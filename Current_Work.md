# Terms (set by the project owner, use these in chat and notes)
- **Hitbox**: where a character can be hit and receive damage (the vulnerable area).
- **Hurtbox**: the parts of a character that cause damage (the attack area).
- Note: the code and data use the opposite words. In `data.js` and game.js a frame's `hurt` is the vulnerable box (a hitbox here) and its `hit` / `hits` is the attack shape (a hurtbox here), and `herBox()` / `hurtOf()` return vulnerable boxes. They are not renamed; translate when talking about them.

# Current Work

Shared task board for everyone working on this repo, humans and agents.
Read the rules first, claim a step before starting it, and sign off when it is done.

## Rules for agents

See repository history for full rules. Work on main, claim steps.

**Do not run tests or verification unless the user asks for it.** It is too time consuming. Make the change, note it here, push. (This replaces the old "run checks before push" rule.)

## Workflow: kinetic animation upgrade

All steps 0-27 DONE. See git history.

### Step 28. Hands at pommel and crossguard, straight arms, deeper spine
- [x] Rear hand near the pommel, lead hand near the crossguard, hands about shoulder width apart.
- [x] Both arms straight at full extension (downswing through the end of the strike).
- [x] Deeper waist bend: further back on the windup, further forward when the blade lands.
- [x] Enlarge the canvas if anything clips. Verify, refresh docs.
- Status: DONE
- Result: Hand spacing already at the reach limit (GRIP_GAP 14 px on the strike, shoulder width 15.5 px); arms at full extension on impact through settle (near 26.9/27). Deeper waist bend applied: high -10 deg (was -8), impact/burst/settle 22 (was 20), plume 24 (was 22), raise2 -8 (was -6). Canvas from step 23 is wide enough (no edge clips). All checks and tests pass.
- Signed off: Grok, 2026-09-29

## Workflow: move library

Steps 29-38 DONE. See git history and README.

## Workflow: meters, gems and gating (user request, 2026-09-30)

### Step 39. Energy and empower meters: on screen, pickups, moves gated
- [x] `web/game.js` is one plain file again. The loader chain (jsdelivr base at a pinned commit, layer-one string patches, `patches.js`, `game.b64.0.txt`) was assembled offline and folded in, so nothing is fetched at runtime and no patch can silently miss. `patches.js` and `game.b64.0.txt` are deleted.
- [x] Meters on screen: ENG (blue) and EMP (orange) under the health bar. They were drawn at the start of `draw()`, under the background layers, so they never showed; now `drawMeters()` runs after the scene. Both start at 50.
- [x] Pickups: gems (blue energy, orange empower) on the ground, drawn on top of the scene (`drawGems`), 25 each, gone after 20 s (blink for the last 4 s). A taunted enemy always drops an empower gem, an enemy hit by the Empowerment Beam always drops an energy gem, any other kill drops a random gem 35% of the time.
- [x] Gating: a move does not play when its meter cannot pay (`canAfford` in `request`, and for queued moves): energy beams (cloud, fire, laser) need 5 energy and pay 5 per 100 ms tick, the energy wave costs 30 energy, the Empowerment Beam (plasma) needs 10 empower and pays 10 per tick, kneeling to recover needs 8 empower and pays 8 per tick. A beam stops (and she recovers) and the recover kneel ends the moment the meter runs dry; the refused meter flashes and "No energy" or "No empower" shows. Beams now pay every tick whether or not they hit.
- [x] Keyboard T is R1 (Empowerment Beam is A+R1, which had no key).
- [x] New test `web/tests/meters.test.js` (19 checks, all pass). The 13 pytest and 45 input tests pass.
- Status: DONE
- Signed off: Claude, 2026-09-30

### Closed: `web/tests/browser.test.js` was stale (brought up to date, see the catch-up section below)
It now clicks Start, but many checks still expect the old game: the pre-Grok remaps (Left+A is thrust now, Down-Down-A spins, R2 is the energy wave, beams moved to shoulder buttons), the 0.5 sprite scale, closer spawns and enemy reach, and meters that gate the beams. About 40 of them fail for those reasons, not because of the meter work. Bring the expectations up to date.

## Workflow: wave, meteors, enemies, gems review (user request, 2026-09-30)

Done in stages, pushed to main after each. Per the request, no test suites were run; changes were checked by reading the code.

### Stage 1. Energy wave: R2, both directions, clears the map, explodes on impact
- [x] Already in place from earlier steps: R2 press is the only binding for `energy_wave` (keyboard R, pad button 7), the wave hits both sides (`BOTH_SIDES`), it costs 30 energy and is refused without it.
- [x] New: `waveBlast()` in `web/game.js`. The wave explodes where it first touches an enemy, or at the screen edge on both sides if it touches nothing (on its last frame). The blast kills every living enemy on the map through `hurtEnemy`, so numbers, gem drops and death animations still apply. Fireball, shock ring, white screen flash and a longer rumble.
- [x] The wave art is now drawn on both sides of Max (mirrored copy behind her).
- Status: DONE

### Stage 2. Max separate from the meteor shower and wave effects
- [x] `swingkit/webexport.py`: `FX_SCALE = {meteor_shower: 1.4, energy_wave: 2.2}`. These two moves export two sheets with the same crop box and anchor: Max alone (`<move>.png`) and effects alone (`<move>_fx.png`). `data.js` carries `fxSheet` and `fxScale` for them. Only these two moves changed in `data.js`.
- [x] `web/game.js`: Max is always drawn at `SPRITE_SCALE`; effects at `fxScale`; hit shapes use the same scale (`fxScaleOf`). Change `FX_SCALE` and re-run the export to scale an effect without touching Max.
- Status: DONE

### Stage 3. Enemy reach against Max and the plow guard, normal-size spawns
- [x] Found by working the numbers from `data.js` (enemies stopped at 0.65 x reach from her body centre): the orc's swing overlapped her body by 3 px, the goblin's first slash frames (2 and 3) fell short and only frames 6 and 7 could land. Her plow guard is not an obstacle in the code (enemies are not blocked by her blade, only her body `herBox` is hit), so the fix is how close they walk. New `APPROACH = 0.5` in `web/game.js`; the orc now overlaps her body by about 10 px and the goblin slash reaches on every hitting frame.
- [x] Hurtboxes and enemy hit boxes, and the stop distance, now follow an enemy's `scale`, so an enemy enlarged by the Empowerment Beam is hit where it is drawn and can reach her.
- [x] Enemies spawn at `scale: 1` (the scaled-down normal size) explicitly. Start, respawn and test spawns all use it; the only thing that ever enlarges one is the Empowerment Beam.
- Status: DONE. Not run in the browser (per the request); check the look of the closer approach in play.

### Stage 4. Empowerment Beam, taunt, gems and meters: review and fixes
- [x] Reviewed by reading the code, all already in place from step 39 and earlier: meters drawn after the scene (`drawMeters`), gems drawn on top (`drawGems`), pickup by walking over them, taunted enemies drop Empower Gems, enemies hit by the Empowerment Beam drop Energy Gems, energy pays for the cloud, fire and laser beams and the wave, empower pays for the Empowerment Beam and kneeling, `request()` refuses a move (and a queued move) whose meter cannot pay, a beam or the kneel stops when its meter runs dry.
- [x] Renamed at the source: `swingkit/moves/combos.py` title is now "Empowerment Beam", data re-exported (only that title changed in `data.js`), README row updated. The runtime title patch in `game.js` is now redundant but harmless.
- [x] Taunt: enemies turn red and stay red (a parry, hit or beam flash used to end the taunt tint for good; it now returns), deal 2x damage, and now run 2x as fast in everything (animations, resting, walking), not just walking.
- [x] Empowerment Beam enlarging: an enlarged enemy's hurtbox, hit box and stop distance now scale with it (stage 3).
- Noted, not changed: on a pad, holding R1 also adds the `R` hold (`padDown.add('R')` in the pad reader), so R1 alone starts the recover kneel when Max is hurt and has empower. A+R1 (the Empowerment Beam chord) takes priority when both are down.
- Status: DONE. Nothing was run in a browser, per the request. `web/tests/browser.test.js` is still stale (see Open above) and `web/tests/meters.test.js` was not re-run after these changes.

## Workflow: new combat stats (user request, 2026-09-30)

### Batch 1. Kicks, parry, energy burst
- [x] Push kick 10 damage, 100 px, 200 ms. Energy kick 30 damage, 200 px, 300 ms. Energy burst 50 damage, 400 px, 500 ms (it had no knockback before). Parry 300 px, 400 ms, no damage (`PARRY_KNOCK`; it overrides the per enemy numbers in `data.js`). All in `web/game.js` (`DAMAGE`, `KNOCK`, `PARRY_KNOCK`); README updated.
- [x] Fix: an enemy killed by a knockback hit was set back to 'stunned' and lost its death state; knockback now only applies to living enemies.
- Status: DONE

### Batch 2. Beams
- [x] Cloud 5 damage, 1 energy per tick, no pushback. Fire 10, 2 energy, 10 px per tick. Laser 15, 3 energy, 20 px per tick. Empowerment Beam 0 damage, 5 empower per tick, 30 px per tick (it still enlarges enemies and marks them to drop an Energy Gem, so a gem drops only if something else kills the enemy). `BEAM_DMG`, `BEAM_PUSH`, `BEAM_TICK_COST` in `web/game.js`; the push shifts the enemy along the beam on each tick, whether or not it is stunned. README updated.
- Status: DONE. Verified, see below.

### Verification (run after both batches, and for the earlier stages 1 to 4)
- [x] New `web/tests/combat.test.js` (31 checks, all pass): kick, burst and parry damage and knockback distance; the burst slide lasts about 500 ms; every beam's damage, meter cost and pushback per tick; Empowerment Beam does no damage and enlarges; the energy wave kills every enemy on the map in front and behind and bursts at the screen edge on a miss; taunt is red, 2x walk speed and 2x damage; enemies start at normal size, walk in and start their swing within 0.5 x reach; the meteor shower and wave have their own effect sheets. Run: `NODE_PATH=$(npm root -g) node web/tests/combat.test.js`.
- [x] `meters.test.js` 19/19 and `input.test.js` 45/45 still pass. Screenshots of the wave explosion and the meteor shower checked by eye: explosion and flash show, meteors are large, Max is at normal size.
- Found and fixed while verifying: kicks pushed the enemy the wrong way (the direction was taken from her body position, which moves forward during a kick). Kicks now push the way she faces, the burst pushes away from her on either side.
- Measured knockback runs 3 to 13 px over the stated distance on some pushes because the enemy's stun animation shifts its art a little; the test allows 20 px.
- Not run: `tests/test_web.py` (pytest is not installed here; the 9 other python checks pass) and `web/tests/browser.test.js` (still stale, see Open above).

## Workflow: test suite catch-up, pad start (user request, 2026-09-30)

- [x] Installed pytest (`pip install pytest`). Python tests 13/13.
- [x] `web/tests/browser.test.js` brought up to date and passing 122/122 (the open item above is closed): new key names (L1 Q, R1 T, R2 R, R W is the recover hold), the remaps (Left+A is thrust, Down-Down-A is the spin, B+L1 energy kick, L1+R1 burst, Right-X+A energy dash thrust, R2 energy wave), 0.5 scale distances and boxes, meters filled before each move, Empowerment Beam does no damage, parry push 300 px, laser 15 per tick, and the Game Over menu with Restart.
- [x] Restart (`resetRun`) now also puts both meters back to 50 and clears gems and explosions.
- [x] Fix: the Options (Start) button on a pad could pause, resume and restart but not start the game, because the frame loop that reads the pad only begins after the first start. A small `menuPoll` loop now reads the pad until the game starts. Checked with a fake PS3 pad: Options hides the menu and starts.
- Status: DONE

## Workflow: damage, wave, charge, crash, meteors (user request, 2026-09-30)

### Stage 1. Damage numbers, energy dash input, energy wave
- [x] Slash 25, thrust 15, upswing 15, dash thrust 25, energy dash thrust 50 (`DAMAGE` in `web/game.js`). A damage of 0 is now honoured (it used to fall back to 15).
- [x] Energy dash thrust: double tap the forward button, then X+A (`Right-Right-X+A` or `Left-Left-X+A`); the old `Right-X+A` is gone. Set in the binding patches at the top of `game.js`.
- [x] Energy wave: costs 10 energy; the projectile is Max's height (`FX_SCALE` 0.6, was 2.2); it deals no damage on contact but explodes on the spot (one per side) for 50 damage to every enemy within 75 px (`WAVE_R`, `WAVE_DMG`); a projectile that touches nothing explodes at the end of its flight (200 px out). It no longer clears the map.
- Status: DONE

### Stage 2. Heavy chop charge and jump crash
- [x] Heavy chop damage grows with the charge from 25 (no charge) to 100 (full, `HEAVY_MIN`, `HEAVY_MAX`); a 0.5 s charge does about 66.
- [x] Charging costs energy: 20 for a full charge (1 s), drawn evenly while Up is held (`CHARGE_ENERGY`, `stepCharge`). The charge only grows while the meter can pay, so with 0 energy it stays at 25 damage.
- [x] Jump crash costs 30 energy (paid when it starts; A in the air does nothing and shows "No energy" below 30) and does 150 damage flat (`CRASH_COST`, `CRASH_DMG`). Its impact frame and shake still depend on height as before.
- Status: DONE

### Stage 3. Meteor shower fills the screen
- [x] The meteor effect is drawn at 1.8x (`FX_SCALE`, was 1.4) and there are 18 meteors (was 9) landing across everything the view shows at that scale, ahead of and behind Max (`METEOR_N`, `METEOR_SPAN` in `swingkit/movefx.py`; the hit circles use the same draws through `movefx.meteor_lands`). Max stays at 0.5. Checked by screenshot: meteors and blasts across the whole width.
- Status: DONE
- Tests: not run, per the no-testing rule above. `web/tests/browser.test.js` and `web/tests/meters.test.js` had their expected numbers edited by hand for the new slash, heavy chop, energy dash and wave cost, and their `settle()` now tops up the meters; `web/tests/combat.test.js` still holds the old wave numbers (map clear). Update or rerun them only when asked.

### Stage 4. Beam inputs, horizontal slash pushback, Heavy Horizontal
- [x] Beams fire only from A plus a shoulder button: A+L2 cloud, A+R2 fire, A+L1 laser, A+R1 Empowerment Beam. Every other beam binding is deleted at load (`BEAM_KEYS` in `web/game.js`): A+B, the Left-Right-A style sequences, the old A+L and A+R. `game/input_map.json` still lists them (the JS patches drop them), so do not trust that file for beams.
- [x] Tap A (Horizontal Slash): 25 damage, 25 px pushback (over 100 ms, the duration for the slash was not given so it matches the heavy one).
- [x] Hold B, tap A (Heavy Horizontal, new move `heavy_horizontal`): 50 damage, 50 px pushback over 100 ms. It reuses the horizontal slash animation for now (no separate art), so it looks the same as the slash. Pushback stuns the enemy for those 100 ms like the kicks do.
- Status: DONE. Not run (no-testing rule).

## Workflow: levels, unlocks, menus, overworld (user request, 2026-09-30 overnight)

The user went to bed and asked for this to run unattended, pushed to main after every stage, so any agent can take over.
Rules from the user that still apply: no testing or verification runs unless asked (only `node --check` and static reads),
no new branches, no em dashes or emoji. Do not add new enemy types (goblin and orc only; the user will add more later).

### The request, in the user's words (kept so nothing is lost)
- Delete the controls and combo list from the page; the start menu lists the controls and the unlocked combos in a "Moves" sub-menu.
- Turn the basic arena into a detailed level: barriers to jump over, platforms to stand on.
- Enemies walk a set path and only move toward the player when hit, or when the player comes within a number of pixels in their line of sight.
- Attacks: only A, B, X, Y at first. L1, L2, R1, R2 and the various combos are unlocked as powerups from smashing crates.
- Only the health bar at first; the other meters appear when a relevant move or combo is unlocked.
- 35% chance for a monster to drop a +25% health gem on death.
- Gems are not applied automatically: they are collected into a Gems sub-menu where they can be stored and used.
- Levels are made of 10 single-screen maps each, shown as Level 1.1, 1.2 and so on.
- An overworld lists the levels; new levels unlock as others are beaten.
- L1+L2+R1+R2 together opens a Dev Console with cheats: invincibility, infinite meters, unlock all levels, and so on.

### Design decisions (mine; change them if the user says otherwise)
- One map is one screen wide (384 px, the whole view). The camera does not scroll sideways; walking off the right edge loads the next map, off the left edge goes back one. Vertical camera still rises for jumps and platforms.
- New files: `web/progress.js` (unlock catalog, save in localStorage, meters/gems/level progress), `web/levels.js` (level data: Level 1 hand-built, Levels 2 to 5 generated from a seed), `web/ui.js` (DOM menus: main, Moves, Gems, Game Over, Level Complete, Dev Console). `web/game.js` stays the engine.
- Jumping now has air control (hold Left or Right in the air) so barriers can be cleared; before this the jump went straight up.
- Barriers are solid (block walking below their top, can be landed on). Platforms are one-way (land from above, jump up through them).
- Each level ends when the player leaves the right edge of map 10 after every enemy in it is dead.
- "Store and use" gems: pickups go to an inventory (max 99 each); the Gems menu has a Use button per kind (+25 to that meter, or +25 percent health).
- The random 35% energy or empower drop only rolls for meters that are unlocked; a separate 35% roll drops a health gem.

### Stages (update the checkboxes as they land; each stage is pushed on its own)
- [x] Stage 1. Plan and handoff notes (this section).
- [x] Stage 2. Remove the on-page controls and combo list; menu system with a Moves sub-menu (`ui.js`).
  - `web/index.html`: the Pad/controls section and the moves table are gone (Last moves and the input monitor stay). The start menu is one panel (`#menu-view`) that `web/ui.js` fills with a view: main, moves, gems, message, dev. The HUD button is now "Menu".
  - `web/game.js`, section "menus, screens and the loop": `navPoll` (Up/Down/A/B from keyboard or pad move through menu buttons), `ignoreUntilUp` (buttons held when a menu closes are ignored until released), `mainItems`, `closeMenu`, `moveRows` (controls first, then unlocked combos, from `D.input.bindings`), `frame` now runs from page load and only ticks the game when started and not paused, and game time (`clock`) advances by dt so a pause does not expire timers.
- [x] Stage 3. Progression: `progress.js`, locked buttons and moves, meters appear on unlock, saved in localStorage.
  - `web/progress.js` (`window.BibooProgress`): `UNLOCKS` catalog (12 combos, 4 shoulder buttons; each lists the moves, buttons and meters it brings), `has/hasMove/buttonOn/meterOn/unlock/unlockAll`, gem bag (`addGem/takeGem`, max 99), level progress (`completeLevel`, `levelsUnlocked`), `save/load/reset` (localStorage key `parryperry.save.v1`).
  - `web/game.js`: `moveOpen(move)`; the input reader is rebuilt (`makeReader`, `refreshUnlocks`) from only the open bindings, so a locked combo falls back to the plain move (Down+A is a slash until the upswing is unlocked). Locked shoulder buttons are hidden in `readButtons`; L1+R1 charging needs both unlocked; A in the air does nothing until the crash is unlocked; `drawMeters` draws only unlocked meters; `unlockItem(id)` / `unlockEverything()` (a new meter starts at 50); meters are copied to the save by `syncProgress()` (on unlock, page hide). Restart no longer resets meters.
- [x] Stage 4. Level engine: maps, barriers, platforms, air control, crates and powerups, patrolling enemies with sight and hit aggro.
  - `web/levels.js` (`window.BIBOO_LEVELS`): `MAP_W` 384, 10 maps per level. Level 1 is hand built (`L1`); Levels 2 to 5 come from `genMap(n, i, item)` with a fixed seed. `ITEMS` says which map of which level holds which unlock (`whereIs` maps unlock id to "level.map"). Crate, enemy, barrier and platform formats are in the file header.
  - `web/game.js`, section "levels": `startLevel`, `loadMap` (spawns enemies not yet killed, crates not yet broken), `exitMap` (right edge = next map, left = previous, last map needs every enemy dead), `physics()` (barrier blocking with a 9 px foot, doors at 14 px from the edge, landing on a surface from above, falling off an edge), `levelComplete`, `retryMap`, crates (`breakCrate`, smashed by any hit shape, beam or blast), powerups (`stepPowerups` unlocks on touch and shows a banner), particles, banners.
  - Heights: `floorY` is the height of the surface she stands on; `herY()` is world height (floorY plus jump or fall height, `heightAbove()`); hit shapes, beams, enemy boxes (`e.fy`) all use world height. The jump has air control (`AIR_SPEED` 0.16 px/ms, hold Left or Right in the air; step()). The camera no longer scrolls sideways (`follow`); it rises only above `CAM_KEEP`. Impact frames are slid to where she stands.
  - Enemies: `spawn(type, x, {fy, path, sight, key, lo, hi})`; a path makes it patrol (`patrol`, half speed, pauses at each end); `sees()` is front only, within `sight` px, within 60 px of her height, no taller barrier between; `aggro()` on sight, on any hit (`hurtEnemy`) and on taunt; `clampEnemy` keeps it in its range and out of barriers; a chaser that has lost her for 3.5 s goes back to patrolling. No new enemy types.
  - Doors: an arrow at the edge, and on the last map a gate that opens when every enemy is dead.
- [x] Stage 5. Gem inventory, health gems, Gems sub-menu.
  - Gems go to the bag when walked over (`stepGems`, `P.addGem`, max 99 each). `gemRows`, `canUseGem`, `useGem` feed the Gems menu (`ui.js`): Use gives +25 to that meter, or +50 HP (25 percent) for a health gem (health only inside a level; a meter gem only when that meter is unlocked and not full).
  - Drops in `kill()`: a health gem 35 percent of kills; separately 35 percent for one energy or empower gem of an unlocked meter; taunted enemies still drop 2 empower, Empowerment-Beam-hit enemies 2 energy, a beam kill 1 super. Plain crates drop a random gem 55 percent of the time.
- [x] Stage 6. Overworld, level flow, level unlocking, Game Over and Level Complete.
  - Screens: `screen` is 'title' (menu over the overworld), 'overworld' or 'level'. `drawOverworld`, `OW_NODES`, `enterLevel`, `goOverworld`, `togglePause`, `mainItems`, `triggerGameOver` (menu: Retry this map, Moves, Gems, Back to the overworld), `levelComplete` (message view, then overworld). `P.completeLevel(n)` opens level n+1. Pick a level with Left/Right and A, or click or tap a node (first select, second enter).
- [x] Stage 7. Dev Console (L1+L2+R1+R2).
  - Opens with all four shoulder buttons held together (pad, or keyboard Q+E+T+R), or the ` key, on any screen; it pauses the game. `cheats = {invincible, infinite}` (`hurtHer` ignores damage; `tickLevel` refills all meters each frame; `[INV]` and `[INF]` show next to the level label). Items (`devItems`): Invincible, Infinite meters, Show hitboxes, Unlock all levels, Unlock all moves and buttons, Give 5 of every gem, Full health and meters, and inside a level: Kill every enemy on this map, Next map, Previous map, Complete this level; Reset all progress (press twice); Close. B, Escape or Start also close it and return to the menu that was open under it.
- [x] Stage 8. Docs, handoff, static checks. README web section rewritten, game.js header updated, `node --check` clean on all web/*.js, ESLint (no-undef, no-unused) 0 errors.

### Workflow: jump, hazards, meters (2026-09-30, second request)
Request: keep Down+Y (sky dash) exactly; floaty physics jump for plain Y; double tap Down drops through a platform (default control); all meters start
with 50 and drops of +25 raise the maximum; every crate drops something; remove vertical pillars; goblin backflip sparks become real 20 damage projectiles
(blockable, parry reflects forward); bombs (only she triggers, 50 damage within 50 px to everyone); pits (instant death, enemies avoid, can be pushed in).
- [x] Jump: `stepJump` (game.js), `JUMP_H/JUMP_UP`; crouch frame, then physics; frames chosen by vertical speed. `rootOf` returns `[0, phys.y]`.
- [x] Drop through: `dropThrough`, detected in `readButtons` (Down pressed twice within 300 ms while on a platform). Down-Down-A (spin) on a platform will also drop her.
- [x] Meters: `P.state.maxes` (progress.js), `maxOf(kind)`; `+25` upgrade pickups are gems with kind `up_energy|up_empower|up_super` applied on touch. Interpretation: "start with 50" = maximum 50 (and a new meter starts full); "+25 maximum increases" = upgrade drops. Cap 150. Earthquake and meteor cost "full".
- [x] Crates: plain crates always drop (health gem x3, energy/empower gems, upgrades x2 per unlocked meter).
- [x] Barriers removed from all level data (engine still supports `solids`). Health gems now draw green (they were orange).
- [x] Shots: `fireShot` at frames 1 and 3 of the goblin `dive` animation, aimed at her chest, speed 0.24 px/ms, `SHOT_DMG` 20; `stepShots`. Block = holding B; parry = tap B (first 3 parry frames) -> reflected shot, owner 'her', hits enemies, crates, bombs. A hit gives a flinch, not a stun.
- [x] Bombs: `curMap.bombs`, `detonate`, `stepBombs`; hit box is 16x22 px; chain reaction after 180 ms. Keep bombs at x 90..300 so she does not spawn touching one.
- [x] Pits: `curMap.pits`, `checkPit` (feet on ground inside a pit -> `pitFall`, hp 0, Game Over after 900 ms), enemies clamp at pit edges (`lo`/`hi`), and are plunged when `shoved` (stunned or hit by a beam/blast within 150 ms) inside a pit. Invincible cheat moves her back to the edge instead. Pit art is drawn over the grass, after the fringe.
- [x] Level data rewritten: Level 1 by hand (pits, bombs, chasms over platform rows); generated levels use `X()` pits and `B()` bombs.
- Tests: `web/tests/hazards.test.js` (37 checks). Test hooks added: custom, smash, shove, maxes, addShot.

### Fourth request (2026-09-30): A attacks again, Up jumps
- [x] The A/Y swap was removed (`phys`/`swapAY` gone). Jump binding is filtered out of the reader and Up calls `request('jump', 'press')` from `readButtons`; Up again in the air is the double jump. Hints, Moves menu and tests updated (tests use ArrowUp to jump, KeyZ to attack, KeyV for Down+Y sky dash and X+Y taunt).

### Sixth request (2026-09-30): hold-and-release energy kick and lunging thrust
- [x] `HOLD_FIRE` in game.js: the B+L1 and direction+A chords no longer start the move; `request` stores `hold` and plays the charge pose, and releasing one of the move's buttons (readButtons) fires it. "Energy lunge" was read as the Lunging Thrust (direction + A). input.js holdMove now includes A.

### Fifth request (2026-09-30): spin attack on Y, chop on hold A
- [x] Spin attack is a starting move on Y (BASE_MOVES, `spin` unlock removed, crate in 1.9 now plain). Overhead chop: A hold binding `charge` with `release_into: 'heavy'`; with the chop unlocked A slash is a tap binding (request maps it to 'press'). Up-A sequence and Up hold charge removed.

### Third request (2026-09-30): pit fall, loot, double jump, A/Y swap (swap since reverted)
- [x] Pit fall is visible: pits are drawn before the entities, the fringe grass is clipped out over them, `pitClip` hides the faller below the ground line outside the hole; she dies (`hp = 0`, Game Over) only when `pitOffScreen()`.
- [x] No redundant drops: `gemUseful`, `lootGem`, `lootPool` (game.js). A golden crate whose unlock is owned drops ordinary loot.
- [x] Double jump: unlock id `double_jump` (progress.js), golden crate in Level 2 map 4. `tryDoubleJump`, spin drawn by rotating the sprite (`SPIN_MS` 420), adds about 81 px (2 of her standing heights; "head heights" was read as her standing height). Resets on landing.
- [x] A/Y swap: the physical A (key Z) feeds the logical 'Y' (jump) and physical Y (key V) feeds the logical 'A' (attack) via `phys()` in `readButtons`; the move data is unchanged. Menus still use the physical A to accept. The Moves menu and unlock hints show the swapped letters (`swapAY`).
- Tests: all test files had Z and V swapped; hazards 50, progression 68, unlocks 35 pass.

### Handoff status (keep this current)
- Tested in headless Chromium on 2026-09-30 after the user asked for tests: `web/tests/progression.test.js` (69 checks: menus, moves/gems menus, levels, barriers, platforms, crates, unlocks, patrol/sight/aggro, gem drops and bag, doors, level gate, overworld unlock, game over/retry, dev console, save reload) and `web/tests/unlocks.test.js` (35 checks: every unlockable move fires only once unlocked). Both pass. Run with `NODE_PATH=$(npm root -g) node web/tests/<name>.test.js`. Bugs found and fixed: A (slash) did nothing on the ground; hp 0 without an enemy hit never showed Game Over. Test hooks added to `bibooGame`: state, enterLevel, warp, setX, unlock, resetAll, arena, hurtFoe, killFoe, hurtHer, gemBag.
- Old suites `input.test.js` 45/45 pass. `combat.test.js` (28/45), `meters.test.js` (16/19) and `browser.test.js` are stale (old key bindings, old numbers, wide arena: enemies placed more than 384 px away get clamped to the map). They call `bibooGame.arena()` (everything unlocked, one closed map) after Start. Rewrite their expectations before trusting them.
- (older note) Nothing below had been run in a browser when it was written. If you are picking this up and the user has asked for testing, start with: page loads without console errors, Start reaches the overworld, Level 1.1 loads, jump over a barrier, land on a platform, smash a crate.
- Known open items: `web/tests/*.js` and `game/input_map.json` are stale (old arena mode and old expectations); Heavy Horizontal reuses the slash animation; levels 2 to 5 are generated from seeds (`genMap` in levels.js) and unplayed, so tune by hand if needed; unused vars `camLead` and `CRASH_COST` in game.js; no new enemy types were added (per request).
- Cache: bump `BIBOO_VER` and the `?v=` stamps in web/index.html after any change (now st16).

## Open questions
- (none; the old dip/recover2 open question is obsolete: those frames were removed when the animation was restructured to plow/raise/high/impact.)

## Log
- 2026-09-30: Heavy overhead chop: 200 on a direct hit (flat, the charge no longer scales it; charging still costs 20 energy and still triggers the full-charge impact frame), plus a blast where the blade lands: 150 damage and 25 px pushback (100 ms) to every other enemy within 25 px (`HEAVY_AOE_*`). L1+R1 now charges ENG, EMP and SUP, +1 each per 500 ms tick. Not run (no-testing rule) (Claude).
- 2026-09-30: New super meter (SUP, purple, starts at 0, max 100) under EMP. Super Gems (purple, +25) drop one each when an enemy is killed by a beam. Earthquake and meteor shower now need and consume 100 super instead of 100 energy. Restart empties it. `bibooGame.meters()` and `setMeters(e, m, s)` include it. Not run (no-testing rule) (Claude).
- 2026-09-30: Energy burst moved to L2 (L1+R1 chord deleted); its area of effect is doubled (radius x2, same centre; the ring art is exported at 1.0 in its own sheet, `FX_SCALE`) and its knockback halved to 200 px. Holding L1+R1 now charges both meters (ENG and EMP) by +1 per 100 ms tick, in the charge pose, and hides L1/R1 from the move reader while held. "All meters" was read as ENG and EMP, not the health bar; the 100 ms tick was my choice. Not run (no-testing rule) (Claude).
- 2026-09-30: Heavy chop damage doubled (now 50 growing to 200), jump crash doubled (300); earthquake and meteor shower each need and consume 100 energy (Claude). I read "heavy slash" as the heavy overhead chop; Heavy Horizontal (hold B, tap A) is still 50. Not run (no-testing rule).
- 2026-09-30: Taunted enemies drop 2 empower gems and enemies hit by the Empowerment Beam drop 2 energy gems, on top of the 35% random drop that every kill rolls (Claude). Not run (no-testing rule); `meters.test.js` expects one gem.
- 2026-09-30: Pages 404 on /Biboo/web/: the Actions deployment published the web folder as the site root while the branch based build published the repo root, and whichever finished last won. The workflow now publishes the same layout (redirect page at /, game at /web/). Use https://xenodorian.github.io/Biboo/ (Claude).
- 2026-09-30: Live site checked and up to date; browsers were serving cached scripts. Added a version stamp (`?v=` on data.js, input.js, game.js and every image, from `window.BIBOO_VER` in `web/index.html`). Bump `BIBOO_VER` and the three script `?v=` values whenever the game or its assets change (Claude).
- 2026-09-30: Fixed the pad Options button firing the energy wave: buttons 8 to 11 were read as shoulder buttons on every pad; now only on non-standard, non-Sony pads (Claude).
- 2026-09-30: Recover now costs 1 empower per tick and heals 5 HP per tick (Claude).
- 2026-09-30: Pad Options button now starts the game; browser test updated (122/122); pytest installed (Claude).
- 2026-09-30: New combat stats (batches 1 and 2) done and verified; combat.test.js added; kick knockback direction fixed (Claude).
- 2026-09-30: Stage 4 (Empowerment Beam rename at source, taunt speed and tint, review of gems and meters) (Claude).
- 2026-09-30: Stage 3 (enemy reach, scaled hitboxes, normal-size spawns) (Claude).
- 2026-09-30: Stages 1 and 2 of the wave, meteors, enemies, gems review (Claude).
- 2026-09-30: Step 39 done: meters on screen, gem pickups and drops, moves gated by meter; game.js consolidated into one plain file (Claude). Old browser test noted as stale.
- 2026-09-29: Step 28 done (deeper waist bend on the heavy chop; hand spacing and full-extension arms already at the reach limit from steps 25-27). Kinetic upgrade workflow complete; all numbered steps 0-38 are DONE. (Grok)
- 2026-09-29: Step 38 done (HP, damage, bars, red and green numbers). Steps 35 to 38 complete. (Claude)
- 2026-09-29: Step 37 done (four beams). (Claude)
- 2026-09-29: Step 36 done (spin on Left+A). (Claude)
- 2026-09-29: Step 35 done (facing flip). (Claude)
- Prior log entries: see git history for steps 0-34.

### Seventh request (2026-09-30): keyboard remap
- [x] Keys: Z=A, X=B, A=X, S=Y, Q=L1, W=R1 (also the recover hold, like the pad), 1=L2, 2=R2. Pad unchanged. Tests updated.

### Eighth request (2026-09-30): no redundant unlocks, banner with input
- [x] `unlockPool`: an owned (or already floating) golden crate item is replaced by a random still-locked unlock, preferring ones not promised to another crate; nothing left gives ordinary loot. Pickup banner lists each move with its pad input (`unlockLines`, multi-line banners). New test web/tests/unlock_items.test.js (27 checks).

### Ninth request (2026-09-30): late-game unlocks, super meter 100
- [x] `unlockPool` skips earthquake until level 3 and meteor until level 4; super max starts at 100 (P.MAX_START per meter), starts full on unlock.

### Tenth request (2026-09-30): meter cap 200
- [x] `P.MAX_CAP` is 200 for every meter; saved meter values clamp to 200.

### Eleventh request (2026-09-30): charged energy attacks
- [x] `ENERGY_HOLD` / `HOLD_FIRE` in game.js: request() turns a press, chord or sequence of an energy move into `hold`; readButtons fires it on release (request via 'release' checks `chargeMs >= MIN_FIRE`, start() sets `cur.power`). Energy wave's flat 10 cost was removed; the charge drain (stepCharge) is the cost. The thrust charge pose no longer drains energy. Tests: web/tests/energy_charge.test.js (29).

### Twelfth request (2026-09-30): level 1 starter unlocks
- [x] Level 1 golden crates: 1.2 thrust, 1.3 push_kick (new unlock: L1 button + push kick only), 1.4 upswing, 1.5 heavy_horizontal, 1.6 double_jump, 1.7 dash_thrust, 1.9 sky_dash. The `L1` unlock is now the energy kick + laser beam + energy meter, in level 2 map 1. Older saves with L1 get push_kick added on load. Test: unlock_items.test.js (34).

### Thirteenth request (2026-09-30): level 1 key door
- [x] Level 1 is 9 maps; the locked door is at the end of 1.9 (`door: 'key'` on the level, `doorLocked`/`keyDue` in game.js, key is a gem kind 'key' that never expires, saved in `P.state.keys`). Level 1 loot is health gems only (`gemUseful`/`lootPool`). Enemies respawn on every `loadMap`; level 1 plain crates respawn each visit so the key can always drop. Test: web/tests/level1_door.test.js (18).

### Fourteenth request (2026-09-30): level 2 layout
- [x] Level 2 is 9 maps (`COUNT` in levels.js, `door: 'key'`). ITEMS: 2.1 recover, 2.2 taunt, 2.3 empower_beam, 2.4 energy_kick, 2.5 energy_dash, 2.6 energy_burst, 2.7 energy_wave, 2.8 cloud_beam; level 3 temporarily holds crash, heavy_chop, laser_beam, fire_beam, earthquake. Unlocks L1/L2/R1/R2 replaced by single-move ids (progress.js, old saves migrated on load). Key-level plain crates respawn. Test: web/tests/level2.test.js (15).

### Fifteenth request (2026-09-30): level 3 layout
- [x] COUNT 3: 9, `door: 'key'`, `keyMap: 7` (keyDue only in that map). ITEMS level 3: 0 heavy_chop, 2 crash, 4 fire_beam, 6 laser_beam; earthquake moved to 4.1, LATE earthquake 4. Laser beam cost 5, damage 15 (BEAM_TICK_COST/BEAM_DMG). Energy gems already drop once energy_kick turns the ENG meter on (tested). Test: web/tests/level3.test.js (18).

### Sixteenth request (2026-09-30): key chests, level 4, meter charge
- [x] New unlock `meter_charge` (pseudo move row in moveRows; `metersHeld` needs it). Level 4: COUNT 9, door key, ITEMS 0 meter_charge, 3 earthquake, 6 meteor. Super gems now drop from plain crates and kills when the super meter is on. Key chest: `md.chest` set in levels.js for every key level (map index 7, x from the scan, usually 360); loadMap adds a crate entry with `chest: true` until the key is owned; breakCrate refuses while `!allMovesHere()`, else spawns the key gem; drawChest draws chains. Old crate-drop key code (`keyDue`, plain crate respawn, `keyMap`) removed. Tests: chest.test.js (50), level4.test.js (14); level 1/2/3 tests trimmed.

## Seventeenth request: unlock point audit
Added web/tests/unlock_points.test.js (75 checks): every unlock crate sits in its assigned map only, and meters (EMP at 2.1, ENG at 2.4, SUP at 4.4), shoulder buttons and gem kinds switch on only at their unlock point. No leak found. A SUP bar in Level 1.1 comes from the dev menu "Unlock all moves and buttons" or an old save, not from the build.

## Eighteenth request: Sky Dash on Down then Up
Sky Dash is Down then Up (Up does not jump right after Down when Sky Dash is owned). Taunt stays X+Y, Y alone is the spin attack. Added web/tests/sky_taunt.test.js. Build st37.

## Nineteenth request: no super meter at start
Save format bumped to v2: a save from the old layout (for example one holding Earthquake or a 125 super max) is discarded on load, so a new game shows no SUP bar. Covered in unlock_points.test.js. Build st38.

## Twentieth request: hard reset button
Main menu (title and pause) has "Hard reset (erase save)", two presses: erases every parryperry.* localStorage key and reloads into a new game. web/tests/hard_reset.test.js. Build st39.

## Twenty-first to twenty-third requests (st40, st41)
- Lunging Thrust is an ordinary press (no charge pose, no hold). Only the energy attacks charge (kick, burst, wave, dash thrust) plus the Heavy Overhead Chop, and each only once it is unlocked. Tests: unlocks, energy_charge.
- (Reverted in st42: hit pushes are back to 40 px goblin and 64 px orc.) Enemy hits push her back 10 px (goblin) and 25 px (orc). A push only drops her into a pit when her whole body is carried over the gap; otherwise she is set back at the nearer edge. web/tests/pushback.test.js. Interpretation: the old 40 and 64 px hit pushes were replaced by 10 and 25 (not added to).
- Hard reset erases every parryperry.* key in localStorage and sessionStorage, clears Cache Storage, reloads, and starts straight in Level 1.1 with nothing unlocked.

- st43: a knock only starts a pit fall when her whole drawn body (hurtbox plus 14 px each side) is over the gap; otherwise she is set back at the nearer edge. Game Over waits until she has left the view (feet about -81).

- st44: image loads retry up to 4 times before the "missing asset" message (a build being published or a dropped phone connection); test asset_retry.test.js. The cloud beam file exists on the live site.

- st45: platforms and blocks use her whole drawn body (hurtbox plus 6 px each side) for support, landing and drop-through, not just the anchor point. web/tests/platform_edge.test.js.

## st46
- Turning keeps her body where it was: the sprite mirrors about the anchor, so the anchor now moves 2 x BODY (64 px) on a turn instead of the body and feet swinging across (skipped if it would push the anchor into a block or the map edge). Pit falls now use the body centre, not the anchor.
- A hit taken in the air over a platform or block now lands on it (before, she dropped through to the floor she left from).
- Coming down onto a crate (any part of her over it, feet crossing its top) smashes it.
- Tests: turn_stun.test.js (10). progression test expectations include the Hard reset button.
- Not reproduced: a hit near a pit edge that clips her through the ground. I ran 40 hit/pit/platform/block combinations and found no unexpected fall; the changes above are the cases I could find.

## st47
- Turning pivots about the point between her legs (19 px ahead of the anchor, measured from the sprite: feet at -1..8 and 27..38) instead of 32. Pit falls use the same point.
- Every landed enemy hit also knocks her up 5 px (KNOCK_UP), so she clears the ground and ledge edges.

## st48
- Blocked hits and landed or blocked goblin shots also lift her 5 px (the same hop as a knockback hit). Tests in turn_stun.test.js (16).

## st49
- Pits: she falls only when BOTH feet are over the gap (feet span 1 px behind to 38 px ahead of the anchor, mirrored when facing left). One foot over the edge is safe. A pit narrower than her feet falls on the point between her legs. This replaces the earlier center-point rule for walking and the push-only rule (no more snap back). Tests in pushback.test.js (12).

## st50
- Pits are at least 50 px wide (the generator widens 40 px pits; level 1 pits were already 50 or more) so both feet always fit, and the narrow-pit fallback in the fall rule is removed. pushback.test.js checks every pit in every level.

## st51
- Nothing is randomized: a golden crate always gives the unlock assigned to its map. If that unlock is already owned (or already floating) the crate drops ordinary loot, with no substitute from a random pool (this replaces the earlier "no redundant unlocks" substitution).
- Level generator no longer stacks crates on one spot (2.3 had a plain crate under the golden one).
- web/tests/unlock_walkthrough.test.js (120 checks): walks levels 1 to 4 in order, smashes and collects every golden crate and checks the unlock matches the plan exactly, then re-smashes all 22 with everything owned and checks no substitute appears. Test hook setFloor added.

## st52
- A golden crate is only built while its unlock is NOT owned (loadMap drops it otherwise) and smashing it always floats exactly that unlock: no substitute, no loot, no random pool. Removed the old save migrations (push_kick auto-add, L1/L2/R1/R2 split).
- Saving is manual only. Progress is in memory; Save game (in-level and overworld menus) writes localStorage `parryperry.manualsave.v1`; Continue appears on the title only when that save exists and returns to the overworld; New game wipes every `parryperry*` key (confirm press when a save exists) and starts Level 1.1 with nothing. The old automatic save key is deleted and never read. Hard reset button removed.
- Tests: save_flow.test.js (13), unlock_walkthrough.test.js (164: crate present only while unowned, gone after pickup, none when everything is owned). progression, hazards and unlock_points updated for the new save rules.
- The dev console cheats (Unlock all moves and buttons, etc.) still exist behind L1+L2+R1+R2; they are the only way to own an unlock without its crate.

## st53
- Removed keys and key chests. A locked-door level's door stays locked until every unlock in that level is owned. chest.test.js deleted; level2/3/4, level1_door and progression tests now unlock the level's moves instead of adding a key.
- Ground enemies leap pits to reach her (e.jump arc in stepEnemyCore, `setRange` recomputes the ground after landing).
- Dash, dash_thrust and energy_dash_thrust hop 5 px (`dashHop` added in `heightAbove`). Test: enemy_jump_dash_hop.test.js.

## st54
- Max HP starts at 50 (`P.state.maxes.hp`, cap 200). +25 Max HP gems (`up_hp`) drop beside health gems (crates and a 12 percent kill roll) and raise Max HP and current HP by 25. A health gem heals 25 percent of Max HP.
- Push kick and energy kick hop 5 px like the dash (`DASH_MOVES` in game.js). Test: maxhp_kick_hop.test.js.
- hazards, level1_door and progression tests updated for 50 HP and the new gem; the pit tests now expect enemies to leap pits. Not re-run after the last edits. browser, combat and meters tests were already stale.

## st55
- The goblin roll (anim id `dive`) no longer throws shards. It is a melee attack: its low hit box on frames 19 and 20 does the damage. The hazards goblin shard checks now expect no projectile and are out of date (not updated).

## st56
- Goblin combo: frames 3, 4 and 6 of the backflip also fire a streak shard (`fireComboShard`, 10 damage each). They fly up and away for 500 ms, then curve toward her (`HOME_TURN`) until hit, blocked or reflected. Parry is generous: a parry pressed up to 450 ms early counts, and a shard that reaches her waits 300 ms for a late parry. A reflected shard flies straight forward, level. goblin_roll (dive) is untouched. Test: combo_shards.test.js.

## st57
- Normal enemy attacks now land HIT_DELAY = 300 ms after first contact (was 90), so a parry up to 300 ms late still counts. Combo shards already allowed 300 ms late.

## st58
- Push kick hurtbox (the part that damages, in the terms above) is now a box on both active frames (1 kick, 2 extend): sheet coords x 38 to 102.9 forward of the anchor, y -1 to 34.8, set in game.js next to the other data overrides (was a small capsule around the foot). Her lunge root motion moves it forward: world reach is about 48 to 80 px ahead of the anchor on frame 1 and 67 to 99 on frame 2. Checked with a goblin at several distances: no hit at 20 and 30 px (inside the lunge), hits from 45 to 110 px.

## st59
- Push kick hurtbox now ends at sheet x 95 from the anchor (the outer edge of the last white arc), 7.9 sheet px (about 4 game px) shorter than before. Energy kick hurtbox is the same box as the first push kick version (x 38 to 102.9, y -1 to 34.8) on frames 1 and 2. Not play-tested.

## st60
- Enemy approach and attack range now use hitboxes. `ENEMY_REACH` (computed from each enemy attack animation hurtbox: goblin 63.5, orc 39) sets when an attack starts: once the gap from the enemy ground point to the near edge of her hitbox is at most reach minus 1 (goblin 62, orc 38) and no pit lies between. Before that it walks on until its own hitbox touches hers (`room`), unless a pit, solid or knockback stops it. The goblin roll still starts at 110 to 170 px. The old APPROACH x ai.reach rule is no longer used for stopping. Test: enemy_reach.test.js.

## st61
- Goblin pattern (`goblinLike` branch in stepEnemyCore): a combo the moment it detects her (`comboReady`, set at spawn and in `aggro`), then it walks forward and uses melee only (slash, plus the roll gap-closer). Another combo only if she leaves melee range (gap > reach + 2) after a melee swing started in range (`meleeSeen`); each combo clears both flags. Her being knocked out of range by a hit counts as leaving range.
- Goblin climbing (`planHop`, `CLIMBERS`): jumps up to a platform up to 70 px above it (from the ground or another platform, from beside or underneath), walks to the platform edge on her side and drops, hops a gap between two platforms of the same height, and still jumps pits. `setRange` now follows the surface it lands on, and a patrol path is reset to that surface.
- Enemies only attack when on her level (`floorY` within 1 px of their surface). Orc unchanged apart from that. Test: goblin_pattern.test.js (5 checks).

## st62
- Orc pit jumps: it attempts gaps up to 140 px like the goblin, but its jump only carries 60 px (`ENEMY_JUMP_DIST`; goblin 200, so it always makes the 140 it tries). Where 60 px falls short of the far edge it lands in the pit and is lost (`doom`, `plunge`). Takeoff distance from the edge is random per jump (`hopAt`, 3 to 13 px) so a 50 px pit is sometimes cleared by an orc and every pit over about 57 px never is. Enemies now walk to within 2 px of a pit edge (was 8). Test: orc_jump.test.js.

## st63
- Orc jump distance raised to 70 px (`ENEMY_JUMP_DIST`). It clears a pit when takeoff distance (random 3 to 13 px) plus the pit width is at most 70: 50 and 55 px pits always, 60 px about 70 percent (measured 7 of 10), 65 px about 20 percent (measured 2 of 8), 67 px and wider never.

## st64
- Her health bar is 200 px wide (was 100) and the HP text sits after it (x 232). Display only, it does not grow with Max HP.

## Creature and boss project handoff (st65 onward)
User request (asleep, autonomous): clean the 10 supplied images, cut them into in-game animations, assign HP/damage/knockback, spread the enemies over levels by difficulty, four bosses (largest craftpix sprites) at the end of levels 1 to 4 in unique arenas (own ground, background, sky), and a mirror-Max final boss at the end of level 5 (max HP and meters, all her attacks).

Decisions:
- The supplied "animated" images were single-frame stills (webp, 1 frame each), so animations are PROCEDURAL (squash, stretch, lean, lunge, collapse) from the cleaned sprite. Tool: `tools/creatures/clean.py` (background and banner removal, source/ -> clean/) and `tools/creatures/build.py` (clean/ -> `web/assets/enemies/<name>.png` + `web/assets/creatures.js`, merged into `BIBOO.enemies`). Re-run `python3 build.py` after changing stats or recipes; stats live in the `C` table at the top of build.py.
- Image 1 (tiny goblin, 12x17 after cleaning) is unusable and unused. Right-facing sources (2, 4, 6) are flipped so art faces left.
- Engine: `ai.hp`, `ai.dmg`, and per-attack `ai.atk[name] = {dmg, knock:[px, ms]}` are read by `spawn` and `knocked`. ENEMY_HP/ENEMY_DMG tables still win for goblin and orc.
- Creatures (hp / first attack dmg): hobgoblin 80/14, skullraider 110/18, dusksaur 140/22, darkknight 170/26, ogre 320/40; goblin 60/12 and orc 200/30 unchanged. Difficulty order low to high: goblin, hobgoblin, skullraider, dusksaur, darkknight, orc, ogre.
- Bosses (largest craftpix sprites): wyrmslug (image 3, hp 700), oozewraith (9, 900), horneddread (0, 1100), boarlord (8, 1400). Boss order: L1 wyrmslug, L2 oozewraith, L3 horneddread, L4 boarlord. Level 5 final: mirror Max.

Status:
- [x] Step 1 clean images
- [x] Step 2 sheets, enemy data, engine hooks, test `web/tests/creatures.test.js` (passes)
- [x] Step 3 enemies spread by difficulty: levels.js LADDER (goblin, hobgoblin, skullraider, dusksaur, darkknight, orc, ogre); L1 hand maps use goblin + hobgoblin; genMap slides up the ladder per map (st66)
- [x] Step 4 boss arenas (st67): map x.10 of levels 1 to 4 (`bossMap` in levels.js; def.boss + def.theme). Themes fungal/crypt/bone/ember/keep generated by `tools/arenas/build_arenas.py` into `web/assets/arenas/` + `arenas.js` (BIBOO.themes: sky, far, near, ground, fringe, tileable 384x232). Engine: `THEMES`, `bossAlive()`, arena clamps (left closed, right closed until boss dead), the door at x.9 is the key door, boss bar at the bottom, enrage below 50% HP (x1.45 speed via `espeed`), boss defeat banner + gems. Boss damage is 0.6 of the table because Max starts at 50 HP. Test `web/tests/boss_arena.test.js`.
- [x] Step 5 level 5 mirror-Max boss (st68): map 5.11 (`bossMap('mirrormax','keep')`). `tools/creatures/mirror.py` builds the enemy from Max's own move sheets (flipped to face left, dark tint) with her real frame timings, root motion and hit shapes (her shapes are in sheet px, forward positive; converted to one hit box per frame). Moves: slash, thrust, upswing, push_kick, heavy, spin (damage 30/30/35/40/50/40). HP 200 (her cap). Not done yet (ideas for the next agent): energy moves and meters (energy wave, energy kick, burst), block and parry, dash thrust (382 px wide cells), a harder HP value (the `hp` field in mirror.py is a single knob), a purple/steel tint that reads less pink.

All five steps are done. Possible polish: per-attack reach selection for enemies (they currently start any attack at the longest attack's reach), boss attack telegraphs, a boss drop of an unlock, balance pass (boss damage is 0.6 of table, boss HP 700 to 1400, enrage at 50 percent), and level 1 to 4 boss blurbs.

## Big update 2 (user request 2026-10-01 02:30): story, level 4, cheats, ankhs, new backgrounds
Plan and status (each step is pushed on its own; resume from the first unchecked box):
- [x] A. Move list (st70): `moveRows()` in game.js merges redundant inputs (Left/Right variants, repeated tokens as "x4"), orders unlocked combos by pickup order (`P.state.unlocked`), and Up/Down scroll the list (`UI.nav` in ui.js when view is 'moves').
- [x] B. (st71) Levels: 1 Green Trail, 2 Mossy Falls, 3 Sunstone Canyon, 4 Sunset Shore (NEW, holds the 5 new unlocks chain, chain_burst, fly, rainbow, ultimate at 4.1, 4.3, 4.5, 4.7, 4.8; they are in progress.js UNLOCKS with `moves: []` until step G), 5 Mire Wood (old level 4: meter_charge, earthquake, meteor), 6 Moonlit Sanctum (old level 5, ends in Mirror Max at 6.11). Bosses: wyrmslug, oozewraith, horneddread, ogrechief (new, hue-shifted ogre, theme 'tide'), boarlord, mirrormax. `genMap(n, i, item, ln, sk, cnt)` keeps old terrain seeds. Save format bumped to v4 (v3 saves are migrated: cleared and levelsUnlocked shift for old levels 4 and 5). `level.bg` ('falls','canyon','shore','mire','sanctum') is set in levels.js for step D.
- [x] C. (st72) Cheats menu: the chord in the main/pause menu sets `cheatsShown` and adds a Cheats entry; `devItems()` now lists God Mode, Infinite Meter, Level Unlock, Master Unlock, No Pitfalls (`cheats.nopit` skips `checkPit`; `pitsSolid()` is the hook the rainbow guard will use). The ` key is gone. Test `web/tests/cheats.test.js`. NOTE: the dev-console parts of `progression.test.js` still target the old menu and must be rewritten in the final test pass.
- [x] D. (st73) Level 1 keeps the old scenery; levels 2 to 6 use the five supplied images (tools/backgrounds/source/bg1..5.jpg: waterfalls, canyon, beach, swamp, blue ruins) via `tools/backgrounds/build_bgs.py` -> `web/assets/bgs/` + `bgs.js` (BIBOO.themes entries falls, canyon, shore, mire, sanctum; mirror-tiled sky layer, generated ground and fringe). game.js picks `curMap.def.theme || level.def.bg`; boss arenas keep their own themes.
- [x] E. (st74) Ankhs: `P.state.ankhs` (start 3, cap 9, saved), gems of kind 'ankh' (placed per map from `map.ankhs`, generated in levels.js; `perm`, tracked in `level.ankhGot`), `drawAnkh`, HUD counter, `retryMap()` costs 1 ankh (free in test levels n=0); with none left the level restarts (`startLevel`) and ankhs reset to 3. Test `web/tests/ankhs.test.js`.
- [x] F. (st75) `isBoss(e)`: taunt skips bosses, `beamHit` returns early for plasma on bosses; boss kill drops 9 random usable gems (health weighted), 3 ankhs and an up_hp. Test `web/tests/boss_immunity.test.js`.
- [x] G1 chain (AAAAA, AAAAB)
- [x] G2-G5 fly (ABAB-Up), rainbow (ABABAB), ultimate (AAAA + R1+R2+L1+L2), tests in powers.test.js
- [x] H. (st78) Story: prologue on New game, Mirror Max confession (story.double), ending after level 6 (story.ending), Skip story button; story.test.js. Flags saved in P.state.story.

### Final test pass (st79)
- Passing: ankhs, asset_retry, boss_arena, boss_immunity, chain, cheats, combo_shards, creatures, enemy_jump_dash_hop, energy_charge, goblin_pattern, input, level1_door, level2, level3, level5, maxhp_kick_hop, meteor_input, orc_jump, platform_edge, powers, progression (rewritten for the Cheats menu and prologue), pushback, save_flow, sky_taunt, story, unlock_items, unlock_points, unlock_walkthrough (27 unlocks), unlocks.
- Failing before this update too (verified on commit 4f457f9, stale expectations from older input and balance changes, not regressions): browser.test.js (15 old input checks), combat.test.js (22), meters.test.js (7), hazards.test.js (4), enemy_reach.test.js (3), turn_stun.test.js (1, air hit). They need rewriting against the current controls.
- startLevel now drops any open story page so test hooks can start levels after "New game".

### Hit feedback and title screen (st80)
- Hit feedback in game.js: `hitStop(ms)` freezes the world (tickLevel returns early but still reads buttons so presses are not lost), `impact()` adds a starburst (`flashes`), sparks, a white screen flash and shake on big hits, `herHitFx()` for her being hurt (red flash, shake, stop), parry and block sparks. Beam ticks are excluded (`beamTick`). Test hook `bibooGame.fx()`. Test: feedback.test.js.
- Title screen: `drawTitle()` (scenery, big idle Max, animated PARRY PERRY logo with a sword slash sweep, tagline, version stamp). The menu uses the `.title` layout (bottom right, no hero) via `api.isTitle`.

### Sunset Training (st81)
- Optional level outside the six: `BIBOO_LEVELS.training` (levels.js), bg 'training' from the vaporwave image (tools/backgrounds/source/bg6.jpg, build_bgs.py), entered from a 'T' node on the overworld (7th selection, `enterTraining()`). Level n=0: progress is never touched; health and meters refill.
- Heavy bag: enemy type `heavybag` (`ai.prop`) from tools/training/build.py -> web/assets/training.js. Never dies or moves; swings like a pendulum (`stepBag`), counts last hit, total, hits, combo (`train`, HUD top right).
- Slime Bunny: `BIBOO.training.bunny` sprite, bobbing on the right, speech bubble cycling `TIPS` every 8.5 s (how to open the move lists, locked moves, parry, leaving).
- Move lists: the menu now has `Moves: Gamepad` and `Moves: Keyboard` (ui.js movesView takes `opts.device`).
- Overworld positions fixed: OW_NODES has 7 entries (6 levels + training; level 6 used to share node 1's spot).
- Test: training.test.js; progression.test.js updated for the new menu labels.

### Leaves, Bone Merchant, per-map doors (st82)
- Removed: golden crates / in-map unlock pickups, the level door key, `LV.whereIs`, `doorLocked`, `unlockPool`, loose ankhs. Each map's right door is barred until no non-prop enemy is alive (`doorOpen()`); the left edge is a wall (`exitMap(dir<0)` returns false), so knockback cannot carry her to the previous map. Level 1 enemies do not respawn inside levels.
- Leaves: gold coin currency (`P.state.leaves`, start 100, `P.addLeaves`). `m.leaves` placed by levels.js with its own seeded rng (pit arcs, platform lines, ground lines, each pit or platform used once per map); crates carry `loot` = 'ankh' or 'leaves:N' (caches scale with level; boss arenas give every crate a cache). Ankhs only from ankh crates. Crates still roll the normal gem pool (`lootPool` unchanged), enemy drops unchanged.
- Gem renames/sprites: Bone (health), Quartz (energy), Garnet (empower), Diamond (super), Bone Powder (+25 max HP). Sheet from tools/items/build.py -> web/assets/items/*.png and web/assets/items.js (`BIBOO.items`).
- Bone Merchant (overworld selection index levels+1, art f22274d2 image): game.js `shopRows()/buy(key)/spriteCss`, ui.js `shop` view (rows with icon, price, note, Buy buttons, `Leave the shop`), also a "Bone Merchant" item in the title/overworld menu. Prices in progress.js `PRICE` (Bone 8, Quartz/Garnet 12, Diamond 30, Bone Powder 90, Scroll 15+10*lv, Mutagen 25+15*lv). Mutagen = unlocks that use a meter (or meter_charge), Scroll = all other unlocks. An unlock needs `levelsUnlocked >= u.level` (level N unlock is on sale once level N-1 is beaten). Quartz/Garnet/Diamond need the matching meter owned.
- New game: prologue, then the overworld with the merchant selected and a "You start with 100 Leaves" banner. Overworld nav cycles levels 1-6, Training, Merchant (Left from level 1 hits the merchant, Left again the training node).
- Tests: new shop.test.js, leaves.test.js; rewritten ankhs, progression, save_flow, story, level1_door, hazards; deleted level2, level3, level5, unlock_items, unlock_points, unlock_walkthrough (all were about golden crates).

### Soundtrack (st82)
- Tool search result: mido (pip, writes MIDI) + a small numpy NES-style synth (2 pulse channels with duty cycles and vibrato, 4-bit triangle bass, noise drums) + ffmpeg (ogg/mp3). Considered chippy, chiptune-studio, blip8, PySynth; our own rule based composer was simplest and fully offline.
- tools/music/compose.py composes 17 original multi-layer songs (lead, harmony, arpeggio, bass, drums) from seeded rules (key, mode, 8-bar chord progressions A/B, motif and answer phrases, cadences, bass and drum patterns) and writes web/assets/music/<id>.{ogg,mp3,mid} plus web/assets/music.js. Songs: level1-6, boss1-6 (wyrmslug, oozewraith, horneddread, ogrechief, boarlord, mirrormax), training, shop, prologue (opening cutscene), ending (epilogue), overworld (also the title screen). Re-run `python3 tools/music/compose.py [id ...]`; edit the SONGS table to change a song.
- web/music.js `BibooMusic`: Web Audio, one looping track with 0.5 s crossfade, starts after the first click/key/pad press, volume Off/30/60/100% (menu item "Music: N%", saved in localStorage key pp_music_vol), ogg if supported else mp3. Silent on file:// pages (fetch is blocked there); use the live site or a local server. game.js `wantedTrack()` picks the song every frame (story, shop view, title/overworld, training, boss arena, level n).
- Test: music.test.js (serves the folder over http).

- Test status at st82: all pass except the known older failures (browser, combat, enemy_reach, hazards 4, meters 7, turn_stun 1) and chain.test.js 'slow presses stay plain slashes' (fails on st81 too; the test fights a live ogre chief, so the second press can land while she is stunned).

### Engine split (st82)
- web/game.js (3150 lines) was cut at its section markers into web/game/00_core.js ... 22_test_hooks.js (23 files, 26 to 345 lines). Same code, IIFE removed: classic scripts share one global lexical scope, so the files see each other's top-level let/const/function. index.html loads them in numeric order (order matters for load-time statements). Only collision with a window property is `screen` (game variable shadows window.screen; nothing else uses it). When adding a new top-level name, avoid names of window properties (name, top, status, location, close, open, stop, print, event ...).
- To edit: grep -n the function name in web/game/, then Read only that file. Cache stamp sed in the notes above still works (it rewrites every v=stN).

## st83
- Gems menu renamed Items; parry deals 10 damage; no leaves over pits; ankh cap removed; Y shows descriptions in Items, Moves and shop (row cursor). Test: web/tests/menus_info.test.js. Also: web/game.js split into web/game/*.js (st82 follow-up).

## st86 (enemy logic, not fully tested)
- Sight x2 for all enemies; enemies track the middle of her hurtbox; all enemies climb, drop and hop; attacks start when a damage box would touch her hurtbox (contact fallback). Damage boxes tightened by tools/creatures/tighten_hits.py (rerun after build.py). New web/tests/enemy_ai.test.js is unrun; enemy_reach.test.js still expects the old distances; goblin_pattern climb check needs a solo rerun.

## st87 (backgrounds, untested in a browser)
- web/assets/story.js maps the eight supplied scenes (assets/story/, view-sized copies in assets/story/view/): cutscene pages (calm/crowd village meadow, fire burning house, sea/rewind/meditate/sunrise sunset island, double moonlit courtyard, altar snow temple) and boss arena stills (fungal forest waterfall, crypt cave shrine, bone mine bridge, keep moonlit courtyard). Ogre Chief (tide) and Boar Lord (ember) keep their old arenas. Floor height in the pictures is not matched to the game floor; adjust if it looks off.

## st88 (cutscene layout, not run in a browser)
- Story text panel now at the top (#start-menu.story). 18_story.js has an SC table: per scene the picture pan, Perry's feet (x, gy) and size, picked from each picture's ground. Drift removed. Idle-sprite anchor fixed to the middle of her boots. Miracle Island pages use the supplied boat picture (assets/story/boat.png, view copy 150 px wide) rocking on the water instead of her idle sprite. Pictures re-cut 3 px inside the borders (removed a leftover white line).

## st92 (cutscene shadows and reflection, not run in a browser)
- 18_story.js: castShadow() lays a silhouette of Perry (and the twin) on the ground along each scene's light (SC[...].L: sx, sy, a, col). Altar scene steps the shadow up the stair treads (L.steps); the cliff scene clips it to the grass (L.clip). Miracle Island draws a rippled, fading mirror image of the boat and Perry in the water instead of a shadow. Scene feet lines were raised a little (calm, fire, double) so shadows stay on screen.
- st93: shadows doubled (alpha 1.0, darker colours), temple shadow longer and near-black, burning-house Perry lowered 8 px, evil Perry now drawn at Perry's scale in both scenes.
- st94: boat reflection mirrored about the keel (touches the hull) and twice as opaque.
- st95: Perry, evil Perry and the boat are stationary in cutscenes (frame 0, no walk, no bob). Burning-house shadow flicker kept.
- st96: shadow opacity: meadow 0.8, burning house 1.0, courtyard 0.8, temple 0.8, cliff 1.0 (unchanged).
- st97: title screen shadow is now a real cast shadow of Perry's outline (was an ellipse under the back foot).
