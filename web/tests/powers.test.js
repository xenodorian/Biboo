/* Flight (ABAB-Up), Rainbow Guard (ABABAB) and the Ultimate Chain. Run: NODE_PATH=$(npm root -g) node web/tests/powers.test.js */
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
  const fresh = async (unlocks, md) => {
    await ev(`bibooGame.resetAll(); ${unlocks.map(u => `bibooGame.unlock('${u}')`).join(';')}; bibooGame.custom(${JSON.stringify(md || { enemies: [] })}); bibooGame.setHp(100)`); await wait(600);
    await ev('bibooGame.started.length = 0; bibooGame.setX(60)');
  };
  // flight
  await fresh(['fly']);
  await mash(['KeyZ', 'KeyX', 'KeyZ', 'KeyX', 'ArrowUp']); await wait(500);
  let p = await ev('bibooGame.powers()');
  check('ABAB-Up starts flight', p.flying && p.y > 5, p);
  const y1 = p.y; await page.keyboard.down('ArrowUp'); await wait(600); p = await ev('bibooGame.powers()'); await page.keyboard.up('ArrowUp');
  check('Up climbs while flying', p.y > y1 + 20, [y1, p.y]);
  await wait(4200);
  p = await ev('bibooGame.powers()');
  check('flight ends after 5 seconds', !p.flying, p);
  await wait(1500); p = await ev('bibooGame.powers()');
  check('she lands afterwards', p.y < 2, p);
  await fresh([]);
  await mash(['KeyZ', 'KeyX', 'KeyZ', 'KeyX', 'ArrowUp']); await wait(300);
  check('no flight without the unlock', !(await ev('bibooGame.powers()')).flying);
  // slow input does not fly
  await fresh(['fly']);
  for (const k of ['KeyZ', 'KeyX', 'KeyZ', 'KeyX']) { await page.keyboard.down(k); await wait(35); await page.keyboard.up(k); await wait(900); }
  await mash(['ArrowUp']); await wait(200);
  check('slow ABAB then Up does not fly', !(await ev('bibooGame.powers()')).flying);
  // rainbow
  await fresh(['rainbow'], { enemies: [], pits: [{ x0: 120, x1: 200 }] });
  await mash(['KeyZ', 'KeyX', 'KeyZ', 'KeyX', 'KeyZ', 'KeyX']); await wait(300);
  p = await ev('bibooGame.powers()');
  check('ABABAB starts the rainbow guard', p.rainbow, p);
  check('she is tinted while it lasts', !!(await ev('bibooGame.combat().tint')), null);
  await ev('bibooGame.hurtHer(0); bibooGame.addShot(40, 20, 0.2, 0)');
  await wait(100); await ev('bibooGame.setX(150)'); await wait(600);
  p = await ev('bibooGame.powers()');
  check('she can stand over a pitfall', p.hp === 100 && p.y > -1 && p.rainbow, p);
  await wait(4600);
  check('it ends after 5 seconds', !(await ev('bibooGame.powers()')).rainbow);
  // ultimate
  await fresh(['chain', 'ultimate', 'heavy_chop', 'taunt', 'cloud_beam', 'fire_beam', 'laser_beam', 'empower_beam', 'meter_charge'], { enemies: [{ type: 'goblin', x: 300, fy: 0 }] });
  await ev('bibooGame.setMeters(500, 500, 0)');
  for (const k of ['KeyZ', 'KeyZ', 'KeyZ', 'KeyZ']) { await page.keyboard.down(k); await wait(35); await page.keyboard.up(k); await wait(60); }
  for (const k of ['KeyQ', 'KeyW', 'Digit1', 'Digit2']) await page.keyboard.down(k);
  await wait(60); for (const k of ['KeyQ', 'KeyW', 'Digit1', 'Digit2']) await page.keyboard.up(k);
  await wait(9000);
  const m = (await ids()).filter(i => i !== 'idle' && i !== 'walk_right' && i !== 'charge');
  console.log(JSON.stringify(m));
  const tail = m.slice(-5);
  check('ultimate: chain, taunt, then the four beams in order', JSON.stringify(tail) === JSON.stringify(['taunt', 'beam_plasma', 'beam_cloud', 'beam_fire', 'beam_laser']), m);
  console.log(errors.length ? errors : '');
  await b.close(); process.exit(res.every(Boolean) && !errors.length ? 0 : 1);
})();
