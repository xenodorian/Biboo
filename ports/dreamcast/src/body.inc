/* ------------------------------------------------------------------ her body (web/game/13_enemy_attacks.js) */
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

static float her_body_x(void) { return player_x() + (float)her_face() * 32.0f; }
static float her_feet_y(void) { return her_y(); }
static float her_x_for_float(void) { return player_x() + (float)her_face() * 32.0f; }        /* her body centre */
static float her_y_for_float(void) { return her_y() + her_top() + 8.0f; }                       /* web: herY() + herTop() + 8 */
