"""Tighten every enemy's damage box (frame 'hit') so it covers only what the enemy attacks with.

An enemy's `hit` box is the box that hurts Perry. The generated creatures got big boxes cut from fractions of the sprite
width: they reached far past the art and back into the body. This pass rebuilds each one from the sprite pixels:

  * creatures built by build.py: the leading slice of the art (the head, teeth, tusk, horn, club or blade that leads the lunge),
    kept to the rows the old box covered, so low attacks (stomp, tail, trample) stay low and high ones (spear) stay high;
  * Mirror Max (hand tuned, follows her sword): the old box trimmed to the pixels that are actually there;
  * the goblin and the orc come from another tool whose frames are positioned differently, so they are left as tuned.

Run:  python3 tools/creatures/tighten_hits.py     (safe to run twice; it only ever shrinks a box)
Run it again after tools/creatures/build.py, which regenerates the loose boxes.
"""
import json, os, sys
from PIL import Image

WEB = os.path.join(os.path.dirname(__file__), '..', '..', 'web')
HAND = {'mirrormax'}                            # drawn from real art with hand set boxes: trim only
SKIP = {'goblin', 'orc'}                        # frames not laid out on the anchor like the rest: left as tuned
SLICE = 0.30                                    # depth of the leading slice, as a share of the art width
MIN_W = 14                                      # the narrowest a box gets, in sheet pixels


def mask(im, cw, ch, src):
    a = im.crop((src * cw, 0, (src + 1) * cw, ch)).getchannel('A').point(lambda v: 255 if v > 40 else 0)
    return a


def bbox_in(a, x0, x1, y0, y1):
    """bounding box (pixel coordinates) of opaque pixels inside the given pixel window, or None"""
    x0, y0 = max(0, int(x0)), max(0, int(y0)); x1, y1 = min(a.width, int(x1)), min(a.height, int(y1))
    if x1 <= x0 or y1 <= y0: return None
    return a.crop((x0, y0, x1, y1)).getbbox() and tuple(v + o for v, o in zip(a.crop((x0, y0, x1, y1)).getbbox(), (x0, y0, x0, y0)))


def tighten(name, T, base):
    cw, ch = T['cell']; ax, ay = T['anchor']
    im = Image.open(os.path.join(WEB, T['sheet'])).convert('RGBA')
    n = 0
    for f in T['frames']:
        h = f.get('hit')
        if not h or f.get('rig'): continue                 # rig frames (the Boar Lord's spear) carry boxes placed on the weapon tip by build.py: leave them
        a = mask(im, cw, ch, f['src'])
        # the old box as a pixel window (x grows right, y grows down; the art faces left, so forward is -x)
        wx0, wx1, wy0, wy1 = ax + h[0], ax + h[2], ay - h[3], ay - h[1]
        if name in HAND:
            bb = bbox_in(a, wx0, wx1, wy0, wy1)
            if not bb: continue
            px0, px1, py0, py1 = bb[0], bb[2], bb[1], bb[3]
        else:
            rows = bbox_in(a, 0, cw, wy0, wy1) or bbox_in(a, 0, cw, 0, ch)      # rows the old box covered; else the whole art
            if not rows: continue
            ry0, ry1 = rows[1], rows[3]
            front, back = rows[0], rows[2]
            depth = max(MIN_W, SLICE * (back - front))
            body = f['hurt']; mid = ax + (body[0] + body[2]) / 2                    # never reaches past the middle of the body
            bb = bbox_in(a, front, min(front + depth, mid), ry0, ry1) or bbox_in(a, front, front + depth, ry0, ry1)
            if not bb or bb[2] - bb[0] < MIN_W or bb[3] - bb[1] < MIN_W:             # a sliver (the band missed the leading part): use the leading slice of the whole art
                rows = bbox_in(a, 0, cw, 0, ch); front = rows[0]; depth = max(MIN_W, SLICE * (rows[2] - rows[0]))
                bb = bbox_in(a, front, min(front + depth, mid), rows[1], rows[3]) or bbox_in(a, front, front + depth, rows[1], rows[3])
            if not bb: continue
            px0, px1, py0, py1 = bb[0], bb[2], bb[1], bb[3]
        new = [px0 - ax, ay - py1, px1 - ax, ay - py0]
        # never grow: stay inside the old box
        new = [max(new[0], h[0]), max(new[1], h[1]), min(new[2], h[2]), min(new[3], h[3])]
        if new[2] - new[0] < 4 or new[3] - new[1] < 4: continue
        if new != h: n += 1
        f['hit'] = new
    return n


def run(path, opener, closer, keys=None):
    s = open(path).read()
    i = s.index(opener); j = s.rindex(closer)
    data = json.loads(s[i:j + 1])
    en = data['enemies'] if 'enemies' in data else data
    tot = 0
    for name, T in en.items():
        if name in SKIP or (keys and name not in keys): continue
        if T.get('ai', {}).get('prop'): continue
        c = tighten(name, T, path); tot += c; print(f'{name}: {c} boxes tightened')
    open(path, 'w').write(s[:i] + json.dumps(data, separators=(',', ':')) + s[j + 1:])
    return tot


if __name__ == '__main__':
    run(os.path.join(WEB, 'assets', 'creatures.js'), '{"hobgoblin"', '}')
