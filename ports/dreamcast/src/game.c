/* Parry Perry, Dreamcast port: the game. Ported from web/game/; the move, enemy and map tables are generated from the web data
 * (tools/bake_game.py), so the web game and this one read the same numbers.
 *
 * Steps 1-3: the real background and Max on the screen, her hold moves (idle, walk, duck, block), action moves (slash, spin, dash,
 * parry), the physics jump and the landing; enemies (patrol, sight, chase, strikes, parried and knocked states, death); her hits on
 * them, their hits on her (clean hit, block, parry), health and the HUD; maps and the door (a map ends when every enemy is dead).
 * Not ported yet: platforms and pits for Max, enemy hops and pit jumps, crates, bombs, leaves, gems, sound, menus, saves.
 * Coordinates are the web game's ("view" pixels, 384x216, y up from the ground); only drawing converts to screen pixels (5/6 size). */
#include "dc.h"
#include "gen/game_data.h"

#define FRAME_MS 16.6667f

/* ------------------------------------------------------------------ view to screen */
static int iround(float v) { return v >= 0 ? (int)(v + 0.5f) : -(int)(-v + 0.5f); }
static int v2s(int v) { return v >= 0 ? (v * 5 + 3) / 6 : -((-v * 5 + 3) / 6); }       /* 384x216 view -> 320x180 */

/* ------------------------------------------------------------------ state (names follow web/game/03_state.js) */
enum { K_HOLD, K_ACTION, K_LAND, K_FALL, K_STUN };
typedef struct { int id, k, kind, face; float t; int phys; float py, pv; } Cur;
static Cur cur;
static int has_cur;
static float X;                         /* world x of her anchor, view px */
static int facing = 1;
static int fall_on; static float fall_y, fall_v;
static int queued = -1;
static float camY;
static float floor_y, prev_feet, last_cx; static int prev_ok;          /* height of the surface she stands on; her feet last frame */
static int pit_fall_on; static float pit_t0, last_down_t;
static const MapDef *cur_map;
static u32 clock_ms;
static float now;                       /* ms since the start, the web game's `clock` */
static u32 mv_serial;                   /* counts action moves; a move hurts each enemy once per use */
static int stun_on; static float stun_v, stun_a, stun_y, stun_vy;
static float slide_v, slide_a;          /* a blocked hit slides her back */
static float invuln, ko_until;
static float hp;
static const char *banner; static float banner_until;
#define MAX_HP 50.0f                    /* web/progress.js MAX_START.hp */
#define BODY_W 16.5f
#define HURT_X0 5.0f
#define HURT_X1 30.0f
#define SS 0.5f                         /* SPRITE_SCALE */
#define EDGE 14.0f
#define HEAVY_HIGH_K 3                  /* the frame named 'high' in the heavy move: her knocked-back pose */
#define KNOCK_UP_VY (-0.13416f)         /* -sqrt(2 * 0.0018 * 5) */
#define HIT_DELAY 200.0f
#define DIE_MS 900.0f
#define KO_MS 1500.0f

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
    if(c->kind == K_STUN) { *rx = 0; *ry = 0; return; }
    if(c->phys) { *rx = 0; *ry = c->py; return; }
    *rx = (float)c->face * mf(c->id, k)->rx;
    *ry = mf(c->id, k)->ry;
}

/* ------------------------------------------------------------------ surfaces (web/game/09_maps.js) */
#define SPRITE_PAD 6.0f
static int face_now(void) { return has_cur ? cur.face : facing; }
static void span_of(float bx, float out[2]) {                 /* her drawn body: the hurtbox x range plus SPRITE_PAD each side */
    float f = (float)face_now(), lo = f * 5.0f, hi = f * 30.0f, a, b;
    if(lo > hi) { float t = lo; lo = hi; hi = t; }
    a = bx + lo - SPRITE_PAD; b = bx + hi + SPRITE_PAD;
    out[0] = a < bx ? a : bx; out[1] = b > bx ? b : bx;
}
static int over_surf(const Plat *p, const float sp[2]) { return sp[1] >= p->x0 - 3 && sp[0] <= p->x1 + 3; }
static float support_below(float bx, float y) {                 /* the highest surface at or below height y under her (the ground is 0) */
    float best = 0, sp[2];
    int i;
    span_of(bx, sp);
    for(i = 0; i < cur_map->nplat; i++) {
        const Plat *p = &PLATS[cur_map->plat0 + i];
        if(over_surf(p, sp) && p->top <= y + 0.5f && p->top > best) best = p->top;
    }
    return best;
}
static float support_under(float bx, float y) {                 /* the highest surface strictly below height y under her */
    float best = 0, sp[2];
    int i;
    span_of(bx, sp);
    for(i = 0; i < cur_map->nplat; i++) {
        const Plat *p = &PLATS[cur_map->plat0 + i];
        if(over_surf(p, sp) && p->top < y - 1 && p->top > best) best = p->top;
    }
    return best;
}
static const Plat *surface_at(float bx, int top) {
    int i;
    for(i = 0; i < cur_map->nplat; i++) {
        const Plat *p = &PLATS[cur_map->plat0 + i];
        if(p->top == top && bx >= p->x0 - 3 && bx <= p->x1 + 3) return p;
    }
    return 0;
}
static float pit_sink(void) { return pit_fall_on ? 0.0006f * (now - pit_t0) * (now - pit_t0) : 0; }

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
static void step_stun(float dt);
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
    if(kind == K_ACTION) mv_serial++;
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
    if(cur.py <= 0 && cur.pv < 0) {                         /* back down to the height she left from */
        if(floor_y > 0) {                                   /* she left a platform and walked off it in the air: keep falling */
            float S = support_under(X, floor_y + 0.5f);
            if(S < floor_y - 0.5f) {
                fall_on = 1; fall_y = (floor_y - S) + cur.py; fall_v = -cur.pv; floor_y = S;
                cur.k = FALL_K; cur.t = 0; cur.kind = K_FALL; cur.phys = 0;
                return;
            }
        }
        cur.id = MV_jump; cur.k = LAND_K; cur.t = 0; cur.kind = K_LAND; cur.phys = 0;
    }
}

static void step(float dt) {
    if(slide_v != 0) {                                                                /* a blocked hit slides her back */
        float v = slide_v - (slide_v > 0 ? 1.0f : -1.0f) * slide_a * dt;
        X += slide_v * dt; slide_v = ((v > 0) == (slide_v > 0)) ? v : 0;
    }
    if(stun_on) { step_stun(dt); return; }
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

/* ------------------------------------------------------------------ her body (web/game/13_enemy_attacks.js) */
static int strlen_(const char *p) { int n = 0; while(p[n]) n++; return n; }
static float fabsf_(float v) { return v < 0 ? -v : v; }
static float minf_(float a, float b) { return a < b ? a : b; }
static float maxf_(float a, float b) { return a > b ? a : b; }
static float signf_(float v) { return v > 0 ? 1.0f : v < 0 ? -1.0f : 0.0f; }
static u32 rng = 2463534242u;
static float frand(void) { rng ^= rng << 13; rng ^= rng >> 17; rng ^= rng << 5; return (float)(rng & 0xffffff) / 16777216.0f; }

static float player_x(void) {           /* her anchor: the root motion counts only while she is on her feet in a move */
    float rx, ry;
    if(!has_cur || fall_on || cur.kind == K_FALL || cur.kind == K_LAND || cur.kind == K_STUN) return X;
    root_of(&cur, cur.k, &rx, &ry);
    return X + rx;
}
static float height_above(void) {       /* above the surface she stands on */
    float rx, ry;
    if(stun_on) return stun_y;
    if(fall_on) return fall_y;
    if(has_cur && cur.kind != K_FALL) { root_of(&cur, cur.k, &rx, &ry); return ry; }
    return 0;
}
static float her_y(void) { return floor_y + height_above() - pit_sink(); }      /* world height of her feet */
static int her_face(void) { return has_cur ? cur.face : facing; }
static float her_top(void) {
    int id = has_cur ? cur.id : MV_idle, k = has_cur ? cur.k : 0;
    float t = (float)mf(id, k)->top;
    return id == MV_duck ? t - 5.0f : t;
}
static void her_box(float b[4]) {
    float px = player_x(), py = her_y(), f = (float)her_face();
    b[0] = px + minf_(f * HURT_X0, f * HURT_X1); b[2] = px + maxf_(f * HURT_X0, f * HURT_X1);
    b[1] = py; b[3] = py + her_top() * SS;
}
static float her_mid_x(void) { float b[4]; her_box(b); return (b[0] + b[2]) * 0.5f; }
static int parrying(void) { return has_cur && cur.id == MV_parry && cur.kind == K_ACTION && cur.k <= 2; }
static int blocking(void) { return has_cur && cur.id == MV_block; }

/* ------------------------------------------------------------------ enemies (web/game/11_enemies.js) */
enum { S_WALK, S_IDLE, S_PATROL, S_ATTACK, S_STUN, S_DYING };
typedef struct {
    int type, state, face, anim, k, dir, on;
    float fy, jy, hp, maxhp, x, base, t, rest, dead, lo, hi, lo0, hi0, sight, pause, far, prevx, push_v, push_a, land_at, flash_until;
    int path0, path1, dive, combo_ready, melee_seen, hit_done, jump_on, jfall, jdoom;
    float jx0, jx1, jfy0, jfy1, jH, jt, jdur, hop_at;
    u32 seen;                           /* the last move of hers that hurt it */
} Enemy;
#define MAX_ENEMIES 12
static Enemy en[MAX_ENEMIES];
#define SIGHT_MUL 2.0f
#define PATROL_SPEED 0.5f

static const EnemyAnim *anim_of(const Enemy *e) { return &ENEMY_ANIMS[e->anim]; }
static const EnemyFrame *frame_of(const Enemy *e) { return &ENEMY_FRAMES[ENEMY_ANIM_FRAME_LIST[anim_of(e)->list0 + e->k]]; }
static float ground_off(const Enemy *e) { float g = (float)frame_of(e)->ground; return e->face < 0 ? g : -g; }
static void play(Enemy *e, int anim) {
    if(anim < 0) anim = ENEMIES[e->type].a_idle;
    e->anim = anim; e->k = 0; e->t = 0; e->hit_done = 0; e->land_at = 0; e->base = e->x - ground_off(e);
}
static void turn(Enemy *e, int face) { if(face != e->face) { e->face = face; e->base = e->x - ground_off(e); } }
static int alive(const Enemy *e) { return e->on && e->state != S_DYING; }
static float espeed(const Enemy *e) { const EnemyDef *d = &ENEMIES[e->type]; return (float)d->speed * (d->boss && e->hp < e->maxhp * 0.5f ? 1.45f : 1.0f); }

/* a box [x0, y0, x1, y1] in world coordinates from a frame's native-pixel box (hx0, hy0, hx1, hy1) */
static void box_of(int face, float base, float fy, const short *h, float out[4]) {
    if(face < 0) { out[0] = base + h[0] * SS; out[2] = base + h[2] * SS; }
    else { out[0] = base - h[2] * SS; out[2] = base - h[0] * SS; }
    out[1] = h[1] * SS + fy; out[3] = h[3] * SS + fy;
}
static int hurt_of(const Enemy *e, float out[4]) {
    const EnemyFrame *f = frame_of(e);
    if(!alive(e) || f->hx1 <= f->hx0) return 0;
    box_of(e->face, e->base, e->fy + e->jy, &f->hx0, out);
    return 1;
}
static int overlap(const float a[4], const float b[4]) { return a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3]; }

static void kill(Enemy *e) {
    const EnemyDef *d = &ENEMIES[e->type];
    e->state = S_DYING; e->dead = 0; e->hp = 0;
    if(d->a_death >= 0) play(e, d->a_death);
}
static int sees(const Enemy *e) {
    float dx = her_mid_x() - e->x;
    if(dx * e->face <= 0 || fabsf_(dx) > e->sight) return 0;
    if(fabsf_(her_y() - e->fy) > 60.0f * SIGHT_MUL) return 0;
    return 1;
}
static void aggro(Enemy *e, int noticed) {
    if(e->state != S_PATROL) return;
    e->state = S_IDLE; e->rest = noticed ? 250.0f : 0; e->far = 0; e->combo_ready = 1; e->melee_seen = 0; play(e, ENEMIES[e->type].a_idle);
}
static void hurt_enemy(Enemy *e, int dmg) {
    if(!alive(e)) return;
    aggro(e, 0);                                         /* being hit wakes a patrolling enemy, even for 0 damage */
    if(dmg <= 0) return;
    e->hp = maxf_(0, e->hp - (float)dmg);
    e->flash_until = now + 110.0f;
    if(e->hp <= 0) kill(e);
}
static void clamp_enemy(Enemy *e, int free) {
    float nx = maxf_(free ? e->lo0 : e->lo, minf_(free ? e->hi0 : e->hi, e->x));
    if(nx != e->x) { e->base += nx - e->x; e->x = nx; }
    e->prevx = e->x;
}

static int in_pit(float x) {
    int i;
    for(i = 0; i < cur_map->npit; i++) { const Pit *p = &PITS[cur_map->pit0 + i]; if(x > p->x0 - 2 && x < p->x1 + 2) return 1; }
    return 0;
}
static void set_range(Enemy *e) {           /* the stretch of surface that holds the enemy where it stands: a platform, or the ground between pits */
    float lo = 8, hi = (float)(VIEW_W - 8);
    int i;
    if(e->fy > 0) {
        const Plat *sf = surface_at(e->x, (int)e->fy);
        if(sf) { e->lo = e->lo0 = (float)(sf->x0 + 8); e->hi = e->hi0 = (float)(sf->x1 - 8); return; }
    }
    for(i = 0; i < cur_map->npit; i++) {
        const Pit *p = &PITS[cur_map->pit0 + i];
        if(p->x1 <= e->x) lo = maxf_(lo, (float)(p->x1 + 2)); else if(p->x0 >= e->x) hi = minf_(hi, (float)(p->x0 - 2));
    }
    e->lo = lo; e->hi = hi; e->lo0 = 8; e->hi0 = (float)(VIEW_W - 8);
}
/* The goblin climbs: it jumps up onto a platform up to HOP_UP px above it, drops off a platform edge toward her, and hops a gap
 * between two platforms of the same height. plan_hop picks the launch point and the landing (ok = 0 when there is nothing to do). */
typedef struct { int ok, kind; float launch, land, fy1; } Hop;          /* kind: 0 up, 1 drop, 2 gap */
#define HOP_UP 70.0f
#define HOP_X 130.0f
static Hop plan_hop(const Enemy *e) {
    Hop best = {0}, none = {0};
    float fy = e->fy, her = floor_y, bx = her_mid_x(), bestcost = 0;
    int i;
    if(her > fy + 1) {                                                   /* she is higher: jump up */
        const Plat *mine = fy > 0 ? surface_at(e->x, (int)fy) : 0;
        for(i = 0; i < cur_map->nplat; i++) {
            const Plat *sf = &PLATS[cur_map->plat0 + i];
            float dx, launch, land, cost;
            if(sf->top <= fy + 1 || sf->top > fy + HOP_UP || sf->top > her + 0.5f) continue;
            dx = e->x < sf->x0 ? sf->x0 - e->x : e->x > sf->x1 ? e->x - sf->x1 : 0;
            if(dx > HOP_X) continue;
            launch = dx == 0 ? e->x : (e->x < sf->x0 ? (float)(sf->x0 - 6) : (float)(sf->x1 + 6));
            if(fy == 0 && in_pit(launch)) continue;
            if(fy > 0 && (!mine || launch < mine->x0 + 6 || launch > mine->x1 - 6)) continue;
            land = dx == 0 ? maxf_((float)(sf->x0 + 10), minf_((float)(sf->x1 - 10), e->x)) : (e->x < sf->x0 ? (float)(sf->x0 + 12) : (float)(sf->x1 - 12));
            cost = dx + (her - sf->top) * 0.6f + fabsf_((float)(sf->x0 + sf->x1) * 0.5f - bx) * 0.2f;
            if(!best.ok || cost < bestcost) { best.ok = 1; best.kind = 0; best.launch = launch; best.land = land; best.fy1 = (float)sf->top; bestcost = cost; }
        }
        return best;
    }
    if(her < fy - 1) {                                                   /* she is lower: walk to the edge on her side and drop */
        const Plat *sf = surface_at(e->x, (int)fy);
        float d0 = bx >= e->x ? 1.0f : -1.0f, d;
        int n;
        if(!sf) return none;
        for(n = 0; n < 2; n++) {
            float land, fy1 = 0;
            int j;
            d = n == 0 ? d0 : -d0;
            land = d > 0 ? (float)(sf->x1 + 14) : (float)(sf->x0 - 14);
            for(j = 0; j < cur_map->nplat; j++) {
                const Plat *o = &PLATS[cur_map->plat0 + j];
                if(o->top < fy - 1 && land >= o->x0 - 3 && land <= o->x1 + 3 && o->top > fy1) fy1 = (float)o->top;
            }
            if(land < 8 || land > VIEW_W - 8 || (fy1 == 0 && in_pit(land))) continue;
            best.ok = 1; best.kind = 1; best.launch = d > 0 ? (float)(sf->x1 - 8) : (float)(sf->x0 + 8); best.land = land; best.fy1 = fy1;
            return best;
        }
        return none;
    }
    if(fy > 0) {                                                         /* same height, another platform: hop the gap */
        const Plat *a = surface_at(e->x, (int)fy), *b = surface_at(bx, (int)her);
        if(a && b && a != b) {
            float d = bx >= e->x ? 1.0f : -1.0f, gapw = d > 0 ? (float)(b->x0 - a->x1) : (float)(a->x0 - b->x1);
            if(gapw <= HOP_X) { best.ok = 1; best.kind = 2; best.launch = d > 0 ? (float)(a->x1 - 8) : (float)(a->x0 + 8); best.land = d > 0 ? (float)(b->x0 + 12) : (float)(b->x1 - 12); best.fy1 = fy; return best; }
        }
    }
    return none;
}
#define ENEMY_JUMP_H 22.0f
#define ENEMY_JUMP_MAX 140
static void patrol(Enemy *e, float dt) {
    const EnemyDef *d = &ENEMIES[e->type];
    float target, dist, step;
    if(sees(e)) { aggro(e, 1); return; }
    if(e->pause > 0) {
        e->pause -= dt;
        if(e->anim != d->a_idle) play(e, d->a_idle);
        if(e->pause <= 0) e->dir = -e->dir;
        return;
    }
    target = (float)(e->dir > 0 ? e->path1 : e->path0); dist = target - e->x;
    turn(e, dist >= 0 ? 1 : -1);
    if(e->anim != d->a_walk) play(e, d->a_walk);
    step = espeed(e) * PATROL_SPEED * dt / 1000.0f;
    if(fabsf_(dist) <= step) { e->x += dist; e->base += dist; e->pause = 700.0f + frand() * 900.0f; play(e, d->a_idle); }
    else { float mv = signf_(dist) * step; e->x += mv; e->base += mv; }
}
/* the attacks whose damage box would touch her hurtbox on one of its hitting frames, from where the enemy stands now */
static int strike_attacks(const Enemy *e, const float me[4], int out[4]) {
    const EnemyDef *d = &ENEMIES[e->type];
    int n = 0, i, j;
    for(i = 0; i < d->nattacks; i++) {
        const EnemyAnim *A = &ENEMY_ANIMS[d->attack[i]];
        int g0 = ENEMY_FRAMES[ENEMY_ANIM_FRAME_LIST[A->list0]].ground;
        float base = e->x - (e->face < 0 ? (float)g0 : (float)-g0);
        for(j = 0; j < A->n; j++) {
            const EnemyFrame *f = &ENEMY_FRAMES[ENEMY_ANIM_FRAME_LIST[A->list0 + j]];
            float h[4];
            if(!f->has_hit) continue;
            box_of(e->face, base, e->fy + e->jy, &f->ax0, h);
            if(overlap(h, me)) { out[n++] = i; break; }
        }
    }
    return n;
}
static void start_attack(Enemy *e, int anim) { e->state = S_ATTACK; play(e, anim); }

static void step_enemy_core(Enemy *e, float dt) {
    const EnemyDef *d = &ENEMIES[e->type];
    const EnemyAnim *A = anim_of(e);
    int ended = 0, i, same_level, blocked_, goblin_like, strike[4], ns, pit_between = 0;
    float dd, dist, me[4], edge, gap, reach, eb[4], room, mv;
    if(e->state == S_ATTACK && e->land_at > 0 && !e->hit_done && now < e->land_at) {     /* held on the striking frame until the hit lands (or she parries) */
        const EnemyFrame *sf = frame_of(e);
        dt = sf->pause ? maxf_(0, minf_(dt, (float)sf->ms - 1.0f - e->t)) : 0;
    }
    e->t += dt;
    while(e->t >= (float)frame_of(e)->ms) {
        e->t -= (float)frame_of(e)->ms;
        if(e->k + 1 < A->n) e->k++;
        else if(A->loop) e->k = 0;
        else { ended = 1; e->t = 0; break; }
    }
    e->x = e->base + ground_off(e);
    if(e->state == S_DYING) { e->dead += dt; return; }
    if(e->jump_on) {                    /* leaping a pit, hopping or dropping: a run over the gap with an arc */
        if(e->state == S_STUN) { e->jump_on = 0; e->jy = 0; }
        else {
            float u, nx, dy;
            e->jt += dt; u = minf_(1.0f, e->jt / e->jdur); nx = e->jx0 + (e->jx1 - e->jx0) * u; dy = e->jfy1 - e->jfy0;
            e->base += nx - e->x; e->x = nx;
            e->jy = e->jfall ? dy * u * u : dy * u + 4.0f * e->jH * u * (1.0f - u);       /* a jump arcs, a drop falls */
            if(u >= 1.0f) {
                e->jump_on = 0; e->jy = 0; e->fy = e->jfy1; set_range(e); e->prevx = e->x;
                if(e->jdoom) { kill(e); return; }                                       /* it came down in the pit */
                if(e->path0 >= 0 && e->jfy1 != e->jfy0) { e->path0 = (int)(e->lo + 6); e->path1 = (int)maxf_(e->lo + 6, e->hi - 6); }   /* a patrol resumes on the surface it landed on */
            }
            return;
        }
    }
    if(e->state == S_STUN) {            /* parried or knocked: slides back, no control until it stops */
        float v;
        e->x += e->push_v * dt; e->base += e->push_v * dt;
        v = e->push_v - signf_(e->push_v) * e->push_a * dt;
        if(signf_(v) == signf_(e->push_v)) { e->push_v = v; return; }
        e->state = S_IDLE; e->rest = (float)d->rest0; play(e, d->a_idle);
        return;
    }
    if(e->state == S_PATROL) { patrol(e, dt); return; }
    dd = her_mid_x() - e->x; dist = fabsf_(dd);
    if(e->path0 >= 0 && (e->state == S_IDLE || e->state == S_WALK)) {     /* chasing: give up when she is gone for a while */
        e->far = (dist > e->sight * 2.5f || fabsf_(her_y() - e->fy) > 110.0f * SIGHT_MUL) ? e->far + dt : 0;
        if(e->far > 3500.0f) { e->state = S_PATROL; e->far = 0; e->pause = 0; e->dir = e->x < (float)(e->path0 + e->path1) * 0.5f ? 1 : -1; play(e, d->a_walk); return; }
    }
    blocked_ = 0;                       /* wait behind another enemy that is already closer to her */
    for(i = 0; i < MAX_ENEMIES; i++) {
        const Enemy *o = &en[i];
        if(o != e && alive(o) && signf_(o->x - e->x) == signf_(dd) && fabsf_(o->x - e->x) < 40.0f) blocked_ = 1;
    }
    if(e->state == S_ATTACK) {
        if(!ended) return;
        e->state = S_IDLE; e->rest = (float)d->rest0 + frand() * (float)(d->rest1 - d->rest0); play(e, d->a_idle);
        e->dive = frand() < 0.5f;
        return;
    }
    turn(e, dd < 0 ? -1 : 1);
    if(e->state == S_IDLE) {
        e->rest -= dt;
        if(e->rest > 0) return;
        e->state = S_WALK;
    }
    goblin_like = d->attack_combo >= 0;
    same_level = fabsf_(floor_y - e->fy) <= 1.0f;
    her_box(me); edge = dd < 0 ? me[2] : me[0];
    gap = dd < 0 ? e->x - edge : edge - e->x;
    if(e->fy == 0) for(i = 0; i < cur_map->npit; i++) { const Pit *q = &PITS[cur_map->pit0 + i]; if(q->x1 > minf_(e->x, edge) && q->x0 < maxf_(e->x, edge)) pit_between = 1; }
    reach = d->reach;
    if(goblin_like && (e->combo_ready || (e->melee_seen && same_level && gap > reach + 2.0f))) {
        e->combo_ready = 0; e->melee_seen = 0; start_attack(e, d->attack_combo);
        return;
    }
    ns = strike_attacks(e, me, strike);
    if(ns) {
        e->melee_seen = 1;
        start_attack(e, d->attack[strike[(int)(frand() * ns) % ns]]);
        return;
    }
    if(!same_level || e->fy > 0) {      /* every enemy that has noticed her climbs, drops and hops toward her */
        Hop h = plan_hop(e);
        if(h.ok) {
            float dir = h.launch >= e->x ? 1.0f : -1.0f;
            int at = fabsf_(e->x - h.launch) <= 3.0f || (dir > 0 && e->x >= e->hi - 1 && h.launch >= e->hi - 1) || (dir < 0 && e->x <= e->lo + 1 && h.launch <= e->lo + 1);
            if(at) {
                float dy = h.fy1 - e->fy;
                e->jump_on = 1; e->jfall = h.kind == 1; e->jdoom = 0; e->jx0 = e->x; e->jx1 = h.land; e->jfy0 = e->fy; e->jfy1 = h.fy1;
                e->jH = h.kind == 0 ? 16.0f : ENEMY_JUMP_H; e->jt = 0;
                e->jdur = e->jfall ? __builtin_sqrtf(2.0f * fabsf_(dy) / 0.0018f) + 80.0f : 420.0f + fabsf_(h.land - e->x) * 3.0f + maxf_(0, dy) * 2.0f;
                return;
            }
            turn(e, dir > 0 ? 1 : -1); if(e->anim != d->a_walk) play(e, d->a_walk);
            mv = dir * minf_(espeed(e) * dt / 1000.0f, fabsf_(h.launch - e->x));
            e->x += mv; e->base += mv;
            return;
        }
    }
    if(d->a_dive >= 0 && e->dive && !blocked_ && same_level && dist >= (float)d->dive_min && dist <= (float)d->dive_max) {
        e->dive = 0; start_attack(e, d->a_dive);
    } else if(blocked_) {
        if(e->anim != d->a_idle) play(e, d->a_idle);
    } else {
        if(e->anim != d->a_walk) play(e, d->a_walk);
        if(e->fy == 0 && cur_map->npit) {                /* a pit between it and her: jump it when it reaches the edge */
            const Pit *q = 0;
            if(e->hop_at < 0) e->hop_at = 3.0f + frand() * 10.0f;           /* how close to the edge it takes off (rerolled after each jump) */
            for(i = 0; i < cur_map->npit && !q; i++) {
                const Pit *p = &PITS[cur_map->pit0 + i];
                if(e->face > 0 ? (p->x0 - e->x >= -2 && p->x0 - e->x < e->hop_at && her_mid_x() > p->x1)
                               : (e->x - p->x1 >= -2 && e->x - p->x1 < e->hop_at && her_mid_x() < p->x0)) q = p;
            }
            if(q && q->x1 - q->x0 <= ENEMY_JUMP_MAX && fabsf_(her_y() - e->fy) < 40.0f) {
                float want = e->face > 0 ? (float)(q->x1 + d->land_off) : (float)(q->x0 - d->land_off), jr, tx;
                int bad = 0, doom = 0;
                for(i = 0; i < cur_map->npit; i++) { const Pit *o = &PITS[cur_map->pit0 + i]; if(want > o->x0 - 4 && want < o->x1 + 4) bad = 1; }
                if(!bad) {
                    jr = minf_(fabsf_(want - e->x), (float)d->jump_dist); tx = e->x + e->face * jr;
                    for(i = 0; i < cur_map->npit; i++) { const Pit *o = &PITS[cur_map->pit0 + i]; if(tx > o->x0 && tx < o->x1) doom = 1; }   /* a jump that is too short drops it into the pit */
                    e->jump_on = 1; e->jfall = 0; e->jdoom = doom; e->jx0 = e->x; e->jx1 = tx; e->jfy0 = e->jfy1 = e->fy; e->jH = ENEMY_JUMP_H; e->jt = 0; e->jdur = 420.0f + jr * 4.0f;
                    e->hop_at = -1;
                    return;
                }
            }
        }
        if(hurt_of(e, eb)) room = e->face < 0 ? eb[0] - me[2] : me[0] - eb[2]; else room = gap;     /* free ground until its hitbox meets hers */
        mv = (float)e->face * maxf_(0, minf_(espeed(e) * dt / 1000.0f, room));
        if(mv == 0 && same_level && !pit_between && d->nattacks) {                    /* its body is against hers and nothing reached: swing anyway */
            e->melee_seen = 1; start_attack(e, d->attack[(int)(frand() * d->nattacks) % d->nattacks]);
            return;
        }
        if(mv == 0 && e->anim != d->a_idle) play(e, d->a_idle);
        e->x += mv; e->base += mv;
    }
}
static void step_enemy(Enemy *e, float dt) {
    int free = 0, i;
    step_enemy_core(e, dt);
    if(e->state == S_DYING || e->jump_on) return;
    if(e->fy == 0 && cur_map->npit) {
        free = e->state == S_STUN;                      /* pushed: only the walls hold it, and a pit can take it */
        if(free) for(i = 0; i < cur_map->npit; i++) { const Pit *p = &PITS[cur_map->pit0 + i]; if(e->x > p->x0 + 6 && e->x < p->x1 - 6) { kill(e); return; } }
    }
    clamp_enemy(e, free);
}

/* ------------------------------------------------------------------ hits: hers on them (web/game/12_hits.js) */
static int dmg_of(int id) {
    switch(id) {
    case MV_slash: return 25; case MV_heavy: return 200; case MV_thrust: case MV_upswing: return 15; case MV_push_kick: return 10;
    case MV_heavy_kick: return 25; case MV_energy_kick: return 30; case MV_dash_thrust: return 25; case MV_energy_dash_thrust: return 50;
    case MV_spin_attack: return 20; case MV_chain2: return 15; case MV_chain3: return 18; case MV_chain4: return 22;
    default: return 15;
    }
}
static int knock_of(int id, float *dist, float *ms) {
    switch(id) {
    case MV_heavy: case MV_slash: *dist = 25; *ms = 100; return 1;
    case MV_push_kick: *dist = 100; *ms = 200; return 1;
    case MV_energy_kick: *dist = 200; *ms = 300; return 1;
    default: return 0;
    }
}
static float dist_box2(float px, float py, const float b[4]) {      /* squared distance from a point to a box */
    float dx = maxf_(maxf_(b[0] - px, 0), px - b[2]), dy = maxf_(maxf_(b[1] - py, 0), py - b[3]);
    return dx * dx + dy * dy;
}
static int touches(const Hit *h, float px, float py, int face, const float box[4]) {
    float f = (float)face, ax = px + f * h->ax * SS, ay = py + h->ay * SS;
    if(h->shape == 1) return dist_box2(ax, ay, box) <= h->r * SS * h->r * SS;
    if(h->shape == 2) {
        float bx = px + f * h->bx * SS, by = py + h->by * SS, x0 = minf_(ax, bx), x1 = maxf_(ax, bx), y0 = minf_(ay, by), y1 = maxf_(ay, by);
        return x0 <= box[2] && box[0] <= x1 && y0 <= box[3] && box[1] <= y1;
    } else {
        float bx = px + f * h->bx * SS, by = py + h->by * SS, r2 = h->r * SS * h->r * SS;
        int i;
        for(i = 0; i <= 16; i++) {
            float u = (float)i / 16.0f;
            if(dist_box2(ax + (bx - ax) * u, ay + (by - ay) * u, box) <= r2) return 1;
        }
        return 0;
    }
}
static void resolve_hits_one(const MoveFrame *f, float px, float py, int face) {
    int s, i;
    for(s = 0; s < f->nhit; s++) {
        const Hit *h = &HITS[f->hit0 + s];
        for(i = 0; i < MAX_ENEMIES; i++) {
            Enemy *e = &en[i];
            float box[4], dist, ms;
            if(!e->on || !hurt_of(e, box) || e->seen == mv_serial || !touches(h, px, py, face, box)) continue;
            e->seen = mv_serial;
            hurt_enemy(e, dmg_of(cur.id));
            if(knock_of(cur.id, &dist, &ms) && alive(e)) {         /* knocked back and stunned */
                e->state = S_STUN; play(e, ENEMIES[e->type].a_stun);
                e->push_v = 2.0f * dist / ms * (float)face; e->push_a = 2.0f * dist / (ms * ms);
            }
        }
    }
}
static void resolve_hits(void) {
    const MoveFrame *f;
    float rx, ry;
    if(!has_cur || cur.kind != K_ACTION || stun_on) return;
    f = mf(cur.id, cur.k);
    if(!f->nhit) return;
    root_of(&cur, cur.k, &rx, &ry);
    resolve_hits_one(f, X + rx, ry + floor_y, cur.face);
    if(cur.id == MV_spin_attack) resolve_hits_one(f, X + rx, ry + floor_y, -cur.face);       /* the spin also cuts behind her */
}

/* ------------------------------------------------------------------ hits: theirs on her (web/game/13_enemy_attacks.js) */
static void parried(Enemy *e) {
    float d = 100.0f, ms = 400.0f;
    e->hit_done = 1;
    hurt_enemy(e, 10);                                  /* a parried melee attacker takes 10 */
    if(!alive(e)) return;
    e->state = S_STUN; play(e, ENEMIES[e->type].a_stun);
    e->push_v = 2.0f * d / ms * (e->x >= her_mid_x() ? 1.0f : -1.0f); e->push_a = 2.0f * d / (ms * ms);
    e->flash_until = now + ms;
}
static void blocked_hit(const Enemy *e) {
    float dir = her_mid_x() >= e->x ? 1.0f : -1.0f;
    slide_v = 2.0f * 8.0f / 120.0f * dir; slide_a = 2.0f * 8.0f / (120.0f * 120.0f);
}
static void knocked(const Enemy *e) {
    const EnemyDef *d = &ENEMIES[e->type];
    float kd = (float)d->knock_d, kms = (float)d->knock_ms, dmg = (float)d->atk_dmg[0], rx, ry, h;
    int i;
    for(i = 0; i < d->nattacks; i++) if(d->attack[i] == e->anim) { kd = (float)d->atk_knock_d[i]; kms = (float)d->atk_knock_ms[i]; dmg = (float)d->atk_dmg[i]; }
    h = height_above();
    if(has_cur && !fall_on && cur.kind != K_FALL) { root_of(&cur, cur.k, &rx, &ry); X += rx; }
    fall_on = 0; queued = -1; slide_v = 0;
    stun_on = 1; stun_v = 2.0f * kd / kms * (her_mid_x() >= e->x ? 1.0f : -1.0f); stun_a = 2.0f * kd / (kms * kms); stun_y = h; stun_vy = KNOCK_UP_VY;
    cur.id = MV_heavy; cur.k = HEAVY_HIGH_K; cur.t = 0; cur.kind = K_STUN; cur.face = has_cur ? cur.face : facing; cur.phys = 0; cur.py = cur.pv = 0; has_cur = 1;
    invuln = now + kms + 400.0f;
    hp -= dmg;
    if(hp <= 0) { hp = 0; ko_until = now + KO_MS; }
}
static void enemy_attacks(void) {
    float me[4];
    int i, j;
    her_box(me);
    for(i = 0; i < MAX_ENEMIES; i++) {
        Enemy *e = &en[i];
        const EnemyAnim *A;
        float h[4];
        if(!e->on || e->state != S_ATTACK || e->hit_done) continue;
        if(parrying() && e->land_at > 0) { parried(e); continue; }
        A = anim_of(e);
        if(parrying()) {                /* the attack lands this frame or within the next two */
            int soon = 0;
            for(j = e->k; j <= e->k + 2 && j < A->n && !soon; j++) {
                const EnemyFrame *f = &ENEMY_FRAMES[ENEMY_ANIM_FRAME_LIST[A->list0 + j]];
                if(f->has_hit) { box_of(e->face, e->base, e->fy + e->jy, &f->ax0, h); soon = overlap(h, me); }
            }
            if(soon) { parried(e); continue; }
        }
        if(e->land_at == 0) {
            const EnemyFrame *f = frame_of(e);
            if(!f->has_hit) continue;
            box_of(e->face, e->base, e->fy + e->jy, &f->ax0, h);
            if(!overlap(h, me)) continue;
            e->land_at = now + HIT_DELAY;                      /* contact: the hit lands shortly, a parry still works */
        }
        if(now < e->land_at) continue;
        { const EnemyFrame *f = frame_of(e); if(!f->has_hit) { e->hit_done = 1; continue; } box_of(e->face, e->base, e->fy + e->jy, &f->ax0, h); if(!overlap(h, me)) { e->hit_done = 1; continue; } }
        e->hit_done = 1;
        if(blocking()) blocked_hit(e);
        else if(now >= invuln && !stun_on) knocked(e);
    }
}
/* walking and the plain dash stop at an enemy instead of passing through it */
static void block_move(float before) {
    float f, a, b, front = 1e9f, back = -1e9f, px, me[4];
    int i;
    if(!has_cur || (cur.id != MV_dash && cur.id != MV_walk_right && cur.id != MV_walk_left)) return;
    f = (float)cur.face; a = minf_(f * HURT_X0, f * BODY_W); b = maxf_(f * HURT_X0, f * BODY_W);
    px = player_x(); her_box(me);
    for(i = 0; i < MAX_ENEMIES; i++) {
        float bx[4];
        if(!hurt_of(&en[i], bx) || bx[1] > me[3] || bx[3] < me[1]) continue;
        if(bx[0] >= before + b - 1) front = minf_(front, bx[0] - b);
        else if(bx[2] <= before + a + 1) back = maxf_(back, bx[2] - a);
    }
    if(px > front) X -= px - front; else if(px < back) X += back - px;
}

/* ------------------------------------------------------------------ maps and doors (web/game/09_maps.js) */
static int level_idx, map_idx;
static void load_map(int level, int idx, int from_left) {
    const MapDef *m = &MAPS[LEVELS[level].map0 + idx];
    int i;
    level_idx = level; map_idx = idx; cur_map = m;
    for(i = 0; i < MAX_ENEMIES; i++) en[i].on = 0;
    for(i = 0; i < m->nen && i < MAX_ENEMIES; i++) {
        const EnemySpawn *s = &SPAWNS[m->en0 + i];
        Enemy *e = &en[i];
        const EnemyDef *d = &ENEMIES[s->type];
        float x = (float)s->x;
        e->type = s->type; e->on = 1; e->hp = e->maxhp = (float)d->hp; e->x = e->base = e->prevx = x; e->face = -1; e->state = S_WALK;
        e->k = 0; e->t = 0; e->rest = 0; e->dead = 0; e->dive = frand() < 0.5f; e->fy = (float)s->fy; e->jy = 0; e->jump_on = 0; e->hop_at = -1; e->dir = 1; e->pause = 0; e->far = 0;
        e->combo_ready = 1; e->melee_seen = 0; e->hit_done = 0; e->land_at = 0; e->flash_until = 0; e->seen = 0; e->push_v = e->push_a = 0;
        set_range(e);                                    /* an enemy on a platform never leaves it; a ground enemy stays between the pits */
        e->sight = (float)(s->sight ? s->sight : 100) * SIGHT_MUL;
        e->path0 = s->path0; e->path1 = s->path1;
        e->anim = d->a_walk; play(e, d->a_walk);
        if(e->path0 >= 0) { e->state = S_PATROL; e->dir = x <= (float)(e->path0 + e->path1) * 0.5f ? 1 : -1; e->face = e->dir; play(e, d->a_walk); }
    }
    X = from_left ? 26.0f : (float)(VIEW_W - 26); facing = from_left ? 1 : -1;
    floor_y = 0; pit_fall_on = 0; prev_ok = 0;
    fall_on = 0; stun_on = 0; slide_v = 0; has_cur = 0; queued = -1; camY = 0; invuln = now + 600.0f; ko_until = 0;
    start(MV_idle, K_HOLD);
}
static int door_open(void) {
    int i;
    for(i = 0; i < MAX_ENEMIES; i++) if(alive(&en[i])) return 0;
    return 1;
}
static void say(const char *s, float ms) { banner = s; banner_until = now + ms; }
static int edges(void) {
    float px = player_x();
    if(px >= VIEW_W - EDGE) {
        if(!stun_on && door_open()) {
            if(map_idx + 1 < LEVELS[level_idx].nmaps) load_map(level_idx, map_idx + 1, 1);
            else load_map((level_idx + 1) % NUM_LEVELS, 0, 1);       /* TODO: the level-complete screen and the overworld */
            return 1;
        }
        if(!stun_on) say("DEFEAT EVERY ENEMY", 2200);
        X -= px - (VIEW_W - EDGE);
    } else if(px <= EDGE) X += EDGE - px;
    return 0;
}


static int physics(void) {              /* landing on surfaces and walking off them (web/game/09_maps.js physics); 1 when the map changed */
    float px, feet, sp[2];
    int flying, i;
    if(edges()) return 1;
    px = player_x(); feet = her_y();
    flying = !stun_on && has_cur && (fall_on || cur.kind == K_FALL || (cur.kind == K_ACTION && cur.id == MV_jump));
    if(flying && prev_ok && feet < prev_feet) {          /* falling (or a jump coming down) through the top of a surface under her */
        float T = -1;
        span_of(px, sp);
        for(i = 0; i < cur_map->nplat; i++) {
            const Plat *p = &PLATS[cur_map->plat0 + i];
            if(p->top > floor_y && over_surf(p, sp) && prev_feet > p->top && feet <= p->top && p->top > T) T = (float)p->top;
        }
        if(T >= 0) {
            float rx, ry;
            if(cur.kind == K_ACTION) { root_of(&cur, cur.k, &rx, &ry); X += rx; }
            floor_y = T; fall_on = 0;
            cur.id = MV_jump; cur.k = LAND_K; cur.t = 0; cur.kind = K_LAND; cur.phys = 0;
        }
    }
    if(floor_y > 0 && !fall_on && !stun_on && (!has_cur || cur.kind == K_HOLD || cur.kind == K_LAND)) {      /* walked off the edge: fall to what is below */
        float S = support_below(player_x(), floor_y);
        if(S < floor_y - 0.5f) {
            float rx, ry;
            if(has_cur) { root_of(&cur, cur.k, &rx, &ry); X += rx; }
            fall_on = 1; fall_y = floor_y - S; fall_v = 0; floor_y = S;
            cur.id = MV_jump; cur.k = FALL_K; cur.t = 0; cur.kind = K_FALL; cur.face = has_cur ? cur.face : facing; cur.phys = 0; has_cur = 1;
        }
    }
    prev_feet = her_y(); prev_ok = 1; last_cx = player_x();
    return 0;
}
static void check_pit(void) {           /* she falls only when BOTH feet are over the gap (web/game/10_hazards.js) */
    float px = player_x(), f = (float)face_now(), a = f > 0 ? px - 1 : px - 38, b = f > 0 ? px + 38 : px + 1;
    int i;
    if(pit_fall_on || !cur_map->npit || floor_y != 0 || her_y() > 1.5f || stun_on || slide_v != 0) return;
    for(i = 0; i < cur_map->npit; i++) {
        const Pit *p = &PITS[cur_map->pit0 + i];
        if(a >= p->x0 - 1 && b <= p->x1 + 1) {
            pit_fall_on = 1; pit_t0 = now; invuln = now + 1e9f; stun_on = 0; slide_v = 0; fall_on = 0; queued = -1;
            cur.id = MV_jump; cur.k = FALL_K; cur.t = 0; cur.kind = K_FALL; cur.face = (int)f; cur.phys = 0; has_cur = 1;
            return;
        }
    }
}
static int drop_through(void) {         /* double tap Down on a platform: drop through it to whatever is below */
    float S, rx, ry;
    if(floor_y <= 0 || fall_on || stun_on) return 0;
    if(has_cur && cur.kind != K_HOLD && cur.kind != K_LAND) return 0;
    S = support_under(player_x(), floor_y);
    if(S >= floor_y - 0.5f) return 0;
    if(has_cur) { root_of(&cur, cur.k, &rx, &ry); X += rx; }
    fall_on = 1; fall_y = floor_y - S; fall_v = 0.05f; floor_y = S;
    cur.id = MV_jump; cur.k = FALL_K; cur.t = 0; cur.kind = K_FALL; cur.face = has_cur ? cur.face : facing; cur.phys = 0; has_cur = 1;
    prev_feet = her_y();
    return 1;
}

/* ------------------------------------------------------------------ her health and K.O. */
static void step_stun(float dt) {
    float v = stun_v - signf_(stun_v) * stun_a * dt;
    X += stun_v * dt;
    stun_v = signf_(v) == signf_(stun_v) ? v : 0;
    if(stun_y > 0 || stun_vy < 0) {
        float f0 = floor_y + stun_y;
        stun_vy += 0.0018f * dt; stun_y = maxf_(0, stun_y - stun_vy * dt);
        {                                               /* knocked while in the air: land on a platform she falls through, not below it */
            float T = -1, sp[2];
            int i;
            span_of(player_x(), sp);
            for(i = 0; i < cur_map->nplat; i++) {
                const Plat *p = &PLATS[cur_map->plat0 + i];
                if(p->top > floor_y && over_surf(p, sp) && f0 > p->top && floor_y + stun_y <= p->top && p->top > T) T = (float)p->top;
            }
            if(T >= 0) { floor_y = T; stun_y = 0; }
        }
    }
    if(stun_v == 0 && stun_y == 0 && (ko_until == 0 || now >= ko_until)) {
        stun_on = 0;
        if(ko_until > 0) { hp = MAX_HP; load_map(level_idx, map_idx, 1); return; }      /* K.O.: the same map again (TODO: ankhs, game over) */
        has_cur = 0; hold_state();
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

static int ground_row(void) { return VIEW_TOP + v2s(FEET_ROW + iround(camY)); }     /* screen row of the ground line */
static void draw_player(void) {
    float rx = 0, ry;
    int vx, vy;
    const MoveFrame *f;
    if(now < invuln && !stun_on && !pit_fall_on && ((int)(now / 60.0f) & 1)) return;       /* blink while she cannot be hurt */
    if(!(stun_on || fall_on || cur.kind == K_FALL)) { float t; root_of(&cur, cur.k, &rx, &t); }
    ry = her_y();
    f = mf(cur.id, cur.k);
    vx = iround(X + rx);                                   /* the camera x is fixed at ANCHOR_X, so world x is view x */
    vy = FEET_ROW - iround(ry - camY);
    if(pit_fall_on) {                                      /* falling into a pit: drawn only above the ground line or below it inside the hole */
        int gl = ground_row();
        gfx_clip(VIEW_TOP, gl); gfx_blit(art_sprite(f->sprite), v2s(vx), VIEW_TOP + v2s(vy), cur.face < 0);
        gfx_clip(gl, VIEW_TOP + VIEW_SCR_H); gfx_blit(art_sprite(f->sprite), v2s(vx), VIEW_TOP + v2s(vy), cur.face < 0);
        gfx_clip(VIEW_TOP, VIEW_TOP + VIEW_SCR_H);
        return;
    }
    gfx_blit(art_sprite(f->sprite), v2s(vx), VIEW_TOP + v2s(vy), cur.face < 0);
}

/* the map's pits, platforms and door (web/game/15_draw_scenery.js drawGeometry and drawPits), view pixels converted to screen */
static void vrect(int x, int y, int w, int h, u16 c) {
    int sx = v2s(x), sy = VIEW_TOP + v2s(y), ex = v2s(x + w), ey = VIEW_TOP + v2s(y + h);
    if(ex <= sx) ex = sx + 1;
    if(ey <= sy) ey = sy + 1;
    gfx_rect(sx, sy, ex - sx, ey - sy, c);
}
static void draw_geometry(void) {
    int i, k, gy = FEET_ROW + iround(camY);                 /* view row of the ground line */
    int open = door_open(), gx = VIEW_W - 10;
    gfx_clip(VIEW_TOP, VIEW_TOP + VIEW_SCR_H);
    for(i = 0; i < cur_map->npit; i++) {
        const Pit *p = &PITS[cur_map->pit0 + i];
        int x0 = p->x0, w = p->x1 - p->x0, top = gy - 5;
        vrect(x0, top, w, VIEW_H - top + 40, RGB(5, 3, 10));
        for(k = top + 10; k < VIEW_H; k += 14) vrect(x0, k, w, 3, RGB(27, 16, 36));                  /* dark bands: a deep shaft */
        vrect(x0 - 2, top, 2, 10, RGB(107, 74, 42)); vrect(x0 + w, top, 2, 10, RGB(107, 74, 42));   /* the dirt rim */
        vrect(x0 - 3, top - 1, 3, 2, RGB(63, 143, 58)); vrect(x0 + w, top - 1, 3, 2, RGB(63, 143, 58));
        for(k = 0; k < w; k += 8) vrect(x0 + k + 2, top + 1, 3, 2, RGB(200, 180, 224));            /* teeth of the hole */
    }
    for(i = 0; i < cur_map->nplat; i++) {                  /* platforms: a plank on two posts */
        const Plat *p = &PLATS[cur_map->plat0 + i];
        int x0 = p->x0, w = p->x1 - p->x0, top = gy - p->top, bot = gy;
        vrect(x0 + 4, top + 7, 3, bot - top - 7, RGB(50, 33, 20)); vrect(x0 + w - 7, top + 7, 3, bot - top - 7, RGB(50, 33, 20));
        vrect(x0, top, w, 7, RGB(122, 82, 48));
        vrect(x0, top, w, 2, RGB(176, 124, 68));
        vrect(x0, top + 6, w, 1, RGB(74, 48, 24));
        for(k = x0 + 6; k < x0 + w - 3; k += 16) vrect(k, top + 3, 2, 2, RGB(42, 26, 12));
    }
    /* the door at the right edge: barred while an enemy is alive, a green glow and arrow once the map is clear */
    vrect(gx, gy - 70, 10, 70, open ? RGB(40, 110, 62) : RGB(30, 30, 40));
    if(!open) for(k = gy - 70; k < gy; k += 6) vrect(gx + 2, k, 6, 2, RGB(138, 138, 153));
    else for(k = 0; k < 8; k++) vrect(gx - 4 + (k < 4 ? k : 7 - k), gy - 28 - 7 + k * 2, 1 + (k < 4 ? k : 7 - k), 2, RGB(125, 255, 154));
}

static void draw_enemies(void) {
    int i;
    gfx_clip(VIEW_TOP, VIEW_TOP + VIEW_SCR_H);
    for(i = 0; i < MAX_ENEMIES; i++) {
        const Enemy *e = &en[i];
        const EnemyFrame *f;
        const EnemyDef *d;
        int vx, vy;
        if(!e->on) continue;
        d = &ENEMIES[e->type];
        if(e->state == S_DYING && d->a_death < 0 && ((int)(e->dead / 70.0f) & 1)) continue;        /* no death animation: it flickers */
        if(e->state == S_DYING && e->dead > DIE_MS - 200.0f && ((int)(e->dead / 40.0f) & 1)) continue;
        f = frame_of(e);
        vx = iround(e->base); vy = FEET_ROW - iround(e->fy + e->jy - camY);
        gfx_blit(art_sprite(f->sprite), v2s(vx), VIEW_TOP + v2s(vy), e->face > 0);              /* the art faces left */
        if(e->state != S_DYING && e->hp < e->maxhp) {                                           /* a small health bar over a hurt enemy */
            float hb[4];
            if(hurt_of(e, hb)) {
                int bx = v2s(iround((hb[0] + hb[2]) * 0.5f)) - 10, by = VIEW_TOP + v2s(FEET_ROW - iround(hb[3] - camY)) - 6;
                gfx_num(bx, by - 9, (u32)e->hp, RGB(255, 255, 255)); gfx_rect(bx, by, 20, 3, RGB(40, 0, 0)); gfx_rect(bx, by, (int)(20.0f * e->hp / e->maxhp), 3, RGB(230, 40, 40));
            }
        }
    }
}

static void draw_hud(u32 frame_us, u32 draw_us) {
    int i, left = 0;
    gfx_clip(0, SCR_H);
    gfx_rect(0, 0, SCR_W, VIEW_TOP, RGB(10, 10, 20));
    gfx_text(6, 4, "HP", RGB(255, 255, 255));
    gfx_rect(26, 4, 102, 10, RGB(60, 60, 70)); gfx_rect(27, 5, 100, 8, RGB(40, 0, 0));
    gfx_rect(27, 5, (int)(100.0f * hp / MAX_HP), 8, RGB(60, 220, 90));
    gfx_text(6, 18, LEVELS[level_idx].name, RGB(255, 220, 120));
    gfx_text(SCR_W - 8 * 8, 4, "MAP", RGB(160, 180, 230)); gfx_text(SCR_W - 8 * 4, 4, cur_map->id, RGB(255, 255, 255));
    for(i = 0; i < MAX_ENEMIES; i++) if(alive(&en[i])) left++;
    gfx_text(SCR_W - 8 * 8, 18, "FOES", RGB(160, 180, 230)); gfx_num(SCR_W - 8 * 3, 18, (u32)left, RGB(255, 255, 255));
    gfx_rect(0, VIEW_TOP + VIEW_SCR_H, SCR_W, SCR_H - VIEW_TOP - VIEW_SCR_H, RGB(8, 8, 16));
    if(now < banner_until) gfx_text((SCR_W - 8 * (int)strlen_(banner)) / 2, VIEW_TOP + 8, banner, RGB(255, 210, 74));
    if(hp <= 0) gfx_text((SCR_W - 8 * 4) / 2, 100, "K.O.", RGB(255, 60, 60));
    gfx_text(4, 214, MOVES[cur.id].id, RGB(255, 220, 120));
    gfx_text(4, 226, "FRAME US", RGB(160, 180, 230)); gfx_num(4 + 8 * 9, 226, frame_us, RGB(255, 255, 255));
    gfx_text(160, 226, "DRAW US", RGB(160, 180, 230)); gfx_num(160 + 8 * 8, 226, draw_us, RGB(255, 255, 255));
}

/* ------------------------------------------------------------------ the frame */
void game_init(void) {
    int i;
    FALL_K = 0; LAND_K = 0;
    for(i = 1; i < nframes(MV_jump); i++) if(mf(MV_jump, i)->ry < mf(MV_jump, i - 1)->ry) { FALL_K = i; break; }
    for(i = FALL_K + 1; i < nframes(MV_jump); i++) if(mf(MV_jump, i)->ry == 0) { LAND_K = i; break; }
    hp = MAX_HP;
    load_map(0, 0, 1);
}

void game_frame(u16 raw, u32 frame_us, u32 draw_us) {
    float rx, ry, before, dt = FRAME_MS;
    int i;
#ifdef AUTOTEST                                        /* test build: a bot plays (walk to the nearest enemy, slash, go right when the door is open) */
    {
        static u32 fc; int j; float tx = 1e9f, px = player_x();
        raw = 0xffff; fc++;
        for(j = 0; j < MAX_ENEMIES; j++) if(alive(&en[j]) && fabsf_(en[j].x - px) < fabsf_(tx - px)) tx = en[j].x;
        if(tx > 1e8f) raw &= ~PAD_RIGHT;
        else if(fabsf_(tx - px) > 45.0f) raw &= (tx > px ? ~PAD_RIGHT : ~PAD_LEFT);
        else { if(tx < px) raw &= ~PAD_LEFT; else raw &= ~PAD_RIGHT; if((fc % 25) == 0) raw &= ~PAD_A; }
        for(j = 0; j < cur_map->npit; j++) { const Pit *q = &PITS[cur_map->pit0 + j]; if(q->x0 - px > -2 && q->x0 - px < 30.0f && floor_y == 0 && (fc % 70) == 0) raw &= ~PAD_UP; }     /* a pit ahead: jump it */
        for(j = 0; j < MAX_ENEMIES; j++) if(alive(&en[j]) && en[j].fy > floor_y + 5 && fabsf_(en[j].x - px) < 70.0f && (fc % 90) == 0) raw &= ~PAD_UP;     /* an enemy above: jump */
    }
#endif
    pad.prev = pad.held;
    pad.held = (u16)(~raw & 0x07ff);                       /* a 0 bit in the raw word is a pressed button */
    if(raw == 0xffff) pad.held = 0;
    now += dt; clock_ms = (u32)now;
    /* buttons -> moves (web/game/02_input.js readButtons); none while she is knocked out of control or falling into a pit */
    if(!stun_on && !pit_fall_on) {
        if(pressed_now(PAD_DOWN)) { if(now - last_down_t < 300.0f) drop_through(); last_down_t = now; }
        if(pressed_now(PAD_LEFT)) facing = -1; else if(pressed_now(PAD_RIGHT)) facing = 1;
        if(released_now(PAD_LEFT) && held(PAD_RIGHT)) facing = 1;
        else if(released_now(PAD_RIGHT) && held(PAD_LEFT)) facing = -1;
        if(pressed_now(PAD_UP)) request(MV_jump, VIA_PRESS);
        if(pressed_now(PAD_A)) request(MV_slash, VIA_PRESS);
        if(pressed_now(PAD_X)) request(MV_dash, VIA_PRESS);
        if(pressed_now(PAD_Y)) request(MV_spin_attack, VIA_PRESS);
        if(pressed_now(PAD_B)) b_down_t = clock_ms;
        if(released_now(PAD_B) && clock_ms - b_down_t <= TAP_MS) request(MV_parry, VIA_CANCEL);       /* tap B: parry; hold B: block */
    }
    before = player_x();
    if(!pit_fall_on) {
        step(dt);
        block_move(before);
        resolve_hits();
    }
    for(i = 0; i < MAX_ENEMIES; i++) if(en[i].on) step_enemy(&en[i], dt);
    enemy_attacks();
    for(i = 0; i < MAX_ENEMIES; i++) if(en[i].on && en[i].state == S_DYING && en[i].dead > DIE_MS) en[i].on = 0;
    if(!pit_fall_on) { if(physics()) goto drawn; check_pit(); }
    else if(pit_sink() > (float)(VIEW_H - FEET_ROW) + her_top() * SS + 8.0f) { hp = MAX_HP; load_map(level_idx, map_idx, 1); goto drawn; }      /* she dropped out of sight: the map again (TODO: ankhs) */
    root_of(&cur, cur.k, &rx, &ry);
    ry = her_y();
    camY += ((ry - CAM_KEEP > 0 ? ry - CAM_KEEP : 0) - camY) * 0.2123f;          /* 1 - exp(-dt / 70) at 60 fps */

    gfx_clear(RGB(0, 0, 0));
    draw_layers(ANCHOR_X, camY);
    draw_geometry();
    draw_enemies();
    draw_player();
    gfx_clip(VIEW_TOP, VIEW_TOP + VIEW_SCR_H);
    draw_layer(FRINGE_SPRITE, 1.0f, ANCHOR_X, camY);
drawn:
    draw_hud(frame_us, draw_us);
}
