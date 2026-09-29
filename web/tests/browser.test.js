// Drives web/index.html in headless Chromium with real key presses: every binding in
// game/input_map.json must start (or, for holds, loop) its move. Saves mid-move screenshots.
// Run: NODE_PATH=$(npm root -g) node web/tests/browser.test.js [screenshot dir]
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const K = { Up: 'ArrowUp', Down: 'ArrowDown', Left: 'ArrowLeft', Right: 'ArrowRight',
            A: 'KeyZ', B: 'KeyX', X: 'KeyC', Y: 'KeyV', L: 'KeyQ', R: 'KeyW' };
const shots = process.argv[2];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + path.resolve(__dirname, '../index.html'));
  await page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 20000 });
  await page.click('#view');

  const wait = ms => page.waitForTimeout(ms);
  const down = b => page.keyboard.down(K[b]);
  const up = b => page.keyboard.up(K[b]);
  const tap = async (b, len = 50) => { await down(b); await wait(len); await up(b); };
  const cur = () => page.evaluate(() => window.bibooGame.current());
  const startedCount = () => page.evaluate(() => window.bibooGame.started.length);
  const startedSince = n => page.evaluate(n => window.bibooGame.started.slice(n).map(s => s.id), n);
  const settle = async () => {                      // back to idle before the next case
    for (let i = 0; i < 80; i++) { const c = await cur(); if (c && c.id === 'idle') return; await wait(100); }
    throw new Error('never returned to idle');
  };
  const shot = async name => { if (shots) { fs.mkdirSync(shots, { recursive: true }); await page.locator('#view').screenshot({ path: path.join(shots, name + '.png') }); } };

  const results = [];
  const check = (name, ok, detail) => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  ' + detail}`); };

  // holds: the move loops while the button is down
  for (const [b, want] of [['Right', 'walk_right'], ['Left', 'walk_left'], ['Down', 'duck'], ['Up', 'charge'], ['B', 'block'], ['R', 'recover']]) {
    await settle();
    const n = await startedCount();
    await down(b); await wait(700);
    const c = await cur();
    await shot('hold_' + want);
    await up(b);
    await wait(50);
    const after = await startedSince(n);
    check(`hold ${b} -> ${want}`, c && c.id === want, `current ${JSON.stringify(c)}`);
    if (b === 'Up') check('releasing a charge starts nothing', after.length === 0, `started ${after}`);
  }

  // one-shot moves: [name, expected move, action]
  const seq = bs => async () => { for (const b of bs) { await tap(b, 40); await wait(110); } };
  const chord = (bs, hold = []) => async () => {
    for (const h of hold) await down(h);
    if (hold.length) await wait(120);
    for (const b of bs) await down(b);
    await wait(80);
    for (const b of bs) await up(b);
    for (const h of hold) await up(h);
  };
  const cases = [
    ['tap B -> parry', 'parry', async () => tap('B', 60)],
    ['Y -> jump', 'jump', async () => tap('Y')],
    ['X -> dash', 'dash', async () => tap('X')],
    ['A -> slash', 'slash', async () => tap('A')],
    ['L -> push_kick', 'push_kick', async () => tap('L')],
    ['tap Up, then A -> heavy', 'heavy', seq(['Up', 'A'])],
    ['hold Up + A -> heavy', 'heavy', async () => { await down('Up'); await wait(800); await tap('A'); await up('Up'); }],
    ['Right+A -> thrust', 'thrust', chord(['A'], ['Right'])],
    ['Down+A -> upswing', 'upswing', chord(['A'], ['Down'])],
    ['Left+A -> backstep_upswing', 'backstep_upswing', chord(['A'], ['Left'])],
    ['A+B -> energy_slash', 'energy_slash', chord(['A', 'B'])],
    ['hold B + tap A -> energy_slash', 'energy_slash', async () => { await down('B'); await wait(600); await tap('A'); await wait(60); await up('B'); }],
    ['B+L -> heavy_kick', 'heavy_kick', chord(['B', 'L'])],
    ['A+B+L -> energy_kick', 'energy_kick', chord(['A', 'B', 'L'])],
    ['A, B, L one after another -> energy_kick', 'energy_kick', seq(['A', 'B', 'L'])],
    ['L+R -> energy_burst', 'energy_burst', chord(['L', 'R'])],
    ['X+Y -> taunt', 'taunt', chord(['X', 'Y'])],
    ['X+A -> dash_thrust', 'dash_thrust', chord(['X', 'A'])],
    ['Y-A -> jump_crash', 'jump_crash', seq(['Y', 'A'])],
    ['Down-Y -> sky_dash', 'sky_dash', seq(['Down', 'Y'])],
    ['hold Down + Y -> sky_dash', 'sky_dash', async () => { await down('Down'); await wait(800); await tap('Y'); await up('Down'); }],
    ['Left-Right-A -> spin_attack', 'spin_attack', seq(['Left', 'Right', 'A'])],
    ['tap B, then X+A -> energy_dash_thrust', 'energy_dash_thrust', async () => { await tap('B', 50); await wait(80); await chord(['X', 'A'])(); }],
    ['hold B, then X+A -> energy_dash_thrust', 'energy_dash_thrust', async () => { await down('B'); await wait(600); await chord(['X', 'A'])(); await up('B'); }],
    ['Down-Right-A-B -> energy_wave', 'energy_wave', seq(['Down', 'Right', 'A', 'B'])],
    ['Down x4, A -> earthquake', 'earthquake', seq(['Down', 'Down', 'Down', 'Down', 'A'])],
    ['Up x4, A -> meteor_shower', 'meteor_shower', seq(['Up', 'Up', 'Up', 'Up', 'A'])],
  ];
  for (const [name, want, act] of cases) {
    await settle();
    const n = await startedCount();
    await act();
    let seen = false;
    for (let i = 0; i < 30 && !seen; i++) {
      const c = await cur();
      if (c && c.id === want) { seen = true; await wait(150); await shot(want); }
      else await wait(40);
    }
    const got = await startedSince(n);
    check(name, got.includes(want) && seen, `started ${JSON.stringify(got)}`);
  }
  // the heavy chop picks up from the charge pose: never its idle (plow) frame
  const firstHeavyFrame = async act => {
    await settle(); await act();
    for (let i = 0; i < 40; i++) { const c = await cur(); if (c && c.id === 'heavy') return c.k; await wait(10); }
    return null;
  };
  let k = await firstHeavyFrame(async () => { await down('Up'); await wait(800); await tap('A'); await up('Up'); });
  check('held charge + A starts heavy on the high pose (frame 4)', k === 3, `first frame index ${k}`);
  k = await firstHeavyFrame(seq(['Up', 'A']));
  check('tap Up, A starts heavy past the idle frame', k !== null && k >= 1, `first frame index ${k}`);
  await settle();
  check('no page errors', errors.length === 0, errors.join(' | '));
  await browser.close();
  const fail = results.filter(r => !r).length;
  console.log(`${results.length - fail}/${results.length} passed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
