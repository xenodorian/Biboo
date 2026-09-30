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

## Open questions
- (none; the old dip/recover2 open question is obsolete: those frames were removed when the animation was restructured to plow/raise/high/impact.)

## Log
- 2026-09-30: Step 39 done: meters on screen, gem pickups and drops, moves gated by meter; game.js consolidated into one plain file (Claude). Old browser test noted as stale.
- 2026-09-29: Step 28 done (deeper waist bend on the heavy chop; hand spacing and full-extension arms already at the reach limit from steps 25-27). Kinetic upgrade workflow complete; all numbered steps 0-38 are DONE. (Grok)
- 2026-09-29: Step 38 done (HP, damage, bars, red and green numbers). Steps 35 to 38 complete. (Claude)
- 2026-09-29: Step 37 done (four beams). (Claude)
- 2026-09-29: Step 36 done (spin on Left+A). (Claude)
- 2026-09-29: Step 35 done (facing flip). (Claude)
- Prior log entries: see git history for steps 0-34.
