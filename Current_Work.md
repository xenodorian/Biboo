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
   overlap only. The only exception is a change the user approves (step 25 lengthened both arms). If a step needs a new check (for example, leg length), add it to
   `swingkit/checks.py` and to `tests/`.
10. Face occlusion (user rule, 2026-09-28): the lead (far) arm and its fist are drawn behind the head;
    the rear (near) arm and its fist may pass in front of the face; the blade and guard never cover
    the face. The occlusion check enforces this.
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
- [x] Add a one-frame dip before the rise: knees bend, sword dips.
- [x] Take the frame from the plume hold (frames 8 to 10 become two frames) so the total stays at 12.
- Acceptance: 12 frames or fewer, the loop still closes, effects still read, checks pass.
- Status: DONE
- Result: New frame 2 'dip' (80 ms): hips drop 2 px, knees bend, blade dips 6 degrees below the ready line, hair and hem lift 1 px. Paid for by removing 'plume2' (plume hold is now plume1 90 ms + settle 120 ms); ready hold shortened to 320 ms, total 1470 ms, still 12 frames. Compositor, effects and shake now look frames up by name (`anim.index`, `anim.by_name`), so inserting or removing frames no longer breaks them. All checks and tests pass.
- Signed off: Claude, 2026-09-28

### Step 13. Review and publish follow-ups
- [x] Review every frame zoomed and at 1x, update `docs/swing_x3.gif`, the README table and the
      manifest.
- Status: DONE
- Result: Reviewed all 12 frames zoomed and at 1x; no blocking issues. `docs/swing_x3.gif` and `docs/char_sheet.png` updated, README frame table rewritten for the new frame list (dip added, plume2 removed), manifest now also records gaze, rear heel and shoulders per frame. All 8 checks and 7 tests pass.
- Signed off: Claude, 2026-09-28

### Step 14. Rear foot and rear knee point forward
- [x] User feedback (2026-09-28): the outward-toe fix from step 8 is not wanted for the back leg.
      Point the back (left) foot and the back knee forward, toward the strike (to the right).
- [x] Rear foot: toe cap on the forward side, heel under the shaft on the back side; heel-up variant
      to match (heel lifts at the back, toe planted in front).
- [x] Rear knee bends forward instead of outward. Front leg unchanged (it already points forward).
- Acceptance: both feet and both knees point toward the strike; leg lengths and planted feet checks
  pass; all checks and tests pass.
- Status: DONE
- Result: Rear foot is now the drawn boot mirrored about its shaft (`rig.REAR_FOOT`): toe cap forward, heel at the back; the heel-up variant is mirrored the same way (heel lifts at the back, toe planted in front). The rear knee's IK bend side is flipped so it bends forward toward the strike (neutral knee moves about 1 px). Front leg unchanged. This supersedes the outward-toe part of step 8 for the back leg. docs preview GIF and sprite sheet refreshed. All checks and tests pass.
- Signed off: Claude, 2026-09-28

### Step 15. Fix the ankles
- [x] User feedback (2026-09-28): the ankles look broken. The foot is a separate stamp under the
      shin, leaving a notch and an outline jog where they meet.
- [x] Draw the foot together with the shin as one outlined boot: heel flares back from the shin's
      rear edge, instep flows forward from its front edge, toe forward, sole on the ground; heel-up
      tilts the sole with the toe planted.
- Acceptance: continuous ankle curve with no notch in every frame; planted and leg-length checks
  pass; all checks and tests pass.
- Status: DONE
- Result: The foot is no longer a separate stamp: `rig._foot_mask` draws it with the shin as one outlined shape (heel flares from the shin's back edge, instep from its front edge, toe forward, sole band on the ground; heel-up tilts the sole with the toe planted). Continuous ankle in every frame. Found and fixed a 1 px float on the planted front boot (each leg now uses its own ankle-to-sole distance), and the planted-feet check now measures drawn pixels instead of ankle rows so this cannot slip through again. The old foot stamps (`LEFT_FOOT` etc.) are removed. docs preview refreshed; all checks and tests pass.
- Signed off: Claude, 2026-09-28

### Step 16. Lead foot toes point forward
- [x] User feedback (2026-09-28): the lead (front, right) foot reads as pointing inward. Its toe
      barely clears the forward-slanted shin and the heel flares behind, so the boot looks folded
      back under the leg.
- [x] Give the lead foot a longer forward toe and a heel flush with the back of the shin so it
      clearly points forward, toward the strike.
- Acceptance: lead toe clearly points forward in every frame; planted and leg checks pass; all checks
  and tests pass.
- Status: DONE
- Result: Per-leg foot shape in `LEG_NEUTRAL` (`toe_reach`, `heel_flare`): the lead foot now reaches 13 px forward from the ankle (was 9) with its heel flush to the back of the shin, so the boot clearly points forward instead of folding back under the forward-slanted shin. Rear foot unchanged. docs preview refreshed; all checks and tests pass.
- Signed off: Claude, 2026-09-28

### Step 17. Rear hand grips the pommel end the whole time
- [x] User request (2026-09-28): the rear (near) arm no longer lets go during the raise or
      re-grips near the guard. It holds the base of the handle, just above the pommel, in every
      frame; the front (far) hand stays near the guard.
- [x] Re-pose the two-handed frames with the new hand spacing, and make the rise and peak
      two-handed. With the pommel in the rear hand the blade cannot lean back over the head at the
      peak (the pommel would be out of reach), so the peak becomes a two-handed near-upright guard
      beside the head.
- Acceptance: rear hand on the pommel end in all 12 frames; arm lengths in range; face clearance
  passes; all checks and tests pass.
- Status: DONE
- Result: The rear (near) hand now holds the base of the handle, 17.5 px down the grip from the front hand and just above the pommel, in all 12 frames (`anim.GRIP_SPAN`, `anim.REAR_HAND`); rise and peak are two-handed. Hand positions were solved per frame so both arms stay in range and nothing covers the face. Consequences: the peak is now a two-handed near-upright guard beside the head (the blade can no longer lean back over the head), and during settle she stays braced low on the buried blade (hips and front shoulder held down) because rising would over-stretch the front arm. New rear-grip check and test. All 9 checks and 8 tests pass.
- Signed off: Claude, 2026-09-28

### Step 18. Arms bend at the elbow (fixed lengths)
- [x] User request (2026-09-28): the rear arm bends down at the elbow instead of shortening.
- [x] The lead (far) arm's upper arm rises only until it is parallel to the ground; beyond that the
      elbow bends to keep lifting the sword.
- [x] Both arms become two-bone IK with fixed upper-arm and forearm lengths. Re-solve the hand
      positions per frame under the new limits (face clearance, rear hand on the pommel end, blade
      buried at impact).
- Acceptance: upper-arm and forearm lengths constant in every frame; rear elbow bends downward;
  lead upper arm never above horizontal; all checks and tests pass.
- Status: DONE
- Result: Both arms are two-bone IK with fixed lengths (`anim.ARM_LEN`: upper 10, forearm 10.8; `rig.arm_ik`, elbow-down solution), so they bend at the elbow instead of shortening. The lead upper arm never rises above horizontal (new check); in the rise and peak it stays level and the forearm bends up. Hand positions re-solved per frame under the new limits (peak hands now at head height, blade 76 degrees). Checks now verify fixed segment lengths and the lead-arm limit; all 10 checks and 9 tests pass.
- Signed off: Claude, 2026-09-28

### Step 19. Knees bend at a natural pivot
- [x] User feedback (2026-09-28): the knee joint is too low; the legs bend just above the boot.
- [x] Move the knee pivot up the leg to a natural height. The shin now shows skin between the knee
      and the sock cuff before the boot starts; the boot top stays where it was.
- Acceptance: bends read at the knee, not at the boot top; leg lengths constant; planted feet and
  all other checks pass.
- Status: DONE
- Result: Knee pivots moved up each thigh (`rig.KNEE_RAISE`: rear 4.5 px, front 4 px) to a natural knee height. The shin now shows bare skin from the knee down to the sock cuff, and the boot top stays where it was, so bends read at the knee instead of just above the boot. Thigh and shin lengths are re-derived once and stay fixed; all 10 checks and 9 tests pass.
- Signed off: Claude, 2026-09-28

### Step 20. Lead arm behind the handle
- [x] User feedback (2026-09-28): the lead arm clips in front of the handle. Draw the lead (far)
      arm behind the grip in every frame; only the fists sit on top of it.
- [x] Add a check that no lead-arm pixel covers the handle.
- Acceptance: no lead-arm pixels over the grip in any frame; all checks and tests pass.
- Status: DONE
- Result: The rise and peak frames drew the handle before the lead arm, so the forearm painted over the grip. Every frame now draws the lead arm first, then the grip, then the fists; the handle reads unbroken from the upper fist to the rear hand. New draw-order check and test; all 11 checks and 10 tests pass.
- Signed off: Claude, 2026-09-28

### Step 21. Ankle bend near the heel
- [x] User feedback (2026-09-28): the ankle bend point is too high; it should bend closer to the
      base of the heel.
- [x] Lower the ankle joint toward the heel (the boot shaft runs lower, the foot becomes a shallower
      wedge). Soles stay on the ground; leg lengths re-derived once and fixed.
- Acceptance: the ankle bend reads just above the heel in every frame; planted feet, leg lengths and
  all other checks pass.
- Status: DONE
- Result: Ankle joints lowered 3.5 px toward the heel (`LEG_NEUTRAL` ankles now 5 and 6 px above the sole instead of 8.5 and 9.5); the boot shaft runs lower and the foot is a shallower wedge, so the ankle bends just above the heel. Soles stay on the ground; shin lengths re-derived once and fixed. All 11 checks and 10 tests pass.
- Signed off: Claude, 2026-09-28

### Step 22. Low-swing grip from reference poses
- [x] User feedback (2026-09-28): on the low swing the lead hand dips well below the rear hand and
      the rear hand pulls up to rotate the sword. User supplied three low-cut reference poses.
- [x] Reference measurements (normalised to shoulder-to-ground height): hands at hip or upper-thigh
      height (0.2 to 0.6 down), hands close together (touching to about 1.5 fist widths), grip at
      27 to 35 degrees below horizontal, rear elbow bent back by the hip, lead arm extended, torso
      leaning over the front knee.
- [x] Keep the rear hand at the base of the handle by the pommel (step 17) and the sword's position
      relative to it; move the lead hand down the grip to one fist's gap (8 px) from the rear hand.
- [x] Re-solve the downswing frames (smearB to recover1) so the rear hand sits at hip level close to
      the body and the lead arm extends; the blade must still bury itself in the ground.
- Acceptance: lead hand drop on the low frames about half of before or less; rear hand at hip level
  on the low frames; all checks and tests pass.
- Status: DONE
- Result: Lead hand moved down to one fist's gap (HAND_GAP=8) above the rear hand; downswing re-solved so both hands finish stacked at hip level. Rear hand y 34-37 -> 39-40, lead hand now only 1.4-4 px below the rear hand (was 4-10), angles smearB -14, impact group -30, recover1 -10; blade still buries ahead of the front foot. All 11 checks and 10 tests pass.
- Signed off: Claude, 2026-09-28

## Workflow: overhead wind-up rework

Goal (user request, 2026-09-28, with three reference animations): more room to swing, a high point
with bent arms raised over the head and the sword pointed backwards, a downswing that straightens
the arms to a full forward extension, and torso lean and bend. The user approved lengthening the
arms by about 30% so the hands can reach over the head, and replaced the face-clearance rule with
the occlusion rule (rule 10). Step 18's "lead upper arm never above horizontal" limit is retired
by this request, because the arms now rise over the head.

### Step 23. Wider sprite canvas
- [x] Enlarge the character canvas so a sword pointed backwards over the head is never clipped.
      The sprite anchor, the feet row and the scene placement stay the same.
- Status: DONE
- Result: Canvas is now 320x224 (PX 104, PY 124); the peak sword reaches x 36 on it, which the old canvas clipped. Anchor, feet row and scene placement unchanged.
- Signed off: Claude, 2026-09-28

### Step 24. Occlusion layers
- [x] Split the head into its own draw pass so the lead arm and fist can go behind it and the rear
      arm and fist in front of it. Replace the face-clearance check with the occlusion check.
- Status: DONE
- Result: Head drawn in its own pass (`rig.draw_head_pass`); draw orders `anim.LOW` and `anim.HIGH`; new occlusion check replaces face clearance and the lead-upper-arm check.
- Signed off: Claude, 2026-09-28

### Step 25. Longer arms
- [x] Lengthen both arms by about 30% (user approved), same for every frame.
- Status: DONE
- Result: `anim.ARM_LEN` is (13.0, 14.0) for both arms, 27 px total (was 20.8).
- Signed off: Claude, 2026-09-28

### Step 26. Torso lean and bend
- [x] Add a per-frame waist bend (upper body pivots at the waist, forward and back) alongside the
      existing lean, with the shoulders, head and arms following it.
- Status: DONE
- Result: `bend` (degrees) in `anim.HIPS`; torso rotated with `rig.rotate_layer`, head and shoulders follow via `rig.head_offset` and `rig.upper_point`.
- Signed off: Claude, 2026-09-28

### Step 27. Overhead wind-up and extended downswing
- [x] Peak: arms raised over the head with bent elbows, sword pointed backwards, torso bent back.
- [x] Downswing: arms straighten to a full forward extension, torso bends forward into the strike.
- [x] Re-solve every frame, verify, refresh the docs GIF and sprite sheet.
- Status: DONE
- Result: Peak: hands over the head with bent elbows, sword pointed back (159 deg), torso bent back 12 deg. Downswing: rear arm at full forward extension in smearB and impact, torso bent forward up to 22 deg. All 10 checks and 9 tests pass.
- Signed off: Claude, 2026-09-28

### Step 28. Hands at pommel and crossguard, straight arms, deeper spine
- [ ] Rear hand near the pommel, lead hand near the crossguard, hands about shoulder width apart.
- [ ] Both arms straight at full extension (downswing through the end of the strike).
- [ ] Deeper waist bend: further back on the windup, further forward when the blade lands.
- [ ] Enlarge the canvas if anything clips. Verify, refresh docs.
- Status: IN PROGRESS (Claude, 2026-09-28)
- Result:
- Signed off:

## Open questions
- Ready is now Plow (blade 27 degrees up, hands at the hip). The dip (blade -6, hands at chest) and recover2 (blade 0) still match the old ready pose, so they jump. Re-pose them to lead into and out of Plow? (asked 2026-09-28)

## Log
- 2026-09-28: User request: the motion-blur arc moved onto the impact frame (smear from the high guard) and the chop frame deleted; 9 frames. (Claude)
- 2026-09-28: User request: all other poses deleted; the animation is now 10 frames: plow, raise1, raise2, high, chop (one smear frame from the high guard), impact (steady, unblurred low point with flash, dirt and shake), plume, settle, return1, return2 (loops to plow). Frame names changed everywhere (anim tables, composite effects and shake); README table and docs previews updated. Step 28 is superseded by this frame list. (Claude)
- 2026-09-28: Skirt rebuilt as two layers (user). `rig.SKIRT_FRONT` ends at the front hem (`rig.FRONT_HEM`, just above where each thigh shows) and is drawn over the legs; `rig.SKIRT_BACK` is the inside of the back skirt, rebuilt across the full width from the visible back columns and drawn behind the legs, so moving legs never open holes. It replaces `UNDERSKIRT`. Mask fixes: the skirt's left flare was inside the left-hair box, and the back skirt's bottom rows 57-59 were dropped as legs. (Claude)
- 2026-09-28: User-approved low point applied to impact, plume1 and settle: near shoulder, straight near arm, grip and blade on one line (theta -31.7, rear hand 48.36, 45.69, lead hand 14 px up the grip); settle now holds impact's bend and shoulder drop so the arms stay in reach. Plow: lead arm drawn behind the skirt too, so the elbow no longer sticks out. (Claude)
- 2026-09-28: Contrast and Plow arm repair (user). Colours re-matched to the base painting and the original pixel art (same 20-colour palette as `data/pal.npy`): long hair is a mid-toned pinkish purple (`rig._HAIR_RGB`), dress is white with dark saturated violet (`rig._DRESS_RGB`); the previous lighter-hair/darker-dress tones are replaced. The torso is its own pass (`rig.draw_torso_pass`); in Plow the lead arm goes behind the torso only, and the grip moved (rear hand 37.5, 37.4) so the lead forearm shows from the far hip up to the fist. (Claude)
- 2026-09-28: User request: the long hair is its own first draw pass ('hair' in every draw order, `rig.draw_hair_pass`) so it sits behind everything, including the lead arm in Plow. User-approved palette change: long hair lighter and dress darker via added palette entries (`rig.HAIR_TONE`, `rig.DRESS_TONE`); the original 20 entries and `data/pal.npy` are unchanged because the eyes and sword gems share those purples. (Claude)
- 2026-09-28: Plow fix (user): lead arm drawn behind the body (`anim.PLOW` draw order), lead hand moved up to just below the guard (`GRIP_GAP['ready']` = 14). (Claude)
- 2026-09-28: User request: ready (idle and first frame) is now Plow from a reference photo: hands low at the hip, elbows bent back, blade 27 degrees up, hips 1 px lower, 3 degree forward bend. (Claude)
- 2026-09-28: User request: peak reworked into a high guard from four reference images (fists just above and in front of the forehead, blade up and back at 45 degrees, lead hand 12 px up the grip via `anim.GRIP_GAP`, peak waist bend -12 to -8 so the fists clear the head). Fixed arm length limits how far above the head the hands can go. Step 28 owner: the peak is already done, so leave it unless the user asks. (Claude)
- 2026-09-28: Steps 23 to 27 done: wide canvas, head draw pass with the occlusion rule, arms +30%, waist bend, overhead wind-up and extended downswing. Hands are solved by the scratchpad-style search in the step notes; keep the buried-blade frames on one shared grip. (Claude)
- 2026-09-28: User approved a ~30% arm lengthening and the new face occlusion rule; steps 23 to 27 added and claimed. (Claude)
- 2026-09-28: Step 22 done: low-swing grip from reference poses. (Claude)
- 2026-09-28: Step 21 (ankle bend near the heel) done. (Claude)
- 2026-09-28: Step 20 (lead arm behind the handle) done. Draw order must keep far < grip < fists (checked). (Claude)
- 2026-09-28: Step 19 (knee pivot) done. Knee height is `rig.KNEE_RAISE`. (Claude)
- 2026-09-28: Step 18 (elbows) done. Arm segment lengths in `anim.ARM_LEN`; hands must stay reachable with the lead elbow at or below shoulder height. (Claude)
- 2026-09-28: Step 17 (rear hand on the pommel end) done. Hand positions live in `anim.REAR_HAND` in final coordinates; keep the buried-blade frames on one shared grip. (Claude)
- 2026-09-28: Step 16 (lead foot toes forward) done. Foot shape per leg lives in `rig.LEG_NEUTRAL`. (Claude)
- 2026-09-28: Step 15 (ankles) done. Feet are drawn with the shin in `rig._foot_mask`; the hand-drawn foot grids are gone. (Claude)
- 2026-09-28: Step 14 done: both feet and both knees now point toward the strike. Do not reintroduce outward toes on the back leg. (Claude)
- 2026-09-28: Step 13 done. All approved follow-ups (steps 8 to 13) are complete; nothing is waiting on approval. (Claude)
- 2026-09-28: Step 12 (dip) done. Frames are referenced by name everywhere now; never use hard-coded frame indices. (Claude)
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
