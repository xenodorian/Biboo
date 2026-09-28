# Biboo

Procedural pixel-art pipeline for a 10-frame greatsword chop in a sunset side-scroller scene.
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
| `frames/` | The 10 composited frames, 384x216 |
| `layers/` | `sky`, `mountains_far`, `mountains_near`, `trees_back`, `trees_front`, `ground`, `fringe`. Each is 384 wide and tiles seamlessly in x, with 8 margin rows above and below the view for camera shake |
| `character/` | 10 transparent sprite frames sharing one crop box and anchor, plus `char_sheet.png` |
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
| 5 | impact | 120 | Low point: shoulder, straight arm and blade in one line, blade buried, motion-blur arc trailing the blade from the high guard, front foot stomps 4 px forward, flash, dirt crown, camera shake |
| 6 | burst | 90 | Same pose; the first dust cloud erupts from the cut, shake rebounds |
| 7-8 | plume, settle | 100, 120 | Dust plume and debris come down; body stays braced low on the buried blade, shake decays |
| 9-10 | return1, return2 | 110, 130 | Blade pulled free, front foot steps back, ease into plow (frame 1) |

Techniques: the fast part of the swing is carried by a motion-blur arc on the impact frame instead of in-between poses;
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
  checks.py     frame count, arm and leg lengths, planted feet, occlusion, tiling, GIF fidelity
data/
  pal.npy       20-colour character palette
  body_old.npy  character body (no arms or sword), 128x82 palette indices
docs/           preview GIF and sprite sheet
tests/          pytest wrapper around checks.py
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
