'use strict';
  // ---- the title screen: drifting level 1 scenery, the logo with a sword slash sweeping through it, and Max on guard
  function drawTitle() {
    const W = V.w, H = V.h, T = clock;
    g.fillStyle = '#10151c'; g.fillRect(0, 0, W, H);
    for (const l of D.layers) drawLayer(img[l.src].im, -T * 0.02 * l.parallax, 0);
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(10,8,24,0.55)'); gr.addColorStop(0.55, 'rgba(10,8,24,0.1)'); gr.addColorStop(1, 'rgba(10,8,24,0.55)');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    // Max, idle, large, on the left
    const m = D.moves.idle, cw = m.cell[0], ch = m.cell[1], total = m.frames.reduce((a, f) => a + f.ms, 0);
    let t = T % total, k = 0; while (k < m.frames.length - 1 && t >= m.frames[k].ms) { t -= m.frames[k].ms; k++; }
    const sc = 1.0, ax = Math.round(W * 0.22), ay = H - 34;
    const tdx = Math.round(ax - m.anchor[0] * sc), tdy = Math.round(ay - m.anchor[1] * sc);   // a real cast shadow: her own outline laid on the grass, away from the sunset glow
    castShadow(silhouette('title' + k, img[m.sheet].im, k * cw, 0, cw, ch, Math.round(cw * sc), Math.round(ch * sc), '#0a0614'), tdx, tdy, ay, { sx: 1.0, sy: 0.2, a: 0.85 });
    blit(img[m.sheet].im, k * cw, cw, ch, ax - m.anchor[0] * sc, ay - m.anchor[1] * sc, null, sc);
    // the logo
    g.save(); g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    const draw = (txt, cx, cy, size) => {
      g.font = `bold ${size}px monospace`;
      const gap = size * 0.78, x0 = cx - (txt.length - 1) * gap / 2;
      for (let i = 0; i < txt.length; i++) {
        const bob = Math.sin(T * 0.003 + i * 0.7) * 1.5, X = x0 + i * gap, Y = cy + bob;
        g.lineWidth = 6; g.strokeStyle = '#1a0c06'; g.strokeText(txt[i], X + 1, Y + 2);
        const fg = g.createLinearGradient(0, Y - size / 2, 0, Y + size / 2); fg.addColorStop(0, '#fff3b0'); fg.addColorStop(0.5, '#ffc83a'); fg.addColorStop(1, '#d8641c');
        g.fillStyle = fg; g.lineWidth = 3; g.strokeStyle = '#3a1608'; g.strokeText(txt[i], X, Y); g.fillText(txt[i], X, Y);
      }
    };
    const intro = Math.min(1, T / 700);
    g.globalAlpha = intro; draw('PARRYING', W / 2, 92 - (1 - intro) * 18, 52); draw('PERRY', W / 2, 150 - (1 - intro) * 18, 52); g.globalAlpha = 1;
    // a sword slash sweeping across the logo, now and then
    const sweep = (T % 4200) / 4200, sx0 = 90 + sweep * 3 * (W - 180);
    if (sweep < 0.34) { g.globalAlpha = 0.85 * Math.sin(sweep / 0.34 * Math.PI); g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.moveTo(sx0 - 60, 190); g.lineTo(sx0 + 15, 55); g.stroke(); g.lineWidth = 1; g.beginPath(); g.moveTo(sx0 - 45, 190); g.lineTo(sx0 + 30, 55); g.stroke(); g.globalAlpha = 1; }
    g.font = 'bold 12px monospace'; g.fillStyle = '#e8e0ff'; g.strokeStyle = '#000'; g.lineWidth = 3;
    g.strokeText('A PERRY RIPOSTE ADVENTURE', W / 2, 188); g.fillText('A PERRY RIPOSTE ADVENTURE', W / 2, 188);
    g.font = '9px monospace'; g.textAlign = 'right'; g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillText(window.BIBOO_VER || '', W - 6, H - 8);
    g.restore();
  }
  function drawOverworld() {
    const n = LV.levels.length;
    g.fillStyle = '#10151c'; g.fillRect(0, 0, V.w, V.h);
    for (const l of D.layers) drawLayer(img[l.src].im, -clock * 0.012 * l.parallax, 0);
    g.fillStyle = 'rgba(8,12,20,0.6)'; g.fillRect(0, 0, V.w, V.h);
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = '#000'; g.lineWidth = 7; g.beginPath();
    for (let i = 0; i < n; i++) { const [px, py] = nodeAt(i); if (i) g.lineTo(px, py); else g.moveTo(px, py); }
    g.stroke();
    g.strokeStyle = '#8a7a55'; g.lineWidth = 3; g.setLineDash([6, 5]); g.beginPath();
    for (let i = 0; i < n; i++) { const [px, py] = nodeAt(i); if (i) g.lineTo(px, py); else g.moveTo(px, py); }
    g.stroke(); g.setLineDash([]);
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 2;
    for (let i = 0; i < n; i++) {
      const [px, py] = nodeAt(i), open = P.levelOpen(i + 1), done = P.state.cleared.includes(i + 1), sel = i === ow.sel;
      g.fillStyle = '#000'; g.beginPath(); g.arc(px, py, 13, 0, Math.PI * 2); g.fill();
      g.fillStyle = done ? '#3ddc5f' : open ? '#c9962a' : '#3a3a44'; g.beginPath(); g.arc(px, py, 11, 0, Math.PI * 2); g.fill();
      g.font = 'bold 10px monospace'; g.fillStyle = open ? '#1a1206' : '#777'; g.fillText(String(i + 1), px, py + 1);
      if (!open) { g.fillStyle = '#9a9aa8'; g.fillRect(px - 4, py + 4, 8, 6); g.strokeStyle = '#9a9aa8'; g.lineWidth = 1.5; g.beginPath(); g.arc(px, py + 4, 3, Math.PI, 0); g.stroke(); }
      if (sel) { g.strokeStyle = '#ffe14d'; g.lineWidth = 2; g.globalAlpha = 0.6 + 0.4 * Math.sin(clock / 160); g.beginPath(); g.arc(px, py, 16, 0, Math.PI * 2); g.stroke(); g.globalAlpha = 1; }
    }
    { const [px, py] = nodeAt(n), sel = ow.sel === n;                  // the optional training node, off the main path
      g.strokeStyle = '#ff7ad8'; g.lineWidth = 1.5; g.setLineDash([3, 4]); g.beginPath(); g.moveTo(...nodeAt(0)); g.quadraticCurveTo(160, 40, px, py); g.stroke(); g.setLineDash([]);
      g.fillStyle = '#000'; g.beginPath(); g.arc(px, py, 13, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#c04ab8'; g.beginPath(); g.arc(px, py, 11, 0, Math.PI * 2); g.fill();
      g.font = 'bold 10px monospace'; g.fillStyle = '#fff'; g.fillText('T', px, py + 1);
      if (sel) { g.strokeStyle = '#ffe14d'; g.lineWidth = 2; g.globalAlpha = 0.6 + 0.4 * Math.sin(clock / 160); g.beginPath(); g.arc(px, py, 16, 0, Math.PI * 2); g.stroke(); g.globalAlpha = 1; } }
    { const mi = n + 1, sel = ow.sel === mi, M = D.items && D.items.merchant, im2 = M && img[M.src] && img[M.src].im;   // the Bone Merchant sits by the first level
      if (im2) {
        const bob2 = Math.sin(clock / 400) * 1;
        pixOval(MERCHANT_AT[0], MERCHANT_AT[1] + 1, 16, 3, '#0a0614', 0.5);
        const mw = M.w, mh = M.h, mLeft = Math.round(MERCHANT_AT[0] - mw / 2), mTop = Math.round(MERCHANT_AT[1] - mh + bob2);
        castOnGround(gameSil('merch' + mw, im2, 0, 0, im2.width, im2.height, mw, mh, '#0a0614', false), mLeft, mTop, MERCHANT_AT[1], LIGHTS.trail, 1);
        g.drawImage(im2, mLeft, mTop, mw, mh);
        g.font = 'bold 7px monospace'; g.textAlign = 'center'; g.textBaseline = 'top'; g.strokeStyle = '#000'; g.lineWidth = 3; g.fillStyle = '#ffe14d';
        g.strokeText('BONE MERCHANT', MERCHANT_AT[0], MERCHANT_AT[1] - M.h - 11); g.fillText('BONE MERCHANT', MERCHANT_AT[0], MERCHANT_AT[1] - M.h - 11);
        if (sel) { g.strokeStyle = '#ffe14d'; g.lineWidth = 2; g.globalAlpha = 0.6 + 0.4 * Math.sin(clock / 160); g.strokeRect(MERCHANT_AT[0] - M.w / 2 - 3, MERCHANT_AT[1] - M.h - 3, M.w + 6, M.h + 8); g.globalAlpha = 1; }
        g.textBaseline = 'middle';
      } }
    // Max stands on the selected node and bobs a little
    const [mx, my] = ow.sel === n + 1 ? [MERCHANT_AT[0] + 44, MERCHANT_AT[1] + 4] : nodeAt(ow.sel), im = D.moves.idle, sc = 0.4, bob = Math.sin(clock / 260) * 1.5;
    g.save(); g.translate(Math.round(mx), Math.round(my - 14 + bob));
    blit(img[im.sheet].im, 0, im.cell[0], im.cell[1], -im.anchor[0] * sc, -im.anchor[1] * sc, null, sc);
    g.restore();
    // header and the info strip for the selected level
    const isM = ow.sel === n + 1, isT = ow.sel >= n, L = isM ? { name: 'Bone Merchant', blurb: `Bones, Bone Powder, Quartz, Garnet, Diamonds, Mutagens and Scrolls. You have ${P.state.leaves} Leaves.` } : isT ? LV.training : LV.levels[ow.sel], open = isT || P.levelOpen(ow.sel + 1), got = P.state.unlocked.length;
    g.textAlign = 'center'; g.textBaseline = 'top'; g.lineJoin = 'round'; g.lineWidth = 3;
    g.font = 'bold 12px monospace'; g.strokeStyle = '#000'; g.fillStyle = '#ffe14d';
    g.strokeText('OVERWORLD', V.w / 2, 10); g.fillText('OVERWORLD', V.w / 2, 10);
    g.fillStyle = 'rgba(12,10,18,0.85)'; g.fillRect(24, 170, V.w - 48, 38);
    g.strokeStyle = '#ffd24a'; g.lineWidth = 1; g.strokeRect(24.5, 170.5, V.w - 49, 37);
    g.font = 'bold 9px monospace'; g.fillStyle = '#fff';
    g.fillText(isT ? L.name : `Level ${L.n}: ${L.name}${P.state.cleared.includes(L.n) ? '  (cleared)' : ''}`, V.w / 2, 175);
    g.font = '7px monospace'; g.fillStyle = '#e6e6ec';
    g.fillText(open ? L.blurb : `Locked. Beat level ${L.n - 1} first.`, V.w / 2, 188);
    g.fillStyle = '#9a9aa8';
    g.fillText(`${isM ? 'A or Enter: shop   ' : open ? 'A or Enter: play   ' : ''}Left and Right: choose   Start: menu   Moves found: ${got}/${P.UNLOCKS.length}`, V.w / 2, 198);
    g.textAlign = 'left';
    drawBanners();
  }
  function enterTraining() { startLevel(0, LV.training); }
  function enterLevel(n) {
    if (n === LV.levels.length + 2) { openShop(); return; }
    if (n > LV.levels.length) { enterTraining(); return; }
    if (!P.levelOpen(n)) { hint(`Locked: beat level ${n - 1} first`); return; }
    startLevel(n);
  }
  function goOverworld() {
    if (level) syncProgress();
    storyAt = null; level = null; curMap = null; screen = 'overworld'; paused = false; gameOver = false; levelDone = false;
    enemies.length = 0; respawns.length = 0; gems.length = 0; explosions.length = 0; floaters.length = 0;
    powerups.length = 0; particles.length = 0; banners.length = 0; hitQ.length = 0;
    stun = null; slide = null; fall = null; cur = null; queued = null; hold = null; tint = null; floorY = 0; camY = 0; rumble = null; flight = null; rainbow = null; ult = null;
    ow.sel = Math.max(0, Math.min(LV.levels.length, P.state.levelsUnlocked) - 1);
    hideMenu(); ignoreHeldButtons(); setStartLabel();
    if (killsEl) killsEl.textContent = '';
    canvas.focus();
  }
