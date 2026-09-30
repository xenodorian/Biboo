"""Pose specifications for the 11-frame overhead chop and the character renderer.

Structure (user request, 2026-09-28):
  1 plow (Pflug guard, held) | 2-3 raise the sword | 4 high guard (held, glint) |
  5 impact: the low point with the motion-blur arc from the high guard, flash, dirt crown and
  camera shake | 6 black-and-white impact frame with speed lines | 7 burst: the first dust cloud
  erupts | 8-9 debris settles while the pose holds | 10-11 pull the blade free and return to plow
  (loops to frame 1).
"""
import numpy as np
from . import rig
from .rig import V, Canvas, Sword, arm, fist, body, finish

S_NEAR = np.array([20.0, 29.5])     # viewer-left shoulder (rear arm, crosses in front)
S_FAR = np.array([35.5, 29.0])      # viewer-right shoulder (lead arm)
# Fixed arm segment lengths (upper arm, forearm). Arms bend at the elbow, never shorten (step 18).
# Step 25: both arms lengthened by about 30% (user approved) so the hands can go over the head.
ARM_LEN = dict(near=(13.0, 14.0), far=(13.0, 14.0))

# Rear (near) hand holds the base of the handle just above the pommel in every frame. H is the
# sword reference point GRIP_SPAN further along the grip (see rig.Sword). The lead (far) hand
# sits HAND_GAP up the handle from the rear hand (step 22: hands close together).
GRIP_SPAN = 17.5
HAND_GAP = 8.0

def two_hand(theta, Hl):
    th = np.radians(theta); d = np.array([np.cos(th), -np.sin(th)])
    Hl = np.array(Hl, float); Hu = Hl + GRIP_SPAN * d
    return Hl, Hu

# Draw orders (step 24). The long hair is always drawn first, behind everything. The lead arm and
# fist are always behind the head, the rear arm and fist in front of it. LOW: sword in front of the body. HIGH: the sword is up and back, so the blade,
# guard and grip pass behind the head while the rear hand stays in front.
LOW = ['hair', 'body', 'far', 'grip', 'lead_fist', 'head', 'near', 'rear_fist', 'guard', 'blade']
HIGH = ['hair', 'body', 'blade', 'guard', 'far', 'grip', 'lead_fist', 'head', 'near', 'rear_fist']
# PLOW: hands low at the hip. The lead arm hangs on the far side, behind the torso and skirt (so the
# elbow never sticks out), in front of the hair; its forearm shows where it leaves the body.
PLOW = ['hair', 'far', 'body', 'grip', 'lead_fist', 'head', 'near', 'rear_fist', 'guard', 'blade']

# Each frame: name, duration, sword angle (degrees, 0 = pointing forward, 90 = up, 180 = back),
# arm sleeves, elbow direction ('down' or 'fwd'), draw order and effect flags. Hand positions are
# in REAR_HAND below; body motion is in the tables that follow.
FRAMES = []
def F(**k):
    k.setdefault('far', dict(sleeve=3.5, rs=2.6)); k.setdefault('near', dict())
    k.setdefault('order', LOW); k.setdefault('head', (0, 0)); k.setdefault('torso', (0, 0))
    FRAMES.append(k)

# 1 PLOW (Pflug): hands low at the hip, elbows bent back by the body, blade angled up so the point
# aims at the opponent's face; knees bent, slight forward lean
F(name='plow', ms=320, theta=27, sway=0, far=dict(sleeve=2.5, rs=2.6), order=PLOW)
# 2-3 RAISE - both hands lift the sword past vertical toward the high guard, weight rocks back
F(name='raise1', ms=90, theta=70, sway=1, elbows='fwd', order=HIGH)
F(name='raise2', ms=80, theta=108, sway=1, elbows='fwd', order=HIGH)
# 4 HIGH GUARD - fists just above and in front of the forehead, elbows bent, blade pointing up
# and back at 45 degrees, torso bent back
F(name='high', ms=250, theta=135, sway=0, elbows='fwd', order=HIGH, glint=True)
# 5 IMPACT - the low point: the near shoulder, straight near arm, grip and blade form one line;
# rear hand by the pommel, lead hand below the guard. Motion blur from the high guard trails the
# blade (fx.blur_strike); flash, dirt and camera shake
F(name='impact', ms=120, theta=-31.7, sway=-1, smear_from='high')
# 6 IMPACT FRAME - anime-style black-and-white frame with speed lines (fx.impact_frame_bw)
F(name='impactbw', ms=60, theta=-31.7, sway=-1, bw=True)
# 7 BURST - same pose; the first dust cloud erupts from the cut
F(name='burst', ms=90, theta=-31.7, sway=1)
# 8-9 hold on the buried blade while the dirt comes down; hair overshoots then settles
F(name='plume', ms=100, theta=-31.7, sway=2)
F(name='settle', ms=120, theta=-31.7, sway=0)
# 10 RETURN 1 - pull the blade free, arms bend again
F(name='return1', ms=110, theta=-14, sway=-1)
# 11 RETURN 2 - ease back into plow (loops to frame 1)
F(name='return2', ms=130, theta=12, sway=1, far=dict(sleeve=2.5, rs=2.6))

# ---------------------------------------------------------------- hips (step 2)
# Hip offset per frame. The skirt sits on the hips, and the torso, head and hands ride
# on top of them; the feet stay planted and the knees bend (IK) to absorb the change.
# torso/head are given relative to the hips (small lean/stretch offsets only).
HIPS = dict(
    # hip: hip offset; torso/head: extra offsets relative to the hips; lean: px the head moves
    # sideways (row shear, step 4); bend: waist bend in degrees, + forward (step 26 / 28).
    # Step 28: deeper bend (further back on the wind-up, further forward on the strike).
    plow=dict(hip=(0, 1), torso=(0, 0), head=(0, 0), lean=0, bend=3),
    raise1=dict(hip=(-1, 1), torso=(0, 0), head=(0, 0), lean=-1, bend=-4),
    raise2=dict(hip=(-1, 0), torso=(0, -1), head=(0, -1), lean=-1, bend=-8),
    high=dict(hip=(-2, 0), torso=(0, -1), head=(0, -1), lean=-2, bend=-10),
    impact=dict(hip=(2, 3), torso=(0, 0), head=(0, 0), lean=2, bend=22),
    impactbw=dict(hip=(2, 3), torso=(0, 0), head=(0, 0), lean=2, bend=22),
    burst=dict(hip=(2, 3), torso=(0, 0), head=(0, 0), lean=2, bend=22),
    plume=dict(hip=(2, 4), torso=(0, 0), head=(0, 0), lean=2, bend=24),
    settle=dict(hip=(2, 3), torso=(0, 0), head=(0, 0), lean=2, bend=22),   # stays down while the blade is buried
    return1=dict(hip=(1, 1), torso=(0, 0), head=(0, 0), lean=1, bend=8),
    return2=dict(hip=(0, 1), torso=(0, 0), head=(0, 0), lean=0, bend=4),
)

def _add(p, d):
    return None if p is None else (p[0] + d[0], p[1] + d[1])

def _rebase(fr, spec):
    """Apply the hip offsets: the skirt sits on the hips, torso and head ride on top of them."""
    hip = spec['hip']
    fr = dict(fr)
    fr['skirt'] = hip; fr['hip'] = hip
    fr['torso'] = (hip[0] + spec['torso'][0], hip[1] + spec['torso'][1])
    fr['head'] = (hip[0] + spec['head'][0], hip[1] + spec['head'][1])
    fr['lean'] = spec.get('lean', 0); fr['bend'] = spec.get('bend', 0)
    fr['legs'] = {n: dict(hip=_add(rig.LEG_NEUTRAL[n]['hip'], hip)) for n in ('left', 'right')}
    return fr

# ---------------------------------------------------------------- footwork (step 3)
# Front (right) foot: planted, lifts and draws back as weight rocks onto the rear leg during the
# raise, stomps down 4 px forward at impact, then steps back during
# the return so the loop closes in plow. The rear foot never moves. 'planted' feet must sit
# exactly on the ground (ankle row unchanged).
R0 = rig.LEG_NEUTRAL['right']['ankle']
FEET = dict(
    plow=dict(right=(R0[0], R0[1]), planted=True),
    raise1=dict(right=(R0[0], R0[1]), planted=True),
    raise2=dict(right=(R0[0] - 0.5, R0[1] - 1.5), planted=False),
    high=dict(right=(R0[0] - 1.0, R0[1] - 3.0), planted=False),
    impact=dict(right=(R0[0] + 4.0, R0[1]), planted=True),
    impactbw=dict(right=(R0[0] + 4.0, R0[1]), planted=True),
    burst=dict(right=(R0[0] + 4.0, R0[1]), planted=True),
    plume=dict(right=(R0[0] + 4.0, R0[1]), planted=True),
    settle=dict(right=(R0[0] + 4.0, R0[1]), planted=True),
    return1=dict(right=(R0[0] + 2.5, R0[1] - 1.5), planted=False),
    return2=dict(right=(R0[0] + 0.5, R0[1]), planted=True),
)

# ---------------------------------------------------------------- cloth (step 5)
# Skirt hem motion per frame: lift (px up at the hem, negative = below rest), trail
# (px sideways at the hem, lagging behind the body), flare (px outward on both sides).
CLOTH = dict(
    plow=dict(lift=0, trail=0, flare=0),
    raise1=dict(lift=1, trail=1, flare=0),
    raise2=dict(lift=1, trail=1, flare=1),
    high=dict(lift=3, trail=0, flare=1),
    impact=dict(lift=1, trail=-1, flare=3),
    impactbw=dict(lift=1, trail=-1, flare=3),
    burst=dict(lift=0, trail=0, flare=2),
    plume=dict(lift=-1, trail=1, flare=1),
    settle=dict(lift=0, trail=0, flare=0),
    return1=dict(lift=1, trail=0, flare=0),
    return2=dict(lift=0, trail=0, flare=0),
)

# ---------------------------------------------------------------- hair (step 6)
# Long-hair follow-through: sway (px sideways at the tips, lagging behind the body) and
# lift (px up at the tips: rises while the body drops, hangs while it rises).
HAIR = dict(
    plow=dict(sway=0, lift=0),
    raise1=dict(sway=1, lift=-1),
    raise2=dict(sway=2, lift=-1),
    high=dict(sway=1, lift=1),
    impact=dict(sway=-2, lift=2),
    impactbw=dict(sway=-2, lift=2),
    burst=dict(sway=1, lift=1),
    plume=dict(sway=3, lift=-1),
    settle=dict(sway=0, lift=0),
    return1=dict(sway=-1, lift=-1),
    return2=dict(sway=1, lift=0),
)

# ---------------------------------------------------------------- head direction (step 9)
# gaze: -1 chin up / eyes up (watching the blade rise), +1 chin tucked / eyes down (driving
# the strike), 0 neutral. (A physical 1 px head tuck was tried and removed: it pushes the chin
# onto the near arm at impact.)
GAZE = dict(plow=0, raise1=0, raise2=-1, high=-1, impact=1, impactbw=1, burst=1, plume=1, settle=0,
            return1=0, return2=0)

# ---------------------------------------------------------------- shoulders (step 10)
# Shoulder drive on top of the torso: the far shoulder lifts into the high guard, the near
# shoulder drives down into the strike. Sleeve puffs stretch at the high guard (longer) and squash
# at impact (shorter and fuller). near/far = (dx, dy) px; *_sleeve = change in sleeve length;
# rs = change in sleeve radius.
SHOULDERS = dict(
    plow=dict(),
    raise1=dict(far=(0, -0.5)),
    raise2=dict(near=(0, -1.0), far=(0, -1.5)),
    high=dict(near=(0, -2.0), far=(0.5, -2.0), far_sleeve=1.0),
    impact=dict(near=(1.0, 1.5), far=(0.5, 1.0), near_sleeve=-1.0, rs=0.4),
    impactbw=dict(near=(1.0, 1.5), far=(0.5, 1.0), near_sleeve=-1.0, rs=0.4),
    burst=dict(near=(1.0, 1.5), far=(0.5, 1.0), near_sleeve=-1.0, rs=0.4),
    plume=dict(near=(1.0, 1.5), far=(0.5, 1.0), near_sleeve=-1.0, rs=0.4),
    settle=dict(near=(1.0, 1.5), far=(0.5, 1.0), near_sleeve=-0.5, rs=0.2),   # still braced on the buried blade
    return1=dict(),
    return2=dict(),
)

# ---------------------------------------------------------------- rear heel (step 11)
# The rear (left) heel lifts while the weight transfers forward (impact) and she pivots
# on the toe. In the high guard the front foot is in the air, so the rear heel stays down.
REAR_HEEL_UP = {'impact', 'impactbw', 'burst', 'plume'}


def index(name):
    return next(i for i, fr in enumerate(FRAMES) if fr['name'] == name)

def by_name(name):
    return FRAMES[index(name)]

FRAMES[:] = [_rebase(fr, HIPS[fr['name']]) for fr in FRAMES]
# ---------------------------------------------------------------- grip (steps 17, 22, 27)
# Rear (near) hand position per frame in final sprite coordinates, solved so both arms stay in
# reach with fixed-length arms. The lead hand is GRIP_GAP (or HAND_GAP) further along the grip.
# While the blade is buried (impact to settle) the grip stays fixed in the world.
REAR_HAND = dict(plow=(37.5, 37.4), raise1=(38.0, 22.0), raise2=(36.0, 13.0), high=(34.5, 7.5),
                 impact=(48.36, 45.69), impactbw=(48.36, 45.69), burst=(48.36, 45.69), plume=(48.36, 45.69),
                 settle=(48.36, 45.69), return1=(43.0, 40.5), return2=(39.0, 38.5))

# Hand gap along the grip where a frame differs from HAND_GAP. High guard: lead hand 12 px up the
# grip so both fists sit clear above the head. Plow and the low point: lead hand below the guard.
GRIP_GAP = dict(plow=14.0, raise1=13.0, raise2=12.0, high=12.0, impact=14.0, impactbw=14.0, burst=14.0,
                plume=14.0, settle=14.0, return1=14.0, return2=14.0)

def apply_grip(fr, Hl):
    Hl, Hu = two_hand(fr['theta'], Hl)                     # Hu = sword reference point
    gap = GRIP_GAP.get(fr['name'], HAND_GAP)
    th = np.radians(fr['theta']); lead = Hl + gap * np.array([np.cos(th), -np.sin(th)])
    fr['Hl'] = tuple(Hl); fr['H'] = tuple(Hu); fr['lead'] = tuple(lead)
    fr['fists'] = [tuple(lead), tuple(Hl)]
    fr['far'] = dict(fr['far'], to=tuple(lead), elbow=None)
    fr['near'] = dict(fr['near'], to=tuple(Hl), elbow=None)

for fr in FRAMES:
    apply_grip(fr, REAR_HAND[fr['name']])

for fr in FRAMES:
    ft = FEET[fr['name']]
    fr['legs']['right']['ankle'] = ft['right']
    fr['front_planted'] = ft['planted']
    fr['cloth'] = CLOTH[fr['name']]
    fr['sway'] = HAIR[fr['name']]['sway']; fr['hair_lift'] = HAIR[fr['name']]['lift']
    fr['gaze'] = GAZE[fr['name']]
    fr['shoulders'] = SHOULDERS[fr['name']]
    if fr['name'] in REAR_HEEL_UP:
        L0 = rig.LEG_NEUTRAL['left']['ankle']
        fr['legs']['left']['ankle'] = (L0[0], L0[1] - rig.HEEL_UP_ANKLE_LIFT)
        fr['legs']['left']['heel_up'] = True

def shoulders(fr):
    """Final shoulder points: they ride the torso through the waist bend and the lean."""
    sd = fr.get('shoulders', {})
    lean, bend, t = fr.get('lean', 0), fr.get('bend', 0), t = fr['torso']
    sn = rig.upper_point(S_NEAR, lean, bend, t) + np.array(sd.get('near', (0, 0)))
    sf = rig.upper_point(S_FAR, lean, bend, t) + np.array(sd.get('far', (0, 0)))
    return sn, sf

def arm_reach(fr):
    """Shoulder-to-hand distance for the near and far arm."""
    sn, sf = shoulders(fr)
    return float(np.linalg.norm(np.array(fr['near']['to']) - sn)), float(np.linalg.norm(np.array(fr['far']['to']) - sf))

def elbow(fr, k, S, H):
    return rig.arm_ik(S, H, *ARM_LEN[k], prefer=fr.get('elbows', 'down'))

def arm_joints(fr):
    """Shoulder, elbow and hand for both arms (two-bone IK)."""
    sn, sf = shoulders(fr)
    out = {}
    for k, S in (('near', sn), ('far', sf)):
        H = np.array(fr[k]['to'], float)
        out[k] = (S, elbow(fr, k, S, H), H)
    return out

arm_lengths = arm_reach        # backward-compatible name

def render_character(i):
    return render_pose(FRAMES[i])

def render_pose(fr):
    """Render one frame description (a FRAMES entry, or a move frame from swingkit.moves)."""
    cv = Canvas()
    sw = Sword(fr['theta'], fr['H'])
    J = arm_joints(fr)
    sd = fr.get('shoulders', {})
    parts = {}
    for op in fr['order']:
        if op == 'hair':
            rig.draw_hair_pass(cv.C, head=fr['head'], skirt=fr['skirt'], sway=fr['sway'], lean=fr.get('lean', 0),
                               bend=fr.get('bend', 0), hair_lift=fr.get('hair_lift', 0))
        elif op == 'body':
            info = body(cv.C, head=fr['head'], torso=fr['torso'], skirt=fr['skirt'], sway=fr['sway'],
                        legs=fr.get('legs'), lean=fr.get('lean', 0), bend=fr.get('bend', 0),
                        cloth=fr.get('cloth'), hair_lift=fr.get('hair_lift', 0), draw_head=False,
                        draw_hair=False, draw_torso='torso' not in fr['order'])
            parts['head_offset'] = info.pop('head')
            parts['legs'] = info
        elif op == 'torso':
            rig.draw_torso_pass(cv.C, fr['torso'], fr.get('lean', 0), fr.get('bend', 0))
        elif op == 'head':
            m0 = cv.C.copy()
            rig.draw_head_pass(cv.C, parts['head_offset'], fr.get('gaze', 0))
            parts['head'] = cv.C != m0
        elif op in ('far', 'near'):
            a = fr[op]; S, E, H = J[op]
            if op == 'far':
                sl, rs = a.get('sleeve', 3.5) + sd.get('far_sleeve', 0), a.get('rs', 2.6) + sd.get('rs', 0)
            else:
                sl, rs = a.get('sleeve', 7.0) + sd.get('near_sleeve', 0), a.get('rs', 2.7) + sd.get('rs', 0)
            parts[op] = arm(cv, S, H, elbow=tuple(E), sleeve=sl, rs=rs)
        elif op == 'grip':
            parts['grip'] = sw.grip(cv)
        elif op == 'lead_fist':
            parts['lead_fist'] = fist(cv, fr['fists'][0])
        elif op == 'rear_fist':
            parts['rear_fist'] = fist(cv, fr['fists'][1])
        elif op == 'guard':
            parts['guard'] = sw.guard(cv)
        elif op == 'blade':
            parts['blade'] = sw.blade(cv)
        elif op == 'lead_hand':                     # free lead hand (not on the grip)
            parts['lead_fist'] = fist(cv, fr['fists'][0])
    if fr.get('clip_row', rig.FEET_ROW) is not None:
        finish(cv.C, fr.get('clip_row', rig.FEET_ROW))
    else:
        finish(cv.C, clip_row=rig.CH)
    return cv.C, sw, parts

def face_box(fr):
    hx, hy = rig.head_offset(fr['head'], fr.get('lean', 0), fr.get('bend', 0))
    return (21 + hx, 12 + hy, 33 + hx, 25 + hy)     # x0,y0,x1,y1 inclusive, sprite space

if __name__ == '__main__':
    for i, fr in enumerate(FRAMES):
        n, f = arm_lengths(fr)
        print(f"{i+1:2d} {fr['name']:9s} theta={fr['theta']:6.1f} near={n:5.1f} far={f:5.1f}")
