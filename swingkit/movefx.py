"""Effects for the move library, drawn in scene-layer coordinates like swingkit.fx.

Each effect is called as EFFECTS[name](ctx, **kwargs). ctx carries the back and front layers,
the frame, its sword, the character's world offset (root) and silhouette, and the frame index.
World points are given in sprite coordinates of the character; ctx.L() turns them into layer
coordinates, following the character's root motion.
"""
import numpy as np
from scipy import ndimage as ndi
from . import fx, rig
from .rig import Sword

C = dict(fx.C)
C.update(
    b_dark=(40, 70, 190), b_mid=(80, 140, 255), b_lite=(150, 205, 255), b_hi=(225, 245, 255),
    g_dark=(30, 140, 70), g_mid=(70, 205, 100), g_lite=(150, 245, 150), g_hi=(225, 255, 215),
    m_dark=(120, 36, 30), m_mid=(235, 110, 40), m_lite=(255, 190, 90), m_hi=(255, 245, 200),
    k_dark=(40, 22, 30), k_mid=(84, 48, 46),
)
TONES = dict(blue=('b_dark', 'b_mid', 'b_lite', 'b_hi'), green=('g_dark', 'g_mid', 'g_lite', 'g_hi'),
             white=('lav2', 'lav', 'light', 'white'), fire=('m_dark', 'm_mid', 'm_lite', 'm_hi'))


class Ctx:
    def __init__(self, back, front, fr, sw, root, mask, i, move):
        self.back, self.front, self.fr, self.sw, self.root = back, front, fr, sw, root
        self.mask, self.i, self.move = mask, i, move

    def L(self, p):
        x, y = fx.to_layer(p)
        return np.array([x + self.root[0], y - self.root[1]], float)

    gy = fx.GROUND_LY                      # layer row of the ground line (moves with the camera)


def _star(layer, x, y, r, cols):
    x, y = int(round(x)), int(round(y))
    layer.px(x, y, C[cols[-1]])
    for k in range(1, r + 1):
        col = C[cols[-1]] if k < r else C[cols[-2]]
        for dx, dy in ((k, 0), (-k, 0), (0, k), (0, -k)):
            layer.px(x + dx, y + dy, col)


def _blade_pts(sw, u0=0.0, u1=None):
    u1 = Sword.L if u1 is None else u1
    return sw.B0 + u0 * sw.d, sw.B0 + u1 * sw.d


# ------------------------------------------------------------ energy on the blade
def energy(ctx, color='blue', n=16, glow=True):
    """Glittering energy: a glow outline around the blade and twinkling sparkles along it."""
    sw, t = ctx.sw, TONES[color]
    if glow:
        a, b = _blade_pts(sw, -2, Sword.L + 3)
        for w, col in ((Sword.HW + 3.0, t[0]), (Sword.HW + 1.8, t[1])):
            pts = [a + sw.n * w, b + sw.n * w * 0.4, b + sw.d * 3, b - sw.n * w * 0.4, a - sw.n * w]
            ctx.back.poly([tuple(ctx.L(p)) for p in pts], C[col])
    rng = np.random.default_rng(100 + ctx.i)
    for _ in range(n):
        u = rng.uniform(0, Sword.L + 4); v = rng.uniform(-Sword.HW - 7, Sword.HW + 7)
        p = ctx.L(sw.B0 + u * sw.d + v * sw.n)
        _star(ctx.front, p[0], p[1], int(rng.integers(1, 3)), t)


def aura(ctx, color='blue', width=2):
    """Glow hugging the character's silhouette (behind the character)."""
    t = TONES[color]
    m = ctx.mask
    outer = ndi.binary_dilation(m, iterations=width + 1) & ~m
    inner = ndi.binary_dilation(m, iterations=max(width - 1, 1)) & ~m
    ctx.back.a[outer, :3] = C[t[0]]; ctx.back.a[outer, 3] = 255
    ctx.back.a[inner, :3] = C[t[1]]; ctx.back.a[inner, 3] = 255


def plus(ctx, n=9, phase=0.0, color='green'):
    """Plus signs floating up around the character (healing)."""
    t = TONES[color]
    rng = np.random.default_rng(7)
    for k in range(n):
        x0 = rng.uniform(-6, 70); y0 = rng.uniform(20, 78); sp = rng.uniform(9, 15)
        ph = (phase + k / n) % 1.0
        p = ctx.L((x0, y0 - ph * sp * 3))
        r = 3 if (k % 3) else 4
        col = t[3] if ph < 0.6 else t[2]
        for dx in range(-r, r + 1):              # two-pixel-thick arms with a darker core line
            for w in (0, 1):
                ctx.front.px(p[0] + dx, p[1] + w, C[t[1]]); ctx.front.px(p[0] + w, p[1] + dx, C[t[1]])
            ctx.front.px(p[0] + dx, p[1], C[col]); ctx.front.px(p[0], p[1] + dx, C[col])


# ------------------------------------------------------------ smears and speed
def arc(ctx, frm, s0=0.5):
    """Motion blur trailing the blade from an earlier frame of this move (rotation arc)."""
    frA = ctx.move.frames[ctx.move.index(frm)]
    a, b = dict(frA), dict(ctx.fr)
    a['H'] = tuple(np.array(frA['H']) + np.array([frA['root'][0], -frA['root'][1]]) - np.array([ctx.root[0], -ctx.root[1]]))
    lay = _Shift(ctx.back, ctx.root)
    sw = ctx.sw
    L = None
    if ctx.fr['root'][1] <= 0 and sw.d[1] > 0.05:   # blade in the ground: sweep only what shows
        L = float(min(Sword.L, max((rig.FEET_ROW - sw.B0[1]) / sw.d[1], 20.0)))
    fx.blur_strike(lay, a, b, s0=s0, u_min=min(24, (L or Sword.L) * 0.4), L=L)


class _Shift:
    """Layer proxy that offsets fx.Layer drawing by the character's root."""
    def __init__(self, layer, root):
        self.l, self.dx, self.dy = layer, root[0], -root[1]
    def px(self, x, y, col): self.l.px(x + self.dx, y + self.dy, col)
    def poly(self, pts, col): self.l.poly([(p[0] + self.dx, p[1] + self.dy) for p in pts], col)
    def line(self, p, q, col, thick=1):
        self.l.line((p[0] + self.dx, p[1] + self.dy), (q[0] + self.dx, q[1] + self.dy), col, thick)


def hsmear(ctx, center=(34, 36), rx=74, ry=16, a0=200, a1=20, width=0.45, color='white'):
    """Horizontal slash seen from the side: a flat elliptical crescent swept from angle a0 to a1
    (degrees; 0 = in front, 90 = toward the viewer, 180 = behind). The half toward the viewer is
    drawn in front of the character, the far half behind. Thick at the leading end."""
    t = TONES[color]
    cx, cy = center
    n = 48
    angs = np.radians(np.linspace(a0, a1, n + 1))
    for band, (w0, col) in enumerate(((width, t[1]), (width * 0.62, t[2]), (width * 0.3, t[3]))):
        segs = []
        for i, a in enumerate(angs):
            k = i / n
            w = w0 * k ** 1.2
            o = ctx.L((cx + rx * np.cos(a), cy + ry * np.sin(a)))
            inn = ctx.L((cx + rx * (1 - w) * np.cos(a), cy + ry * (1 - w) * np.sin(a)))
            segs.append((o, inn, np.sin(a) > 0))
        for (o1, i1, f1), (o2, i2, f2) in zip(segs[:-1], segs[1:]):
            lay = ctx.front if (f1 and f2) else ctx.back
            lay.poly([tuple(o1), tuple(o2), tuple(i2), tuple(i1)], C[col])


def spin(ctx, center=(34, 38), rx=70, ry=18, width=0.4, color='white'):
    """Full ring smear around the character for a spin attack."""
    hsmear(ctx, center, rx, ry, a0=-160, a1=190, width=width, color=color)


def thrust_lines(ctx, n=7, length=60, color='white'):
    """Speed lines trailing back along the blade line of a thrust."""
    sw = ctx.sw; t = TONES[color]
    rng = np.random.default_rng(3 + ctx.i)
    for k in range(n):
        v = rng.uniform(-11, 11); u0 = rng.uniform(10, Sword.L - 10); ln = rng.uniform(0.4, 1.0) * length
        p = ctx.L(sw.B0 + u0 * sw.d + v * sw.n); q = ctx.L(sw.B0 + (u0 - ln) * sw.d + v * sw.n)
        ctx.back.line(tuple(p), tuple(q), C[t[2] if k % 2 else t[3]])


def speedlines(ctx, n=26, direction=1, color='white', band=(40, 205)):
    """Screen-wide horizontal streaks behind the character (dash)."""
    t = TONES[color]
    rng = np.random.default_rng(11 + ctx.i)
    for k in range(n):
        y = rng.uniform(*band) + fx.M; x = rng.uniform(0, fx.W); ln = rng.uniform(20, 70)
        ctx.back.line((x, y), (x - direction * ln, y), C[t[1] if k % 3 else t[2]])


def vlines(ctx, n=22, color='white'):
    """Vertical streaks (rising dash)."""
    t = TONES[color]
    rng = np.random.default_rng(21 + ctx.i)
    base = ctx.L((32, 40))
    for k in range(n):
        x = base[0] + rng.uniform(-60, 60); y = rng.uniform(0, fx.H); ln = rng.uniform(25, 80)
        ctx.back.line((x, y), (x, y + ln), C[t[1] if k % 3 else t[2]])


def ghosts(ctx, offsets=((-14, 0), (-28, 0)), color='blue'):
    """Afterimages: tinted copies of the character at offsets (world px). The nearest is a full
    tinted copy; older ones keep every other row (scanlines), so they fade without dot noise."""
    t = TONES[color]
    ramp = np.array([C[t[0]], C[t[1]], C[t[2]], C[t[3]]], float)
    rgb = ctx.char[..., :3].astype(float); a = ctx.char[..., 3] > 0
    lum = rgb @ np.array([0.3, 0.55, 0.15]) / 255.0
    tint = ramp[np.clip((lum * 4.2).astype(int), 0, 3)].astype(np.uint8)
    rows = (np.arange(fx.H) % 2 == 0)[:, None]
    for k, (dx, dy) in list(enumerate(offsets))[::-1]:
        sh = lambda arr: np.roll(np.roll(arr, int(round(dx)), axis=1), int(round(-dy)), axis=0)
        m = sh(a) & (True if k == 0 else rows)
        ctx.back.a[m, :3] = sh(tint)[m]; ctx.back.a[m, 3] = 255


def dust(ctx, foot='both', t=0.0, big=1.0):
    """Dust kicked up at the feet (takeoff, landing, skid)."""
    feet = {'front': ctx.fr['legs']['right']['ankle'], 'rear': ctx.fr['legs']['left']['ankle']}
    sel = ['front', 'rear'] if foot == 'both' else [foot]
    discs = []
    for f in sel:
        x = ctx.L(feet[f])[0] + (4 if f == 'front' else 0)
        gy = ctx.gy
        for side, r0, rm in ((-1, 2.0, 4.0), (1, 2.5, 5.0), (1, 1.5, 3.0)):
            spread = (6 + 7 * (1 - 0.55 ** (t + 0.6))) * big
            r = (r0 + (rm - r0) * (1 - np.exp(-(t + 0.5) / 1.1))) * big
            fade = min(max((t - 1.2) / 1.4, 0), 1)
            rr = r * (1 - 0.75 * fade)
            discs.append((x + side * spread * (1.0 if rm > 3.5 else 1.7), gy - rr * 0.5, rr, 1.5, fade))
    fx.cloud(ctx.front, [d for d in discs if d[2] >= 1.2])


def spark(ctx, u=None, size=6):
    """Parry spark on the blade: a bright star with rays."""
    sw = ctx.sw
    u = Sword.L * 0.55 if u is None else u
    p = ctx.L(sw.B0 + u * sw.d)
    for ang, ln in ((0, size * 2), (90, size * 2), (45, size), (135, size), (180, size * 2), (270, size * 2), (225, size), (315, size)):
        a = np.radians(ang); dv = np.array([np.cos(a), -np.sin(a)])
        for i in range(int(ln) + 1):
            q = p + dv * i
            ctx.front.px(q[0], q[1], C['white'] if i < ln * 0.6 else C['yellow'])
    ctx.front.disc(p[0], p[1], 2.2, C['white'])


def glint(ctx, u=58):
    sw = ctx.sw
    p = ctx.L(sw.B0 + u * sw.d - 3.0 * sw.n)
    _star(ctx.front, p[0], p[1], 4, ('lav', 'white'))


def burst(ctx, r=40, color='blue', rays=16, center=(32, 44)):
    """Energy burst in all directions: a thick ring, radial rays and a bright core."""
    t = TONES[color]
    c = ctx.L(center)
    ring = ctx.front if r > 48 else ctx.back        # a small ring would cover her body: keep it behind
    for rr, col, w in ((r, t[1], 4), (r - 3, t[2], 2), (r - 5, t[3], 1)):
        for a in np.radians(np.arange(0, 360, 1.5)):
            for k in range(w):
                ring.px(c[0] + (rr - k) * np.cos(a), c[1] + (rr - k) * np.sin(a) * 0.9, C[col])
    rng = np.random.default_rng(5)
    for a in np.radians(np.linspace(0, 360, rays, endpoint=False) + rng.uniform(-6, 6, rays)):
        dv = np.array([np.cos(a), np.sin(a) * 0.9])
        p = c + dv * r * 0.35; q = c + dv * r * 1.35
        ctx.back.line(tuple(p), tuple(q), C[t[2]], thick=2)
    if r < 60:
        ctx.back.disc(c[0], c[1], r * 0.3, C[t[2]])


def charge(ctx, t=0.0, color='blue', n=14):
    """Energy gathering: particles streaking inward toward the sword."""
    tt = TONES[color]
    sw = ctx.sw
    tgt = ctx.L(sw.B0 + Sword.L * 0.5 * sw.d)
    rng = np.random.default_rng(31)
    for k in range(n):
        a = rng.uniform(0, 2 * np.pi); R = rng.uniform(30, 60)
        ph = (t + k / n) % 1.0
        d = R * (1 - ph)
        p = tgt + d * np.array([np.cos(a), np.sin(a)])
        q = tgt + (d + 6) * np.array([np.cos(a), np.sin(a)])
        ctx.front.line(tuple(p), tuple(q), C[tt[3] if ph > 0.5 else tt[2]])


def projectile(ctx, x=90, y=40, size=1.0, color='blue'):
    """Large energy crescent flying forward; x, y in sprite coords of the character."""
    t = TONES[color]
    c = ctx.L((x, y))
    R = 40 * size
    for rr, col, frac in ((R, t[0], 1.0), (R * 0.9, t[1], 0.85), (R * 0.78, t[2], 0.7), (R * 0.66, t[3], 0.55)):
        pts = []
        for a in np.radians(np.linspace(-80, 80, 25)):
            pts.append((c[0] + rr * np.cos(a) * 0.55, c[1] + rr * np.sin(a)))
        for a in np.radians(np.linspace(80, -80, 25)):
            pts.append((c[0] + rr * np.cos(a) * 0.55 * (1 - frac) - rr * 0.25, c[1] + rr * np.sin(a) * 0.8))
        ctx.front.poly(pts, C[col])
    rng = np.random.default_rng(9)
    for k in range(8):
        yy = c[1] + rng.uniform(-R * 0.8, R * 0.8); ln = rng.uniform(20, 55)
        ctx.back.line((c[0] - R * 0.2, yy), (c[0] - R * 0.2 - ln, yy), C[t[2] if k % 2 else t[1]])


def impact(ctx, u=None, big=True, flash=True):
    """Blade-in-the-ground impact (crown of dirt, mound, flash) where the blade meets the ground."""
    sw = ctx.sw
    u = (rig.FEET_ROW - sw.B0[1]) / sw.d[1] if abs(sw.d[1]) > 1e-3 else Sword.L
    I = ctx.L(sw.B0 + u * sw.d)
    fx.crown(ctx.front, I); fx.mound(ctx.front, I, big)
    if flash: fx.flash(ctx.front, I)


def quake(ctx, t=0.0, reach=150):
    """Earthquake: cracks racing along and down into the ground both ways, rocks thrown up, dust."""
    sw = ctx.sw
    u = (rig.FEET_ROW - sw.B0[1]) / sw.d[1] if abs(sw.d[1]) > 1e-3 else Sword.L
    I = ctx.L(sw.B0 + u * sw.d)
    gy = ctx.gy
    rng = np.random.default_rng(13)
    L = reach * min(1.0, 0.35 + t * 0.4)
    for side in (-1, 1):                          # main crack along the surface, branches into the soil
        x, y = I[0], gy
        while abs(x - I[0]) < L:
            nx = x + side * rng.uniform(4, 9); ny = gy + rng.uniform(-1, 4)
            ctx.ground.line((x, y), (nx, ny), C['k_dark'], thick=2)
            if rng.random() < 0.45:
                bx, by = nx, ny
                for _ in range(int(rng.integers(2, 4))):
                    cx, cy = bx + side * rng.uniform(1, 4), by + rng.uniform(3, 6)
                    ctx.ground.line((bx, by), (cx, cy), C['k_dark'])
                    bx, by = cx, cy
            x, y = nx, ny
    for k in range(9):                            # rocks thrown up along the crack
        x = I[0] + rng.uniform(-L, L)
        h = (np.sin(min(t, 2.0) * 1.3 + k) * 0.5 + 0.5) * rng.uniform(10, 34)
        s = int(rng.integers(2, 5))
        for dx in range(-s, s + 1):
            for dy in range(-s, s + 1):
                if abs(dx) + abs(dy) <= s + 1:
                    ctx.front.px(x + dx, gy - h + dy, C['k_mid'] if dy < 0 else C['k_dark'])
    if t > 0.5:                                   # dust bursting out of the crack, irregular
        discs = []
        for k in range(10):
            x = I[0] + rng.uniform(-L, L); r = rng.uniform(3.0, 7.5) * (1.1 - 0.15 * (t - 1))
            discs.append((x, gy - r * 0.6 - rng.uniform(0, 5), r, rng.uniform(1.2, 1.8), 0.0))
        fx.cloud(ctx.front, discs)
    fx.flash(ctx.front, I, scale=0.8, remnant=t > 0.5)


def meteors(ctx, t=0.0, n=9, seed=17):
    """Meteor shower: fireballs streak down from the upper left with trails and burst on impact."""
    rng = np.random.default_rng(seed)
    gy = ctx.gy
    for k in range(n):
        t0 = rng.uniform(0, 3.0); x_land = rng.uniform(150, 380); spd = rng.uniform(55, 80)
        tt = t - t0
        if tt < 0: continue
        fall = tt * spd
        y = -20 + fall; x = x_land - (gy + 20 - fall) * 0.55
        if y < gy:
            for j in range(34):
                q = (x - j * 0.55 * 1.6, y - j * 1.6)
                col = C['m_hi'] if j < 4 else (C['m_lite'] if j < 10 else (C['m_mid'] if j < 20 else C['m_dark']))
                ctx.back.disc(q[0], q[1], max(5.0 - j * 0.14, 0.7), col)
            ctx.back.disc(x, y, 5.5, C['m_lite']); ctx.back.disc(x + 1, y + 1, 3.5, C['m_hi'])
        else:
            age = (y - gy) / spd
            if age < 1.4:
                fx.crown(ctx.front, np.array([x_land, gy]))       # dirt first, the fireball over it
                ctx.front.disc(x_land, gy - 4, 12 * (1 - age * 0.45), C['m_mid'])
                ctx.front.disc(x_land, gy - 4, 8 * (1 - age * 0.5), C['m_lite'])
                ctx.front.disc(x_land, gy - 4, 4 * (1 - age * 0.6), C['m_hi'])
            elif age < 3.0:
                fx.cloud(ctx.front, [(x_land + dx, gy - 5 - (age - 1.4) * 4, 6 - (age - 1.4) * 2.5, 1.4, 0.0) for dx in (-6, 0, 6)])


def kickwave(ctx, big=False, color='white'):
    """Shock ripples in front of the kicking foot."""
    t = TONES[color]
    ank = np.array(ctx.fr['legs']['right']['ankle'], float)
    p = ctx.L(ank + np.array([12, 2]))
    for k, R in enumerate((6, 10, 15) if not big else (7, 12, 18, 25)):
        for a in np.radians(np.linspace(-70, 70, 40)):
            ctx.front.px(p[0] + R * np.cos(a) * 0.6, p[1] + R * np.sin(a), C[t[3] if k == 0 else t[2]])
    if big:
        _star(ctx.front, p[0] + 4, p[1], 5, t)


EFFECTS = dict(energy=energy, aura=aura, plus=plus, arc=arc, hsmear=hsmear, spin=spin,
               thrust_lines=thrust_lines, speedlines=speedlines, vlines=vlines, ghosts=ghosts,
               dust=dust, spark=spark, glint=glint, burst=burst, charge=charge,
               projectile=projectile, impact=impact, quake=quake, meteors=meteors, kickwave=kickwave)


def glitter(ctx, at='foot', n=12, color='blue', r=10):
    """Twinkling sparkles around the kicking foot, the body or a point (sprite coords)."""
    t = TONES[color]
    if at == 'foot':
        c = np.array(ctx.fr['legs']['right']['ankle'], float) + np.array([6.0, 0.0])
    elif at == 'body':
        c = np.array([32.0, 45.0]); r = max(r, 30)
    else:
        c = np.array(at, float)
    rng = np.random.default_rng(200 + ctx.i)
    for _ in range(n):
        p = ctx.L(c + rng.uniform(-r, r, 2))
        _star(ctx.front, p[0], p[1], int(rng.integers(1, 3)), t)


EFFECTS['glitter'] = glitter
