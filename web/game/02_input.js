'use strict';
  // ------------------------------------------------------------------ input
  const BUTTONS = ['Up', 'Down', 'Left', 'Right', 'A', 'B', 'X', 'Y', 'L1', 'L2', 'R1', 'R2', 'R'];
  const KEYS = { ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right',
                 KeyZ: 'A', KeyX: 'B', KeyA: 'X', KeyS: 'Y', KeyQ: 'L1', KeyW: 'R1', Digit1: 'L2', Digit2: 'R2' };   // W is R1 and also the recover hold, like the pad's R1
  const KEY_LABEL = { Up: '↑', Down: '↓', Left: '←', Right: '→', A: 'Z', B: 'X', X: 'A', Y: 'S', L1: 'Q', L2: '1', R1: 'W', R2: '2', R: 'W' };
  const PAD = { 0: 'A', 1: 'B', 2: 'X', 3: 'Y', 4: 'L1', 5: 'R1', 6: 'L2', 7: 'R2', 12: 'Up', 13: 'Down', 14: 'Left', 15: 'Right' };
  const keyDown = new Set(), padDown = new Set(), isDown = new Set();
  // A attacks, Up jumps (tap Up; a second tap in the air is the double jump). Y is the spin attack; X+Y is the taunt. Sky dash is Down then Up.
  const btnHeld = b => keyDown.has(b) || padDown.has(b);

  let reader = null;
  function activeInput() {                       // the bindings whose move is open (air and idle bindings are always kept)
    let bs = D.input.bindings.filter(b => b.type === 'idle' || b.type === 'air' || moveOpen(b.move)).filter(b => b.move !== 'jump');
    // with the chop unlocked A is tap = slash, hold = charge (release = chop), like B's parry and block
    if (moveOpen('charge')) bs = bs.map(b => b.move === 'slash' && b.type === 'press' ? Object.assign({}, b, { type: 'tap' }) : b);
    return Object.assign({}, D.input, { bindings: bs });   // jump is the Up button, read in readButtons
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
                      z: 'A', x: 'B', a: 'X', s: 'Y', q: 'L1', w: 'R1', 1: 'L2', 2: 'R2', Z: 'A', X: 'B', A: 'X', S: 'Y', Q: 'L1', W: 'R1' };
  const KEY_CODES = { 37: 'Left', 38: 'Up', 39: 'Right', 40: 'Down' };
  const keyButton = e => KEYS[e.code] || KEY_NAMES[e.key] || KEY_CODES[e.keyCode];
  addEventListener('keydown', e => {
    if (e.code === 'KeyH' && !e.repeat) { showBoxes = !showBoxes; return; }
    const b = keyButton(e);
    if (!e.repeat) monitor(`key down  key "${e.key}"  code "${e.code}"  keyCode ${e.keyCode}  -> ${b || 'not used'}`);
    if (!b) return;
    e.preventDefault();
    keyDown.add(b); if (b === 'R1') keyDown.add('R');
  });
  addEventListener('keyup', e => {
    const b = keyButton(e);
    monitor(`key up    key "${e.key}"  code "${e.code}"  keyCode ${e.keyCode}  -> ${b || 'not used'}`);
    if (b) { e.preventDefault(); keyDown.delete(b); if (b === 'R1') keyDown.delete('R'); }
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
  const metersHeld = () => P.has('meter_charge') && P.buttonOn('L1') && P.buttonOn('R1') && (keyDown.has('L1') || padDown.has('L1')) && (keyDown.has('R1') || padDown.has('R1')) && !keyDown.has('L2') && !padDown.has('L2') && !keyDown.has('R2') && !padDown.has('R2');   // L1+R1 with L2 or R2 is the Ultimate Chain's chord, not a charge
  // Up also finishes the Sky Dash, so it does not jump right after Down when Sky Dash is owned
  const upIsCombo = t => (P.has('sky_dash') && (isDown.has('Down') || t - lastDownRel < D.input.sequence_window_ms));
  let lastDownRel = -1e9;
  // Flight (A, B, A, B, Up) and the Rainbow Guard (A, B, A, B, A, B) are read from the raw button log here, not by the reader
  const comboLog = []; let lastBClock = -1e9;
  function comboSeq(list, t, includesLast) {                         // the last presses were exactly `list`, each within the sequence window of the next
    const w = D.input.sequence_window_ms, n = list.length, tail = comboLog.slice(-n);
    if (tail.length < n || tail.some((e, i) => e.b !== list[i])) return false;
    for (let i = 1; i < n; i++) if (tail[i].t - tail[i - 1].t > w) return false;
    return includesLast || t - tail[n - 1].t <= w;
  }
  function readButtons(t) {
    pollPad();
    lastT = t;
    const charging = metersHeld();
    for (const b of BUTTONS) {
      let now = btnHeld(b);
      if (ignoreUntilUp.has(b)) { if (now) now = false; else ignoreUntilUp.delete(b); }   // held when a menu closed
      if (!P.buttonOn(b)) now = false;                             // a shoulder button that is not unlocked yet
      if (charging && (b === 'L1' || b === 'R1')) now = false;
      else if (charging && b === 'R') now = false;
      if (now && !isDown.has(b)) {
        isDown.add(b); reader.down(b, t);
        if (b === 'Up' && !charging) {
          if (P.has('fly') && comboSeq(['A', 'B', 'A', 'B'], t)) { comboLog.length = 0; startFlight(); }      // A, B, A, B, Up
          else if (!upIsCombo(t)) request('jump', 'press');   // Up jumps (and double jumps in the air)
        }
        if (b === 'A' || b === 'B') {
          comboLog.push({ b, t }); if (comboLog.length > 8) comboLog.shift();
          if (b === 'B') lastBClock = clock;
          if (b === 'B' && P.has('rainbow') && comboSeq(['A', 'B', 'A', 'B', 'A', 'B'], t + 1, true)) { comboLog.length = 0; startRainbow(); }   // A, B, A, B, A, B
        }
        if (b === 'Down') { if (t - lastDownT < DROP_TAP_MS && dropThrough()) lastDownT = -1e9; else lastDownT = t; }
        if (b === 'Left') facing = -1; else if (b === 'Right') facing = 1;
      } else if (!now && isDown.has(b)) {
        isDown.delete(b); reader.up(b, t); if (b === 'Down') lastDownRel = t;
        if (hold && hold.keys.includes(b)) { const m = hold.move; hold = null; request(m, 'release'); }   // (energy moves: see request)   // let go: the charged attack fires
        if (b === 'Left' && isDown.has('Right')) facing = 1;        // let go of the newer one: the other still held
        else if (b === 'Right' && isDown.has('Left')) facing = -1;
      }
    }
  }
