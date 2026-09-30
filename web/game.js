/* Parry Perry: the move library of Max Perry played live from the Dreamcast pad.
 *
 * World: the parallax scene from swingkit (layers tile in x). Max faces right; pressing Left turns
 * her to face left (art, hit shapes and motion mirrored) and pressing Right turns her back.
 * Each move frame is one actor image (effects + character) placed at the character's world
 * position: start of the move + that frame's root motion (y up). Black-and-white impact frames
 * replace the whole view for their duration. Camera: follows the character in x, rises once a
 * jump clears 30 px (the same camera the exporter drew the impact frames with).
 *
 * Beam moves draw a scrolling beam from the blade tip (D.beams) that kills what it touches.
 *
 * Game structure: title menu -> overworld -> level (10 one-screen maps, "Level 1.1" and so on). Progress
 * (unlocked moves and buttons, gems, meters, open levels) is in progress.js; map data is in levels.js; the
 * menus are in ui.js. Only A, B, X, Y and the d-pad work at first; golden crates hold unlocks. Meters show once
 * a move that uses them is unlocked. Enemies (goblin, orc) patrol a set path and chase when hit or when she is
 * within their sight range. Max and the enemies have HP: her hit shapes (blade, foot, energy, beams) take HP off
 * an enemy's hurtbox they touch. Enemies drop gems into a bag (Gems menu). An enemy attack that reaches her: a
 * clean hit turns her red and knocks her back; blocking flashes white; a well timed parry knocks the enemy back.
 * L1+L2+R1+R2 (or the ` key) opens the Dev Console.
 */
(function () {
  'use strict';
  const D = window.BIBOO;
  D.input.sequence_window_ms = 700;
  if (!D.input.bindings.some(b => b.input === 'Left-Right+A'))
    D.input.bindings.push({ input: 'Left-Right+A', type: 'sequence', move: 'beam_cloud' });
  for (const inp of ['Right-Left-A', 'Right-Left+A']) {
    if (!D.input.bindings.some(b => b.input === inp))
      D.input.bindings.push({ input: inp, type: 'sequence', move: 'beam_cloud' });
  }
  for (const b of D.input.bindings) {
    if (b.input === 'Left+A' && b.type === 'chord') b.move = 'thrust';
  }
  for (const inp of ['Down-Down-A', 'Down-Down+A']) {
    if (!D.input.bindings.some(b => b.input === inp))
      D.input.bindings.push({ input: inp, type: 'sequence', move: 'spin_attack' });
  }
  for (const b of D.input.bindings) {
    if (b.input === 'Down-Right-A-B' && b.type === 'sequence') b.input = 'Down-Right-A';
  }
  if (!D.input.bindings.some(b => b.input === 'Down-Right+A'))
    D.input.bindings.push({ input: 'Down-Right+A', type: 'sequence', move: 'energy_wave' });
  // energy dash thrust: double tap the forward button (either way), then X and A together
  D.input.bindings = D.input.bindings.filter(b => b.move !== 'energy_dash_thrust');
  for (const inp of ['Right-Right-X+A', 'Left-Left-X+A'])
    D.input.bindings.push({ input: inp, type: 'sequence', move: 'energy_dash_thrust' });
  const LRmap = { L: 'L1', 'A+L': 'A+L1', 'A+R': 'A+R1', 'B+L': 'B+L1', 'A+B+L': 'B+L1', 'L+R': 'L1+R1' };
  for (const b of D.input.bindings) {
    if (LRmap[b.input]) b.input = LRmap[b.input];
    if (b.move === 'heavy_kick') b.move = 'energy_kick';
  }
  const seenEk = new Set();
  D.input.bindings = D.input.bindings.filter(b => {
    if (b.move !== 'energy_kick') return true;
    if (seenEk.has(b.input)) return false;
    seenEk.add(b.input); return true;
  });
  D.input.bindings = D.input.bindings.filter(b => b.move !== 'heavy_kick');
  for (const b of D.input.bindings) { if (b.move === 'energy_wave') { b.input = 'R2'; b.type = 'press'; } }
  if (!D.input.bindings.some(b => b.move === 'energy_wave')) D.input.bindings.push({ input: 'R2', type: 'press', move: 'energy_wave' });
  D.input.bindings = D.input.bindings.filter(b => !(b.move === 'energy_wave' && b.input !== 'R2'));
  for (const b of D.input.bindings) { if (b.move === 'recover') { b.input = 'R'; b.type = 'hold'; } }
  if (!D.input.bindings.some(b => b.move === 'recover')) D.input.bindings.push({ input: 'R', type: 'hold', move: 'recover' });
  for (const b of D.input.bindings) {
    if (b.input === 'A+L2') b.move = 'beam_cloud';
    if (b.input === 'A+R2') b.move = 'beam_fire';
  }
  if (!D.input.bindings.some(b => b.input === 'A+L2'))
    D.input.bindings.push({ input: 'A+L2', type: 'chord', move: 'beam_cloud' });
  if (!D.input.bindings.some(b => b.input === 'A+R2'))
    D.input.bindings.push({ input: 'A+R2', type: 'chord', move: 'beam_fire' });
  for (const b of D.input.bindings) {
    if (b.move === 'energy_wave') { b.input = 'R2'; b.type = 'press'; }
  }
  if (!D.input.bindings.some(b => b.move === 'energy_wave'))
    D.input.bindings.push({ input: 'R2', type: 'press', move: 'energy_wave' });
  D.input.bindings = D.input.bindings.filter(b => !(b.move === 'energy_wave' && b.input !== 'R2'));
  // Beams: only A plus a shoulder button fires one. L2 cloud, R2 fire, L1 laser, R1 Empowerment Beam. Every
  // other beam binding (A+B, the Left-Right-A style sequences, the old A+L and A+R) is deleted.
  const BEAM_KEYS = { beam_cloud: 'A+L2', beam_fire: 'A+R2', beam_laser: 'A+L1', beam_plasma: 'A+R1' };
  D.input.bindings = D.input.bindings.filter(b => !b.move.startsWith('beam_') || BEAM_KEYS[b.move] === b.input);
  for (const [mv, inp] of Object.entries(BEAM_KEYS))
    if (!D.input.bindings.some(b => b.move === mv && b.input === inp)) D.input.bindings.push({ input: inp, type: 'chord', move: mv });
  // Energy burst is L2 on its own. L1+R1 is no longer a burst: holding both charges the meters (see metersHeld).
  D.input.bindings = D.input.bindings.filter(b => b.move !== 'energy_burst');
  D.input.bindings.push({ input: 'L2', type: 'press', move: 'energy_burst' });
  // Heavy Horizontal: hold B, tap A. It plays the horizontal slash animation with its own damage and pushback.
  if (!D.moves.heavy_horizontal)
    D.moves.heavy_horizontal = Object.assign({}, D.moves.slash, { title: 'Heavy Horizontal', input: 'A+B', inputType: 'chord' });
  D.input.bindings.push({ input: 'A+B', type: 'chord', move: 'heavy_horizontal', held: ['B'] });
  const V = D.view;
  const P = window.BibooProgress;
  // The player starts with the d-pad and A, B, X, Y only. Every other move is an unlock found in a golden crate
  // (web/progress.js). A move that is not open is not in the input reader at all, so the button that would have
  // triggered it falls back to the plain move (Down+A is just a slash until the upswing is unlocked).
  const BASE_MOVES = new Set(['idle', 'walk_right', 'walk_left', 'duck', 'block', 'parry', 'jump', 'dash', 'slash']);
  const moveOpen = move => BASE_MOVES.has(move) || P.hasMove(move);
  const SPRITE_SCALE = 0.5;
  if (D.moves.beam_plasma) D.moves.beam_plasma.title = 'Empowerment Beam';
  // Energy (blue) and empower (orange) meters. Gems dropped by defeated enemies fill them: taunted enemies
  // always drop an empower gem, enemies hit by the Empowerment Beam always drop an energy gem, and any
  // other kill drops a random gem GEM_CHANCE of the time. Energy pays for the beams and the energy wave,
  // empower for the Empowerment Beam and for kneeling to recover. A move whose meter cannot pay does not
  // play at all, and a beam or recovery stops the moment the meter runs dry.
  const ENERGY_MAX = 100, EMPOWER_MAX = 100, METER_START = 50;
  // The super meter (purple, SUP) starts empty and is filled only by Super Gems: one drops when an enemy is
  // killed by a beam. A full meter (100) pays for the earthquake and the meteor shower.
  const SUPER_MAX = 100;
  let energyMeter = P.state.meters.energy, empowerMeter = P.state.meters.empower, superMeter = P.state.meters.super;   // saved with the progress
  const GEM_VALUE = 25, GEM_CHANCE = 0.35, GEM_LIFE = 20000, GEM_PICKUP = 28;
  const BEAM_TICK_COST = { cloud: 1, fire: 3, laser: 3, plasma: 5 };         // per beam tick (100 ms)
  const MOVE_COST = { energy_wave: ['energy', 10], jump_crash: ['energy', 30], earthquake: ['super', 100], meteor_shower: ['super', 100] };   // earthquake and meteor shower need a full super meter and use all of it                          // paid once, when the move starts
  const HEAL_COST = 1;                                                        // empower per recover tick
  const meterOf = k => k === 'energy' ? energyMeter : k === 'super' ? superMeter : empowerMeter;
  function spend(k, n) {
    if (k === 'energy') energyMeter = Math.max(0, energyMeter - n);
    else if (k === 'super') superMeter = Math.max(0, superMeter - n);
    else empowerMeter = Math.max(0, empowerMeter - n);
  }
  let gems = [], meterFlash = { energy: 0, empower: 0, super: 0 }, lastDeny = 0;
  function spawnGem(wx, kind, fy) { gems.push({ x: wx, y: (fy || 0) + 14 + Math.random() * 8, fy: fy || 0, kind, bob: Math.random() * 6.28, t0: clock }); }
  // Progress is kept in progress.js; the meters live here while playing and are copied over when it is saved.
  function syncProgress() { P.state.meters = { energy: energyMeter, empower: empowerMeter, super: superMeter }; P.save(); }
  function meterStarts(had) {                        // a meter that has just become available starts at METER_START
    if (!had.energy && P.meterOn('energy')) energyMeter = Math.max(energyMeter, METER_START);
    if (!had.empower && P.meterOn('empower')) empowerMeter = Math.max(empowerMeter, METER_START);
  }
  const meterState = () => ({ energy: P.meterOn('energy'), empower: P.meterOn('empower'), super: P.meterOn('super') });
  function unlockItem(id) {                          // from a golden crate or the dev console
    const had = meterState();
    if (!P.unlock(id)) return false;
    meterStarts(had); refreshUnlocks(); syncProgress();
    return true;
  }
  function unlockEverything() {
    const had = meterState();
    P.unlockAll(); meterStarts(had); refreshUnlocks(); syncProgress();
  }
  // what a move needs before it may start: [meter, amount] or null
  function needOf(move) {
    if (MOVE_COST[move]) return MOVE_COST[move];
    const b = D.moves[move] && D.moves[move].frames.find(f => f.beam);
    if (b) return [b.beam.kind === 'plasma' ? 'empower' : 'energy', BEAM_TICK_COST[b.beam.kind] || 5];
    if (move === 'recover') return ['empower', HEAL_COST];
    return null;
  }
  function canAfford(move) { const n = needOf(move); return !n || meterOf(n[0]) >= n[1]; }
  function deny(move) {
    const n = needOf(move);
    meterFlash[n[0]] = clock + 500;
    if (clock - lastDeny > 500) { lastDeny = clock; floater(bodyX(), herY() + herTop() + 8, n[0] === 'energy' ? 'No energy' : n[0] === 'super' ? 'No super' : 'No empower', n[0] === 'energy' ? '#4af' : n[0] === 'super' ? '#c6f' : '#fa4'); }
  }
  // Walking over a gem puts it in the gem bag (the Gems menu); nothing is applied until the player uses it there.
  const GEM_LABEL = { health: 'Health Gem', energy: 'Energy Gem', empower: 'Empower Gem', super: 'Super Gem' };
  const GEM_COLOR = { health: '#3ddc5f', energy: '#4af', empower: '#fa4', super: '#c6f' };
  const GEM_HEAL = 50;                                                         // a health gem: +25 percent of MAX_HP (200)
  function stepGems(dt) {
    for (const gm of gems) gm.bob += dt * 0.006;
    gems = gems.filter(gm => {
      if (clock - gm.t0 > GEM_LIFE) return false;
      const hy = herY();
      if (Math.abs(gm.x - bodyX()) < GEM_PICKUP && hy < gm.fy + 50 && hy > gm.fy - 20 && P.addGem(gm.kind, 1) > 0) {
        floater(gm.x, gm.y + 24, '+' + GEM_LABEL[gm.kind], GEM_COLOR[gm.kind]);
        return false;
      }
      return true;
    });
  }
  function canUseGem(kind) {
    if ((P.state.gems[kind] || 0) < 1) return false;
    if (kind === 'health') return !!level && hp < MAX_HP;                      // health only matters inside a level
    if (!P.meterOn(kind)) return false;
    return meterOf(kind) < (kind === 'energy' ? ENERGY_MAX : kind === 'empower' ? EMPOWER_MAX : SUPER_MAX);
  }
  function useGem(kind) {
    if (!canUseGem(kind)) return;
    P.takeGem(kind);
    if (kind === 'health') hp = Math.min(MAX_HP, hp + GEM_HEAL);
    else if (kind === 'energy') { energyMeter = Math.min(ENERGY_MAX, energyMeter + GEM_VALUE); meterFlash.energy = clock + 400; }
    else if (kind === 'empower') { empowerMeter = Math.min(EMPOWER_MAX, empowerMeter + GEM_VALUE); meterFlash.empower = clock + 400; }
    else { superMeter = Math.min(SUPER_MAX, superMeter + GEM_VALUE); meterFlash.super = clock + 400; }
    syncProgress();
  }
  function gemRows() {
    return P.GEM_KINDS.map(kind => {
      let note = '';
      if (kind === 'health') note = level ? `+${GEM_HEAL} HP  (${hp}/${MAX_HP})` : `+${GEM_HEAL} HP, use it inside a level`;
      else if (!P.meterOn(kind)) note = 'meter not unlocked yet';
      else note = `+${GEM_VALUE}  (${Math.round(meterOf(kind))}/${kind === 'energy' ? ENERGY_MAX : kind === 'empower' ? EMPOWER_MAX : SUPER_MAX})`;
      return { kind, label: GEM_LABEL[kind], color: GEM_COLOR[kind], count: P.state.gems[kind] || 0, canUse: canUseGem(kind), note };
    });
  }

  const canvas = document.getElementById('view');
  const g = canvas.getContext('2d');
  g.imageSmoothingEnabled = false;

  // ------------------------------------------------------------------ assets
  const img = {};
  function load(src) {
    if (img[src]) return img[src].p;
    const im = new Image();
    const p = new Promise((res, rej) => { im.onload = res; im.onerror = () => rej(new Error('missing ' + src)); });
    im.src = src + (window.BIBOO_VER ? '?v=' + window.BIBOO_VER : '');   // version in the URL so a new build is never served from the cache
    img[src] = { im, p };
    return p;
  }
  const srcs = [...D.layers.map(l => l.src), D.fringe.src];
  for (const m of Object.values(D.moves)) {
    srcs.push(m.sheet);
    if (m.fxSheet) srcs.push(m.fxSheet);                       // effects drawn apart from Max (own scale)
    for (const f of m.frames) if (f.bw) srcs.push(f.bw);
  }
  for (const b of Object.values(D.beams || {})) srcs.push(b.src);
  const EN = D.enemies || {};
  for (const e of Object.values(EN)) srcs.push(e.sheet);

  // ------------------------------------------------------------------ input
  const BUTTONS = ['Up', 'Down', 'Left', 'Right', 'A', 'B', 'X', 'Y', 'L1', 'L2', 'R1', 'R2', 'R'];
  const KEYS = { ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right',
                 KeyZ: 'A', KeyX: 'B', KeyC: 'X', KeyV: 'Y', KeyQ: 'L1', KeyW: 'R', KeyE: 'L2', KeyR: 'R2', KeyT: 'R1' };
  const KEY_LABEL = { Up: '↑', Down: '↓', Left: '←', Right: '→', A: 'Z', B: 'X', X: 'C', Y: 'V', L1: 'Q', L2: 'E', R1: 'T', R2: 'R', R: 'W' };
  const PAD = { 0: 'A', 1: 'B', 2: 'X', 3: 'Y', 4: 'L1', 5: 'R1', 6: 'L2', 7: 'R2', 12: 'Up', 13: 'Down', 14: 'Left', 15: 'Right' };
  const keyDown = new Set(), padDown = new Set(), isDown = new Set();

  let reader = null;
  function activeInput() {                       // the bindings whose move is open (air and idle bindings are always kept)
    return Object.assign({}, D.input, { bindings: D.input.bindings.filter(b => b.type === 'idle' || b.type === 'air' || moveOpen(b.move)) });
  }
  function makeReader() {
    return new BibooInput.Reader(activeInput(), {
      // releasing Up turns the charge into the heavy chop once the aura loop has started
      holdReady: (b) => { const hb = D.input.bindings.find(x => x.input === b && x.type === 'hold'); return !!cur && !!hb && cur.id === hb.move && cur.k >= D.moves[cur.id].loopFrom; },
    });
  }
  reader = makeReader();
  let lastT = 0;                                 // time of the last frame, for rebuilding the reader mid-game
  function refreshUnlocks() {                    // an unlock changed: rebuild the reader and tell it what is held
    reader = makeReader();
    for (const b of isDown) reader.held.set(b, lastT);
  }

  // Some controllers reach the page as key events (Android can send a pad's d-pad as arrow keys),
  // and those can come with an empty e.code, so the key name and legacy keyCode are checked too.
  const KEY_NAMES = { ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right',
                      z: 'A', x: 'B', c: 'X', v: 'Y', q: 'L1', w: 'R', e: 'L2', r: 'R2', Z: 'A', X: 'B', C: 'X', V: 'Y', Q: 'L1', W: 'R', E: 'L2', R: 'R2' };
  const KEY_CODES = { 37: 'Left', 38: 'Up', 39: 'Right', 40: 'Down' };
  const keyButton = e => KEYS[e.code] || KEY_NAMES[e.key] || KEY_CODES[e.keyCode];
  addEventListener('keydown', e => {
    if (e.code === 'KeyH' && !e.repeat) { showBoxes = !showBoxes; return; }
    const b = keyButton(e);
    if (!e.repeat) monitor(`key down  key "${e.key}"  code "${e.code}"  keyCode ${e.keyCode}  -> ${b || 'not used'}`);
    if (!b) return;
    e.preventDefault();
    keyDown.add(b);
  });
  addEventListener('keyup', e => {
    const b = keyButton(e);
    monitor(`key up    key "${e.key}"  code "${e.code}"  keyCode ${e.keyCode}  -> ${b || 'not used'}`);
    if (b) { e.preventDefault(); keyDown.delete(b); }
  });
  addEventListener('blur', () => { if (keyDown.size) monitor('page lost focus: held keys released'); keyDown.clear(); });

  // input monitor: raw key and controller events, to see what a controller really sends
  const monEl = document.getElementById('monitor'), monOn = document.getElementById('monitor-on');
  const monLines = [];
  let padSnap = {};                     // last seen button and axis values per pad index
  function monitor(text) {
    if (!monOn || !monOn.checked) return;
    monLines.unshift(`${(performance.now() / 1000).toFixed(2)}s  ${text}`);
    monLines.length = Math.min(monLines.length, 14);
  }
  function monitorPads(pads) {
    if (!monOn || !monOn.checked) return;
    for (const p of pads) {
      if (!p) continue;
      const old = padSnap[p.index] || { b: [], a: [] };
      p.buttons.forEach((bt, i) => {
        const on = bt.pressed || bt.value > 0.5;
        if (on !== !!old.b[i]) monitor(`pad ${p.index} button ${i} ${on ? 'down' : 'up'}  -> ${PAD[i] || 'not used'}`);
      });
      p.axes.forEach((v, i) => {
        const r = Math.round(v * 2) / 2;
        if (r !== (old.a[i] || 0)) monitor(`pad ${p.index} axis ${i} = ${v.toFixed(2)}`);
      });
      padSnap[p.index] = { b: p.buttons.map(bt => bt.pressed || bt.value > 0.5), a: p.axes.map(v => Math.round(v * 2) / 2) };
    }
  }
  function drawMonitor() {
    if (!monEl) return;
    if (!monOn.checked) { if (monEl.textContent) monEl.textContent = ''; return; }
    const held = `held  keys [${[...keyDown].join(' ')}]  pad [${[...padDown].join(' ')}]  game [${[...isDown].join(' ')}]`;
    const text = [held, ...monLines].join('\n');
    if (monEl.textContent !== text) monEl.textContent = text;
  }

  // Controllers (USB or Bluetooth, including on Android) come through the browser's Gamepad API.
  // Browsers report most pads with the "standard" layout (A bottom, B right, X left, Y top, d-pad
  // 12-15). Pads without it are read with the same button numbers, and their d-pad is also read
  // from axes 6-7, where many of them put it. A pad only shows up after one of its buttons is
  // pressed while the page is open.
  let padName = '';
  let padStartWas = false;
  function pollPad() {
    padDown.clear();
    let pads = [];
    try { pads = navigator.getGamepads ? navigator.getGamepads() : []; } catch (e) { pads = []; }
    monitorPads(pads);
    let name = '';
    let startNow = false;
    for (const p of pads) {
      if (!p || !p.connected) continue;
      name = name || `${p.id}${p.mapping === 'standard' ? '' : ' (non-standard layout)'}`;
      const pressed = (bt, thr) => {
        if (bt == null) return false;
        if (typeof bt === 'number') return bt > thr;
        return !!(bt.pressed || (bt.value != null && bt.value > thr));
      };
      const thr = (i) => (i === 6 || i === 7) ? 0.12 : 0.35;
      p.buttons.forEach((bt, i) => {
        if (!PAD[i]) return;
        if (pressed(bt, thr(i))) padDown.add(PAD[i]);
      });
      // Some non-standard pads put the shoulder buttons on buttons 8 to 11. On a standard-mapping pad, and on
      // Sony pads, 8 is Select, 9 is Start or Options and 10 and 11 are the stick clicks, so they are not
      // read as shoulder buttons there (Options used to fire the energy wave, which is R2).
      const shoulderAlias = p.mapping !== 'standard' && !/054c|sony|playstation|ps3|ps4|ps5|dualshock|dualsense|wireless controller/i.test(p.id || '');
      if (shoulderAlias) {
        if (!padDown.has('L1') && pressed(p.buttons[10], 0.35)) padDown.add('L1');
        if (!padDown.has('R1') && pressed(p.buttons[11], 0.35)) padDown.add('R1');
        if (!padDown.has('L2') && pressed(p.buttons[8], 0.12)) padDown.add('L2');
        if (!padDown.has('R2') && pressed(p.buttons[9], 0.12)) padDown.add('R2');
      }
      const axn = (i) => (p.axes && p.axes.length > i ? p.axes[i] : 0);
      if (!padDown.has('L2') && axn(2) > 0.2) padDown.add('L2');
      if (!padDown.has('R2') && axn(5) > 0.2) padDown.add('R2');
      if (padDown.has('R1')) padDown.add('R');
      if (padDown.has('L1')) padDown.add('L');
      for (const bi of [8, 9]) {
        if (pressed(p.buttons[bi], 0.35)) startNow = true;
      }
      const axis = i => (p.axes.length > i ? p.axes[i] : 0);
      const [ax, ay] = [axis(0), axis(1)];
      if (ax < -0.5) padDown.add('Left'); if (ax > 0.5) padDown.add('Right');
      if (ay < -0.5) padDown.add('Up'); if (ay > 0.5) padDown.add('Down');
      if (p.mapping !== 'standard') {
        if (axis(6) < -0.5) padDown.add('Left'); if (axis(6) > 0.5) padDown.add('Right');
        if (axis(7) < -0.5) padDown.add('Up'); if (axis(7) > 0.5) padDown.add('Down');
      }
    }
    if (startNow && !padStartWas) {
      const tp = (typeof togglePause === 'function') ? togglePause : window.togglePause;
      if (typeof tp === 'function') tp();
    }
    padStartWas = startNow;
    padName = name;
  }
  addEventListener('gamepadconnected', () => pollPad());

  // L1 and R1 held together charge all three meters (+METER_CHARGE_STEP each METER_CHARGE_TICK ms). While they are
  // held the reader is not shown L1, R1 or the pad's R1-as-R, so no push kick or recover starts.
  const METER_CHARGE_STEP = 1, METER_CHARGE_TICK = 500;
  const metersHeld = () => P.buttonOn('L1') && P.buttonOn('R1') && (keyDown.has('L1') || padDown.has('L1')) && (keyDown.has('R1') || padDown.has('R1'));
  function readButtons(t) {
    pollPad();
    lastT = t;
    const charging = metersHeld();
    for (const b of BUTTONS) {
      let now = keyDown.has(b) || padDown.has(b);
      if (ignoreUntilUp.has(b)) { if (now) now = false; else ignoreUntilUp.delete(b); }   // held when a menu closed
      if (!P.buttonOn(b)) now = false;                             // a shoulder button that is not unlocked yet
      if (charging && (b === 'L1' || b === 'R1')) now = false;
      else if (charging && b === 'R') now = keyDown.has('R');
      if (now && !isDown.has(b)) {
        isDown.add(b); reader.down(b, t);
        if (b === 'Left') facing = -1; else if (b === 'Right') facing = 1;
      } else if (!now && isDown.has(b)) {
        isDown.delete(b); reader.up(b, t);
        if (b === 'Left' && isDown.has('Right')) facing = 1;        // let go of the newer one: the other still held
        else if (b === 'Right' && isDown.has('Left')) facing = -1;
      }
    }
  }

  // ------------------------------------------------------------------ state
  // cur: {id, k: frame index, t: ms into the frame, base: [x, y] where the move started, kind}
  let cur = null, queued = null, x = 0, camX = 0, camY = 0;
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
  function start(id, kind, via) {
    const k0 = entryFrame(id);
    const charged = cur && cur.id === 'charge' ? chargeMs : 0;
    if (id === 'charge' && !(cur && cur.id === 'charge')) chargeMs = 0;
    if (cur) x += rootOf(cur)[0];       // keep the ground covered so far; height resets
    cur = { id, k: k0, t: 0, kind, from: x, face: facing };
    if (id === 'heavy') { cur.lite = charged < FULL_CHARGE; cur.charged = charged; }
    if (kind === 'action' && MOVE_COST[id]) spend(MOVE_COST[id][0], MOVE_COST[id][1]);
    if (kind === 'action') queueHit();
    if (id === 'taunt') {
      for (const en of enemies) {
        if (!alive(en)) continue;
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

  function request(move, via) {
    if (!D.moves[move] || stun || !moveOpen(move)) return;
    if (!canAfford(move)) { deny(move); return; }             // no meter: the move does not play
    const air = AIR.find(b => usesButton(D.moves[move].input, b.input));
    const inAir = airborne() || (cur && cur.id === 'jump' && cur.kind === 'action');
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
  const holdWant = t => { if (metersHeld()) return 'charge'; const w = holdId(reader.holdMove(t)); return w === 'recover' && empowerMeter < HEAL_COST ? 'idle' : w; };
  function holdState(t) {
    const want = holdWant(t);
    if (!cur || cur.id !== want || cur.face !== facing) start(want, 'hold');
  }

  // a light heavy chop or crash passes straight over its black-and-white frame
  function msOf(c, k) { const f = D.moves[c.id].frames[k]; return f.bw ? (c.lite ? 0 : BW_HOLD) : f.ms; }

  function step(dt, t) {
    if (stun) { stepStun(dt); return; }
    if (slide) {
      x += slide.v * dt;
      const v = slide.v - Math.sign(slide.v) * slide.a * dt;
      slide = Math.sign(v) === Math.sign(slide.v) ? Object.assign(slide, { v }) : null;
    }
    // steering in the air: hold Left or Right while a jump is up or she is falling
    const steer = (isDown.has('Right') ? 1 : 0) - (isDown.has('Left') ? 1 : 0);
    if (steer && (fall || (cur && (cur.kind === 'fall' || (cur.kind === 'action' && cur.id === 'jump' && rootOf(cur)[1] > 0))))) {
      x += steer * AIR_SPEED * dt; facing = steer; if (cur) cur.face = steer;
    }
    if (fall) {                                                  // simple gravity, px/ms^2
      fall.v += 0.0018 * dt;
      fall.y -= fall.v * dt;
      if (fall.y <= 0) { fall = null; cur = { id: 'jump', k: LAND_K, t: 0, kind: 'land', face: cur ? cur.face : facing }; }
      return;
    }
    if (!cur) holdState(t);
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
      if (cur.kind === 'action') { if (cur.id === 'beam_cloud' && (keyDown.has('A') || padDown.has('A')) && energyMeter >= BEAM_TICK_COST.cloud) { cur.beamCut = false;  const bi = D.moves.beam_cloud.frames.findIndex(f => f.beam); cur.k = bi >= 0 ? bi : 2; continue; } cur.k = m.frames.length - 1; finishAction(t); return; }
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

  // ------------------------------------------------------------------ health and damage
  // Tunable numbers. A move hurts each enemy once per use (moves in REHIT_MS again after that many ms);
  // beams hurt on every tick they touch. The heavy chop and the crash do more when full.
  const MAX_HP = 200, ENEMY_HP = { goblin: 60, orc: 200 }, ENEMY_DMG = { goblin: 12, orc: 30 };
  const DAMAGE = { slash: 25, heavy_horizontal: 50, thrust: 15, upswing: 15, push_kick: 10, heavy_kick: 25, energy_kick: 30, energy_burst: 50,
                   dash_thrust: 25, energy_dash_thrust: 50, spin_attack: 20, energy_wave: 0, earthquake: 250, meteor_shower: 200 };
  // knockback of the moves that push an enemy: [distance px, duration ms]
  const KNOCK = { heavy: [25, 100], slash: [25, 100], heavy_horizontal: [50, 100], push_kick: [100, 200], energy_kick: [200, 300], energy_burst: [100, 500] };
  const BOTH_SIDES_PUSH = new Set(['energy_burst']);
  const PARRY_KNOCK = [100, 400];                                    // an enemy parried: pushed back this far, stunned this long
  const REHIT_MS = { earthquake: 250, meteor_shower: 300 };
  const BEAM_DMG = { cloud: 5, fire: 15, laser: 10, plasma: 0 };
  const BEAM_PUSH = { cloud: 0, fire: 5, laser: 20, plasma: 30 };     // px an enemy is shoved back on every tick it is touched
  // the heavy overhead chop: 200 on a direct hit; where the blade lands it also blasts every other enemy within
  // HEAVY_AOE_R px for HEAVY_AOE_DMG and pushes it back (KNOCK.heavy). The charge no longer scales the damage.
  const HEAVY_DMG = 200, HEAVY_AOE_DMG = 150, HEAVY_AOE_R = 25
  const CRASH_DMG = 300, CRASH_COST = 30;      // the jump crash: flat damage, energy paid when it starts
  const HEAL_EVERY = 350, HEAL_AMOUNT = 5, KO_MS = 1500;
  const dmgOf = c => c.id === 'heavy' ? HEAVY_DMG : c.id === 'jump_crash' ? CRASH_DMG : (c.id in DAMAGE ? DAMAGE[c.id] : 15);   // 0 is a real value (the wave hurts only by its blast)
  let hp = MAX_HP, hpOverride = null, healAcc = 0;
  const floaters = [];                  // {wx, wy, text, color, t0}: numbers that rise and fade
  const FLOAT_MS = 900;
  const GREEN = '#3dff6e';
  function floater(wx, wy, text, color) { floaters.push({ wx, wy, text, color, t0: clock }); }
  function hurtEnemy(e, dmg) {
    if (!alive(e)) return;
    aggro(e, false);                                  // being hit wakes a patrolling enemy, even for 0 damage
    if (dmg <= 0) return;
    e.hp = Math.max(0, e.hp - dmg);
    const b = hurtOf(e);
    if (b) floater((b[0] + b[2]) / 2, b[3] + 4, '-' + dmg, RED);
    if (!e.tint || clock >= e.tint.until) e.tint = { color: RED, alpha: 0.55, until: clock + 110 };
    if (e.hp <= 0) kill(e);
  }
  const cheats = { invincible: false, infinite: false };     // set from the Dev Console (L1+L2+R1+R2)
  function hurtHer(dmg) {
    if (dmg <= 0 || cheats.invincible) return;
    hp = Math.max(0, hp - dmg);
    floater(bodyX(), herY() + herTop() + 6, '-' + dmg, RED);
  }
  function stepHeal(dt) {
    stepGems(dt);
    if (cur && cur.id === 'charge' && cur.kind === 'hold' && !stun) {
      if (metersHeld()) {                                          // L1+R1: ENG, EMP and SUP each fill by 1 per tick
        meterAcc += dt;
        while (meterAcc >= METER_CHARGE_TICK) {
          meterAcc -= METER_CHARGE_TICK;
          energyMeter = Math.min(ENERGY_MAX, energyMeter + METER_CHARGE_STEP);
          empowerMeter = Math.min(EMPOWER_MAX, empowerMeter + METER_CHARGE_STEP);
          superMeter = Math.min(SUPER_MAX, superMeter + METER_CHARGE_STEP);
        }
      } else stepCharge(dt);
    } else meterAcc = 0;
    if (!cur || cur.id !== 'recover' || cur.kind !== 'hold' || stun || hp >= MAX_HP) { healAcc = 0; return; }
    healAcc += dt;
    while (healAcc >= HEAL_EVERY && hp < MAX_HP && empowerMeter >= HEAL_COST) {
      healAcc -= HEAL_EVERY;
      empowerMeter = Math.max(0, empowerMeter - HEAL_COST);
      const n = Math.min(HEAL_AMOUNT, MAX_HP - hp);
      hp += n;
      floater(bodyX(), herY() + herTop() + 6, '+' + n, GREEN);
    }
  }

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
  }
  function beamHit(e, b) {
    if (b.kind === 'plasma') {
      e.scale = Math.max(e.scale || 1, 1.6);
      e.dropEnergy = true;
      e.tint = { color: '#a0f', alpha: 0.4, until: clock + 400 };
    }
    const was = alive(e);
    hurtEnemy(e, BEAM_DMG[b.kind] || 0);
    if (was && !alive(e)) spawnGem(e.x, 'super', e.fy);                 // killed by a beam: a Super Gem
    const push = BEAM_PUSH[b.kind] || 0;
    if (push && alive(e)) { e.x += b.face * push; e.base += b.face * push; }   // shoved away along the beam
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

  // ------------------------------------------------------------------ levels: maps, barriers, platforms, crates
  // A level is 10 one-screen maps (web/levels.js). loadMap() builds the current one. The camera never scrolls sideways,
  // so world x is screen x. Barriers (solids) block walking and can be stood on; platforms can be stood on and jumped
  // up through. She is always standing on `floorY`; in the air her height above it comes from the jump animation, and
  // physics() lands her on a surface she falls onto or drops her off the edge of one.
  const surfaces = m => m.solids.concat(m.plats);
  function supportBelow(bx, y) {                 // the highest surface at or below height y under x (the ground is 0)
    let best = 0;
    if (!curMap) return 0;
    for (const s of surfaces(curMap)) if (bx >= s.x0 - 3 && bx <= s.x1 + 3 && s.top <= y + 0.5 && s.top > best) best = s.top;
    return best;
  }
  function surfaceAt(m, bx, top) { return surfaces(m).find(s => s.top === top && bx >= s.x0 - 3 && bx <= s.x1 + 3) || null; }
  let lastHint = -1e9;
  function hint(text) { if (clock - lastHint > 2500) { lastHint = clock; banners.push({ title: text, t0: clock, ms: 2200 }); } }

  function startLevel(n) {
    const def = LV.levels[n - 1];
    if (!def) return;
    level = { n, def, idx: 0, killed: new Set(), broken: new Set(), pending: new Map() };
    kills = 0; hp = MAX_HP; gameOver = false; paused = false; respawnOn = false;
    screen = 'level';
    hideMenu(); ignoreHeldButtons();
    loadMap(0, 'left');
    banners.push({ title: `Level ${n}: ${def.name}`, sub: def.blurb, t0: clock, ms: 3200 });
    setStartLabel();
    canvas.focus();
  }
  function loadMap(idx, side) {
    level.idx = idx;
    const md = level.def.maps[idx];
    curMap = { idx, id: md.id, def: md, solids: md.solids, plats: md.plats,
               crates: md.crates.map((c, i) => ({ key: idx + ':' + i, x: c.x, fy: c.fy, item: c.item || null, broken: level.broken.has(idx + ':' + i) })) };
    enemies.length = 0; respawns.length = 0; gems.length = 0; explosions.length = 0; floaters.length = 0;
    powerups.length = 0; particles.length = 0; hitQ.length = 0;
    md.enemies.forEach((d, i) => {
      const key = idx + ':' + i;
      if (level.killed.has(key)) return;
      const sf = d.fy > 0 ? surfaceAt(curMap, d.x, d.fy) : null;    // an enemy on a platform never leaves it
      spawn(d.type, d.x, { fy: d.fy, path: d.path, sight: d.sight, key, lo: sf ? sf.x0 + 8 : 8, hi: sf ? sf.x1 - 8 : MAP_W - 8 });
    });
    for (const c of curMap.crates)                                   // a golden crate smashed earlier whose item was not picked up
      if (c.broken && c.item && level.pending.has(c.key)) powerups.push({ key: c.key, item: c.item, x: c.x, y: c.fy + 16, t0: clock });
    x = side === 'left' ? 26 : MAP_W - 26; facing = side === 'left' ? 1 : -1;
    floorY = 0; fall = null; stun = null; slide = null; cur = null; queued = null; rumble = null; tint = null;
    invuln = clock + 600; prevFeet = null; lastCx = null; camX = V.anchorX; camY = 0; fadeUntil = clock + FADE_MS;
    if (killsEl) killsEl.textContent = '';
  }
  function exitMap(dir) {                        // true when the map changed (or the level ended)
    const last = level.def.maps.length - 1;
    if (dir > 0) {
      if (level.idx < last) { loadMap(level.idx + 1, 'left'); banners.push({ title: `Level ${level.n}.${level.idx + 1}`, t0: clock, ms: 1300 }); return true; }
      if (enemies.some(alive)) { hint('Defeat every enemy to open the gate'); return false; }
      levelComplete();
      return true;
    }
    if (level.idx > 0) { loadMap(level.idx - 1, 'right'); banners.push({ title: `Level ${level.n}.${level.idx + 1}`, t0: clock, ms: 1300 }); return true; }
    return false;
  }
  // She is a point on the ground (her anchor, `playerX()`) for standing and for the doors, and a narrow foot (FOOT px
  // each side) for barriers, so turning around never moves her against a wall or off a ledge.
  const FOOT = 9, EDGE = 14;
  function physics() {
    if (!curMap) return;
    let px = playerX();
    // 1. barriers stop her from the side while she is below their top; she is pushed out on the side she came from
    for (const sd of curMap.solids) {
      if (herY() >= sd.top - 2 || px + FOOT <= sd.x0 || px - FOOT >= sd.x1) continue;
      const mid = (sd.x0 + sd.x1) / 2;
      if ((lastCx !== null ? lastCx : px) < mid) x -= (px + FOOT) - sd.x0; else x += sd.x1 - (px - FOOT);
      px = playerX();
    }
    // 2. the doors: past the right edge is the next map, past the left edge the one before (while stunned she is only kept in)
    if (px >= MAP_W - EDGE) { if (!stun && exitMap(1)) return; x -= px - (MAP_W - EDGE); px = playerX(); }
    else if (px <= EDGE) { if (!stun && exitMap(-1)) return; x += EDGE - px; px = playerX(); }
    // 3. landing: falling (or a jump coming down) through the top of a surface under her
    const feet = herY();
    const flying = !stun && cur && (fall || cur.kind === 'fall' || (cur.kind === 'action' && cur.id === 'jump'));
    if (flying && prevFeet !== null && feet < prevFeet) {
      let T = -1;
      for (const sf of surfaces(curMap)) if (sf.top > floorY && px >= sf.x0 - 3 && px <= sf.x1 + 3 && prevFeet > sf.top && feet <= sf.top && sf.top > T) T = sf.top;
      if (T >= 0) {
        if (cur.kind === 'action') x += rootOf(cur)[0];
        floorY = T; fall = null;
        cur = { id: 'jump', k: LAND_K, t: 0, kind: 'land', face: cur.face };
      }
    }
    // 4. standing on a surface that is no longer under her (walked off the edge): fall to what is below
    if (floorY > 0 && !fall && !stun && (!cur || cur.kind === 'hold' || cur.kind === 'land')) {
      const S = supportBelow(playerX(), floorY);
      if (S < floorY - 0.5) {
        if (cur) x += rootOf(cur)[0];
        fall = { y: floorY - S, v: 0 }; floorY = S;
        cur = { id: 'jump', k: FALL_K, t: 0, kind: 'fall', face: cur ? cur.face : facing };
      }
    }
    prevFeet = herY(); lastCx = playerX();
  }
  function levelComplete() {
    const n = level.n, next = LV.levels[n];
    P.completeLevel(n); syncProgress();
    paused = true; levelDone = true;
    UI.open('message', { title: `Level ${n} complete`,
      msg: next ? `Level ${n + 1}: ${next.name} is now open.` : 'You beat the last level. More are coming.',
      items: [{ label: 'Back to the overworld', fn: () => goOverworld(), primary: true, id: 'btn-start' }] });
    setStartLabel();
  }
  function retryMap() {                          // after a K.O.: the same map again, full health
    hp = MAX_HP; gameOver = false; paused = false;
    hideMenu(); ignoreHeldButtons();
    loadMap(level.idx, 'left');
    setStartLabel();
    canvas.focus();
  }

  // crates: any of her attacks that touches one smashes it. A golden crate holds an unlock; a plain one may drop a gem.
  const crateBox = c => [c.x - 9, c.fy, c.x + 9, c.fy + 18];
  function burst(wx, wy, n, colors) {
    for (let i = 0; i < n; i++) particles.push({ wx, wy, vx: (Math.random() - 0.5) * 0.22, vy: 0.04 + Math.random() * 0.16, t0: clock, life: 500 + Math.random() * 300, c: colors[i % colors.length] });
  }
  function breakCrate(c) {
    if (c.broken) return;
    c.broken = true; level.broken.add(c.key);
    burst(c.x, c.fy + 9, 9, c.item ? ['#e8c050', '#c9962a', '#fff2a0'] : ['#8a5a2b', '#6b4420', '#b07a3c']);
    if (c.item) {
      if (P.has(c.item)) {                       // already owned: a small reward instead
        spawnGem(c.x - 6, 'health', c.fy); spawnGem(c.x + 6, 'health', c.fy);
        floater(c.x, c.fy + 30, 'Already unlocked', '#ffd24a');
      } else {
        level.pending.set(c.key, c.item);
        powerups.push({ key: c.key, item: c.item, x: c.x, y: c.fy + 16, t0: clock });
      }
    } else if (Math.random() < 0.55) {
      const pool = ['health', 'health', 'health'];
      if (P.meterOn('energy')) pool.push('energy');
      if (P.meterOn('empower')) pool.push('empower');
      spawnGem(c.x, pool[Math.floor(Math.random() * pool.length)], c.fy);
    }
  }
  function crateHitsFrom(w) { if (curMap) for (const c of curMap.crates) if (!c.broken && touches(w, crateBox(c))) breakCrate(c); }
  function crateBlast(wx, wy, r) { if (curMap) for (const c of curMap.crates) if (!c.broken && distBox(wx, wy, crateBox(c)) <= r) breakCrate(c); }

  // the floating item a golden crate leaves: touch it to unlock the button or combo
  function stepPowerups() {
    for (let i = powerups.length - 1; i >= 0; i--) {
      const u = powerups[i];
      if (Math.abs(u.x - bodyX()) < 26 && Math.abs(u.y - (herY() + 22)) < 44) {
        powerups.splice(i, 1);
        if (level) level.pending.delete(u.key);
        const it = P.byId[u.item];
        unlockItem(u.item);
        banners.push({ title: `NEW ${it.kind === 'Button' ? 'BUTTON' : 'MOVE'}: ${it.name}`, sub: it.hint, t0: clock, ms: 5200 });
        burst(u.x, u.y, 18, ['#fff2a0', '#ffd24a', '#ffffff']);
      }
    }
  }
  function stepEffects(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const q = particles[i];
      if (clock - q.t0 > q.life) { particles.splice(i, 1); continue; }
      q.wx += q.vx * dt; q.wy += q.vy * dt; q.vy -= 0.0007 * dt;
    }
    for (let i = banners.length - 1; i >= 0; i--) if (clock - banners[i].t0 > banners[i].ms) banners.splice(i, 1);
  }

  // ------------------------------------------------------------------ enemies
  // e: {type, x: world x of its ground point, base: world x its frames are drawn from, face (-1 left,
  //     1 right), anim, k, t, state, rest, dead, dive: may dive roll on this approach}
  // Rolls and leaps move the art inside its frames; each frame's ground offset keeps e.x on the
  // body, so the enemy stays where an animation leaves it when the next one starts.
  const enemies = [];
  const respawns = [];                  // {type, at}
  let kills = 0, respawnOn = true;
  const TAUNT_TINT = { color: '#e22', alpha: 0.55, until: Infinity };     // taunted enemies stay red
  const BODY = 32;                      // her body centre, px ahead of her anchor
  // An enemy walks in until it is APPROACH x its reach from her body centre. Her plow guard holds the blade
  // out in front of her body, but only her body (herBox) is hit, so the enemy has to close in far enough
  // that its swing overlaps the body on the first hitting frames, not just the last ones (0.65 left the
  // orc 3 px inside and the goblin's first slash frames out of reach).
  const APPROACH = 0.5;
  const DIE_MS = 900;                   // death: animation or flicker, then fade

  function playerX() {
    if (!cur || fall || cur.kind === 'fall' || cur.kind === 'land') return x;
    return x + rootOf(cur)[0];
  }
  // o (level enemies): fy surface height it stands on, path [a, b] it patrols, sight px, key for the level's killed list,
  // lo and hi the x range it may not leave. With no path it walks straight at her (the old arena behaviour, used by tests).
  function spawn(type, wx, o) {
    o = o || {};
    const hp0 = hpOverride || ENEMY_HP[type] || 60;
    const e = { type, hp: hp0, maxHp: hp0, x: wx, base: wx, face: -1, anim: 'walk', k: 0, t: 0, state: 'walk', rest: 0, dead: 0, dive: Math.random() < 0.5, scale: 1,   // scale 1 = the normal (already scaled down) size; only the Empowerment Beam makes one larger
                fy: o.fy || 0, lo: o.lo != null ? o.lo : 8, hi: o.hi != null ? o.hi : MAP_W - 8, key: o.key || null,
                path: o.path || null, sight: o.sight || 100, pause: 0, far: 0, prevX: wx, dir: 1 };
    enemies.push(e);
    if (e.path) {                                    // patrol: walk between the two ends until hit or until she comes into view
      e.state = 'patrol';
      e.dir = wx <= (e.path[0] + e.path[1]) / 2 ? 1 : -1;
      e.face = e.dir;
      play(e, 'walk');
    }
    return e;
  }
  function frameOf(e) { const T = EN[e.type]; return T.frames[T.anims[e.anim].frames[e.k]]; }
  function groundOff(e) { const gx = frameOf(e).ground || 0; return e.face < 0 ? gx : -gx; }
  function play(e, anim) { e.anim = anim; e.k = 0; e.t = 0; e.hitDone = false; e.landAt = 0; e.base = e.x - groundOff(e); }
  function turn(e, face) { if (face !== e.face) { e.face = face; e.base = e.x - groundOff(e); } }
  function alive(e) { return e.state !== 'dying'; }

  // hurtbox in world coordinates (y up from the ground)
  function hurtOf(e) {
    const h = frameOf(e).hurt;
    if (!h || !alive(e)) return null;
    const s = SPRITE_SCALE * (e.scale || 1), fy = e.fy || 0;
    return e.face < 0
      ? [e.base + h[0] * s, h[1] * s + fy, e.base + h[2] * s, h[3] * s + fy]
      : [e.base - h[2] * s, h[1] * s + fy, e.base - h[0] * s, h[3] * s + fy];
  }

  function kill(e) {
    // Drops: a taunted enemy 2 empower gems, one hit by the Empowerment Beam 2 energy gems. Every kill also rolls
    // GEM_CHANCE for a health gem (+25 percent health) and, separately, GEM_CHANCE for one energy or empower gem of a
    // meter the player has unlocked (nothing if none). All of them go to the gem bag when walked over.
    const fy = e.fy || 0;
    if (e.dropEnergy) { spawnGem(e.x - 6, 'energy', fy); spawnGem(e.x + 6, 'energy', fy); }
    if (e.dropEmpower) { spawnGem(e.x - 6, 'empower', fy); spawnGem(e.x + 6, 'empower', fy); }
    if (Math.random() < GEM_CHANCE) spawnGem(e.x - 3, 'health', fy);
    const pool = [];
    if (P.meterOn('energy')) pool.push('energy');
    if (P.meterOn('empower')) pool.push('empower');
    if (pool.length && Math.random() < GEM_CHANCE) spawnGem(e.x + 3, pool[Math.floor(Math.random() * pool.length)], fy);
    if (level && e.key) level.killed.add(e.key);
    e.state = 'dying'; e.dead = 0; e.hp = 0;
    const death = EN[e.type].ai.death;
    if (death) play(e, death);
    kills++;
    respawns.push({ type: e.type, at: clock + 2 * (DIE_MS + 4200), side: Math.random() < 0.5 ? -1 : 1 });
  }

  // Patrolling enemies (level enemies) walk between the ends of their path at half speed and pause at each end.
  // They chase only after being hit (or taunted), or when she is in front of them within `sight` px on about the same
  // level with no tall barrier between. A chasing enemy that loses her (far away, or on another level) for 3.5 s goes
  // back to its patrol.
  const PATROL_SPEED = 0.5;
  function sees(e) {
    if (!curMap) return false;
    const bxp = bodyX(), dx = bxp - e.x;
    if (dx * e.face <= 0 || Math.abs(dx) > e.sight) return false;      // only in front of it, and only within sight
    if (Math.abs(herY() - e.fy) > 60) return false;                    // she is on another level
    for (const s of curMap.solids)                                     // a barrier taller than its eyes and than her blocks the view
      if (s.x1 > Math.min(e.x, bxp) && s.x0 < Math.max(e.x, bxp) && s.top > e.fy + 36 && s.top > herY() + 20) return false;
    return true;
  }
  function aggro(e, noticed) {
    if (e.state !== 'patrol') return;
    e.state = 'idle'; e.rest = noticed ? 250 : 0; e.far = 0; play(e, 'idle');
    if (noticed) { const b = hurtOf(e); floater(e.x, (b ? b[3] : e.fy + 40) + 8, '!', '#ffd24a'); }
  }
  function patrol(e, dt) {
    const ai = EN[e.type].ai;
    if (sees(e)) { aggro(e, true); return; }
    if (e.pause > 0) {
      e.pause -= dt;
      if (e.anim !== 'idle') play(e, 'idle');
      if (e.pause <= 0) e.dir = -e.dir;
      return;
    }
    const target = e.dir > 0 ? e.path[1] : e.path[0], dist = target - e.x;
    turn(e, dist >= 0 ? 1 : -1);
    if (e.anim !== 'walk') play(e, 'walk');
    const step = ai.speed * PATROL_SPEED * dt / 1000;
    if (Math.abs(dist) <= step) { e.x += dist; e.base += dist; e.pause = 700 + Math.random() * 900; play(e, 'idle'); }
    else { const mv = Math.sign(dist) * step; e.x += mv; e.base += mv; }
  }
  // keep an enemy inside its range and out of barriers taller than the surface it stands on
  function clampEnemy(e) {
    let nx = Math.max(e.lo, Math.min(e.hi, e.x));
    if (curMap) for (const s of curMap.solids) {
      if (s.top <= e.fy + 1) continue;
      const pad = 10;
      if (nx > s.x0 - pad && nx < s.x1 + pad) nx = e.prevX <= (s.x0 + s.x1) / 2 ? s.x0 - pad : s.x1 + pad;
    }
    if (nx !== e.x) { e.base += nx - e.x; e.x = nx; }
    e.prevX = e.x;
  }
  function stepEnemy(e, dt) {
    stepEnemyCore(e, dt);
    if (e.state !== 'dying') clampEnemy(e);
  }
  function stepEnemyCore(e, dt) {
    const T = EN[e.type], ai = T.ai;
    let A = T.anims[e.anim], ended = false;
    dt *= (e.speedMul || 1);            // taunted: everything it does, walking, swinging and resting, runs 2x as fast
    if (e.taunted && (!e.tint || clock >= e.tint.until)) e.tint = TAUNT_TINT;   // back to red after a flash
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
    if (e.state === 'patrol') { patrol(e, dt); return; }
    const d = bodyX() - e.x, dist = Math.abs(d);
    if (e.path && (e.state === 'idle' || e.state === 'walk')) {       // chasing: give up when she is gone for a while
      e.far = dist > e.sight * 2.5 || Math.abs(herY() - e.fy) > 110 ? e.far + dt : 0;
      if (e.far > 3500) { e.state = 'patrol'; e.far = 0; e.pause = 0; e.dir = e.x < (e.path[0] + e.path[1]) / 2 ? 1 : -1; play(e, 'walk'); return; }
    }
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
    const stop = ai.reach * APPROACH * (e.scale || 1);
    if (dist <= stop) {
      e.state = 'attack';
      play(e, ai.attacks[Math.floor(Math.random() * ai.attacks.length)]);
    } else if (ai.dive && e.dive && !blocked && dist >= ai.dive.min && dist <= ai.dive.max) {
      e.state = 'attack'; e.dive = false;
      play(e, ai.dive.anim);
    } else if (blocked) {
      if (e.anim !== 'idle') play(e, 'idle');
    } else {
      if (e.anim !== 'walk') play(e, 'walk');
      const mv = e.face * Math.min(ai.speed * dt / 1000, dist - stop);
      e.x += mv; e.base += mv;
    }
  }

  // ------------------------------------------------------------------ hits
  function distBox(px, py, b) {          // point to box [x0, y0, x1, y1]
    const dx = Math.max(b[0] - px, 0, px - b[2]), dy = Math.max(b[1] - py, 0, py - b[3]);
    return Math.hypot(dx, dy);
  }
  // effect moves (meteor shower, energy wave) draw Max at SPRITE_SCALE and their effects at fxScale,
  // and their hit shapes follow the effects
  const BURST_SCALE = 1.0;               // energy burst effect scale: twice Max's, so twice the area of effect
  const FX_CENTER = { energy_burst: [32, 37] };   // where the burst ring is centred (native px from the anchor): it grows around this point
  function fxScaleOf(id) { const m = id && D.moves[id]; return m && m.fxScale ? m.fxScale : SPRITE_SCALE; }
  function worldShape(s, h) {
    const sc = fxScaleOf(h.mv && h.mv.id);
    const P = p => [h.px + h.face * p[0] * sc, h.py + p[1] * sc];
    if (s.shape === 'capsule') return { shape: 'capsule', a: P(s.a), b: P(s.b), r: s.radius * sc };
    if (s.shape === 'circle') return { shape: 'circle', c: P(s.c), r: s.r * (h.mv && h.mv.id === 'energy_burst' ? BURST_SCALE : sc) };   // the burst keeps its centre but its radius is doubled
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
      if (h.mv.id === 'energy_wave' && h.mv.blast && h.mv.blast[h.face]) continue;   // that projectile has burst
      const seen = h.mv.hit || (h.mv.hit = new Map()), gap = REHIT_MS[h.mv.id];
      for (const sh of h.f.hits) {
        const w = worldShape(sh, h);
        for (const e of enemies) {
          const box = hurtOf(e);
          if (!box || !touches(w, box)) continue;
          const last = seen.get(e);
          if (last !== undefined && !(gap && clock - last >= gap)) continue;
          seen.set(e, clock);
          hurtEnemy(e, dmgOf(h.mv));
          if (KNOCK[h.mv.id] && alive(e)) {                        // knocked back and stunned
            const [dist, ms] = KNOCK[h.mv.id];
            // a kick sends it the way she faces; the burst sends it away from her on either side
            const p = push(dist, ms), dir = BOTH_SIDES_PUSH.has(h.mv.id) ? (e.x >= h.px ? 1 : -1) : h.face;
            e.state = 'stunned'; play(e, (EN[e.type].ai.stun || 'idle'));
            e.push = { v: p.v * dir, a: p.a };
          }
          if (h.mv.id === 'energy_wave') {                          // impact: the wave explodes on the spot
            const b = hurtOf(e) || box;
            waveBlast(h.mv, h.face, (b[0] + b[2]) / 2, (b[1] + b[3]) / 2);
          }
        }
        crateHitsFrom(w);                                          // and any crate the shape touches
      }
      if (h.mv.id === 'heavy' && h.f.name === 'impact' && !h.mv.aoeDone) {   // the chop lands: a small blast where the blade meets the ground
        h.mv.aoeDone = true;
        const w = worldShape(h.f.hits[0], h);
        const cx = w.b[0], cy = Math.max(0, w.b[1]);
        explosions.push({ wx: cx, wy: cy, t0: clock, big: true, r: HEAVY_AOE_R });
        crateBlast(cx, cy, HEAVY_AOE_R);
        for (const o of enemies) {
          if (!alive(o) || seen.has(o)) continue;                   // a direct hit already took 200
          const b = hurtOf(o);
          if (!b || distBox(cx, cy, b) > HEAVY_AOE_R) continue;
          hurtEnemy(o, HEAVY_AOE_DMG);
          if (alive(o)) {
            const [dist, ms] = KNOCK.heavy, p = push(dist, ms);
            o.state = 'stunned'; play(o, (EN[o.type].ai.stun || 'idle'));
            o.push = { v: p.v * h.face, a: p.a };
          }
        }
      }
    }
    lastHits = hitQ.splice(0);
  }
  let lastHits = [];

  // The energy wave does no damage where it touches an enemy: it explodes there (one projectile each side),
  // and the blast hurts every enemy within WAVE_R px of the centre for WAVE_DMG. A projectile that touches
  // nothing explodes at the end of its flight.
  const explosions = [];                // {wx, wy, t0, big, r}
  let flashUntil = 0;
  const BLAST_MS = 650, FLASH_MS = 380, WAVE_R = 75, WAVE_DMG = 50, WAVE_END = 200;
  function waveBlast(mv, side, wx, wy) {
    mv.blast = mv.blast || {};
    if (mv.blast[side]) return;
    mv.blast[side] = true;
    explosions.push({ wx, wy, t0: clock, big: true, r: WAVE_R });
    crateBlast(wx, wy, WAVE_R);
    rumble = { t0: clock, ms: 350, amp: 5 };
    for (const o of enemies) {
      if (!alive(o)) continue;
      const b = hurtOf(o);
      if (b && distBox(wx, wy, b) <= WAVE_R) hurtEnemy(o, WAVE_DMG);
    }
  }

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
  const heightAbove = () => stun ? stun.y : fall ? fall.y : (cur && cur.kind !== 'fall' ? rootOf(cur)[1] : 0);   // above the surface she stands on
  function herY() { return floorY + heightAbove(); }                                                              // world height of her feet
  const hf = () => cur ? cur.face : facing;
  const bodyX = () => playerX() + hf() * BODY;         // her body centre
  function herBox() {
    const px = playerX(), py = herY(), f = hf();
    return [px + Math.min(f * HURT[0], f * HURT[2]), py + HURT[1], px + Math.max(f * HURT[0], f * HURT[2]), py + herTop() * SPRITE_SCALE];
  }
  function boxOf(e, h) {
    if (!h) return null;
    const s = SPRITE_SCALE * (e.scale || 1), fy = e.fy || 0;
    return e.face < 0
      ? [e.base + h[0] * s, h[1] * s + fy, e.base + h[2] * s, h[3] * s + fy]
      : [e.base - h[2] * s, h[1] * s + fy, e.base - h[0] * s, h[3] * s + fy];
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
    e.state = 'stunned';
    play(e, T.ai.stun || 'idle');
    e.push = { v: p.v * (e.x >= bodyX() ? 1 : -1), a: p.a };
    e.tint = { color: WHITE, alpha: 0.75, until: clock + ms };
    parries++;
  }
  function knocked(e) {                 // a clean hit: red, pushed away from the enemy, stunned
    const [d, ms] = EN[e.type].ai.knock, p = push(d, ms);
    const dir = bodyX() >= e.x ? 1 : -1;
    const y = heightAbove();
    if (cur && !fall && cur.kind !== 'fall') x += rootOf(cur)[0];
    fall = null; queued = null; slide = null;
    stun = { v: p.v * dir, a: p.a, y, vy: 0 };
    cur = { id: 'heavy', k: HIGH_K, t: 0, kind: 'stun', from: x, face: cur ? cur.face : facing };
    tint = { color: RED, alpha: 0.6, until: clock + ms };
    invuln = clock + ms + 400;
    hits++;
    hurtHer((ENEMY_DMG[e.type] || 10) * (e.dmgMul || 1));
    if (hp <= 0) { stun.until = clock + KO_MS; floater(bodyX(), herY() + herTop() + 18, 'K.O.', RED); if (typeof triggerGameOver === 'function') triggerGameOver(); }
  }
  function blocked(e) {                 // white, a small slide back, no stun
    const dir = bodyX() >= e.x ? 1 : -1, p = push(8, 120);
    slide = { v: p.v * dir, a: p.a };
    tint = { color: WHITE, alpha: 0.75, until: clock + 150 };
    blocks++;
  }
  function stepStun(dt) {
    x += stun.v * dt;
    const v = stun.v - Math.sign(stun.v) * stun.a * dt;
    stun.v = Math.sign(v) === Math.sign(stun.v) ? v : 0;
    if (stun.y > 0) { stun.vy += 0.0018 * dt; stun.y = Math.max(0, stun.y - stun.vy * dt); }
    if (stun.v === 0 && stun.y === 0 && (!stun.until || clock >= stun.until)) {
      if (stun.until) { if (typeof gameOver !== 'undefined' && gameOver) { stun = null; cur = null; return; } hp = MAX_HP; floater(bodyX(), herY() + herTop() + 6, '+' + MAX_HP, GREEN); }
      stun = null; cur = null; holdState(clock);
    }
  }
  let hits = 0, blocks = 0, parries = 0;

  // An enemy attack that reaches her lands HIT_DELAY ms after first contact. Until then a parry
  // still works, so the window covers the frames just before the swing and the start of its first
  // hitting frame. 90 ms is about one enemy frame: long enough to react to the swing appearing,
  // short enough that the hit does not feel late.
  const HIT_DELAY = 90;
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
    const rel = stun ? [0, stun.y] : fall ? [0, fall.y] : (cur.kind === 'fall' ? [0, 0] : rootOf(cur));
    const rx = rel[0], ry = rel[1] + floorY;                     // ry: world height of her feet
    let [sx, sy] = cur.kind === 'fall' || cur.kind === 'land' || cur.lite ? [0, 0] : f.shake;
    if (rumble) {                                                // fading aftershock
      const e = clock - rumble.t0;
      if (e >= rumble.ms) rumble = null;
      else {
        const a = rumble.amp * Math.pow(1 - e / rumble.ms, 1.5);
        sx += Math.round(a * Math.sin(e * 0.11)); sy += Math.round(a * Math.cos(e * 0.083));
      }
    }
    const px = x + rx;
    const targetY = Math.max(0, ry - CAM_KEEP);
    if (f.bw && cur.kind === 'action') {                         // impact frame: the whole view (the picture has her at anchorX, so it is slid to where she is)
      camY = targetY;
      const sh = Math.round(px - V.anchorX);
      g.fillStyle = '#000'; g.fillRect(0, 0, V.w, V.h);
      if (cur.face < 0) {                                        // mirrored about her position, black beyond it
        g.save(); g.translate((V.anchorX + sh) * 2, 0); g.scale(-1, 1);
        g.drawImage(img[f.bw].im, 0, 0); g.drawImage(img[f.bw].im, V.w, 0);
        g.restore();
      } else g.drawImage(img[f.bw].im, sh, 0);
      return;
    }
    const bgx = camX + (level ? level.idx * MAP_W : 0);          // the scenery carries on from map to map
    for (const l of D.layers) drawLayer(img[l.src].im, -bgx * l.parallax + sx * l.shake, camY * l.parallax + sy * l.shake);
    if (level && level.def.tint) { g.globalAlpha = level.def.tint.alpha; g.fillStyle = level.def.tint.color; g.fillRect(0, 0, V.w, V.h); g.globalAlpha = 1; }
    if (curMap) { drawGeometry(sx, sy); drawCrates(sx, sy); drawPowerups(sx, sy); }
    drawEnemies(sx, sy);
    const cw = m.cell[0], ch = m.cell[1];
    const ax = V.anchorX + (px - camX) + sx;
    const ay = V.feetRow - (ry - camY) + sy;
    const tc = tint && clock < tint.until ? tint : (isCharged() ? CHARGED_TINT : null);
    g.save();
    g.translate(Math.round(ax), Math.round(ay));
    if (cur.face < 0) g.scale(-1, 1);
    if (m.fxSheet) {                                             // effects at their own scale, behind Max
      const fs = m.fxScale || SPRITE_SCALE, fim = img[m.fxSheet].im;
      const fc = FX_CENTER[cur.id];
      g.save();
      if (fc) g.translate(fc[0] * (SPRITE_SCALE - fs), fc[1] * (fs - SPRITE_SCALE));   // keep the enlarged ring centred on Max's body
      const gone = side => cur.id === 'energy_wave' && cur.blast && cur.blast[side] && cur.k >= 2;   // that projectile burst
      if (!gone(cur.face)) blit(fim, cur.k * cw, cw, ch, -m.anchor[0] * fs, -m.anchor[1] * fs, null, fs);
      if (BOTH_SIDES.has(cur.id) && !gone(-cur.face)) { g.save(); g.scale(-1, 1); blit(fim, cur.k * cw, cw, ch, -m.anchor[0] * fs, -m.anchor[1] * fs, null, fs); g.restore(); }
      g.restore();
    }
    blit(img[m.sheet].im, cur.k * cw, cw, ch, -m.anchor[0] * SPRITE_SCALE, -m.anchor[1] * SPRITE_SCALE, tc, SPRITE_SCALE);
    g.restore();
    drawBeam(sx, sy);
    drawExplosions(sx, sy);
    drawParticles(sx, sy);
    drawLayer(img[D.fringe.src].im, -bgx + sx, camY + sy);
    drawGems(sx, sy);
    drawBars(sx, sy);
    drawMeters();
    drawFloaters(sx, sy);
    drawBanners();
    if (fadeUntil > clock) { g.globalAlpha = Math.min(1, (fadeUntil - clock) / FADE_MS); g.fillStyle = '#000'; g.fillRect(0, 0, V.w, V.h); g.globalAlpha = 1; }
    if (showBoxes) drawBoxes(sx, sy);
  }

  // ------------------------------------------------------------------ drawing: level scenery, crates, banners
  let fadeUntil = 0;
  const FADE_MS = 350;
  const groundY = sy => V.feetRow + camY + sy;                    // screen row of the ground line
  function drawGeometry(sx, sy) {
    const Y = wy => Math.round(groundY(sy) - wy);
    for (const s of curMap.solids) {                              // barriers: stone blocks
      const x0 = Math.round(s.x0 + sx), w = s.x1 - s.x0, top = Y(s.top), bot = Y(0);
      g.fillStyle = '#3d3949'; g.fillRect(x0, top, w, bot - top + 12);
      g.fillStyle = '#2b2735';
      for (let yy = top + 8; yy < bot + 12; yy += 8) g.fillRect(x0, yy, w, 1);
      for (let yy = top, r = 0; yy < bot + 12; yy += 8, r++) g.fillRect(x0 + (r % 2 ? 4 : 10), yy, 1, 8);
      g.fillStyle = '#635e7a'; g.fillRect(x0, top, w, 3);
      g.strokeStyle = '#111'; g.lineWidth = 1; g.strokeRect(x0 + 0.5, top + 0.5, w - 1, bot - top + 11);
    }
    for (const p of curMap.plats) {                               // platforms: a plank on two posts
      const x0 = Math.round(p.x0 + sx), w = p.x1 - p.x0, top = Y(p.top), bot = Y(0);
      g.fillStyle = 'rgba(58,38,22,0.75)';
      g.fillRect(x0 + 4, top + 7, 3, bot - top - 7); g.fillRect(x0 + w - 7, top + 7, 3, bot - top - 7);
      g.fillStyle = '#7a5230'; g.fillRect(x0, top, w, 7);
      g.fillStyle = '#b07c44'; g.fillRect(x0, top, w, 2);
      g.fillStyle = '#4a3018'; g.fillRect(x0, top + 6, w, 1);
      g.fillStyle = '#2a1a0c'; for (let nx = x0 + 6; nx < x0 + w - 3; nx += 16) g.fillRect(nx, top + 3, 2, 2);
      g.strokeStyle = '#111'; g.strokeRect(x0 + 0.5, top + 0.5, w - 1, 6);
    }
    // the way on: an arrow at the right edge (and the left, when there is a map before), a gate on the last map
    const last = level.idx === level.def.maps.length - 1, pulse = 0.55 + 0.35 * Math.sin(clock / 260);
    g.save();
    g.globalAlpha = pulse;
    const arrow = (ex, dir) => { const ay = Y(28); g.fillStyle = '#ffe14d'; g.beginPath(); g.moveTo(ex, ay - 7); g.lineTo(ex + dir * 9, ay); g.lineTo(ex, ay + 7); g.closePath(); g.fill(); };
    if (!last) arrow(MAP_W - 12 + sx, 1);
    if (level.idx > 0) arrow(12 + sx, -1);
    g.restore();
    if (last) {
      const open = !enemies.some(alive), gx = MAP_W - 10 + sx;
      g.fillStyle = open ? 'rgba(90,220,120,0.35)' : 'rgba(30,30,40,0.85)';
      g.fillRect(gx, Y(70), 10, Y(0) - Y(70));
      if (!open) { g.fillStyle = '#8a8a99'; for (let yy = Y(70); yy < Y(0); yy += 6) g.fillRect(gx + 2, yy, 6, 2); }
      else { g.save(); g.globalAlpha = pulse; g.fillStyle = '#7dff9a'; g.beginPath(); g.moveTo(gx - 4, Y(28) - 7); g.lineTo(gx + 5, Y(28)); g.lineTo(gx - 4, Y(28) + 7); g.closePath(); g.fill(); g.restore(); }
    }
  }
  function drawCrates(sx, sy) {
    for (const c of curMap.crates) {
      if (c.broken) continue;
      const X = Math.round(c.x + sx), Y = Math.round(groundY(sy) - c.fy), gold = !!c.item;
      if (gold) {                                                 // a soft pulsing glow so golden crates stand out
        g.save(); g.globalAlpha = 0.22 + 0.12 * Math.sin(clock / 220);
        g.fillStyle = '#ffd24a'; g.beginPath(); g.arc(X, Y - 9, 16, 0, Math.PI * 2); g.fill(); g.restore();
      }
      g.fillStyle = '#000'; g.fillRect(X - 10, Y - 19, 20, 19);
      g.fillStyle = gold ? '#c9962a' : '#8a5a2b'; g.fillRect(X - 9, Y - 18, 18, 17);
      g.fillStyle = gold ? '#f0cf66' : '#b07a3c'; g.fillRect(X - 9, Y - 18, 18, 2);
      g.strokeStyle = gold ? '#7a5a10' : '#5a3a18'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(X - 8, Y - 17); g.lineTo(X + 8, Y - 2); g.moveTo(X + 8, Y - 17); g.lineTo(X - 8, Y - 2); g.stroke();
      g.strokeRect(X - 8.5, Y - 17.5, 17, 16);
      if (gold) { g.font = 'bold 9px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 2; g.strokeText('?', X, Y - 10); g.fillText('?', X, Y - 10); g.textAlign = 'left'; }
    }
  }
  function drawPowerups(sx, sy) {
    for (const u of powerups) {
      const X = Math.round(u.x + sx), Y = Math.round(groundY(sy) - u.y - Math.sin((clock - u.t0) / 240) * 3), it = P.byId[u.item];
      g.save();
      g.globalAlpha = 0.3 + 0.15 * Math.sin(clock / 180); g.fillStyle = '#ffe14d';
      g.beginPath(); g.arc(X, Y, 13, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
      g.fillStyle = '#000'; g.beginPath(); g.arc(X, Y, 9, 0, Math.PI * 2); g.fill();
      g.fillStyle = it && it.kind === 'Button' ? '#ff9f43' : '#ffd24a'; g.beginPath(); g.arc(X, Y, 8, 0, Math.PI * 2); g.fill();
      g.font = 'bold 7px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#2a1a00';
      g.fillText(it && it.kind === 'Button' ? it.id : 'NEW', X, Y + 0.5);
      g.restore();
    }
  }
  function drawParticles(sx, sy) {
    for (const q of particles) {
      g.globalAlpha = Math.max(0, 1 - (clock - q.t0) / q.life);
      g.fillStyle = q.c; g.fillRect(Math.round(q.wx + sx) - 1, Math.round(groundY(sy) - q.wy) - 1, 3, 3);
    }
    g.globalAlpha = 1;
  }
  // banners: a dark strip near the top with a title and an optional second line; they fade in and out
  function drawBanners() {
    let y = 62;
    for (const b of banners) {
      const age = clock - b.t0, a = Math.max(0, Math.min(1, age / 200, (b.ms - age) / 350));
      const h = b.sub ? 30 : 20;
      g.save();
      g.globalAlpha = a * 0.82; g.fillStyle = '#0c0a12'; g.fillRect(52, y, V.w - 104, h);
      g.globalAlpha = a; g.strokeStyle = '#ffd24a'; g.lineWidth = 1; g.strokeRect(52.5, y + 0.5, V.w - 105, h - 1);
      g.textAlign = 'center'; g.textBaseline = 'top'; g.lineWidth = 2; g.lineJoin = 'round';
      g.font = 'bold 9px monospace'; g.strokeStyle = '#000'; g.fillStyle = '#ffe14d';
      g.strokeText(b.title, V.w / 2, y + 5); g.fillText(b.title, V.w / 2, y + 5);
      if (b.sub) { g.font = '7px monospace'; g.fillStyle = '#e6e6ec'; g.strokeText(b.sub, V.w / 2, y + 18); g.fillText(b.sub, V.w / 2, y + 18); }
      g.restore();
      y += h + 4;
    }
    g.textAlign = 'left';
  }

  // explosions: an expanding fireball with a shock ring, and a white flash over the view for the big one
  function drawExplosions(sx, sy) {
    for (let i = explosions.length - 1; i >= 0; i--) {
      const ex = explosions[i], age = clock - ex.t0;
      if (age > BLAST_MS) { explosions.splice(i, 1); continue; }
      if (age < 0) continue;
      const u = age / BLAST_MS, R = (ex.r || (ex.big ? 90 : 34)) * (0.25 + 0.75 * Math.sqrt(u));
      const X = Math.round(V.anchorX + (ex.wx - camX) + sx), Y = Math.round(V.feetRow + camY + sy - ex.wy);
      g.save();
      g.globalAlpha = Math.max(0, 1 - u);
      const gr = g.createRadialGradient(X, Y, 0, X, Y, R);
      gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.35, '#ffd060'); gr.addColorStop(0.7, '#ff6a20'); gr.addColorStop(1, 'rgba(255,60,0,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(X, Y, R, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#8fd0ff'; g.lineWidth = ex.big ? 4 : 2;
      g.beginPath(); g.arc(X, Y, R, 0, Math.PI * 2); g.stroke();
      g.restore();
    }
    if (clock < flashUntil) {
      g.save(); g.globalAlpha = 0.75 * (flashUntil - clock) / FLASH_MS; g.fillStyle = '#fff'; g.fillRect(0, 0, V.w, V.h); g.restore();
    }
  }
  // gems on the ground: a bobbing diamond with a glow, blinking for the last 4 s
  function drawGems(sx, sy) {
    for (const gm of gems) {
      const left = GEM_LIFE - (clock - gm.t0);
      if (left < 4000 && Math.floor(clock / 120) % 2) continue;
      const X = Math.round(V.anchorX + (gm.x - camX) + sx), Y = Math.round(V.feetRow + camY + sy - gm.y - Math.sin(gm.bob) * 3);
      const c = gm.kind === 'energy' ? ['#bfe6ff', '#4af', '#1d5fb0'] : gm.kind === 'super' ? ['#f0d6ff', '#c6f', '#6a2a9a'] : ['#ffe3b0', '#fa4', '#b25a10'];
      g.save();
      g.globalAlpha = 0.25 + 0.1 * Math.sin(gm.bob * 2); g.fillStyle = c[1];
      g.beginPath(); g.arc(X, Y, 9, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 1;
      g.fillStyle = '#000'; g.beginPath(); g.moveTo(X, Y - 7); g.lineTo(X + 5, Y); g.lineTo(X, Y + 7); g.lineTo(X - 5, Y); g.closePath(); g.fill();
      g.fillStyle = c[1]; g.beginPath(); g.moveTo(X, Y - 6); g.lineTo(X + 4, Y); g.lineTo(X, Y + 6); g.lineTo(X - 4, Y); g.closePath(); g.fill();
      g.fillStyle = c[0]; g.beginPath(); g.moveTo(X, Y - 6); g.lineTo(X - 4, Y); g.lineTo(X, Y - 1); g.closePath(); g.fill();
      g.fillStyle = c[2]; g.beginPath(); g.moveTo(X, Y + 6); g.lineTo(X + 4, Y); g.lineTo(X, Y + 1); g.closePath(); g.fill();
      g.restore();
    }
  }
  // meters under the health bar: ENG (blue) and EMP (orange); a bar flashes white when a move was refused
  function drawMeters() {
    g.font = 'bold 7px monospace'; g.textBaseline = 'top'; g.textAlign = 'left'; g.lineWidth = 2; g.lineJoin = 'round';
    let y = 24;                                                    // only the meters the player has unlocked are drawn
    for (const [lab, k, v, max, col] of [['ENG', 'energy', energyMeter, ENERGY_MAX, '#4af'], ['EMP', 'empower', empowerMeter, EMPOWER_MAX, '#fa4'], ['SUP', 'super', superMeter, SUPER_MAX, '#c6f']]) {
      if (!P.meterOn(k)) continue;
      g.strokeStyle = '#000'; g.fillStyle = '#fff';
      g.strokeText(lab, 8, y - 1); g.fillText(lab, 8, y - 1);
      const flash = clock < meterFlash[k];
      g.fillStyle = '#000'; g.fillRect(27, y - 1, 102, 8);
      g.fillStyle = '#16202e'; g.fillRect(28, y, 100, 6);
      const fw = Math.round(100 * v / max);
      g.fillStyle = flash && Math.floor(clock / 70) % 2 ? '#fff' : col; g.fillRect(28, y, fw, 6);
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(28, y, fw, 1);
      const t = `${Math.round(v)}/${max}`;
      g.strokeStyle = '#000'; g.fillStyle = '#fff'; g.strokeText(t, 132, y - 1); g.fillText(t, 132, y - 1);
      y += 9;
    }
  }

  // health bars: hers at the top left of the view, each living enemy's over its head
  function bar(x0, y0, w, h, frac) {
    g.fillStyle = '#000'; g.fillRect(x0 - 1, y0 - 1, w + 2, h + 2);
    g.fillStyle = '#4a1414'; g.fillRect(x0, y0, w, h);
    const fw = Math.round(w * Math.max(0, Math.min(1, frac)));
    g.fillStyle = frac > 0.5 ? '#3ddc5f' : frac > 0.25 ? '#f0c030' : '#e63b2e';
    g.fillRect(x0, y0, fw, h);
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x0, y0, fw, 1);
  }
  function drawBars(sx, sy) {
    const X = wx => V.anchorX + (wx - camX) + sx, Y = wy => V.feetRow + camY + sy - wy;
    for (const e of enemies) {
      const b = hurtOf(e);
      if (!b) continue;
      bar(Math.round(X((b[0] + b[2]) / 2)) - 15, Math.round(Y(b[3])) - 8, 30, 3, e.hp / e.maxHp);
    }
    g.font = 'bold 7px monospace'; g.textBaseline = 'top'; g.lineWidth = 2; g.lineJoin = 'round';
    g.strokeStyle = '#000'; g.fillStyle = '#fff';
    g.strokeText('MAX', 8, 14); g.fillText('MAX', 8, 14);
    bar(28, 15, 100, 6, hp / MAX_HP);
    const t = `${hp}/${MAX_HP}`;
    g.strokeText(t, 132, 14); g.fillText(t, 132, 14);
  }
  function drawFloaters(sx, sy) {
    const X = wx => V.anchorX + (wx - camX) + sx, Y = wy => V.feetRow + camY + sy - wy;
    g.font = 'bold 10px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 3; g.lineJoin = 'round';
    for (let i = floaters.length - 1; i >= 0; i--) {
      const f = floaters[i], age = clock - f.t0;
      if (age > FLOAT_MS) { floaters.splice(i, 1); continue; }
      g.globalAlpha = age < FLOAT_MS - 300 ? 1 : (FLOAT_MS - age) / 300;
      const fx = Math.round(X(f.wx)), fy = Math.round(Y(f.wy) - age * 0.035);
      g.strokeStyle = '#000'; g.strokeText(f.text, fx, fy);
      g.fillStyle = f.color; g.fillText(f.text, fx, fy);
    }
    g.globalAlpha = 1; g.textAlign = 'left';
  }

  // one sheet cell, optionally washed with a colour (a red hit, a white block or parry)
  const wash = document.createElement('canvas'), wg = wash.getContext('2d');
  function blit(im, sx, w, h, dx, dy, tc, sc) {
    sc = sc == null ? 1 : sc;
    const dw = w * sc, dh = h * sc;
    if (!tc) { g.drawImage(im, sx, 0, w, h, dx, dy, dw, dh); return; }
    if (wash.width < w || wash.height < h) { wash.width = Math.max(wash.width, w); wash.height = Math.max(wash.height, h); }
    wg.globalCompositeOperation = 'source-over'; wg.globalAlpha = 1;
    wg.clearRect(0, 0, wash.width, wash.height);
    wg.drawImage(im, sx, 0, w, h, 0, 0, w, h);
    wg.globalCompositeOperation = 'source-atop'; wg.globalAlpha = tc.alpha || 0.7;
    wg.fillStyle = tc.color; wg.fillRect(0, 0, w, h);
    g.drawImage(wash, 0, 0, w, h, dx, dy, dw, dh);
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
      g.translate(vx, Math.round(gy - (e.fy || 0)));
      if (e.face > 0) g.scale(-1, 1);
      blit(img[T.sheet].im, cell * cw, cw, ch, -ax * SPRITE_SCALE * (e.scale||1), -ay * SPRITE_SCALE * (e.scale||1), e.tint && clock < e.tint.until ? e.tint : null, SPRITE_SCALE * (e.scale||1));
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
    camX = V.anchorX;                    // one map is one screen: no sideways scrolling, world x is screen x
    if (!cur) return;
    const ease = 1 - Math.exp(-dt / 70);
    camY += (Math.max(0, herY() - CAM_KEEP) - camY) * ease;
  }

  // ------------------------------------------------------------------ HUD
  const logEl = document.getElementById('log');
  function logMove(id, via) {
    if (!logEl) return;
    const li = document.createElement('li');
    li.textContent = `${id}  (${D.moves[id].input}${via && via !== 'action' ? ', ' + via : ''})`;
    logEl.prepend(li);
    while (logEl.children.length > 8) logEl.lastChild.remove();
  }
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
  // Rows for the Moves menu: the base controls first, then every combo or button the player has unlocked.
  function moveRows() {
    const rows = [];
    for (const b of D.input.bindings) {
      if (b.type === 'idle' || !moveOpen(b.move)) continue;
      const m = D.moves[b.move];
      rows.push({ section: BASE_MOVES.has(b.move) ? 'Controls' : 'Unlocked combos',
                  pad: (b.input === 'none' ? '(nothing)' : b.input) + (b.type === 'air' ? ' (air)' : ''),
                  keys: keysOf(b.input), title: m ? m.title : b.move, how: how(b) });
    }
    return rows.filter(r => r.section === 'Controls').concat(rows.filter(r => r.section !== 'Controls'));
  }
  function lockedCount() {
    const seen = new Set();
    for (const b of D.input.bindings) if (b.type !== 'idle' && !moveOpen(b.move)) seen.add(b.move);
    return seen.size;
  }
  const killsEl = document.getElementById('kills');
  const padStatus = () => padName ? `Controller: ${padName}` : 'Controller: none seen yet. Connect it, then press any button on it.';
  function hud() {
    if (killsEl) killsEl.textContent = (level ? `Level ${level.n}.${level.idx + 1}   Kills ${kills}` : '') + (cheats.invincible ? '  [INV]' : '') + (cheats.infinite ? '  [INF]' : '');
  }

  // ------------------------------------------------------------------ menus, screens and the loop
  // Screens: 'title' (the menu over the overworld), 'overworld' (pick a level) and 'level' (playing). A menu (Start,
  // Enter, Escape) pauses the level. Game time (`clock`) only advances while a level runs.
  const UI = window.BibooUI;
  let last = 0;
  let assetsReady = false, paused = false, gameOver = false, levelDone = false, devOpen = false;
  const ow = { sel: 0 };                                             // overworld cursor: index of the selected level

  // Menu navigation: while a menu is open, Up and Down (arrows, d-pad or stick) move the highlight, A activates and
  // B goes back. On the overworld, Left/Right or Up/Down pick a level and A enters it. Edge detected, with key repeat.
  const navPrev = { Up: false, Down: false, Left: false, Right: false, A: false, B: false, dev: false }, navNext = { Up: 0, Down: 0 };
  function navPoll(t) {
    const on = k => keyDown.has(k) || padDown.has(k);
    const now = { Up: on('Up'), Down: on('Down'), Left: on('Left'), Right: on('Right'), A: on('A'), B: on('B') };
    const chord = ['L1', 'L2', 'R1', 'R2'].every(on);                  // all four shoulder buttons together: the Dev Console
    if (chord && !navPrev.dev && assetsReady) toggleDev();
    navPrev.dev = chord;
    if (UI && UI.isOpen()) {
      for (const k of ['Up', 'Down']) {
        if (now[k] && (!navPrev[k] || t >= navNext[k])) { UI.nav(k === 'Up' ? -1 : 1); navNext[k] = t + (navPrev[k] ? 110 : 320); }
      }
      if (now.A && !navPrev.A) UI.activate();
      if (now.B && !navPrev.B) UI.back();
    } else if (screen === 'overworld' && !paused && !devOpen) {
      const n = LV.levels.length;
      if ((now.Left && !navPrev.Left) || (now.Up && !navPrev.Up)) ow.sel = (ow.sel + n - 1) % n;
      if ((now.Right && !navPrev.Right) || (now.Down && !navPrev.Down)) ow.sel = (ow.sel + 1) % n;
      if (now.A && !navPrev.A) enterLevel(ow.sel + 1);
    }
    Object.assign(navPrev, now);
  }
  // buttons still held when a menu closes are ignored until they are let go, so pressing A on "Resume" does not slash
  const ignoreUntilUp = new Set();
  function ignoreHeldButtons() { for (const b of BUTTONS) if (keyDown.has(b) || padDown.has(b)) ignoreUntilUp.add(b); }

  function tickLevel(t, dt) {
    clock += dt;                                      // game time: it does not run while a menu is open
    if (cheats.infinite) { energyMeter = ENERGY_MAX; empowerMeter = EMPOWER_MAX; superMeter = SUPER_MAX; }
    readButtons(t);
    for (const e of reader.update(t)) request(e.move, e.via);
    const before = cur && BLOCKED.has(cur.id) ? playerX() : null;
    step(dt, t);
    if (cur && cur.crash && cur.id === 'jump' && rootOf(cur)[1] > 0) airCrash('air');
    blockMove(before);
    physics();
    if (screen !== 'level' || !curMap) return;        // the level just ended
    if (hp <= 0 && !gameOver) triggerGameOver();     // any source of damage ends the run, not only an enemy hit
    beamHits();
    stepHeal(dt);
    stepPowerups();
    stepEffects(dt);
    if (cur && cur.kind === 'action' && !hitQ.length) queueHit();   // the frame still on screen
    stepEnemies(dt);
    resolveHits();
    enemyAttacks();
    follow(dt);
    draw();
    hud();
    drawMonitor();
  }
  function frame(t) {
    pollPad();
    navPoll(t);
    const dt = Math.min(100, last ? t - last : 16);
    last = t;
    if (assetsReady) {
      if (screen === 'level') { if (!paused && !gameOver && !devOpen) tickLevel(t, dt); }
      else { clock += dt; stepEffects(dt); drawOverworld(); hud(); }
    }
    requestAnimationFrame(frame);
  }

  // ---- the overworld: five level nodes on a path; a level opens when the one before it is beaten
  const OW_NODES = [[52, 150], [120, 112], [192, 146], [262, 104], [332, 138]];
  const nodeAt = i => OW_NODES[i % OW_NODES.length];
  function drawOverworld() {
    const n = LV.levels.length;
    g.fillStyle = '#10151c'; g.fillRect(0, 0, V.w, V.h);
    for (const l of D.layers) drawLayer(img[l.src].im, -clock * 0.012 * l.parallax, 0);
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
    // Max stands on the selected node and bobs a little
    const [mx, my] = nodeAt(ow.sel), im = D.moves.idle, sc = 0.4, bob = Math.sin(clock / 260) * 1.5;
    g.save(); g.translate(Math.round(mx), Math.round(my - 14 + bob));
    blit(img[im.sheet].im, 0, im.cell[0], im.cell[1], -im.anchor[0] * sc, -im.anchor[1] * sc, null, sc);
    g.restore();
    // header and the info strip for the selected level
    const L = LV.levels[ow.sel], open = P.levelOpen(ow.sel + 1), got = P.state.unlocked.length;
    g.textAlign = 'center'; g.textBaseline = 'top'; g.lineJoin = 'round'; g.lineWidth = 3;
    g.font = 'bold 12px monospace'; g.strokeStyle = '#000'; g.fillStyle = '#ffe14d';
    g.strokeText('OVERWORLD', V.w / 2, 10); g.fillText('OVERWORLD', V.w / 2, 10);
    g.fillStyle = 'rgba(12,10,18,0.85)'; g.fillRect(24, 170, V.w - 48, 38);
    g.strokeStyle = '#ffd24a'; g.lineWidth = 1; g.strokeRect(24.5, 170.5, V.w - 49, 37);
    g.font = 'bold 9px monospace'; g.fillStyle = '#fff';
    g.fillText(`Level ${L.n}: ${L.name}${P.state.cleared.includes(L.n) ? '  (cleared)' : ''}`, V.w / 2, 175);
    g.font = '7px monospace'; g.fillStyle = '#e6e6ec';
    g.fillText(open ? L.blurb : `Locked. Beat level ${L.n - 1} first.`, V.w / 2, 188);
    g.fillStyle = '#9a9aa8';
    g.fillText(`${open ? 'A or Enter: play   ' : ''}Left and Right: choose   Start: menu   Moves found: ${got}/${P.UNLOCKS.length}`, V.w / 2, 198);
    g.textAlign = 'left';
    drawBanners();
  }
  function enterLevel(n) {
    if (!P.levelOpen(n)) { hint(`Locked: beat level ${n - 1} first`); return; }
    startLevel(n);
  }
  function goOverworld() {
    if (level) syncProgress();
    level = null; curMap = null; screen = 'overworld'; paused = false; gameOver = false; levelDone = false;
    enemies.length = 0; respawns.length = 0; gems.length = 0; explosions.length = 0; floaters.length = 0;
    powerups.length = 0; particles.length = 0; banners.length = 0; hitQ.length = 0;
    stun = null; slide = null; fall = null; cur = null; queued = null; tint = null; floorY = 0; camY = 0; rumble = null;
    ow.sel = Math.max(0, Math.min(LV.levels.length, P.state.levelsUnlocked) - 1);
    hideMenu(); ignoreHeldButtons(); setStartLabel();
    if (killsEl) killsEl.textContent = '';
    canvas.focus();
  }


  // ---- the Dev Console: L1+L2+R1+R2 together (or the ` key) opens it over whatever screen is up. It pauses the game.
  let devReturn = null, resetArmed = false;
  function openDev() {
    devReturn = UI.isOpen() ? { view: UI.view, opts: UI.opts } : null;
    devOpen = true; resetArmed = false;
    UI.open('dev', {});
  }
  function closeDev() {                              // back to the menu that was open under it, or to the game
    devOpen = false; resetArmed = false;
    if (devReturn) UI.open(devReturn.view, devReturn.opts); else { UI.close(); ignoreHeldButtons(); canvas.focus(); }
    devReturn = null;
  }
  function leaveDev() {                              // close the console and the menus under it: play on
    devOpen = false; devReturn = null; resetArmed = false;
    paused = false; gameOver = false; levelDone = false;
    if (hp <= 0) hp = MAX_HP;
    UI.close(); ignoreHeldButtons(); setStartLabel();
  }
  function toggleDev() { if (devOpen) closeDev(); else if (assetsReady) openDev(); }
  function devItems() {
    const onoff = v => v ? 'ON' : 'OFF', act = fn => () => { resetArmed = false; fn(); };
    const items = [
      { label: 'Invincible', state: onoff(cheats.invincible), fn: act(() => { cheats.invincible = !cheats.invincible; }) },
      { label: 'Infinite meters', state: onoff(cheats.infinite), fn: act(() => { cheats.infinite = !cheats.infinite; }) },
      { label: 'Show hitboxes', state: onoff(showBoxes), fn: act(() => { showBoxes = !showBoxes; }) },
      { label: 'Unlock all levels', fn: act(() => { P.unlockAllLevels(); }) },
      { label: 'Unlock all moves and buttons', fn: act(() => unlockEverything()) },
      { label: 'Give 5 of every gem', fn: act(() => { for (const k of P.GEM_KINDS) P.addGem(k, 5); P.save(); }) },
      { label: 'Full health and full meters', fn: act(() => { hp = MAX_HP; energyMeter = ENERGY_MAX; empowerMeter = EMPOWER_MAX; superMeter = SUPER_MAX; syncProgress(); }) },
    ];
    if (level) {
      items.push({ label: 'Kill every enemy on this map', fn: act(() => { for (const e of enemies) if (alive(e)) kill(e); }) });
      items.push({ label: 'Next map', fn: act(() => { if (level.idx < level.def.maps.length - 1) { leaveDev(); loadMap(level.idx + 1, 'left'); } }) });
      items.push({ label: 'Previous map', fn: act(() => { if (level.idx > 0) { leaveDev(); loadMap(level.idx - 1, 'left'); } }) });
      items.push({ label: 'Complete this level', fn: act(() => { leaveDev(); levelComplete(); }) });
    }
    items.push({ label: resetArmed ? 'Press again to erase the save' : 'Reset all progress', fn: () => {
      if (!resetArmed) { resetArmed = true; return; }
      P.reset(); energyMeter = empowerMeter = superMeter = 0; refreshUnlocks();
      leaveDev(); goOverworld();
    } });
    items.push({ label: 'Close', fn: closeDev, primary: true });
    return items;
  }

  function setStartLabel() {
    const b = document.getElementById('btn-hud-start');
    if (b) b.textContent = screen === 'title' ? 'Start' : gameOver ? 'Retry' : paused ? 'Resume' : 'Menu';
  }
  function showMenu(msg) { if (UI) UI.open('main', { msg: msg != null ? msg : '' }); }
  function hideMenu() { if (UI) UI.close(); }
  function toggleFullscreen() {
    const stage = document.getElementById('stage') || canvas;
    if (!document.fullscreenElement) (stage.requestFullscreen && stage.requestFullscreen()) || (canvas.requestFullscreen && canvas.requestFullscreen());
    else document.exitFullscreen && document.exitFullscreen();
  }
  // B or Escape on the main list: back to the game (not from the title menu, Game Over or Level Complete)
  function closeMenu() {
    if (devOpen) { closeDev(); return; }
    if (screen === 'title' || gameOver || levelDone || !paused) return;
    togglePause();
  }
  function mainItems() {
    const items = [];
    if (screen === 'title') items.push({ label: 'Start', fn: () => goOverworld(), primary: true, id: 'btn-start' });
    else if (gameOver) items.push({ label: 'Retry this map', fn: () => retryMap(), primary: true, id: 'btn-start' });
    else items.push({ label: 'Resume', fn: () => togglePause(), primary: true, id: 'btn-start' });
    items.push({ label: 'Moves', fn: () => UI.open('moves', { msg: UI.opts.msg }) });
    items.push({ label: 'Gems', fn: () => UI.open('gems', { msg: UI.opts.msg }) });
    if (screen === 'level') items.push({ label: 'Back to the overworld', fn: () => goOverworld() });
    items.push({ label: 'Fullscreen', fn: toggleFullscreen, id: 'btn-fullscreen' });
    return items;
  }
  function triggerGameOver() {
    if (gameOver) return;
    gameOver = true;
    paused = true;
    showMenu('Game Over');
    setStartLabel();
  }
  function togglePause() {
    if (!assetsReady) return;
    if (devOpen) { closeDev(); return; }
    if (screen === 'title') { goOverworld(); return; }
    if (levelDone) { goOverworld(); return; }
    if (gameOver) { retryMap(); return; }
    paused = !paused;
    if (paused) showMenu(screen === 'level' ? 'Paused' : 'Menu');
    else { hideMenu(); ignoreHeldButtons(); canvas.focus(); }
    setStartLabel();
  }
  if (UI) UI.init({ mainItems, closeMenu, moveRows, lockedCount, padStatus, gemRows, useGem, devItems,
    moveNotes: () => ['Keyboard: arrows = d-pad, Z = A, X = B, C = X, V = Y. Shoulders: Q = L1, E = L2, T = R1, R = R2, W = hold R (recover). Enter, Space or Escape opens and closes this menu. Hold Left or Right while jumping to steer.',
                      'A gamepad works too, wired or Bluetooth, also on an Android phone in Chrome: A is the bottom face button, B right, X left, Y top. Click the game first if keys do nothing. Press H to show hurtboxes and hit shapes.'] });
  Promise.all(srcs.map(load)).then(() => {
    const loading = document.getElementById('loading');
    if (loading) loading.remove();
    assetsReady = true;
    const hb = document.getElementById('btn-hud-start');
    if (hb) hb.disabled = false;
    goOverworld(); screen = 'title';                  // the title menu sits over the overworld
    ow.sel = 0;
    setStartLabel();
    showMenu('Defeat the goblins and orcs');
  }).catch(err => {
    const loading = document.getElementById('loading');
    if (loading) loading.textContent = String(err);
  });
  requestAnimationFrame(frame);

  canvas.addEventListener('pointerdown', ev => {
    canvas.focus();
    if (screen !== 'overworld' || paused) return;      // tap or click a level on the overworld: first selects, second enters
    const r = canvas.getBoundingClientRect(), px = (ev.clientX - r.left) * V.w / r.width, py = (ev.clientY - r.top) * V.h / r.height;
    for (let i = 0; i < LV.levels.length; i++) {
      const [nx, ny] = nodeAt(i);
      if (Math.hypot(px - nx, py - ny) < 18) { if (ow.sel === i) enterLevel(i + 1); else ow.sel = i; return; }
    }
  });
  window.togglePause = togglePause;
  addEventListener('pagehide', syncProgress);
  document.addEventListener('visibilitychange', () => { if (document.hidden) syncProgress(); });
  const hudBtn = document.getElementById('btn-hud-start');
  if (hudBtn) hudBtn.addEventListener('click', ev => { ev.preventDefault(); togglePause(); });
  addEventListener('keydown', e => {
    if (e.code === 'Escape') {
      e.preventDefault();
      if (UI && UI.isOpen()) UI.back(); else if (screen !== 'title' && !gameOver) togglePause();
      return;
    }
    if (e.code === 'Backquote') { e.preventDefault(); toggleDev(); return; }
    if (e.code === 'Enter' || e.code === 'Space') {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'BUTTON')) return;
      e.preventDefault();
      togglePause();
    }
  });
  // read-only hooks for the browser test
  window.bibooGame = {
    facing: () => cur ? cur.face : facing,
    beam: () => { const b = beamNow(); return b && { kind: b.kind, face: b.face, len: b.len, ox: b.ox, oy: b.oy }; },
    started, current: () => cur && { id: cur.id, k: cur.k, kind: cur.kind, y: fall ? fall.y : rootOf(cur)[1], air: !!cur.air }, x: () => x,
    playerX: () => playerX(),
    enemies: () => enemies.map(e => ({ type: e.type, x: e.x, face: e.face, state: e.state, anim: e.anim,
                                       scale: e.scale || 1, tint: e.tint && clock < e.tint.until ? e.tint.color : null })),
    kills: () => kills,
    hp: () => hp,
    meters: () => ({ energy: energyMeter, empower: empowerMeter, super: superMeter }),
    setMeters: (e, m, sp) => { energyMeter = e; empowerMeter = m; if (sp !== undefined) superMeter = sp; },
    gems: () => gems.map(gm => ({ x: gm.x, kind: gm.kind })),
    dropGem: (dx, kind) => spawnGem(bodyX() + dx, kind),
    enemyHp: () => enemies.map(e => e.hp),
    floaters: () => floaters.map(f => f.text),
    setEnemyHp: n => { hpOverride = n; },
    setHp: n => { hp = n; },
    heavy: () => cur && (cur.id === 'heavy' || cur.id === 'jump_crash') ? { id: cur.id, lite: !!cur.lite, charged: cur.charged, height: cur.height } : null,
    herBox: () => herBox(),
    combat: () => ({ stun: !!stun, hits, blocks, parries, tint: tint && clock < tint.until ? tint.color : null }),
    setRespawn: on => { respawnOn = on; },
    attack: (i, anim) => { const e = enemies[i]; e.state = 'attack'; play(e, anim); },
    // state and controls for the browser tests of levels, unlocks, menus and the dev console
    state: () => ({ screen, paused, gameOver, levelDone, devOpen, hp, floorY, feet: herY(), px: playerX(), cheats: { ...cheats },
                    level: level ? { n: level.n, idx: level.idx, id: curMap && curMap.id } : null,
                    crates: curMap ? curMap.crates.map(c => ({ x: c.x, fy: c.fy, item: c.item, broken: c.broken })) : [],
                    powerups: powerups.map(u => ({ item: u.item, x: u.x, y: u.y })),
                    foes: enemies.map(e => ({ type: e.type, x: e.x, fy: e.fy, hp: e.hp, state: e.state, alive: alive(e), path: e.path, dir: e.dir })),
                    solids: curMap ? curMap.solids : [], plats: curMap ? curMap.plats : [], fx: { gems: gems.length } }),
    enterLevel: n => enterLevel(n), warp: idx => { loadMap(idx, 'left'); }, setX: v => { x = v; }, goOverworld: () => goOverworld(),
    menuOpen: () => !!(UI && UI.isOpen()),
    hurtFoe: (i, dmg) => { if (enemies[i]) hurtEnemy(enemies[i], dmg); }, killFoe: i => { if (enemies[i]) kill(enemies[i]); },
    hurtHer: d => hurtHer(d), gemBag: () => ({ ...P.state.gems }), pickups: () => gems.map(g => ({ x: g.x, kind: g.kind })),
    // test setup: clear the field and place enemies at distances from her anchor
    setEnemies: list => {
      enemies.length = 0; respawns.length = 0; facing = 1; hp = MAX_HP;
      for (const [type, dx, rest] of list) {                  // rest: stand still this long first (ms)
        const e = spawn(type, playerX() + dx);
        if (rest) { e.state = 'idle'; e.rest = rest; play(e, 'idle'); }
      }
    },
  };
})();
