/* State shared by everything: her, the camera, the clock, progress. Names follow web/game/03_state.js. */

/* ------------------------------------------------------------------ view to screen */
static int iround(float v) { return v >= 0 ? (int)(v + 0.5f) : -(int)(-v + 0.5f); }
static int v2s(int v) { return v >= 0 ? (v * 5 + 3) / 6 : -((-v * 5 + 3) / 6); }       /* 384x216 view -> 320x180 */

/* ------------------------------------------------------------------ state (names follow web/game/03_state.js) */
enum { K_HOLD, K_ACTION, K_LAND, K_FALL, K_STUN };
typedef struct { int id, k, kind, face; float t; int phys; float py, pv; } Cur;
static Cur cur;
static int has_cur;
static float X;                         /* world x of her anchor, view px */
static int facing = 1;
static int fall_on; static float fall_y, fall_v;
static int queued = -1;
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
static float ms_of(int id, int k) { const MoveFrame *f = mf(id, k); return f->bw ? 110.0f : (float)f->ms; }

/* root motion of the current frame: x already carries her facing */
static void root_of(const Cur *c, int k, float *rx, float *ry) {
    if(c->kind == K_STUN) { *rx = 0; *ry = 0; return; }
    if(c->phys) { *rx = 0; *ry = c->py; return; }
    *rx = (float)c->face * mf(c->id, k)->rx;
    *ry = mf(c->id, k)->ry;
}

