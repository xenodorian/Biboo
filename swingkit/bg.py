"""Original sunset side-scroller scene, drawn at 1:1 pixel scale.
Every layer is native 640x480 artwork and periodic (tiles horizontally) for parallax scrolling.
Layers are rendered with a vertical margin (M rows above and below the 216-px view)
so camera shake never exposes an edge.
"""
import numpy as np
from PIL import Image
from scipy import ndimage

W, VH, M = 640, 480, 16
BASE_W, BASE_VH = 384, 216
SX, SY = W / BASE_W, VH / BASE_VH
H = VH + 2 * M                      # layer height incl. margins; layer row = view row + M
rng = np.random.default_rng(7)

def periodic_noise(nx, cell_h, seed, h=H, w=W):
    """Smooth value noise, periodic in x with nx lattice cells across w."""
    r = np.random.default_rng(seed)
    ny = int(np.ceil(h / cell_h)) + 2
    lat = r.uniform(-1, 1, (ny, nx))
    ys = np.arange(h) / cell_h
    xs = np.arange(w) / w * nx
    y0 = np.floor(ys).astype(int); x0 = np.floor(xs).astype(int)
    fy = ys - y0; fx = xs - x0
    sy = (1 - np.cos(fy * np.pi)) / 2; sx = (1 - np.cos(fx * np.pi)) / 2
    a = lat[y0][:, x0 % nx]; b = lat[y0][:, (x0 + 1) % nx]
    c = lat[y0 + 1][:, x0 % nx]; d = lat[y0 + 1][:, (x0 + 1) % nx]
    top = a + (b - a) * sx[None, :]; bot = c + (d - c) * sx[None, :]
    return top + (bot - top) * sy[:, None]

def wrapdist(x, c):
    d = (x - c) % W
    return np.where(d > W / 2, d - W, d)

def mode_clean(idx, iters=1, mask=None):
    """Remove isolated pixels: replace a pixel that has no same-colour 4-neighbour
    with the most common colour among its 8 neighbours (x wraps, y clamps)."""
    for _ in range(iters):
        p = np.pad(idx, ((1, 1), (0, 0)), mode='edge')
        p = np.concatenate([p[:, -1:], p, p[:, :1]], axis=1)
        c = p[1:-1, 1:-1]
        n4 = [p[:-2, 1:-1], p[2:, 1:-1], p[1:-1, :-2], p[1:-1, 2:]]
        lonely = np.all([n != c for n in n4], axis=0)
        if mask is not None: lonely &= mask
        ys, xs = np.nonzero(lonely)
        out = idx.copy()
        for y, x in zip(ys, xs):
            nb = p[y:y + 3, x:x + 3].ravel()
            nb = np.delete(nb, 4)
            v, k = np.unique(nb, return_counts=True)
            out[y, x] = v[k.argmax()]
        idx = out
    return idx

def remove_islands(idx, min_size=6):
    out = idx.copy()
    for v in np.unique(idx):
        if v < 0: continue
        lab, n = ndimage.label(idx == v)
        if n == 0: continue
        sizes = ndimage.sum(np.ones_like(idx), lab, range(1, n + 1))
        for i, sz in enumerate(sizes, 1):
            if sz < min_size:
                m = lab == i
                ring = ndimage.binary_dilation(m) & ~m
                vals = out[ring]; vals = vals[vals >= 0]
                if len(vals):
                    u, k = np.unique(vals, return_counts=True); out[m] = u[k.argmax()]
    return out

# ---------------------------------------------------------------- SKY
SKY = np.array([(116, 58, 108), (149, 76, 117), (188, 76, 95), (219, 91, 77),
                (232, 106, 63), (241, 128, 65), (245, 146, 71), (248, 166, 81),
                (251, 190, 102)], float)
SUN_CX, SUN_CY = round(262 * SX), round(148 * SY) + M      # glow centre (behind mountains)

def make_sky():
    y = np.arange(H)[:, None].astype(float); x = np.arange(W)[None, :].astype(float)
    t = np.clip((y - 0) / (round(158 * SY) + M), 0, 1)
    base = 7.6 * t ** 0.85
    n = (periodic_noise(5, 16, 11) * 1.0 + periodic_noise(11, 8, 12) * 0.55 +
         periodic_noise(23, 4, 13) * 0.25)
    # streaks: stronger in the middle sky, calm near zenith and horizon
    streak = 1.25 * np.sin(np.clip(t, 0, 1) * np.pi) ** 0.7
    dx = wrapdist(x, SUN_CX)
    glow = 1.7 * np.exp(-(dx / 78) ** 2 - ((y - SUN_CY) / 46) ** 2)
    v = base + streak * n + glow
    idx = np.clip(np.floor(v), 0, len(SKY) - 1).astype(int)
    idx = mode_clean(idx, 2)
    idx = remove_islands(idx, 8)
    return idx

# ---------------------------------------------------------------- MOUNTAINS
def fbm1d(n_list, amp_list, seed):
    out = np.zeros(W)
    for i, (n, a) in enumerate(zip(n_list, amp_list)):
        out += periodic_noise(n, 999, seed + i, h=1)[0] * a
    return out

def mountain_layer(peaks, seed, cols, base_y, haze_col, rim_rows=1):
    """peaks: (centre_x, summit_y, left_slope, right_slope). The sun is to the
    right, so right-hand faces are lit. Ridgelines are fractal, the light/shadow
    divide wanders, gullies are sparse diagonal strokes."""
    r = np.random.default_rng(seed)
    x = np.arange(W).astype(float)
    rough = fbm1d([24, 48, 96, 192], [3.0, 1.8, 1.0, 0.5], seed)
    dist_min = np.min([np.abs(wrapdist(x, p[0])) for p in peaks], axis=0)
    rs = rough * np.clip(dist_min / 25, 0.3, 1.0)
    tops = []
    for (c, ty, sl, sr) in peaks:
        d = wrapdist(x, c)
        tops.append(np.round(ty + np.where(d < 0, -d * sl, d * sr) + rs).astype(int))
    tops = np.array(tops)
    # depth order: lower summits sit in front (index 0 = frontmost)
    order = np.argsort([-p[1] for p in peaks])
    names = ['shadow', 'shadow2', 'lit2', 'lit', 'rim', 'haze']
    lay = np.full((H, W), -1); owner = np.full((H, W), -1)
    divides = []
    for k in range(len(peaks)):
        steps = np.cumsum(r.choice([-1, 0, 0, 1], size=H)) * 0.5
        divides.append((steps, r.uniform(0.15, 0.45)))
    for xi in range(W):
        for y in range(0, base_y + 1):
            k = next((k for k in order if y >= tops[k, xi]), None)
            if k is None: continue
            owner[y, xi] = k
            c, ty, sl, sr = peaks[k]
            d = wrapdist(np.array([float(xi)]), c)[0]
            steps, lean = divides[k]
            depth = max(y - ty, 0)
            lit = d > steps[min(y, H - 1)] + depth * lean
            col = 'lit' if lit else 'shadow'
            if lit and y - tops[k, xi] < rim_rows: col = 'rim'
            lay[y, xi] = names.index(col)
    # separation edge where a front peak overlaps one behind it
    for xi in range(W):
        for y in range(1, base_y + 1):
            o = owner[y, xi]; above = owner[y - 1, xi]
            if o >= 0 and above >= 0 and above != o:
                lay[y, xi] = names.index('shadow2') if names[lay[y, xi]] in ('shadow',) else names.index('lit2')
    top = np.array([np.min(tops[:, xi]) for xi in range(W)])
    # gullies on lit faces (shadow strokes) and ridges on shadow faces (lit strokes)
    for k, (c, ty, sl, sr) in enumerate(peaks):
        for _ in range(r.integers(3, 6)):
            side = r.choice([1, -1])
            sx = c + side * r.uniform(3, 30)
            sx_i = int(round(sx)) % W
            y0 = top[sx_i] + r.integers(2, 6)
            length = r.integers(8, 26)
            ang = r.uniform(0.35, 0.8) * side     # dx per dy
            xx = sx
            for j in range(length):
                yy = y0 + j; xx += ang + r.choice([-0.3, 0, 0.3])
                xi = int(round(xx)) % W
                if yy >= H or lay[yy, xi] < 0: continue
                cur = names[lay[yy, xi]]
                if cur in ('lit', 'rim'): lay[yy, xi] = names.index('lit2')
                elif cur == 'shadow': lay[yy, xi] = names.index('shadow2')
                if j % 3 != 2:     # 2-px thick for most of the stroke
                    xj = (xi + (1 if side > 0 else -1)) % W
                    cur = names[lay[yy, xj]] if lay[yy, xj] >= 0 else None
                    if cur in ('lit', 'rim'): lay[yy, xj] = names.index('lit2')
                    elif cur == 'shadow': lay[yy, xj] = names.index('shadow2')
    # atmospheric haze toward the base: a ragged band in the haze colour
    hz = np.round(fbm1d([16, 32], [2.0, 1.0], seed + 9)).astype(int)
    for xi in range(W):
        for y in range(base_y - 10 + hz[xi], base_y + 1):
            if 0 <= y < H and lay[y, xi] >= 0: lay[y, xi] = names.index('haze')
    lay = mode_clean(lay, 1, mask=lay >= 0)
    rgb = np.array([cols[n] for n in names[:5]] + [haze_col], float)
    return lay, rgb

FAR_PEAKS = [(round(14 * SX), round(106 * SY) + M, 0.62, 0.7), (round(78 * SX), round(118 * SY) + M, 0.66, 0.6),
              (round(140 * SX), round(100 * SY) + M, 0.7, 0.66), (round(212 * SX), round(116 * SY) + M, 0.6, 0.72),
              (round(268 * SX), round(92 * SY) + M, 0.64, 0.6), (round(338 * SX), round(110 * SY) + M, 0.7, 0.62)]
FAR_COLS = dict(shadow=(152, 74, 114), shadow2=(170, 80, 106), lit2=(194, 80, 90),
                lit=(214, 90, 80), rim=(240, 142, 74))
NEAR_PEAKS = [(40, 132 + M, 0.72, 0.62), (118, 140 + M, 0.6, 0.7), (190, 128 + M, 0.66, 0.6),
              (300, 136 + M, 0.62, 0.7), (360, 142 + M, 0.7, 0.66)]
NEAR_COLS = dict(shadow=(102, 58, 106), shadow2=(118, 60, 108), lit2=(146, 64, 106),
                 lit=(176, 72, 96), rim=(210, 88, 80))

# ---------------------------------------------------------------- TREES
def tree_layer(seed, base_y, rmin, rmax, spacing, cols, rim=True):
    r = np.random.default_rng(seed)
    x = np.arange(W).astype(float)
    top = np.full(W, 1e9)
    xs = np.arange(0, W, spacing) + r.integers(-spacing // 3, spacing // 3 + 1, len(np.arange(0, W, spacing)))
    for cx in xs:
        rad = r.uniform(rmin, rmax); by = base_y + r.integers(-2, 3)
        d = wrapdist(x, cx)
        inside = np.abs(d) <= rad
        h = np.where(inside, by - np.sqrt(np.maximum(rad ** 2 - d ** 2, 0)) * 1.05, 1e9)
        top = np.minimum(top, h)
    top = np.where(top > 1e8, base_y, top)
    top = np.round(top).astype(int)
    lay = np.full((H, W), -1)
    for xi in range(W):
        lay[top[xi]:, xi] = 0
    if rim:
        for xi in range(W):
            t = top[xi]; tl = top[(xi - 1) % W]; tr = top[(xi + 1) % W]
            if tr > t:                    # surface falls away to the right: faces the sun
                lay[t, xi] = 2
                lay[t + 1, xi] = 1
            elif tl >= t and tr >= t:     # crest pixel
                lay[t, xi] = 1
    rgb = np.array(cols, float)
    return lay, rgb

TREE_BACK_COLS = [(108, 60, 106), (126, 64, 108), (150, 70, 104)]
TREE_FRONT_COLS = [(48, 43, 76), (66, 48, 88), (98, 58, 104)]

# ---------------------------------------------------------------- GROUND
GRASS = [(49, 46, 52), (61, 61, 37), (84, 82, 40), (104, 100, 42), (136, 124, 46), (172, 160, 72)]
DIRT = [(56, 30, 44), (70, 33, 47), (93, 33, 45), (112, 40, 46), (132, 50, 50), (156, 70, 58)]
GROUND_TOP = round(183 * SY)          # view row of grass surface
GRASS_BOTTOM = round(194 * SY)        # view row where dirt begins (ragged)

def ground_layer():
    r = np.random.default_rng(21)
    pal = GRASS + DIRT
    G = lambda i: i; D = lambda i: len(GRASS) + i
    lay = np.full((H, W), -1)
    top = GROUND_TOP + M + np.round(periodic_noise(64, 999, 31, h=1)[0] * 0.8).astype(int)
    gb = GRASS_BOTTOM + M + np.round(periodic_noise(40, 999, 32, h=1)[0] * 1.3).astype(int)
    streak = periodic_noise(192, 3, 33)          # vertical blade texture
    for xi in range(W):
        for y in range(top[xi], H):
            if y < gb[xi]:
                dep = y - top[xi]; s = streak[y, xi]
                if dep == 0: c = G(4)
                elif dep <= 2: c = G(4) if s > -0.2 else G(3)
                elif dep <= 5: c = G(3) if s > 0.1 else G(2)
                elif dep <= 8: c = G(2) if s > 0.2 else G(1)
                else: c = G(1)
            else:
                dep = y - gb[xi]
                c = D(1) if dep < 2 else D(2)
            lay[y, xi] = c
    # lit grass tips along the surface + tufts rising above it
    for xi in range(W):
        if r.random() < 0.22: lay[top[xi], xi] = G(5)
    for _ in range(95):
        cx = r.integers(0, W); hgt = r.integers(1, 5)
        for k, off in enumerate((-1, 0, 1)):
            hh = hgt - abs(off) - (1 if r.random() < 0.4 else 0)
            for j in range(1, hh + 1):
                xx = (cx + off) % W
                lay[top[xx] - j, xx] = G(4) if j < hh else G(5)
    # grass strands hanging into the dirt
    for _ in range(120):
        cx = r.integers(0, W); ln = r.integers(1, 4)
        for j in range(ln):
            lay[gb[cx] + j, cx] = G(1) if j < ln - 1 else G(0)
    # dirt clumps (lighter, lit from above) and dark specks
    for _ in range(70):
        cx = r.integers(0, W); cy = r.integers(GRASS_BOTTOM + M + 3, H - 2)
        w = r.integers(2, 6); h = r.integers(1, 3)
        for yy in range(cy, cy + h):
            for xx in range(cx, cx + w):
                if lay[yy % H, xx % W] >= D(0): lay[yy % H, xx % W] = D(3)
        for xx in range(cx, cx + w - 1):
            if lay[cy % H, xx % W] >= D(0): lay[cy % H, xx % W] = D(4)
        for xx in range(cx + 1, cx + w):
            yy = (cy + h) % H
            if lay[yy, xx % W] >= D(0): lay[yy, xx % W] = D(1)
    for _ in range(110):
        cx = r.integers(0, W); cy = r.integers(GRASS_BOTTOM + M + 2, H)
        if lay[cy % H, cx] >= D(0): lay[cy % H, cx] = D(0)
    for _ in range(14):   # pebbles
        cx = r.integers(0, W); cy = r.integers(GRASS_BOTTOM + M + 4, H - 3)
        for dx, dy, c in ((0, 0, 5), (1, 0, 4), (0, 1, 4), (1, 1, 1), (2, 0, 4), (2, 1, 1)):
            lay[(cy + dy) % H, (cx + dx) % W] = D(c)
    return lay, np.array(pal, float), top

def front_fringe(top):
    """Sparse tall tufts drawn IN FRONT of the character (bases hidden below view
    of the surface, tips poking up past the feet line)."""
    r = np.random.default_rng(41)
    lay = np.full((H, W), -1)
    cols = [(52, 52, 34), (76, 76, 38), (104, 100, 42), (140, 128, 48)]
    for cx in list(range(6, W, 29)):
        cx = (cx + r.integers(-8, 9)) % W
        base = GROUND_TOP + M + 9 + r.integers(0, 3)
        blades = [(-2, r.integers(2, 4), -1), (-1, r.integers(4, 7), 0), (0, r.integers(5, 9), 0),
                  (1, r.integers(4, 7), 1), (2, r.integers(2, 4), 1)]
        for off, hgt, lean in blades:
            for j in range(hgt):
                xx = (cx + off + (lean if j > hgt * 0.6 else 0)) % W
                yy = base - j
                c = 0 if j < hgt * 0.35 else (1 if j < hgt * 0.7 else (2 if j < hgt - 1 else 3))
                lay[yy, xx] = c
    return lay, np.array(cols, float)

def to_rgba(lay, pal):
    a = lay >= 0
    img = np.zeros(lay.shape + (4,), np.uint8)
    img[a, :3] = pal[lay[a]].round(); img[a, 3] = 255
    return img

def build_all():
    layers = {}
    sky = make_sky(); layers['sky'] = to_rgba(sky, SKY)
    far, farc = mountain_layer(FAR_PEAKS, 51, FAR_COLS, round(172 * SY) + M, (164, 82, 108))
    layers['mountains_far'] = to_rgba(far, farc)
    near, nearc = mountain_layer(NEAR_PEAKS, 61, NEAR_COLS, round(180 * SY) + M, (112, 60, 104))
    layers['mountains_near'] = to_rgba(near, nearc)
    tb, tbc = tree_layer(71, round(171 * SY) + M, 4, 9, 9, TREE_BACK_COLS)
    layers['trees_back'] = to_rgba(tb, tbc)
    tf, tfc = tree_layer(81, round(178 * SY) + M, 3, 7, 7, TREE_FRONT_COLS)
    layers['trees_front'] = to_rgba(tf, tfc)
    gl, glc, top = ground_layer(); layers['ground'] = to_rgba(gl, glc)
    ff, ffc = front_fringe(top); layers['fringe'] = to_rgba(ff, ffc)
    return layers

ORDER_BACK = ['sky', 'mountains_far', 'mountains_near', 'trees_back', 'trees_front', 'ground']
PARALLAX = dict(sky=0.1, mountains_far=0.2, mountains_near=0.35, trees_back=0.55,
                trees_front=0.7, ground=1.0, fringe=1.0)
