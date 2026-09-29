"""Basic attacks: A, Right+A, Down+A, Left+A, L, R."""
import numpy as np

from .. import rig
from .base import Move, PLOW, tween, fit
from . import noncombat as nc
from .noncombat import DUCK

P = dict(PLOW)
def pose(**k):
    return {**P, **k}

LOWF = dict(order='LOW', far=dict(sleeve=3.5, rs=2.6))


# A: horizontal slash. Seen from the side the blade sweeps from behind her, across the front of
# the body at hip height and out in front; the smear is a flat crescent (movefx.hsmear).
SLASH_WIND = pose(theta=188, hand=(28.0, 41.0), gap=14, order='HIGH', hip=(-1, 2), bend=-2, lean=-2,
                  hair=(2, 0), cloth=(0, 1, 0), far=dict(sleeve=3.5, rs=2.6))
SLASH_HIT = pose(theta=4, hand=(47.0, 34.0), gap=14, **LOWF, hip=(1, 2), bend=10, lean=2, front=(2, 0),
                 hair=(-3, 1), cloth=(1, -2, 1), gaze=1, shoulders=dict(near=(0.5, 1.0)))
SLASH_FOLLOW = dict(SLASH_HIT, theta=-12, hand=(48.0, 37.0), hair=(-2, 1), cloth=(0, -1, 1))


def slash(id='slash', title='Horizontal slash', inputs='A', energy=None):
    e = [('energy', dict(color=energy))] if energy else []
    col = energy or 'white'
    return Move(id, title, inputs, 'basic' if not energy else 'combo', [
        pose(name='ready', ms=60),
        dict(SLASH_WIND, name='wind', ms=110, fx=list(e)),
        dict(SLASH_HIT, name='slash', ms=60, active=True, shake=(1, 0),
             fx=[('hsmear', dict(center=(30, 40), rx=74, ry=15, a0=190, a1=12, color=col))] + e),
        dict(SLASH_FOLLOW, name='follow', ms=80, active=True,
             fx=[('hsmear', dict(center=(30, 36), rx=74, ry=15, a0=110, a1=0, width=0.25, color=col))] + e),
        tween(SLASH_FOLLOW, P, 0.5, 'recover', 100, order='PLOW', far=dict(sleeve=2.5, rs=2.6)),
        pose(name='plow', ms=120),
    ], notes='medium power; active frames 3-4')


# Right+A: thrust with a lunge. The arms extend first, then the front foot drives forward and the
# front knee bends over the toe; the rear foot is dragged. The character ends 18 px forward.
THRUST_CHAMBER = pose(theta=3, hand=(27.0, 38.0), gap=14, **LOWF, hip=(-1, 2), bend=-4, lean=-1, hair=(1, 0))
THRUST_HIT = pose(theta=2, hand=(51.0, 33.0), gap=14, **LOWF, hip=(3, 4), bend=14, lean=3, gaze=1,
                  hair=(-3, 2), cloth=(1, -2, 1), heel_up=True, shoulders=dict(near=(1.0, 1.0), far=(0.5, 0.5)))


def thrust(id='thrust', title='Lunging thrust', inputs='Right+A', energy=None, extra_fx=()):
    e = [('energy', dict(color=energy))] if energy else []
    return Move(id, title, inputs, 'basic' if not energy else 'combo', [
        dict(THRUST_CHAMBER, name='chamber', ms=90, fx=list(e)),
        dict(THRUST_HIT, name='extend', ms=40, root=(8, 0), front=(4, -2), rear=(-4, 0), front_planted=False,
             fx=[('thrust_lines', dict(n=5))] + e),
        dict(THRUST_HIT, name='lunge', ms=70, root=(18, 0), front=(4, 0), rear=(-3, 0), active=True, shake=(1, 0),
             fx=[('thrust_lines', dict(n=9)), ('dust', dict(foot='front', t=0.2))] + e + list(extra_fx)),
        dict(THRUST_HIT, name='hold', ms=90, root=(18, 0), front=(4, 0), rear=(-3, 0), active=True,
             hair=(-1, 1), fx=[('dust', dict(foot='front', t=1.0))] + e),
        tween(THRUST_HIT, P, 0.5, 'recover', 100, root=(18, 0), front=(2, 0), rear=(-5, -2), heel_up=False,
              order='PLOW', far=dict(sleeve=2.5, rs=2.6)),
        pose(name='plow', ms=120, root=(18, 0)),
    ], notes='long range; lunges 18 px forward; active frames 3-4')


# Down+A: duck with the blade trailing low behind, then rise into an upswing in front.
DUCK_LOW = dict(DUCK, theta=-162, hand=(31.0, 44.0), gap=14, order='HIGH', far=dict(sleeve=3.5, rs=2.6))
UP_HIT = pose(theta=74, hand=(46.0, 22.0), gap=13, **LOWF, elbows='fwd', hip=(0, 0), bend=-4, lean=-1,
              gaze=-1, hair=(0, -2), cloth=(2, 0, 1), shoulders=dict(far=(0, -1.0)))
UP_FOLLOW = pose(theta=102, hand=(41.0, 15.0), gap=12, order='HIGH', elbows='fwd', hip=(-1, 0), bend=-6,
                 lean=-1, gaze=-1, hair=(0, -1), cloth=(1, 0, 1), far=dict(sleeve=3.5, rs=2.6),
                 shoulders=dict(near=(0, -1.0), far=(0, -1.5)))


def down_a():
    return Move('upswing', 'Ducking upswing', 'Down+A', 'basic', [
        tween(P, DUCK_LOW, 0.5, 'dip', 60, order='HIGH', far=dict(sleeve=3.5, rs=2.6), theta=-178, hand=(33.0, 41.0)),
        dict(DUCK_LOW, name='duck', ms=110),
        dict(UP_HIT, name='rise', ms=60, active=True, fx=[('arc', dict(frm='duck', s0=0.35))]),
        dict(UP_FOLLOW, name='follow', ms=90, active=True, fx=[('arc', dict(frm='duck', s0=0.7))]),
        tween(UP_FOLLOW, P, 0.5, 'recover', 110, order='HIGH', far=dict(sleeve=3.5, rs=2.6)),
        pose(name='plow', ms=120),
    ], notes='medium range; active frames 3-4; frames 1-2 are low (duck under high attacks)')


# Left+A: upswing while hopping back to gain distance.
def left_a():
    tuck = dict(front=(-3, -6), rear=(3, -6))
    return Move('backstep_upswing', 'Upswing with a back hop', 'Left+A', 'basic', [
        pose(name='set', ms=70, theta=-16, hand=(42.0, 42.0), gap=14, **LOWF, hip=(0, 3), bend=8, lean=1),
        dict(UP_HIT, name='rise', ms=60, root=(-14, 10), **tuck, active=True, hair=(3, -2), cloth=(-1, 2, 1),
             fx=[('arc', dict(frm='set', s0=0.3)), ('dust', dict(foot='both', t=0.0))]),
        dict(UP_FOLLOW, name='float', ms=90, root=(-28, 13), **tuck, hair=(3, 0), cloth=(2, 2, 1)),
        pose(name='land', ms=90, root=(-36, 0), hip=(0, 5), bend=6, theta=40, hand=(39.0, 36.0), hair=(-1, 2),
             cloth=(-1, 0, 2), fx=[('dust', dict(foot='both', t=0.3))]),
        pose(name='plow', ms=120, root=(-36, 0), fx=[('dust', dict(foot='both', t=1.6))]),
    ], notes='hops 36 px back; active frame 2')


# L: push kick (teep). One cock frame: the kicking knee comes up and the foot draws back while the
# sword goes up into the high guard, out of the kick's way. Then the kicking leg drives out straight
# and she slides forward until the boot passes the point where the blade tip was in the guard, so
# the kick lands on anything the blade would have reached. The support leg straightens under her.
def _straight_leg(name, hip_off, angle, reach=0.998):
    """Ankle offset from neutral for a straight leg: `angle` degrees below horizontal (forward)."""
    v = rig.LEG_NEUTRAL[name]
    hip = np.array(v['hip'], float) + np.array(hip_off, float)
    a = np.radians(angle)
    ankle = hip + sum(rig.LEG_LEN[name]) * reach * np.array([np.cos(a), np.sin(a)])
    return tuple(np.round(ankle - np.array(v['ankle'], float), 2))


def _straight_support(hip_off, reach=0.998):
    """Rear ankle offset that straightens the support leg with the foot still on the ground."""
    v = rig.LEG_NEUTRAL['left']
    hip = np.array(v['hip'], float) + np.array(hip_off, float)
    drop = v['ankle'][1] - hip[1]
    dx = np.sqrt(max((sum(rig.LEG_LEN['left']) * reach) ** 2 - drop ** 2, 0.0))
    return (round(float(hip[0] - dx - v['ankle'][0]), 2), 0.0)


def _guard_tip_x():
    from .base import frame
    fr = frame(dict(P, name='plow', ms=100))
    return float(rig.Sword(fr['theta'], fr['H']).tip[0])


def push_kick(id='push_kick', title='Push kick', inputs='L', heavy=False, energy=None):
    e = [('energy', dict(color=energy, glow=False, n=10))] if energy else []
    col = energy or 'white'
    up = {k: v for k, v in nc.HIGH.items()}                    # sword raised, clear of the kick
    kick_hip = (1, 1)
    front = _straight_leg('right', kick_hip, 6 if heavy else 8)
    rear = _straight_support(kick_hip)
    toe = rig.LEG_NEUTRAL['right']['ankle'][0] + front[0] + rig.LEG_NEUTRAL['right']['toe_reach']
    hip = np.array(rig.LEG_NEUTRAL['right']['hip']) + np.array(up['hip'])
    cock = tuple(np.round(hip + (-4.0, 16.0) - np.array(rig.LEG_NEUTRAL['right']['ankle']), 2))   # foot tucked back under the hip
    slide = int(np.ceil(_guard_tip_x() - toe + 6))           # boot ends past the old blade tip
    kick = fit({**P, **up, **dict(hip=kick_hip, front=front, rear=rear, hair=(-2, 1), cloth=(2, -1, 1), active=True,
                                   hit='foot', name='kick', ms=50 if heavy else 40)})
    specs = [
        fit({**P, **up, **dict(name='cock', ms=100 if heavy else 80, front=cock, hair=(1, 0), cloth=(1, 0, 1),
                               fx=[('aura', dict(color=energy, width=1))] if energy else [])}),
        dict(kick, root=(round(slide * 0.6), 0), shake=(2, 0) if heavy else (1, 0),
             fx=[('kickwave', dict(big=heavy, color=col)), ('dust', dict(foot='rear', t=0.0))] + e),
        dict(kick, name='extend', ms=70 if heavy else 50, root=(slide, 0), hair=(-1, 1),
             fx=[('kickwave', dict(big=heavy, color=col)), ('dust', dict(foot='rear', t=0.2))] + e),
        tween(kick, P, 0.5, 'recoil', 70, root=(slide, 0), front=(-5, -14), rear=(0, 0), hair=(1, 0),
              order='HIGH', far=dict(sleeve=3.5, rs=2.6), fx=[('dust', dict(foot='rear', t=1.0))]),
        pose(name='plant', ms=80, root=(slide, 0), fx=[('dust', dict(foot='front', t=0.3))]),
        pose(name='plow', ms=100, root=(slide, 0)),
    ]
    return Move(id, title, inputs, 'basic' if not (heavy or energy) else 'combo', specs,
                notes=f'pushes the enemy back; slides {slide} px so the boot passes the guard\'s blade tip; '
                      'active frames 2-3 (foot)')


# R: kneel with the sword planted, glow green while + signs float up (recover HP).
KNEEL = pose(theta=-86, hand=(48.0, 34.0), gap=8, **LOWF, hip=(0, 9), bend=12, lean=1, gaze=1,
             hair=(0, 2), cloth=(-1, 0, 2), shoulders=dict(near=(0.5, 1.0), far=(0.5, 1.0)))


def recover():
    loop = [dict(KNEEL, name=f'glow{k + 1}', ms=110, hair=(0, 2 + k % 2),
                 fx=[('aura', dict(color='green', width=1 + (k % 2))), ('plus', dict(phase=k / 3))]) for k in range(3)]
    return Move('recover', 'Kneel and recover HP', 'R (hold)', 'basic', [
        tween(P, KNEEL, 0.5, 'kneel1', 80, order='LOW', far=dict(sleeve=3.5, rs=2.6)),
        dict(KNEEL, name='kneel2', ms=100, shake=(0, 1)),
    ] + loop, loop=True, loop_from=2, input_type='hold', notes='loops frames 3-5 while R is held')


ALL = [slash, thrust, down_a, left_a, push_kick, recover]
