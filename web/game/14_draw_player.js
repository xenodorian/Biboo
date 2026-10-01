'use strict';
  // ------------------------------------------------------------------ drawing
  function drawLayer(im, dx, dy) {
    // the layer's top-left sits at view (dx mod width, dy - margin); edge rows stretch past its ends
    const w = im.width, h = im.height, top = Math.round(dy) - V.margin;
    let x0 = (Math.round(dx) % w + w) % w - w;
    for (let xx = x0; xx < V.w; xx += w) {
      g.drawImage(im, xx, top);
      if (top > 0) g.drawImage(im, 0, 0, w, 1, xx, 0, w, top);
      if (top + h < V.h) g.drawImage(im, 0, h - 1, w, 1, xx, top + h, w, V.h - top - h);
    }
  }

  function draw() {
    if (!cur) return;
    g.imageSmoothingEnabled = false;
    const m = D.moves[cur.id];
    const f = m.frames[cur.k];
    const rel = stun ? [0, stun.y] : fall ? [0, fall.y] : (cur.kind === 'fall' ? [0, 0] : rootOf(cur));
    const rx = rel[0], ry = rel[1] + floorY - pitSink();                     // ry: world height of her feet
    let [sx, sy] = cur.kind === 'fall' || cur.kind === 'land' || cur.lite ? [0, 0] : f.shake;
    if (rumble) {                                                // fading aftershock
      const e = clock - rumble.t0;
      if (e >= rumble.ms) rumble = null;
      else {
        const a = rumble.amp * Math.pow(1 - e / rumble.ms, 1.5);
        sx += Math.round(a * Math.sin(e * 0.11)); sy += Math.round(a * Math.cos(e * 0.083));
      }
    }
    const px = x + rx;
    const targetY = Math.max(0, ry - CAM_KEEP);
    if (f.bw && cur.kind === 'action') {                         // impact frame: the whole view (the picture has her at anchorX, so it is slid to where she is)
      camY = targetY;
      const sh = Math.round(px - V.anchorX);
      g.fillStyle = '#000'; g.fillRect(0, 0, V.w, V.h);
      if (cur.face < 0) {                                        // mirrored about her position, black beyond it
        g.save(); g.translate((V.anchorX + sh) * 2, 0); g.scale(-1, 1);
        g.drawImage(img[f.bw].im, 0, 0); g.drawImage(img[f.bw].im, V.w, 0);
        g.restore();
      } else g.drawImage(img[f.bw].im, sh, 0);
      return;
    }
    const bgx = camX + (level ? level.idx * MAP_W : 0);          // the scenery carries on from map to map
    const TH = curMap ? THEMES[curMap.def.theme || (level && level.def.bg)] || null : null;       // boss arenas set def.theme; levels 2 to 6 set def.bg
    const stillKey = curMap && curMap.def.boss ? curMap.def.theme : null, still = stillKey && STILLS[stillKey] && img['story:arena_' + stillKey] && img['story:arena_' + stillKey].im;
    if (still) {                                                  // a boss arena picture: one fixed crop of a wider picture, locked to the screen like the arena itself (no scrolling, no parallax)
      const range = Math.max(0, still.width - V.w);
      g.imageSmoothingEnabled = false;
      g.drawImage(still, -Math.round(range * 0.5) + Math.round(sx * 0.3), Math.round(sy * 0.3) - Math.max(0, still.height - V.h), still.width, still.height);
    } else for (const l of TH ? TH.layers : D.layers) drawLayer(img[l.src].im, -bgx * l.parallax + sx * l.shake, camY * l.parallax + sy * l.shake);
    drawGrade();
    if (level && level.def.tint && !TH) {
      g.save(); g.globalCompositeOperation = 'multiply'; g.globalAlpha = level.def.tint.alpha; g.fillStyle = level.def.tint.color; g.fillRect(0, 0, V.w, V.h); g.restore();
    }
    if (curMap) { drawPits(sx, sy); drawGeometry(sx, sy); drawCrates(sx, sy); drawBombs(sx, sy); }
    const cw = m.cell[0], ch = m.cell[1];
    const ax = V.anchorX + (px - camX) + sx;
    const ay = V.feetRow - (ry - camY) + sy;
    drawContacts(sx, sy, ax, ay, m);
    drawEnemies(sx, sy);
    drawTraining(sx, sy);
    const tc = tint && clock < tint.until ? tint : (isCharged() ? CHARGED_TINT : null);
    g.save();
    if (pitFall && curMap) pitClip(sx, sy);
    g.translate(Math.round(ax), Math.round(ay));
    if (cur.face < 0) g.scale(-1, 1);
    if (cur.spin && clock - cur.spin < SPIN_MS && cur.id === 'jump') {       // the double jump's spin: a full turn about her middle
      const c = -herTop() * SPRITE_SCALE * 0.5;
      g.translate(0, c); g.rotate(2 * Math.PI * (clock - cur.spin) / SPIN_MS); g.translate(0, -c);
    }
    if (m.fxSheet) {                                             // effects at their own scale, behind Max
      const fs = m.fxScale || SPRITE_SCALE, fim = img[m.fxSheet].im;
      const fc = FX_CENTER[cur.id];
      g.save();
      if (fc) g.translate(fc[0] * (SPRITE_SCALE - fs), fc[1] * (fs - SPRITE_SCALE));   // keep the enlarged ring centred on Max's body
      const gone = side => cur.id === 'energy_wave' && cur.blast && cur.blast[side] && cur.k >= 2;   // that projectile burst
      if (!gone(cur.face)) blit(fim, cur.k * cw, cw, ch, -m.anchor[0] * fs, -m.anchor[1] * fs, null, fs);
      if (BOTH_SIDES.has(cur.id) && !gone(-cur.face)) { g.save(); g.scale(-1, 1); blit(fim, cur.k * cw, cw, ch, -m.anchor[0] * fs, -m.anchor[1] * fs, null, fs); g.restore(); }
      g.restore();
    }
    const Lm = sceneLight();
    if (Lm.rim) {
      const screenOx = Lm.sx >= 0 ? -1 : 1, localOx = cur.face < 0 ? -screenOx : screenOx;
      g.save(); g.globalAlpha = 0.5;
      blit(img[m.sheet].im, cur.k * cw, cw, ch, -m.anchor[0] * SPRITE_SCALE + localOx, -m.anchor[1] * SPRITE_SCALE - 1, { color: Lm.rim, alpha: 0.9 }, SPRITE_SCALE);
      g.restore();
    }
    blit(img[m.sheet].im, cur.k * cw, cw, ch, -m.anchor[0] * SPRITE_SCALE, -m.anchor[1] * SPRITE_SCALE, tc, SPRITE_SCALE);
    if (Lm.water && heightAbove() < 8 && floorY < 2 && !pitFall && !inPit(playerX())) {
      dampMirrorLocal(img[m.sheet].im, cur.k * cw, cw, ch, -m.anchor[0] * SPRITE_SCALE, -m.anchor[1] * SPRITE_SCALE, cw * SPRITE_SCALE, ch * SPRITE_SCALE, Lm.water);
    }
    g.restore();
    drawBeam(sx, sy);
    drawExplosions(sx, sy);
    drawParticles(sx, sy);
    drawFlashes(sx, sy);
    drawShots(sx, sy);
    g.save();                                                     // the foreground grass is cut away over the pits
    if (curMap && curMap.pits.length) { g.beginPath(); g.rect(0, 0, V.w, V.h); for (const p of curMap.pits) g.rect(Math.round(p.x0 + sx), 0, p.x1 - p.x0, V.h); g.clip('evenodd'); }
    if (!still) drawLayer(img[TH ? TH.fringe : D.fringe.src].im, -bgx + sx, camY + sy);
    g.restore();
    drawGems(sx, sy);
    drawBars(sx, sy);
    drawMeters();
    drawFloaters(sx, sy);
    drawBanners();
    drawTrainingHud();
    if (screenFlash) { const a = (clock - screenFlash.t0) / screenFlash.ms; if (a >= 1) screenFlash = null; else { g.globalAlpha = screenFlash.a * (1 - a); g.fillStyle = screenFlash.c; g.fillRect(0, 0, V.w, V.h); g.globalAlpha = 1; } }
    if (fadeUntil > clock) { g.globalAlpha = Math.min(1, (fadeUntil - clock) / FADE_MS); g.fillStyle = '#000'; g.fillRect(0, 0, V.w, V.h); g.globalAlpha = 1; }
    if (showBoxes) drawBoxes(sx, sy);
  }
