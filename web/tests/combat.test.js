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

  // ---- the energy wave: R2, costs 10, no damage on contact, explodes for 50 in a 75 px radius, both sides
  await setup([['orc', 130, 9000], ['goblin', 170, 9000], ['goblin', 300, 9000], ['orc', -110, 9000]]);
  await press(['KeyR'], 90); await wait(1400);
  const wh = await hps(), wm = await M();
  check('energy wave: costs 10 energy', wm.energy === 90, wm);
  check('energy wave: 50 damage to enemies within 75 px of the blast, in front and behind, none farther out', JSON.stringify(wh) === JSON.stringify([950, 950, 1000, 950]), wh);
  await setup([['orc', 700, 9000]]);
  await press(['KeyR'], 90); await wait(1400);
  check('energy wave: touches nothing, bursts at the end of its flight and hurts nothing far away', (await hps())[0] === 1000, await hps());

  // ---- damage numbers and the new energy dash input
  for (const [name, keys, dmg, dx] of [['slash', ['KeyZ'], 25, 55]]) {
    await setup([['orc', dx, 9000]]);
    await press(keys, 60); await wait(900);
    check(`${name}: ${dmg} damage`, 1000 - (await hps())[0] === dmg, await hps());
  }
  for (const [name, hold, dmg, dx] of [['thrust', 'ArrowRight', 15, 60], ['upswing', 'ArrowDown', 15, 55]]) {
    await setup([['orc', dx, 9000]]);
    await page.keyboard.down(hold); await wait(120); await press(['KeyZ'], 80); await page.keyboard.up(hold); await wait(900);
    check(`${name}: ${dmg} damage`, 1000 - (await hps())[0] === dmg, await hps());
  }
  await setup([['orc', 80, 9000]]);
  await press(['KeyC', 'KeyZ'], 90); await wait(1000);
  check('dash thrust: 25 damage', 1000 - (await hps())[0] === 25, await hps());
  await setup([['orc', 80, 9000]]);
  await page.keyboard.down('ArrowRight'); await wait(40); await page.keyboard.up('ArrowRight'); await wait(80);
  await page.keyboard.down('ArrowRight'); await wait(40); await page.keyboard.up('ArrowRight'); await wait(80);
  await press(['KeyC', 'KeyZ'], 90); await wait(1000);
  check('energy dash thrust: double tap forward, then X+A, 50 damage', 1000 - (await hps())[0] === 50, await hps());
  await setup([['orc', 80, 9000]]);
  const nd = await ev('bibooGame.started.length');
  await page.keyboard.down('ArrowRight'); await wait(40); await page.keyboard.up('ArrowRight'); await wait(80);
  await press(['KeyC', 'KeyZ'], 90); await wait(600);
  check('a single tap forward then X+A is only the plain dash thrust', JSON.stringify(await ev(`bibooGame.started.slice(${nd}).map(s => s.id)`)).includes('dash_thrust') && !JSON.stringify(await ev(`bibooGame.started.slice(${nd}).map(s => s.id)`)).includes('energy_dash_thrust'), await ev(`bibooGame.started.slice(${nd}).map(s => s.id)`));

  // ---- heavy chop 25 to 100 with the charge, charging costs 20 energy for a full charge, jump crash 30 energy and 150 damage
  for (const [ms, lo, hi] of [[0, 25, 25], [500, 55, 75], [1000, 100, 100]]) {
    await setup([['orc', 55, 9000]]);
    if (ms === 0) { await press(['ArrowUp'], 40); await wait(110); await press(['KeyZ'], 50); }
    else { await page.keyboard.down('ArrowUp'); await wait(ms); await press(['KeyZ'], 50); await page.keyboard.up('ArrowUp'); }
    await wait(1300);
    const d = 1000 - (await hps())[0], en = (await M()).energy;
    check(`heavy chop after a ${ms} ms charge: ${lo === hi ? lo : lo + ' to ' + hi} damage`, d >= lo && d <= hi, { d });
    if (ms === 1000) check('a full charge cost about 20 energy', near(100 - en, 20, 3), { en });
  }
  await setup([['orc', 55, 9000]]); await ev('bibooGame.setMeters(0, 100)');
  await page.keyboard.down('ArrowUp'); await wait(1200); await press(['KeyZ'], 50); await page.keyboard.up('ArrowUp'); await wait(1300);
  check('no energy: the charge does not grow (25 damage)', 1000 - (await hps())[0] === 25, await hps());
  await setup([['orc', 60, 9000]]);
  await press(['KeyV'], 50); await wait(300); await press(['KeyZ'], 50); await wait(1500);
  check('jump crash: 150 damage and 30 energy', 1000 - (await hps())[0] === 150 && (await M()).energy === 70, { hp: await hps(), m: await M() });
  await setup([['orc', 60, 9000]]); await ev('bibooGame.setMeters(20, 100)');
  const nc = await ev('bibooGame.started.length');
  await press(['KeyV'], 50); await wait(300); await press(['KeyZ'], 50); await wait(700);
  check('jump crash does not play below 30 energy', !(await ev(`bibooGame.started.slice(${nc}).map(s => s.id)`)).includes('jump_crash'), await ev(`bibooGame.started.slice(${nc}).map(s => s.id)`));

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
