# Parry Perry, Dreamcast port. ON-DEMAND ONLY: not part of the permanent pipeline and not run by any CI (see README.md).
#   make assets  -> build/ART.BIN and src/gen/game_data.h from the web game (needs node and python3 with Pillow and numpy)
#   make         -> parryperry.elf
#   make cdi     -> parryperry.cdi (needs mkdcdisc; see tools/setup_toolchain.sh)
CC      = sh-elf-gcc
AS      = sh-elf-gcc
LD      = sh-elf-gcc

ARCHFLAGS = -m4-single-only -ml
CFLAGS    = $(CFLAGS_EXTRA) $(ARCHFLAGS) -O2 -fno-builtin -ffreestanding -fomit-frame-pointer -fno-tree-loop-distribute-patterns \
            -Wall -Wextra -nostdlib -nostartfiles -nodefaultlibs
LDFLAGS   = $(ARCHFLAGS) -nostdlib -nostartfiles -nodefaultlibs -T dc.ld -Wl,--build-id=none

OBJS = src/start.o src/hw.o src/gfx.o src/game.o src/main.o src/art.o src/gen/game_data.o

WEB = ../../web
ASSET_SRC = $(wildcard $(WEB)/assets/*.js $(WEB)/assets/moves/*.png $(WEB)/assets/enemies/*.png $(WEB)/assets/layers/*.png) tools/bake_game.py tools/dump_game_data.js

all: parryperry.elf

assets: build/ART.BIN src/gen/game_data.h src/gen/game_data.c
build/ART.BIN src/gen/game_data.h src/gen/game_data.c: $(ASSET_SRC)
	node tools/dump_game_data.js
	python3 tools/bake_game.py

src/start.o: src/start.S
	$(AS) $(ARCHFLAGS) -c -o $@ $<

src/art.o: src/art.S build/ART.BIN
	$(AS) $(ARCHFLAGS) -c -o $@ $<

src/hw.o: src/hw.c src/dc.h
	$(CC) $(CFLAGS) -c -o $@ $<

src/gfx.o: src/gfx.c src/dc.h src/font8x8_basic.h
	$(CC) $(CFLAGS) -c -o $@ $<

src/game.o: src/game.c src/dc.h src/gen/game_data.h
	$(CC) $(CFLAGS) -c -o $@ $<

src/main.o: src/main.c src/dc.h
	$(CC) $(CFLAGS) -c -o $@ $<

parryperry.elf: $(OBJS) dc.ld
	$(LD) $(LDFLAGS) -o $@ $(OBJS) -lgcc

cdi: parryperry.elf
	mkdcdisc -e parryperry.elf -o parryperry.cdi -n "Parry Perry" -a "Parry Perry" -N --allow-overwrite

clean:
	rm -f $(OBJS) parryperry.elf parryperry.cdi

.PHONY: all assets cdi clean
