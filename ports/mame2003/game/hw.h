/* Hardware the boot ROM is allowed to touch. The MAME driver implements this
   with a native blitter. A host build implements it in RAM so the same
   game_main() can be looked at without the emulator. */
#ifndef PP_HW_H
#define PP_HW_H

typedef unsigned short u16;
typedef unsigned char u8;

#define RGB565(r, g, b) ((u16)((((r) & 0xF8) << 8) | (((g) & 0xFC) << 3) | ((b) >> 3)))

/* One word at 0x300000, active low, matching the driver. A 0 bit is pressed. */
#define PAD_UP    0x0001u
#define PAD_DOWN  0x0002u
#define PAD_LEFT  0x0004u
#define PAD_RIGHT 0x0008u
#define PAD_A     0x0010u
#define PAD_B     0x0020u
#define PAD_X     0x0040u
#define PAD_Y     0x0080u
#define PAD_L1    0x0100u
#define PAD_R1    0x0200u
#define PAD_L2    0x0400u
#define PAD_R2    0x0800u
#define PAD_START 0x1000u
#define PAD_COIN  0x2000u

void hw_init(void);
void hw_clear(u16 color);
void hw_rect(int x, int y, int w, int h, u16 color);
void hw_glyph(int x, int y, int ch, u16 color, int scale);
void hw_clip(int x0, int y0, int x1, int y1);
void hw_sprite(int x, int y, int id, int flip);
void hw_sprite_tint(int x, int y, int id, int flip, u16 tint, int alpha);
u16 hw_pad(void);
void hw_present(void);
u16 hw_nv_r(int i);
void hw_nv_w(int i, u16 v);

void game_main(void);

#endif
