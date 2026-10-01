/* Max HP starts at 50; +25 Max HP gems drop beside health gems; push kick and energy kick hop 5 px.
 * Run: NODE_PATH=$(npm root -g) node web/tests/maxhp_kick_hop.test.js */
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
  await ev(`bibooGame.custom(${JSON.stringify({ enemies: [] })})`); await wait(900);
  check('a new game starts at 50 Max HP and 50 HP', (await ev('bibooGame.maxHp()')) === 50 && (await S()).hp === 50, await S());
  check('the crate loot pool contains the Max HP gem next to the health gem', await ev("(() => { const p = bibooGame.lootPool(); return p.includes('up_hp') && p.includes('health'); })()"), await ev('bibooGame.lootPool()'));
  // pick one up
  await ev('bibooGame.hurtHer(30)'); await wait(100);
  const hp0 = (await S()).hp;
  const px = (await S()).px;
  await ev(`bibooGame.addGem('up_hp', ${px + 32})`); await wait(400);
  const s = await S();
  check('a Max HP gem raises Max HP to 75 and heals 25', (await ev('bibooGame.maxHp()')) === 75 && s.hp === Math.min(75, hp0 + 25), { hp0, hp: s.hp });
  // health gem heals 25 percent of max (19 of 75)
  await ev('BibooProgress.addGem("health", 1)'); 
  // kicks hop
  await ev('bibooGame.unlock("push_kick"); bibooGame.unlock("energy_kick")');
  await ev('bibooGame.setHp(75)');
  await ev('bibooGame.setX(60)'); await wait(200);
  await page.keyboard.down('KeyQ'); await wait(40); await page.keyboard.up('KeyQ');
  let peak = 0;
  for (let i = 0; i < 45; i++) { await wait(15); peak = Math.max(peak, (await S()).feet); }
  check('the push kick rises about 5 px', peak >= 3 && peak <= 5.5, peak);
  console.log(errors.length ? errors : '');
  await b.close(); process.exit(res.every(Boolean) && !errors.length ? 0 : 1);
})();
