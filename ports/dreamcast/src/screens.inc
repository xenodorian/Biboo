/* ------------------------------------------------------------------ screens: title, overworld, pause, Game Over, level complete (web/game/20_title.js, 19_overworld.js, 17_menus.js) */
static void draw_scene(void) {
    const MoveFrame *f = mf(cur.id, cur.k);
    int sx = 0, sy = 0;
    if(!(cur.kind == K_FALL || cur.kind == K_LAND || cur.lite)) { sx = f->shx; sy = f->shy; }
    if(rumble.amp != 0) {                                                       /* fading aftershock */
        float e = now - rumble.t0, u = 1.0f - e / rumble.ms, a = rumble.amp * (u > 0 ? u * __builtin_sqrtf(u) : 0);
        sx += iround(a * fsin(e * 0.11f)); sy += iround(a * fsin(e * 0.083f + 1.5707963f));
    }
    if(f->bw >= 0 && cur.kind == K_ACTION && !stun_on) {                      /* impact frame: the whole view replaced by a black and white picture slid to where she is */
        float rx, ry, tgt;
        int shv;
        root_of(&cur, cur.k, &rx, &ry);
        tgt = maxf_(0, ry - CAM_KEEP); camY = tgt;
        shv = iround(X + rx - (float)ANCHOR_X);
        gfx_clear(RGB(0, 0, 0)); gfx_clip(VIEW_TOP, VIEW_TOP + VIEW_SCR_H);
        if(cur.face < 0) { gfx_blit(art_sprite(f->bw), v2s(ANCHOR_X + shv), VIEW_TOP, 1); gfx_blit(art_sprite(f->bw), v2s(ANCHOR_X + shv - VIEW_W), VIEW_TOP, 1); }
        else gfx_blit(art_sprite(f->bw), v2s(shv), VIEW_TOP, 0);
        return;
    }
    gfx_clear(RGB(0, 0, 0));
    draw_layers(camY);
    draw_geometry();
    draw_items();
    if(training_on) { draw_bag(); draw_bunny(); }
    draw_enemies();
    draw_player();
    draw_beam();
    draw_effects();
    gfx_clip(VIEW_TOP, VIEW_TOP + VIEW_SCR_H);
    draw_fringe(camY);
    draw_flashes_floaters();
    if(sx || sy) gfx_shift(VIEW_TOP, VIEW_TOP + VIEW_SCR_H, v2s(sx), v2s(sy));
    if(screen_flash.on) { float a = (now - screen_flash.t0) / screen_flash.ms; gfx_clip(VIEW_TOP, VIEW_TOP + VIEW_SCR_H); gfx_fill_alpha(VIEW_TOP, VIEW_TOP + VIEW_SCR_H, screen_flash.c, (int)((float)screen_flash.a * (1.0f - a))); }
}
static void ctext(int y, const char *t, u16 c, int k) { gfx_text2((SCR_W - 8 * k * strlen_(t)) / 2, y, t, c, k); }
static void box(int x, int y, int w, int h) { gfx_rect(x, y, w, h, RGB(255, 210, 74)); gfx_rect(x + 1, y + 1, w - 2, h - 2, RGB(12, 10, 18)); }
static void wrap_text(int x, int y, const char *t, u16 c, int cols, int maxlines) {    /* word wrap in an 8x8 font */
    int line = 0, n = (int)strlen_(t), i = 0;
    while(i < n && line < maxlines) {
        int len = n - i > cols ? cols : n - i, end = i + len;
        if(end < n) { int b = end; while(b > i && t[b] != ' ') b--; if(b > i) end = b; }
        { char buf[64]; int k, m = end - i; if(m > 62) m = 62; for(k = 0; k < m; k++) buf[k] = t[i + k]; buf[m] = 0; gfx_text(x, y + line * 9, buf, c); }
        i = end; while(i < n && t[i] == ' ') i++;
        line++;
    }
}
static void disc(int cx, int cy, int r, u16 c) {
    int y;
    for(y = -r; y <= r; y++) { int xo = (int)(__builtin_sqrtf((float)(r * r - y * y)) + 0.5f); gfx_rect(cx - xo, cy + y, xo * 2 + 1, 1, c); }
}
static void line(int x0, int y0, int x1, int y1, u16 c, int dash) {
    int n = (x1 - x0 > 0 ? x1 - x0 : x0 - x1), m = (y1 - y0 > 0 ? y1 - y0 : y0 - y1), steps = n > m ? n : m, i;
    if(steps == 0) return;
    for(i = 0; i <= steps; i++) if(!dash || (i / dash) % 2 == 0) gfx_rect(x0 + (x1 - x0) * i / steps - 1, y0 + (y1 - y0) * i / steps - 1, 3, 3, c);
}
static void draw_drifting(float speed) {       /* the Green Trail scenery drifting past */
    const Scene *sc = &SCENES[SC_TRAIL];
    int i;
    gfx_clear(RGB(0, 0, 0));
    gfx_clip(VIEW_TOP, VIEW_TOP + VIEW_SCR_H);
    for(i = 0; i < sc->nlayers; i++) {
        int dx = -iround(now * speed * sc->layers[i].parallax), p = sc->layers[i].period, x0 = ((dx % p) + p) % p - p, xx;
        for(xx = x0; xx < VIEW_W; xx += p) gfx_blit(art_sprite(sc->layers[i].sprite), v2s(xx), VIEW_TOP + v2s(-VIEW_MARGIN), 0);
    }
}
static void draw_title(void) {
    static const char *w1 = "PARRYING", *w2 = "PERRY";
    int i, k, t = (int)now;
    float tot = 0, tt;
    draw_drifting(0.02f);
    for(k = 0; k < nframes(MV_idle); k++) tot += ms_of(MV_idle, k);       /* Max, idle, on guard */
    tt = now - tot * (float)(int)(now / tot);
    for(k = 0; k < nframes(MV_idle) - 1 && tt >= ms_of(MV_idle, k); k++) tt -= ms_of(MV_idle, k);
    gfx_clip(0, SCR_H);
    gfx_blit(art_sprite(mf(MV_idle, k)->sprite), 64, VIEW_TOP + v2s(FEET_ROW), 0);
    for(i = 0; i < 8; i++) {                                              /* the logo: gold letters with a dark outline, bobbing */
        int bob = (int)(fsin((float)t * 0.003f + (float)i * 0.7f) * 2.0f), x = 160 - 8 * 3 * 4 + i * 24;
        gfx_text2(x + 1, 40 + bob + 2, (char[]){w1[i], 0}, RGB(58, 22, 8), 3); gfx_text2(x, 40 + bob, (char[]){w1[i], 0}, RGB(255, 200, 58), 3);
    }
    for(i = 0; i < 5; i++) {
        int bob = (int)(fsin((float)t * 0.003f + (float)(i + 8) * 0.7f) * 2.0f), x = 160 - (5 * 24) / 2 + i * 24;
        gfx_text2(x + 1, 70 + bob + 2, (char[]){w2[i], 0}, RGB(58, 22, 8), 3); gfx_text2(x, 70 + bob, (char[]){w2[i], 0}, RGB(255, 200, 58), 3);
    }
    ctext(102, "A PERRY RIPOSTE ADVENTURE", RGB(232, 224, 255), 1);
    if(!title_menu && (((int)(now / 500.0f)) & 1)) ctext(180, "PRESS START", RGB(255, 255, 255), 1);
    ctext(222, save_msg, RGB(160, 180, 230), 1);                          /* what the memory card held at boot */
}
static const short OW_NODES[7][2] = {{36, 150}, {90, 112}, {144, 146}, {198, 106}, {252, 144}, {306, 108}, {348, 60}};
static int nx(int i) { return v2s(OW_NODES[i][0]); }
static int ny(int i) { return VIEW_TOP + v2s(OW_NODES[i][1]); }
static void draw_overworld(void) {
    int i, n = NUM_LEVELS;
    const LevelDef *L = &LEVELS[ow_sel];
    int open = ow_sel < levels_unlocked, done = (cleared >> ow_sel) & 1, bob = (int)(fsin(now / 260.0f) * 1.5f);
    char lab[2] = {0, 0};
    draw_drifting(0.012f);
    for(i = 1; i < n; i++) line(nx(i - 1), ny(i - 1), nx(i), ny(i), RGB(0, 0, 0), 0);
    for(i = 1; i < n; i++) line(nx(i - 1), ny(i - 1), nx(i), ny(i), RGB(138, 122, 85), 5);
    for(i = 0; i < n; i++) {
        int o = i < levels_unlocked, d = (cleared >> i) & 1;
        disc(nx(i), ny(i), 11, RGB(0, 0, 0)); disc(nx(i), ny(i), 9, d ? RGB(61, 220, 95) : o ? RGB(201, 150, 42) : RGB(58, 58, 68));
        lab[0] = (char)('1' + i); gfx_text(nx(i) - 4, ny(i) - 4, lab, o ? RGB(26, 18, 6) : RGB(119, 119, 119));
        if(!o) gfx_rect(nx(i) - 3, ny(i) + 3, 7, 5, RGB(154, 154, 168));
        if(i == ow_sel && ((int)(now / 160.0f) & 1) == 0) ring(nx(i), ny(i), 14, RGB(255, 225, 77));
    }
    gfx_clip(0, SCR_H);
    gfx_blit(art_sprite(mf(MV_idle, 0)->sprite), nx(ow_sel), ny(ow_sel) - 12 + bob, 0);
    ctext(6, "OVERWORLD", RGB(255, 225, 77), 2);
    box(16, 172, SCR_W - 32, 60);
    { char buf[48]; int p = 0; const char *a = "LEVEL ", *b = L->name, *c = done ? " (CLEARED)" : "";
      buf[p++] = 'L'; buf[p++] = 'E'; buf[p++] = 'V'; buf[p++] = 'E'; buf[p++] = 'L'; buf[p++] = ' '; (void)a; buf[p++] = (char)('1' + ow_sel); buf[p++] = ':'; buf[p++] = ' ';
      while(*b && p < 38) buf[p++] = *b++;
      while(*c && p < 47) buf[p++] = *c++;
      buf[p] = 0; gfx_text(24, 178, buf, RGB(255, 255, 255)); }
    if(open) wrap_text(24, 187, L->blurb, RGB(230, 230, 236), 34, 3);
    else { char buf[40] = "LOCKED. BEAT LEVEL N FIRST."; buf[19] = (char)('0' + ow_sel); gfx_text(24, 187, buf, RGB(230, 230, 236)); }
    gfx_text(24, 220, "A PLAY  Y SHOP  X TRAIN", RGB(154, 154, 168));
    if(now < banner_until) ctext(130, banner, RGB(255, 210, 74), 1);
    if(now < save_msg_until) ctext(2, save_msg, RGB(160, 180, 230), 1);
}
static void enter_level(int n) {                /* n is 0-based */
    if(n >= levels_unlocked) { say("LOCKED: BEAT THE LEVEL BEFORE", 2000); return; }
    if(ankhs < 3) ankhs = 3;                    /* every level starts with at least 3 ankhs */
    screen = SCN_LEVEL; paused = gameover_on = level_done = 0;
    start_level(n);
    say(LEVELS[n].name, 3200.0f);
}
static void go_overworld(void) {
    training_on = 0;
    if(screen == SCN_LEVEL || screen == SCN_STORY) save_game();                    /* web: goOverworld syncs and saves the progress */
    screen = SCN_OVERWORLD; paused = gameover_on = level_done = 0;
    ow_sel = (levels_unlocked < NUM_LEVELS ? levels_unlocked : NUM_LEVELS) - 1;
    banner_until = 0;
}
static void overlay(const char *l0, const char *l1, const char *l2) {
    gfx_dim(VIEW_TOP, VIEW_TOP + VIEW_SCR_H);
    box(24, 78, SCR_W - 48, 76);
    ctext(86, l0, RGB(255, 225, 77), 2);
    ctext(112, l1, RGB(255, 255, 255), 1);
    ctext(128, l2, RGB(154, 154, 168), 1);
}

/* ------------------------------------------------------------------ story (web/game/18_story.js): the words, on a panel. The wide scene pictures are not in the art pack. */
typedef struct { int id, bg; const char *title, *body; } StoryPage;
static const StoryPage STORY[] = {
    { ST_PROLOGUE, STBG_CALM, "PERRY", "Peregrine \"Perry\" Riposte was ten years old. She had a mom, a dad, and a little brother. The house was small and loud. It was home." },
    { ST_PROLOGUE, STBG_FIRE, "THE FIRE", "One night the house went up in flames. Perry saw a figure on the lawn, lit by the fire. The figure looked exactly like her." },
    { ST_PROLOGUE, STBG_FIRE, "THE FIRE", "Her parents and her little brother never came out." },
    { ST_PROLOGUE, STBG_CROWD, "THE VILLAGE", "The village came running. They saw the smoke, and they saw Perry. \"She did it,\" they said. Nobody would listen. Perry ran." },
    { ST_PROLOGUE, STBG_SEA, "MIRACLE ISLAND", "She found a boat and sailed to Miracle Island. It is full of monsters. At its center lies the Legendary Wish Scroll, which can grant any wish." },
    { ST_PROLOGUE, STBG_SEA, "MIRACLE ISLAND", "Perry gripped her sword. She would fight her way to the center." },
    { ST_DOUBLE, STBG_DOUBLE, "PERRY, FALLEN", "The other Perry drops to one knee. Her body flickers like a candle in the wind." },
    { ST_DOUBLE, STBG_DOUBLE, "THE DOUBLE", "\"You still do not get it,\" she says. \"I am not a stranger. I came from you.\"" },
    { ST_DOUBLE, STBG_DOUBLE, "THE DOUBLE", "\"I was born from your magic and your worst feelings. I am every angry thought you ever had, with a body.\"" },
    { ST_DOUBLE, STBG_DOUBLE, "THE DOUBLE", "\"You can beat me. It will not last. Unless you let your anger out in a healthy way, I will rise again.\"" },
    { ST_DOUBLE, STBG_DOUBLE, "PERRY", "The double fades into red sparks. The way to the center of the island is open." },
    { ST_ENDING, STBG_ALTAR, "THE CENTER", "Perry walked on, past the last of the monsters, to the very center of the island." },
    { ST_ENDING, STBG_ALTAR, "THE SCROLL", "Behind a ring of old stones lay the Legendary Wish Scroll. It glowed softly. Perry opened it. \"Take me back,\" she said. \"To before the fire.\"" },
    { ST_ENDING, STBG_REWIND, "BACK IN TIME", "The world spun backward. Days and nights blurred past, until the sky settled on that last evening." },
    { ST_ENDING, STBG_CALM, "HOME", "Perry stood outside her house. Through the window she saw her mom, her dad, and her little brother, laughing at supper. They were alive." },
    { ST_ENDING, STBG_CALM, "HOME", "All that hatred had never made her strong. It had only made her alone. It had hurt her far more than it ever helped." },
    { ST_ENDING, STBG_MEDITATE, "PERRY", "Perry sat down in the grass. She took a deep breath. In, and out. Again. She let the anger go a little at a time." },
    { ST_ENDING, STBG_SUNRISE, "PERRY", "\"Holding on to anger is self-destructive,\" Perry said. \"I have to appreciate what I have, before it is all gone.\"" },
    { ST_ENDING, STBG_SUNRISE, "THE END", "Thank you for playing Perry Riposte." },
};
static int story_len(void) { int i, n = 0; for(i = 0; i < (int)(sizeof STORY / sizeof STORY[0]); i++) if(STORY[i].id == story_id) n++; return n; }
static const StoryPage *story_cur(void) {
    int i, n = 0;
    for(i = 0; i < (int)(sizeof STORY / sizeof STORY[0]); i++) if(STORY[i].id == story_id) { if(n == story_page) return &STORY[i]; n++; }
    return &STORY[0];
}
static void story_finish(void) {
    int after = story_after;
    if(after == ST_AFTER_OW) { go_overworld(); say("YOU START WITH 100 LEAVES", 4200); }
    else if(after == ST_AFTER_COMPLETE) { screen = SCN_LEVEL; paused = 0; level_done = 1; }
    else { screen = SCN_LEVEL; paused = 0; }
}
static void draw_story(void) {
    const StoryPage *p = story_cur();
    int last = story_page + 1 >= story_len();
    gfx_clear(RGB(0, 0, 0));
    gfx_clip(0, SCR_H);
    gfx_blit(art_sprite(STORY_BG[p->bg]), 0, VIEW_TOP, 0);
    box(8, 148, SCR_W - 16, 80);
    ctext(152, p->title, RGB(255, 225, 77), 1);
    wrap_text(16, 164, p->body, RGB(230, 230, 236), 36, 4);
    ctext(216, last ? "A: CONTINUE" : "A: NEXT    B: SKIP", RGB(154, 154, 168), 1);
}

/* ------------------------------------------------------------------ Bone Merchant (web/game/00_core.js shopRows / buy) */
enum { SK_BONE, SK_QUARTZ, SK_GARNET, SK_DIAMOND, SK_POWDER, SK_UNLOCK };
typedef struct { int kind, ul, price, can; const char *name; } ShopRow;
static ShopRow shop_rows[40];
static int shop_n, shop_i;
static int gem_heal(void) { int h = (int)(max_hp + 0.5f); return h < 1 ? 1 : (h + 3) / 4; }
#define GEM_FILL 25
static void shop_add(int kind, int ul, int price, int can, const char *name) {
    if(shop_n >= 40) return;
    shop_rows[shop_n].kind = kind; shop_rows[shop_n].ul = ul; shop_rows[shop_n].price = price; shop_rows[shop_n].can = can; shop_rows[shop_n].name = name;
    shop_n++;
}
static void shop_build(void) {
    int i;
    shop_n = 0;
    shop_add(SK_BONE, -1, 8, gem_bag[0] < MAX_GEM_BAG && leaves >= 8, "BONE");
    if(meter_on(M_ENERGY)) shop_add(SK_QUARTZ, -1, 12, gem_bag[1] < MAX_GEM_BAG && leaves >= 12, "QUARTZ");
    if(meter_on(M_EMPOWER)) shop_add(SK_GARNET, -1, 12, gem_bag[2] < MAX_GEM_BAG && leaves >= 12, "GARNET");
    if(meter_on(M_SUPER)) shop_add(SK_DIAMOND, -1, 30, gem_bag[3] < MAX_GEM_BAG && leaves >= 30, "DIAMOND");
    if(max_hp < 200.0f) shop_add(SK_POWDER, -1, 90, leaves >= 90, "BONE POWDER");
    for(i = 0; i < UL_COUNT; i++) {
        if(has(i) || UNLOCKS[i].level > levels_unlocked) continue;
        shop_add(SK_UNLOCK, i, UNLOCKS[i].price, leaves >= UNLOCKS[i].price, UNLOCKS[i].name);
    }
    if(shop_i >= shop_n) shop_i = shop_n ? shop_n - 1 : 0;
    if(shop_i < 0) shop_i = 0;
}
static void shop_buy(void) {
    ShopRow *r;
    if(!shop_n) return;
    r = &shop_rows[shop_i];
    if(!r->can || leaves < r->price) { say("CANNOT BUY THAT", 1600); return; }
    leaves -= r->price;
    if(r->kind == SK_BONE && gem_bag[0] < MAX_GEM_BAG) gem_bag[0]++;
    else if(r->kind == SK_QUARTZ && gem_bag[1] < MAX_GEM_BAG) gem_bag[1]++;
    else if(r->kind == SK_GARNET && gem_bag[2] < MAX_GEM_BAG) gem_bag[2]++;
    else if(r->kind == SK_DIAMOND && gem_bag[3] < MAX_GEM_BAG) gem_bag[3]++;
    else if(r->kind == SK_POWDER) { max_hp += 25.0f; if(max_hp > 200.0f) max_hp = 200.0f; if(hp > max_hp) hp = max_hp; }
    else if(r->kind == SK_UNLOCK && r->ul >= 0) { unlocked |= 1u << r->ul; recompute_unlocks(); }
    say("BOUGHT", 1200);
    shop_build();
}
static void draw_shop(void) {
    int i, first, y, shown = 0;
    draw_drifting(0.008f);
    gfx_clip(0, SCR_H);
    ctext(4, "BONE MERCHANT", RGB(255, 225, 77), 2);
    gfx_text(8, 24, "LEAVES", RGB(255, 210, 74)); gfx_num(64, 24, (u32)leaves, RGB(255, 255, 255));
    first = shop_i - 7; if(first < 0) first = 0;
    if(shop_n > 16 && first + 16 > shop_n) first = shop_n - 16;
    y = 40;
    for(i = first; i < shop_n && shown < 16; i++, shown++) {
        u16 c = i == shop_i ? RGB(255, 225, 77) : shop_rows[i].can ? RGB(230, 230, 236) : RGB(120, 120, 130);
        if(i == shop_i) gfx_text(4, y, ">", c);
        gfx_text(16, y, shop_rows[i].name, c);
        gfx_num(250, y, (u32)shop_rows[i].price, c);
        y += 10;
    }
    if(!shop_n) gfx_text(16, 48, "NOTHING FOR SALE", RGB(154, 154, 168));
    gfx_text(8, 224, "A: BUY    B: LEAVE", RGB(154, 154, 168));
    if(now < banner_until) ctext(200, banner, RGB(255, 210, 74), 1);
}
static int use_item(int k) {
    int m;
    if(k == 0) {
        if(gem_bag[0] < 1 || hp >= max_hp) return 0;
        gem_bag[0]--; hp += (float)gem_heal(); if(hp > max_hp) hp = max_hp; return 1;
    }
    m = k - 1;
    if(k < 1 || k > 3 || gem_bag[k] < 1 || !meter_on(m) || meter[m] >= meter_max[m]) return 0;
    gem_bag[k]--; meter[m] += GEM_FILL; if(meter[m] > meter_max[m]) meter[m] = meter_max[m];
    meter_flash[m] = now + 400.0f;
    return 1;
}
static void draw_item_menu(void) {
    static const char *nm[4] = {"BONE", "QUARTZ", "GARNET", "DIAMOND"};
    int i;
    gfx_dim(VIEW_TOP, VIEW_TOP + VIEW_SCR_H);
    box(20, 36, SCR_W - 40, 150);
    ctext(44, "ITEMS", RGB(255, 225, 77), 2);
    for(i = 0; i < 4; i++) {
        u16 c = i == item_i ? RGB(255, 225, 77) : RGB(230, 230, 236);
        if(i == item_i) gfx_text(32, 72 + i * 16, ">", c);
        gfx_text(48, 72 + i * 16, nm[i], c);
        gfx_num(200, 72 + i * 16, (u32)gem_bag[i], c);
    }
    ctext(168, "A: USE    B: BACK", RGB(154, 154, 168), 1);
}
static void new_game(void) { reset_progress(); title_menu = 0; begin_story(ST_PROLOGUE, ST_AFTER_OW); }

void game_init(void) {
    int i;
    FALL_K = 0; LAND_K = 0;
    for(i = 1; i < nframes(MV_jump); i++) if(mf(MV_jump, i)->ry < mf(MV_jump, i - 1)->ry) { FALL_K = i; break; }
    for(i = FALL_K + 1; i < nframes(MV_jump); i++) if(mf(MV_jump, i)->ry == 0) { LAND_K = i; break; }
    rd_reset();
    unlocked = 0; recompute_unlocks();
#ifdef UNLOCK_ALL                                       /* test builds: every unlock and full meters */
    unlocked = (1u << UL_COUNT) - 1; recompute_unlocks(); meter[0] = meter[1] = 50; meter[2] = 100;
#endif
    hp = max_hp;
    screen = SCN_TITLE;
#ifndef AUTOTEST
    load_game();
#endif
#ifdef AUTOTEST
    screen = SCN_LEVEL;
#endif
#ifdef START_LEVEL                                      /* test builds: start in the given level and map (make CFLAGS_EXTRA='-DAUTOTEST -DSTART_LEVEL=1 -DSTART_MAP=9') */
    start_level(START_LEVEL); load_map(START_LEVEL, START_MAP, 1);
#else
    start_level(0);
#endif
    if(screen == SCN_TITLE) { cur_map = &MAPS[0]; level_idx = 0; map_idx = 0; }
}

static void pick_music(void) {                 /* which track belongs to what is on screen (web/game/19_overworld.js wantedTrack) */
    int t = TRK_OVERWORLD;
    if(screen == SCN_LEVEL) t = gameover_on ? -1 : cur_map->boss ? TRK_BOSS1 + level_idx : TRK_LEVEL1 + level_idx;
    audio_want(t);
}

static int menu_i, move_i, move_show, move_n;
typedef struct { short move; char pad[32], title[18], how[16]; } MoveRow;
static MoveRow move_rows[40];
static int str_eq(const char *a, const char *b) { while(*a && *a == *b) { a++; b++; } return *a == 0 && *b == 0; }
static void str_put(char *d, int cap, const char *s) { int i = 0; if(cap < 1) return; while(s[i] && i < cap - 1) { d[i] = s[i]; i++; } d[i] = 0; }
static void step_text(unsigned mask, char *d, int cap) {
    static const unsigned bits[10] = {BTN_UP, BTN_DOWN, BTN_LEFT, BTN_RIGHT, BTN_A, BTN_B, BTN_X, BTN_Y, BTN_L, BTN_R};
    static const char *nm[10] = {"UP", "DOWN", "LEFT", "RIGHT", "A", "B", "X", "Y", "L", "R"};
    int i, p = 0, any = 0;
    for(i = 0; i < 10; i++) if(mask & bits[i]) {
        const char *s = nm[i];
        if(any && p < cap - 1) d[p++] = '+';
        while(*s && p < cap - 1) d[p++] = *s++;
        any = 1;
    }
    d[p] = 0;
}
static void seq_text(const Binding *b, char *out, int cap) {
    char tok[6][12];
    int i, p = 0;
    for(i = 0; i < b->nsteps && i < 6; i++) step_text(b->steps[i], tok[i], 12);
    i = 0;
    while(i < b->nsteps && i < 6) {
        int run = 1;
        const char *s;
        while(i + run < b->nsteps && i + run < 6 && str_eq(tok[i], tok[i + run])) run++;
        if(p && p < cap - 1) out[p++] = ',';
        s = tok[i]; while(*s && p < cap - 1) out[p++] = *s++;
        if(run > 1 && p < cap - 3) { out[p++] = ' '; out[p++] = 'x'; out[p++] = (char)('0' + run); }
        i += run;
    }
    out[p] = 0;
}
static void fold_dir(const char *s, char *d, int cap) {
    int o = 0;
    while(*s && o < cap - 1) {
        if(s[0] == 'L' && s[1] == 'E' && s[2] == 'F' && s[3] == 'T') { d[o++] = '#'; s += 4; }
        else if(s[0] == 'R' && s[1] == 'I' && s[2] == 'G' && s[3] == 'H' && s[4] == 'T') { d[o++] = '#'; s += 5; }
        else d[o++] = *s++;
    }
    d[o] = 0;
}
static void unify_dir(char *s) {
    char tmp[32];
    int o = 0;
    const char *p = s;
    while(*p && o < 31) {
        if(p[0] == 'L' && p[1] == 'E' && p[2] == 'F' && p[3] == 'T') { tmp[o++] = 'L'; tmp[o++] = '/'; tmp[o++] = 'R'; p += 4; }
        else if(p[0] == 'R' && p[1] == 'I' && p[2] == 'G' && p[3] == 'H' && p[4] == 'T') { tmp[o++] = 'L'; tmp[o++] = '/'; tmp[o++] = 'R'; p += 5; }
        else tmp[o++] = *p++;
    }
    tmp[o] = 0;
    str_put(s, 32, tmp);
}
static void short_title(int mv, const char *over, char *d) {
    const char *s = over ? over : mv == MV_ULTIMATE ? "ULTIMATE" : MOVES[mv].title;
    int i = 0;
    for(; s[i] && s[i] != '(' && i < 16; i++) { char c = s[i]; if(c >= 'a' && c <= 'z') c = (char)(c - 32); d[i] = c; }
    while(i > 0 && d[i - 1] == ' ') i--;
    d[i] = 0;
}
static const char *how_of(const Binding *b) {
    if(b->move == MV_energy_burst || b->move == MV_energy_wave || b->move == MV_energy_kick || b->move == MV_energy_dash_thrust) return "HOLD, LET GO";
    if(b->release_into >= 0) return "HOLD, LET GO";
    if(b->type == BT_TAP) return "TAP";
    if(b->type == BT_HOLD) return "HOLD";
    if(b->type == BT_AIR) return "IN AIR";
    if(b->type == BT_CHORD) return "TOGETHER";
    if(b->type == BT_SEQ) return "IN ORDER";
    return "PRESS";
}
static void add_move_row(int mv, const char *pad, const char *title, const char *how) {
    int i;
    char fa[32], fb[32];
    if(move_n >= 40) return;
    if(mv >= 0) for(i = 0; i < move_n; i++) if(move_rows[i].move == mv) {
        fold_dir(move_rows[i].pad, fa, 32); fold_dir(pad, fb, 32);
        if(str_eq(fa, fb)) { str_put(move_rows[i].pad, 32, pad); unify_dir(move_rows[i].pad); }
        return;
    }
    move_rows[move_n].move = (short)mv;
    str_put(move_rows[move_n].pad, 32, pad);
    short_title(mv, title, move_rows[move_n].title);
    str_put(move_rows[move_n].how, 16, how);
    move_n++;
}
static void add_binding(const Binding *b) {
    char pad[32];
    if(b->type == BT_IDLE || b->nsteps < 1 || !bind_open(b)) return;
    if(b->move == MV_jump) { add_move_row(MV_jump, "UP", 0, "PRESS"); return; }
    if(b->type == BT_SEQ) seq_text(b, pad, 32); else step_text(b->steps[0], pad, 32);
    add_move_row(b->move, pad, 0, how_of(b));
}
static void build_moves(void) {
    int i;
    move_n = 0;
    for(i = 0; i < N_BIND_OTHER; i++) add_binding(&BIND_OTHER[i]);
    for(i = 0; i < N_BIND_CHORDS; i++) add_binding(&BIND_CHORDS[i]);
    for(i = 0; i < N_BIND_SEQS; i++) add_binding(&BIND_SEQS[i]);
    if(has(UL_METER_CHARGE)) add_move_row(-2, "DOWN+L+R", "METER CHARGE", "HOLD");
    if(has(UL_CHAIN)) add_move_row(-3, "A x5", "CHAIN", "PRESS");
    if(has(UL_CHAIN_BURST)) add_move_row(-4, "A x4, B", "BURST CHAIN", "IN ORDER");
    if(has(UL_FLY)) add_move_row(-5, "A,B,A,B,UP", "FLIGHT", "IN ORDER");
    if(has(UL_RAINBOW)) add_move_row(-6, "A,B,A,B,A,B", "RAINBOW", "IN ORDER");
    if(has(UL_DOUBLE_JUMP)) add_move_row(-7, "UP,UP", "DOUBLE JUMP", "IN AIR");
}
static void draw_moves(void) {
    int i, first, shown = 0, y;
    gfx_dim(VIEW_TOP, VIEW_TOP + VIEW_SCR_H);
    box(8, 24, SCR_W - 16, 188);
    ctext(28, "MOVES", RGB(255, 225, 77), 2);
    first = move_i - 6; if(first < 0) first = 0;
    if(move_n > 13 && first + 13 > move_n) first = move_n - 13;
    y = 48;
    for(i = first; i < move_n && shown < 13; i++, shown++) {
        u16 c = i == move_i ? RGB(255, 225, 77) : RGB(230, 230, 236);
        if(i == move_i) gfx_text(12, y, ">", c);
        gfx_text(24, y, move_rows[i].pad, c);
        gfx_text(168, y, move_rows[i].title, c);
        y += 10;
    }
    if(!move_n) gfx_text(16, 56, "NO MOVES", RGB(154, 154, 168));
    else if(move_show) gfx_text(16, 188, move_rows[move_i].how, RGB(255, 210, 74));
    gfx_text(16, 200, "B: BACK    Y: HOW", RGB(154, 154, 168));
}
static void draw_pause_list(void) {
    static const char *items[4] = {"RESUME", "MOVES", "ITEMS", "SAVE"};
    int i;
    gfx_dim(VIEW_TOP, VIEW_TOP + VIEW_SCR_H);
    box(48, 48, SCR_W - 96, 120);
    ctext(56, "PAUSED", RGB(255, 225, 77), 2);
    for(i = 0; i < 4; i++) {
        u16 c = i == menu_i ? RGB(255, 225, 77) : RGB(230, 230, 236);
        if(i == menu_i) gfx_text(72, 84 + i * 16, ">", c);
        gfx_text(88, 84 + i * 16, items[i], c);
    }
    gfx_text(64, 152, "A: PICK  START: RESUME", RGB(154, 154, 168));
}

void game_frame(u16 raw, u32 frame_us, u32 draw_us) {
    float rx, ry, before, dt = FRAME_MS;
    int i;
    pick_music();
#if defined(AUTOTEST) && !defined(MOVETEST)             /* test build: a bot plays (walk to the nearest enemy, slash, go right when the door is open) */
    {
        static u32 fc; int j; float tx = 1e9f, px = player_x();
        raw = 0xffff; fc++;
#ifdef KILLALL
        if(fc == 120) for(j = 0; j < MAX_ENEMIES; j++) if(alive(&en[j])) kill_q(&en[j], 1);       /* test: clear the map to reach the level-complete screen */
        if(fc == 120) for(j = 0; j < cur_map->ncrate; j++) crate_broken[j] = 1;
#endif
        for(j = 0; j < MAX_ENEMIES; j++) if(alive(&en[j]) && fabsf_(en[j].x - px) < fabsf_(tx - px)) tx = en[j].x;
        if(tx > 1e8f) raw &= ~PAD_RIGHT;
        else if(fabsf_(tx - px) > 45.0f) raw &= (tx > px ? ~PAD_RIGHT : ~PAD_LEFT);
        else { if(tx < px) raw &= ~PAD_LEFT; else raw &= ~PAD_RIGHT; if((fc % 25) == 0) raw &= ~PAD_A; }
        for(j = 0; j < cur_map->ncrate; j++) { const Crate *q = &CRATES[cur_map->crate0 + j]; if(!crate_broken[j] && q->x - px > 0 && q->x - px < 40.0f && fabsf_(q->fy - floor_y) < 2 && (fc % 25) == 0) raw &= ~PAD_A; }     /* a crate ahead: slash it */
        for(j = 0; j < cur_map->npit; j++) { const Pit *q = &PITS[cur_map->pit0 + j]; if(q->x0 - px > -2 && q->x0 - px < 30.0f && floor_y == 0 && (fc % 70) == 0) raw &= ~PAD_UP; }     /* a pit ahead: jump it */
        for(j = 0; j < MAX_ENEMIES; j++) if(alive(&en[j]) && en[j].fy > floor_y + 5 && fabsf_(en[j].x - px) < 70.0f && (fc % 90) == 0) raw &= ~PAD_UP;     /* an enemy above: jump */
    }
#endif
    pad.prev = pad.held;
    pad.held = (raw == 0xffff) ? 0 : (u16)(~raw & 0x3fff);  /* a 0 bit in the raw word is a pressed button */
    pad_raw = 0;                                           /* the same buttons in the reader's BTN_ bits */
    if(pad.held & PAD_UP) pad_raw |= BTN_UP;
    if(pad.held & PAD_DOWN) pad_raw |= BTN_DOWN;
    if(pad.held & PAD_LEFT) pad_raw |= BTN_LEFT;
    if(pad.held & PAD_RIGHT) pad_raw |= BTN_RIGHT;
    if(pad.held & PAD_A) pad_raw |= BTN_A;
    if(pad.held & PAD_B) pad_raw |= BTN_B;
    if(pad.held & PAD_X) pad_raw |= BTN_X;
    if(pad.held & PAD_Y) pad_raw |= BTN_Y;
    if(pad.held & PAD_L) pad_raw |= BTN_L;
    if(pad.held & PAD_R) pad_raw |= BTN_R;
    if(!(screen == SCN_LEVEL && freeze_ms > 0 && !paused && !gameover_on && !level_done)) { now += dt; clock_ms = (u32)now; }
#ifdef GODMODE
    if(hp < max_hp * 0.5f) hp = max_hp;
#endif
#ifdef MOVETEST
    if(screen == SCN_LEVEL && !training_on) { if(meter[0] < 30) meter[0] = 50; if(meter[1] < 30) meter[1] = 50; }       /* test: the energy and empower meters never run dry */
#endif
    if(training_on && screen == SCN_LEVEL) { hp = max_hp; meter[0] = meter_max[0]; meter[1] = meter_max[1]; meter[2] = meter_max[2]; }
    if(screen == SCN_STORY) {
        draw_story();
        if(pressed_now(PAD_A) || pressed_now(PAD_START)) { if(story_page + 1 >= story_len()) story_finish(); else story_page++; }
        else if(pressed_now(PAD_B)) story_finish();
        return;
    }
    if(screen == SCN_TITLE) {
        draw_title();
        if(!title_menu) {
            if((pressed_now(PAD_START) || pressed_now(PAD_A))) { if(has_save) { title_menu = 1; title_pick = 0; } else new_game(); }
        } else {
            if(pressed_now(PAD_UP) || pressed_now(PAD_DOWN)) title_pick ^= 1;
            if(pressed_now(PAD_A) || pressed_now(PAD_START)) { if(title_pick == 0) go_overworld(); else new_game(); }
            if(pressed_now(PAD_B)) title_menu = 0;
            ctext(168, title_pick == 0 ? "> CONTINUE" : "  CONTINUE", RGB(255, 255, 255), 1);
            ctext(180, title_pick == 1 ? "> NEW GAME" : "  NEW GAME", RGB(255, 255, 255), 1);
        }
        return;
    }
    if(screen == SCN_SHOP) {
        if(pressed_now(PAD_UP) && shop_i > 0) shop_i--;
        if(pressed_now(PAD_DOWN) && shop_i + 1 < shop_n) shop_i++;
        if(pressed_now(PAD_A)) shop_buy();
        if(pressed_now(PAD_B) || pressed_now(PAD_START)) screen = SCN_OVERWORLD;
        draw_shop();
        return;
    }
    if(screen == SCN_OVERWORLD) {
        if(pressed_now(PAD_RIGHT) && ow_sel < NUM_LEVELS - 1) ow_sel++;
        if(pressed_now(PAD_LEFT) && ow_sel > 0) ow_sel--;
        if(pressed_now(PAD_Y)) { shop_build(); shop_i = 0; screen = SCN_SHOP; draw_shop(); return; }
        if(pressed_now(PAD_X)) { enter_training(); return; }
        if(pressed_now(PAD_A) || pressed_now(PAD_START)) enter_level(ow_sel);
        draw_overworld();
        return;
    }
    if(screen == SCN_LEVEL && story_at > 0 && now >= story_at) { story_at = 0; begin_story(ST_DOUBLE, ST_AFTER_LEVEL); draw_story(); return; }
    if(paused || gameover_on || level_done) {                                  /* the world holds still under a menu */
        if(level_done) { if(pressed_now(PAD_A) || pressed_now(PAD_START)) { go_overworld(); return; } }
        else if(gameover_on) { if(pressed_now(PAD_A) || pressed_now(PAD_START)) { gameover_on = 0; retry_map(); return; } if(pressed_now(PAD_B)) { go_overworld(); return; } }
        else if(pressed_now(PAD_START)) { paused = 0; menu_page = 0; }
        else if(menu_page == 2) {
            if(pressed_now(PAD_UP) && move_i > 0) move_i--;
            if(pressed_now(PAD_DOWN) && move_i + 1 < move_n) move_i++;
            if(pressed_now(PAD_Y)) move_show ^= 1;
            if(pressed_now(PAD_B)) { menu_page = 0; move_show = 0; }
        } else if(menu_page == 1) {
            if(pressed_now(PAD_UP) && item_i > 0) item_i--;
            if(pressed_now(PAD_DOWN) && item_i < 3) item_i++;
            if(pressed_now(PAD_A)) use_item(item_i);
            if(pressed_now(PAD_B)) menu_page = 0;
        } else {
            if(pressed_now(PAD_UP) && menu_i > 0) menu_i--;
            if(pressed_now(PAD_DOWN) && menu_i < 3) menu_i++;
            if(pressed_now(PAD_Y)) { menu_page = 1; item_i = 0; }
            else if(pressed_now(PAD_A)) {
                if(menu_i == 0) paused = 0;
                else if(menu_i == 1) { build_moves(); move_i = 0; move_show = 0; menu_page = 2; }
                else if(menu_i == 2) { menu_page = 1; item_i = 0; }
                else save_game();
            }
        }
        draw_scene(); draw_hud(frame_us, draw_us);
        if(level_done) {
            char buf[40] = "LEVEL N COMPLETE";
            buf[6] = (char)('1' + level_idx);
            overlay(buf, level_idx + 1 < NUM_LEVELS ? "THE NEXT LEVEL IS NOW OPEN" : "YOU BEAT THE LAST LEVEL", "A: BACK TO THE OVERWORLD");
        } else if(gameover_on) overlay("GAME OVER", ankhs < 1 ? "NO ANKHS: THE LEVEL STARTS OVER" : "A: RETRY (USES 1 ANKH)", "B: OVERWORLD");
        else if(!paused) { }
        else if(menu_page == 2) draw_moves();
        else if(menu_page == 1) draw_item_menu();
        else draw_pause_list();
        if(now < save_msg_until) ctext(210, save_msg, RGB(160, 180, 230), 1);
        return;
    }
    if(pressed_now(PAD_START)) { paused = 1; menu_page = 0; menu_i = 0; ignore_until_up = 0; return; }
    if(freeze_ms > 0) {                                                        /* hit-stop: the world holds still (presses made now are still read) */
        freeze_ms -= dt; read_buttons(now); draw_scene(); draw_hud(frame_us, draw_us);
        return;
    }
    /* buttons -> moves (web/game/17_menus.js tickLevel); none while she is falling into a pit */
    if(!pit_fall_on) {
        MoveEvent ev[16];
        int n, j;
        read_buttons(now);
        n = rd_update(now, ev);
        for(j = 0; j < n; j++) {
            int via = ev[j].via, mvn = ev[j].move;
            if(mvn == MV_ULTIMATE) { start_ultimate(); continue; }
            if(mvn == MV_slash && via == VIA_TAP) via = VIA_PRESS;
            if(mvn == MV_slash && via == VIA_PRESS && chain_press()) continue;
            if(mvn == MV_parry && via == VIA_TAP && chain_burst()) continue;
            request(mvn, via);
        }
        chain_tick(); ult_tick();
    }
    before = player_x();
    if(!pit_fall_on) {
        step(dt, now);
        {   /* turning mirrors the sprite about her anchor, but the point between her legs sits LEGS px ahead of it: move the anchor so that point stays put */
            static int vis_face = 1;
            int vf = her_face();
            if(vf != vis_face) {
                if(!stun_on) { float sh = (float)(vis_face - vf) * 19.0f, ax = player_x() + sh; if(!(ax < EDGE + 2 || ax > MAP_W - EDGE - 2)) X += sh; }
                vis_face = vf;
            }
        }
        if(has_cur && cur.crash && cur.id == MV_jump && cur.kind == K_ACTION) { float rx2, ry2; root_of(&cur, cur.k, &rx2, &ry2); if(ry2 > 0) air_crash(VIA_AIR); }
        block_move(before);
        if(physics()) goto drawn;
        if(flight_on && (stun_on || !(has_cur && cur.id == MV_jump && cur.phys))) flight_on = 0;
        if(rainbow_active && !rainbow_on()) rainbow_active = 0;
        check_pit();
        if(!fall_on && (!has_cur || cur.kind == K_HOLD || cur.kind == K_LAND || (cur.id == MV_jump && cur.kind == K_ACTION && !cur.phys))) dbl_used = 0;       /* back on her feet */
    }
    ko_check();
    if(!pit_fall_on) { beam_hits(); step_heal(dt); }
    if(training_on) step_bag(dt);
    step_effects(dt);
    step_shots(dt);
    if(!pit_fall_on) step_bombs();
    for(i = 0; i < MAX_ENEMIES; i++) if(en[i].on) step_enemy(&en[i], dt);
    if(!pit_fall_on) resolve_hits();
    enemy_attacks();
    step_gems(dt); step_parts(dt);
    for(i = 0; i < MAX_ENEMIES; i++) if(en[i].on && en[i].state == S_DYING && en[i].dead > DIE_MS) en[i].on = 0;
    if(pit_fall_on && pit_sink() > (float)(VIEW_H - FEET_ROW) + her_top() * SS + 8.0f) { gameover_on = 1; goto drawn; }      /* she dropped out of sight: Game Over */
    root_of(&cur, cur.k, &rx, &ry);
    ry = her_y();
    camY += ((ry - CAM_KEEP > 0 ? ry - CAM_KEEP : 0) - camY) * 0.2123f;          /* 1 - exp(-dt / 70) at 60 fps */

    draw_scene();
drawn:
    draw_hud(frame_us, draw_us);
}

