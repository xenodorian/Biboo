/* Talks to the blitter and the pad in the custom MAME driver. No C library. */
#include "hw.h"

#define BLIT ((volatile u16 *)0x200000)
#define PAD  ((volatile u16 *)0x300000)

#define R_X   0
#define R_Y   1
#define R_A   2
#define R_B   3
#define R_C   4
#define R_CMD 5

#define CMD_CLEAR 1
#define CMD_RECT  2
#define CMD_GLYPH 3
#define CMD_SPRITE 4
#define CMD_TINT  7
#define CMD_CLIP  8

volatile u8 vblank_flag;

void hw_init(void)
{
}

static void cmd(u16 c)
{
    BLIT[R_CMD] = c;
}

void hw_clear(u16 color)
{
    BLIT[R_C] = color;
    cmd(CMD_CLEAR);
}

void hw_rect(int x, int y, int w, int h, u16 color)
{
    BLIT[R_X] = (u16)x;
    BLIT[R_Y] = (u16)y;
    BLIT[R_A] = (u16)w;
    BLIT[R_B] = (u16)h;
    BLIT[R_C] = color;
    cmd(CMD_RECT);
}

void hw_glyph(int x, int y, int ch, u16 color, int scale)
{
    BLIT[R_X] = (u16)(short)x;
    BLIT[R_Y] = (u16)(short)y;
    BLIT[R_A] = (u16)ch;
    BLIT[R_B] = (u16)scale;
    BLIT[R_C] = color;
    cmd(CMD_GLYPH);
}

void hw_clip(int x0, int y0, int x1, int y1)
{
    BLIT[R_X] = (u16)(short)x0;
    BLIT[R_Y] = (u16)(short)y0;
    BLIT[R_A] = (u16)(short)x1;
    BLIT[R_B] = (u16)(short)y1;
    cmd(CMD_CLIP);
}

void hw_sprite(int x, int y, int id, int flip)
{
    BLIT[R_X] = (u16)(short)x;
    BLIT[R_Y] = (u16)(short)y;
    BLIT[R_A] = (u16)id;
    BLIT[R_B] = (u16)(flip ? 1 : 0);
    cmd(CMD_SPRITE);
}

void hw_sprite_tint(int x, int y, int id, int flip, u16 tint, int alpha)
{
    BLIT[R_X] = (u16)(short)x;
    BLIT[R_Y] = (u16)(short)y;
    BLIT[R_A] = (u16)id;
    BLIT[R_B] = (u16)((flip ? 1 : 0) | ((alpha & 255) << 8));
    BLIT[R_C] = tint;
    cmd(CMD_TINT);
}

u16 hw_pad(void)
{
    return *PAD;
}

void hw_present(void)
{
    /* STOP wakes on an interrupt above the mask. Mask 5 lets the level-6
       vblank through. MAME idles the CPU instead of emulating a spin. */
    vblank_flag = 0;
    while (!vblank_flag)
        asm volatile("stop #0x2500" ::: "memory");
}
