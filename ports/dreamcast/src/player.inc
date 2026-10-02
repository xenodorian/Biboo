#include "input.inc"

/* ------------------------------------------------------------------ her moves (web/game/02_input.js, 03_state.js, 04_chain.js) */
static float player_x(void);
static float height_above(void);
static float her_y(void);
static int her_face(void);
static void start(int id, int kind, int via);
static void hold_state(float t);
static void step_stun(float dt);
static void taunt_all(void);                                            /* enemy.inc */
static float her_x_for_float(void);
static float her_y_for_float(void);
static void hit_queue_now(void);                                        /* combat.inc: the frame on screen hits now */

#define HOLD_NONE 0
/* energy moves are charged: press and hold their buttons (the charge pose plays, energy drains, Max turns blue when full), let go to fire */
static int hold_on, hold_move, hold_keys;                               /* the charge in progress */
#define MIN_FIRE 250.0f
#define FULL_CHARGE 1000.0f
#define CHARGE_ENERGY 20.0f
#define CRASH_HIGH 164.0f
#define BEAM_LEN 500.0f
static float charge_ms, meter_acc, heal_acc;
static float chain_t = -1e9f; static int chain_n;
static int chain_q[8], chain_qn;
static float last_b_clock = -1e9f;
static int flight_on; static float flight_until, trail_acc;
static int rainbow_active; static float rainbow_until;
static int ult_on, ult_steps[6], ult_n;
static int dbl_used;
static float last_down_rel = -1e9f;
static struct { int b; float t; } combo_log[8]; static int combo_n;

static int is_energy_hold(int m) { return m == MV_energy_kick || m == MV_energy_burst || m == MV_energy_wave || m == MV_energy_dash_thrust; }
static int hold_keys_of(int m) {                                        /* the buttons whose release fires the move (the DC pad has two triggers: see bake_game.py) */
    switch(m) {
    case MV_energy_kick: return BTN_B | BTN_L;
    case MV_energy_burst: return BTN_L | BTN_R;
    case MV_energy_wave: return BTN_A;
    default: return BTN_X | BTN_A;
    }
}
static int is_down(int bit) { int i = bit_index(bit); return i >= 0 && rd_held[i] >= 0; }
static int btn_held_raw(int bit);                                       /* the pad as it is now, before the reader (frame.inc) */
static int metersHeld(void) { return has(UL_METER_CHARGE) && (btn_mask & (BTN_L | BTN_R)) && btn_held_raw(BTN_L) && btn_held_raw(BTN_R) && btn_held_raw(BTN_DOWN); }

/* ---- meters */
static int need_of(int move, int *kind, float *n) {
    static const float TICK[4] = {1, 3, 5, 5};
    int k;
    if(move == MV_jump_crash) { *kind = M_ENERGY; *n = 30; return 1; }
    if(move == MV_earthquake || move == MV_meteor_shower) { *kind = M_SUPER; *n = meter_max[M_SUPER]; return 1; }
    if(move == MV_recover) { *kind = M_EMPOWER; *n = 1; return 1; }
    for(k = 0; k < nframes(move); k++) if(mf(move, k)->beam >= 0) {
        int b = mf(move, k)->beam;
        *kind = b == 3 ? M_EMPOWER : M_ENERGY; *n = TICK[b]; return 1;
    }
    return 0;
}
static int can_afford(int move) { int k; float n; return !need_of(move, &k, &n) || meter[k] >= n; }
static void deny(int move) {
    int k; float n;
    static float last_deny;
    if(!need_of(move, &k, &n)) return;
    meter_flash[k] = now + 500.0f;
    if(now - last_deny > 500.0f) { last_deny = now; floater(her_x_for_float(), her_y_for_float(), k == M_ENERGY ? "NO ENERGY" : k == M_SUPER ? "NO SUPER" : "NO EMPOWER", k == M_ENERGY ? RGB(68, 170, 255) : k == M_SUPER ? RGB(204, 102, 255) : RGB(255, 170, 68)); }
}

static int hold_ready(int bit, float ms) {                              /* releasing A turns the charge into the chop once the aura loop has started */
    const Binding *hb = hold_of(bit);
    (void)ms;
    return hb && has_cur && cur.id == hb->move && cur.k >= MOVES[cur.id].loop_from;
}

/* first frame of a move: some moves skip their opening, or pick up from the pose of the move they interrupt (the chop starts from the charge pose) */
static int entry_frame(int id) {
    const MoveDef *m = &MOVES[id];
    if(m->enter_from >= 0 && has_cur && cur.id == m->enter_from && cur.k < 16 && m->enter_k[cur.k] >= 0) return m->enter_k[cur.k];
    return m->enter_default;
}
static void last_hit_frame_of(int id, int *out) { int k, r = -1; for(k = 0; k < nframes(id); k++) if(mf(id, k)->nhit) r = k; *out = r; }

static void start(int id, int kind, int via) {
    int k0 = entry_frame(id), i;
    float charged = has_cur && cur.id == MV_charge ? charge_ms : 0;
    if(via == VIA_CHAIN && (id == MV_heavy || id == MV_energy_burst)) {              /* the chain's finishers: no charging, but the energy is paid */
        float pay = minf_(CHARGE_ENERGY, meter[M_ENERGY]);
        spend(M_ENERGY, pay); charged = FULL_CHARGE * pay / CHARGE_ENERGY;
    }
    if(id == MV_charge && !(has_cur && cur.id == MV_charge)) charge_ms = 0;
    if(has_cur) { float rx, ry; root_of(&cur, cur.k, &rx, &ry); X += rx; }          /* keep the ground covered so far; height resets */
    cur.id = id; cur.k = k0; cur.t = 0; cur.kind = kind; cur.face = facing; cur.phys = 0; cur.py = cur.pv = 0; cur.air = 0;
    cur.lite = cur.crash = cur.beam_cut = 0; cur.charged = 0; cur.power = 1; cur.spin = -1e9f; cur.beam_t = 0; cur.aoe_done = 0; cur.blast[0] = cur.blast[1] = 0;
    has_cur = 1;
    if(kind == K_ACTION) cur.serial = ++mv_serial;
    if(id == MV_parry) last_parry_t = now;
    if(id == MV_heavy) { cur.lite = charged < FULL_CHARGE; cur.charged = charged; }
    if(is_energy_hold(id) && (via == VIA_RELEASE || via == VIA_CHAIN)) cur.power = 0.5f + 0.5f * minf_(1.0f, charged / FULL_CHARGE);   /* the charge sets the power */
    if(kind == K_ACTION) { int k; float n; if(need_of(id, &k, &n) && (id == MV_jump_crash || id == MV_earthquake || id == MV_meteor_shower)) spend(k, n); }
    if(kind == K_ACTION) hit_queue_now();
    if(id == MV_taunt) taunt_all();
    (void)i;
}

/* A in the air: the crash starts at its raised-sword frame, at her current height and x */
static int airborne(void) {
    float rx, ry;
    if(fall_on || (has_cur && cur.kind == K_FALL)) return 1;
    if(!has_cur || cur.kind != K_ACTION || cur.id == MV_jump_crash) return 0;
    root_of(&cur, cur.k, &rx, &ry);
    return ry > 0;
}
static int frame_named(int id, const char *name) {
    int k, j;
    for(k = 0; k < nframes(id); k++) { const char *a = mf(id, k)->name; for(j = 0; a[j] && name[j] && a[j] == name[j]; j++) ; if(!a[j] && !name[j]) return k; }
    return -1;
}
static void air_crash(int via) {
    float h, rx, ry;
    int k0;
    if(!can_afford(MV_jump_crash)) { cur.crash = 0; deny(MV_jump_crash); return; }
    spend(M_ENERGY, 30);
    if(fall_on) h = fall_y; else { root_of(&cur, cur.k, &rx, &ry); h = ry; }
    if(has_cur && !fall_on && cur.kind != K_FALL) { root_of(&cur, cur.k, &rx, &ry); X += rx; }
    fall_on = 0; queued = -1;
    k0 = frame_named(MV_jump_crash, "apex"); if(k0 < 0) k0 = 0;
    cur.id = MV_jump_crash; cur.k = k0; cur.t = 0; cur.kind = K_ACTION; cur.face = facing; cur.phys = 0;
    cur.air = 1; cur.air_x0 = mf(MV_jump_crash, k0)->rx; cur.air_s = h / mf(MV_jump_crash, k0)->ry;
    cur.lite = h <= CRASH_HIGH; cur.crash = 0; cur.beam_cut = 0; cur.power = 1; cur.aoe_done = 0; cur.beam_t = 0; cur.spin = -1e9f;
    cur.serial = ++mv_serial; has_cur = 1;
    (void)via;
    hit_queue_now();
}

/* ---- the attack chain: mash A. 1st press the slash, 2nd to 4th chain2 to chain4, the 5th the uncharged chop; B after the 4th ends it in a burst */
#define CHAIN_MS 750.0f
static int chain_busy(void) { int lh; if(!has_cur || cur.kind != K_ACTION) return 0; last_hit_frame_of(cur.id, &lh); return cur.k <= lh; }
static void chain_go(int move) {
    if(!chain_qn && !chain_busy()) { queued = -1; start(move, K_ACTION, VIA_CHAIN); }
    else if(chain_qn < 8) chain_q[chain_qn++] = move;
}
static void chain_tick(void) {
    int i;
    if(!chain_qn) return;
    if(stun_on) { chain_qn = 0; return; }
    if(chain_busy()) return;
    queued = -1;
    { int m = chain_q[0]; for(i = 1; i < chain_qn; i++) chain_q[i - 1] = chain_q[i]; chain_qn--; start(m, K_ACTION, VIA_CHAIN); }
}
static int chain_press(void) {                                          /* an A press with the chain unlocked; 1 when the chain handled it */
    static const int CM[4] = {MV_slash, MV_chain2, MV_chain3, MV_chain4};
    int n;
    if(!has(UL_CHAIN) || stun_on || fall_on || airborne() || (hold_on && is_energy_hold(hold_move))) { chain_n = 0; return 0; }
    n = (now - chain_t <= CHAIN_MS && last_b_clock <= chain_t) ? chain_n + 1 : 1;       /* a B in between starts the count over */
    if(n == 1) { chain_n = 1; chain_t = now; return 0; }
    if(n <= 4) { chain_n = n; chain_t = now; chain_go(CM[n - 1]); return 1; }
    chain_n = 0; chain_t = -1e9f;                                       /* 5th press: the heavy chop, uncharged */
    if(meter[M_ENERGY] < 1) return 1;
    chain_go(MV_heavy);
    return 1;
}
static int chain_burst(void) {                                          /* a B tap right after the 4th A */
    if(!has(UL_CHAIN_BURST) || chain_n != 4 || now - chain_t > CHAIN_MS || stun_on || airborne()) return 0;
    chain_n = 0; chain_t = -1e9f;
    if(meter[M_ENERGY] < 1) return 1;
    chain_go(MV_energy_burst);
    return 1;
}

/* ---- double jump, flight, rainbow guard, ultimate chain */
#define DJ_H (2.0f * 81.0f)
static int try_double_jump(void) {
    float dj_v;
    if(!has(UL_DOUBLE_JUMP) || dbl_used || stun_on) return 0;
    if(has_cur && cur.id == MV_jump && cur.kind == K_ACTION && cur.phys) { }
    else if(fall_on || (has_cur && cur.id == MV_jump && cur.kind == K_FALL)) {
        float y = fall_on ? fall_y : 0;
        cur.id = MV_jump; cur.k = 3; cur.t = 0; cur.kind = K_ACTION; cur.face = has_cur ? cur.face : facing; cur.phys = 1; cur.py = y; cur.pv = 0; has_cur = 1;
        fall_on = 0;
    } else return 0;
    dj_v = __builtin_sqrtf(2.0f * JUMP_G * 0.75f * DJ_H);
    cur.pv = maxf_(cur.pv, dj_v);
    cur.spin = now; dbl_used = 1; queued = -1;
    return 1;
}
#define FLY_MS 5000.0f
#define FLY_VY 0.11f
#define FLY_MIN 6.0f
#define FLY_MAX 150.0f
static void start_flight(void) {
    float y0;
    if(stun_on || flight_on || pit_fall_on) return;
    y0 = maxf_(height_above(), 0);
    if(has_cur && !fall_on && cur.kind != K_FALL) { float rx, ry; root_of(&cur, cur.k, &rx, &ry); X += rx; }
    fall_on = 0; queued = -1; slide_v = 0; hold_on = 0;
    cur.id = MV_jump; cur.k = 3; cur.t = 0; cur.kind = K_ACTION; cur.face = facing; cur.phys = 1; cur.py = maxf_(y0, FLY_MIN) + 6.0f; cur.pv = 0; cur.air = 0; cur.lite = cur.crash = 0; cur.spin = -1e9f; has_cur = 1;
    flight_on = 1; flight_until = now + FLY_MS;
    floater(her_x_for_float(), her_y_for_float(), "FLIGHT", RGB(127, 208, 255));
}
#define RAINBOW_MS 5000.0f
static int rainbow_on(void) { return rainbow_active && now < rainbow_until; }
static void start_rainbow(void) {
    if(stun_on || pit_fall_on) return;
    rainbow_active = 1; rainbow_until = now + RAINBOW_MS; invuln = maxf_(invuln, now + RAINBOW_MS);
    floater(her_x_for_float(), her_y_for_float(), "RAINBOW", RGB(255, 210, 74));
}
static void start_ultimate(void) {                                      /* after the chain: taunt, then the four beams one after another */
    static const int S[5] = {MV_taunt, MV_beam_plasma, MV_beam_cloud, MV_beam_fire, MV_beam_laser};
    int i;
    if(stun_on || ult_on) return;
    ult_on = 1; ult_n = 5; for(i = 0; i < 5; i++) ult_steps[i] = S[i];
}
static void ult_tick(void) {
    int id, i;
    if(!ult_on) return;
    if(stun_on) { ult_on = 0; return; }
    if(chain_qn || (has_cur && cur.kind == K_ACTION) || fall_on || (has_cur && cur.kind == K_LAND)) return;
    if(ult_n == 0) { ult_on = 0; return; }
    id = ult_steps[0]; for(i = 1; i < ult_n; i++) ult_steps[i - 1] = ult_steps[i]; ult_n--;
    if(!can_afford(id)) { deny(id); return; }                           /* no meter for this beam: on to the next */
    queued = -1; start(id, K_ACTION, VIA_ULTIMATE);
}

/* ---- request: a move was asked for (web/game/04_chain.js request) */
static void request(int move, int via) {
    int in_air, air_bind = 0;
    if(move < 0 || move >= MV_COUNT || stun_on || !move_open(move)) return;
    if(move == MV_jump && try_double_jump()) return;
    if(!can_afford(move)) { deny(move); return; }                       /* no meter: the move does not play */
    air_bind = MOVES[move].uses_a && !(via == VIA_SEQUENCE && move == MV_meteor_shower);    /* a move that uses A is the air press when she is in the air */
    in_air = airborne() || (has_cur && cur.id == MV_jump && cur.kind == K_ACTION);
    if(is_energy_hold(move) && via == VIA_RELEASE) {                    /* let go of an energy charge: fire it if it was held long enough */
        if(!(has_cur && cur.id == MV_charge && charge_ms >= MIN_FIRE)) return;
    } else if(is_energy_hold(move)) {                                   /* press and hold to charge (on the ground only) */
        if(in_air || fall_on || (has_cur && cur.kind == K_ACTION && cur.id != MV_charge)) return;
        if(meter[M_ENERGY] < 1) { meter_flash[M_ENERGY] = now + 500.0f; return; }
        hold_on = 1; hold_move = move; hold_keys = hold_keys_of(move); queued = -1;
        return;
    }
    if(air_bind && in_air && !move_open(MV_jump_crash)) return;        /* A in the air does nothing until the crash is unlocked */
    if(air_bind) {
        if(in_air && !can_afford(MV_jump_crash)) { deny(MV_jump_crash); return; }
        if(airborne()) { air_crash(via); return; }
        if(has_cur && cur.id == MV_jump && cur.kind == K_ACTION) { cur.crash = 1; return; }   /* pressed during the jump's crouch: crash as soon as she leaves the ground */
    }
    if(fall_on || (has_cur && cur.kind == K_LAND)) { queued_q.move = move; queued_q.via = via; return; }
    {
        int busy = has_cur && cur.kind == K_ACTION;
        if(!busy || via != VIA_PRESS) start(move, K_ACTION, via);       /* chords, sequences, taps and releases cancel */
        else { queued_q.move = move; queued_q.via = via; }              /* a plain press waits its turn */
    }
}

static void finish_action(float t) {
    float rx, ry;
    const MoveDef *m = &MOVES[cur.id];
    if(m->quake_ms && cur.kind == K_ACTION) rumble_set((float)m->quake_ms, m->quake_amp);
    { Cur tmp = cur; root_of(&tmp, nframes(cur.id) - 1, &rx, &ry); }
    if(ry > 0) {                                                        /* ended in the air: fall back down */
        X += rx; fall_on = 1; fall_y = ry; fall_v = 0;
        cur.id = MV_jump; cur.k = FALL_K; cur.t = 0; cur.kind = K_FALL; cur.phys = 0; cur.air = 0;
        return;
    }
    X += rx;
    has_cur = 0;
    if(queued >= 0 && !can_afford(queued)) { deny(queued); queued = -1; }
    if(queued >= 0) { int q = queued, v = queued_q.via; queued = -1; start(q, K_ACTION, v); }
    else hold_state(t);
}

/* Left and Right both walk with the forward walk; which way she goes and faces is `facing` */
static int hold_want(float t) {
    int w;
    if(metersHeld() || hold_on) return MV_charge;
    w = rd_hold_move(t);
    if(w == MV_walk_left) w = MV_walk_right;
    if(w == MV_recover && meter[M_EMPOWER] < 1) return MV_idle;
    return w;
}
static void hold_state(float t) {
    int want = hold_want(t);
    if(!has_cur || cur.id != want || cur.face != facing) start(want, K_HOLD, VIA_PRESS);
}

#define FLY_TRAIL_MS 25.0f
static void step_jump(float dt) {
    if(flight_on) {
        if(now >= flight_until) flight_on = 0;
        else {                                                          /* flying: no gravity; Up and Down climb and dive */
            float vy = ((is_down(BTN_UP) ? 1.0f : 0.0f) - (is_down(BTN_DOWN) ? 1.0f : 0.0f)) * FLY_VY;
            cur.pv = 0; cur.py = minf_(FLY_MAX, maxf_(FLY_MIN, cur.py + vy * dt)); cur.k = 3;
            trail_acc += dt;
            while(trail_acc >= FLY_TRAIL_MS) {                          /* a trail of blue particles */
                trail_acc -= FLY_TRAIL_MS;
                burst(player_x() + (float)her_face() * 19.0f, her_y() + 10.0f + frand() * 12.0f, 1, RGB(47, 123, 255), RGB(127, 208, 255), RGB(191, 232, 255));
            }
            return;
        }
    }
    cur.pv -= JUMP_G * ((cur.pv < 0 ? -cur.pv : cur.pv) < JUMP_HANG_V ? JUMP_HANG_G : 1.0f) * dt;
    cur.py += cur.pv * dt;
    cur.k = cur.pv > 0.6f * JUMP_V0 ? 1 : cur.pv > 0.2f * JUMP_V0 ? 2 : cur.pv > -0.2f * JUMP_V0 ? 3 : 4;   /* takeoff, rise, apex, fall */
    if(cur.py <= 0 && cur.pv < 0) {                                     /* back down to the height she left from */
        if(floor_y > 0) {                                               /* she left a platform and walked off it in the air: keep falling */
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

static void impact_quake(void) {
    if(!has_cur || cur.kind != K_ACTION || cur.lite) return;
    if(MOVES[cur.id].quake_ms == 0 && cur.id != MV_heavy && cur.id != MV_jump_crash) return;
    if((cur.id == MV_heavy && frame_named(MV_heavy, "impact") == cur.k) || (cur.id == MV_jump_crash && frame_named(MV_jump_crash, "crash") == cur.k)) rumble_set(1000.0f, 14.0f);
}

static void step(float dt, float t) {
    if(stun_on) { hold_on = 0; step_stun(dt); return; }
    if(slide_v != 0) {                                                  /* a blocked hit slides her back */
        float v = slide_v - signf_(slide_v) * slide_a * dt;
        X += slide_v * dt; slide_v = signf_(v) == signf_(slide_v) ? v : 0;
    }
    {   /* steering in the air: hold Left or Right while a jump is up or she is falling */
        int steer = (is_down(BTN_RIGHT) ? 1 : 0) - (is_down(BTN_LEFT) ? 1 : 0), air_j = 0;
        if(has_cur && cur.kind == K_ACTION && cur.id == MV_jump) { float rx, ry; root_of(&cur, cur.k, &rx, &ry); air_j = ry > 0; }
        if(steer && (fall_on || (has_cur && (cur.kind == K_FALL || air_j)))) { X += steer * AIR_SPEED * dt; facing = steer; if(has_cur) cur.face = steer; }
    }
    if(fall_on) {                                                       /* simple gravity, px/ms^2 */
        fall_v += 0.0018f * dt; fall_y -= fall_v * dt;
        if(fall_y <= 0) { fall_on = 0; cur.id = MV_jump; cur.k = LAND_K; cur.t = 0; cur.kind = K_LAND; cur.face = has_cur ? cur.face : facing; has_cur = 1; cur.phys = 0; cur.air = 0; }
        return;
    }
    if(!has_cur) hold_state(t);
    if(cur.id == MV_jump && cur.kind == K_ACTION) {                     /* the plain jump: crouch, then physics until she lands */
        if(cur.phys) { step_jump(dt); return; }
        cur.t += dt;
        if(cur.t >= ms_of_c(&cur, MV_jump, 0)) { cur.phys = 1; cur.py = 0; cur.pv = JUMP_V0; cur.k = 1; cur.t = 0; if(cur.crash) { air_crash(VIA_AIR); } }
        return;
    }
    if(cur.kind == K_HOLD) {
        int want = hold_want(t);
        if(want != cur.id || cur.face != facing) start(want, K_HOLD, VIA_PRESS);
    }
    cur.t += dt;
    while(cur.t >= ms_of_c(&cur, cur.id, cur.k)) {
        cur.t -= ms_of_c(&cur, cur.id, cur.k);
        cur.k++;
        if(cur.k < nframes(cur.id)) { if(cur.kind == K_ACTION) { hit_queue_now(); impact_quake(); } continue; }
        if(cur.kind == K_LAND) { cur.k = nframes(cur.id) - 1; finish_action(t); return; }
        if(cur.kind == K_ACTION) {
            if(cur.id == MV_beam_cloud && btn_held_raw(BTN_A) && meter[M_ENERGY] >= 1) {      /* the cloud beam keeps firing while A is held */
                int bi = -1, k;
                for(k = 0; k < nframes(cur.id); k++) if(mf(cur.id, k)->beam >= 0) { bi = k; break; }
                cur.beam_cut = 0; cur.k = bi >= 0 ? bi : 2; continue;
            }
            cur.k = nframes(cur.id) - 1; finish_action(t); return;
        }
        if(MOVES[cur.id].loop) {                                        /* the next cycle carries on from here */
            int n = nframes(cur.id), lf = MOVES[cur.id].loop_from;
            float r_last = mf(cur.id, n - 1)->rx, r_prev = n > 1 ? mf(cur.id, n - 2)->rx : 0, r_from = mf(cur.id, lf)->rx;
            X += cur.face * (r_last + (n > 1 ? r_last - r_prev : 0) - r_from);
            cur.k = lf;
        } else cur.k = nframes(cur.id) - 1;
    }
}

/* ---- charge and recover (web/game/07_feedback.js stepHeal, 03_state.js stepCharge) */
static void step_heal(float dt) {
    if(has_cur && cur.id == MV_charge && cur.kind == K_HOLD && !stun_on) {
        if(metersHeld()) {                                              /* every meter fills by 1 per 500 ms */
            meter_acc += dt;
            while(meter_acc >= 500.0f) { meter_acc -= 500.0f; spend(M_ENERGY, -1); spend(M_EMPOWER, -1); spend(M_SUPER, -1); }
        } else if(!hold_on || is_energy_hold(hold_move)) {              /* the charge grows only while the meter can pay */
            if(charge_ms < FULL_CHARGE) {
                float want = dt * CHARGE_ENERGY / FULL_CHARGE, pay = minf_(want, meter[M_ENERGY]);
                if(pay > 0) { spend(M_ENERGY, pay); charge_ms = minf_(FULL_CHARGE, charge_ms + dt * pay / want); }
            }
        }
    } else meter_acc = 0;
    if(!has_cur || cur.id != MV_recover || cur.kind != K_HOLD || stun_on || hp >= max_hp) { heal_acc = 0; return; }
    heal_acc += dt;
    while(heal_acc >= 350.0f && hp < max_hp && meter[M_EMPOWER] >= 1) {
        float n;
        heal_acc -= 350.0f; spend(M_EMPOWER, 1);
        n = minf_(5.0f, max_hp - hp); hp += n;
        floater(her_x_for_float(), her_y_for_float(), "+", RGB(61, 255, 110));
    }
}

/* ---- reading the pad (web/game/02_input.js readButtons) */
static u16 pad_raw;
static int btn_held_raw(int bit) { return (pad_raw & bit) != 0; }
static void log_combo(int b, float t) { if(combo_n == 8) { int i; for(i = 1; i < 8; i++) combo_log[i - 1] = combo_log[i]; combo_n--; } combo_log[combo_n].b = b; combo_log[combo_n].t = t; combo_n++; }
static int combo_seq(const int *list, int n, float t, int includes_last) {
    int i;
    if(combo_n < n) return 0;
    for(i = 0; i < n; i++) if(combo_log[combo_n - n + i].b != list[i]) return 0;
    for(i = 1; i < n; i++) if(combo_log[combo_n - n + i].t - combo_log[combo_n - n + i - 1].t > SEQ_MS) return 0;
    return includes_last || t - combo_log[combo_n - 1].t <= SEQ_MS;
}
static float last_drop_tap = -1e9f;
static int ignore_until_up;                                             /* buttons held when a menu closed */
static int drop_through(void);
static int up_is_combo(float t) { return has(UL_SKY_DASH) && (is_down(BTN_DOWN) || t - last_down_rel < SEQ_MS); }
static void read_buttons(float t) {
    static const int ALL[NBTN] = {BTN_UP, BTN_DOWN, BTN_LEFT, BTN_RIGHT, BTN_A, BTN_B, BTN_X, BTN_Y, BTN_L, BTN_R};
    int charging = metersHeld(), i;
    for(i = 0; i < NBTN; i++) {
        int b = ALL[i], now_on = (pad_raw & b) != 0;
        if(ignore_until_up & b) { if(now_on) now_on = 0; else ignore_until_up &= ~b; }
        if((b & (BTN_L | BTN_R)) && !(btn_mask & (BTN_L | BTN_R))) now_on = 0;     /* a shoulder button that is not unlocked yet */
        if(charging && (b & (BTN_L | BTN_R))) now_on = 0;
        if(now_on && !is_down(b)) {
            rd_down(b, t);
            if(b == BTN_UP && !charging) {
                static const int FLY[4] = {BTN_A, BTN_B, BTN_A, BTN_B};
                if(has(UL_FLY) && combo_seq(FLY, 4, t, 0)) { combo_n = 0; start_flight(); }       /* A, B, A, B, Up */
                else if(!up_is_combo(t)) request(MV_jump, VIA_PRESS);                             /* Up jumps (and double jumps in the air) */
            }
            if(b == BTN_A || b == BTN_B) {
                static const int RB[6] = {BTN_A, BTN_B, BTN_A, BTN_B, BTN_A, BTN_B};
                log_combo(b, t);
                if(b == BTN_B) last_b_clock = now;
                if(b == BTN_B && has(UL_RAINBOW) && combo_seq(RB, 6, t + 1, 1)) { combo_n = 0; start_rainbow(); }    /* A, B, A, B, A, B */
            }
            if(b == BTN_DOWN) { if(t - last_drop_tap < 300.0f && drop_through()) last_drop_tap = -1e9f; else last_drop_tap = t; }
            if(b == BTN_LEFT) facing = -1; else if(b == BTN_RIGHT) facing = 1;
        } else if(!now_on && is_down(b)) {
            rd_up(b, t);
            if(b == BTN_DOWN) last_down_rel = t;
            if(hold_on && (hold_keys & b)) { int m = hold_move; hold_on = 0; request(m, VIA_RELEASE); }     /* let go: the charged attack fires */
            if(b == BTN_LEFT && is_down(BTN_RIGHT)) facing = 1;           /* let go of the newer one: the other still held */
            else if(b == BTN_RIGHT && is_down(BTN_LEFT)) facing = -1;
        }
    }
}
