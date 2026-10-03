OUTPUT_ARCH(m68k)
OUTPUT_FORMAT(elf32-m68k)
ENTRY(_start)

MEMORY {
    rom : ORIGIN = 0x000000, LENGTH = 512K
    ram : ORIGIN = 0x100000, LENGTH = 64K
}

SECTIONS {
    .vectors 0x000000 : { KEEP(*(.vectors)) } > rom
    .text : {
        *(.text .text.*)
        *(.rodata .rodata.*)
        . = ALIGN(2);
    } > rom
    .bss : {
        _sbss = .;
        *(.bss .bss.*)
        *(COMMON)
        . = ALIGN(2);
        _ebss = .;
    } > ram
    /DISCARD/ : { *(.comment) *(.note*) *(.eh_frame*) *(.gnu*) }
}
