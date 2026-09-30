/* Sky Dash is Down then Up (no jump); taunt is X+Y; Y alone is the spin attack; plain Up still jumps.
 * Run: NODE_PATH=$(npm root -g) node web/tests/sky_taunt.test.js */
const path = require('path');
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(), page = await b.newPage();
  await page.goto('file://' + path.resolve(__dirname, '../index.html'));
  await page.waitForFunction(() => document.getElementById('btn-start') && window.bibooGame, null, { timeout: 20000 });
  const ev = j => page.evaluate(j), wait = ms => page.waitForTimeout(ms), res = [];
  const check = (n, ok, d) => { res.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${ok ? '' : '  ' + JSON.stringify(d)}`); };
  const fresh = async () => { await ev("bibooGame.resetAll(); for (const id of ['sky_dash','taunt','double_jump']) bibooGame.unlock(id); bibooGame.enterLevel(1); bibooGame.setEnemies([])"); await wait(700); };
  const cur = () => ev('bibooGame.state().cur && bibooGame.state().cur.id || bibooGame.state().move || null');
  const log = async fn => { await ev('window.__ids = new Set(); window.__iv = setInterval(() => { const c = bibooGame.charging().cur; if (c) __ids.add(c); }, 10)'); await fn(); await wait(400); return ev('clearInterval(__iv); [...__ids]'); };
  await fresh();
  let ids = await log(async () => { await page.keyboard.down('ArrowDown'); await wait(80); await page.keyboard.up('ArrowDown'); await wait(60); await page.keyboard.down('ArrowUp'); await wait(60); await page.keyboard.up('ArrowUp'); });
  check('Down then Up: sky dash, no jump', ids.includes('sky_dash') && !ids.includes('jump'), ids);
  await fresh();
  ids = await log(async () => { await page.keyboard.down('KeyA'); await wait(40); await page.keyboard.down('KeyS'); await wait(80); await page.keyboard.up('KeyS'); await page.keyboard.up('KeyA'); });
  check('X+Y: taunt, not spin', ids.includes('taunt') && !ids.includes('spin_attack'), ids);
  await fresh();
  ids = await log(async () => { await page.keyboard.down('KeyS'); await wait(80); await page.keyboard.up('KeyS'); });
  check('Y alone: spin attack', ids.includes('spin_attack'), ids);
  await fresh();
  ids = await log(async () => { await page.keyboard.down('ArrowUp'); await wait(80); await page.keyboard.up('ArrowUp'); });
  check('Up alone: jump', ids.includes('jump') && !ids.includes('sky_dash'), ids);
  console.log(`${res.filter(Boolean).length}/${res.length} passed`); await b.close(); process.exit(res.every(Boolean) ? 0 : 1);
})();
