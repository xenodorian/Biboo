#include "fbdraw.h"
#include "font8x8_basic.h"

void fb_clear(unsigned short *fb, unsigned short color)
{
    int i;
    for (i = 0; i < FB_W * FB_H; i++)
        fb[i] = color;
}

void fb_rect(unsigned short *fb, int x, int y, int w, int h, unsigned short color)
{
    int x0, y0, x1, y1, yy, xx;
    if (w <= 0 || h <= 0)
        return;
    x0 = x < 0 ? 0 : x;
    y0 = y < 0 ? 0 : y;
    x1 = x + w;
    y1 = y + h;
    if (x1 > FB_W) x1 = FB_W;
    if (y1 > FB_H) y1 = FB_H;
    for (yy = y0; yy < y1; yy++) {
        unsigned short *row = fb + yy * FB_W;
        for (xx = x0; xx < x1; xx++)
            row[xx] = color;
    }
}

void fb_glyph(unsigned short *fb, int x, int y, int ch, unsigned short color, int scale)
{
    const unsigned char *g;
    int row, col, sy, sx;
    if (scale < 1)
        scale = 1;
    if (ch < 0 || ch > 127)
        ch = 0;
    g = font8x8_basic[ch];
    for (row = 0; row < 8; row++) {
        unsigned char bits = g[row];
        for (col = 0; col < 8; col++) {
            /* font8x8_basic: least significant bit is the leftmost pixel */
            if (bits & (1 << col)) {
                int px = x + col * scale;
                int py = y + row * scale;
                for (sy = 0; sy < scale; sy++) {
                    for (sx = 0; sx < scale; sx++) {
                        int xx = px + sx;
                        int yy = py + sy;
                        if ((unsigned)xx < FB_W && (unsigned)yy < FB_H)
                            fb[yy * FB_W + xx] = color;
                    }
                }
            }
        }
    }
}
