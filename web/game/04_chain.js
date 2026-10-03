'use strict';
  // ---- The attack chain (unlocks 'chain', 'chain_burst'): mash A. The 1st press is the normal slash, the 2nd to 4th are the chain strikes
  // (chain2 to chain4, no knockback), the 5th is the heavy chop without charging it (it still costs CHARGE_ENERGY). With 'chain_burst', a B tap
  // after the 4th A ends the chain in an energy burst instead. A press cancels the recovery of the move before it once its hit frames are over.
  const CHAIN_MS = 750, CHAIN_MOVES = ['slash', 'chain2', 'chain3', 'chain4'];
  let chain = { n: 0, t: -1e9 }, chainQueue = [];
  const lastHitFrame = id => { const fr = D.moves[id].frames; let k = -1; fr.forEach((f, i) => { if (f.hits && f.hits.length) k = i; }); return k; };
  const chainBusy = () => !!cur && cur.kind === 'action' && cur.k <= lastHitFrame(cur.id);      // the move before it is still hitting
  function chainGo(move) {                                           // play it now, or in order as soon as the move before it has finished hitting
    if (!chainQueue.length && !chainBusy()) { queued = null; start(move, 'action', 'chain'); }
    else chainQueue.push(move);
  }
  function chainTick() {
    if (!chainQueue.length) return;
    if (stun) { chainQueue.length = 0; return; }
    if (chainBusy()) return;
    queued = null; start(chainQueue.shift(), 'action', 'chain');
  }
  function chainPress() {                                            // an A press with the chain unlocked; true when the chain handled it
    if (!P.has('chain') || stun || fall || airborne() || (hold && ENERGY_HOLD.has(hold.move))) { chain.n = 0; return false; }
    const n = clock - chain.t <= CHAIN_MS && lastBClock <= chain.t ? chain.n + 1 : 1;   // a B in between starts the count over
    if (n === 1) { chain = { n: 1, t: clock }; return false; }       // the plain slash
    if (n <= 4) { chain = { n, t: clock }; chainGo(CHAIN_MOVES[n - 1]); return true; }
    chain = { n: 0, t: -1e9 };                                       // 5th press: the heavy chop, uncharged
    if (energyMeter < 1) return true;                                // no energy for the chop: the chain simply ends
    chainGo('heavy');
    return true;
  }
  function chainBurst() {                                            // a B tap right after the 4th A
    if (!P.has('chain_burst') || chain.n !== 4 || clock - chain.t > CHAIN_MS || stun || airborne()) return false;
    chain = { n: 0, t: -1e9 };
    if (energyMeter < 1) return true;
    chainGo('energy_burst');
    return true;
  }
  function request(move, via) {
    if (!D.moves[move] || stun || !moveOpen(move)) return;
    if (move === 'jump' && tryDoubleJump()) return;
    if (!canAfford(move)) { deny(move); return; }             // no meter: the move does not play
    const air = via === 'sequence' && (/^Up-/.test(D.moves[move].input) || move === 'meteor_shower') ? null     // Up then A (heavy, meteor shower) is not the air A
              : AIR.find(b => usesButton(D.moves[move].input, b.input));
    const inAir = airborne() || (cur && cur.id === 'jump' && cur.kind === 'action');
    if (ENERGY_HOLD.has(move) && via === 'release') {                   // let go of an energy charge: fire it if it was held long enough
      if (!(cur && cur.id === 'charge' && chargeMs >= MIN_FIRE)) return;
    } else if (ENERGY_HOLD.has(move)) {                                 // press and hold to charge (on the ground only)
      if (inAir || fall || (cur && cur.kind === 'action' && cur.id !== 'charge')) return;
      if (energyMeter < 1) { meterFlash.energy = clock + 500; return; }
      hold = { move, keys: HOLD_FIRE[move] }; queued = null;
      return;
    }
    if (air && inAir && !moveOpen('jump_crash')) return;      // A in the air does nothing until the crash is unlocked
    if (air) {
      if ((airborne() || (cur && cur.id === 'jump' && cur.kind === 'action')) && !canAfford('jump_crash')) { deny('jump_crash'); return; }
      if (airborne()) { airCrash(via); return; }
      // pressed during the jump's crouch: crash as soon as she leaves the ground
      if (cur && cur.id === 'jump' && cur.kind === 'action') { cur.crash = true; return; }
    }
    if (fall || (cur && cur.kind === 'land')) { queued = { move, via }; return; }
    const busy = cur && cur.kind === 'action';
    if (!busy || via !== 'press') start(move, 'action', via);   // chords, sequences, taps, releases cancel
    else queued = { move, via };                                 // a plain press waits its turn
  }

  function finishAction(t) {
    const m = D.moves[cur.id];
    if (m.aftershake && cur.kind === 'action') rumble = { t0: clock, ms: m.aftershake.ms, amp: m.aftershake.amp };
    const end = rootOf(cur, m.frames.length - 1);
    if (end[1] > 0) {                                            // ended in the air: fall back down
      x += end[0];
      fall = { y: end[1], v: 0 };
      cur = { id: 'jump', k: FALL_K, t: 0, kind: 'fall', face: cur.face };
      return;
    }
    x += end[0];
    cur = null;
    if (queued && !canAfford(queued.move)) { deny(queued.move); queued = null; }
    if (queued) { const q = queued; queued = null; start(q.move, 'action', q.via); }
    else holdState(t);
  }

  // Left and Right both walk with the forward walk; which way she goes and faces is `facing`
  const holdId = id => id === 'walk_left' ? 'walk_right' : id;
  const holdWant = t => { if (metersHeld() || hold) return 'charge'; const w = holdId(reader.holdMove(t)); return w === 'recover' && empowerMeter < HEAL_COST ? 'idle' : w; };
  function holdState(t) {
    const want = holdWant(t);
    if (!cur || cur.id !== want || cur.face !== facing) start(want, 'hold');
  }

  // a light heavy chop or crash passes straight over its black-and-white frame
  function msOf(c, k) { const f = D.moves[c.id].frames[k]; return f.bw ? (c.lite ? 0 : BW_HOLD) : f.ms; }

  function step(dt, t) {
    if (stun) { hold = null; stepStun(dt); return; }
    if (slide) {
      x += slide.v * dt;
      const v = slide.v - Math.sign(slide.v) * slide.a * dt;
      slide.v = Math.sign(v) === Math.sign(slide.v) ? v : 0;
      slide.vy += 0.0018 * WORLD_Y_SCALE * dt; slide.y = Math.max(0, slide.y - slide.vy * dt);      // the KNOCK_UP hop
      if (slide.v === 0 && slide.y === 0 && slide.vy >= 0) slide = null;
    }
    // steering in the air: hold Left or Right while a jump is up or she is falling
    const steer = (isDown.has('Right') ? 1 : 0) - (isDown.has('Left') ? 1 : 0);
    if (steer && !flight && (fall || (cur && (cur.kind === 'fall' || (cur.kind === 'action' && cur.id === 'jump' && rootOf(cur)[1] > 0))))) {
      const speed = dblUsed ? DOUBLE_AIR_SPEED : AIR_SPEED;
      x += steer * speed * dt; facing = steer; if (cur) cur.face = steer;
      if (cur && cur.id === 'jump' && cur.kind === 'action' && cur.phys && cur.phys.xRange != null) {
        x = Math.max(cur.phys.x0 - cur.phys.xRange, Math.min(cur.phys.x0 + cur.phys.xRange, x));
      }
    }
    if (fall) {
      fall.v += JUMP_G * dt;
      fall.y -= fall.v * dt;
      if (fall.y <= 0) { fall = null; cur = { id: 'jump', k: LAND_K, t: 0, kind: 'land', face: cur ? cur.face : facing }; }
      return;
    }
    if (!cur) holdState(t);
    if (cur.id === 'jump' && cur.kind === 'action') {            // the plain jump: crouch, then physics until she lands
      if (cur.phys) { stepJump(dt); return; }
      cur.t += dt;
      if (cur.t >= msOf(cur, 0)) { cur.phys = { y: 0, v: JUMP_V0 }; cur.k = 1; cur.t = 0; }
      return;
    }
    if (cur.kind === 'hold') {
      const want = holdWant(t);
      if (want !== cur.id || cur.face !== facing) { start(want, 'hold'); }
    }
    const m = D.moves[cur.id];
    cur.t += dt;
    while (cur.t >= msOf(cur, cur.k)) {
      cur.t -= msOf(cur, cur.k);
      cur.k++;
      if (cur.k < m.frames.length) { if (cur.kind === 'action') { queueHit(); impactQuake(); } continue; }
      if (cur.kind === 'land') { cur.k = m.frames.length - 1; finishAction(t); return; }
      if (cur.kind === 'action') { if (cur.id === 'beam_cloud' && btnHeld('A') && energyMeter >= BEAM_TICK_COST.cloud) { cur.beamCut = false;  const bi = D.moves.beam_cloud.frames.findIndex(f => f.beam); cur.k = bi >= 0 ? bi : 2; continue; } cur.k = m.frames.length - 1; finishAction(t); return; }
      if (m.loop) {                                              // next cycle carries on from here
        const r = m.frames.map(f => f.root[0]);
        const n = r.length;
        x += cur.face * (r[n - 1] + (n > 1 ? r[n - 1] - r[n - 2] : 0) - r[m.loopFrom]);
        cur.k = m.loopFrom;
      } else cur.k = m.frames.length - 1;
    }
  }

  const BOTH_SIDES = new Set(['spin_attack', 'energy_wave']);
  function queueHit() {
    const f = D.moves[cur.id].frames[cur.k];
    const r = rootOf(cur);
    if (cur.id === 'energy_wave' && f.name === 'plow') {                        // a projectile that touched nothing bursts at the end of its flight
      const px = x + r[0];
      for (const side of [cur.face, -cur.face]) waveBlast(cur, side, px + side * WAVE_END, 20);
    }
    if (f.hits) {
      hitQ.push({ f, px: x + r[0], py: r[1] + floorY, face: cur.face, mv: cur });
      if (BOTH_SIDES.has(cur.id)) hitQ.push({ f, px: x + r[0], py: r[1] + floorY, face: -cur.face, mv: cur });   // the spin also cuts behind her
    }
  }
