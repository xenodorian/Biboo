/* Every attack named "energy" is press and hold to charge (energy drains, Max turns blue when full), fired on release.
 * Run: NODE_PATH=$(npm root -g) node web/tests/energy_charge.test.js */
const path = require('path');
const { chromium } = require('playwright');

// unlock id, move id, keys held together (energy dash thrust first needs Right, Right)
const MOVES = [
  ['energy_kick', 'energy_kick', ['KeyX', 'KeyQ'], []],
  ['energy_burst', 'energy_burst', ['Digit1'], []],
  ['energy_wave', 'energy_wave', ['Digit2'], []],
  ['energy_dash', 'energy_dash_thrust', ['KeyA', 'KeyZ'], ['ArrowRight', 'ArrowRight']],
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
  const fresh = async id => {
    await ev('bibooGame.resetAll(); bibooGame.enterLevel(1)'); await wait(400);
    await ev(`bibooGame.unlock('${id}'); bibooGame.enterLevel(1)`); await wait(500);
    await ev('bibooGame.setEnemies([]); bibooGame.setMeters(200, 0, 0)'); await wait(700);
  };
  const played = async n => ev(`bibooGame.started.slice(${n}).map(m => m.id)`);
  const tap = async k => { await page.keyboard.down(k); await wait(60); await page.keyboard.up(k); await wait(60); };

  for (const [unlock, move, keys, pre] of MOVES) {
    // a quick tap does nothing
    await fresh(unlock);
    await ev('bibooGame.setMeters(50, 0, 0)');
    let n = await ev('bibooGame.started.length');
    for (const k of pre) await tap(k);
    for (const k of keys) await page.keyboard.down(k);
    await wait(120);
    for (const k of keys) await page.keyboard.up(k);
    await wait(900);
    check(`${move}: a quick tap does not fire it`, !(await played(n)).includes(move), await played(n));

    // held: charging, energy drains, nothing fires yet
    await fresh(unlock);
    await ev('bibooGame.setMeters(50, 0, 0)');
    n = await ev('bibooGame.started.length');
    const e0 = (await ev('bibooGame.charging()')).energy;
    for (const k of pre) await tap(k);
    for (const k of keys) await page.keyboard.down(k);
    await wait(600);
    let c = await ev('bibooGame.charging()');
    check(`${move}: holding plays the charge pose and builds charge`, c.cur === 'charge' && c.chargeMs > 200, c);
    check(`${move}: the charge uses energy`, c.energy < e0, { e0, c });
    check(`${move}: it has not fired while held`, !(await played(n)).includes(move), await played(n));
    await wait(1000);
    c = await ev('bibooGame.charging()');
    check(`${move}: at full charge Max is blue`, c.full === true, c);
    for (const k of keys) await page.keyboard.up(k);
    await wait(150);
    check(`${move}: fires on release`, (await played(n)).includes(move), await played(n));
    await wait(1200);
  }

  // a partial charge fires weaker than a full one (kick: 30 at full)
  await fresh('energy_kick');
  await ev('bibooGame.setMeters(50, 0, 0)');
  for (const k of ['KeyX', 'KeyQ']) await page.keyboard.down(k);
  await wait(500);
  for (const k of ['KeyX', 'KeyQ']) await page.keyboard.up(k);
  await wait(120);
  const part = await ev('bibooGame.charging()');
  check('a half charge fires at reduced power', part.power > 0.5 && part.power < 1, part);
  await wait(1200);
  await fresh('energy_kick'); await ev('bibooGame.setMeters(50, 0, 0)');
  for (const k of ['KeyX', 'KeyQ']) await page.keyboard.down(k);
  await wait(1500);
  for (const k of ['KeyX', 'KeyQ']) await page.keyboard.up(k);
  await wait(120);
  const full = await ev('bibooGame.charging()');
  check('a full charge fires at full power', full.power === 1, full);
  await wait(1200);

  // no energy: holding does nothing
  await fresh('energy_kick'); await ev('bibooGame.setMeters(0, 0, 0)');
  let n = await ev('bibooGame.started.length');
  for (const k of ['KeyX', 'KeyQ']) await page.keyboard.down(k);
  await wait(1200);
  for (const k of ['KeyX', 'KeyQ']) await page.keyboard.up(k);
  await wait(600);
  check('with no energy a held charge never fires', !(await played(n)).includes('energy_kick'), await played(n));

  // the lunging thrust is not an energy attack: its charge pose costs no energy
  await fresh('thrust'); await ev('bibooGame.setMeters(50, 0, 0)');
  const before = (await ev('bibooGame.charging()')).energy;
  await page.keyboard.down('ArrowRight'); await page.keyboard.down('KeyZ'); await wait(1500);
  const mid = await ev('bibooGame.charging()');
  await page.keyboard.up('KeyZ'); await page.keyboard.up('ArrowRight'); await wait(600);
  check('the thrust charge pose does not drain energy', mid.energy === before, { before, mid });

  console.log(errors.length ? errors : '');
  check('no page errors', errors.length === 0, errors);
  const ok = results.filter(Boolean).length;
  console.log(ok === results.length ? `ALL PASSED ${ok}/${results.length}` : `SOME FAILED ${ok}/${results.length}`);
  await browser.close();
  process.exit(ok === results.length ? 0 : 1);
})();
