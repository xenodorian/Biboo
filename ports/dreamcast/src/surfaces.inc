/* ------------------------------------------------------------------ small helpers */
static int strlen_(const char *p) { int n = 0; while(p[n]) n++; return n; }
static int streq_(const char *a, const char *b) { while(*a && *a == *b) { a++; b++; } return *a == *b; }
static float fabsf_(float v) { return v < 0 ? -v : v; }
static float minf_(float a, float b) { return a < b ? a : b; }
static float maxf_(float a, float b) { return a > b ? a : b; }
static float signf_(float v) { return v > 0 ? 1.0f : v < 0 ? -1.0f : 0.0f; }
static u32 rng = 2463534242u;
static float frand(void) { rng ^= rng << 13; rng ^= rng >> 17; rng ^= rng << 5; return (float)(rng & 0xffffff) / 16777216.0f; }


/* ------------------------------------------------------------------ surfaces (web/game/09_maps.js) */
#define SPRITE_PAD 6.0f
static int face_now(void) { return has_cur ? cur.face : facing; }
static void span_of(float bx, float out[2]) {                 /* her drawn body: the hurtbox x range plus SPRITE_PAD each side */
    float f = (float)face_now(), lo = f * 5.0f, hi = f * 30.0f, a, b;
    if(lo > hi) { float t = lo; lo = hi; hi = t; }
    a = bx + lo - SPRITE_PAD; b = bx + hi + SPRITE_PAD;
    out[0] = a < bx ? a : bx; out[1] = b > bx ? b : bx;
}
static int over_surf(const Plat *p, const float sp[2]) { return sp[1] >= p->x0 - 3 && sp[0] <= p->x1 + 3; }
static float support_below(float bx, float y) {                 /* the highest surface at or below height y under her (the ground is 0) */
    float best = 0, sp[2];
    int i;
    span_of(bx, sp);
    for(i = 0; i < cur_map->nplat; i++) {
        const Plat *p = &PLATS[cur_map->plat0 + i];
        if(over_surf(p, sp) && p->top <= y + 0.5f && p->top > best) best = p->top;
    }
    return best;
}
static float support_under(float bx, float y) {                 /* the highest surface strictly below height y under her */
    float best = 0, sp[2];
    int i;
    span_of(bx, sp);
    for(i = 0; i < cur_map->nplat; i++) {
        const Plat *p = &PLATS[cur_map->plat0 + i];
        if(over_surf(p, sp) && p->top < y - 1 && p->top > best) best = p->top;
    }
    return best;
}
static const Plat *surface_at(float bx, int top) {
    int i;
    for(i = 0; i < cur_map->nplat; i++) {
        const Plat *p = &PLATS[cur_map->plat0 + i];
        if(p->top == top && bx >= p->x0 - 3 && bx <= p->x1 + 3) return p;
    }
    return 0;
}
static float pit_sink(void) { return pit_fall_on ? 0.0006f * (now - pit_t0) * (now - pit_t0) : 0; }

