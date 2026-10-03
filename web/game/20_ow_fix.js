  function drawOverworld() {
    const n = LV.levels.length;
    g.fillStyle = '#10151c'; g.fillRect(0, 0, V.w, V.h);
    // Crop 640x512 layers into the 4:3 view (drop excess bottom fence, keep horizon)
    for (const l of D.layers) {
      const im = img[l.src] && img[l.src].im;
      if (!im) continue;
      const sw = im.width, sh = im.height;
      const srcH = Math.min(sh, Math.round(sw * V.h / V.w));
      const srcY = Math.max(0, Math.round((sh - srcH) * 0.2));
      const dx = -clock * 0.012 * l.parallax;
      let x0 = (Math.round(dx) % sw + sw) % sw - sw;
      g.imageSmoothingEnabled = false;
      for (let xx = x0; xx < V.w; xx += sw) {
        g.drawImage(im, 0, srcY, sw, srcH, xx, 0, sw, V.h);
      }
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
    { const [px, py] = nodeAt(n), sel = ow.sel === n;
      g.strokeStyle = '#ff7ad8'; g.lineWidth = 1.5; g.setLineDash([3, 4]); g.beginPath();
      const a = nodeAt(0);
      g.moveTo(a[0], a[1]);
      g.quadraticCurveTo(Math.round((a[0]+px)/2), Math.round(Math.min(a[1], py) - 40 * (typeof OW_SCALE !== 'undefined' ? OW_SCALE : V.h/216)), px, py);
      g.stroke(); g.setLineDash([]);
      g.fillStyle = '#000'; g.beginPath(); g.arc(px, py, 13, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#c04ab8'; g.beginPath(); g.arc(px, py, 11, 0, Math.PI * 2); g.fill();
      g.font = 'bold 10px monospace'; g.fillStyle = '#fff'; g.fillText('T', px, py + 1);
      if (sel) { g.strokeStyle = '#ffe14d'; g.lineWidth = 2; g.globalAlpha = 0.6 + 0.4 * Math.sin(clock / 160); g.beginPath(); g.arc(px, py, 16, 0, Math.PI * 2); g.stroke(); g.globalAlpha = 1; } }
    { const mi = n + 1, sel = ow.sel === mi, [px, py] = MERCHANT_AT;
      if (img[D.items.merchant.src] && img[D.items.merchant.src].im) {
        const im = img[D.items.merchant.src].im, sc = 1;
        g.drawImage(im, 0, 0, im.width, im.height, Math.round(px - 20), Math.round(py - 40), Math.round(40 * sc), Math.round(40 * sc));
      }
      g.strokeStyle = sel ? '#ffe14d' : '#c9a227'; g.lineWidth = sel ? 2 : 1;
      g.strokeRect(Math.round(px - 24) + 0.5, Math.round(py - 44) + 0.5, 48, 48);
      g.font = 'bold 7px monospace'; g.fillStyle = '#ffe14d'; g.textAlign = 'center';
      g.fillText('BONE MERCHANT', px, py - 50);
    }
    { const [mx, my] = ow.sel === n + 1 ? MERCHANT_AT : nodeAt(ow.sel), im = D.moves.idle, sc = 1.0, bob = Math.sin(clock / 260) * 1.5;
      g.save(); g.translate(Math.round(mx), Math.round(my + bob));
      blit(img[im.sheet].im, 0, im.cell[0], im.cell[1], -im.anchor[0] * sc, -im.anchor[1] * sc, null, sc);
      g.restore();
    }
    const isM = ow.sel === n + 1, isT = ow.sel >= n, L = isM ? { name: 'Bone Merchant', blurb: `Bones, Bone Powder, Quartz, Garnet, Diamonds, Mutagens and Scrolls. You have ${P.state.leaves} Leaves.` } : isT ? LV.training : LV.levels[ow.sel], open = isT || P.levelOpen(ow.sel + 1), got = P.state.unlocked.length;
    g.textAlign = 'center'; g.textBaseline = 'top'; g.lineJoin = 'round'; g.lineWidth = 3;
    g.font = 'bold 12px monospace'; g.strokeStyle = '#000'; g.fillStyle = '#ffe14d';
    g.strokeText('OVERWORLD', V.w / 2, 10); g.fillText('OVERWORLD', V.w / 2, 10);
    const stripY = V.h - 48;
    g.fillStyle = 'rgba(12,10,18,0.85)'; g.fillRect(24, stripY, V.w - 48, 38);
    g.strokeStyle = '#ffd24a'; g.lineWidth = 1; g.strokeRect(24.5, stripY + 0.5, V.w - 49, 37);
    g.font = 'bold 9px monospace'; g.fillStyle = '#fff';
    g.fillText(isT ? L.name : `Level ${L.n}: ${L.name}${P.state.cleared.includes(L.n) ? '  (cleared)' : ''}`, V.w / 2, stripY + 5);
    g.font = '7px monospace'; g.fillStyle = '#e6e6ec';
    g.fillText(open ? L.blurb : `Locked. Beat level ${L.n - 1} first.`, V.w / 2, stripY + 18);
    g.fillStyle = '#9a9aa8';
    g.fillText(`${isM ? 'A or Enter: shop   ' : open ? 'A or Enter: play   ' : ''}Left and Right: choose   Start: menu   Moves found: ${got}/${P.UNLOCKS.length}`, V.w / 2, stripY + 28);
    g.textAlign = 'left';
    drawBanners();
  }
