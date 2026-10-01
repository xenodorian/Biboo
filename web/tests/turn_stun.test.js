/* Turning keeps her body where it was (the anchor moves, not the feet), and a hit taken in the air over a platform lands on it.
 * Run: NODE_PATH=$(npm root -g) node web/tests/turn_stun.test.js */
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
  const tap = async (k, ms = 60) => { await page.keyboard.down(k); await wait(ms); await page.keyboard.up(k); };
  const body = async () => { const s = await S(); const f = await ev('bibooGame.facing()'); return { b: s.px + f * 19, f, px: s.px, fy: s.floorY }; };

  // ---- turning on open ground: the body stays put
  await ev(`bibooGame.custom(${JSON.stringify({ enemies: [] })})`); await wait(900);
  await ev('bibooGame.setX(200)'); await wait(500);
  let a = await body();
  await tap('ArrowLeft', 40); await wait(500);
  let c = await body();
  check('turning left flips her about the point between her legs (it stays within 4 px)', a.f === 1 && c.f === -1 && Math.abs(c.b - a.b) < 4, { a, c });
  await tap('ArrowRight', 40); await wait(500);
  let d = await body();
  check('turning back right keeps the body in place too', d.f === 1 && Math.abs(d.b - c.b) < 4, { c, d });

  // ---- turning on a narrow ledge does not carry her feet off it
  await ev(`bibooGame.custom(${JSON.stringify({ plats: [{ x0: 150, x1: 200, top: 60 }], enemies: [] })})`); await wait(900);
  await ev('bibooGame.setX(175)'); await wait(300);
  await tap('ArrowUp', 50); await wait(1400);
  let s = await S();
  check('set up: standing on the 50 px ledge', s.floorY === 60, s);
  for (let i = 0; i < 6; i++) { await tap(i % 2 ? 'ArrowRight' : 'ArrowLeft', 40); await wait(350); }
  s = await S();
  check('after six quick turns she is still standing on the ledge', s.floorY === 60, { fy: s.floorY, px: s.px });

  // ---- a hit taken in the air above a platform lands on the platform, not through it
  await ev(`bibooGame.custom(${JSON.stringify({ plats: [{ x0: 150, x1: 330, top: 30 }], enemies: [{ type: 'goblin', x: 235, fy: 30, path: [235, 235], sight: 0 }] })})`); await wait(900);
  await ev('bibooGame.setX(200)'); await wait(600);
  let minFloor = 1e9, hit = false, landed = null, tries = 0;
  await tap('ArrowUp', 40); await wait(300);
  await ev("bibooGame.setRespawn(false); bibooGame.attack(0, 'slash')");
  for (let i = 0; i < 70; i++) { await wait(30); const t = await S(); minFloor = Math.min(minFloor, t.floorY); landed = t.floorY; }
  hit = (await ev('bibooGame.combat()')).hits >= 1;
  check('(she was hit in the air)', hit, await ev('bibooGame.combat()'));
  check('after the hit she is standing on the platform (floor 30)', landed === 30, { landed, minFloor });
  // ---- a hit knocks her up about 5 px as well as back
  await ev(`bibooGame.custom(${JSON.stringify({ enemies: [] })})`); await wait(900);
  await ev('bibooGame.setX(200)'); await wait(400);
  await ev("bibooGame.setRespawn(false); bibooGame.setEnemies([['orc', 60, 99999]])"); await wait(1100);
  await ev("bibooGame.attack(0, 'attack')");
  let peak = 0;
  for (let i = 0; i < 40; i++) { await wait(25); const t = await S(); peak = Math.max(peak, t.feetNow); }
  check('a hit lifts her about 5 px (peak 3 to 7 px)', peak >= 3 && peak <= 7.5, peak);
  const after = await S();
  check('and she is back on the ground afterwards', after.feetNow === 0 && after.floorY === 0, after.feetNow);

  // ---- shot hits and blocked hits hop her up 5 px as well
  for (const blocking of [false, true]) {
    await ev(`bibooGame.custom(${JSON.stringify({ enemies: [] })})`); await wait(900);
    await ev('bibooGame.setX(150)'); await wait(400); await ev('bibooGame.setHp(200)');
    if (blocking) { await page.keyboard.down('KeyX'); await wait(250); }
    await ev('bibooGame.addShot(200, 20, -0.24, 0)');
    let pk = 0;
    for (let i = 0; i < 30; i++) { await wait(20); const t = await S(); pk = Math.max(pk, t.feetNow); }
    if (blocking) { await page.keyboard.up('KeyX'); await wait(300); }
    const t2 = await S();
    check(`a ${blocking ? 'blocked' : 'landed'} shard lifts her about 5 px (peak 3 to 7)`, pk >= 3 && pk <= 7.5, pk);
    check(`and she is back on the ground (${blocking ? 'blocked' : 'landed'})`, t2.feetNow === 0, t2.feetNow);
  }

  // ---- jumping down onto a crate smashes it
  await ev(`bibooGame.custom(${JSON.stringify({ enemies: [], crates: [{ x: 200, fy: 0 }, { x: 330, fy: 0 }] })})`); await wait(900);
  await ev('bibooGame.setX(190)'); await wait(400);
  let cr = (await S()).crates;
  check('set up: two whole crates', cr.length === 2 && cr.every(c => !c.broken), cr);
  await tap('ArrowUp', 40); await wait(1200);
  cr = (await S()).crates;
  check('jumping on the crate (straight up and down) smashes it', cr[0].broken, cr);
  check('the far crate is untouched', !cr[1].broken, cr);
  check('no page errors', errors.length === 0, errors);
  console.log(`${res.filter(Boolean).length}/${res.length} passed`); await b.close(); process.exit(res.every(Boolean) ? 0 : 1);
})();
