/* ------------------------------------------------------------------ the pad as the menus see it (PAD_ bits, active high after inversion) */
typedef struct { u16 held; u16 prev; } Pad;
static Pad pad;
static int held(u16 mask) { return (pad.held & mask) != 0; }
static int pressed_now(u16 mask) { return (pad.held & mask) && !(pad.prev & mask); }
static int released_now(u16 mask) { return !(pad.held & mask) && (pad.prev & mask); }

/* ------------------------------------------------------------------ pad reader (a C port of web/input.js)
 * Turns button presses into moves: press, tap (quick press and release), hold, chord (together), sequence (one after another).
 * Priority: the longest sequence, then the largest chord, then a single button. A press waits CHORD_MS before it resolves so a chord is not
 * taken for its first button. Pure logic: timestamps are the game clock in ms. */
#define CHORD_MS 60.0f
#define SEQ_MS 700.0f                   /* web/game/00_core.js sets sequence_window_ms to 700 */
#define TAP_MAX_MS 150.0f
#define HIST_N 16
#define NBTN 10
#define DIR_MASK (BTN_UP | BTN_DOWN | BTN_LEFT | BTN_RIGHT)

typedef struct { int b; float t, u; int used; } Press;                  /* u: when it was let go, -1 while held */
typedef struct { int move, via; } MoveEvent;
enum { VIA_PRESS, VIA_TAP, VIA_RELEASE, VIA_CHORD, VIA_SEQUENCE, VIA_CHAIN, VIA_ULTIMATE, VIA_QUEUE, VIA_AIR };
static float rd_held[NBTN];                                             /* time it went down, -1 when up */
static Press rd_hist[HIST_N]; static int rd_nhist;
static int rd_group_on, rd_group_n, rd_group_keys[NBTN]; static float rd_group_t; static int rd_group_mask;
static int rd_consumed;
static MoveEvent rd_events[16]; static int rd_nev;

static int bit_index(int mask) { int i; for(i = 0; i < NBTN; i++) if(mask == (1 << i)) return i; return -1; }
static int popcount_(int m) { int n = 0; while(m) { n += m & 1; m >>= 1; } return n; }
static int rd_is_held(int bit) { int i = bit_index(bit); return i >= 0 && rd_held[i] >= 0; }
static int move_open(int move);                                         /* defined with the progress state */
static int bind_open(const Binding *b) { return b->move == MV_ULTIMATE ? has(UL_ULTIMATE) : move_open(b->move); }
static int hold_bound(int bit);

static void rd_reset(void) {
    int i;
    for(i = 0; i < NBTN; i++) rd_held[i] = -1;
    rd_nhist = 0; rd_group_on = 0; rd_consumed = 0; rd_nev = 0;
}
static void rd_emit(int move, int via) { if(rd_nev < 16) { rd_events[rd_nev].move = move; rd_events[rd_nev].via = via; rd_nev++; } }
static const Binding *rd_find(int type, int bit) {                      /* the last open single-button binding of a type (later ones win, like web parse()) */
    const Binding *r = 0;
    int i;
    for(i = 0; i < N_BIND_OTHER; i++) {
        const Binding *b = &BIND_OTHER[i];
        if(b->type == type && b->steps[0] == bit && bind_open(b)) {
            if(type == BT_PRESS && b->move == MV_jump) continue;       /* jump is the Up button, read in read_buttons */
            r = b;
        }
    }
    return r;
}
static const Binding *tap_of(int bit) {                                 /* with the chop unlocked, A is tap = slash (like B's parry), hold = charge */
    const Binding *b = rd_find(BT_TAP, bit);
    if(b) return b;
    if(bit == BTN_A && move_open(MV_charge)) return rd_find(BT_PRESS, BTN_A);
    return 0;
}
static const Binding *press_of(int bit) { if(bit == BTN_A && move_open(MV_charge)) return 0; return rd_find(BT_PRESS, bit); }
static const Binding *hold_of(int bit) { return rd_find(BT_HOLD, bit); }
static int hold_bound(int bit) { return hold_of(bit) != 0; }
static int hold_ready(int bit, float ms);                                 /* the charge loop has started (player.inc) */

static void rd_resolve(float t);
static void rd_down(int bit, float t) {
    int i = bit_index(bit);
    if(i < 0 || rd_held[i] >= 0) return;                                 /* key repeat */
    rd_held[i] = t; rd_consumed &= ~bit;
    if(rd_nhist == HIST_N) { int k; for(k = 1; k < HIST_N; k++) rd_hist[k - 1] = rd_hist[k]; rd_nhist--; }
    rd_hist[rd_nhist].b = bit; rd_hist[rd_nhist].t = t; rd_hist[rd_nhist].u = -1; rd_hist[rd_nhist].used = 0; rd_nhist++;
    if(rd_group_on && t - rd_group_t <= CHORD_MS) { rd_group_keys[rd_group_n++] = bit; rd_group_mask |= bit; }
    else {
        if(rd_group_on) rd_resolve(t);
        rd_group_on = 1; rd_group_t = t; rd_group_n = 1; rd_group_keys[0] = bit; rd_group_mask = bit;
    }
}
static void rd_up(int bit, float t) {
    int i = bit_index(bit), k, was;
    float t0;
    const Binding *tp, *into;
    if(i < 0 || rd_held[i] < 0) return;
    t0 = rd_held[i];
    if(rd_group_on) rd_resolve(t);                                       /* a release settles any press still waiting out the chord window */
    rd_held[i] = -1;
    for(k = rd_nhist - 1; k >= 0; k--) if(rd_hist[k].b == bit) { if(rd_hist[k].u < 0) rd_hist[k].u = t; break; }
    was = rd_consumed & bit; rd_consumed &= ~bit;
    if(was) return;
    tp = tap_of(bit);
    if(tp && t - t0 <= TAP_MAX_MS) rd_emit(tp->move, VIA_TAP);
    into = hold_of(bit);
    if(into && into->release_into >= 0 && move_open(into->release_into) && hold_ready(bit, t - t0)) rd_emit(into->release_into, VIA_RELEASE);
}
static void rd_resolve(float t) {
    int n, i, k;
    (void)t;
    if(!rd_group_on) return;
    rd_group_on = 0;
    /* 1. sequences: the earlier steps are the presses just before this group, each within the sequence window of the next */
    for(i = 0; i < N_BIND_SEQS; i++) {
        const Binding *s = &BIND_SEQS[i];
        int last = s->steps[s->nsteps - 1], ok = 1, nprior = 0, earlier0, lastT_is_group = 0;
        Press *earlier[6];
        float lastT;
        n = s->nsteps;
        if(!bind_open(s)) continue;
        if(popcount_(last) == 1) {                                       /* ends in one button: the last n presses */
            if(rd_nhist < n) continue;
            if(rd_hist[rd_nhist - 1].b != last || !(rd_group_mask & last)) continue;
            for(k = 0; k < n - 1; k++) earlier[k] = &rd_hist[rd_nhist - n + k];
            lastT = rd_hist[rd_nhist - 1].t;
        } else {                                                         /* ends in a chord: all of it in this group */
            int pr[HIST_N];
            if((rd_group_mask & last) != last) continue;
            for(k = 0; k < rd_nhist; k++) if(rd_hist[k].t < rd_group_t) pr[nprior++] = k;
            if(nprior < n - 1) continue;
            for(k = 0; k < n - 1; k++) earlier[k] = &rd_hist[pr[nprior - (n - 1) + k]];
            lastT = rd_group_t; lastT_is_group = 1;
        }
        (void)lastT_is_group; (void)earlier0;
        for(k = 0; k < n - 1 && ok; k++) {
            Press *e = earlier[k];
            float next = k < n - 2 ? earlier[k + 1]->t : lastT;
            if(popcount_(s->steps[k]) != 1 || e->b != s->steps[k]) ok = 0;
            else if(next - e->t > SEQ_MS) {
                int holdable = (e->b & DIR_MASK) || hold_bound(e->b);
                ok = n == 2 && holdable && (e->u < 0 || e->u >= next);
            }
        }
        if(ok) {
            int all = 0;
            for(k = 0; k < n; k++) all |= s->steps[k];
            for(k = 0; k < NBTN; k++) if((all & (1 << k)) && rd_held[k] >= 0) rd_consumed |= 1 << k;
            rd_nhist = 0;                                                /* a finished sequence starts fresh */
            rd_emit(s->move, VIA_SEQUENCE);
            return;
        }
    }
    /* 2. chords: directions may just be held, other buttons must be in this press group; a loose chord also takes its buttons one after another */
    {
        float nowt = rd_group_t + CHORD_MS;
        for(i = 0; i < N_BIND_CHORDS; i++) {
            const Binding *c = &BIND_CHORDS[i];
            int keys = c->steps[0], ok = 1, fresh = 0;
            if(!bind_open(c)) continue;
            for(k = 0; k < NBTN && ok; k++) {
                int kb = 1 << k, recent = 0, j;
                if(!(keys & kb)) continue;
                for(j = 0; j < rd_nhist; j++) if(rd_hist[j].b == kb && !rd_hist[j].used && nowt - rd_hist[j].t <= SEQ_MS) recent = 1;
                {
                    int may = (kb & DIR_MASK) || (c->held & kb), in_group = (rd_group_mask & kb) != 0;
                    int heldok = rd_held[k] >= 0 && !(rd_consumed & kb);
                    if(!(in_group || ((may || c->loose) && heldok) || (c->loose && recent))) ok = 0;
                }
            }
            for(k = 0; k < NBTN; k++) if((keys & (1 << k)) && (rd_group_mask & (1 << k)) && !((1 << k) & DIR_MASK)) fresh = 1;
            if(ok && fresh) {
                for(k = 0; k < NBTN; k++) if((keys & (1 << k)) && rd_held[k] >= 0 && !((1 << k) & DIR_MASK)) rd_consumed |= 1 << k;
                if(c->loose) { int j; for(j = 0; j < rd_nhist; j++) if(keys & rd_hist[j].b) rd_hist[j].used = 1; }
                rd_emit(c->move, VIA_CHORD);
                return;
            }
        }
    }
    /* 3. single buttons: the last non-direction button of the group */
    {
        int b = 0;
        const Binding *p;
        for(k = 0; k < rd_group_n; k++) if(!(rd_group_keys[k] & DIR_MASK)) b = rd_group_keys[k];
        if(b && (p = press_of(b)) != 0) rd_emit(p->move, VIA_PRESS);
    }
}
static int rd_events_take(MoveEvent *out) {                              /* resolve what has waited long enough, hand over the events */
    int n = rd_nev;
    int i;
    for(i = 0; i < n; i++) out[i] = rd_events[i];
    rd_nev = 0;
    return n;
}
static int rd_update(float t, MoveEvent *out) {
    if(rd_group_on && t - rd_group_t > CHORD_MS) rd_resolve(t);
    return rd_events_take(out);
}
/* the hold move to loop while nothing else plays, from what is held right now (web input.js holdMove) */
static int rd_hold_move(float t) {
    static const int order[7] = {BTN_R, BTN_B, BTN_A, BTN_UP, BTN_DOWN, BTN_RIGHT, BTN_LEFT};
    int i;
    for(i = 0; i < 7; i++) {
        int bit = order[i], bi = bit_index(bit);
        const Binding *h, *tp;
        if(rd_held[bi] < 0 || (rd_consumed & bit)) continue;
        h = hold_of(bit);
        if(!h) continue;
        tp = tap_of(bit);
        if(tp && t - rd_held[bi] <= TAP_MAX_MS) continue;                /* could still be a tap */
        return h->move;
    }
    return MV_idle;
}
