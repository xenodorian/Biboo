/* Software raster ops shared by the MAME driver and the host preview.
   640x480, RGB565. Sprites are the Dreamcast art pack (PPK1, little endian):
   the 68000 passes an id, it does not touch pixels. */
#ifndef PP_FBDRAW_H
#define PP_FBDRAW_H

#define FB_W 640
#define FB_H 480

/* fb_sprite modes. 0 copies colour-keyed runs. 1 blends them over the frame.
   2 is a sprite baked with per-pixel alpha. 3 tints the runs (opaque). */
#define FB_OPAQUE 0
#define FB_FADE   1
#define FB_ALPHA  2
#define FB_TINT   3

void fb_set_art(const unsigned char *pack);
void fb_clip(int x0, int y0, int x1, int y1);
void fb_clear(unsigned short *fb, unsigned short color);
void fb_rect(unsigned short *fb, int x, int y, int w, int h, unsigned short color);
void fb_glyph(unsigned short *fb, int x, int y, int ch, unsigned short color, int scale);
void fb_dim(unsigned short *fb, int y0, int y1);
void fb_fill_alpha(unsigned short *fb, int y0, int y1, unsigned short color, int alpha);
void fb_sprite(unsigned short *fb, int x, int y, int id, int flip, int mode, unsigned short tint, int fade);

#endif
