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
  check('title menu lists New game, both Moves lists, Gems, Fullscreen', JSON.stringify(await labels()) === JSON.stringify(['New game', 'Moves: Gamepad', 'Moves: Keyboard', 'Gems', 'Fullscreen']), await labels());
  check('old controls panel and combo table removed from the page', await ev("!document.querySelector('#pad-section') && document.querySelectorAll('table.moves-table').length === 0"), null);

  // ---- 2. moves menu at first launch
  await clickText('Moves');
  const rows0 = await page.$$eval('#menu-view .moves-table tr', r => r.map(x => x.textContent));
  const txt0 = rows0.join('|');
  check('moves menu lists the base moves', /Slash|Chop|Dash|Jump|Parry|Block/i.test(txt0), rows0.slice(0, 12));
  check('moves menu hides locked moves (no Earthquake, no Empowerment)', !/Earthquake|Meteor|Empowerment|Laser|Fire beam/i.test(txt0), rows0);
  check('moves menu says how many are locked', /still locked/.test(await ev("document.getElementById('menu-view').textContent")), null);
  await key('Escape'); await wait(100);
  check('Escape goes back from Moves to the main list', (await labels())[0] === 'New game', await labels());

  // ---- 3. gems menu empty
  await clickText('Gems');
  const gemtxt = await ev("document.getElementById('menu-view').textContent");
  check('gems menu shows 4 kinds, all Use disabled', (await page.$$('#menu-view .gem-row')).length === 4 && (await page.$$('#menu-view .gem-row button:disabled')).length === 4, gemtxt);
  await key('Escape'); await wait(100);

  // ---- 4. Start -> overworld
  await clickText('New game');
  check('New game opens the prologue first', !!(await ev('bibooGame.story()')), await S());
  await clickText('Skip story'); await wait(300);
  s = await S();
  check('Skipping the prologue starts Level 1.1', s.screen === 'level' && s.level && s.level.n === 1 && s.level.idx === 0 && !(await ev("bibooGame.menuOpen()")), s);
  await ev('bibooGame.goOverworld()'); await wait(200);
  s = await S();
  check('back to the overworld', s.screen === 'overworld' && !(await ev("bibooGame.menuOpen()")), s);
  await ev("bibooGame.enterLevel(2)"); await wait(100);
  check('level 2 is locked at first', (await S()).screen === 'overworld', await S());
  await ev("bibooGame.enterLevel(1)"); await wait(600);
  s = await S();
  check('level 1 starts on map 1.1', s.screen === 'level' && s.level.id === '1.1' && s.level.idx === 0, s.level);
  check('starts standing on the ground at the left door', s.floorY === 0 && s.px > 15 && s.px < 60, { fy: s.floorY, px: s.px });

  // ---- 5. the Cheats menu: L1+R1+L2+R2 together in the pause menu lists it
  const cheatMenu = async () => {                              // pause, press the four shoulders, open Cheats
    if (!(await S()).paused) { await key('Escape'); await wait(200); }
    if (!(await labels()).includes('Cheats')) { await hold(['KeyQ', 'Digit1', 'KeyW', 'Digit2'], 250); await wait(200); }
    await clickText('Cheats');
  };
  const cheatsDone = async () => { await clickText('Close'); await wait(150); if ((await S()).paused) { await key('Escape'); await wait(200); } };
  await key('Escape'); await wait(200);
  check('the pause menu has no Cheats entry at first', !(await labels()).includes('Cheats'), await labels());
  await cheatMenu();
  s = await S();
  check('L1+R1+L2+R2 reveals the Cheats menu', s.devOpen && (await ev('bibooGame.menuOpen()')), s.devOpen);
  const dl = await labels();
  check('Cheats lists God Mode, Infinite Meter, Level Unlock, Master Unlock, No Pitfalls', ['God Mode', 'Infinite Meter', 'Level Unlock', 'Master Unlock', 'No Pitfalls'].every(n => dl.some(l => l.startsWith(n))), dl);
  await clickText('God Mode'); await clickText('Infinite Meter');
  s = await S();
  check('cheat toggles flip', s.cheats.invincible && s.cheats.infinite, s.cheats);
  await cheatsDone();
  s = await S();
  check('closing Cheats and the menu returns to the game', !s.devOpen && !s.paused, s);

  // ---- 6. movement: barriers, jumping, platforms (map 1.2 has a log at x 150-166, top 34)
  await ev('bibooGame.warp(1)'); await wait(700);
  await ev('bibooGame.setEnemies([])'); await wait(100);
  s = await S();
  check('warp to 1.2', s.level.id === '1.2', s.level);
  await ev('bibooGame.setX(120)'); await wait(100);
  await page.keyboard.down('ArrowRight'); await key('ArrowUp', 60);
  await wait(1100); await page.keyboard.up('ArrowRight'); await wait(500);
  s = await S();
  check('jump with Right held clears the 1.2 pit and she survives', !s.pitFall && s.hp === 50 && s.px > 205 && s.floorY === 0, { px: s.px, hp: s.hp, pf: s.pitFall });

  // platform: 1.1 has a plank x 150-214 top 44; jump onto it from x 120
  await ev('bibooGame.warp(0)'); await wait(700); await ev('bibooGame.setEnemies([])');
  await ev('bibooGame.setX(96 - 96 + 118)'); await wait(100);   // world x is screen x here
  s = await S();
  await page.keyboard.down('ArrowRight'); await key('ArrowUp', 60); await wait(600); await page.keyboard.up("ArrowRight"); await wait(600);
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
  check('an unlock is NOT written to the browser by itself (saving is manual only)', (await ev("Object.keys(localStorage).filter(k => k.startsWith('parryperry')).length")) === 0, await ev("Object.keys(localStorage)"));

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
  const drops = await ev(`(() => { let d = 0; for (let i = 0; i < ${N}; i++) { bibooGame.enterLevel(1); bibooGame.killFoe(0); if (bibooGame.pickups().some(g => g.kind === 'health')) d++; } return d; })()`);
  check(`health gem drop rate is about 35% (${drops}/${N})`, drops / N > 0.28 && drops / N < 0.42, drops);
  // ---- 12. gems: pick up into the bag, use from the menu
  await ev('BibooProgress.state.maxes.hp = 200');
  await ev('bibooGame.enterLevel(1)'); await wait(600);
  await ev('bibooGame.setEnemies([])');
  const bag0 = (await ev('bibooGame.gemBag()')).health;
  await ev("bibooGame.dropGem(0, 'health')"); await wait(400);
  s = await ev('bibooGame.gemBag()');
  check('walking over a gem stores it in the bag (+1 health)', s.health === bag0 + 1, s);
  await ev('bibooGame.hurtHer(0)');
  await ev('bibooGame.setHp(100)'); await key('Escape'); await wait(200);
  check('Escape pauses with the menu (Resume, Moves, Cheats, Gems, Back to overworld, Save game, Fullscreen, New game)', JSON.stringify(await labels()) === JSON.stringify(['Resume', 'Moves: Gamepad', 'Moves: Keyboard', 'Cheats', 'Gems', 'Back to the overworld', 'Save game', 'Fullscreen', 'New game (erases save)']), await labels());
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
  await ev("(function(){ const P = BibooProgress; return P.unlock('energy_kick'); })()");
  await ev("bibooGame.enterLevel(1)"); await wait(400);
  check('energy_kick unlocks the energy meter (P.meterOn)', await ev("BibooProgress.meterOn('energy') && !BibooProgress.meterOn('empower') && !BibooProgress.meterOn('super')"), null);

  // ---- 13. map doors and the level gate
  await ev('bibooGame.enterLevel(1)'); await wait(600);
  await ev('bibooGame.setEnemies([])');
  await ev('bibooGame.setX(340)'); await page.keyboard.down('ArrowRight'); for (let i = 0; i < 40 && (await S()).level.id === '1.1'; i++) await wait(200); await page.keyboard.up('ArrowRight'); await wait(300);
  s = await S();
  check('walking off the right edge loads 1.2 at the left door', s.level.id === '1.2' && s.px < 60, s.level);
  await ev('bibooGame.setX(50)'); await page.keyboard.down('ArrowLeft'); for (let i = 0; i < 40 && (await S()).level.id === '1.2'; i++) await wait(200); await page.keyboard.up('ArrowLeft'); await wait(300);
  s = await S();
  check('walking off the left edge goes back to 1.1 at the right door', s.level.id === '1.1' && s.px > 300, { l: s.level, px: s.px });
  await ev('bibooGame.warp(8)'); await wait(700);
  s = await S();
  check('1.9 has 2 enemies', s.foes.length === 2 && s.level.id === '1.9', s.foes.length);
  await ev('bibooGame.setX(290)');
  await page.keyboard.down('ArrowRight'); await wait(3500); await page.keyboard.up('ArrowRight');
  s = await S();
  check('the last map is a locked door (moves missing)', s.screen === 'level' && !s.levelDone && s.level.id === '1.9', s);
  await ev('bibooGame.setHp(200)');
  await ev('for (let i = 0; i < 2; i++) bibooGame.killFoe(0)'); await wait(200);
  await ev("Object.keys(BIBOO_LEVELS.whereIs).filter(i => BIBOO_LEVELS.whereIs[i].split('.')[0] === '1').forEach(i => bibooGame.unlock(i))");
  await ev('bibooGame.setX(300)'); await page.keyboard.down('ArrowRight'); await wait(3000); await page.keyboard.up('ArrowRight'); await wait(300);
  s = await S();
  check('with every move, the door leads into the boss arena', s.level.id === '1.10', s.level);
  await ev('bibooGame.killFoe(0)'); await wait(600);
  await ev('bibooGame.setX(300)'); await page.keyboard.down('ArrowRight'); await wait(3000); await page.keyboard.up('ArrowRight'); await wait(300);
  s = await S();
  check('beating the boss and walking out of the arena completes the level', s.levelDone, s);
  check('level 2 is now unlocked and Level complete message shown', (await ev('BibooProgress.state.levelsUnlocked')) === 2 && /complete/i.test(await ev("document.getElementById('menu-title').textContent")), await ev("document.getElementById('menu-title').textContent"));
  await clickText('Back to the overworld'); await wait(200);
  s = await S();
  check('back on the overworld with the menu closed', s.screen === 'overworld' && !(await ev('bibooGame.menuOpen()')), s);
  await ev('bibooGame.enterLevel(2)'); await wait(700);
  s = await S();
  check('level 2 can now be entered (2.1)', s.screen === 'level' && s.level.id === '2.1', s.level);

  // ---- 14. game over and retry (cheats from earlier off first)
  await cheatMenu(); await clickText('God Mode'); await clickText('Infinite Meter'); await cheatsDone();
  check('cheats can be turned off again', !(await S()).cheats.invincible && !(await S()).cheats.infinite, (await S()).cheats);
  await ev('bibooGame.hurtHer(9999)'); await wait(700);
  s = await S();
  check('K.O. shows the Game Over menu with Retry this map', s.gameOver && /^Retry this map/.test((await labels())[0]), { s, l: await labels() });
  await clickText('Retry this map'); await wait(600);
  s = await S();
  check('Retry reloads the same map at full health', !s.gameOver && !s.paused && s.hp === (await ev('bibooGame.maxHp()')) && s.level.id === '2.1', s);

  // ---- 15. Cheats actions in a level
  await cheatMenu(); await clickText('Level Unlock'); await clickText('Master Unlock'); await cheatsDone();
  check('cheats: all levels unlocked', (await ev('BibooProgress.state.levelsUnlocked')) === 6, null);
  check('cheats: all unlocks owned', await ev('BibooProgress.UNLOCKS.every(u => BibooProgress.has(u.id))'), null);
  await cheatMenu(); await clickText('God Mode'); await cheatsDone(); await ev('bibooGame.setHp(200)'); await ev('bibooGame.hurtHer(150)');
  check('cheats: God Mode blocks damage', (await S()).hp === (await ev('bibooGame.maxHp()')), (await S()).hp);
  await cheatMenu(); await clickText('No Pitfalls'); await cheatsDone();
  check('cheats: No Pitfalls is on', (await S()).cheats.nopit, (await S()).cheats);
  await ev("BibooProgress.wipe(); BibooProgress.reset(); bibooGame.goOverworld()"); await wait(200);
  check('reset returned to the overworld with nothing unlocked', !(await ev("BibooProgress.has('thrust')")) && (await ev('BibooProgress.state.levelsUnlocked')) === 1 && (await S()).screen === 'overworld', await S());

  // ---- 16. unsaved progress does not survive a reload; a manual save does
  await ev("BibooProgress.unlock('thrust'); BibooProgress.completeLevel(1); BibooProgress.addGem('health', 3)");
  await page.reload(); await page.waitForFunction(() => document.getElementById('btn-start') && window.bibooGame, null, { timeout: 20000 });
  check('unsaved progress is gone after a reload', await ev("!BibooProgress.has('thrust') && BibooProgress.state.levelsUnlocked === 1 && BibooProgress.state.gems.health === 0"), await ev('JSON.stringify(BibooProgress.state)'));
  check('title screen again after reload', (await S()).screen === 'title', null);

  console.log(errors.length ? errors : '');
  console.log(results.filter(x => !x).length ? 'SOME FAILED' : 'ALL PASSED', `${results.filter(Boolean).length}/${results.length}`);
  if (errors.length) console.log('page errors:', errors);
  await browser.close();
  process.exit(results.every(Boolean) && !errors.length ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
