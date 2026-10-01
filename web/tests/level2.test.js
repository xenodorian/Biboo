/* Level 2: nine maps, one unlock per map in a fixed order, and a locked door at the end of 2.9.
 * Run: NODE_PATH=$(npm root -g) node web/tests/level2.test.js */
const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto('file://' + path.resolve(__dirname, '../index.html'));
  await page.waitForFunction(() => document.getElementById('btn-start') && window.bibooGame, null, { timeout: 20000 });
  const ev = js => page.evaluate(js), wait = ms => page.waitForTimeout(ms);
  const S = () => ev('bibooGame.state()');
  const results = [];
  const check = (name, ok, detail) => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  ' + JSON.stringify(detail)}`); };
  const ORDER = ['recover', 'taunt', 'empower_beam', 'energy_kick', 'energy_dash', 'energy_burst', 'energy_wave', 'cloud_beam'];

  const L = await ev(`(() => { const l = BIBOO_LEVELS.levels[1]; return { n: l.maps.length, door: l.door, last: l.maps[l.maps.length - 1].id, finalFlag: !!l.maps[l.maps.length - 1].final,
    items: l.maps.map(m => m.crates.filter(c => c.item).map(c => c.item)) }; })()`);
  check('level 2 has nine maps and 2.10 is gone', L.n === 9 && L.last === '2.9', L);
  check('level 2 ends at a locked key door', L.door === 'key' && L.finalFlag, L);
  check('2.1 to 2.8 hold Recover, Taunt, Empowerment Beam, Energy Kick, Energy Dash Thrust, Energy Burst, Energy Wave, Cloud Beam in that order',
    JSON.stringify(L.items.slice(0, 8)) === JSON.stringify(ORDER.map(i => [i])), L.items);
  check('2.9 has no unlock crate', L.items[8].length === 0, L.items[8]);

  // what the first unlocks switch on
  await ev('bibooGame.resetAll()');
  check('nothing on before level 2', await ev("!BibooProgress.meterOn('empower') && !BibooProgress.meterOn('energy')"), null);
  await ev("bibooGame.unlock('recover')");
  check('Recover turns on the Empowerment meter (and empower gems) but not energy', await ev("BibooProgress.meterOn('empower') && !BibooProgress.meterOn('energy') && BibooProgress.hasMove('recover') && BibooProgress.buttonOn('R1')"), null);
  check('it does not give the Empowerment Beam', await ev("!BibooProgress.hasMove('beam_plasma')"), null);
  await ev("bibooGame.unlock('energy_kick')");
  check('Energy Kick turns on the energy meter', await ev("BibooProgress.meterOn('energy') && BibooProgress.hasMove('energy_kick')"), null);

  // the door at the end of 2.9
  await ev('bibooGame.resetAll(); BibooProgress.completeLevel(1); bibooGame.goOverworld(); bibooGame.enterLevel(2)'); await wait(600);
  await ev('bibooGame.warp(8)'); await wait(400); await ev('bibooGame.setEnemies([])'); await wait(200);
  await ev('bibooGame.setX(376)'); await wait(700);
  let s = await S();
  check('the door is locked without the key', s.screen === 'level' && !s.levelDone && s.level.id === '2.9', { screen: s.screen, id: s.level && s.level.id });
  await ev('BibooProgress.addKey(2)'); await ev('bibooGame.setX(376)'); await wait(900);
  s = await S();
  check('with the key the door ends level 2', s.levelDone === true || s.screen !== 'level', { screen: s.screen, done: s.levelDone });

  // level 1's key does not open level 2
  await ev('bibooGame.resetAll(); BibooProgress.completeLevel(1); BibooProgress.addKey(1); bibooGame.enterLevel(2)'); await wait(600);
  check('the level 1 key does not open level 2', (await ev('bibooGame.doorLocked()')) === true, null);

  console.log(errors.length ? errors : '');
  check('no page errors', errors.length === 0, errors);
  const ok = results.filter(Boolean).length;
  console.log(ok === results.length ? `ALL PASSED ${ok}/${results.length}` : `SOME FAILED ${ok}/${results.length}`);
  await browser.close();
  process.exit(ok === results.length ? 0 : 1);
})();
