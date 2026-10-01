/* Leaves on the maps, cache and ankh crates, and the per-map door. Run: NODE_PATH=$(npm root -g) node web/tests/leaves.test.js */
const path = require('path');
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(), page = await b.newPage({ viewport: { width: 1000, height: 640 } });
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  await page.goto('file://' + path.resolve(__dirname, '../index.html'));
  await page.waitForFunction(() => document.getElementById('btn-start') && window.bibooGame, null, { timeout: 20000 });
  const ev = j => page.evaluate(j), wait = ms => page.waitForTimeout(ms), res = [];
  const check = (n, ok, d) => { res.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${ok ? '' : '  ' + JSON.stringify(d)}`); };
  const data = await ev(`(() => { let items = 0, leaves = 0, caches = 0, ankh = 0, perLevel = [];
    for (const L of BIBOO_LEVELS.levels) { let lv = 0; for (const m of L.maps) { leaves += (m.leaves || []).length; lv += (m.leaves || []).length; for (const c of m.crates) { if (c.item) items++; if (c.loot === 'ankh') ankh++; if (/^leaves:/.test(c.loot || '')) caches++; } if ((m.ankhs || []).length) items++; } perLevel.push(lv); }
    return { items, leaves, caches, ankh, perLevel }; })()`);
  check('no map holds an unlock crate or a loose ankh', data.items === 0, data);
  check('every level has loose leaves, leaf caches and ankh crates', data.perLevel.every(n => n > 50) && data.caches > 10 && data.ankh > 3, data);
  await ev('bibooGame.resetAll(); bibooGame.goOverworld(); bibooGame.enterLevel(1)'); await wait(700);
  check('level 1 starts with 100 leaves', (await ev('BibooProgress.state.leaves')) === 100);
  await ev('bibooGame.setEnemies([])');
  check('map 1.1 has leaves on it', (await ev("bibooGame.gems().filter(g => g.kind === 'leaf')")).length > 0);
  // door gating
  await ev('bibooGame.warp(0)'); await wait(600);
  const dupes = await ev(`(() => { let d = 0; for (const L of BIBOO_LEVELS.levels) for (const m of L.maps) { const k = new Set(); for (const l of m.leaves) { const id = l.x + ',' + l.fy; if (k.has(id)) d++; k.add(id); } } return d; })()`);
  check('no two leaves sit on the same spot', dupes === 0, dupes);
  await ev('bibooGame.setX(330)'); await page.keyboard.down('ArrowRight'); await wait(1800); await page.keyboard.up('ArrowRight'); await wait(300);
  let s = await ev('bibooGame.state()');
  check('with enemies alive the right door will not open', s.level.id === '1.1', s.level);
  await ev('bibooGame.setEnemies([])'); await wait(200);
  await ev('bibooGame.setX(330)'); await page.keyboard.down('ArrowRight'); await wait(2200); await page.keyboard.up('ArrowRight'); await wait(300);
  s = await ev('bibooGame.state()');
  check('with every enemy defeated the door opens', s.level.id === '1.2', s.level);
  await ev('bibooGame.setX(40)'); await page.keyboard.down('ArrowLeft'); await wait(1800); await page.keyboard.up('ArrowLeft'); await wait(300);
  s = await ev('bibooGame.state()');
  check('the left edge is a wall', s.level.id === '1.2', s.level);
  await ev('bibooGame.custom({ leaves: [{ x: 200, fy: 0, h: 12 }, { x: 213, fy: 0, h: 12 }], crates: [] })'); await wait(700);
  const ls = await ev("bibooGame.gems().filter(g => g.kind === 'leaf')");
  check('a map\'s leaves are placed as pickups', ls.length === 2, ls.length);
  const before = await ev('BibooProgress.state.leaves');
  await ev(`bibooGame.setX(${ls[0].x - 34})`); await wait(900);
  check('walking into leaves collects them', (await ev('BibooProgress.state.leaves')) > before, await ev('BibooProgress.state.leaves'));
  await page.screenshot({ path: '/tmp/leaves.png' });
  check('no page errors', errors.length === 0, errors);
  await b.close(); process.exit(res.every(Boolean) ? 0 : 1);
})();
