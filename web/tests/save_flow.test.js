/* Saving is manual only: nothing is written to the browser until Save game, a reload loses unsaved progress, Continue loads the
 * manual save, and New game wipes it and starts level 1.1.
 * Run: NODE_PATH=$(npm root -g) node web/tests/save_flow.test.js */
const path = require('path');
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(), page = await b.newPage({ viewport: { width: 1152, height: 648 } });
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  const url = 'file://' + path.resolve(__dirname, '../index.html');
  const ready = () => page.waitForFunction(() => document.getElementById('btn-start') && window.bibooGame, null, { timeout: 20000 });
  await page.goto(url); await ready();
  const ev = j => page.evaluate(j), wait = ms => page.waitForTimeout(ms), res = [];
  const check = (n, ok, d) => { res.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${ok ? '' : '  ' + JSON.stringify(d)}`); };
  const keys = () => ev("Object.keys(localStorage).filter(k => k.startsWith('parryperry'))");
  const labels = () => ev("[...document.querySelectorAll('#menu-view .actions button, #menu-view button')].map(b => b.textContent.trim())");
  const clickId = id => page.locator('#' + id).click();

  check('a first visit has no saved game', (await keys()).length === 0 && !(await ev('BibooProgress.hasSave()')), await keys());
  check('the title menu offers New game (no Continue yet)', JSON.stringify((await labels()).slice(0, 1)) === JSON.stringify(['New game']) && !(await labels()).includes('Continue'), await labels());

  // progress changes never write to the browser on their own
  await ev("bibooGame.unlock('thrust'); bibooGame.unlock('recover'); BibooProgress.completeLevel(1); BibooProgress.addGem('health', 3); BibooProgress.raiseMax('energy')");
  await wait(300);
  check('unlocks and level progress are not written to the browser', (await keys()).length === 0, await keys());
  await page.reload(); await ready();
  check('after a reload the unsaved progress is gone', await ev("BibooProgress.state.unlocked.length === 0 && BibooProgress.state.levelsUnlocked === 1 && BibooProgress.state.gems.health === 0"), await ev('JSON.stringify(BibooProgress.state)'));

  // the menu inside a level has Save game; saving writes exactly one save
  await ev("bibooGame.unlock('thrust'); BibooProgress.completeLevel(1); BibooProgress.addGem('health', 3); bibooGame.enterLevel(1)"); await wait(600);
  await ev('togglePause()'); await wait(300);
  const inLevel = await labels();
  check('the in-level menu lists Save game and New game', inLevel.includes('Save game') && inLevel.some(t => /^New game/.test(t)), inLevel);
  await clickId('btn-save'); await wait(300);
  const ks = await keys();
  check('Save game writes the manual save and nothing else', ks.length === 1 && ks[0] === 'parryperry.manualsave.v1', ks);

  // more progress after the save is not kept
  await ev("bibooGame.unlock('upswing')"); await wait(200);
  await page.reload(); await ready();
  const t = await labels();
  check('after a reload the title menu offers Continue and New game (erases save)', t[0] === 'Continue' && t.some(x => /^New game/.test(x)), t);
  await clickId('btn-start'); await wait(500);
  const cont = await ev("({ thrust: BibooProgress.has('thrust'), up: BibooProgress.has('upswing'), lv: BibooProgress.state.levelsUnlocked, gems: BibooProgress.state.gems.health, screen: bibooGame.state().screen })");
  check('Continue restores exactly what was saved (not the later unlock)', cont.thrust && !cont.up && cont.lv === 2 && cont.gems === 3 && cont.screen === 'overworld', cont);

  // New game: two presses when a save exists, then everything is wiped and level 1.1 starts
  await page.reload(); await ready();
  await clickId('btn-new-game'); await wait(300);
  check('New game needs a second press while a save exists', (await keys()).length === 1 && (await labels()).some(x => /Press again/.test(x)), await labels());
  await clickId('btn-new-game'); await wait(500);
  await page.click('button:has-text("Skip story")'); await wait(500);       // the prologue
  const nw = await ev("({ u: BibooProgress.state.unlocked.length, lv: BibooProgress.state.levelsUnlocked, gems: BibooProgress.state.gems.health, lvl: bibooGame.state().level, screen: bibooGame.state().screen })");
  check('New game goes to the overworld with nothing unlocked', nw.u === 0 && nw.lv === 1 && nw.gems === 0 && nw.screen === 'overworld', nw);
  check('New game wiped the saved data', (await keys()).length === 0, await keys());
  await page.reload(); await ready();
  check('and a reload afterwards shows no Continue', !(await labels()).includes('Continue'), await labels());
  check('no page errors', errors.length === 0, errors);
  console.log(`${res.filter(Boolean).length}/${res.length} passed`); await b.close(); process.exit(res.every(Boolean) ? 0 : 1);
})();
