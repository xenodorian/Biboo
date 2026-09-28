"""Character rig for the sword-swing animation.

Coordinates are "sprite space" (the original 128x82 sprite grid): x right, y down,
feet (boot soles) on row 81. The body is split into layers that can be offset by
whole pixels (head / torso / skirt), long hair that bends by per-row resampling,
and parametric arms + sword that are redrawn every frame. Nothing is ever scaled,
so limb and sword proportions stay identical in every frame.
"""
import numpy as np
from scipy import ndimage
from .paths import DATA

PAL = np.load(DATA / 'pal.npy')                 # 20-colour character palette
BODY = np.load(DATA / 'body_old.npy')           # 82x128, body without arms/sword
# left boot sole extended one row so both soles end on row 81 (ground contact)
BODY[80, 2:11] = 1; BODY[80, 1] = 0; BODY[80, 11] = 0; BODY[81, 2:11] = 0
PX, PY = 24, 104                         # sprite (x,y) -> canvas (x+PX, y+PY)
CW, CH = 176, 190
FEET_ROW = 81                            # sprite row of the boot soles

# palette indices used by the parametric parts
OUT, SK, SKS = 0, 17, 14
WHITE, WHITE2, LAV, LAV2 = 19, 18, 16, 15
TRIM, TRIM2 = 10, 7
BLADE_L, BLADE_D, CORE1, CORE2, FULLER, GEM, GEM2 = 16, 11, 2, 1, 12, 7, 5
METAL_L, METAL, METAL_D = 6, 3, 1

# ---------------------------------------------------------------- body layers
def _masks():
    h, w = BODY.shape
    Y, X = np.mgrid[0:h, 0:w]
    op = BODY >= 0
    head = op & (Y <= 25) & (X <= 41)
    hr = op & (((Y >= 14) & (Y <= 25) & (X >= 42)) | ((Y >= 26) & (Y <= 44) & (X >= 40)))
    whites = np.isin(BODY, [19, 18, 16, 15, 13, 12, 11])
    hr &= ~((Y >= 41) & whites)                 # apron edge belongs to the skirt
    hl = op & (Y >= 26) & (Y <= 50) & (X <= 15)
    torso = op & (Y >= 26) & (Y <= 33) & (X >= 16) & (X <= 39)
    skin = np.isin(BODY, [SK, SKS])
    skirt = op & (Y >= 34) & (Y <= 56) & ~hl & ~hr & ~((Y >= 45) & skin)
    legs = op & ~head & ~hr & ~hl & ~torso & ~skirt
    return dict(head=head, hr=hr, hl=hl, torso=torso, skirt=skirt, legs=legs)

MASKS = _masks()

def _underpaint():
    """Static fill behind the moving layers, only inside the neutral silhouette,
    so a 1-3 px layer offset reveals plausible colour instead of a hole."""
    u = np.full(BODY.shape, -1)
    op = BODY >= 0
    Y, X = np.mgrid[0:BODY.shape[0], 0:BODY.shape[1]]
    u[op & (Y >= 18) & (Y <= 27) & (X >= 14) & (X <= 41)] = 9       # hair behind head
    u[op & (Y >= 22) & (Y <= 27) & (X >= 24) & (X <= 31)] = SKS     # neck
    u[op & (Y >= 26) & (Y <= 35) & (X >= 12) & (X <= 17)] = 9       # hair beside torso
    u[op & (Y >= 31) & (Y <= 36) & (X >= 16) & (X <= 40)] = 7       # waist / dress
    return u

UNDER = _underpaint()

def _paste(C, src, mask, dx, dy):
    ys, xs = np.nonzero(mask)
    C[ys + dy + PY, xs + dx + PX] = src[ys, xs]

def _hair(C, mask, r0, r1, inner, side, top_off, bot_off, sway):
    """Bend a long-hair mass. Row r moves by a blend of the offset of what it hangs
    from (top_off) and what it rests against (bot_off), plus sway at the tips.
    Pixels are resampled per row; columns beyond the inner boundary are clamped so
    no gap opens against the body. side=-1 hair hangs on the left (inner boundary is
    its right edge), +1 on the right."""
    h, w = BODY.shape
    for r in range(r0, r1 + 1):
        b = (r - r0) / max(r1 - r0, 1)
        dx = int(round(top_off[0] * (1 - b) + bot_off[0] * b + sway * b ** 1.4))
        dy = int(round(top_off[1] * (1 - b) + bot_off[1] * b))
        row_mask = mask[r]
        if not row_mask.any(): continue
        xs = np.nonzero(row_mask)[0]
        lo, hi = xs.min(), xs.max()
        fill = [x for x in xs if BODY[r, x] != OUT]
        if not fill: continue
        in_hi, in_lo = max(fill), min(fill)       # innermost non-outline hair pixels
        for xd in range(min(lo, lo + dx) - 1, max(hi, hi + dx) + 2):
            xsrc = xd - dx
            if side < 0:
                if xsrc > hi: xsrc = in_hi
                if xsrc < lo: continue
            else:
                if xsrc < lo: xsrc = in_lo
                if xsrc > hi: continue
            if not row_mask[xsrc]: continue
            yy, xx = r + dy + PY, xd + PX
            if 0 <= yy < CH and 0 <= xx < CW:
                C[yy, xx] = BODY[r, xsrc]

def body(C, head=(0, 0), torso=(0, 0), skirt=(0, 0), sway=0):
    """Draw the body into canvas C (index array, -1 = transparent)."""
    M = MASKS
    _paste(C, UNDER, UNDER >= 0, *skirt)            # underpaint rides with the skirt/waist
    _hair(C, M['hl'], 26, 50, inner=15, side=-1, top_off=head, bot_off=skirt, sway=sway)
    _hair(C, M['hr'], 14, 44, inner=40, side=+1, top_off=head, bot_off=skirt, sway=sway)
    _paste(C, BODY, M['legs'], 0, 0)
    _paste(C, BODY, M['skirt'], *skirt)
    _paste(C, BODY, M['torso'], *torso)
    _paste(C, BODY, M['head'], *head)

# ---------------------------------------------------------------- parametric parts
V = lambda x, y: np.array([x, y], float)

class Canvas:
    def __init__(self):
        self.C = np.full((CH, CW), -1)
        self._part = None
    def put(self, x, y, c):
        yy, xx = y + PY, x + PX
        if 0 <= yy < CH and 0 <= xx < CW:
            self.C[yy, xx] = c
            if self._part is not None: self._part[yy, xx] = True
    def fill(self, box, fn):
        x0, y0, x1, y1 = box
        for y in range(int(np.floor(y0)), int(np.ceil(y1)) + 1):
            for x in range(int(np.floor(x0)), int(np.ceil(x1)) + 1):
                c = fn(V(x + 0.5, y + 0.5))
                if c is not None: self.put(x, y, c)
    def part(self, box, fn, outline=True):
        """Draw one part and give it its own 1-px outline against what is behind."""
        self._part = np.zeros(self.C.shape, bool)
        self.fill(box, fn)
        m = self._part; self._part = None
        if outline:
            ring = ndimage.binary_dilation(m) & ~m
            self.C[ring] = OUT
        return m

def seg(p, a, b):
    ab = b - a; L2 = ab @ ab
    t = 0.0 if L2 == 0 else float(np.clip((p - a) @ ab / L2, 0, 1)); q = a + t * ab
    return np.linalg.norm(p - q), t, p - q

def arm(cv, S, E, elbow=None, sleeve=7.0, rs=2.7, ra=1.6):
    """Shoulder S -> (elbow) -> hand E. The first `sleeve` px from the shoulder are
    the white puffed sleeve with a purple cuff; the rest is skin (3 px wide)."""
    S = V(*S); E = V(*E)
    pts = [S] + ([V(*elbow)] if elbow is not None else []) + [E]
    segs = list(zip(pts[:-1], pts[1:]))
    # sleeve end point along the polyline
    rem = sleeve; M = S; sleeve_segs = []
    for a, b in segs:
        L = np.linalg.norm(b - a)
        if rem <= 0: break
        if L >= rem:
            M = a + (b - a) * rem / L; sleeve_segs.append((a, M)); rem = 0
        else:
            sleeve_segs.append((a, b)); rem -= L; M = b
    def shade_normal(a, b):
        dv = (b - a) / max(np.linalg.norm(b - a), 1e-9); nr = V(-dv[1], dv[0])
        if nr[1] < 0 or (abs(nr[1]) < 1e-9 and nr[0] < 0): nr = -nr
        return nr        # points down / away from the light (upper-left light)
    def f(p):
        # skin segments (from sleeve end to hand)
        started = False
        for a, b in segs:
            # portion of this segment beyond M
            d, t, off = seg(p, a, b)
            if d <= ra:
                # is the closest point beyond the sleeve?
                q = p - off
                if _beyond(q, pts, M):
                    return SKS if off @ shade_normal(a, b) > 0.6 else SK
        for i, (a, b) in enumerate(sleeve_segs):
            d, t, off = seg(p, a, b)
            if d <= rs:
                s = off @ shade_normal(a, b)
                total = sum(np.linalg.norm(bb - aa) for aa, bb in sleeve_segs)
                along = sum(np.linalg.norm(bb - aa) for aa, bb in sleeve_segs[:i]) + t * np.linalg.norm(b - a)
                if along > total - 1.3:
                    return TRIM if s <= 0.8 else TRIM2
                return WHITE if s < -0.5 else (WHITE2 if s < 0.8 else LAV2)
        return None
    allp = np.array(pts)
    return cv.part((allp[:, 0].min() - 4, allp[:, 1].min() - 4, allp[:, 0].max() + 4, allp[:, 1].max() + 4), f)

def _beyond(q, pts, M):
    """True if point q (on the polyline) lies past the sleeve end M."""
    acc = 0; mpos = None; qpos = None; best_q = 1e9; best_m = 1e9
    for a, b in zip(pts[:-1], pts[1:]):
        L = np.linalg.norm(b - a)
        for pt, which in ((q, 'q'), (M, 'm')):
            d, t, _ = seg(pt, a, b)
            if which == 'q' and d < best_q: best_q = d; qpos = acc + t * L
            if which == 'm' and d < best_m: best_m = d; mpos = acc + t * L
        acc += L
    return qpos >= mpos - 1e-6

def fist(cv, c):
    c = V(*c)
    def f(p):
        q = p - c
        if np.linalg.norm(q) > 3.0: return None
        return SKS if (q[0] + q[1]) > 1.6 else SK
    return cv.part((c[0] - 4, c[1] - 4, c[0] + 4, c[1] + 4), f)

class Sword:
    """Same sword every frame: blade 76 long, 10 wide; guard 18 wide; grip from the
    guard to the pommel 27 px. `H` is the hand nearest the guard."""
    L = 76; HW = 5.0
    def __init__(self, theta, H):
        th = np.radians(theta)
        self.d = V(np.cos(th), -np.sin(th)); self.n = V(np.sin(th), np.cos(th))
        self.H = V(*H); self.G = self.H + 6 * self.d; self.P0 = self.H - 21 * self.d
        self.B0 = self.G + 1.7 * self.d
        self.theta = theta
    @property
    def tip(self): return self.B0 + self.L * self.d
    def grip(self, cv):
        d, n, G, P0 = self.d, self.n, self.G, self.P0
        def f(p):
            dist, t, off = seg(p, P0, G)
            if dist <= 1.25:
                u = (p - G) @ d
                return METAL if int(np.floor(u)) % 2 else CORE1
            q = p - (P0 - 1.5 * d); u = q @ d; v = q @ n
            if abs(u) + abs(v) <= 1.2: return GEM
            if abs(u) + abs(v) <= 2.9: return METAL_L if v < 0 else METAL
            return None
        pts = np.array([P0 - 5 * d, G + 3 * d]); pad = 5
        return cv.part((pts[:, 0].min() - pad, pts[:, 1].min() - pad, pts[:, 0].max() + pad, pts[:, 1].max() + pad), f)
    def guard(self, cv):
        d, n, G = self.d, self.n, self.G
        def f(p):
            q = p - G; u = q @ d; v = q @ n
            if abs(u) + abs(v) <= 1.5: return GEM if abs(u) + abs(v) <= 0.8 else GEM2
            if abs(u) + abs(v) <= 3.2: return METAL_L if u > 0.4 else METAL
            if abs(u) <= 1.5 and abs(v) <= 9: return METAL_L if u > 0.6 else (METAL_D if u < -0.6 else METAL)
            if abs(u) <= 0.6 and abs(v) <= 10.2: return METAL
            return None
        return cv.part((G[0] - 11, G[1] - 11, G[0] + 11, G[1] + 11), f)
    def blade(self, cv, clip_row=None, flat=None):
        d, n, B0, L, HW = self.d, self.n, self.B0, self.L, self.HW
        PXS = max(abs(n[0]), abs(n[1])); BEV = 2.0 * PXS; FH = 0.5 * PXS
        def f(p):
            if clip_row is not None and p[1] > clip_row + 1: return None
            q = p - B0; u = q @ d; v = q @ n
            if u < 0 or u > L: return None
            hw = HW if u < L - 10 else HW * (L - u) / 10
            if abs(v) > hw: return None
            if flat is not None: return flat
            if v + hw < BEV: return BLADE_L
            if hw - v < BEV: return BLADE_D
            fv = 0.25
            for gu in (15, 62):
                g = abs(u - gu) + abs(v - fv)
                if g <= 0.75: return GEM
                if g <= 1.5: return GEM2
            if -FH <= v - fv < FH and u < L - 12: return FULLER
            return CORE1 if v < fv else CORE2
        tip = self.tip
        box = (min(B0[0], tip[0]) - 7, min(B0[1], tip[1]) - 7, max(B0[0], tip[0]) + 7, max(B0[1], tip[1]) + 7)
        return cv.part(box, f)

def fill_holes(C):
    """Fill transparent pixels that are enclosed (not connected to the canvas edge)
    with the most common neighbouring colour, so they never get outlined."""
    a = C >= 0
    ext = ndimage.binary_fill_holes(a)
    holes = ext & ~a
    for _ in range(4):
        if not holes.any(): break
        ys, xs = np.nonzero(holes)
        for y, x in zip(ys, xs):
            nb = C[max(y - 1, 0):y + 2, max(x - 1, 0):x + 2].ravel()
            nb = nb[(nb >= 0) & (nb != OUT)]
            if len(nb):
                v, k = np.unique(nb, return_counts=True); C[y, x] = v[k.argmax()]
        holes = ext & ~(C >= 0)
    return C

def finish(C, clip_row=FEET_ROW):
    """Fill enclosed holes, add the silhouette outline against the exterior, then
    remove everything below the ground line so the blade reads as buried (no outline
    is drawn along the cut)."""
    fill_holes(C)
    a = C >= 0
    ring = ndimage.binary_dilation(a) & ~a
    C[ring] = OUT
    C[clip_row + 1 + PY:, :] = -1
    return C

def to_rgba(C, pal=PAL):
    a = C >= 0
    img = np.zeros(C.shape + (4,), np.uint8)
    img[a, :3] = pal[C[a]].round(); img[a, 3] = 255
    return img
