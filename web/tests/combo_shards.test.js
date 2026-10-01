/* Goblin combo shards: fly up first, then home on her; a parry (early or late) reflects them straight forward.
 * Run: NODE_PATH=$(npm root -g) node web/tests/combo_shards.test.js */
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
  const setup = async () => {
    await ev(`bibooGame.custom(${JSON.stringify({ enemies: [{ type: 'goblin', x: 330, fy: 0, path: [325, 335], sight: 5 }] })})`); await wait(900);
    await ev('bibooGame.setHp(200)'); await ev('bibooGame.setX(150)'); await wait(200);
    await ev("bibooGame.attack(0, 'combo')");
  };
  await setup();
  let early = null, maxShots = 0, hom = null;
  for (let i = 0; i < 20; i++) { await wait(50); const s = await S(); maxShots = Math.max(maxShots, s.shots.length); if (s.shots.length && !early) early = s.shots.map(x => ({ vy: x.vy, vx: x.vx })); }
  check('the combo fires three shards', maxShots === 3, maxShots);
  check('they leave going up and away (vy > 0)', early && early.every(x => x.vy > 0.05), early);
  await wait(1500);
  let s = await S();
  check('later they have curved toward her (some now travel downward)', s.shots.length === 0 || s.shots.some(x => x.vy < 0) || s.hp < 200, { shots: s.shots, hp: s.hp });
  // parry: tap B (KeyX) while they close in
  await setup();
  let reflected = null;
  for (let i = 0; i < 200 && !reflected; i++) {
    await wait(30);
    const st = await S();
    if (st.shots.some(x => Math.hypot(x.x - (st.px + 32), x.y - 20) < 120) && !(await ev('bibooGame.combat().parry || false'))) { await page.keyboard.down('KeyX'); await wait(40); await page.keyboard.up('KeyX'); }
    reflected = (await S()).shots.find(x => x.from === 'her');
  }
  check('a parry sends a shard straight forward (hers, level)', reflected && reflected.vx > 0 && reflected.vy === 0, reflected);
  console.log(errors.length ? errors : '');
  await b.close(); process.exit(res.every(Boolean) && !errors.length ? 0 : 1);
})();
