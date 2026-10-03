/* Parry Perry on the 68000. The web game's maps, moves and enemies, in integers.
   Drawing is commands. The pixels live in the art pack. No floating point. */
#include "hw.h"
#include "data.h"

#define COL_BG     RGB565(20, 24, 28)
#define COL_GOLD   RGB565(196, 163, 90)
#define COL_INK    RGB565(244, 240, 230)
#define COL_DIM    RGB565(138, 132, 120)
#define COL_RED    RGB565(196, 64, 48)
#define COL_GREEN  RGB565(80, 168, 96)
#define COL_BLUE   RGB565(64, 112, 196)
#define COL_YELLOW RGB565(220, 196, 64)
#define COL_WHITE  RGB565(244, 244, 244)

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

static void hw_num(int x, int y, int v, u16 color)
{
    char b[8];
    int n = 0, i;
    if (v < 0)
        v = 0;
    if (v == 0)
        b[n++] = '0';
    while (v && n < 8) {
        b[n++] = (char)('0' + v % 10);
        v /= 10;
    }
    for (i = n - 1; i >= 0; i--) {
        hw_glyph(x, y, b[i], color, 1);
        x += 8;
    }
}

#include "play.inc"
