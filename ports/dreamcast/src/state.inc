/* State shared by everything: her, the camera, the clock, progress. Names follow web/game/03_state.js. */

/* ------------------------------------------------------------------ view to screen */
static int iround(float v) { return v >= 0 ? (int)(v + 0.5f) : -(int)(-v + 0.5f); }
static int v2s(int v) { return v >= 0 ? (v * 5 + 3) / 6 : -((-v * 5 + 3) / 6); }       /* 384x216 view -> 320x180 */

/* ------------------------------------------------------------------ state (names follow web/game/03_state.js) */
enum { K_HOLD, K_ACTION, K_LAND, K_FALL, K_STUN };
typedef struct {
    int id, k, kind, face;
    float t;
    int phys; float py, pv;             /* the plain jump and flight are physics, not frame root motion */
    int air; float air_x0, air_s;       /* a crash started in the air is scaled to begin at her height */
    int lite, crash, beam_cut;          /* lite: no black and white frame and no shake; crash: A pressed during the jump crouch */
    float charged, power, spin, beam_t; /* charge built before the chop, power of an energy move, the double jump's spin, next beam tick */
    int aoe_done, blast[2];             /* the chop's blast, the energy wave's burst per side */
    u32 serial;                         /* which use of a move this is: a move hurts each enemy once per use */
} Cur;
static Cur cur;
static int has_cur;
static float X;                         /* world x of her anchor, view px */
static int facing = 1;
static int fall_on; static float fall_y, fall_v;
typedef struct { int move, via; } Queued;
static Queued queued_q;
#define queued (queued_q.move)

static float camY;
static float floor_y, prev_feet, last_cx; static int prev_ok;          /* height of the surface she stands on; her feet last frame */
static int pit_fall_on; static float pit_t0, last_down_t;
static const MapDef *cur_map;
static int level_idx, map_idx;
static u32 clock_ms;
static float now;                       /* ms since the start, the web game's `clock` */
static u32 mv_serial;                   /* counts action moves; a move hurts each enemy once per use */
static int stun_on; static float stun_v, stun_a, stun_y, stun_vy;
static float slide_v, slide_a;          /* a blocked hit slides her back */
static float invuln, ko_until;
static float hp;
static const char *banner; static float banner_until;
#define MAX_HP_START 50.0f              /* web/progress.js MAX_START.hp; +25 per Bone Powder, capped at 200 */
static float max_hp = MAX_HP_START;
static int ankhs = 3, leaves = 100;     /* leaves start at 100 (web/progress.js) */
enum { SCN_TITLE, SCN_OVERWORLD, SCN_LEVEL };
static int screen, paused, gameover_on, level_done, ow_sel, levels_unlocked = 1;
static u8 cleared;                      /* bit n set: level n+1 beaten */           /* ankhs: retries (web/progress.js ANKH_START); leaves: the purse */
static float last_parry_t = -1e9f;
#define BODY_W 16.5f
#define HURT_X0 5.0f
#define HURT_X1 30.0f
#define SS 0.5f                         /* SPRITE_SCALE */
#define EDGE 14.0f
#define HEAVY_HIGH_K 3                  /* the frame named 'high' in the heavy move: her knocked-back pose */
#define KNOCK_UP_VY (-0.13416f)         /* -sqrt(2 * 0.0018 * 5) */
#define HIT_DELAY 200.0f
#define DIE_MS 900.0f
#define KO_MS 1500.0f

static const float AIR_SPEED = 0.16f;
#define JUMP_H 130.0f
#define JUMP_UP 280.0f
#define JUMP_G (2.0f * JUMP_H / (JUMP_UP * JUMP_UP))
#define JUMP_V0 (JUMP_G * JUMP_UP)
#define JUMP_HANG_V (0.2f * JUMP_V0)
#define JUMP_HANG_G 0.5f
#define CAM_KEEP 100.0f
#define MAP_W 384
#define TAP_MS 150

static int FALL_K, LAND_K;

static const MoveFrame *mf(int id, int k) { return &MOVE_FRAMES[MOVES[id].frame0 + k]; }
static int nframes(int id) { return MOVES[id].nframes; }
#define BW_HOLD 110.0f
static float ms_of_c(const Cur *c, int id, int k) { const MoveFrame *f = mf(id, k); return f->bw >= 0 ? (c->lite ? 0.0f : BW_HOLD) : (float)f->ms; }
static float ms_of(int id, int k) { const MoveFrame *f = mf(id, k); return f->bw >= 0 ? BW_HOLD : (float)f->ms; }

/* root motion of the current frame: x already carries her facing */
static void root_of(const Cur *c, int k, float *rx, float *ry) {
    if(c->kind == K_STUN) { *rx = 0; *ry = 0; return; }
    if(c->phys) { *rx = 0; *ry = c->py; return; }
    if(c->air) { *rx = (float)c->face * (mf(c->id, k)->rx - c->air_x0); *ry = mf(c->id, k)->ry * c->air_s; return; }
    *rx = (float)c->face * mf(c->id, k)->rx;
    *ry = mf(c->id, k)->ry;
}


/* ------------------------------------------------------------------ progress and meters (web/progress.js, web/game/00_core.js) */
enum { M_ENERGY, M_EMPOWER, M_SUPER };
static u32 unlocked;                    /* bit per UL_ id: what she owns */
static u8 moves_open[MV_COUNT + 2];     /* moves switched on by what she owns */
static int btn_mask, meters_on;         /* shoulder buttons and meters her unlocks bring */
static float meter[3], meter_max[3] = {50, 50, 100}, meter_flash[3];
static int gem_bag[4];                  /* health, energy, empower, super (the Items menu) */
#define MAX_GEM_BAG 99
static int has(int ul) { return (unlocked >> ul) & 1; }
static void recompute_unlocks(void) {
    int i, j;
    for(i = 0; i < MV_COUNT + 2; i++) moves_open[i] = 0;
    btn_mask = 0; meters_on = 0;
    for(i = 0; i < UL_COUNT; i++) if(has(i)) {
        for(j = 0; j < 3; j++) if(UNLOCKS[i].moves[j] >= 0) moves_open[UNLOCKS[i].moves[j]] = 1;
        btn_mask |= UNLOCKS[i].buttons; meters_on |= UNLOCKS[i].meters;
    }
}
static int move_open(int move) {
    switch(move) {
    case MV_idle: case MV_walk_right: case MV_walk_left: case MV_duck: case MV_block: case MV_parry: case MV_jump: case MV_dash: case MV_slash: case MV_spin_attack: return 1;
    default: return move >= 0 && move < MV_COUNT && moves_open[move];
    }
}
static int meter_on(int k) { return (meters_on >> k) & 1; }
static float meter_of(int k) { return meter[k]; }
static void spend(int k, float n) {                    /* n < 0 adds (capped at the meter's maximum) */
    float v = meter[k] - n;
    meter[k] = v < 0 ? 0 : v > meter_max[k] ? meter_max[k] : v;
}
