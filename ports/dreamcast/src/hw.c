/* Dreamcast hardware: video (320x240 RGB565, double buffered, CPU drawn), Maple controller, SH-4 timer.
 * From the CryMon port handoff (Appendices D and E). No C library: memset and memcpy are defined here. */
#include "dc.h"

void *memset(void *d, int c, unsigned int n) { u8 *p = d; while (n--) *p++ = (u8)c; return d; }
void *memcpy(void *d, const void *s, unsigned int n) { u8 *a = d; const u8 *b = s; while (n--) *a++ = *b++; return d; }

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

#define SCREEN_W SCR_W
#define SCREEN_H SCR_H

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


/* ------------------------------------------------------------------ the API used by the game */
void hw_init(void) { video_init(); maple_init(); timer_init(); }
u16 hw_pad(void) { return maple_poll_buttons(); }
u32 hw_ticks(void) { return timer_now(); }
/* The frame is copied into the hidden buffer 32 bits at a time, then the vertical blank is waited for and the buffers are flipped. */
void hw_present(const u16 *frame) {
    const u32 *s = (const u32 *)frame;
    volatile u32 *d = (volatile u32 *)draw_fb;
    u32 i, n = (u32)SCREEN_W * SCREEN_H / 2;
    for(i = 0; i < n; i++) d[i] = s[i];
    wait_vblank();
    fb_flip();
}
