"""Pose specifications for the 12-frame downward swing and the character renderer.

Structure (after SLYNYRD-style attack timing):
  1 ready (held) | 2-3 rise | 4 anticipation peak (held, glint) | 5-6 smear frames |
  7 impact | 8-10 debris/plume while the pose holds | 11-12 recover into the ready pose.
Only the held poses are 'pretty'; the fast part of the swing is carried by smears,
so no awkward half-way poses are ever shown on screen for long.
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

# 1 READY - Plow (Pflug): hands low at the hip, elbows bent back by the body, blade angled up
# so the point aims at the opponent's face; knees bent, slight forward lean
F(name='ready', ms=320, theta=27, sway=0, far=dict(sleeve=2.5, rs=2.6), order=PLOW)
# 2 DIP - down before up: knees bend, blade dips below the ready line (step 12)
F(name='dip', ms=80, theta=-6, sway=0, far=dict(sleeve=2.5, rs=2.6))
# 3 RISE 1 - hands lift the blade past vertical, upper body starts to bend back
F(name='rise1', ms=90, theta=75, sway=1, elbows='fwd', order=HIGH)
# 4 RISE 2 - hands go over the head, blade tipping back
F(name='rise2', ms=80, theta=120, sway=1, elbows='fwd', order=HIGH)
# 5 PEAK - high guard: fists just above and in front of the forehead, elbows bent, blade pointing
# up and back at 45 degrees, torso bent back
F(name='peak', ms=250, theta=135, sway=0, elbows='fwd', order=HIGH, glint=True)
# 6 SMEAR A - arms swing forward over the head and start to straighten
F(name='smearA', ms=50, theta=55, sway=-2, elbows='fwd', order=HIGH, smear_from='peak')
# 7 SMEAR B - arms at full forward extension, upper body bends into the strike
F(name='smearB', ms=40, theta=-4, sway=-3, smear_from='smearA')
# 8 IMPACT - blade buried, deepest bend. Low point (user reference): the near shoulder, straight
# near arm, grip and blade form one line; rear hand by the pommel, lead hand below the guard
F(name='impact', ms=110, theta=-31.7, sway=-1, smear_from='smearB', residual=True)
# 9-10 hold while debris flies; hair overshoots then settles; body eases up
F(name='plume1', ms=90, theta=-31.7, sway=2)
F(name='settle', ms=120, theta=-31.7, sway=0)
# 11 RECOVER 1 - pull the blade free, arms bend again
F(name='recover1', ms=110, theta=-16, sway=-1)
# 12 RECOVER 2 - ease back into the ready pose (loops to frame 1)
F(name='recover2', ms=130, theta=0, sway=1, far=dict(sleeve=2.5, rs=2.6))

# ---------------------------------------------------------------- hips (step 2)
# Hip offset per frame. The skirt sits on the hips, and the torso, head and hands ride
# on top of them; the feet stay planted and the knees bend (IK) to absorb the change.
# torso/head are given relative to the hips (small lean/stretch offsets only).
HIPS = dict(
    # hip: hip offset; torso/head: extra offsets relative to the hips; lean: px the head moves
    # sideways (row shear, step 4); bend: waist bend in degrees, + forward (step 26).
    ready=dict(hip=(0, 1), torso=(0, 0), head=(0, 0), lean=0, bend=3),
    dip=dict(hip=(0, 2), torso=(0, 0), head=(0, 0), lean=1, bend=4),
    rise1=dict(hip=(-1, 1), torso=(0, 0), head=(0, 0), lean=-1, bend=-4),
    rise2=dict(hip=(-1, 0), torso=(0, -1), head=(0, -1), lean=-1, bend=-9),
    peak=dict(hip=(-2, 0), torso=(0, -1), head=(0, -1), lean=-2, bend=-8),
    smearA=dict(hip=(0, 1), torso=(0, 0), head=(0, 0), lean=0, bend=0),
    smearB=dict(hip=(1, 2), torso=(0, 0), head=(0, 0), lean=2, bend=12),
    impact=dict(hip=(2, 3), torso=(0, 0), head=(0, 0), lean=2, bend=20),
    plume1=dict(hip=(2, 4), torso=(0, 0), head=(0, 0), lean=2, bend=22),
    settle=dict(hip=(2, 3), torso=(0, 0), head=(0, 0), lean=2, bend=20),   # stays down while the blade is buried
    recover1=dict(hip=(1, 1), torso=(0, 0), head=(0, 0), lean=1, bend=8),
    recover2=dict(hip=(0, 1), torso=(0, 0), head=(0, 0), lean=0, bend=2),
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
# Front (right) foot: planted, lifts and draws back as weight rocks onto the rear leg,
# travels forward during the swing, stomps down 4 px forward at impact, then steps back
# during the recovery so the loop returns to the ready stance. The rear foot never moves.
# 'planted' feet must sit exactly on the ground (ankle row unchanged).
R0 = rig.LEG_NEUTRAL['right']['ankle']
FEET = dict(
    ready=dict(right=(R0[0], R0[1]), planted=True),
    dip=dict(right=(R0[0], R0[1]), planted=True),
    rise1=dict(right=(R0[0], R0[1]), planted=True),
    rise2=dict(right=(R0[0] - 0.5, R0[1] - 1.5), planted=False),
    peak=dict(right=(R0[0] - 1.0, R0[1] - 3.0), planted=False),
    smearA=dict(right=(R0[0] + 1.0, R0[1] - 2.0), planted=False),
    smearB=dict(right=(R0[0] + 3.0, R0[1] - 1.0), planted=False),
    impact=dict(right=(R0[0] + 4.0, R0[1]), planted=True),
    plume1=dict(right=(R0[0] + 4.0, R0[1]), planted=True),
    plume2=dict(right=(R0[0] + 4.0, R0[1]), planted=True),
    settle=dict(right=(R0[0] + 4.0, R0[1]), planted=True),
    recover1=dict(right=(R0[0] + 2.5, R0[1] - 1.5), planted=False),
    recover2=dict(right=(R0[0] + 0.5, R0[1]), planted=True),
)

# ---------------------------------------------------------------- cloth (step 5)
# Skirt hem motion per frame: lift (px up at the hem, negative = below rest), trail
# (px sideways at the hem, lagging behind the body), flare (px outward on both sides).
CLOTH = dict(
    ready=dict(lift=0, trail=0, flare=0),
    dip=dict(lift=1, trail=0, flare=0),
    rise1=dict(lift=1, trail=1, flare=0),
    rise2=dict(lift=1, trail=1, flare=1),
    peak=dict(lift=3, trail=0, flare=1),
    smearA=dict(lift=1, trail=-1, flare=1),
    smearB=dict(lift=3, trail=-2, flare=1),
    impact=dict(lift=1, trail=-1, flare=3),
    plume1=dict(lift=-1, trail=1, flare=1),
    plume2=dict(lift=0, trail=1, flare=0),
    settle=dict(lift=0, trail=0, flare=0),
    recover1=dict(lift=1, trail=0, flare=0),
    recover2=dict(lift=0, trail=0, flare=0),
)

# ---------------------------------------------------------------- hair (step 6)
# Long-hair follow-through: sway (px sideways at the tips, lagging behind the body) and
# lift (px up at the tips: rises while the body drops, hangs while it rises).
HAIR = dict(
    ready=dict(sway=0, lift=0),
    dip=dict(sway=0, lift=1),
    rise1=dict(sway=1, lift=-1),
    rise2=dict(sway=2, lift=-1),
    peak=dict(sway=1, lift=1),
    smearA=dict(sway=-2, lift=1),
    smearB=dict(sway=-4, lift=3),
    impact=dict(sway=-2, lift=2),
    plume1=dict(sway=3, lift=-1),
    plume2=dict(sway=2, lift=0),
    settle=dict(sway=0, lift=0),
    recover1=dict(sway=-1, lift=-1),
    recover2=dict(sway=1, lift=0),
)

# ---------------------------------------------------------------- head direction (step 9)
# gaze: -1 chin up / eyes up (watching the blade rise), +1 chin tucked / eyes down (driving
# the strike), 0 neutral. (A physical 1 px head tuck was tried and removed: it pushes the chin
# onto the near arm at impact and fails face clearance.)
GAZE = dict(ready=0, dip=0, rise1=0, rise2=-1, peak=-1, smearA=0, smearB=1, impact=1,
            plume1=1, plume2=1, settle=0, recover1=0, recover2=0)

# ---------------------------------------------------------------- shoulders (step 10)
# Shoulder drive on top of the torso: the far shoulder lifts into the peak, the near shoulder
# drives down into the strike. Sleeve puffs stretch at the peak (longer) and squash at impact
# (shorter and fuller). near/far = (dx, dy) px; *_sleeve = change in sleeve length; rs = change
# in sleeve radius.
SHOULDERS = dict(
    ready=dict(),
    dip=dict(near=(0, 0.5), far=(0, 0.5)),
    rise1=dict(far=(0, -0.5)),
    rise2=dict(near=(0, -1.0), far=(0, -1.5)),
    peak=dict(near=(0, -2.0), far=(0.5, -2.0), far_sleeve=1.0),
    smearA=dict(far=(0, -0.5)),
    smearB=dict(near=(0.5, 1.0), far=(0.5, 0.5), near_sleeve=-0.5),
    impact=dict(near=(1.0, 1.5), far=(0.5, 1.0), near_sleeve=-1.0, rs=0.4),
    plume1=dict(near=(1.0, 1.5), far=(0.5, 1.0), near_sleeve=-1.0, rs=0.4),
    plume2=dict(near=(0.5, 1.0), far=(0.5, 0.5), near_sleeve=-0.5, rs=0.2),
    settle=dict(near=(1.0, 1.5), far=(0.5, 1.0), near_sleeve=-0.5, rs=0.2),   # still braced on the buried blade
    recover1=dict(),
    recover2=dict(),
)

# ---------------------------------------------------------------- rear heel (step 11)
# The rear (left) heel lifts while the weight transfers forward (swing and impact) and she
# pivots on the toe. At the wind-up peak the front foot is in the air, so all the weight is on
# the rear foot and its heel stays down.
REAR_HEEL_UP = {'smearA', 'smearB', 'impact', 'plume1'}


def index(name):
    return next(i for i, fr in enumerate(FRAMES) if fr['name'] == name)

def by_name(name):
    return FRAMES[index(name)]

FRAMES[:] = [_rebase(fr, HIPS[fr['name']]) for fr in FRAMES]
# ---------------------------------------------------------------- grip (steps 17, 22, 27)
# Rear (near) hand position per frame in final sprite coordinates, solved so both arms stay in
# reach with fixed-length arms. The lead hand is always HAND_GAP further along the grip. While the
# blade is buried (impact, plume1, settle) the grip stays fixed in the world as the body moves.
REAR_HAND = dict(ready=(37.5, 37.4), dip=(36.6, 33.0), rise1=(38.0, 17.1), rise2=(31.7, 9.3),
                 peak=(34.5, 7.5), smearA=(36.5, 10.0), smearB=(49.5, 30.9),
                 impact=(48.36, 45.69), plume1=(48.36, 45.69), settle=(48.36, 45.69),
                 recover1=(42.9, 38.4), recover2=(36.6, 32.2))

# Hand gap along the grip where a frame differs from HAND_GAP. Peak (high guard): lead hand 12 px
# up the grip so both fists sit clear above the head. Ready (Plow): lead hand just below the guard.
GRIP_GAP = dict(peak=12.0, ready=14.0, impact=14.0, plume1=14.0, settle=14.0)

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
    lean, bend, t = fr.get('lean', 0), fr.get('bend', 0), fr['torso']
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
    fr = FRAMES[i]
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
    finish(cv.C)
    return cv.C, sw, parts

def face_box(fr):
    hx, hy = rig.head_offset(fr['head'], fr.get('lean', 0), fr.get('bend', 0))
    return (21 + hx, 12 + hy, 33 + hx, 25 + hy)     # x0,y0,x1,y1 inclusive, sprite space

if __name__ == '__main__':
    for i, fr in enumerate(FRAMES):
        n, f = arm_lengths(fr)
        print(f"{i+1:2d} {fr['name']:9s} theta={fr['theta']:6.1f} near={n:5.1f} far={f:5.1f}")
