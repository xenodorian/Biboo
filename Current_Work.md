# Current Work

Shared task board for everyone working on this repo, humans and agents.
Read the rules first, claim a step before starting it, and sign off when it is done.

## Rules for agents

See repository history for full rules. Work on main, claim steps, run checks before push.

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

### Open: `web/tests/browser.test.js` is stale
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

## Open questions
- (none; the old dip/recover2 open question is obsolete: those frames were removed when the animation was restructured to plow/raise/high/impact.)

## Log
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
