'use strict';
  // ------------------------------------------------------------------ hazards: goblin shots, bombs, pitfalls
  // Shots: the goblin's backflip (its "dive" animation) throws two blue shards at frames SHOT_AT. Each flies in a straight line
  // at where she was when it was thrown and does SHOT_DMG. Holding B blocks one for no damage; a parry reflects it straight
  // forward (the way she faces) and the reflected shard hurts enemies and sets off bombs.
  const SHOT_SPEED = 0.24, SHOT_DMG = 20, SHOT_R = 5, SHOT_AT = [1, 3];
  const shots = [];                      // {x, y, vx, vy, from: 'foe' | 'her', t0, home?}
  // The combo's backflip leaves three streak shards. Each flies up and away at first, then after HOME_DELAY ms curves toward her
  // (turning at most HOME_TURN rad/ms) until it hits, is blocked, or is reflected. Parry is generous: a parry pressed up to
  // PARRY_EARLY ms before a shard arrives counts, and a shard that has reached her waits PARRY_LATE ms for a parry before it hurts.
  const COMBO_SHOT_AT = [3, 4, 6], COMBO_ANGLES = [28, 48, 72], COMBO_SHOT_DMG = 10;
  const COMBO_SPEED = 0.2, HOME_SPEED = 0.17, HOME_DELAY = 500, HOME_TURN = 0.0035, PARRY_EARLY = 450, PARRY_LATE = 200;
  let lastParryT = -1e9;
  function fireComboShard(e, n) {
    const a = COMBO_ANGLES[n] * Math.PI / 180, ox = e.x + e.face * 10, oy = (e.fy || 0) + 44;
    shots.push({ x: ox, y: oy, vx: e.face * Math.cos(a) * COMBO_SPEED, vy: Math.sin(a) * COMBO_SPEED, from: 'foe', t0: clock, home: true, streak: true, dmg: COMBO_SHOT_DMG });
  }
  function fireShot(e) {
    const ox = e.x + e.face * 14, oy = (e.fy || 0) + 40;
    const dx = herMidX() - ox, dy = herY() + herTop() * SPRITE_SCALE * 0.5 - oy, L = Math.hypot(dx, dy) || 1;
    shots.push({ x: ox, y: oy, vx: SHOT_SPEED * dx / L, vy: SHOT_SPEED * dy / L, from: 'foe', t0: clock });
  }
  function stepShots(dt) {
    for (let i = shots.length - 1; i >= 0; i--) {
      const sh = shots[i];
      if (sh.home && sh.from === 'foe' && clock - sh.t0 > HOME_DELAY && !sh.contactAt) {          // after the delay: curve toward her body
        const ta = Math.atan2(herY() + herTop() * SPRITE_SCALE * 0.5 - sh.y, herMidX() - sh.x), ca = Math.atan2(sh.vy, sh.vx);
        let d = ta - ca; d = Math.atan2(Math.sin(d), Math.cos(d));
        const na = ca + Math.max(-HOME_TURN * dt, Math.min(HOME_TURN * dt, d));
        sh.vx = Math.cos(na) * HOME_SPEED; sh.vy = Math.sin(na) * HOME_SPEED;
      }
      if (!sh.contactAt) { sh.x += sh.vx * dt; sh.y += sh.vy * dt; }                              // a shard that reached her holds still while she can parry
      if (clock - sh.t0 > (sh.home ? 7000 : 4000) || sh.x < -30 || sh.x > MAP_W + 30 || sh.y < -4 || sh.y > 400) { shots.splice(i, 1); continue; }
      const box = [sh.x - SHOT_R, sh.y - SHOT_R, sh.x + SHOT_R, sh.y + SHOT_R];
      if (sh.from === 'foe') {
        if (!overlap(box, herBox())) { sh.contactAt = 0; continue; }
        const dir = sh.vx >= 0 ? 1 : -1;
        if (!sh.contactAt) sh.contactAt = clock;
        const reflect = parrying() || lastParryT >= sh.contactAt - PARRY_EARLY;
        if (!reflect && !blocking() && clock - sh.contactAt < PARRY_LATE) continue;       // wait out the late-parry window
        if (reflect) {                                          // reflected: straight forward, a little faster
          sh.from = 'her'; sh.home = false; sh.contactAt = 0; sh.vx = hf() * SHOT_SPEED * 1.5; sh.vy = 0; sh.x = playerX() + hf() * 22; sh.t0 = clock;
          tint = { color: WHITE, alpha: 0.75, until: clock + 150 }; parries++;
          floater(bodyX(), herY() + herTop() * SPRITE_SCALE + 10, 'Reflect', '#8fd0ff');
          burst(sh.x, sh.y, 8, ['#ffffff', '#8fd0ff']);
        } else if (blocking()) {                                   // blocked: no damage
          const p = push(8, 120); slide = newSlide(p, dir); lastPushT = clock;
          tint = { color: WHITE, alpha: 0.75, until: clock + 150 }; blocks++;
          burst(sh.x, sh.y, 6, ['#ffffff', '#8fd0ff']);
          shots.splice(i, 1);
        } else if (clock >= invuln && !stun) {                     // a hit: damage, a short red flash and a small flinch
          hurtHer(sh.dmg || SHOT_DMG);
          herHitFx();
          const p = push(14, 180); slide = newSlide(p, dir); lastPushT = clock;
          tint = { color: RED, alpha: 0.6, until: clock + 220 }; invuln = clock + 500; hits++;
          burst(sh.x, sh.y, 8, ['#ff2b2b', '#8fd0ff']);
          shots.splice(i, 1);
        }
      } else {
        let hit = false;
        for (const e of enemies) { const hb = hurtOf(e); if (hb && overlap(box, hb)) { hurtEnemy(e, SHOT_DMG); hit = true; break; } }
        if (!hit && curMap) {
          for (const c of curMap.crates) if (!c.broken && overlap(box, crateBox(c))) { breakCrate(c); hit = true; break; }
          for (const b of curMap.bombs) if (!b.gone && overlap(box, bombBox(b))) { detonate(b); hit = true; break; }
        }
        if (hit) { burst(sh.x, sh.y, 8, ['#ffffff', '#8fd0ff']); shots.splice(i, 1); }
      }
    }
  }
  function drawShots(sx, sy) {
    for (const sh of shots) {
      const X = V.anchorX + (sh.x - camX) + sx, Y = V.feetRow + camY + sy - sh.y, a = Math.atan2(-sh.vy, sh.vx), mine = sh.from === 'her';
      g.save();
      g.translate(Math.round(X), Math.round(Y)); g.rotate(a);
      if (sh.streak) {                                                  // a combo shard: the long white and blue streak drawn in the backflip
        g.globalAlpha = 0.3; g.fillStyle = mine ? '#ffe14d' : '#4da6ff'; g.beginPath(); g.moveTo(8, 0); g.lineTo(-22, 3); g.lineTo(-22, -3); g.closePath(); g.fill();
        g.globalAlpha = 1; g.fillStyle = mine ? '#ffd24a' : '#8fb4ff'; g.beginPath(); g.moveTo(10, 0); g.lineTo(-14, 2); g.lineTo(-14, -2); g.closePath(); g.fill();
        g.fillStyle = '#fff'; g.beginPath(); g.moveTo(10, 0); g.lineTo(-6, 1); g.lineTo(-6, -1); g.closePath(); g.fill();
        g.restore(); continue;
      }
      g.globalAlpha = 0.35; g.fillStyle = mine ? '#ffe14d' : '#4da6ff'; g.beginPath(); g.ellipse(0, 0, 11, 6, 0, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 1; g.fillStyle = '#000'; g.beginPath(); g.moveTo(9, 0); g.lineTo(0, 4); g.lineTo(-8, 0); g.lineTo(0, -4); g.closePath(); g.fill();
      g.fillStyle = mine ? '#ffe680' : '#9fd0ff'; g.beginPath(); g.moveTo(8, 0); g.lineTo(0, 3); g.lineTo(-6, 0); g.lineTo(0, -3); g.closePath(); g.fill();
      g.fillStyle = '#fff'; g.fillRect(-2, -1, 7, 2);
      g.restore();
    }
  }

  // Bombs sit on the ground or a platform. Only she sets one off: by touching it, or with anything of hers that does damage
  // (a blade, a kick, a beam, a blast, a reflected shard). The blast does BOMB_DMG to her and to every enemy within BOMB_R px,
  // breaks crates and sets off other bombs in range a moment later. Enemies walk over bombs without harm.
  const BOMB_DMG = 50, BOMB_R = 50, BOMB_CHAIN_MS = 180;
  const bombBox = b => [b.x - 8, b.fy, b.x + 8, b.fy + 22];   // a little taller than it is drawn, so chest-high shards and blades can set it off
  function detonate(b) {
    if (b.gone) return;
    b.gone = true; if (level) level.popped.add(b.key);
    const cx = b.x, cy = b.fy + 7;
    explosions.push({ wx: cx, wy: cy, t0: clock, big: true, r: BOMB_R });
    burst(cx, cy, 14, ['#ffd060', '#ff6a20', '#444444']);
    rumble = { t0: clock, ms: 300, amp: 4 };
    for (const e of enemies) { const hb = alive(e) && hurtOf(e); if (hb && distBox(cx, cy, hb) <= BOMB_R) { e.shoved = clock; hurtEnemy(e, BOMB_DMG); } }
    if (!rainbowOn() && distBox(cx, cy, herBox()) <= BOMB_R) {
      hurtHer(BOMB_DMG);
      herHitFx();
      tint = { color: RED, alpha: 0.6, until: clock + 300 }; invuln = Math.max(invuln, clock + 500); hits++;
    }
    crateBlast(cx, cy, BOMB_R);
    if (curMap) for (const o of curMap.bombs) if (!o.gone && !o.fuse && Math.hypot(o.x - cx, o.fy - b.fy) <= BOMB_R) o.fuse = clock + BOMB_CHAIN_MS;
  }
  function stepBombs() {
    if (!curMap) return;
    const me = herBox();
    for (const b of curMap.bombs) {
      if (b.gone) continue;
      if (b.fuse && clock >= b.fuse) { detonate(b); continue; }
      if (overlap(me, bombBox(b))) detonate(b);
    }
  }
  function bombHitsFrom(w) { if (curMap) for (const b of curMap.bombs) if (!b.gone && touches(w, bombBox(b))) detonate(b); }
  function bombsInBox(box) { if (curMap) for (const b of curMap.bombs) if (!b.gone && overlap(box, bombBox(b))) detonate(b); }
  function drawBombs(sx, sy) {
    for (const b of curMap.bombs) {
      if (b.gone) continue;
      const X = Math.round(b.x + sx), Y = Math.round(groundY(sy) - b.fy), lit = !!b.fuse;
      g.fillStyle = '#000'; g.beginPath(); g.arc(X, Y - 6, 7, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#2b2b33'; g.beginPath(); g.arc(X, Y - 6, 6, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#5a5a68'; g.fillRect(X - 3, Y - 10, 2, 2);
      g.strokeStyle = '#8a6a3a'; g.lineWidth = 1; g.beginPath(); g.moveTo(X + 2, Y - 12); g.lineTo(X + 5, Y - 16); g.stroke();
      const on = lit ? Math.floor(clock / 50) % 2 : Math.floor(clock / 240) % 2;   // the fuse spark blinks
      g.fillStyle = on ? '#ffe14d' : '#ff6a20'; g.fillRect(X + 4, Y - 18, 3, 3);
      if (lit) pixGlow(X, Y - 6, 9, '#ff2b2b', 0.7);
    }
  }

  // Pitfalls: gaps in the ground. Her feet on the ground inside one mean instant death (she falls out of sight, then Game Over).
  // Enemies stop at the edge instead of walking in; only a push (a hit, a beam, a blast) can send one over, and then it falls.
  const inPit = px => (curMap && curMap.pits.find(p => px > p.x0 + 2 && px < p.x1 - 2)) || null;
  let lastPushT = -1e9;                  // when she was last pushed by an enemy or shot
  let pitFall = null;                    // {t0}: she is falling
  const PIT_GRAV = 0.0006 * WORLD_Y_SCALE;                // px/ms^2: she drops out of the bottom of the view; only then does the run end
  const pitSink = () => pitFall ? PIT_GRAV * (clock - pitFall.t0) * (clock - pitFall.t0) : 0;
  const pitOffScreen = () => pitSink() > V.h - V.feetRow + herTop() * SPRITE_SCALE + 8;   // her head has left the bottom of the view
  // She falls only when BOTH feet are over the gap: the feet span from 1 px behind to 38 px ahead of the anchor (measured from
  // the sprite, mirrored when she faces left). Standing with one foot over the edge is safe. Pits are at least 50 px wide
  // (levels.js) so both feet always fit.
  const FEET_BACK = 1, FEET_FRONT = 38;
  function feetSpan() { const px = playerX(), f = hf(); return f > 0 ? [px - FEET_BACK, px + FEET_FRONT] : [px - FEET_FRONT, px + FEET_BACK]; }
  function pitUnderFeet() {
    const fs = feetSpan();
    for (const p of curMap.pits) if (fs[0] >= p.x0 - 1 && fs[1] <= p.x1 + 1) return p;
    return null;
  }
  const pitsSolid = () => rainbowOn();                             // the rainbow guard: pitfalls count as solid ground
  function checkPit() {
    if (pitFall || !curMap || !curMap.pits.length || floorY !== 0 || herY() > 1.5) return;
    if (cheats.nopit || pitsSolid()) return;                          // pitfalls count as solid ground
    if (stun || slide) return;                                     // still being pushed: wait and see where it ends
    const p = pitUnderFeet();
    if (!p) return;
    if (cheats.invincible) {                                       // the cheat keeps her out of the hole: back to the nearer edge
      const px = legsX();
      x += (px - p.x0 < p.x1 - px) ? p.x0 - 4 - px : p.x1 + 4 - px;
      floater(bodyX(), 40, 'Saved', '#ffd24a');
      return;
    }
    pitFall = { t0: clock };
    invuln = clock + 1e9; stun = null; slide = null; fall = null; queued = null;
    cur = { id: 'jump', k: FALL_K, t: 0, kind: 'fall', face: hf() };
    floater(bodyX(), 40, 'FELL', RED);
  }
  // while something falls into a pit it is drawn only above the ground line or inside the pit, so the edges of the hole hide it
  function pitClip(sx, sy) {
    const gl = Math.round(groundY(sy));
    g.beginPath(); g.rect(0, 0, V.w, gl);
    for (const p of curMap.pits) g.rect(Math.round(p.x0 + sx), gl, p.x1 - p.x0, V.h - gl);
    g.clip();
  }
  function drawPits(sx, sy) {
    const top = Math.round(groundY(sy)) - 5;
    for (const p of curMap.pits) {
      const x0 = Math.round(p.x0 + sx), w = p.x1 - p.x0;
      g.fillStyle = '#05030a'; g.fillRect(x0, top, w, V.h - top + 40);
      g.fillStyle = '#1b1024'; for (let yy = top + 10; yy < V.h; yy += 14) g.fillRect(x0, yy, w, 3);   // dark bands: a deep shaft
      g.fillStyle = '#6b4a2a'; g.fillRect(x0 - 2, top, 2, 10); g.fillRect(x0 + w, top, 2, 10);        // the dirt rim
      g.fillStyle = '#3f8f3a'; g.fillRect(x0 - 3, top - 1, 3, 2); g.fillRect(x0 + w, top - 1, 3, 2);
      g.fillStyle = '#c8b4e0'; for (let k = 0; k < w; k += 8) g.fillRect(x0 + k + 2, top + 1, 3, 2);       // teeth of the hole
    }
  }
  // an enemy sent over a pit by a push falls in and is gone (no drops)
  function plunge(e) {
    if (e.state === 'dying') return;
    kill(e, true);
    e.sink = 0; e.sinkAt = clock;
  }
