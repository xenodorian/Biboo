/* Enemies leap pits to reach her; the dash and dash based moves hop 5 px.
 * Run: NODE_PATH=$(npm root -g) node web/tests/enemy_jump_dash_hop.test.js */
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
  // enemy across a pit
  await ev(`bibooGame.custom(${JSON.stringify({ pits: [{ x0: 150, x1: 210 }], enemies: [{ type: 'goblin', x: 90, fy: 0 }] })})`); await wait(900);
  await ev('bibooGame.setX(290)');
  let maxX = 0, seenAir = false, alive = true;
  for (let i = 0; i < 80; i++) { await wait(100); const s = await S(); const f = s.foes[0]; if (!f || !f.alive) { alive = false; break; } maxX = Math.max(maxX, f.x); if (f.x > 150 && f.x < 210) seenAir = true; }
  check('a goblin leaps the pit and lives', alive && maxX > 215 && seenAir, { maxX, seenAir, alive });
  // an enemy that is not facing her side does not jump into a pit when she is on its side
  await ev(`bibooGame.custom(${JSON.stringify({ pits: [{ x0: 150, x1: 210 }], enemies: [{ type: 'goblin', x: 90, fy: 0 }] })})`); await wait(900);
  await ev('bibooGame.setX(40)'); await wait(3000);
  const s2 = await S();
  check('with her on its own side it stays out of the pit', s2.foes[0] && s2.foes[0].alive && s2.foes[0].x < 150, s2.foes);
  // dash hop
  await ev(`bibooGame.custom(${JSON.stringify({ enemies: [] })})`); await wait(900);
  await ev('bibooGame.setX(60)'); await wait(200);
  await page.keyboard.down('KeyA'); await wait(40); await page.keyboard.up('KeyA');
  let peak = 0;
  for (let i = 0; i < 40; i++) { await wait(15); peak = Math.max(peak, (await S()).feet); }
  check('the dash rises about 5 px', peak >= 3 && peak <= 5.5, peak);
  await wait(800);
  check('and lands back on the ground', (await S()).feet === 0, await S());
  console.log(errors.length ? errors : '');
  await b.close(); process.exit(res.every(Boolean) && !errors.length ? 0 : 1);
})();
