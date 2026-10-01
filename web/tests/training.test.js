/* Sunset Training: overworld node, heavy bag, Slime Bunny tips, and the two move lists. Run: NODE_PATH=$(npm root -g) node web/tests/training.test.js */
const path = require('path');
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(), page = await b.newPage({ viewport: { width: 1000, height: 640 } });
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  await page.goto('file://' + path.resolve(__dirname, '../index.html'));
  await page.waitForFunction(() => document.getElementById('btn-start') && window.bibooGame, null, { timeout: 20000 });
  const ev = j => page.evaluate(j), wait = ms => page.waitForTimeout(ms), res = [];
  const check = (n, ok, d) => { res.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${ok ? '' : '  ' + JSON.stringify(d)}`); };
  const labels = () => page.$$eval('#menu-view button', b => b.map(x => x.textContent));
  const hold = async (k, ms) => { await page.keyboard.down(k); await wait(ms); await page.keyboard.up(k); };
  // title menu: two move lists
  const l0 = await labels();
  check('the title menu offers both move lists', l0.includes('Moves: Gamepad') && l0.includes('Moves: Keyboard'), l0);
  await page.locator('#menu-view button', { hasText: 'Moves: Keyboard' }).click(); await wait(200);
  let heads = await page.$$eval('#menu-view .moves-table th', t => t.map(x => x.textContent));
  check('the keyboard list shows a Keyboard column and no Gamepad column', heads.includes('Keyboard') && !heads.includes('Gamepad'), heads);
  check('the keyboard list is titled', /Keyboard/.test(await page.textContent('#menu-title')), await page.textContent('#menu-title'));
  await page.locator('#menu-view button', { hasText: 'Back' }).click(); await wait(150);
  await page.locator('#menu-view button', { hasText: 'Moves: Gamepad' }).click(); await wait(200);
  heads = await page.$$eval('#menu-view .moves-table th', t => t.map(x => x.textContent));
  check('the gamepad list shows a Gamepad column and no Keyboard column', heads.includes('Gamepad') && !heads.includes('Keyboard'), heads);
  const rowsPad = await page.$$eval('#menu-view .moves-table tr td.pad', t => t.map(x => x.textContent));
  check('gamepad rows use pad button names', rowsPad.length > 5 && rowsPad.some(r => r === 'B' || r === 'A'), rowsPad);
  // overworld node
  await ev('bibooGame.goOverworld()'); await wait(300);
  await hold('ArrowLeft', 120); await wait(150); await hold('ArrowLeft', 120); await wait(150);
  await hold('KeyZ', 80); await wait(900);
  let t = await ev('bibooGame.training()');
  check('Left twice from level 1 selects Sunset Training and A enters it', t.on, t);
  check('the training level is outside progress (level 0)', (await ev('bibooGame.state().level.n')) === 0, await ev('bibooGame.state().level'));
  check('the bag is the only foe', (await ev('bibooGame.state().foes.map(f => f.type)')).join() === 'heavybag', await ev('bibooGame.state().foes'));
  check('Slime Bunny greets first', /Slime Bunny/.test(t.tip), t.tip);
  // hit the bag
  await ev('bibooGame.unlock("thrust")');
  await ev('bibooGame.setX(95)'); await wait(100);
  for (let i = 0; i < 3; i++) { await hold('KeyZ', 40); await wait(500); }
  t = await ev('bibooGame.training()');
  check('hitting the bag counts damage and hits', t.hits >= 1 && t.total > 0 && t.last > 0, t);
  const bag = (await ev('bibooGame.state().foes'))[0];
  check('the bag never loses health or dies', bag.alive && bag.hp > 900000, bag);
  check('the bag does not move', Math.abs(bag.x - 140) < 1, bag.x);
  await ev('bibooGame.hurtFoe(0, 99999)'); await wait(200);
  check('even a huge hit leaves it standing', (await ev('bibooGame.state().foes'))[0].alive, null);
  // meters and health refill
  await ev('bibooGame.hurtHer(30)'); await wait(200);
  check('health refills in training', (await ev('bibooGame.state().hp')) === (await ev('bibooGame.maxHp()')), await ev('bibooGame.state().hp'));
  // the tips change over time
  const t1 = (await ev('bibooGame.training()')).tip; await wait(9200);
  const t2 = (await ev('bibooGame.training()')).tip;
  check('Slime Bunny moves on to the next tip', t1 !== t2, [t1, t2]);
  // leaving
  await page.keyboard.press('Escape'); await wait(250);
  const l1 = await labels();
  check('the pause menu can go back to the overworld', l1.includes('Back to the overworld') && l1.includes('Moves: Keyboard') && l1.includes('Moves: Gamepad'), l1);
  await page.locator('#menu-view button', { hasText: 'Back to the overworld' }).click(); await wait(300);
  check('back on the overworld with progress untouched', (await ev('bibooGame.state().screen')) === 'overworld' && (await ev('BibooProgress.state.levelsUnlocked')) === 1, await ev('bibooGame.state().screen'));
  console.log(errors.length ? errors : '');
  await b.close(); process.exit(res.every(Boolean) && !errors.length ? 0 : 1);
})();
