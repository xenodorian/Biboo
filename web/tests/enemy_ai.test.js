/* Enemy logic: double sight, every enemy drops from a platform and climbs up to her, attacks when her hurtbox is inside the reach of its
 * damage box, and the damage boxes sit over the weapon (not the body). Run: NODE_PATH=$(npm root -g) node web/tests/enemy_ai.test.js */
const path = require('path');
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(), page = await b.newPage({ viewport: { width: 1000, height: 640 } });
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  await page.goto('file://' + path.resolve(__dirname, '../index.html'));
  await page.waitForFunction(() => document.getElementById('btn-start') && window.bibooGame, null, { timeout: 20000 });
  const ev = j => page.evaluate(j), wait = ms => page.waitForTimeout(ms), res = [];
  const check = (n, ok, d) => { res.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${ok ? '' : '  ' + JSON.stringify(d)}`); };
  const S = () => ev('bibooGame.state()');
  const types = await ev("Object.keys(window.BIBOO.enemies).filter(t => !window.BIBOO.enemies[t].ai.prop)");
  // 1. damage boxes: forward of the body's middle, and only on attack frames
  const bad = await ev(`(() => { const out = []; for (const t of ${JSON.stringify(types)}) { const T = window.BIBOO.enemies[t];
    for (const [a, A] of Object.entries(T.anims)) for (const k of A.frames) { const f = T.frames[k]; if (!f.hit) continue;
      if (!T.ai.attacks.includes(a) && a !== T.ai.dive?.anim) out.push(t + ':' + a + ' has a damage box but is not an attack');
      if (t !== 'goblin' && t !== 'orc' && f.hurt && f.hit[2] > (f.hurt[0] + f.hurt[2]) / 2 + 1) out.push(t + ':' + a + ' box reaches behind the middle of the body'); } } return out; })()`);
  check('damage boxes exist only on attack frames and stay in the front half of the body', bad.length === 0, bad.slice(0, 5));
  const wide = await ev(`(() => { const out = []; for (const t of ${JSON.stringify(types)}) { if (t === 'goblin' || t === 'orc' || t === 'mirrormax') continue; const T = window.BIBOO.enemies[t];
    for (const f of T.frames) if (f.hit && (f.hit[2] - f.hit[0]) > (T.cell[0] * 0.45)) out.push(t); } return out; })()`);
  check('no damage box is wider than 45% of its sprite', wide.length === 0, wide);
  // 2. every enemy drops off a platform to reach her
  await ev(`bibooGame.custom(${JSON.stringify({ plats: [{ x0: 150, x1: 330, top: 40 }], enemies: [] })})`); await wait(600);
  for (const t of types) {
    await ev(`bibooGame.custom(${JSON.stringify({ plats: [{ x0: 150, x1: 330, top: 40 }], enemies: [{ type: t, x: 250, fy: 40, path: [170, 310], sight: 10 }] })})`); await wait(500);
    await ev('bibooGame.setHp(200)'); await ev('bibooGame.setX(60)');
    let dropped = false;
    for (let i = 0; i < 140 && !dropped; i++) { await wait(50); await ev('bibooGame.setHp(200)'); const f = (await S()).foes[0]; if (f && f.fy === 0) dropped = true; }
    check(`${t} drops off its platform toward her`, dropped, (await S()).foes);
  }
  // 3. sight is doubled: an enemy with sight 60 notices her from just under 120 px (patrol -> chase)
  await ev(`bibooGame.custom(${JSON.stringify({ enemies: [{ type: 'hobgoblin', x: 300, fy: 0, path: [295, 305], sight: 60 }] })})`); await wait(600);
  await ev('bibooGame.setHp(200)'); await ev('bibooGame.setX(300 - 32 - 100)'); await wait(500);
  let st = (await S()).foes[0];
  check('sight 60 now notices her at about 100 px', st && st.state !== 'patrol', st);
  await ev(`bibooGame.custom(${JSON.stringify({ enemies: [{ type: 'hobgoblin', x: 300, fy: 0, path: [295, 305], sight: 60 }] })})`); await wait(600);
  await ev('bibooGame.setHp(200)'); await ev('bibooGame.setX(300 - 32 - 160)'); await wait(500);
  st = (await S()).foes[0];
  check('and not at 160 px', st && st.state === 'patrol', st);
  // 4. attacks go out when her hurtbox is inside the reach of a damage box
  for (const t of types) {
    await ev(`bibooGame.custom(${JSON.stringify({ enemies: [] })})`); await wait(500);
    await ev('bibooGame.setHp(200)'); await ev('bibooGame.setX(60)');
    await ev(`bibooGame.setEnemies([['${t}', 330, 0]])`);
    let at = null;
    for (let i = 0; i < 300 && at === null; i++) { await wait(25); await ev('bibooGame.setHp(200)'); const s = await S(), f = s.foes[0]; if (f && f.state === 'attack' && f.anim !== 'dive') at = { x: f.x, px: s.px, anim: f.anim }; }
    check(`${t} attacks once she is within reach`, at !== null, at);
  }
  check('no page errors', errors.length === 0, errors);
  await b.close(); process.exit(res.every(Boolean) ? 0 : 1);
})();
