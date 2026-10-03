/* Parry Perry, a homebrew machine for MAME 2003-Plus.
   Not a real arcade board. One 68000, a 640x480 RGB565 frame the driver
   draws, and eight action buttons. The ROM is the game. The pixels are
   not written by the emulated CPU: a full-frame software fill is already
   too slow on a real SH-4, and it is hopeless under an interpreted 68000.
   See ports/mame2003/README.md in the Biboo repo.

   Memory map
     000000-07FFFF  ROM, 512K, the boot image main.bin
     100000-10FFFF  work RAM, 64K
     200000-20000B  blitter, six 16-bit registers, write the command last
                    0 X, 1 Y, 2 A, 3 B, 4 color (RGB565), 5 command
                    command 1 clear (color), 2 rect (x,y,w,h,color),
                    3 glyph (x,y,char,scale,color)
     300000-300001  pad, active low. See hw.h for the bits.
*/

#include "driver.h"
#include "palette.h"
#include "fbdraw.h"

static UINT16 pp_fb[FB_W * FB_H];
static UINT16 pp_x, pp_y, pp_a, pp_b, pp_c;

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
        break;
    }
}

static MEMORY_READ16_START(pp_readmem)
    { 0x000000, 0x07ffff, MRA16_ROM },
    { 0x100000, 0x10ffff, MRA16_RAM },
    { 0x300000, 0x300001, input_port_0_word_r },
MEMORY_END

static MEMORY_WRITE16_START(pp_writemem)
    { 0x000000, 0x07ffff, MWA16_ROM },
    { 0x100000, 0x10ffff, MWA16_RAM },
    { 0x200000, 0x20000b, pp_blit_w },
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
    fb_clear(pp_fb, 0);
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
MACHINE_DRIVER_END

ROM_START(parryperry)
    ROM_REGION(0x80000, REGION_CPU1, 0)
#include "rom_load.inc"
ROM_END

GAME(2026, parryperry, 0, parryperry, parryperry, 0, ROT0, "Homebrew", "Parry Perry")
