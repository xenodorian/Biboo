/* Software raster ops shared by the MAME driver and the host preview.
   640x480, RGB565, no C library. The 68000 does not call these; the driver does. */
#ifndef PP_FBDRAW_H
#define PP_FBDRAW_H

#define FB_W 640
#define FB_H 480

void fb_clear(unsigned short *fb, unsigned short color);
void fb_rect(unsigned short *fb, int x, int y, int w, int h, unsigned short color);
void fb_glyph(unsigned short *fb, int x, int y, int ch, unsigned short color, int scale);

#endif
