'use strict';
  // ---- Sunset Training: the heavy bag swings and counts, Slime Bunny gives tips. Nothing here touches progress.
  const train = { last: 0, total: 0, hits: 0, combo: 0, comboAt: -1e9, t0: 0 };
  const TIPS = [
    "Hi, I'm Slime Bunny! Welcome to Sunset Training. Hit the heavy bag with any move you own.",
    "To see your moves: press Start (pad) or Enter, Space or Escape (keyboard), then pick Moves: Gamepad or Moves: Keyboard.",
    "The lists only show moves you own. Buy more from the Bone Merchant on the overworld with Leaves.",
    "The bag never breaks. Your last hit, total damage, hits and combo are at the top right.",
    "Your meters and health refill here, so try everything, even the beams.",
    "Tap B to parry, hold B to block. A parry pushes enemies back and reflects shards.",
    "Mash A for the attack chain once you have it. More combos hide in the later levels.",
    "Ready to go? Open the menu and choose Back to the overworld.",
  ];
  function bagHit(e, dmg) {                                       // any hit on the bag: count it, swing it, spark
    if (dmg <= 0) return;
    const b = hurtOf(e), cx = b ? (b[0] + b[2]) / 2 : e.x, cy = b ? (b[1] + b[3]) / 2 : 30;
    train.total += dmg;
    if (!beamTick) { train.last = dmg; train.hits++; train.combo = clock - train.comboAt < 1400 ? train.combo + 1 : 1; train.comboAt = clock; }
    const dir = bodyX() <= e.x ? 1 : -1;
    e.sw = e.sw || { a: 0, v: 0 };
    e.sw.v += dir * Math.min(0.012, 0.0025 + dmg * 0.00007);
    floater(cx, (b ? b[3] : 60) + 4, '-' + dmg, RED);
    if (!beamTick) impact(cx, cy, dmg, null, false);
    e.tint = { color: WHITE, alpha: 0.5, until: clock + 70 };
  }
  function stepBag(e, dt) {                                        // a pendulum: it swings back and settles
    e.hp = e.maxHp; e.scale = 1; e.state = 'idle'; e.taunted = false;
    const w = e.sw = e.sw || { a: 0, v: 0 };
    w.v += (-0.00016 * w.a - 0.0035 * w.v) * dt * 4; w.a += w.v * dt;
    w.a = Math.max(-1.2, Math.min(1.2, w.a));
  }
  function drawTraining(sx, sy) {                                  // Slime Bunny: bobbing on the right
    const B = D.training && D.training.bunny; if (!B || !level || !level.def.training) return;
    const gy = V.feetRow + camY + sy, X = BUNNY_X + sx, ph = (clock % 1800) / 1800, hop = ph < 0.25 ? Math.sin(ph / 0.25 * Math.PI) * 9 : 0;
    const sq = ph < 0.25 ? 1.08 : 1 + 0.05 * Math.sin(clock / 260), sc = SPRITE_SCALE;
    g.save(); g.translate(Math.round(X), Math.round(gy - hop)); g.scale(1 / sq, sq);
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(0, hop, 14, 3, 0, 0, 7); g.fill();
    g.drawImage(img[B.sheet].im, 0, 0, B.cell[0], B.cell[1], -B.anchor[0] * sc, -B.anchor[1] * sc, B.cell[0] * sc, B.cell[1] * sc);
    g.restore();
  }
  const BUNNY_X = 338;
  function wrapText(txt, maxW) {
    const words = txt.split(' '), lines = []; let cur = '';
    for (const w of words) { const t = cur ? cur + ' ' + w : w; if (g.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
    if (cur) lines.push(cur); return lines;
  }
  function drawTrainingHud() {
    if (!level || !level.def.training) return;
    g.save(); g.textBaseline = 'top'; g.lineJoin = 'round';
    g.font = 'bold 7px monospace'; g.textAlign = 'right'; g.lineWidth = 2;
    const rows = [['LAST HIT', train.last], ['TOTAL', train.total], ['HITS', train.hits], ['COMBO', clock - train.comboAt < 1400 ? train.combo : 0]];
    rows.forEach(([k, v], i) => { const y = 20 + i * 10; g.strokeStyle = '#000'; g.fillStyle = '#ffb0f0'; g.strokeText(k, V.w - 52, y); g.fillText(k, V.w - 52, y); g.fillStyle = '#fff'; g.strokeText(String(v), V.w - 8, y); g.fillText(String(v), V.w - 8, y); });
    // the speech bubble
    const tip = TIPS[Math.floor((clock - train.t0) / 8500) % TIPS.length];
    g.font = '7px monospace'; g.textAlign = 'left';
    const lines = wrapText(tip, 150), w = Math.min(166, Math.max(...lines.map(l => g.measureText(l).width)) + 12), h = lines.length * 9 + 8;
    const bx = Math.max(6, Math.min(V.w - w - 6, BUNNY_X - w / 2)), by = V.feetRow - 36 - h;
    g.fillStyle = 'rgba(255,255,255,0.95)'; g.strokeStyle = '#7a2a8a'; g.lineWidth = 1.5;
    g.beginPath(); g.rect(bx, by, w, h); g.fill(); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.95)'; g.beginPath(); g.moveTo(BUNNY_X - 6, by + h); g.lineTo(BUNNY_X + 4, by + h); g.lineTo(BUNNY_X, by + h + 8); g.closePath(); g.fill(); g.stroke();
    g.fillRect(BUNNY_X - 5, by + h - 1, 9, 3);
    g.fillStyle = '#3a1048'; lines.forEach((l, i) => g.fillText(l, bx + 6, by + 5 + i * 9));
    g.restore();
  }
