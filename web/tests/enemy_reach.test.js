/* Enemies start attacking once her hitbox is within their reach (goblin 62 px or less, orc 38 or less) and otherwise walk on.
 * Run: NODE_PATH=$(npm root -g) node web/tests/enemy_reach.test.js */
const path = require('path');
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(), page = await b.newPage({ viewport: { width: 1200, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  await page.goto('file://' + path.resolve(__dirname, '../index.html'));
  await page.waitForFunction(() => document.getElementById('btn-start') && window.bibooGame, null, { timeout: 20000 });
  const ev = j => page.evaluate(j), wait = ms => page.waitForTimeout(ms), res = [];
  const check = (n, ok, d) => { res.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${ok ? '' : '  ' + JSON.stringify(d)}`); };
  for (const [type, lo, hi] of [['goblin', 55, 62.01], ['goblin', 55, 62.01], ['goblin', 55, 62.01], ['orc', 32, 38.01]]) {
    await ev(`bibooGame.custom(${JSON.stringify({ enemies: [] })})`); await wait(700);
    await ev('bibooGame.setHp(200)'); await ev('bibooGame.setX(100)');
    await ev(`bibooGame.setEnemies([['${type}', 220, 0]])`);
    let gap = null;
    for (let i = 0; i < 200 && gap === null; i++) {
      await wait(25);
      const s = await ev('bibooGame.state()'), f = s.foes[0];
      if (f && f.state === 'attack') gap = f.x - (s.px + 30);
    }
    const roll = type === 'goblin' && gap > 100 && gap < 175;   // the goblin's roll starts from 110 to 170 px, as before
    check(`${type} starts attacking when her hitbox is ${lo} to ${hi} px away${type === 'goblin' ? ' (or the 110 to 170 px roll)' : ''}`, gap !== null && ((gap >= lo && gap <= hi) || roll), gap);
  }
  console.log(errors.length ? errors : '');
  await b.close(); process.exit(res.every(Boolean) && !errors.length ? 0 : 1);
})();
