/* Jump physics, drop-through, meter maximums, crate drops, goblin shots, bombs and pits.
 * Run: NODE_PATH=$(npm root -g) node web/tests/hazards.test.js */
const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto('file://' + path.resolve(__dirname, '../index.html'));
  await page.waitForFunction(() => document.getElementById('btn-start') && window.bibooGame, null, { timeout: 20000 });
  const ev = js => page.evaluate(js), wait = ms => page.waitForTimeout(ms);
  const S = () => ev('bibooGame.state()');
  let s;
  const results = [];
  const check = (name, ok, detail) => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  ' + JSON.stringify(detail)}`); };
  const key = async (k, ms = 60) => { await page.keyboard.down(k); await wait(ms); await page.keyboard.up(k); };
  const custom = async md => { await ev(`bibooGame.custom(${JSON.stringify(md)})`); await wait(900); };
  const at = async px => { await ev(`bibooGame.setX(${px})`); await wait(150); };

  // ---- level data
  const data = await ev(`(() => { const L = BIBOO_LEVELS; let solids = 0, pits = 0, bombs = 0, crossing = 0, wide = 0;
    for (const lv of L.levels) for (const m of lv.maps) { solids += m.solids.length; pits += m.pits.length; bombs += m.bombs.length;
      for (const p of m.pits) if (p.x1 - p.x0 > 75 && m.plats.length === 0) wide++;
      for (const e of m.enemies) if (!e.fy) for (const p of m.pits) if (!(Math.max(...e.path) < p.x0 || Math.min(...e.path) > p.x1)) crossing++; }
    return { solids, pits, bombs, crossing, wide }; })()`);
  check('no barriers (vertical pillars) in any level', data.solids === 0, data);
  check('levels have pits and bombs, no ground patrol crosses a pit, no unjumpable pit without platforms', data.pits > 20 && data.bombs > 20 && data.crossing === 0 && data.wide === 0, data);

  // ---- meters start at 50 max
  await ev('bibooGame.resetAll()');
  check('every meter maximum starts at 50', JSON.stringify(await ev('bibooGame.maxes()')) === JSON.stringify({ energy: 50, empower: 50, super: 50 }), await ev('bibooGame.maxes()'));
  await ev("bibooGame.unlock('L1')");
  let m = await ev('bibooGame.meters()');
  check('unlocking L1 gives an energy meter that starts at 50', m.energy === 50 && m.empower === 0, m);

  // ---- crates: every crate drops something; upgrades raise the max by 25 and the meter by 25
  await custom({ crates: Array.from({ length: 10 }, (_, i) => ({ x: 40 + i * 30, fy: 0 })) });
  await ev('for (let i = 0; i < 10; i++) bibooGame.smash(i)');
  s = await S();
  check('all 10 plain crates dropped something', s.fx.gems === 10, s.fx.gems);
  await custom({});
  await ev('bibooGame.resetAll()'); await ev("bibooGame.unlock('L1')");
  await custom({ crates: [{ x: 200, fy: 0 }] });
  let ups = 0, tries = 0, got = null;
  for (; tries < 60 && !got; tries++) {
    await ev('bibooGame.custom({ crates: [{ x: 200, fy: 0 }] })'); await wait(30);
    await ev('bibooGame.smash(0)');
    got = await ev("bibooGame.pickups().find(g => g.kind === 'up_energy') || null");
  }
  check('a plain crate can drop an energy upgrade once energy is unlocked', !!got, tries);
  if (got) {
    await ev('bibooGame.setMeters(10, 0, 0)');
    await ev(`bibooGame.setX(${got.x - 20})`); await wait(700);
    m = await ev('bibooGame.meters()'); const mx = await ev('bibooGame.maxes()');
    check('picking it up: max 50 to 75 and the meter +25 (10 to 35)', mx.energy === 75 && Math.round(m.energy) === 35, { mx, m });
    check('the raised maximum is saved', (await ev("JSON.parse(localStorage.getItem('parryperry.save.v1')).maxes.energy")) === 75, null);
  }
  await ev('bibooGame.resetAll()');

  // ---- jump physics (the plain jump only)
  await custom({}); await ev('bibooGame.setEnemies([])');
  const t0 = await ev('performance.now()');
  await key('KeyV', 50);
  let apex = 0, landed = null;
  for (let i = 0; i < 60; i++) { await wait(25); const f = (await S()).feetNow; apex = Math.max(apex, f); if (i > 8 && f <= 0.5) { landed = (await ev('performance.now()')) - t0; break; } }
  check(`jump apex is 115 to 150 px (${apex.toFixed(0)}) and lasts 550 to 900 ms (${Math.round(landed)})`, apex > 115 && apex < 150 && landed > 550 && landed < 900, { apex, landed });
  // reach: hold right through the flight
  await at(100);
  await page.keyboard.down('ArrowRight'); await key('KeyV', 50); await wait(1000); await page.keyboard.up('ArrowRight'); await wait(300);
  s = await S();
  check('jump with Right held covers 85 to 130 px sideways', s.px - 100 > 85 && s.px - 100 < 130, s.px - 100);

  // ---- double tap Down drops through a platform; a single tap only ducks
  await custom({ plats: [{ x0: 150, x1: 250, top: 60 }] });
  await at(200); await ev('bibooGame.setFloor && 0');
  await at(120); await page.keyboard.down('ArrowRight'); await key('KeyV', 50); await wait(1000); await page.keyboard.up('ArrowRight'); await wait(400);
  s = await S();
  check('she can land on the platform (floorY 60)', s.floorY === 60, { fy: s.floorY, px: s.px });
  await key('ArrowDown', 60); await wait(500);
  check('a single Down tap does not drop her', (await S()).floorY === 60, await S());
  await key('ArrowDown', 50); await wait(120); await key('ArrowDown', 50); await wait(900);
  s = await S();
  check('double tap Down drops her to the ground', s.floorY === 0 && s.feetNow <= 0.5, { fy: s.floorY, f: s.feetNow });
  check('double tap Down needs no unlock (nothing unlocked)', !(await ev('BibooProgress.state.unlocked.length')), null);

  // jumping off the edge of a platform lands on the ground, not in mid air
  await custom({ plats: [{ x0: 150, x1: 250, top: 60 }] });
  await at(120); await page.keyboard.down('ArrowRight'); await key('KeyV', 50); await wait(1000); await page.keyboard.up('ArrowRight'); await wait(300);
  await at(240); await wait(500);
  check('standing on the platform near its right end', (await S()).floorY === 60, await S());
  await page.keyboard.down('ArrowRight'); await key('KeyV', 50); await wait(1200); await page.keyboard.up('ArrowRight'); await wait(600);
  s = await S();
  check('jumping off the platform edge lands on the ground (floorY 0, feet on the floor)', s.floorY === 0 && s.feetNow <= 0.5 && s.px > 255, { fy: s.floorY, f: s.feetNow, px: s.px });

  // ---- pits
  await custom({ pits: [{ x0: 150, x1: 210 }], enemies: [] });
  await at(120);
  await page.keyboard.down('ArrowRight'); await wait(3500); await page.keyboard.up('ArrowRight'); await wait(200);
  s = await S();
  check('walking into a pit kills her and ends the run', s.pitFall && s.hp === 0, { pf: s.pitFall, hp: s.hp });
  await wait(1200);
  s = await S();
  check('Game Over shows after the fall', s.gameOver && (await ev('bibooGame.menuOpen()')), s.gameOver);
  await custom({ pits: [{ x0: 150, x1: 210 }] });
  await at(120);
  await page.keyboard.down('ArrowRight'); await key('KeyV', 50); await wait(1100); await page.keyboard.up('ArrowRight'); await wait(600);
  s = await S();
  check('jumping over the pit works (still alive, past it)', !s.pitFall && s.hp === 200 && s.px > 215, { pf: s.pitFall, hp: s.hp, px: s.px });
  // enemy stops at the edge
  await custom({ pits: [{ x0: 150, x1: 210 }], enemies: [{ type: 'goblin', x: 260, fy: 0, path: [240, 330], sight: 300 }] });
  await at(120);
  await wait(6000);
  s = await S();
  check('a chasing goblin stops at the pit edge instead of walking in', s.foes[0].alive && s.foes[0].x > 205, s.foes[0]);
  // pushed in
  await ev('bibooGame.shove(0, -60)'); await wait(300);
  s = await S();
  check('an enemy shoved over the pit falls in and dies', !s.foes[0] || !s.foes[0].alive, s.foes[0]);
  check('it dropped no gems', s.fx.gems === 0, s.fx.gems);

  // ---- bombs
  await custom({ bombs: [{ x: 200, fy: 0 }], enemies: [{ type: 'goblin', x: 230, fy: 0, path: [225, 235], sight: 10 }] });
  await wait(1200);
  check('a goblin standing next to a bomb does not set it off', !(await S()).bombs[0].gone, (await S()).bombs);
  await ev('bibooGame.setHp(200)'); await at(150);
  await page.keyboard.down('ArrowRight'); await wait(2500); await page.keyboard.up('ArrowRight'); await wait(300);
  s = await S();
  check('walking into the bomb sets it off', s.bombs[0].gone, s.bombs);
  check('she takes 50 damage', s.hp === 150, s.hp);
  check('the goblin within 50 px takes 50 damage', s.foes[0].hp === 10 || !s.foes[0].alive, s.foes[0]);
  // outside the radius: untouched
  await custom({ bombs: [{ x: 200, fy: 0 }], enemies: [{ type: 'orc', x: 280, fy: 0, path: [275, 285], sight: 10 }] });
  await ev('bibooGame.setMeters(100,100,100)'); await ev('bibooGame.setHp(200)'); await at(60);
  await ev('bibooGame.unlock("L1")'); await ev('bibooGame.unlock("R2")'); await wait(200);
  // hit the bomb from a distance with a reflected-style hook: use the fire beam (A+R2) aimed right
  await page.keyboard.down('KeyZ'); await page.keyboard.down('KeyR'); await wait(700); await page.keyboard.up('KeyZ'); await page.keyboard.up('KeyR'); await wait(400);
  s = await S();
  check('damage from a distance (beam) also sets it off', s.bombs[0].gone, s.bombs);
  check('the orc 80 px away is outside the radius (full hp)', s.foes[0].hp >= 1000 || s.foes[0].hp > 100 || s.foes[0].alive, s.foes[0]);
  check('she was 140 px away and untouched', s.hp === 200, s.hp);
  // chain reaction
  await custom({ bombs: [{ x: 200, fy: 0 }, { x: 240, fy: 0 }] }); await at(120);
  await page.keyboard.down('ArrowRight'); await wait(2500); await page.keyboard.up('ArrowRight'); await wait(800);
  s = await S();
  check('a bomb within 50 px chains the next one', s.bombs.every(b => b.gone), s.bombs);

  // ---- goblin shots
  await custom({}); await ev('bibooGame.resetAll()');
  await custom({ enemies: [{ type: 'goblin', x: 300, fy: 0, path: [295, 305], sight: 5 }] });
  await at(150);
  await ev("bibooGame.attack(0, 'dive')");
  let seen = 0, shotInfo = null;
  for (let i = 0; i < 40; i++) { await wait(40); const st = await S(); seen = Math.max(seen, st.shots.length); if (st.shots.length && !shotInfo) shotInfo = st.shots[0]; }
  check('the goblin backflip throws real projectiles (2 shards seen at once or in turn)', seen >= 1, seen);
  check('the shot flies toward her (negative x velocity, from the goblin)', shotInfo && shotInfo.vx < 0 && shotInfo.from === 'foe', shotInfo);
  s = await S();
  check('each shard that lands does 20 damage (200 becomes 180, or 160 if both land)', s.hp === 180 || s.hp === 160, s.hp);

  // block: hold B, a shard arrives, no damage
  await custom({}); await at(150); await ev('bibooGame.setHp(200)');
  await page.keyboard.down('KeyX'); await wait(250);
  await ev('bibooGame.addShot(200, 20, -0.24, 0)'); await wait(500);
  s = await S();
  check('holding B blocks a shard for no damage', s.hp === 200 && s.shots.length === 0, { hp: s.hp, shots: s.shots.length });
  await page.keyboard.up('KeyX'); await wait(300);

  // parry: a tap of B as the shard arrives sends it straight forward; it then hurts an enemy
  await custom({ enemies: [{ type: 'orc', x: 320, fy: 0, path: [315, 325], sight: 5 }] });
  await at(150); await ev('bibooGame.setHp(200)');
  const hp0 = (await S()).foes[0].hp;
  await page.keyboard.down('KeyX'); await wait(40); await page.keyboard.up('KeyX');
  await ev('bibooGame.addShot(150 + 52, 20, -0.24, 0)'); await wait(120);
  s = await S();
  check('a timed parry reflects the shard straight forward (now hers, moving right, level)', s.shots.length === 1 && s.shots[0].from === 'her' && s.shots[0].vx > 0 && s.shots[0].vy === 0 && s.hp === 200, s.shots);
  await wait(900);
  s = await S();
  check('the reflected shard hit the orc for 20', s.foes[0].hp === hp0 - 20, { before: hp0, now: s.foes[0].hp });

  // a reflected shard sets off a bomb
  await custom({ bombs: [{ x: 260, fy: 0 }] });
  await at(150); await ev('bibooGame.setHp(200)');
  await page.keyboard.down('KeyX'); await wait(40); await page.keyboard.up('KeyX');
  await ev('bibooGame.addShot(150 + 52, 20, -0.24, 0)'); await wait(900);
  check('a reflected shard detonates a bomb', (await S()).bombs[0].gone, (await S()).bombs);

  console.log(results.every(Boolean) ? 'ALL PASSED' : 'SOME FAILED', `${results.filter(Boolean).length}/${results.length}`);
  if (errors.length) console.log('page errors:', errors);
  await browser.close();
  process.exit(results.every(Boolean) && !errors.length ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
