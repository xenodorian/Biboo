/* Meteor Shower is five taps of B (full super meter). Run: NODE_PATH=$(npm root -g) node web/tests/meteor_input.test.js */
const path = require('path');
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(), page = await b.newPage({ viewport: { width: 1200, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  await page.goto('file://' + path.resolve(__dirname, '../index.html'));
  await page.waitForFunction(() => document.getElementById('btn-start') && window.bibooGame, null, { timeout: 20000 });
  const ev = j => page.evaluate(j), wait = ms => page.waitForTimeout(ms);
  await ev("bibooGame.resetAll(); bibooGame.unlock('earthquake'); bibooGame.unlock('meteor'); bibooGame.custom({})"); await wait(600);
  let seen = false;
  for (let i = 0; i < 5; i++) { await page.keyboard.down('KeyX'); await wait(40); await page.keyboard.up('KeyX'); await wait(90); const c = await ev('bibooGame.charging()'); if (c.cur === 'meteor_shower') seen = true; }
  for (let i = 0; i < 10 && !seen; i++) { await wait(50); if ((await ev('bibooGame.charging()')).cur === 'meteor_shower') seen = true; }
  console.log(seen ? 'PASS  five B taps play the meteor shower' : 'FAIL  five B taps did not play the meteor shower');
  console.log(errors.length ? errors : '');
  await b.close(); process.exit(seen && !errors.length ? 0 : 1);
})();
