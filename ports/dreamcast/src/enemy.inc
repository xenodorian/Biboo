/* ------------------------------------------------------------------ enemies (web/game/11_enemies.js) */
enum { S_WALK, S_IDLE, S_PATROL, S_ATTACK, S_STUN, S_DYING };
typedef struct {
    int type, state, face, anim, k, dir, on;
    float fy, jy, hp, maxhp, x, base, t, rest, dead, lo, hi, lo0, hi0, sight, pause, far, prevx, push_v, push_a, land_at, tint_until, scale, seen_t, speed_mul, dmg_mul;
    int tint_a, taunted, drop_energy, drop_empower;
    u16 tint_c;
    int shot_k, path0, path1, dive, combo_ready, melee_seen, hit_done, jump_on, jfall, jdoom;
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
    e->anim = anim; e->k = 0; e->t = 0; e->hit_done = 0; e->land_at = 0; e->shot_k = 0; e->base = e->x - ground_off(e);
}
static void turn(Enemy *e, int face) { if(face != e->face) { e->face = face; e->base = e->x - ground_off(e); } }
static int alive(const Enemy *e) { return e->on && e->state != S_DYING; }
static float espeed(const Enemy *e) { const EnemyDef *d = &ENEMIES[e->type]; return (float)d->speed * (d->boss && e->hp < e->maxhp * 0.5f ? 1.45f : 1.0f); }
static void set_tint(Enemy *e, u16 c, int a, float ms) { e->tint_c = c; e->tint_a = a; e->tint_until = ms > 1e8f ? 1e30f : now + ms; }

/* a box [x0, y0, x1, y1] in world coordinates from a frame's native-pixel box (hx0, hy0, hx1, hy1) */
static void box_of(int face, float base, float fy, float scale, const short *h, float out[4]) {
    float s = SS * scale;
    if(face < 0) { out[0] = base + h[0] * s; out[2] = base + h[2] * s; }
    else { out[0] = base - h[2] * s; out[2] = base - h[0] * s; }
    out[1] = h[1] * s + fy; out[3] = h[3] * s + fy;
}
static int hurt_of(const Enemy *e, float out[4]) {
    const EnemyFrame *f = frame_of(e);
    if(!alive(e) || f->hx1 <= f->hx0) return 0;
    box_of(e->face, e->base, e->fy + e->jy, e->scale, &f->hx0, out);
    return 1;
}
static int overlap(const float a[4], const float b[4]) { return a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3]; }

enum { G_HEALTH, G_ENERGY, G_EMPOWER, G_SUPER, G_UPHP, G_UP_ENERGY, G_UP_EMPOWER, G_UP_SUPER, G_ANKH, G_LEAF };
static void spawn_gem(float x, int kind, float fy, int val);
static void say(const char *s, float ms);
static void loot_gem(float x, int kind, float fy);
static void kill_q(Enemy *e, int quiet) {
    const EnemyDef *d = &ENEMIES[e->type];
    e->state = S_DYING; e->dead = 0; e->hp = 0;
    if(d->a_death >= 0) play(e, d->a_death);
    if(quiet) return;
    if(d->boss) {                                       /* a bunch of gems, three ankhs and a bone powder; the way on opens */
        int k, kinds[8], nk = 0, m;
        say("BOSS DEFEATED", 2600.0f);
        kinds[nk++] = G_HEALTH; kinds[nk++] = G_HEALTH; kinds[nk++] = G_HEALTH;
        if(meter_on(M_ENERGY)) { kinds[nk++] = G_ENERGY; kinds[nk++] = G_ENERGY; }
        if(meter_on(M_EMPOWER)) { kinds[nk++] = G_EMPOWER; kinds[nk++] = G_EMPOWER; }
        if(meter_on(M_SUPER)) kinds[nk++] = G_SUPER;
        for(k = 0; k < 9; k++) spawn_gem(e->x - 56.0f + (float)k * 14.0f, kinds[(int)(frand() * (float)nk) % nk], e->fy, 1);
        for(k = 0; k < 3; k++) spawn_gem(e->x - 20.0f + (float)k * 20.0f, G_ANKH, e->fy, 1);
        if(max_hp < 200.0f) spawn_gem(e->x + 62.0f, G_UPHP, e->fy, 1);
        (void)m;
    }
    if(e->drop_energy) { loot_gem(e->x - 6, G_ENERGY, e->fy); loot_gem(e->x + 6, G_ENERGY, e->fy); }          /* hit by the Empowerment Beam: 2 energy gems */
    if(e->drop_empower) { loot_gem(e->x - 6, G_EMPOWER, e->fy); loot_gem(e->x + 6, G_EMPOWER, e->fy); }      /* taunted: 2 empower gems */
    if(frand() < 0.35f) loot_gem(e->x - 3, G_HEALTH, e->fy);                                                  /* GEM_CHANCE: a health gem */
    if(frand() < 0.12f && max_hp < 200.0f) spawn_gem(e->x - 9, G_UPHP, e->fy, 1);                           /* MAXHP_CHANCE: bone powder */
    {   /* and separately one energy, empower or super gem of a meter she has unlocked */
        int pool[3], n = 0, m2;
        for(m2 = 0; m2 < 3; m2++) if(meter_on(m2)) pool[n++] = G_ENERGY + m2;
        if(n && frand() < 0.35f) loot_gem(e->x + 3, pool[(int)(frand() * (float)n) % n], e->fy);
    }
}
static void kill(Enemy *e) { kill_q(e, 0); }
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
    { float b[4]; if(hurt_of(e, b)) { floater_num((b[0] + b[2]) * 0.5f, b[3] + 4, dmg, "-", RGB(255, 43, 43)); if(!beam_tick_on) impact((b[0] + b[2]) * 0.5f, (b[1] + b[3]) * 0.5f, dmg, e->hp <= 0); } }
    if(now >= e->tint_until) set_tint(e, RGB(255, 34, 34), 140, 110.0f);        /* a short red flash */
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
            box_of(e->face, base, e->fy + e->jy, e->scale, &f->ax0, h);
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
    dt *= e->speed_mul;                 /* taunted: everything it does, walking, swinging and resting, runs 2x as fast */
    if(e->taunted && now >= e->tint_until) set_tint(e, RGB(238, 34, 34), 140, 1e9f);          /* back to red after a flash */
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
                if(e->jdoom) { kill_q(e, 1); return; }                                       /* it came down in the pit */
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
    reach = d->reach * e->scale;
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
static void fire_combo_shard(const Enemy *e, int n);
static void step_enemy(Enemy *e, float dt) {
    int free = 0, i;
    step_enemy_core(e, dt);
    if(e->state == S_ATTACK && ENEMIES[e->type].attack_combo >= 0 && e->anim == ENEMIES[e->type].attack_combo)      /* the backflip's streaks of light also leave as homing shards */
        while(e->shot_k < e->k) { e->shot_k++; fire_combo_shard(e, e->shot_k == 3 ? 0 : e->shot_k == 4 ? 1 : e->shot_k == 6 ? 2 : -1); }
    if(e->state == S_DYING || e->jump_on) return;
    if(e->fy == 0 && cur_map->npit) {
        free = e->state == S_STUN;                      /* pushed: only the walls hold it, and a pit can take it */
        if(free) for(i = 0; i < cur_map->npit; i++) { const Pit *p = &PITS[cur_map->pit0 + i]; if(e->x > p->x0 + 6 && e->x < p->x1 - 6) { kill_q(e, 1); return; } }
    }
    clamp_enemy(e, free);
}


static void taunt_all(void) {           /* bosses are immune to the taunt */
    int i;
    for(i = 0; i < MAX_ENEMIES; i++) {
        Enemy *e = &en[i];
        if(!alive(e) || ENEMIES[e->type].boss) continue;
        aggro(e, 0);
        e->taunted = 1; e->drop_empower = 1; e->speed_mul = 2; e->dmg_mul = 2;
        set_tint(e, RGB(238, 34, 34), 140, 1e9f);
    }
}
