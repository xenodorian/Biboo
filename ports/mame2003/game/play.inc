/* The whole trail: reader, moves, enemies, maps, shop, save.
   Integers only. Music stays with the driver, not this CPU.
   Beams are rectangles; the web's alpha sheets are not in the pack. */
#define DT 16
#define CHORD_MS 60
#define SEQ_MS 700
#define TAP_MAX 150
#define NBTN 12
#define HIST_N 16
#define DIR_MASK (PAD_UP | PAD_DOWN | PAD_LEFT | PAD_RIGHT)
#define V0 60858
#define GRAV 217
#define FULL_CHARGE 1000
#define MIN_FIRE 250
#define MAX_EN 8
#define MAX_LEAF 20
#define MAX_CRATE 4
#define MAX_BOMB 4

enum { VIA_PRESS, VIA_TAP, VIA_RELEASE, VIA_CHORD, VIA_SEQ, VIA_CHAIN, VIA_AIR, VIA_ULT };
enum { K_HOLD, K_ACTION, K_LAND };
enum { MODE_PLAY, MODE_SHOP, MODE_DEAD, MODE_END };
enum { ST_PATROL, ST_CHASE, ST_ATK, ST_STUN, ST_DEAD };

static int now;
static int map_id, level, levels_unlocked;
static int px, face, surf, mv, fr, acc, kind;
static int jumping, py, pv, peak, dbl_used, want_crash;
static int flight, flight_left, fly_h;
static int rainbow_left, invuln, hurt_flash, slide, her_stun;
static int charge_ms, hold_on, hold_move, hold_keys, heavy_lite, power_pct;
static int serial, chain_n, chain_t, chain_q[6], chain_qn;
static int ult_on, ult_i, queued, queued_via, deny_t, deny_k;
static int hp, maxhp, leaves, ankhs;
static int gem[4];
static int maxm[4];
static unsigned cleared;
static int story_f, music_vol, saved_t;
static int meter[3];
static unsigned unlocked;
static int btn_mask, meters_on;
static unsigned char moves_open[MV_COUNT];
static int mode, paused, shop_i, shop_clear, shop_next;
static int boom_t, boom_x, boom_y;
static int hop_y, hop_t, down_at, down_held;

static int rd_held[NBTN];
typedef struct { int b, t, u, used; } Press;
static Press rd_hist[HIST_N];
static int rd_nhist, rd_group_on, rd_group_n, rd_group_t, rd_group_mask, rd_consumed, rd_nev;
static int rd_group_keys[NBTN];
typedef struct { int move, via; } Ev;
static Ev rd_events[16];
static int combo_b[8], combo_t[8], combo_n;
static unsigned rng_s;

typedef struct {
    short type, state, face, anim, k, atk;
    short x, fy, base, hp, maxhp, lo, hi;
    short sacc, t, rest, stun, tint, taunt, knock_left, knock_ms, knock_acc, knock_dir;
    short path0, path1, dir, hop, shot_k, sight;
    unsigned short seen;
    int seen_t;
    unsigned char on, hit_done;
} En;
static En en[MAX_EN];
static unsigned char leaf_on[MAX_LEAF], crate_on[MAX_CRATE], bomb_on[MAX_BOMB];

static int move_open(int move);
static int has(int ul) { return (int)((unlocked >> ul) & 1u); }
static void start(int id, int knd, int via, int k0);
static void request(int move, int via);
static int keys_of(int move);
static void taunt_all(void);
static void resolve_hits(void);
static int feet_h(void);
static void die(void);
static void load_map(void);
static void save_game(void);

static int iabs(int v) { return v < 0 ? -v : v; }
static int rng(void)
{
    rng_s = rng_s * 1103515245u + 12345u;
    return (int)((rng_s >> 16) & 32767u);
}
static int clampi(int v, int lo, int hi)
{
    if (v < lo) return lo;
    if (v > hi) return hi;
    return v;
}
static const Frame *mf(int id, int k)
{
    int n = (int)MOVES[id].n;
    if (k < 0) k = 0;
    if (n < 1) n = 1;
    if (k >= n) k = n - 1;
    return &FRAMES[MOVES[id].f0 + k];
}
static int frame_named(int id, const char *name)
{
    int k, j, n = (int)MOVES[id].n;
    for (k = 0; k < n; k++) {
        const char *a = FRAMES[MOVES[id].f0 + k].name;
        for (j = 0; a[j] && name[j] && a[j] == name[j]; j++)
            ;
        if (!a[j] && !name[j]) return k;
    }
    return -1;
}
static int meter_cap(int k)
{
    int cap;
    if (k < 0 || k > 2) return 50;
    cap = maxm[k + 1];
    if (cap < 1) cap = k == 2 ? 100 : 50;
    if (cap > 200) cap = 200;
    return cap;
}
static int meter_on(int k) { return (meters_on >> k) & 1; }
static void spend(int k, int n)
{
    int m, cap;
    if (k < 0 || k > 2) return;
    if (n < 0 && !meter_on(k)) return;
    cap = meter_cap(k);
    m = meter[k] - n;
    if (m < 0) m = 0;
    if (m > cap) m = cap;
    meter[k] = m;
}
static int can_pay(int k, int n)
{
    return meter_on(k) && meter[k] >= n;
}
static void deny(int k)
{
    deny_k = k;
    deny_t = now + 500;
}
static void recompute(void)
{
    int i, j;
    for (i = 0; i < MV_COUNT; i++) moves_open[i] = 0;
    btn_mask = 0;
    meters_on = 0;
    for (i = 0; i < UL_COUNT; i++) if (has(i)) {
        for (j = 0; j < 3; j++) {
            int m = (int)UNLOCKS[i].moves[j];
            if (m == MV_SKY) moves_open[MV_sky_dash] = 1;
            else if (m >= 0 && m < MV_COUNT) moves_open[m] = 1;
        }
        btn_mask |= (int)UNLOCKS[i].buttons;
        meters_on |= (int)UNLOCKS[i].meters;
    }
}
static int move_open(int move)
{
    if (move == MV_sky_dash) return has(UL_SKY_DASH) || moves_open[MV_sky_dash];
    switch (move) {
    case MV_idle: case MV_walk_right: case MV_walk_left: case MV_duck:
    case MV_block: case MV_parry: case MV_jump: case MV_dash:
    case MV_slash: case MV_spin_attack:
        return 1;
    default:
        return move >= 0 && move < MV_COUNT && moves_open[move];
    }
}
static int is_energy_hold(int m)
{
    /* L2 burst and R2 wave are presses in 00_core.js. Only the kick and the dash thrust charge. */
    return m == MV_energy_kick || m == MV_energy_dash_thrust;
}

static void sync_level(void)
{
    int i;
    level = 0;
    for (i = 0; i < NLEVELS; i++) {
        if (map_id >= (int)LEVELS[i].map0 && map_id < (int)LEVELS[i].map0 + (int)LEVELS[i].nmaps)
            level = i;
    }
}
static unsigned save_sum(const unsigned w[25])
{
    unsigned s = 0;
    int i;
    for (i = 0; i < 25; i++) s += w[i];
    return (s ^ 0xA5A5u) & 0xffffu;
}
static void save_game(void)
{
    unsigned w[26];
    int i;
    w[0] = 0xB1B4u;
    w[1] = 4;
    w[2] = unlocked & 0xffffu;
    w[3] = (unlocked >> 16) & 0xffffu;
    w[4] = (unsigned)clampi(leaves, 0, 99999) & 0xffffu;
    w[5] = ((unsigned)clampi(leaves, 0, 99999) >> 16) & 0xffffu;
    w[6] = (unsigned)clampi(hp, 0, 400);
    w[7] = (unsigned)clampi(maxhp, 1, 200);
    w[8] = (unsigned)clampi(map_id, 0, 255);
    w[9] = (unsigned)clampi(level, 0, 15);
    w[10] = (unsigned)clampi(ankhs, 0, 65535);
    w[11] = (unsigned)clampi(levels_unlocked, 1, NLEVELS);
    w[12] = cleared & 0xffffu;
    w[13] = (unsigned)clampi(meter[0], 0, 200);
    w[14] = (unsigned)clampi(meter[1], 0, 200);
    w[15] = (unsigned)clampi(meter[2], 0, 200);
    w[16] = (unsigned)clampi(gem[0], 0, 99);
    w[17] = (unsigned)clampi(gem[1], 0, 99);
    w[18] = (unsigned)clampi(gem[2], 0, 99);
    w[19] = (unsigned)clampi(gem[3], 0, 99);
    w[20] = (unsigned)clampi(maxm[1], 1, 200);
    w[21] = (unsigned)clampi(maxm[2], 1, 200);
    w[22] = (unsigned)clampi(maxm[3], 1, 200);
    w[23] = (unsigned)story_f & 3u;
    w[24] = (unsigned)clampi(music_vol, 0, 3);
    w[25] = save_sum(w);
    for (i = 0; i < 26; i++) hw_nv_w(i, (u16)w[i]);
    saved_t = now + 1200;
}
static void fresh_game(void)
{
    int i;
    unlocked = 0;
    leaves = 100;
    maxm[0] = maxhp = 50;
    maxm[1] = 50;
    maxm[2] = 50;
    maxm[3] = 100;
    hp = maxhp;
    ankhs = 3;
    gem[0] = gem[1] = gem[2] = gem[3] = 0;
    meter[0] = meter[1] = meter[2] = 0;
    levels_unlocked = 1;
    cleared = 0;
    story_f = 0;
    music_vol = 2;
    map_id = 0;
    for (i = 0; i < 32; i++) hw_nv_w(i, 0);
    recompute();
    sync_level();
}
static void load_save(void)
{
    unsigned w[26];
    int i;
    for (i = 0; i < 26; i++) w[i] = hw_nv_r(i);
    if (w[0] != 0xB1B4u || w[1] != 4 || save_sum(w) != w[25]) {
        fresh_game();
        return;
    }
    unlocked = w[2] | (w[3] << 16);
    leaves = (int)(w[4] | (w[5] << 16));
    hp = (int)w[6];
    maxhp = maxm[0] = (int)w[7];
    if (maxhp < 1) maxhp = maxm[0] = 50;
    map_id = (int)w[8];
    level = (int)w[9];
    ankhs = (int)w[10];
    levels_unlocked = (int)w[11];
    if (levels_unlocked < 1) levels_unlocked = 1;
    cleared = w[12];
    meter[0] = (int)w[13];
    meter[1] = (int)w[14];
    meter[2] = (int)w[15];
    gem[0] = (int)w[16];
    gem[1] = (int)w[17];
    gem[2] = (int)w[18];
    gem[3] = (int)w[19];
    maxm[1] = (int)w[20];
    maxm[2] = (int)w[21];
    maxm[3] = (int)w[22];
    story_f = (int)w[23] & 3;
    music_vol = (int)w[24];
    recompute();
    if (map_id < 0 || map_id >= NMAPS) map_id = 0;
    sync_level();
}

static int ground_under(int x, int y)
{
    const MapDef *m = &MAPS[map_id];
    int i, best = 0;
    for (i = 0; i < (int)m->nplat; i++) {
        const Plat *p = &PLATS[m->plat0 + i];
        if (x + 8 < p->x0 || x - 8 > p->x1) continue;
        if (p->top <= y + 4 && p->top >= best) best = p->top;
    }
    return best;
}
static int in_pit(int x)
{
    const MapDef *m = &MAPS[map_id];
    int i;
    for (i = 0; i < (int)m->npit; i++) {
        const Pit *p = &PITS[m->pit0 + i];
        if (x > p->x0 && x < p->x1) return 1;
    }
    return 0;
}
static void clamp_x(void) { px = clampi(px, 16, VIEW_W - 16); }
static int vis_x(void) { return px + face * (int)mf(mv, fr)->rx; }
static int feet_h(void)
{
    if (flight) return fly_h + hop_y;
    if (jumping) return surf + (py >> 16);
    return surf + (int)mf(mv, fr)->ry + hop_y;
}
static void her_box(int *x0, int *y0, int *x1, int *y1)
{
    int x = vis_x(), y = feet_h(), top = (int)mf(mv, fr)->top / 2;
    if (top < 10) top = 10;
    if (face > 0) { *x0 = x + 5; *x1 = x + 30; }
    else { *x0 = x - 30; *x1 = x - 5; }
    *y0 = y;
    *y1 = y + top;
}
static int overlap(int a0, int a1, int a2, int a3, int b0, int b1, int b2, int b3)
{
    return a0 <= b2 && b0 <= a2 && a1 <= b3 && b1 <= a3;
}
static int dist2_box(int px0, int py0, int x0, int y0, int x1, int y1)
{
    int dx = 0, dy = 0;
    if (px0 < x0) dx = x0 - px0;
    else if (px0 > x1) dx = px0 - x1;
    if (py0 < y0) dy = y0 - py0;
    else if (py0 > y1) dy = py0 - y1;
    return dx * dx + dy * dy;
}

static void ebox(int fc, int base, int fy, const short *h, int *x0, int *y0, int *x1, int *y1)
{
    int a = h[0] / 2, b = h[1] / 2, c = h[2] / 2, d = h[3] / 2;
    if (fc < 0) { *x0 = base + a; *x1 = base + c; }
    else { *x0 = base - c; *x1 = base - a; }
    if (*x0 > *x1) { int t = *x0; *x0 = *x1; *x1 = t; }
    *y0 = fy + b;
    *y1 = fy + d;
    if (*y0 > *y1) { int t = *y0; *y0 = *y1; *y1 = t; }
}
static const EFrame *ef(const En *e)
{
    const EAnim *A = &EANIMS[e->anim];
    int k = e->k;
    if ((int)A->n <= 0) return &EFRAMES[EFLAT[A->list0]];
    if (k < 0) k = 0;
    if (k >= (int)A->n) k = (int)A->n - 1;
    return &EFRAMES[EFLAT[A->list0 + k]];
}
static void eplay(En *e, int anim)
{
    const EFrame *f;
    int g;
    if (anim < 0) anim = (int)ENEMIES[e->type].a_idle;
    if (anim < 0) anim = 0;
    e->anim = (short)anim;
    e->k = 0;
    e->t = 0;
    e->hit_done = 0;
    e->shot_k = -1;
    f = ef(e);
    g = e->face < 0 ? f->ground : -f->ground;
    e->base = (short)(e->x - g);
}
static int e_hurt(const En *e, int *x0, int *y0, int *x1, int *y1)
{
    const EFrame *f;
    if (!e->on || e->hp <= 0) return 0;
    f = ef(e);
    if (f->hx1 <= f->hx0) return 0;
    ebox(e->face, e->base, e->fy + 0, &f->hx0, x0, y0, x1, y1);
    *y0 += 0;
    return 1;
}
static void e_move(En *e, int dir)
{
    int nx = e->x + (dir >= 0 ? 1 : -1);
    if (nx < e->lo) nx = e->lo;
    if (nx > e->hi) nx = e->hi;
    if (e->state != ST_STUN && e->fy == 0 && in_pit(nx)) return;
    if (e->state == ST_STUN && e->fy == 0 && in_pit(nx)) {
        e->hp = 0;
        e->state = ST_DEAD;
        leaves += 2;
        return;
    }
    e->base = (short)(e->base + (nx - e->x));
    e->x = (short)nx;
}
static void e_knock(En *e, int dist, int ms, int dir)
{
    if (dist < 0) dist = -dist;
    if (ms < 1) ms = 1;
    e->knock_left = (short)dist;
    e->knock_ms = (short)ms;
    e->knock_acc = 0;
    e->knock_dir = (short)(dir >= 0 ? 1 : -1);
}
static void hurt_enemy(En *e, int dmg, int dir)
{
    int dist = 0, ms = 0;
    if (!e->on || e->hp <= 0) return;
    if (e->state == ST_PATROL) e->state = ST_CHASE;
    e->tint = 8;
    if (dmg <= 0) return;
    e->hp = (short)(e->hp - dmg);
    if (e->hp < 0) e->hp = 0;
    if (mv == MV_heavy || mv == MV_slash) { dist = 25; ms = 100; }
    else if (mv == MV_heavy_horizontal) { dist = 50; ms = 100; }
    else if (mv == MV_push_kick) { dist = 100; ms = 200; }
    else if (mv == MV_energy_kick) { dist = 80; ms = 280; }
    else if (mv == MV_energy_burst) { dist = 70; ms = 320; }
    if (e->hp == 0) {
        e->state = ST_DEAD;
        if (ENEMIES[e->type].boss) {
            leaves += 15;
            ankhs = clampi(ankhs + 1, 0, 9);
            gem[0] = clampi(gem[0] + 1, 0, 99);
            hp = clampi(hp + 20, 0, maxhp);
        } else {
            leaves += 2;
            if ((rng() % 3) == 0) hp = clampi(hp + 8, 0, maxhp);
        }
        if ((int)ENEMIES[e->type].a_death >= 0) eplay(e, ENEMIES[e->type].a_death);
        return;
    }
    if (dist) {
        e->state = ST_STUN;
        e->stun = (short)ms;
        if ((int)ENEMIES[e->type].a_stun >= 0) eplay(e, ENEMIES[e->type].a_stun);
        e_knock(e, dist, ms, dir);
    }
}
static void set_range(En *e)
{
    const MapDef *m = &MAPS[map_id];
    int i;
    e->lo = 16;
    e->hi = (short)(VIEW_W - 16);
    if (e->fy > 0) {
        for (i = 0; i < (int)m->nplat; i++) {
            const Plat *p = &PLATS[m->plat0 + i];
            if (p->top == e->fy && e->x >= p->x0 && e->x <= p->x1) {
                e->lo = (short)(p->x0 + 8);
                e->hi = (short)(p->x1 - 8);
                return;
            }
        }
    }
    for (i = 0; i < (int)m->npit; i++) {
        const Pit *p = &PITS[m->pit0 + i];
        if (p->x1 <= e->x && p->x1 + 2 > e->lo) e->lo = (short)(p->x1 + 2);
        if (p->x0 >= e->x && p->x0 - 2 < e->hi) e->hi = (short)(p->x0 - 2);
    }
}
static int strike_anim(En *e)
{
    const EDef *d = &ENEMIES[e->type];
    int hx0, hy0, hx1, hy1, i, j, best = -1;
    if (iabs(vis_x() - e->x) > d->reach + 48) return -1;
    her_box(&hx0, &hy0, &hx1, &hy1);
    for (i = 0; i < (int)d->nattacks; i++) {
        int anim = (int)d->attack[i];
        const EAnim *A;
        int g0, base;
        if (anim < 0) continue;
        A = &EANIMS[anim];
        g0 = EFRAMES[EFLAT[A->list0]].ground;
        base = e->x - (e->face < 0 ? g0 : -g0);
        for (j = 0; j < (int)A->n; j++) {
            const EFrame *f = &EFRAMES[EFLAT[A->list0 + j]];
            int x0, y0, x1, y1;
            if (!(f->flags & 2)) continue;
            ebox(e->face, base, e->fy, &f->ax0, &x0, &y0, &x1, &y1);
            if (overlap(x0, y0, x1, y1, hx0, hy0, hx1, hy1)) best = anim;
        }
    }
    if ((int)d->combo >= 0 && (rng() & 1) && best >= 0) return (int)d->combo;
    return best;
}
static int hurt_her(int dmg, int from_face)
{
    if (mode != MODE_PLAY || paused) return 0;
    if (rainbow_left > 0 || invuln > 0) return 0;
    if (mv == MV_parry && kind == K_ACTION && fr <= 2) return 2;
    if (mv == MV_block && kind != K_LAND) {
        dmg /= 2;
        slide += from_face * 8;
    }
    if (dmg <= 0) return 1;
    hp -= dmg;
    if (hp < 0) hp = 0;
    invuln = 360;
    hurt_flash = 8;
    slide += from_face * 10;
    if (dmg >= 24) her_stun = 180;
    if (hp == 0) die();
    return 1;
}
static void step_enemy(En *e)
{
    const EDef *d = &ENEMIES[e->type];
    const EAnim *A;
    const EFrame *f;
    int sp, ended = 0;
    if (!e->on) return;
    if (e->tint > 0) e->tint--;
    if (e->taunt > 0) e->taunt--;
    if (e->knock_left > 0 && e->knock_ms > 0) {
        e->knock_acc = (short)(e->knock_acc + e->knock_left * DT);
        while (e->knock_acc >= e->knock_ms && e->knock_left > 0) {
            e->knock_acc = (short)(e->knock_acc - e->knock_ms);
            e->knock_left--;
            e_move(e, e->knock_dir);
        }
    }
    A = &EANIMS[e->anim];
    f = ef(e);
    e->t = (short)(e->t + DT);
    if (e->t >= f->ms) {
        e->t = (short)(e->t - f->ms);
        e->k++;
        if (e->k >= (int)A->n) {
            if (A->loop) e->k = 0;
            else { e->k = (short)(A->n - 1); ended = 1; }
        }
    }
    if (e->state == ST_DEAD) {
        if (ended || (int)d->a_death < 0) e->on = 0;
        return;
    }
    if (e->state == ST_ATK) {
        f = ef(e);
        if ((f->flags & 2) && !e->hit_done) {
            int x0, y0, x1, y1, hx0, hy0, hx1, hy1, hit_now = 0;
            if (f->flags & 8) hit_now = e->shot_k != e->k;
            else hit_now = 1;
            if (hit_now) {
                ebox(e->face, e->base, e->fy, &f->ax0, &x0, &y0, &x1, &y1);
                her_box(&hx0, &hy0, &hx1, &hy1);
                if (overlap(x0, y0, x1, y1, hx0, hy0, hx1, hy1)) {
                    int ai = e->atk;
                    int dmg, r;
                    if (ai < 0 || ai > 3) ai = 0;
                    dmg = d->atk_dmg[ai];
                    r = hurt_her(dmg, e->face);
                    if (r == 2) {
                        hurt_enemy(e, d->parry_d, -e->face);
                        if (e->hp > 0) {
                            e->state = ST_STUN;
                            e->stun = d->parry_ms;
                            e_knock(e, d->parry_d > 0 ? 30 : 20, d->parry_ms > 0 ? d->parry_ms : 300, -e->face);
                        }
                    }
                }
                e->shot_k = e->k;
                if (!(f->flags & 8)) e->hit_done = 1;
            }
        }
        if (ended) {
            e->state = ST_CHASE;
            e->rest = d->rest0;
            eplay(e, d->a_idle >= 0 ? d->a_idle : d->a_walk);
        }
        return;
    }
    if (e->state == ST_STUN) {
        e->stun = (short)(e->stun - DT);
        if (e->stun <= 0) {
            e->state = ST_CHASE;
            eplay(e, d->a_idle >= 0 ? d->a_idle : 0);
        }
        return;
    }
    if (e->rest > 0) e->rest = (short)(e->rest - DT);
    if (e->hop > 0) {
        int step = d->jump_dist / 8;
        int rise = e->hop < 4 ? e->hop * 6 : (8 - e->hop) * 6;
        if (step < 1) step = 1;
        e->base = (short)(e->base + e->dir * step);
        e->x = (short)(e->x + e->dir * step);
        e->fy = (short)(e->fy + 0);
        (void)rise;
        e->hop++;
        if (e->hop >= 8) {
            e->hop = 0;
            e->x = (short)(e->x + e->dir * d->land_off);
            if (e->fy == 0 && in_pit(e->x)) {
                e->hp = 0;
                e->state = ST_DEAD;
                e->on = 0;
                leaves += 2;
                return;
            }
        }
        return;
    }
    if (e->state == ST_PATROL) {
        int target, dxh = vis_x() - e->x;
        if (dxh * e->face > 0 && iabs(dxh) < e->sight && iabs(feet_h() - e->fy) < 80) {
            e->state = ST_CHASE;
            e->rest = 180;
            return;
        }
        target = e->dir > 0 ? e->path1 : e->path0;
        if (e->path0 < 0) target = e->dir > 0 ? e->hi : e->lo;
        if ((e->dir > 0 && e->x >= target) || (e->dir < 0 && e->x <= target)) {
            e->dir = (short)(-e->dir);
            e->face = e->dir;
            e->rest = (short)(400 + (rng() % 400));
            eplay(e, d->a_idle >= 0 ? d->a_idle : d->a_walk);
            return;
        }
        if (e->rest > 0) return;
        if ((int)d->a_walk >= 0 && e->anim != d->a_walk) eplay(e, d->a_walk);
        e->face = e->dir;
    } else {
        int dxh = vis_x() - e->x;
        int anim;
        e->dir = (short)(dxh >= 0 ? 1 : -1);
        e->face = e->dir;
        if (iabs(dxh) > 200 && iabs(feet_h() - e->fy) > 80) {
            e->state = ST_PATROL;
            return;
        }
        if (e->rest <= 0 && iabs(dxh) < d->reach + 36) {
            anim = strike_anim(e);
            if (anim >= 0) {
                e->state = ST_ATK;
                e->atk = 0;
                eplay(e, anim);
                return;
            }
        }
        if (iabs(dxh) < 28) return;
        if (e->fy == 0 && in_pit(e->x + e->dir * 8) && d->jump_dist > 0) {
            e->hop = 1;
            return;
        }
        if ((int)d->a_walk >= 0 && e->anim != d->a_walk && e->rest <= 0) eplay(e, d->a_walk);
    }
    sp = d->speed;
    if (d->boss && e->hp * 2 < e->maxhp) sp = sp * 145 / 100;
    if (e->taunt > 0) sp *= 2;
    if (e->state == ST_PATROL) sp /= 2;
    e->sacc = (short)(e->sacc + sp * DT);
    while (e->sacc >= 1000) {
        e->sacc = (short)(e->sacc - 1000);
        e_move(e, e->dir);
    }
}
static void taunt_all(void)
{
    int i;
    for (i = 0; i < MAX_EN; i++) {
        if (!en[i].on || en[i].hp <= 0) continue;
        if (ENEMIES[en[i].type].boss) continue;
        en[i].taunt = 250;
        en[i].tint = 250;
        if (en[i].state == ST_PATROL) en[i].state = ST_CHASE;
    }
}
static int enemies_left(void)
{
    int i, n = 0;
    for (i = 0; i < MAX_EN; i++) if (en[i].on && en[i].hp > 0) n++;
    return n;
}

static int shape_hit(const Hit *h, int ax, int ay, int *box)
{
    int x0, y0, x1, y1, i;
    int hax = ax + face * (int)h->ax;
    int hay = ay + (int)h->ay;
    int hbx = ax + face * (int)h->bx;
    int hby = ay + (int)h->by;
    if (h->shape == 1) {
        int r = (int)h->r;
        return dist2_box(hax, hay, box[0], box[1], box[2], box[3]) <= r * r;
    }
    if (h->shape == 2) {
        int xa = hax < hbx ? hax : hbx, xb = hax > hbx ? hax : hbx;
        int ya = hay < hby ? hay : hby, yb = hay > hby ? hay : hby;
        return overlap(xa, ya, xb, yb, box[0], box[1], box[2], box[3]);
    }
    x0 = box[0]; y0 = box[1]; x1 = box[2]; y1 = box[3];
    for (i = 0; i <= 4; i++) {
        int x = hax + (hbx - hax) * i / 4;
        int y = hay + (hby - hay) * i / 4;
        int r = (int)h->r;
        if (r < 3) r = 3;
        if (dist2_box(x, y, x0, y0, x1, y1) <= r * r) return 1;
    }
    return 0;
}
static int dmg_of(void)
{
    int v = 15, p = power_pct;
    if (p < 1) p = 100;
    switch (mv) {
    case MV_heavy: return heavy_lite ? 80 : 200;
    case MV_jump_crash: return 300;
    case MV_slash: v = 25; break;
    case MV_heavy_horizontal: v = 50; break;
    case MV_thrust: case MV_upswing: v = 15; break;
    case MV_push_kick: v = 10; break;
    case MV_heavy_kick: v = 25; break;
    case MV_energy_kick: v = 30; break;
    case MV_energy_burst: v = 50; break;
    case MV_dash_thrust: v = 25; break;
    case MV_energy_dash_thrust: v = 50; break;
    case MV_spin_attack: v = 20; break;
    case MV_energy_wave: return 0;
    case MV_earthquake: v = 250; break;
    case MV_meteor_shower: v = 200; break;
    case MV_chain2: v = 15; break;
    case MV_chain3: v = 18; break;
    case MV_chain4: v = 22; break;
    default: v = 15; break;
    }
    return v * p / 100;
}
static void break_crate(int i)
{
    const Crate *c;
    if (i < 0 || i >= MAX_CRATE || !crate_on[i]) return;
    crate_on[i] = 0;
    c = &CRATES[MAPS[map_id].crate0 + i];
    if (c->loot < 0) ankhs = clampi(ankhs + 1, 0, 9);
    else if (c->loot > 0) leaves += c->loot;
    else leaves += 3;
}
static void detonate(int i)
{
    const MapDef *m = &MAPS[map_id];
    const Spot *b;
    int k, hx0, hy0, hx1, hy1;
    if (i < 0 || i >= MAX_BOMB || !bomb_on[i]) return;
    bomb_on[i] = 0;
    b = &BOMBS[m->bomb0 + i];
    boom_t = 10;
    boom_x = b->x;
    boom_y = b->fy + 20;
    her_box(&hx0, &hy0, &hx1, &hy1);
    if (dist2_box(b->x, b->fy + 10, hx0, hy0, hx1, hy1) <= 50 * 50)
        hurt_her(40, vis_x() >= b->x ? -1 : 1);
    for (k = 0; k < MAX_EN; k++) {
        int x0, y0, x1, y1;
        if (!e_hurt(&en[k], &x0, &y0, &x1, &y1)) continue;
        if (dist2_box(b->x, b->fy + 10, x0, y0, x1, y1) <= 50 * 50)
            hurt_enemy(&en[k], 50, en[k].x >= b->x ? 1 : -1);
    }
    for (k = 0; k < (int)m->ncrate && k < MAX_CRATE; k++) {
        const Crate *c = &CRATES[m->crate0 + k];
        int dx = c->x - b->x, dy = c->fy - b->fy;
        if (dx * dx + dy * dy <= 60 * 60) break_crate(k);
    }
    for (k = 0; k < (int)m->nbomb && k < MAX_BOMB; k++) {
        const Spot *o;
        int dx, dy;
        if (k == i || !bomb_on[k]) continue;
        o = &BOMBS[m->bomb0 + k];
        dx = o->x - b->x;
        dy = o->fy - b->fy;
        if (dx * dx + dy * dy <= 70 * 70) detonate(k);
    }
}
static void hit_world(const Hit *h, int ax, int ay)
{
    const MapDef *m = &MAPS[map_id];
    int i;
    for (i = 0; i < (int)m->ncrate && i < MAX_CRATE; i++) {
        const Crate *c = &CRATES[m->crate0 + i];
        int box[4];
        if (!crate_on[i]) continue;
        box[0] = c->x - 12; box[1] = c->fy; box[2] = c->x + 12; box[3] = c->fy + 20;
        if (shape_hit(h, ax, ay, box)) break_crate(i);
    }
    for (i = 0; i < (int)m->nbomb && i < MAX_BOMB; i++) {
        const Spot *b = &BOMBS[m->bomb0 + i];
        int box[4];
        if (!bomb_on[i]) continue;
        box[0] = b->x - 8; box[1] = b->fy; box[2] = b->x + 8; box[3] = b->fy + 16;
        if (shape_hit(h, ax, ay, box)) detonate(i);
    }
}
static void resolve_hits(void)
{
    const Frame *f = mf(mv, fr);
    int s, i, gap, ax, ay, dmg;
    if (kind != K_ACTION || her_stun > 0) return;
    if (f->nhit <= 0 && f->beam < 0) return;
    gap = (mv == MV_earthquake || mv == MV_meteor_shower) ? 250 : 0;
    ax = vis_x();
    ay = feet_h();
    dmg = dmg_of();
    for (s = 0; s < f->nhit; s++) {
        const Hit *h = &HITS[f->hit0 + s];
        hit_world(h, ax, ay);
        for (i = 0; i < MAX_EN; i++) {
            int box[4];
            if (!e_hurt(&en[i], &box[0], &box[1], &box[2], &box[3])) continue;
            if (!shape_hit(h, ax, ay, box)) continue;
            if (en[i].seen == (unsigned short)serial && (gap == 0 || now - en[i].seen_t < gap)) continue;
            en[i].seen = (unsigned short)serial;
            en[i].seen_t = now;
            if (mv == MV_energy_wave) {
                int k;
                for (k = 0; k < MAX_EN; k++) {
                    int b2[4];
                    if (!e_hurt(&en[k], &b2[0], &b2[1], &b2[2], &b2[3])) continue;
                    if (dist2_box(box[0], box[1], b2[0], b2[1], b2[2], b2[3]) <= 75 * 75)
                        hurt_enemy(&en[k], 50 * power_pct / 100, face);
                }
            } else {
                hurt_enemy(&en[i], dmg, face);
            }
        }
    }
}
static void beam_tick(void)
{
    const Frame *f = mf(mv, fr);
    int b, k, cost, x, y, x0, x1, y0, y1, i;
    static int beam_clock;
    if (kind != K_ACTION || f->beam < 0) { beam_clock = 0; return; }
    b = (int)f->beam;
    k = b == 3 ? 1 : 0;
    cost = b == 1 ? 3 : (b >= 2 ? 5 : 1);
    beam_clock += DT;
    if (beam_clock < 100) return;
    beam_clock = 0;
    if (!can_pay(k, cost)) { deny(k); return; }
    spend(k, cost);
    x = vis_x();
    y = feet_h();
    x0 = x + face * 18;
    x1 = x + face * 120;
    if (x0 > x1) { int t = x0; x0 = x1; x1 = t; }
    y0 = y + 18;
    y1 = y + 40;
    for (i = 0; i < MAX_EN; i++) {
        int box[4];
        if (!e_hurt(&en[i], &box[0], &box[1], &box[2], &box[3])) continue;
        if (overlap(x0, y0, x1, y1, box[0], box[1], box[2], box[3]))
            hurt_enemy(&en[i], 8 + cost, face);
    }
}

static int entry_frame(int id)
{
    const Move *m = &MOVES[id];
    if (m->enter_from >= 0 && mv == m->enter_from && fr < 16 && m->enter_k[fr] >= 0)
        return (int)m->enter_k[fr];
    if (m->enter_default > 0) return (int)m->enter_default;
    return 0;
}
static int beam_need(int id, int *k, int *n)
{
    int i, nfr = (int)MOVES[id].n;
    for (i = 0; i < nfr; i++) {
        int b = (int)FRAMES[MOVES[id].f0 + i].beam;
        if (b >= 0) {
            *k = b == 3 ? 1 : 0;
            *n = b == 1 ? 3 : (b >= 2 ? 5 : 1);
            return 1;
        }
    }
    return 0;
}
static int can_afford(int id)
{
    int k, n;
    if (id == MV_jump_crash) return can_pay(0, 30);
    if (id == MV_earthquake || id == MV_meteor_shower) return can_pay(2, 100);
    if (beam_need(id, &k, &n)) return can_pay(k, n);
    return 1;
}
static void start(int id, int knd, int via, int k0)
{
    int charged = (mv == MV_charge) ? charge_ms : 0;
    int bk, bn;
    if (id < 0 || id >= MV_COUNT) return;
    if (knd == K_ACTION && !can_afford(id) && via != VIA_CHAIN) { deny(0); return; }
    px += face * (int)mf(mv, fr)->rx;
    clamp_x();
    if (via == VIA_CHAIN && (id == MV_heavy || id == MV_energy_burst)) {
        int pay = meter[0] < 20 ? meter[0] : 20;
        if (meter_on(0)) meter[0] -= pay;
        charged = pay > 0 ? 1000 * pay / 20 : 0;
    }
    if (id == MV_charge && mv != MV_charge) charge_ms = 0;
    if (k0 < 0) k0 = entry_frame(id);
    mv = id;
    fr = k0;
    acc = 0;
    kind = knd;
    power_pct = 100;
    heavy_lite = 0;
    if (knd == K_ACTION) serial++;
    if (id == MV_heavy) heavy_lite = charged < FULL_CHARGE;
    if (is_energy_hold(id) && (via == VIA_RELEASE || via == VIA_CHAIN))
        power_pct = 50 + (charged > FULL_CHARGE ? 50 : 50 * charged / FULL_CHARGE);
    if (knd == K_ACTION && id == MV_jump_crash) spend(0, 30);
    if (knd == K_ACTION && (id == MV_earthquake || id == MV_meteor_shower)) spend(2, 100);
    if (knd == K_ACTION && beam_need(id, &bk, &bn)) spend(bk, bn);
    if (id == MV_taunt) taunt_all();
    jumping = 0;
    want_crash = 0;
    if (id == MV_jump) dbl_used = 0;
    if (id == MV_dash || id == MV_dash_thrust || id == MV_push_kick || id == MV_energy_dash_thrust)
        hop_t = 1;
    else if (knd != K_HOLD)
        hop_t = 0;
    (void)peak;
}
static void air_crash(void)
{
    int k0;
    if (!move_open(MV_jump_crash)) return;
    if (!can_pay(0, 30)) { deny(0); return; }
    k0 = frame_named(MV_jump_crash, "apex");
    jumping = 0;
    flight = 0;
    start(MV_jump_crash, K_ACTION, VIA_AIR, k0);
}
static void start_flight(void)
{
    if (her_stun > 0 || flight) return;
    px += face * (int)mf(mv, fr)->rx;
    clamp_x();
    flight = 1;
    flight_left = 5000;
    fly_h = feet_h();
    if (fly_h < surf + 20) fly_h = surf + 20;
    jumping = 0;
    hold_on = 0;
    mv = MV_jump;
    fr = 3;
    kind = K_HOLD;
    acc = 0;
}
static void start_rainbow(void)
{
    if (her_stun > 0) return;
    rainbow_left = 5000;
    invuln = 5000;
}
static void start_ult(void)
{
    if (her_stun > 0 || ult_on) return;
    ult_on = 1;
    ult_i = 0;
}
static int chain_busy(void)
{
    int k, last = -1, n;
    if (kind != K_ACTION) return 0;
    n = (int)MOVES[mv].n;
    for (k = 0; k < n; k++) if (FRAMES[MOVES[mv].f0 + k].nhit > 0) last = k;
    return last >= 0 && fr <= last;
}
static void chain_go(int move)
{
    if (!chain_qn && !chain_busy() && kind != K_ACTION) start(move, K_ACTION, VIA_CHAIN, -1);
    else if (chain_qn < 6) chain_q[chain_qn++] = move;
}
static void chain_tick(void)
{
    int m, i;
    if (!chain_qn || her_stun > 0 || chain_busy()) return;
    if (kind == K_ACTION || jumping || flight) return;
    m = chain_q[0];
    for (i = 1; i < chain_qn; i++) chain_q[i - 1] = chain_q[i];
    chain_qn--;
    queued = -1;
    start(m, K_ACTION, VIA_CHAIN, -1);
}
static int chain_press(void)
{
    static const int cm[4] = {MV_slash, MV_chain2, MV_chain3, MV_chain4};
    int n;
    if (!has(UL_CHAIN) || her_stun > 0 || jumping || flight) { chain_n = 0; return 0; }
    n = (now - chain_t <= 750) ? chain_n + 1 : 1;
    if (n == 1) { chain_n = 1; chain_t = now; return 0; }
    if (n <= 4) { chain_n = n; chain_t = now; chain_go(cm[n - 1]); return 1; }
    chain_n = 0;
    chain_t = 0;
    if (!meter_on(0) || meter[0] < 1) return 1;
    chain_go(MV_heavy);
    return 1;
}
static int chain_burst(void)
{
    if (!has(UL_CHAIN_BURST) || chain_n != 4 || now - chain_t > 750) return 0;
    if (her_stun > 0 || jumping) return 0;
    chain_n = 0;
    if (!meter_on(0) || meter[0] < 1) return 1;
    chain_go(MV_energy_burst);
    return 1;
}
static int keys_of(int move)
{
    int i, k, m = 0;
    for (i = 0; i < N_BIND_OTHER; i++) if ((int)BIND_OTHER[i].move == move) {
        for (k = 0; k < (int)BIND_OTHER[i].nsteps; k++) m |= (int)BIND_OTHER[i].steps[k];
    }
    for (i = 0; i < N_BIND_CHORDS; i++) if ((int)BIND_CHORDS[i].move == move)
        m |= (int)BIND_CHORDS[i].steps[0];
    return m ? m : (int)PAD_A;
}
static int move_uses_a(int move)
{
    int i, k;
    for (i = 0; i < N_BIND_OTHER; i++) if ((int)BIND_OTHER[i].move == move) {
        for (k = 0; k < (int)BIND_OTHER[i].nsteps; k++)
            if (BIND_OTHER[i].steps[k] & PAD_A) return 1;
    }
    for (i = 0; i < N_BIND_CHORDS; i++) if ((int)BIND_CHORDS[i].move == move) {
        if (BIND_CHORDS[i].steps[0] & PAD_A) return 1;
    }
    return 0;
}
static void request(int move, int via)
{
    int in_air;
    if (move == MV_ULTIMATE) { start_ult(); return; }
    if (move == MV_SKY) move = MV_sky_dash;
    if (move == MV_FLY) { start_flight(); return; }
    if (move == MV_RAINBOW) { start_rainbow(); return; }
    if (move < 0 || move >= MV_COUNT || her_stun > 0) return;
    if (move == MV_jump && jumping && has(UL_DOUBLE_JUMP) && !dbl_used) {
        if (pv < V0) pv = V0;
        dbl_used = 1;
        queued = -1;
        return;
    }
    if (!move_open(move)) return;
    if (!can_afford(move)) { deny(move == MV_earthquake || move == MV_meteor_shower ? 2 : 0); return; }
    in_air = jumping || flight || (mv == MV_jump && kind == K_ACTION && (int)mf(mv, fr)->ry > 0);
    if (is_energy_hold(move) && via == VIA_RELEASE) {
        if (!(mv == MV_charge && charge_ms >= MIN_FIRE)) return;
    } else if (is_energy_hold(move)) {
        if (in_air || (kind == K_ACTION && mv != MV_charge)) return;
        if (meter_on(0) && meter[0] < 1) { deny(0); return; }
        hold_on = 1;
        hold_move = move;
        hold_keys = keys_of(move);
        queued = -1;
        return;
    }
    if (move_uses_a(move) && in_air && move != MV_jump_crash) {
        if (!move_open(MV_jump_crash)) return;
        if (jumping && mv == MV_jump && !((py >> 16) > 0) && kind != K_ACTION) { want_crash = 1; return; }
        if (in_air) { air_crash(); return; }
    }
    if (kind == K_LAND) { queued = move; queued_via = via; return; }
    if (kind == K_ACTION && via == VIA_PRESS) { queued = move; queued_via = via; return; }
    start(move, K_ACTION, via, -1);
}

static int bit_index(int mask)
{
    int i;
    for (i = 0; i < NBTN; i++) if (mask == (1 << i)) return i;
    return -1;
}
static int popcount_(int m)
{
    int n = 0;
    while (m) { n += m & 1; m >>= 1; }
    return n;
}
static int bind_open(const Bind *b)
{
    if (b->move == MV_ULTIMATE) return has(UL_ULTIMATE);
    if (b->move == MV_SKY || b->move == MV_sky_dash) return has(UL_SKY_DASH);
    if (b->move == MV_DBL) return has(UL_DOUBLE_JUMP);
    if (b->move == MV_FLY) return has(UL_FLY);
    if (b->move == MV_RAINBOW) return has(UL_RAINBOW);
    if (b->move == MV_CHAINBURST) return has(UL_CHAIN_BURST);
    if (b->move == MV_METER) return has(UL_METER_CHARGE);
    return move_open(b->move);
}
static const Bind *rd_find(int type, int bit)
{
    const Bind *r = 0;
    int i;
    for (i = 0; i < N_BIND_OTHER; i++) {
        const Bind *b = &BIND_OTHER[i];
        if ((int)b->type == type && (int)b->steps[0] == bit && bind_open(b)) {
            if (type == BT_PRESS && b->move == MV_jump) continue;
            r = b;
        }
    }
    return r;
}
static const Bind *tap_of(int bit)
{
    const Bind *b = rd_find(BT_TAP, bit);
    if (b) return b;
    if (bit == PAD_A && move_open(MV_charge)) return rd_find(BT_PRESS, PAD_A);
    return 0;
}
static const Bind *press_of(int bit)
{
    if (bit == PAD_A && move_open(MV_charge)) return 0;
    return rd_find(BT_PRESS, bit);
}
static const Bind *hold_of(int bit) { return rd_find(BT_HOLD, bit); }
static int hold_ready_bit(int bit)
{
    const Bind *hb = hold_of(bit);
    return hb && mv == hb->move && fr >= (int)MOVES[mv].loop_from;
}
static void rd_reset(void)
{
    int i;
    for (i = 0; i < NBTN; i++) rd_held[i] = -1;
    rd_nhist = 0;
    rd_group_on = 0;
    rd_consumed = 0;
    rd_nev = 0;
}
static void rd_emit(int move, int via)
{
    if (rd_nev < 16) {
        rd_events[rd_nev].move = move;
        rd_events[rd_nev].via = via;
        rd_nev++;
    }
}
static void rd_resolve(int t);
static void rd_down(int bit, int t)
{
    int i = bit_index(bit);
    if (i < 0 || rd_held[i] >= 0) return;
    rd_held[i] = t;
    rd_consumed &= ~bit;
    if (rd_nhist == HIST_N) {
        int k;
        for (k = 1; k < HIST_N; k++) rd_hist[k - 1] = rd_hist[k];
        rd_nhist--;
    }
    rd_hist[rd_nhist].b = bit;
    rd_hist[rd_nhist].t = t;
    rd_hist[rd_nhist].u = -1;
    rd_hist[rd_nhist].used = 0;
    rd_nhist++;
    if (rd_group_on && t - rd_group_t <= CHORD_MS && rd_group_n < NBTN) {
        rd_group_keys[rd_group_n++] = bit;
        rd_group_mask |= bit;
    } else {
        if (rd_group_on) rd_resolve(t);
        rd_group_on = 1;
        rd_group_t = t;
        rd_group_n = 1;
        rd_group_keys[0] = bit;
        rd_group_mask = bit;
    }
}
static void rd_up(int bit, int t)
{
    int i = bit_index(bit), k, was, t0;
    const Bind *tp, *into;
    if (i < 0 || rd_held[i] < 0) return;
    t0 = rd_held[i];
    if (rd_group_on) rd_resolve(t);
    rd_held[i] = -1;
    for (k = rd_nhist - 1; k >= 0; k--) if (rd_hist[k].b == bit && rd_hist[k].u < 0) {
        rd_hist[k].u = t;
        break;
    }
    was = rd_consumed & bit;
    rd_consumed &= ~bit;
    if (was) return;
    tp = tap_of(bit);
    if (tp && t - t0 <= TAP_MAX) rd_emit(tp->move, VIA_TAP);
    into = hold_of(bit);
    if (into && into->release_into >= 0 && move_open(into->release_into) && hold_ready_bit(bit))
        rd_emit(into->release_into, VIA_RELEASE);
}
static void rd_resolve(int t)
{
    int i, k, n;
    (void)t;
    if (!rd_group_on) return;
    rd_group_on = 0;
    for (i = 0; i < N_BIND_SEQS; i++) {
        const Bind *s = &BIND_SEQS[i];
        int last, ok = 1, nprior = 0;
        Press *earlier[6];
        int lastT = 0;
        n = (int)s->nsteps;
        if (n < 2 || n > 6 || !bind_open(s)) continue;
        last = (int)s->steps[n - 1];
        if (popcount_(last) == 1) {
            if (rd_nhist < n) continue;
            if (rd_hist[rd_nhist - 1].b != last || !(rd_group_mask & last)) continue;
            for (k = 0; k < n - 1; k++) earlier[k] = &rd_hist[rd_nhist - n + k];
            lastT = rd_hist[rd_nhist - 1].t;
        } else {
            int pr[HIST_N];
            if ((rd_group_mask & last) != last) continue;
            for (k = 0; k < rd_nhist; k++) if (rd_hist[k].t < rd_group_t) pr[nprior++] = k;
            if (nprior < n - 1) continue;
            for (k = 0; k < n - 1; k++) earlier[k] = &rd_hist[pr[nprior - (n - 1) + k]];
            lastT = rd_group_t;
        }
        for (k = 0; k < n - 1 && ok; k++) {
            Press *e = earlier[k];
            int next = (k < n - 2) ? earlier[k + 1]->t : lastT;
            if (popcount_((int)s->steps[k]) != 1 || e->b != (int)s->steps[k]) ok = 0;
            else if (next - e->t > SEQ_MS) {
                int holdable = (e->b & DIR_MASK) || hold_of(e->b) != 0;
                ok = n == 2 && holdable && (e->u < 0 || e->u >= next);
            }
        }
        if (ok) {
            int all = 0;
            for (k = 0; k < n; k++) all |= (int)s->steps[k];
            for (k = 0; k < NBTN; k++) if ((all & (1 << k)) && rd_held[k] >= 0) rd_consumed |= 1 << k;
            rd_nhist = 0;
            rd_emit(s->move, VIA_SEQ);
            return;
        }
    }
    {
        int nowt = rd_group_t + CHORD_MS;
        for (i = 0; i < N_BIND_CHORDS; i++) {
            const Bind *c = &BIND_CHORDS[i];
            int keys = (int)c->steps[0], ok = 1, fresh = 0;
            if (!bind_open(c)) continue;
            for (k = 0; k < NBTN && ok; k++) {
                int kb = 1 << k, recent = 0, j;
                if (!(keys & kb)) continue;
                for (j = 0; j < rd_nhist; j++)
                    if (rd_hist[j].b == kb && !rd_hist[j].used && nowt - rd_hist[j].t <= SEQ_MS) recent = 1;
                {
                    int may = (kb & DIR_MASK) || ((int)c->held & kb);
                    int in_group = (rd_group_mask & kb) != 0;
                    int heldok = rd_held[k] >= 0 && !(rd_consumed & kb);
                    if (!(in_group || ((may || c->loose) && heldok) || (c->loose && recent))) ok = 0;
                }
            }
            for (k = 0; k < NBTN; k++)
                if ((keys & (1 << k)) && (rd_group_mask & (1 << k)) && !((1 << k) & DIR_MASK)) fresh = 1;
            if (ok && fresh) {
                for (k = 0; k < NBTN; k++)
                    if ((keys & (1 << k)) && rd_held[k] >= 0 && !((1 << k) & DIR_MASK)) rd_consumed |= 1 << k;
                if (c->loose) {
                    int j;
                    for (j = 0; j < rd_nhist; j++) if (keys & rd_hist[j].b) rd_hist[j].used = 1;
                }
                rd_emit(c->move, VIA_CHORD);
                return;
            }
        }
    }
    {
        int b = 0;
        const Bind *p;
        for (k = 0; k < rd_group_n; k++) if (!(rd_group_keys[k] & DIR_MASK)) b = rd_group_keys[k];
        if (b && (p = press_of(b)) != 0) rd_emit(p->move, VIA_PRESS);
    }
}
static int rd_take(Ev *out)
{
    int n = rd_nev, i;
    if (rd_group_on && now - rd_group_t > CHORD_MS) rd_resolve(now);
    for (i = 0; i < n; i++) out[i] = rd_events[i];
    rd_nev = 0;
    return n;
}
static int rd_is_down(int bit)
{
    int i = bit_index(bit);
    return i >= 0 && rd_held[i] >= 0;
}
static int rd_hold_move(void)
{
    static const int order[10] = {
        PAD_R1, PAD_R2, PAD_L1, PAD_L2, PAD_B, PAD_A, PAD_UP, PAD_DOWN, PAD_RIGHT, PAD_LEFT
    };
    int i;
    for (i = 0; i < 10; i++) {
        int bit = order[i], bi = bit_index(bit);
        const Bind *h, *tp;
        if (bi < 0 || rd_held[bi] < 0 || (rd_consumed & bit)) continue;
        h = hold_of(bit);
        if (!h) continue;
        tp = tap_of(bit);
        if (tp && now - rd_held[bi] <= TAP_MAX) continue;
        return (int)h->move;
    }
    return MV_idle;
}
static int combo_seq(const int *list, int n, int includes_last)
{
    int i;
    if (combo_n < n) return 0;
    for (i = 0; i < n; i++) if (combo_b[combo_n - n + i] != list[i]) return 0;
    for (i = 1; i < n; i++)
        if (combo_t[combo_n - n + i] - combo_t[combo_n - n + i - 1] > SEQ_MS) return 0;
    return includes_last || now - combo_t[combo_n - 1] <= SEQ_MS;
}
static void log_combo(int b)
{
    if (combo_n == 8) {
        int i;
        for (i = 1; i < 8; i++) { combo_b[i - 1] = combo_b[i]; combo_t[i - 1] = combo_t[i]; }
        combo_n--;
    }
    combo_b[combo_n] = b;
    combo_t[combo_n] = now;
    combo_n++;
}
static int meters_held(int down)
{
    return has(UL_METER_CHARGE) && (down & PAD_DOWN) && (down & PAD_L1) && (down & PAD_R1);
}
static int up_is_sky(int down)
{
    return has(UL_SKY_DASH) && ((down & PAD_DOWN) || rd_is_down(PAD_DOWN));
}
static void read_buttons(int down, int prev)
{
    static const int all[NBTN] = {
        PAD_UP, PAD_DOWN, PAD_LEFT, PAD_RIGHT, PAD_A, PAD_B, PAD_X, PAD_Y,
        PAD_L1, PAD_R1, PAD_L2, PAD_R2
    };
    int charging = meters_held(down), i;
    int edge_up = 0;
    for (i = 0; i < NBTN; i++) {
        int b = all[i];
        int on = (down & b) != 0;
        if ((b & (PAD_L1 | PAD_R1 | PAD_L2 | PAD_R2)) && !(btn_mask & b)) on = 0;
        if (charging && (b & (PAD_L1 | PAD_R1))) on = 0;
        if (on && !rd_is_down(b)) {
            rd_down(b, now);
            if (b == PAD_UP && !charging) edge_up = 1;
            if (b == PAD_A || b == PAD_B) log_combo(b);
            if (b == PAD_LEFT) face = -1;
            else if (b == PAD_RIGHT) face = 1;
        } else if (!on && rd_is_down(b)) {
            rd_up(b, now);
            if (hold_on && (hold_keys & b)) {
                int m = hold_move;
                hold_on = 0;
                request(m, VIA_RELEASE);
            }
            if (b == PAD_LEFT && (down & PAD_RIGHT)) face = 1;
            else if (b == PAD_RIGHT && (down & PAD_LEFT)) face = -1;
        }
    }
    if (edge_up) {
        static const int fly[4] = {PAD_A, PAD_B, PAD_A, PAD_B};
        if (has(UL_FLY) && combo_seq(fly, 4, 0)) { combo_n = 0; start_flight(); }
        else if (!up_is_sky(down)) request(MV_jump, VIA_PRESS);
    }
    if ((down & PAD_B) && !(prev & PAD_B) && has(UL_RAINBOW)) {
        static const int rb[6] = {PAD_A, PAD_B, PAD_A, PAD_B, PAD_A, PAD_B};
        if (combo_seq(rb, 6, 1)) { combo_n = 0; start_rainbow(); }
    }
    (void)prev;
}
static void take_events(void)
{
    Ev ev[16];
    int n = rd_take(ev), i;
    for (i = 0; i < n; i++) {
        int m = ev[i].move, v = ev[i].via;
        if ((m == MV_slash) && (v == VIA_PRESS || v == VIA_TAP) && chain_press()) continue;
        if (m == MV_parry && v == VIA_TAP && chain_burst()) continue;
        if (m == MV_ULTIMATE) { start_ult(); continue; }
        if (m == MV_SKY) m = MV_sky_dash;
        request(m, v);
    }
}

static int hold_want(int down)
{
    int w;
    if (meters_held(down) || hold_on) return MV_charge;
    w = rd_hold_move();
    if (w == MV_walk_left) { face = -1; w = MV_walk_right; }
    if (w == MV_walk_right && (down & PAD_LEFT) && !(down & PAD_RIGHT)) face = -1;
    if (w == MV_walk_right && (down & PAD_RIGHT)) face = 1;
    if (w == MV_recover && meter[1] < 1) return MV_idle;
    return w;
}
static void hold_state(int down)
{
    int want = hold_want(down);
    if (mv != want || (want == MV_walk_right && face != (down & PAD_LEFT ? -1 : face)))
        start(want, K_HOLD, VIA_PRESS, -1);
    if (want == MV_walk_right) {
        if ((down & PAD_LEFT) && !(down & PAD_RIGHT)) face = -1;
        if ((down & PAD_RIGHT) && !(down & PAD_LEFT)) face = 1;
    }
}
static void finish_action(int down)
{
    int ry = (int)mf(mv, fr)->ry;
    int rx = (int)mf(mv, fr)->rx;
    px += face * rx;
    clamp_x();
    if (ry > 8 && mv != MV_jump) {
        int g = ground_under(px, surf + ry);
        py = (surf + ry - g) << 16;
        if (py < 0) py = 0;
        pv = 0;
        surf = g;
        jumping = 1;
        dbl_used = 0;
        mv = MV_jump;
        fr = 4;
        kind = K_ACTION;
        acc = 0;
        return;
    }
    {
        int g = ground_under(px, surf + ry + 4);
        if (g > surf) surf = g;
    }
    kind = K_HOLD;
    mv = MV_idle;
    fr = 0;
    acc = 0;
    if (queued >= 0) {
        int q = queued, v = queued_via;
        queued = -1;
        if (move_open(q)) request(q, v);
        return;
    }
    hold_state(down);
}
static void advance_pose(int down)
{
    for (;;) {
        int ms = (int)mf(mv, fr)->ms;
        int n = (int)MOVES[mv].n;
        if (acc < ms) return;
        acc -= ms;
        fr++;
        if (fr < n) {
            if (kind == K_ACTION) resolve_hits();
            continue;
        }
        if (kind == K_LAND || kind == K_ACTION) {
            if (kind == K_ACTION && mv == MV_beam_cloud && rd_is_down(PAD_A) && can_pay(0, 1)) {
                int bi = -1, k;
                for (k = 0; k < n; k++) if (FRAMES[MOVES[mv].f0 + k].beam >= 0) { bi = k; break; }
                fr = bi >= 0 ? bi : 2;
                spend(0, 1);
                continue;
            }
            fr = n - 1;
            finish_action(down);
            return;
        }
        if (MOVES[mv].loop) {
            int lf = (int)MOVES[mv].loop_from;
            int last = (int)FRAMES[MOVES[mv].f0 + n - 1].rx;
            int prev = n > 1 ? (int)FRAMES[MOVES[mv].f0 + n - 2].rx : 0;
            int from = (int)FRAMES[MOVES[mv].f0 + lf].rx;
            px += face * (last + (last - prev) - from);
            clamp_x();
            fr = lf;
        } else {
            fr = n - 1;
            return;
        }
    }
}
static void step_jump(int down)
{
    int ggrav, feet, g;
    if (flight) return;
    if ((down & PAD_LEFT) && !(down & PAD_RIGHT)) { px -= 2; face = -1; }
    if ((down & PAD_RIGHT) && !(down & PAD_LEFT)) { px += 2; face = 1; }
    clamp_x();
    ggrav = iabs(pv) < V0 / 5 ? GRAV / 2 : GRAV;
    pv -= ggrav * DT;
    py += pv * DT;
    if (py > peak) peak = py;
    if (py < 0) py = 0;
    if (pv > V0 * 3 / 5) fr = 1;
    else if (pv > V0 / 5) fr = 2;
    else if (pv > -(V0 / 5)) fr = 3;
    else fr = 4;
    feet = surf + (py >> 16);
    if (pv < 0) {
        g = ground_under(px, feet);
        if (g > surf && g >= feet - 10) {
            surf = g;
            py = 0;
            pv = 0;
            jumping = 0;
            dbl_used = 0;
            peak = 0;
            mv = MV_jump;
            fr = 5;
            acc = 0;
            kind = K_LAND;
            return;
        }
    }
    if (py <= 0 && pv < 0) {
        g = ground_under(px, surf + (peak >> 16));
        if (g > surf) surf = g;
        else {
            int g2 = ground_under(px, surf + 4);
            if (g2 < surf) surf = g2;
        }
        py = 0;
        pv = 0;
        jumping = 0;
        dbl_used = 0;
        peak = 0;
        mv = MV_jump;
        fr = 5;
        acc = 0;
        kind = K_LAND;
    }
}
static void step_flight(int down)
{
    flight_left -= DT;
    if (flight_left <= 0) {
        int g = ground_under(px, fly_h);
        flight = 0;
        py = (fly_h - g) << 16;
        if (py < 0) py = 0;
        pv = 0;
        surf = g;
        jumping = 1;
        mv = MV_jump;
        fr = 4;
        kind = K_ACTION;
        return;
    }
    if (down & PAD_UP) fly_h += 2;
    if (down & PAD_DOWN) fly_h -= 2;
    if (fly_h < 8) fly_h = 8;
    if (fly_h > 150) fly_h = 150;
    if ((down & PAD_LEFT) && !(down & PAD_RIGHT)) { px -= 2; face = -1; }
    if ((down & PAD_RIGHT) && !(down & PAD_LEFT)) { px += 2; face = 1; }
    clamp_x();
    mv = MV_jump;
    fr = 3;
    kind = K_HOLD;
}
static void step_charge(int down)
{
    static int bag;
    if (!(mv == MV_charge && kind == K_HOLD) || her_stun > 0) return;
    if (meters_held(down)) return;
    if (charge_ms < FULL_CHARGE && meter_on(0) && meter[0] > 0) {
        bag += DT;
        while (bag >= 50 && charge_ms < FULL_CHARGE && meter[0] > 0) {
            bag -= 50;
            meter[0]--;
            charge_ms += 50;
        }
    }
}
static void step_meters(int down)
{
    static int mbag, hbag;
    if (meters_held(down) && mv == MV_charge && kind == K_HOLD) {
        mbag += DT;
        while (mbag >= 500) {
            mbag -= 500;
            if (meter_on(0)) spend(0, -1);
            if (meter_on(1)) spend(1, -1);
            if (meter_on(2)) spend(2, -1);
        }
    } else mbag = 0;
    if (mv == MV_recover && kind == K_HOLD && hp < maxhp && meter[1] > 0) {
        hbag += DT;
        while (hbag >= 350 && hp < maxhp && meter[1] > 0) {
            hbag -= 350;
            meter[1]--;
            hp = clampi(hp + 5, 0, maxhp);
        }
    } else hbag = 0;
}
static void pickups(void)
{
    const MapDef *m = &MAPS[map_id];
    int i, x = vis_x(), y = feet_h();
    for (i = 0; i < (int)m->nleaf && i < MAX_LEAF; i++) {
        const LeafSpot *L = &LEAVES[m->leaf0 + i];
        if (!leaf_on[i]) continue;
        if (iabs(x - L->x) < 16 && iabs(y - L->fy) < 28) {
            leaf_on[i] = 0;
            leaves++;
        }
    }
    if (!jumping && rainbow_left <= 0 && surf == 0 && in_pit(x)) die();
}
static void step_hop(void)
{
    if (hop_t <= 0) { hop_y = 0; return; }
    hop_t += DT;
    if (hop_t < 80) hop_y = hop_t * 5 / 80;
    else if (hop_t < 200) hop_y = 5 - (hop_t - 80) * 5 / 120;
    else { hop_y = 0; hop_t = 0; }
}
static void try_drop(int down)
{
    int edge = (down & PAD_DOWN) && !down_held;
    down_held = (down & PAD_DOWN) != 0;
    if (!edge) return;
    if (jumping || flight || kind == K_ACTION || surf <= 0) {
        down_at = now;
        return;
    }
    if (down_at && now - down_at < 300) {
        int below = ground_under(vis_x(), surf - 8);
        py = (surf - below) << 16;
        pv = 0;
        surf = below;
        jumping = 1;
        dbl_used = 0;
        mv = MV_jump;
        fr = 4;
        kind = K_ACTION;
        acc = 0;
        down_at = 0;
    } else down_at = now;
}
static void step_player(int down)
{
    if (her_stun > 0) {
        her_stun -= DT;
        if (slide > 1) { px += 2; slide -= 2; }
        else if (slide < -1) { px -= 2; slide += 2; }
        else slide = 0;
        clamp_x();
        if (her_stun <= 0) hold_state(down);
        return;
    }
    if (invuln > 0) invuln -= DT;
    if (rainbow_left > 0) rainbow_left -= DT;
    if (hurt_flash > 0) hurt_flash--;
    if (slide > 1) { px += 2; slide -= 2; }
    else if (slide < -1) { px -= 2; slide += 2; }
    else slide = 0;
    clamp_x();
    step_hop();
    try_drop(down);
    step_charge(down);
    step_meters(down);
    chain_tick();
    if (ult_on && !chain_qn && kind != K_ACTION && !jumping && !flight && her_stun <= 0) {
        static const int seq[5] = {MV_taunt, MV_beam_plasma, MV_beam_cloud, MV_beam_fire, MV_beam_laser};
        if (ult_i >= 5) ult_on = 0;
        else {
            int id = seq[ult_i++];
            if (id == MV_taunt || can_afford(id))
                start(id, K_ACTION, VIA_ULT, -1);
        }
    }
    if (flight) { step_flight(down); return; }
    if (jumping) { step_jump(down); return; }
    if (mv == MV_jump && kind == K_ACTION && fr == 0) {
        acc += DT;
        if (acc >= (int)mf(mv, 0)->ms) {
            if (want_crash) { want_crash = 0; air_crash(); return; }
            jumping = 1;
            py = 0;
            pv = V0;
            peak = 0;
            fr = 1;
            acc = 0;
        }
        return;
    }
    if (kind == K_HOLD) {
        int want = hold_want(down);
        int nf = face;
        if (want == MV_walk_right) {
            if ((down & PAD_LEFT) && !(down & PAD_RIGHT)) nf = -1;
            if ((down & PAD_RIGHT) && !(down & PAD_LEFT)) nf = 1;
        }
        if (want != mv || nf != face) {
            face = nf;
            start(want, K_HOLD, VIA_PRESS, -1);
        }
    }
    if (!jumping && !flight && kind == K_HOLD) {
        int x = vis_x();
        int g = ground_under(x, surf + 2);
        if (g < surf - 2) {
            py = (surf - g) << 16;
            pv = 0;
            surf = g;
            jumping = 1;
            dbl_used = 0;
            mv = MV_jump;
            fr = 4;
            kind = K_ACTION;
            return;
        }
        surf = g;
    }
    acc += DT;
    advance_pose(down);
    if (kind == K_ACTION) {
        resolve_hits();
        beam_tick();
    }
}
static void spawn_map(void)
{
    const MapDef *m = &MAPS[map_id];
    int i;
    for (i = 0; i < MAX_EN; i++) en[i].on = 0;
    for (i = 0; i < MAX_LEAF; i++) leaf_on[i] = 0;
    for (i = 0; i < MAX_CRATE; i++) crate_on[i] = 0;
    for (i = 0; i < MAX_BOMB; i++) bomb_on[i] = 0;
    for (i = 0; i < (int)m->nen && i < MAX_EN; i++) {
        const Spawn *s = &SPAWNS[m->en0 + i];
        En *e = &en[i];
        const EDef *d = &ENEMIES[s->type];
        e->on = 1;
        e->type = s->type;
        e->x = s->x;
        e->fy = s->fy;
        e->hp = e->maxhp = d->hp;
        e->path0 = s->path0;
        e->path1 = s->path1;
        e->dir = 1;
        if (s->path1 > s->x) e->dir = 1;
        else e->dir = -1;
        e->face = e->dir;
        e->state = ST_PATROL;
        e->rest = 0;
        e->stun = 0;
        e->tint = 0;
        e->taunt = 0;
        e->hop = 0;
        e->sacc = 0;
        e->seen = 0;
        e->knock_left = 0;
        e->sight = s->sight > 0 ? s->sight : 80;
        set_range(e);
        eplay(e, d->a_idle >= 0 ? d->a_idle : 0);
    }
    for (i = 0; i < (int)m->nleaf && i < MAX_LEAF; i++) leaf_on[i] = 1;
    for (i = 0; i < (int)m->ncrate && i < MAX_CRATE; i++) crate_on[i] = 1;
    for (i = 0; i < (int)m->nbomb && i < MAX_BOMB; i++) bomb_on[i] = 1;
}
static void reset_pose(void)
{
    mv = MV_idle;
    fr = 0;
    acc = 0;
    kind = K_HOLD;
    jumping = 0;
    py = pv = peak = 0;
    flight = 0;
    hold_on = 0;
    hold_move = 0;
    hold_keys = 0;
    dbl_used = 0;
    slide = 0;
    her_stun = 0;
    want_crash = 0;
    chain_n = chain_qn = 0;
    ult_on = 0;
    queued = -1;
    face = 1;
    charge_ms = 0;
    power_pct = 100;
    rd_reset();
}
static void load_map(void)
{
    if (map_id < 0) map_id = 0;
    if (map_id >= NMAPS) map_id = NMAPS - 1;
    sync_level();
    reset_pose();
    px = ANCHOR_X;
    surf = ground_under(px, 8);
    spawn_map();
    mode = MODE_PLAY;
    paused = 0;
}
static void die(void)
{
    if (mode != MODE_PLAY) return;
    mode = MODE_DEAD;
    hp = 0;
    paused = 0;
}
static void continue_dead(void)
{
    if (ankhs > 0) {
        ankhs--;
        hp = maxhp;
        load_map();
    } else {
        ankhs = 3;
        hp = maxhp;
        map_id = (int)LEVELS[level].map0;
        load_map();
    }
}
static void clear_map(void)
{
    int end = (int)LEVELS[level].map0 + (int)LEVELS[level].nmaps;
    if (map_id + 1 < end) {
        map_id++;
        load_map();
        return;
    }
    if (levels_unlocked < level + 2) levels_unlocked = level + 2;
    if (levels_unlocked > NLEVELS) levels_unlocked = NLEVELS;
    cleared |= 1u << level;
    shop_clear = 1;
    shop_next = (level + 1 >= NLEVELS) ? 1 : level + 1;
    shop_i = 0;
    mode = MODE_SHOP;
}
static int shop_ok(int i)
{
    return i >= 0 && i < UL_COUNT && (int)UNLOCKS[i].level <= levels_unlocked && !has(i);
}
static int shop_count(void)
{
    int i, n = 0;
    for (i = 0; i < UL_COUNT; i++) if (shop_ok(i)) n++;
    return n;
}
static int shop_nth(int n)
{
    int i, c = 0;
    for (i = 0; i < UL_COUNT; i++) if (shop_ok(i)) {
        if (c == n) return i;
        c++;
    }
    return -1;
}
static void shop_buy(void)
{
    int n = shop_count(), id, price;
    if (n <= 0) return;
    shop_i = clampi(shop_i, 0, n - 1);
    id = shop_nth(shop_i);
    if (id < 0) return;
    price = (int)UNLOCKS[id].price;
    if (leaves < price) return;
    leaves -= price;
    unlocked |= 1u << id;
    recompute();
}
static void shop_leave(void)
{
    if (!shop_clear) {
        mode = MODE_PLAY;
        paused = 0;
        rd_reset();
        return;
    }
    shop_clear = 0;
    if (shop_next <= 0 || shop_next >= NLEVELS) {
        mode = MODE_END;
        return;
    }
    level = shop_next;
    map_id = (int)LEVELS[level].map0;
    hp = maxhp;
    if (ankhs < 3) ankhs = 3;
    load_map();
}

static int mul_q8(int v, int q8)
{
    int neg = 0, r;
    if (v < 0) { neg = 1; v = -v; }
    r = (int)(((long)v * (long)q8 + 128L) >> 8);
    return neg ? -r : r;
}
static int wrap_mod(int a, int m)
{
    if (m <= 0) return 0;
    if (a >= 0) return a % m;
    a = -a % m;
    return a ? m - a : 0;
}
static void draw_tiled(int id, int period, int margin, int par, int bgx)
{
    int dx, x0, x;
    if (id < 0 || period <= 0) return;
    dx = -mul_q8(bgx, par);
    x0 = wrap_mod(dx, period) - period;
    for (x = x0; x < VIEW_W; x += period)
        hw_sprite(PF_X + x, PF_Y - margin, id, 0);
}
static void rect_w(int x0, int y0, int x1, int y1, u16 col)
{
    int sy0, sy1;
    if (x1 < x0) { int t = x0; x0 = x1; x1 = t; }
    if (y1 < y0) { int t = y0; y0 = y1; y1 = t; }
    sy0 = PF_Y + FEET_ROW - y1;
    sy1 = PF_Y + FEET_ROW - y0;
    hw_rect(PF_X + x0, sy0, x1 - x0, sy1 - sy0, col);
}
static void draw_world(void)
{
    const MapDef *m = &MAPS[map_id];
    const Scene *sc = &SCENES[m->scene < SC_COUNT ? m->scene : 0];
    int i, bgx, open;
    int sprid = (int)mf(mv, fr)->spr;
    bgx = ANCHOR_X + (map_id - (int)LEVELS[level].map0) * VIEW_W;
    hw_clip(PF_X, PF_Y, PF_X + VIEW_W, PF_Y + VIEW_H);
    for (i = 0; i < (int)sc->n && i < 6; i++) {
        const Layer *L = &sc->layer[i];
        draw_tiled((int)L->spr, (int)L->period, (int)L->margin, (int)L->par, bgx);
    }
    if (sc->fringe >= 0)
        draw_tiled((int)sc->fringe, (int)sc->fringe_period, VIEW_MARGIN, 256, bgx);
    for (i = 0; i < (int)m->npit; i++) {
        const Pit *p = &PITS[m->pit0 + i];
        rect_w(p->x0, -28, p->x1, 0, RGB565(8, 6, 12));
    }
    for (i = 0; i < (int)m->nplat; i++) {
        const Plat *p = &PLATS[m->plat0 + i];
        rect_w(p->x0, p->top - 6, p->x1, p->top, RGB565(122, 82, 48));
    }
    for (i = 0; i < (int)m->nleaf && i < MAX_LEAF; i++) {
        const LeafSpot *L = &LEAVES[m->leaf0 + i];
        int fid;
        if (!leaf_on[i]) continue;
        fid = (int)LEAF_SPR[((now / 80) + i) % LEAF_N];
        hw_sprite(PF_X + L->x, PF_Y + FEET_ROW - (L->fy + L->h), fid, 0);
    }
    for (i = 0; i < (int)m->ncrate && i < MAX_CRATE; i++) {
        const Crate *c = &CRATES[m->crate0 + i];
        if (!crate_on[i]) continue;
        rect_w(c->x - 10, c->fy, c->x + 10, c->fy + 18, RGB565(138, 90, 43));
    }
    for (i = 0; i < (int)m->nbomb && i < MAX_BOMB; i++) {
        const Spot *b = &BOMBS[m->bomb0 + i];
        if (!bomb_on[i]) continue;
        rect_w(b->x - 6, b->fy, b->x + 6, b->fy + 12, RGB565(40, 40, 48));
    }
    for (i = 0; i < MAX_EN; i++) {
        const EFrame *f;
        int y;
        if (!en[i].on) continue;
        f = ef(&en[i]);
        y = en[i].fy + (en[i].hop ? (en[i].hop < 4 ? en[i].hop * 6 : (8 - en[i].hop) * 6) : 0);
        if (en[i].tint > 0)
            hw_sprite_tint(PF_X + en[i].base, PF_Y + FEET_ROW - y, f->spr, en[i].face > 0, COL_RED, 160);
        else
            hw_sprite(PF_X + en[i].base, PF_Y + FEET_ROW - y, f->spr, en[i].face > 0);
    }
    if (kind == K_ACTION && mf(mv, fr)->beam >= 0) {
        int x0 = vis_x() + face * 18;
        int x1 = vis_x() + face * 120;
        u16 col = COL_BLUE;
        int b = (int)mf(mv, fr)->beam;
        if (b == 1) col = COL_RED;
        else if (b == 2) col = COL_YELLOW;
        else if (b == 3) col = RGB565(180, 80, 220);
        rect_w(x0, feet_h() + 18, x1, feet_h() + 36, col);
    }
    if (boom_t > 0) {
        rect_w(boom_x - 20, boom_y - 20, boom_x + 20, boom_y + 20, COL_YELLOW);
        boom_t--;
    }
    open = enemies_left() == 0;
    rect_w(VIEW_W - 16, 0, VIEW_W - 8, 64, open ? RGB565(40, 140, 70) : RGB565(90, 40, 40));
    {
        int wy = feet_h();
        u16 tint = 0;
        int alpha = 0, use = 0;
        if (hurt_flash > 0) { tint = COL_RED; alpha = 140; use = 1; }
        else if (rainbow_left > 0) { tint = COL_GOLD; alpha = 160; use = 1; }
        else if (mv == MV_charge && charge_ms >= FULL_CHARGE) { tint = COL_BLUE; alpha = 120; use = 1; }
        if (use)
            hw_sprite_tint(PF_X + vis_x(), PF_Y + FEET_ROW - wy, sprid, face < 0, tint, alpha);
        else
            hw_sprite(PF_X + vis_x(), PF_Y + FEET_ROW - wy, sprid, face < 0);
    }
    hw_clip(0, 0, 640, 480);
}
static void hud(int down)
{
    const MapDef *m = &MAPS[map_id];
    int bar = maxhp > 0 ? hp * 80 / maxhp : 0;
    hw_text(200, 20, "PARRYING PERRY", COL_GOLD, 2);
    hw_text(160, 48, LEVELS[level].name, COL_INK, 1);
    hw_text(360, 48, m->id, COL_GOLD, 1);
    hw_rect(PF_X - 2, PF_Y - 2, VIEW_W + 4, VIEW_H + 4, COL_GOLD);
    hw_text(48, 316, MOVES[mv].id, COL_INK, 1);
    hw_text(280, 316, "HP", COL_DIM, 1);
    hw_rect(304, 316, 80, 8, RGB565(40, 16, 16));
    if (bar > 0) hw_rect(304, 316, bar, 8, COL_GREEN);
    hw_num(392, 316, hp, COL_INK);
    hw_text(440, 316, "LV", COL_DIM, 1);
    hw_num(464, 316, leaves, COL_GOLD);
    hw_text(520, 316, "AK", COL_DIM, 1);
    hw_num(544, 316, ankhs, COL_INK);
    if (meters_on & 1) {
        hw_text(48, 332, "EN", COL_BLUE, 1);
        hw_num(72, 332, meter[0], COL_BLUE);
    }
    if (meters_on & 2) {
        hw_text(120, 332, "EM", COL_YELLOW, 1);
        hw_num(144, 332, meter[1], COL_YELLOW);
    }
    if (meters_on & 4) {
        hw_text(192, 332, "SU", RGB565(180, 80, 220), 1);
        hw_num(216, 332, meter[2], RGB565(180, 80, 220));
    }
    if (deny_t > now) hw_text(300, 332, deny_k == 2 ? "NO SUPER" : deny_k == 1 ? "NO EMPOWER" : "NO ENERGY", COL_RED, 1);
    if (gem[0] | gem[1] | gem[2] | gem[3]) {
        hw_text(400, 332, "BN", COL_DIM, 1); hw_num(424, 332, gem[0], COL_INK);
        hw_text(456, 332, "QZ", COL_DIM, 1); hw_num(480, 332, gem[1], COL_INK);
        hw_text(512, 332, "GR", COL_DIM, 1); hw_num(536, 332, gem[2], COL_INK);
        hw_text(568, 332, "DI", COL_DIM, 1); hw_num(592, 332, gem[3], COL_INK);
    }
    if (saved_t > now) hw_text(300, 332, "SAVED", COL_GREEN, 1);
    mark(48, 356, "UP", down & PAD_UP);
    mark(88, 356, "DN", down & PAD_DOWN);
    mark(128, 356, "LT", down & PAD_LEFT);
    mark(168, 356, "RT", down & PAD_RIGHT);
    mark(220, 356, "A", down & PAD_A);
    mark(252, 356, "B", down & PAD_B);
    mark(284, 356, "X", down & PAD_X);
    mark(316, 356, "Y", down & PAD_Y);
    mark(360, 356, "L1", down & PAD_L1);
    mark(400, 356, "R1", down & PAD_R1);
    mark(440, 356, "L2", down & PAD_L2);
    mark(480, 356, "R2", down & PAD_R2);
    mark(530, 356, "ST", down & PAD_START);
    if (paused) hw_text(120, 180, "PAUSED  A RESUME  B SHOP  Y SAVES", COL_GOLD, 1);
    if (mode == MODE_DEAD) hw_text(148, 180, ankhs > 0 ? "DOWN  A SPENDS AN ANKH" : "OUT OF ANKHS  A RETRIES", COL_RED, 1);
    if (mode == MODE_END) hw_text(168, 180, "END OF THE TRAIL", COL_GOLD, 1);
}
static void draw_shop(int down)
{
    int n = shop_count(), i, y = 120;
    hw_text(200, 28, "BONE MERCHANT", COL_GOLD, 2);
    hw_text(48, 64, LEVELS[level].name, COL_INK, 1);
    hw_text(48, 84, "LEAVES", COL_DIM, 1);
    hw_num(112, 84, leaves, COL_GOLD);
    hw_text(200, 84, shop_clear ? "START CONTINUES" : "START RETURNS", COL_DIM, 1);
    if (n <= 0) hw_text(48, 140, "NOTHING FOR SALE", COL_INK, 1);
    shop_i = n > 0 ? clampi(shop_i, 0, n - 1) : 0;
    for (i = 0; i < n && i < 8; i++) {
        int id = shop_nth(i);
        u16 col = i == shop_i ? COL_GOLD : COL_INK;
        if (id < 0) continue;
        hw_text(48, y, i == shop_i ? ">" : " ", col, 1);
        hw_text(64, y, UNLOCKS[id].name, col, 1);
        hw_num(480, y, (int)UNLOCKS[id].price, leaves >= (int)UNLOCKS[id].price ? COL_GREEN : COL_RED);
        y += 16;
    }
    hw_text(48, 420, "UP DOWN  A BUYS", COL_DIM, 1);
    mark(400, 420, "A", down & PAD_A);
    mark(448, 420, "ST", down & PAD_START);
    (void)down;
}

static void sim(int down, int prev)
{
    int i;
    if (mode != MODE_PLAY || paused) return;
    read_buttons(down, prev);
    take_events();
    step_player(down);
    for (i = 0; i < MAX_EN; i++) step_enemy(&en[i]);
    pickups();
    if (mode == MODE_PLAY && px >= 350 && enemies_left() == 0) clear_map();
}

void game_main(void)
{
    u16 raw_prev = 0xffff;
    hw_init();
    rng_s = 1;
    queued = -1;
    face = 1;
    mv = MV_idle;
    load_save();
    load_map();
    for (;;) {
        u16 raw = hw_pad();
        u16 down = (u16)~raw;
        u16 prev = (u16)~raw_prev;
        int pressed = down & ~prev;
        now += DT;
        if (mode == MODE_PLAY) {
            if (pressed & PAD_START) {
                paused = !paused;
                if (!paused) rd_reset();
            }
            if (paused && (pressed & PAD_Y)) save_game();
            if (paused && (pressed & PAD_B)) {
                shop_clear = 0;
                shop_i = 0;
                mode = MODE_SHOP;
                paused = 0;
            } else if (!paused) {
                sim(down, prev);
            }
        } else if (mode == MODE_SHOP) {
            int n = shop_count();
            if ((pressed & PAD_UP) && shop_i > 0) shop_i--;
            if ((pressed & PAD_DOWN) && shop_i + 1 < n) shop_i++;
            if (pressed & PAD_A) shop_buy();
            if (pressed & PAD_START) shop_leave();
        } else if (mode == MODE_DEAD) {
            if (pressed & PAD_A) continue_dead();
        } else if (mode == MODE_END) {
            if (pressed & PAD_START) {
                map_id = 0;
                level = 0;
                hp = maxhp;
                load_map();
            }
        }
        hw_clear(COL_BG);
        hw_rect(8, 8, 624, 464, COL_DIM);
        hw_rect(12, 12, 616, 456, COL_BG);
        if (mode == MODE_SHOP) draw_shop(down);
        else {
            draw_world();
            hud(down);
        }
        raw_prev = raw;
        hw_present();
    }
}
