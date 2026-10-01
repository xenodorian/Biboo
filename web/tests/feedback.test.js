/* Hit feedback (hit-stop, starbursts, flash, shake) and the title screen. Run: NODE_PATH=$(npm root -g) node web/tests/feedback.test.js */
const path = require('path');
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(), page = await b.newPage({ viewport: { width: 1000, height: 640 } });
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  await page.goto('file://' + path.resolve(__dirname, '../index.html'));
  await page.waitForFunction(() => document.getElementById('btn-start') && window.bibooGame, null, { timeout: 20000 });
  const ev = j => page.evaluate(j), wait = ms => page.waitForTimeout(ms), res = [];
  const check = (n, ok, d) => { res.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${ok ? '' : '  ' + JSON.stringify(d)}`); };
  // title screen
  check('the title menu sits in the title layout', await ev("document.getElementById('start-menu').classList.contains('title')"), null);
  check('the title screen has no errors after drawing', errors.length === 0, errors);
  await wait(800);
  // melee hit feedback
  await ev("bibooGame.resetAll(); bibooGame.custom({ enemies: [{ type: 'orc', x: 85, fy: 0 }] })"); await wait(600);
  await ev('bibooGame.setX(40)');
  let seen = { freeze: false, flashes: false };
  await page.keyboard.down('KeyZ'); await wait(30); await page.keyboard.up('KeyZ');
  for (let i = 0; i < 40; i++) { const f = await ev('bibooGame.fx()'); if (f.freeze > 0) seen.freeze = true; if (f.flashes > 0) seen.flashes = true; await wait(15); }
  const hp = (await ev('bibooGame.state().foes[0].hp'));
  check('the orc was hit', hp < 100000 && (await ev('bibooGame.state().foes[0].hp')) < (await ev("bibooGame.state().foes[0].maxHp || 1e9")), hp);
  check('a hit freezes the game briefly (hit-stop)', seen.freeze, seen);
  check('a hit makes a starburst', seen.flashes, seen);
  // her getting hit: red flash, shake, stop
  await ev('bibooGame.custom({ enemies: [] })'); await wait(400);
  await ev('bibooGame.addShot(10, 20, 0.05, 0)');
  let her = { flash: false, freeze: false };
  for (let i = 0; i < 40; i++) { const f = await ev('bibooGame.fx()'); if (f.flash) her.flash = true; if (f.freeze > 0) her.freeze = true; await wait(15); }
  check('her being hit flashes the screen and freezes', her.flash && her.freeze, her);
  // the game is not stuck frozen
  await wait(500);
  check('the freeze always ends', (await ev('bibooGame.fx()')).freeze <= 0, await ev('bibooGame.fx()'));
  console.log(errors.length ? errors : '');
  await b.close(); process.exit(res.every(Boolean) && !errors.length ? 0 : 1);
})();
