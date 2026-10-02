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

