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
**Cache stamp:** after any change to the game or its assets, bump `window.BIBOO_VER` and every `?v=` in `web/index.html` (now st97): `sed -i "s/BIBOO_VER = 'stN'/BIBOO_VER = 'stN+1'/; s/v=stN/v=stN+1/g" web/index.html`.

**Git rules (project owner):** work only on main, never create branches, `git pull --rebase` then push to main after every successful step, and end commit messages with the Co-Authored-By and Claude-Session lines.

*This file was condensed on 2026-10-01 (st97). The full step by step log, including every old stage, request and test count, is in git history: `git show a0a3b03:Current_Work.md`.*

## Notes for Grok (read these first)

1. **`web/game/00_core.js` keeps getting overwritten with a one-line placeholder** (`PLACEHOLDER_AGAIN is not defined` is the symptom; the game then fails to load). It has been restored four times (commits 0233308, 30fa4e9, 342ea7a, 20a1437). The good file is about 25,987 bytes. Before every push run `wc -c web/game/00_core.js`; if it is tiny, restore it with `git show 20a1437:web/game/00_core.js > web/game/00_core.js`. Always `git pull --rebase` before pushing so you do not push over someone else's work.
2. **All of `web/game/` is one shared global scope** (classic `<script>` files, load order set in `web/index.html`, no modules). A syntax error in any file takes the whole game down. Check edits with `node -e "new Function(require('fs').readFileSync('FILE','utf8'))"` before pushing. A top-level `let screen` shadows `window.screen`.
3. **Do not run tests unless the user asks.** Mock-ups in Python and the syntax check above are fine. The user did ask for one visual check on 2026-10-01 (screenshots of the cutscenes through a local http server with Playwright), so it is allowed when requested.
4. **Terms:** hitbox and hurtbox in the code are the reverse of the owner's words (see the top of this file). Enemy frame data: `hurt` is the body box, `hit` is the damage box.
5. **Known stale or unrun tests:** `enemy_ai.test.js` (new, never run), `enemy_reach.test.js` (expects the old attack distances), `goblin_pattern.test.js` (the climb check failed once in a slow run, rerun alone), plus the older stale suites `browser`, `combat`, `meters`, `hazards` (shard checks), `turn_stun` (1) and `chain.test.js` ("slow presses stay plain slashes").
6. **Docs problems found in review (not fixed yet):** the four beam previews `docs/moves/beam_cloud|fire|laser|plasma.gif` are the same file (same hash, 146,164 bytes); the README move table (lines 105 to 107) still lists Y as jump and A as slash, while lines 153 and 154 are correct (Up jumps, A attacks, Y spins). The README should be fixed to match the later text.
7. **Cutscene art has been checked in a browser** (st95 to st97, screenshots of every story page and the title). Enemy logic (st86), arena pictures (st87) and the in-level boss arenas have not been looked at in a real playthrough.
8. The twin in cutscenes now draws straight from the Mirror Perry sheet (`drawTwin`), so there is no `getImageData` call or invert filter and file:// pages no longer hit the canvas taint error.

## Project state (what exists)

**Game:** "Perry Riposte", a 2D side scroller, canvas 384x216 shown with `image-rendering: pixelated`. Live site: https://xenodorian.github.io/Biboo/web/ . Hero is Perry (full name Peregrine "Perry" Riposte; the opening line uses the full name, the title screen says Perry Riposte, all other text says Perry).

**Code layout:** `web/index.html`, `web/ui.js` (menus, shop, move lists with row cursor and Y descriptions), `web/progress.js` (saves, unlocks, ankhs without a cap), `web/levels.js` (map generator, leaves, boss maps), `web/input.js`, `web/music.js`, and the engine split into `web/game/00_core.js` to `22_test_hooks.js` (core and menus, assets, health, training, hazards, enemies in `11_enemies.js`, enemy attacks in `13_enemy_attacks.js`, player drawing, HUD, menus, story in `18_story.js`, title and overworld in `20_title.js`, test hooks in `22_test_hooks.js` which exposes `window.bibooGame`). Art and data generators are in `tools/` (creatures, arenas, backgrounds, items, music, training). Generated data: `web/assets/data.js`, `creatures.js`, `arenas.js`, `items.js`, `training.js`, `story.js`.

**Progression:** six levels (Green Trail, Mossy Falls, Sunstone Canyon, Sunset Shore, and two more; map counts per level not re-verified in this condensing) each ending in a boss map; optional Sunset Training; a Bone Merchant shop reached from the overworld. Each map's right door opens once every non-prop enemy is dead. Currency is Leaves (gold coins, start 100, never placed over pits). Gems are Bone (health), Quartz (energy), Garnet (empower), Diamond (super), Bone Powder (+25 max HP). Max HP starts at 50. Ankhs are extra lives with no cap. Unlocks are bought in the shop (Y shows what an item or unlock does); the Items menu replaced the Gems menu; Moves menus exist for gamepad and keyboard. Saving is manual (Save game writes localStorage `parryperry.manualsave.v1`). Dev cheats sit behind the L1+L2+R1+R2 chord. Hard reset wipes all saved keys.

**Controls (live game):** A attack and accept, Up jump (tap again in the air for the double jump), Y spin attack, X+Y taunt, Down then Up sky dash, hold A then release for the heavy chop, R held to recover. Energy moves use the L2, R2 and shoulder buttons.

**Combat numbers worth knowing:** parry of a melee attack deals 10 damage (`PARRY_DMG`, `05_health.js`). Enemy attacks land 300 ms after first contact so a parry up to 300 ms late counts. Bosses: Wyrm Slug (L1), Ooze Wraith (L2), Horned Dread (L3), Boar Lord (L4), Mirror Perry (final, level 5 keep). Bosses ignore taunt and plasma and drop 9 gems, 3 ankhs and a Bone Powder.

**Enemies (st86):** sight is doubled (`SIGHT_MUL = 2`). Enemies aim at the middle of Perry's body box (`herMidX()`), every enemy climbs, drops from platforms and hops pits (goblin carries 200 px, orc 70 px), and an enemy attacks as soon as one of its damage boxes would touch her body box (`strikeAttacks`). Creature damage boxes were tightened to the leading slice of the sprite by `tools/creatures/tighten_hits.py`; run it again after `tools/creatures/build.py`. Goblin keeps its combo-first pattern.

**Story and cutscenes (st84 to st97):** `web/game/18_story.js` holds the `STORY` pages (prologue, double, ending) and a per-scene table `SC` (picture pan, Perry's feet and scale, light `L`). Text is at the top. Backgrounds are the eight scene pictures in `web/assets/story/view/`, mapped in `web/assets/story.js`; boss arenas for fungal, crypt, bone and keep use scene pictures through `ARENA_STILLS`. Perry and evil Perry (Mirror Perry sheet) are stationary, drawn at the same scale. Shadows: `castShadow()` lays a silhouette on the ground along the scene light (`sx`, `sy`, `a`, `col`); the temple scene steps it up the stair treads (`L.steps`), the cliff scene clips it at the edge (`L.clip`), the burning house flickers it. Current shadow opacity: meadow and crowd 0.8, burning house 1.0, courtyard 0.8, temple 0.8, cliff 1.0. Miracle Island has no shadow: a rippled, fading reflection of the boat is mirrored below the hull, and the boat is still. The title screen uses the same shadow code (`20_title.js`).

**Audio:** 17 original chiptune songs generated by `tools/music/compose.py`, played by `BibooMusic` (Web Audio, crossfade, volume Off/30/60/100).

## Open items

- Cliff scene: Perry's shadow shoots left as a thin spike over the grass edge. The user has not decided whether to shorten or tilt it.
- Unrun or stale tests (see note 5) and the two docs fixes (note 6).
- Possible polish: per-attack reach for enemies, boss attack telegraphs, a boss unlock drop, a balance pass on boss damage.
- Heavy Horizontal reuses the slash animation.

## Log (recent, newest last)

- st83: Items menu, parry 10 damage, no leaves over pits, no ankh cap, Y descriptions; engine split.
- st84: hero renamed Perry; title screen Perry Riposte.
- st86: enemy logic overhaul (see Enemies).
- st87 to st88: scene pictures as cutscene backgrounds and boss arenas; text at the top; Perry placed per scene; boat picture on the Miracle Island pages.
- st89 to st91: boat halved, then raised and lowered to clear the shore (boatY 185).
- st92 to st96: cutscene shadows and boat reflection, darker shadows, burning-house Perry lowered 8 px, evil Perry matched to Perry's size, reflection attached to the hull and doubled in opacity, sprites made stationary, per-scene shadow opacity set by the owner.
- st97: title screen disc shadow replaced with a real cast shadow.
- st98: title screen logo reads PARRYING over PERRY (menu title Parrying Perry); subtitle still A PERRY RIPOSTE ADVENTURE; page title, h1 and final card text still say Perry Riposte.
- st99: the sea in the sunset picture ripples (rippleWater in 18_story.js): rows of the water slide sideways with the same sine wave as the boat reflection, growing toward the viewer. The water area is a hand-measured polygon (seaLeft, seaRight, SEA_TOP 161) that skips the cliff, the headland and the far shore. Applies to every scene that uses the sunset picture (sea, rewind, meditate, sunrise).
- st100: boss arena pictures no longer slide with Perry. One fixed centred crop, locked to the screen like the arena (camX is fixed in a map), so the background and characters never move at different speeds. No parallax for single pictures.
