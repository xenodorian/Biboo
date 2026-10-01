/* Cheats menu: L1+R1+L2+R2 (Q+W+1+2) in the pause menu adds "Cheats"; God Mode, Infinite Meter, Level Unlock, Master Unlock, No Pitfalls work.
 * Run: NODE_PATH=$(npm root -g) node web/tests/cheats.test.js */
const path = require('path');
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(), page = await b.newPage({ viewport: { width: 1200, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  await page.goto('file://' + path.resolve(__dirname, '../index.html'));
  await page.waitForFunction(() => document.getElementById('btn-start') && window.bibooGame, null, { timeout: 20000 });
  const ev = j => page.evaluate(j), wait = ms => page.waitForTimeout(ms), res = [];
  const check = (n, ok, d) => { res.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${ok ? '' : '  ' + JSON.stringify(d)}`); };
  const labels = () => ev("[...document.querySelectorAll('#menu-view button')].map(b => b.textContent)");
  const click = async t => { await page.locator('#menu-view button', { hasText: t }).first().click(); await wait(150); };
  const chord = async () => { for (const k of ['KeyQ', 'KeyW', 'Digit1', 'Digit2']) await page.keyboard.down(k); await wait(250); for (const k of ['KeyQ', 'KeyW', 'Digit1', 'Digit2']) await page.keyboard.up(k); await wait(200); };
  await ev("bibooGame.resetAll(); bibooGame.custom({ pits: [{ x0: 150, x1: 230 }] })"); await wait(500);
  await page.keyboard.press('Escape'); await wait(300);
  check('pause menu has no Cheats entry at first', !(await labels()).includes('Cheats'), await labels());
  await page.keyboard.press('Backquote'); await wait(150);
  check('the old ` key does nothing now', !(await ev('bibooGame.state().devOpen')), null);
  await chord();
  check('L1+R1+L2+R2 in the pause menu adds Cheats', (await labels()).includes('Cheats'), await labels());
  await click('Cheats');
  const l = await labels();
  check('the Cheats menu lists exactly the five cheats and Close', ['God Mode: OFF', 'Infinite Meter: OFF', 'Level Unlock', 'Master Unlock', 'No Pitfalls: OFF', 'Close'].every((t, i) => l[i] === t) && l.length === 6, l);
  await click('God Mode'); await click('Infinite Meter'); await click('Level Unlock'); await click('Master Unlock');
  check('Level Unlock opens all six levels', (await ev('BibooProgress.state.levelsUnlocked')) === 6, null);
  check('Master Unlock gives every unlockable', await ev('BibooProgress.UNLOCKS.every(u => BibooProgress.has(u.id))'), null);
  await click('Close'); await page.keyboard.press('Escape'); await wait(300);
  const hp0 = await ev('bibooGame.state().hp'); await ev('bibooGame.hurtHer(40)'); await wait(100);
  check('God Mode: no damage', (await ev('bibooGame.state().hp')) === hp0, hp0);
  await ev('bibooGame.setX(180)'); await wait(1500);
  check('God Mode keeps her out of the pit', !(await ev('bibooGame.state().gameOver')), null);
  // No Pitfalls with God Mode off
  await page.keyboard.press('Escape'); await wait(300); await click('Cheats'); await click('God Mode'); await click('No Pitfalls'); await click('Close'); await page.keyboard.press('Escape'); await wait(300);
  await ev('bibooGame.setX(190)'); await wait(1800);
  const s = await ev('bibooGame.state()');
  check('No Pitfalls: she stands over the pit', !s.gameOver && s.feet >= 0 && s.px > 150 && s.px < 230, { go: s.gameOver, feet: s.feet, px: s.px });
  console.log(errors.length ? errors : '');
  await b.close(); process.exit(res.every(Boolean) && !errors.length ? 0 : 1);
})();
