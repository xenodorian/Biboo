'use strict';
  // ------------------------------------------------------------------ drawing: level scenery, crates, banners
  let fadeUntil = 0;
  const FADE_MS = 350;
  const groundY = sy => V.feetRow + camY + sy;                    // screen row of the ground line
  // One light per backdrop. sx leans the shadow (+ right), sy lays it toward the viewer (+) or away (-).
  // grade/ga is a vertical multiply on the background. water is a damp reflection under the feet (0 means none).
  // Boss stills use the same direction as the matching cutscene.
  const LIGHTS = {
    trail:    { sx: 0.8,  sy: 0.22, a: 0.55, col: '#0a120c', grade: '#1c140c', ga: 0.28, rim: '#ffe0a0' },
    falls:    { sx: 0.35, sy: 0.12, a: 0.50, col: '#061018', grade: '#0c1a22', ga: 0.32, rim: '#d0ecff', water: 0.22 },
    canyon:   { sx: -0.9, sy: 0.26, a: 0.62, col: '#1a0804', grade: '#3a1408', ga: 0.30, rim: '#ffb070' },
    shore:    { sx: -1.3, sy: 0.30, a: 0.70, col: '#14041c', grade: '#2a1018', ga: 0.34, rim: '#ffd0a0', water: 0.32 },
    mire:     { sx: 0.15, sy: 0.08, a: 0.45, col: '#041008', grade: '#06140c', ga: 0.38, rim: '#b0e0c0' },
    sanctum:  { sx: 0.25, sy: -0.32, a: 0.70, col: '#000010', grade: '#080818', ga: 0.42, rim: '#c8d0ff' },
    training: { sx: 0.55, sy: 0.18, a: 0.50, col: '#100818', grade: '#201008', ga: 0.22, rim: '#ffe0b0' },
    fungal:   { sx: 0.4,  sy: 0.16, a: 0.55, col: '#061410', grade: '#081810', ga: 0.26, rim: '#d8ffe4', water: 0.28 },
    crypt:    { sx: 0.2,  sy: -0.28, a: 0.75, col: '#000008', grade: '#060814', ga: 0.40, rim: '#b0b8ff' },
    bone:     { sx: -0.7, sy: 0.22, a: 0.65, col: '#140808', grade: '#1a0c08', ga: 0.32, rim: '#ffc090' },
    keep:     { sx: 0.9,  sy: 0.25, a: 0.80, col: '#01030a', grade: '#060810', ga: 0.36, rim: '#d0d8ff' },
  };
  function sceneLight() {
    const boss = curMap && curMap.def.boss && curMap.def.theme;
    const key = boss || (level && level.def.bg) || 'trail';
    return LIGHTS[key] || LIGHTS.trail;
  }
  function drawGrade() {
    const L = sceneLight();
    g.save();
    g.globalCompositeOperation = 'multiply';
    const gr = g.createLinearGradient(0, 0, 0, V.h);
    gr.addColorStop(0, L.grade); gr.addColorStop(0.55, '#ffffff'); gr.addColorStop(1, L.grade);
    g.globalAlpha = L.ga; g.fillStyle = gr; g.fillRect(0, 0, V.w, V.h);
    g.restore();
  }
  // Filled oval made of solid rows, so it stays on the pixel grid (no antialiased arc).
  function pixOval(cx, cy, rx, ry, col, a) {
    rx = Math.max(1, Math.round(rx)); ry = Math.max(1, Math.round(ry));
    g.save(); g.globalAlpha = a; g.fillStyle = col; g.imageSmoothingEnabled = false;
    for (let y = -ry; y <= ry; y++) {
      const t = 1 - (y * y) / (ry * ry); if (t <= 0) continue;
      const w = Math.max(1, Math.round(rx * Math.sqrt(t)));
      g.fillRect(cx - w, cy + y, w * 2, 1);
    }
    g.restore();
  }
  // A 2 px ring, used wherever a soft radial glow used to be.
  function pixGlow(cx, cy, r, col, a) {
    g.save(); g.globalAlpha = a; g.fillStyle = col; g.imageSmoothingEnabled = false;
    r = Math.max(2, Math.round(r));
    for (let i = 0; i < 8; i++) {
      const ang = i * Math.PI / 4 + clock * 0.002;
      g.fillRect(cx + Math.round(Math.cos(ang) * r), cy + Math.round(Math.sin(ang) * r), 2, 2);
    }
    g.restore();
  }
  function pixRing(cx, cy, R, col, a) {
    R = Math.max(2, Math.round(R));
    const R2 = R * R, rIn = Math.max(0, R - 2), rIn2 = rIn * rIn;
    g.save(); g.globalAlpha = a; g.fillStyle = col; g.imageSmoothingEnabled = false;
    for (let y = -R; y <= R; y++) {
      const yy = y * y; if (yy > R2) continue;
      const xo = Math.round(Math.sqrt(R2 - yy));
      const xi = yy >= rIn2 ? 0 : Math.round(Math.sqrt(Math.max(0, rIn2 - yy)));
      if (xi <= 0) g.fillRect(cx - xo, cy + y, xo * 2 + 1, 1);
      else { g.fillRect(cx - xo, cy + y, xo - xi, 1); g.fillRect(cx + xi + 1, cy + y, xo - xi, 1); }
    }
    g.restore();
  }
  // air is px above the surface. withCast: a long shadow is also drawn, so the blob stays small.
  function contactBlob(x, y, rx, air, withCast) {
    const k = Math.max(0, 1 - (air || 0) / 96);
    if (k < 0.05) return;
    const L = sceneLight();
    pixOval(x, y + 1, Math.max(3, rx * (0.55 + 0.45 * k)), Math.max(1, Math.round(3 * k)), L.col, (withCast ? 0.28 : 0.55) * k * Math.min(1, L.a + 0.2));
  }
  const _gameSil = {};
  function gameSil(key, im, sx0, sy0, sw, sh, w, h, col, flip) {
    if (!im) return null;
    w = Math.max(1, w); h = Math.max(1, h);
    if (!flip) return silhouette(key, im, sx0, sy0, sw, sh, w, h, col);
    const k = key + col + '~f';
    if (_gameSil[k]) return _gameSil[k];
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
    x.translate(w, 0); x.scale(-1, 1);
    x.drawImage(im, sx0, sy0, sw, sh, 0, 0, w, h);
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, w, h);
    return (_gameSil[k] = c);
  }
  // Long shadow only on a flat floor. Clipped to a band around the feet so it cannot paint the sky.
  function castOnGround(sil, dx, dy, feetY, L, alpha) {
    if (!sil) return;
    const clip = [[0, feetY - 56], [V.w, feetY - 56], [V.w, V.h], [0, V.h]];
    castShadow(sil, dx, dy, feetY, { sx: L.sx, sy: L.sy, a: L.a, col: L.col, clip }, alpha);
  }
  function drawContacts(sx, sy, ax, ay, m) {
    const L = sceneLight();
    const air = heightAbove();
    const surfY = Math.round(groundY(sy) - floorY);
    const hx = Math.round(playerX() + sx);
    const pitted = floorY < 2 && (pitFall || inPit(playerX()));
    if (!pitted && img[m.sheet]) {
      const planted = air < 3 && floorY < 2;
      contactBlob(hx, surfY, 14, air, planted);
      if (planted) {
        const sc = SPRITE_SCALE, cw = m.cell[0], ch = m.cell[1], dw = Math.round(cw * sc), dh = Math.round(ch * sc);
        const left = cur.face < 0 ? Math.round(ax - dw + m.anchor[0] * sc) : Math.round(ax - m.anchor[0] * sc);
        const top = Math.round(ay - m.anchor[1] * sc);
        castOnGround(gameSil('p' + cur.id + ':' + cur.k + ':' + dw + (cur.face < 0 ? 'f' : ''), img[m.sheet].im, cur.k * cw, 0, cw, ch, dw, dh, L.col, cur.face < 0), left, top, Math.round(ay), L, 1);
      }
    }
    if (!curMap) return;
    for (const e of enemies) {
      if (e.sinkAt || !EN[e.type]) continue;
      const T = EN[e.type], surf = e.fy || 0, airE = e.jy || 0;
      if (surf < 2 && inPit(e.x)) continue;
      const sc = SPRITE_SCALE * (e.scale || 1);
      const ex = Math.round(V.anchorX + (e.base - camX) + sx);
      const ey = Math.round(groundY(sy) - surf);
      const planted = airE < 3 && surf < 2 && e.state !== 'dying';
      contactBlob(ex, ey, Math.max(8, Math.round(T.cell[0] * sc * 0.22)), airE, planted);
      if (!planted || !img[T.sheet]) continue;
      const cell = T.anims[e.anim].frames[e.k], [cw, ch] = T.cell, [ax0, ay0] = T.anchor;
      const dw = Math.round(cw * sc), dh = Math.round(ch * sc), faceR = e.face > 0;
      const left = faceR ? Math.round(ex - dw + ax0 * sc) : Math.round(ex - ax0 * sc);
      const top = Math.round(ey - ay0 * sc);
      let alpha = 1;
      if (e.state === 'dying') { const fade = T.ai.death ? 500 : 400; alpha = Math.max(0, Math.min(1, (DIE_MS - e.dead) / fade)); }
      castOnGround(gameSil('e' + e.type + ':' + e.anim + ':' + cell + ':' + dw + (faceR ? 'f' : ''), img[T.sheet].im, cell * cw, 0, cw, ch, dw, dh, L.col, faceR), left, top, ey, L, alpha);
    }
  }
  // The bottom of a sprite, mirrored a few rows into wet ground. Called in the sprite's own transform (feet at dy+dh).
  function dampMirrorLocal(im, sx0, sw, sh, dx, dy, dw, dh, alpha) {
    if (!im || !alpha) return;
    const feet = dy + dh, band = 12;
    g.save();
    g.beginPath(); g.rect(dx - 8, feet, dw + 16, band); g.clip();
    g.globalAlpha = alpha; g.imageSmoothingEnabled = false;
    for (let r = 0; r < band; r++) {
      const srcY = Math.min(sh - 1, Math.max(0, sh - 1 - Math.floor(r * sh / Math.max(1, dh))));
      const off = Math.round(Math.sin(r * 0.9 + clock * 0.004)) * 2;
      g.drawImage(im, sx0, srcY, sw, 1, dx + off, feet + r, dw, 1);
    }
    g.restore();
  }

  function drawGeometry(sx, sy) {
    const Y = wy => Math.round(groundY(sy) - wy);
    for (const s of curMap.solids) {                              // barriers: stone blocks
      const x0 = Math.round(s.x0 + sx), w = s.x1 - s.x0, top = Y(s.top), bot = Y(0);
      g.fillStyle = '#3d3949'; g.fillRect(x0, top, w, bot - top + 12);
      g.fillStyle = '#2b2735';
      for (let yy = top + 8; yy < bot + 12; yy += 8) g.fillRect(x0, yy, w, 1);
      for (let yy = top, r = 0; yy < bot + 12; yy += 8, r++) g.fillRect(x0 + (r % 2 ? 4 : 10), yy, 1, 8);
      g.fillStyle = '#635e7a'; g.fillRect(x0, top, w, 3);
      g.strokeStyle = '#111'; g.lineWidth = 1; g.strokeRect(x0 + 0.5, top + 0.5, w - 1, bot - top + 11);
    }
    for (const p of curMap.plats) {                               // platforms: a plank on two posts
      const x0 = Math.round(p.x0 + sx), w = p.x1 - p.x0, top = Y(p.top), bot = Y(0);
      g.fillStyle = 'rgba(58,38,22,0.75)';
      g.fillRect(x0 + 4, top + 7, 3, bot - top - 7); g.fillRect(x0 + w - 7, top + 7, 3, bot - top - 7);
      g.fillStyle = '#7a5230'; g.fillRect(x0, top, w, 7);
      g.fillStyle = '#b07c44'; g.fillRect(x0, top, w, 2);
      g.fillStyle = '#4a3018'; g.fillRect(x0, top + 6, w, 1);
      g.fillStyle = '#2a1a0c'; for (let nx = x0 + 6; nx < x0 + w - 3; nx += 16) g.fillRect(nx, top + 3, 2, 2);
      g.strokeStyle = '#111'; g.strokeRect(x0 + 0.5, top + 0.5, w - 1, 6);
    }
    // the door at the right edge: barred while an enemy is alive, a green glow and arrow once the map is clear
    const open = doorOpen(), pulse = 0.55 + 0.35 * Math.sin(clock / 260), gx = MAP_W - 10 + sx;
    g.fillStyle = open ? 'rgba(90,220,120,0.35)' : 'rgba(30,30,40,0.85)';
    g.fillRect(gx, Y(70), 10, Y(0) - Y(70));
    if (!open) { g.fillStyle = '#8a8a99'; for (let yy = Y(70); yy < Y(0); yy += 6) g.fillRect(gx + 2, yy, 6, 2); }
    else { g.save(); g.globalAlpha = pulse; g.fillStyle = '#7dff9a'; g.beginPath(); g.moveTo(gx - 4, Y(28) - 7); g.lineTo(gx + 5, Y(28)); g.lineTo(gx - 4, Y(28) + 7); g.closePath(); g.fill(); g.restore(); }
  }
  function drawCrates(sx, sy) {
    for (const c of curMap.crates) {
      if (c.broken) continue;
      const X = Math.round(c.x + sx), Y = Math.round(groundY(sy) - c.fy), gold = !!c.item;
      if (!(c.fy < 2 && inPit(c.x))) contactBlob(X, Y, 8, 0, false);
      if (gold) pixGlow(X, Y - 9, 12, '#ffd24a', 0.55 + 0.25 * Math.sin(clock / 220));
      g.fillStyle = '#000'; g.fillRect(X - 10, Y - 19, 20, 19);
      g.fillStyle = gold ? '#c9962a' : '#8a5a2b'; g.fillRect(X - 9, Y - 18, 18, 17);
      g.fillStyle = gold ? '#f0cf66' : '#b07a3c'; g.fillRect(X - 9, Y - 18, 18, 2);
      g.strokeStyle = gold ? '#7a5a10' : '#5a3a18'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(X - 8, Y - 17); g.lineTo(X + 8, Y - 2); g.moveTo(X + 8, Y - 17); g.lineTo(X - 8, Y - 2); g.stroke();
      g.strokeRect(X - 8.5, Y - 17.5, 17, 16);
      if (gold) { g.font = 'bold 9px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 2; g.strokeText('?', X, Y - 10); g.fillText('?', X, Y - 10); g.textAlign = 'left'; }
    }
  }
  function drawFlashes(sx, sy) {
    for (let i = flashes.length - 1; i >= 0; i--) {
      const f = flashes[i], a = (clock - f.t0) / f.ms;
      if (a >= 1) { flashes.splice(i, 1); continue; }
      const X = Math.round(f.wx + sx), Y = Math.round(groundY(sy) - f.wy), r = f.r * (0.4 + 0.6 * Math.min(1, a * 3)), inner = r * 0.25;
      g.save(); g.globalAlpha = 1 - a; g.strokeStyle = f.c; g.lineWidth = a < 0.35 ? 2 : 1; g.beginPath();
      for (let k = 0; k < 8; k++) { const ang = k * Math.PI / 4 + 0.4, len = k % 2 ? r * 0.6 : r; g.moveTo(X + Math.cos(ang) * inner, Y + Math.sin(ang) * inner); g.lineTo(X + Math.cos(ang) * len, Y + Math.sin(ang) * len); }
      g.stroke();
      if (a < 0.4) { g.fillStyle = '#fff'; g.beginPath(); g.arc(X, Y, r * 0.3 * (1 - a), 0, 7); g.fill(); }
      g.restore();
    }
  }
  function drawParticles(sx, sy) {
    for (const q of particles) {
      g.globalAlpha = Math.max(0, 1 - (clock - q.t0) / q.life);
      g.fillStyle = q.c; g.fillRect(Math.round(q.wx + sx) - 1, Math.round(groundY(sy) - q.wy) - 1, 3, 3);
    }
    g.globalAlpha = 1;
  }
  // banners: a dark strip near the top with a title and an optional second line; they fade in and out
  function drawBanners() {
    let y = 62;
    for (const b of banners) {
      const age = clock - b.t0, a = Math.max(0, Math.min(1, age / 200, (b.ms - age) / 350));
      const lines = Array.isArray(b.sub) ? b.sub : b.sub ? [b.sub] : [], h = lines.length ? 21 + 9 * lines.length : 20;
      g.save();
      g.globalAlpha = a * 0.82; g.fillStyle = '#0c0a12'; g.fillRect(52, y, V.w - 104, h);
      g.globalAlpha = a; g.strokeStyle = '#ffd24a'; g.lineWidth = 1; g.strokeRect(52.5, y + 0.5, V.w - 105, h - 1);
      g.textAlign = 'center'; g.textBaseline = 'top'; g.lineWidth = 2; g.lineJoin = 'round';
      g.font = 'bold 9px monospace'; g.strokeStyle = '#000'; g.fillStyle = '#ffe14d';
      g.strokeText(b.title, V.w / 2, y + 5); g.fillText(b.title, V.w / 2, y + 5);
      g.font = '7px monospace'; g.fillStyle = '#e6e6ec';
      lines.forEach((ln, i) => { g.strokeText(ln, V.w / 2, y + 18 + 9 * i); g.fillText(ln, V.w / 2, y + 18 + 9 * i); });
      g.restore();
      y += h + 4;
    }
    g.textAlign = 'left';
  }

  // explosions: an expanding fireball with a shock ring, and a white flash over the view for the big one
  function drawExplosions(sx, sy) {
    for (let i = explosions.length - 1; i >= 0; i--) {
      const ex = explosions[i], age = clock - ex.t0;
      if (age > BLAST_MS) { explosions.splice(i, 1); continue; }
      if (age < 0) continue;
      const u = age / BLAST_MS;
      const X = Math.round(V.anchorX + (ex.wx - camX) + sx), Y = Math.round(V.feetRow + camY + sy - ex.wy);
      const R = Math.max(4, Math.round((ex.r || (ex.big ? 90 : 34)) * (0.25 + 0.75 * Math.sqrt(u))));
      pixRing(X, Y, Math.max(2, Math.round(R * 0.35)), '#ffffff', Math.max(0, 1 - u));
      pixRing(X, Y, Math.max(3, Math.round(R * 0.7)), '#ffd060', Math.max(0, 0.85 - u));
      pixRing(X, Y, R, '#ff6a20', Math.max(0, 0.7 - u));
      pixRing(X, Y, R, '#8fd0ff', Math.max(0, 0.9 - u) * 0.85);
    }
    if (clock < flashUntil) {
      g.save(); g.globalAlpha = 0.75 * (flashUntil - clock) / FLASH_MS; g.fillStyle = '#fff'; g.fillRect(0, 0, V.w, V.h); g.restore();
    }
  }
  // gems on the ground: a bobbing diamond with a glow, blinking for the last 4 s
  // a golden ankh (the loop on top, a bar across, a stem), the ankh pickup and the counter icon
  function drawAnkh(X, Y, k) {
    g.save();
    g.translate(X, Y); g.scale(k, k);
    g.fillStyle = '#000';
    g.fillRect(-2, -9, 5, 1); g.fillRect(-3, -8, 1, 4); g.fillRect(3, -8, 1, 4); g.fillRect(-2, -4, 5, 1); g.fillRect(-5, -3, 11, 4); g.fillRect(-2, 1, 5, 9);
    g.fillStyle = '#ffd24a';
    g.fillRect(-1, -8, 3, 1); g.fillRect(-2, -7, 1, 3); g.fillRect(2, -7, 1, 3); g.fillRect(-1, -4, 3, 1); g.fillRect(-4, -2, 9, 2); g.fillRect(-1, 0, 3, 9);
    g.fillStyle = '#fff2a8'; g.fillRect(-1, -8, 3, 1); g.fillRect(-4, -2, 9, 1);
    g.fillStyle = '#b8801a'; g.fillRect(-1, 8, 3, 1); g.fillRect(-4, -1, 9, 1);
    g.restore();
  }
  function drawGems(sx, sy) {
    for (const gm of gems) {
      const left = GEM_LIFE - (clock - gm.t0);
      if (gm.kind !== 'ankh' && left < 4000 && Math.floor(clock / 120) % 2) continue;
      const X = Math.round(V.anchorX + (gm.x - camX) + sx), Y = Math.round(V.feetRow + camY + sy - gm.y - Math.sin(gm.bob) * 3);
      if (gm.kind === 'ankh') { drawAnkh(X, Y, 1); continue; }
      const IT = D.items, up = gm.kind.startsWith('up_'), base = up ? gm.kind.slice(3) : gm.kind;
      if (gm.kind === 'leaf') {                                   // the spinning Leaf coin (a 5-leaf piece is drawn larger)
        const f = Math.floor((clock + gm.bob * 97) / 85) % IT.leafFrames, sc = (gm.val || 1) >= 5 ? 1.5 : 1;
        g.drawImage(img[IT.leaf].im, f * IT.cell, 0, IT.cell, IT.cell, X - IT.cell * sc / 2, Y - IT.cell * sc / 2, IT.cell * sc, IT.cell * sc);
        continue;
      }
      const c = base === 'energy' ? ['#bfe6ff', '#4af', '#1d5fb0'] : base === 'super' ? ['#f0d6ff', '#c6f', '#6a2a9a'] : base === 'health' || base === 'hp' ? ['#c9ffd6', '#3ddc5f', '#15803d'] : ['#ffe3b0', '#fa4', '#b25a10'];
      g.save();
      pixGlow(X, Y, 8, c[1], 0.45 + 0.2 * Math.sin(gm.bob * 2));
      g.globalAlpha = 1;
      const spr = GEM_SPRITE[gm.kind] || GEM_SPRITE[base];            // Bone, Bone Powder, Quartz, Garnet, Diamond
      g.drawImage(img[IT.gemSheet].im, IT.gems[spr] * IT.cell, 0, IT.cell, IT.cell, X - IT.cell / 2, Y - IT.cell / 2, IT.cell, IT.cell);
      if (up && gm.kind !== 'up_hp') {                            // a meter upgrade (the gem's powder): a ring and a plus sign
        g.strokeStyle = '#fff'; g.lineWidth = 1; g.beginPath(); g.arc(X, Y, 11, 0, Math.PI * 2); g.stroke();
        g.fillStyle = '#fff'; g.fillRect(X - 3, Y - 1, 7, 2); g.fillRect(X, Y - 4, 1, 8);
      }
      g.restore();
    }
  }
  // meters under the health bar: ENG (blue) and EMP (orange); a bar flashes white when a move was refused
  function drawMeters() {
    g.font = 'bold 7px monospace'; g.textBaseline = 'top'; g.textAlign = 'left'; g.lineWidth = 2; g.lineJoin = 'round';
    let y = 24;                                                    // only the meters the player has unlocked are drawn
    for (const [lab, k, v, max, col] of [['ENG', 'energy', energyMeter, maxOf('energy'), '#4af'], ['EMP', 'empower', empowerMeter, maxOf('empower'), '#fa4'], ['SUP', 'super', superMeter, maxOf('super'), '#c6f']]) {
      if (!P.meterOn(k)) continue;
      g.strokeStyle = '#000'; g.fillStyle = '#fff';
      g.strokeText(lab, 8, y - 1); g.fillText(lab, 8, y - 1);
      const flash = clock < meterFlash[k];
      g.fillStyle = '#000'; g.fillRect(27, y - 1, max + 2, 8);          // the bar is as long as the meter's maximum: upgrades make it longer
      g.fillStyle = '#16202e'; g.fillRect(28, y, max, 6);
      const fw = Math.max(0, Math.min(max, Math.round(v)));
      g.fillStyle = flash && Math.floor(clock / 70) % 2 ? '#fff' : col; g.fillRect(28, y, fw, 6);
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(28, y, fw, 1);
      const t = `${Math.round(v)}/${max}`;
      g.strokeStyle = '#000'; g.fillStyle = '#fff'; g.strokeText(t, 32 + max, y - 1); g.fillText(t, 32 + max, y - 1);
      y += 9;
    }
  }

  // health bars: hers at the top left of the view, each living enemy's over its head
  function bar(x0, y0, w, h, frac) {
    g.fillStyle = '#000'; g.fillRect(x0 - 1, y0 - 1, w + 2, h + 2);
    g.fillStyle = '#4a1414'; g.fillRect(x0, y0, w, h);
    const fw = Math.round(w * Math.max(0, Math.min(1, frac)));
    g.fillStyle = frac > 0.5 ? '#3ddc5f' : frac > 0.25 ? '#f0c030' : '#e63b2e';
    g.fillRect(x0, y0, fw, h);
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x0, y0, fw, 1);
  }
  function drawBars(sx, sy) {
    const X = wx => V.anchorX + (wx - camX) + sx, Y = wy => V.feetRow + camY + sy - wy;
    for (const e of enemies) {
      const b = hurtOf(e);
      if (!b || EN[e.type].ai.boss || EN[e.type].ai.prop) continue;
      bar(Math.round(X((b[0] + b[2]) / 2)) - 15, Math.round(Y(b[3])) - 8, 30, 3, e.hp / e.maxHp);
    }
    g.font = 'bold 7px monospace'; g.textBaseline = 'top'; g.lineWidth = 2; g.lineJoin = 'round';
    g.strokeStyle = '#000'; g.fillStyle = '#fff';
    g.strokeText('MAX', 8, 14); g.fillText('MAX', 8, 14);
    bar(28, 15, 200, 6, hp / maxHp());
    if (level) {                                                     // Leaves counter
      const IT = D.items; g.drawImage(img[IT.leaf].im, 0, 0, IT.cell, IT.cell, 318, 12, 10, 10);
      g.strokeText('x' + P.state.leaves, 330, 14); g.fillText('x' + P.state.leaves, 330, 14);
    }
    if (level && level.n > 0) {                                      // ankh counter
      drawAnkh(284, 17, 0.8);
      g.strokeText('x' + P.state.ankhs, 291, 14); g.fillText('x' + P.state.ankhs, 291, 14);
    }
    const bo = enemies.find(e => EN[e.type].ai.boss && alive(e));
    if (bo) {                                                         // boss bar along the bottom
      g.textAlign = 'center'; g.strokeText(EN[bo.type].ai.bossName || EN[bo.type].title, V.w / 2, 196); g.fillText(EN[bo.type].ai.bossName || EN[bo.type].title, V.w / 2, 196); g.textAlign = 'left';
      bar(64, 206, 256, 6, bo.hp / bo.maxHp);
    }
    const t = `${hp}/${maxHp()}`;
    g.strokeText(t, 232, 14); g.fillText(t, 232, 14);
  }
  function drawFloaters(sx, sy) {
    const X = wx => V.anchorX + (wx - camX) + sx, Y = wy => V.feetRow + camY + sy - wy;
    g.font = 'bold 10px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 3; g.lineJoin = 'round';
    for (let i = floaters.length - 1; i >= 0; i--) {
      const f = floaters[i], age = clock - f.t0;
      if (age > FLOAT_MS) { floaters.splice(i, 1); continue; }
      g.globalAlpha = age < FLOAT_MS - 300 ? 1 : (FLOAT_MS - age) / 300;
      const fx = Math.round(X(f.wx)), fy = Math.round(Y(f.wy) - age * 0.035);
      g.strokeStyle = '#000'; g.strokeText(f.text, fx, fy);
      g.fillStyle = f.color; g.fillText(f.text, fx, fy);
    }
    g.globalAlpha = 1; g.textAlign = 'left';
  }

  // one sheet cell, optionally washed with a colour (a red hit, a white block or parry)
  const wash = document.createElement('canvas'), wg = wash.getContext('2d');
  function blit(im, sx, w, h, dx, dy, tc, sc) {
    sc = sc == null ? 1 : sc;
    const dw = w * sc, dh = h * sc;
    if (!tc) { g.drawImage(im, sx, 0, w, h, dx, dy, dw, dh); return; }
    if (wash.width < w || wash.height < h) { wash.width = Math.max(wash.width, w); wash.height = Math.max(wash.height, h); }
    wg.globalCompositeOperation = 'source-over'; wg.globalAlpha = 1;
    wg.clearRect(0, 0, wash.width, wash.height);
    wg.drawImage(im, sx, 0, w, h, 0, 0, w, h);
    wg.globalCompositeOperation = 'source-atop'; wg.globalAlpha = tc.alpha || 0.7;
    wg.fillStyle = tc.color; wg.fillRect(0, 0, w, h);
    g.drawImage(wash, 0, 0, w, h, dx, dy, dw, dh);
  }

  function drawEnemies(sx, sy) {
    const gy = V.feetRow + camY + sy;
    for (const e of enemies) {
      const T = EN[e.type];
      let alpha = 1;
      if (e.state === 'dying') {
        const fade = T.ai.death ? 500 : 400;
        if (!T.ai.death && !e.sinkAt && e.dead < DIE_MS - fade && Math.floor(e.dead / 60) % 2) continue;   // no death art: flicker
        alpha = Math.max(0, Math.min(1, (DIE_MS - e.dead) / fade));
      }
      const cell = T.anims[e.anim].frames[e.k];
      const [cw, ch] = T.cell, [ax, ay] = T.anchor;
      const vx = Math.round(V.anchorX + (e.base - camX) + sx);
      g.save();
      if (e.sinkAt && curMap) pitClip(sx, sy);
      g.globalAlpha = alpha;
      g.translate(vx, Math.round(gy - (e.fy || 0) - (e.jy || 0) + (e.sinkAt ? PIT_GRAV * (clock - e.sinkAt) * (clock - e.sinkAt) : 0)));
      if (e.face > 0) g.scale(-1, 1);
      if (e.type === 'heavybag' && e.sw) { const top = ay * SPRITE_SCALE; g.translate(0, -top); g.rotate(e.sw.a); g.translate(0, top); }   // it swings from its top
      const Lm = sceneLight();
      if (Lm.rim && img[T.sheet]) {
        const screenOx = Lm.sx >= 0 ? -1 : 1, localOx = e.face > 0 ? -screenOx : screenOx;
        g.save(); g.globalAlpha = 0.5 * alpha;
        blit(img[T.sheet].im, cell * cw, cw, ch, -ax * SPRITE_SCALE * (e.scale||1) + localOx, -ay * SPRITE_SCALE * (e.scale||1) - 1, { color: Lm.rim, alpha: 0.9 }, SPRITE_SCALE * (e.scale||1));
        g.restore();
      }
      blit(img[T.sheet].im, cell * cw, cw, ch, -ax * SPRITE_SCALE * (e.scale||1), -ay * SPRITE_SCALE * (e.scale||1), e.tint && clock < e.tint.until ? e.tint : null, SPRITE_SCALE * (e.scale||1));
      if (Lm.water && (e.fy || 0) < 2 && (e.jy || 0) < 8 && !e.sinkAt && !inPit(e.x)) {
        const sc = SPRITE_SCALE * (e.scale || 1);
        dampMirrorLocal(img[T.sheet].im, cell * cw, cw, ch, -ax * sc, -ay * sc, cw * sc, ch * sc, Lm.water * alpha);
      }
      g.restore();
    }
  }

  function drawBoxes(sx, sy) {
    const X = wx => V.anchorX + (wx - camX) + sx, Y = wy => V.feetRow + camY + sy - wy;
    g.save();
    g.lineWidth = 1;
    g.strokeStyle = '#ffe14d';
    for (const e of enemies) {
      const b = hurtOf(e);
      if (b) g.strokeRect(X(b[0]) + 0.5, Y(b[3]) + 0.5, b[2] - b[0], b[3] - b[1]);
    }
    g.strokeStyle = '#4dd2ff';
    { const b = herBox(); g.strokeRect(X(b[0]) + 0.5, Y(b[3]) + 0.5, b[2] - b[0], b[3] - b[1]); }
    g.strokeStyle = '#ff8a3d';
    for (const e of enemies) {
      const b = e.state === 'attack' ? boxOf(e, frameOf(e).hit) : null;
      if (b) g.strokeRect(X(b[0]) + 0.5, Y(b[3]) + 0.5, b[2] - b[0], b[3] - b[1]);
    }
    g.strokeStyle = '#ff4d4d';
    for (const h of lastHits) for (const s of h.f.hits) {
      const w = worldShape(s, h);
      g.beginPath();
      if (w.shape === 'box') g.rect(X(w.box[0]), Y(w.box[3]), w.box[2] - w.box[0], w.box[3] - w.box[1]);
      else if (w.shape === 'circle') g.arc(X(w.c[0]), Y(w.c[1]), w.r, 0, Math.PI * 2);
      else {
        g.lineWidth = w.r * 2; g.lineCap = 'round'; g.globalAlpha = 0.45; g.strokeStyle = '#ff4d4d';
        g.moveTo(X(w.a[0]), Y(w.a[1])); g.lineTo(X(w.b[0]), Y(w.b[1]));
        g.stroke(); g.lineWidth = 1; g.globalAlpha = 1; continue;
      }
      g.stroke();
    }
    g.restore();
  }

  function follow(dt) {
    camX = V.anchorX;                    // one map is one screen: no sideways scrolling, world x is screen x
    if (!cur) return;
    const ease = 1 - Math.exp(-dt / 70);
    camY += (Math.max(0, herY() - CAM_KEEP) - camY) * ease;
  }
