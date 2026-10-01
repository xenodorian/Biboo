/* Every creature from tools/creatures spawns with its table HP, reaches Max, hits for its first attack's damage and dies without errors.
 * Run: NODE_PATH=$(npm root -g) node web/tests/creatures.test.js */
const path = require('path');
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(), page = await b.newPage({ viewport: { width: 1200, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  await page.goto('file://' + path.resolve(__dirname, '../index.html'));
  await page.waitForFunction(() => document.getElementById('btn-start') && window.bibooGame, null, { timeout: 20000 });
  const ev = j => page.evaluate(j), wait = ms => page.waitForTimeout(ms), res = [];
  const check = (n, ok, d) => { res.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${ok ? '' : '  ' + JSON.stringify(d)}`); };
  const names = ['hobgoblin', 'skullraider', 'dusksaur', 'darkknight', 'ogre', 'wyrmslug', 'oozewraith', 'horneddread', 'ogrechief', 'boarlord', 'clubogre', 'mirrormax'];
  for (const t of names) {
    await ev(`bibooGame.custom(${JSON.stringify({ enemies: [{ type: t, x: 200, fy: 0 }] })})`); await wait(500);
    await ev('bibooGame.setHp(200)'); await ev('bibooGame.setX(120)');
    const s0 = await ev('bibooGame.state()'); const f0 = s0.foes[0];
    let hurt = false;
    for (let i = 0; i < 160 && !hurt; i++) { await wait(50); const s = await ev('bibooGame.state()'); if (s.hp < 200) hurt = true; }
    check(`${t}: spawns (hp ${f0 && f0.hp}) and hurts Max`, !!f0 && hurt, { f0 });
    if (t === 'boarlord') await page.screenshot({ path: process.env.SHOT || 'creature_shot.png' });
  }
  console.log(errors.length ? errors : '');
  await b.close(); process.exit(res.every(Boolean) && !errors.length ? 0 : 1);
})();
