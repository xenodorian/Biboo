/* Parry Perry, Dreamcast port: music on the AICA sound chip, no KallistiOS. ON-DEMAND ONLY, see ../README.md
 *
 * The web soundtrack is a small chip-style synth (tools/music/compose.py): two pulse voices and an arpeggio, a triangle bass, a kick, a snare and
 * a hat. tools/bake_music.py runs the composer and bakes its note events at 60 Hz. Here each voice is one AICA channel looping a 32 sample
 * waveform from sound RAM; a note sets the channel's pitch, and a volume envelope is stepped once per frame through the total level register.
 *
 * Channel register layout (offset from 0xa0700000 + 0x80 * channel, 32 bit registers) as I remember it from the AICA documentation and
 * KallistiOS: 0x00 play control (KEYONEX 0x8000, KEYONB 0x4000, loop 0x200, PCM format in bits 7-8, sample address bits 16-22), 0x04 sample
 * address low, 0x08 loop start, 0x0c loop end, 0x10 attack, decay 1 and 2 rates, 0x14 release rate, decay level and loop link, 0x18 pitch
 * (octave in bits 11-14, 10 bit fraction), 0x24 direct send level and pan, 0x28 total level in bits 8-15 (0 is loudest). The ARM core is held in
 * reset so the SH-4 drives the channels (first step of the handoff's chip_init). Every write waits on the G2 FIFO first. */
#include "dc.h"
#include "gen/music_data.h"

#define AICA_BASE   0xa0700000u
#define SNDRAM      0xa0800000u
#define G2_FIFO     (*(volatile u32 *)0xa05f688cu)

#define WAVE_LEN    32
#define NOISE_LEN   2048
#define ADDR_P12    0x0000
#define ADDR_P25    (ADDR_P12 + WAVE_LEN * 2)
#define ADDR_P50    (ADDR_P25 + WAVE_LEN * 2)
#define ADDR_TRI    (ADDR_P50 + WAVE_LEN * 2)
#define ADDR_SINE   (ADDR_TRI + WAVE_LEN * 2)
#define ADDR_NOISE  (ADDR_SINE + WAVE_LEN * 2)
#define AMP16       0x5000

static void g2_wait(void) { while(G2_FIFO & 0x11) { } }
static void aw_raw(u32 addr, u32 v) { g2_wait(); *(volatile u32 *)addr = v; }
static void aw(int ch, u32 off, u32 v) { aw_raw(AICA_BASE + 0x80u * (u32)ch + off, v); }

static void ram_put(u32 addr, const s16 *w, int n) {              /* two samples per 32 bit write */
    int i;
    for(i = 0; i < n; i += 2) aw_raw(SNDRAM + addr + (u32)i * 2, (u32)(u16)w[i] | ((u32)(u16)w[i + 1] << 16));
}
static const s16 SINE32[32] = {0,3995,7837,11378,14482,17028,18921,20086,20480,20086,18921,17028,14482,11378,7837,3995,0,-3995,-7837,-11378,-14482,-17028,-18921,-20086,-20480,-20086,-18921,-17028,-14482,-11378,-7837,-3995};

static void upload_waves(void) {
    s16 w[NOISE_LEN];
    u32 lfsr = 0xace1u;
    int i, duty;
    for(duty = 0; duty < 3; duty++) {                                /* pulse 12.5, 25 and 50 percent */
        int hi = duty == 0 ? 4 : duty == 1 ? 8 : 16;
        for(i = 0; i < WAVE_LEN; i++) w[i] = (s16)(i < hi ? AMP16 : -AMP16);
        ram_put(duty == 0 ? ADDR_P12 : duty == 1 ? ADDR_P25 : ADDR_P50, w, WAVE_LEN);
    }
    for(i = 0; i < WAVE_LEN; i++) {                                  /* triangle in 4 bit steps, like the NES triangle */
        int ph = i < 16 ? i : 32 - i, step = ph * 15 / 16;           /* 0..15..0 */
        w[i] = (s16)((step * 2 - 15) * AMP16 / 15);
    }
    ram_put(ADDR_TRI, w, WAVE_LEN);
    ram_put(ADDR_SINE, SINE32, WAVE_LEN);
    for(i = 0; i < NOISE_LEN; i++) {
        lfsr = (lfsr >> 1) ^ (-(lfsr & 1u) & 0xb400u);               /* a 16 bit maximal length LFSR */
        w[i] = (s16)((lfsr & 1u) ? AMP16 : -AMP16);
    }
    ram_put(ADDR_NOISE, w, NOISE_LEN);
}

typedef struct { int on, note, vel, age, dur; u16 pitch; u8 tl; u32 addr; u32 len; } Voice;
static Voice vc[6];
static int inited, cur_track = -1, ev_i, frame;

static void ch_on(int ch, u32 addr, u32 len, u16 pitch) {
    aw(ch, 0x00, 0x8000);                                            /* key off */
    aw(ch, 0x04, addr & 0xffffu); aw(ch, 0x08, 0); aw(ch, 0x0c, len);
    aw(ch, 0x10, 0x1f); aw(ch, 0x14, 0x1f);                         /* instant attack, no decay, a quick release */
    aw(ch, 0x18, pitch);
    aw(ch, 0x20, 0);
    aw(ch, 0x24, 0x0f00);                                            /* full direct send, centre pan */
    aw(ch, 0x28, 0x24 | (255u << 8));                                /* silent until a note starts */
    aw(ch, 0x00, 0xc000 | 0x200 | ((addr >> 16) & 0x7f));           /* key on, looping, 16 bit PCM */
    vc[ch].addr = addr; vc[ch].len = len; vc[ch].pitch = pitch; vc[ch].tl = 255; vc[ch].on = 0;
}
static void set_pitch(int ch, u16 p) { if(vc[ch].pitch != p) { vc[ch].pitch = p; aw(ch, 0x18, p); } }
static void set_amp(int ch, int amp) {                               /* amp 0..255 -> total level */
    u8 tl = TL_OF_AMP[amp < 0 ? 0 : amp > 255 ? 255 : amp];
    if(vc[ch].tl != tl) { vc[ch].tl = tl; aw(ch, 0x28, 0x24 | ((u32)tl << 8)); }
}

void audio_init(void) {
    int ch;
    aw_raw(0xa0702c00u, 1);                                          /* hold the ARM core in reset so the SH-4 owns the channels */
    upload_waves();
    aw_raw(0xa0702800u, 0x000f);                                     /* master volume */
    ch_on(0, ADDR_P50, WAVE_LEN, NOTE_REG[60]); ch_on(1, ADDR_P12, WAVE_LEN, NOTE_REG[60]); ch_on(2, ADDR_P12, WAVE_LEN, NOTE_REG[60]);
    ch_on(3, ADDR_TRI, WAVE_LEN, NOTE_REG[36]); ch_on(4, ADDR_SINE, WAVE_LEN, KICK_REG[0]); ch_on(5, ADDR_NOISE, NOISE_LEN, NOISE_SNARE_REG);
    for(ch = 0; ch < 6; ch++) vc[ch].on = 0;
    inited = 1;
}

static void silence(void) { int ch; for(ch = 0; ch < 6; ch++) { vc[ch].on = 0; set_amp(ch, 0); } }

void audio_want(int track) {                                         /* -1 for silence; asking for the track that already plays does nothing */
    if(!inited || track == cur_track) return;
    cur_track = track; ev_i = 0; frame = 0;
    silence();
    if(track >= 0) {                                                 /* the lead's pulse width is per song */
        u32 a = TRACKS[track].duty == 0 ? ADDR_P12 : TRACKS[track].duty == 1 ? ADDR_P25 : ADDR_P50;
        ch_on(0, a, WAVE_LEN, vc[0].pitch);
    }
}

static const u8 DEC_FRAMES[4] = {5, 4, 3, 3};                        /* decay time of lead, harmony, arpeggio and bass in frames (web envelopes) */
static const u8 SUSTAIN[4] = {75, 70, 35, 90};                       /* and the sustain level in percent */
static const u8 KICK_ENV[9] = {100, 72, 51, 37, 26, 19, 14, 10, 7};   /* exp(-t * 20) at 60 Hz */
static const u8 SNARE_ENV[8] = {100, 65, 42, 28, 18, 12, 7, 5};      /* exp(-t * 26) */

static void note_on(const MusicEvent *e) {
    Voice *v = &vc[e->voice];
    v->on = 1; v->note = e->note; v->vel = e->vel; v->age = 0; v->dur = e->dur;
    if(e->voice <= 3) set_pitch(e->voice, NOTE_REG[e->note & 127]);
    else if(e->voice == 5) set_pitch(5, e->note == 38 ? NOISE_SNARE_REG : NOISE_HAT_REG);
}

void audio_tick(void) {                                              /* once per frame */
    const Track *t;
    int ch;
    if(!inited || cur_track < 0) return;
    t = &TRACKS[cur_track];
    while(ev_i < t->nev && t->ev[ev_i].frame <= frame) note_on(&t->ev[ev_i++]);
    for(ch = 0; ch < 6; ch++) {
        Voice *v = &vc[ch];
        int a;
        if(!v->on) { set_amp(ch, 0); continue; }
        if(ch <= 3) {
            int d = DEC_FRAMES[ch], s = SUSTAIN[ch], env;
            if(v->age >= v->dur + 1) { v->on = 0; set_amp(ch, 0); continue; }
            env = v->age >= d ? s : 100 - (100 - s) * v->age / d;
            if(v->age >= v->dur) env = env * 4 / 10;                 /* the release: one soft frame */
            a = VOICE_AMP[ch] * v->vel / 100 * env / 100;
        } else if(ch == 4) {
            if(v->age >= 9) { v->on = 0; set_amp(ch, 0); continue; }
            set_pitch(4, KICK_REG[v->age]);
            a = VOICE_AMP[4] * v->vel / 110 * KICK_ENV[v->age] / 100;
        } else if(v->note == 38) {                                   /* snare */
            if(v->age >= 8) { v->on = 0; set_amp(ch, 0); continue; }
            a = VOICE_AMP[5] * v->vel / 105 * SNARE_ENV[v->age] / 100;
        } else {                                                     /* hat: a very short noise tick */
            if(v->age >= 2) { v->on = 0; set_amp(ch, 0); continue; }
            a = VOICE_AMP[5] * 43 / 100 * v->vel / 75 * (v->age == 0 ? 100 : 22) / 100;
        }
        set_amp(ch, a);
        v->age++;
    }
    if(++frame >= t->frames) { frame = 0; ev_i = 0; }                /* the song loops */
}
