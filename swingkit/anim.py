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

S_NEAR = np.array([20.0, 29.5])     # viewer-left shoulder (arm crosses in front)
S_FAR = np.array([35.5, 29.0])      # viewer-right shoulder

def two_hand(theta, Hl):
    th = np.radians(theta); d = np.array([np.cos(th), -np.sin(th)])
    Hl = np.array(Hl, float); Hu = Hl + 5 * d
    return Hl, Hu

# Each frame: sword angle, hand(s), body offsets, hair sway, arm routing, draw order
FRAMES = []
def F(**k): FRAMES.append(k)

# 1 READY - the original design pose, both hands, blade forward
Hl, Hu = two_hand(4.9, (35.8, 30.5))
F(name='ready', ms=360, theta=4.9, H=Hu, Hl=Hl, head=(0, 0), torso=(0, 0), skirt=(0, 0), sway=0,
  far=dict(to=Hu, sleeve=2.5, rs=2.6), near=dict(to=Hl), fists=[Hu, Hl],
  order=['body', 'far', 'grip', 'near', 'fists', 'guard', 'blade'])
# 2 RISE 1 - both hands lift the blade up and forward, body leans back
Hl, Hu = two_hand(40, (39.5, 27.5))
F(name='rise1', ms=90, theta=40, H=Hu, Hl=Hl, head=(-1, 0), torso=(-1, 0), skirt=(0, 0), sway=1,
  far=dict(to=Hu, sleeve=3.5, rs=2.6), near=dict(to=Hl), fists=[Hu, Hl],
  order=['body', 'far', 'grip', 'near', 'fists', 'guard', 'blade'])
# 3 RISE 2 - near hand lets go to a guard fist at the waist, far hand carries the sword up
F(name='rise2', ms=80, theta=78, H=(42.5, 16.5), Hl=None, head=(-2, -1), torso=(-1, -1), skirt=(0, 0), sway=1,
  far=dict(to=(42.5, 16.5), elbow=(40.5, 23.5), sleeve=3.5, rs=2.6),
  near=dict(to=(28.0, 33.0), elbow=(16.5, 35.5)), fists=[(42.5, 16.5), (28.0, 33.0)],
  order=['body', 'grip', 'far', 'near', 'fists', 'guard', 'blade'])
# 4 PEAK - one-handed high guard at ear height, blade leaning back OVER the head
F(name='peak', ms=250, theta=108, H=(43.5, 11.0), Hl=None, head=(-2, -1), torso=(-1, -1), skirt=(0, 0), sway=0,
  far=dict(to=(43.5, 11.0), elbow=(42.0, 21.0), sleeve=3.5, rs=2.6),
  near=dict(to=(28.0, 33.0), elbow=(16.5, 35.5)), fists=[(43.5, 11.0), (28.0, 33.0)],
  order=['body', 'grip', 'far', 'near', 'fists', 'guard', 'blade'], glint=True)
# 5 SMEAR A - both hands rejoin on the grip, blade sweeping over the top
Hl, Hu = two_hand(38, (40.5, 27.5))
F(name='smearA', ms=50, theta=38, H=Hu, Hl=Hl, head=(0, 0), torso=(0, 0), skirt=(0, 0), sway=-2,
  far=dict(to=Hu, sleeve=3.5, rs=2.6), near=dict(to=Hl), fists=[Hu, Hl],
  order=['body', 'far', 'grip', 'near', 'fists', 'guard', 'blade'], smear_from=3)
# 6 SMEAR B - body drops into the strike
Hl, Hu = two_hand(-18, (40.0, 34.5))
F(name='smearB', ms=40, theta=-18, H=Hu, Hl=Hl, head=(2, 1), torso=(1, 1), skirt=(0, 1), sway=-3,
  far=dict(to=Hu, sleeve=3.5, rs=2.6), near=dict(to=Hl), fists=[Hu, Hl],
  order=['body', 'far', 'grip', 'near', 'fists', 'guard', 'blade'], smear_from=4)
# 7 IMPACT - blade buried, deepest crouch
Hl, Hu = two_hand(-34, (38.0, 40.0))
IMPACT = dict(theta=-34, H=Hu, Hl=Hl, far=dict(to=Hu, sleeve=3.5, rs=2.6), near=dict(to=Hl), fists=[Hu, Hl],
              order=['body', 'far', 'grip', 'near', 'fists', 'guard', 'blade'])
F(name='impact', ms=110, head=(2, 2), torso=(1, 2), skirt=(0, 1), sway=-1, smear_from=5, residual=True, **IMPACT)
# 8-10 hold while debris flies; hair overshoots then settles; body eases up
F(name='plume1', ms=80, head=(2, 2), torso=(1, 2), skirt=(0, 1), sway=2, **IMPACT)
F(name='plume2', ms=80, head=(2, 2), torso=(1, 2), skirt=(0, 1), sway=1, **IMPACT)
F(name='settle', ms=100, head=(1, 1), torso=(1, 1), skirt=(0, 1), sway=0, **IMPACT)
# 11 RECOVER 1 - pull the blade free
Hl, Hu = two_hand(-14, (37.5, 34.5))
F(name='recover1', ms=110, theta=-14, H=Hu, Hl=Hl, head=(1, 1), torso=(0, 1), skirt=(0, 0), sway=-1,
  far=dict(to=Hu, sleeve=3.5, rs=2.6), near=dict(to=Hl), fists=[Hu, Hl],
  order=['body', 'far', 'grip', 'near', 'fists', 'guard', 'blade'])
# 12 RECOVER 2 - ease back into the ready pose (loops to frame 1)
Hl, Hu = two_hand(0, (36.5, 31.0))
F(name='recover2', ms=130, theta=0, H=Hu, Hl=Hl, head=(0, 0), torso=(0, 0), skirt=(0, 0), sway=1,
  far=dict(to=Hu, sleeve=2.5, rs=2.6), near=dict(to=Hl), fists=[Hu, Hl],
  order=['body', 'far', 'grip', 'near', 'fists', 'guard', 'blade'])

# ---------------------------------------------------------------- hips (step 2)
# Hip offset per frame. The skirt sits on the hips, and the torso, head and hands ride
# on top of them; the feet stay planted and the knees bend (IK) to absorb the change.
# torso/head are given relative to the hips (small lean/stretch offsets only).
HIPS = dict(
    ready=dict(hip=(0, 0), torso=(0, 0), head=(0, 0)),
    rise1=dict(hip=(-1, 1), torso=(0, 0), head=(0, 0)),
    rise2=dict(hip=(-1, 1), torso=(0, -1), head=(-1, -1)),
    peak=dict(hip=(-1, 1), torso=(0, -1), head=(-1, -1)),
    smearA=dict(hip=(0, 1), torso=(0, 0), head=(0, 0)),
    smearB=dict(hip=(1, 2), torso=(0, 0), head=(1, 0)),
    impact=dict(hip=(2, 3), torso=(0, 0), head=(0, 0)),
    plume1=dict(hip=(2, 4), torso=(0, 0), head=(0, 0)),
    plume2=dict(hip=(2, 3), torso=(0, 0), head=(0, 0)),
    settle=dict(hip=(2, 2), torso=(0, 0), head=(0, 0)),
    recover1=dict(hip=(1, 1), torso=(0, 0), head=(0, 0)),
    recover2=dict(hip=(0, 1), torso=(0, 0), head=(0, 0)),
)

def _add(p, d):
    return None if p is None else (p[0] + d[0], p[1] + d[1])

def _rebase(fr, spec):
    """Apply the hip offsets. Hand positions were authored against the old torso offset,
    so every hand-related point moves by (new torso - old torso)."""
    hip = spec['hip']
    new_torso = (hip[0] + spec['torso'][0], hip[1] + spec['torso'][1])
    new_head = (hip[0] + spec['head'][0], hip[1] + spec['head'][1])
    d = (new_torso[0] - fr['torso'][0], new_torso[1] - fr['torso'][1])
    fr = dict(fr)
    fr['H'] = _add(fr['H'], d); fr['Hl'] = _add(fr['Hl'], d)
    fr['fists'] = [_add(c, d) for c in fr['fists']]
    for k in ('far', 'near'):
        a = dict(fr[k]); a['to'] = _add(a['to'], d)
        if a.get('elbow') is not None: a['elbow'] = _add(a['elbow'], d)
        fr[k] = a
    fr['skirt'] = hip; fr['torso'] = new_torso; fr['head'] = new_head; fr['hip'] = hip
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

FRAMES[:] = [_rebase(fr, HIPS[fr['name']]) for fr in FRAMES]
for fr in FRAMES:
    ft = FEET[fr['name']]
    fr['legs']['right']['ankle'] = ft['right']
    fr['front_planted'] = ft['planted']

def shoulders(fr):
    t = np.array(fr['torso'], float)
    return S_NEAR + t, S_FAR + t

def arm_lengths(fr):
    sn, sf = shoulders(fr)
    def plen(S, spec):
        pts = [S] + ([np.array(spec['elbow'])] if spec.get('elbow') is not None else []) + [np.array(spec['to'])]
        return sum(np.linalg.norm(b - a) for a, b in zip(pts[:-1], pts[1:]))
    return plen(sn, fr['near']), plen(sf, fr['far'])

def render_character(i):
    fr = FRAMES[i]
    cv = Canvas()
    sw = Sword(fr['theta'], fr['H'])
    sn, sf = shoulders(fr)
    parts = {}
    for op in fr['order']:
        if op == 'body':
            parts['legs'] = body(cv.C, head=fr['head'], torso=fr['torso'], skirt=fr['skirt'], sway=fr['sway'],
                                 legs=fr.get('legs'))
        elif op == 'far':
            a = fr['far']
            parts['far'] = arm(cv, sf, a['to'], elbow=a.get('elbow'), sleeve=a.get('sleeve', 3.5), rs=a.get('rs', 2.6))
        elif op == 'near':
            a = fr['near']
            parts['near'] = arm(cv, sn, a['to'], elbow=a.get('elbow'), sleeve=a.get('sleeve', 7.0), rs=a.get('rs', 2.7))
        elif op == 'grip':
            parts['grip'] = sw.grip(cv)
        elif op == 'fists':
            for c in fr['fists']:
                fist(cv, c)
        elif op == 'guard':
            parts['guard'] = sw.guard(cv)
        elif op == 'blade':
            parts['blade'] = sw.blade(cv)
    finish(cv.C)
    return cv.C, sw, parts

def face_box(fr):
    hx, hy = fr['head']
    return (21 + hx, 12 + hy, 33 + hx, 25 + hy)     # x0,y0,x1,y1 inclusive, sprite space

if __name__ == '__main__':
    for i, fr in enumerate(FRAMES):
        n, f = arm_lengths(fr)
        print(f"{i+1:2d} {fr['name']:9s} theta={fr['theta']:6.1f} near={n:5.1f} far={f:5.1f}")
