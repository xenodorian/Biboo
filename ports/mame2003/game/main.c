/* Parry Perry, MAME 2003 boot ROM. Step MAME-2.
   The 384x216 view is the Green Trail, baked 1:1, and Perry's idle.
   The d-pad walks her. A tints the sprite, the same flash the hit code uses. */
#include "hw.h"
#include "art_ids.h"

#define COL_BG    RGB565(20, 24, 28)
#define COL_GOLD  RGB565(196, 163, 90)
#define COL_INK   RGB565(244, 240, 230)
#define COL_DIM   RGB565(138, 132, 120)
#define COL_RED   RGB565(196, 64, 48)
#define COL_GREEN RGB565(80, 168, 96)
#define COL_BLUE  RGB565(64, 112, 196)
#define COL_YELLOW RGB565(220, 196, 64)

#define PF_X 128
#define PF_Y 88

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

static int wrap_mod(int a, int m)
{
    while (a < 0)
        a += m;
    while (a >= m)
        a -= m;
    return a;
}

/* par_q8 is parallax * 256. Rounded, so 0.1 of 96 is 10 and not 9. */
static int mul_q8(int v, int q8)
{
    int neg = 0;
    int r;
    if (v < 0) {
        neg = 1;
        v = -v;
    }
    r = (v * q8 + 128) >> 8;
    return neg ? -r : r;
}

static void draw_tiled(int id, int period, int margin, int par_q8, int bgx)
{
    int dx, x0, xx;
    if (id < 0 || period <= 0)
        return;
    dx = -mul_q8(bgx, par_q8);
    x0 = wrap_mod(dx, period) - period;
    for (xx = x0; xx < VIEW_W; xx += period)
        hw_sprite(PF_X + xx, PF_Y - margin, id, 0);
}

static void draw_scene(int px, int py, int idle, int tint)
{
    int i;
    hw_clip(PF_X, PF_Y, PF_X + VIEW_W, PF_Y + VIEW_H);
    for (i = 0; i < NLAYERS; i++)
        draw_tiled(LAYER_ID[i], LAYER_PERIOD[i], LAYER_MARGIN[i], LAYER_PAR[i], ANCHOR_X);
    if (FRINGE_ID >= 0)
        draw_tiled(FRINGE_ID, FRINGE_PERIOD, VIEW_MARGIN, 256, ANCHOR_X);
    if (tint)
        hw_sprite_tint(PF_X + px, PF_Y + py, IDLE_ID[idle], 0, COL_RED, 180);
    else
        hw_sprite(PF_X + px, PF_Y + py, IDLE_ID[idle], 0);
    hw_clip(0, 0, 640, 480);
}

void game_main(void)
{
    int px = ANCHOR_X;
    int py = FEET_ROW;
    int idle = 0;
    int acc = 0;

    hw_init();
    for (;;) {
        u16 pad = hw_pad();
        u16 down = (u16)~pad;
        int step = (down & (PAD_L1 | PAD_R1 | PAD_L2 | PAD_R2)) ? 8 : 3;

        if (down & PAD_LEFT)  px -= step;
        if (down & PAD_RIGHT) px += step;
        if (down & PAD_UP)    py -= step;
        if (down & PAD_DOWN)  py += step;
        if (px < 16) px = 16;
        if (py < 40) py = 40;
        if (px > VIEW_W - 16) px = VIEW_W - 16;
        if (py > VIEW_H - 4) py = VIEW_H - 4;

        acc += 16;
        if (acc >= IDLE_MS[idle]) {
            acc = 0;
            idle++;
            if (idle >= IDLE_N)
                idle = 0;
        }

        hw_clear(COL_BG);
        hw_rect(8, 8, 624, 464, COL_DIM);
        hw_rect(10, 10, 620, 460, COL_BG);
        hw_text(208, 28, "PARRYING PERRY", COL_GOLD, 2);
        hw_text(232, 56, "GREEN TRAIL, 1:1", COL_INK, 1);
        hw_rect(PF_X - 2, PF_Y - 2, VIEW_W + 4, VIEW_H + 4, COL_GOLD);
        draw_scene(px, py, idle, down & PAD_A);

        hw_text(48, 320, "ONE WEB MAP. THE MARGIN IS THE HUD.", COL_DIM, 1);
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
        hw_text(320, 384, "A TINTS HER RED", COL_DIM, 1);

        if (down & PAD_B) hw_text(PF_X + 8, PF_Y + 8, "PARRY", COL_GREEN, 1);
        if (down & PAD_X) hw_text(PF_X + 8, PF_Y + 20, "DASH", COL_BLUE, 1);
        if (down & PAD_Y) hw_text(PF_X + 8, PF_Y + 32, "SPIN", COL_YELLOW, 1);

        hw_present();
    }
}
