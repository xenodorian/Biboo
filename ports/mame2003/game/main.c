/* Parry Perry, MAME 2003 boot ROM. Step MAME-1.
   Not the game yet: a 640x480 input test that shows the screen-fit decision
   (one 384x216 web map, drawn 1:1, the rest of the frame is HUD margin). */
#include "hw.h"

#define COL_BG    RGB565(20, 24, 28)
#define COL_FIELD RGB565(36, 48, 40)
#define COL_GOLD  RGB565(196, 163, 90)
#define COL_INK   RGB565(244, 240, 230)
#define COL_DIM   RGB565(138, 132, 120)
#define COL_RED   RGB565(196, 64, 48)
#define COL_GREEN RGB565(80, 168, 96)
#define COL_BLUE  RGB565(64, 112, 196)
#define COL_YELLOW RGB565(220, 196, 64)

#define PF_X 128
#define PF_Y 88
#define PF_W 384
#define PF_H 216

static void hw_text(int x, int y, const char *s, u16 color, int scale)
{
    int i;
    for (i = 0; s[i]; i++) {
        hw_glyph(x, y, (unsigned char)s[i], color, scale);
        x += 8 * scale;
    }
}

static void mark(int x, int y, const char *s, int on)
{
    hw_text(x, y, s, on ? COL_GOLD : COL_DIM, 1);
}

void game_main(void)
{
    int px = PF_X + (PF_W - 16) / 2;
    int py = PF_Y + (PF_H - 16) / 2;

    hw_init();
    for (;;) {
        u16 pad = hw_pad();
        u16 down = (u16)~pad;
        u16 body = COL_INK;
        int step = 3;

        if (down & PAD_A) body = COL_RED;
        else if (down & PAD_B) body = COL_GREEN;
        else if (down & PAD_X) body = COL_BLUE;
        else if (down & PAD_Y) body = COL_YELLOW;

        if (down & (PAD_L1 | PAD_R1 | PAD_L2 | PAD_R2))
            step = 8;

        if (down & PAD_LEFT)  px -= step;
        if (down & PAD_RIGHT) px += step;
        if (down & PAD_UP)    py -= step;
        if (down & PAD_DOWN)  py += step;
        if (down & PAD_L1) px -= 6;
        if (down & PAD_R1) px += 6;
        if (down & PAD_L2) py -= 6;
        if (down & PAD_R2) py += 6;

        if (px < PF_X + 2) px = PF_X + 2;
        if (py < PF_Y + 2) py = PF_Y + 2;
        if (px > PF_X + PF_W - 18) px = PF_X + PF_W - 18;
        if (py > PF_Y + PF_H - 18) py = PF_Y + PF_H - 18;

        hw_clear(COL_BG);
        hw_rect(8, 8, 624, 464, COL_DIM);
        hw_rect(10, 10, 620, 460, COL_BG);

        hw_text(208, 28, "PARRYING PERRY", COL_GOLD, 2);
        hw_text(200, 56, "MAME 2003   640x480   8 BUTTONS", COL_INK, 1);

        hw_rect(PF_X, PF_Y, PF_W, PF_H, COL_GOLD);
        hw_rect(PF_X + 2, PF_Y + 2, PF_W - 4, PF_H - 4, COL_FIELD);
        hw_text(PF_X + 16, PF_Y + PF_H - 18, "ONE WEB MAP, 384x216, DRAWN 1:1", COL_DIM, 1);
        hw_rect(px, py, 16, 16, body);

        hw_text(48, 320, "THE MARGIN IS THE HUD. THE MAP IS NOT STRETCHED.", COL_DIM, 1);
        mark(48,  344, "UP", down & PAD_UP);
        mark(96,  344, "DOWN", down & PAD_DOWN);
        mark(168, 344, "LEFT", down & PAD_LEFT);
        mark(232, 344, "RIGHT", down & PAD_RIGHT);
        mark(312, 344, "START", down & PAD_START);
        mark(48,  364, "A ATTACK", down & PAD_A);
        mark(160, 364, "B PARRY", down & PAD_B);
        mark(264, 364, "X DASH", down & PAD_X);
        mark(360, 364, "Y SPIN", down & PAD_Y);
        mark(48,  384, "L1", down & PAD_L1);
        mark(112, 384, "R1", down & PAD_R1);
        mark(176, 384, "L2", down & PAD_L2);
        mark(240, 384, "R2", down & PAD_R2);
        hw_text(320, 384, "GOLD MEANS HELD", COL_DIM, 1);

        hw_present();
    }
}
