/* Bosses ignore the taunt and the Empowerment Beam, and drop gems and ankhs when they die. Run: NODE_PATH=$(npm root -g) node web/tests/boss_immunity.test.js */
const path = require('path');
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(), page = await b.newPage({ viewport: { width: 1200, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  await page.goto('file://' + path.resolve(__dirname, '../index.html'));
  await page.waitForFunction(() => document.getElementById('btn-start') && window.bibooGame, null, { timeout: 20000 });
  const ev = j => page.evaluate(j), wait = ms => page.waitForTimeout(ms), res = [];
  const check = (n, ok, d) => { res.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${ok ? '' : '  ' + JSON.stringify(d)}`); };
  await ev("bibooGame.resetAll(); for (const u of BibooProgress.UNLOCKS) bibooGame.unlock(u.id); bibooGame.custom({ enemies: [{ type: 'wyrmslug', x: 330, fy: 0 }, { type: 'goblin', x: 300, fy: 0 }] }); bibooGame.setHp(200)"); await wait(600);
  await ev('bibooGame.setEnemyHp && 0'); await ev('bibooGame.setX(60)');
  await page.keyboard.down('KeyA'); await page.keyboard.down('KeyS'); await wait(150); await page.keyboard.up('KeyA'); await page.keyboard.up('KeyS'); await wait(400);
  let f = (await ev('bibooGame.state()')).foes;
  check('the taunt taunts the goblin', f.find(x => x.type === 'goblin').taunted, f);
  check('the boss ignores the taunt', !f.find(x => x.type === 'wyrmslug').taunted, f);
  await ev("bibooGame.setEnemies([['wyrmslug', 130, 3000], ['goblin', 100, 3000]])"); await wait(300);
  await page.keyboard.down('KeyZ'); await page.keyboard.down('KeyW'); await wait(120); await page.keyboard.up('KeyZ'); await wait(900); await page.keyboard.up('KeyW'); await wait(300);
  f = await ev('bibooGame.enemies()');
  const sc = t => (f.find(x => x.type === t) || {}).scale;
  check('the Empowerment Beam grows a goblin but not the boss', sc('wyrmslug') === 1 && sc('goblin') > 1, f.map(x => [x.type, x.scale]));
  await ev("bibooGame.custom({ enemies: [{ type: 'boarlord', x: 250, fy: 0 }] })"); await wait(500);
  await ev('bibooGame.killFoe(0)'); await wait(300);
  const gems = await ev('bibooGame.gems()');
  check('a defeated boss drops 3 ankhs and a bunch of gems', gems.filter(g => g.kind === 'ankh').length === 3 && gems.length >= 11, gems.map(g => g.kind));
  console.log(errors.length ? errors : '');
  await b.close(); process.exit(res.every(Boolean) && !errors.length ? 0 : 1);
})();
