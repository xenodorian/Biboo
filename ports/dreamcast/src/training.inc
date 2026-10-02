/* ------------------------------------------------------------------ Sunset Training (web/game/06_training.js)
 * The heavy bag is not in the art pack, so it is drawn as a shape.
 * Nothing here writes a cleared level. Health and meters are filled by the frame loop. */
static float bag_x = 140.0f, bag_fy = 12.0f, bag_a, bag_v;
static u32 bag_seen;
static float bag_seen_t;
static int train_last, train_total, train_hits, train_combo;
static float train_combo_at = -1.0e9f, train_t0;
static void bag_box(float b[4]) {          /* web heavybag hurt [-21,0,21,102] at sprite scale 0.5 */
    b[0] = bag_x - 10.5f; b[2] = bag_x + 10.5f; b[1] = bag_fy; b[3] = bag_fy + 51.0f;
}
static void bag_hit(int dmg, float hx, float hy, int from_beam) {
    float dir, add;
    if(!training_on || dmg <= 0) return;
    train_total += dmg;
    if(!from_beam) {
        train_last = dmg; train_hits++;
        train_combo = now - train_combo_at < 1400.0f ? train_combo + 1 : 1;
        train_combo_at = now;
    }
    dir = player_x() <= bag_x ? 1.0f : -1.0f;
    add = 0.0025f + (float)dmg * 0.00007f;
    if(add > 0.012f) add = 0.012f;
    bag_v += dir * add;
    floater_num(hx, hy + 4.0f, dmg, "-", RGB(255, 43, 43));
    if(!from_beam) impact(hx, hy, dmg, 0);
}
static void step_bag(float dt) {
    if(!training_on) return;
    bag_v += (-0.00016f * bag_a - 0.0035f * bag_v) * dt * 4.0f;
    bag_a += bag_v * dt;
    if(bag_a > 1.2f) bag_a = 1.2f; else if(bag_a < -1.2f) bag_a = -1.2f;
}
static void draw_bag(void) {
    int lean = iround(bag_a * 14.0f);
    int feet = VIEW_TOP + v2s(FEET_ROW - iround(bag_fy - camY));
    int top = VIEW_TOP + v2s(FEET_ROW - iround(bag_fy + 51.0f - camY));
    int h = feet - top, x, w = 14;
    if(h < 8) h = 8;
    x = v2s(iround(bag_x)) + lean;
    gfx_rect(x - w / 2, top, w, 5, RGB(48, 28, 16));
    gfx_rect(x - w / 2 + 2, top + 5, w - 4, h - 5, RGB(120, 72, 36));
    gfx_rect(x - w / 2 + 2, top + 5, 2, h - 5, RGB(72, 40, 20));
}
static const char *const TIPS[] = {
    "Hit the bag with any move you own.",
    "Buy moves from the Bone Merchant.",
    "Meters and health refill here.",
    "Tap B parry. Hold B to block.",
    "Start, then Moves, lists your controls.",
};
static void draw_bunny(void) {
    int hop = 0;
    float ph = (float)((int)now % 1800) / 1800.0f;
    int x = v2s(338), y, tip = ((int)now / 8500) % 5;
    if(ph < 0.25f) hop = 5;
    y = VIEW_TOP + v2s(FEET_ROW - iround(-camY)) - hop;
    gfx_blit(art_sprite(BUNNY_SPRITE), x, y, 0);
    gfx_text(8, 36, TIPS[tip], RGB(255, 176, 240));
}
