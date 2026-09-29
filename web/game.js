/* Biboo move test: the move library played live from the Dreamcast pad.
 *
 * World: the parallax scene from swingkit (layers tile in x). The character always faces right.
 * Each move frame is one actor image (effects + character) placed at the character's world
 * position: start of the move + that frame's root motion (y up). Black-and-white impact frames
 * replace the whole view for their duration. Camera: follows the character in x, rises once a
 * jump clears 30 px (the same camera the exporter drew the impact frames with).
 *
 * Enemies (goblin, orc) walk toward her and attack when close; their attacks do no damage yet.
 * Any of her hit shapes (blade, foot, energy) touching an enemy's hurtbox kills it at once.
 * An enemy attack that reaches her: a clean hit turns her red and knocks her back, stunned (raised
 * sword pose) until the push ends; while blocking she flashes white and slides back a little; a
 * parry made while the attack is at most two frames from landing turns the enemy white and knocks
 * it back, stunned.
 */
(function () {
  'use strict';
  const D = window.BIBOO;
  const V = D.view;
  const canvas = document.getElementById('view');
  const g = canvas.getContext('2d');
  g.imageSmoothingEnabled = false;

  // ------------------------------------------------------------------ assets
  const img = {};
  function load(src) {
    if (img[src]) return img[src].p;
    const im = new Image();
    const p = new Promise((res, rej) => { im.onload = res; im.onerror = () => rej(new Error('missing ' + src)); });
    im.src = src;
    img[src] = { im, p };
    return p;
  }
  const srcs = [...D.layers.map(l => l.src), D.fringe.src];
  for (const m of Object.values(D.moves)) {
    srcs.push(m.sheet);
    for (const f of m.frames) if (f.bw) srcs.push(f.bw);
  }
  const EN = D.enemies || {};
  for (const e of Object.values(EN)) srcs.push(e.sheet);

  // ------------------------------------------------------------------ input
  const BUTTONS = ['Up', 'Down', 'Left', 'Right', 'A', 'B', 'X', 'Y', 'L', 'R'];
  const KEYS = { ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right',
                 KeyZ: 'A', KeyX: 'B', KeyC: 'X', KeyV: 'Y', KeyQ: 'L', KeyW: 'R' };
  const KEY_LABEL = { Up: '↑', Down: '↓', Left: '←', Right: '→', A: 'Z', B: 'X', X: 'C', Y: 'V', L: 'Q', R: 'W' };
  const PAD = { 0: 'A', 1: 'B', 2: 'X', 3: 'Y', 4: 'L', 5: 'R', 6: 'L', 7: 'R', 12: 'Up', 13: 'Down', 14: 'Left', 15: 'Right' };
  const keyDown = new Set(), padDown = new Set(), isDown = new Set();

  const reader = new BibooInput.Reader(D.input, {
    // releasing Up turns the charge into the heavy chop once the aura loop has started
    holdReady: (b) => cur && cur.id === D.input.bindings.find(x => x.input === b && x.type === 'hold').move
                      && cur.k >= D.moves[cur.id].loopFrom,
  });

  addEventListener('keydown', e => {
    if (e.code === 'KeyH' && !e.repeat) { showBoxes = !showBoxes; return; }
    const b = KEYS[e.code];
    if (!b) return;
    e.preventDefault();
    keyDown.add(b);
  });
  addEventListener('keyup', e => { const b = KEYS[e.code]; if (b) { e.preventDefault(); keyDown.delete(b); } });
  addEventListener('blur', () => keyDown.clear());

  // Controllers (USB or Bluetooth, including on Android) come through the browser's Gamepad API.
  // Browsers report most pads with the "standard" layout (A bottom, B right, X left, Y top, d-pad
  // 12-15). Pads without it are read with the same button numbers, and their d-pad is also read
  // from axes 6-7, where many of them put it. A pad only shows up after one of its buttons is
  // pressed while the page is open.
  let padName = '';
  function pollPad() {
    padDown.clear();
    let pads = [];
    try { pads = navigator.getGamepads ? navigator.getGamepads() : []; } catch (e) { pads = []; }
    let name = '';
    for (const p of pads) {
      if (!p || !p.connected) continue;
      name = name || `${p.id}${p.mapping === 'standard' ? '' : ' (non-standard layout)'}`;
      p.buttons.forEach((bt, i) => { if (PAD[i] && (bt.pressed || bt.value > 0.5)) padDown.add(PAD[i]); });
      const axis = i => (p.axes.length > i ? p.axes[i] : 0);
      const [ax, ay] = [axis(0), axis(1)];
      if (ax < -0.5) padDown.add('Left'); if (ax > 0.5) padDown.add('Right');
      if (ay < -0.5) padDown.add('Up'); if (ay > 0.5) padDown.add('Down');
      if (p.mapping !== 'standard') {
        if (axis(6) < -0.5) padDown.add('Left'); if (axis(6) > 0.5) padDown.add('Right');
        if (axis(7) < -0.5) padDown.add('Up'); if (axis(7) > 0.5) padDown.add('Down');
      }
    }
    padName = name;
  }
  addEventListener('gamepadconnected', () => pollPad());

  function readButtons(t) {
    pollPad();
    for (const b of BUTTONS) {
      const now = keyDown.has(b) || padDown.has(b);
      if (now && !isDown.has(b)) { isDown.add(b); reader.down(b, t); }
      else if (!now && isDown.has(b)) { isDown.delete(b); reader.up(b, t); }
    }
  }

  // ------------------------------------------------------------------ state
  // cur: {id, k: frame index, t: ms into the frame, base: [x, y] where the move started, kind}
  let cur = null, queued = null, x = 0, camX = 0, camY = 0;
  let fall = null;                      // {y, v}: coming back down after a move that ends in the air
  let rumble = null;                    // {t0, ms, amp}: shake that outlasts a move (the earthquake)
  let clock = 0;
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
    const r = D.moves[c.id].frames[k].root;
    return c.air ? [r[0] - c.air.x0, r[1] * c.air.s] : r;
  }
  function airborne() {
    if (fall || (cur && cur.kind === 'fall')) return true;
    return !!cur && cur.kind === 'action' && cur.id !== 'jump_crash' && rootOf(cur)[1] > 0;
  }
  // A in the air: the crash starts at its raised-sword frame, at her current height and x
  function airCrash(via) {
    const h = fall ? fall.y : rootOf(cur)[1];
    if (cur && !fall && cur.kind !== 'fall') x += rootOf(cur)[0];
    fall = null; queued = null;
    const m = D.moves.jump_crash, k0 = m.frames.findIndex(f => f.name === 'apex');
    const a = m.frames[k0].root;
    cur = { id: 'jump_crash', k: k0, t: 0, kind: 'action', from: x, air: { x0: a[0], s: h / a[1] } };
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

  function start(id, kind, via) {
    const k0 = entryFrame(id);
    if (cur) x += rootOf(cur)[0];       // keep the ground covered so far; height resets
    cur = { id, k: k0, t: 0, kind, from: x };
    if (kind === 'action') queueHit();
    if (kind === 'action' || kind === 'land') {
      started.push({ id, via: via || kind });
      logMove(id, via);
    }
  }

  function request(move, via) {
    if (!D.moves[move] || stun) return;
    const air = AIR.find(b => usesButton(D.moves[move].input, b.input));
    if (air) {
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
      cur = { id: 'jump', k: FALL_K, t: 0, kind: 'fall' };
      return;
    }
    x += end[0];
    cur = null;
    if (queued) { const q = queued; queued = null; start(q.move, 'action', q.via); }
    else holdState(t);
  }

  function holdState(t) {
    const want = reader.holdMove(t);
    if (!cur || cur.id !== want) start(want, 'hold');
  }

  function step(dt, t) {
    if (stun) { stepStun(dt); return; }
    if (slide) {
      x += slide.v * dt;
      const v = slide.v - Math.sign(slide.v) * slide.a * dt;
      slide = Math.sign(v) === Math.sign(slide.v) ? Object.assign(slide, { v }) : null;
    }
    if (fall) {                                                  // simple gravity, px/ms^2
      fall.v += 0.0018 * dt;
      fall.y -= fall.v * dt;
      if (fall.y <= 0) { fall = null; cur = { id: 'jump', k: LAND_K, t: 0, kind: 'land' }; }
      return;
    }
    if (!cur) holdState(t);
    if (cur.kind === 'hold') {
      const want = reader.holdMove(t);
      if (want !== cur.id) { start(want, 'hold'); }
    }
    const m = D.moves[cur.id];
    cur.t += dt;
    while (cur.t >= m.frames[cur.k].ms) {
      cur.t -= m.frames[cur.k].ms;
      cur.k++;
      if (cur.k < m.frames.length) { if (cur.kind === 'action') queueHit(); continue; }
      if (cur.kind === 'land') { cur.k = m.frames.length - 1; finishAction(t); return; }
      if (cur.kind === 'action') { cur.k = m.frames.length - 1; finishAction(t); return; }
      if (m.loop) {                                              // next cycle carries on from here
        const r = m.frames.map(f => f.root[0]);
        const n = r.length;
        x += r[n - 1] + (n > 1 ? r[n - 1] - r[n - 2] : 0) - r[m.loopFrom];
        cur.k = m.loopFrom;
      } else cur.k = m.frames.length - 1;
    }
  }

  function queueHit() {
    const f = D.moves[cur.id].frames[cur.k];
    const r = rootOf(cur);
    if (f.hits) hitQ.push({ f, px: x + r[0], py: r[1] });
  }

  // ------------------------------------------------------------------ enemies
  // e: {type, x: world x of its ground point, base: world x its frames are drawn from, face (-1 left,
  //     1 right), anim, k, t, state, rest, dead, dive: may dive roll on this approach}
  // Rolls and leaps move the art inside its frames; each frame's ground offset keeps e.x on the
  // body, so the enemy stays where an animation leaves it when the next one starts.
  const enemies = [];
  const respawns = [];                  // {type, at}
  let kills = 0, respawnOn = true;
  const BODY = 32;                      // her body centre, px ahead of her anchor
  const DIE_MS = 900;                   // death: animation or flicker, then fade

  function playerX() {
    if (!cur || fall || cur.kind === 'fall' || cur.kind === 'land') return x;
    return x + rootOf(cur)[0];
  }
  function spawn(type, wx) {
    const e = { type, x: wx, base: wx, face: -1, anim: 'walk', k: 0, t: 0, state: 'walk', rest: 0, dead: 0, dive: Math.random() < 0.5 };
    enemies.push(e);
    return e;
  }
  function frameOf(e) { const T = EN[e.type]; return T.frames[T.anims[e.anim].frames[e.k]]; }
  function groundOff(e) { const gx = frameOf(e).ground || 0; return e.face < 0 ? gx : -gx; }
  function play(e, anim) { e.anim = anim; e.k = 0; e.t = 0; e.hitDone = false; e.base = e.x - groundOff(e); }
  function turn(e, face) { if (face !== e.face) { e.face = face; e.base = e.x - groundOff(e); } }
  function alive(e) { return e.state !== 'dying'; }

  // hurtbox in world coordinates (y up from the ground)
  function hurtOf(e) {
    const h = frameOf(e).hurt;
    if (!h || !alive(e)) return null;
    return e.face < 0 ? [e.base + h[0], h[1], e.base + h[2], h[3]] : [e.base - h[2], h[1], e.base - h[0], h[3]];
  }

  function kill(e) {
    e.state = 'dying'; e.dead = 0;
    const death = EN[e.type].ai.death;
    if (death) play(e, death);
    kills++;
    respawns.push({ type: e.type, at: clock + DIE_MS + 1200 });
  }

  function stepEnemy(e, dt) {
    const T = EN[e.type], ai = T.ai;
    let A = T.anims[e.anim], ended = false;
    e.t += dt;
    while (e.t >= T.frames[A.frames[e.k]].ms) {
      e.t -= T.frames[A.frames[e.k]].ms;
      if (e.k + 1 < A.frames.length) e.k++;
      else if (A.loop) e.k = 0;
      else { ended = true; e.t = 0; break; }
    }
    e.x = e.base + groundOff(e);
    if (e.state === 'dying') { e.dead += dt; return; }
    if (e.state === 'stunned') {        // parried: slides back, no control until it stops
      e.x += e.push.v * dt; e.base += e.push.v * dt;
      const v = e.push.v - Math.sign(e.push.v) * e.push.a * dt;
      if (Math.sign(v) === Math.sign(e.push.v)) { e.push.v = v; return; }
      e.state = 'idle'; e.rest = ai.rest[0]; play(e, 'idle');
      return;
    }
    const d = playerX() + BODY - e.x, dist = Math.abs(d);
    // wait behind another enemy that is already closer to her
    const blocked = enemies.some(o => o !== e && alive(o) && Math.sign(o.x - e.x) === Math.sign(d)
                                      && Math.abs(o.x - e.x) < 40);
    if (e.state === 'attack') {
      if (!ended) return;
      e.state = 'idle'; e.rest = ai.rest[0] + Math.random() * (ai.rest[1] - ai.rest[0]); play(e, 'idle');
      e.dive = Math.random() < 0.5;
      return;
    }
    turn(e, d < 0 ? -1 : 1);
    if (e.state === 'idle') {
      e.rest -= dt;
      if (e.rest > 0) return;
      e.state = 'walk';
    }
    if (dist <= ai.reach) {
      e.state = 'attack';
      play(e, ai.attacks[Math.floor(Math.random() * ai.attacks.length)]);
    } else if (ai.dive && e.dive && !blocked && dist >= ai.dive.min && dist <= ai.dive.max) {
      e.state = 'attack'; e.dive = false;
      play(e, ai.dive.anim);
    } else if (blocked) {
      if (e.anim !== 'idle') play(e, 'idle');
    } else {
      if (e.anim !== 'walk') play(e, 'walk');
      const mv = e.face * Math.min(ai.speed * dt / 1000, dist - ai.reach);
      e.x += mv; e.base += mv;
    }
  }

  // ------------------------------------------------------------------ hits
  function distBox(px, py, b) {          // point to box [x0, y0, x1, y1]
    const dx = Math.max(b[0] - px, 0, px - b[2]), dy = Math.max(b[1] - py, 0, py - b[3]);
    return Math.hypot(dx, dy);
  }
  function worldShape(s, h) {
    const P = p => [h.px + p[0], h.py + p[1]];
    if (s.shape === 'capsule') return { shape: 'capsule', a: P(s.a), b: P(s.b), r: s.radius };
    if (s.shape === 'circle') return { shape: 'circle', c: P(s.c), r: s.r };
    const a = P(s.a), b = P(s.b);
    return { shape: 'box', box: [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])] };
  }
  function touches(w, box) {
    if (w.shape === 'circle') return distBox(w.c[0], w.c[1], box) <= w.r;
    if (w.shape === 'box') return w.box[0] <= box[2] && box[0] <= w.box[2] && w.box[1] <= box[3] && box[1] <= w.box[3];
    for (let i = 0; i <= 16; i++) {      // capsule: samples along the segment
      const u = i / 16;
      if (distBox(w.a[0] + (w.b[0] - w.a[0]) * u, w.a[1] + (w.b[1] - w.a[1]) * u, box) <= w.r) return true;
    }
    return false;
  }
  function resolveHits() {
    for (const h of hitQ) {
      for (const s of h.f.hits) {
        const w = worldShape(s, h);
        for (const e of enemies) {
          const box = hurtOf(e);
          if (box && touches(w, box)) kill(e);
        }
      }
    }
    lastHits = hitQ.splice(0);
  }
  let lastHits = [];

  // ------------------------------------------------------------------ enemy attacks on her
  const HURT = [10, 0, 60, 88];         // her body, px from her anchor (x right, y up)
  const RED = '#ff2b2b', WHITE = '#ffffff';
  function herY() { return stun ? stun.y : fall ? fall.y : (cur && cur.kind !== 'fall' ? rootOf(cur)[1] : 0); }
  function herBox() { const px = playerX(), py = herY(); return [px + HURT[0], py + HURT[1], px + HURT[2], py + HURT[3]]; }
  function boxOf(e, h) {
    if (!h) return null;
    return e.face < 0 ? [e.base + h[0], h[1], e.base + h[2], h[3]] : [e.base - h[2], h[1], e.base - h[0], h[3]];
  }
  const overlap = (a, b) => a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];
  // a push that starts at speed v0 and slows evenly to a stop: covers d px in ms
  const push = (d, ms) => ({ v: 2 * d / ms, a: 2 * d / (ms * ms) });
  const HIGH_K = D.moves.heavy.frames.findIndex(f => f.name === 'high');
  const parrying = () => cur && cur.id === 'parry' && cur.kind === 'action' && cur.k <= 2;
  const blocking = () => cur && cur.id === 'block';

  function parried(e) {
    const T = EN[e.type], [d, ms] = T.ai.parried, p = push(d, ms);
    e.hitDone = true;
    e.state = 'stunned';
    play(e, T.ai.stun || 'idle');
    e.push = { v: p.v * (e.x >= playerX() + BODY ? 1 : -1), a: p.a };
    e.tint = { color: WHITE, alpha: 0.75, until: clock + ms };
    parries++;
  }
  function knocked(e) {                 // a clean hit: red, pushed away from the enemy, stunned
    const [d, ms] = EN[e.type].ai.knock, p = push(d, ms);
    const dir = playerX() + BODY >= e.x ? 1 : -1;
    const y = herY();
    if (cur && !fall && cur.kind !== 'fall') x += rootOf(cur)[0];
    fall = null; queued = null; slide = null;
    stun = { v: p.v * dir, a: p.a, y, vy: 0 };
    cur = { id: 'heavy', k: HIGH_K, t: 0, kind: 'stun', from: x };
    tint = { color: RED, alpha: 0.6, until: clock + ms };
    invuln = clock + ms + 400;
    hits++;
  }
  function blocked(e) {                 // white, a small slide back, no stun
    const dir = playerX() + BODY >= e.x ? 1 : -1, p = push(8, 120);
    slide = { v: p.v * dir, a: p.a };
    tint = { color: WHITE, alpha: 0.75, until: clock + 150 };
    blocks++;
  }
  function stepStun(dt) {
    x += stun.v * dt;
    const v = stun.v - Math.sign(stun.v) * stun.a * dt;
    stun.v = Math.sign(v) === Math.sign(stun.v) ? v : 0;
    if (stun.y > 0) { stun.vy += 0.0018 * dt; stun.y = Math.max(0, stun.y - stun.vy * dt); }
    if (stun.v === 0 && stun.y === 0) { stun = null; cur = null; holdState(clock); }
  }
  let hits = 0, blocks = 0, parries = 0;

  function enemyAttacks() {
    const me = herBox();
    for (const e of enemies) {
      if (e.state !== 'attack' || e.hitDone) continue;
      const T = EN[e.type], A = T.anims[e.anim];
      if (parrying()) {                 // the attack lands this frame or within the next two
        let soon = false;
        for (let j = e.k; j <= Math.min(e.k + 2, A.frames.length - 1) && !soon; j++) {
          const h = boxOf(e, T.frames[A.frames[j]].hit);
          soon = !!h && overlap(h, me);
        }
        if (soon) { parried(e); continue; }
      }
      const h = boxOf(e, frameOf(e).hit);
      if (!h || !overlap(h, me)) continue;
      e.hitDone = true;
      if (blocking()) blocked(e);
      else if (clock >= invuln && !stun) knocked(e);
    }
  }

  // the plain dash stops at the first enemy in front of her instead of passing through it
  const BODY_FRONT = 60;                // px from her anchor to the front of her body in the dash
  function blockDash() {
    if (!cur || cur.id !== 'dash' || cur.kind !== 'action') return;
    let lim = Infinity;
    for (const e of enemies) {
      const b = hurtOf(e);
      if (b && b[0] >= cur.from + BODY_FRONT - 8) lim = Math.min(lim, b[0] - BODY_FRONT);
    }
    const px = x + rootOf(cur)[0];
    if (px > lim) x -= px - lim;
  }

  function stepEnemies(dt) {
    for (const e of enemies) stepEnemy(e, dt);
    for (let i = enemies.length - 1; i >= 0; i--) if (enemies[i].state === 'dying' && enemies[i].dead > DIE_MS) enemies.splice(i, 1);
    if (!respawnOn) respawns.length = 0;
    for (let i = respawns.length - 1; i >= 0; i--) {
      if (clock < respawns[i].at) continue;
      spawn(respawns[i].type, camX + V.w - V.anchorX + 40);   // just past the right edge of the view
      respawns.splice(i, 1);
    }
  }

  // ------------------------------------------------------------------ drawing
  function drawLayer(im, dx, dy) {
    // the layer's top-left sits at view (dx mod width, dy - margin); edge rows stretch past its ends
    const w = im.width, h = im.height, top = Math.round(dy) - V.margin;
    let x0 = (Math.round(dx) % w + w) % w - w;
    for (let xx = x0; xx < V.w; xx += w) {
      g.drawImage(im, xx, top);
      if (top > 0) g.drawImage(im, 0, 0, w, 1, xx, 0, w, top);
      if (top + h < V.h) g.drawImage(im, 0, h - 1, w, 1, xx, top + h, w, V.h - top - h);
    }
  }

  function draw() {
    if (!cur) return;
    const m = D.moves[cur.id];
    const f = m.frames[cur.k];
    const [rx, ry] = stun ? [0, stun.y] : fall ? [0, fall.y] : (cur.kind === 'fall' ? [0, 0] : rootOf(cur));
    let [sx, sy] = cur.kind === 'fall' || cur.kind === 'land' ? [0, 0] : f.shake;
    if (rumble) {                                                // fading aftershock
      const e = clock - rumble.t0;
      if (e >= rumble.ms) rumble = null;
      else {
        const a = rumble.amp * Math.pow(1 - e / rumble.ms, 1.5);
        sx += Math.round(a * Math.sin(e * 0.11)); sy += Math.round(a * Math.cos(e * 0.083));
      }
    }
    const px = x + rx;
    const targetY = Math.max(0, ry - 30);
    if (f.bw && cur.kind === 'action') {                         // impact frame: the whole view
      camX = px; camY = targetY;
      g.drawImage(img[f.bw].im, 0, 0);
      return;
    }
    for (const l of D.layers) drawLayer(img[l.src].im, -camX * l.parallax + sx * l.shake, camY * l.parallax + sy * l.shake);
    drawEnemies(sx, sy);
    const cw = m.cell[0], ch = m.cell[1];
    const ax = V.anchorX + (px - camX) + sx;
    const ay = V.feetRow - (ry - camY) + sy;
    const tc = tint && clock < tint.until ? tint : null;
    blit(img[m.sheet].im, cur.k * cw, cw, ch, Math.round(ax - m.anchor[0]), Math.round(ay - m.anchor[1]), tc);
    drawLayer(img[D.fringe.src].im, -camX + sx, camY + sy);
    if (showBoxes) drawBoxes(sx, sy);
  }

  // one sheet cell, optionally washed with a colour (a red hit, a white block or parry)
  const wash = document.createElement('canvas'), wg = wash.getContext('2d');
  function blit(im, sx, w, h, dx, dy, tc) {
    if (!tc) { g.drawImage(im, sx, 0, w, h, dx, dy, w, h); return; }
    if (wash.width < w || wash.height < h) { wash.width = Math.max(wash.width, w); wash.height = Math.max(wash.height, h); }
    wg.globalCompositeOperation = 'source-over'; wg.globalAlpha = 1;
    wg.clearRect(0, 0, wash.width, wash.height);
    wg.drawImage(im, sx, 0, w, h, 0, 0, w, h);
    wg.globalCompositeOperation = 'source-atop'; wg.globalAlpha = tc.alpha || 0.7;
    wg.fillStyle = tc.color; wg.fillRect(0, 0, w, h);
    g.drawImage(wash, 0, 0, w, h, dx, dy, w, h);
  }

  function drawEnemies(sx, sy) {
    const gy = V.feetRow + camY + sy;
    for (const e of enemies) {
      const T = EN[e.type];
      let alpha = 1;
      if (e.state === 'dying') {
        const fade = T.ai.death ? 500 : 400;
        if (!T.ai.death && e.dead < DIE_MS - fade && Math.floor(e.dead / 60) % 2) continue;   // no death art: flicker
        alpha = Math.max(0, Math.min(1, (DIE_MS - e.dead) / fade));
      }
      const cell = T.anims[e.anim].frames[e.k];
      const [cw, ch] = T.cell, [ax, ay] = T.anchor;
      const vx = Math.round(V.anchorX + (e.base - camX) + sx);
      g.save();
      g.globalAlpha = alpha;
      g.translate(vx, Math.round(gy - ay));
      if (e.face > 0) g.scale(-1, 1);                   // the art faces left; mirror to face right
      blit(img[T.sheet].im, cell * cw, cw, ch, -ax, 0, e.tint && clock < e.tint.until ? e.tint : null);
      g.restore();
    }
  }

  function drawBoxes(sx, sy) {
    const X = wx => V.anchorX + (wx - camX) + sx, Y = wy => V.feetRow + camY + sy - wy;
    g.save();
    g.lineWidth = 1;
    g.strokeStyle = '#ffe14d';
    for (const e of enemies) {
      const b = hurtOf(e);
      if (b) g.strokeRect(X(b[0]) + 0.5, Y(b[3]) + 0.5, b[2] - b[0], b[3] - b[1]);
    }
    g.strokeStyle = '#4dd2ff';
    { const b = herBox(); g.strokeRect(X(b[0]) + 0.5, Y(b[3]) + 0.5, b[2] - b[0], b[3] - b[1]); }
    g.strokeStyle = '#ff8a3d';
    for (const e of enemies) {
      const b = e.state === 'attack' ? boxOf(e, frameOf(e).hit) : null;
      if (b) g.strokeRect(X(b[0]) + 0.5, Y(b[3]) + 0.5, b[2] - b[0], b[3] - b[1]);
    }
    g.strokeStyle = '#ff4d4d';
    for (const h of lastHits) for (const s of h.f.hits) {
      const w = worldShape(s, h);
      g.beginPath();
      if (w.shape === 'box') g.rect(X(w.box[0]), Y(w.box[3]), w.box[2] - w.box[0], w.box[3] - w.box[1]);
      else if (w.shape === 'circle') g.arc(X(w.c[0]), Y(w.c[1]), w.r, 0, Math.PI * 2);
      else {
        g.lineWidth = w.r * 2; g.lineCap = 'round'; g.globalAlpha = 0.45; g.strokeStyle = '#ff4d4d';
        g.moveTo(X(w.a[0]), Y(w.a[1])); g.lineTo(X(w.b[0]), Y(w.b[1]));
        g.stroke(); g.lineWidth = 1; g.globalAlpha = 1; continue;
      }
      g.stroke();
    }
    g.restore();
  }

  function follow(dt) {
    if (!cur) return;
    const ry = stun ? stun.y : fall ? fall.y : (cur.kind === 'fall' ? 0 : rootOf(cur)[1]);
    const rx = fall || cur.kind === 'fall' ? 0 : rootOf(cur)[0];
    const ease = 1 - Math.exp(-dt / 70);
    camX += (x + rx - camX) * ease;
    camY += (Math.max(0, ry - 30) - camY) * ease;
  }

  // ------------------------------------------------------------------ HUD
  const padEl = document.getElementById('pad');
  const chips = {};
  for (const b of BUTTONS) {
    const d = document.createElement('div');
    d.className = 'btn';
    d.innerHTML = `${b}<kbd>${KEY_LABEL[b]}</kbd>`;
    padEl.appendChild(d);
    chips[b] = d;
  }
  const logEl = document.getElementById('log');
  function logMove(id, via) {
    const li = document.createElement('li');
    li.textContent = `${id}  (${D.moves[id].input}${via && via !== 'action' ? ', ' + via : ''})`;
    logEl.prepend(li);
    while (logEl.children.length > 8) logEl.lastChild.remove();
  }
  const table = document.querySelector('#moves tbody');
  const rows = {};
  const HOLDABLE = b => BibooInput.DIRS.includes(b) || D.input.bindings.some(x => x.input === b && x.type === 'hold');
  const keysOf = input => input === 'none' ? '' :
    input.split('-').map(step => step.split('+').map(b => KEY_LABEL[b] || b).join('+')).join(' then ');
  function how(b) {
    const steps = b.input.split('-');
    if (b.type === 'idle') return 'nothing pressed';
    if (b.type === 'hold') return 'hold';
    if (b.type === 'tap') return 'tap';
    if (b.type === 'press') return 'press';
    if (b.type === 'air') return 'press while in the air (jumping or falling); crashes down from that height';
    if (b.type === 'chord') {
      const keys = b.input.split('+');
      if (b.loose) return 'together, or one after another in any order';
      if (b.held) return `together, or hold ${b.held.join('+')} and press ${keys.filter(k => !b.held.includes(k)).join('+')}`;
      const dirs = keys.filter(k => BibooInput.DIRS.includes(k));
      if (dirs.length) return `hold ${dirs.join('+')}, press ${keys.filter(k => !dirs.includes(k)).join('+')}`;
      return 'together';
    }
    if (steps.length === 2 && HOLDABLE(steps[0])) {
      const last = steps[1].includes('+') ? steps[1] + ' together' : steps[1];
      return `tap or hold ${steps[0]}, then ${last}`;
    }
    return 'one after another' + (b.input.includes('+') ? ' (+ together)' : '');
  }
  for (const b of D.input.bindings) {
    const tr = document.createElement('tr');
    const m = D.moves[b.move];
    tr.innerHTML = `<td class="pad">${b.input === 'none' ? '(nothing)' : b.input + (b.type === 'air' ? ' (air)' : '')}</td><td class="keys">${keysOf(b.input)}</td>` +
                   `<td>${m ? m.title : b.move}</td><td class="how">${how(b)}</td>`;
    table.appendChild(tr);
    (rows[b.move] = rows[b.move] || []).push(tr);
  }
  const nowEl = document.getElementById('now');
  let lastShown = '';
  const killsEl = document.getElementById('kills');
  const padStatusEl = document.getElementById('padstatus');
  let padShown = null;
  function hud() {
    if (padStatusEl && padShown !== padName) {
      padShown = padName;
      padStatusEl.textContent = padName ? `Controller: ${padName}` : 'Controller: none seen yet. Connect it, then press any button on it.';
    }
    if (killsEl) killsEl.textContent = `Kills ${kills}`;
    for (const b of BUTTONS) chips[b].classList.toggle('on', isDown.has(b));
    const id = cur ? cur.id : '';
    const label = stun ? 'stunned' : fall || (cur && (cur.kind === 'fall' || cur.kind === 'land')) ? 'falling' : id;
    if (label !== lastShown) {
      lastShown = label;
      nowEl.innerHTML = label === 'stunned' ? 'Stunned' : label === 'falling' ? 'Landing'
        : `${D.moves[id].title}<small>${D.moves[id].input}</small>`;
      for (const trs of Object.values(rows)) for (const tr of trs) tr.classList.remove('playing');
      for (const tr of rows[id] || []) tr.classList.add('playing');
    }
  }

  // ------------------------------------------------------------------ loop
  let last = 0;
  function frame(t) {
    const dt = Math.min(100, last ? t - last : 16);
    last = t;
    clock = t;
    readButtons(t);
    for (const e of reader.update(t)) request(e.move, e.via);
    step(dt, t);
    if (cur && cur.crash && cur.id === 'jump' && rootOf(cur)[1] > 0) airCrash('air');
    blockDash();
    if (cur && cur.kind === 'action' && !hitQ.length) queueHit();   // the frame still on screen
    stepEnemies(dt);
    resolveHits();
    enemyAttacks();
    follow(dt);
    draw();
    hud();
    requestAnimationFrame(frame);
  }

  Promise.all(srcs.map(load)).then(() => {
    document.getElementById('loading').remove();
    if (EN.orc) spawn('orc', 260);
    if (EN.goblin) spawn('goblin', 360);
    canvas.focus();
    requestAnimationFrame(frame);
  }).catch(err => { document.getElementById('loading').textContent = String(err); });

  canvas.addEventListener('pointerdown', () => canvas.focus());
  // read-only hooks for the browser test
  window.bibooGame = {
    started, current: () => cur && { id: cur.id, k: cur.k, kind: cur.kind, y: fall ? fall.y : rootOf(cur)[1], air: !!cur.air }, x: () => x,
    playerX: () => playerX(),
    enemies: () => enemies.map(e => ({ type: e.type, x: e.x, face: e.face, state: e.state, anim: e.anim,
                                       tint: e.tint && clock < e.tint.until ? e.tint.color : null })),
    kills: () => kills,
    combat: () => ({ stun: !!stun, hits, blocks, parries, tint: tint && clock < tint.until ? tint.color : null }),
    setRespawn: on => { respawnOn = on; },
    attack: (i, anim) => { const e = enemies[i]; e.state = 'attack'; play(e, anim); },
    // test setup: clear the field and place enemies at distances from her anchor
    setEnemies: list => {
      enemies.length = 0; respawns.length = 0;
      for (const [type, dx, rest] of list) {                  // rest: stand still this long first (ms)
        const e = spawn(type, playerX() + dx);
        if (rest) { e.state = 'idle'; e.rest = rest; play(e, 'idle'); }
      }
    },
  };
})();
