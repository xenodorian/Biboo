/* Enemy hits push her back 10 px (goblin) or 25 px (orc), and a push only drops her into a pit when she is carried fully over the edge.
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
  const gob = await hit('goblin', 'slash', 100);
  check('a goblin hit pushes her back about 10 px', gob.hurt > 0 && Math.abs(gob.moved - 10) <= 6, gob);
  const orc = await hit('orc', 'attack', 100);
  check('an orc hit pushes her back about 25 px', orc.hurt > 0 && Math.abs(orc.moved - 25) <= 8, orc);
  // a goblin pushes her half over a pit edge (she stands 5 px past the right edge; 10 px push puts her centre inside the gap): no fall
  const edge = await hit('goblin', 'slash', 215, { x0: 150, x1: 210 });
  check('a push that only reaches half over the edge does not start a fall', edge.hurt > 0 && !edge.pitFall, edge);
  const ground = await ev("(() => { const s = bibooGame.state(); return s.feetNow; })()");
  check('she is standing on the ground at the edge afterwards', ground <= 1 && edge.px >= 149, { ground, px: edge.px });
  // walking in on purpose still falls
  await custom({ pits: [{ x0: 150, x1: 210 }], enemies: [] }); await ev('bibooGame.setX(120)'); await wait(150);
  await page.keyboard.down('ArrowRight');
  for (let i = 0; i < 60 && !(await S()).pitFall; i++) await wait(50);
  await page.keyboard.up('ArrowRight');
  check('walking into the pit still falls', !!(await S()).pitFall);
  check('no page errors', errors.length === 0, errors);
  console.log(`${res.filter(Boolean).length}/${res.length} passed`); await b.close(); process.exit(res.every(Boolean) ? 0 : 1);
})();
