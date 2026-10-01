'use strict';
  // ------------------------------------------------------------------ state
  // cur: {id, k: frame index, t: ms into the frame, base: [x, y] where the move started, kind}
  let cur = null, queued = null, x = 0, camX = 0, camY = 0;
  // Hold-and-release attacks: the chord (B+L1 energy kick, direction+A lunging thrust) starts a charge; letting go of a button fires the move.
  // Every attack named "energy" is charged: press and hold its buttons (the charge pose plays, energy drains, Max turns blue
  // when full) and let go to fire. A release before MIN_FIRE ms does nothing; a partial charge fires at 50% to 100% power.
  const HOLD_FIRE = { energy_kick: ['B', 'L1'], energy_burst: ['L2'], energy_wave: ['R2'], energy_dash_thrust: ['X', 'A'] };
  const ENERGY_HOLD = new Set(['energy_kick', 'energy_burst', 'energy_wave', 'energy_dash_thrust']);
  const MIN_FIRE = 250;
  let hold = null;                      // {move, keys}: the charge in progress
  let facing = 1, camLead = 0;          // facing: 1 right, -1 left (each move keeps the one it started with)
  let fall = null;                      // {y, v}: coming back down after a move that ends in the air
  let rumble = null;                    // {t0, ms, amp}: shake that outlasts a move (the earthquake)
  let clock = 0;
  // levels: the level being played, its loaded map, and the surface she stands on (see "levels" below)
  const LV = window.BIBOO_LEVELS, MAP_W = LV.MAP_W;
  let level = null, curMap = null;
  let screen = 'title';                 // 'title', 'overworld' or 'level'
  let floorY = 0;                       // height of the surface she stands on: 0 is the ground, a platform or barrier top is more
  let prevFeet = null, lastCx = null;   // her feet height and anchor x on the last frame, for landing and blocking
  const powerups = [], particles = [], banners = [];
  const AIR_SPEED = 0.16;               // px/ms she can steer sideways in the air (a jump reaches about 65 px)
  const CAM_KEEP = 100;                 // the camera only rises when she is higher than this above the ground
  let showBoxes = false;                // H: draw hurtboxes and hit shapes
  let stun = null;                      // {v: px/ms (signed), a: px/ms^2, y, vy}: knocked back, no control
  let slide = null;                     // {v, a}: the small push back of a blocked hit
  let tint = null;                      // {color, until}: her flash (red hit, white block)
  let invuln = 0;                       // clock time until she can be hit again
  const hitQ = [];                      // attack frames shown this tick: {f, px, py}
  const started = [];                   // every move started, for the log and the browser test
  const JUMP = D.moves.jump;
  const FALL_K = JUMP.frames.findIndex((f, i) => i > 0 && f.root[1] < JUMP.frames[i - 1].root[1]);
  const LAND_K = JUMP.frames.findIndex((f, i) => i > FALL_K && f.root[1] === 0);

  // root motion of frame k; the crash started in the air is scaled to begin at her height
  function rootOf(c, k = c.k) {
    if (c.phys) return [0, c.phys.y];                            // the plain jump is driven by physics, not by frame root motion
    const r = D.moves[c.id].frames[k].root, s = c.face || 1;
    return c.air ? [s * (r[0] - c.air.x0), r[1] * c.air.s] : [s * r[0], r[1]];
  }
  function airborne() {
    if (fall || (cur && cur.kind === 'fall')) return true;
    return !!cur && cur.kind === 'action' && cur.id !== 'jump_crash' && rootOf(cur)[1] > 0;
  }
  // A in the air: the crash starts at its raised-sword frame, at her current height and x
  function airCrash(via) {
    if (!canAfford('jump_crash')) { if (cur) cur.crash = false; deny('jump_crash'); return; }   // 30 energy, or no crash
    spend('energy', MOVE_COST.jump_crash[1]);
    const h = fall ? fall.y : rootOf(cur)[1];
    if (cur && !fall && cur.kind !== 'fall') x += rootOf(cur)[0];
    fall = null; queued = null;
    const m = D.moves.jump_crash, k0 = m.frames.findIndex(f => f.name === 'apex');
    const a = m.frames[k0].root;
    cur = { id: 'jump_crash', k: k0, t: 0, kind: 'action', from: x, face: facing, air: { x0: a[0], s: h / a[1] }, lite: h <= CRASH_HIGH, height: h };
    started.push({ id: 'jump_crash', via: via || 'air' });
    logMove('jump_crash', 'air');
    queueHit();
  }
  const AIR = D.input.bindings.filter(b => b.type === 'air');
  const usesButton = (input, b) => input.split(/[-+]/).includes(b);

  // first frame of a move: some moves skip their opening, or pick up from the pose of the move
  // they interrupt (the heavy chop starts from the charge pose, not from the idle guard)
  function entryFrame(id) {
    const m = D.moves[id], en = m.enter;
    if (!en) return 0;
    const find = name => m.frames.findIndex(f => f.name === name);
    if (cur && en.fromMove && en.fromMove[cur.id]) {
      const now = D.moves[cur.id].frames[cur.k].name;
      const k = find(en.fromMove[cur.id][now] || now);
      if (k >= 0) return k;
    }
    return Math.max(0, find(en.default));
  }

  // The heavy chop gets its black-and-white impact frame and camera shake only after a full charge
  // (Up held FULL_CHARGE ms); the crash only when it starts more than two body lengths up.
  // Without them the move plays its other frames and effects (the dirt plume) with no shake.
  const FULL_CHARGE = 1000, BODY_LEN = 82, CRASH_HIGH = 2 * BODY_LEN;
  // A full impact also holds its black-and-white frame a little longer and shakes the ground: the
  // shake starts on the frame where the blade lands and fades out over QUAKE_MS.
  const BW_HOLD = 110, QUAKE_AT = { heavy: 'impact', jump_crash: 'crash' }, QUAKE_MS = 1000, QUAKE_AMP = 14;
  const CHARGED_TINT = { color: '#2f7bff', alpha: 0.5 };   // Max turns blue once the charge is complete
  // Charging costs energy: CHARGE_ENERGY for a full charge, drawn evenly while Up is held. The charge only
  // grows while the meter can pay, so with no energy it stops where it is.
  const CHARGE_ENERGY = 20;
  let meterAcc = 0;                                          // ms toward the next L1+R1 meter tick
  let chargeMs = 0;                                          // charge built up so far, 0 to FULL_CHARGE
  const isCharged = () => !!cur && cur.id === 'charge' && chargeMs >= FULL_CHARGE;
  function stepCharge(dt) {
    if (chargeMs >= FULL_CHARGE) return;
    const want = dt * CHARGE_ENERGY / FULL_CHARGE, pay = Math.min(want, energyMeter);
    if (pay <= 0) return;
    spend('energy', pay);
    chargeMs = Math.min(FULL_CHARGE, chargeMs + dt * pay / want);
  }
  function impactQuake() {
    if (!cur || cur.kind !== 'action' || cur.lite) return;
    if (QUAKE_AT[cur.id] === D.moves[cur.id].frames[cur.k].name) rumble = { t0: clock, ms: QUAKE_MS, amp: QUAKE_AMP };
  }
  // The plain jump (Y) is a physics jump: a short crouch, then launch at JUMP_V0 (px/ms) under gravity JUMP_G. Gravity is
  // halved near the top so she hangs a moment, which makes it slower, smoother and floatier than the old frame by frame hop.
  // It rises about 135 px in 280 ms and stays up about 670 ms (the old hop was about 410 ms); with Left or Right held she covers about 107 px sideways. Steering in the air is
  // in step(). The sky dash (Down then Up) is a separate move and is unchanged.
  const FLY_MS = 5000, FLY_VY = 0.11, FLY_MIN = 6, FLY_MAX = 150;
  let flight = null, trailAcc = 0;
  function startFlight() {
    if (stun || flight || pitFall) return;
    const y0 = Math.max(heightAbove(), 0);
    if (cur && !fall && cur.kind !== 'fall') x += rootOf(cur)[0];
    fall = null; queued = null; slide = null; hold = null;
    cur = { id: 'jump', k: 3, t: 0, kind: 'action', face: facing, phys: { y: Math.max(y0, FLY_MIN) + 6, v: 0 } };
    flight = { until: clock + FLY_MS };
    floater(bodyX(), herY() + herTop() + 8, 'Flight', '#7fd0ff');
  }
  // Rainbow Guard: 5 seconds of complete invulnerability, cycling through the rainbow, and pitfalls count as solid ground
  const RAINBOW_MS = 5000, RAINBOW_CYCLE = 450;
  let rainbow = null;
  const rainbowOn = () => !!rainbow && clock < rainbow.until;
  function startRainbow() {
    if (stun || pitFall) return;
    rainbow = { until: clock + RAINBOW_MS }; invuln = Math.max(invuln, clock + RAINBOW_MS);
    floater(bodyX(), herY() + herTop() + 8, 'Rainbow', '#ffd24a');
  }
  const rainbowTint = () => ({ color: `hsl(${Math.floor(((clock - rainbow.until + RAINBOW_MS) % RAINBOW_CYCLE) / RAINBOW_CYCLE * 360)},100%,50%)`, alpha: 0.6, until: clock + 40 });
  // Ultimate Chain: after the four chain strikes, L1+R1+L2+R2 together: taunt, then the four beams one after another
  const ULT_STEPS = ['taunt', 'beam_plasma', 'beam_cloud', 'beam_fire', 'beam_laser'];
  let ult = null;
  function startUltimate() { if (!stun && !ult) ult = { steps: ULT_STEPS.slice() }; }
  function ultTick() {
    if (!ult) return;
    if (stun) { ult = null; return; }
    if (chainQueue.length || (cur && cur.kind === 'action') || fall || (cur && cur.kind === 'land')) return;
    const id = ult.steps.shift();
    if (!id) { ult = null; return; }
    if (D.moves[id] && !canAfford(id)) { deny(id); return; }       // no meter for this beam: on to the next
    queued = null; start(id, 'action', 'ultimate');
  }
  const JUMP_H = 130, JUMP_UP = 280, JUMP_G = 2 * JUMP_H / (JUMP_UP * JUMP_UP), JUMP_V0 = JUMP_G * JUMP_UP;
  const JUMP_HANG_V = 0.2 * JUMP_V0, JUMP_HANG_G = 0.5;
  function stepJump(dt) {
    const j = cur.phys;
    if (flight) {
      if (clock >= flight.until) flight = null;
      else {                                                       // flying: no gravity; Up and Down climb and dive
        const vy = ((isDown.has('Up') ? 1 : 0) - (isDown.has('Down') ? 1 : 0)) * FLY_VY;
        j.v = 0; j.y = Math.min(FLY_MAX, Math.max(FLY_MIN, j.y + vy * dt)); cur.k = 3;
        trailAcc += dt;
        while (trailAcc >= 25) {                                   // a trail of blue particles
          trailAcc -= 25;
          particles.push({ wx: legsX() + (Math.random() - 0.5) * 8, wy: herY() + 10 + Math.random() * 12, vx: (Math.random() - 0.5) * 0.04 - hf() * 0.02, vy: (Math.random() - 0.5) * 0.03, t0: clock, life: 450 + Math.random() * 250, c: ['#2f7bff', '#7fd0ff', '#1b46d8', '#bfe8ff'][Math.floor(Math.random() * 4)] });
        }
        return;
      }
    }
    j.v -= JUMP_G * (Math.abs(j.v) < JUMP_HANG_V ? JUMP_HANG_G : 1) * dt;
    j.y += j.v * dt;
    cur.k = j.v > 0.6 * JUMP_V0 ? 1 : j.v > 0.2 * JUMP_V0 ? 2 : j.v > -0.2 * JUMP_V0 ? 3 : 4;   // takeoff, rise, apex, fall frames
    if (j.y <= 0 && j.v < 0) {                                   // back down to the height she left from
      const y = j.y, vv = -j.v;
      if (floorY > 0) {                                          // she left a platform and walked off it in the air: keep falling
        const S = supportUnder(playerX(), floorY + 0.5);
        if (S < floorY - 0.5) {
          fall = { y: (floorY - S) + y, v: vv }; floorY = S;
          cur = { id: 'jump', k: FALL_K, t: 0, kind: 'fall', face: cur.face };
          return;
        }
      }
      cur = { id: 'jump', k: LAND_K, t: 0, kind: 'land', face: cur.face };
    }
  }
  // Double jump (an unlock): tap jump again in the air for a spinning second jump that rises about two more of her heights
  // (81 px). One per trip through the air; it resets when she touches down.
  const DJ_H = 2 * 81, SPIN_MS = 420;
  const DJ_V = Math.sqrt(2 * JUMP_G * 0.75 * DJ_H);            // the top of the arc is slower (halved gravity), so a little less than 2 g H
  let dblUsed = false;
  function tryDoubleJump() {
    if (!P.has('double_jump') || dblUsed || stun) return false;
    if (cur && cur.id === 'jump' && cur.kind === 'action' && cur.phys) { /* in the flight */ }
    else if (fall || (cur && cur.id === 'jump' && cur.kind === 'fall')) {           // dropped off a ledge or from a drop-through
      cur = { id: 'jump', k: 3, t: 0, kind: 'action', face: cur ? cur.face : facing, phys: { y: fall ? fall.y : 0, v: 0 } };
      fall = null;
    } else return false;
    cur.phys.v = Math.max(cur.phys.v, DJ_V);
    cur.spin = clock; dblUsed = true; queued = null;
    return true;
  }
  // double tap Down on a platform: drop through it to whatever is below
  const DROP_TAP_MS = 300;
  let lastDownT = -1e9;
  function dropThrough() {
    if (!curMap || floorY <= 0 || fall || stun) return false;
    if (cur && cur.kind !== 'hold' && cur.kind !== 'land') return false;
    const px = playerX();
    if (curMap.solids.some(sd => sd.top === floorY && overSurf(sd, span(px)))) return false;   // a block is not a plank
    const S = supportUnder(px, floorY);
    if (S >= floorY - 0.5) return false;
    if (cur) x += rootOf(cur)[0];
    fall = { y: floorY - S, v: 0.05 }; floorY = S;
    cur = { id: 'jump', k: FALL_K, t: 0, kind: 'fall', face: cur ? cur.face : facing };
    prevFeet = herY();
    return true;
  }
  function start(id, kind, via) {
    const k0 = entryFrame(id);
    let charged = cur && cur.id === 'charge' ? chargeMs : 0;
    if (via === 'chain' && (id === 'heavy' || id === 'energy_burst')) {          // the chain's finishers: no charging, but the energy is paid
      const pay = Math.min(CHARGE_ENERGY, energyMeter); spend('energy', pay); charged = FULL_CHARGE * pay / CHARGE_ENERGY;
    }
    if (id === 'charge' && !(cur && cur.id === 'charge')) chargeMs = 0;
    if (cur) x += rootOf(cur)[0];       // keep the ground covered so far; height resets
    cur = { id, k: k0, t: 0, kind, from: x, face: facing };
    if (id === 'parry') lastParryT = clock;
    if (id === 'heavy') { cur.lite = charged < FULL_CHARGE; cur.charged = charged; }
    if (ENERGY_HOLD.has(id) && (via === 'release' || via === 'chain')) cur.power = 0.5 + 0.5 * Math.min(1, charged / FULL_CHARGE);   // the charge sets the power
    if (kind === 'action' && MOVE_COST[id]) { const n = needOf(id); spend(n[0], n[1]); }
    if (kind === 'action') queueHit();
    if (id === 'taunt') {
      for (const en of enemies) {
        if (!alive(en) || isBoss(en)) continue;                      // bosses are immune to the taunt
        aggro(en, false);
        en.taunted = true; en.dropEmpower = true; en.speedMul = 2; en.dmgMul = 2;
        en.tint = TAUNT_TINT;
      }
    }
    if (kind === 'action' || kind === 'land') {
      started.push({ id, via: via || kind });
      logMove(id, via);
    }
  }
