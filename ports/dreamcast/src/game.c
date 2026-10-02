/* Parry Perry, Dreamcast port: the game. Ported from web/game/; the move, enemy and map tables are generated from the web data
 * (tools/bake_game.py), so the web game and this one read the same numbers.
 *
 * Step 1 (this file so far): the real background and Max on the screen, her hold moves (idle, walk, duck, block), action moves (slash,
 * spin, dash, parry), the physics jump and the landing, all driven by the move tables with the web game's rules.
 * Coordinates are the web game's ("view" pixels, 384x216, y up from the ground); only drawing converts to screen pixels (5/6 size). */
#include "dc.h"
#include "gen/game_data.h"

#define FRAME_MS 16.6667f

/* ------------------------------------------------------------------ view to screen */
static int iround(float v) { return v >= 0 ? (int)(v + 0.5f) : -(int)(-v + 0.5f); }
static int v2s(int v) { return v >= 0 ? (v * 5 + 3) / 6 : -((-v * 5 + 3) / 6); }       /* 384x216 view -> 320x180 */

/* ------------------------------------------------------------------ state (names follow web/game/03_state.js) */
enum { K_HOLD, K_ACTION, K_LAND, K_FALL };
typedef struct { int id, k, kind, face; float t; int phys; float py, pv; } Cur;
static Cur cur;
static int has_cur;
static float X;                         /* world x of her anchor, view px */
static int facing = 1;
static int fall_on; static float fall_y, fall_v;
static int queued = -1;
static float camY;
static u32 clock_ms;

static const float AIR_SPEED = 0.16f;
#define JUMP_H 130.0f
#define JUMP_UP 280.0f
#define JUMP_G (2.0f * JUMP_H / (JUMP_UP * JUMP_UP))
#define JUMP_V0 (JUMP_G * JUMP_UP)
#define JUMP_HANG_V (0.2f * JUMP_V0)
#define JUMP_HANG_G 0.5f
#define CAM_KEEP 100.0f
#define MAP_W 384
#define TAP_MS 150

static int FALL_K, LAND_K;

static const MoveFrame *mf(int id, int k) { return &MOVE_FRAMES[MOVES[id].frame0 + k]; }
static int nframes(int id) { return MOVES[id].nframes; }
static float ms_of(int id, int k) { const MoveFrame *f = mf(id, k); return f->bw ? 110.0f : (float)f->ms; }

/* root motion of the current frame: x already carries her facing */
static void root_of(const Cur *c, int k, float *rx, float *ry) {
    if(c->phys) { *rx = 0; *ry = c->py; return; }
    *rx = (float)c->face * mf(c->id, k)->rx;
    *ry = mf(c->id, k)->ry;
}

/* ------------------------------------------------------------------ input */
typedef struct { u16 held; u16 prev; } Pad;
static Pad pad;
static u32 b_down_t = 0;                /* when B went down, for tap versus hold */
static int held(u16 mask) { return (pad.held & mask) != 0; }
static int pressed_now(u16 mask) { return (pad.held & mask) && !(pad.prev & mask); }
static int released_now(u16 mask) { return !(pad.held & mask) && (pad.prev & mask); }

/* ------------------------------------------------------------------ moves */
static void start(int id, int kind);
static void hold_state(void);
enum { VIA_PRESS, VIA_CANCEL };

static int hold_want(void) {            /* the hold move to loop while nothing else plays (web/input.js holdMove: B, Down, Right, Left) */
    if(held(PAD_B) && clock_ms - b_down_t > TAP_MS) return MV_block;
    if(held(PAD_DOWN)) return MV_duck;
    if(held(PAD_RIGHT) || held(PAD_LEFT)) return MV_walk_right;                 /* both walk with the forward walk; facing mirrors it */
    return MV_idle;
}

static void hold_state(void) {
    int want = hold_want();
    if(!has_cur || cur.id != want || cur.face != facing) start(want, K_HOLD);
}

static void start(int id, int kind) {
    if(has_cur) { float rx, ry; root_of(&cur, cur.k, &rx, &ry); X += rx; }       /* keep the ground covered so far; height resets */
    cur.id = id; cur.k = 0; cur.t = 0; cur.kind = kind; cur.face = facing; cur.phys = 0; cur.py = cur.pv = 0;
    has_cur = 1;
}

static void request(int move, int via) {
    int busy;
    if(fall_on || (has_cur && cur.kind == K_LAND)) { queued = move; return; }
    busy = has_cur && cur.kind == K_ACTION;
    if(!busy || via != VIA_PRESS) { queued = -1; start(move, K_ACTION); }      /* chords, sequences and taps cancel */
    else queued = move;                                                         /* a plain press waits its turn */
}

static void finish_action(void) {
    float rx, ry;
    root_of(&cur, nframes(cur.id) - 1, &rx, &ry);
    if(ry > 0) {                                        /* ended in the air: fall back down */
        X += rx; fall_on = 1; fall_y = ry; fall_v = 0;
        cur.id = MV_jump; cur.k = FALL_K; cur.t = 0; cur.kind = K_FALL; cur.phys = 0;
        return;
    }
    X += rx;
    has_cur = 0;
    if(queued >= 0) { int q = queued; queued = -1; start(q, K_ACTION); }
    else hold_state();
}

static int airborne(void) {
    float rx, ry;
    if(fall_on || (has_cur && cur.kind == K_FALL)) return 1;
    if(!has_cur || cur.kind != K_ACTION) return 0;
    root_of(&cur, cur.k, &rx, &ry);
    return ry > 0;
}

static void step_jump(float dt) {
    cur.pv -= JUMP_G * ((cur.pv < 0 ? -cur.pv : cur.pv) < JUMP_HANG_V ? JUMP_HANG_G : 1.0f) * dt;
    cur.py += cur.pv * dt;
    cur.k = cur.pv > 0.6f * JUMP_V0 ? 1 : cur.pv > 0.2f * JUMP_V0 ? 2 : cur.pv > -0.2f * JUMP_V0 ? 3 : 4;   /* takeoff, rise, apex, fall */
    if(cur.py <= 0 && cur.pv < 0) { cur.id = MV_jump; cur.k = LAND_K; cur.t = 0; cur.kind = K_LAND; cur.phys = 0; }
}

static void step(float dt) {
    int steer = (held(PAD_RIGHT) ? 1 : 0) - (held(PAD_LEFT) ? 1 : 0);
    if(steer && (fall_on || (has_cur && (cur.kind == K_FALL || (cur.kind == K_ACTION && cur.id == MV_jump && airborne()))))) {
        X += steer * AIR_SPEED * dt; facing = steer; if(has_cur) cur.face = steer;     /* steering in the air */
    }
    if(fall_on) {
        fall_v += 0.0018f * dt; fall_y -= fall_v * dt;
        if(fall_y <= 0) { fall_on = 0; cur.id = MV_jump; cur.k = LAND_K; cur.t = 0; cur.kind = K_LAND; cur.face = has_cur ? cur.face : facing; has_cur = 1; cur.phys = 0; }
        return;
    }
    if(!has_cur) hold_state();
    if(cur.id == MV_jump && cur.kind == K_ACTION) {                                   /* the plain jump: crouch, then physics until she lands */
        if(cur.phys) { step_jump(dt); return; }
        cur.t += dt;
        if(cur.t >= ms_of(MV_jump, 0)) { cur.phys = 1; cur.py = 0; cur.pv = JUMP_V0; cur.k = 1; cur.t = 0; }
        return;
    }
    if(cur.kind == K_HOLD) {
        int want = hold_want();
        if(want != cur.id || cur.face != facing) start(want, K_HOLD);
    }
    cur.t += dt;
    while(cur.t >= ms_of(cur.id, cur.k)) {
        cur.t -= ms_of(cur.id, cur.k);
        cur.k++;
        if(cur.k < nframes(cur.id)) continue;
        if(cur.kind == K_LAND || cur.kind == K_ACTION) { cur.k = nframes(cur.id) - 1; finish_action(); return; }
        if(MOVES[cur.id].loop) {                                                       /* the next cycle carries on from here */
            int n = nframes(cur.id), lf = MOVES[cur.id].loop_from;
            float r_last = mf(cur.id, n - 1)->rx, r_prev = n > 1 ? mf(cur.id, n - 2)->rx : 0, r_from = mf(cur.id, lf)->rx;
            X += cur.face * (r_last + (n > 1 ? r_last - r_prev : 0) - r_from);
            cur.k = lf;
        } else cur.k = nframes(cur.id) - 1;
    }
}

/* ------------------------------------------------------------------ drawing */
static void draw_layer(int sprite, float par, int camx, float camy) {
    int dx = -iround(camx * par), x0 = ((dx % MAP_W) + MAP_W) % MAP_W - MAP_W;     /* web/game/14_draw_player.js drawLayer */
    int top = iround(camy * par) - VIEW_MARGIN;
    int sx = v2s(x0), sy = VIEW_TOP + v2s(top);
    const Sprite *sp = art_sprite(sprite);
    for(; sx < SCR_W; sx += SCR_W) gfx_blit(sp, sx, sy, 0);                         /* one tile is 384 view px = 320 screen px */
}

static void draw_layers(int camx, float camy) {
    int i;
    gfx_clip(VIEW_TOP, VIEW_TOP + VIEW_SCR_H);
    for(i = 0; i < NUM_LAYERS; i++) draw_layer(LAYER_SPRITE[i], LAYER_PARALLAX[i], camx, camy);
}

static void draw_player(void) {
    float rx, ry;
    int k = cur.k, vx, vy;
    const MoveFrame *f;
    if(fall_on) { rx = 0; ry = fall_y; }
    else if(cur.kind == K_FALL) { rx = 0; ry = 0; }
    else root_of(&cur, cur.k, &rx, &ry);
    f = mf(cur.id, k);
    vx = iround(X + rx);                                   /* the camera x is fixed at ANCHOR_X, so world x is view x */
    vy = FEET_ROW - iround(ry - camY);
    gfx_blit(art_sprite(f->sprite), v2s(vx), VIEW_TOP + v2s(vy), cur.face < 0);
}

static void draw_debug(u32 frame_us, u32 draw_us) {
    gfx_clip(0, SCR_H);
    gfx_rect(0, 210, SCR_W, 30, RGB(8, 8, 16));
    gfx_text(4, 214, MOVES[cur.id].id, RGB(255, 220, 120));
    gfx_num(4 + 8 * 18, 214, (u32)cur.k, RGB(255, 255, 255));
    gfx_text(4, 226, "FRAME US", RGB(160, 180, 230)); gfx_num(4 + 8 * 9, 226, frame_us, RGB(255, 255, 255));
    gfx_text(160, 226, "DRAW US", RGB(160, 180, 230)); gfx_num(160 + 8 * 8, 226, draw_us, RGB(255, 255, 255));
}

/* ------------------------------------------------------------------ the frame */
void game_init(void) {
    int i;
    FALL_K = 0; LAND_K = 0;
    for(i = 1; i < nframes(MV_jump); i++) if(mf(MV_jump, i)->ry < mf(MV_jump, i - 1)->ry) { FALL_K = i; break; }
    for(i = FALL_K + 1; i < nframes(MV_jump); i++) if(mf(MV_jump, i)->ry == 0) { LAND_K = i; break; }
    X = 96; facing = 1; camY = 0; has_cur = 0; queued = -1; fall_on = 0;
    start(MV_idle, K_HOLD);
}

void game_frame(u16 raw, u32 frame_us, u32 draw_us) {
    float rx, ry;
    pad.prev = pad.held;
    pad.held = (u16)(~raw & 0x07ff);                       /* a 0 bit in the raw word is a pressed button */
    if(raw == 0xffff) pad.held = 0;
    clock_ms += 17;
    /* buttons -> moves (web/game/02_input.js readButtons) */
    if(pressed_now(PAD_LEFT)) facing = -1; else if(pressed_now(PAD_RIGHT)) facing = 1;
    if(released_now(PAD_LEFT) && held(PAD_RIGHT)) facing = 1;
    else if(released_now(PAD_RIGHT) && held(PAD_LEFT)) facing = -1;
    if(pressed_now(PAD_UP)) request(MV_jump, VIA_PRESS);
    if(pressed_now(PAD_A)) request(MV_slash, VIA_PRESS);
    if(pressed_now(PAD_X)) request(MV_dash, VIA_PRESS);
    if(pressed_now(PAD_Y)) request(MV_spin_attack, VIA_PRESS);
    if(pressed_now(PAD_B)) b_down_t = clock_ms;
    if(released_now(PAD_B) && clock_ms - b_down_t <= TAP_MS) request(MV_parry, VIA_CANCEL);       /* tap B: parry; hold B: block */
    step(FRAME_MS);
    /* keep her on the screen */
    root_of(&cur, cur.k, &rx, &ry);
    if(X + rx < 8) X = 8 - rx; else if(X + rx > MAP_W - 8) X = MAP_W - 8 - rx;
    camY += ((ry - CAM_KEEP > 0 ? ry - CAM_KEEP : 0) - camY) * 0.2123f;          /* 1 - exp(-dt / 70) at 60 fps */

    gfx_clear(RGB(0, 0, 0));
    draw_layers(ANCHOR_X, camY);
    draw_player();
    gfx_clip(VIEW_TOP, VIEW_TOP + VIEW_SCR_H);
    draw_layer(FRINGE_SPRITE, 1.0f, ANCHOR_X, camY);
    draw_debug(frame_us, draw_us);
}
