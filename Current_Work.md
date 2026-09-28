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
- [ ] Hem lifts and flares during the rise, trails behind during the swing, bounces past rest at
      impact, then settles.
- Acceptance: smooth motion across frames, no holes, and the silhouette outline stays clean.
- Status: TODO
- Result:
- Signed off:

### Step 6. Stronger hair motion
- [ ] Add vertical lag to the existing sideways sway: the hair lifts as the body drops, overshoots
      forward at impact, then falls and settles.
- Acceptance: no seams or doubled outlines at any offset (test the extremes as in the rig stress
  test).
- Status: TODO
- Result:
- Signed off:

### Step 7. Review and publish
- [ ] Render every frame and review each one zoomed in and at 1x. Fix any issues found.
- [ ] Update `docs/swing_x3.gif`, the README frame table, and the manifest notes.
- Acceptance: all checks and tests pass, and the preview GIF on `main` shows the upgraded animation.
- Status: TODO
- Result:
- Signed off:

### Optional steps (need the user's approval before starting)
- [ ] A. Hand-drawn heel-up boot variant, so the rear heel can lift during the swing.
- [ ] B. A one-frame down-before-up dip at the start of the wind-up. This needs a frame taken from
      the plume hold (frames 8 to 10).
- [ ] C. Head direction: chin up at the peak, chin tucked at impact.
- [ ] D. Shoulder drive and sleeve squash.

## Open questions
- Approve optional steps A to D? (asked 2026-09-27)

## Log
- 2026-09-27: Step 4 (lean) done. Never shear the head row by row; it jogs the face. (Claude)
- 2026-09-27: Step 3 (step into the strike) done. Front foot keyframes in `anim.FEET`; mark a frame `planted=True` only if the ankle row equals the neutral row. (Claude)
- 2026-09-27: Step 2 (hips and knee bend) done. Hip offsets live in `anim.HIPS`; a deeper crouch than 4 px hides the thighs under the skirt, so keep it at or below that. (Claude)
- 2026-09-27: Step 1 (leg rig) done. `rig.draw_leg`, `rig.leg_ik`, `LEG_NEUTRAL`, `LEG_LEN`; frames accept `legs={'left': dict(hip=..., ankle=...)}`. (Claude)
- 2026-09-27: Board created, Step 0 done. (Claude)
