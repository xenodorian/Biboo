/* st143: overworld has no bottom info strip; Bone Merchant and Sunset Training are separate panels above the path */
  function drawOverworld() {
    const n = LV.levels.length;
    g.fillStyle = '#10151c'; g.fillRect(0, 0, V.w, V.h);
    for (const l of D.layers) {
      const im = img[l.src] && img[l.src].im;
      if (!im) continue;
      const sw = im.width, sh = im.height;
      const srcH = Math.min(sh, Math.round(sw * V.h / V.w));
      const srcY = Math.max(0, Math.round((sh - srcH) * 0.2));
      const dx = -clock * 0.012 * l.parallax;
      let x0 = (Math.round(dx) % sw + sw) % sw - sw;
      g.imageSmoothingEnabled = false;
      for (let xx = x0; xx < V.w; xx += sw) g.drawImage(im, 0, srcY, sw, srcH, xx, 0, sw, V.h);
    }
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
    // Two separate panels above the path: the Bone Merchant (left) and Sunset Training (right). Sprites and labels are 2x.
    const panel = (at, sel, label) => {
      const x = Math.round(at[0] - OW_PANEL_W / 2), y = OW_PANEL_Y;
      g.fillStyle = 'rgba(12,10,18,0.6)'; g.fillRect(x, y, OW_PANEL_W, OW_PANEL_H);
      g.strokeStyle = sel ? '#ffe14d' : '#6a5a35'; g.lineWidth = sel ? 3 : 1;
      g.globalAlpha = sel ? 0.7 + 0.3 * Math.sin(clock / 160) : 1; g.strokeRect(x + 0.5, y + 0.5, OW_PANEL_W - 1, OW_PANEL_H - 1); g.globalAlpha = 1;
      g.font = 'bold 14px monospace'; g.textAlign = 'center'; g.textBaseline = 'top'; g.strokeStyle = '#000'; g.lineWidth = 4; g.lineJoin = 'round'; g.fillStyle = '#ffe14d';
      g.strokeText(label, at[0], at[1] + 8); g.fillText(label, at[0], at[1] + 8);
      g.textBaseline = 'middle';
    };
    { const sel = ow.sel === n + 1, M = D.items && D.items.merchant, im2 = M && img[M.src] && img[M.src].im;
      panel(MERCHANT_AT, sel, 'BONE MERCHANT');
      if (im2) {
        const bob2 = Math.sin(clock / 400) * 2, mw = M.w * 2, mh = M.h * 2;
        pixOval(MERCHANT_AT[0], MERCHANT_AT[1] + 1, 32, 6, '#0a0614', 0.5);
        g.imageSmoothingEnabled = false;
        g.drawImage(im2, Math.round(MERCHANT_AT[0] - mw / 2), Math.round(MERCHANT_AT[1] - mh + bob2), mw, mh);
      }
    }
    { const sel = ow.sel === n, B = D.training && D.training.bunny, H = D.enemies && D.enemies.heavybag;
      const bun = B && img[B.sheet] && img[B.sheet].im, bag = H && img[H.sheet] && img[H.sheet].im;
      panel(TRAIN_AT, sel, 'SUNSET TRAINING');
      g.imageSmoothingEnabled = false;
      if (bag) {                                                          // the heavy bag hangs on the right and sways a little
        const bx = TRAIN_AT[0] + 40, sw = Math.sin(clock / 700) * 0.06;
        pixOval(bx, TRAIN_AT[1] + 1, 18, 3, '#0a0614', 0.5);
        g.save(); g.translate(bx, TRAIN_AT[1] - H.cell[1]); g.rotate(sw); g.translate(0, H.cell[1]);
        g.drawImage(bag, 0, 0, H.cell[0], H.cell[1], -H.anchor[0], -H.anchor[1], H.cell[0], H.cell[1]); g.restore();
      }
      if (bun) {                                                          // Slime Bunny on the left, hopping now and then
        const bx = TRAIN_AT[0] - 40, ph = (clock % 1800) / 1800, hop = ph < 0.25 ? Math.sin(ph / 0.25 * Math.PI) * 9 : 0;
        pixOval(bx, TRAIN_AT[1] + 1, 12, 3, '#0a0614', 0.5);
        g.drawImage(bun, 0, 0, B.cell[0], B.cell[1], Math.round(bx - B.anchor[0]), Math.round(TRAIN_AT[1] - hop - B.anchor[1]), B.cell[0], B.cell[1]);
      }
    }
    const [mx, my] = ow.sel === n + 1 ? [MERCHANT_AT[0] + 120, MERCHANT_AT[1] + 4] : ow.sel === n ? [TRAIN_AT[0] - 120, TRAIN_AT[1] + 4] : nodeAt(ow.sel), im = D.moves.idle, sc = 1.0, bob = Math.sin(clock / 260) * 1.5;
    g.save(); g.translate(Math.round(mx), Math.round(my + bob));
    blit(img[im.sheet].im, 0, im.cell[0], im.cell[1], -im.anchor[0] * sc, -im.anchor[1] * sc, null, sc);
    g.restore();
    g.textAlign = 'center'; g.textBaseline = 'top'; g.lineJoin = 'round'; g.lineWidth = 9;
    g.font = 'bold 36px monospace'; g.strokeStyle = '#000'; g.fillStyle = '#ffe14d';     // 3x the old 12px title
    g.strokeText('OVERWORLD', V.w / 2, 10); g.fillText('OVERWORLD', V.w / 2, 10);
    g.textAlign = 'left';
    drawBanners();
  }
