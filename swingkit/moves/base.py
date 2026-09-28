"""Pose builder for the move library.

A move is a list of frame specs (plain dicts). `frame()` turns a spec into the frame description
the renderer (`anim.render_pose`) draws, with the same rig rules as the heavy attack: fixed arm and
leg lengths, rear hand on the pommel end, lead hand GAP up the grip (or free), hair behind
everything, lead arm behind the head. Specs only hold what differs from the plow guard.

Spec keys (all optional except name, ms, theta, hand):
  theta        sword angle, degrees (0 forward, 90 up, 180 back, negative down)
  hand         rear (near) hand position, sprite px; the grip runs from it along theta
  gap          lead hand distance up the grip from the rear hand (px)
  lead         (x, y): lead hand off the grip at this point (one-handed poses)
  elbows       'down' or 'fwd'; order: 'LOW', 'HIGH', 'PLOW' or a list of draw ops
  hip          hip offset (dx, dy); lean px; bend degrees (+ forward)
  front, rear  ankle offsets of the front (right) and rear (left) foot from the neutral stance
  heel_up      rear heel raised (toe planted)
  cloth        (lift, trail, flare); hair (sway, lift); gaze -1/0/1; shoulders dict
  root         (x, y) character position in the world, px; y up is positive (jumps)
  fx           list of (effect name, kwargs) drawn by swingkit.movefx
  active       True on frames where the blade (or foot) can hit
  hit          'blade' (default for active frames) or 'foot'
"""
import numpy as np
from .. import anim, rig

ORDERS = dict(LOW=anim.LOW, HIGH=anim.HIGH, PLOW=anim.PLOW)
L0 = np.array(rig.LEG_NEUTRAL['left']['ankle']); R0 = np.array(rig.LEG_NEUTRAL['right']['ankle'])

PLOW = dict(theta=27, hand=(37.5, 37.4), gap=14, order='PLOW', hip=(0, 1), lean=0, bend=3,
            far=dict(sleeve=2.5, rs=2.6))

NUMERIC = ('theta', 'gap', 'lean', 'bend', 'gaze')
PAIRS = ('hand', 'lead', 'hip', 'torso', 'head', 'front', 'rear', 'root', 'hair')


def frame(spec):
    s = dict(spec)
    name, ms, theta = s['name'], s['ms'], float(s['theta'])
    order = s.get('order', 'LOW'); order = list(ORDERS[order]) if isinstance(order, str) else list(order)
    ri = lambda v: tuple(int(round(float(x))) for x in v)       # layer offsets are whole pixels
    hip = ri(s.get('hip', (0, 1)))
    fr = dict(name=name, ms=ms, theta=theta, sway=s.get('hair', (0, 0))[0],
              far={**dict(sleeve=3.5, rs=2.6), **s.get('far', {})}, near=dict(s.get('near', {})),
              order=order, elbows=s.get('elbows', 'down'))
    fr = anim._rebase(fr, dict(hip=hip, torso=ri(s.get('torso', (0, 0))), head=ri(s.get('head', (0, 0))),
                               lean=s.get('lean', 0), bend=s.get('bend', 0)))
    # grip: rear hand on the pommel end, lead hand gap up the grip unless it is free
    th = np.radians(theta); d = np.array([np.cos(th), -np.sin(th)])
    Hl = np.array(s['hand'], float); Hu = Hl + anim.GRIP_SPAN * d
    lead = np.array(s['lead'], float) if s.get('lead') is not None else Hl + s.get('gap', anim.HAND_GAP) * d
    fr.update(Hl=tuple(Hl), H=tuple(Hu), lead=tuple(lead), fists=[tuple(lead), tuple(Hl)])
    fr['far'] = dict(fr['far'], to=tuple(lead), elbow=None)
    fr['near'] = dict(fr['near'], to=tuple(Hl), elbow=None)
    if s.get('lead') is not None:                       # a free lead hand is not drawn on the grip
        fr['order'] = [('lead_hand' if op == 'lead_fist' else op) for op in fr['order']]
        fr['free_lead'] = True
    # legs and feet
    root = tuple(s.get('root', (0, 0)))
    fo, ro = np.array(s.get('front', (0, 0)), float), np.array(s.get('rear', (0, 0)), float)
    fr['legs']['right']['ankle'] = tuple(R0 + fo)
    fr['legs']['left']['ankle'] = tuple(L0 + ro)
    if s.get('heel_up'):
        fr['legs']['left']['ankle'] = (L0[0] + ro[0], L0[1] + ro[1] - rig.HEEL_UP_ANKLE_LIFT)
        fr['legs']['left']['heel_up'] = True
    airborne = root[1] > 0
    fr['front_planted'] = s.get('front_planted', (not airborne) and abs(fo[1]) < 1e-6)
    fr['rear_planted'] = s.get('rear_planted', (not airborne) and abs(ro[1]) < 1e-6)
    cl = s.get('cloth', (0, 0, 0)); fr['cloth'] = dict(lift=cl[0], trail=cl[1], flare=cl[2])
    hr = s.get('hair', (0, 0)); fr['sway'] = int(round(hr[0])); fr['hair_lift'] = int(round(hr[1]))
    fr['gaze'] = s.get('gaze', 0); fr['shoulders'] = dict(s.get('shoulders', {}))
    fr['root'] = root
    # the ground cuts the blade only when the character stands on it
    fr['clip_row'] = int(rig.FEET_ROW + round(root[1])) if root[1] < rig.CH - rig.PY - rig.FEET_ROW else None
    for k in ('fx', 'active', 'hit', 'bw', 'flip', 'ghosts', 'shake', 'cam'):
        if k in s: fr[k] = s[k]
    fr['spec'] = s
    return fr


def tween(a, b, t, name, ms, **over):
    """In-between spec: numbers and pairs interpolate, everything else comes from the nearer key."""
    out = dict(a if t < 0.5 else b)
    out.pop('fx', None); out.pop('active', None)
    for k in NUMERIC:
        if k in a or k in b:
            va, vb = a.get(k, PLOW.get(k, 0)), b.get(k, PLOW.get(k, 0))
            if va is not None and vb is not None: out[k] = va + (vb - va) * t
    for k in PAIRS:
        if k in a or k in b:
            va = a.get(k, PLOW.get(k, (0, 0))); vb = b.get(k, PLOW.get(k, (0, 0)))
            if va is None or vb is None: out[k] = va if t < 0.5 else vb; continue
            out[k] = tuple(np.array(va, float) + (np.array(vb, float) - np.array(va, float)) * t)
    if 'cloth' in a or 'cloth' in b:
        out['cloth'] = tuple(np.array(a.get('cloth', (0, 0, 0)), float) * (1 - t) + np.array(b.get('cloth', (0, 0, 0)), float) * t)
    out.update(name=name, ms=ms, **over)
    return out


def reach_ok(fr, slack=0.05):
    """Both hands within fixed arm length of their shoulders."""
    for k, (S, E, H) in anim.arm_joints(fr).items():
        if np.linalg.norm(H - S) > sum(anim.ARM_LEN[k]) - slack:
            return False
    return True


def fit(spec, toward=None, step=0.25, limit=80):
    """Move the rear hand (and so the grip) toward the shoulders until both hands are in reach.
    Returns the fixed spec. Keeps the sword angle and the lead gap."""
    s = dict(spec)
    for _ in range(limit):
        fr = frame(s)
        if reach_ok(fr): return s
        sn, sf = anim.shoulders(fr)
        tgt = np.array(toward, float) if toward is not None else (sn + sf) / 2 + np.array([4.0, 6.0])
        h = np.array(s['hand'], float); v = tgt - h; n = np.linalg.norm(v)
        if n < 1e-6: break
        s['hand'] = tuple(h + v / n * step)
        if s.get('lead') is not None:
            l = np.array(s['lead'], float); w = (sf + np.array([3.0, 6.0])) - l
            if np.linalg.norm(l - sf) > sum(anim.ARM_LEN['far']) - 0.1:
                s['lead'] = tuple(l + w / max(np.linalg.norm(w), 1e-6) * step)
    return s


class Move:
    def __init__(self, id, title, inputs, kind, specs, loop=False, camera='fixed', notes='',
                 loop_from=0, input_type='press', preview_cycles=1):
        self.id, self.title, self.inputs, self.kind = id, title, inputs, kind
        self.loop, self.camera, self.notes, self.loop_from = loop, camera, notes, loop_from
        self.input_type, self.preview_cycles = input_type, preview_cycles
        self.specs = [fit(s) for s in specs]
        self.frames = [frame(s) for s in self.specs]

    def index(self, name):
        return next(i for i, f in enumerate(self.frames) if f['name'] == name)
