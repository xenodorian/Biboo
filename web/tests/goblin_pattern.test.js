/* Goblin pattern: combo on detecting her, then melee only; another combo only after she leaves melee range;
 * it jumps up to platforms, drops off them and hops pits.
 * Run: NODE_PATH=$(npm root -g) node web/tests/goblin_pattern.test.js */
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
  // ---- attack pattern
  await ev(`bibooGame.custom(${JSON.stringify({ enemies: [] })})`); await wait(700);
  await ev('bibooGame.setHp(200)'); await ev('bibooGame.setX(60)');
  await ev("bibooGame.setEnemies([['goblin', 150, 0]])");
  const seq = []; let last = null;
  const watch = async ms => { const t0 = Date.now(); while (Date.now() - t0 < ms) { await wait(40); const f = (await S()).foes[0]; if (f && f.state === 'attack' && f.anim !== last) seq.push(f.anim); last = f && f.state === 'attack' ? f.anim : null; } };
  await watch(6000);
  check('the first attack is the combo', seq[0] === 'combo', seq);
  check('the attack after the combo is melee (slash or roll), not another combo', seq.length > 1 && (seq[1] === 'slash' || seq[1] === 'dive'), seq);
  // once it has swung in melee range, her leaving that range brings the next combo
  await ev("bibooGame.setEnemies([['goblin', 150, 0]])"); await ev('bibooGame.setX(60)'); await ev('bibooGame.setHp(200)');
  const s2 = []; let l2 = null, away = false, comboAfter = false;
  for (let i = 0; i < 200 && !comboAfter; i++) {
    await wait(40); const f = (await S()).foes[0]; if (!f) break;
    const a2 = f.state === 'attack' ? f.anim : null;
    if (a2 && a2 !== l2) { s2.push(a2); if (away && a2 === 'combo') comboAfter = true; if (a2 === 'slash' && !away) { away = true; await ev('bibooGame.setHp(200)'); await ev(`bibooGame.setX(${Math.max(8, f.x - 170)})`); } }
    l2 = a2;
  }
  check('after a melee swing, her leaving melee range triggers another combo', comboAfter, s2);
  // ---- platforms
  await ev(`bibooGame.custom(${JSON.stringify({ plats: [{ x0: 200, x1: 300, top: 60 }], enemies: [] })})`); await wait(700);
  await ev('bibooGame.setHp(200)'); await ev('bibooGame.setFloor(60)'); await ev('bibooGame.setX(250)'); await wait(200);
  await ev("bibooGame.setEnemies([['goblin', -150, 0]])"); await wait(100);
  let upOk = false;
  for (let i = 0; i < 200 && !upOk; i++) { await wait(50); const f = (await S()).foes[0]; if (f && f.fy === 60) upOk = true; }
  check('a goblin on the ground jumps up onto a platform to reach her', upOk, (await S()).foes);
  // drop
  await ev(`bibooGame.custom(${JSON.stringify({ plats: [{ x0: 200, x1: 300, top: 60 }], enemies: [{ type: 'goblin', x: 250, fy: 60, path: [215, 285], sight: 400 }] })})`); await wait(700);
  await ev('bibooGame.setHp(200)'); await ev('bibooGame.setX(120)'); await wait(100);
  let dropOk = false;
  for (let i = 0; i < 240 && !dropOk; i++) { await wait(50); const f = (await S()).foes[0]; if (f && f.fy === 0) dropOk = true; }
  check('a goblin on a platform drops down to reach her', dropOk, (await S()).foes);
  console.log(errors.length ? errors : '');
  await b.close(); process.exit(res.every(Boolean) && !errors.length ? 0 : 1);
})();
