/* Level 3: nine maps, four unlocks, the locked door at the end of 3.9; laser beam numbers; energy gem drops.
 * Run: NODE_PATH=$(npm root -g) node web/tests/level3.test.js */
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
  const L3 = ['heavy_chop', 'crash', 'fire_beam', 'laser_beam'];
  const into3 = async () => { await ev('bibooGame.resetAll(); BibooProgress.completeLevel(1); BibooProgress.completeLevel(2); bibooGame.enterLevel(3)'); await wait(600); await ev('bibooGame.setEnemies([])'); await wait(200); };

  const L = await ev(`(() => { const l = BIBOO_LEVELS.levels[2]; return { n: l.maps.length, door: l.door, keyMap: l.keyMap, last: l.maps[l.maps.length - 1].id, finalFlag: !!l.maps[l.maps.length - 1].final,
    items: l.maps.map(m => m.crates.filter(c => c.item).map(c => c.item)), plain: l.maps.map(m => m.crates.filter(c => !c.item).length) }; })()`);
  check('level 3 has nine maps and 3.10 is gone', L.n === 9 && L.last === '3.9', L);
  check('level 3 ends at a locked door', L.door === 'key' && L.finalFlag, L);
  check('3.1 Heavy Overhead Chop, 3.3 Jumping Crash, 3.5 Fire Beam, 3.7 Laser Beam',
    JSON.stringify([L.items[0], L.items[2], L.items[4], L.items[6]]) === JSON.stringify([['heavy_chop'], ['crash'], ['fire_beam'], ['laser_beam']]), L.items);
  check('no other level 3 map has an unlock crate', [1, 3, 5, 7, 8].every(i => L.items[i].length === 0), L.items);
  const late = await ev(`(() => { const w = BIBOO_LEVELS.whereIs; return { eq: w.earthquake, mt: w.meteor }; })()`);
  check('Earthquake and Meteor Shower are still late-game (level 4)', parseInt(late.eq) === 4 && parseInt(late.mt) === 4, late);

  // laser beam: 5 energy and 15 damage per tick
  await into3();
  await ev("bibooGame.unlock('laser_beam'); bibooGame.enterLevel(3)"); await wait(500);
  await ev("bibooGame.setEnemies([['orc', 200, 3000]]); bibooGame.setMeters(50, 0, 0)"); await wait(400);
  const e0 = (await ev('bibooGame.meters()')).energy, h0 = (await ev('bibooGame.enemyHp()'))[0];
  await page.keyboard.down('KeyZ'); await page.keyboard.down('KeyQ'); await wait(900); await page.keyboard.up('KeyZ'); await page.keyboard.up('KeyQ'); await wait(300);
  const e1 = (await ev('bibooGame.meters()')).energy, h1 = (await ev('bibooGame.enemyHp()'))[0];
  const spent = e0 - e1, dealt = h0 - h1, ticks = Math.round(spent / 5);
  check('the laser beam spends energy in steps of 5 per tick', ticks >= 3 && Math.abs(spent - ticks * 5) < 0.6, { e0, e1 });
  const bs = await ev('bibooGame.beamStats()');
  check('the laser beam is set to 5 energy and 15 damage per tick', bs.cost.laser === 5 && bs.dmg.laser === 15, bs);
  check('the orc in its path took at least 15 per tick', dealt >= 15 * ticks, { dealt, ticks });

  // the door at the end of 3.9
  await ev('bibooGame.warp(8)'); await wait(400); await ev('bibooGame.setEnemies([])'); await wait(200);
  await ev('bibooGame.setX(376)'); await wait(700);
  let s = await S();
  check('the door is locked without every move of the level', s.screen === 'level' && !s.levelDone && s.level.id === '3.9', { screen: s.screen, id: s.level && s.level.id });
  await ev("Object.keys(BIBOO_LEVELS.whereIs).filter(i => BIBOO_LEVELS.whereIs[i].split('.')[0] === '3').forEach(i => bibooGame.unlock(i))"); await ev('bibooGame.setX(376)'); await wait(900);
  s = await S();
  check('with every move the door ends level 3', s.levelDone === true || s.screen !== 'level', { screen: s.screen, done: s.levelDone });

  // energy gems drop once the energy kick is unlocked
  await ev('bibooGame.resetAll(); bibooGame.enterLevel(1)'); await wait(400);
  const drops = async () => ev(`(() => { const kinds = []; for (let i = 0; i < 60; i++) { bibooGame.custom({ crates: [{ x: 300, fy: 0 }] }); bibooGame.smash(0); kinds.push(...bibooGame.gems().map(g => g.kind)); }
    for (let i = 0; i < 40; i++) { bibooGame.setEnemies([['goblin', 200, 3000]]); bibooGame.killFoe(0); kinds.push(...bibooGame.gems().map(g => g.kind)); } return kinds; })()`);
  let k0 = await drops();
  check('before the Energy Kick there are no energy gems', !k0.includes('energy') && !k0.includes('up_energy'), [...new Set(k0)]);
  await ev("bibooGame.unlock('energy_kick')");
  await ev('bibooGame.custom({})'); await wait(300);
  let k1 = await drops();
  check('with the Energy Kick unlocked, crates and enemies drop energy gems', k1.includes('energy'), [...new Set(k1)]);

  console.log(errors.length ? errors : '');
  check('no page errors', errors.length === 0, errors);
  const ok = results.filter(Boolean).length;
  console.log(ok === results.length ? `ALL PASSED ${ok}/${results.length}` : `SOME FAILED ${ok}/${results.length}`);
  await browser.close();
  process.exit(ok === results.length ? 0 : 1);
})();
