"""Club Ogre: an enemy built from a real 10 frame animation (source/clubogre.gif, a 6x upscale of 155x119 pixel art).

The GIF is one loop: the club rests on the ground in a cloud of dust (frames 8, 9, 0, 1), lifts and swings back (2 to 5),
comes down on the ground (6) and hits (7). Its art faces left, like every sheet in this game.

  * idle and walk: frame 0 with the dust removed and its club rebuilt from frame 6 (repair_club), moved by the same squash and sway recipes as the other monsters (build.py)
  * smash: the real frames 2 to 9. Frame 6 (club down) is the striking frame. It lasts 200 ms and is flagged `pause`, so the
    engine counts that time as the parry window: the damage lands when the 200 ms are up (see stepEnemyCore in 11_enemies.js)
  * hurt and death: the same recipes as the other monsters, moved from the still

Scale: every native pixel is 2 sheet pixels (1 world pixel at SPRITE_SCALE 0.5), so the art is never resampled. The ogre
stands 88 world pixels tall (Perry is 81).
Run: python3 tools/creatures/build.py clubogre   (rebuilds only this monster and keeps the rest of creatures.js)
"""
import math, os
import numpy as np
from PIL import Image, ImageSequence

HERE = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.join(HERE, '..', '..', 'web')
SRC = os.path.join(HERE, 'source', 'clubogre.gif')
UP = 6                                           # the GIF is 6x the native art
K = 2                                            # sheet pixels per native pixel
DUST = {(255, 255, 255), (227, 230, 255)}        # the dust cloud's two colours (eyes and teeth are white too, but sit right of BODY_X0)
BODY_X0 = 62                                     # native x: the body (feet, legs, belly, head) is right of this; the club and dust are left
FEET_Y = 107                                     # native row of the bottom of the toes
ANCHOR_X = 95                                    # native x under the body's middle (between the feet)
SMASH = [2, 3, 4, 5, 6, 7, 8, 9]                 # GIF frames used by the attack
MS = {2: 100, 3: 100, 4: 130, 5: 100, 6: 200, 7: 100, 8: 110, 9: 110}   # frame 6 is the 200 ms parry pause
STRIKE = (6, 7)                                  # frames whose club carries the damage box
PAUSE = 6                                        # the main attack frame


def frames():
    """[(rgba uint8 native array)] one per GIF frame, background keyed out (each frame's own most common colour)."""
    out = []
    for f in ImageSequence.Iterator(Image.open(SRC)):
        a = np.asarray(f.convert('RGB'))[UP // 2::UP, UP // 2::UP]
        vals, counts = np.unique(a.reshape(-1, 3), axis=0, return_counts=True)
        bg = vals[counts.argmax()]
        rgba = np.dstack([a, np.where((a == bg).all(2), 0, 255).astype(np.uint8)])
        out.append(rgba)
    return out


def dust_mask(a):
    m = np.zeros(a.shape[:2], bool)
    for c in DUST:
        m |= (a[..., :3] == np.array(c)).all(2)
    return m


def remove_dust(a):
    """The dust cloud left of the body becomes transparent (the face and teeth are right of BODY_X0 and are kept)."""
    a = a.copy()
    m = dust_mask(a); m[:, BODY_X0:] = False
    a[m, 3] = 0
    return a


CLUB_SHIFT = (9, -9)         # frame 6's club moved by this (x, y) lies on frame 0's club (best match found by search; whole pixels only)
CLUB_TIP = (30, 46, 92, 104)  # native window (x0, x1, y0, y1) around the club's end, where the loose cap pixels are closed up


def close_gaps(a, win, fill=(65, 37, 36)):
    """Morphological closing (3x3 dilate, then erode) inside win: pixels that sit in a gap of the club's outline get the club's dark shade."""
    x0, x1, y0, y1 = win
    op = a[..., 3] > 0
    pad = np.pad(op, 1)
    dil = np.zeros_like(op)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            dil |= pad[1 + dy:1 + dy + op.shape[0], 1 + dx:1 + dx + op.shape[1]]
    pad = np.pad(dil, 1, constant_values=True)
    ero = np.ones_like(op)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            ero &= pad[1 + dy:1 + dy + op.shape[0], 1 + dx:1 + dx + op.shape[1]]
    add = ero & ~op
    keep = np.zeros_like(op); keep[y0:y1 + 1, x0:x1 + 1] = True
    a = a.copy(); a[add & keep] = (*fill, 255)
    return a


def fill_end(a, win=(35, 49, 94, 100), body=(65, 37, 36), edge=(39, 23, 15)):
    """The club's end had a bite out of its underside, with the cap's last pixels hanging below it. Everything inside the convex hull of
    the club's pixels in win is filled with the club's dark shade, and the pixels on the new underside get the dark outline shade."""
    x0, x1, y0, y1 = win
    pts = sorted({(x, y) for y in range(y0, y1 + 1) for x in range(x0, x1 + 1) if a[y, x, 3] > 0})
    def cross(o, p, q): return (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0])
    hull = []
    for seq in (pts, pts[::-1]):                                  # monotone chain: lower hull, then upper hull
        h = []
        for pt in seq:
            while len(h) >= 2 and cross(h[-2], h[-1], pt) <= 0: h.pop()
            h.append(pt)
        hull += h[:-1]
    out = a.copy()
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if a[y, x, 3] == 0 and all(cross(hull[i], hull[(i + 1) % len(hull)], (x, y)) >= 0 for i in range(len(hull))):
                out[y, x] = (*body, 255)
    op = out[..., 3] > 0
    for y in range(y0, y1 + 1):                                   # the new underside: filled pixels with nothing below them
        for x in range(x0, x1 + 1):
            if a[y, x, 3] == 0 and op[y, x] and not op[y + 1, x]: out[y, x] = (*edge, 255)
    return out


def repair_club(f0, f6):
    """Frame 0's club is half hidden under the dust cloud, so deleting the dust leaves it chewed up. Everything of the club left of
    the hand (x < BODY_X0) is rebuilt from frame 6, where the same club is clear: its pixels, moved by CLUB_SHIFT. The upper club and
    the hand keep frame 0's own pixels. The loose dust of frame 0 is gone."""
    a = remove_dust(f0); a[:, :BODY_X0, 3] = 0
    club = (f6[..., 3] > 0) & ~dust_mask(f6); club[:, BODY_X0:] = False; club[:FEET_Y - 40] = False
    for y, x in zip(*np.nonzero(club)):
        x0, y0 = x + CLUB_SHIFT[0], y + CLUB_SHIFT[1]
        if x0 < BODY_X0 and 0 <= y0 < a.shape[0]: a[y0, x0] = f6[y, x]
    return fill_end(close_gaps(a, CLUB_TIP))


def build():
    import build as B                                            # the recipes shared with the other monsters
    F = frames()
    still = repair_club(F[0], F[6])
    used = [still] + [F[i] for i in SMASH]
    alpha = np.any(np.stack([u[..., 3] > 0 for u in used]), 0)
    ys, xs = np.nonzero(alpha)
    x0, x1, y0, y1 = int(xs.min()), int(xs.max()), int(ys.min()), FEET_Y
    w, h = (x1 - x0 + 1) * K, (y1 - y0 + 1) * K                  # the crop in sheet pixels
    pf, pb, pt, pbot = round(0.5 * w), round(0.4 * w), round(0.3 * h), 6
    cw, ch = pf + w + pb, pt + h + pbot
    cx, by = pf + (ANCHOR_X - x0) * K + K // 2, pt + (FEET_Y - y0 + 1) * K       # the ground point under the body
    def crop(a, dust=True):
        im = Image.fromarray(a[y0:FEET_Y + 1, x0:x1 + 1]).resize((w, h), Image.NEAREST)
        return im
    def body_of(a):                                              # the body without the club: its box is the hurtbox
        a = a.copy(); a[:, :BODY_X0, 3] = 0; return a
    def place(im, dx=0, dy=0, sx=1, sy=1, rot=0):
        """The art with its feet on the anchor, moved by a recipe (dx, dy as shares of w, h; sx, sy squash; rot lean about the anchor)."""
        big = Image.new('RGBA', (cw, ch), (0, 0, 0, 0))
        ax_s = (ANCHOR_X - x0) * K + K // 2
        s = im.resize((max(1, round(w * sx)), max(1, round(h * sy))), Image.NEAREST)
        px = round(cx + dx * w - ax_s * sx); py = round(by - dy * h - s.height)
        big.paste(s, (px, py), s)
        if rot: big = big.rotate(rot, resample=Image.NEAREST, center=(cx + dx * w, by - dy * h))
        return big
    def hurtbox(img):
        L, T, R, Bt = img.getchannel('A').getbbox()
        return [round((L + (R - L) * 0.12) - cx), 0, round((R - (R - L) * 0.12) - cx), max(2, round(by - T))]
    cells, fr, anims, stats = [], [], {}, {}
    def add(img, body_img, ms, hit=None, pause=False):
        i = len(cells); cells.append(img)
        f = {'src': i, 'ms': ms, 'hurt': hurtbox(body_img), 'hit': hit, 'ground': 0}
        if hit: f['rig'] = True                                  # tighten_hits.py leaves boxes that were placed on the real club
        if pause: f['pause'] = True
        fr.append(f); return i
    S, Sb = crop(still), crop(body_of(still))
    anims['idle'] = {'frames': [add(place(S, *r[:5]), place(Sb, *r[:5]), r[5]) for r in B.idle(4)], 'loop': True}
    anims['walk'] = {'frames': [add(place(S, *r[:5]), place(Sb, *r[:5]), r[5]) for r in B.walk(False)], 'loop': True}
    ids = []
    for g in SMASH:
        a = F[g]
        hit = None
        if g in STRIKE:                                          # the club (everything left of the body that is not dust)
            club = (a[..., 3] > 0) & ~dust_mask(a); club[:, BODY_X0:] = False; club[:FEET_Y - 40] = False
            yy, xx = np.nonzero(club)
            hit = [(int(xx.min()) - ANCHOR_X) * K, (FEET_Y - int(yy.max()) - 1) * K,
                   (BODY_X0 - ANCHOR_X) * K, (FEET_Y - int(yy.min())) * K]      # sheet px from the anchor, y up, forward is -x
        ids.append(add(place(crop(a)), place(crop(body_of(a))), MS[g], hit, g == PAUSE))
    anims['smash'] = {'frames': ids, 'loop': False}
    stats['smash'] = {'dmg': 44, 'knock': [100, 400]}
    anims['hurt'] = {'frames': [add(place(S, *r[:5]), place(Sb, *r[:5]), r[5]) for r in B.hurt()], 'loop': False}
    anims['death'] = {'frames': [add(place(S, *r[:5]), place(Sb, *r[:5]), r[5]) for r in B.death(False)], 'loop': False}
    sheet = Image.new('RGBA', (cw * len(cells), ch), (0, 0, 0, 0))
    for i, c in enumerate(cells): sheet.paste(c, (i * cw, 0))
    os.makedirs(os.path.join(WEB, 'assets', 'enemies'), exist_ok=True)
    sheet.save(os.path.join(WEB, 'assets', 'enemies', 'clubogre.png'), optimize=True)
    ai = {'speed': 34, 'reach': 70, 'attacks': ['smash'], 'rest': [900, 1500], 'death': 'death', 'stun': 'hurt',
          'knock': [64, 400], 'parried': [40, 450], 'hp': 380, 'dmg': 44, 'atk': stats}
    return {'title': 'clubogre', 'sheet': 'assets/enemies/clubogre.png', 'cell': [cw, ch], 'anchor': [cx, by], 'frames': fr, 'anims': anims, 'ai': ai}, (cw, ch, len(cells))
