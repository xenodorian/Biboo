/* The key chest: every key level keeps its door key in a chained red chest in map .8 that opens once all the level's unlocks are owned.
 * Run: NODE_PATH=$(npm root -g) node web/tests/chest.test.js */
const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto('file://' + path.resolve(__dirname, '../index.html'));
  await page.waitForFunction(() => document.getElementById('btn-start') && window.bibooGame, null, { timeout: 20000 });
  const ev = js => page.evaluate(js), wait = ms => page.waitForTimeout(ms);
  const S = () => ev('bibooGame.state()');
  const results = [];
  const check = (name, ok, detail) => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  ' + JSON.stringify(detail)}`); };
  const enter = async n => {
    await ev(`bibooGame.resetAll(); for (let i = 1; i < ${n}; i++) BibooProgress.completeLevel(i); bibooGame.enterLevel(${n})`); await wait(600);
    await ev('bibooGame.setEnemies([])'); await wait(200);
  };
  const chestIdx = async () => (await S()).crates.findIndex(c => c.chest);

  for (const n of [1, 2, 3, 4]) {
    const D = await ev(`(() => { const l = BIBOO_LEVELS.levels[${n - 1}]; const ch = l.maps.map((m, i) => m.chest ? i : -1).filter(i => i >= 0);
      const m = l.maps[7], c = m.chest; return { door: l.door, maps: l.maps.length, chestMaps: ch, x: c && c.x, inPit: c ? m.pits.some(p => c.x > p.x0 - 10 && c.x < p.x1 + 10) : null,
      items: [].concat(...l.maps.map(mm => mm.crates.filter(cc => cc.item).map(cc => cc.item))) }; })()`);
    check(`level ${n}: one chest, in map ${n}.8, standing on ground and not in a pit`, D.door === 'key' && D.chestMaps.length === 1 && D.chestMaps[0] === 7 && D.inPit === false, D);
    check(`level ${n}: the door is at the end of ${n}.9`, D.maps === 9, D.maps);

    await enter(n);
    await ev('bibooGame.warp(7)'); await wait(500); await ev('bibooGame.setEnemies([])');
    let ci = await chestIdx();
    check(`level ${n}: the chest is in the world`, ci >= 0, (await S()).crates);
    await ev(`bibooGame.smash(${ci})`); await wait(100);
    let gems = await ev('bibooGame.gems()');
    check(`level ${n}: chained chest will not open while a move is still locked`, !gems.some(g => g.kind === 'key') && !(await S()).crates[ci].broken && (await ev('bibooGame.chestOpen()')) === false, { gems });
    await ev(`for (const id of ${JSON.stringify(D.items)}.slice(1)) bibooGame.unlock(id)`);
    await ev('bibooGame.smash(' + ci + ')'); await wait(100);
    check(`level ${n}: one move short, it is still shut`, !(await ev('bibooGame.gems()')).some(g => g.kind === 'key'), null);
    await ev(`bibooGame.unlock(${JSON.stringify(D.items[0])})`);
    check(`level ${n}: with every move owned the chest is open`, (await ev('bibooGame.chestOpen()')) === true, null);
    await ev('bibooGame.smash(' + ci + ')'); await wait(100);
    gems = await ev('bibooGame.gems()');
    check(`level ${n}: smashing the open chest releases the key`, gems.filter(g => g.kind === 'key').length === 1 && (await S()).crates[ci].broken, gems);

    // leave without the key: the chest comes back
    await ev('bibooGame.warp(6)'); await wait(400); await ev('bibooGame.warp(7)'); await wait(500);
    check(`level ${n}: the chest is back if the key was left behind`, (await chestIdx()) >= 0 && !(await S()).crates[await chestIdx()].broken, (await S()).crates);
    await ev('bibooGame.setEnemies([])');
    await ev('bibooGame.smash(' + (await chestIdx()) + ')'); await wait(100);
    const kx = (await ev('bibooGame.gems()')).find(g => g.kind === 'key');
    // the door is locked until she holds it
    await ev('bibooGame.warp(8)'); await wait(400); await ev('bibooGame.setEnemies([])'); await wait(150);
    await ev('bibooGame.setX(376)'); await wait(700);
    let s = await S();
    check(`level ${n}: the door does not open without the key`, s.screen === 'level' && !s.levelDone && s.level.idx === 8, { screen: s.screen, level: s.level, done: s.levelDone, hp: s.hp });
    await ev('bibooGame.warp(7)'); await wait(500); await ev('bibooGame.setEnemies([])');
    await ev('bibooGame.smash(' + (await chestIdx()) + ')'); await wait(100);
    const k2 = (await ev('bibooGame.gems()')).find(g => g.kind === 'key');
    await ev(`bibooGame.setX(${k2.x - 32})`); await wait(500);
    check(`level ${n}: touching the key picks it up`, (await ev('bibooGame.hasKey()')) === true, await ev('bibooGame.gems()'));
    await ev('bibooGame.warp(6)'); await wait(300); await ev('bibooGame.warp(7)'); await wait(500);
    check(`level ${n}: the chest is gone once the key is taken`, (await chestIdx()) < 0, (await S()).crates);
    await ev('bibooGame.warp(8)'); await wait(400); await ev('bibooGame.setEnemies([])'); await wait(150);
    await ev('bibooGame.setX(376)'); await wait(900);
    s = await S();
    check(`level ${n}: with the key the door ends the level`, s.levelDone === true || s.screen !== 'level', { screen: s.screen, done: s.levelDone });
    await ev('bibooGame.goOverworld()'); await wait(300);
  }

  // a key only opens its own level
  await ev('bibooGame.resetAll(); BibooProgress.completeLevel(1); BibooProgress.completeLevel(2); BibooProgress.addKey(1); BibooProgress.addKey(2); bibooGame.enterLevel(3)'); await wait(600);
  check("levels 1 and 2 keys do not open level 3's door", (await ev('bibooGame.doorLocked()')) === true, null);

  // a picture of the chained and the open chest
  await enter(1); await ev('bibooGame.warp(7)'); await wait(600); await ev('bibooGame.setEnemies([])'); await ev('bibooGame.setX(60)'); await wait(300);
  await page.screenshot({ path: process.env.SHOT || '/dev/null', clip: { x: 60, y: 200, width: 1100, height: 460 } }).catch(() => {});

  console.log(errors.length ? errors : '');
  check('no page errors', errors.length === 0, errors);
  const ok = results.filter(Boolean).length;
  console.log(ok === results.length ? `ALL PASSED ${ok}/${results.length}` : `SOME FAILED ${ok}/${results.length}`);
  await browser.close();
  process.exit(ok === results.length ? 0 : 1);
})();
