/* Golden crates never give a redundant unlock, and every unlock banner names the move and its controller input.
 * Run: NODE_PATH=$(npm root -g) node web/tests/unlock_items.test.js */
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
  const results = [];
  const check = (name, ok, detail) => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  ' + JSON.stringify(detail)}`); };
  const custom = async md => { await ev(`bibooGame.custom(${JSON.stringify(md)})`); await wait(700); };

  // ---- the level data: every unlock sits in exactly one golden crate, and every crate holds a real unlock
  const data = await ev(`(() => { const ids = BibooProgress.UNLOCKS.map(u => u.id), count = {}, bad = [];
    for (const lv of BIBOO_LEVELS.levels) for (const m of lv.maps) for (const c of m.crates) if (c.item) { count[c.item] = (count[c.item] || 0) + 1; if (!BibooProgress.byId[c.item]) bad.push(c.item); }
    return { ids, count, bad, dup: Object.keys(count).filter(k => count[k] > 1), missing: ids.filter(i => !count[i]) }; })()`);
  check('no two golden crates hold the same unlock', data.dup.length === 0, data.dup);
  check('every golden crate holds a real unlock', data.bad.length === 0, data.bad);
  check('every unlock is in some golden crate', data.missing.length === 0, data.missing);
  check('the unlock list has no repeated ids', new Set(data.ids).size === data.ids.length, data.ids);

  // ---- a golden crate only pulls from what is still locked
  await ev('bibooGame.resetAll(); bibooGame.enterLevel(1)'); await wait(600);
  let bad = 0, trials = 0, none = 0;
  const all = data.ids;
  for (let t = 0; t < 40; t++) {
    await ev('bibooGame.resetAll(); bibooGame.enterLevel(1)'); await wait(250);
    const owned = all.filter(() => Math.random() < 0.6);
    const item = owned.length ? owned[Math.floor(Math.random() * owned.length)] : all[0];
    const r = await ev(`(() => { for (const id of ${JSON.stringify(owned)}) bibooGame.unlock(id);
      bibooGame.custom({ crates: [{ x: 330, fy: 0, item: ${JSON.stringify(item)} }] }); return 1; })()`);
    await wait(400);
    await ev('bibooGame.smash(0)');
    const st = await ev('bibooGame.state()');
    trials++;
    const given = st.powerups.map(p => p.item);
    const owns = id => owned.includes(id);
    if (owns(item)) { if (given.some(owns) || given.length > 1) bad++; }
    else if (given.length !== 1 || given[0] !== item) bad++;
    if (given.length === 0) none++;
  }
  check(`${trials} random smashes: never an owned unlock, never a duplicate`, bad === 0, { bad, trials, none });

  // ---- many golden crates at once hand out different unlocks, then nothing once all are promised
  await ev('bibooGame.resetAll(); bibooGame.enterLevel(1)'); await wait(400);
  await ev('bibooGame.unlock("thrust")');
  const n = all.length;
  await custom({ crates: Array.from({ length: n + 2 }, (_, i) => ({ x: 120 + i * 13, fy: 0, item: 'thrust' })) });
  await ev(`for (let i = 0; i < ${n + 2}; i++) bibooGame.smash(i)`);
  const st2 = await ev('bibooGame.state()');
  const items = st2.powerups.map(p => p.item);
  check('simultaneous golden crates give distinct unlocks', new Set(items).size === items.length, items);
  check('none of them is already owned', !items.includes('thrust'), items);
  check('early on, the late-game Earthquake and Meteor Shower are never handed out as substitutes', !items.includes('earthquake') && !items.includes('meteor'), items);
  check('the other 13 still-locked unlocks are handed out and the extra crates give nothing', items.length === n - 3, items.length);
  const late = await ev(`(() => { const w = BIBOO_LEVELS.whereIs; return { eq: w.earthquake, mt: w.meteor }; })()`);
  check('Earthquake and Meteor Shower stay in their late-game crates (level 3 or later)', parseInt(late.eq) >= 3 && parseInt(late.mt) >= 3, late);

  // ---- a real pickup shows the name and the controller input
  await ev('bibooGame.resetAll(); bibooGame.enterLevel(1)'); await wait(500);
  await custom({ crates: [{ x: 200, fy: 0, item: 'taunt' }] });
  await ev('bibooGame.smash(0); bibooGame.setX(168)'); await wait(600);
  const ban = await ev('bibooGame.banners()');
  const b = ban.find(x => /^NEW/.test(x.title));
  check('the banner names the move', b && /Taunt/.test(b.title), ban);
  check('the banner shows its controller input', b && Array.isArray(b.sub) && b.sub.some(l => /X\+Y/.test(l)), ban);

  // ---- every unlock's banner text: a name and an input for each move it gives
  const lines = await ev(`(() => { const out = {}; for (const u of BibooProgress.UNLOCKS) { bibooGame.resetAll(); bibooGame.unlock(u.id); out[u.id] = bibooGame.unlockLines(u.id); } return out; })()`);
  const expectIn = { thrust: 'Right+A', upswing: 'Down+A', heavy_horizontal: 'A+B', dash_thrust: 'X+A', energy_dash: 'X+A', taunt: 'X+Y', double_jump: 'Up', sky_dash: 'Down-Y',
    crash: 'A', heavy_chop: 'A', earthquake: 'Down-Down-Down-Down-A', meteor: 'Up-Up-Up-Up-A', L1: 'L1', L2: 'L2', R1: 'R1', R2: 'R2' };
  for (const u of Object.keys(expectIn)) {
    const ls = lines[u] || [];
    check(`${u} banner has a move name and its input (${expectIn[u]})`, ls.length > 0 && ls.every(l => /^[^:]+: .+/.test(l) && !/undefined/.test(l)) && ls.some(l => l.includes(expectIn[u])), ls);
  }

  console.log(errors.length ? errors : '');
  check('no page errors', errors.length === 0, errors);
  const ok = results.filter(Boolean).length;
  console.log(ok === results.length ? `ALL PASSED ${ok}/${results.length}` : `SOME FAILED ${ok}/${results.length}`);
  await browser.close();
  process.exit(ok === results.length ? 0 : 1);
})();
