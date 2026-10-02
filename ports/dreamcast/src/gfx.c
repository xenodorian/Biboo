/* Graphics: a 320x240 RGB565 frame buffer in RAM (cached, fast), sprites from the art pack, an 8x8 font.
 * The finished frame is copied to video RAM once per frame by hw_present(). */
#include "dc.h"
#include "font8x8_basic.h"

u16 scr[SCR_W * SCR_H] __attribute__((aligned(32)));
extern const u8 art_pack[];                                    /* art.S embeds build/ART.BIN here */

static int clip_y0 = 0, clip_y1 = SCR_H, clip_x0 = 0, clip_x1 = SCR_W;       /* the x range applies to the alpha blit and the scaled blit */

const Sprite *art_sprite(int id) {
    const u32 *ent;
    if(id < 0) return 0;
    ent = (const u32 *)(art_pack + 8);                         /* skip magic and count */
    return (const Sprite *)(art_pack + ent[id * 2]);
}

void gfx_clip_x(int x0, int x1) { clip_x0 = x0 < 0 ? 0 : x0; clip_x1 = x1 > SCR_W ? SCR_W : x1; }
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

void gfx_text2(int x, int y, const char *s, u16 c, int k) {              /* 8x8 text with every pixel k x k */
    for(; *s; s++, x += 8 * k) {
        int ch = (unsigned char)*s, row, col;
        const u8 *g;
        if(ch > 127) ch = '?';
        g = font8x8_basic[ch];
        for(row = 0; row < 8; row++) for(col = 0; col < 8; col++) if((g[row] >> col) & 1) gfx_rect(x + col * k, y + row * k, k, k, c);
    }
}
void gfx_dim(int y0, int y1) {                                           /* halve the brightness of rows y0..y1 */
    int i;
    if(y0 < 0) y0 = 0;
    if(y1 > SCR_H) y1 = SCR_H;
    for(i = y0 * SCR_W; i < y1 * SCR_W; i++) scr[i] = (u16)((scr[i] >> 1) & 0x7bef);
}

/* ---- alpha: pixels are blended 31/32 steps with the packed 565 trick */
static u32 blend565(u32 src, u32 dst, u32 a5) {                   /* a5 0..32: how much of src */
    u32 s = (src | (src << 16)) & 0x07e0f81fu, d = (dst | (dst << 16)) & 0x07e0f81fu;
    u32 r = (d + (((s - d) * a5) >> 5)) & 0x07e0f81fu;
    return (r | (r >> 16)) & 0xffffu;
}
/* a sprite baked with per-pixel alpha (tools/bake_game.py encode_alpha): spans of (x, len) pairs, then one u32 per pixel, alpha in bits 16-23.
 * `fade` 0..255 scales the alpha of the whole sprite. */
void gfx_blit_alpha(const Sprite *sp, int x, int y, int flip, int fade) {
    int r, i;
    if(!sp) return;
    for(r = 0; r < sp->h; r++) {
        int sy = y + sp->oy + r, ns, k;
        const u16 *p;
        const u32 *px;
        u16 *row;
        if(sy < clip_y0 || sy >= clip_y1) continue;
        p = (const u16 *)((const u8 *)sp + sp->rowoff[r]);
        ns = *p++;
        px = (const u32 *)((const u8 *)p + ns * 4 + 2);          /* the row header is padded to 4 bytes: the count (2), the pairs, 2 more */
        row = scr + sy * SCR_W;
        for(k = 0; k < ns; k++) {
            int sx0 = p[k * 2], len = p[k * 2 + 1];
            for(i = 0; i < len; i++) {
                u32 v = px[i], a = (((v >> 16) & 255) * (u32)fade) >> 8, a5 = (a + 4) >> 3;
                int dx = flip ? x - (sp->ox + sx0 + i) - 1 : x + sp->ox + sx0 + i;
                if(dx < clip_x0 || dx >= clip_x1 || a5 == 0) continue;
                row[dx] = (u16)(a5 >= 32 ? (v & 0xffff) : blend565(v & 0xffff, row[dx], a5));
            }
            px += len;
        }
    }
}
/* a colour-keyed sprite with every pixel mixed toward `tint` by alpha/255 (a red hit flash, a white block flash, the blue charge glow) */
void gfx_blit_tint(const Sprite *sp, int x, int y, int flip, u16 tint, int alpha) {
    int r, i;
    u32 a5 = ((u32)alpha + 4) >> 3;
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
            for(i = 0; i < len; i++) {
                int dx = flip ? x - (sp->ox + sx0 + i) - 1 : x + sp->ox + sx0 + i;
                if(dx < 0 || dx >= SCR_W) continue;
                row[dx] = (u16)blend565(tint, px[i], a5);
            }
        }
    }
}
void gfx_fill_alpha(int y0, int y1, u16 c, int alpha) {            /* a translucent colour over rows y0..y1 */
    int i;
    u32 a5 = ((u32)alpha + 4) >> 3;
    if(y0 < clip_y0) y0 = clip_y0;
    if(y1 > clip_y1) y1 = clip_y1;
    for(i = y0 * SCR_W; i < y1 * SCR_W; i++) scr[i] = (u16)blend565(c, scr[i], a5);
}

/* a colour-keyed sprite scaled by k (an enemy the Empowerment Beam made larger): nearest neighbour, about the anchor */
void gfx_blit_scaled(const Sprite *sp, int x, int y, int flip, float k, u16 tint, int alpha) {
    int dy0, dy1, dy;
    u32 a5 = ((u32)alpha + 4) >> 3;
    if(!sp) return;
    dy0 = (int)((float)sp->oy * k - 0.5f); dy1 = (int)((float)(sp->oy + sp->h) * k + 0.5f);
    for(dy = dy0; dy < dy1; dy++) {
        int sy = y + dy, r, ns;
        const u16 *p;
        u16 *row;
        if(sy < clip_y0 || sy >= clip_y1) continue;
        r = (int)(((float)dy + 0.5f) / k) - sp->oy;
        if(r < 0 || r >= sp->h) continue;
        p = (const u16 *)((const u8 *)sp + sp->rowoff[r]);
        ns = *p++;
        row = scr + sy * SCR_W;
        while(ns--) {
            int sx0 = p[0], len = p[1], dx0 = (int)((float)(sp->ox + sx0) * k), dx1 = (int)((float)(sp->ox + sx0 + len) * k + 0.5f), dx;
            const u16 *px = p + 2;
            p += 2 + len;
            for(dx = dx0; dx < dx1; dx++) {
                int si = (int)(((float)dx + 0.5f) / k) - sp->ox - sx0, X = flip ? x - dx - 1 : x + dx;
                u16 c;
                if(si < 0) si = 0; else if(si >= len) si = len - 1;
                if(X < clip_x0 || X >= clip_x1) continue;
                c = px[si];
                row[X] = a5 ? (u16)blend565(tint, c, a5) : c;
            }
        }
    }
}

void gfx_shift(int y0, int y1, int dx, int dy) {                         /* shake: slide rows y0..y1 by (dx, dy), black where nothing is left */
    int y, x;
    if(!dx && !dy) return;
    if(y0 < 0) y0 = 0;
    if(y1 > SCR_H) y1 = SCR_H;
    for(y = dy > 0 ? y1 - 1 : y0; dy > 0 ? y >= y0 : y < y1; y += dy > 0 ? -1 : 1) {
        int sy = y - dy;
        u16 *row = scr + y * SCR_W;
        if(sy < y0 || sy >= y1) { for(x = 0; x < SCR_W; x++) row[x] = 0; continue; }
        {
            const u16 *src = scr + sy * SCR_W;
            if(dx > 0) { for(x = SCR_W - 1; x >= 0; x--) row[x] = x - dx >= 0 ? src[x - dx] : 0; }
            else if(dx < 0) { for(x = 0; x < SCR_W; x++) row[x] = x - dx < SCR_W ? src[x - dx] : 0; }
            else if(dy) { for(x = 0; x < SCR_W; x++) row[x] = src[x]; }
        }
    }
}
