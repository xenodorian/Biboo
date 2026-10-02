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
    if(id == MV_parry) last_parry_t = now;
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

