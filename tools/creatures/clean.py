"""Step 1: turn the 10 supplied stills into transparent, cropped sprites (clean/creatureN.png).
Run: python3 clean.py   (needs Pillow). Sources are in source/srcN.webp; each file held a single frame."""
from PIL import Image
from collections import deque
import os, sys
BANNER_TOP = {0: 272, 2: 300, 3: 300, 4: 298, 6: 298, 7: 272, 8: 272, 9: 272}   # craftpix.net banner starts here
os.makedirs('clean', exist_ok=True)

def close(a, b, tol): return abs(a[0]-b[0]) <= tol and abs(a[1]-b[1]) <= tol and abs(a[2]-b[2]) <= tol

def strip(im, palette, tol):
    w, h = im.size; px = im.load(); out = im.convert('RGBA'); op = out.load()
    seen = [[False]*h for _ in range(w)]; q = deque()
    for x in range(w):
        for y in (0, h-1): q.append((x, y))
    for y in range(h):
        for x in (0, w-1): q.append((x, y))
    while q:
        x, y = q.popleft()
        if x < 0 or y < 0 or x >= w or y >= h or seen[x][y]: continue
        c = px[x, y]
        if not any(close(c, p, tol) for p in palette): continue
        seen[x][y] = True; op[x, y] = (0, 0, 0, 0)
        q.extend(((x+1, y), (x-1, y), (x, y+1), (x, y-1)))
    return out

def bbox_crop(im):
    bb = im.getchannel('A').point(lambda v: 255 if v > 0 else 0).getbbox()
    return im.crop(bb)

def native(im):
    """Undo nearest-neighbour upscaling: find the biggest k where every k x k block is one colour."""
    w, h = im.size
    for k in range(16, 1, -1):
        if w % k or h % k: continue
        small = im.resize((w//k, h//k), Image.NEAREST)
        if small.resize((w, h), Image.NEAREST).tobytes() == im.tobytes(): return small, k
    return im, 1

def defringe(im, rounds=2):
    """Compression leaves a pale halo around craftpix sprites: drop near-white grey pixels that touch the cut-out background."""
    w, h = im.size; px = im.load()
    for _ in range(rounds):
        kill = []
        for x in range(w):
            for y in range(h):
                r, g, b, a = px[x, y]
                if a == 0 or min(r, g, b) < 205 or max(r, g, b) - min(r, g, b) > 14: continue
                if any(not (0 <= x+dx < w and 0 <= y+dy < h) or px[x+dx, y+dy][3] == 0 for dx, dy in ((1,0),(-1,0),(0,1),(0,-1))): kill.append((x, y))
        for p in kill: px[p] = (0, 0, 0, 0)
    return im

def block_size(im):
    """Pixel-art block size of an upscaled image: the most common distance between colour edges."""
    from collections import Counter
    w, h = im.size; px = im.load(); c = Counter()
    for y in range(0, h, 3):
        last = 0
        for x in range(1, w):
            if sum(abs(a-b) for a, b in zip(px[x, y][:3], px[x-1, y][:3])) > 40:
                if x - last > 1: c[x - last] += 1
                last = x
    ks = [k for k, n in c.most_common(6) if k >= 3]
    return ks[0] if ks else 1

def clean(i):
    im = Image.open(f'source/src{i}.webp').convert('RGB')
    if i == 1:                                                           # 16x upscaled tiny goblin: back to its real pixels first
        im = im.resize((42, 42), Image.NEAREST)
        out = bbox_crop(strip(im, [(157, 157, 157)], 6)); return out
    if i in BANNER_TOP: im = im.crop((0, 0, im.width, BANNER_TOP[i]))
    if i == 5: im = im.crop((370, 255, 728, 552))                       # the goblin only: drop the title text and bands above
    corner = im.getpixel((2, 2))
    palette = [corner] + ([(255, 255, 255)] if i in BANNER_TOP else [])
    if i == 5: palette = [(118, 159, 172), (84, 112, 121), (59, 89, 102), (52, 78, 90), (48, 72, 84)]
    out = strip(im, palette, 14 if i == 5 else 9)
    out = bbox_crop(out)
    if i in BANNER_TOP: out = bbox_crop(defringe(out))
    if i == 5:                                                           # blocky goblin: shrink to its real pixels
        k = block_size(out)
        out = out.resize((max(1, round(out.width / k)), max(1, round(out.height / k))), Image.NEAREST)
        print('goblin block', k)
    return out

if __name__ == '__main__':
    for i in range(10):
        o = clean(i)
        nat, k = native(o) if i != 5 else (o, 1)
        nat.save(f'clean/creature{i}.png'); print(i, o.size, 'native', nat.size, 'scale', k)
