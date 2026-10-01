/* Walk the whole game in order: every golden crate gives exactly the unlock assigned to its map, nothing is randomized,
 * a golden crate exists only while its unlock is unowned, and it never gives loot or a substitute.
 * Run: NODE_PATH=$(npm root -g) node web/tests/unlock_walkthrough.test.js */
const path = require('path');
const { chromium } = require('playwright');

const PLAN = {
  '1.2': 'thrust', '1.3': 'push_kick', '1.4': 'upswing', '1.5': 'heavy_horizontal', '1.6': 'double_jump', '1.7': 'dash_thrust', '1.9': 'sky_dash',
  '2.1': 'recover', '2.2': 'taunt', '2.3': 'empower_beam', '2.4': 'energy_kick', '2.5': 'energy_dash', '2.6': 'energy_burst', '2.7': 'energy_wave', '2.8': 'cloud_beam',
  '3.1': 'heavy_chop', '3.3': 'crash', '3.5': 'fire_beam', '3.7': 'laser_beam',
  '4.1': 'chain', '4.3': 'chain_burst', '4.5': 'fly', '4.7': 'rainbow', '4.8': 'ultimate', '5.1': 'meter_charge', '5.4': 'earthquake', '5.7': 'meteor',
};

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  await page.goto('file://' + path.resolve(__dirname, '../index.html'));
  await page.waitForFunction(() => document.getElementById('btn-start') && window.bibooGame, null, { timeout: 20000 });
  const ev = j => page.evaluate(j), wait = ms => page.waitForTimeout(ms);
  const results = [];
  const check = (name, ok, detail) => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  ' + JSON.stringify(detail)}`); };
  const S = () => ev('bibooGame.state()');
  const owned = () => ev('BibooProgress.state.unlocked.slice()');

  // golden crates are NOT always the same crate index, so find them by the item the level data assigns
  async function enterMap(n, idx) {
    await ev('bibooGame.setEnemies([])'); await ev(`bibooGame.warp(${idx})`); await wait(350); await ev('bibooGame.setEnemies([])'); await wait(150);
  }
  await ev('bibooGame.resetAll()');
  for (let n = 1; n <= 5; n++) {
    await ev('bibooGame.goOverworld()'); await ev(`bibooGame.resetAll && 0; ${n > 1 ? `BibooProgress.completeLevel(${n - 1});` : ''} bibooGame.enterLevel(${n})`); await wait(700);
    const count = await ev('BIBOO_LEVELS.levels[' + (n - 1) + '].maps.length');
    for (let idx = 0; idx < count; idx++) {
      const id = `${n}.${idx + 1}`;
      await enterMap(n, idx);
      const want = PLAN[id] || null;
      const crates = (await S()).crates;
      const golden = crates.map((c, i) => ({ ...c, i })).filter(c => c.item);
      check(`${id}: ${want ? 'one golden crate holding ' + want : 'no golden crate'}`, want ? golden.length === 1 && golden[0].item === want : golden.length === 0, golden);
      const before = await owned();
      if (want) check(`${id}: ${want} is not owned before the crate is smashed`, !before.includes(want), before);
      if (want) {
        await ev(`bibooGame.smash(${golden[0].i})`); await wait(250);
        let pw = (await S()).powerups;
        const autoGot = (await owned()).filter(x => !before.includes(x));        // she was standing close enough that it was picked up at once
        check(`${id}: smashing it offers exactly ${want}`, (pw.length === 1 && pw[0].item === want && autoGot.length === 0) || (pw.length === 0 && autoGot.length === 1 && autoGot[0] === want), { pw, autoGot });
        if (pw.length) { await ev(`bibooGame.setFloor(${golden[0].fy})`); await ev(`bibooGame.setX(${Math.max(30, pw[0].x - 32)})`); await wait(500); }
        const after = await owned();
        const gained = after.filter(x => !before.includes(x));
        check(`${id}: picking it up unlocks only ${want}`, gained.length === 1 && gained[0] === want, gained);
        await enterMap(n, idx);
        check(`${id}: once ${want} is owned the golden crate is gone from the map`, (await S()).crates.every(c => !c.item), (await S()).crates);
      }
      // plain crates never hold an unlock
      const plain = crates.map((c, i) => ({ ...c, i })).filter(c => !c.item && !c.chest).slice(0, 3);
      for (const c of plain) await ev(`bibooGame.smash(${c.i})`);
      await wait(200);
      const noPw = (await S()).powerups.filter(u => u.item !== want).length === 0;
      check(`${id}: plain crates give no unlock`, noPw && (await owned()).length === before.length + (want ? 1 : 0), await owned());
    }
    await ev(`BibooProgress.completeLevel(${n})`);
  }
  check('all 27 unlocks were collected in order, and nothing else', (await owned()).length === 27, await owned());

  // everything is owned now: no golden crate is built in any map
  let present = [];
  for (const id of Object.keys(PLAN)) {
    const [n, m] = id.split('.').map(Number);
    await ev('bibooGame.goOverworld()'); await ev(`bibooGame.enterLevel(${n})`); await wait(300);
    await enterMap(n, m - 1);
    if ((await S()).crates.some(c => c.item)) present.push(id);
  }
  check('with every unlock owned, no map has a golden crate', present.length === 0, present);
  check('still exactly 27 unlocks', (await owned()).length === 27, await owned());
  check('no page errors', errors.length === 0, errors);
  console.log(`${results.filter(Boolean).length}/${results.length} passed`);
  await browser.close();
  process.exit(results.every(Boolean) ? 0 : 1);
})();
