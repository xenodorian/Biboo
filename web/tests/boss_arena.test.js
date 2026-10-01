/* Boss arenas: x.10 (5.11) of levels 1 to 5 has a boss, a theme, a closed right edge until the boss dies, and then completes the level.
 * Run: NODE_PATH=$(npm root -g) node web/tests/boss_arena.test.js */
const path = require('path');
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(), page = await b.newPage({ viewport: { width: 1200, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  await page.goto('file://' + path.resolve(__dirname, '../index.html'));
  await page.waitForFunction(() => document.getElementById('btn-start') && window.bibooGame, null, { timeout: 20000 });
  const ev = j => page.evaluate(j), wait = ms => page.waitForTimeout(ms), res = [];
  const check = (n, ok, d) => { res.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${ok ? '' : '  ' + JSON.stringify(d)}`); };
  const boss = ['wyrmslug', 'oozewraith', 'horneddread', 'ogrechief', 'boarlord', 'mirrormax'];
  for (let n = 1; n <= 6; n++) {
    await ev('bibooGame.goOverworld()'); await wait(200);
    await ev(`bibooGame.enterLevel(${n})`); await wait(400);
    await ev(`bibooGame.warp(${n === 6 ? 10 : 9})`); await wait(500);
    await ev('bibooGame.setHp(200)');
    let s = await ev('bibooGame.state()');
    check(`level ${n}: boss ${boss[n - 1]} waits in the arena`, s.foes.length === 1 && s.foes[0].type === boss[n - 1], s.foes);
    await ev('bibooGame.setX(400)'); await wait(300);
    s = await ev('bibooGame.state()');
    check(`level ${n}: right edge held shut`, !s.levelDone, null);
    await ev('bibooGame.killFoe(0)'); await wait(300);
    await ev('bibooGame.setX(400)'); await wait(400);
    s = await ev('bibooGame.state()');
    check(`level ${n}: boss dead, level completes`, s.levelDone, null);
    await ev('bibooGame.goOverworld()'); await wait(200);
  }
  await page.screenshot({ path: process.env.SHOT || 'boss_shot.png' });
  console.log(errors.length ? errors : '');
  await b.close(); process.exit(res.every(Boolean) && !errors.length ? 0 : 1);
})();
