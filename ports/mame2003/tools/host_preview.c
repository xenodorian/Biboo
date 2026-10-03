/* Draw frames with Right and A held, and write a PPM of the last one.
   Art is roms/art.bin, the same pack the MAME driver blits. */
#include <stdio.h>
#include <stdlib.h>
#include "hw.h"
#include "fbdraw.h"

static unsigned short fb[FB_W * FB_H];
static unsigned char *art;
static int frames;
static int limit = 200;
static const char *out_path = "boot.ppm";
static u16 nv[32];

static void load_art(void)
{
    FILE *f;
    long n;
    const char *path = "../roms/art.bin";
    f = fopen(path, "rb");
    if (!f) {
        perror(path);
        exit(1);
    }
    fseek(f, 0, SEEK_END);
    n = ftell(f);
    fseek(f, 0, SEEK_SET);
    art = (unsigned char *)malloc((size_t)n);
    if (!art || fread(art, 1, (size_t)n, f) != (size_t)n) {
        perror(path);
        exit(1);
    }
    fclose(f);
    fb_set_art(art);
}

void hw_init(void)
{
    if (!art)
        load_art();
}

void hw_clear(u16 color) { fb_clear(fb, color); }

void hw_rect(int x, int y, int w, int h, u16 color)
{
    fb_rect(fb, x, y, w, h, color);
}

void hw_glyph(int x, int y, int ch, u16 color, int scale)
{
    fb_glyph(fb, x, y, ch, color, scale);
}

void hw_clip(int x0, int y0, int x1, int y1)
{
    fb_clip(x0, y0, x1, y1);
}

void hw_sprite(int x, int y, int id, int flip)
{
    fb_sprite(fb, x, y, id, flip, FB_OPAQUE, 0, 255);
}

void hw_sprite_tint(int x, int y, int id, int flip, u16 tint, int alpha)
{
    fb_sprite(fb, x, y, id, flip, FB_TINT, tint, alpha);
}

u16 hw_pad(void)
{
    /* Right held: she walks toward the first goblin. */
    return (u16)~PAD_RIGHT;
}

u16 hw_nv_r(int i) { return nv[i & 31]; }
void hw_nv_w(int i, u16 v) { nv[i & 31] = v; }

void hw_present(void)
{
    frames++;
    if (frames >= limit) {
        FILE *f = fopen(out_path, "wb");
        int i;
        if (!f) {
            perror(out_path);
            exit(1);
        }
        fprintf(f, "P6\n%d %d\n255\n", FB_W, FB_H);
        for (i = 0; i < FB_W * FB_H; i++) {
            unsigned char px[3];
            u16 c = fb[i];
            px[0] = (unsigned char)(((c >> 11) & 31) * 255 / 31);
            px[1] = (unsigned char)(((c >> 5) & 63) * 255 / 63);
            px[2] = (unsigned char)((c & 31) * 255 / 31);
            fwrite(px, 1, 3, f);
        }
        fclose(f);
        exit(0);
    }
}

int main(int argc, char **argv)
{
    if (argc > 1)
        out_path = argv[1];
    game_main();
    return 0;
}
