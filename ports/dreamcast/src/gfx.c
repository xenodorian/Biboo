/* Graphics: a 320x240 RGB565 frame buffer in RAM (cached, fast), sprites from the art pack, an 8x8 font.
 * The finished frame is copied to video RAM once per frame by hw_present(). */
#include "dc.h"
#include "font8x8_basic.h"

u16 scr[SCR_W * SCR_H] __attribute__((aligned(32)));
extern const u8 art_pack[];                                    /* art.S embeds build/ART.BIN here */

static int clip_y0 = 0, clip_y1 = SCR_H;

const Sprite *art_sprite(int id) {
    const u32 *ent;
    if(id < 0) return 0;
    ent = (const u32 *)(art_pack + 8);                         /* skip magic and count */
    return (const Sprite *)(art_pack + ent[id * 2]);
}

void gfx_clip(int y0, int y1) { clip_y0 = y0 < 0 ? 0 : y0; clip_y1 = y1 > SCR_H ? SCR_H : y1; }

void gfx_clear(u16 c) {
    u32 v = ((u32)c << 16) | c, *p = (u32 *)scr;
    u32 i, n = (u32)SCR_W * SCR_H / 2;
    for(i = 0; i < n; i++) p[i] = v;
}

void gfx_rect(int x, int y, int w, int h, u16 c) {
    int i, j;
    if(x < 0) { w += x; x = 0; }
    if(y < clip_y0) { h -= clip_y0 - y; y = clip_y0; }
    if(x + w > SCR_W) w = SCR_W - x;
    if(y + h > clip_y1) h = clip_y1 - y;
    for(j = 0; j < h; j++) for(i = 0; i < w; i++) scr[(y + j) * SCR_W + x + i] = c;
}

/* Draw a sprite stored as colour-keyed runs. (x, y) is its anchor on the screen. flip mirrors it about the anchor. */
void gfx_blit(const Sprite *sp, int x, int y, int flip) {
    int r, i;
    if(!sp) return;
    for(r = 0; r < sp->h; r++) {
        int sy = y + sp->oy + r, ns;
        const u16 *p;
        u16 *row;
        if(sy < clip_y0 || sy >= clip_y1) continue;
        p = (const u16 *)((const u8 *)sp + sp->rowoff[r]);
        ns = *p++;
        row = scr + sy * SCR_W;
        while(ns--) {
            int sx0 = p[0], len = p[1];
            const u16 *px = p + 2;
            p += 2 + len;
            if(!flip) {
                int dx = x + sp->ox + sx0, i0 = 0, i1 = len;
                if(dx < 0) i0 = -dx;
                if(dx + len > SCR_W) i1 = SCR_W - dx;
                for(i = i0; i < i1; i++) row[dx + i] = px[i];
            } else {
                int dx = x - (sp->ox + sx0) - 1;               /* the first pixel; the next ones go left */
                int i0 = 0, i1 = len;
                if(dx >= SCR_W) i0 = dx - SCR_W + 1;
                if(dx - (len - 1) < 0) i1 = dx + 1;
                for(i = i0; i < i1; i++) row[dx - i] = px[i];
            }
        }
    }
}

void gfx_char(int x, int y, int ch, u16 c) {
    const u8 *g;
    int row, col;
    if(ch < 0 || ch > 127) ch = '?';
    g = font8x8_basic[ch];
    for(row = 0; row < 8; row++) {
        int yy = y + row;
        if(yy < 0 || yy >= SCR_H) continue;
        for(col = 0; col < 8; col++) {
            int xx = x + col;
            if(((g[row] >> col) & 1) && xx >= 0 && xx < SCR_W) scr[yy * SCR_W + xx] = c;
        }
    }
}
void gfx_text(int x, int y, const char *s, u16 c) { while(*s) { gfx_char(x, y, *s++, c); x += 8; } }
void gfx_num(int x, int y, u32 v, u16 c) {
    char buf[12]; int n = 0, i;
    if(v == 0) buf[n++] = '0';
    while(v) { buf[n++] = (char)('0' + v % 10); v /= 10; }
    for(i = 0; i < n; i++) gfx_char(x + i * 8, y, buf[n - 1 - i], c);
}
