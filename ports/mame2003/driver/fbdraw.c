#include "fbdraw.h"
#include "font8x8_basic.h"

static const unsigned char *art_pack;
static int clip_x0, clip_y0, clip_x1 = FB_W, clip_y1 = FB_H;

static unsigned short rd16(const unsigned char *p)
{
    return (unsigned short)(p[0] | (p[1] << 8));
}

static short rds16(const unsigned char *p)
{
    return (short)rd16(p);
}

static unsigned int rd32(const unsigned char *p)
{
    return (unsigned int)p[0] | ((unsigned int)p[1] << 8) | ((unsigned int)p[2] << 16) | ((unsigned int)p[3] << 24);
}

static unsigned short blend565(unsigned short src, unsigned short dst, unsigned int a5)
{
    unsigned int s = (src | (src << 16)) & 0x07e0f81fu;
    unsigned int d = (dst | (dst << 16)) & 0x07e0f81fu;
    unsigned int r = (d + (((s - d) * a5) >> 5)) & 0x07e0f81fu;
    return (unsigned short)((r | (r >> 16)) & 0xffffu);
}

void fb_set_art(const unsigned char *pack)
{
    art_pack = pack;
}

void fb_clip(int x0, int y0, int x1, int y1)
{
    if (x0 < 0) x0 = 0;
    if (y0 < 0) y0 = 0;
    if (x1 > FB_W) x1 = FB_W;
    if (y1 > FB_H) y1 = FB_H;
    if (x1 < x0) x1 = x0;
    if (y1 < y0) y1 = y0;
    clip_x0 = x0;
    clip_y0 = y0;
    clip_x1 = x1;
    clip_y1 = y1;
}

void fb_clear(unsigned short *fb, unsigned short color)
{
    int i;
    fb_clip(0, 0, FB_W, FB_H);
    for (i = 0; i < FB_W * FB_H; i++)
        fb[i] = color;
}

void fb_rect(unsigned short *fb, int x, int y, int w, int h, unsigned short color)
{
    int x0, y0, x1, y1, yy, xx;
    if (w <= 0 || h <= 0)
        return;
    x0 = x;
    y0 = y;
    x1 = x + w;
    y1 = y + h;
    if (x0 < clip_x0) x0 = clip_x0;
    if (y0 < clip_y0) y0 = clip_y0;
    if (x1 > clip_x1) x1 = clip_x1;
    if (y1 > clip_y1) y1 = clip_y1;
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
            if (bits & (1 << col)) {
                int px = x + col * scale;
                int py = y + row * scale;
                for (sy = 0; sy < scale; sy++) {
                    for (sx = 0; sx < scale; sx++) {
                        int xx = px + sx;
                        int yy = py + sy;
                        if (xx >= clip_x0 && xx < clip_x1 && yy >= clip_y0 && yy < clip_y1)
                            fb[yy * FB_W + xx] = color;
                    }
                }
            }
        }
    }
}

void fb_dim(unsigned short *fb, int y0, int y1)
{
    int y, x;
    if (y0 < clip_y0) y0 = clip_y0;
    if (y1 > clip_y1) y1 = clip_y1;
    for (y = y0; y < y1; y++) {
        unsigned short *row = fb + y * FB_W;
        for (x = 0; x < FB_W; x++)
            row[x] = (unsigned short)((row[x] >> 1) & 0x7bef);
    }
}

void fb_fill_alpha(unsigned short *fb, int y0, int y1, unsigned short color, int alpha)
{
    unsigned int a5 = ((unsigned int)alpha + 4) >> 3;
    int y, x;
    if (y0 < clip_y0) y0 = clip_y0;
    if (y1 > clip_y1) y1 = clip_y1;
    for (y = y0; y < y1; y++) {
        unsigned short *row = fb + y * FB_W;
        for (x = clip_x0; x < clip_x1; x++)
            row[x] = blend565(color, row[x], a5);
    }
}

static const unsigned char *sprite_ptr(int id)
{
    unsigned int count, off;
    if (!art_pack || id < 0)
        return 0;
    if (rd32(art_pack) != 0x314b5050u) /* 'PPK1' little endian */
        return 0;
    count = rd32(art_pack + 4);
    if ((unsigned int)id >= count)
        return 0;
    off = rd32(art_pack + 8 + (unsigned int)id * 8);
    return art_pack + off;
}

static void plot_span(unsigned short *row, int dx, const unsigned char *px, int len, int flip, int mode, unsigned short tint, unsigned int a5)
{
    int i0 = 0, i1 = len, i;
    if (!flip) {
        if (dx < clip_x0) i0 = clip_x0 - dx;
        if (dx + len > clip_x1) i1 = clip_x1 - dx;
        for (i = i0; i < i1; i++) {
            unsigned short c = rd16(px + i * 2);
            int x = dx + i;
            if (mode == FB_FADE)
                row[x] = blend565(c, row[x], a5);
            else if (mode == FB_TINT)
                row[x] = a5 ? blend565(tint, c, a5) : c;
            else
                row[x] = c;
        }
    } else {
        if (dx >= clip_x1) i0 = dx - clip_x1 + 1;
        if (dx - (len - 1) < clip_x0) i1 = dx - clip_x0 + 1;
        for (i = i0; i < i1; i++) {
            unsigned short c = rd16(px + i * 2);
            int x = dx - i;
            if (mode == FB_FADE)
                row[x] = blend565(c, row[x], a5);
            else if (mode == FB_TINT)
                row[x] = a5 ? blend565(tint, c, a5) : c;
            else
                row[x] = c;
        }
    }
}

static void blit_keyed(unsigned short *fb, const unsigned char *sp, int x, int y, int flip, int mode, unsigned short tint, unsigned int a5)
{
    int ox = rds16(sp);
    int oy = rds16(sp + 2);
    int h = rd16(sp + 6);
    int r;
    for (r = 0; r < h; r++) {
        int sy = y + oy + r;
        const unsigned char *p;
        unsigned int ns;
        if (sy < clip_y0 || sy >= clip_y1)
            continue;
        p = sp + rd32(sp + 8 + r * 4);
        ns = rd16(p);
        p += 2;
        while (ns--) {
            int sx0 = rd16(p);
            int len = rd16(p + 2);
            const unsigned char *px = p + 4;
            int dx = flip ? x - (ox + sx0) - 1 : x + ox + sx0;
            p += 4 + len * 2;
            if (len > 0)
                plot_span(fb + sy * FB_W, dx, px, len, flip, mode, tint, a5);
        }
    }
}

static void blit_alpha(unsigned short *fb, const unsigned char *sp, int x, int y, int flip, int fade)
{
    int ox = rds16(sp);
    int oy = rds16(sp + 2);
    int h = rd16(sp + 6);
    int r, k, i;
    for (r = 0; r < h; r++) {
        int sy = y + oy + r;
        const unsigned char *p;
        const unsigned char *px;
        unsigned int ns;
        unsigned short *row;
        if (sy < clip_y0 || sy >= clip_y1)
            continue;
        p = sp + rd32(sp + 8 + r * 4);
        ns = rd16(p);
        p += 2;
        px = p + ns * 4 + 2; /* count, pairs, 2 bytes of pad, then one u32 per pixel */
        row = fb + sy * FB_W;
        for (k = 0; k < (int)ns; k++) {
            int sx0 = rd16(p + k * 4);
            int len = rd16(p + k * 4 + 2);
            for (i = 0; i < len; i++) {
                unsigned int v = rd32(px);
                unsigned int a = (((v >> 16) & 255) * (unsigned int)fade) >> 8;
                unsigned int a5 = (a + 4) >> 3;
                int dx = flip ? x - (ox + sx0 + i) - 1 : x + ox + sx0 + i;
                px += 4;
                if (dx < clip_x0 || dx >= clip_x1 || a5 == 0)
                    continue;
                row[dx] = (unsigned short)(a5 >= 32 ? (v & 0xffff) : blend565((unsigned short)(v & 0xffff), row[dx], a5));
            }
        }
    }
}

void fb_sprite(unsigned short *fb, int x, int y, int id, int flip, int mode, unsigned short tint, int fade)
{
    const unsigned char *sp = sprite_ptr(id);
    unsigned int a5;
    if (!sp)
        return;
    if (fade < 0) fade = 0;
    if (fade > 255) fade = 255;
    if (mode == FB_ALPHA) {
        blit_alpha(fb, sp, x, y, flip, fade);
        return;
    }
    if (mode == FB_OPAQUE) {
        blit_keyed(fb, sp, x, y, flip, FB_OPAQUE, 0, 0);
        return;
    }
    a5 = ((unsigned int)fade + 4) >> 3;
    if (mode == FB_FADE && (a5 == 0 || fade >= 255)) {
        if (fade >= 255)
            blit_keyed(fb, sp, x, y, flip, FB_OPAQUE, 0, 0);
        return;
    }
    blit_keyed(fb, sp, x, y, flip, mode, tint, a5);
}
