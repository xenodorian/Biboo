/* Any part of her sprite over a platform keeps her standing on it (not only the anchor point).
 * Run: NODE_PATH=$(npm root -g) node web/tests/platform_edge.test.js */
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
  const tap = async k => { await page.keyboard.down(k); await wait(60); await page.keyboard.up(k); };
  const fresh = async () => {
    await ev(`bibooGame.custom(${JSON.stringify({ plats: [{ x0: 150, x1: 250, top: 60 }], enemies: [] })})`); await wait(900);
    await ev('bibooGame.setX(120)'); await wait(150);
    await page.keyboard.down('ArrowRight'); await tap('ArrowUp'); await wait(900); await page.keyboard.up('ArrowRight'); await wait(400);
    await ev('bibooGame.setX(200)'); await wait(400);
  };
  await fresh();
  check('set up: standing on the platform', (await S()).floorY === 60, await S());
  // face left, then put the anchor 20 px past the right edge: her body still trails over the platform
  await tap('ArrowLeft'); await wait(200);
  await ev('bibooGame.setX(270)'); await wait(500);
  let s = await S();
  check('facing left with the anchor 20 px past the edge, her body is still over it: she stays up', s.floorY === 60, { fy: s.floorY, px: s.px });
  await ev('bibooGame.setX(340)'); await wait(900);
  s = await S();
  check('with no part of her over the platform she falls to the ground', s.floorY === 0, { fy: s.floorY, px: s.px });
  // landing: a jump that comes down with only her trailing body over the platform
  await fresh();
  await tap('ArrowLeft'); await wait(150);
  await ev('bibooGame.setX(0)'); await wait(100);
  await ev('bibooGame.setX(280)'); await wait(700);
  s = await S();
  check('on the ground beside the platform she stays on the ground', s.floorY === 0, s.floorY);
  check('no page errors', errors.length === 0, errors);
  console.log(`${res.filter(Boolean).length}/${res.length} passed`); await b.close(); process.exit(res.every(Boolean) ? 0 : 1);
})();
