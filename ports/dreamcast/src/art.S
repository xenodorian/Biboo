! The art pack (build/ART.BIN, made by tools/bake_game.py) embedded in the ELF read-only data.
    .section .rodata
    .balign 4
    .globl _art_pack
_art_pack:
    .incbin "build/ART.BIN"
    .balign 4
    .globl _art_pack_end
_art_pack_end:
