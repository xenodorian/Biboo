"""Effects for the swing, drawn in scene-layer coordinates (layer row = view row + M).
All shapes are hard-edged pixel shapes (no anti-aliasing), using a small fixed palette.
"""
import numpy as np
from PIL import Image, ImageDraw
from . import rig, anim
from .rig import Sword
from .bg import W, H, M, VH

X0, Y0 = 96, 107            # sprite (x,y) -> view (x+X0, y+Y0); feet row 81 -> view 188

C = dict(
    white=(249, 249, 250), light=(233, 231, 238), lav=(214, 206, 230), lav2=(184, 174, 214),
    yellow=(255, 232, 160),
    d_dark=(56, 30, 44), d_mid=(93, 33, 45), d_lite=(124, 43, 46), d_hi=(156, 70, 58),
    c_body=(138, 58, 54), c_hi=(196, 106, 74), c_sh=(78, 36, 48), c_trail=(112, 62, 66),
    g_dark=(61, 61, 37), g_mid=(104, 100, 42), g_lite=(140, 128, 48),
    dust0=(128, 76, 90), dust1=(178, 118, 104), dust2=(220, 160, 120), dust3=(248, 204, 146),
)

def to_layer(p):
    return (p[0] + X0, p[1] + Y0 + M)

GROUND_LY = rig.FEET_ROW + Y0 + M       # layer row of the ground line (feet row)

class Layer:
    def __init__(self):
        self.a = np.zeros((H, W, 4), np.uint8)
    def clip_below(self, ly):
        self.a[int(ly) + 1:] = 0
    def px(self, x, y, col):
        x = int(round(x)); y = int(round(y))
        if 0 <= x < W and 0 <= y < H:
            self.a[y, x, :3] = col; self.a[y, x, 3] = 255
    def poly(self, pts, col):
        m = Image.new('L', (W, H), 0)
        ImageDraw.Draw(m).polygon([tuple(map(float, p)) for p in pts], fill=255)
        mk = np.asarray(m) > 0
        self.a[mk, :3] = col; self.a[mk, 3] = 255
    def disc(self, cx, cy, r, col, sx=1.0):
        if r <= 0.35: return
        x0, x1 = int(np.floor(cx - r * sx - 1)), int(np.ceil(cx + r * sx + 1))
        y0, y1 = int(np.floor(cy - r - 1)), int(np.ceil(cy + r + 1))
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                if ((x + 0.5 - cx) / sx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r:
                    self.px(x, y, col)
    def line(self, p, q, col, thick=1):
        n = int(max(abs(q[0] - p[0]), abs(q[1] - p[1]))) + 1
        for i in range(n + 1):
            t = i / max(n, 1)
            x = p[0] + (q[0] - p[0]) * t; y = p[1] + (q[1] - p[1]) * t
            self.px(x, y, col)
            if thick > 1: self.px(x + 1, y, col)
            if thick > 2: self.px(x, y + 1, col)

def sword_of(fr):
    return Sword(fr['theta'], fr['H'])

# ------------------------------------------------------------ glint
def glint(layer, fr, size=4):
    sw = sword_of(fr)
    p = to_layer(sw.B0 + 58 * sw.d - 3.0 * sw.n)
    x, y = int(round(p[0])), int(round(p[1]))
    layer.px(x, y, C['white'])
    for k in range(1, size + 1):
        col = C['white'] if k <= size // 2 else C['lav']
        for dx, dy in ((k, 0), (-k, 0), (0, k), (0, -k)):
            layer.px(x + dx, y + dy, col)
    for dx, dy in ((1, 1), (-1, -1), (1, -1), (-1, 1)):
        layer.px(x + dx, y + dy, C['lav'])

# ------------------------------------------------------------ impact geometry
def impact_point():
    fr = anim.by_name('impact')
    sw = sword_of(fr)
    u = (rig.FEET_ROW - sw.B0[1]) / sw.d[1]
    p = sw.B0 + u * sw.d
    return np.array(to_layer(p), float)

def flash(layer, I, scale=1.0, remnant=False):
    rays = [(170, 15), (144, 25), (116, 34), (90, 40), (66, 33), (40, 26), (12, 15)]
    for ang, ln in rays:
        a = np.radians(ang); dv = np.array([np.cos(a), -np.sin(a)])
        if remnant:
            for t in (ln * 1.1, ln * 1.3):
                q = I + dv * t * scale; layer.px(q[0], q[1], C['white'])
            continue
        L = ln * scale
        for i in range(int(L) + 1):
            q = I + dv * i
            col = C['white'] if i < L * 0.6 else C['yellow']
            layer.px(q[0], q[1], col)
            if i < L * 0.45:
                layer.px(q[0] + (1 if dv[0] >= 0 else -1), q[1], col)
            if i < L * 0.2:
                layer.px(q[0], q[1] - 1, col)
    if not remnant:
        for dx in range(-18, 19):     # ground slash
            layer.px(I[0] + dx, I[1] - 1, C['white'] if abs(dx) < 11 else C['yellow'])
            if abs(dx) < 7: layer.px(I[0] + dx, I[1] - 2, C['white'])
        layer.disc(I[0], I[1] - 2, 4.2, C['white'])
        layer.disc(I[0], I[1] - 2, 2.2, C['yellow'])

def crown(layer, I):
    """Dirt thrown up in a crown the instant the blade bites."""
    for ang, ln, w in [(66, 8, 3), (84, 10, 3), (100, 9, 3), (118, 8, 3), (140, 6, 2), (46, 6, 2)]:
        a = np.radians(ang); dv = np.array([np.cos(a), -np.sin(a)]); nv = np.array([-dv[1], dv[0]])
        base = I + np.array([0, -1])
        tip = base + dv * ln
        layer.poly([base + nv * w / 2, base - nv * w / 2, tip], C['d_mid'])
        layer.line(base + nv * (w / 2 - 0.5) + dv * 1, tip, C['d_lite'])   # sunlit right edge

def mound(layer, I, big=True):
    """Soil and grass heaped where the blade enters: hides the flat cut."""
    cx, gy = I[0], I[1]
    w = 6 if big else 4
    for dx in range(-w, w + 1):
        h = int(round((1 - (abs(dx) / (w + 0.5)) ** 2) * (3.2 if big else 2)))
        for j in range(h + 1):
            y = gy - j
            col = C['d_mid'] if j < h else (C['d_lite'] if dx > 0 else C['d_mid'])
            layer.px(cx + dx, y, col)
        if h >= 1: layer.px(cx + dx, gy - h - 1, C['g_mid'] if dx % 3 else C['g_lite'])
    for dx in (-w - 1, w + 1):
        layer.px(cx + dx, gy, C['d_dark'])

# ------------------------------------------------------------ particles
rng = np.random.default_rng(99)
CHUNKS = []
for i in range(24):
    lobe = i % 6
    if lobe in (0, 1, 2):   ang = rng.uniform(24, 62)      # forward spray (direction of the swing)
    elif lobe in (3, 4):    ang = rng.uniform(116, 156)    # back spray
    else:                   ang = rng.uniform(76, 104)     # straight up, fastest
    spd = rng.uniform(12.0, 19.0) if lobe != 5 else rng.uniform(16.0, 21.0)
    ang = np.radians(ang)
    kind = 'grass' if i % 4 == 0 else 'dirt'
    size = 1 if kind == 'grass' else int(rng.choice([2, 3, 3, 4]))
    CHUNKS.append(dict(v=np.array([np.cos(ang), -np.sin(ang)]) * spd, off=rng.uniform(-3, 3, 2) * [1, 0.3],
                       kind=kind, size=size, phase=int(rng.integers(0, 2)), behind=lobe in (3, 4)))
PUFFS = []
for i in range(24):
    big = i < 7
    PUFFS.append(dict(off=np.array([rng.uniform(-13, 13), rng.uniform(-1.5, 1)]),
                      v=np.array([rng.uniform(-4.2, 5.4), -rng.uniform(8.0, 14.5) if big else -rng.uniform(3.0, 13.0)]),
                      r0=rng.uniform(2.5, 4.5) if big else rng.uniform(1.5, 3.0),
                      rmax=rng.uniform(12.0, 17.0) if big else rng.uniform(5.0, 9.5),
                      rise=rng.uniform(0.5, 1.5)))
GROUND_PUFFS = [dict(dir=-1, r0=2.5, rmax=5.5), dict(dir=1, r0=3.0, rmax=6.5), dict(dir=1, r0=2.0, rmax=4.5),
                dict(dir=-1, r0=2.0, rmax=4.0)]
G = 5.6
DRAG = 0.7
DEBRIS_TIME = 1.35

def chunk(layer, p, c, t):
    x, y = int(round(p[0])), int(round(p[1]))
    if c['kind'] == 'grass':
        horiz = (int(t) + c['phase']) % 2 == 0
        layer.px(x, y, C['g_lite']); layer.px(x + (1 if horiz else 0), y + (0 if horiz else 1), C['g_mid'])
        return
    s = c['size']; w, h = (s, s) if (int(t) + c['phase']) % 2 else (s + (1 if s == 2 else 0), max(s - 1, 2))
    for yy in range(h):
        for xx in range(w):
            col = C['c_body']
            if yy == 0 or xx == w - 1: col = C['c_hi']          # sunlit top / right
            if yy == h - 1 and xx == 0: col = C['c_sh']
            layer.px(x + xx, y + yy, col)

def puff(layer, cx, cy, r, sx=1.0, fade=0.0):
    """Sunlit dust puff: dark base, progressively lighter discs offset toward the sun
    (upper right). `fade` 0..1 erodes it from the lit side inward."""
    if r < 0.8: return
    layer.disc(cx, cy, r, C['dust0'], sx)
    if fade < 0.85: layer.disc(cx + 0.18 * r, cy - 0.22 * r, r * 0.8, C['dust1'], sx)
    if fade < 0.55: layer.disc(cx + 0.32 * r, cy - 0.42 * r, r * 0.52, C['dust2'], sx)
    if fade < 0.25: layer.disc(cx + 0.48 * r, cy - 0.58 * r, r * 0.26, C['dust3'], sx)

def cloud(layer, discs):
    """Render a set of discs (cx, cy, r, sx, fade) as ONE cohesive cloud:
    mid-tone union, shadowed bottom rim, sunlit lumps toward the upper right."""
    if not discs: return
    Y, X = np.mgrid[0:H, 0:W]
    Xc, Yc = X + 0.5, Y + 0.5
    uni = np.zeros((H, W), bool); lit = np.zeros((H, W), bool); hi = np.zeros((H, W), bool)
    shade = np.zeros((H, W), bool)
    for cx, cy, r, sx, fade in discs:
        if r < 0.8: continue
        x0, x1 = int(max(cx - r * sx - 2, 0)), int(min(cx + r * sx + 3, W))
        y0, y1 = int(max(cy - r - 2, 0)), int(min(cy + r + 3, H))
        xs, ys = Xc[y0:y1, x0:x1], Yc[y0:y1, x0:x1]
        uni[y0:y1, x0:x1] |= ((xs - cx) / sx) ** 2 + (ys - cy) ** 2 <= r * r
        sr_ = r * 0.62
        shade[y0:y1, x0:x1] |= ((xs - cx + 0.42 * r) / sx) ** 2 + (ys - cy - 0.45 * r) ** 2 <= sr_ * sr_
        if fade < 0.8:
            lr = r * 0.66
            lit[y0:y1, x0:x1] |= ((xs - cx - 0.3 * r) / sx) ** 2 + (ys - cy + 0.34 * r) ** 2 <= lr * lr
        if fade < 0.45:
            hr = r * 0.38
            hi[y0:y1, x0:x1] |= ((xs - cx - 0.46 * r) / sx) ** 2 + (ys - cy + 0.55 * r) ** 2 <= hr * hr
    below2 = np.zeros_like(uni); below2[:-2] = uni[2:]
    rim = uni & ~below2
    def paint(mask, col):
        layer.a[mask, :3] = col; layer.a[mask, 3] = 255
    paint(uni, C['dust1'])
    paint(uni & shade & ~lit, C['dust0'])
    paint(uni & lit, C['dust2'])
    paint(uni & hi, C['dust3'])
    paint(rim & ~hi, C['dust0'])

def particles(layer, I, t, back=None):
    """t = time since impact in frame units (impact frame ~0.4)."""
    ground = I[1]
    # dust puffs
    items = []
    for p in PUFFS:
        disp = p['v'] * (1 - DRAG ** t) / (1 - DRAG) + np.array([0, -p['rise'] * t])   # slow buoyant rise
        c = I + p['off'] + disp
        r = p['r0'] + (p['rmax'] - p['r0']) * (1 - np.exp(-t / 1.3))
        fade = 0.0
        if t > 2.9:
            fade = min((t - 2.9) / 3.2, 1.0)
            r *= (1 - 0.8 * fade)
        c[1] = min(c[1], ground - r * 0.4)
        items.append((r, c, fade))
    discs = [(c[0], c[1], r, 1.0, fade) for r, c, fade in items]
    # ground-hugging dust rolling outward
    if t > 0.8:
        for gp in GROUND_PUFFS:
            tt = t - 0.8
            x = I[0] + gp['dir'] * (6 + 16 * (1 - 0.7 ** tt) / 0.3) * (0.7 if gp['rmax'] < 7 else 1.0)
            r = gp['r0'] + (gp['rmax'] - gp['r0']) * (1 - np.exp(-tt / 1.2))
            fade = min(max((tt - 2.2) / 2.2, 0), 1)
            rr = r * (1 - 0.7 * fade)
            for k, (ox, sc) in enumerate(((-0.9, 0.62), (0.0, 0.8), (1.0, 0.55))):
                discs.append((x + ox * rr * 1.2, ground - rr * sc * 0.55, rr * sc, 1.3, fade))
    # debris first (behind the dust), so only chunks that escape the cloud are seen
    td = t * DEBRIS_TIME
    for c in CHUNKS:
        p = I + c['off'] + c['v'] * td + np.array([0, 0.5 * G * td * td])
        if p[1] > ground - 0.5: continue
        vel = c['v'] + np.array([0, G * td])
        sp = np.linalg.norm(vel)
        tgt = back if (c.get('behind') and back is not None) else layer
        if sp > 6:
            back_pt = p - vel / sp * min(sp * 0.35, 6)
            tgt.line(back_pt, p, C['c_trail'])
        chunk(tgt, p, c, td)
    discs = [dsc for dsc in discs if dsc[2] >= 1.6]
    cloud(layer, discs)

def stomp(layer, fr, t):
    """Small dust kicked out from under the front boot when it stomps down (t = frames
    since the stomp, 0 on the impact frame)."""
    ankle = fr['legs']['right']['ankle']
    x = ankle[0] + X0 + 1                    # boot centre, view x
    gy = rig.FEET_ROW + Y0 + M               # ground, layer row
    discs = []
    for side, r0, rm in ((-1, 2.0, 4.0), (1, 2.5, 5.0), (1, 1.5, 3.0)):
        spread = 6 + 7 * (1 - 0.55 ** (t + 0.6))
        r = r0 + (rm - r0) * (1 - np.exp(-(t + 0.5) / 1.1))
        fade = min(max((t - 1.2) / 1.4, 0), 1)
        rr = r * (1 - 0.75 * fade)
        cx = x + side * spread * (1.0 if rm > 3.5 else 1.7)
        discs.append((cx, gy - rr * 0.5, rr, 1.5, fade))
    cloud(layer, [d for d in discs if d[2] >= 1.2])

def clod(layer, fr, t):
    """Dirt still clinging to the blade tip as it is pulled free, falling off."""
    sw = sword_of(fr)
    tip = np.array(to_layer(sw.B0 + (Sword.L - 6) * sw.d))
    for k, (dx, vy) in enumerate(((0, 0.0), (2, 0.4), (-2, 0.2))):
        p = tip + np.array([dx, 1 + vy * t + 0.5 * G * t * t])
        chunk(layer, p, dict(kind='dirt', size=2, phase=k), t)

# ------------------------------------------------------------ strike blur (user request, 2026-09-28)
def blur_strike(layer, frA, frB, s0=0.5, u_min=24):
    """Motion blur for the strike, trailing the blade from pose A (high guard) to pose B (impact):
    a crescent swept by the blade in stepped tones (faint at the tail, white against the blade),
    narrowing toward the tail, with speed streaks along the arc. Drawn behind the character."""
    L = Sword.L
    HA = np.array(frA['H'], float); HB = np.array(frB['H'], float)
    thA, thB = frA['theta'], frB['theta']
    def pose(s):
        return Sword(thA + (thB - thA) * s, HA + (HB - HA) * s)
    def u_in(s):                                  # inner edge: near the tip at the tail, wide at the blade
        k = (s - s0) / (1 - s0)
        return L - (L - u_min) * k ** 0.8
    bands = [(0.50, 0.66, 'lav2'), (0.66, 0.80, 'lav'), (0.80, 0.92, 'light'), (0.92, 1.0, 'white')]
    for sa, sb, col in bands:
        outer, inner = [], []
        for i in range(13):
            s = sa + (sb - sa) * i / 12
            sw = pose(s)
            outer.append(to_layer(sw.B0 + (L + 1) * sw.d)); inner.append(to_layer(sw.B0 + u_in(s) * sw.d))
        layer.poly(outer + inner[::-1], C[col])
    # speed streaks: bright arcs along the crescent, longest at the tip
    for u, start, thick in ((L, 0.52, 2), (L - 9, 0.64, 1), (L - 20, 0.74, 1), (L - 32, 0.84, 1)):
        pts = [pose(start + (0.995 - start) * i / 40) for i in range(41)]
        for p, q in zip(pts[:-1], pts[1:]):
            layer.line(to_layer(p.B0 + u * p.d), to_layer(q.B0 + u * q.d), C['white'], thick=thick)

# ------------------------------------------------------------ black-and-white impact frame
BW_BLACK, BW_WHITE = (14, 12, 22), (250, 250, 250)

def impact_frame_bw(char_rgba, char_line, I, ground_row, seed=11):
    """Anime-style impact frame in view coordinates: white field, dense black speed lines
    converging on the impact point I, black ground, the character as a black silhouette with white
    linework on a white halo, and a white starburst at the cut. Returns an RGBA view image."""
    from scipy import ndimage as ndi
    out = np.zeros((VH, W, 4), np.uint8); out[..., :3] = BW_WHITE; out[..., 3] = 255
    img = Image.new('L', (W, VH), 0); dr = ImageDraw.Draw(img)
    rng = np.random.default_rng(seed)
    R = float(np.hypot(W, VH))
    for _ in range(170):                       # speed lines: thin wedges from off screen to the centre
        a = rng.uniform(0, 2 * np.pi); da = np.radians(rng.uniform(0.25, 1.6))
        r_in = rng.uniform(34, 120)
        p_in = (I[0] + r_in * np.cos(a), I[1] + r_in * np.sin(a))
        p1 = (I[0] + R * np.cos(a - da), I[1] + R * np.sin(a - da))
        p2 = (I[0] + R * np.cos(a + da), I[1] + R * np.sin(a + da))
        dr.polygon([p_in, p1, p2], fill=1)
    lines = np.asarray(img) > 0
    out[lines, :3] = BW_BLACK
    out[int(ground_row) + 1:, :, :3] = BW_BLACK   # ground in black
    # white starburst at the cut
    star = Image.new('L', (W, VH), 0); ds = ImageDraw.Draw(star)
    for ang, ln, w in [(90, 70, 5), (60, 48, 4), (120, 48, 4), (30, 34, 3), (150, 34, 3), (8, 26, 3), (172, 26, 3)]:
        a = np.radians(ang); dv = np.array([np.cos(a), -np.sin(a)]); nv = np.array([-dv[1], dv[0]])
        base = np.array(I, float)
        ds.polygon([tuple(base + nv * w), tuple(base - nv * w), tuple(base + dv * ln)], fill=1)
    ds.ellipse([I[0] - 9, I[1] - 6, I[0] + 9, I[1] + 4], fill=1)
    out[np.asarray(star) > 0, :3] = BW_WHITE
    # character: white halo, black silhouette, white linework inside
    sil = char_rgba[..., 3] > 0
    halo = ndi.binary_dilation(sil, iterations=2) & ~sil
    out[halo, :3] = BW_WHITE
    out[sil, :3] = BW_BLACK
    inner = char_line & ndi.binary_erosion(sil)
    out[inner, :3] = BW_WHITE
    return out
