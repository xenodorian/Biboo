'use strict';
  // ------------------------------------------------------------------ beams
  // A beam move's frames carry beam: {kind, x, y}: where the beam leaves the blade tip (px from her
  // anchor, y up). The beam is a tiled texture from D.beams that scrolls away from her, grows out over
  // its first moments and reaches BEAM_LEN px; every BEAM_TICK ms it hits the enemies it touches.
  const BEAM_LEN = 500, BEAM_GROW = 8, BEAM_SPEED = 0.45, BEAM_TICK = 100, BEAM_CORE = 0.7;
  function beamNow() {
    if (!cur || cur.kind !== 'action' || cur.beamCut) return null;
    const m = D.moves[cur.id], f = m.frames[cur.k];
    if (!f.beam) return null;
    let k0 = cur.k;
    while (k0 > 0 && m.frames[k0 - 1].beam) k0--;
    let el = cur.t;
    for (let k = k0; k < cur.k; k++) el += m.frames[k].ms;
    const r = rootOf(cur), T = D.beams[f.beam.kind];
    const len = Math.min(BEAM_LEN, 40 + el * BEAM_GROW);
    const HILT_X = 58 * SPRITE_SCALE, HILT_Y = 48 * SPRITE_SCALE;
    const ox = x + r[0] + cur.face * HILT_X, oy = r[1] + floorY + HILT_Y;
    const last = cur.k + 1 >= m.frames.length || !m.frames[cur.k + 1].beam;
    return { kind: f.beam.kind, face: cur.face, ox, oy, len, el, last, T,
             box: [Math.min(ox, ox + cur.face * len), oy - T.h * BEAM_CORE / 2, Math.max(ox, ox + cur.face * len), oy + T.h * BEAM_CORE / 2] };
  }
  function beamHits() {
    const b = beamNow();
    if (!b) { if (cur) cur.beamT = 0; return; }
    if (clock < (cur.beamT || 0)) return;
    cur.beamT = clock + BEAM_TICK;
    const k = b.kind === 'plasma' ? 'empower' : 'energy', cost = BEAM_TICK_COST[b.kind] || 5;
    if (meterOf(k) < cost) {                                     // the meter ran dry: the beam stops and she recovers
      cur.beamCut = true; meterFlash[k] = clock + 500;
      const fr = D.moves[cur.id].frames;
      let j = cur.k; while (j < fr.length && fr[j].beam) j++;
      cur.k = Math.min(j, fr.length - 1); cur.t = 0;
      return;
    }
    spend(k, cost);                                              // every tick costs, whether or not it hits
    for (const e of enemies) { const box = hurtOf(e); if (box && overlap(box, b.box)) beamHit(e, b); }
    if (curMap) for (const c of curMap.crates) if (!c.broken && overlap(crateBox(c), b.box)) breakCrate(c);
    bombsInBox(b.box);
  }
  function beamHit(e, b) {
    if (e.type === 'duelist') { duelistHop(e); return; }
    if (b.kind === 'plasma' && isBoss(e)) return;                  // bosses are immune to the Empowerment Beam (no growing, no shove)
    if (b.kind === 'plasma') {
      e.scale = Math.max(e.scale || 1, 1.6);
      e.dropEnergy = true;
      e.tint = { color: '#a0f', alpha: 0.4, until: clock + 400 };
    }
    const was = alive(e);
    beamTick = true; hurtEnemy(e, BEAM_DMG[b.kind] || 0); beamTick = false;
    if (was && !alive(e)) lootGem(e.x, 'super', e.fy);                 // killed by a beam: a Super Gem
    const push = BEAM_PUSH[b.kind] || 0;
    if (push && alive(e)) { e.x += b.face * push; e.base += b.face * push; e.shoved = clock; }   // shoved away along the beam
  }
  function drawBeam(sx, sy) {
    const b = beamNow();
    if (!b) return;
    const X = V.anchorX + (b.ox - camX) + sx, Y = V.feetRow + camY + sy - b.oy;
    const im = img[b.T.src].im, w = b.T.w, h = b.T.h;
    const off = Math.floor(clock * BEAM_SPEED) % w;
    g.save();
    g.translate(Math.round(X), Math.round(Y));
    if (b.face < 0) g.scale(-1, 1);
    g.beginPath(); g.rect(0, -h, Math.ceil(b.len), h * 2); g.clip();
    if (b.last) g.globalAlpha = 0.6;
    for (let xx = off - w; xx < b.len; xx += w) g.drawImage(im, xx, -Math.round(h / 2));
    g.restore();
  }
