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
static void world_hit_shape(const Hit *h, float px, float py, int face);
static void resolve_hits_one(const MoveFrame *f, float px, float py, int face) {
    int s, i;
    for(s = 0; s < f->nhit; s++) {
        const Hit *h = &HITS[f->hit0 + s];
        world_hit_shape(h, px, py, face);                  /* any crate or bomb the shape touches */
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
static void ko_check(void);
static void hurt_her(float dmg) { if(dmg > 0) hp = maxf_(0, hp - dmg); }
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
    hurt_her(dmg);
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


