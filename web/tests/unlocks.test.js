/* Every unlockable move fires when its unlock is owned and does nothing while it is locked.
 * Run: NODE_PATH=$(npm root -g) node web/tests/unlocks.test.js */
const path = require('path');
const { chromium } = require('playwright');

// unlock id, the move ids it should start, and the key presses ([keys held together] or {seq: [...steps]})
const CASES = [
  ['thrust', ['thrust'], [['ArrowRight', 'KeyV']]],
  ['upswing', ['upswing'], [['ArrowDown', 'KeyV']]],
  ['spin', ['spin_attack'], [['ArrowDown'], ['ArrowDown', 'KeyV']]],
  ['heavy_horizontal', ['heavy_horizontal'], null],
  ['dash_thrust', ['dash_thrust'], [['KeyC', 'KeyV']]],
  ['taunt', ['taunt'], [['KeyC', 'KeyZ']]],
  ['sky_dash', ['sky_dash'], [['ArrowDown'], ['KeyZ']]],
  ['heavy_chop', ['heavy'], [['ArrowUp'], ['KeyV']]],
  ['L1', ['push_kick'], [['KeyQ']]],
  ['L1', ['beam_laser'], [['KeyV', 'KeyQ']]],
  ['L2', ['energy_burst'], [['KeyE']]],
  ['L2', ['beam_cloud'], [['KeyV', 'KeyE']]],
  ['R2', ['energy_wave'], [['KeyR']]],
  ['R2', ['beam_fire'], [['KeyV', 'KeyR']]],
  ['R1', ['beam_plasma'], [['KeyV', 'KeyT']]],
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto('file://' + path.resolve(__dirname, '../index.html'));
  await page.waitForFunction(() => document.getElementById('btn-start') && window.bibooGame, null, { timeout: 20000 });
  const ev = js => page.evaluate(js), wait = ms => page.waitForTimeout(ms);
  const results = [];
  const check = (name, ok, detail) => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  ' + JSON.stringify(detail)}`); };
  const fresh = async () => {                                   // new game, empty map, full meters, nothing unlocked
    await ev('bibooGame.resetAll(); bibooGame.enterLevel(1)'); await wait(500);
    await ev('bibooGame.setEnemies([]); bibooGame.setMeters(100, 100, 100)'); await wait(800);
  };
  const play = async steps => {
    for (const keys of steps) {
      for (const k of keys) await page.keyboard.down(k);
      await wait(90);
      for (const k of keys) await page.keyboard.up(k);
      await wait(40);
    }
    await wait(700);
  };
  const played = async before => ev(`bibooGame.started.slice(${before}).map(m => m.id)`);

  for (const [id, moves, steps] of CASES) {
    if (!steps) continue;
    const label = `${id}: ${moves.join(', ')}`;
    // locked: nothing
    await fresh();
    let n = await ev('bibooGame.started.length');
    await play(steps);
    let got = await played(n);
    check(`${label} does nothing while locked`, !moves.some(m => got.includes(m)), got);
    // unlocked: fires
    await fresh();
    await ev(`bibooGame.unlock('${id}')`);
    await ev('bibooGame.enterLevel(1)'); await wait(500);
    await ev('bibooGame.setEnemies([]); bibooGame.setMeters(100, 100, 100)'); await wait(800);
    n = await ev('bibooGame.started.length');
    await play(steps);
    got = await played(n);
    check(`${label} fires once unlocked`, moves.every(m => got.includes(m)), got);
  }

  // heavy horizontal: Hold B and tap A
  await fresh(); await ev("bibooGame.unlock('heavy_horizontal'); bibooGame.enterLevel(1)"); await wait(500); await ev('bibooGame.setEnemies([])'); await wait(800);
  let n0 = await ev('bibooGame.started.length');
  await page.keyboard.down('KeyX'); await wait(150); await page.keyboard.down('KeyV'); await wait(60); await page.keyboard.up('KeyV'); await wait(700); await page.keyboard.up('KeyX'); await wait(300);
  check('heavy_horizontal (hold B, tap A) fires once unlocked', (await played(n0)).includes('heavy_horizontal'), await played(n0));

  // jumping crash (A in the air) and the energy dash, earthquake, meteor
  await fresh(); await ev("bibooGame.unlock('crash'); bibooGame.enterLevel(1)"); await wait(500); await ev('bibooGame.setEnemies([]); bibooGame.setMeters(100, 100, 100)'); await wait(800);
  n0 = await ev('bibooGame.started.length');
  await page.keyboard.down('KeyZ'); await wait(60); await page.keyboard.up('KeyZ'); await wait(260); await page.keyboard.down('KeyV'); await wait(60); await page.keyboard.up('KeyV'); await wait(1500);
  check('crash: A in the air plays jump_crash once unlocked', (await played(n0)).includes('jump_crash'), await played(n0));
  await fresh();
  n0 = await ev('bibooGame.started.length');
  await page.keyboard.down('KeyZ'); await wait(60); await page.keyboard.up('KeyZ'); await wait(260); await page.keyboard.down('KeyV'); await wait(60); await page.keyboard.up('KeyV'); await wait(1500);
  check('A in the air does nothing while crash is locked', !(await played(n0)).some(m => m === 'jump_crash' || m === 'slash'), await played(n0));

  await fresh(); await ev("bibooGame.unlock('earthquake'); bibooGame.enterLevel(1)"); await wait(500); await ev('bibooGame.setEnemies([]); bibooGame.setMeters(0, 0, 100)'); await wait(800);
  n0 = await ev('bibooGame.started.length');
  await play([['ArrowDown'], ['ArrowDown'], ['ArrowDown'], ['ArrowDown'], ['KeyV']]);
  check('earthquake plays with a full super meter', (await played(n0)).includes('earthquake'), await played(n0));
  await fresh(); await ev("bibooGame.unlock('meteor'); bibooGame.enterLevel(1)"); await wait(500); await ev('bibooGame.setEnemies([]); bibooGame.setMeters(0, 0, 100)'); await wait(800);
  n0 = await ev('bibooGame.started.length');
  await play([['ArrowUp'], ['ArrowUp'], ['ArrowUp'], ['ArrowUp'], ['KeyV']]);
  check('meteor shower plays with a full super meter', (await played(n0)).includes('meteor_shower'), await played(n0));

  // energy dash thrust: B then X+A (double tap forward variant is the old one)
  await fresh(); await ev("bibooGame.unlock('energy_dash'); bibooGame.enterLevel(1)"); await wait(500); await ev('bibooGame.setEnemies([]); bibooGame.setMeters(100, 100, 100)'); await wait(800);
  n0 = await ev('bibooGame.started.length');
  await play([['ArrowRight'], ['ArrowRight'], ['KeyC', 'KeyV']]);
  check('energy dash thrust plays', (await played(n0)).includes('energy_dash_thrust'), await played(n0));

  // recover needs R1 (hold W)
  await fresh(); await ev("bibooGame.unlock('R1'); bibooGame.enterLevel(1)"); await wait(500); await ev('bibooGame.setEnemies([]); bibooGame.setMeters(0, 100, 0); bibooGame.setHp(100)'); await wait(800);
  await page.keyboard.down('KeyW'); await wait(1500); await page.keyboard.up('KeyW');
  check('recover (hold W) heals once R1 is unlocked', (await ev('bibooGame.hp()')) > 100, await ev('bibooGame.hp()'));

  console.log(results.every(Boolean) ? 'ALL PASSED' : 'SOME FAILED', `${results.filter(Boolean).length}/${results.length}`);
  if (errors.length) console.log('page errors:', errors);
  await browser.close();
  process.exit(results.every(Boolean) && !errors.length ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
