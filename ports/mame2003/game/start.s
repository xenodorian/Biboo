/* 68000 reset vectors and the vblank autovector. No C library. */
.section .vectors,"a",@progbits
    .long 0x00110000          /* reset SP: top of the 64K work RAM */
    .long _start              /* reset PC */
    .long _halt               /* bus error */
    .long _halt               /* address error */
    .rept 26                  /* vectors 4 through 29 */
    .long _rte
    .endr
    .long vblank_irq          /* vector 30, interrupt level 6 */
    .long _rte                /* vector 31 */

.section .text
.global _start
.global vblank_irq

_start:
    move.w #0x2000, %sr       /* supervisor, interrupts enabled */
    lea _sbss, %a0
    lea _ebss, %a1
1:
    cmp.l %a0, %a1
    beq.s 2f
    clr.b (%a0)+
    bra.s 1b
2:
    jsr game_main
3:
    bra.s 3b

vblank_irq:
    move.b #1, vblank_flag
    rte

_rte:
    rte

_halt:
    bra.s _halt
