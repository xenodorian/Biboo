/* Parry Perry, Dreamcast port: shared declarations. Bare metal, no C library. ON-DEMAND ONLY, see ../README.md */
#ifndef DC_H
#define DC_H
typedef unsigned int u32;
typedef unsigned short u16;
typedef unsigned char u8;
typedef int s32;
typedef short s16;
typedef signed char s8;

#define SCR_W 320
#define SCR_H 240

/* ---- hw.c: video (double buffered, CPU drawn), controller, timer */
void hw_init(void);
void hw_present(const u16 *frame);      /* copy a finished 320x240 RGB565 frame into the hidden buffer, wait for vblank, show it */
u16 hw_pad(void);                       /* raw Maple button word; a 0 bit means pressed; 0xffff when no controller answers */
u32 hw_ticks(void);                     /* SH-4 timer, 12.5 ticks per microsecond */
#define PAD_C 1u
#define PAD_B 2u
#define PAD_A 4u
#define PAD_START 8u
#define PAD_UP 16u
#define PAD_DOWN 32u
#define PAD_LEFT 64u
#define PAD_RIGHT 128u
#define PAD_Z 256u
#define PAD_Y 512u
#define PAD_X 1024u
#define PAD_L 4096u                      /* the left and right triggers, folded into two unused bits of the button word (a 0 bit is pressed) */
#define PAD_R 8192u

/* ---- gfx.c: the RAM frame buffer, sprites from the art pack, text */
typedef struct { s16 ox, oy; u16 w, h; u32 rowoff[1]; } Sprite;     /* see tools/bake_game.py for the format */
extern u16 scr[SCR_W * SCR_H];
#define RGB(r, g, b) ((u16)((((r) >> 3) << 11) | (((g) >> 2) << 5) | ((b) >> 3)))
const Sprite *art_sprite(int id);
void gfx_clip(int y0, int y1);                                      /* rows y0 <= y < y1 are drawn (all columns) */
void gfx_clear(u16 c);
void gfx_rect(int x, int y, int w, int h, u16 c);
void gfx_blit(const Sprite *s, int x, int y, int flip);            /* (x, y) is the sprite's anchor on the screen; flip mirrors about it */
void gfx_blit_fade(const Sprite *s, int x, int y, int flip, int fade); /* colour-keyed sprite, fade 0..255 (not for alpha-baked sprites) */
void gfx_text(int x, int y, const char *s, u16 c);
void gfx_num(int x, int y, u32 v, u16 c);
void gfx_shift(int y0, int y1, int dx, int dy);
void gfx_clip_x(int x0, int x1);
void gfx_blit_scaled(const Sprite *s, int x, int y, int flip, float k, u16 tint, int alpha);
void gfx_blit_alpha(const Sprite *s, int x, int y, int flip, int fade);
void gfx_blit_tint(const Sprite *s, int x, int y, int flip, u16 tint, int alpha);
void gfx_fill_alpha(int y0, int y1, u16 c, int alpha);
void gfx_text2(int x, int y, const char *s, u16 c, int k);
void gfx_dim(int y0, int y1);

/* audio.c: music on the AICA */
void audio_init(void);
void audio_want(int track);             /* a TRK_ number from gen/music_data.h, or -1 for silence */
void audio_tick(void);                  /* once per frame */

/* save.c: the VMU */
int save_read(u8 *data256);             /* 1 read, 0 no save, -1 no card */
int save_write(const u8 *data256);      /* 1 saved */

/* ---- game.c */
void game_init(void);
void game_frame(u16 pad_raw, u32 frame_us, u32 draw_us);   /* update and draw one 1/60 s frame into scr[] */
#endif
