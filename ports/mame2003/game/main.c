/* Parry Perry, MAME 2003. Step MAME-3.
   One screen of the Green Trail. Perry's basic kit, in whole pixels:
   walk, duck, block, parry, slash, dash, jump, spin, thrust, upswing.
   No floats. Roots come from the baked frames. Not the full web reader. */
#include "hw.h"
#include "art_ids.h"

#define COL_BG     RGB565(20, 24, 28)
#define COL_GOLD   RGB565(196, 163, 90)
#define COL_INK    RGB565(244, 240, 230)
#define COL_DIM    RGB565(138, 132, 120)
#define COL_GREEN  RGB565(80, 168, 96)
#define COL_BLUE   RGB565(64, 112, 196)
#define COL_YELLOW RGB565(220, 196, 64)

#define PF_X 128
#define PF_Y 88
#define TAP_MS 150

#define K_HOLD   0
#define K_ACTION 1

static int px = ANCHOR_X;
static int face = 1;
static int mv = MV_IDLE;
static int fr = 0;
static int acc = 0;
static int kind = K_HOLD;
static int clock_ms = 0;
static int b_at = -1;

static void apply_hold(u16 down);

static void hw_text(int x, int y, const char *s, u16 color, int scale)
{
    int i;
    for (i = 0; s[i]; i++) {
        hw_glyph(x, y, (unsigned char)s[i], color, scale);
        x += 8 * scale;
    }
}

static void mark(int x, int y, const char *s, int on)
{
    hw_text(x, y, s, on ? COL_GOLD : COL_DIM, 1);
}

static int wrap_mod(int a, int m)
{
    while (a < 0)
        a += m;
    while (a >= m)
        a -= m;
    return a;
}

static int mul_q8(int v, int q8)
{
    int neg = 0;
    int r;
    if (v < 0) {
        neg = 1;
        v = -v;
    }
    r = (v * q8 + 128) >> 8;
    return neg ? -r : r;
}

static int fbase(void)
{
    return (int)MV_F0[mv] + fr;
}

static void clamp_x(void)
{
    if (px < 20)
        px = 20;
    if (px > VIEW_W - 20)
        px = VIEW_W - 20;
}

/* Leaving a frame keeps the ground it covered. Same rule as the web rootOf handoff. */
static void begin(int id, int knd, int newface)
{
    px += face * (int)F_RX[fbase()];
    face = newface;
    mv = id;
    fr = 0;
    acc = 0;
    kind = knd;
    clamp_x();
}

static void advance(void)
{
    int base, n, ms;
    acc += 16;
    for (;;) {
        base = (int)MV_F0[mv];
        n = (int)MV_N[mv];
        ms = (int)F_MS[base + fr];
        if (acc < ms)
            return;
        acc -= ms;
        fr++;
        if (fr < n)
            continue;
        if (kind == K_ACTION) {
            px += face * (int)F_RX[base + n - 1];
            clamp_x();
            mv = MV_IDLE;
            fr = 0;
            acc = 0;
            kind = K_HOLD;
            return;
        }
        if (MV_LOOP[mv]) {
            int lf = (int)MV_LF[mv];
            int last = (int)F_RX[base + n - 1];
            int prev = n > 1 ? (int)F_RX[base + n - 2] : 0;
            int from = (int)F_RX[base + lf];
            px += face * (last + (last - prev) - from);
            clamp_x();
            fr = lf;
        } else {
            fr = n - 1;
            return;
        }
    }
}

static void read_pad(u16 down, u16 prev)
{
    int pressed = down & ~prev;

    clock_ms += 16;
    if ((down & PAD_B) && !(prev & PAD_B))
        b_at = clock_ms;
    if (!(down & PAD_B) && (prev & PAD_B)) {
        if (b_at >= 0 && clock_ms - b_at <= TAP_MS && kind != K_ACTION)
            begin(MV_PARRY, K_ACTION, face);
        b_at = -1;
    }

    if (kind != K_ACTION) {
        if (pressed & PAD_A) {
            if (down & PAD_DOWN)
                begin(MV_UPSWING, K_ACTION, face);
            else if (down & PAD_LEFT)
                begin(MV_THRUST, K_ACTION, -1);
            else if (down & PAD_RIGHT)
                begin(MV_THRUST, K_ACTION, 1);
            else
                begin(MV_SLASH, K_ACTION, face);
        } else if (pressed & PAD_X)
            begin(MV_DASH, K_ACTION, face);
        else if (pressed & PAD_Y)
            begin(MV_SPIN, K_ACTION, face);
        else if (pressed & PAD_UP)
            begin(MV_JUMP, K_ACTION, face);
    }

    if (kind == K_ACTION && mv == MV_JUMP && F_RY[fbase()] > 0) {
        if (down & PAD_LEFT) {
            px -= 1;
            face = -1;
        }
        if (down & PAD_RIGHT) {
            px += 1;
            face = 1;
        }
        clamp_x();
    }
    apply_hold(down);
}

static void apply_hold(u16 down)
{
    int want, nf, block;
    if (kind != K_HOLD)
        return;
    want = MV_IDLE;
    nf = face;
    block = b_at >= 0 && clock_ms - b_at > TAP_MS;
    if (block)
        want = MV_BLOCK;
    else if (down & PAD_DOWN)
        want = MV_DUCK;
    else if ((down & PAD_LEFT) && !(down & PAD_RIGHT)) {
        nf = -1;
        want = MV_WALK;
    } else if ((down & PAD_RIGHT) && !(down & PAD_LEFT)) {
        nf = 1;
        want = MV_WALK;
    }
    if (want != mv || nf != face)
        begin(want, K_HOLD, nf);
}

static void draw_tiled(int id, int period, int margin, int par_q8, int bgx)
{
    int dx, x0, xx;
    if (id < 0 || period <= 0)
        return;
    dx = -mul_q8(bgx, par_q8);
    x0 = wrap_mod(dx, period) - period;
    for (xx = x0; xx < VIEW_W; xx += period)
        hw_sprite(PF_X + xx, PF_Y - margin, id, 0);
}

static void draw_world(void)
{
    int i, rx, ry;
    hw_clip(PF_X, PF_Y, PF_X + VIEW_W, PF_Y + VIEW_H);
    for (i = 0; i < NLAYERS; i++)
        draw_tiled(LAYER_ID[i], LAYER_PERIOD[i], LAYER_MARGIN[i], LAYER_PAR[i], ANCHOR_X);
    if (FRINGE_ID >= 0)
        draw_tiled(FRINGE_ID, FRINGE_PERIOD, VIEW_MARGIN, 256, ANCHOR_X);
    rx = face * (int)F_RX[fbase()];
    ry = (int)F_RY[fbase()];
    hw_sprite(PF_X + px + rx, PF_Y + FEET_ROW - ry, F_SPR[fbase()], face < 0);
    hw_clip(0, 0, 640, 480);
}

void game_main(void)
{
    u16 prev = 0xffff;

    hw_init();
    for (;;) {
        u16 pad = hw_pad();
        u16 down = (u16)~pad;

        read_pad(down, (u16)~prev);
        advance();
        apply_hold(down);

        hw_clear(COL_BG);
        hw_rect(8, 8, 624, 464, COL_DIM);
        hw_rect(10, 10, 620, 460, COL_BG);
        hw_text(208, 28, "PARRYING PERRY", COL_GOLD, 2);
        hw_text(168, 56, MV_NAME[mv], COL_INK, 1);
        hw_rect(PF_X - 2, PF_Y - 2, VIEW_W + 4, VIEW_H + 4, COL_GOLD);
        draw_world();

        hw_text(48, 320, "ONE WEB MAP. THE MARGIN IS THE HUD.", COL_DIM, 1);
        mark(48,  344, "UP", down & PAD_UP);
        mark(96,  344, "DOWN", down & PAD_DOWN);
        mark(168, 344, "LEFT", down & PAD_LEFT);
        mark(232, 344, "RIGHT", down & PAD_RIGHT);
        mark(312, 344, "START", down & PAD_START);
        mark(48,  364, "A ATTACK", down & PAD_A);
        mark(160, 364, "B PARRY", down & PAD_B);
        mark(264, 364, "X DASH", down & PAD_X);
        mark(360, 364, "Y SPIN", down & PAD_Y);
        mark(48,  384, "L1", down & PAD_L1);
        mark(112, 384, "R1", down & PAD_R1);
        mark(176, 384, "L2", down & PAD_L2);
        mark(240, 384, "R2", down & PAD_R2);
        hw_text(320, 384, "UP JUMPS  B HOLD BLOCKS", COL_DIM, 1);

        prev = pad;
        hw_present();
    }
}
