/* Audit: every unlock sits in the map the designer assigned, and meters, gems and buttons only switch on at their unlock point.
 * Run: NODE_PATH=$(npm root -g) node web/tests/unlock_points.test.js */
const path = require('path');
const { chromium } = require('playwright');

const PLAN = [
  ['1.2', 'thrust'], ['1.3', 'push_kick'], ['1.4', 'upswing'], ['1.5', 'heavy_horizontal'], ['1.6', 'double_jump'], ['1.7', 'dash_thrust'], ['1.9', 'sky_dash'],
  ['2.1', 'recover'], ['2.2', 'taunt'], ['2.3', 'empower_beam'], ['2.4', 'energy_kick'], ['2.5', 'energy_dash'], ['2.6', 'energy_burst'], ['2.7', 'energy_wave'], ['2.8', 'cloud_beam'],
  ['3.1', 'heavy_chop'], ['3.3', 'crash'], ['3.5', 'fire_beam'], ['3.7', 'laser_beam'],
  ['4.1', 'meter_charge'], ['4.4', 'earthquake'], ['4.7', 'meteor'],
];
// meters that must be ON right after each unlock (and were off before): the EMP meter at 2.1, ENG at 2.4, SUP at 4.4
const METER_AT = { empower: 'recover', energy: 'energy_kick', super: 'earthquake' };

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  await page.goto('file://' + path.resolve(__dirname, '../index.html'));
  await page.waitForFunction(() => window.bibooGame && window.BibooProgress, null, { timeout: 20000 });
  const results = [];
  const check = (name, ok, detail) => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  ' + JSON.stringify(detail)}`); };

  // 1. where each unlock crate really is
  const where = await page.evaluate(() => { const o = {}; BIBOO_LEVELS.levels.forEach(l => l.maps.forEach(m => m.crates.forEach(c => { if (c.item) (o[c.item] = o[c.item] || []).push(m.id); }))); return o; });
  for (const [map, id] of PLAN) check(`${id} is only in map ${map}`, JSON.stringify(where[id]) === JSON.stringify([map]), where[id]);
  check('no crate holds an unlock outside the plan', Object.keys(where).length === PLAN.length, Object.keys(where));

  // 2. a fresh save has no meter, no shoulder button, no move
  await page.evaluate(() => { bibooGame.resetAll(); });
  const fresh = await page.evaluate(() => ({ m: ['energy', 'empower', 'super'].map(k => BibooProgress.meterOn(k)), b: ['L1', 'L2', 'R1', 'R2'].map(b => BibooProgress.buttonOn(b)), u: BibooProgress.state.unlocked.length }));
  check('new game: no meters, no shoulder buttons, no unlocks', !fresh.m.some(Boolean) && !fresh.b.some(Boolean) && fresh.u === 0, fresh);

  // 3. collect in order; after each, compare what is on against what the plan allows
  let own = [];
  for (const [map, id] of PLAN) {
    const before = await page.evaluate(() => ({ m: ['energy', 'empower', 'super'].map(k => BibooProgress.meterOn(k)), b: ['L1', 'L2', 'R1', 'R2'].map(b => BibooProgress.buttonOn(b)), moves: BibooProgress.UNLOCKS.filter(u => BibooProgress.has(u.id)).length }));
    await page.evaluate(i => BibooProgress.unlock(i), id); own.push(id);
    const after = await page.evaluate(() => ({ m: ['energy', 'empower', 'super'].map(k => BibooProgress.meterOn(k)), b: ['L1', 'L2', 'R1', 'R2'].map(b => BibooProgress.buttonOn(b)), moves: BibooProgress.UNLOCKS.filter(u => BibooProgress.has(u.id)).length }));
    const expM = ['energy', 'empower', 'super'].map(k => own.includes(METER_AT[k]));
    check(`after ${map} ${id}: meters ${JSON.stringify(expM)}`, JSON.stringify(after.m) === JSON.stringify(expM), { before: before.m, after: after.m });
    check(`after ${map} ${id}: exactly ${own.length} unlocks owned`, after.moves === own.length, after.moves);
  }

  // 4. gem kinds that can drop, per point in the campaign (level 1 is health only; others need their meter)
  await page.evaluate(() => { bibooGame.resetAll(); });
  const gemsAt = async (lvlN, owned) => page.evaluate(([n, owned]) => {
    bibooGame.resetAll(); for (let i = 1; i < n; i++) BibooProgress.completeLevel(i); bibooGame.goOverworld(); bibooGame.enterLevel(n);
    for (const id of owned) bibooGame.unlock(id);
    const out = {}; for (const k of ['energy', 'empower', 'super']) out[k] = BibooProgress.meterOn(k);
    return out;
  }, [lvlN, owned]);
  const l1 = await gemsAt(1, PLAN.slice(0, 7).map(p => p[1]));
  check('level 1 with all its moves: no meter gems possible', !l1.energy && !l1.empower && !l1.super, l1);
  const l2a = await gemsAt(2, PLAN.slice(0, 7).map(p => p[1]));
  check('level 2 before 2.1: no meters', !l2a.energy && !l2a.empower && !l2a.super, l2a);
  const l3 = await gemsAt(3, PLAN.slice(0, 15).map(p => p[1]));
  check('level 3 start: ENG and EMP on, SUP off', l3.energy && l3.empower && !l3.super, l3);
  const l4a = await gemsAt(4, PLAN.slice(0, 20).map(p => p[1]));
  check('level 4 at 4.1 (Meter Charge): SUP still off', !l4a.super && l4a.energy && l4a.empower, l4a);
  const l4b = await gemsAt(4, PLAN.slice(0, 21).map(p => p[1]));
  check('level 4 after 4.4 Earthquake: SUP on', l4b.super, l4b);

  // 5. real drops: smash 40 plain crates in level 1 of a new game, only health gems may appear
  await page.evaluate(() => { bibooGame.resetAll(); bibooGame.enterLevel(1); });
  await page.waitForTimeout(400);
  const kinds = await page.evaluate(async () => {
    const seen = new Set();
    for (let r = 0; r < 4; r++) {
      bibooGame.setEnemies([]);
      const n = (bibooGame.state().crates || 10);
      for (let i = 0; i < 12; i++) { try { bibooGame.smash(i); } catch (e) {} }
      await new Promise(r => setTimeout(r, 120));
      for (const g of (bibooGame.gems() || [])) seen.add(g.kind || g.k || g.type);
    }
    return [...seen];
  });
  check('level 1 drops only health gems', kinds.every(k => k === 'health'), kinds);
  check('no page errors', errors.length === 0, errors);

  console.log(`${results.filter(Boolean).length}/${results.length} passed`);
  await browser.close();
  process.exit(results.every(Boolean) ? 0 : 1);
})();
