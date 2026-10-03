# Parry Perry boot ROM. Needs an m68k-elf-gcc (make M68K_CC=... if it is not on PATH).
# Not $(CC): a parent make often sets CC to the host compiler.
M68K_CC  ?= m68k-elf-gcc
OBJCOPY  ?= $(patsubst %gcc,%objcopy,$(M68K_CC))
CFLAGS  := -m68000 -msoft-float -Os -ffreestanding -fno-builtin -fno-pic -Wall -Wextra
CFLAGS  += -fno-tree-loop-distribute-patterns
LDFLAGS := -nostdlib -T link.ld -lgcc

BUILD := ../build
ROM   := ../roms/main.bin
ART   := ../roms/art.bin
ZIP   := ../roms/parryperry.zip
IDS   := art_ids.h

.PHONY: all rom preview clean art

all: rom

art: $(ART) $(IDS)

$(ART) $(IDS): ../tools/bake_art.py
	python3 ../tools/bake_art.py

$(BUILD)/start.o: start.s
	mkdir -p $(BUILD)
	$(M68K_CC) $(CFLAGS) -c start.s -o $@

$(BUILD)/hal_m68k.o: hal_m68k.c hw.h
	mkdir -p $(BUILD)
	$(M68K_CC) $(CFLAGS) -c hal_m68k.c -o $@

$(BUILD)/main.o: main.c hw.h $(IDS)
	mkdir -p $(BUILD)
	$(M68K_CC) $(CFLAGS) -c main.c -o $@

$(BUILD)/parryperry.elf: $(BUILD)/start.o $(BUILD)/hal_m68k.o $(BUILD)/main.o link.ld
	$(M68K_CC) $(CFLAGS) $(LDFLAGS) $(BUILD)/start.o $(BUILD)/hal_m68k.o $(BUILD)/main.o -o $@

rom: $(BUILD)/parryperry.elf $(ART)
	mkdir -p ../roms
	$(OBJCOPY) -O binary $(BUILD)/parryperry.elf $(BUILD)/main.unpadded
	python3 ../tools/pack_rom.py $(BUILD)/main.unpadded $(ART) $(ROM) $(ZIP) ../driver/rom_load.inc

preview: main.c hw.h $(IDS) $(ART) ../driver/fbdraw.c ../driver/fbdraw.h
	mkdir -p $(BUILD)
	gcc -O2 -Wall -Wextra -I. -I../driver -o $(BUILD)/host_preview ../tools/host_preview.c main.c ../driver/fbdraw.c
	$(BUILD)/host_preview $(BUILD)/boot.ppm
	python3 ../tools/ppm_to_png.py $(BUILD)/boot.ppm ../boot.png

clean:
	rm -rf $(BUILD)
