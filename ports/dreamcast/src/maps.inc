/* ------------------------------------------------------------------ maps and doors (web/game/09_maps.js) */
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
        e->combo_ready = 1; e->melee_seen = 0; e->hit_done = 0; e->land_at = 0; e->strike_fr = -1; e->tint_until = 0; e->scale = 1; e->speed_mul = e->dmg_mul = 1; e->taunted = 0; e->drop_energy = e->drop_empower = 0; e->seen_t = 0; e->seen = 0; e->push_v = e->push_a = 0;
        set_range(e);                                    /* an enemy on a platform never leaves it; a ground enemy stays between the pits */
        e->sight = (float)(s->sight ? s->sight : 100) * SIGHT_MUL;
        e->path0 = s->path0; e->path1 = s->path1;
        e->anim = d->a_walk; play(e, d->a_walk);
        if(e->path0 >= 0) { e->state = S_PATROL; e->dir = x <= (float)(e->path0 + e->path1) * 0.5f ? 1 : -1; e->face = e->dir; play(e, d->a_walk); }
    }
    for(i = 0; i < MAX_GEMS_ON; i++) gems[i].on = 0;
    for(i = 0; i < MAX_SHOTS; i++) shots[i].on = 0;
    for(i = 0; i < MAX_PARTS; i++) parts[i].on = 0;
    for(i = 0; i < MAX_BOOMS; i++) booms[i].r = 0;
    for(i = 0; i < 4; i++) { crate_broken[i] = i < m->ncrate && (crate_gone[idx] >> i & 1); bomb_state[i] = i < m->nbomb && (bomb_gone[idx] >> i & 1); bomb_fuse[i] = 0; }
    for(i = 0; i < m->nleaf && i < 32; i++) {                       /* leaves lying on the map: gone for good once picked up (until the level restarts) */
        const Leaf *l = &LEAVES[m->leaf0 + i];
        if(leaf_got[idx] >> i & 1) continue;
        spawn_gem((float)l->x, G_LEAF, (float)l->fy, 1);
        { int j; for(j = MAX_GEMS_ON - 1; j >= 0; j--) if(gems[j].on && gems[j].kind == G_LEAF && gems[j].key < 0 && gems[j].t0 == now) { gems[j].key = i; gems[j].y = (float)(l->fy + l->h); break; } }
    }
    X = from_left ? 26.0f : (float)(VIEW_W - 26); facing = from_left ? 1 : -1;
    floor_y = 0; pit_fall_on = 0; prev_ok = 0;
    fall_on = 0; stun_on = 0; slide_v = 0; has_cur = 0; queued = -1; camY = 0; invuln = now + 600.0f; ko_until = 0;
    start(MV_idle, K_HOLD, VIA_PRESS);
}
static void start_level(int level) {       /* a level starts with its crates, bombs and leaves back */
    int i;
    for(i = 0; i < 12; i++) { crate_gone[i] = 0; bomb_gone[i] = 0; leaf_got[i] = 0; }
    hp = max_hp;
    load_map(level, 0, 1);
}
static void retry_map(void) {               /* after a K.O. the same map can be replayed only by spending an ankh; with none left the level starts over */
    if(ankhs < 1) { ankhs = 3; start_level(level_idx); return; }
    ankhs--; hp = max_hp; load_map(level_idx, map_idx, 1);
}
static const MapDef TRAIN_MAP = { "T", 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, SC_TRAINING };
static void enter_training(void) {      /* web enterTraining: not a level, so it never marks one cleared */
    int i;
    training_on = 1; screen = SCN_LEVEL; paused = gameover_on = level_done = 0; menu_page = 0;
    cur_map = &TRAIN_MAP; level_idx = 0; map_idx = 0;
    for(i = 0; i < MAX_ENEMIES; i++) en[i].on = 0;
    for(i = 0; i < MAX_GEMS_ON; i++) gems[i].on = 0;
    for(i = 0; i < MAX_SHOTS; i++) shots[i].on = 0;
    for(i = 0; i < MAX_PARTS; i++) parts[i].on = 0;
    for(i = 0; i < MAX_BOOMS; i++) booms[i].r = 0;
    effects_clear();
    bag_a = bag_v = 0; bag_seen = 0; train_last = train_total = train_hits = train_combo = 0; train_combo_at = -1.0e9f; train_t0 = now;
    X = 70.0f; facing = 1; floor_y = 0; pit_fall_on = 0; prev_ok = 0;
    fall_on = 0; stun_on = 0; slide_v = 0; has_cur = 0; queued = -1; camY = 0; invuln = now + 600.0f; ko_until = 0;
    hp = max_hp; meter[0] = meter_max[0]; meter[1] = meter_max[1]; meter[2] = meter_max[2];
    start(MV_idle, K_HOLD, VIA_PRESS);
    say("SUNSET TRAINING", 3200.0f);
}
static void save_game(void);
static void level_complete(void) {         /* web/game/09_maps.js levelComplete, progress.js completeLevel */
    cleared |= (u8)(1 << level_idx);
    if(levels_unlocked < level_idx + 2) levels_unlocked = level_idx + 2 > NUM_LEVELS ? NUM_LEVELS : level_idx + 2;
    save_game();
    if(level_idx + 1 >= NUM_LEVELS && !story_ending) { begin_story(ST_ENDING, ST_AFTER_COMPLETE); return; }
    level_done = 1;
}
static int door_open(void) {
    int i;
    for(i = 0; i < MAX_ENEMIES; i++) if(alive(&en[i])) return 0;
    return 1;
}
static void say(const char *s, float ms) { banner = s; banner_until = now + ms; }
static int edges(void) {
    float px = player_x();
    if(training_on) {                       /* one closed room, no door (web arena maps) */
        if(px >= VIEW_W - EDGE) X -= px - (VIEW_W - EDGE);
        else if(px <= EDGE) X += EDGE - px;
        return 0;
    }
    if(px >= VIEW_W - EDGE) {
        if(!stun_on && door_open()) {
            if(map_idx + 1 < LEVELS[level_idx].nmaps) load_map(level_idx, map_idx + 1, 1);
            else level_complete();
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
        smash_crates_under(prev_feet, feet, sp);
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

