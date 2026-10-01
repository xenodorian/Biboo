#!/usr/bin/env python3
"""Parry Perry soundtrack generator.

Tools used: mido (writes the .mid files, pip install mido), numpy (a small NES-style synth: two pulse channels,
a triangle bass, a noise drum channel) and ffmpeg (WAV to ogg and mp3).  Every song is composed here from a seeded
rule set (scale, chord progression per bar, motif and answer phrases, bass pattern, arpeggio, drum pattern), so
the whole soundtrack is original and repeatable.  Run:  python3 tools/music/compose.py [song ...]
Output: web/assets/music/<id>.ogg, <id>.mp3, <id>.mid  and web/assets/music.js (the track list).
"""
import os, sys, random, subprocess, json
import numpy as np
import mido

SR = 32000
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'web', 'assets', 'music')
SCALES = {'major': [0,2,4,5,7,9,11], 'minor': [0,2,3,5,7,8,10], 'dorian': [0,2,3,5,7,9,10], 'phrygian': [0,1,3,5,7,8,10],
          'mixolydian': [0,2,4,5,7,9,10], 'harmonic': [0,2,3,5,7,8,11], 'lydian': [0,2,4,6,7,9,11]}
NOTE = {'C':0,'C#':1,'D':2,'D#':3,'E':4,'F':5,'F#':6,'G':7,'G#':8,'A':9,'A#':10,'B':11}

# rhythm banks, durations in sixteenth notes (each sums to 16); negative = rest
BANK = {
  'flow': [[4,4,4,4],[6,2,4,4],[4,2,2,8],[2,2,4,4,4],[8,4,4],[4,4,8],[6,2,8]],
  'busy': [[2,2,2,2,2,2,2,2],[4,2,2,4,2,2],[2,2,4,2,2,4],[3,3,2,3,3,2],[2,2,2,2,4,2,2,2],[4,2,2,2,2,4]],
  'slow': [[8,8],[12,4],[8,4,4],[16],[6,2,8],[8,6,2]],
  'sparse': [[-4,4,-2,2,4],[-8,8],[4,-4,8],[-2,2,4,-4,4],[8,-4,4]],
}
DRUMS = {
  'rock':  dict(k=[0,8], s=[4,12], h=list(range(0,16,2))),
  'drive': dict(k=[0,6,8,10], s=[4,12], h=list(range(0,16,2))),
  'march': dict(k=[0,4,8,12], s=[4,12], h=list(range(0,16,4))),
  'half':  dict(k=[0,10], s=[8], h=list(range(0,16,4))),
  'boss':  dict(k=[0,3,6,8,11,14], s=[4,12], h=list(range(0,16,2))),
  'gallop':dict(k=[0,2,3,8,10,11], s=[4,12], h=list(range(1,16,2))),
  'light': dict(k=[0], s=[8], h=[]),
  'none':  dict(k=[], s=[], h=[]),
}

# id: spec.  prog A/B are scale degrees (0 = tonic), one chord per bar.
SONGS = {
 'level1': dict(key='C', mode='major', bpm=132, A=[0,4,5,3,0,4,3,4], B=[5,3,0,4,5,3,1,4], rhythm='flow', drums='drive', bass='root8', arp=8, duty=.5, seed=11, harm=True),
 'level2': dict(key='D', mode='dorian', bpm=118, A=[0,3,0,4,0,3,6,4], B=[5,4,3,0,5,4,1,4], rhythm='flow', drums='rock', bass='walk', arp=16, duty=.25, seed=22, harm=True),
 'level3': dict(key='E', mode='phrygian', bpm=126, A=[0,1,0,6,0,1,5,6], B=[3,2,1,0,3,5,1,0], rhythm='busy', drums='march', bass='drive', arp=8, duty=.5, seed=33, harm=False),
 'level4': dict(key='G', mode='mixolydian', bpm=106, A=[0,6,3,0,0,6,3,4], B=[5,3,0,0,5,3,6,4], rhythm='flow', drums='half', bass='offbeat', arp=8, duty=.25, seed=44, harm=True),
 'level5': dict(key='F#', mode='minor', bpm=138, A=[0,0,5,6,0,0,3,4], B=[2,6,0,5,2,6,3,4], rhythm='busy', drums='drive', bass='drive', arp=16, duty=.125, seed=55, harm=False),
 'level6': dict(key='D', mode='harmonic', bpm=120, A=[0,5,3,4,0,5,1,4], B=[2,5,3,0,2,5,1,4], rhythm='flow', drums='rock', bass='root8', arp=16, duty=.5, seed=66, harm=True),
 'boss1': dict(key='A', mode='minor', bpm=156, A=[0,0,5,4,0,0,6,4], B=[5,4,0,0,5,4,6,6], rhythm='busy', drums='boss', bass='drive', arp=16, duty=.5, seed=101, harm=True, bars=24),
 'boss2': dict(key='C#', mode='phrygian', bpm=148, A=[0,1,0,1,0,1,6,5], B=[3,2,1,1,3,2,6,0], rhythm='sparse', drums='gallop', bass='pedal', arp=16, duty=.125, seed=102, harm=False, bars=24),
 'boss3': dict(key='E', mode='harmonic', bpm=160, A=[0,5,0,5,3,4,0,4], B=[5,4,3,4,5,4,0,4], rhythm='busy', drums='boss', bass='drive', arp=16, duty=.25, seed=103, harm=True, bars=24),
 'boss4': dict(key='D', mode='minor', bpm=144, A=[0,0,6,6,5,5,4,4], B=[0,2,3,4,0,2,5,4], rhythm='flow', drums='march', bass='root8', arp=8, duty=.5, seed=104, harm=True, bars=24),
 'boss5': dict(key='G', mode='minor', bpm=168, A=[0,6,5,6,0,6,5,4], B=[3,2,0,4,3,2,5,4], rhythm='busy', drums='gallop', bass='drive', arp=16, duty=.25, seed=105, harm=True, bars=24),
 'boss6': dict(key='A', mode='harmonic', bpm=176, A=[0,5,4,5,0,3,1,4], B=[5,6,4,0,5,6,1,4], rhythm='busy', drums='gallop', bass='drive', arp=16, duty=.5, seed=106, harm=True, bars=32),
 'overworld': dict(key='G', mode='major', bpm=112, A=[0,3,4,0,5,3,1,4], B=[3,4,5,2,3,4,1,4], rhythm='flow', drums='half', bass='walk', arp=8, duty=.5, seed=203, harm=True, bars=24),
 'training': dict(key='A', mode='lydian', bpm=96, A=[0,1,0,1,3,1,0,4], B=[5,3,0,4,5,3,1,4], rhythm='slow', drums='half', bass='offbeat', arp=8, duty=.25, seed=201, harm=True, bars=16),
 'shop': dict(key='F', mode='major', bpm=104, A=[0,5,1,4,0,5,3,4], B=[3,4,0,5,3,4,1,4], rhythm='flow', drums='light', bass='walk', arp=8, duty=.25, seed=202, harm=False, bars=16),
 'prologue': dict(key='A', mode='minor', bpm=72, A=[0,5,3,4,0,5,6,4], B=[2,5,3,0,2,5,4,4], rhythm='slow', drums='none', bass='pedal', arp=8, duty=.5, seed=301, harm=True, bars=16),
 'ending': dict(key='C', mode='major', bpm=66, A=[0,5,3,4,0,2,3,4], B=[5,3,0,4,5,3,1,0], rhythm='slow', drums='none', bass='pedal', arp=8, duty=.25, seed=302, harm=True, bars=16),
}

def pitch(spec, deg, base):
    sc = SCALES[spec['mode']]
    return base + NOTE[spec['key']] + sc[deg % 7] + 12 * (deg // 7)

def chord_degs(d): return [d, d + 2, d + 4]

def compose(spec):
    rnd = random.Random(spec['seed']); bpm = spec['bpm']; step = 60.0 / bpm / 4
    nbars = spec.get('bars', 32)
    form = []
    for i in range(nbars // 8): form.append('A' if i % 2 == 0 else 'B')
    if nbars >= 32: form[-1] = 'B'
    ev = {'lead': [], 'harm': [], 'arp': [], 'bass': [], 'drum': []}      # (start_step, dur_steps, midi, vel)
    def bar_notes(prog_bar, lead_start, pat_name, prev):
        pat = rnd.choice(BANK[pat_name]); out = []; pos = 0; cur = prev
        ch = [d % 7 for d in chord_degs(prog_bar)]
        for dur in pat:
            if dur < 0: pos += -dur; continue
            strong = pos in (0, 8)
            if strong or rnd.random() < .22:                              # snap to a chord tone
                cands = [d for d in range(cur - 4, cur + 5) if d % 7 in ch]
                cur = min(cands, key=lambda d: abs(d - cur) + rnd.random() * .9)
            else:
                cur += rnd.choice([-2, -1, -1, 1, 1, 2])
            cur = max(5, min(cur, 19)); out.append((pos, dur, cur)); pos += dur
        return out, cur
    for si, sec in enumerate(form):
        prog = spec[sec]; base_bar = si * 8
        motif = {}; cur = 11
        melody = {}
        for b in range(8):
            if b in (4, 5) and sec == form[si] and (0 in melody) and (b - 4) in melody: melody[b] = [(p, d, n) for p, d, n in melody[b - 4]]; continue
            if b == 2 and 0 in melody: melody[b] = [(p, d, n + rnd.choice([-1, 1, 2])) for p, d, n in melody[0]]; continue
            if b == 6 and 2 in melody: melody[b] = [(p, d, n + rnd.choice([-2, 1])) for p, d, n in melody[2]]; continue
            notes, cur = bar_notes(prog[b], b, spec['rhythm'], cur); melody[b] = notes
        for b in range(8):
            ch = [d % 7 for d in chord_degs(prog[b])]
            notes = melody[b]
            if b in (3, 7) and notes:                                     # cadence: end the phrase on a stable tone
                p, d, n = notes[-1]; tgt = 0 if b == 7 else 4
                notes[-1] = (p, d, min([x for x in range(n - 4, n + 5) if x % 7 == tgt] or [n], key=lambda x: abs(x - n)))
            if b in (2, 6, 3, 7):                                         # snap the whole bar's notes diatonic after the edits (already scale degrees)
                pass
            for p, d, n in notes:
                up = 2 if (sec == 'B' and si >= 2) else 0
                st = (base_bar + b) * 16 + p
                ev['lead'].append((st, max(1, d - (1 if d > 2 else 0)), pitch(spec, n + up, 48), 100))
                if spec['harm'] and (sec == 'B' or si >= 2):
                    ev['harm'].append((st, max(1, d - 1), pitch(spec, n - 2 + up, 48), 70))
            root = prog[b]; bst = (base_bar + b) * 16; kind = spec['bass']
            r = pitch(spec, root, 36); fifth = pitch(spec, root + 4, 36); third = pitch(spec, root + 2, 36)
            if kind == 'root8':
                for i in range(8): ev['bass'].append((bst + i * 2, 2, r + (12 if i % 2 else 0) - (0 if i % 4 else 0), 100))
            elif kind == 'drive':
                for i in range(16):
                    if i % 4 == 3: ev['bass'].append((bst + i, 1, fifth, 90))
                    elif i % 2 == 0: ev['bass'].append((bst + i, 2, r, 100))
            elif kind == 'walk':
                for i, n in enumerate([r, third, fifth, third]): ev['bass'].append((bst + i * 4, 4, n, 100))
            elif kind == 'offbeat':
                for i in range(4): ev['bass'].append((bst + i * 4 + 2, 2, r if i % 2 == 0 else fifth, 100)); ev['bass'].append((bst + i * 4, 1, r - 12 if r - 12 >= 28 else r, 80))
            else:                                                          # pedal: held root, fifth in the second half
                ev['bass'].append((bst, 8, r, 100)); ev['bass'].append((bst + 8, 8, r if b % 2 else fifth, 90))
            if spec['arp']:
                tones = [pitch(spec, d, 48) for d in (root, root + 2, root + 4, root + 7)]
                seq = [0, 1, 2, 3, 2, 1] if spec['arp'] == 16 else [0, 2, 1, 3]
                stp = 1 if spec['arp'] == 16 else 2
                for i in range(16 // stp): ev['arp'].append((bst + i * stp, stp, tones[seq[i % len(seq)]] + (12 if i % 8 >= 4 else 0), 60))
            dp = DRUMS[spec['drums']]
            fill = (b == 7 and spec['drums'] not in ('none', 'light'))
            for k in dp['k']: ev['drum'].append((bst + k, 1, 36, 110))
            for s_ in dp['s']:
                if fill and s_ >= 12: continue
                ev['drum'].append((bst + s_, 1, 38, 105))
            for hh in dp['h']: ev['drum'].append((bst + hh, 1, 42, 55 if hh % 4 else 75))
            if fill:
                for i in range(12, 16): ev['drum'].append((bst + i, 1, 38, 80 + (i - 12) * 8))
    for k, hi in (('lead', 84), ('harm', 80), ('arp', 84)):            # keep every voice in a comfortable range
        ev[k] = [(a, b, m - 12 if m > hi else m, v) for a, b, m, v in ev[k]]
    return ev, nbars * 16, step

# ---------- synth ----------
def env(n, a, d, s, r, sr=SR):
    e = np.ones(n, dtype=np.float32); ai = max(1, int(a * sr)); di = max(1, int(d * sr)); ri = max(1, min(n, int(r * sr)))
    ai = min(ai, n); e[:ai] = np.linspace(0, 1, ai, dtype=np.float32)
    dend = min(n, ai + di)
    if dend > ai: e[ai:dend] = np.linspace(1, s, dend - ai, dtype=np.float32)
    e[dend:] = s
    e[-ri:] *= np.linspace(1, 0, ri, dtype=np.float32)
    return e

def mtof(m): return 440.0 * 2 ** ((m - 69) / 12.0)

def pulse(freq, n, duty, vib=0.0):
    t = np.arange(n, dtype=np.float64) / SR
    if vib: freq = freq * (1 + vib * np.sin(2 * np.pi * 5.5 * t) * np.clip((t - .12) * 6, 0, 1))
    ph = np.cumsum(freq / SR) % 1.0
    return np.where(ph < duty, 1.0, -1.0).astype(np.float32)

def tri(freq, n):
    ph = (np.arange(n) * freq / SR) % 1.0
    w = 4 * np.abs(ph - .5) - 1
    return (np.round((w + 1) * 7.5) / 7.5 - 1).astype(np.float32)              # 4-bit steps, like the NES triangle

def noise_burst(n, rate, rng):
    hold = max(1, int(SR / rate)); raw = rng.choice([-1.0, 1.0], size=n // hold + 2).astype(np.float32)
    return np.repeat(raw, hold)[:n]

def render(ev, total_steps, step, spec):
    n_total = int(total_steps * step * SR); tail = int(2.0 * SR)
    buf = np.zeros(n_total + tail, dtype=np.float32); rng = np.random.default_rng(spec['seed'])
    def add(sig, st):
        i0 = int(st * step * SR); sig = sig[:len(buf) - i0]
        buf[i0:i0 + len(sig)] += sig
    for st, dur, m, vel in ev['lead']:
        n = int(dur * step * SR) + int(.03 * SR); w = pulse(mtof(m), n, spec['duty'], vib=.006) * env(n, .004, .08, .75, .03)
        add(w * .20 * vel / 100, st)
    for st, dur, m, vel in ev['harm']:
        n = int(dur * step * SR) + int(.02 * SR); w = pulse(mtof(m), n, .125) * env(n, .004, .06, .7, .03)
        add(w * .11 * vel / 100, st)
    for st, dur, m, vel in ev['arp']:
        n = int(dur * step * SR * 1.0) + int(.02 * SR); w = pulse(mtof(m), n, .125) * env(n, .002, .05, .35, .02)
        add(w * .09 * vel / 100, st)
    for st, dur, m, vel in ev['bass']:
        n = int(dur * step * SR); w = tri(mtof(m), n) * env(n, .003, .05, .9, .015)
        add(w * .32 * vel / 100, st)
    for st, dur, m, vel in ev['drum']:
        if m == 36:
            n = int(.14 * SR); t = np.arange(n) / SR; f = 150 * np.exp(-t * 28) + 42
            w = np.sin(2 * np.pi * np.cumsum(f) / SR).astype(np.float32) * np.exp(-t * 20).astype(np.float32); add(w * .45 * vel / 110, st)
        elif m == 38:
            n = int(.13 * SR); t = np.arange(n) / SR
            w = (noise_burst(n, 9000, rng) * .8 + np.sin(2 * np.pi * 190 * t) * .3).astype(np.float32) * np.exp(-t * 26).astype(np.float32); add(w * .3 * vel / 105, st)
        else:
            n = int(.04 * SR); t = np.arange(n) / SR
            w = noise_burst(n, 16000, rng) * np.exp(-t * 90).astype(np.float32); add(w * .13 * vel / 75, st)
    loop = buf[:n_total].copy(); loop[:tail] += buf[n_total:n_total + tail] if tail <= len(buf) - n_total else 0   # the ring-out wraps onto the start: seamless loop
    loop = loop / max(1e-6, np.abs(loop).max()) * .85
    return loop

def write_midi(ev, spec, path):
    mid = mido.MidiFile(ticks_per_beat=480); tpq = 480 // 4
    names = [('lead', 0, 80), ('harm', 1, 81), ('arp', 2, 80), ('bass', 3, 38), ('drum', 9, 0)]
    conductor = mido.MidiTrack(); conductor.append(mido.MetaMessage('set_tempo', tempo=mido.bpm2tempo(spec['bpm']))); conductor.append(mido.MetaMessage('track_name', name=spec.get('title', 'song'))); mid.tracks.append(conductor)
    for name, ch, prog in names:
        tr = mido.MidiTrack(); tr.append(mido.MetaMessage('track_name', name=name))
        if ch != 9: tr.append(mido.Message('program_change', program=prog, channel=ch))
        msgs = []
        for st, dur, m, vel in ev[name]:
            msgs.append((st * tpq, 1, mido.Message('note_on', note=m, velocity=min(127, vel), channel=ch)))
            msgs.append(((st + dur) * tpq, 0, mido.Message('note_off', note=m, velocity=0, channel=ch)))
        msgs.sort(key=lambda x: (x[0], x[1])); last = 0
        for t, _, msg in msgs: msg.time = int(t - last); last = t; tr.append(msg)
        mid.tracks.append(tr)
    mid.save(path)

def wav_write(path, a):
    import wave
    with wave.open(path, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((a * 32767).astype('<i2').tobytes())

def main():
    os.makedirs(OUT, exist_ok=True); ids = sys.argv[1:] or list(SONGS); info = {}
    for sid in ids:
        spec = SONGS[sid]; spec['title'] = sid
        ev, steps, step = compose(spec); a = render(ev, steps, step, spec)
        wav = os.path.join(OUT, sid + '.wav'); wav_write(wav, a); write_midi(ev, spec, os.path.join(OUT, sid + '.mid'))
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, '-c:a', 'libvorbis', '-q:a', '1', os.path.join(OUT, sid + '.ogg')], check=True)
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, '-c:a', 'libmp3lame', '-b:a', '64k', os.path.join(OUT, sid + '.mp3')], check=True)
        os.remove(wav); info[sid] = round(steps * step, 2); print(sid, info[sid], 's')
    full = {s: round(compose(SONGS[s])[1] * compose(SONGS[s])[2], 2) for s in SONGS}
    with open(os.path.join(OUT, '..', 'music.js'), 'w') as f:
        f.write('/* generated by tools/music/compose.py */\nwindow.BIBOO = window.BIBOO || {};\nwindow.BIBOO.music = ' + json.dumps({'dir': 'assets/music/', 'tracks': full}) + ';\n')

if __name__ == '__main__': main()
