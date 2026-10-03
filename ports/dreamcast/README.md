# Parry Perry, Dreamcast port

**PAUSED, 2026-10-03.** The owner moved the port to MAME 2003 (`ports/mame2003/`). Do not keep building this disc unless asked. The code stays, because the MAME port is reusing its lessons (C runtime, baked data, 384×216 maps, RGB565, no false hardware claims).

**ON-DEMAND ONLY.** This port is not part of the permanent pipeline. No CI builds it, nothing in the web game depends on it,
and a Dreamcast disc image (`.cdi`) is built and delivered only when the project owner asks for one. Do not wire it into
`python -m swingkit`, the web build or any workflow. (Owner's instruction, 2026-10-02.)

It is a **rewrite of the game's runtime in C** for the SH-4 CPU, plus Python tools that run on a PC and turn the game's art
and data into C source or disc data. Method and hard-won lessons: the CryMon port handoff (`DREAMCAST_PORT_HANDOFF.txt`, kept
by the owner; its key points are repeated here). Bare metal, no KallistiOS, no C library.

## Build

    ports/dreamcast/tools/setup_toolchain.sh /tmp/dcwork   # once: compiler, mkdcdisc, Flycast emulator (the emulator takes long)
    make -C ports/dreamcast            # parryperry.elf
    make -C ports/dreamcast cdi        # parryperry.cdi, the disc image (git ignores it)

`make assets` regenerates `build/ART.BIN`, `src/gen/game_data.[ch]` and `src/gen/music_data.[ch]` from the web game (needs node, python3 with
Pillow and numpy). Test builds (never ship them): `make clean && make CFLAGS_EXTRA='-DAUTOTEST'` adds a bot that plays;
add `-DGODMODE`, `-DKILLALL`, `-DSTART_LEVEL=n -DSTART_MAP=m` (0-based) as needed. Emulator runs: `tools/emu_run.py` (screenshots, key presses,
`--home DIR` for a persistent virtual memory card, `--audio FILE` to record the sound).

## Facts the code relies on (from the handoff; [V] = verified in the CryMon port, the R36S is untested by anyone)

- Video: 320x240, RGB565, NTSC, CPU-drawn into video RAM at 0xa5000000, two buffers (0x000000 and 0x040000), redraw every frame,
  flip after vblank. Colour key for sprites 0xF81F (no alpha).
- Pad: Maple bus port A unit 0, buttons active low, one GetCondition per frame. Bounded wait.
- RAM is 16 MB at 0x8c000000, program at 0x8c010000, stack 0x8cfffff0. Zero the bss in start.S. Float only (no double).
- Disc image: `mkdcdisc -e x.elf [-f extra.bin] -o x.cdi -n "Parry Perry" -a "Parry Perry" -N --allow-overwrite`.
- Emulator tests only prove behaviour in desktop Flycast with its built-in BIOS. Nothing is verified on a real Dreamcast or the R36S.
  Never say "it works on the R36S" until someone has run it there.

## Status

See "Dreamcast port (on demand only)" in `Current_Work.md` for the step log and what to do next.
