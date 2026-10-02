/* Parry Perry, Dreamcast port. Phase 1 to 3: boot, video, text, pad, frame cost.
 *
 * Bare metal (no KallistiOS), written from the CryMon port handoff (video: Appendix D, pad: Appendix E). No C library:
 * memset and memcpy are defined here. Everything is static arrays, float only (-m4-single-only).
 * ON-DEMAND ONLY: see ../README.md. */
typedef unsigned int u32;
typedef unsigned short u16;
typedef unsigned char u8;
typedef int s32;

/* ------------------------------------------------------------------ no C library */
void *memset(void *d, int c, unsigned int n) { u8 *p = d; while (n--) *p++ = (u8)c; return d; }
void *memcpy(void *d, const void *s, unsigned int n) { u8 *a = d; const u8 *b = s; while (n--) *a++ = *b++; return d; }

#include "font8x8_basic.h"

/* ------------------------------------------------------------------ video (320x240, RGB565, NTSC, CPU drawn) */
#define PVR_BASE 0xa05f8000u
#define PVR(reg) (*(volatile u32 *)(PVR_BASE + (reg)))
#define PVR_BORDER_COLOR 0x040
#define PVR_FB_CFG_1     0x044
#define PVR_FB_CFG_2     0x048
#define PVR_RENDER_MODULO 0x04c
#define PVR_FB_ADDR      0x050
#define PVR_FB_SIZE      0x05c
#define PVR_VPOS_IRQ     0x0cc
#define PVR_IL_CFG       0x0d0
#define PVR_BORDER_X     0x0d4
#define PVR_SCAN_CLK     0x0d8
#define PVR_BORDER_Y     0x0dc
#define PVR_VIDEO_CFG    0x0e8
#define PVR_BITMAP_X     0x0ec
#define PVR_BITMAP_Y     0x0f0
#define PVR_SYNC_STATUS  0x10c

#define SCREEN_W 320
#define SCREEN_H 240

#define FB_OFFSET0 0x000000u
#define FB_OFFSET1 0x040000u
static u32 fb_back_offset = FB_OFFSET1;
static volatile u16 *draw_fb = (volatile u16 *)(0xa5000000u + FB_OFFSET1);

/* Show the buffer that was drawn last frame, then draw into the other one (redraw every frame). */
static void fb_flip(void) {
    PVR(PVR_FB_ADDR) = fb_back_offset;
    fb_back_offset = (fb_back_offset == FB_OFFSET0) ? FB_OFFSET1 : FB_OFFSET0;
    draw_fb = (volatile u16 *)(0xa5000000u + fb_back_offset);
}

/* DM_320x240_NTSC timing, from KallistiOS's vid_builtin table */
#define SCANLINES 262
#define CLOCKS    857
#define BITMAPX   164
#define BITMAPY   24
#define SCANINT1  21
#define SCANINT2  260
#define BORDERX1  141
#define BORDERX2  843
#define BORDERY1  24
#define BORDERY2  263

static void video_init(void) {
    PVR(PVR_VIDEO_CFG) = PVR(PVR_VIDEO_CFG) | 0x8u;
    PVR(PVR_FB_CFG_1)  = PVR(PVR_FB_CFG_1) & ~1u;
    PVR(PVR_BORDER_COLOR) = 0;
    PVR(PVR_FB_CFG_1) = (1u << 2);
    PVR(PVR_FB_CFG_2) = 1u | (1u << 3);
    PVR(PVR_RENDER_MODULO) = (SCREEN_W * 2) / 8;
    PVR(PVR_FB_ADDR) = 0;
    PVR(PVR_FB_SIZE) = (((SCREEN_W * 2) / 4) - 1) | (1u << 20) | ((SCREEN_H - 1u) << 10);
    PVR(PVR_VPOS_IRQ) = (SCANINT1 << 16) | SCANINT2;
    PVR(PVR_IL_CFG) = 0x100;
    PVR(PVR_BORDER_X) = (BORDERX1 << 16) | BORDERX2;
    PVR(PVR_BORDER_Y) = (BORDERY1 << 16) | BORDERY2;
    PVR(PVR_SCAN_CLK) = (SCANLINES << 16) | CLOCKS;
    PVR(PVR_VIDEO_CFG) = PVR(PVR_VIDEO_CFG) | 0x100u;
    PVR(PVR_BITMAP_X) = BITMAPX;
    PVR(PVR_BITMAP_Y) = (BITMAPY << 16) | BITMAPY;
    *(volatile u32 *)0xa0702c00 = (*(volatile u32 *)0xa0702c00 & 0xfffffcffu) | (3u << 8);
    PVR(PVR_VIDEO_CFG) = PVR(PVR_VIDEO_CFG) & ~0x8u;
    PVR(PVR_FB_CFG_1)  = PVR(PVR_FB_CFG_1) | 1u;
}

/* wait for vblank to start, then to end: one fresh frame per call (checked against KOS vid_waitvbl) */
static void wait_vblank(void) {
    while(!(PVR(PVR_SYNC_STATUS) & 0x01ffu)) ;
    while(PVR(PVR_SYNC_STATUS) & 0x01ffu) ;
}

/* ------------------------------------------------------------------ timer: SH-4 TMU channel 0, Pclk/4 = 12.5 MHz */
#define TMU_TSTR  (*(volatile u8  *)0xffd80004)
#define TMU_TCOR0 (*(volatile u32 *)0xffd80008)
#define TMU_TCNT0 (*(volatile u32 *)0xffd8000c)
#define TMU_TCR0  (*(volatile u16 *)0xffd80010)
static void timer_init(void) {
    TMU_TSTR &= (u8)~1u;
    TMU_TCOR0 = 0xffffffffu;
    TMU_TCNT0 = 0xffffffffu;
    TMU_TCR0 = 0;                                /* Pclk/4 */
    TMU_TSTR |= 1u;
}
static u32 timer_now(void) { return 0xffffffffu - TMU_TCNT0; }   /* ticks since start; 12.5 ticks per microsecond */

/* ------------------------------------------------------------------ drawing */
#define RGB(r, g, b) ((u16)((((r) >> 3) << 11) | (((g) >> 2) << 5) | ((b) >> 3)))

static void put_pixel(int x, int y, u16 c) {
    if((u32)x < SCREEN_W && (u32)y < SCREEN_H) draw_fb[y * SCREEN_W + x] = c;
}
static void fill_rect(int x, int y, int w, int h, u16 c) {
    int i, j;
    if(x < 0) { w += x; x = 0; }
    if(y < 0) { h += y; y = 0; }
    if(x + w > SCREEN_W) w = SCREEN_W - x;
    if(y + h > SCREEN_H) h = SCREEN_H - y;
    for(j = 0; j < h; j++) for(i = 0; i < w; i++) draw_fb[(y + j) * SCREEN_W + x + i] = c;
}
static void draw_char(int x, int y, int ch, u16 c) {
    const u8 *g;
    int row, col;
    if(ch < 0 || ch > 127) ch = '?';
    g = font8x8_basic[ch];
    for(row = 0; row < 8; row++) for(col = 0; col < 8; col++) if((g[row] >> col) & 1) put_pixel(x + col, y + row, c);
}
static void draw_text(int x, int y, const char *s, u16 c) { while(*s) { draw_char(x, y, *s++, c); x += 8; } }
static void draw_num(int x, int y, u32 v, u16 c) {
    char buf[12]; int n = 0, i;
    if(v == 0) buf[n++] = '0';
    while(v) { buf[n++] = (char)('0' + v % 10); v /= 10; }
    for(i = 0; i < n; i++) draw_char(x + i * 8, y, buf[n - 1 - i], c);
}

/* ------------------------------------------------------------------ controller (Maple bus, port A unit 0), buttons are active low */
#define MAPLE_BASE      0xa05f6c00u
#define MAPLE_DMA_ADDR  (*(volatile u32 *)(MAPLE_BASE + 0x04))
#define MAPLE_DMA_TSEL  (*(volatile u32 *)(MAPLE_BASE + 0x10))
#define MAPLE_ENABLE    (*(volatile u32 *)(MAPLE_BASE + 0x14))
#define MAPLE_STATE     (*(volatile u32 *)(MAPLE_BASE + 0x18))
#define MAPLE_SPEED     (*(volatile u32 *)(MAPLE_BASE + 0x80))
#define MAPLE_DMA_PROT  (*(volatile u32 *)(MAPLE_BASE + 0x8c))
#define MAPLE_COMMAND_GETCOND   9
#define MAPLE_RESPONSE_DATATRF  8
#define MAPLE_FUNC_CONTROLLER   0x01000000u
#define CONT_C 1u
#define CONT_B 2u
#define CONT_A 4u
#define CONT_START 8u
#define CONT_UP 16u
#define CONT_DOWN 32u
#define CONT_LEFT 64u
#define CONT_RIGHT 128u
#define CONT_Z 256u
#define CONT_Y 512u
#define CONT_X 1024u

static u32 maple_cmd_buf[8]   __attribute__((aligned(32)));
static u32 maple_resp_buf[64] __attribute__((aligned(32)));
#define P2(p)   ((volatile u32 *)(((u32)(p)) | 0x20000000u))
#define PHYS(p) (((u32)(p)) & 0x1fffffffu)

static void maple_init(void) {
    MAPLE_DMA_PROT = 0x6155404fu;
    MAPLE_DMA_TSEL = 0;
    MAPLE_SPEED = 0x0000u | (50000u << 16);
    MAPLE_ENABLE = 1;
}
/* returns the raw button word (a 0 bit means pressed), or 0xffff when no controller answers */
static u16 maple_poll_buttons(void) {
    volatile u32 *cmd  = P2(maple_cmd_buf);
    volatile u32 *resp = P2(maple_resp_buf);
    u32 timeout;
    cmd[0] = 1u | (0u << 16) | 0x80000000u;
    cmd[1] = PHYS(maple_resp_buf);
    cmd[2] = MAPLE_COMMAND_GETCOND | (0x20u << 8) | (0u << 16) | (1u << 24);
    cmd[3] = MAPLE_FUNC_CONTROLLER;
    MAPLE_DMA_ADDR = PHYS(maple_cmd_buf);
    MAPLE_STATE = 1;
    for(timeout = 0; timeout < 100000u; timeout++) if(MAPLE_STATE == 0) break;   /* bounded: no pad must not stall every frame */
    if(MAPLE_STATE != 0) return 0xffff;
    if((resp[0] & 0xffu) != MAPLE_RESPONSE_DATATRF) return 0xffff;
    if(resp[1] != MAPLE_FUNC_CONTROLLER) return 0xffff;
    return (u16)(resp[2] & 0xffffu);
}
static int pressed(u16 raw, u16 mask) { return (raw & mask) == 0; }

/* ------------------------------------------------------------------ the Phase 1 to 3 screen */
static void draw_button(int x, int y, const char *label, int on) {
    fill_rect(x, y, 22, 14, on ? RGB(240, 180, 76) : RGB(60, 60, 80));
    draw_text(x + 3, y + 3, label, on ? RGB(0, 0, 0) : RGB(200, 200, 210));
}

int main(void) {
    u32 frame = 0, t0, draw_us = 0, frame_us = 0, last_start;
    u16 raw;
    int sx = 40, i, j;
    video_init();
    maple_init();
    timer_init();
    /* draw one frame into the hidden buffer so the first flip shows something */
    fill_rect(0, 0, SCREEN_W, SCREEN_H, RGB(20, 20, 40));
    last_start = timer_now();
    for(;;) {
        wait_vblank();
        fb_flip();
        t0 = timer_now();
        frame_us = (t0 - last_start) / 25 * 2;           /* 12.5 ticks per microsecond */
        last_start = t0;
        frame++;
        raw = maple_poll_buttons();

        /* background: a full-screen pattern, redrawn every frame (the Phase 2 workload) */
        for(j = 0; j < SCREEN_H; j++) {
            u16 *row = (u16 *)&draw_fb[j * SCREEN_W];
            u16 c = RGB(20 + (j >> 2), 30 + (j >> 3), 70 + (j >> 2));
            for(i = 0; i < SCREEN_W; i++) row[i] = c;
        }
        /* a few moving blocks standing in for sprites */
        sx = (int)((frame * 3) % (SCREEN_W + 64)) - 64;
        fill_rect(sx, 150, 48, 48, RGB(180, 70, 60));
        fill_rect(SCREEN_W - 48 - sx / 2, 170, 32, 32, RGB(60, 160, 90));

        draw_text(80, 16, "PARRY PERRY", RGB(255, 220, 120));
        draw_text(40, 30, "DREAMCAST PORT : PHASE 1 TO 3", RGB(220, 220, 230));
        draw_text(16, 56, "FRAME", RGB(180, 200, 255)); draw_num(72, 56, frame, RGB(255, 255, 255));
        draw_text(16, 68, "FRAME US", RGB(180, 200, 255)); draw_num(88, 68, frame_us, RGB(255, 255, 255));
        draw_text(16, 80, "DRAW US", RGB(180, 200, 255)); draw_num(80, 80, draw_us, RGB(255, 255, 255));
        draw_text(16, 92, raw == 0xffff ? "PAD: NONE OR NOTHING PRESSED" : "PAD: ACTIVE", RGB(180, 200, 255));
        draw_text(16, 104, "RAW", RGB(180, 200, 255)); draw_num(48, 104, raw, RGB(255, 255, 255));

        draw_button(16, 124, "UP", pressed(raw, CONT_UP));
        draw_button(16, 142, "DN", pressed(raw, CONT_DOWN));
        draw_button(42, 133, "LF", pressed(raw, CONT_LEFT));
        draw_button(68, 133, "RT", pressed(raw, CONT_RIGHT));
        draw_button(130, 124, "A", pressed(raw, CONT_A));
        draw_button(156, 124, "B", pressed(raw, CONT_B));
        draw_button(130, 142, "X", pressed(raw, CONT_X));
        draw_button(156, 142, "Y", pressed(raw, CONT_Y));
        draw_button(200, 133, "ST", pressed(raw, CONT_START));

        draw_us = (timer_now() - t0) / 25 * 2;
    }
    return 0;
}
