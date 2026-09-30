/* The main menu has a two-press hard reset that erases the save and reloads into a new game.
 * Run: NODE_PATH=$(npm root -g) node web/tests/hard_reset.test.js */
const path = require('path');
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(), page = await b.newPage({ viewport: { width: 1152, height: 648 } });
  await page.goto('file://' + path.resolve(__dirname, '../index.html'));
  await page.waitForFunction(() => document.getElementById('btn-start') && window.bibooGame, null, { timeout: 20000 });
  const res = [], check = (n, ok, d) => { res.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${ok ? '' : '  ' + JSON.stringify(d)}`); };
  await page.evaluate(() => { bibooGame.unlock('thrust'); bibooGame.unlock('recover'); localStorage.setItem('parryperry.extra', '1'); });
  const before = await page.evaluate(() => BibooProgress.state.unlocked.length);
  check('save has unlocks before the reset', before === 2, before);
  const btn = page.locator('#btn-hard-reset');
  check('the button is on the title menu', await btn.count() === 1, await btn.count());
  await btn.click();
  check('first press only arms it', (await page.evaluate(() => BibooProgress.state.unlocked.length)) === 2 && /again/.test(await page.locator('#btn-hard-reset').innerText()));
  await Promise.all([page.waitForNavigation(), page.locator('#btn-hard-reset').click()]);
  await page.waitForFunction(() => window.bibooGame && document.getElementById('btn-start'));
  const after = await page.evaluate(() => ({ u: BibooProgress.state.unlocked.length, keys: Object.keys(localStorage).filter(k => k.startsWith('parryperry')), sup: BibooProgress.meterOn('super'), max: BibooProgress.maxOf('super') }));
  check('second press erases the save and reloads a new game', after.u === 0 && !after.keys.includes('parryperry.extra') && !after.sup && after.max === 100, after);
  console.log(`${res.filter(Boolean).length}/${res.length} passed`); await b.close(); process.exit(res.every(Boolean) ? 0 : 1);
})();
