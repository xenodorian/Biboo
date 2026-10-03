# MAME 2003: install the live web game

This is the work list for putting **every feature of the current web game** into the MAME port. The web game is the source. The Gemini handoff, the Dreamcast port, and the uncommitted draft in this tree are not.

Read [README.md](README.md) and the MAME section of [Current_Work.md](../../Current_Work.md) first. Claim one step there before starting it. One step, then commit and push to `main`. Do not open a branch.

## Rules that do not change

- The ROM is 68000 C, integers only. No `float`, no 68881, no libc. Roots, gravity, parallax and timers are whole pixels or fixed point.
- The CPU does not paint pixels. It writes blitter commands. The driver paints a 640×480 RGB565 buffer at vblank. The CPU waits with `STOP` for the level-6 interrupt.
- One web map is 384×216. Draw it **1:1**. The rest of the 640×480 frame is the HUD. Do not use the Dreamcast 5/6 shrink.
- Eight buttons are real inputs: A, B, X, Y, L1, R1, L2, R2, plus Start. Do not fold L2 and R2 into chords the way the Dreamcast pad did.
- Art and tables are baked on the PC from a fresh dump of `web/`. The 68000 only reads them.
- Music, if it is a synth, runs in the **driver**, not on the 68000.
- Saves are MAME NVRAM. A web `localStorage` file does not load here.
- This port is not part of `python -m swingkit` or the GitHub Pages build. Do not edit `web/` to make the port easier. If `web/game/00_core.js` is a one-line placeholder, restore it from git (`20a1437`) before dumping. Do not push that restore unless it was already broken on `main`.
- Do not say this runs on a phone or an R36S until that machine has booted the zip. A desktop core is not those machines.
- Do not run the web test suite unless the owner asks. A host compile and a host frame are enough to see that a step links.
- In notes, a **hitbox** is where she can be hurt and a **hurtbox** is what deals damage. The web code uses those words backwards (`hurt` is the body, `hits` is the attack). Do not rename the web data.

## What is already true

Pushed on `main` (MAME-1, MAME-2, MAME-3). Not booted in MAME.

- [x] Custom mame2003-plus driver, 640×480, eight-button pad, native blitter.
- [x] `PPK1` sprites, colour key `0xF81F`, little-endian runs.
- [x] Basic kit only: idle, walk, duck, block, parry, slash, thrust, upswing, dash, jump, spin. Green Trail. Shoulders do nothing.

There is a **pushed work-in-progress** (`game/play.inc`, `game/data.h`, `tools/bake_full.py`, plus a rebuilt `roms/parryperry.zip`). It is not a finished step. It sketches the reader, the move list, enemies, the six levels, and a shop, but it is behind the live web game: one gem counter instead of a bag, hardcoded prices, beams and crates drawn as rectangles, save-on-every-map instead of a manual save, and no title, overworld, story, training, music, items menu, or cheats. It has not been booted in MAME. Start at MAME-4 and re-bake from `web/` before trusting `data.h`.

## How to work a step

1. `git pull --rebase` on `main`.
2. Write the step id on the MAME section of `Current_Work.md` before editing code.
3. Re-read the web files named in the step. If they disagree with this list, the web files win. Update this list in the same commit.
4. Bake or port only that step. Leave the next step's systems alone.
5. `make -C ports/mame2003/game` must link. If the picture should change, `make -C ports/mame2003/game preview` and look at `boot.png`.
6. Note what was checked and what was not (MAME itself, a phone, an R36S). Commit. Push.

Controls, for every step that reads the pad. This is the live game (`progress.js`, `00_core.js`), not the stale line in `ui.js` that says Y attacks.

| Pad | Live game |
|---|---|
| D-pad | Move. Up jumps. Up again in the air is the double jump, once unlocked. Down ducks. Down twice on a plank drops through. |
| A | Attack and accept. Hold, then release, for the heavy chop once unlocked. |
| B | Tap parries. Hold blocks. |
| X | Dash. |
| Y | Spin. In a menu, Y shows what the row does. |
| L1 L2 R1 R2 | Off until that button is bought. See the unlock table below. |
| Start | Pause, which opens the menu. |

---

## MAME-4 — Bake the live game, and stop

Do this before any more gameplay. The draft header is already stale.

Web files: `web/progress.js`, `web/levels.js`, `web/assets/data.js`, `web/game/00_core.js` (the rewrites at the top), `ports/dreamcast/tools/dump_game_data.js`.

- [x] Dump `web/` **after** `00_core.js` has applied its binding rewrites. Do not bake the raw `input_map` if the core then changes it.
- [x] Sprites at view scale 1 and character scale 1/2, same as the web canvas. Whole-pixel roots. No floats in `data.h`.
- [x] All move frames, including charge, heavy, chains, beams, kicks, earthquake, meteor, sky dash, jump crash, taunt, recover.
- [x] All enemy frames, including the club ogre and Mirror Perry. Training heavy bag is a prop (`prop` on `EDef`, HP stored capped at 32767).
- [x] Scenes: trail, falls, canyon, shore, mire, sanctum, tide, ember, and the still arenas fungal, crypt, bone, keep, plus training. The multiply grade is baked into the pixels. Fringe layers included.
- [x] Pickup and prop art that exists as pictures: leaf frames, Bone, Quartz, Garnet, Diamond, Bone Powder, merchant, Slime Bunny, heavy bag, beam sheets, impact pictures, story views, the boat. Crates, bombs, the door, and the ankh are drawn shapes in the web game, not sprites, so they are not in the pack.
- [x] Story backgrounds from `web/assets/story/view/`, plus the boat, at 384×216 (`STORY_SPR`).
- [x] Tables: 6 levels plus the training map (`MAP_TRAINING`). Crates do not hold unlocks.
- [x] Unlock table from `progress.js`. 27 unlocks. Scroll and mutagen prices use the live formula.
- [x] Binding table is the post-rewrite list. Jump bindings are dropped (the web reader does that too). R2 press is Energy Wave. Beams are only A+L2, A+R2, A+L1, A+R1. The Left-Right-A cloud sequences are deleted by `00_core.js`, so they are not baked.
- [ ] `art.bin` stays in the ROM region the CPU cannot see. The zip was **not** rebuilt: no 68000 compiler in this sandbox. Rebuild with `make` before loading it.

Done when: the header names every web move, enemy, map, and unlock, and a host frame still shows the Green Trail. Gameplay may still be the basic kit.

## MAME-5 — Progress, the way the web saves it

Web files: `web/progress.js`, the save block in `web/game/21_cheats_loop.js`.

A new game starts with the d-pad and A, B, X, Y only. Everything else is locked. Leaves 100. HP 50. Ankhs 3. No meters on screen.

- [x] Record: unlock ids, `levelsUnlocked`, `cleared`, gem bag of four kinds, meter values and maxima, story flags, leaves, ankhs. Magic `0xB1B4`, version 4.
- [x] Nothing writes NVRAM by itself. Y while paused writes one snapshot. Boot loads it. A bad or old record starts a new game and zeroes NVRAM. The "press again" confirm is the MAME-11 menu. Closing the core without saving loses the run.
- [x] Version the record. Reject a bad checksum. The old 14-word autosave is rejected.
- [x] `recompute` is `has` / `hasMove` / `buttonOn` / `meterOn`. Shoulders stay dead until that unlock is owned. A meter is drawn only once an unlock uses it.
- [x] Base moves stay open with nothing owned: idle, walk, duck, block, parry, jump, dash, slash, spin.

Done when: a fresh boot has no shoulders and no meters, a manual save survives a reboot of the core, and New game erases it.

## MAME-6 — The input reader

Web files: `web/input.js`, `web/game/02_input.js`, the binding rewrites at the top of `web/game/00_core.js`.

Port the reader. Do not re-invent timings. Chord window 60 ms, sequence 700 ms, tap 150 ms, frame 16 ms.

- [ ] Press, tap, hold, chord, sequence, air, and release-into (hold A, then the chop; hold L2, then the burst).
- [ ] A locked move or a locked shoulder does nothing, and the plain move underneath still works (Down+A is a slash until the upswing is bought).
- [ ] Every live binding, checked against the baked table from MAME-4:

| Unlock | How |
|---|---|
| (always) | A slash, B tap parry, B hold block, X dash, Y spin, Up jump, Down duck, Left/Right walk |
| Lunging Thrust | Hold Left or Right, press A |
| Ducking Upswing | Hold Down, press A |
| Heavy Horizontal | Hold B, tap A |
| Dash Thrust | X+A |
| Energy Dash Thrust | Double-tap forward, then hold X+A and release. Also the Left-Left and Right-Right forms the core adds |
| Taunt | X+Y |
| Double Jump | Up again in the air |
| Sky Dash | Down, then Up |
| Jumping Crash | A in the air, costs 30 energy |
| Heavy Overhead Chop | Hold A to charge, release to chop |
| Earthquake | Down four times, then A, spends a full super meter |
| Meteor Shower | B five times, spends a full super meter |
| Push Kick | L1 |
| Meter Charge | Hold L1+R1, fills every meter she owns |
| Recover | Hold R1, spends empower |
| Empowerment Beam | A+R1 |
| Energy Kick | Hold B+L1, release |
| Energy Burst | Hold L2, release |
| Energy Wave | R2 |
| Cloud Beam | A+L2, or Left then Right then A |
| Laser Beam | A+L1 |
| Fire Beam | A+R2 |
| Attack Chain | Mash A: slash, chain 2, chain 3, chain 4, then the heavy chop |
| Burst Chain | A A A A, then B |
| Flight | A B A B, then Up. Five seconds |
| Rainbow Guard | A B A B A B. Five seconds, walks over pits |
| Ultimate Chain | A A A A, then L1+L2+R1+R2 together |

- [ ] Menu chords do not fire moves: while a menu is open, Up/Down move the row, A activates, B goes back, Y toggles the description.
- [ ] Start opens and closes the menu. The L1+L2+R1+R2 chord is reserved for MAME-14 and must not also be read as Ultimate while that menu chord is the one being pressed from the pause menu. Follow the web: Ultimate is the sequence, the cheat chord is the same four shoulders **inside the pause menu**.

Done when: a host pad script can fire each row above once that unlock is forced on, and a fresh game can fire only the always-on row.

## MAME-7 — Perry's body

Web files: `web/game/03_state.js`, `04_chain.js`, the dash hop in `13_enemy_attacks.js`.

- [ ] Hold, action, and land. Entry frames. Loop commits only on a wrap. Root motion from the baked table, including the walk handoff.
- [ ] Jump, air steering, landing on a platform, walking off an edge, double jump, drop-through on a second Down.
- [ ] Dash, dash thrust, and push kick hop 5 px and come back down over the move.
- [ ] Charge meter and the heavy chop. Energy holds that fire on release. Chain, chain burst, jump crash.
- [ ] Flight and rainbow timers. Ultimate plays the chain, a taunt, then the four beams, in the web order.
- [ ] Recover heals and spends 1 empower per tick. Meter charge fills owned meters only.
- [ ] Costs, paid once when the move starts: jump crash 30 energy, earthquake and meteor a full super meter. If she cannot pay, the move does not start and the HUD says which meter is short.
- [ ] Hit stun, slide on block, knockback, 400 ms invulnerability after a clean hit, red tint on that hit. Rainbow and god mode skip damage.

Done when: with unlocks forced on, each move in the MAME-6 table changes her sprite and her position the way that web function does. No floats in the disassembly of `main.o`.

## MAME-8 — Hitting things

Web files: `web/game/05_health.js`, `12_hits.js`, `08_beams.js`.

- [ ] Attack shapes are the baked boxes and circles, scaled the way the web scales them. A move hits a given enemy once per swing, unless the web gives it a re-hit gap.
- [ ] Both-side moves, knock tables, the wave blast, and the chop blast.
- [ ] Beams use the baked sheets, scroll, and tick a meter every 100 ms: cloud 1, fire 3, laser 5, plasma 5.
- [ ] A parry of a melee hit deals 10. An enemy swing lands 300 ms after it first overlaps her, so a parry up to 300 ms late still counts. A parry reflects the goblin's shards.
- [ ] Bosses ignore taunt and the plasma beam. Under half HP a boss moves at 1.45×. On death a boss drops 9 gems, 3 ankhs, and one Bone Powder, and the arena opens.
- [ ] Names: Wyrm Slug (level 1), Ooze Wraith (2), Horned Dread (3), Boar Lord (4), Mirror Perry (the keep). If the web list has an ogre chief as well, include that boss too. The web file wins if this sentence is behind it.

Done when: a forced slash damages one enemy once, a late parry still lands, and a beam spends its meter.

## MAME-9 — Enemies

Web files: `web/game/11_enemies.js`, `13_enemy_attacks.js`.

- [ ] Every baked type, including the club ogre and Mirror Perry. A prop (the heavy bag) does not walk or attack.
- [ ] Patrol, sight at 2× the baked distance, chase, and an attack as soon as one damage box would touch her body. They aim at the middle of that box.
- [ ] Climb, drop off platforms, hop pits. Jump distance and landing offset stay the baked per-type numbers (goblin 200 px, orc 70 px). They do not walk into pits on their own. A knock into a pit kills them.
- [ ] Goblin combo, including the three shards. Dive, swing-anyway, rest, parried, knocked.
- [ ] Death fades out. It does not blink off.
- [ ] Damage boxes stay the tightened leading slice from `tools/creatures/tighten_hits.py`. Re-bake if that tool is re-run; do not hand-widen them.

Done when: on map 1.1 a goblin walks its path, chases, swings, and can be parried. A pit knock removes it.

## MAME-10 — Maps, pits, crates, bombs, leaves, gems

Web files: `web/game/09_maps.js`, `10_hazards.js`, `web/levels.js`.

- [ ] All six levels and every map the baker emitted. The right door is shut until every non-prop enemy is dead, then the right edge loads the next map. The last map of a level does not dump her straight into the shop; it goes to level-complete (MAME-11).
- [ ] Platforms, including dropping through a plank. Pits: both feet over the gap, she sinks, then the map retries. Ankhs are spent by that retry the way `retryMap` spends them. With none left, the level starts over with 3 ankhs.
- [ ] Crates break from her attacks, from landing on them, from reflected shards, and from blasts. Loot matches the map data. A crate never grants an unlock.
- [ ] Bombs arm on touch or on a hit, hurt her and enemies within 50 px for 50, break crates, and set off other bombs in range 180 ms later.
- [ ] Leaves add to the purse and are never placed over a pit. Gems go into the bag. A full bag leaves the gem on the ground. Gems despawn after 20 s. Health gems do **not** heal on touch.
- [ ] Enemy drops: health gem 35%, Bone Powder 12%, and only for a meter she has unlocked. No gem for a meter at its cap. Powder on the ground raises max HP by 25, cap 200, and it is the same powder the shop sells.
- [ ] Boss rooms stay sealed on the left and the right until the boss is dead.

Done when: map 1.1 can be cleared to 1.2, a pit costs an ankh, and a crate's leaves land in the purse.

## MAME-11 — Screens and menus

Web files: `web/game/20_title.js`, `19_overworld.js`, `17_menus.js`, `18_story.js`, `06_training.js`, `21_cheats_loop.js`, `web/ui.js`. The menu is text on the 640×480 frame, not a DOM overlay. Same rows, same order.

- [ ] **Title.** Perry idle, the name "Perry Riposte" (the opening story uses Peregrine "Perry" Riposte; every other line says Perry). Continue if a save exists, otherwise New game. New game with a save asks a second time, then wipes, plays the prologue, and lands on the overworld with the banner "You start with 100 Leaves".
- [ ] **Prologue, double, ending.** Pages and picture ids from `STORY` in `18_story.js`. A advances, the picture is the baked story view, Perry and Mirror Perry stand on it. Prologue before level 1. Mirror Perry's confession (`double`) the first time she falls, 2.6 s after, and only once (`story.double`). Ending after the last level, only once.
- [ ] **Overworld.** Six level nodes, then Sunset Training, then the Bone Merchant. A level opens when the one before it is cleared. A locked node refuses. Left and Right change the selection. A enters. The blurb and the move count `owned/27` are on screen.
- [ ] **Pause menu**, Start, in this order: Resume, Moves: Gamepad, Moves: Keyboard, Music (label only until MAME-13), Items, Bone Merchant (title and overworld only), Back to the overworld (during a level), Save game, New game (second press erases). Y on a row shows the description. B backs out of a sub-menu. Fullscreen is a browser button; skip it.
- [ ] **Moves menus.** Base controls first, then owned unlocks. Gamepad wording and keyboard wording are the two lists from `16_hud.js` / `ui.js`. Locked moves are counted, not listed as usable.
- [ ] **Items.** Bone heals only inside a level and only while hurt (25% of max HP, matching `gemHeal`). Quartz, Garnet, and Diamond refill 25 of that meter, only if the meter exists and is not full.
- [ ] **Bone Merchant.** Supplies: Bone, Quartz, Garnet, Diamond, Bone Powder, at the MAME-4 prices, hidden until that meter exists, refused when the bag or the HP cap is full. Then Mutagens, then Warrior Scrolls. An unlock whose level is above `levelsUnlocked` is not shown. Y describes the row. B leaves.
- [ ] **Sunset Training.** Optional shore room. Heavy bag swings and never dies. Slime Bunny cycles the eight tips. Hits, last hit, total, and combo display. HP and owned meters refill on entry. Beams can score. Leaving does not mark a level cleared.
- [ ] **Game Over.** Retry spends 1 ankh and replays the map, or restarts the level when none remain. **Level complete** returns to the overworld, marks `cleared`, and opens the next level. It does not autosave.

Done when: New game shows the prologue, the overworld can enter level 1 and Training, and the shop can sell Lunging Thrust for its real price.

## MAME-12 — What the web draws on top of the sprites

Web files: `web/game/15_draw_scenery.js`, `07_feedback.js`, `14_draw_player.js`, `16_hud.js`.

The blitter already has tint, alpha, clip, dim, and fill. Use those. Do not add a full-frame CPU fade.

- [ ] Contact blob under Perry, on the ground, on a platform, and in the air. Cast shadow on flat ground from the baked light. Shore, falls, and the fungal arena keep a short reflection. No white rim.
- [ ] Crate, bomb, gem, leaf, ankh, and door sprites from MAME-4, with the small glow stamps.
- [ ] Damage numbers, hit-stop, screen flash, shake, starburst, enemy tint, boss bar and name, "BOSS DEFEATED", the level banner, the "not enough meter" line.
- [ ] HUD: HP, leaves, ankhs, the three meters only when owned, map id, kills, and the move name. God, infinite, and no-pit tags appear only when those cheats are on.
- [ ] Training bunny bob, bag swing, and the tip line.

Done when: a host frame of map 1.1 shows the door, a crate, and her contact blob, not coloured stand-ins.

## MAME-13 — Music, in the driver

Web files: `web/music.js`, `web/game/19_overworld.js` `wantedTrack`, `tools/music/compose.py`.

There are no sound effects in the web game. Do not invent any.

- [ ] Bake the 17 songs as a note list the driver can play, the same approach as the Dreamcast `audio_tick` (one frame of notes, not a 68000 synth).
- [ ] Tracks: prologue and any non-ending story use `prologue`; ending uses `ending`; shop uses `shop`; title and overworld use `overworld`; training uses `training`; a level uses `level1`..`level6`; a boss map uses `boss1`..`boss6`; Game Over is silent.
- [ ] Loop, crossfade about half a second, volume Off / 30 / 60 / 100. The pause menu's Music row cycles it. The chosen step is stored with the NVRAM record only if the web stores it (the web stores volume separately from the manual save; store it in NVRAM on change so the core remembers).

Done when: the driver plays `overworld` on the title. Not claimed until someone has heard the core.

## MAME-14 — Cheats

Web file: `web/game/21_cheats_loop.js`, `07_feedback.js`.

- [ ] In the pause menu, L1+R1+L2+R2 together adds a Cheats row. It is not on the list before that.
- [ ] Rows: God Mode, Infinite Meter, Level Unlock, Master Unlock, No Pitfalls, Close. Each does what the web row does, including Master Unlock buying nothing: it grants every unlock and opens every level.
- [ ] The chord does not also start Ultimate.

Done when: the row is absent on a fresh pause, present after the chord, and God Mode stops a hit.

## MAME-15 — Boot the core, and stop claiming machines you have not booted

- [ ] `python3 ports/mame2003/tools/install_driver.py` into a current [mame2003-plus](https://github.com/libretro/mame2003-plus-libretro), then `make platform=unix`.
- [ ] Load `roms/parryperry.zip`. The game name is Parry Perry. The zip's CRC matches `driver/rom_load.inc`.
- [ ] Desktop: title, New game, prologue, overworld, one map, one bought move, Save, quit, Continue.
- [ ] Write what was not booted. Android (`platform=android-armv7`) and an R36S-class build (`platform=classic_armv8_a35`) stay unchecked until someone loads the zip there. There is no arm64 Android target in that makefile.

Done when: the desktop core has done the path in the third box, and `Current_Work.md` says so in those words.

---

## Feature ledger

Every line of the live game is one of these. Do not call the port finished while any line is open.

| Live feature | Web home | Step |
|---|---|---|
| 640×480, 1:1 map, eight real buttons, blitter | this port | done (MAME-1..3) |
| Basic kit on the Green Trail | `03_state.js` | done, replaced by MAME-7 |
| Fresh dump of moves, enemies, maps, scenes, pickups, beams, story art | `web/`, `00_core.js` | MAME-4 |
| Unlocks, gem bag, meter caps, manual save, New game wipe | `progress.js` | MAME-5 |
| Full binding table, shoulders gated by unlocks | `input.js`, `02_input.js`, `00_core.js` | MAME-6 |
| Jump, drop-through, charge, chains, flight, rainbow, ultimate, costs | `03_state.js`, `04_chain.js` | MAME-7 |
| Hits, beams, parry window, boss rules and drops | `12_hits.js`, `08_beams.js`, `05_health.js` | MAME-8 |
| Enemy AI, shards, pit hops, fade | `11_enemies.js`, `13_enemy_attacks.js` | MAME-9 |
| Six levels, doors, pits, crates, bombs, leaves, gem drops | `09_maps.js`, `10_hazards.js`, `levels.js` | MAME-10 |
| Title, overworld, story, training, pause, items, shop, game over | `20_title.js`, `19_overworld.js`, `18_story.js`, `06_training.js`, `ui.js` | MAME-11 |
| Shadows, glows, damage numbers, hit-stop, boss bar | `15_draw_scenery.js`, `07_feedback.js` | MAME-12 |
| 17 songs, crossfade, volume | `music.js` | MAME-13 |
| Cheat menu | `21_cheats_loop.js` | MAME-14 |
| Desktop core boot | mame2003-plus | MAME-15 |

Out of scope, on purpose: loading a web save, keyboard-only play inside MAME (the Moves: Keyboard page is a description, the machine has a pad), browser fullscreen, and the web test hooks in `22_test_hooks.js`.
