/* Parry Perry, Dreamcast port: entry point and the 60 Hz loop. ON-DEMAND ONLY, see ../README.md */
#include "dc.h"

int main(void) {
    u32 t_start, draw_us = 0, frame_us = 0, last = 0;
    hw_init();
    game_init();
    last = hw_ticks();
    for(;;) {
        u16 raw = hw_pad();
        t_start = hw_ticks();
        game_frame(raw, frame_us, draw_us);                    /* update and draw into scr[] */
        draw_us = (hw_ticks() - t_start) / 25 * 2;             /* guest time for the update and the draw: 12.5 ticks per microsecond */
        hw_present(scr);                                       /* copy to video RAM, wait for vblank, flip */
        frame_us = (hw_ticks() - last) / 25 * 2;
        last = hw_ticks();
    }
    return 0;
}
