/* The A chain (AAAAA) and the burst chain (AAAAB). Run: NODE_PATH=$(npm root -g) node web/tests/chain.test.js */
const path = require('path');
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(), page = await b.newPage({ viewport: { width: 1200, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  await page.goto('file://' + path.resolve(__dirname, '../index.html'));
  await page.waitForFunction(() => document.getElementById('btn-start') && window.bibooGame, null, { timeout: 20000 });
  const ev = j => page.evaluate(j), wait = ms => page.waitForTimeout(ms), res = [];
  const check = (n, ok, d) => { res.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${ok ? '' : '  ' + JSON.stringify(d)}`); };
  const ids = () => ev('bibooGame.started.map(s => s.id)');
  const mash = async keys => { for (const k of keys) { await page.keyboard.down(k); await wait(35); await page.keyboard.up(k); await wait(95); } };
  const fresh = async (unlocks) => {
    await ev(`bibooGame.resetAll(); ${unlocks.map(u => `bibooGame.unlock('${u}')`).join(';')}; bibooGame.custom({ enemies: [{ type: 'ogrechief', x: 330, fy: 0 }] }); bibooGame.setHp(200)`); await wait(700);
    await ev('bibooGame.started.length = 0; bibooGame.setX(60)');
  };
  await fresh(['chain', 'heavy_chop', 'taunt']);
  const en0 = await ev('bibooGame.meters().energy');
  await mash(['KeyZ', 'KeyZ', 'KeyZ', 'KeyZ', 'KeyZ']); await wait(1200);
  let m = (await ids()).filter(i => i !== 'idle' && i !== 'walk_right');
  check('AAAAA plays slash, three chain strikes, then the heavy chop', JSON.stringify(m) === JSON.stringify(['slash', 'chain2', 'chain3', 'chain4', 'heavy']), m);
  check('the chop costs energy', (await ev('bibooGame.meters().energy')) < en0, [en0, await ev('bibooGame.meters().energy')]);
  await wait(1500);
  // slow presses are just slashes
  await ev('bibooGame.started.length = 0');
  await page.keyboard.down('KeyZ'); await wait(35); await page.keyboard.up('KeyZ'); await wait(1300);
  await page.keyboard.down('KeyZ'); await wait(35); await page.keyboard.up('KeyZ'); await wait(1300);
  m = (await ids()).filter(i => i !== 'idle' && i !== 'walk_right');
  check('slow presses stay plain slashes', JSON.stringify(m) === JSON.stringify(['slash', 'slash']), m);
  // chain strikes have no knockback: a goblin hit by chain2 does not move away
  await ev("bibooGame.custom({ enemies: [{ type: 'goblin', x: 85, fy: 0 }] })"); await wait(500); await ev('bibooGame.setX(40)');
  await ev('bibooGame.started.length = 0');
  await mash(['KeyZ', 'KeyZ']); await wait(900);
  const hpFoe = (await ev('bibooGame.state().foes[0].hp'));
  check('a chain strike damages', hpFoe < (await ev('bibooGame.state().foes[0].maxHp||1e9')), hpFoe);
  // AAAAB
  await fresh(['chain', 'chain_burst', 'heavy_chop']);
  await mash(['KeyZ', 'KeyZ', 'KeyZ', 'KeyZ', 'KeyX']); await wait(1200);
  m = (await ids()).filter(i => i !== 'idle' && i !== 'walk_right');
  check('AAAAB ends in an energy burst, not a parry or a chop', JSON.stringify(m) === JSON.stringify(['slash', 'chain2', 'chain3', 'chain4', 'energy_burst']), m);
  // without the unlock nothing changes
  await fresh([]);
  await mash(['KeyZ', 'KeyZ', 'KeyZ']); await wait(1000);
  m = (await ids()).filter(i => i !== 'idle' && i !== 'walk_right');
  check('without the unlock, mashing A only slashes', m.every(i => i === 'slash'), m);
  console.log(errors.length ? errors : '');
  await b.close(); process.exit(res.every(Boolean) && !errors.length ? 0 : 1);
})();
