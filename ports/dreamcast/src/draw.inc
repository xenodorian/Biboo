/* ------------------------------------------------------------------ drawing */
static void draw_tiled(int sprite, int period, int margin, float par, int bgx, float camy) {
    int dx = -iround((float)bgx * par), x0 = ((dx % period) + period) % period - period, xx;     /* web/game/14_draw_player.js drawLayer */
    int sy = VIEW_TOP + v2s(iround(camy * par) - margin);
    const Sprite *sp = art_sprite(sprite);
    for(xx = x0; xx < VIEW_W; xx += period) gfx_blit(sp, v2s(xx), sy, 0);
}
static int scene_bgx(void) { return ANCHOR_X + map_idx * MAP_W; }       /* the scenery carries on from map to map */
static void draw_layers(float camy) {
    const Scene *sc = &SCENES[cur_map->scene];
    int i;
    gfx_clip(VIEW_TOP, VIEW_TOP + VIEW_SCR_H);
    for(i = 0; i < sc->nlayers; i++) draw_tiled(sc->layers[i].sprite, sc->layers[i].period, sc->layers[i].margin, sc->layers[i].parallax, scene_bgx(), camy);
}
static void draw_fringe(float camy) {
    const Scene *sc = &SCENES[cur_map->scene];
    gfx_clip(VIEW_TOP, VIEW_TOP + VIEW_SCR_H);
    if(sc->fringe >= 0) draw_tiled(sc->fringe, sc->fringe_period, VIEW_MARGIN, 1.0f, scene_bgx(), camy);     /* none over a boss arena picture */
}

static int ground_row(void) { return VIEW_TOP + v2s(FEET_ROW + iround(camY)); }     /* screen row of the ground line */
static float fcos(float a) { return fsin(a + 1.5707963f); }
static int shake_x, shake_y;                           /* this frame's shake in view px, applied to the whole scene when it is finished */
static int her_tint_now(u16 *c, int *a) {              /* her flash: red hit, white block, the rainbow guard, the blue charge glow */
    if(rainbow_on()) {                                 /* hsl(h, 100%, 50%) cycling every 450 ms */
        float h = (float)(((int)(now - rainbow_until + RAINBOW_MS)) % 450) / 450.0f * 6.0f;
        int k = (int)h, f = (int)((h - (float)k) * 255.0f);
        static const u8 R[6] = {255, 0, 0, 0, 0, 0};
        (void)R;
        switch(k) { case 0: *c = RGB(255, f, 0); break; case 1: *c = RGB(255 - f, 255, 0); break; case 2: *c = RGB(0, 255, f); break; case 3: *c = RGB(0, 255 - f, 255); break; case 4: *c = RGB(f, 0, 255); break; default: *c = RGB(255, 0, 255 - f); break; }
        *a = 153; return 1;
    }
    if(now < her_tint_until) { *c = her_tint_c; *a = her_tint_a; return 1; }
    if(has_cur && cur.id == MV_charge && charge_ms >= FULL_CHARGE) { *c = RGB(47, 123, 255); *a = 128; return 1; }     /* Max turns blue once the charge is complete */
    return 0;
}
static void vrect(int x, int y, int w, int h, u16 c);
static void ring(int cx, int cy, int R, u16 c);
static void draw_beam(void) {
    BeamNow b;
    int off, xx, w, x0, x1, bx, by;
    const BeamDef *T;
    const Sprite *sp;
    if(!beam_now(&b)) return;
    T = &BEAMS[b.kind]; sp = art_sprite(T->sprite);
    w = T->w; off = (int)(now * 0.45f) % w;
    bx = b.ox; by = FEET_ROW + iround(camY) - iround(b.oy);
    if(b.face > 0) { x0 = v2s(bx); x1 = v2s(bx + (int)b.len); } else { x0 = v2s(bx - (int)b.len); x1 = v2s(bx); }
    gfx_clip(VIEW_TOP, VIEW_TOP + VIEW_SCR_H); gfx_clip_x(x0, x1);
    for(xx = off - w; xx < (int)b.len; xx += w) gfx_blit_alpha(sp, v2s(b.face > 0 ? bx + xx : bx - xx), VIEW_TOP + v2s(by), b.face < 0, b.last ? 153 : 255);
    gfx_clip_x(0, SCR_W);
}
static void draw_player(void) {
    float rx = 0, ry;
    int vx, vy, flip, sx, sy;
    const MoveFrame *f;
    u16 tc; int ta, tint;
    if(now < invuln && !stun_on && !pit_fall_on && !rainbow_on() && ((int)(now / 60.0f) & 1)) return;       /* blink while she cannot be hurt */
    if(!(stun_on || fall_on || cur.kind == K_FALL)) { float t; root_of(&cur, cur.k, &rx, &t); }
    ry = her_y();
    f = mf(cur.id, cur.k);
    vx = iround(X + rx);                                   /* the camera x is fixed at ANCHOR_X, so world x is view x */
    vy = FEET_ROW - iround(ry - camY);
    flip = cur.face < 0;
    tint = her_tint_now(&tc, &ta);
    sx = v2s(vx); sy = VIEW_TOP + v2s(vy);
    if(pit_fall_on) {                                      /* falling into a pit: drawn only above the ground line or below it inside the hole */
        int gl = ground_row();
        gfx_clip(VIEW_TOP, gl); gfx_blit(art_sprite(f->sprite), sx, sy, flip);
        gfx_clip(gl, VIEW_TOP + VIEW_SCR_H); gfx_blit(art_sprite(f->sprite), sx, sy, flip);
        gfx_clip(VIEW_TOP, VIEW_TOP + VIEW_SCR_H);
        return;
    }
    if(f->fx >= 0) {                                       /* effects at their own scale, behind Max */
        int gone_main = cur.id == MV_energy_wave && cur.blast[cur.face > 0 ? 1 : 0] && cur.k >= 2;
        int gone_back = cur.id == MV_energy_wave && cur.blast[cur.face > 0 ? 0 : 1] && cur.k >= 2;
        int fxx = sx, fxy = sy;
        if(cur.id == MV_energy_burst) { fxx += v2s((int)(-16.0f * (float)cur.face)); fxy += v2s(18); }      /* keep the enlarged ring centred on Max's body */
        if(!gone_main) gfx_blit_alpha(art_sprite(f->fx), fxx, fxy, flip, 255);
        if(cur.id == MV_energy_wave && !gone_back) gfx_blit_alpha(art_sprite(f->fx), fxx, fxy, !flip, 255);
    }
    if(tint) gfx_blit_tint(art_sprite(f->sprite), sx, sy, flip, tc, ta);
    else gfx_blit(art_sprite(f->sprite), sx, sy, flip);
}

/* the map's pits, platforms and door (web/game/15_draw_scenery.js drawGeometry and drawPits), view pixels converted to screen */
static void vrect(int x, int y, int w, int h, u16 c) {
    int sx = v2s(x), sy = VIEW_TOP + v2s(y), ex = v2s(x + w), ey = VIEW_TOP + v2s(y + h);
    if(ex <= sx) ex = sx + 1;
    if(ey <= sy) ey = sy + 1;
    gfx_rect(sx, sy, ex - sx, ey - sy, c);
}
static void draw_geometry(void) {
    int i, k, gy = FEET_ROW + iround(camY);                 /* view row of the ground line */
    int open = door_open(), gx = VIEW_W - 10;
    gfx_clip(VIEW_TOP, VIEW_TOP + VIEW_SCR_H);
    for(i = 0; i < cur_map->npit; i++) {
        const Pit *p = &PITS[cur_map->pit0 + i];
        int x0 = p->x0, w = p->x1 - p->x0, top = gy - 5;
        vrect(x0, top, w, VIEW_H - top + 40, RGB(5, 3, 10));
        for(k = top + 10; k < VIEW_H; k += 14) vrect(x0, k, w, 3, RGB(27, 16, 36));                  /* dark bands: a deep shaft */
        vrect(x0 - 2, top, 2, 10, RGB(107, 74, 42)); vrect(x0 + w, top, 2, 10, RGB(107, 74, 42));   /* the dirt rim */
        vrect(x0 - 3, top - 1, 3, 2, RGB(63, 143, 58)); vrect(x0 + w, top - 1, 3, 2, RGB(63, 143, 58));
        for(k = 0; k < w; k += 8) vrect(x0 + k + 2, top + 1, 3, 2, RGB(200, 180, 224));            /* teeth of the hole */
    }
    for(i = 0; i < cur_map->nplat; i++) {                  /* platforms: a plank on two posts */
        const Plat *p = &PLATS[cur_map->plat0 + i];
        int x0 = p->x0, w = p->x1 - p->x0, top = gy - p->top, bot = gy;
        vrect(x0 + 4, top + 7, 3, bot - top - 7, RGB(50, 33, 20)); vrect(x0 + w - 7, top + 7, 3, bot - top - 7, RGB(50, 33, 20));
        vrect(x0, top, w, 7, RGB(122, 82, 48));
        vrect(x0, top, w, 2, RGB(176, 124, 68));
        vrect(x0, top + 6, w, 1, RGB(74, 48, 24));
        for(k = x0 + 6; k < x0 + w - 3; k += 16) vrect(k, top + 3, 2, 2, RGB(42, 26, 12));
    }
    /* the door at the right edge: barred while an enemy is alive, a green glow and arrow once the map is clear */
    vrect(gx, gy - 70, 10, 70, open ? RGB(40, 110, 62) : RGB(30, 30, 40));
    if(!open) for(k = gy - 70; k < gy; k += 6) vrect(gx + 2, k, 6, 2, RGB(138, 138, 153));
    else for(k = 0; k < 8; k++) vrect(gx - 4 + (k < 4 ? k : 7 - k), gy - 28 - 7 + k * 2, 1 + (k < 4 ? k : 7 - k), 2, RGB(125, 255, 154));
}


static void vpix(float wx, float wy, int w, int h, u16 c) {          /* a w x h view-pixel rectangle centred on a world point */
    vrect(iround(wx) - w / 2, FEET_ROW + iround(camY) - iround(wy) - h / 2, w, h, c);
}
static void ring(int cx, int cy, int R, u16 c) {                      /* a 2 px ring in screen pixels */
    int y, xo, xi, rin = R > 2 ? R - 2 : 0;
    for(y = -R; y <= R; y++) {
        xo = (int)(__builtin_sqrtf((float)(R * R - y * y)) + 0.5f);
        xi = y * y >= rin * rin ? 0 : (int)(__builtin_sqrtf((float)(rin * rin - y * y)) + 0.5f);
        if(xi <= 0) gfx_rect(cx - xo, cy + y, xo * 2 + 1, 1, c);
        else { gfx_rect(cx - xo, cy + y, xo - xi, 1, c); gfx_rect(cx + xi + 1, cy + y, xo - xi, 1, c); }
    }
}
static void draw_items(void) {
    int i, k;
    gfx_clip(VIEW_TOP, VIEW_TOP + VIEW_SCR_H);
    for(i = 0; i < cur_map->ncrate; i++) {                             /* crates */
        const Crate *c = &CRATES[cur_map->crate0 + i];
        int X = c->x, Y = FEET_ROW + iround(camY) - c->fy;
        if(crate_broken[i]) continue;
        vrect(X - 10, Y - 19, 20, 19, RGB(0, 0, 0)); vrect(X - 9, Y - 18, 18, 17, RGB(138, 90, 43)); vrect(X - 9, Y - 18, 18, 2, RGB(176, 122, 60));
        for(k = 0; k < 15; k++) { vrect(X - 8 + k, Y - 17 + k, 1, 1, RGB(90, 58, 24)); vrect(X + 8 - k, Y - 17 + k, 1, 1, RGB(90, 58, 24)); }
    }
    for(i = 0; i < cur_map->nbomb; i++) {                              /* bombs */
        const Spot *b = &BOMBS[cur_map->bomb0 + i];
        int X = b->x, Y = FEET_ROW + iround(camY) - b->fy, on = bomb_fuse[i] != 0 ? ((int)(now / 50.0f) & 1) : ((int)(now / 240.0f) & 1);
        if(bomb_state[i] == 1) continue;
        vrect(X - 7, Y - 13, 14, 14, RGB(0, 0, 0)); vrect(X - 6, Y - 12, 12, 12, RGB(43, 43, 51)); vrect(X - 3, Y - 10, 2, 2, RGB(90, 90, 104));
        vrect(X + 2, Y - 16, 2, 4, RGB(138, 106, 58)); vrect(X + 4, Y - 18, 3, 3, on ? RGB(255, 225, 77) : RGB(255, 106, 32));
        if(bomb_fuse[i] != 0) vrect(X - 8, Y - 14, 16, 1, RGB(255, 43, 43));
    }
    for(i = 0; i < MAX_GEMS_ON; i++) {                                 /* gems and leaves */
        const Gem *g = &gems[i];
        int X, Y;
        float left;
        if(!g->on) continue;
        left = 20000.0f - (now - g->t0);
        if(g->kind != G_ANKH && g->kind != G_LEAF && left < 4000.0f && ((int)(now / 120.0f) & 1)) continue;
        X = iround(g->x); Y = FEET_ROW + iround(camY) - iround(g->y + fsin(g->bob) * 3.0f);
        if(g->kind == G_ANKH) {                                        /* a golden ankh */
            vrect(X - 2, Y - 9, 5, 1, RGB(0, 0, 0)); vrect(X - 3, Y - 8, 1, 4, RGB(0, 0, 0)); vrect(X + 3, Y - 8, 1, 4, RGB(0, 0, 0)); vrect(X - 5, Y - 3, 11, 4, RGB(0, 0, 0)); vrect(X - 2, Y + 1, 5, 9, RGB(0, 0, 0));
            vrect(X - 1, Y - 8, 3, 1, RGB(255, 210, 74)); vrect(X - 2, Y - 7, 1, 3, RGB(255, 210, 74)); vrect(X + 2, Y - 7, 1, 3, RGB(255, 210, 74)); vrect(X - 4, Y - 2, 9, 2, RGB(255, 210, 74)); vrect(X - 1, Y, 3, 9, RGB(255, 210, 74));
            vrect(X - 4, Y - 2, 9, 1, RGB(255, 242, 168));
        } else if(g->kind == G_LEAF) {
            int f = ((int)((now + g->bob * 97.0f) / 85.0f)) % LEAF_FRAMES;
            gfx_blit(art_sprite((g->val >= 5 ? LEAF_BIG_SPRITES : LEAF_SPRITES)[f]), v2s(X), VIEW_TOP + v2s(Y), 0);
        } else {
            int spr = g->kind == G_HEALTH ? 0 : g->kind == G_UPHP ? 1 : g->kind == G_ENERGY || g->kind == G_UP_ENERGY ? 2 : g->kind == G_EMPOWER || g->kind == G_UP_EMPOWER ? 3 : 4;
            gfx_blit(art_sprite(GEM_SPRITES[spr]), v2s(X), VIEW_TOP + v2s(Y), 0);
            if(g->kind > G_UPHP && g->kind < G_ANKH) { ring(v2s(X), VIEW_TOP + v2s(Y), 9, RGB(255, 255, 255)); vrect(X - 3, Y - 1, 7, 2, RGB(255, 255, 255)); vrect(X, Y - 4, 1, 8, RGB(255, 255, 255)); }   /* a meter upgrade: a ring and a plus sign */
        }
    }
}
static void draw_effects(void) {
    int i;
    gfx_clip(VIEW_TOP, VIEW_TOP + VIEW_SCR_H);
    for(i = 0; i < MAX_SHOTS; i++) {                                   /* shards: a bright diamond and, for the streaks, a short tail */
        const Shot *sh = &shots[i];
        u16 c = sh->from_her ? RGB(255, 210, 74) : RGB(143, 180, 255);
        float len = __builtin_sqrtf(sh->vx * sh->vx + sh->vy * sh->vy), ux, uy;
        int k;
        if(!sh->on) continue;
        ux = len > 0 ? sh->vx / len : 1; uy = len > 0 ? sh->vy / len : 0;
        if(sh->streak) for(k = 1; k < 6; k++) vpix(sh->x - ux * k * 3.0f, sh->y - uy * k * 3.0f, 3, 2, c);
        vpix(sh->x, sh->y, 5, 5, RGB(0, 0, 0)); vpix(sh->x, sh->y, 3, 3, c); vpix(sh->x, sh->y, 2, 1, RGB(255, 255, 255));
    }
    for(i = 0; i < MAX_BOOMS; i++) {                                   /* explosions: an expanding fireball ring */
        const Boom *b = &booms[i];
        float age = now - b->t0, u = age / 650.0f, R;
        int cx, cy;
        if(b->r == 0 || age > 650.0f) continue;
        R = b->r * (0.25f + 0.75f * __builtin_sqrtf(u));
        cx = v2s(iround(b->x)); cy = VIEW_TOP + v2s(FEET_ROW + iround(camY) - iround(b->y));
        ring(cx, cy, (int)(R * 0.35f * 5.0f / 6.0f) + 2, RGB(255, 255, 255));
        ring(cx, cy, (int)(R * 0.7f * 5.0f / 6.0f) + 3, RGB(255, 208, 96));
        ring(cx, cy, (int)(R * 5.0f / 6.0f) + 4, RGB(255, 106, 32));
    }
    for(i = 0; i < MAX_PARTS; i++) {
        const Particle *q = &parts[i];
        if(q->on) vpix(q->x, q->y, 3, 3, q->c);
    }
}

static void draw_enemies(void) {
    int i;
    gfx_clip(VIEW_TOP, VIEW_TOP + VIEW_SCR_H);
    for(i = 0; i < MAX_ENEMIES; i++) {
        const Enemy *e = &en[i];
        const EnemyFrame *f;
        const EnemyDef *d;
        int vx, vy;
        if(!e->on) continue;
        d = &ENEMIES[e->type];
        if(e->state == S_DYING && d->a_death < 0 && e->dead < DIE_MS - 400.0f && ((int)(e->dead / 60.0f) & 1)) continue;        /* no death animation: it flickers, then fades */
        f = frame_of(e);
        vx = iround(e->base); vy = FEET_ROW - iround(e->fy + e->jy - camY);
        {
            int tint = now < e->tint_until, flip = e->face > 0, sx = v2s(vx), sy = VIEW_TOP + v2s(vy);
            const Sprite *sp = art_sprite(f->sprite);
            int fade = 255;
            if(e->state == S_DYING) {                               /* web/game/15_draw_scenery.js: alpha = (DIE_MS - dead) / fade window */
                float window = d->a_death >= 0 ? 500.0f : 400.0f;
                if(e->dead > DIE_MS - window) { fade = (int)(255.0f * (DIE_MS - e->dead) / window); if(fade < 0) fade = 0; if(fade > 255) fade = 255; }
            }
            if(fade < 255) gfx_blit_fade(sp, sx, sy, flip, fade);
            else if(e->scale != 1.0f) gfx_blit_scaled(sp, sx, sy, flip, e->scale, tint ? e->tint_c : 0, tint ? e->tint_a : 0);
            else if(tint) gfx_blit_tint(sp, sx, sy, flip, e->tint_c, e->tint_a);
            else gfx_blit(sp, sx, sy, flip);                                    /* the art faces left */
        }
        if(e->state != S_DYING && e->hp < e->maxhp && !d->boss) {                                  /* a small health bar over a hurt enemy */
            float hb[4];
            if(hurt_of(e, hb)) {
                int bx = v2s(iround((hb[0] + hb[2]) * 0.5f)) - 12, by = VIEW_TOP + v2s(FEET_ROW - iround(hb[3] - camY)) - 7;
                gfx_rect(bx, by, 25, 3, RGB(40, 0, 0)); gfx_rect(bx, by, (int)(25.0f * e->hp / e->maxhp), 3, RGB(230, 40, 40));
            }
        }
    }
}

static void draw_flashes_floaters(void) {
    int i, k;
    gfx_clip(VIEW_TOP, VIEW_TOP + VIEW_SCR_H);
    for(i = 0; i < MAX_FLASHES; i++) {                                        /* starbursts */
        const Flash *f = &flashes[i];
        float a, r;
        int X, Y, inner, len;
        if(!f->on) continue;
        a = (now - f->t0) / f->ms; r = f->r * (0.4f + 0.6f * minf_(1.0f, a * 3.0f));
        X = v2s(iround(f->wx)); Y = VIEW_TOP + v2s(FEET_ROW + iround(camY) - iround(f->wy));
        inner = (int)(r * 0.25f * 0.83f);
        for(k = 0; k < 8; k++) {
            float ang = (float)k * 0.7853982f + 0.4f;
            len = (int)((k % 2 ? r * 0.6f : r) * 0.83f);
            if(a > 0.7f) len = len * 2 / 3;
            gfx_rect(X + (int)(fcos(ang) * (float)len) - 1, Y + (int)(fsin(ang) * (float)len) - 1, 2, 2, f->c);
            gfx_rect(X + (int)(fcos(ang) * (float)(len + inner) * 0.5f), Y + (int)(fsin(ang) * (float)(len + inner) * 0.5f), 1, 1, f->c);
        }
        if(a < 0.4f) gfx_rect(X - 1, Y - 1, 3, 3, RGB(255, 255, 255));
    }
    for(i = 0; i < MAX_FLOATERS; i++) {                                       /* damage numbers and notices rise and fade */
        const Floater *f = &floaters[i];
        float age;
        int X, Y, w;
        if(!f->on) continue;
        age = now - f->t0;
        if(age > FLOAT_MS - 300.0f && ((int)(age / 50.0f) & 1)) continue;
        w = 8 * strlen_(f->text);
        X = v2s(iround(f->wx)) - w / 2; Y = VIEW_TOP + v2s(FEET_ROW + iround(camY) - iround(f->wy) - (int)(age * 0.035f)) - 4;
        gfx_text(X + 1, Y + 1, f->text, RGB(0, 0, 0)); gfx_text(X, Y, f->text, f->c);
    }
}

static void draw_bar(int x, int y, int len, int h, float frac, u16 col, int flash) {
    int w;
    if(frac < 0) frac = 0; else if(frac > 1) frac = 1;
    gfx_rect(x - 1, y - 1, len + 2, h + 2, RGB(0, 0, 0)); gfx_rect(x, y, len, h, RGB(22, 32, 46));
    w = (int)((float)len * frac + 0.5f);
    gfx_rect(x, y, w, h, flash ? RGB(255, 255, 255) : col);
    gfx_rect(x, y, w, 1, RGB(255, 255, 255) == col ? col : RGB(200, 220, 230));
}
static void draw_hud(u32 frame_us, u32 draw_us) {
    int i, left = 0, row = 1;
    static const char *MLAB[3] = {"EN", "EM", "SU"};
    static const u16 MCOL[3] = {RGB(68, 170, 255), RGB(255, 170, 68), RGB(204, 102, 255)};
    gfx_clip(0, SCR_H);
    gfx_rect(0, 0, SCR_W, VIEW_TOP, RGB(10, 10, 20));
    gfx_text(1, row, "HP", RGB(255, 255, 255));                                   /* health, then the meters she has unlocked */
    { int bl = v2s((int)max_hp); draw_bar(20, row, bl, 6, hp / max_hp, RGB(61, 220, 95), 0); gfx_num(24 + bl, row - 1, (u32)hp, RGB(255, 255, 255)); }
    row += 9;
    for(i = 0; i < 3; i++) if(meter_on(i)) {
        int bl = v2s((int)meter_max[i]);
        gfx_text(1, row, MLAB[i], RGB(255, 255, 255));
        draw_bar(20, row, bl, 6, meter[i] / meter_max[i], MCOL[i], now < meter_flash[i] && ((int)(now / 70.0f) & 1));
        gfx_num(24 + bl, row - 1, (u32)(meter[i] + 0.5f), RGB(255, 255, 255));
        row += 7;
    }
    for(i = 0; i < MAX_ENEMIES; i++) if(alive(&en[i])) left++;
    gfx_text(SCR_W - 8 * 11, 1, "MAP", RGB(160, 180, 230)); gfx_text(SCR_W - 8 * 7, 1, cur_map->id, RGB(255, 255, 255));
    gfx_text(SCR_W - 8 * 11, 9, "FOES", RGB(160, 180, 230)); gfx_num(SCR_W - 8 * 6, 9, (u32)left, RGB(255, 255, 255));
    gfx_text(SCR_W - 8 * 11, 17, "LEAF", RGB(160, 220, 120)); gfx_num(SCR_W - 8 * 6, 17, (u32)leaves, RGB(255, 255, 255));
    gfx_text(SCR_W - 8 * 11, 25 - 1, "ANKH", RGB(255, 210, 74)); gfx_num(SCR_W - 8 * 6, 25 - 1, (u32)ankhs, RGB(255, 255, 255));
    gfx_rect(0, VIEW_TOP + VIEW_SCR_H, SCR_W, SCR_H - VIEW_TOP - VIEW_SCR_H, RGB(8, 8, 16));
    for(i = 0; i < MAX_ENEMIES; i++) if(alive(&en[i]) && ENEMIES[en[i].type].boss) {          /* the boss bar along the bottom of the view */
        const Enemy *b = &en[i];
        const char *nm = ENEMIES[b->type].boss_name;
        int bw = 160, bx = (SCR_W - bw) / 2, by = VIEW_TOP + VIEW_SCR_H - 12;
        gfx_text((SCR_W - 8 * strlen_(nm)) / 2, by - 11, nm, RGB(255, 225, 77));
        gfx_rect(bx - 1, by - 1, bw + 2, 8, RGB(0, 0, 0)); gfx_rect(bx, by, bw, 6, RGB(60, 10, 10));
        gfx_rect(bx, by, (int)((float)bw * b->hp / b->maxhp), 6, RGB(230, 50, 50));
        break;
    }
    if(now < banner_until) gfx_text((SCR_W - 8 * (int)strlen_(banner)) / 2, VIEW_TOP + 8, banner, RGB(255, 210, 74));
    if(hp <= 0) gfx_text((SCR_W - 8 * 4) / 2, 100, "K.O.", RGB(255, 60, 60));
#ifdef DEBUG_HUD
    gfx_text(4, 214, MOVES[cur.id].id, RGB(255, 220, 120));
    gfx_text(4, 226, "FRAME US", RGB(160, 180, 230)); gfx_num(4 + 8 * 9, 226, frame_us, RGB(255, 255, 255));
    gfx_text(160, 226, "DRAW US", RGB(160, 180, 230)); gfx_num(160 + 8 * 8, 226, draw_us, RGB(255, 255, 255));
#else
    (void)frame_us; (void)draw_us;
    gfx_text(4, 214, MOVES[cur.id].id, RGB(255, 220, 120));
#endif
}

