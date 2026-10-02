! Minimal SH4 entry point for a bare-metal Dreamcast ELF (from the CryMon port handoff, Appendix B, plus bss clearing).
! The boot loader (real BIOS or Flycast's reios) loads the segments and jumps here with the CPU state otherwise
! undefined: disable interrupts, pick a known status register, set the stack at the top of the 16MB RAM, clear bss.

    .section .text.start
    .globl _start

_start:
    mov.l   sr_init, r0
    ldc     r0, sr

    mov.l   stack_top, r15

    ! zero the bss (the handoff says to never depend on luck here)
    mov.l   bss_start, r1
    mov.l   bss_end, r2
    mov     #0, r0
1:  cmp/hs  r2, r1
    bt      2f
    mov.l   r0, @r1
    bra     1b
    add     #4, r1
2:
    mov.l   main_addr, r0
    jsr     @r0
    nop

halt:
    bra     halt
    nop

    .align  4
sr_init:
    .long   0x500000f0
stack_top:
    .long   0x8cfffff0
bss_start:
    .long   __bss_start
bss_end:
    .long   __bss_end
main_addr:
    .long   _main
