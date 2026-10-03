/* Parry Perry, a homebrew machine for MAME 2003-Plus.
   Not a real arcade board. One 68000, a 640x480 RGB565 frame the driver
   draws, and eight action buttons. The ROM is the game. The pixels are
   not written by the emulated CPU: a full-frame software fill is already
   too slow on a real SH-4, and it is hopeless under an interpreted 68000.
   See ports/mame2003/README.md in the Biboo repo.

   Memory map
     000000-07FFFF  ROM, 512K, the program main.bin
     080000-......  art pack, art.bin, not mapped into the CPU. The blitter reads it.
     100000-10FFFF  work RAM, 64K
     200000-20000B  blitter, six 16-bit registers, write the command last
                    0 X, 1 Y, 2 A, 3 B, 4 color (RGB565), 5 command
                    1 clear (color)   2 rect (x,y,w,h,color)   3 glyph (x,y,char,scale,color)
                    4 sprite (x,y,id,flip)   5 fade (fade in color)   6 alpha (fade in color)
                    7 tint (flip in bit 0 of B, alpha in the high byte, tint in color)
                    8 clip (x0,y0,x1,y1)   9 dim (y0,y1)   10 fill-alpha (y0,y1,alpha in A, color)
     300000-300001  pad, active low. See hw.h for the bits.
     400000-400001  music cue, written by the 68000. The driver plays it.
                    0 off  1 overworld  2 training  3 shop  4 prologue  5 ending
                    6..11 level1..level6  12..17 boss1..boss6
     400002-400003  volume, 0 off, 30, 60, 100. The driver owns the notes.
     500000-50003F  NVRAM, 32 words. The save.
*/

#include "driver.h"
#include "palette.h"
#include "fbdraw.h"

static UINT16 pp_fb[FB_W * FB_H];
static UINT16 pp_x, pp_y, pp_a, pp_b, pp_c;
static UINT8 pp_nv[64];
static UINT16 pp_song, pp_vol = 60;

/* The 17 songs, named the way web/assets/music.js names them. The notes
   themselves are not in this file: this sandbox has no MAME to hear them,
   and the 68000 does not synthesize. A later pass fills pp_score. */
static const char *pp_song_name[18] = {
    "off", "overworld", "training", "shop", "prologue", "ending",
    "level1", "level2", "level3", "level4", "level5", "level6",
    "boss1", "boss2", "boss3", "boss4", "boss5", "boss6"
};

static WRITE16_HANDLER(pp_music_w)
{
    if (offset == 0) pp_song = data;
    else pp_vol = data;
    (void)pp_song_name;
}

static READ16_HANDLER(pp_nv_r)
{
    return pp_nv[offset * 2] | (pp_nv[offset * 2 + 1] << 8);
}

static WRITE16_HANDLER(pp_nv_w)
{
    UINT16 cur = pp_nv[offset * 2] | (pp_nv[offset * 2 + 1] << 8);
    COMBINE_DATA(&cur);
    pp_nv[offset * 2] = cur & 0xff;
    pp_nv[offset * 2 + 1] = (cur >> 8) & 0xff;
}

static WRITE16_HANDLER(pp_blit_w)
{
    switch (offset) {
    case 0: pp_x = data; break;
    case 1: pp_y = data; break;
    case 2: pp_a = data; break;
    case 3: pp_b = data; break;
    case 4: pp_c = data; break;
    case 5:
        if (data == 1)
            fb_clear(pp_fb, pp_c);
        else if (data == 2)
            fb_rect(pp_fb, (signed short)pp_x, (signed short)pp_y, (signed short)pp_a, (signed short)pp_b, pp_c);
        else if (data == 3)
            fb_glyph(pp_fb, (signed short)pp_x, (signed short)pp_y, pp_a, pp_c, pp_b ? pp_b : 1);
        else if (data == 4 || data == 5 || data == 6 || data == 7) {
            int id = pp_a == 0xffff ? -1 : (int)pp_a;
            int flip = pp_b & 1;
            int x = (signed short)pp_x;
            int y = (signed short)pp_y;
            if (data == 4)
                fb_sprite(pp_fb, x, y, id, flip, FB_OPAQUE, 0, 255);
            else if (data == 5)
                fb_sprite(pp_fb, x, y, id, flip, FB_FADE, 0, pp_c);
            else if (data == 6)
                fb_sprite(pp_fb, x, y, id, flip, FB_ALPHA, 0, pp_c);
            else
                fb_sprite(pp_fb, x, y, id, flip, FB_TINT, pp_c, pp_b >> 8);
        } else if (data == 8)
            fb_clip((signed short)pp_x, (signed short)pp_y, (signed short)pp_a, (signed short)pp_b);
        else if (data == 9)
            fb_dim(pp_fb, (signed short)pp_x, (signed short)pp_y);
        else if (data == 10)
            fb_fill_alpha(pp_fb, (signed short)pp_x, (signed short)pp_y, pp_c, (signed short)pp_a);
        break;
    }
}

static MEMORY_READ16_START(pp_readmem)
    { 0x000000, 0x07ffff, MRA16_ROM },
    { 0x100000, 0x10ffff, MRA16_RAM },
    { 0x300000, 0x300001, input_port_0_word_r },
    { 0x500000, 0x50003f, pp_nv_r },
MEMORY_END

static MEMORY_WRITE16_START(pp_writemem)
    { 0x000000, 0x07ffff, MWA16_ROM },
    { 0x100000, 0x10ffff, MWA16_RAM },
    { 0x200000, 0x20000b, pp_blit_w },
    { 0x400000, 0x400003, pp_music_w },
    { 0x500000, 0x50003f, pp_nv_w },
MEMORY_END

INPUT_PORTS_START(parryperry)
    PORT_START
    PORT_BIT(0x0001, IP_ACTIVE_LOW, IPT_JOYSTICK_UP)
    PORT_BIT(0x0002, IP_ACTIVE_LOW, IPT_JOYSTICK_DOWN)
    PORT_BIT(0x0004, IP_ACTIVE_LOW, IPT_JOYSTICK_LEFT)
    PORT_BIT(0x0008, IP_ACTIVE_LOW, IPT_JOYSTICK_RIGHT)
    PORT_BIT(0x0010, IP_ACTIVE_LOW, IPT_BUTTON1) /* A */
    PORT_BIT(0x0020, IP_ACTIVE_LOW, IPT_BUTTON2) /* B */
    PORT_BIT(0x0040, IP_ACTIVE_LOW, IPT_BUTTON3) /* X */
    PORT_BIT(0x0080, IP_ACTIVE_LOW, IPT_BUTTON4) /* Y */
    PORT_BIT(0x0100, IP_ACTIVE_LOW, IPT_BUTTON5) /* L1 */
    PORT_BIT(0x0200, IP_ACTIVE_LOW, IPT_BUTTON6) /* R1 */
    PORT_BIT(0x0400, IP_ACTIVE_LOW, IPT_BUTTON7) /* L2 */
    PORT_BIT(0x0800, IP_ACTIVE_LOW, IPT_BUTTON8) /* R2 */
    PORT_BIT(0x1000, IP_ACTIVE_LOW, IPT_START1)
    PORT_BIT(0x2000, IP_ACTIVE_LOW, IPT_COIN1)
    PORT_BIT(0x4000, IP_ACTIVE_LOW, IPT_UNUSED)
    PORT_BIT(0x8000, IP_ACTIVE_LOW, IPT_UNUSED)
INPUT_PORTS_END

VIDEO_START(parryperry)
{
    const unsigned char *rom = memory_region(REGION_CPU1);
    generic_nvram = pp_nv;
    generic_nvram_size = sizeof(pp_nv);
    fb_clear(pp_fb, 0);
    if (rom && memory_region_length(REGION_CPU1) > 0x80000)
        fb_set_art(rom + 0x80000);
    else
        fb_set_art(0);
    return 0;
}

static UINT32 pp_pack(int depth, UINT8 r, UINT8 g, UINT8 b)
{
    if (depth == 32) {
        return (r * (direct_rgb_components[0] / 255))
             + (g * (direct_rgb_components[1] / 255))
             + (b * (direct_rgb_components[2] / 255));
    }
    return ((r >> 3) * (direct_rgb_components[0] / 0x1f))
         + ((g >> 3) * (direct_rgb_components[1] / 0x1f))
         + ((b >> 3) * (direct_rgb_components[2] / 0x1f));
}

VIDEO_UPDATE(parryperry)
{
    int y, x;
    int depth = bitmap->depth;
    for (y = cliprect->min_y; y <= cliprect->max_y; y++) {
        UINT16 *src = pp_fb + y * FB_W;
        if (depth == 32) {
            UINT32 *dst = (UINT32 *)bitmap->line[y];
            for (x = cliprect->min_x; x <= cliprect->max_x; x++) {
                UINT16 c = src[x];
                dst[x] = pp_pack(32, (c >> 11) << 3, ((c >> 5) & 0x3f) << 2, (c & 0x1f) << 3);
            }
        } else {
            UINT16 *dst = (UINT16 *)bitmap->line[y];
            for (x = cliprect->min_x; x <= cliprect->max_x; x++) {
                UINT16 c = src[x];
                dst[x] = (UINT16)pp_pack(15, (c >> 11) << 3, ((c >> 5) & 0x3f) << 2, (c & 0x1f) << 3);
            }
        }
    }
}

static MACHINE_DRIVER_START(parryperry)
    MDRV_CPU_ADD(M68000, 12000000)
    MDRV_CPU_MEMORY(pp_readmem, pp_writemem)
    MDRV_CPU_VBLANK_INT(irq6_line_hold, 1)

    MDRV_FRAMES_PER_SECOND(60)
    MDRV_VBLANK_DURATION(DEFAULT_60HZ_VBLANK_DURATION)

    MDRV_VIDEO_ATTRIBUTES(VIDEO_TYPE_RASTER | VIDEO_RGB_DIRECT)
    MDRV_SCREEN_SIZE(FB_W, FB_H)
    MDRV_VISIBLE_AREA(0, FB_W - 1, 0, FB_H - 1)
    MDRV_PALETTE_LENGTH(0)

    MDRV_VIDEO_START(parryperry)
    MDRV_VIDEO_UPDATE(parryperry)

    MDRV_NVRAM_HANDLER(generic_0fill)
MACHINE_DRIVER_END

ROM_START(parryperry)
#include "rom_load.inc"
ROM_END

DRIVER_INIT(parryperry)
{
    generic_nvram = pp_nv;
    generic_nvram_size = sizeof(pp_nv);
}

GAME(2026, parryperry, 0, parryperry, parryperry, parryperry, ROT0, "Homebrew", "Parry Perry")
