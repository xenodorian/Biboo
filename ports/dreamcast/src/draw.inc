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
static void draw_player(void) {
    float rx = 0, ry;
    int vx, vy;
    const MoveFrame *f;
    if(now < invuln && !stun_on && !pit_fall_on && ((int)(now / 60.0f) & 1)) return;       /* blink while she cannot be hurt */
    if(!(stun_on || fall_on || cur.kind == K_FALL)) { float t; root_of(&cur, cur.k, &rx, &t); }
    ry = her_y();
    f = mf(cur.id, cur.k);
    vx = iround(X + rx);                                   /* the camera x is fixed at ANCHOR_X, so world x is view x */
    vy = FEET_ROW - iround(ry - camY);
    if(pit_fall_on) {                                      /* falling into a pit: drawn only above the ground line or below it inside the hole */
        int gl = ground_row();
        gfx_clip(VIEW_TOP, gl); gfx_blit(art_sprite(f->sprite), v2s(vx), VIEW_TOP + v2s(vy), cur.face < 0);
        gfx_clip(gl, VIEW_TOP + VIEW_SCR_H); gfx_blit(art_sprite(f->sprite), v2s(vx), VIEW_TOP + v2s(vy), cur.face < 0);
        gfx_clip(VIEW_TOP, VIEW_TOP + VIEW_SCR_H);
        return;
    }
    gfx_blit(art_sprite(f->sprite), v2s(vx), VIEW_TOP + v2s(vy), cur.face < 0);
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
        } else gfx_blit(art_sprite(GEM_SPRITES[g->kind == G_UPHP ? 1 : 0]), v2s(X), VIEW_TOP + v2s(Y), 0);
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
        if(e->state == S_DYING && d->a_death < 0 && ((int)(e->dead / 70.0f) & 1)) continue;        /* no death animation: it flickers */
        if(e->state == S_DYING && e->dead > DIE_MS - 200.0f && ((int)(e->dead / 40.0f) & 1)) continue;
        f = frame_of(e);
        vx = iround(e->base); vy = FEET_ROW - iround(e->fy + e->jy - camY);
        gfx_blit(art_sprite(f->sprite), v2s(vx), VIEW_TOP + v2s(vy), e->face > 0);              /* the art faces left */
        if(e->state != S_DYING && e->hp < e->maxhp) {                                           /* a small health bar over a hurt enemy */
            float hb[4];
            if(hurt_of(e, hb)) {
                int bx = v2s(iround((hb[0] + hb[2]) * 0.5f)) - 10, by = VIEW_TOP + v2s(FEET_ROW - iround(hb[3] - camY)) - 6;
                gfx_num(bx, by - 9, (u32)e->hp, RGB(255, 255, 255)); gfx_rect(bx, by, 20, 3, RGB(40, 0, 0)); gfx_rect(bx, by, (int)(20.0f * e->hp / e->maxhp), 3, RGB(230, 40, 40));
            }
        }
    }
}

static void draw_hud(u32 frame_us, u32 draw_us) {
    int i, left = 0;
    gfx_clip(0, SCR_H);
    gfx_rect(0, 0, SCR_W, VIEW_TOP, RGB(10, 10, 20));
    gfx_text(6, 4, "HP", RGB(255, 255, 255));
    { int bl = (int)(max_hp * 2.0f); if(bl > 180) bl = 180;
      gfx_rect(26, 4, bl + 2, 10, RGB(60, 60, 70)); gfx_rect(27, 5, bl, 8, RGB(40, 0, 0));
      gfx_rect(27, 5, (int)((float)bl * hp / max_hp), 8, RGB(60, 220, 90)); }
    gfx_text(26, 18, "ANKH", RGB(255, 210, 74)); gfx_num(26 + 8 * 5, 18, (u32)ankhs, RGB(255, 255, 255));
    gfx_text(106, 18, "LEAF", RGB(160, 220, 120)); gfx_num(106 + 8 * 5, 18, (u32)leaves, RGB(255, 255, 255));
    gfx_text(SCR_W - 8 * 8, 4, "MAP", RGB(160, 180, 230)); gfx_text(SCR_W - 8 * 4, 4, cur_map->id, RGB(255, 255, 255));
    for(i = 0; i < MAX_ENEMIES; i++) if(alive(&en[i])) left++;
    gfx_text(SCR_W - 8 * 8, 18, "FOES", RGB(160, 180, 230)); gfx_num(SCR_W - 8 * 3, 18, (u32)left, RGB(255, 255, 255));
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
    gfx_text(4, 214, MOVES[cur.id].id, RGB(255, 220, 120));
    gfx_text(4, 226, "FRAME US", RGB(160, 180, 230)); gfx_num(4 + 8 * 9, 226, frame_us, RGB(255, 255, 255));
    gfx_text(160, 226, "DRAW US", RGB(160, 180, 230)); gfx_num(160 + 8 * 8, 226, draw_us, RGB(255, 255, 255));
}

