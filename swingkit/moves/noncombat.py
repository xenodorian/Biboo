"""Non-combat moves: idle, walk, duck, jump, dash, block, parry, charge."""
from .base import Move, PLOW, tween

P = dict(PLOW)
def pose(**k):
    return {**P, **k}

# the high guard from the heavy attack (up + A), reused by charge
HIGH = dict(theta=135, hand=(34.5, 7.5), gap=12, order='HIGH', elbows='fwd', hip=(-2, 0), torso=(0, -1),
            head=(0, -1), lean=-2, bend=-8, gaze=-1, far=dict(sleeve=3.5, rs=2.6),
            shoulders=dict(near=(0, -2.0), far=(0.5, -2.0), far_sleeve=1.0))
RAISE1 = dict(theta=70, hand=(38.0, 22.0), gap=13, order='HIGH', elbows='fwd', hip=(-1, 1), lean=-1, bend=-3,
              far=dict(sleeve=3.5, rs=2.6), shoulders=dict(far=(0, -0.5)))
RAISE2 = dict(theta=108, hand=(36.0, 13.0), gap=12, order='HIGH', elbows='fwd', hip=(-1, 0), torso=(0, -1),
              head=(0, -1), lean=-1, bend=-6, gaze=-1, far=dict(sleeve=3.5, rs=2.6),
              shoulders=dict(near=(0, -1.0), far=(0, -1.5)))


def idle():
    down = dict(torso=(0, 1), head=(0, 1), hand=(37.5, 38.4))
    return Move('idle', 'Idle (plow guard)', 'none', 'non-combat', [
        pose(name='idle1', ms=360),
        pose(name='idle2', ms=240, **down, hair=(-1, 0)),
        pose(name='idle3', ms=300, **down, hair=(-1, 1), theta=26),
        pose(name='idle4', ms=240, hair=(1, 0)),
    ], loop=True, input_type='none', notes='breathing loop in the plow guard')


def _walk(id, title, inputs, rows):
    specs = []
    for k, (root, front, rear, hip) in enumerate(rows):
        specs.append(pose(name=f'{id}{k + 1}', ms=110, root=(root, 0), front=front, rear=rear, hip=(0, hip),
                          hair=(-1 if root > 0 else 1, 0), cloth=(0, -1 if root > 0 else 1, 0)))
    return Move(id, title, inputs, 'non-combat', specs, loop=True, input_type='hold', preview_cycles=3,
                notes='shuffle step in guard; root x is the distance covered within one cycle (12 px)')


def walk_right():
    return _walk('walk_right', 'Walk right', 'Right', [
        (0, (0, 0), (0, 0), 1), (2, (-2, 0), (2, -2), 1), (4, (-4, 0), (5, -2), 2),
        (6, (-6, 0), (6, 0), 2), (8, (-2, -2), (4, 0), 1), (10, (1, -1), (2, 0), 1)])


def walk_left():
    return _walk('walk_left', 'Walk left (backpedal in guard)', 'Left', [
        (0, (0, 0), (0, 0), 1), (-2, (-2, -2), (2, 0), 1), (-4, (-5, -2), (4, 0), 2),
        (-6, (-6, 0), (6, 0), 2), (-8, (-4, 0), (2, -2), 1), (-10, (-2, 0), (-1, -1), 1)])


DUCK = pose(hip=(0, 7), bend=16, lean=2, hand=(40.0, 44.0), theta=18, gaze=1, hair=(0, 2), cloth=(-1, 0, 2),
            shoulders=dict(near=(0.5, 1.0), far=(0.5, 1.0)))


def duck():
    return Move('duck', 'Duck', 'Down', 'non-combat', [
        pose(name='duck1', ms=60, hip=(0, 3), bend=8, hand=(38.5, 40.5), theta=22, hair=(0, 1)),
        dict(DUCK, name='duck2', ms=80, hair=(0, 3)),
        dict(DUCK, name='duck3', ms=200),
    ], loop=True, loop_from=2, input_type='hold', notes='frames 1-2 enter the crouch, frame 3 holds')


def jump():
    tuck = dict(front=(-3, -9), rear=(5, -9), hip=(0, 0), theta=40, hand=(38.0, 33.0), bend=6)
    return Move('jump', 'Jump (2 body heights)', 'Y', 'non-combat', [
        pose(name='crouch', ms=80, hip=(0, 5), bend=10, hand=(38.5, 41.0), theta=22, cloth=(0, 0, 1)),
        pose(name='takeoff', ms=60, root=(0, 24), front=(1, 2), rear=(-1, 2), hip=(0, 0), theta=35,
             hand=(38.0, 34.0), hair=(0, -2), cloth=(-1, 0, 0), fx=[('dust', dict(foot='both', t=0.0))]),
        pose(name='rise', ms=90, root=(0, 100), **{**tuck, 'front': (-1, -4), 'rear': (3, -4)}, hair=(0, -3),
             cloth=(-1, 0, 0), fx=[('vlines', dict(n=10))]),
        pose(name='apex', ms=170, root=(0, 164), **tuck, hair=(0, 2), cloth=(2, 0, 1)),
        pose(name='fall', ms=90, root=(0, 90), **{**tuck, 'front': (-1, -3), 'rear': (2, -3)}, hair=(0, 3), cloth=(3, 0, 1)),
        pose(name='land', ms=100, hip=(0, 6), bend=12, hand=(39.0, 42.0), theta=20, hair=(0, 2),
             cloth=(-1, 0, 2), shake=(0, 1), fx=[('dust', dict(foot='both', t=0.3, big=1.3))]),
        pose(name='recover', ms=90, hip=(0, 2), fx=[('dust', dict(foot='both', t=1.6, big=1.3))]),
    ], camera='follow_y', notes='rises 164 px (two body heights of 82 px)')


def dash():
    lean = dict(bend=16, lean=3, hip=(2, 3), hand=(42.0, 38.0), theta=12, gaze=1)
    return Move('dash', 'Dash forward', 'X', 'non-combat', [
        pose(name='set', ms=60, hip=(0, 4), bend=10, hand=(39.0, 40.0), theta=18),
        pose(name='burst', ms=50, root=(30, 0), **lean, rear=(-4, -3), front=(2, -2), hair=(-4, 3), cloth=(2, -3, 0),
             fx=[('ghosts', dict(offsets=((-18, 0), (-36, 0)), color='white')), ('speedlines', dict(n=18)),
                 ('dust', dict(foot='rear', t=0.2))]),
        pose(name='glide', ms=50, root=(70, 0), **lean, rear=(-2, -3), front=(3, -2), hair=(-4, 3), cloth=(2, -3, 0),
             fx=[('ghosts', dict(offsets=((-20, 0), (-40, 0), (-60, 0)), color='white')), ('speedlines', dict(n=26))]),
        pose(name='skid', ms=90, root=(92, 0), hip=(0, 4), bend=6, lean=0, hand=(39.0, 41.0), theta=20, front=(4, 0),
             hair=(3, 1), cloth=(0, 2, 1), fx=[('dust', dict(foot='front', t=0.4, big=1.2))]),
        pose(name='recover', ms=100, root=(92, 0), hair=(1, 0), fx=[('dust', dict(foot='front', t=1.8, big=1.2))]),
    ], notes='covers 92 px')


BLOCK = pose(theta=76, hand=(47.0, 37.0), gap=11, order='LOW', hip=(0, 3), bend=8, lean=1, gaze=1,
             far=dict(sleeve=3.5, rs=2.6), cloth=(0, 0, 1))


def block():
    return Move('block', 'Block (hold B)', 'B (hold)', 'non-combat', [
        tween(P, BLOCK, 0.5, 'block1', 50, order='LOW', far=dict(sleeve=3.5, rs=2.6)),
        dict(BLOCK, name='block2', ms=60, fx=[('glint', dict(u=40))]),
        dict(BLOCK, name='block3', ms=240),
    ], loop=True, loop_from=2, input_type='hold', notes='sword upright in front, flat to the enemy')


def parry():
    snap = pose(theta=62, hand=(44.0, 33.0), gap=12, order='LOW', hip=(1, 2), bend=6, lean=1, front=(2, 0),
                far=dict(sleeve=3.5, rs=2.6))
    return Move('parry', 'Parry (tap B)', 'B (tap)', 'non-combat', [
        tween(P, snap, 0.5, 'parry1', 40, order='LOW', far=dict(sleeve=3.5, rs=2.6)),
        dict(snap, name='parry2', ms=70, fx=[('spark', dict(u=48, size=7))], shake=(1, 0), active=True),
        dict(snap, name='parry3', ms=60, theta=55, fx=[('spark', dict(u=48, size=4))]),
        tween(snap, P, 0.5, 'parry4', 80, order='PLOW', far=dict(sleeve=2.5, rs=2.6)),
        pose(name='parry5', ms=80),
    ], input_type='tap', notes='frame 2 is the parry window')


def charge():
    loop = [dict(HIGH, name=f'charge{k + 1}', ms=90, front=(-2, 0), hair=(0, 1 + k % 2),
                 fx=[('aura', dict(color='blue', width=1 + k % 2)), ('energy', dict(color='blue', n=10 + 4 * k)),
                     ('charge', dict(t=k / 3))]) for k in range(3)]
    return Move('charge', 'Raise and charge (hold Up)', 'Up (hold)', 'non-combat', [
        dict(RAISE1, name='raise1', ms=90), dict(RAISE2, name='raise2', ms=80),
        dict(HIGH, name='high', ms=120, front=(-2, 0), fx=[('glint', {})]),
    ] + loop, loop=True, loop_from=3, input_type='hold',
        notes='lifts into the high guard, then loops the charge; press A while holding Up for the heavy attack (Up-A)')


ALL = [idle, walk_right, walk_left, duck, jump, dash, block, parry, charge]
