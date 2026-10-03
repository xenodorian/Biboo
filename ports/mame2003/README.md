# Parry Perry, MAME 2003 port

**ON DEMAND, and not part of the web pipeline.** Nothing in `web/` or the GitHub Pages build depends on this. Do not wire it into `python -m swingkit` or CI. The Dreamcast port in `ports/dreamcast/` is **paused** (2026-10-03). Its code stays. New port work happens here.

The same ROM zip is the game on PC, a phone, and the R36S. Each machine needs its own build of the core, because the core is the hardware. The zip does not change between them.

## What the Gemini handoff got right

- Stock MAME 2003 boards are 240p or 384p and stop at six buttons. A 640×480 game with eight buttons needs a driver added to [mame2003-plus](https://github.com/libretro/mame2003-plus-libretro) (MAME 0.78).
- The game is C, compiled for a Motorola 68000, packed in a zip, and loaded by that custom core.
- PC, Android, and the R36S each get their own core build. The zip is the shared file.

## What that handoff got wrong, and what this tree does instead

The sample `custom_480p.c` and the two-line `m68k-elf-gcc` command will not build, and the memory map in the sample C does not match the sample driver. This port keeps the goal and uses the real 0.78 macros (`VIDEO_START`, `MEMORY_READ16_START`, `GAME`, `ROM_LOAD16_WORD`).

The other change is the one the Dreamcast port already paid for. A full-frame software redraw cost 4 to 10 ms on a real 200 MHz SH-4. MAME 2003 *interprets* every 68000 instruction, so the same 640×480 fill cannot reach a playable frame rate on a handheld. The 68000 writes draw commands (clear, rectangle, glyph). The driver runs them as native code into a 640×480 RGB565 buffer, then copies that to the screen at vblank. The CPU waits on the level-6 interrupt with `STOP`, so a wait does not burn the host. A raw framebuffer at a magic address is not the path the game uses.

Eight buttons are real inputs, not chords. The Dreamcast pad was short two buttons, so L2 and R2 became key combinations. This port does not repeat that.

| Bit in the pad word (0 means held) | RetroArch button | Game |
|---|---|---|
| 0 up, 1 down, 2 left, 3 right | d-pad | move |
| 4, 5, 6, 7 | Button 1, 2, 3, 4 | A attack, B parry, X dash, Y spin |
| 8, 9, 10, 11 | Button 5, 6, 7, 8 | L1, R1, L2, R2 |
| 12, 13 | Start, Coin | Start, Coin |

Map them in RetroArch under Quick Menu, Controls, Port 1. The boot ROM turns a label gold while that button is held, and the square takes the colour of A, B, X, or Y.

## Lessons kept from the Dreamcast port

- The runtime is a C rewrite. The web game is not wrapped, and this port is not part of its build.
- Art and data get baked on a PC. The ROM consumes tables. That baker is not in this step yet. The Dreamcast one (`ports/dreamcast/tools/bake_game.py`) is the model.
- One web map is exactly 384×216 with no scrolling. 2× of that is 768×432, which does not fit 640×480. This port draws the map **1:1** and uses the margin as the HUD. The Dreamcast's 5/6 scale was a last resort for a 320×240 TV mode. Do not stretch the map here.
- Pixels stay RGB565. The sprite colour key, when art arrives, stays `0xF81F`.
- No floating point on this CPU. The 68000 has no FPU, and a 68881 would be emulated too. The Dreamcast code uses `float`. Bringing it over means fixed point.
- Sound is not the Dreamcast AICA. When music is ported, the driver should play the baked note list natively, the way `audio_tick` was once a frame. Do not run the synth on the 68000.
- Saves will be MAME NVRAM, not a VMU. The record can follow the Dreamcast save (levels, leaves, ankhs, unlocks, gems, meters). A web save will not load.
- Phases, and no false claims. Flycast on a desktop was not a Dreamcast, and a desktop core is not an R36S. Do not say this runs on a phone or the R36S until someone has booted the zip there.
- Build the disc, or here the zip, only when asked. This step was asked for.

## Build the ROM

Needs `m68k-elf-gcc` on `PATH` (any 68000 bare-metal GCC).

    make -C ports/mame2003/game

That writes `ports/mame2003/roms/parryperry.zip` (the file you load) and `driver/rom_load.inc` (the CRC the core checks). A picture of the boot screen, from the same `game_main` with Right and A held, is:

    make -C ports/mame2003/game preview

## Build the core

Clone [libretro/mame2003-plus-libretro](https://github.com/libretro/mame2003-plus-libretro). From this repo:

    python3 ports/mame2003/tools/install_driver.py /path/to/mame2003-plus-libretro
    make -C /path/to/mame2003-plus-libretro platform=unix

The script copies `src/drivers/parryperry.c`, the blitter, the font, and the hash line, and registers `DRIVER(parryperry)`. Re-run it after every ROM rebuild, then rebuild the core, or the zip's CRC will not match.

Targets that actually exist in that makefile (the handoff's `platform=armv7-neon-hardfp` is not one of them):

| Machine | Make platform | Notes |
|---|---|---|
| PC Linux | `unix` | produces `mame2003_plus_libretro.so` |
| Android | `android-armv7` | needs the NDK compiler it expects. There is no arm64 Android target in this makefile. |
| R36S-class, 32-bit ARM | `classic_armv8_a35` | tunes for a Cortex-A35, still 32-bit (`-marm`). A 64-bit ArkOS userspace has no stock target here. Not built or booted in this step. |

Put the `.so` in RetroArch's cores directory and `ports/mame2003/roms/parryperry.zip` in the ROMs folder. Load Core, then the zip. The game name is **Parry Perry**.

## Status

**MAME-1 (this step).** The machine, the eight-button pad, the blitter, and a boot ROM that draws the title and moves a square. Checked by compiling the 68000 image and by drawing one frame of the same C on the host (`boot.png`). Not yet run inside MAME, and not run on a phone or an R36S.

Not in the ROM yet, on purpose: Perry's moves, enemies, maps, the shop, saves, music. Next step is MAME-2, a fixed-point draw path in the same command style as `ports/dreamcast/src/gfx.c`, then the baked art. The web game stays the source of the numbers.

## Memory map (for the next step)

    000000-07FFFF  ROM, 512K, main.bin
    100000-10FFFF  work RAM, 64K. Reset stack is 0x110000.
    200000-20000B  blitter registers, 16-bit. Write the command last.
                   1 clear, 2 rectangle, 3 glyph (8x8, scale 1 or 2)
    300000-300001  pad, active low

Vblank is a level-6 autovector. The boot ROM stops the CPU until it arrives.
