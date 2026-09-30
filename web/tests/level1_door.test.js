/* Level 1: health gems only, a locked end door whose key is a crate drop once every move is unlocked, and enemies that respawn.
 * Run: NODE_PATH=$(npm root -g) node web/tests/level1_door.test.js */
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
  const STARTERS = ['thrust', 'upswing', 'heavy_horizontal', 'dash_thrust', 'double_jump', 'sky_dash', 'push_kick'];
  const fresh = async () => { await ev('bibooGame.resetAll(); bibooGame.enterLevel(1)'); await wait(600); await ev('bibooGame.setEnemies([])'); await wait(200); };
  // smash n plain crates one after another in a custom crate row, but inside level 1 (n = 1) so its rules apply
  const smashAll = async count => {
    await ev(`(() => { const c = bibooGame.state().crates; return 0; })()`);
    return ev(`(() => { const out = []; const n = ${count}; for (let r = 0; r < n; r++) { bibooGame.warp(0); const cs = bibooGame.state().crates; for (let i = 0; i < cs.length; i++) { if (cs[i].item) continue; bibooGame.smash(i); out.push(...bibooGame.gems().map(g => g.kind)); } } return out; })()`);
  };

  // ---- gems: level 1 drops health gems only, even with every meter unlocked
  await fresh();
  await ev("for (const id of ['energy_kick', 'energy_burst', 'energy_wave', 'recover']) bibooGame.unlock(id)");
  await ev('bibooGame.warp(0)'); await wait(300);
  const kinds = await smashAll(8);
  check('crates in level 1 drop only health gems, with every meter owned', kinds.length > 0 && kinds.every(k => k === 'health'), [...new Set(kinds)]);
  await ev('bibooGame.warp(0)'); await wait(200);
  let enemyKinds = [];
  for (let i = 0; i < 12; i++) {
    await ev("bibooGame.setEnemies([['goblin', 200, 3000]])"); await wait(120);
    await ev('bibooGame.killFoe(0)'); await wait(60);
    enemyKinds.push(...(await ev('bibooGame.gems()')).map(g => g.kind));
  }
  check('enemy drops in level 1 are health gems too (and never a key)', enemyKinds.every(k => k === 'health'), [...new Set(enemyKinds)]);

  // ---- the key: a crate drop, only after every move is unlocked
  await fresh();
  for (const id of STARTERS.slice(0, 6)) await ev(`bibooGame.unlock('${id}')`);
  check('with six of seven moves the key is not due', (await ev('bibooGame.keyDue()')) === false, null);
  let k6 = await smashAll(6);
  check('no key from any crate while a move is still locked', !k6.includes('key'), [...new Set(k6)]);
  await ev("bibooGame.unlock('push_kick')");
  check('with all seven moves the key is due', (await ev('bibooGame.keyDue()')) === true, null);
  await ev('bibooGame.warp(0)'); await wait(300);
  await ev('bibooGame.warp(0)');
  const crates = (await S()).crates;
  const plain = crates.map((c, i) => [c, i]).filter(([c]) => !c.item).map(([, i]) => i);
  await ev(`bibooGame.smash(${plain[0]})`);
  let g1 = (await ev('bibooGame.gems()')).map(g => g.kind);
  check('the next crate drops the key', g1.includes('key'), g1);
  await ev(`bibooGame.smash(${plain[1]})`);
  g1 = (await ev('bibooGame.gems()')).map(g => g.kind);
  check('only one key exists at a time', g1.filter(k => k === 'key').length === 1, g1);
  check('the door is locked before the key is picked up', (await ev('bibooGame.doorLocked()')) === true, null);

  // ---- the door: locked without the key, opens with it
  await ev('bibooGame.warp(8)'); await wait(400); await ev('bibooGame.setEnemies([])'); await wait(200);
  await ev('bibooGame.setX(376)'); await wait(700);
  let s = await S();
  check('walking into the locked door does not finish the level', s.screen === 'level' && !s.levelDone && s.level.idx === 8, { screen: s.screen, done: s.levelDone, idx: s.level && s.level.idx });
  await ev('bibooGame.setX(120)');
  await ev('bibooGame.warp(0)'); await wait(300); await ev('bibooGame.setEnemies([])');
  const crates2 = (await S()).crates; const pl = crates2.map((c, i) => [c, i]).filter(([c]) => !c.item).map(([, i]) => i);
  await ev(`bibooGame.smash(${pl[0]})`); await wait(100);
  const kx = (await ev('bibooGame.gems()')).find(g => g.kind === 'key');
  await ev(`bibooGame.setX(${kx.x - 32})`); await wait(500);
  check('touching the key picks it up', (await ev('bibooGame.hasKey()')) === true && (await ev('bibooGame.doorLocked()')) === false, await ev('bibooGame.gems()'));
  await ev('bibooGame.warp(8)'); await wait(400); await ev('bibooGame.setEnemies([])'); await wait(200);
  await ev('bibooGame.setX(376)'); await wait(900);
  s = await S();
  check('with the key the door ends the level', s.levelDone === true || s.screen !== 'level', { screen: s.screen, done: s.levelDone });
  await ev('bibooGame.goOverworld()'); await wait(300);
  check('the key is remembered after leaving the level', (await ev("BibooProgress.hasKey(1)")) === true, null);

  // ---- respawns: enemies and level 1's plain crates come back when she leaves and returns
  await fresh();
  await ev('bibooGame.warp(1)'); await wait(500);
  const before = (await S()).foes.length;
  for (let i = 0; i < before; i++) await ev('bibooGame.killFoe(0)');
  await wait(300);
  check('the enemies are gone once killed', (await S()).foes.filter(f => f.alive).length === 0, (await S()).foes);
  const cb = (await S()).crates; await ev(`bibooGame.smash(${cb.findIndex(c => !c.item)})`);
  check('a plain crate is broken', (await S()).crates.some(c => c.broken && !c.item), null);
  await ev('bibooGame.warp(2)'); await wait(400); await ev('bibooGame.warp(1)'); await wait(500);
  s = await S();
  check('enemies respawn after leaving and coming back', s.foes.filter(f => f.alive).length === before, { before, now: s.foes.length });
  check('level 1 plain crates respawn too', s.crates.filter(c => !c.item).every(c => !c.broken), s.crates);

  // other levels: enemies respawn as well
  await ev('bibooGame.resetAll(); BibooProgress.completeLevel(1); bibooGame.enterLevel(2)'); await wait(600);
  await ev('bibooGame.warp(1)'); await wait(400);
  const b2 = (await S()).foes.length;
  for (let i = 0; i < b2; i++) await ev('bibooGame.killFoe(0)');
  await wait(200); await ev('bibooGame.warp(2)'); await wait(300); await ev('bibooGame.warp(1)'); await wait(400);
  check('level 2 enemies respawn when she returns', (await S()).foes.filter(f => f.alive).length === b2, { b2 });

  console.log(errors.length ? errors : '');
  check('no page errors', errors.length === 0, errors);
  const ok = results.filter(Boolean).length;
  console.log(ok === results.length ? `ALL PASSED ${ok}/${results.length}` : `SOME FAILED ${ok}/${results.length}`);
  await browser.close();
  process.exit(ok === results.length ? 0 : 1);
})();
