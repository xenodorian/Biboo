/* Draw one boot frame with Right and A held, and write a PPM. */
#include <stdio.h>
#include <stdlib.h>
#include "hw.h"
#include "fbdraw.h"

static unsigned short fb[FB_W * FB_H];
static int frames;
static int limit = 40;
static const char *out_path = "boot.ppm";

void hw_init(void) {}

void hw_clear(u16 color) { fb_clear(fb, color); }

void hw_rect(int x, int y, int w, int h, u16 color)
{
    fb_rect(fb, x, y, w, h, color);
}

void hw_glyph(int x, int y, int ch, u16 color, int scale)
{
    fb_glyph(fb, x, y, ch, color, scale);
}

u16 hw_pad(void)
{
    /* active low: Right and A held, so the square has moved and turned red */
    return (u16)~(PAD_RIGHT | PAD_A);
}

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
