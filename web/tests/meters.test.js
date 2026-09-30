/* Energy and empower meters: on-screen bars, gem pickups and drops, and moves that do not play without meter.
 * Run: node web/tests/meters.test.js (needs playwright, like browser.test.js). */
const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto('file://' + path.resolve(__dirname, '../index.html'));
  await page.waitForFunction(() => { const b = document.getElementById('btn-start'); return b && !b.disabled; }, null, { timeout: 20000 });
  await page.click('#btn-start'); await page.evaluate('bibooGame.arena()'); await page.click('#view');
  const ev = js => page.evaluate(js), wait = ms => page.waitForTimeout(ms);
  const press = async (keys, ms = 70) => { for (const k of keys) await page.keyboard.down(k); await wait(ms); for (const k of keys) await page.keyboard.up(k); };
  const cur = () => ev('(c => c && c.id)(bibooGame.current())');
  const started = () => ev('bibooGame.started.map(s => s.id)');
  const meters = () => ev('bibooGame.meters()');
  const results = [];
  const check = (name, ok, detail) => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  ' + detail}`); };
  const reset = async (en, em) => { await ev(`bibooGame.setRespawn(false); bibooGame.setEnemyHp(null); bibooGame.setEnemies([]); bibooGame.setMeters(${en}, ${em})`); await wait(1500); };
  const tryMove = async (keys, ms = 250) => { const n = (await started()).length; await press(keys); await wait(ms); return (await started()).slice(n); };

  // the meters are drawn on top of the scene: sample the ENG and EMP bar pixels of the canvas
  await reset(50, 50);
  // (the canvas is tainted on file://, so read the pixels from a screenshot of it)
  const barPx = async (y) => {
    const b64 = (await page.locator('#view').screenshot()).toString('base64');
    return page.evaluate(([b, y]) => new Promise(res => {
      const im = new Image();
      im.onload = () => { const k = im.width / 384, c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
        const x = c.getContext('2d'); x.drawImage(im, 0, 0); const d = x.getImageData(Math.round(40 * k), Math.round(y * k), 1, 1).data; res([d[0], d[1], d[2]]); };
      im.src = 'data:image/png;base64,' + b;
    }), [b64, y]);
  };
  const eng = await barPx(27), emp = await barPx(36);
  check('the energy bar is visible (blue) on screen', eng[2] > 200 && eng[0] < 120, JSON.stringify(eng));
  check('the empower bar is visible (orange) on screen', emp[0] > 200 && emp[2] < 120, JSON.stringify(emp));

  // moves do not play without their meter
  await reset(0, 0);
  check('laser beam (A+L1) does not play at 0 energy', (await tryMove(['KeyZ', 'KeyQ'])).length === 0, await cur());
  check('energy wave (R2) does not play at 0 energy', (await tryMove(['KeyR'])).length === 0, await cur());
  check('Empowerment Beam (A+R1) does not play at 0 empower', (await tryMove(['KeyZ', 'KeyT'])).length === 0, await cur());
  await page.keyboard.down('KeyW'); await wait(300);
  check('kneeling to recover does not start at 0 empower', (await cur()) !== 'recover', await cur());
  await page.keyboard.up('KeyW');

  // with meter they play and pay
  await reset(100, 100);
  check('laser beam plays with energy', (await tryMove(['KeyZ', 'KeyQ'], 150)).includes('beam_laser'), await cur());
  check('the beam draws while it fires', !!(await ev('bibooGame.beam()')), 'no beam');
  await wait(900);
  const m1 = await meters();
  check('the beam spent energy, not empower', m1.energy < 100 && m1.energy >= 40 && m1.empower === 100, JSON.stringify(m1));
  await reset(100, 100);
  check('energy wave plays and costs 10', (await tryMove(['KeyR'], 150)).includes('energy_wave') && (await meters()).energy === 90, JSON.stringify(await meters()));
  await reset(0, 100);
  check('Empowerment Beam plays and spends empower', (await tryMove(['KeyZ', 'KeyT'], 500)).includes('beam_plasma') && (await meters()).empower < 100, JSON.stringify(await meters()));

  // a beam stops the moment the meter runs dry
  await reset(12, 0);
  await press(['KeyZ', 'KeyQ']); await wait(160);
  check('a beam starts with 12 energy', !!(await ev('bibooGame.beam()')), 'no beam');
  await wait(700);
  check('the beam stopped when the meter ran dry', !(await ev('bibooGame.beam()')) && (await meters()).energy < 5 && (await cur()) === 'idle', `${JSON.stringify(await meters())} ${await cur()}`);

  // recover drains empower and stops when it is empty
  await reset(0, 30); await ev('bibooGame.setHp(100)');
  await page.keyboard.down('KeyW'); await wait(1700);
  const hp = await ev('bibooGame.hp()'), mm = await meters(), c2 = await cur();
  await page.keyboard.up('KeyW');
  check('recover heals while it has empower, then stops', hp > 100 && mm.empower < 8 && c2 !== 'recover', `hp ${hp} ${JSON.stringify(mm)} ${c2}`);

  // gems: visible, picked up by walking over them, and dropped by kills
  await reset(0, 0);
  await ev("bibooGame.dropGem(50, 'energy'); bibooGame.dropGem(80, 'empower')");
  check('two gems lie on the ground', (await ev('bibooGame.gems()')).length === 2, 'no gems');
  await page.keyboard.down('ArrowRight'); await wait(2300); await page.keyboard.up('ArrowRight');
  const pk = await meters();
  check('walking over the gems fills both meters by 25', pk.energy === 25 && pk.empower === 25 && (await ev('bibooGame.gems()')).length === 0, JSON.stringify(pk));
  await reset(0, 0);
  await ev("bibooGame.setEnemyHp(1); bibooGame.setEnemies([['goblin', 90, 60000]])"); await wait(200);
  await press(['KeyC', 'KeyV']); await wait(800); await press(['KeyZ']); await wait(700);
  const gd = await ev('bibooGame.gems()');
  check('a taunted enemy always drops an empower gem', gd.length === 1 && gd[0].kind === 'empower', JSON.stringify(gd));
  let drops = 0;
  await ev('bibooGame.setMeters(0, 0)');
  for (let i = 0; i < 24; i++) {
    await ev("bibooGame.setEnemyHp(1); bibooGame.setEnemies([['goblin', 90, 3000]])"); await wait(100); await press(['KeyZ']); await wait(650);
  }
  drops = (await ev('bibooGame.gems()')).length;
  check('ordinary kills sometimes drop a gem', drops >= 1, `drops ${drops}`);

  check('no page errors', errors.length === 0, errors.join(' | '));
  const ok = results.filter(Boolean).length;
  console.log(`${ok}/${results.length} passed`);
  await browser.close();
  process.exit(ok === results.length ? 0 : 1);
})();
