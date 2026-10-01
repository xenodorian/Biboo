"""Boar Lord rig: cleans the rider and splits the arm and spear out of the still so the spear attack can be animated.

Input : clean/creature8.png  (the Boar Lord still, 248x226, from clean.py)
Output: clean/boar_fixed.png  the still with the white left over from the background cut removed from the RIDER only
        clean/boar_body.png   the still without the arm and spear, with the cut-out filled from the pixels around it
        clean/boar_arm.png    the arm and spear on their own, same canvas, so they can be rotated about PIVOT
        clean/boar_preview.png a contact sheet to check the cuts by eye
Everything is in the still's own pixels (x right, y down).  The art faces LEFT.
Run: python3 boar_rig.py   (from tools/creatures)"""
import math, os
from collections import deque
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'clean', 'creature8.png')

RIDER = (100, 0, 216, 142)                 # x0, y0, x1, y1: the red and gray rider. The boar's white tusks (x < 70) and the white spear tip (y > 195) are outside it
POLE_A = (136.6, 221.0)                    # the spear tip: the white point low on the boar's front leg (the weapon's business end)
POLE_B = (233.0, 21.0)                     # the far end of the pole, under the red pennant
POLE_R = 3.8                               # pole half width in pixels, outline included
PENNANT = [(205, 8), (252, 8), (252, 96), (222, 96), (205, 70)]          # the red pennant at the top of the pole
ARM = [(168, 64), (206, 64), (208, 100), (190, 103), (176, 95), (168, 82)]  # the sleeve that holds the pole
PIVOT = (190, 96)                          # the grip: the arm and spear turn about this point
TIP = (139.0, 216.0)           # where the white point is drawn; the hit box follows it


def lum(p): return p[0] + p[1] + p[2]
def is_white(p): return p[3] > 0 and min(p[:3]) >= 190 and max(p[:3]) - min(p[:3]) <= 30
def is_dark(p): return p[3] > 0 and lum(p) < 150


def is_brown(p): return p[3] > 0 and p[0] > p[1] > p[2] and p[1] - p[2] > 12
def not_red(p): return is_brown(p) or p[2] > p[0] + 8          # brown fur or gray-blue armour


def inpaint(img, todo, avoid_dark=True, no_brown=False):
    """Fill every pixel in `todo` (a set of (x, y)) with the colour of the nearest opaque pixel that is not itself in `todo`."""
    px = img.load(); w, h = img.size
    def ok(x, y, strict):
        if (x, y) in todo or not (0 <= x < w and 0 <= y < h): return False
        p = px[x, y]
        return p[3] > 0 and not (strict and is_dark(p)) and not (no_brown and is_brown(p))
    for strict in ((True, False) if avoid_dark else (False,)):
        q = deque(); got = {}
        for (x, y) in todo:
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                if ok(x + dx, y + dy, strict):
                    got[(x, y)] = px[x + dx, y + dy]; q.append((x, y)); break
        while q:
            x, y = q.popleft()
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                n = (x + dx, y + dy)
                if n in todo and n not in got: got[n] = got[(x, y)]; q.append(n)
        for k, v in got.items():
            px[k] = v; todo = todo - {k}
        if not todo: break
    return img


def fill_mode(img, todo, radius=4, reject=None):
    """Fill each pixel of `todo` with the most common colour among the nearby pixels that are not being filled (not dark, not rejected); repeat inwards."""
    from collections import Counter
    px = img.load(); w, h = img.size; todo = set(todo); left = set(todo)
    while left:
        got = {}
        for (x, y) in left:
            c = Counter()
            for dy in range(-radius, radius + 1):
                for dx in range(-radius, radius + 1):
                    n = (x + dx, y + dy)
                    if n in left or not (0 <= n[0] < w and 0 <= n[1] < h): continue
                    p = px[n]
                    if p[3] == 0 or is_dark(p) or (reject and reject(p)): continue
                    c[p] += 1.0 / (1 + abs(dx) + abs(dy))
            if c: got[(x, y)] = c.most_common(1)[0][0]
        if not got:
            if reject: return fill_mode(img, left, radius, None)
            return img
        for k, v in got.items(): px[k] = v
        left -= set(got)
    return img


def is_cape(p):
    return p[3] > 0 and p[0] > 140 and p[0] > p[1] + 30 and p[1] < 140 and p[2] < 150


def close_gaps(im):
    """Fill pinholes from the cut and from nearest-neighbour rotation.

    A clear pixel is filled only when opaque pixels sit on both axes around it, so a
    gap in the spear shaft closes and an outside corner of the silhouette does not."""
    from collections import Counter
    px = im.load(); w, h = im.size
    for _ in range(4):
        fix = []
        for y in range(1, h - 1):
            for x in range(1, w - 1):
                if px[x, y][3]: continue
                offs = []; cols = []; card = 0
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        if not dx and not dy: continue
                        p = px[x + dx, y + dy]
                        if p[3] > 200:
                            offs.append((dx, dy)); cols.append(p)
                            if dx == 0 or dy == 0: card += 1
                if not offs: continue
                xs = [d[0] for d in offs]; ys = [d[1] for d in offs]
                spanned = min(xs) < 0 < max(xs) and min(ys) < 0 < max(ys)
                if card >= 3 or (len(offs) >= 5 and spanned):
                    fix.append((x, y, Counter(cols).most_common(1)[0][0]))
        if not fix: break
        for x, y, c in fix: px[x, y] = c
    return im


def remove_white(im):
    """White left from the background cut, on the rider only.

    Enclosed blobs, and the dark ring that fenced them, are filled from the cape
    pixels around them (its own reds, not one flat stamp, and never the boar's brown).
    A speck sitting on the outline is filled from whatever pixel it actually touches,
    so the silhouette is not notched."""
    im = im.copy(); px = im.load(); w, h = im.size
    x0, y0, x1, y1 = RIDER
    cand = {(x, y) for y in range(y0, y1) for x in range(x0, x1) if is_white(px[x, y])}
    seen = set(); fill = set(); specks = set()
    for s in cand:
        if s in seen: continue
        comp = []; q = deque([s]); seen.add(s)
        while q:
            c = q.popleft(); comp.append(c)
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    n = (c[0] + dx, c[1] + dy)
                    if n in cand and n not in seen: seen.add(n); q.append(n)
        edge = any(not (0 <= x + dx < w and 0 <= y + dy < h) or px[x + dx, y + dy][3] == 0 for x, y in comp for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
        if edge and len(comp) <= 6: specks.update(comp)
        else:
            fill.update(comp)
            for (x, y) in comp:                                     # the dark outline ring that fenced the blob in goes too
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        n = (x + dx, y + dy)
                        if n not in cand and 0 <= n[0] < w and 0 <= n[1] < h and is_dark(px[n]): fill.add(n)
    from collections import Counter
    cape = Counter(px[x, y][:3] for y in range(y0, y1) for x in range(x0, x1) if is_cape(px[x, y])).most_common(1)[0][0]
    inpaint(im, specks, avoid_dark=True)
    for k in fill: px[k] = (0, 0, 0, 0)
    fill_mode(im, fill, 6, lambda p: not is_cape(p))
    px = im.load()
    for (x, y) in fill:
        if px[x, y][3] == 0: px[x, y] = cape + (255,)
        elif any(0 <= x + dx < w and 0 <= y + dy < h and px[x + dx, y + dy][3] == 0 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
            px[x, y] = (28, 16, 24, 255)
    return im


def seg_dist(p, a, b):
    ax, ay = a; bx, by = b; px_, py_ = p
    dx, dy = bx - ax, by - ay; t = max(0, min(1, ((px_ - ax) * dx + (py_ - ay) * dy) / (dx * dx + dy * dy)))
    return math.hypot(px_ - (ax + t * dx), py_ - (ay + t * dy))


def inside(poly, x, y):
    n = len(poly); c = False
    for i in range(n):
        (x1, y1), (x2, y2) = poly[i], poly[(i + 1) % n]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1: c = not c
    return c


def split(im):
    w, h = im.size; px = im.load()
    arm = Image.new('RGBA', im.size, (0, 0, 0, 0)); body = im.copy(); ap = arm.load(); bp = body.load()
    cut = set()
    for y in range(h):
        for x in range(w):
            if px[x, y][3] == 0: continue
            if seg_dist((x, y), POLE_A, POLE_B) <= (POLE_R + 2 if y >= 205 else POLE_R) or inside(PENNANT, x, y) or inside(ARM, x, y) or (is_white(px[x, y]) and math.hypot(x - POLE_A[0], y - POLE_A[1]) <= 28):
                ap[x, y] = px[x, y]; cut.add((x, y))
    # what lies behind the cut: inside the body's outline (closed over the thin pole) it is filled from the pixels around; outside it the cut stays empty
    keep = Image.new('L', im.size, 0); kp = keep.load()
    for y in range(h):
        for x in range(w):
            if px[x, y][3] and (x, y) not in cut: kp[x, y] = 255
    from PIL import ImageFilter
    closed = keep.filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.MinFilter(9)); cp = closed.load()
    # the pole and arm leave a gap: behind it is the body (filled), or nothing (left clear)
    kept = {(x, y) for y in range(h) for x in range(w) if kp[x, y]}
    def near(x, y, d): return any((x + dx, y + dy) in kept for dx in range(-d, d + 1) for dy in range(-d, d + 1))
    fill = set()
    for (x, y) in cut:
        bp[x, y] = (0, 0, 0, 0)
        arm_part = inside(ARM, x, y) or inside(PENNANT, x, y)
        if arm_part: ok = cp[x, y] and near(x, y, 2)
        else: ok = any((x - d, y) in kept for d in range(1, 10)) and any((x + d, y) in kept for d in range(1, 10))   # the pole crosses the body here: there is body behind it
        if ok: fill.add((x, y))
    pole = {p for p in fill if seg_dist(p, POLE_A, POLE_B) <= POLE_R and not inside(ARM, *p) and not inside(PENNANT, *p)}
    low = {p for p in pole if p[1] >= 128}; high = pole - low
    def fur_at(x, y):
        if (x, y) in fill or (x, y) in cut or not (0 <= x < w and 0 <= y < h): return None
        p = bp[x, y]
        if p[3] == 0 or is_dark(p) or is_white(p): return None
        if not (p[0] > p[1] >= p[2]): return None          # the boar's brown, not the cape and not the armour
        return p
    for (x, y) in low:
        # continue the fur from above or below. Copying the pixel beside the gap
        # stamped one colour across the whole row and left a flat band.
        pick = None
        for d in range(1, 8):
            for p in (fur_at(x, y - d), fur_at(x, y + d)):
                if p is not None and (pick is None or d < pick[0]): pick = (d, p)
            if pick and pick[0] < d: break
        if pick: bp[x, y] = pick[1]; continue
        l = x
        while l >= 0 and ((l, y) in fill or (l, y) in cut or is_dark(bp[l, y]) or bp[l, y][3] == 0) and x - l < 14: l -= 1
        r = x
        while r < w and ((r, y) in fill or (r, y) in cut or is_dark(bp[r, y]) or bp[r, y][3] == 0) and r - x < 14: r += 1
        okl = l >= 0 and bp[l, y][3] > 0 and not is_dark(bp[l, y]) and (l, y) not in cut; okr = r < w and bp[r, y][3] > 0 and not is_dark(bp[r, y]) and (r, y) not in cut
        if okl and (not okr or x - l < r - x): bp[x, y] = bp[l, y]
        elif okr: bp[x, y] = bp[r, y]
    fill_mode(body, high, 4, is_white)
    fill_mode(body, fill - pole, 4, is_brown)
    # a new edge made by the cut gets the same dark outline the art has everywhere else
    for (x, y) in fill:
        if any(0 <= x + dx < w and 0 <= y + dy < h and bp[x + dx, y + dy][3] == 0 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))): bp[x, y] = (28, 16, 24, 255)
    close_gaps(body)
    return body, arm


def preview(fixed, body, arm, path):
    Z = 3; w, h = fixed.size
    out = Image.new('RGB', (w * Z * 3, h * Z), (60, 66, 80))
    for i, im in enumerate((fixed, body, arm)):
        bg = Image.new('RGBA', im.size, (60, 66, 80, 255)); bg.alpha_composite(im)
        out.paste(bg.convert('RGB').resize((w * Z, h * Z), Image.NEAREST), (i * w * Z, 0))
    d = ImageDraw.Draw(out)
    d.text((6, 4), 'white removed (rider only)', fill=(255, 255, 0)); d.text((w * Z + 6, 4), 'body, cut-out filled', fill=(255, 255, 0)); d.text((2 * w * Z + 6, 4), 'arm and spear', fill=(255, 255, 0))
    for i in range(3):
        d.ellipse([i * w * Z + PIVOT[0] * Z - 4, PIVOT[1] * Z - 4, i * w * Z + PIVOT[0] * Z + 4, PIVOT[1] * Z + 4], outline=(0, 255, 255), width=2)
        d.ellipse([i * w * Z + TIP[0] * Z - 4, TIP[1] * Z - 4, i * w * Z + TIP[0] * Z + 4, TIP[1] * Z + 4], outline=(255, 0, 255), width=2)
    out.save(path)


def make():
    raw = Image.open(SRC).convert('RGBA')
    fixed = remove_white(raw)
    body, arm = split(fixed)
    c = os.path.join(HERE, 'clean')
    fixed.save(os.path.join(c, 'boar_fixed.png')); body.save(os.path.join(c, 'boar_body.png')); arm.save(os.path.join(c, 'boar_arm.png'))
    preview(fixed, body, arm, os.path.join(c, 'boar_preview.png'))
    return fixed, body, arm


if __name__ == '__main__':
    make(); print('ok')
