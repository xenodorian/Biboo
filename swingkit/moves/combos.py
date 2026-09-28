"""Combo attacks: chords ('+') and sequences ('-') built from the basic moves plus energy."""
from .base import Move, PLOW, tween
from . import noncombat as nc, basic as bs

P = dict(PLOW)
def pose(**k):
    return {**P, **k}

LOWF = dict(order='LOW', far=dict(sleeve=3.5, rs=2.6))
BLUE = [('energy', dict(color='blue'))]

# the heavy attack's low point (buried blade), reused by the crash-down moves
IMPACT = pose(theta=-31.7, hand=(48.36, 45.69), gap=14, **LOWF, hip=(2, 3), lean=2, bend=20, front=(4, 0),
              heel_up=True, gaze=1, hair=(-2, 2), cloth=(1, -1, 3),
              shoulders=dict(near=(1.0, 1.5), far=(0.5, 1.0), near_sleeve=-1.0, rs=0.4))


def shift(specs, dx=0.0, dy=0.0, prefix=''):
    out = []
    for s in specs:
        r = s.get('root', (0, 0))
        out.append(dict(s, root=(r[0] + dx, r[1] + dy), name=prefix + s['name']))
    return out


def energy_slash():
    return bs.slash('energy_slash', 'Energy slash', 'A+B', energy='blue')


def heavy_kick():
    return bs.push_kick('heavy_kick', 'Heavy push kick', 'B+L', heavy=True)


def energy_kick():
    m = bs.push_kick('energy_kick', 'Heavy energy push kick', 'A+B+L', heavy=True, energy='blue')
    specs = [dict(s) for s in m.specs]
    for s in specs[:4]:
        s['fx'] = list(s.get('fx', [])) + [('glitter', dict(at='foot', n=10))]
    return Move(m.id, m.title, m.inputs, 'combo', specs, notes='heavy kick with blue energy; active frames 2-3 (foot)')


def energy_burst():
    gather = pose(theta=74, hand=(50.0, 34.0), gap=11, **LOWF, hip=(0, 5), bend=10, gaze=1, hair=(0, 1))
    release = pose(theta=92, hand=(40.0, 13.0), gap=12, order='HIGH', elbows='fwd', hip=(0, 0), bend=-6,
                   lean=-1, gaze=-1, far=dict(sleeve=3.5, rs=2.6), front=(-1, 0), hair=(0, -3), cloth=(3, 0, 3),
                   shoulders=dict(near=(0, -1.0), far=(0, -1.5)))
    return Move('energy_burst', 'Energy burst', 'L+R', 'combo', [
        tween(P, gather, 0.5, 'brace', 60, **LOWF),
        dict(gather, name='gather1', ms=90, fx=[('aura', dict(width=1)), ('charge', dict(t=0.0))]),
        dict(gather, name='gather2', ms=90, fx=[('aura', dict(width=2)), ('charge', dict(t=0.5))] + BLUE),
        dict(release, name='burst1', ms=60, active=True, shake=(0, 3),
             fx=[('burst', dict(r=26)), ('aura', dict(width=2))] + BLUE),
        dict(release, name='burst2', ms=60, active=True, shake=(3, -2), fx=[('burst', dict(r=56))] + BLUE),
        dict(release, name='burst3', ms=70, active=True, shake=(-2, 1), fx=[('burst', dict(r=92, rays=10))]),
        tween(release, P, 0.5, 'settle', 90, order='HIGH', far=dict(sleeve=3.5, rs=2.6)),
        pose(name='plow', ms=120),
    ], notes='hits all around; active frames 4-6 (radius 26, 56, 92 px)')


def taunt():
    plant = pose(theta=-80, hand=(44.0, 39.0), gap=9, **LOWF, hip=(0, 0), bend=-2, lean=-1, hair=(1, 0))
    return Move('taunt', 'Taunt', 'X+Y', 'combo', [
        tween(P, plant, 0.5, 'turn', 80, **LOWF),
        dict(plant, name='plant', ms=120, lead=(49.0, 34.0), shake=(0, 1)),
        dict(plant, name='beckon1', ms=160, lead=(52.0, 22.0), gaze=-1, hair=(0, 1)),
        dict(plant, name='beckon2', ms=140, lead=(50.0, 26.0), gaze=-1),
        dict(plant, name='beckon3', ms=160, lead=(52.0, 22.0), gaze=-1, hair=(0, 1)),
        dict(plant, name='beckon4', ms=140, lead=(50.0, 26.0), gaze=-1),
        tween(plant, P, 0.5, 'pull', 90, **LOWF),
        pose(name='plow', ms=120),
    ], notes='plants the sword and beckons with the free hand')


def dash_thrust(id='dash_thrust', title='Dash thrust', inputs='X+A', energy=None):
    d = nc.dash().specs; t = bs.thrust(energy=energy).specs
    e = [('energy', dict(color=energy))] if energy else []
    specs = [dict(d[0], name='set', fx=list(d[0].get('fx', [])) + e)]
    for k, s in enumerate(d[1:3]):
        g = dict(s, name=f'blur{k + 1}', **{kk: v for kk, v in t[0].items() if kk in ('theta', 'hand', 'gap')})
        g['fx'] = [('ghosts', dict(offsets=((-20, 0), (-40, 0), (-60, 0)), color=energy or 'white')),
                   ('speedlines', dict(n=28, color=energy or 'white'))] + e
        specs.append(g)
    specs += shift(t[1:], dx=d[2]['root'][0] - 4)
    return Move(id, title, inputs, 'combo', specs,
                notes=f'dashes about {int(specs[-1]["root"][0])} px and thrusts; active on the lunge frames')


def energy_dash_thrust():
    m = dash_thrust('energy_dash_thrust', 'Energy dash thrust', 'B-X-A', energy='blue')
    specs = [dict(s) for s in m.specs]
    for s in specs:
        if s.get('active'):
            s['fx'] = list(s.get('fx', [])) + [('aura', dict(width=1)), ('glitter', dict(at=(95, 34), n=10, r=14))]
    return Move(m.id, m.title, m.inputs, 'combo', specs, notes='heavy thrust with blue energy at the end of a dash')


def jump_crash():
    j = nc.jump().specs
    tuck = dict(front=(-3, -9), rear=(5, -9))
    high = dict(nc.HIGH, **tuck, front_planted=False, rear_planted=False)
    return Move('jump_crash', 'Jumping crash', 'Y-A', 'combo', [
        j[0], j[1], dict(j[2], name='rise'),
        dict(high, name='apex', ms=150, root=(10, 164), hair=(0, 2), cloth=(2, 0, 1), fx=[('glint', {})]),
        dict(high, name='dive', ms=50, root=(20, 70), theta=60, hand=(40.0, 16.0), hair=(0, 4), cloth=(4, 0, 2),
             fx=[('vlines', dict(n=16))]),
        dict(IMPACT, name='crash', ms=110, root=(24, 0), active=True, shake=(0, 4),
             fx=[('arc', dict(frm='dive', s0=0.55)), ('impact', {})]),
        dict(IMPACT, name='flash', ms=60, root=(24, 0), bw=True, shake=(-2, 2)),
        dict(IMPACT, name='dust', ms=110, root=(24, 0), shake=(2, -1), hair=(1, 1), cloth=(0, 0, 2),
             fx=[('dust', dict(foot='both', t=0.6, big=1.25))]),
        tween(IMPACT, P, 0.5, 'pull', 110, root=(24, 0), front=(2, 0), heel_up=False),
        pose(name='plow', ms=120, root=(24, 0)),
    ], camera='follow_y', notes='jumps, then crashes down with a heavy chop; active frame 6')


def sky_dash():
    up = pose(theta=88, hand=(40.0, 12.0), gap=12, order='HIGH', elbows='fwd', hip=(0, 0), bend=-4, lean=0,
              far=dict(sleeve=3.5, rs=2.6), front=(-2, -3), rear=(3, -3), gaze=-1, hair=(0, -4), cloth=(-2, 0, 0),
              shoulders=dict(near=(0, -1.0), far=(0, -1.5)))
    return Move('sky_dash', 'Sky dash', 'Down-Y', 'combo', [
        dict(nc.DUCK, name='coil', ms=90, hair=(0, 3)),
        dict(up, name='launch', ms=50, root=(0, 40), fx=[('dust', dict(foot='both', t=0.0, big=1.5)),
                                                        ('vlines', dict(n=20)),
                                                        ('ghosts', dict(offsets=((0, -22),), color='blue'))]),
        dict(up, name='streak1', ms=50, root=(0, 150), fx=[('vlines', dict(n=28)), ('ghosts', dict(offsets=((0, -40),), color='blue'))]),
        dict(up, name='streak2', ms=60, root=(0, 300), fx=[('vlines', dict(n=28))]),
        dict(up, name='gone', ms=160, root=(0, 492), fx=[('dust', dict(foot='both', t=1.8, big=1.5))]),
    ], notes='rises 492 px (6 body lengths) in 4 frames; the preview camera stays on the ground')


def spin_attack():
    wind = dict(bs.SLASH_WIND)
    hit = dict(bs.SLASH_HIT)
    return Move('spin_attack', 'Spin attack', 'Left-Right-A', 'combo', [
        dict(wind, name='wind', ms=90),
        dict(hit, name='turn1', ms=50, flip=True, active=True, fx=[('spin', dict(width=0.25))]),
        dict(hit, name='turn2', ms=50, active=True, shake=(1, 0), fx=[('spin', dict(width=0.45))]),
        dict(wind, name='turn3', ms=50, flip=True, active=True, fx=[('spin', dict(width=0.35))]),
        dict(hit, name='finish', ms=70, active=True, shake=(2, 0), fx=[('spin', dict(width=0.5))]),
        dict(bs.SLASH_FOLLOW, name='follow', ms=90, fx=[('hsmear', dict(center=(30, 36), rx=74, ry=15, a0=110, a1=0, width=0.25))]),
        tween(bs.SLASH_FOLLOW, P, 0.5, 'recover', 100, order='PLOW', far=dict(sleeve=2.5, rs=2.6)),
        pose(name='plow', ms=120),
    ], notes='two full turns; hits all around on frames 2-5')


def energy_wave():
    return Move('energy_wave', 'Energy wave', 'Down-Right-A-B', 'combo', [
        dict(bs.DUCK_LOW, name='duck', ms=100, fx=[('aura', dict(width=1))]),
        dict(bs.UP_HIT, name='cut', ms=60, active=True,
             fx=[('arc', dict(frm='duck', s0=0.35)), ('projectile', dict(x=86, y=28, size=0.8))] + BLUE),
        dict(bs.UP_FOLLOW, name='release', ms=70, fx=[('projectile', dict(x=140, y=30, size=1.0))] + BLUE),
        dict(bs.UP_FOLLOW, name='fly1', ms=70, fx=[('projectile', dict(x=200, y=32, size=1.05))]),
        tween(bs.UP_FOLLOW, P, 0.5, 'fly2', 70, order='HIGH', far=dict(sleeve=3.5, rs=2.6),
              fx=[('projectile', dict(x=262, y=34, size=1.1))]),
        pose(name='fly3', ms=80, fx=[('projectile', dict(x=326, y=36, size=1.1))]),
        pose(name='plow', ms=120),
    ], notes='launches a projectile that travels about 60 px per frame; the projectile is the hitbox')


def earthquake():
    return Move('earthquake', 'Earthquake', 'Down-Down-Down-Down-A', 'combo', [
        dict(nc.RAISE1, name='raise1', ms=80),
        dict(nc.RAISE2, name='raise2', ms=80),
        dict(nc.HIGH, name='high', ms=140, front=(-2, 0), fx=[('aura', dict(color='fire', width=1)), ('glint', {})]),
        dict(IMPACT, name='slam', ms=100, active=True, shake=(0, 5), fx=[('arc', dict(frm='high', s0=0.5)), ('quake', dict(t=0.0))]),
        dict(IMPACT, name='flash', ms=60, bw=True, shake=(-3, 3)),
        dict(IMPACT, name='quake1', ms=90, active=True, shake=(4, -3), fx=[('quake', dict(t=1.0))]),
        dict(IMPACT, name='quake2', ms=90, active=True, shake=(-3, 2), fx=[('quake', dict(t=2.0))]),
        dict(IMPACT, name='quake3', ms=100, shake=(2, -1), fx=[('quake', dict(t=3.0))]),
        tween(IMPACT, P, 0.5, 'pull', 110, front=(2, 0), heel_up=False),
        pose(name='plow', ms=120),
    ], notes='hits along the ground both ways; active frames 4 and 6-7')


def meteor_shower():
    sky = pose(theta=90, hand=(40.0, 12.0), gap=12, order='HIGH', elbows='fwd', hip=(0, 0), bend=-6, lean=-1,
               far=dict(sleeve=3.5, rs=2.6), gaze=-1, hair=(0, -1), front=(-1, 0),
               shoulders=dict(near=(0, -1.0), far=(0, -1.5)))
    fire = [('energy', dict(color='fire', n=10))]
    frames = [dict(nc.RAISE1, name='raise', ms=80),
              dict(sky, name='call', ms=160, fx=[('aura', dict(color='fire', width=1)), ('glint', {})] + fire)]
    for k in range(6):
        frames.append(dict(sky, name=f'rain{k + 1}', ms=100, active=True, shake=((1, -1), (-1, 1))[k % 2] if k else (0, 0),
                           fx=[('meteors', dict(t=0.6 + k * 0.55))] + (fire if k < 3 else [])))
    frames += [tween(sky, P, 0.5, 'lower', 100, order='HIGH', far=dict(sleeve=3.5, rs=2.6), fx=[('meteors', dict(t=4.0))]),
               pose(name='plow', ms=120, fx=[('meteors', dict(t=4.6))])]
    return Move('meteor_shower', 'Meteor shower', 'Up-Up-Up-Up-A', 'combo', frames,
                notes='meteors land ahead of her across the screen during frames 3-8')


ALL = [energy_slash, heavy_kick, energy_kick, energy_burst, taunt, dash_thrust, jump_crash, sky_dash,
       spin_attack, energy_dash_thrust, energy_wave, earthquake, meteor_shower]
