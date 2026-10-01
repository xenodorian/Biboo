/* Ankhs: crate drops only, the counter, a retry costs one, none left restarts the level. Run: NODE_PATH=$(npm root -g) node web/tests/ankhs.test.js */
const path = require('path');
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(), page = await b.newPage({ viewport: { width: 1200, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  await page.goto('file://' + path.resolve(__dirname, '../index.html'));
  await page.waitForFunction(() => document.getElementById('btn-start') && window.bibooGame, null, { timeout: 20000 });
  const ev = j => page.evaluate(j), wait = ms => page.waitForTimeout(ms), res = [];
  const check = (n, ok, d) => { res.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${ok ? '' : '  ' + JSON.stringify(d)}`); };
  const S = () => ev('bibooGame.state()');
  await ev('bibooGame.resetAll(); bibooGame.goOverworld(); bibooGame.enterLevel(1)'); await wait(700);
  check('a new level starts with 3 ankhs', (await ev('bibooGame.ankhs()')) === 3, null);
  await ev('bibooGame.warp(1)'); await wait(500); await ev('bibooGame.setEnemies([])');
  check('no ankhs lie loose on the map any more', (await ev("bibooGame.gems().filter(g => g.kind === 'ankh')")).length === 0, null);
  await ev("bibooGame.dropGem(0, 'ankh')"); await wait(900);
  check('an ankh dropped from a crate is picked up (+1)', (await ev('bibooGame.ankhs()')) === 4, await ev('bibooGame.ankhs()'));
  await ev('bibooGame.setAnkhs(9)'); await ev("bibooGame.dropGem(0, 'ankh')"); await wait(900);
  check('the counter stops at 9', (await ev('bibooGame.ankhs()')) === 9, null);
  await ev('bibooGame.warp(1)'); await wait(500);
  // K.O. and retry
  await ev('bibooGame.setX(20)'); await wait(300); await ev('bibooGame.setAnkhs(2); bibooGame.setHp(50); bibooGame.hurtHer(500)'); await wait(1800);
  let s = await S();
  check('K.O. shows Game Over with the retry costing an ankh', s.gameOver && /costs 1 ankh, 2 left/.test(await ev("document.querySelector('#menu-view button').textContent")), await ev("document.querySelector('#menu-view button').textContent"));
  await page.locator('#menu-view button').first().click(); await wait(500);
  s = await S();
  check('retrying spends one ankh and replays the same map', !s.gameOver && (await ev('bibooGame.ankhs()')) === 1 && s.level.id === '1.2', { a: await ev('bibooGame.ankhs()'), id: s.level.id });
  await ev('bibooGame.setAnkhs(0); bibooGame.hurtHer(500)'); await wait(1800);
  const txt = await ev("document.querySelector('#menu-view button').textContent");
  check('with no ankhs the button offers a level restart', /restart the level/i.test(txt), txt);
  await page.locator('#menu-view button').first().click(); await wait(700);
  s = await S();
  check('the level restarts from map 1.1 with 3 ankhs', s.level.id === '1.1' && (await ev('bibooGame.ankhs()')) === 3, { id: s.level.id, a: await ev('bibooGame.ankhs()') });
  console.log(errors.length ? errors : '');
  await b.close(); process.exit(res.every(Boolean) && !errors.length ? 0 : 1);
})();
