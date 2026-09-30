/* Levels, unlocks, menus, gems, overworld and the dev console.
 * Run: NODE_PATH=$(npm root -g) node web/tests/progression.test.js */
const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto('file://' + path.resolve(__dirname, '../index.html'));
  await page.waitForFunction(() => document.getElementById('btn-start') && window.bibooGame, null, { timeout: 20000 });
  const ev = js => page.evaluate(js), wait = ms => page.waitForTimeout(ms);
  const S = () => ev('bibooGame.state()');
  const results = [];
  const check = (name, ok, detail) => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  ' + JSON.stringify(detail)}`); };
  const key = async (k, ms = 60) => { await page.keyboard.down(k); await wait(ms); await page.keyboard.up(k); };
  const hold = async (keys, ms) => { for (const k of keys) await page.keyboard.down(k); await wait(ms); for (const k of keys) await page.keyboard.up(k); };
  const clickText = async t => { await page.locator('#menu-view button', { hasText: t }).first().click(); await wait(120); };
  const labels = () => page.$$eval('#menu-view button', b => b.map(x => x.textContent));

  // ---- 1. load, title menu
  let s = await S();
  check('title screen, no errors', s.screen === 'title' && errors.length === 0, { s: s.screen, errors });
  check('title menu lists Start, Moves, Gems, Fullscreen', JSON.stringify(await labels()) === JSON.stringify(['Start', 'Moves', 'Gems', 'Fullscreen']), await labels());
  check('old controls panel and combo table removed from the page', await ev("!document.querySelector('#pad-section') && document.querySelectorAll('table.moves-table').length === 0"), null);

  // ---- 2. moves menu at first launch
  await clickText('Moves');
  const rows0 = await page.$$eval('#menu-view .moves-table tr', r => r.map(x => x.textContent));
  const txt0 = rows0.join('|');
  check('moves menu lists the base moves', /Slash|Chop|Dash|Jump|Parry|Block/i.test(txt0), rows0.slice(0, 12));
  check('moves menu hides locked moves (no Earthquake, no Empowerment)', !/Earthquake|Meteor|Empowerment|Laser|Fire beam/i.test(txt0), rows0);
  check('moves menu says how many are locked', /still locked/.test(await ev("document.getElementById('menu-view').textContent")), null);
  await key('Escape'); await wait(100);
  check('Escape goes back from Moves to the main list', (await labels())[0] === 'Start', await labels());

  // ---- 3. gems menu empty
  await clickText('Gems');
  const gemtxt = await ev("document.getElementById('menu-view').textContent");
  check('gems menu shows 4 kinds, all Use disabled', (await page.$$('#menu-view .gem-row')).length === 4 && (await page.$$('#menu-view .gem-row button:disabled')).length === 4, gemtxt);
  await key('Escape'); await wait(100);

  // ---- 4. Start -> overworld
  await clickText('Start');
  s = await S();
  check('Start goes to the overworld', s.screen === 'overworld' && !(await ev("bibooGame.menuOpen()")), s);
  await ev("bibooGame.enterLevel(2)"); await wait(100);
  check('level 2 is locked at first', (await S()).screen === 'overworld', await S());
  await ev("bibooGame.enterLevel(1)"); await wait(600);
  s = await S();
  check('level 1 starts on map 1.1', s.screen === 'level' && s.level.id === '1.1' && s.level.idx === 0, s.level);
  check('starts standing on the ground at the left door', s.floorY === 0 && s.px > 15 && s.px < 60, { fy: s.floorY, px: s.px });

  // ---- 5. dev console by the four-shoulder chord and the ` key
  await hold(['KeyQ', 'KeyE', 'KeyT', 'KeyR'], 250); await wait(200);
  s = await S();
  check('Q+E+T+R opens the Dev Console', s.devOpen && (await ev('bibooGame.menuOpen()')), s.devOpen);
  const dl = await labels();
  check('dev console has the cheats', dl.some(l => /^Invincible: OFF/.test(l)) && dl.some(l => /^Infinite meters: OFF/.test(l)) && dl.some(l => /Unlock all levels/.test(l)) && dl.some(l => /Complete this level/.test(l)), dl);
  await clickText('Invincible'); await clickText('Infinite meters');
  s = await S();
  check('cheat toggles flip', s.cheats.invincible && s.cheats.infinite, s.cheats);
  await key('Escape'); await wait(150);
  s = await S();
  check('Escape closes the console and returns to the game', !s.devOpen && !s.paused, s);
  await key('Backquote'); await wait(150);
  check('` key opens it again', (await S()).devOpen, null);
  await key('Backquote'); await wait(150);
  check('` key closes it', !(await S()).devOpen, null);

  // ---- 6. movement: barriers, jumping, platforms (map 1.2 has a log at x 150-166, top 34)
  await ev('bibooGame.warp(1)'); await wait(700);
  await ev('bibooGame.setEnemies([])'); await wait(100);
  s = await S();
  check('warp to 1.2', s.level.id === '1.2', s.level);
  await page.keyboard.down('ArrowRight'); await wait(2200); await page.keyboard.up('ArrowRight');
  s = await S();
  check('a barrier stops her walking (px about 141)', s.level.id === '1.2' && s.px > 130 && s.px < 146, { px: s.px, id: s.level.id });
  await page.keyboard.down('ArrowRight'); await key('KeyV', 60);
  await wait(1500); await page.keyboard.up('ArrowRight'); await wait(400);
  s = await S();
  check('jump with Right held clears the barrier', s.px > 170 && s.floorY === 0, { px: s.px, fy: s.floorY });

  // platform: 1.1 has a plank x 150-214 top 44; jump onto it from x 120
  await ev('bibooGame.warp(0)'); await wait(700); await ev('bibooGame.setEnemies([])');
  await ev('bibooGame.setX(96 - 96 + 118)'); await wait(100);   // world x is screen x here
  s = await S();
  await page.keyboard.down('ArrowRight'); await key('KeyV', 60); await wait(600); await page.keyboard.up("ArrowRight"); await wait(600);
  s = await S();
  check('jump lands on a platform (floorY 44)', s.floorY === 44 && s.px >= 147 && s.px <= 217, { fy: s.floorY, px: s.px });
  await page.keyboard.down('ArrowRight'); await wait(1500); await page.keyboard.up('ArrowRight'); await wait(900);
  s = await S();
  check('walking off the edge drops her back to the ground', s.floorY === 0 && s.px > 214, { fy: s.floorY, px: s.px });

  // ---- 7. crates: smash with a slash, golden crate leaves an unlock, touching it unlocks the move
  await ev('bibooGame.warp(1)'); await wait(700); await ev('bibooGame.setEnemies([])');
  let before = (await S()).crates.filter(c => c.broken).length;
  await ev('bibooGame.setX(300 - 40)'); await wait(100);
  await key('KeyZ', 60); await wait(900);
  s = await S();
  check('slash smashes the golden crate and leaves the item', s.crates.find(c => c.item).broken && ((s.powerups.length === 1 && s.powerups[0].item === 'thrust') || (await ev("BibooProgress.has('thrust')"))), { c: s.crates, p: s.powerups });
  await ev('bibooGame.setX(300 - 4)'); await wait(400);
  s = await S();
  check('touching the item unlocks it', s.powerups.length === 0 && (await ev("BibooProgress.has('thrust')")), s.powerups);
  check('unlock is saved', (await ev("JSON.parse(localStorage.getItem('parryperry.save.v1')).unlocked")).includes('thrust'), null);

  // ---- 8. gating: locked buttons and moves do nothing, unlocked ones work
  await ev('bibooGame.warp(1)'); await wait(600); await ev('bibooGame.setEnemies([])'); await wait(200);
  const n0 = (await ev('bibooGame.current()')) ; const cnt0 = await ev('bibooGame.started.length');
  await key('KeyQ', 80); await wait(500);
  check('locked L1 does nothing', (await ev('bibooGame.started.length')) === cnt0, null);
  await key('KeyZ', 60); await wait(600);
  check('slash (A) works', (await ev('bibooGame.started.length')) > cnt0, null);
  const cnt1 = await ev('bibooGame.started.length');
  await hold(['ArrowRight', 'KeyZ'], 80); await wait(800);
  const last = await ev('bibooGame.started.slice(-3).map(m => m.id || m.move || m)');
  check('unlocked thrust (Right+A) plays', /thrust/.test(JSON.stringify(last)), last);

  // ---- 9. enemies: patrol a set path, ignore her outside sight, chase when she is in sight or after a hit
  await ev('bibooGame.warp(0)'); await wait(700);
  s = await S();
  const g0 = s.foes[0];
  check('1.1 has one goblin with path 230..330 on the ground', s.foes.length === 1 && g0.type === 'goblin' && g0.path[0] === 230 && g0.path[1] === 330 && g0.fy === 0, s.foes);
  const xs = [];
  for (let i = 0; i < 12; i++) { xs.push((await S()).foes[0].x); await wait(500); }
  const mn = Math.min(...xs), mx = Math.max(...xs);
  check('goblin stays inside its path while she stands at the door (x 26)', mn >= 225 && mx <= 335 && mx - mn > 20, { mn, mx, xs });
  const st = (await S()).foes[0].state;
  // chase when she is within sight (goblin sight 90): move her to 180, 50 px in front of the goblin's path end
  await ev('bibooGame.setX(180)');
  let chased = false;
  for (let i = 0; i < 10; i++) { await wait(300); const f = (await S()).foes[0]; if (f.state === 'walk' || f.state === 'attack') chased = true; }
  check('goblin leaves patrol to chase when she is within its sight', chased, (await S()).foes[0]);

  // out of sight: she stays 200 px away, so it keeps patrolling
  await ev('bibooGame.warp(0)'); await wait(700);
  await ev('bibooGame.setX(20)'); await wait(2500);
  check('goblin keeps patrolling while she is far away', (await S()).foes[0].state === 'patrol', (await S()).foes[0]);
  // hit trigger: damage it from range (test hook), it should aggro
  await ev('bibooGame.hurtFoe(0, 5)'); await wait(600);
  s = await S();
  check('a hit from out of sight makes it chase', s.foes[0].state !== 'patrol', s.foes[0]);
  // stays alive with reduced hp
  check('hp dropped by 5', s.foes[0].hp === 55, s.foes[0].hp);

  // ---- 10. enemy on a platform stays on it: 1.5 has a goblin on a platform (path 235..305, top 110)
  await ev('bibooGame.warp(4)'); await wait(800);
  s = await S();
  const pf = s.foes.find(f => f.fy === 110);
  check('1.5 has an enemy on the high ledge', !!pf, s.foes);
  await ev('bibooGame.setX(20)'); await wait(6000);
  s = await S();
  const pf2 = s.foes.find(f => f.fy === 110);
  check('platform enemy patrols within its ledge (x 220..320)', pf2 && pf2.x >= 215 && pf2.x <= 325, pf2);

  // ---- 11. drops: kill many goblins, count health gems
  const N = 400;
  const drops = await ev(`(() => { let d = 0; for (let i = 0; i < ${N}; i++) { bibooGame.enterLevel(1); bibooGame.killFoe(0); if (bibooGame.state().fx.gems > 0) d++; } return d; })()`);
  check(`health gem drop rate is about 35% (${drops}/${N})`, drops / N > 0.28 && drops / N < 0.42, drops);
  // ---- 12. gems: pick up into the bag, use from the menu
  await ev('bibooGame.enterLevel(1)'); await wait(600);
  await ev('bibooGame.setEnemies([])');
  const bag0 = (await ev('bibooGame.gemBag()')).health;
  await ev("bibooGame.dropGem(0, 'health')"); await wait(400);
  s = await ev('bibooGame.gemBag()');
  check('walking over a gem stores it in the bag (+1 health)', s.health === bag0 + 1 && (await S()).fx.gems === 0, s);
  await ev('bibooGame.hurtHer(0)');
  await ev('bibooGame.setHp(100)'); await key('Escape'); await wait(200);
  check('Escape pauses with the menu (Resume, Moves, Gems, Back to overworld, Fullscreen)', JSON.stringify(await labels()) === JSON.stringify(['Resume', 'Moves', 'Gems', 'Back to the overworld', 'Fullscreen']), await labels());
  await clickText('Gems');
  let rows = await page.$$eval('#menu-view .gem-row', r => r.map(x => ({ t: x.textContent, dis: x.querySelector('button').disabled })));
  check('Gems menu: health Use is enabled, the rest disabled', !rows[0].dis && rows.slice(1).every(r => r.dis), rows);
  await page.locator('#menu-view .gem-row').first().locator('button').click(); await wait(150);
  check('Use health gem: +50 HP (100 to 150), bag 0', (await S()).hp === 150 && (await ev('bibooGame.gemBag()')).health === bag0, { hp: (await S()).hp, bag: await ev('bibooGame.gemBag()') });
  await key('Escape'); await wait(150); await key('Escape'); await wait(150);
  check('Escape twice resumes play', !(await S()).paused, await S());
  // energy gem needs the meter: give one, verify disabled, then unlock L1 and use it
  await ev("BibooProgress.addGem('energy', 1)");
  await key('Escape'); await wait(150); await clickText('Gems');
  rows = await page.$$eval('#menu-view .gem-row', r => r.map(x => ({ t: x.textContent, dis: x.querySelector('button').disabled })));
  check('energy gem cannot be used before the meter is unlocked', rows[1].dis && /not unlocked/.test(rows[1].t), rows[1]);
  await key('Escape'); await wait(100); await key('Escape'); await wait(100);
  await ev("bibooGame.enterLevel(1)"); await wait(400);
  // unlock L1 through the dev console button path
  await ev("(function(){ const P = BibooProgress; return P.unlock('L1'); })()");
  await ev("bibooGame.enterLevel(1)"); await wait(400);
  check('L1 unlocks the energy meter (P.meterOn)', await ev("BibooProgress.meterOn('energy') && !BibooProgress.meterOn('empower') && !BibooProgress.meterOn('super')"), null);

  // ---- 13. map doors and the level gate
  await ev('bibooGame.enterLevel(1)'); await wait(600);
  await ev('bibooGame.setEnemies([])');
  await ev('bibooGame.setX(340)'); await page.keyboard.down('ArrowRight'); for (let i = 0; i < 40 && (await S()).level.id === '1.1'; i++) await wait(200); await page.keyboard.up('ArrowRight'); await wait(300);
  s = await S();
  check('walking off the right edge loads 1.2 at the left door', s.level.id === '1.2' && s.px < 60, s.level);
  await ev('bibooGame.setX(50)'); await page.keyboard.down('ArrowLeft'); for (let i = 0; i < 40 && (await S()).level.id === '1.2'; i++) await wait(200); await page.keyboard.up('ArrowLeft'); await wait(300);
  s = await S();
  check('walking off the left edge goes back to 1.1 at the right door', s.level.id === '1.1' && s.px > 300, { l: s.level, px: s.px });
  await ev('bibooGame.warp(9)'); await wait(700);
  s = await S();
  check('1.10 has 4 enemies', s.foes.length === 4 && s.level.id === '1.10', s.foes.length);
  await ev('bibooGame.hurtHer(0)');
  await ev('BibooProgress.state.levelsUnlocked'); 
  await page.keyboard.down('ArrowRight'); await wait(3500); await page.keyboard.up('ArrowRight');
  s = await S();
  check('the last map is gated while enemies live', s.screen === 'level' && !s.levelDone && s.level.id === '1.10', s);
  await ev('bibooGame.setHp(200)');
  await ev('for (let i = 0; i < 4; i++) bibooGame.killFoe(i)'); await wait(200);
  await ev('bibooGame.setX(300)'); await page.keyboard.down('ArrowRight'); await wait(3000); await page.keyboard.up('ArrowRight'); await wait(300);
  s = await S();
  check('clearing the map and walking out completes the level', s.levelDone, s);
  check('level 2 is now unlocked and Level complete message shown', (await ev('BibooProgress.state.levelsUnlocked')) === 2 && /complete/i.test(await ev("document.getElementById('menu-title').textContent")), await ev("document.getElementById('menu-title').textContent"));
  await clickText('Back to the overworld'); await wait(200);
  s = await S();
  check('back on the overworld with the menu closed', s.screen === 'overworld' && !(await ev('bibooGame.menuOpen()')), s);
  await ev('bibooGame.enterLevel(2)'); await wait(700);
  s = await S();
  check('level 2 can now be entered (2.1)', s.screen === 'level' && s.level.id === '2.1', s.level);

  // ---- 14. game over and retry (cheats from earlier off first)
  await key('Backquote'); await wait(200); await clickText('Invincible'); await clickText('Infinite meters'); await key('Backquote'); await wait(200);
  check('cheats can be turned off again', !(await S()).cheats.invincible && !(await S()).cheats.infinite, (await S()).cheats);
  await ev('bibooGame.hurtHer(9999)'); await wait(700);
  s = await S();
  check('K.O. shows the Game Over menu with Retry this map', s.gameOver && (await labels())[0] === 'Retry this map', { s, l: await labels() });
  await clickText('Retry this map'); await wait(600);
  s = await S();
  check('Retry reloads the same map at full health', !s.gameOver && !s.paused && s.hp === 200 && s.level.id === '2.1', s);

  // ---- 15. dev console actions in a level
  const dev = async () => { await key('Backquote'); await wait(200); };
  const devClick = async t => { await clickText(t); };
  await dev(); await devClick('Unlock all levels'); await devClick('Unlock all moves and buttons'); await devClick('Give 5 of every gem');
  check('dev: all levels unlocked', (await ev('BibooProgress.state.levelsUnlocked')) === 5, null);
  check('dev: all unlocks owned', await ev('BibooProgress.UNLOCKS.every(u => BibooProgress.has(u.id))'), null);
  check('dev: gems given', JSON.stringify(await ev('bibooGame.gemBag()')) !== JSON.stringify({ health: 0, energy: 0, empower: 0, super: 0 }), await ev('bibooGame.gemBag()'));
  await devClick('Next map'); await wait(500);
  s = await S();
  check('dev: Next map goes to 2.2 and closes the console', s.level.id === '2.2' && !s.devOpen && !s.paused, s);
  await dev(); await devClick('Previous map'); await wait(500);
  check('dev: Previous map goes back to 2.1', (await S()).level.id === '2.1', (await S()).level);
  await dev(); await devClick('Kill every enemy on this map'); await devClick('Close'); await wait(300);
  check('dev: kill every enemy', (await S()).foes.every(f => !f.alive), (await S()).foes);
  await dev(); await devClick('Invincible'); await devClick('Close'); await ev('bibooGame.setHp(200)'); await ev('bibooGame.hurtHer(150)');
  check('dev: invincible blocks damage', (await S()).hp === 200, (await S()).hp);
  await dev(); await devClick('Complete this level'); await wait(300);
  check('dev: Complete this level shows the message', (await S()).levelDone, await S());
  await clickText('Back to the overworld'); await wait(200);
  await dev(); await devClick('Reset all progress');
  check('reset needs a second press (still unlocked)', await ev("BibooProgress.has('thrust')"), null);
  await devClick('Press again to erase the save'); await wait(300);
  check('reset erased progress and returned to the overworld', !(await ev("BibooProgress.has('thrust')")) && (await ev('BibooProgress.state.levelsUnlocked')) === 1 && (await S()).screen === 'overworld' && !(await S()).devOpen && !(await S()).paused, await S());

  // ---- 16. save survives a reload
  await ev("BibooProgress.unlock('spin'); BibooProgress.completeLevel(1); BibooProgress.addGem('health', 3); BibooProgress.save()");
  await page.reload(); await page.waitForFunction(() => document.getElementById('btn-start') && window.bibooGame, null, { timeout: 20000 });
  check('progress persists after reload', await ev("BibooProgress.has('spin') && BibooProgress.state.levelsUnlocked === 2 && BibooProgress.state.gems.health === 3"), await ev('JSON.stringify(BibooProgress.state)'));
  check('title screen again after reload', (await S()).screen === 'title', null);
  await clickText('Moves');
  check('moves menu now lists the unlocked Spin Attack', /Spin attack/i.test(await ev("document.getElementById('menu-view').textContent")), null);

  console.log(errors.length ? errors : '');
  console.log(results.filter(x => !x).length ? 'SOME FAILED' : 'ALL PASSED', `${results.filter(Boolean).length}/${results.length}`);
  if (errors.length) console.log('page errors:', errors);
  await browser.close();
  process.exit(results.every(Boolean) && !errors.length ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
