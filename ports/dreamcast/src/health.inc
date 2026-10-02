/* ------------------------------------------------------------------ her health and K.O. */
static void ko_check(void) {            /* any source of damage that empties her health ends the run, not only an enemy hit */
    if(hp > 0 || ko_until != 0 || pit_fall_on) return;
    ko_until = now + KO_MS;
    if(!stun_on) {
        float rx, ry, h = height_above();
        if(has_cur && !fall_on && cur.kind != K_FALL) { root_of(&cur, cur.k, &rx, &ry); X += rx; }
        fall_on = 0; queued = -1; slide_v = 0;
        stun_on = 1; stun_v = 0; stun_a = 0; stun_y = h; stun_vy = KNOCK_UP_VY;
        cur.id = MV_heavy; cur.k = HEAVY_HIGH_K; cur.t = 0; cur.kind = K_STUN; cur.face = has_cur ? cur.face : facing; cur.phys = 0; cur.py = cur.pv = 0; has_cur = 1;
    }
}

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
        if(ko_until > 0) { stun_on = 1; gameover_on = 1; return; }                       /* K.O.: the Game Over menu offers the retry */
        stun_on = 0; has_cur = 0; hold_state(now);
    }
}

