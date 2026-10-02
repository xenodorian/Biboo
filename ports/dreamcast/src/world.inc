/* ------------------------------------------------------------------ crates, bombs, gems, leaves, shards, effects (web/game/09_maps.js, 10_hazards.js, 00_core.js) */
typedef struct { int on, kind, val, key; float x, y, fy, bob, t0; } Gem;
typedef struct { int on, from_her, streak, home, dmg; float x, y, vx, vy, t0, contact; } Shot;
typedef struct { int on; float x, y, vx, vy, t0, life; u16 c; } Particle;
typedef struct { float x, y, t0, r; } Boom;
#define MAX_GEMS_ON 64
#define MAX_SHOTS 12
#define MAX_PARTS 64
#define MAX_BOOMS 4
static Gem gems[MAX_GEMS_ON];
static Shot shots[MAX_SHOTS];
static Particle parts[MAX_PARTS];
static Boom booms[MAX_BOOMS];
static u8 crate_gone[12], bomb_gone[12];                /* kept for the level, so a replayed map has its crates and bombs gone */
static u32 leaf_got[12];
static u8 crate_broken[4], bomb_state[4]; static float bomb_fuse[4];

static void burst(float x, float y, int n, u16 c0, u16 c1, u16 c2) {
    int i, j;
    for(i = 0; i < n; i++) {
        Particle *q = 0;
        for(j = 0; j < MAX_PARTS; j++) if(!parts[j].on) { q = &parts[j]; break; }
        if(!q) return;
        q->on = 1; q->x = x; q->y = y; q->vx = (frand() - 0.5f) * 0.22f; q->vy = 0.04f + frand() * 0.16f; q->t0 = now; q->life = 500.0f + frand() * 300.0f;
        q->c = (i % 3 == 0) ? c0 : (i % 3 == 1) ? c1 : c2;
    }
}
static void spawn_gem(float x, int kind, float fy, int val) {
    int i;
    for(i = 0; i < MAX_GEMS_ON; i++) if(!gems[i].on) {
        Gem *g = &gems[i];
        g->on = 1; g->kind = kind; g->val = val; g->key = -1; g->x = x; g->fy = fy; g->y = fy + 14.0f + frand() * 8.0f; g->bob = frand() * 6.28f; g->t0 = now;
        return;
    }
}
static void ring_boom(float x, float y, float r) {
    int j;
    for(j = 0; j < MAX_BOOMS; j++) if(booms[j].r == 0 || now - booms[j].t0 > 650.0f) { booms[j].x = x; booms[j].y = y; booms[j].t0 = now; booms[j].r = r; return; }
}
static int gem_useful(int kind) {                       /* a drop is never redundant: none for a meter she has not unlocked or a full bag; level 1 drops only health */
    if(level_idx == 0 && kind != G_HEALTH) return 0;
    if(kind == G_HEALTH) return gem_bag[0] < MAX_GEM_BAG;
    return meter_on(kind - G_ENERGY) && gem_bag[kind] < MAX_GEM_BAG;
}
static void loot_gem(float x, int kind, float fy) { if(gem_useful(kind)) spawn_gem(x, kind, fy, 1); }
static int loot_pool(int *pool) {                        /* what a crate can drop */
    int n = 0, m;
    if(gem_useful(G_HEALTH)) { pool[n++] = G_HEALTH; pool[n++] = G_HEALTH; pool[n++] = G_HEALTH; }
    if(max_hp < 200.0f) pool[n++] = G_UPHP;
    for(m = 0; m < 3; m++) {
        if(!meter_on(m) || level_idx == 0) continue;
        if(gem_useful(G_ENERGY + m)) pool[n++] = G_ENERGY + m;
        if(meter_max[m] < 200.0f) { pool[n++] = G_UP_ENERGY + m; pool[n++] = G_UP_ENERGY + m; }
    }
    return n;
}
static float dist_box2(float px, float py, const float b[4]);
static void crate_box(int i, float b[4]) { const Crate *c = &CRATES[cur_map->crate0 + i]; b[0] = c->x - 9.0f; b[1] = c->fy; b[2] = c->x + 9.0f; b[3] = c->fy + 18.0f; }
static void bomb_box(int i, float b[4]) { const Spot *c = &BOMBS[cur_map->bomb0 + i]; b[0] = c->x - 8.0f; b[1] = c->fy; b[2] = c->x + 8.0f; b[3] = c->fy + 22.0f; }
static void break_crate(int i) {
    const Crate *c = &CRATES[cur_map->crate0 + i];
    int pool, pick;
    if(crate_broken[i]) return;
    crate_broken[i] = 1; crate_gone[map_idx] |= (u8)(1 << i);
    burst((float)c->x, c->fy + 9.0f, 9, RGB(138, 90, 43), RGB(107, 68, 32), RGB(176, 122, 60));
    if(c->loot < 0) spawn_gem((float)c->x, G_ANKH, (float)c->fy, 1);
    else if(c->loot > 0) {                                           /* a cache: a shower of leaves, the big ones worth 5 */
        int n = c->loot, big = n / 5, small = n - big * 5, k, total = big + small;
        for(k = 0; k < total; k++) {
            int side = (k % 2 ? 1 : -1) * (6 + (k / 2) * 6);
            if(side > 60) side = 60; else if(side < -60) side = -60;
            spawn_gem((float)(c->x + side), G_LEAF, (float)c->fy, k < big ? 5 : 1);
            { Gem *g = &gems[0]; int j; for(j = MAX_GEMS_ON - 1; j >= 0; j--) if(gems[j].on && gems[j].kind == G_LEAF) { g = &gems[j]; break; } g->y = c->fy + 14.0f + (float)(k % 3) * 7.0f; }
        }
        burst((float)c->x, c->fy + 14.0f, 14, RGB(255, 210, 74), RGB(255, 242, 160), RGB(201, 150, 42));
    }
    {                                                                /* every crate drops something useful: a health gem, a meter gem, or a +25 upgrade */
        int pl[16];
        pool = loot_pool(pl);
        if(pool) { pick = (int)(frand() * (float)pool) % pool; spawn_gem((float)c->x, pl[pick], (float)c->fy, 1); }
    }
}
static void detonate(int i);
static void crate_blast(float wx, float wy, float r) {
    int i;
    for(i = 0; i < cur_map->ncrate; i++) { float b[4]; if(crate_broken[i]) continue; crate_box(i, b); if(dist_box2(wx, wy, b) <= r * r) break_crate(i); }
    for(i = 0; i < cur_map->nbomb; i++) { float b[4]; if(bomb_state[i] == 1) continue; bomb_box(i, b); if(dist_box2(wx, wy, b) <= r * r) detonate(i); }
}
#define BOMB_DMG 50.0f
#define BOMB_R 50.0f
static void detonate(int i) {
    const Spot *b = &BOMBS[cur_map->bomb0 + i];
    float cx = (float)b->x, cy = b->fy + 7.0f, me[4];
    int j;
    if(bomb_state[i] == 1) return;
    bomb_state[i] = 1; bomb_gone[map_idx] |= (u8)(1 << i);
    for(j = 0; j < MAX_BOOMS; j++) if(booms[j].r == 0) { booms[j].x = cx; booms[j].y = cy; booms[j].t0 = now; booms[j].r = BOMB_R; break; }
    burst(cx, cy, 14, RGB(255, 208, 96), RGB(255, 106, 32), RGB(68, 68, 68));
    for(j = 0; j < MAX_ENEMIES; j++) { float hb[4]; if(alive(&en[j]) && hurt_of(&en[j], hb) && dist_box2(cx, cy, hb) <= BOMB_R * BOMB_R) hurt_enemy(&en[j], (int)BOMB_DMG); }
    her_box(me);
    if(dist_box2(cx, cy, me) <= BOMB_R * BOMB_R && !rainbow_on()) { hurt_her(BOMB_DMG); her_hit_fx(); her_tint_set(RGB(255, 43, 43), 153, 300.0f); invuln = maxf_(invuln, now + 500.0f); }
    shake_for(300.0f, 4.0f);
    crate_blast(cx, cy, BOMB_R);
    for(j = 0; j < cur_map->nbomb; j++) {                           /* other bombs in range go off a moment later */
        const Spot *o = &BOMBS[cur_map->bomb0 + j];
        float dx = (float)(o->x - b->x), dy = (float)(o->fy - b->fy);
        if(bomb_state[j] != 1 && bomb_fuse[j] == 0 && dx * dx + dy * dy <= BOMB_R * BOMB_R) bomb_fuse[j] = now + 180.0f;
    }
}
static void step_bombs(void) {
    float me[4];
    int i;
    her_box(me);
    for(i = 0; i < cur_map->nbomb; i++) {
        float b[4];
        if(bomb_state[i] == 1) continue;
        if(bomb_fuse[i] != 0 && now >= bomb_fuse[i]) { detonate(i); continue; }
        bomb_box(i, b);
        if(overlap(me, b)) detonate(i);
    }
}
static void world_hit_shape(const Hit *h, float px, float py, int face) {      /* her blade, kick or shard against crates and bombs */
    int i;
    for(i = 0; i < cur_map->ncrate; i++) { float b[4]; if(crate_broken[i]) continue; crate_box(i, b); if(touches(h, px, py, face, b)) break_crate(i); }
    for(i = 0; i < cur_map->nbomb; i++) { float b[4]; if(bomb_state[i] == 1) continue; bomb_box(i, b); if(touches(h, px, py, face, b)) detonate(i); }
}
static void smash_crates_under(float prev, float feet, const float sp[2]) {     /* coming down onto a crate smashes it */
    int i;
    for(i = 0; i < cur_map->ncrate; i++) {
        float b[4];
        if(crate_broken[i]) continue;
        crate_box(i, b);
        if(sp[1] >= b[0] && sp[0] <= b[2] && prev > b[3] - 2 && feet <= b[3] + 1) break_crate(i);
    }
}

static float fsin(float a) {                                    /* sine to about 0.001: wrap to -pi..pi, then Bhaskara's parabola */
    float x = a - 6.2831853f * (float)(int)(a / 6.2831853f), y;
    if(x > 3.1415927f) x -= 6.2831853f; else if(x < -3.1415927f) x += 6.2831853f;
    y = x < 0 ? 1.2732395f * x + 0.4052847f * x * x : 1.2732395f * x - 0.4052847f * x * x;
    return 0.225f * (y * (y < 0 ? -y : y) - y) + y;
}
static void step_gems(float dt) {
    int i;
    float bx = player_x() + (float)her_face() * 32.0f, hy = her_y();
    for(i = 0; i < MAX_GEMS_ON; i++) {
        Gem *g = &gems[i];
        if(!g->on) continue;
        g->bob += dt * 0.006f;
        if(g->kind != G_ANKH && g->kind != G_LEAF && now - g->t0 > 20000.0f) { g->on = 0; continue; }       /* GEM_LIFE */
        if(fabsf_(g->x - bx) < 28.0f && hy < g->fy + 50.0f && hy > g->fy - 20.0f) {
            static const char *LABEL[4] = {"+BONE", "+QUARTZ", "+GARNET", "+DIAMOND"};
            static const u16 COL[4] = {RGB(61, 220, 95), RGB(68, 170, 255), RGB(255, 170, 68), RGB(204, 102, 255)};
            int taken = 1;
            if(g->kind == G_LEAF) { leaves += g->val; floater_num(g->x, g->y + 20, g->val, "+", RGB(255, 210, 74)); if(g->key >= 0) leaf_got[map_idx] |= 1u << g->key; }
            else if(g->kind == G_ANKH) { ankhs++; floater(g->x, g->y + 24, "+1 ANKH", RGB(255, 210, 74)); }
            else if(g->kind == G_UPHP) {                        /* +25 Max HP: the cap and the current health both grow by 25 */
                if(max_hp < 200.0f) { max_hp += 25.0f; hp = minf_(max_hp, hp + 25.0f); floater(g->x, g->y + 24, "+25 MAX HP", COL[0]); } else floater(g->x, g->y + 24, "HP AT LIMIT", COL[0]);
            } else if(g->kind >= G_UP_ENERGY) {                 /* a meter upgrade: applied at once, the meter grows by 25 and fills by 25 */
                int m = g->kind - G_UP_ENERGY;
                if(meter_max[m] < 200.0f) { meter_max[m] += 25.0f; spend(m, -25.0f); meter_flash[m] = now + 600.0f; floater(g->x, g->y + 24, "+25 MAX", COL[m + 1]); } else floater(g->x, g->y + 24, "AT LIMIT", COL[m + 1]);
            } else if(gem_bag[g->kind] < MAX_GEM_BAG) { gem_bag[g->kind]++; floater(g->x, g->y + 24, LABEL[g->kind], COL[g->kind]); }
            else taken = 0;                                     /* the bag is full: it stays */
            if(taken) g->on = 0;
        }
    }
}
static void step_parts(float dt) {
    int i;
    for(i = 0; i < MAX_PARTS; i++) {
        Particle *q = &parts[i];
        if(!q->on) continue;
        if(now - q->t0 > q->life) { q->on = 0; continue; }
        q->x += q->vx * dt; q->y += q->vy * dt; q->vy -= 0.0007f * dt;
    }
}

/* the goblin's backflip leaves three streak shards: each flies up and away at first, then after 500 ms curves toward her (web/game/10_hazards.js) */
#define SHOT_SPEED 0.24f
#define SHOT_DMG 20
#define HOME_SPEED 0.17f
#define HOME_DELAY 500.0f
#define HOME_TURN 0.0035f
#define PARRY_EARLY 450.0f
#define PARRY_LATE 200.0f
static void fire_combo_shard(const Enemy *e, int n) {
    static const float C[3] = {0.8829f, 0.6691f, 0.3090f}, S[3] = {0.4695f, 0.7431f, 0.9511f};      /* cos and sin of 28, 48 and 72 degrees */
    int i;
    if(n < 0) return;
    for(i = 0; i < MAX_SHOTS; i++) if(!shots[i].on) {
        Shot *sh = &shots[i];
        sh->on = 1; sh->from_her = 0; sh->streak = 1; sh->home = 1; sh->dmg = 10; sh->contact = 0; sh->t0 = now;
        sh->x = e->x + e->face * 10.0f; sh->y = e->fy + 44.0f; sh->vx = e->face * C[n] * 0.2f; sh->vy = S[n] * 0.2f;
        return;
    }
}
static void step_shots(float dt) {
    int i, j;
    float me[4];
    her_box(me);
    for(i = 0; i < MAX_SHOTS; i++) {
        Shot *sh = &shots[i];
        float box[4];
        if(!sh->on) continue;
        if(sh->home && !sh->from_her && now - sh->t0 > HOME_DELAY && sh->contact == 0) {            /* curve toward her body */
            float tx = her_mid_x() - sh->x, ty = her_y() + her_top() * SS * 0.5f - sh->y, vl = __builtin_sqrtf(sh->vx * sh->vx + sh->vy * sh->vy), tl = __builtin_sqrtf(tx * tx + ty * ty);
            if(vl > 0 && tl > 0) {
                float c = (sh->vx * tx + sh->vy * ty) / (vl * tl), sn = (sh->vx * ty - sh->vy * tx) / (vl * tl), mt = HOME_TURN * dt, a, ca, sa, nx, ny;
                a = (c < 0 || fabsf_(sn) > mt) ? signf_(sn) * mt : sn;
                ca = 1.0f - a * a * 0.5f; sa = a - a * a * a / 6.0f;
                nx = (ca * sh->vx - sa * sh->vy) / vl; ny = (sa * sh->vx + ca * sh->vy) / vl;
                sh->vx = nx * HOME_SPEED; sh->vy = ny * HOME_SPEED;
            }
        }
        if(sh->contact == 0) { sh->x += sh->vx * dt; sh->y += sh->vy * dt; }          /* a shard that reached her holds still while she can parry */
        if(now - sh->t0 > (sh->home ? 7000.0f : 4000.0f) || sh->x < -30 || sh->x > VIEW_W + 30 || sh->y < -4 || sh->y > 400) { sh->on = 0; continue; }
        box[0] = sh->x - 5; box[1] = sh->y - 5; box[2] = sh->x + 5; box[3] = sh->y + 5;
        if(!sh->from_her) {
            float dir = sh->vx >= 0 ? 1.0f : -1.0f;
            int reflect;
            if(!overlap(box, me)) { sh->contact = 0; continue; }
            if(sh->contact == 0) sh->contact = now;
            reflect = parrying() || last_parry_t >= sh->contact - PARRY_EARLY;
            if(!reflect && !blocking() && now - sh->contact < PARRY_LATE) continue;       /* wait out the late-parry window */
            if(reflect) {                                       /* reflected: straight forward, a little faster */
                sh->from_her = 1; sh->home = 0; sh->streak = 0; sh->contact = 0; sh->vx = (float)her_face() * SHOT_SPEED * 1.5f; sh->vy = 0;
                sh->x = player_x() + (float)her_face() * 22.0f; sh->t0 = now;
            } else if(blocking()) {                             /* blocked: no damage, a small slide back */
                slide_v = 2.0f * 8.0f / 120.0f * dir; slide_a = 2.0f * 8.0f / (120.0f * 120.0f); sh->on = 0;
            } else if(now >= invuln && !stun_on) {              /* a hit: damage, a small flinch */
                hurt_her((float)sh->dmg); her_tint_set(RGB(255, 43, 43), 153, 220.0f); her_hit_fx(); slide_v = 2.0f * 14.0f / 180.0f * dir; slide_a = 2.0f * 14.0f / (180.0f * 180.0f);
                invuln = now + 500.0f; sh->on = 0;
            }
        } else {
            int hit = 0;
            for(j = 0; j < MAX_ENEMIES && !hit; j++) { float hb[4]; if(hurt_of(&en[j], hb) && overlap(box, hb)) { hurt_enemy(&en[j], SHOT_DMG); hit = 1; } }
            for(j = 0; j < cur_map->ncrate && !hit; j++) { float b[4]; if(crate_broken[j]) continue; crate_box(j, b); if(overlap(box, b)) { break_crate(j); hit = 1; } }
            for(j = 0; j < cur_map->nbomb && !hit; j++) { float b[4]; if(bomb_state[j] == 1) continue; bomb_box(j, b); if(overlap(box, b)) { detonate(j); hit = 1; } }
            if(hit) { burst(sh->x, sh->y, 8, RGB(255, 255, 255), RGB(143, 208, 255), RGB(143, 208, 255)); sh->on = 0; }
        }
    }
}

