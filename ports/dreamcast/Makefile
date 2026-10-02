# Parry Perry, Dreamcast port. ON-DEMAND ONLY: not part of the permanent pipeline and not run by any CI (see README.md).
#   make        -> parryperry.elf
#   make cdi    -> parryperry.cdi (needs mkdcdisc; see tools/setup_toolchain.sh)
CC      = sh-elf-gcc
AS      = sh-elf-gcc
LD      = sh-elf-gcc

ARCHFLAGS = -m4-single-only -ml
CFLAGS    = $(ARCHFLAGS) -O2 -fno-builtin -ffreestanding -fomit-frame-pointer -fno-tree-loop-distribute-patterns \
            -Wall -Wextra -nostdlib -nostartfiles -nodefaultlibs
LDFLAGS   = $(ARCHFLAGS) -nostdlib -nostartfiles -nodefaultlibs -T dc.ld -Wl,--build-id=none

OBJS = src/start.o src/main.o

all: parryperry.elf

src/start.o: src/start.S
	$(AS) $(ARCHFLAGS) -c -o $@ $<

src/main.o: src/main.c src/font8x8_basic.h
	$(CC) $(CFLAGS) -c -o $@ $<

parryperry.elf: $(OBJS) dc.ld
	$(LD) $(LDFLAGS) -o $@ $(OBJS) -lgcc

cdi: parryperry.elf
	mkdcdisc -e parryperry.elf -o parryperry.cdi -n "Parry Perry" -a "Parry Perry" -N --allow-overwrite

clean:
	rm -f $(OBJS) parryperry.elf parryperry.cdi

.PHONY: all cdi clean
