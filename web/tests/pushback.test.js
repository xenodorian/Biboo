/* Enemy hits push her back 40 px (goblin) or 64 px (orc). A push only drops her into a pit when she is carried fully over the edge, and the run ends only once she has fallen to the bottom.
 * Run: NODE_PATH=$(npm root -g) node web/tests/pushback.test.js */
const path = require('path');
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(), page = await b.newPage({ viewport: { width: 1200, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  await page.goto('file://' + path.resolve(__dirname, '../index.html'));
  await page.waitForFunction(() => document.getElementById('btn-start') && window.bibooGame, null, { timeout: 20000 });
  const ev = j => page.evaluate(j), wait = ms => page.waitForTimeout(ms), res = [];
  const check = (n, ok, d) => { res.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${ok ? '' : '  ' + JSON.stringify(d)}`); };
  const custom = async md => { await ev(`bibooGame.custom(${JSON.stringify(md)})`); await wait(900); };
  const S = () => ev('bibooGame.state()');
  // the enemy stands on her right (she faces right), swings, and her displacement is measured
  async function hit(type, anim, px, pit) {
    await custom({ pits: pit ? [pit] : [], enemies: [] });
    await ev(`bibooGame.setX(${px})`); await wait(200);
    await ev(`bibooGame.setRespawn(false); bibooGame.setEnemies([['${type}', 60, 99999]])`); await wait(1200);
    const x0 = (await S()).px, h0 = await ev('bibooGame.hp()');
    await ev(`bibooGame.attack(0, '${anim}')`); await wait(1600);
    const s = await S();
    return { moved: x0 - s.px, hurt: h0 - await ev('bibooGame.hp()'), pitFall: !!s.pitFall, px: s.px, c: await ev('bibooGame.combat()') };
  }
  const narrow = await ev("(() => { const o = []; BIBOO_LEVELS.levels.forEach(l => l.maps.forEach(m => m.pits.forEach(p => { if (p.x1 - p.x0 < 50) o.push(m.id + ':' + (p.x1 - p.x0)); }))); return o; })()");
  check('every pit in every level is at least 50 px wide (both feet fit)', narrow.length === 0, narrow);
  const gob = await hit('goblin', 'slash', 100);
  check('a goblin hit pushes her back about 40 px', gob.hurt > 0 && Math.abs(gob.moved - 40) <= 12, gob);
  const orc = await hit('orc', 'attack', 100);
  check('an orc hit pushes her back about 64 px', orc.hurt > 0 && Math.abs(orc.moved - 64) <= 14, orc);
  // a goblin pushes her half over a pit edge (she stands 5 px past the right edge; 10 px push puts her centre inside the gap): no fall
  const edge = await hit('goblin', 'slash', 240, { x0: 150, x1: 210 });
  check('a push that only reaches half over the edge does not start a fall', edge.hurt > 0 && !edge.pitFall, edge);
  const ground = await ev("(() => { const s = bibooGame.state(); return s.feetNow; })()");
  check('she is standing on the ground at the edge afterwards', ground <= 1 && edge.px >= 149, { ground, px: edge.px });
  // knocked well into a wide pit: she falls, and Game Over waits until she has dropped all the way down
  await custom({ pits: [{ x0: 150, x1: 260 }], enemies: [] }); await ev('bibooGame.setX(270)'); await wait(200);
  await ev("bibooGame.setRespawn(false); bibooGame.setEnemies([['orc', 60, 99999]])"); await wait(1200);
  await ev("bibooGame.attack(0, 'attack')");
  let early = null, end = null, start = null;
  for (let i = 0; i < 80; i++) { await wait(25); const t = await S(); if (t.pitFall && !start) start = { px: t.px }; if (t.pitFall && t.gameOver && t.feetNow > -70) early = { feet: t.feetNow }; if (t.gameOver) { end = { feet: t.feetNow, hp: t.hp }; break; } }
  check('knocked into a pit: she falls', !!(await S()).pitFall);
  check('the fall starts only with both feet over the gap', !!start && start.px - 1 >= 149 && start.px + 38 <= 261 || (!!start && start.px - 38 >= 149 && start.px + 1 <= 261), start);
  check('no Game Over while she is still visible (feet above -70; she leaves the view at about -81)', !early, early);
  check('Game Over comes once she has fallen to the bottom', !!end && end.hp === 0, end);
  // walking in on purpose still falls
  await custom({ pits: [{ x0: 150, x1: 210 }], enemies: [] }); await ev('bibooGame.setX(120)'); await wait(150);
  await page.keyboard.down('ArrowRight');
  for (let i = 0; i < 60 && !(await S()).pitFall; i++) await wait(50);
  await page.keyboard.up('ArrowRight');
  check('walking into the pit still falls', !!(await S()).pitFall);
  // she keeps standing with one foot over the edge and falls only when both feet are over the gap
  await custom({ pits: [{ x0: 150, x1: 260 }], enemies: [] }); await ev('bibooGame.setX(100)'); await wait(200);
  await page.keyboard.down('ArrowRight');
  let atFall = null, maxStanding = 0;
  for (let i = 0; i < 120 && !atFall; i++) { await wait(15); const t = await S(); if (t.pitFall) atFall = t.px; else maxStanding = Math.max(maxStanding, t.px); }
  await page.keyboard.up('ArrowRight');
  check('walking right: she stands with the front foot over the edge (anchor past x 112) before falling', maxStanding > 112, maxStanding);
  check('walking right: she falls only once both feet are over the gap (anchor at 151 or more)', atFall !== null && atFall >= 150, atFall);
  check('no page errors', errors.length === 0, errors);
  console.log(`${res.filter(Boolean).length}/${res.length} passed`); await b.close(); process.exit(res.every(Boolean) ? 0 : 1);
})();
