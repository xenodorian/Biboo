/* Biboo move test: the move library played live from the Dreamcast pad.
 *
 * World: the parallax scene from swingkit (layers tile in x). The character always faces right.
 * Each move frame is one actor image (effects + character) placed at the character's world
 * position: start of the move + that frame's root motion (y up). Black-and-white impact frames
 * replace the whole view for their duration. Camera: follows the character in x, rises once a
 * jump clears 30 px (the same camera the exporter drew the impact frames with).
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
    const b = KEYS[e.code];
    if (!b) return;
    e.preventDefault();
    keyDown.add(b);
  });
  addEventListener('keyup', e => { const b = KEYS[e.code]; if (b) { e.preventDefault(); keyDown.delete(b); } });
  addEventListener('blur', () => keyDown.clear());

  function pollPad() {
    padDown.clear();
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p) continue;
      p.buttons.forEach((bt, i) => { if (PAD[i] && (bt.pressed || bt.value > 0.5)) padDown.add(PAD[i]); });
      const [ax, ay] = p.axes;
      if (ax < -0.5) padDown.add('Left'); if (ax > 0.5) padDown.add('Right');
      if (ay < -0.5) padDown.add('Up'); if (ay > 0.5) padDown.add('Down');
    }
  }

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
  const started = [];                   // every move started, for the log and the browser test
  const JUMP = D.moves.jump;
  const FALL_K = JUMP.frames.findIndex((f, i) => i > 0 && f.root[1] < JUMP.frames[i - 1].root[1]);
  const LAND_K = JUMP.frames.findIndex((f, i) => i > FALL_K && f.root[1] === 0);

  function rootOf(c) { return D.moves[c.id].frames[c.k].root; }

  function start(id, kind, via) {
    if (cur) x += rootOf(cur)[0];       // keep the ground covered so far; height resets
    cur = { id, k: 0, t: 0, kind };
    if (kind === 'action' || kind === 'land') {
      started.push({ id, via: via || kind });
      logMove(id, via);
    }
  }

  function request(move, via) {
    if (!D.moves[move]) return;
    if (fall || (cur && cur.kind === 'land')) { queued = { move, via }; return; }
    const busy = cur && cur.kind === 'action';
    if (!busy || via !== 'press') start(move, 'action', via);   // chords, sequences, taps, releases cancel
    else queued = { move, via };                                 // a plain press waits its turn
  }

  function finishAction(t) {
    const m = D.moves[cur.id];
    const end = m.frames[m.frames.length - 1].root;
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
      if (cur.k < m.frames.length) continue;
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
    const [rx, ry] = fall ? [0, fall.y] : (cur.kind === 'fall' ? [0, 0] : f.root);
    const [sx, sy] = cur.kind === 'fall' || cur.kind === 'land' ? [0, 0] : f.shake;
    const px = x + rx;
    const targetY = Math.max(0, ry - 30);
    if (f.bw && cur.kind === 'action') {                         // impact frame: the whole view
      camX = px; camY = targetY;
      g.drawImage(img[f.bw].im, 0, 0);
      return;
    }
    for (const l of D.layers) drawLayer(img[l.src].im, -camX * l.parallax + sx * l.shake, camY * l.parallax + sy * l.shake);
    const cw = m.cell[0], ch = m.cell[1];
    const ax = V.anchorX + (px - camX) + sx;
    const ay = V.feetRow - (ry - camY) + sy;
    g.drawImage(img[m.sheet].im, cur.k * cw, 0, cw, ch, Math.round(ax - m.anchor[0]), Math.round(ay - m.anchor[1]), cw, ch);
    drawLayer(img[D.fringe.src].im, -camX + sx, camY + sy);
  }

  function follow(dt) {
    if (!cur) return;
    const f = D.moves[cur.id].frames[cur.k];
    const ry = fall ? fall.y : (cur.kind === 'fall' ? 0 : f.root[1]);
    const rx = fall || cur.kind === 'fall' ? 0 : f.root[0];
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
  const table = document.getElementById('moves');
  const rows = {};
  for (const b of D.input.bindings) {
    const tr = document.createElement('tr');
    const m = D.moves[b.move];
    tr.innerHTML = `<td>${b.input}</td><td>${b.move}</td><td>${m ? m.title : ''}${b.release_into ? ' (release: ' + b.release_into + ')' : ''}</td>`;
    table.appendChild(tr);
    (rows[b.move] = rows[b.move] || []).push(tr);
  }
  const nowEl = document.getElementById('now');
  let lastShown = '';
  function hud() {
    for (const b of BUTTONS) chips[b].classList.toggle('on', isDown.has(b));
    const id = cur ? cur.id : '';
    const label = fall || (cur && (cur.kind === 'fall' || cur.kind === 'land')) ? 'falling' : id;
    if (label !== lastShown) {
      lastShown = label;
      nowEl.innerHTML = label === 'falling' ? 'Landing' : `${D.moves[id].title}<small>${D.moves[id].input}</small>`;
      for (const trs of Object.values(rows)) for (const tr of trs) tr.classList.remove('playing');
      for (const tr of rows[id] || []) tr.classList.add('playing');
    }
  }

  // ------------------------------------------------------------------ loop
  let last = 0;
  function frame(t) {
    const dt = Math.min(100, last ? t - last : 16);
    last = t;
    readButtons(t);
    for (const e of reader.update(t)) request(e.move, e.via);
    step(dt, t);
    follow(dt);
    draw();
    hud();
    requestAnimationFrame(frame);
  }

  Promise.all(srcs.map(load)).then(() => {
    document.getElementById('loading').remove();
    canvas.focus();
    requestAnimationFrame(frame);
  }).catch(err => { document.getElementById('loading').textContent = String(err); });

  canvas.addEventListener('pointerdown', () => canvas.focus());
  // read-only hooks for the browser test
  window.bibooGame = { started, current: () => cur && { id: cur.id, k: cur.k, kind: cur.kind }, x: () => x };
})();
