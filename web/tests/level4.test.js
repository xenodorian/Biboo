/* Level 4: nine maps, Meter Charge, Earthquake with the super meter and super gems, Meteor Shower, the key chest in 4.8 and the door at 4.9.
 * Run: NODE_PATH=$(npm root -g) node web/tests/level4.test.js */
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
  const results = [];
  const check = (name, ok, detail) => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  ' + JSON.stringify(detail)}`); };

  const L = await ev(`(() => { const l = BIBOO_LEVELS.levels[3]; return { n: l.maps.length, door: l.door, last: l.maps[l.maps.length - 1].id, chest: l.maps.map(m => !!m.chest),
    items: l.maps.map(m => m.crates.filter(c => c.item).map(c => c.item)) }; })()`);
  check('level 4 has nine maps and 4.10 is gone', L.n === 9 && L.last === '4.9', L);
  check('level 4 ends at a locked key door', L.door === 'key', L);
  check('4.1 Meter Charge, 4.4 Earthquake, 4.7 Meteor Shower', JSON.stringify([L.items[0], L.items[3], L.items[6]]) === JSON.stringify([['meter_charge'], ['earthquake'], ['meteor']]), L.items);
  check('no other level 4 map has an unlock crate', [1, 2, 4, 5, 7, 8].every(i => L.items[i].length === 0), L.items);
  check('the key chest is in 4.8 only', L.chest.map((c, i) => c ? i : -1).filter(i => i >= 0).join() === '7', L.chest);

  // the unlock list: every unlock sits in exactly one crate
  const all = await ev(`(() => { const ids = BibooProgress.UNLOCKS.map(u => u.id), cnt = {}; BIBOO_LEVELS.levels.forEach(l => l.maps.forEach(m => m.crates.forEach(c => { if (c.item) cnt[c.item] = (cnt[c.item] || 0) + 1; })));
    return { total: ids.length, missing: ids.filter(i => !cnt[i]), dup: Object.keys(cnt).filter(k => cnt[k] > 1) }; })()`);
  check('all 22 unlocks are in exactly one crate', all.total === 22 && all.missing.length === 0 && all.dup.length === 0, all);

  // meter charge: L1+R1 held only fills meters once Meter Charge is owned
  await ev('bibooGame.resetAll(); bibooGame.enterLevel(1)'); await wait(500);
  await ev("for (const id of ['push_kick', 'recover', 'energy_kick']) bibooGame.unlock(id); bibooGame.enterLevel(1)"); await wait(500);
  await ev('bibooGame.setEnemies([]); bibooGame.setMeters(10, 10, 0)'); await wait(500);
  await page.keyboard.down('KeyQ'); await page.keyboard.down('KeyW'); await wait(1800); await page.keyboard.up('KeyQ'); await page.keyboard.up('KeyW'); await wait(200);
  let m = await ev('bibooGame.meters()');
  check('holding L1+R1 does nothing before Meter Charge is unlocked', m.energy <= 10.01 && m.empower <= 10.01, m);
  await ev("bibooGame.unlock('meter_charge')"); await wait(200);
  await ev('bibooGame.setMeters(10, 10, 0)'); await wait(300);
  await page.keyboard.down('KeyQ'); await page.keyboard.down('KeyW'); await wait(1800); await page.keyboard.up('KeyQ'); await page.keyboard.up('KeyW'); await wait(200);
  m = await ev('bibooGame.meters()');
  check('with Meter Charge, holding L1+R1 fills the meters you own', m.energy > 10.5 && m.empower > 10.5, m);
  const rows = await ev("bibooGame.unlockLines('meter_charge')");
  check('its banner names the move and its input', rows.some(l => /Meter charge/i.test(l) && /L1\+R1/.test(l)), rows);

  // earthquake turns on the super meter (starting at 100) and super gems
  await ev('bibooGame.resetAll(); bibooGame.enterLevel(1)'); await wait(400);
  check('no super meter before Earthquake', await ev("!BibooProgress.meterOn('super')"), null);
  await ev("bibooGame.unlock('earthquake')");
  m = await ev('bibooGame.meters()');
  check('Earthquake unlocks the super meter at 100', (await ev("BibooProgress.meterOn('super')")) && m.super === 100 && (await ev('bibooGame.maxes()')).super === 100, m);
  const drops = () => ev(`(() => { const kinds = []; for (let i = 0; i < 80; i++) { bibooGame.custom({ crates: [{ x: 300, fy: 0 }] }); bibooGame.smash(0); kinds.push(...bibooGame.gems().map(g => g.kind)); }
    for (let i = 0; i < 60; i++) { bibooGame.setEnemies([['goblin', 200, 3000]]); bibooGame.killFoe(0); kinds.push(...bibooGame.gems().map(g => g.kind)); } return kinds; })()`);
  await ev('bibooGame.custom({})'); await wait(300);
  const k1 = await drops();
  check('with the super meter on, crates and enemies drop super gems', k1.includes('super'), [...new Set(k1)]);
  await ev('bibooGame.resetAll()'); await ev('bibooGame.custom({})'); await wait(300);
  const k0 = await drops();
  check('without it there are no super gems', !k0.includes('super'), [...new Set(k0)]);

  console.log(errors.length ? errors : '');
  check('no page errors', errors.length === 0, errors);
  const ok = results.filter(Boolean).length;
  console.log(ok === results.length ? `ALL PASSED ${ok}/${results.length}` : `SOME FAILED ${ok}/${results.length}`);
  await browser.close();
  process.exit(ok === results.length ? 0 : 1);
})();
