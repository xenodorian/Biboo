"""Basic attacks: A, Right+A, Down+A, Left+A, L, R."""
from .base import Move, PLOW, tween
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


# L: push kick (teep): chamber the knee, drive the hips forward and extend, recoil at once.
def push_kick(id='push_kick', title='Push kick', inputs='L', heavy=False, energy=None):
    e = [('energy', dict(color=energy, glow=False, n=10))] if energy else []
    ext = (11, -25) if heavy else (10, -24)
    specs = [
        pose(name='chamber', ms=90 if heavy else 70, front=(-7, -19), bend=-5, lean=-1, hip=(0, 1), hair=(1, 0),
             cloth=(1, 0, 1)),
        pose(name='kick', ms=50 if heavy else 40, front=ext, hip=(2, 1), bend=-7, lean=-1, active=True, hit='foot',
             hair=(-2, 1), cloth=(2, -1, 1), shake=(2, 0) if heavy else (1, 0),
             fx=[('kickwave', dict(big=heavy, color=energy or 'white'))] + e),
        pose(name='extend', ms=70 if heavy else 50, front=ext, hip=(2, 1), bend=-7, lean=-1, active=True, hit='foot',
             hair=(-1, 1), cloth=(2, -1, 1), fx=[('kickwave', dict(big=heavy, color=energy or 'white'))] if heavy else []),
        pose(name='recoil', ms=60, front=(-5, -14), bend=-4, hair=(1, 0)),
        pose(name='plant', ms=80, front=(0, 0), fx=[('dust', dict(foot='front', t=0.3))]),
        pose(name='plow', ms=100),
    ]
    if energy:
        specs[0]['fx'] = [('aura', dict(color=energy, width=1))]
    return Move(id, title, inputs, 'basic' if not (heavy or energy) else 'combo', specs,
                notes='pushes the enemy back; active frames 2-3 (foot)')


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
