/* Leaves, the Bone Merchant and the per-map door. Run: NODE_PATH=$(npm root -g) node web/tests/shop.test.js */
const path = require('path');
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(), page = await b.newPage({ viewport: { width: 1000, height: 640 } });
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  await page.goto('file://' + path.resolve(__dirname, '../index.html'));
  await page.waitForFunction(() => document.getElementById('btn-start') && window.bibooGame, null, { timeout: 20000 });
  const ev = j => page.evaluate(j), wait = ms => page.waitForTimeout(ms), res = [];
  const check = (n, ok, d) => { res.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${ok ? '' : '  ' + JSON.stringify(d)}`); };
  const P = 'window.BibooProgress';
  // new game lands on the overworld with the merchant selected and 100 leaves
  await page.click('#btn-start'); await wait(300);
  await ev('bibooGame.skipStory()'); await wait(1200);
  let st = await ev('bibooGame.state()');
  check('new game ends on the overworld', st.screen === 'overworld', st.screen);
  check('the player starts with 100 leaves', (await ev(`${P}.state.leaves`)) === 100, await ev(`${P}.state.leaves`));
  await page.screenshot({ path: process.env.SHOT_DIR ? process.env.SHOT_DIR + '/ow.png' : '/tmp/ow.png' });
  // open the shop with A
  await page.keyboard.press('KeyZ', { delay: 90 }); await wait(300);
  check('A on the merchant opens the shop', /Bone Merchant/.test(await page.textContent('#menu-title')));
  const rows = await page.$$eval('.shop-row', r => r.map(x => x.textContent));
  check('shop lists supplies, mutagens and scrolls', rows.some(r => /Bone Powder/.test(r)) && rows.some(r => /Mutagen/.test(r)) && rows.some(r => /Scroll/.test(r)), rows.length);
  check('level 2 unlocks are not for sale yet', await page.$$eval('.shop-row', r => r.filter(x => /Beat level 1 first/.test(x.textContent)).length > 3));
  await page.screenshot({ path: process.env.SHOT_DIR ? process.env.SHOT_DIR + '/shop.png' : '/tmp/shop.png' });
  // buy a Bone (8)
  await page.click('#buy-bone'); await wait(200);
  check('buying a Bone costs 8 and adds one', (await ev(`${P}.state.leaves`)) === 92 && (await ev(`${P}.state.gems.health`)) === 1, [await ev(`${P}.state.leaves`), await ev(`${P}.state.gems.health`)]);
  // quartz needs a meter
  check('Quartz is blocked without an Energy Mutagen', await page.$eval('#buy-quartz', b => b.disabled));
  // bone powder is 90: not enough
  check('Bone Powder is unaffordable at 92-8? (90 <= 92 so affordable)', !(await page.$eval('#buy-powder', b => b.disabled)));
  await page.click('#buy-powder'); await wait(200);
  check('Bone Powder raises max HP by 25', (await ev(`${P}.maxOf('hp')`)) === 75, await ev(`${P}.maxOf('hp')`));
  // scroll for a level 1 unlock
  await ev(`${P}.addLeaves(500)`);
  await page.click('#btn-shop-back'); await wait(500); await page.keyboard.press('KeyZ', { delay: 90 }); await wait(300);
  const first = await ev(`${P}.UNLOCKS.filter(u => u.shop === 'scroll' && u.level === 1)[0].id`);
  const before = await ev(`${P}.has('${first}')`);
  await page.click(`#buy-unlock\\:${first}`); await wait(200);
  check('a level 1 scroll unlocks its move', !before && (await ev(`${P}.has('${first}')`)));
  const mut = await ev(`${P}.UNLOCKS.filter(u => u.shop === 'mutagen' && u.level === 2)[0].id`);
  check('a level 2 mutagen is locked until level 1 is beaten', await page.$eval(`#buy-unlock\\:${mut}`, b => b.disabled));
  await ev(`${P}.state.levelsUnlocked = 2`);
  await page.click('#btn-shop-back'); await wait(500); await page.keyboard.press('KeyZ', { delay: 90 }); await wait(300);
  await page.click(`#buy-unlock\\:${mut}`); await wait(200);
  check('after beating level 1 the mutagen can be bought', await ev(`${P}.has('${mut}')`));
  // the door: blocked while enemies live
  await page.click('#btn-shop-back'); await wait(150);
  
  check('no page errors', errors.length === 0, errors);
  await b.close();
  process.exit(res.every(Boolean) ? 0 : 1);
})();
