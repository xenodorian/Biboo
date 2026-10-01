/* The orc tries gaps up to 140 px but its jump only carries 60 px: a 100 px pit is always its doom, a goblin always clears it.
 * Run: NODE_PATH=$(npm root -g) node web/tests/orc_jump.test.js */
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
  const run = async (type, w) => {
    await ev(`bibooGame.custom(${JSON.stringify({ pits: [{ x0: 150, x1: 150 + w }], enemies: [{ type, x: 80, fy: 0 }] })})`); await wait(700);
    await ev('bibooGame.setHp(200)'); await ev(`bibooGame.setX(${150 + w + 70})`);
    let outcome = 'none';
    for (let i = 0; i < 220 && outcome === 'none'; i++) {
      await wait(50); const f = (await S()).foes[0];
      if (!f || !f.alive) outcome = 'died'; else if (f.x > 150 + w + 2) outcome = 'crossed';
    }
    return outcome;
  };
  check('an orc jumping a 100 px pit comes down in it', (await run('orc', 100)) === 'died', null);
  check('a goblin clears the same 100 px pit', (await run('goblin', 100)) === 'crossed', null);
  console.log(errors.length ? errors : '');
  await b.close(); process.exit(res.every(Boolean) && !errors.length ? 0 : 1);
})();
