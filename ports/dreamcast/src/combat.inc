/* ------------------------------------------------------------------ hits: hers on them (web/game/12_hits.js, 08_beams.js, 05_health.js) */
static int dmg_of_cur(void) {
    float p = cur.power > 0 ? cur.power : 1.0f;
    int v;
    switch(cur.id) {
    case MV_heavy: return 200;
    case MV_jump_crash: return 300;
    case MV_slash: v = 25; break; case MV_heavy_horizontal: v = 50; break; case MV_thrust: case MV_upswing: v = 15; break; case MV_push_kick: v = 10; break;
    case MV_heavy_kick: v = 25; break; case MV_energy_kick: v = 30; break; case MV_energy_burst: v = 50; break;
    case MV_dash_thrust: v = 25; break; case MV_energy_dash_thrust: v = 50; break; case MV_spin_attack: v = 20; break;
    case MV_energy_wave: return 0; case MV_earthquake: v = 250; break; case MV_meteor_shower: v = 200; break;
    case MV_chain2: v = 15; break; case MV_chain3: v = 18; break; case MV_chain4: v = 22; break;
    default: v = 15; break;                                              /* 0 is a real value (the wave hurts only by its blast); anything unlisted is 15 */
    }
    return (int)((float)v * p + 0.5f);
}
static int knock_of(int id, float *dist, float *ms) {                    /* the moves that push an enemy: distance px, duration ms */
    switch(id) {
    case MV_heavy: case MV_slash: *dist = 25; *ms = 100; return 1;
    case MV_heavy_horizontal: *dist = 50; *ms = 100; return 1;
    case MV_push_kick: *dist = 100; *ms = 200; return 1;
    case MV_energy_kick: *dist = 200; *ms = 300; return 1;
    case MV_energy_burst: *dist = 100; *ms = 500; return 1;
    default: return 0;
    }
}
static float dist_box2(float px, float py, const float b[4]) {      /* squared distance from a point to a box */
    float dx = maxf_(maxf_(b[0] - px, 0), px - b[2]), dy = maxf_(maxf_(b[1] - py, 0), py - b[3]);
    return dx * dx + dy * dy;
}
/* a hit shape (sheet px from her anchor) against a box; effect moves draw Max at SPRITE_SCALE and their effects at fx_scale, and their shapes follow the effects */
static int touches(const Hit *h, float px, float py, int face, const float box[4]) {
    float f = (float)face, sc = MOVES[cur.id].fx_scale, ax = px + f * h->ax * sc, ay = py + h->ay * sc;
    if(h->shape == 1) { float r = h->r * (cur.id == MV_energy_burst ? 1.0f : sc); return dist_box2(ax, ay, box) <= r * r; }
    if(h->shape == 2) {
        float bx = px + f * h->bx * sc, by = py + h->by * sc, x0 = minf_(ax, bx), x1 = maxf_(ax, bx), y0 = minf_(ay, by), y1 = maxf_(ay, by);
        return x0 <= box[2] && box[0] <= x1 && y0 <= box[3] && box[1] <= y1;
    } else {
        float bx = px + f * h->bx * sc, by = py + h->by * sc, r2 = h->r * sc * h->r * sc;
        int i;
        for(i = 0; i <= 16; i++) {
            float u = (float)i / 16.0f;
            if(dist_box2(ax + (bx - ax) * u, ay + (by - ay) * u, box) <= r2) return 1;
        }
        return 0;
    }
}
static void world_hit_shape(const Hit *h, float px, float py, int face);
static void crate_blast(float wx, float wy, float r);
static void spawn_gem(float x, int kind, float fy, int val);
static void loot_gem(float x, int kind, float fy);
static void ring_boom(float x, float y, float r);
static u8 crate_broken[4], bomb_state[4];
static void crate_box(int i, float b[4]); static void bomb_box(int i, float b[4]); static void break_crate(int i); static void detonate(int i);

static void wave_blast(int side, float wx, float wy) {                    /* the wave explodes where it touches: the blast hurts every enemy in 75 px */
    int i, si = side > 0 ? 1 : 0;
    if(cur.blast[si]) return;
    cur.blast[si] = 1;
    ring_boom(wx, wy, 75.0f); crate_blast(wx, wy, 75.0f); rumble_set(350.0f, 5.0f);
    for(i = 0; i < MAX_ENEMIES; i++) { float b[4]; if(alive(&en[i]) && hurt_of(&en[i], b) && dist_box2(wx, wy, b) <= 75.0f * 75.0f) hurt_enemy(&en[i], (int)(50.0f * (cur.power > 0 ? cur.power : 1.0f) + 0.5f)); }
    if(training_on) { float b[4]; bag_box(b); if(dist_box2(wx, wy, b) <= 75.0f * 75.0f) bag_hit((int)(50.0f * (cur.power > 0 ? cur.power : 1.0f) + 0.5f), (b[0] + b[2]) * 0.5f, (b[1] + b[3]) * 0.5f, 0); }
}
static void resolve_hits_one(const MoveFrame *f, float px, float py, int face) {
    int s, i;
    float gap = cur.id == MV_earthquake ? 250.0f : cur.id == MV_meteor_shower ? 300.0f : 0;
    if(cur.id == MV_energy_wave && cur.blast[face > 0 ? 1 : 0]) return;      /* that projectile has burst */
    for(s = 0; s < f->nhit; s++) {
        const Hit *h = &HITS[f->hit0 + s];
        world_hit_shape(h, px, py, face);                                    /* any crate or bomb the shape touches */
        for(i = 0; i < MAX_ENEMIES; i++) {
            Enemy *e = &en[i];
            float box[4], dist, ms;
            int dmg;
            if(!e->on || !hurt_of(e, box) || !touches(h, px, py, face, box)) continue;
            if(e->seen == cur.serial && !(gap > 0 && now - e->seen_t >= gap)) continue;
            e->seen = cur.serial; e->seen_t = now;
            dmg = dmg_of_cur();
            hurt_enemy(e, dmg);
            if(knock_of(cur.id, &dist, &ms) && alive(e)) {   /* knocked back and stunned */
                float dir = cur.id == MV_energy_burst ? (e->x >= px ? 1.0f : -1.0f) : (float)face;   /* the burst sends it away from her on either side */
                e->state = S_STUN; play(e, ENEMIES[e->type].a_stun);
                e->push_v = 2.0f * dist / ms * dir; e->push_a = 2.0f * dist / (ms * ms);
            }
            if(cur.id == MV_energy_wave) { float b2[4]; if(!hurt_of(e, b2)) { b2[0] = b2[2] = e->x; b2[1] = b2[3] = 20; } wave_blast(face, (b2[0] + b2[2]) * 0.5f, (b2[1] + b2[3]) * 0.5f); }
        }
        if(training_on) {
            float box[4];
            bag_box(box);
            if(touches(h, px, py, face, box) && !(bag_seen == cur.serial && !(gap > 0 && now - bag_seen_t >= gap))) {
                bag_seen = cur.serial; bag_seen_t = now;
                bag_hit(dmg_of_cur(), (box[0] + box[2]) * 0.5f, (box[1] + box[3]) * 0.5f, 0);
            }
        }
    }
    if(cur.id == MV_heavy && f->name[0] == 'i' && frame_named(MV_heavy, "impact") == cur.k && !cur.aoe_done && f->nhit) {   /* the chop lands: a blast where the blade meets the ground */
        const Hit *h = &HITS[f->hit0];
        float cx = px + (float)face * h->bx * SS, cy = maxf_(0, py + h->by * SS);
        cur.aoe_done = 1;
        ring_boom(cx, cy, 25.0f); crate_blast(cx, cy, 25.0f);
        for(i = 0; i < MAX_ENEMIES; i++) {
            Enemy *o = &en[i];
            float b[4], dist, ms;
            if(!alive(o) || o->seen == cur.serial) continue;                 /* a direct hit already took 200 */
            if(!hurt_of(o, b) || dist_box2(cx, cy, b) > 25.0f * 25.0f) continue;
            hurt_enemy(o, 150);
            if(alive(o)) { knock_of(MV_heavy, &dist, &ms); o->state = S_STUN; play(o, ENEMIES[o->type].a_stun); o->push_v = 2.0f * dist / ms * (float)face; o->push_a = 2.0f * dist / (ms * ms); }
        }
    }
}
static void hit_queue_now(void) {                                            /* the frame on screen hits now (web queueHit + resolveHits) */
    const MoveFrame *f;
    float rx, ry;
    if(!has_cur || cur.kind != K_ACTION || stun_on) return;
    f = mf(cur.id, cur.k);
    root_of(&cur, cur.k, &rx, &ry);
    if(cur.id == MV_energy_wave && f->name[0] == 'p') {                     /* a projectile that touched nothing bursts at the end of its flight */
        if(frame_named(MV_energy_wave, "plow") == cur.k) { wave_blast(cur.face, X + rx + (float)cur.face * 200.0f, 20.0f); wave_blast(-cur.face, X + rx - (float)cur.face * 200.0f, 20.0f); }
    }
    if(!f->nhit) return;
    resolve_hits_one(f, X + rx, ry + floor_y, cur.face);
    if(cur.id == MV_spin_attack || cur.id == MV_energy_wave) resolve_hits_one(f, X + rx, ry + floor_y, -cur.face);       /* the spin also cuts behind her */
}
static void resolve_hits(void) { hit_queue_now(); }

/* ---- beams: a scrolling texture from the blade tip that hurts what it touches every 100 ms */
#define BEAM_TICK 100.0f
#define BEAM_GROW 8.0f
#define BEAM_CORE 0.7f
typedef struct { int kind, face, last; float ox, oy, len, el, box[4]; } BeamNow;
static int beam_now(BeamNow *b) {
    int k0, k;
    float el, rx, ry;
    const MoveFrame *f;
    if(!has_cur || cur.kind != K_ACTION || cur.beam_cut) return 0;
    f = mf(cur.id, cur.k);
    if(f->beam < 0) return 0;
    k0 = cur.k; while(k0 > 0 && mf(cur.id, k0 - 1)->beam >= 0) k0--;
    el = cur.t; for(k = k0; k < cur.k; k++) el += (float)mf(cur.id, k)->ms;
    root_of(&cur, cur.k, &rx, &ry);
    b->kind = f->beam; b->face = cur.face; b->el = el;
    b->len = minf_(BEAM_LEN, 40.0f + el * BEAM_GROW);
    b->ox = X + rx + (float)cur.face * 58.0f * SS; b->oy = ry + floor_y + 48.0f * SS;
    b->last = cur.k + 1 >= nframes(cur.id) || mf(cur.id, cur.k + 1)->beam < 0;
    { float hh = (float)BEAMS[b->kind].h * BEAM_CORE * 0.5f; b->box[0] = minf_(b->ox, b->ox + (float)cur.face * b->len); b->box[2] = maxf_(b->ox, b->ox + (float)cur.face * b->len); b->box[1] = b->oy - hh; b->box[3] = b->oy + hh; }
    return 1;
}
static void beam_hits(void) {
    static const float BEAM_COST[4] = {1, 3, 5, 5};
    static const int BEAM_DMG[4] = {5, 15, 15, 0};
    static const float BEAM_PUSH[4] = {0, 5, 20, 30};
    BeamNow b;
    int i, k;
    float cost;
    if(!beam_now(&b)) { if(has_cur) cur.beam_t = 0; return; }
    if(now < cur.beam_t) return;
    cur.beam_t = now + BEAM_TICK;
    k = b.kind == 3 ? M_EMPOWER : M_ENERGY; cost = BEAM_COST[b.kind];
    if(meter[k] < cost) {                                                    /* the meter ran dry: the beam stops and she recovers */
        int j = cur.k;
        cur.beam_cut = 1; meter_flash[k] = now + 500.0f;
        while(j < nframes(cur.id) && mf(cur.id, j)->beam >= 0) j++;
        cur.k = j < nframes(cur.id) - 1 ? j : nframes(cur.id) - 1; cur.t = 0;
        return;
    }
    spend(k, cost);                                                          /* every tick costs, whether or not it hits */
    for(i = 0; i < MAX_ENEMIES; i++) {
        Enemy *e = &en[i];
        float box[4];
        int was;
        if(!hurt_of(e, box) || !overlap(box, b.box)) continue;
        if(b.kind == 3 && ENEMIES[e->type].boss) continue;                   /* bosses are immune to the Empowerment Beam */
        if(b.kind == 3) { e->scale = maxf_(e->scale, 1.6f); e->drop_energy = 1; set_tint(e, RGB(170, 0, 255), 100, 400.0f); }
        was = alive(e);
        beam_tick_on = 1; hurt_enemy(e, BEAM_DMG[b.kind]); beam_tick_on = 0;
        if(was && !alive(e)) loot_gem(e->x, G_SUPER, e->fy);                 /* killed by a beam: a Super Gem */
        if(BEAM_PUSH[b.kind] != 0 && alive(e)) { e->x += (float)b.face * BEAM_PUSH[b.kind]; e->base += (float)b.face * BEAM_PUSH[b.kind]; }
    }
    if(training_on) { float box[4]; bag_box(box); if(overlap(box, b.box)) bag_hit(BEAM_DMG[b.kind], (box[0] + box[2]) * 0.5f, (box[1] + box[3]) * 0.5f, 1); }
    for(i = 0; i < cur_map->ncrate; i++) { float cb[4]; if(crate_broken[i]) continue; crate_box(i, cb); if(overlap(cb, b.box)) break_crate(i); }
    for(i = 0; i < cur_map->nbomb; i++) { float bb[4]; if(bomb_state[i] == 1) continue; bomb_box(i, bb); if(overlap(bb, b.box)) detonate(i); }
}

/* ------------------------------------------------------------------ hits: theirs on her (web/game/13_enemy_attacks.js) */
static void parried(Enemy *e) {
    float d = 100.0f, ms = 400.0f;
    e->hit_done = 1;
    hurt_enemy(e, 10);                                  /* a parried melee attacker takes 10 */
    if(!alive(e)) return;
    e->state = S_STUN; play(e, ENEMIES[e->type].a_stun);
    e->push_v = 2.0f * d / ms * (e->x >= her_mid_x() ? 1.0f : -1.0f); e->push_a = 2.0f * d / (ms * ms);
    set_tint(e, RGB(255, 255, 255), 190, ms);                                       /* white while it is stunned */
    flash_at((her_body_x() + e->x) * 0.5f, her_feet_y() + 24.0f, 240.0f, 22.0f, RGB(191, 232, 255)); hit_stop(90.0f); screen_flash_set(RGB(255, 255, 255), 77, 110.0f);
}
static void blocked_hit(const Enemy *e) {
    float dir = her_mid_x() >= e->x ? 1.0f : -1.0f;
    slide_v = 2.0f * 8.0f / 120.0f * dir; slide_a = 2.0f * 8.0f / (120.0f * 120.0f);
    her_tint_set(RGB(255, 255, 255), 190, 150.0f);
    flash_at(her_body_x() + (float)her_face() * 12.0f, her_feet_y() + 22.0f, 160.0f, 12.0f, RGB(255, 255, 255)); hit_stop(40.0f);
}
static void ko_check(void);
static void hurt_her(float dmg) { if(dmg > 0 && !rainbow_on()) hp = maxf_(0, hp - dmg); }
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
    hurt_her(dmg * e->dmg_mul);
    her_tint_set(RGB(255, 43, 43), 153, kms); her_hit_fx();
    floater_num(her_x_for_float(), her_y_for_float() - 70.0f, (int)(dmg * e->dmg_mul), "-", RGB(255, 43, 43));
    if(hp <= 0) ko_until = now + KO_MS;
}
static void enemy_attacks(void) {
    float me[4];
    int i, j;
    her_box(me);
    for(i = 0; i < MAX_ENEMIES; i++) {
        Enemy *e = &en[i];
        const EnemyAnim *A;
        float h[4];
        if(!e->on || e->state != S_ATTACK || e->hit_done) {
            if(e->on && e->strike_fr >= 0) goto hog_tick;
            continue;
        }
        if(e->strike_fr >= 0) hog_tick: {
            const EnemyFrame *sf = &ENEMY_FRAMES[e->strike_fr];
            e->strike_fr = -1;
            if(sf->has_hit) {
                box_of(e->face, e->base, e->fy + e->jy, e->scale, &sf->ax0, h);
                if(overlap(h, me)) {
                    if(parrying()) parried(e);
                    else if(blocking()) blocked_hit(e);
                    else if(now >= invuln && !stun_on) knocked(e);
                }
            }
            if(!e->on || e->state != S_ATTACK || e->hit_done) continue;
        }
        if(frame_of(e)->open) {
            const EnemyFrame *f = frame_of(e);
            if(parrying() && f->has_hit) { box_of(e->face, e->base, e->fy + e->jy, e->scale, &f->ax0, h); if(overlap(h, me)) parried(e); }
            continue;
        }
        if(parrying() && e->land_at > 0) { parried(e); continue; }
        A = anim_of(e);
        if(parrying()) {                /* the attack lands this frame or within the next two */
            int soon = 0;
            for(j = e->k; j <= e->k + 2 && j < A->n && !soon; j++) {
                const EnemyFrame *f = &ENEMY_FRAMES[ENEMY_ANIM_FRAME_LIST[A->list0 + j]];
                if(f->has_hit) { box_of(e->face, e->base, e->fy + e->jy, e->scale, &f->ax0, h); soon = overlap(h, me); }
            }
            if(soon) { parried(e); continue; }
        }
        if(e->land_at == 0) {
            const EnemyFrame *f = frame_of(e);
            if(!f->has_hit) continue;
            box_of(e->face, e->base, e->fy + e->jy, e->scale, &f->ax0, h);
            if(!overlap(h, me)) continue;
            e->land_at = now + HIT_DELAY;                      /* contact: the hit lands shortly, a parry still works */
        }
        if(now < e->land_at) continue;
        { const EnemyFrame *f = frame_of(e); if(!f->has_hit) { e->hit_done = 1; continue; } box_of(e->face, e->base, e->fy + e->jy, e->scale, &f->ax0, h); if(!overlap(h, me)) { e->hit_done = 1; continue; } }
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


