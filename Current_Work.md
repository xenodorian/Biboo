# Current Work

Shared task board for everyone working on this repo, humans and agents.
Read the rules first, claim a step before starting it, and sign off when it is done.

## Rules for agents

**Syncing and pushing**
1. Work directly on `main`. Do not create branches. Push each finished step straight to `main` so
   everyone always has the current build.
2. Run `git pull --rebase origin main` before you start work, before you edit this file, and again
   right before every push.
3. Never force-push, rewrite published history, or amend a commit that is already on `main`.
4. If a rebase conflicts, resolve it by keeping both sides' intent. If you cannot tell what the
   other change meant, stop and ask the user instead of discarding it.

**Claiming work**
5. Claim a step before starting it. Change its status to `IN PROGRESS`, add your name and the date,
   commit only that edit (message: `Claim step N: ...`), and push. If the push is rejected because
   someone else claimed it first, pull and pick a different step.
6. Do not start a step that someone else has claimed. If a claim looks abandoned (no related commit
   for 24 hours), ask the user before taking it over.
7. One step per commit where possible. Keep commits small and focused on the step you claimed.

**Quality bar**
8. Before every push, run `python -m swingkit` and `pytest`. Do not push if any check fails. A step
   that changes the animation must also leave every existing check passing.
9. Proportions are fixed. Never scale limbs, the head, or the sword. Change angles, positions and
   overlap only. If a step needs a new check (for example, leg length), add it to
   `swingkit/checks.py` and to `tests/`.
10. Never add pixels over the character's face (the face-clearance check enforces this).
11. Keep all randomness seeded so builds are reproducible.
12. Never commit generated output. `out/` stays ignored. Only update `docs/swing_x3.gif` in the
    review step, or when a step explicitly says to.
13. Do not change `data/` files, the palette, or the character or sword design without the user's
    approval.

**Recording work**
14. When a step is done: tick its box, set the status to `DONE`, add a one-line result note, sign
    off with your name and the date, and push that together with the work, or right after it.
15. Anything outside the step's scope, or anything that changes the look of the character, needs the
    user's approval first. Put the question under *Open questions* instead of guessing.
16. Documentation style: plain language, no em dashes, no emoji.

## Workflow: kinetic animation upgrade

Goal: make the swing more kinetic by animating the legs and secondary body parts, while keeping
the character and sword designs, pixel scale, and fixed proportions. The animation stays at 12
frames or fewer.

### Step 0. Set up this task board
- [x] Create `Current_Work.md` with the workflow and the rules.
- Status: DONE
- Result: Board created.
- Signed off: Claude, 2026-09-27

### Step 1. Leg rig
- [x] Separate the legs and boots from the body bitmap. Keep the boots as fixed stamps that can
      move but are never rotated or scaled.
- [x] Draw the visible leg (lower thigh, knee, sock) every frame as two segments of fixed length
      between a hip point and the boot, the same way the arms are drawn.
- [x] The neutral pose must match the current look closely.
- [x] Add a check that the thigh and shin lengths are identical in every frame.
- Acceptance: all checks pass, the neutral frame matches the current legs, and leg lengths are
  constant.
- Status: DONE
- Result: Legs are now drawn every frame as a skin thigh, a frilled sock cuff and a laced boot shaft, solved with two-bone IK (knees bend outward). Feet are the original boot soles, moved but never rotated. Neutral stance matches the original closely. New leg-length check and test added; all 7 checks and 6 tests pass.
- Signed off: Claude, 2026-09-27

### Step 2. Hip height and real knee bend
- [x] Add a hip offset to each frame in `FRAMES`: hips rise at the peak and drop at impact.
- [x] Legs bend at the knee to absorb the change (knees push outward) instead of the upper body
      sliding down over the legs.
- Acceptance: the crouch reads as bent knees, leg lengths stay constant, and no seams or holes
  appear between the skirt and legs.
- Status: DONE
- Result: `anim.HIPS` sets a hip offset per frame (weight back 1 px in the wind-up, 3 px crouch at impact, 4 px overshoot, then recovery). Skirt, torso, head and hands ride on the hips; feet stay planted and the knees bend outward by IK. Added an under-skirt shadow layer so bent thighs never show through the old hem notches, and a hem shade row on the legs. Out-of-reach poses pull the foot in rather than stretching the leg. All checks and tests pass.
- Signed off: Claude, 2026-09-27

### Step 3. Step into the strike (with stomp)
- [x] Wind-up: weight rocks back onto the rear leg, and the front foot lifts slightly at the peak.
- [x] Impact: the front foot plants 3 to 5 px forward on the impact frame.
- [x] Add a small stomp dust puff at the planted foot.
- [x] Add a check that any planted boot sits exactly on the feet row.
- Acceptance: the step reads at 1x, planted feet never float or sink, and the checks pass.
- Status: DONE
- Result: `anim.FEET` drives the front (right) foot: planted, lifts 1.5 px then 3 px while drawing back during the wind-up, travels forward through the smears, stomps down 4 px forward at impact with its own dust (`fx.stomp`), then steps back in the recovery so the loop closes. The rear foot never moves. New planted-feet check and test; all 8 checks and 7 tests pass.
- Signed off: Claude, 2026-09-27

### Step 4. Torso and head lean
- [x] Tilt the upper body with per-row horizontal shifts, not rotation: 1 to 2 px back at the peak,
      up to 3 px forward at impact.
- [x] Keep the head and the arm attachment points consistent with the lean.
- Acceptance: the lean reads, there are no seams at the waist or neck, and face clearance still
  passes.
- Status: DONE
- Result: `lean` per frame in `anim.HIPS` (2 px back at the wind-up peak, 3 px forward at impact, easing back). The torso shifts row by row (0 at the waist, half the lean at its top, `rig.torso_shear`); the head moves as one rigid piece so the face is never sheared. Shoulders follow the torso shear. Face clearance still passes; all checks and tests pass.
- Signed off: Claude, 2026-09-27

### Step 5. Skirt motion
- [x] Hem lifts and flares during the rise, trails behind during the swing, bounces past rest at
      impact, then settles.
- Acceptance: smooth motion across frames, no holes, and the silhouette outline stays clean.
- Status: DONE
- Result: `anim.CLOTH` gives each frame a hem lift, trail and flare; `rig._deform_paste` bends the skirt below row 40 by inverse-mapped sampling (no holes possible), and the under-skirt shadow and hem shading follow the same deformation. Hem lifts 3 px at the peak, trails through the swing, flares 3 px at impact, bounces 1 px below rest, then settles. Neutral frame unchanged; all checks and tests pass.
- Signed off: Claude, 2026-09-27

### Step 6. Stronger hair motion
- [x] Add vertical lag to the existing sideways sway: the hair lifts as the body drops, overshoots
      forward at impact, then falls and settles.
- Acceptance: no seams or doubled outlines at any offset (test the extremes as in the rig stress
  test).
- Status: DONE
- Result: `anim.HAIR` sets sway and lift per frame. `rig._hair` now adds vertical lag (tips lift 3 px as the body drops, hang 1 px on the rise, drop 1 px on the overshoot) with row-gap filling, and sway reaches 4 px at the fastest point. Stress-tested at sway -4/+4 with lift +3/-2: no seams or doubled outlines. All checks and tests pass.
- Signed off: Claude, 2026-09-27

### Step 7. Review and publish
- [x] Render every frame and review each one zoomed in and at 1x. Fix any issues found.
- [x] Update `docs/swing_x3.gif`, the README frame table, and the manifest notes.
- Acceptance: all checks and tests pass, and the preview GIF on `main` shows the upgraded animation.
- Status: DONE
- Result: All 12 frames reviewed zoomed and at 1x; no blocking issues (the bent front knee's sock cuff reads slightly round in frames 3 and 4, acceptable at this scale). `docs/swing_x3.gif` and `docs/char_sheet.png` updated, README frame table and techniques rewritten, manifest now records hips, lean, front foot, skirt and hair per frame. All 8 checks and 7 tests pass.
- Signed off: Claude, 2026-09-27

### Approved follow-up steps (user approved all on 2026-09-28)

### Step 8. Sock cuff tidy and toe direction
- [x] Keep the sock cuff a clean band across the leg when the knee bends, instead of a round blob
      (frames 3 and 4).
- [x] Toes read as pointing inward while the knees bend outward (user, 2026-09-28). Fix the toes:
      redraw both boot feet so they clearly point outward (toe cap outward, heel under the shaft).
- Acceptance: the cuff reads as a band in every frame; neutral frame visually unchanged; checks pass.
- Status: DONE
- Result: Sock cuff is now measured along the shin axis, so it stays a clean band when the knee bends (no round blob in frames 3 and 4). Both boot feet are redrawn by hand (`rig.LEFT_FOOT`, mirrored for the right): toe cap points outward, heel under the shaft, arch gap between, so the toes now agree with the outward knee bend. All checks and tests pass.
- Signed off: Claude, 2026-09-28

### Step 9. Head direction (was optional C)
- [x] Chin up at the peak, chin tucked at impact, without redrawing or shearing the face.
- Acceptance: reads at 1x, face clearance passes, no seams at the neck.
- Status: DONE
- Result: `anim.GAZE`: the eye block (rows 18-20) moves 1 px up at the rise and peak (looking at the blade) and 1 px down from the drop through the impact hold (focused, chin-down read). Eye pixels are only translated, never redrawn. A physical 1 px head tuck was tried and removed because it pushed the chin onto the near arm (face clearance failed). All checks and tests pass.
- Signed off: Claude, 2026-09-28

### Step 10. Shoulder drive and sleeve squash (was optional D)
- [x] Shoulders move independently of the torso: far shoulder rises at the peak, near shoulder
      drives down at the strike.
- [x] Sleeve puffs stretch 1 px at the peak and squash 1 px at impact.
- Acceptance: arm length check still passes, no seams at the shoulders.
- Status: DONE
- Result: `anim.SHOULDERS`: the far shoulder lifts up to 1.5 px into the peak, the near shoulder drives down 1.5 px into the strike; sleeves stretch 1 px at the peak and squash at impact (1 px shorter, 0.4 px fuller), easing back. Arm lengths stay in range (near 15.8 to 20.9, far 5.4 to 19.4). No seams at the shoulders. All checks and tests pass.
- Signed off: Claude, 2026-09-28

### Step 11. Heel-up boot (was optional A)
- [x] Hand-draw one heel-up variant of the rear boot (same palette and outline style).
- [x] Use it during the wind-up peak and the swing so the rear heel lifts and she pivots on the toe.
- Acceptance: the toe stays on the ground row (planted check updated for heel-up frames), the variant
  matches the original boot style, checks pass.
- Status: DONE
- Result: `rig.LEFT_FOOT_HEEL_UP` is built from the hand-drawn flat boot by raising whole pixel columns (0 at the toe to 3 px at the heel), so it keeps the same palette and outline style. The rear heel lifts in frames 5 to 8 (`anim.REAR_HEEL_UP`) as the weight moves forward, ankle raised 2 px, toe planted. Deviation from the plan: the heel stays down at the wind-up peak, because the front foot is in the air there and all the weight is on the rear foot. The planted-feet check now accepts a heel-up foot planted on its toe. All checks and tests pass.
- Signed off: Claude, 2026-09-28

### Step 12. Down-before-up dip (was optional B)
- [ ] Add a one-frame dip before the rise: knees bend, sword dips.
- [ ] Take the frame from the plume hold (frames 8 to 10 become two frames) so the total stays at 12.
- Acceptance: 12 frames or fewer, the loop still closes, effects still read, checks pass.
- Status: IN PROGRESS (Claude, 2026-09-28)
- Result:
- Signed off:

### Step 13. Review and publish follow-ups
- [ ] Review every frame zoomed and at 1x, update `docs/swing_x3.gif`, the README table and the
      manifest.
- Status: TODO
- Result:
- Signed off:

## Open questions
- None.

## Log
- 2026-09-28: Step 11 (heel-up boot) done. Heel is down at the peak on purpose (weight is on the rear foot there). (Claude)
- 2026-09-28: Step 10 (shoulder drive, sleeve squash) done. Values in `anim.SHOULDERS`. (Claude)
- 2026-09-28: Step 9 (head direction) done via eye-block gaze; do not tuck the head at impact, it collides with the near arm. (Claude)
- 2026-09-28: Step 8 (sock cuff, toe direction) done. Boot feet are hand-drawn grids in `rig.LEFT_FOOT`; the right foot is its mirror. (Claude)
- 2026-09-28: User approved optional steps A to D and the sock cuff tidy; added as steps 8 to 13. (Claude)
- 2026-09-27: Step 7 (review and publish) done. Kinetic upgrade workflow complete; optional steps A to D await the user's approval. (Claude)
- 2026-09-27: Step 6 (hair) done. Hair values in `anim.HAIR`; keep sway within 4 px and lift within 3 px (tested range). (Claude)
- 2026-09-27: Step 5 (skirt) done. Cloth values in `anim.CLOTH`. (Claude)
- 2026-09-27: Step 4 (lean) done. Never shear the head row by row; it jogs the face. (Claude)
- 2026-09-27: Step 3 (step into the strike) done. Front foot keyframes in `anim.FEET`; mark a frame `planted=True` only if the ankle row equals the neutral row. (Claude)
- 2026-09-27: Step 2 (hips and knee bend) done. Hip offsets live in `anim.HIPS`; a deeper crouch than 4 px hides the thighs under the skirt, so keep it at or below that. (Claude)
- 2026-09-27: Step 1 (leg rig) done. `rig.draw_leg`, `rig.leg_ik`, `LEG_NEUTRAL`, `LEG_LEN`; frames accept `legs={'left': dict(hip=..., ankle=...)}`. (Claude)
- 2026-09-27: Board created, Step 0 done. (Claude)
