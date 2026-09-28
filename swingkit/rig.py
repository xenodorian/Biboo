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
# Step 23: wide canvas so a sword pointed backwards over the head is never clipped.
PX, PY = 104, 124                        # sprite (x,y) -> canvas (x+PX, y+PY)
CW, CH = 320, 224
FEET_ROW = 81                            # sprite row of the boot soles

# palette indices used by the parametric parts
OUT, SK, SKS = 0, 17, 14
WHITE, WHITE2, LAV, LAV2 = 19, 18, 16, 15
TRIM, TRIM2 = 10, 7                      # sleeve cuff; retoned to the dress below
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

def _underskirt():
    """Shadowed inside of the skirt, filling the hem notches the fixed thighs used to
    occupy. Drawn behind the legs, so it only shows where a bent thigh has moved away."""
    u = np.full(BODY.shape, -1)
    sk = MASKS['skirt']
    cols = [x for x in range(BODY.shape[1]) if sk[:, x].any()]
    bottom = {x: int(np.nonzero(sk[:, x])[0].max()) for x in cols}
    for x in cols:
        win = [bottom[c] for c in range(x - 6, x + 7) if c in bottom]
        target = min(max(win), 56)
        for y in range(bottom[x] + 1, target + 1):
            u[y, x] = 5 if y > bottom[x] + 1 else 4
    return u

UNDERSKIRT = _underskirt()

# ---------------------------------------------------------------- hair and dress tones
# User request (2026-09-28): the long hair and the dress shared the purple indices 5, 7, 8, 9, 10
# (the eyes and sword gems use them too), so they read as one mass. As in the base painting, the
# hair is a mid-toned pinkish purple and the dress is white with dark, saturated violet. The shared
# entries stay as they are; hair and dress pixels are remapped to added entries.
_HAIR_SRC, _DRESS_SRC = (5, 7, 8, 9, 10), (5, 7, 8, 9, 10)
_HAIR_RGB = [(100, 76, 138), (124, 98, 160), (146, 122, 164), (160, 132, 186), (172, 145, 200)]
_DRESS_RGB = [(48, 38, 104), (62, 50, 130), (84, 72, 146), (76, 62, 158), (98, 82, 184)]
HAIR_TONE = {c: len(PAL) + k for k, c in enumerate(_HAIR_SRC)}
DRESS_TONE = {c: len(PAL) + len(_HAIR_SRC) + k for k, c in enumerate(_DRESS_SRC)}
PAL = np.vstack([PAL, np.array(_HAIR_RGB, float), np.array(_DRESS_RGB, float)])

def _retone(a, table, mask):
    out = a.copy()
    for src, dst in table.items():
        out[mask & (a == src)] = dst
    return out

def _hair_region():
    Y, X = np.mgrid[0:BODY.shape[0], 0:BODY.shape[1]]
    eyes = (Y >= EYE_ROWS[0] - 1) & (Y <= EYE_ROWS[1] + 1) & (X >= EYE_X[0] - 1) & (X <= EYE_X[1] + 1)
    return MASKS['hl'] | MASKS['hr'] | (MASKS['head'] & ~eyes)

EYE_ROWS, EYE_X = (18, 20), (22, 33)              # eye block (moved by _gaze), kept out of the hair tone
BODY = _retone(BODY, HAIR_TONE, _hair_region())
BODY = _retone(BODY, DRESS_TONE, MASKS['torso'] | MASKS['skirt'])
UNDER = _retone(UNDER, HAIR_TONE, UNDER == 9)          # hair behind the head and beside the torso
UNDER = _retone(UNDER, DRESS_TONE, UNDER == 7)         # waist / dress
UNDERSKIRT = _retone(UNDERSKIRT, DRESS_TONE, UNDERSKIRT >= 0)
TRIM, TRIM2 = DRESS_TONE[TRIM], DRESS_TONE[TRIM2]

def _paste(C, src, mask, dx, dy):
    ys, xs = np.nonzero(mask)
    C[ys + dy + PY, xs + dx + PX] = src[ys, xs]

def _hair(C, mask, r0, r1, inner, side, top_off, bot_off, sway, lift=0.0):
    """Bend a long-hair mass. Row r moves by a blend of the offset of what it hangs
    from (top_off) and what it rests against (bot_off), plus sway (sideways) and lift
    (upward, positive) that grow toward the tips. Rows are mapped in order; if rows
    spread apart, the gap is filled by repeating the row above, so no holes open.
    Columns beyond the inner boundary are clamped so no gap opens against the body.
    side=-1 hair hangs on the left (inner boundary is its right edge), +1 on the right."""
    prev_dest = None
    for r in range(r0, r1 + 1):
        b = (r - r0) / max(r1 - r0, 1)
        dx = int(round(top_off[0] * (1 - b) + bot_off[0] * b + sway * b ** 1.4))
        dy = int(round(top_off[1] * (1 - b) + bot_off[1] * b - lift * b ** 1.5))
        dest = r + dy
        row_mask = mask[r]
        if not row_mask.any():
            prev_dest = dest; continue
        xs = np.nonzero(row_mask)[0]
        lo, hi = xs.min(), xs.max()
        fill = [x for x in xs if BODY[r, x] != OUT]
        if not fill:
            prev_dest = dest; continue
        in_hi, in_lo = max(fill), min(fill)       # innermost non-outline hair pixels
        rows_out = [dest] if prev_dest is None or dest <= prev_dest + 1 else list(range(prev_dest + 1, dest + 1))
        for yd in rows_out:
            for xd in range(min(lo, lo + dx) - 1, max(hi, hi + dx) + 2):
                xsrc = xd - dx
                if side < 0:
                    if xsrc > hi: xsrc = in_hi
                    if xsrc < lo: continue
                else:
                    if xsrc < lo: xsrc = in_lo
                    if xsrc > hi: continue
                if not row_mask[xsrc]: continue
                yy, xx = yd + PY, xd + PX
                if 0 <= yy < CH and 0 <= xx < CW:
                    C[yy, xx] = BODY[r, xsrc]
        prev_dest = dest

# ---------------------------------------------------------------- legs
# Neutral joint positions fitted to the original sprite (sprite space); the ankles sit low,
# just above the heel (step 21). Thigh and shin
# lengths are derived from these once and never change.
LEG_NEUTRAL = dict(
    left=dict(hip=(23.4, 47.0), knee=(12.5, 60.0), ankle=(4.2, 75.5), side=+1,
              r_thigh=4.3, r_shaft=4.0, toe_reach=9.0, heel_flare=0.9),
    right=dict(hip=(42.0, 51.0), knee=(53.1, 62.0), ankle=(60.9, 74.5), side=+1,
               r_thigh=4.1, r_shaft=3.7, toe_reach=13.0, heel_flare=0.0),
)
# Step 19: the knee pivot sits higher than the boot top (a natural knee), so the shin shows skin
# between the knee and the sock cuff. KNEE_RAISE moves each knee up along its thigh; the boot top
# stays where the fitted knee was.
KNEE_RAISE = dict(left=4.5, right=4.0)
for _k, _v in LEG_NEUTRAL.items():
    _h, _kn = np.array(_v['hip']), np.array(_v['knee'])
    _v['boot_top'] = tuple(_kn)
    _v['knee'] = tuple(_kn + (_h - _kn) / np.linalg.norm(_h - _kn) * KNEE_RAISE[_k])
    _v['shin_skin'] = KNEE_RAISE[_k]
LEG_LEN = {k: (float(np.hypot(*np.subtract(v['knee'], v['hip']))),
               float(np.hypot(*np.subtract(v['ankle'], v['knee'])))) for k, v in LEG_NEUTRAL.items()}
SOCK_LEN = 3.2

# Boot feet are drawn together with the shin as one shape (see _foot_mask), so the ankle is a
# continuous curve. Both feet point forward (toward the strike, +x). Heel-up tilts the sole,
# toe planted, with the ankle raised by HEEL_UP_ANKLE_LIFT.
HEEL_UP_ANKLE_LIFT = 2.0      # the ankle rises with the heel (sprite px)
HEEL_UP_TILT = 3.0            # heel raised this much above the toe when heel_up

def _foot_mask(ankle, nb, rb, heel_up, ankle_to_sole, toe_reach=9.0, heel_flare=0.9):
    """Pixels of the boot foot for a shin ending at `ankle` with half-width rb and normal nb.
    Returns (mask, sole_y_at(x)) in canvas coordinates."""
    from PIL import Image, ImageDraw
    A = np.asarray(ankle, float)
    e1, e2 = A + nb * rb, A - nb * rb
    back, front = (e1, e2) if e1[0] < e2[0] else (e2, e1)
    sole_toe = A[1] + ankle_to_sole + (HEEL_UP_ANKLE_LIFT if heel_up else 0.0)
    sole_heel = sole_toe - (HEEL_UP_TILT if heel_up else 0.0)
    x_heel = back[0] - 0.4
    x_toe = A[0] + toe_reach
    poly = [back + (0, -0.8),
            (x_heel - heel_flare, (back[1] + sole_heel) / 2),
            (x_heel - 0.4 * (heel_flare > 0), sole_heel),
            (x_toe - 1.0, sole_toe),
            (x_toe + 0.4, sole_toe - 1.8),
            (x_toe - 1.8, sole_toe - 3.6),
            (front[0] + 2.0, A[1] + 1.2),
            front + (0, -0.8)]
    img = Image.new('L', (CW, CH), 0)
    ImageDraw.Draw(img).polygon([(x + PX, y + PY) for x, y in poly], fill=1)
    def sole_y(x):
        t = min(max((x - x_heel) / max(x_toe - x_heel, 1e-6), 0.0), 1.0)
        return sole_heel + (sole_toe - sole_heel) * t
    return np.asarray(img).astype(bool), sole_y, x_toe

def leg_ik(hip, ankle, L1, L2, side):
    """Two-bone IK: knee position for fixed thigh/shin lengths. `side` picks which way
    the knee bends (outward). If the ankle is out of reach the leg is fully straight."""
    hip = np.asarray(hip, float); ankle = np.asarray(ankle, float)
    d = ankle - hip; dist = float(np.hypot(*d))
    dist_c = min(max(dist, abs(L1 - L2) + 1e-6), L1 + L2 - 1e-6)
    a = (L1 * L1 - L2 * L2 + dist_c * dist_c) / (2 * dist_c)
    hgt = np.sqrt(max(L1 * L1 - a * a, 0.0))
    u = d / max(dist, 1e-9); perp = np.array([-u[1], u[0]])
    # perp points to the right of the hip->ankle direction; flip so knee goes outward
    knee = hip + u * a - perp * hgt * side * np.sign(u[1] if abs(u[1]) > 1e-9 else 1)
    return knee

def draw_leg(cv, name, hip=None, ankle=None, heel_up=False):
    v = LEG_NEUTRAL[name]; L1, L2 = LEG_LEN[name]
    hip = np.array(v['hip'] if hip is None else hip, float)
    ankle = np.array(v['ankle'] if ankle is None else ankle, float)
    reach = float(np.hypot(*(ankle - hip)))
    if reach > L1 + L2:          # out of reach: the foot is pulled toward the hip, never stretched
        ankle = hip + (ankle - hip) / reach * (L1 + L2 - 1e-6)
    knee = leg_ik(hip, ankle, L1, L2, v['side'])
    rt, rb = v['r_thigh'], v['r_shaft']
    sh_dir = (ankle - knee) / max(np.linalg.norm(ankle - knee), 1e-9)
    sock_end = knee + sh_dir * SOCK_LEN
    def normal(a, b):
        dv = (b - a) / max(np.linalg.norm(b - a), 1e-9); nr = V(-dv[1], dv[0])
        return nr if nr[0] > 0 else -nr          # points to the viewer's right
    nt = normal(hip, knee); nb = normal(knee, ankle)
    def f(p):
        # shin / sock measured along the shin axis: a clean band, no rounded cap at the knee
        q = p - knee; u = float(q @ sh_dir); s = float(q @ nb)
        skin = v['shin_skin']
        if 0.0 <= u <= L2 and abs(s) <= rb + (0.6 if skin <= u < skin + SOCK_LEN else 0):
            if u < skin:                              # bare shin between the knee and the sock
                return SKS if s > rb * 0.5 else SK
            u2 = u - skin
            if u2 < SOCK_LEN:                         # small frilled cuff at the boot top
                if u2 > SOCK_LEN - 1.0:
                    return 16 if int(round(p[0] + p[1])) % 2 else 18
                return 16 if s > 1.8 else 19
            if abs(s) < 1.1 and int(np.floor(u2)) % 3 == 0: return 4   # laces
            return 1 if s > 1.2 else (3 if s < -2.6 else 2)
        d, t, off = seg(p, hip, knee)
        if d <= rt:
            if t < 0.3: return SKS                    # shadow under the skirt
            return SK
        return None
    pts = np.array([hip, knee, ankle])
    m = cv.part((pts[:, 0].min() - 6, pts[:, 1].min() - 6, pts[:, 0].max() + 6, pts[:, 1].max() + 6), f, outline=False)
    # foot: one shape with the shin, so the ankle is a continuous curve
    # the flat sole's bottom edge sits on the feet row in the neutral pose, for each leg
    ankle_to_sole = (FEET_ROW - 0.5) - v['ankle'][1]
    fm, sole_y, x_toe = _foot_mask(ankle, nb, rb, heel_up, ankle_to_sole, v['toe_reach'], v['heel_flare'])
    body_part = fm & ~m
    ys, xs = np.nonzero(body_part)
    for yy, xx in zip(ys, xs):
        x, y = xx - PX + 0.5, yy - PY + 0.5
        sy = sole_y(x)
        if y > sy - 2.0: c = 1                                   # sole
        elif x > x_toe - 5.0 and y < sy - 2.6: c = 3             # lit toe cap
        else: c = 2
        cv.C[yy, xx] = c
    m = m | body_part
    ring = ndimage.binary_dilation(m) & ~m
    cv.C[ring & ((cv.C < 0) | ~m)] = OUT
    return dict(hip=hip, knee=knee, ankle=ankle, mask=m, heel_up=heel_up)

SKIRT_R0, SKIRT_R1, SKIRT_CX = 40, 57, 33.0

def _deform_paste(C, src, mask, off, lift=0.0, trail=0.0, flare=0.0):
    """Paste a skirt-like layer with cloth motion below row SKIRT_R0. Destination pixels
    are inverse-mapped (nearest sample), so no holes can open. lift > 0 raises the hem,
    trail shifts the hem sideways, flare spreads both sides outward. Returns the placed mask."""
    placed = np.zeros(C.shape, bool)
    ys, xs = np.nonzero(mask)
    rigid = ys < SKIRT_R0
    C[ys[rigid] + off[1] + PY, xs[rigid] + off[0] + PX] = src[ys[rigid], xs[rigid]]
    placed[ys[rigid] + off[1] + PY, xs[rigid] + off[0] + PX] = True
    if not (~rigid).any(): return placed
    x0, x1 = xs.min() - 5, xs.max() + 6
    span = SKIRT_R1 - SKIRT_R0
    for rd in range(SKIRT_R0, SKIRT_R1 + 3):
        b = min(max((rd - SKIRT_R0) / span, 0.0), 1.2)
        rs = SKIRT_R0 + (rd - SKIRT_R0) * span / max(span - lift, 1e-6)
        ri = int(round(rs))
        if ri < SKIRT_R0 or ri >= mask.shape[0]: continue
        for xd in range(x0, x1):
            side = np.sign(xd - SKIRT_CX)
            xsrc = xd - (trail * b ** 1.3 + flare * b * side)
            xi = int(round(xsrc))
            if 0 <= xi < mask.shape[1] and mask[ri, xi]:
                yy, xx = rd + off[1] + PY, xd + off[0] + PX
                if 0 <= yy < CH and 0 <= xx < CW:
                    C[yy, xx] = src[ri, xi]; placed[yy, xx] = True
    return placed

TORSO_TOP, WAIST = 26, 33.5

def torso_shear(lean, row):
    """Horizontal shift of a torso row for a given lean (px at the head): 0 at the waist,
    half the lean at the top of the torso."""
    return 0.5 * lean * (WAIST - row) / (WAIST - TORSO_TOP)

# Step 26: waist bend. The upper body (torso, shoulders, head) pivots at the waist. bend is in
# degrees, positive = forward (toward the strike, the top moves to +x). The torso pixels are
# rotated with a RotSprite-style resample (scale2x three times, then nearest), the head is moved
# rigidly (never rotated, so the face is untouched) along the arc of HEAD_ANCHOR.
PIVOT = np.array([28.0, WAIST])
HEAD_ANCHOR = np.array([28.0, 19.0])     # the head rides the arc of this point

def bend_point(p, bend):
    """Where sprite point p (on the upper body) goes when the upper body bends."""
    if not bend: return np.asarray(p, float)
    t = np.radians(bend); c, s = np.cos(t), np.sin(t)
    q = np.asarray(p, float) - PIVOT
    return PIVOT + np.array([c * q[0] - s * q[1], s * q[0] + c * q[1]])

def upper_point(p, lean=0.0, bend=0.0, torso=(0, 0)):
    """Final sprite position of a point on the torso: bend, then lean shear, then torso offset."""
    q = bend_point(p, bend)
    return np.array([q[0] + torso[0] + torso_shear(lean, p[1]), q[1] + torso[1]])

def head_offset(head, lean=0.0, bend=0.0):
    """Whole-pixel head offset including lean and bend (the head moves as one rigid piece)."""
    d = bend_point(HEAD_ANCHOR, bend) - HEAD_ANCHOR
    return (int(head[0] + round(lean) + round(d[0])), int(head[1] + round(d[1])))

def _scale2x(A):
    """EPX / Scale2x on an index image (-1 = transparent)."""
    P = np.pad(A, 1, mode='edge')
    B, D, F, H = P[:-2, 1:-1], P[1:-1, :-2], P[1:-1, 2:], P[2:, 1:-1]
    E = A
    out = np.empty((A.shape[0] * 2, A.shape[1] * 2), A.dtype)
    ok = (B != H) & (D != F)
    out[0::2, 0::2] = np.where(ok & (D == B), D, E)
    out[0::2, 1::2] = np.where(ok & (B == F), F, E)
    out[1::2, 0::2] = np.where(ok & (D == H), D, E)
    out[1::2, 1::2] = np.where(ok & (H == F), F, E)
    return out

def rotate_layer(src, mask, bend, pad=8):
    """Rotate the masked pixels of src about PIVOT by bend degrees (positive = top moves
    to +x). Returns (ys, xs, colours) in sprite space."""
    ys, xs = np.nonzero(mask)
    if not bend:
        return ys, xs, src[ys, xs]
    y0, y1, x0, x1 = ys.min() - pad, ys.max() + pad, xs.min() - pad, xs.max() + pad
    tile = np.full((y1 - y0 + 1, x1 - x0 + 1), -1)
    tile[ys - y0, xs - x0] = src[ys, xs]
    big = _scale2x(_scale2x(_scale2x(tile)))
    t = np.radians(bend); c, s = np.cos(t), np.sin(t)
    Y, X = np.mgrid[y0:y1 + 1, x0:x1 + 1]
    qx, qy = X + 0.5 - PIVOT[0], Y + 0.5 - PIVOT[1]
    sx = c * qx + s * qy + PIVOT[0]; sy = -s * qx + c * qy + PIVOT[1]   # inverse rotation
    bx = np.floor((sx - x0) * 8).astype(int); by = np.floor((sy - y0) * 8).astype(int)
    ok = (bx >= 0) & (by >= 0) & (bx < big.shape[1]) & (by < big.shape[0])
    col = np.full(Y.shape, -1); col[ok] = big[by[ok], bx[ok]]
    sel = col >= 0
    return Y[sel], X[sel], col[sel]


def _gaze(C, head, gaze):
    """Head direction without redrawing the face: the eye block (rows 18-20) is moved as a
    whole by one row. gaze=-1 looks up (chin up; the row below fills with skin),
    +1 looks down (chin tucked; the row above fills with the bangs)."""
    if gaze == 0: return
    (r0, r1), (x0, x1) = EYE_ROWS, EYE_X
    xs = np.arange(x0, x1 + 1) + head[0] + PX
    def row(r): return r + head[1] + PY
    block = [C[row(r), xs].copy() for r in range(r0, r1 + 1)]
    if gaze < 0:
        filler = C[row(r1 + 1), xs].copy()
        for k, r in enumerate(range(r0 - 1, r1)): C[row(r), xs] = block[k]
        C[row(r1), xs] = filler
    else:
        filler = C[row(r0 - 1), xs].copy()
        for k, r in enumerate(range(r0 + 1, r1 + 2)): C[row(r), xs] = block[k]
        C[row(r0), xs] = filler

def draw_hair_pass(C, head=(0, 0), skirt=(0, 0), sway=0, lean=0.0, bend=0.0, hair_lift=0.0):
    """Underpaint and the long hair, drawn first so the hair sits behind everything else."""
    M = MASKS
    head = head_offset(head, lean, bend)
    _paste(C, UNDER, UNDER >= 0, *skirt)            # underpaint rides with the skirt/waist
    _hair(C, M['hl'], 26, 50, inner=15, side=-1, top_off=head, bot_off=skirt, sway=sway, lift=hair_lift)
    _hair(C, M['hr'], 14, 44, inner=40, side=+1, top_off=head, bot_off=skirt, sway=sway, lift=hair_lift)

def draw_torso_pass(C, torso=(0, 0), lean=0.0, bend=0.0):
    """The upper body (bodice): bends at the waist, then leans row by row."""
    ys, xs, cols = rotate_layer(BODY, MASKS['torso'], bend)
    for y, x, c in zip(ys, xs, cols):
        dx = torso[0] + int(round(torso_shear(lean, y)))
        C[y + torso[1] + PY, x + dx + PX] = c

def body(C, head=(0, 0), torso=(0, 0), skirt=(0, 0), sway=0, legs=None, lean=0.0, cloth=None, hair_lift=0.0,
         gaze=0, bend=0.0, draw_head=True, draw_hair=True, draw_torso=True):
    """Draw the body into canvas C (index array, -1 = transparent). `legs` maps
    'left'/'right' to dict(hip=..., ankle=...) overrides; default is the neutral stance.
    With draw_head=False the head is left for a later pass (see draw_head), so arms can be
    layered behind it; with draw_hair=False the long hair is left for draw_hair_pass, and with
    draw_torso=False the upper body is left for draw_torso_pass."""
    M = MASKS
    if draw_hair:
        draw_hair_pass(C, head, skirt, sway, lean, bend, hair_lift)
    head = head_offset(head, lean, bend)            # head leans and bends as one rigid piece
    cloth = cloth or {}
    _deform_paste(C, UNDERSKIRT, UNDERSKIRT >= 0, skirt, **cloth)
    cv = Canvas(); cv.C = C
    legs = legs or {}
    info = {}
    for name in ('left', 'right'):
        info[name] = draw_leg(cv, name, **legs.get(name, {}))
    sk = _deform_paste(C, BODY, M['skirt'], skirt, **cloth)
    # hem shadow: the row of leg directly below the skirt gets a shade tone
    legm = info['left']['mask'] | info['right']['mask']
    below = np.zeros_like(sk); below[1:] = sk[:-1]
    edge = below & legm & ~sk
    shade = {SK: SKS, SKS: SKS, WHITE: 13, WHITE2: 13, LAV: 13, 13: 13}
    for y, x in zip(*np.nonzero(edge)):
        C[y, x] = shade.get(int(C[y, x]), OUT)
    if draw_torso:
        draw_torso_pass(C, torso, lean, bend)
    info['head'] = head
    if draw_head:
        draw_head_pass(C, head, gaze)
    return info

def draw_head_pass(C, head, gaze=0):
    """Paste the head at its final whole-pixel offset (from body()['head']) and set the gaze."""
    _paste(C, BODY, MASKS['head'], *head)
    _gaze(C, head, gaze)

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

def arm_ik(S, H, L1, L2, prefer='down'):
    """Two-bone arm IK: elbow for fixed upper-arm (L1) and forearm (L2) lengths. prefer='down'
    takes the lower elbow, 'fwd' the elbow further toward the strike (+x, used when the arms are
    raised over the head). If the hand is out of reach the arm is straight toward it."""
    S = np.asarray(S, float); H = np.asarray(H, float)
    d = H - S; dist = float(np.hypot(*d))
    u = d / max(dist, 1e-9)
    if dist >= L1 + L2: return S + u * L1
    dist = max(dist, abs(L1 - L2) + 1e-6)
    a = (L1 * L1 - L2 * L2 + dist * dist) / (2 * dist)
    h = np.sqrt(max(L1 * L1 - a * a, 0.0))
    perp = np.array([-u[1], u[0]])
    e1, e2 = S + u * a + perp * h, S + u * a - perp * h
    if prefer == 'fwd': return e1 if e1[0] >= e2[0] else e2
    return e1 if e1[1] >= e2[1] else e2

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
