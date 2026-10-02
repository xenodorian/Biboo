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
    if(((int)(now / 500.0f)) & 1) ctext(180, "PRESS START", RGB(255, 255, 255), 1);
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
    gfx_text(24, 220, open ? "A: PLAY  LEFT/RIGHT: CHOOSE" : "LEFT/RIGHT: CHOOSE", RGB(154, 154, 168));
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
    if(screen == SCN_LEVEL) save_game();                    /* web: goOverworld syncs and saves the progress */
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
    if(screen == SCN_LEVEL) { if(meter[0] < 30) meter[0] = 50; if(meter[1] < 30) meter[1] = 50; }       /* test: the energy and empower meters never run dry */
#endif
    if(screen == SCN_TITLE) {
        draw_title();
        if(pressed_now(PAD_START) || pressed_now(PAD_A)) go_overworld();
        return;
    }
    if(screen == SCN_OVERWORLD) {
        if(pressed_now(PAD_RIGHT) && ow_sel < NUM_LEVELS - 1) ow_sel++;
        if(pressed_now(PAD_LEFT) && ow_sel > 0) ow_sel--;
        if(pressed_now(PAD_A) || pressed_now(PAD_START)) enter_level(ow_sel);
        draw_overworld();
        return;
    }
    if(paused || gameover_on || level_done) {                                  /* the world holds still under a menu */
        if(level_done) { if(pressed_now(PAD_A) || pressed_now(PAD_START)) { go_overworld(); return; } }
        else if(gameover_on) { if(pressed_now(PAD_A) || pressed_now(PAD_START)) { gameover_on = 0; retry_map(); return; } if(pressed_now(PAD_B)) { go_overworld(); return; } }
        else { if(pressed_now(PAD_START) || pressed_now(PAD_A)) paused = 0; if(pressed_now(PAD_B)) { go_overworld(); return; } }
        draw_scene(); draw_hud(frame_us, draw_us);
        if(level_done) {
            char buf[40] = "LEVEL N COMPLETE";
            buf[6] = (char)('1' + level_idx);
            overlay(buf, level_idx + 1 < NUM_LEVELS ? "THE NEXT LEVEL IS NOW OPEN" : "YOU BEAT THE LAST LEVEL", "A: BACK TO THE OVERWORLD");
        } else if(gameover_on) overlay("GAME OVER", ankhs < 1 ? "NO ANKHS: THE LEVEL STARTS OVER" : "A: RETRY (USES 1 ANKH)", "B: OVERWORLD");
        else overlay("PAUSED", "A OR START: RESUME", "B: OVERWORLD");
        return;
    }
    if(pressed_now(PAD_START)) { paused = 1; ignore_until_up = 0; return; }
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

