# Parry Perry

The game's main character is Max Perry. This repository (named Biboo, the project's earlier name)
holds her procedural pixel-art pipeline for a 11-frame greatsword chop in a sunset side-scroller scene.
One command rebuilds everything: the tileable background layers, the character sprite frames,
the effect overlays, a scene manifest for a game engine, and the preview GIFs.

![swing](docs/swing_x3.gif)

## Quick start

Requires Python 3.10 or newer.

```
pip install -r requirements.txt
python -m swingkit
```

Output goes to `out/` (ignored by git). Build time is a few seconds. The command also runs the
consistency checks and exits non-zero if any fail.

Options:

```
python -m swingkit --out build/          # different output folder
python -m swingkit --scales 5 3 1        # GIF scales to write (5x = 1920x1080)
python -m swingkit --no-check            # skip the checks
```

Run the checks as tests:

```
pip install pytest
pytest
```

## Output

| Path | Contents |
|---|---|
| `swing_x3.gif`, `swing_x1.gif` | The looping animation, exact palette, no dithering |
| `frames/` | The 11 composited frames, 384x216 |
| `layers/` | `sky`, `mountains_far`, `mountains_near`, `trees_back`, `trees_front`, `ground`, `fringe`. Each is 384 wide and tiles seamlessly in x, with 8 margin rows above and below the view for camera shake |
| `character/` | 11 transparent sprite frames sharing one crop box and anchor, plus `char_sheet.png` |
| `fx_back/`, `fx_front/` | Per-frame effect overlays (smears behind the character; glint, flash, dust, debris in front) |
| `scene_manifest.json` | Layer order and parallax factors, ground line, sprite anchor, per-frame timing, sword angle and camera shake |
| `contact_sheet.png` | All frames at a glance |

Draw order back to front: sky, mountains_far, mountains_near, trees_back, trees_front, ground,
fx_back, character, fx_front, fringe. The fringe (tall grass) sits in front of the character's feet.

## The animation

Everything is drawn at one pixel scale. Limbs and the sword are redrawn every frame from fixed
measurements, never scaled, so proportions stay identical.

| Frame | Name | ms | What happens |
|---|---|---|---|
| 1 | plow | 320 | Plow guard (Pflug): hands low at the hip, blade angled up at the opponent's face, knees bent |
| 2-3 | raise1, raise2 | 90, 80 | Both hands lift the sword past vertical; weight rocks back, front foot lifts, eyes look up |
| 4 | high | 250 | High guard: fists above and in front of the forehead, blade up and back at 45 degrees, glint |
| 5 | impact | 120 | Low point: shoulder, straight arm and blade in one line, blade buried; motion blur trails the blade from the high guard (a stepped crescent with speed streaks); front foot stomps 4 px forward, flash, dirt crown, camera shake |
| 6 | impactbw | 60 | Anime-style impact frame: black and white, dense speed lines converging on the cut, black silhouette with white linework, white starburst |
| 7 | burst | 90 | Same pose; the first dust cloud erupts from the cut, shake rebounds |
| 8-9 | plume, settle | 100, 120 | Dust plume and debris come down; body stays braced low on the buried blade, shake decays |
| 10-11 | return1, return2 | 110, 130 | Blade pulled free, front foot steps back, ease into plow (frame 1) |

Techniques: the fast part of the swing is carried by motion blur on the impact frame and a black-and-white impact frame instead of in-between poses;
the hands go over the head in the high guard and the arms straighten into a full forward extension on
the way down. The rear hand holds the base of the handle, just above the pommel, in every frame
(`anim.REAR_HAND`, `anim.GRIP_SPAN`), with the lead hand up the grip by `anim.GRIP_GAP` (below the guard in plow and the strike).
Arms are two fixed-length segments (`anim.ARM_LEN`) that bend at the elbow. The head is drawn in
its own pass, so the lead arm goes behind the head and the rear arm in front of it; the blade and
guard never cover the face. Legs are two fixed-length
segments solved by inverse kinematics, so the hips can drop and the knees bend without changing
leg length; the front foot steps and stomps while planted feet are checked to stay on the ground.
The torso leans row by row and bends at the waist (`bend` in `HIPS`, rotated with a RotSprite-style
resample) while the head moves as one rigid piece (the face is never sheared or rotated).
The skirt hem lifts, trails, flares and bounces; the long hair sways and lifts with lag. Debris and
dust use simple deterministic physics; camera shake moves distant layers less.

Per-frame motion tables live in `swingkit/anim.py`: `HIPS` (hip offset, lean and waist bend), `FEET` (front
foot), `REAR_HEEL_UP`, `CLOTH` (skirt hem), `HAIR` (sway and lift), `GAZE` (eye direction) and
`SHOULDERS` (shoulder drive and sleeve squash). Frames are always looked up by name
(`anim.by_name`), never by index. Each boot foot is drawn together with its shin as one shape
(`rig._foot_mask`), so the ankle is continuous; both feet point toward the strike.

## Move library

Every other move the character has lives in `swingkit/moves/` and is built with the main
animation (`python -m swingkit`; add `--no-moves` to skip it). Each move writes composited preview
frames, transparent sprites on one shared anchor, a sprite sheet and a 2x GIF to
`out/moves/<id>/`. `out/moves/moves.json` holds the game data for all of them: frame timing, root
motion (how far the character travels, y up), hitbox capsules on active frames, loop points and the
input. `game/input_map.json` maps the Dreamcast pad to the moves ('+' = pressed together, '-' = in
sequence) with chord, sequence and tap windows. Previews of every move are in `docs/moves/`.

| Input | Move | Notes |
|---|---|---|
| none | idle | Plow guard, breathing loop |
| Right / Left (hold) | walk_right / walk_left | Shuffle steps in guard, 10 px per cycle. In the game, pressing Left turns Max to face left (her art, attacks and motion mirror) and Right turns her back; both walk with the forward walk |
| Down (hold) | duck | Crouch, holds |
| Up (hold) | charge | Rises into the high guard, blue aura loop; press A for the heavy chop |
| B hold / tap | block / parry | Upright sword; tap gives a spark parry window |
| Y | jump | Two body heights (164 px) |
| X | dash | 92 px, afterimages and speed lines |
| A | slash | Horizontal slash, flat crescent smear. 25 damage, 25 px pushback over 100 ms |
| A (hold, then release) | heavy | The main chop animation above; hold A to charge, let go to swing (tap A is still the slash) |
| Right+A | thrust | Lunging thrust, 18 px forward; fires on press, no charge |
| Down+A | upswing | Duck, then rising cut |
| L | push_kick | One cock-back frame with the sword raised out of the way, then a straight-leg push that slides her 49 px so the boot passes where the blade tip was; recoil |
| R (hold) | recover | Kneel on the planted sword, green glow, rising + signs |
| hold B, tap A | heavy_horizontal | Heavy Horizontal: the horizontal slash with 50 damage and 50 px pushback over 100 ms |
| A+L1 | beam_laser | Laser beam (15 per tick, 5 energy): a yellow-white bar with cyan lightning |
| A+R1 | beam_plasma | Empowerment Beam (was the plasma beam), 0 damage, 5 empower per tick, 30 px pushback per tick. Enlarges the enemies it hits, which then drop Energy Gems |
| A+L2 | beam_cloud | Cloud beam (5 per tick, 1 energy): white and cyan wisps |
| A+R2 | beam_fire | Fire beam (15 per tick, 3 energy, 5 px pushback per tick) from the blade tip |
| B+L / A+B+L | heavy_kick / energy_kick | Bigger push kick; with blue energy (A, B and L together, or one after another in any order) |
| L2 | energy_burst | Ring and rays in all directions: 50 damage, twice the old radius (up to 92 px), 100 px knockback over 500 ms |
| hold L1+R1 | (meter charge) | Charges the ENG, EMP and SUP meters by 1 each every 500 ms while both are held; Max kneels in the charge pose. Not a move: no push kick or recover starts |
| X+Y | taunt | Plants the sword and beckons |
| X+A | dash_thrust | Blurred dash into the thrust |
| A (in the air) | jump_crash | Crash down into the heavy impact from wherever she is in the air (a jump, or falling after the sky dash); no second jump |
| Down-Up | sky_dash | Rises 6 body lengths (492 px); tap Down then Up, or hold Down and press Up |
| Y | spin_attack | Two turns with a ring smear; hits enemies in front of her and behind her |
| B-X+A | energy_dash_thrust | Dash thrust with blue energy; tap or hold B, then press X and A together |
| Down-Right-A-B | energy_wave | Upswing that launches a large energy crescent |
| Down x4, A | earthquake | Slam, cracks and rocks along the ground, heavy shake |
| B x5 | meteor_shower | Sword to the sky, meteors rain ahead |

Moves are written as short pose specs (only what differs from the plow guard) in
`swingkit/moves/`; `base.frame()` turns them into rig frames, `base.tween()` makes in-betweens and
`base.fit()` pulls the grip into reach. Effects are in `swingkit/movefx.py`, the compositor
(root motion, follow camera, afterimages) in `swingkit/movekit.py`. The `moves` check keeps every
move on the rig rules (fixed limb lengths, planted feet, grip, draw order, face clear).

## Web game

`web/index.html` is the game. Open it in a browser (no server needed). Live: https://xenodorian.github.io/Biboo/web/

Flow: title menu, then the overworld (pick a level), then the level. A level is 10 one-screen maps (Level 1.1 to
1.10; level 1 has 9, ending at 1.9); walk off the right edge for the next map and off the left edge to go back. The last map must be cleared of
enemies to finish levels 2 to 5. Level 1 ends at a locked door at the right edge of 1.9: the key drops only from a crate (level 1's plain crates come back
each visit) and only once every move in level 1 is unlocked. Level 1 drops health gems only. Enemies respawn whenever you leave a map and come back.

Controls (the in-game Moves menu lists them and the combos you have unlocked):

| Pad | Keyboard | Gamepad |
|---|---|---|
| Up / Down / Left / Right | arrow keys | d-pad or left stick |
| A / B / X / Y | Z / X / A / S | bottom / right / left / top face button |

A (key Z) is the attack button again (slash and every combo). Jump is the Up button (tap Up; tap Up again in the air for the double jump).
Y (key S) is the spin attack, and X+Y is the taunt. Sky Dash is Down then Up. A is also the accept button in menus. Holding Up still charges once she has landed.
| L1 L2 R1 R2 | Q 1 W 2 | shoulders or triggers |

Unlocks: a new game has only the d-pad and A, B, X, Y. Saving is manual only: the main menu has New game (wipes the saved data and goes to the overworld with 100 Leaves), Continue (only when a manual save exists) and Save game (in-level and overworld menus). Nothing is saved automatically, and closing or reloading the page loses unsaved progress (Retry this map after a K.O. still works). Golden crates (marked "?") hold unlocks, each one exactly the unlock assigned to its map; a golden crate is only built while that unlock is not owned, and it never gives loot or a substitute: combos and the
L1, L2, R1, R2 buttons. Smash the crate and touch the item. Energy, Empowerment and Super meters appear once a move that
uses them is unlocked; the health bar is always shown. Unlock definitions: `web/progress.js` (UNLOCKS); where each
crate sits: `web/levels.js` (`whereIs`).

Jumping: A is a floaty physics jump (about 135 px high, about 670 ms in the air, about 107 px sideways with Left or Right held). Down then A
(the sky dash) is unchanged. Double tap Down on a platform to drop through it (no unlock needed).

Double Jump (an unlock, Level 2.4): tap Up again in the air for a spinning second jump that rises about two more of her heights (81 px). One per trip through the air.

Meters: Energy, Empowerment and Super each start with a maximum of 50 (Super 100) (a new meter starts full). Every plain crate drops something useful (never a gem for a meter she has not unlocked, a full bag, or an upgrade at the cap): a health gem,
a meter gem, or a +25 meter upgrade (raises that meter's maximum by 25 and fills it by 25, up to 200). Earthquake and Meteor Shower need a
full Super meter, whatever its maximum is.

Hazards (Level data in `web/levels.js`, code in the "hazards" section of `web/game.js`):
- Pits: gaps in the ground. Her feet on the ground inside one start a fall; she drops visibly and dies only once she has fallen off the bottom of the screen. Ground enemies stop at the edge; one pushed in
  by a hit, beam or blast falls and is gone (no drops). There are no barriers any more.
- Bombs: only she sets them off (touch, or any damage she does, including a reflected shard). 50 damage within 50 px to her and to enemies; they chain.
- Goblin shards: the goblin's backflip throws two real shards at her. 20 damage each. Hold B to block for no damage, or tap B as one arrives
  to reflect it straight forward (it hurts enemies and sets off bombs).

Enemies patrol a set path and chase only when hit or when she is inside their sight range in front of them.
35% of kills drop a health gem (+25% of max health, 50 of 200 HP, `GEM_HEAL` in game.js). Gems go
to a bag and are used from the Gems menu. Air control was added because the jump has no sideways motion.

Cheats menu: open the pause menu and press L1+R1+L2+R2 together (Q+W+1+2 on the keyboard) to add a Cheats entry to it. Cheats: God Mode (no damage),
Infinite Meter (meters never drain), Level Unlock (all six levels), Master Unlock (every unlockable) and No Pitfalls (pits act as solid ground).

Files: `web/game.js` (engine), `web/progress.js` (unlocks, gems, in memory; the only thing written to the browser is the manual save, localStorage `parryperry.manualsave.v1`),
`web/levels.js` (map data, Level 1 by hand, Levels 2 to 5 generated from fixed seeds), `web/ui.js` (menus),
`web/input.js` (input reader), `web/assets/data.js` (generated move data).

The heavy chop and the crash (A in the air) always play the dust cloud. A full impact also shows the
black-and-white impact frame (held 110 ms) and shakes the ground. The chop is full after a 1 second charge (Up held).
The crash is full only when it starts more than two body lengths (164 px) up.

Gamepads, wired or Bluetooth, come through the browser's Gamepad API with the standard layout. The input monitor
under the page lists every raw key and controller event.

`web/input.js` reads `game/input_map.json`: holds loop while held, B is parry when tapped and block when held, chords
need their buttons within `chord_window_ms`, sequences need each press within `sequence_window_ms` of the last. The
longest sequence wins, then the largest chord, then a single button. Locked buttons are dropped from the reader.

The assets in `web/assets/` are generated. Rebuild them after changing a move:

```
python -m swingkit --web
```

### Enemies (combat test)

A goblin and an orc walk in from the right and attack when they get close. Any attack of hers that
touches one kills it at once (HP comes later). When one of theirs reaches her:

- Hit: she turns red and is knocked back (goblin 40 px, orc 64 px). She is stunned in the raised
  sword pose, with no control, until the push stops, and cannot be hit again for 0.4 s after.
- Blocking (holding B): she flashes white and slides back 8 px. No stun; she keeps blocking.
- Parry (tap B): if her parry frames 1-3 are showing while the attack is up to two frames from
  hitting her, or on its first hitting frame before the hit lands, the enemy turns white, is pushed back (goblin 50 px, orc 40 px)
  and is stunned until the push stops. She takes nothing.

An enemy hit lands 90 ms after its hitting frame first touches her hurtbox (about one enemy frame),
which leaves time to parry the swing as it appears. Her hurtbox reaches the top of her body on each
frame (81 px standing) and stops 5 px under her head in the full kneeling duck (57 px). The orc is drawn at 5x,
so its swing (70-110 px up) hits her standing but passes over her kneeling duck.

Enemy attack areas are the weapon and smear in front of the body on hand-picked frames (goblin 20,
21, 24, 25, 31, 32, 39-41, and 47-49 for the green spin all round; orc 27-28). Press H in the game to
show hurtboxes (yellow enemies, blue her), her attack shapes (red) and enemy attack areas (orange).

`swingkit/enemies.py` builds them from the packed GIFs in `data/enemies/`: it samples each GIF down
to native pixels, keys out the background (the goblin's shadow and the orc's sword smear become
translucent), flips the art to face left, scales it (goblin x2, orc x5) and splits it into
animations:

| Enemy | Animation | GIF frames | Use |
|---|---|---|---|
| goblin | idle | 0-5 | resting between attacks |
| goblin | walk | 0-5 | approach (the sheet has no walk cycle, so it slides in its ready stance) |
| goblin | slash | 18-27 | spin slash into a lunge, when close |
| goblin | dive | 27-35 | dive roll attack, from mid range (110-170 px) |
| goblin | combo | 35-50 | combo attack (leap, air slashes, green spin), when close |
| orc | idle | 0-3 | resting between attacks |
| orc | walk | 8-15 | approach |
| orc | attack | 25-31 | overhead swing |
| orc | hurt | 49-50 | exported, not used yet |
| orc | death | 57-60 | played when killed |

Every attack returns to idle. The goblin's art moves inside its frames during the dive roll and the
combo; each frame stores its ground offset, so the goblin stays where an attack leaves it. Goblin
frames 51-68 are not used. The goblin has no death animation, so it flickers and fades out.

Her hit shapes are exported per frame in `data.js`: the blade capsule (guard to tip) or the kicking
foot on active frames, plus the energy that hits: the burst ring, the earthquake crack along the
ground, the flying energy wave and landing meteors. The parry never hits. The two upswings also hit along the arc the blade swings through (from behind her, under and up through the front) on their first hit frame.

Tests: `node web/tests/input.test.js` drives every binding through the input reader (also run by
`pytest`), and `NODE_PATH=$(npm root -g) node web/tests/browser.test.js` presses real keys in
headless Chromium and checks that each binding starts its move and that attacks kill enemies in reach (needs Playwright).

## Project layout

```
swingkit/
  bg.py         background layers (sky, mountains, trees, ground, fringe), all periodic in x
  rig.py        character rig: body layers, IK legs, skirt cloth, hair bending, arms, fists, sword
  anim.py       the 12 pose specifications and the character renderer
  fx.py         smears, glint, impact flash, dirt crown, mound, debris, dust cloud
  composite.py  frame assembly with parallax camera shake
  gifwrite.py   exact-palette GIF writer and verifier
  build.py      writes every deliverable
  webexport.py  assets for the browser game (web/)
  enemies.py    enemy sprites for the browser game, cut from data/enemies/*.gif
  checks.py     frame count, arm and leg lengths, planted feet, occlusion, tiling, GIF fidelity
data/
  pal.npy       20-colour character palette
  body_old.npy  character body (no arms or sword), 128x82 palette indices
docs/           preview GIF and sprite sheet
tests/          pytest wrapper around checks.py and the web input tests
web/            browser game: index.html, game.js, input.js, generated assets/
```

## Changing things

- Poses and timing: edit `FRAMES` in `swingkit/anim.py`. Each frame sets the sword angle, hand
  positions, arm routing, body offsets, hair sway, draw order and duration. The checks flag arms
  that stretch or shrink, a lead arm drawn in front of the head, and any blade or guard pixel over
  the face.
- Effects: particle counts, speeds, gravity and colours are at the top of the particle section in
  `swingkit/fx.py`. All randomness is seeded, so builds are reproducible.
- Scene: peak positions, colours and seeds live in `swingkit/bg.py`. Placement of the character in
  the demo scene is `X0, Y0` in `swingkit/fx.py`.

## Background art

The scene is original pixel art generated by `bg.py`. It was inspired by a reference image that was
a watermarked stock preview, which is not used or included. If you license a background of your
own, replace the files in `out/layers/` (or change `bg.build_all`) and keep the same layer names,
width and margin rows.


### Beams

The four beam textures come from `data/beams_src/` (two source images with a top and a bottom beam each). `swingkit/beams.py` cuts each out on a transparent background at the game's pixel size and writes one seamless tile per beam to `web/assets/beams/`. A beam move holds the lunging thrust stance for about 0.55 s; the game draws the tile strip, scrolling away, from the blade tip in the direction she faces (up to 330 px), and it hits every enemy it touches every 100 ms.

### Health and damage

Max has 200 HP, a goblin 60 and an orc 200. Every attack takes HP off an enemy it touches (numbers are tunable at the top of the health section in `web/game.js`): slash 15, thrust 18, upswing 18, push kick 10, heavy kick 25, energy kick 30, energy burst 50, dash thrust 22, energy dash thrust 35, spin 20 (each side), energy wave 40, earthquake 30, meteor shower 25. The heavy overhead chop does 200 on a direct hit and, where the blade lands, 150 plus a 25 px push (100 ms) to every other enemy within 25 px; the jump crash does 300. A move hurts an enemy once per use; beams hurt every 100 ms they touch (cloud 5, fire 15, laser 10, Empowerment Beam 0) and shove the enemy back per tick (cloud 0, fire 5 px, laser 20 px, Empowerment Beam 30 px). An orc hit takes 30 HP off Max and a goblin hit 12; blocking and parrying take none. Damage shows as red numbers rising from the target, each enemy has a bar over its head and Max's bar is at the top left. Kneeling to recover (R held) gives 5 HP every 0.35 s with green numbers. At 0 HP Max is knocked out for 1.5 s and gets back up at full HP.

Knockback (distance, stun time): push kick 100 px, 200 ms; energy kick 200 px, 300 ms; energy burst 100 px, 500 ms; a parry 100 px, 400 ms (no damage). An enemy that dies is not pushed.

### Energy and empower meters

Three meters sit under the health bar: ENG (blue) and EMP (orange), each starting at 50 (and +25 per upgrade), and SUP (purple), starting at 100. The super meter is filled only by Super Gems (25 each): one drops where an enemy is killed by a beam attack. A full super meter (100) pays for the earthquake and the meteor shower, and they use all of it; without it they do not play and the bar flashes "No super". Gems dropped by defeated enemies fill them by 25 each when Max walks over them: a taunted enemy (X+Y) drops 2 empower gems, an enemy hit by the Empowerment Beam drops 2 energy gems, and every kill also has a 35% chance of one more random gem. Energy pays for the cloud (1 per tick), fire (2) and laser (3) beams and the energy wave (30). Empower pays for the Empowerment Beam (A+R1, 5 per tick) and for kneeling to recover (R, 1 per tick). A move whose meter cannot pay does not play (the bar flashes and "No energy" or "No empower" shows), and a beam or a recovery stops the moment its meter runs dry. Keyboard: T is R1.

Energy attacks (energy kick, energy burst, energy wave, energy dash thrust): press and hold their buttons to charge (the charge pose plays and drains energy, 20 for a full second; Max turns blue when full) and let go to fire. Letting go before 250 ms fires nothing; a partial charge fires at 50 to 100 percent power. Ground only. They no longer have a flat energy cost.

Level 2 has nine maps (2.10 was removed) and ends at a locked door at the right edge of 2.9, like level 1. Unlocks by map: 2.1 Recover (R1, the Empowerment meter and empower gems), 2.2 Taunt, 2.3 Empowerment Beam, 2.4 Energy Kick (ENG meter and energy gems), 2.5 Energy Dash Thrust, 2.6 Energy Burst (L2), 2.7 Energy Wave (R2), 2.8 Cloud Beam. The key drops from a crate only once all eight are owned. Jumping Crash, Heavy Overhead Chop, Laser Beam and Fire Beam moved to level 3 for now. The old L1, L2, R1 and R2 unlocks were split into single-move unlocks (old saves are converted on load).

Level 3 has nine maps (3.10 was removed): 3.1 Heavy Overhead Chop, 3.3 Jumping Crash, 3.5 Fire Beam, 3.7 Laser Beam (now 5 energy and 15 damage per tick), the key drop only in 3.8 (plain crates there, once all four are owned), and the locked door at the end of 3.9. Earthquake moved to 4.1 (Meteor Shower stays in 4.3), so both stay late-game.

No keys or key chests: every locked-door level (1 to 4) has its door at the right edge of map .9, drawn with a padlock and closed until every unlock placed in that level is owned (`doorLocked` in game.js). The hint reads 'The door is locked. Unlock every move in this level first.'

Enemies leap pits: a chasing ground enemy that reaches a pit edge with her on the far side jumps the gap (22 px arc, gaps up to 140 px) and carries on; patrols and enemies on platforms are unchanged. The dash, dash thrust and energy dash thrust hop 5 px (a short arc over the move, `dashHop` in game.js).

Max HP starts at 50. A +25 Max HP gem (green diamond with a ring and plus) drops from crates and kills alongside health gems; a health gem heals 25 percent of Max HP. The push kick and energy kick hop 5 px like the dash.


## Leaves and the Bone Merchant
Leaves are the gold coin currency (start with 100). They lie along the maps and some crates hold large caches. Ankhs now come only from crates. Each map's right door stays barred until every enemy on that map is defeated, and the left edge is a wall. The Bone Merchant on the overworld sells Bones (health), Bone Powder (+25 max HP), Quartz, Garnet and Diamonds (meter refills), Mutagens (meter based unlocks) and Warrior Scrolls (all other unlocks). An unlock is on sale once the level before the one that used to hold it is beaten. Gems still drop from crates and enemies as before.
