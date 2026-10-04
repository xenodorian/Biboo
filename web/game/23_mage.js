'use strict';
  // ------------------------------------------------------------------ the fire mage (data in assets/mage.js)
  // A stationary caster. When she is within its range it plays its 20 frame fireball cast. From the 2nd frame to the 11th a reticle sits under
  // where her feet were when the 2nd frame began: it does NOT follow her, so she has about 1.5 s to run or dash away. On the 12th frame the
  // reticle goes and a 50 px radius explosion plays just above it (centred 50 px up), hurting every character in the radius for 50.
  const mageBlasts = [];                // {wx, wy, t0}
  const MAGE_RETICLE_FROM = 1, MAGE_FIRE_AT = 11;          // positions in the cast: frame 2 (index 1) shows the reticle, frame 12 (index 11) explodes
  function mageExplode(e, rx, ry) {
    const M = window.BIBOO.mage.blast, cx = rx, cy = ry + M.lift;
    mageBlasts.push({ wx: cx, wy: cy, t0: clock });
    shakeFor(260, 3.5);
    crateBlast(cx, cy, M.radius);
    for (const o of enemies) {                                  // every other character in the radius, the caster too
      if (!alive(o)) continue;
      const b = hurtOf(o);
      if (b && distBox(cx, cy, b) <= M.radius) hurtEnemy(o, M.damage);
    }
    if (distBox(cx, cy, herBox()) <= M.radius && clock >= invuln && !stun) knocked({ type: e.type, anim: 'fireball', x: cx });   // her: the blast's damage and knockback (ai.atk.fireball)
  }
  function mageStep(e, dt) {
    const T = EN[e.type], ai = T.ai;
    if (e.state === 'patrol' || e.state === 'walk') { e.state = 'idle'; e.rest = 400; play(e, 'idle'); }   // level data gives it a path; it holds its ground
    dt *= (e.speedMul || 1);
    const A = T.anims[e.anim]; let ended = false;
    e.t += dt;
    while (e.t >= T.frames[A.frames[e.k]].ms) {
      e.t -= T.frames[A.frames[e.k]].ms;
      if (e.k + 1 < A.frames.length) e.k++;
      else if (A.loop) e.k = 0;
      else { ended = true; e.t = 0; break; }
    }
    e.x = e.base + groundOff(e);
    if (e.state === 'dying') { e.dead += dt; e.cast = null; return; }
    if (e.state === 'stunned') {                                // hit: the cast is lost (no reticle, no blast)
      e.cast = null;
      if (e.push && e.push.v) {
        e.x += e.push.v * dt; e.base += e.push.v * dt;
        const v = e.push.v - Math.sign(e.push.v) * e.push.a * dt;
        if (Math.sign(v) === Math.sign(e.push.v) && v !== 0) { e.push.v = v; return; }
        e.push.v = 0;
      }
      if (e.stunUntil && clock < e.stunUntil) return;
      e.stunUntil = 0; e.tilt = 0;
      e.state = 'idle'; e.rest = ai.rest[0]; play(e, 'idle');
      return;
    }
    if (e.state === 'attack') {
      const c = e.cast;
      if (c) {
        if (c.rx == null && e.k >= MAGE_RETICLE_FROM) { c.rx = herMidX(); c.ry = floorY; }   // where her feet are now; fixed from here on
        if (!c.fired && e.k >= MAGE_FIRE_AT) { c.fired = true; mageExplode(e, c.rx, c.ry); }
      }
      if (ended) { e.state = 'idle'; e.rest = ai.rest[0] + Math.random() * (ai.rest[1] - ai.rest[0]); e.cast = null; play(e, 'idle'); }
      return;
    }
    const d = herMidX() - e.x;
    turn(e, d < 0 ? -1 : 1);
    e.rest -= dt;
    if (e.rest <= 0 && Math.abs(d) <= ai.range && Math.abs(herY() - (e.fy || 0)) <= 160) {
      e.state = 'attack'; e.cast = { rx: null, ry: 0, fired: false };
      play(e, 'fireball');
    }
  }
  function drawMageReticles(sx, sy) {                           // under the sprites: an oval on the ground where the blast will land
    const R = window.BIBOO.mage.reticle, im = img[R.src] && img[R.src].im;
    if (!im) return;
    for (const e of enemies) {
      const c = e.cast;
      if (!c || c.rx == null || c.fired || !alive(e)) continue;
      const X = Math.round(V.anchorX + (c.rx - camX) + sx), Y = Math.round(V.feetRow + camY + sy - c.ry);
      g.save();
      g.globalAlpha = 0.7 + 0.3 * Math.sin(clock / 110);
      g.drawImage(im, X - Math.round(R.w / 2), Y - Math.round(R.h / 2), R.w, R.h);
      g.restore();
    }
  }
  function drawMageBlasts(sx, sy) {
    const B = window.BIBOO.mage.blast, im = img[B.src] && img[B.src].im;
    if (!im) return;
    for (let i = mageBlasts.length - 1; i >= 0; i--) {
      const b = mageBlasts[i], f = Math.floor((clock - b.t0) / B.ms);
      if (f >= B.frames) { mageBlasts.splice(i, 1); continue; }
      if (f < 0) continue;
      const X = Math.round(V.anchorX + (b.wx - camX) + sx), Y = Math.round(V.feetRow + camY + sy - b.wy);
      g.drawImage(im, f * B.cell[0], 0, B.cell[0], B.cell[1], X - Math.round(B.cell[0] / 2), Y - Math.round(B.cell[1] / 2), B.cell[0], B.cell[1]);
    }
  }
  // Level 6, Moonlit Sanctum: one fire mage on the open ground of each map from 6.3 on (not the boss arena). Added here, after levels.js.
  (function () {
    const L = window.BIBOO_LEVELS && window.BIBOO_LEVELS.levels && window.BIBOO_LEVELS.levels[5];
    if (!L) return;
    L.maps.forEach((m, i) => {
      if (m.boss || i < 2 || m.enemies.some(en => en.type === 'firemage')) return;
      const clear = x => !m.pits.some(p => x > p.x0 - 40 && x < p.x1 + 40) && !m.solids.some(s => x > s.x0 - 40 && x < s.x1 + 40);
      const x = [470, 400, 540, 330, 250].find(clear);
      if (x != null) m.enemies.push({ type: 'firemage', x, fy: 0, path: [x, x], sight: 230 });
    });
  })();
