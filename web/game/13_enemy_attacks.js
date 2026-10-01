'use strict';
  // ------------------------------------------------------------------ enemy attacks on her
  // her hurtbox: x from her anchor, up to the top of her drawn body on this frame (hair, head and
  // arms, not the sword); while ducking it stops DUCK_TRIM px under the top of her head
  const HURT = [10 * SPRITE_SCALE, 0, 60 * SPRITE_SCALE];
  const DUCK_TRIM = 5;
  function herTop() {
    if (!cur) return D.moves.idle.frames[0].top;
    const top = D.moves[cur.id].frames[cur.k].top;
    return cur.id === 'duck' ? top - DUCK_TRIM : top;
  }
  const RED = '#ff2b2b', WHITE = '#ffffff';
  const DASH_HOP = 5, DASH_MOVES = new Set(['dash', 'dash_thrust', 'energy_dash_thrust', 'push_kick', 'energy_kick']);
  function dashHop() {                  // the dash, its thrusts and the push kicks rise 5 px and settle again over the move
    if (!cur || !DASH_MOVES.has(cur.id) || cur.kind === 'fall') return 0;
    const F = D.moves[cur.id].frames; let tot = 0, at = 0;
    for (let i = 0; i < F.length; i++) { if (i === cur.k) at = tot + Math.min(cur.t || 0, F[i].ms); tot += F[i].ms; }
    const u = Math.min(1, at / tot);
    return 4 * DASH_HOP * u * (1 - u);
  }
  const heightAbove = () => (stun ? stun.y : (fall ? fall.y : (cur && cur.kind !== 'fall' ? rootOf(cur)[1] : 0)) + (slide ? slide.y : 0) + (stun ? 0 : dashHop()));   // above the surface she stands on
  function herY() { return floorY + heightAbove() - pitSink(); }                                                              // world height of her feet
  const hf = () => cur ? cur.face : facing;
  const legsX = () => playerX() + hf() * LEGS;          // between her feet
  const bodyX = () => playerX() + hf() * BODY;         // her body centre
  function herBox() {
    const px = playerX(), py = herY(), f = hf();
    return [px + Math.min(f * HURT[0], f * HURT[2]), py + HURT[1], px + Math.max(f * HURT[0], f * HURT[2]), py + herTop() * SPRITE_SCALE];
  }
  function boxOf(e, h) {
    if (!h) return null;
    const s = SPRITE_SCALE * (e.scale || 1), fy = e.fy || 0;
    return e.face < 0
      ? [e.base + h[0] * s, h[1] * s + fy + (e.jy || 0), e.base + h[2] * s, h[3] * s + fy + (e.jy || 0)]
      : [e.base - h[2] * s, h[1] * s + fy + (e.jy || 0), e.base - h[0] * s, h[3] * s + fy + (e.jy || 0)];
  }
  const overlap = (a, b) => a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];
  // a push that starts at speed v0 and slows evenly to a stop: covers d px in ms
  const push = (d, ms) => ({ v: 2 * d / ms, a: 2 * d / (ms * ms) });
  const HIGH_K = D.moves.heavy.frames.findIndex(f => f.name === 'high');
  const parrying = () => cur && cur.id === 'parry' && cur.kind === 'action' && cur.k <= 2;
  const blocking = () => cur && cur.id === 'block';

  function parried(e) {
    const T = EN[e.type], [d, ms] = PARRY_KNOCK, p = push(d, ms);
    e.hitDone = true;
    hurtEnemy(e, PARRY_DMG);                                          // a successful parry of a melee attack also hurts the attacker
    if (!alive(e)) { parries++; return; }
    e.state = 'stunned';
    play(e, T.ai.stun || 'idle');
    e.push = { v: p.v * (e.x >= herMidX() ? 1 : -1), a: p.a };
    e.tint = { color: WHITE, alpha: 0.75, until: clock + ms };
    parries++;
    flashes.push({ wx: (bodyX() + e.x) / 2, wy: herY() + 24, t0: clock, ms: 240, r: 22, c: '#bfe8ff' }); hitStop(90); screenFlash = { c: '#ffffff', a: 0.3, t0: clock, ms: 110 };
  }
  const KNOCK_UP = 5;
  const newSlide = (p, dir) => ({ v: p.v * dir, a: p.a, y: 0, vy: -Math.sqrt(2 * 0.0018 * KNOCK_UP) });   // a block or a shot hit: slid back and up KNOCK_UP px
  function knocked(e) {                 // a clean hit: red, pushed away from the enemy, stunned
    const AT = (EN[e.type].ai.atk || {})[e.anim];                      // per-attack damage and knockback (new creatures)
    const [d, ms] = (AT && AT.knock) || EN[e.type].ai.knock, p = push(d, ms);
    const dir = herMidX() >= e.x ? 1 : -1;
    const y = heightAbove();
    if (cur && !fall && cur.kind !== 'fall') x += rootOf(cur)[0];
    fall = null; queued = null; slide = null;
    stun = { v: p.v * dir, a: p.a, y, vy: -Math.sqrt(2 * 0.0018 * KNOCK_UP) }; lastPushT = clock;   // knocked back and up KNOCK_UP px (so she clears the ground and ledge edges)
    cur = { id: 'heavy', k: HIGH_K, t: 0, kind: 'stun', from: x, face: cur ? cur.face : facing };
    tint = { color: RED, alpha: 0.6, until: clock + ms };
    invuln = clock + ms + 400;
    hits++;
    herHitFx();
    hurtHer(((AT && AT.dmg) || ENEMY_DMG[e.type] || EN[e.type].ai.dmg || 10) * (e.dmgMul || 1));
    if (hp <= 0) { stun.until = clock + KO_MS; floater(bodyX(), herY() + herTop() + 18, 'K.O.', RED); if (typeof triggerGameOver === 'function') triggerGameOver(); }
  }
  function blocked(e) {                 // white, a small slide back, no stun
    const dir = herMidX() >= e.x ? 1 : -1, p = push(8, 120);
    slide = newSlide(p, dir); lastPushT = clock;
    tint = { color: WHITE, alpha: 0.75, until: clock + 150 };
    blocks++;
    flashes.push({ wx: bodyX() + hf() * 12, wy: herY() + 22, t0: clock, ms: 160, r: 12, c: '#ffffff' }); hitStop(40);
  }
  function stepStun(dt) {
    x += stun.v * dt;
    const v = stun.v - Math.sign(stun.v) * stun.a * dt;
    stun.v = Math.sign(v) === Math.sign(stun.v) ? v : 0;
    if (stun.y > 0 || stun.vy < 0) {
      const f0 = floorY + stun.y;
      stun.vy += 0.0018 * dt; stun.y = Math.max(0, stun.y - stun.vy * dt);
      if (curMap) {                                   // knocked while in the air: land on a platform or block she falls through, not below it
        let T = -1; const sp = span(playerX());
        for (const sf of surfaces(curMap)) if (sf.top > floorY && overSurf(sf, sp) && f0 > sf.top && floorY + stun.y <= sf.top && sf.top > T) T = sf.top;
        if (T >= 0) { floorY = T; stun.y = 0; }
      }
    }
    if (stun.v === 0 && stun.y === 0 && (!stun.until || clock >= stun.until)) {
      if (stun.until) { if (typeof gameOver !== 'undefined' && gameOver) { stun = null; cur = null; return; } hp = maxHp(); floater(bodyX(), herY() + herTop() + 6, '+' + maxHp(), GREEN); }
      stun = null; cur = null; holdState(clock);
    }
  }
  let hits = 0, blocks = 0, parries = 0;

  // An enemy attack that reaches her lands HIT_DELAY ms after first contact. Until then a parry
  // still works, so the window covers the frames just before the swing and the start of its first
  // hitting frame. 90 ms is about one enemy frame: long enough to react to the swing appearing,
  // short enough that the hit does not feel late. Raised to 300 ms so a late parry still works.
  const HIT_DELAY = 300;
  function enemyAttacks() {
    const me = herBox();
    for (const e of enemies) {
      if (e.state !== 'attack' || e.hitDone) continue;
      if (parrying() && e.landAt) { parried(e); continue; }   // parried during the first hitting frame
      const T = EN[e.type], A = T.anims[e.anim];
      if (parrying()) {                 // the attack lands this frame or within the next two
        let soon = false;
        for (let j = e.k; j <= Math.min(e.k + 2, A.frames.length - 1) && !soon; j++) {
          const h = boxOf(e, T.frames[A.frames[j]].hit);
          soon = !!h && overlap(h, me);
        }
        if (soon) { parried(e); continue; }
      }
      if (!e.landAt) {
        const h = boxOf(e, frameOf(e).hit);
        if (!h || !overlap(h, me)) continue;
        e.landAt = clock + HIT_DELAY;   // contact: the hit lands shortly, parry still possible
      }
      if (clock < e.landAt) continue;
      e.hitDone = true;
      if (blocking()) blocked(e);
      else if (clock >= invuln && !stun) knocked(e);
    }
  }

  // walking and the plain dash stop at an enemy instead of passing through it: her body (HURT x
  // range) may not move into an enemy's hurtbox from the side it was on before this step
  const BLOCKED = new Set(['dash', 'walk_right', 'walk_left']);
  function blockMove(before) {
    if (!cur || !BLOCKED.has(cur.id) || before === null) return;
    const f = cur.face, _bw = Math.max(8, HURT[2] * 0.55), a = Math.min(f * HURT[0], f * _bw), b = Math.max(f * HURT[0], f * _bw);   // her body: [px + a, px + b]
    const px = playerX();
    let front = Infinity, back = -Infinity;
    for (const e of enemies) {
      const bx = hurtOf(e);
      if (!bx) continue;
      const me = herBox(); if (bx[1] > me[3] || bx[3] < me[1]) continue;      // above or below her: not in the way
      if (bx[0] >= before + b - 1) front = Math.min(front, bx[0] - b);       // to her right
      else if (bx[2] <= before + a + 1) back = Math.max(back, bx[2] - a);    // to her left
    }
    if (px > front) x -= px - front;
    else if (px < back) x += back - px;
  }

  function stepEnemies(dt) {
    for (const e of enemies) stepEnemy(e, dt);
    for (let i = enemies.length - 1; i >= 0; i--) if (enemies[i].state === 'dying' && enemies[i].dead > DIE_MS) enemies.splice(i, 1);
    if (!respawnOn) respawns.length = 0;
    for (let i = respawns.length - 1; i >= 0; i--) {
      if (clock < respawns[i].at) continue;
      spawn(respawns[i].type, respawns[i].side < 0 ? camX - V.anchorX - 40 : camX + V.w - V.anchorX + 40);   // just past an edge of the view
      respawns.splice(i, 1);
    }
  }
