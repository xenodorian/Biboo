/* ------------------------------------------------------------------ hit feedback (web/game/07_feedback.js): hit-stop, starbursts, damage numbers, flashes, shake */
typedef struct { float t0, ms, amp; } Rumble;
static Rumble rumble;                                    /* shake that outlasts a move (the earthquake): amp 0 when none */
typedef struct { int on; float wx, wy, t0; char text[12]; u16 c; } Floater;
typedef struct { int on; float wx, wy, t0, ms, r; u16 c; } Flash;
#define MAX_FLOATERS 16
#define MAX_FLASHES 8
#define FLOAT_MS 900.0f
static Floater floaters[MAX_FLOATERS];
static Flash flashes[MAX_FLASHES];
static float freeze_ms;                                  /* the world holds still for a moment on impact */
static struct { int on; u16 c; int a; float t0, ms; } screen_flash;
static int beam_tick_on;
static u16 her_tint_c; static int her_tint_a; static float her_tint_until;      /* her flash: red when hit, white when she blocks or parries */
static void her_tint_set(u16 c, int a, float ms) { her_tint_c = c; her_tint_a = a; her_tint_until = now + ms; }

static void burst(float x, float y, int n, u16 c0, u16 c1, u16 c2);
static void floater(float wx, float wy, const char *text, u16 color) {
    int i, k;
    for(i = 0; i < MAX_FLOATERS; i++) if(!floaters[i].on) {
        Floater *f = &floaters[i];
        f->on = 1; f->wx = wx; f->wy = wy; f->t0 = now; f->c = color;
        for(k = 0; k < 11 && text[k]; k++) f->text[k] = text[k];
        f->text[k] = 0;
        return;
    }
}
static void floater_num(float wx, float wy, int v, const char *prefix, u16 color) {
    char buf[12];
    int n = 0, k, m = 0;
    char tmp[8];
    for(k = 0; prefix[k] && n < 3; k++) buf[n++] = prefix[k];
    if(v < 0) v = 0;
    if(v == 0) tmp[m++] = '0';
    while(v && m < 7) { tmp[m++] = (char)('0' + v % 10); v /= 10; }
    while(m && n < 11) buf[n++] = tmp[--m];
    buf[n] = 0;
    floater(wx, wy, buf, color);
}
static void rumble_set(float ms, float amp) { rumble.t0 = now; rumble.ms = ms; rumble.amp = amp; }
static void shake_for(float ms, float amp) {             /* only if it is stronger than what is still shaking */
    if(rumble.amp == 0 || rumble.amp * (1.0f - (now - rumble.t0) / rumble.ms) < amp) rumble_set(ms, amp);
}
static void hit_stop(float ms) { freeze_ms = minf_(160.0f, maxf_(freeze_ms, ms)); }
static void flash_at(float wx, float wy, float ms, float r, u16 c) {
    int i;
    for(i = 0; i < MAX_FLASHES; i++) if(!flashes[i].on) { Flash *f = &flashes[i]; f->on = 1; f->wx = wx; f->wy = wy; f->t0 = now; f->ms = ms; f->r = r; f->c = c; return; }
}
static void screen_flash_set(u16 c, int a255, float ms) { screen_flash.on = 1; screen_flash.c = c; screen_flash.a = a255; screen_flash.t0 = now; screen_flash.ms = ms; }
static void impact(float wx, float wy, int dmg, int killed) {
    int big = dmg >= 100 || killed, mid = dmg >= 30;
    flash_at(wx, wy, big ? 260.0f : mid ? 200.0f : 150.0f, big ? 26.0f : mid ? 18.0f : 12.0f, RGB(255, 246, 192));
    burst(wx, wy, big ? 16 : mid ? 10 : 6, RGB(255, 246, 192), RGB(255, 210, 74), RGB(255, 255, 255));
    hit_stop(big ? 130.0f : mid ? 80.0f : 45.0f);
    if(big) { screen_flash_set(RGB(255, 255, 255), 102, 120.0f); shake_for(220.0f, 3.0f); }
    else if(mid) shake_for(140.0f, 1.5f);
}
static float her_x_for_float(void);
static float her_y_for_float(void);
static float her_body_x(void);
static float her_feet_y(void);
static void her_hit_fx(void) {                           /* she is hurt: a short freeze, a red flash, a shake and a red starburst */
    hit_stop(100.0f); shake_for(200.0f, 2.5f); screen_flash_set(RGB(255, 32, 32), 90, 200.0f);
    flash_at(her_body_x(), her_feet_y() + 22.0f, 220.0f, 20.0f, RGB(255, 96, 96));
}
static void step_effects(float dt) {
    int i;
    (void)dt;
    for(i = 0; i < MAX_FLOATERS; i++) if(floaters[i].on && now - floaters[i].t0 > FLOAT_MS) floaters[i].on = 0;
    for(i = 0; i < MAX_FLASHES; i++) if(flashes[i].on && now - flashes[i].t0 >= flashes[i].ms) flashes[i].on = 0;
    if(rumble.amp != 0 && now - rumble.t0 >= rumble.ms) rumble.amp = 0;
    if(screen_flash.on && now - screen_flash.t0 >= screen_flash.ms) screen_flash.on = 0;
}
static void effects_clear(void) {
    int i;
    for(i = 0; i < MAX_FLOATERS; i++) floaters[i].on = 0;
    for(i = 0; i < MAX_FLASHES; i++) flashes[i].on = 0;
    screen_flash.on = 0; freeze_ms = 0; rumble.amp = 0;
}
