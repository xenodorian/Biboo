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
  // a fake controller behind the Gamepad API, driven by the gamepad checks below
  await page.addInitScript(() => {
    const pad = { id: 'Test pad', index: 0, connected: true, mapping: 'standard', timestamp: 0,
                  axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
    window.__pad = pad;
    navigator.getGamepads = () => [pad];
  });
  await page.goto('file://' + path.resolve(__dirname, '../index.html'));
  await page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 20000 });
  await page.waitForFunction(() => { const b = document.getElementById('btn-start'); return b && !b.disabled; }, null, { timeout: 20000 });
  await page.click('#btn-start');                               // the game waits on its start menu
  await page.click('#view');
  const E = () => page.evaluate(() => window.bibooGame.enemies());
  const e0 = await E();
  await page.waitForTimeout(1200);
  const e1 = await E();
  const ox = es => (es.find(e => e.type === 'orc') || {}).x;
  // enemies: both types spawn to her right and walk toward her
  console.log(`${e0.length === 2 && e0.every(e => e.x > 0) ? 'PASS' : 'FAIL'}  goblin and orc spawn to the right  ${JSON.stringify(e0)}`);
  const walkOk = ox(e1) < ox(e0) && e1.find(e => e.type === 'orc').face === -1;
  console.log(`${walkOk ? 'PASS' : 'FAIL'}  the orc walks toward her  ${ox(e0)} -> ${ox(e1)}`);
  const early = [e0.length === 2, walkOk];
  // enemies fight back now: clear the field for the move checks (combat checks place their own)
  await page.evaluate(() => { window.bibooGame.setRespawn(false); window.bibooGame.setEnemyHp(1); window.bibooGame.setEnemies([]); });   // 1 HP: one hit kills, as these checks expect

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
  for (const [b, want] of [['Right', 'walk_right'], ['Left', 'walk_right'], ['Down', 'duck'], ['Up', 'charge'], ['B', 'block'], ['R', 'recover']]) {
    await settle();
    const n = await startedCount();
    await down(b); await wait(700);
    const c = await cur();
    await shot('hold_' + want);
    const fc = await page.evaluate(() => window.bibooGame.facing());
    await up(b);
    await wait(50);
    const after = await startedSince(n);
    check(`hold ${b} -> ${want}`, c && c.id === want, `current ${JSON.stringify(c)}`);
    if (b === 'Left') check('Left turns her to face left', fc === -1, `facing ${fc}`);
    if (b === 'Right') check('Right faces her right', fc === 1, `facing ${fc}`);
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
    ['Left+A -> spin_attack', 'spin_attack', chord(['A'], ['Left'])],
    ['A+L -> beam_laser', 'beam_laser', chord(['A', 'L'])],
    ['A+R -> beam_plasma', 'beam_plasma', chord(['A', 'R'])],
    ['Left-Right-A -> beam_cloud', 'beam_cloud', seq(['Left', 'Right', 'A'])],
    ['A+B -> beam_fire', 'beam_fire', chord(['A', 'B'])],
    ['hold B + tap A -> beam_fire', 'beam_fire', async () => { await down('B'); await wait(600); await tap('A'); await wait(60); await up('B'); }],
    ['B+L -> heavy_kick', 'heavy_kick', chord(['B', 'L'])],
    ['A+B+L -> energy_kick', 'energy_kick', chord(['A', 'B', 'L'])],
    ['A, B, L one after another -> energy_kick', 'energy_kick', seq(['A', 'B', 'L'])],
    ['L+R -> energy_burst', 'energy_burst', chord(['L', 'R'])],
    ['X+Y -> taunt', 'taunt', chord(['X', 'Y'])],
    ['X+A -> dash_thrust', 'dash_thrust', chord(['X', 'A'])],
    ['Down-Y -> sky_dash', 'sky_dash', seq(['Down', 'Y'])],
    ['hold Down + Y -> sky_dash', 'sky_dash', async () => { await down('Down'); await wait(800); await tap('Y'); await up('Down'); }],
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
  // combat: an attack that touches an enemy kills it at once; a miss or a non-attack does not
  const kills = () => page.evaluate(() => window.bibooGame.kills());
  const fight = async (name, list, act, want) => {
    await settle();
    await page.evaluate(l => window.bibooGame.setEnemies(l), list);
    const n = await kills();
    await act();
    await wait(1200);
    const got = (await kills()) - n;
    const es = await E();
    await shot('fight_' + name.replace(/[^a-z0-9]+/gi, '_'));
    check(`${name}: ${want} kill(s)`, got === want, `kills ${got}, enemies ${JSON.stringify(es)}`);
    await page.evaluate(() => window.bibooGame.setEnemies([]));
  };
  await fight('A slash kills an orc in reach', [['orc', 100, 3000]], async () => tap('A'), 1);
  await fight('A slash kills a goblin in reach', [['goblin', 100, 3000]], async () => tap('A'), 1);
  await fight('L push kick kills an orc', [['orc', 85, 3000]], async () => tap('L'), 1);
  await fight('Up-A heavy kills a goblin', [['goblin', 100, 3000]], seq(['Up', 'A']), 1);
  await fight('energy wave kills a far orc', [['orc', 260, 3000]], seq(['Down', 'Right', 'A', 'B']), 1);
  await fight('energy burst kills both sides', [['orc', 80, 3000], ['goblin', -40, 3000]], chord(['L', 'R']), 2);
  await fight('Down+A upswing kills an orc in front', [['orc', 90, 3000]], chord(['A'], ['Down']), 1);
  await fight('Down+A upswing kills a goblin in front', [['goblin', 95, 3000]], chord(['A'], ['Down']), 1);
  const faceLeft = async () => { await tap('Left', 120); await wait(400); };
  await fight('facing left: slash kills an orc on her left', [['orc', -100, 3000]], async () => { await faceLeft(); await tap('A'); }, 1);
  await fight('facing left: slash does not hit an orc behind her', [['orc', 60, 3000]], async () => { await faceLeft(); await tap('A'); }, 0);
  await fight('Left+A spin attack kills enemies in front and behind', [['orc', 85, 3000], ['goblin', -85, 3000]], chord(['A'], ['Left']), 2);
  // beams: drawn from the blade tip in her facing direction; they kill what they touch, far ahead
  for (const [nm, act] of [['cloud', seq(['Left', 'Right', 'A'])], ['fire', chord(['A', 'B'])], ['laser', chord(['A', 'L'])], ['plasma', chord(['A', 'R'])]])
    await fight(`${nm} beam kills an orc 240 px ahead`, [['orc', 240, 3000]], act, 1);
  await fight('laser beam misses an orc 620 px ahead', [['orc', 620, 3000]], chord(['A', 'L']), 0);
  await fight('facing left: plasma beam kills an orc 240 px on her left', [['orc', -240, 3000]], async () => { await faceLeft(); await chord(['A', 'R'])(); }, 1);
  await fight('facing left: plasma beam does not hit an orc behind her', [['orc', 200, 3000]], async () => { await faceLeft(); await chord(['A', 'R'])(); }, 0);
  {
    await settle();
    await chord(['A', 'L'])(); await wait(330);
    const b = await page.evaluate(() => window.bibooGame.beam());
    await shot('beam_laser');
    check('the laser beam is drawn while she fires it', !!b && b.kind === 'laser' && b.face === 1 && b.len > 100, JSON.stringify(b));
    await wait(1000);
    check('the beam is gone once the move ends', (await page.evaluate(() => window.bibooGame.beam())) === null, 'still drawn');
  }
  await fight('slash misses a far orc', [['orc', 400, 3000]], async () => tap('A'), 0);
  await fight('taunt kills nothing', [['orc', 95, 3000]], chord(['X', 'Y']), 0);
  await fight('parry kills nothing', [['orc', 95, 3000]], async () => tap('B', 60), 0);
  // dash attacks hit an enemy right in her path; the plain dash stops at an enemy instead of passing it
  for (const dx of [70, 110, 150]) await fight(`X+A dash thrust kills an orc ${dx} px ahead`, [['orc', dx, 3000]], chord(['X', 'A']), 1);
  await fight('B-X+A energy dash thrust kills a goblin 90 px ahead', [['goblin', 90, 3000]],
              async () => { await tap('B', 50); await wait(80); await chord(['X', 'A'])(); }, 1);
  {
    await settle();
    await page.evaluate(() => window.bibooGame.setEnemies([['orc', 150, 5000]]));
    const x0 = await page.evaluate(() => window.bibooGame.x());
    await tap('X'); await wait(700);
    const x1 = await page.evaluate(() => window.bibooGame.x());
    const o = (await E())[0];
    check('plain dash stops in front of the orc', x1 - x0 < 92 && x1 < o.x && o.state !== 'dying', `moved ${x1 - x0}, orc ${JSON.stringify(o)}`);
    await page.evaluate(() => window.bibooGame.setEnemies([]));
    await settle();
    const x2 = await page.evaluate(() => window.bibooGame.x());
    await tap('X'); await wait(700);
    const x3 = await page.evaluate(() => window.bibooGame.x());
    check('plain dash with nothing ahead still covers 92 px', Math.abs(x3 - x2 - 92) < 1, `moved ${x3 - x2}`);
  }

  // the crash: A in the air starts it at her current height, with no second jump
  const airCase = async (name, act, minY) => {
    await settle();
    const n = await startedCount();
    const y = await act();
    let c = null;
    for (let i = 0; i < 40; i++) { c = await cur(); if (c && c.id === 'jump_crash') break; await wait(10); }
    const got = await startedSince(n);
    const crashes = got.filter(g => g === 'jump_crash').length;
    const jumps = got.filter(g => g === 'jump').length;
    check(name, c && c.id === 'jump_crash' && c.air && crashes === 1 && jumps <= 1 && c.y >= minY && (y === null || (c.y <= y + 1 && y - c.y < 100)),   // she keeps falling while A goes down (~1 px/ms)
          `current ${JSON.stringify(c)}, height at press ${y}, started ${JSON.stringify(got)}`);
  };
  await airCase('jump, then A near the top -> crash from that height', async () => {
    await tap('Y'); await wait(300); const c = await cur(); await tap('A'); return c.y; }, 60);
  await airCase('jump, then A right away -> crash once off the ground', async () => { await tap('Y'); await wait(20); await tap('A'); return null; }, 1);
  await airCase('sky dash, then A while falling -> crash from the fall', async () => {
    await seq(['Down', 'Y'])(); await wait(700); const c = await cur(); await tap('A'); return c.y; }, 60);
  {
    await settle();
    const n = await startedCount();
    await tap('A'); await wait(100);
    check('A on the ground is still the slash', (await startedSince(n))[0] === 'slash', JSON.stringify(await startedSince(n)));
  }
  await fight('air crash kills an orc below', [['orc', 110, 5000]], async () => { await tap('Y'); await wait(300); await tap('A'); }, 1);

  // enemy attacks on her: hit (red, knocked back, stunned), block (white, small slide), parry
  const combat = () => page.evaluate(() => window.bibooGame.combat());
  const watch = async (ms, fn) => { const seen = []; const end = Date.now() + ms; while (Date.now() < end) { seen.push(await fn()); await wait(20); } return seen; };
  {
    await settle();
    const c0 = await combat();
    const x0 = await page.evaluate(() => window.bibooGame.x());
    await page.evaluate(() => { window.bibooGame.setEnemies([['orc', 75, 60000]]); window.bibooGame.attack(0, 'attack'); });
    const seen = await watch(900, async () => ({ c: await combat(), cur: await cur(), e: (await E())[0],
                                                 me: await page.evaluate(() => window.bibooGame.herBox()) }));
    const stunned = seen.filter(v => v.c.stun);
    const x1 = await page.evaluate(() => window.bibooGame.x());
    check('orc attack hits her: red, stunned in the raised sword pose',
          stunned.length > 0 && stunned.some(v => v.c.tint === '#ff2b2b') && stunned.every(v => v.cur.id === 'heavy' && v.cur.kind === 'stun'),
          JSON.stringify(seen.filter((v, i) => i % 5 === 0)));
    check('the orc hit takes 30 HP off Max', (await page.evaluate(() => window.bibooGame.hp())) === 170, `hp ${await page.evaluate(() => window.bibooGame.hp())}`);
    check('the hit knocks her back about 64 px', x0 - x1 > 55 && x0 - x1 < 72, `moved ${x1 - x0}`);
    await settle();
    check('she recovers to idle after the stun', !(await combat()).stun && (await combat()).hits === c0.hits + 1, JSON.stringify(await combat()));
  }
  // ducking: her hurtbox drops under the orc's swing; standing, the swing hits
  {
    await settle();
    const stand = await page.evaluate(() => window.bibooGame.herBox());
    await down('Down'); await wait(500);
    const duck = await page.evaluate(() => window.bibooGame.herBox());
    const c0 = await combat();
    await page.evaluate(() => { window.bibooGame.setEnemies([['orc', 75, 60000]]); window.bibooGame.attack(0, 'attack'); });
    await wait(900);
    const c1 = await combat();
    await up('Down');
    const tops = await page.evaluate(() => [window.BIBOO.moves.idle.frames[0].top, window.BIBOO.moves.duck.frames[2].top]);
    check(`hurtbox: standing top at her head (${tops[0]} px), ducking 5 px under her head (${tops[1] - 5} px)`,
          stand[3] - stand[1] === tops[0] && duck[3] - duck[1] === tops[1] - 5, JSON.stringify({ stand, duck, tops }));
    check('ducking: the orc swing passes over her', c1.hits === c0.hits && !c1.stun, JSON.stringify(c1));
    await page.evaluate(() => window.bibooGame.setEnemies([]));
  }
  {
    await settle();
    await page.evaluate(() => window.bibooGame.setEnemies([]));
    await down('B'); await wait(300);
    const c0 = await combat();
    const x0 = await page.evaluate(() => window.bibooGame.x());
    await page.evaluate(() => { window.bibooGame.setEnemies([['orc', 75, 60000]]); window.bibooGame.attack(0, 'attack'); });
    const seen = await watch(700, combat);
    const x1 = await page.evaluate(() => window.bibooGame.x());
    const c1 = await combat(); const c = await cur();
    await up('B');
    check('blocking: white flash, no stun, still blocking', c1.blocks === c0.blocks + 1 && seen.some(v => v.tint === '#ffffff') && seen.every(v => !v.stun) && c.id === 'block',
          JSON.stringify({ c1, c }));
    check('blocking: slides back only a little', x0 - x1 > 4 && x0 - x1 <= 10, `moved ${x1 - x0}`);
  }
  {
    await settle();
    await page.evaluate(() => window.bibooGame.setEnemies([['orc', 75, 60000]]));
    const c0 = await combat();
    const o0 = (await E())[0];
    await page.evaluate(() => window.bibooGame.attack(0, 'attack'));
    await wait(90);                     // the swing lands on the orc's third frame (200 ms in)
    await tap('B', 40);
    const seen = await watch(500, async () => (await E())[0]);
    const c1 = await combat();
    const o1 = (await E())[0];
    check('parry just before the swing lands: the orc turns white and is stunned',
          c1.parries === c0.parries + 1 && seen.some(e => e.state === 'stunned' && e.tint === '#ffffff'), JSON.stringify(seen.slice(0, 6)));
    check('the parried orc is pushed back about 40 px', o1.x - o0.x > 30 && o1.x - o0.x < 50, `moved ${o1.x - o0.x}`);
    check('a parry leaves her unhurt', c1.hits === c0.hits && !c1.stun, JSON.stringify(c1));
    await wait(600);
    check('the orc recovers after the push', (await E())[0].state !== 'stunned', JSON.stringify(await E()));
  }
  // parry as the swing lands: the first hitting frame (200 ms in) still counts until the hit lands
  // 90 ms later; after that it is too late
  for (const [at, ok] of [[215, true], [420, false]]) {
    await settle();
    await page.evaluate(() => window.bibooGame.setEnemies([['orc', 75, 60000]]));
    const c0 = await combat();
    await page.evaluate(() => window.bibooGame.attack(0, 'attack'));
    await wait(at);
    await tap('B', 40);
    await wait(600);
    const c1 = await combat();
    check(`parry ${at} ms into the orc swing: ${ok ? 'parried' : 'too late, hit'}`,
          ok ? c1.parries === c0.parries + 1 && c1.hits === c0.hits : c1.hits === c0.hits + 1 && c1.parries === c0.parries, JSON.stringify(c1));
    await settle();
  }
  {
    await settle();
    await page.evaluate(() => window.bibooGame.setEnemies([['orc', 75, 60000]]));
    const c0 = await combat();
    await tap('B', 40); await wait(400);   // parry long before the swing: too early
    await page.evaluate(() => window.bibooGame.attack(0, 'attack'));
    await wait(700);
    const c1 = await combat();
    check('a parry too early does not stop the hit', c1.parries === c0.parries && c1.hits === c0.hits + 1, JSON.stringify(c1));
  }
  await page.evaluate(() => window.bibooGame.setEnemies([]));

  // heavy: the impact frame and shake only after a full 1 s charge; crash: only from over two body lengths
  const heavyRun = async act => {
    await settle(); await act();
    let info = null; const ks = new Set();
    for (let i = 0; i < 150; i++) {
      const h = await page.evaluate(() => window.bibooGame.heavy());
      const c = await cur();
      if (h) { info = info || h; ks.add(c.k); } else if (info) break;
      await wait(8);
    }
    return { info, ks: [...ks] };
  };
  const BW_K = await page.evaluate(() => window.BIBOO.moves.heavy.frames.findIndex(f => f.bw));
  let r = await heavyRun(async () => { await down('Up'); await wait(500); await tap('A'); await up('Up'); });
  check('heavy after a 0.5 s charge: no impact frame', r.info && r.info.lite && !r.ks.includes(BW_K), JSON.stringify(r));
  r = await heavyRun(async () => { await down('Up'); await wait(1300); await tap('A'); await up('Up'); });
  check('heavy after a 1.3 s charge: impact frame shown', r.info && !r.info.lite && r.ks.includes(BW_K), JSON.stringify(r));
  r = await heavyRun(seq(['Up', 'A']));
  check('tap Up, A heavy (no charge): no impact frame', r.info && r.info.lite && !r.ks.includes(BW_K), JSON.stringify(r));
  r = await heavyRun(async () => { await tap('Y'); await wait(300); await tap('A'); });
  check('crash from a jump (two body lengths or less): no impact frame or shake', r.info && r.info.id === 'jump_crash' && r.info.lite && r.info.height <= 164, JSON.stringify(r));
  r = await heavyRun(async () => { await seq(['Down', 'Y'])(); await wait(700); await tap('A'); });
  check('crash from high after the sky dash: impact frame and shake', r.info && r.info.id === 'jump_crash' && !r.info.lite && r.info.height > 164, JSON.stringify(r));

  // walking is blocked by enemies, both ways
  {
    await settle();
    await page.evaluate(() => window.bibooGame.setEnemies([['orc', 150, 60000]]));
    await down('Right'); await wait(5000);
    const px = await page.evaluate(() => window.bibooGame.playerX());
    await up('Right');
    const o = (await E())[0];
    const OH = await page.evaluate(() => window.BIBOO.enemies.orc.frames[0].hurt[2]);
    check('walking right stops at the orc', px + 60 <= o.x - OH + 1 && px + 60 >= o.x - OH - 30, `her front ${px + 60}, orc left edge ${o.x - OH}`);
    await settle();
    const p0 = await page.evaluate(() => window.bibooGame.playerX());
    await page.evaluate(() => window.bibooGame.setEnemies([['orc', -110, 60000]]));
    await down('Left'); await wait(4000);
    const p1 = await page.evaluate(() => window.bibooGame.playerX());
    await up('Left');
    const o2 = (await E())[0];
    const OH2 = await page.evaluate(() => window.BIBOO.enemies.orc.frames[0].hurt[2]);
    check('walking left stops at an orc on her left', p1 - 60 >= o2.x + OH2 - 1 && p1 - 60 <= o2.x + OH2 + 30 && p1 < p0, `her front ${p1 - 60}, orc right edge ${o2.x + OH2}`);
    await page.evaluate(() => window.bibooGame.setEnemies([]));
  }

  // controller: a held d-pad direction still counts when a face button is pressed
  for (const [d, bt, want] of [[15, 0, 'thrust'], [13, 0, 'upswing'], [14, 0, 'spin_attack'], [13, 3, 'sky_dash']]) {
    await settle();
    const n = await startedCount();
    await page.evaluate(d => { window.__pad.buttons[d] = { pressed: true, value: 1 }; }, d); await wait(300);
    await page.evaluate(b => { window.__pad.buttons[b] = { pressed: true, value: 1 }; }, bt); await wait(80);
    await page.evaluate(b => { window.__pad.buttons[b] = { pressed: false, value: 0 }; }, bt); await wait(150);
    await page.evaluate(d => { window.__pad.buttons[d] = { pressed: false, value: 0 }; }, d);
    const got = await startedSince(n);
    check(`pad: hold d-pad ${d}, press button ${bt} -> ${want}`, got.includes(want), JSON.stringify(got));
  }
  // a controller that sends its d-pad as arrow keys with no e.code (as Android can) still works
  {
    await settle();
    const n = await startedCount();
    await page.evaluate(() => dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', keyCode: 39 }))); await wait(300);
    await page.evaluate(() => { window.__pad.buttons[0] = { pressed: true, value: 1 }; }); await wait(80);
    await page.evaluate(() => { window.__pad.buttons[0] = { pressed: false, value: 0 }; }); await wait(150);
    await page.evaluate(() => dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowRight', keyCode: 39 })));
    const got = await startedSince(n);
    check('d-pad as arrow keys (no code) + pad A -> thrust', got.includes('thrust'), JSON.stringify(got));
  }
  {
    await page.check('#monitor-on');
    await tap('Right'); await wait(100);
    const mon = await page.textContent('#monitor');
    check('input monitor lists raw key events', mon.includes('key down') && mon.includes('ArrowRight'), mon.slice(0, 200));
    await page.uncheck('#monitor-on');
  }

  // gamepad: face buttons, d-pad and stick drive the same reader as the keyboard
  const padSet = (fn) => page.evaluate(fn);
  const padButton = async (i, ms = 60) => {
    await page.evaluate(i => { window.__pad.buttons[i] = { pressed: true, value: 1 }; }, i); await wait(ms);
    await page.evaluate(i => { window.__pad.buttons[i] = { pressed: false, value: 0 }; }, i);
  };
  const padCase = async (name, want, act) => {
    await settle();
    const n = await startedCount();
    const c = await act();
    const got = await startedSince(n);
    check(name, (c && c.id === want) || got.includes(want), `current ${JSON.stringify(c)}, started ${JSON.stringify(got)}`);
  };
  check('controller name shown', (await page.textContent('#padstatus')).includes('Test pad'), await page.textContent('#padstatus'));
  await padCase('pad button 0 (A) -> slash', 'slash', async () => { await padButton(0); await wait(60); return cur(); });
  await padCase('pad button 3 (Y) -> jump', 'jump', async () => { await padButton(3); await wait(60); return cur(); });
  await padCase('pad d-pad right held -> walk_right', 'walk_right', async () => {
    await page.evaluate(() => { window.__pad.buttons[15] = { pressed: true, value: 1 }; }); await wait(400);
    const c = await cur(); await page.evaluate(() => { window.__pad.buttons[15] = { pressed: false, value: 0 }; }); return c; });
  await padCase('pad left stick left -> walk_right (facing left)', 'walk_right', async () => {
    await page.evaluate(() => { window.__pad.axes[0] = -1; }); await wait(400);
    const c = await cur(); await page.evaluate(() => { window.__pad.axes[0] = 0; }); return c; });
  await padCase('non-standard pad: hat axis 7 down -> duck', 'duck', async () => {
    await page.evaluate(() => { window.__pad.mapping = ''; window.__pad.axes = [0, 0, 0, 0, 0, 0, 0, 1]; }); await wait(400);
    const c = await cur(); await page.evaluate(() => { window.__pad.mapping = 'standard'; window.__pad.axes = [0, 0, 0, 0]; }); return c; });

  // goblin: each attack plays its exact frames and returns to idle; the dive roll carries it forward
  const gob = async (anim) => {
    await settle();
    await page.evaluate(() => window.bibooGame.setEnemies([['goblin', 300, 60000]]));
    const x0 = (await E())[0].x;
    await page.evaluate(a => window.bibooGame.attack(0, a), anim);
    let e;
    for (let i = 0; i < 80; i++) { await wait(50); e = (await E())[0]; if (e.anim === 'idle') break; }
    return { e, moved: e.x - x0 };
  };
  for (const a of ['slash', 'dive', 'combo']) {
    const { e, moved } = await gob(a);
    check(`goblin ${a} ends in idle`, e.anim === 'idle' && e.state === 'idle', JSON.stringify(e));
    if (a === 'dive') check('goblin dive roll carries it 92 px toward her (frame 27 to 35)', Math.abs(moved + 92) <= 2, `moved ${moved}`);
  }
  const frames = await page.evaluate(() => Object.fromEntries(Object.entries(window.BIBOO.enemies.goblin.anims)
    .map(([n, a]) => [n, a.frames.map(i => window.BIBOO.enemies.goblin.frames[i].src)])));
  const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
  check('goblin frames: slash 18-27, dive 27-35, combo 35-50',
        JSON.stringify([frames.slash, frames.dive, frames.combo]) === JSON.stringify([range(18, 27), range(27, 35), range(35, 50)]),
        JSON.stringify(frames));
  await page.evaluate(() => window.bibooGame.setEnemies([]));
  results.push(...early);
  await settle();
  // HP and damage: real enemy HP from here on
  await page.evaluate(() => { window.bibooGame.setEnemyHp(null); window.bibooGame.setRespawn(false); });
  {
    const hpOf = () => page.evaluate(() => window.bibooGame.enemyHp());
    const texts = () => page.evaluate(() => window.bibooGame.floaters());
    await settle();
    await page.evaluate(() => window.bibooGame.setEnemies([['goblin', 100, 6000], ['orc', 900, 60000]]));
    check('enemies start with their HP (goblin 60, orc 200)', JSON.stringify(await hpOf()) === '[60,200]', JSON.stringify(await hpOf()));
    await tap('A'); await wait(300);
    check('a slash takes 15 HP off a goblin, shown as red -15', (await hpOf())[0] === 45 && (await texts()).includes('-15'), `${await hpOf()} ${await texts()}`);
    await wait(800);
    check('one slash hurts an enemy only once', (await hpOf())[0] === 45, `${await hpOf()}`);
    await settle();
    await page.evaluate(() => window.bibooGame.setEnemies([['orc', 100, 6000]]));
    await down('Up'); await wait(1300); await tap('A'); await up('Up'); await wait(1200);
    check('a full heavy chop takes 90 HP off an orc', (await hpOf())[0] === 110, `${await hpOf()}`);
    await settle();
    await page.evaluate(() => window.bibooGame.setEnemies([['orc', 100, 6000]]));
    await down('Up'); await wait(300); await tap('A'); await up('Up'); await wait(1200);
    check('a short heavy chop takes 35 HP off an orc', (await hpOf())[0] === 165, `${await hpOf()}`);
    await settle();
    await page.evaluate(() => window.bibooGame.setEnemies([['orc', 240, 6000]]));
    await chord(['A', 'L'])(); await wait(700);
    const lh = (await hpOf())[0];
    check('the laser beam hurts on several ticks (12 each)', lh <= 176 && (200 - lh) % 12 === 0, `${lh}`);
    await settle();
    await page.evaluate(() => { window.bibooGame.setEnemies([]); window.bibooGame.setHp(100); });
    await down('R'); await wait(1700);
    const rh = await page.evaluate(() => window.bibooGame.hp()); const rt = await texts(); await up('R');
    check('kneeling to recover gives HP back with green +6 numbers', rh >= 118 && rt.includes('+6'), `hp ${rh} ${rt}`);
    await settle();
    await page.evaluate(() => { window.bibooGame.setEnemies([['orc', 75, 60000]]); window.bibooGame.setHp(20); window.bibooGame.attack(0, 'attack'); });
    await wait(900);
    const ko = await page.evaluate(() => window.bibooGame.hp());
    await wait(1800);
    const back = await page.evaluate(() => window.bibooGame.hp());
    check('at 0 HP she is knocked out, then back at full HP', ko === 0 && back === 200, `ko ${ko}, later ${back}`);
    await page.evaluate(() => { window.bibooGame.setEnemyHp(1); window.bibooGame.setEnemies([]); });
    await settle();
  }
  check('no page errors', errors.length === 0, errors.join(' | '));
  await browser.close();
  const fail = results.filter(r => !r).length;
  console.log(`${results.length - fail}/${results.length} passed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
