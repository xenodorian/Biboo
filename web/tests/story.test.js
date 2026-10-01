/* The story: prologue on a new game, Mirror Max's confession, and the ending. Run: NODE_PATH=$(npm root -g) node web/tests/story.test.js [shots-dir] */
const path = require('path');
const { chromium } = require('playwright');
(async () => {
  const shots = process.argv[2];
  const b = await chromium.launch(), page = await b.newPage({ viewport: { width: 1000, height: 640 } });
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  await page.goto('file://' + path.resolve(__dirname, '../index.html'));
  await page.waitForFunction(() => document.getElementById('btn-start') && window.bibooGame, null, { timeout: 20000 });
  const ev = j => page.evaluate(j), wait = ms => page.waitForTimeout(ms), res = [];
  const check = (n, ok, d) => { res.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${ok ? '' : '  ' + JSON.stringify(d)}`); };
  const next = async () => { await page.click('#btn-start'); await wait(150); };
  await ev('localStorage.clear()');
  await page.click('#btn-start'); await wait(300);                       // New game
  let s = await ev('bibooGame.story()');
  check('a new game opens the prologue', s && s.id === 'prologue' && s.i === 0, s);
  check('the level has not started yet', (await ev('bibooGame.state().level')) === 0 || (await ev('bibooGame.state().screen')) !== 'level', await ev('bibooGame.state().screen'));
  if (shots) await page.screenshot({ path: shots + '/story_p0.png' });
  for (let i = 0; i < 5; i++) { await next(); if (shots && i === 1) await page.screenshot({ path: shots + '/story_p2.png' }); }
  s = await ev('bibooGame.story()');
  check('pages advance', s && s.id === 'prologue' && s.i === 5, s);
  await next(); await wait(300);
  check('the last page starts level 1', !(await ev('bibooGame.story()')) && (await ev('bibooGame.state().screen')) === 'level', await ev('bibooGame.state().screen'));
  // skip
  await ev('bibooGame.playStory("ending")'); await wait(200);
  await page.click('button:has-text("Skip story")'); await wait(200);
  check('Skip story ends it at once', !(await ev('bibooGame.story()')));
  // double and ending scenes (screenshots)
  for (const [id, n] of [['double', 5], ['ending', 8]]) {
    await ev(`bibooGame.playStory('${id}')`); await wait(200);
    for (let i = 0; i < n; i++) { if (shots) await page.screenshot({ path: `${shots}/story_${id}_${i}.png` }); if (i < n - 1) await next(); }
    await next(); await wait(200);
    check(`${id} plays through and ends`, !(await ev('bibooGame.story()')));
  }
  console.log(errors.length ? errors : '');
  await b.close(); process.exit(res.every(Boolean) && !errors.length ? 0 : 1);
})();
