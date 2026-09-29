# Biboo

Procedural pixel-art pipeline for a 11-frame greatsword chop in a sunset side-scroller scene.
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
| Right / Left (hold) | walk_right / walk_left | Shuffle steps in guard, 12 px per cycle |
| Down (hold) | duck | Crouch, holds |
| Up (hold) | charge | Rises into the high guard, blue aura loop; release into Up+A |
| B hold / tap | block / parry | Upright sword; tap gives a spark parry window |
| Y | jump | Two body heights (164 px) |
| X | dash | 92 px, afterimages and speed lines |
| A | slash | Horizontal slash, flat crescent smear |
| Up+A | heavy | The main chop animation above |
| Right+A | thrust | Lunging thrust, 18 px forward |
| Down+A | upswing | Duck, then rising cut |
| Left+A | backstep_upswing | Rising cut while hopping 36 px back |
| L | push_kick | Chamber, hip-height push, recoil |
| R (hold) | recover | Kneel on the planted sword, green glow, rising + signs |
| A+B | energy_slash | Slash with glittering blue energy |
| B+L / A+B+L | heavy_kick / energy_kick | Bigger push kick; with blue energy |
| L+R | energy_burst | Ring and rays in all directions |
| X+Y | taunt | Plants the sword and beckons |
| X+A | dash_thrust | Blurred dash into the thrust |
| Y-A | jump_crash | Jump, then crash down into the heavy impact |
| Down-Y | sky_dash | Rises 6 body lengths (492 px) |
| Left-Right-A | spin_attack | Two turns with a ring smear |
| B-X-A | energy_dash_thrust | Dash thrust with blue energy |
| Down-Right-A-B | energy_wave | Upswing that launches a large energy crescent |
| Down x4, A | earthquake | Slam, cracks and rocks along the ground, heavy shake |
| Up x4, A | meteor_shower | Sword to the sky, meteors rain ahead |

Moves are written as short pose specs (only what differs from the plow guard) in
`swingkit/moves/`; `base.frame()` turns them into rig frames, `base.tween()` makes in-betweens and
`base.fit()` pulls the grip into reach. Effects are in `swingkit/movefx.py`, the compositor
(root motion, follow camera, afterimages) in `swingkit/movekit.py`. The `moves` check keeps every
move on the rig rules (fixed limb lengths, planted feet, grip, draw order, face clear).

## Web game

`web/index.html` plays the move library live. Open the file in a browser (no server needed) and
use the Dreamcast inputs from the table above:

| Pad | Keyboard | Gamepad |
|---|---|---|
| Up / Down / Left / Right | arrow keys | d-pad or left stick |
| A / B / X / Y | Z / X / C / V | bottom / right / left / top face button |
| L / R | Q / W | shoulders or triggers |

`web/input.js` reads `game/input_map.json` exactly: holds loop while held, B is parry when tapped
(up to `tap_max_ms`) and block when held, chords need their face and shoulder buttons within
`chord_window_ms` (directions only need to be held, so hold Right and press A for the thrust),
sequences need each press within `sequence_window_ms` of the last, and releasing a full charge
(Up) swings the heavy chop. The longest sequence wins, then the largest chord, then a single
button. A plain press made during another attack waits for it to finish; chords, sequences, taps
and releases cut in. A move that ends in the air (the sky dash) falls back down and lands.

The assets in `web/assets/` are generated: each move frame is one image with the effects and the
character, drawn around the character so the game can place it anywhere in the scrolling scene.
Rebuild them after changing a move:

```
python -m swingkit --web
```

Tests: `node web/tests/input.test.js` drives every binding through the input reader (also run by
`pytest`), and `NODE_PATH=$(npm root -g) node web/tests/browser.test.js` presses real keys in
headless Chromium and checks that each binding starts its move (needs Playwright).

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
