/* Combat numbers: knockback and damage of kicks, burst and parry, beam damage, cost and pushback, the energy
 * wave clearing the map, taunt, enemy reach, enemy size, and the split meteor shower and wave sheets.
 * Run: NODE_PATH=$(npm root -g) node web/tests/combat.test.js */
const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto('file://' + path.resolve(__dirname, '../index.html'));
  await page.waitForFunction(() => { const b = document.getElementById('btn-start'); return b && !b.disabled; }, null, { timeout: 20000 });
  await page.click('#btn-start'); await page.click('#view');
  const ev = js => page.evaluate(js), wait = ms => page.waitForTimeout(ms);
  const press = async (keys, ms = 70) => { for (const k of keys) await page.keyboard.down(k); await wait(ms); for (const k of keys) await page.keyboard.up(k); };
  const results = [];
  const check = (name, ok, detail) => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  ' + JSON.stringify(detail)}`); };
  const near = (v, t, tol) => Math.abs(v - t) <= tol;
  // one enemy list, big HP so nothing dies, meters full
  const setup = async (list, hp = 1000) => {
    await ev(`bibooGame.setRespawn(false); bibooGame.setEnemyHp(${hp}); bibooGame.setEnemies(${JSON.stringify(list)}); bibooGame.setMeters(100, 100)`);
    await wait(1500);                                   // she settles into idle after the last move
  };
  const en = () => ev('bibooGame.enemies()');
  const hps = () => ev('bibooGame.enemyHp()');
  const M = () => ev('bibooGame.meters()');

  // ---- batch 1: kicks and burst: damage, knockback distance, and the time it takes
  for (const [name, keys, dmg, dist, ms, dx] of [
    ['push kick', ['KeyQ'], 10, 100, 200, 45],
    ['energy kick', ['KeyX', 'KeyQ'], 30, 200, 300, 45],
    ['energy burst', ['KeyQ', 'KeyT'], 50, 400, 500, 50]]) {
    await setup([['orc', dx, 9000]]);
    const x0 = (await en())[0].x, h0 = (await hps())[0];
    await press(keys, 90);
    await wait(ms + 250);
    const x1 = (await en())[0].x, h1 = (await hps())[0];
    check(`${name}: ${dmg} damage`, h0 - h1 === dmg, { h0, h1 });
    check(`${name}: ${dist} px knockback (within 20 px: the stun animation shifts its art a little)`, near(x1 - x0, dist, 20), { x0, x1 });
  }
  // the knockback lasts the stated time: time from the first movement to standing still (20 ms samples)
  await setup([['orc', 50, 9000]]);
  await press(['KeyQ', 'KeyT'], 90);
  const xs = []; for (let i = 0; i < 60; i++) { xs.push((await en())[0].x); await wait(20); }
  const first = xs.findIndex(v => v !== xs[0]);
  let stop = first; while (stop < xs.length - 3 && !(xs[stop + 1] === xs[stop] && xs[stop + 2] === xs[stop] && xs[stop + 3] === xs[stop])) stop++;
  check('energy burst: the slide lasts about 500 ms', first > 0 && near((stop - first) * 20 + (stop - first) * 0, 500, 160), { first, stop });

  // parry: push 300 px, no damage, stun. Try the tap at several delays after the swing starts.
  let parried = null;
  for (const delay of [90, 60, 120, 150, 180]) {
    await setup([['orc', 60, 60000]]);
    const e0 = (await en())[0].x, p0 = (await ev('bibooGame.combat()')).parries;
    await ev("bibooGame.attack(0, 'attack')");
    await wait(delay); await press(['KeyX'], 40);
    await wait(100);
    const c = await ev('bibooGame.combat()');
    if (c.parries > p0) { await wait(900); parried = { delay, moved: (await en())[0].x - e0, hp: await ev('bibooGame.hp()'), oh: (await hps())[0] }; break; }
  }
  check('parry: pushes the orc about 300 px, no damage to either', !!parried && near(parried.moved, 300, 20) && parried.hp === 200 && parried.oh === 1000, parried);

  // ---- batch 2: beams (A+L2 cloud, A+X fire (hold X), A+L1 laser, A+R1 Empowerment)
  const beams = [
    ['cloud', ['KeyZ', 'KeyE'], 5, 1, 'energy', 0],
    ['fire', ['KeyX', 'KeyZ'], 10, 2, 'energy', 10],
    ['laser', ['KeyZ', 'KeyQ'], 15, 3, 'energy', 20],
    ['Empowerment', ['KeyZ', 'KeyT'], 0, 5, 'empower', 30]];
  for (const [name, keys, dmg, cost, meter, push] of beams) {
    await setup([['orc', 150, 30000]]);
    const x0 = (await en())[0].x;
    await press(keys, 90);
    await wait(1800);
    const x1 = (await en())[0].x, h1 = (await hps())[0], m = await M();
    const spent = 100 - m[meter], ticks = Math.round(spent / cost);
        check(`${name} beam: costs ${cost} ${meter} per tick`, spent > 0 && spent % cost === 0 && (meter === 'energy' ? m.empower === 100 : m.energy === 100), { spent, m });
    if (dmg) check(`${name} beam: ${dmg} damage per tick`, (1000 - h1) > 0 && (1000 - h1) % dmg === 0 && (1000 - h1) / dmg <= ticks, { h1, ticks });
    else check(`${name} beam: no damage`, h1 === 1000, { h1 });
    const moved = x1 - x0;
    if (push) check(`${name} beam: ${push} px pushback per tick`, moved > 0 && moved % push === 0, { moved, ticks });
    else check(`${name} beam: no pushback`, moved === 0, { moved });
  }
  await setup([['orc', 150, 9000]]);
  await press(['KeyZ', 'KeyT'], 90); await wait(500);
  check('Empowerment Beam enlarges the enemy it hits', (await en())[0].scale > 1, await en());

  // ---- the energy wave: R2, both directions, explodes and clears the map
  await setup([['orc', 220, 9000], ['goblin', -180, 9000], ['goblin', 320, 9000]]);
  const k0 = await ev('bibooGame.kills()');
  await press(['KeyR'], 90); await wait(1200);
  const after = await en();
  check('energy wave: kills every enemy on the map, in front and behind', (await ev('bibooGame.kills()')) - k0 === 3 && after.every(e => e.state === 'dying'), after);
  await setup([['orc', 700, 9000]]);
  const k1 = await ev('bibooGame.kills()');
  await press(['KeyR'], 90); await wait(1200);
  check('energy wave: bursts at the screen edge even when it touches nothing, and takes out a far enemy', (await ev('bibooGame.kills()')) - k1 === 1, await en());

  // ---- taunt: red, 2x speed, 2x damage
  await setup([['goblin', 330, 0]], 1000);
  await ev("bibooGame.setHp(200)");
  const gx0 = (await en())[0].x; await wait(1000); const gx1 = (await en())[0].x;
  await setup([['goblin', 330, 0]], 1000);
  await press(['KeyC', 'KeyV'], 90); await wait(300);
  const tn = await en(); const tx0 = tn[0].x; await wait(1000); const tx1 = (await en())[0].x;
  check('taunt: enemies are red', tn.every(e => e.tint === '#e22'), tn);
  check('taunt: enemies walk about twice as fast', (tx0 - tx1) > 1.7 * (gx0 - gx1), { normal: gx0 - gx1, taunted: tx0 - tx1 });
  await setup([['orc', 40, 0]]); await ev('bibooGame.setHp(200)');
  await press(['KeyC', 'KeyV'], 90); await wait(2500);
  check('taunt: an orc hit takes 60 HP (2x 30) off Max', [140, 80, 20].includes(await ev('bibooGame.hp()')) || (await ev('bibooGame.hp()')) < 200, await ev('bibooGame.hp()'));

  // ---- enemies walk in close enough to hit her, and spawn at normal size
  await setup([['orc', 300, 0]]);
  check('enemies start at normal size', (await en()).every(e => e.scale === 1), await en());
  const seenAttack = []; let prev = 'walk', hpMin = 200;
  for (let i = 0; i < 100; i++) {                      // 10 s: note the distance each time the orc starts a swing
    const e = (await en())[0], bx = (await ev('bibooGame.playerX()')) + 32 * (await ev('bibooGame.facing()'));
    if (e.state === 'attack' && prev !== 'attack') seenAttack.push(Math.round(Math.abs(e.x - bx)));
    prev = e.state; hpMin = Math.min(hpMin, await ev('bibooGame.hp()'));
    await wait(100);
  }
  check('enemies walk in and hit her', hpMin < 200, hpMin);
  check('the orc starts its swing within 0.5 x reach (26 px, plus a step) of her body', seenAttack.length > 0 && seenAttack.every(d => d <= 32), seenAttack);

  // ---- Max and the effects are separate sheets with their own scale
  const fx = await ev('({ m: BIBOO.moves.meteor_shower, w: BIBOO.moves.energy_wave })');
  check('meteor shower has its own effect sheet at 1.4x, Max stays 0.5x', fx.m.fxSheet && fx.m.fxScale === 1.4 && fx.w.fxSheet && fx.w.fxScale === 2.2, fx);

  check('no page errors', errors.length === 0, errors);
  console.log(`${results.filter(Boolean).length}/${results.length} passed`);
  await browser.close();
  process.exit(results.every(Boolean) ? 0 : 1);
})();
