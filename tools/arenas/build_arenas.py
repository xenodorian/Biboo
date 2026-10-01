"""Procedural pixel-art scenery for the boss arenas. Each theme has 5 tileable 384x232 layers (sky, far, near, ground, fringe)
written to web/assets/arenas/<theme>_<layer>.png, plus web/assets/arenas.js (BIBOO.themes). The ground surface is at row 191 like the main game.
Run: python3 build_arenas.py"""
import math, os, json, random
from PIL import Image, ImageDraw
W, H, GY = 384, 232, 191
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'web', 'assets')
def mix(a, b, t): return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))
def hexc(s): return tuple(int(s[i:i + 2], 16) for i in (1, 3, 5))
def ridge(seed, base, amp, harm=(1, 2, 3, 5, 8)):
    r = random.Random(seed); ph = [r.random() * 6.28 for _ in harm]; am = [1 / (k ** 0.8) for k in harm]
    s = sum(am)
    return [base + amp * sum(a * math.sin(2 * math.pi * k * x / W + p) for a, k, p in zip(am, harm, ph)) / s for x in range(W)]
def sky(top, bot, bands=14, stars=None, seed=1, glow=None):
    im = Image.new('RGBA', (W, H)); d = ImageDraw.Draw(im)
    for b in range(bands):
        y0, y1 = b * H // bands, (b + 1) * H // bands
        d.rectangle([0, y0, W, y1], fill=mix(hexc(top), hexc(bot), b / (bands - 1)) + (255,))
    r = random.Random(seed)
    if stars:
        for _ in range(stars):
            x, y = r.randrange(W), r.randrange(int(H * 0.6)); c = r.choice([(255, 255, 230), (200, 220, 255), (255, 210, 160)])
            d.point((x, y), fill=c + (255,))
    if glow:
        gx, gy, gr, gc = glow
        for rr in range(gr, 0, -4):
            c = mix(hexc(gc), (255, 255, 255), 1 - rr / gr); d.ellipse([gx - rr, gy - rr, gx + rr, gy + rr], fill=c + (255,)) if rr < gr * 0.35 else None
        d.ellipse([gx - gr // 3, gy - gr // 3, gx + gr // 3, gy + gr // 3], fill=hexc(gc) + (255,))
    return im
def silhouette(h, color, seed, base, amp, detail=None, bottom=GY + 6, harm=(1, 2, 3, 5, 8)):
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    rg = ridge(seed, base, amp, harm)
    for x in range(W): d.line([x, int(rg[x]), x, bottom], fill=hexc(color) + (255,))
    if detail: detail(d, rg)
    return im
def put(im, other): im.alpha_composite(other); return im
def save(name, layer, im): im.save(os.path.join(OUT, 'arenas', f'{name}_{layer}.png'), optimize=True)

def ground(name, top, mid, deep, lip, pattern, seed):
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im); r = random.Random(seed)
    d.rectangle([0, GY, W, H], fill=hexc(mid) + (255,))
    d.rectangle([0, GY, W, GY + 3], fill=hexc(top) + (255,)); d.rectangle([0, GY + 4, W, GY + 5], fill=hexc(lip) + (255,))
    d.rectangle([0, GY + 22, W, H], fill=hexc(deep) + (255,))
    pattern(d, r)
    return im

# ---- patterns / details ------------------------------------------------------------------------
def pat_moss(d, r):
    for _ in range(90):
        x, y = r.randrange(W), r.randrange(GY + 7, H - 2); c = r.choice(['#3d5a2a', '#2c4220', '#5c7a3a']); d.rectangle([x, y, x + r.randrange(2, 7), y + 1], fill=hexc(c) + (255,))
    for x in range(0, W, 24): d.line([x, GY + 6, x + 4, GY + 14], fill=(30, 44, 22, 255))
def pat_cobble(d, r):
    for row, y in enumerate(range(GY + 6, H, 11)):
        off = 12 if row % 2 else 0
        for x in range(-off, W, 24):
            d.rectangle([x, y, x + 22, y + 9], outline=(52, 40, 78, 255)); d.line([x + 1, y + 1, x + 20, y + 1], fill=(104, 88, 140, 255))
def pat_sand(d, r):
    for _ in range(140):
        x, y = r.randrange(W), r.randrange(GY + 7, H - 2); d.rectangle([x, y, x + r.randrange(3, 10), y], fill=r.choice([(214, 168, 100, 255), (160, 112, 64, 255)]))
    for x in range(0, W, 64): d.polygon([(x + 8, GY + 14), (x + 14, GY + 8), (x + 17, GY + 16)], fill=(236, 226, 200, 255))   # bone shards
def pat_lava(d, r):
    for row, y in enumerate(range(GY + 6, H, 14)):
        for x in range(-(row % 2) * 16, W, 32): d.rectangle([x, y, x + 30, y + 12], outline=(28, 14, 16, 255))
    for x in (30, 118, 205, 300):
        pts = [(x, GY + 6)]
        for k in range(1, 6): pts.append((x + r.randrange(-6, 7), GY + 6 + k * 8))
        d.line(pts, fill=(255, 150, 40, 255), width=2)
def pat_marble(d, r):
    for row, y in enumerate(range(GY + 6, H, 13)):
        for x in range(0, W, 26):
            c = (86, 74, 82, 255) if (x // 26 + row) % 2 == 0 else (54, 44, 54, 255)
            d.rectangle([x, y, x + 25, y + 12], fill=c)
def fringe(kind, seed):
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im); r = random.Random(seed)
    cols = {'fungus': ['#1c2e1c', '#243a22'], 'crypt': ['#1a1228', '#241a38'], 'bone': ['#4a3220', '#5a4028'], 'ember': ['#140a0c', '#241014'], 'keep': ['#0e0a10', '#1c1220']}[kind]
    for x in range(0, W, 3):
        hgt = 3 + int(5 * (0.5 + 0.5 * math.sin(2 * math.pi * 3 * x / W + seed)) ) + r.randrange(0, 4)
        d.line([x, H, x, H - hgt], fill=hexc(r.choice(cols)) + (255,))
    return im

def stalks_fungus(d, rg):
    pass
def build_fungal():
    n = 'fungal'
    s = sky('#0b1a22', '#2c5a44', stars=60, seed=11, glow=(290, 60, 40, '#cfe8b0')); save(n, 'sky', s)
    far = silhouette(0, '#173a36', 21, 150, 30); d = ImageDraw.Draw(far)
    r = random.Random(5)
    for x in range(10, W, 48):                                        # distant giant mushrooms
        h = r.randrange(40, 80); cx = x + r.randrange(-6, 6); top = GY - h - 20
        d.rectangle([cx - 3, top + 8, cx + 3, GY], fill=(18, 50, 44, 255)); d.ellipse([cx - 22, top - 6, cx + 22, top + 14], fill=(24, 74, 64, 255))
    save(n, 'far', far)
    near = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(near)
    for x in range(30, W, 96):
        h = r.randrange(70, 110); top = GY - h
        d.rectangle([x - 5, top + 10, x + 5, GY], fill=(34, 62, 46, 255)); d.ellipse([x - 38, top - 10, x + 38, top + 28], fill=(60, 120, 92, 255))
        for k in range(-3, 4): d.ellipse([x + k * 9 - 2, top + 4, x + k * 9 + 2, top + 8], fill=(190, 255, 200, 255))
    for _ in range(50): d.point((r.randrange(W), r.randrange(60, GY)), fill=(200, 255, 160, 255))   # spores
    save(n, 'near', near)
    save(n, 'ground', ground(n, '#6a9a3a', '#3a3a24', '#22221a', '#2a4a1c', pat_moss, 3)); save(n, 'fringe', fringe('fungus', 2))
def build_crypt():
    n = 'crypt'
    s = sky('#120a24', '#5a3a78', stars=90, seed=12, glow=(96, 52, 34, '#f0e8ff')); save(n, 'sky', s)
    far = silhouette(0, '#2a1c44', 22, 160, 22); save(n, 'far', far)
    near = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(near)
    for x in range(0, W, 96):                                          # ruined gothic arches
        d.rectangle([x + 6, 70, x + 22, GY], fill=(54, 40, 82, 255)); d.rectangle([x + 70, 90, x + 86, GY], fill=(54, 40, 82, 255))
        d.pieslice([x + 6, 40, x + 86, 120], 180, 360, fill=(54, 40, 82, 255)); d.pieslice([x + 22, 60, x + 70, 108], 180, 360, fill=(0, 0, 0, 0))
        d.rectangle([x + 22, 84, x + 70, GY], fill=(0, 0, 0, 0))
        for yy in range(100, GY, 20): d.line([x + 6, yy, x + 22, yy], fill=(40, 28, 62, 255))
    save(n, 'near', near)
    save(n, 'ground', ground(n, '#8a78b8', '#4a3c6c', '#2a2040', '#2e2448', pat_cobble, 4)); save(n, 'fringe', fringe('crypt', 3))
def build_bone():
    n = 'bone'
    s = sky('#3a1a40', '#f08a3c', stars=0, seed=13, bands=18, glow=(250, 150, 70, '#ffe0a0')); save(n, 'sky', s)
    far = silhouette(0, '#8a3a3c', 23, 170, 26, harm=(1, 2, 3)); save(n, 'far', far)
    def ribs(d, rg):
        r = random.Random(9)
        for x in range(40, W, 128):                                    # giant rib cages and a skull
            for k in range(6):
                d.arc([x + k * 12, 100, x + k * 12 + 40, GY + 40], 180, 270, fill=(236, 226, 200, 255), width=3)
        d.ellipse([W // 2 - 40, GY - 56, W // 2 + 30, GY - 6], fill=(236, 226, 200, 255)); d.ellipse([W // 2 - 22, GY - 40, W // 2 - 8, GY - 26], fill=(40, 20, 30, 255)); d.ellipse([W // 2 + 2, GY - 40, W // 2 + 16, GY - 26], fill=(40, 20, 30, 255))
    near = silhouette(0, '#b8603c', 33, 176, 14, detail=ribs, harm=(1, 2, 4)); save(n, 'near', near)
    save(n, 'ground', ground(n, '#e8c07a', '#c08c52', '#7a5232', '#a06a3c', pat_sand, 5)); save(n, 'fringe', fringe('bone', 4))
def build_ember():
    n = 'ember'
    s = sky('#1a0608', '#a8281c', stars=0, seed=14, bands=16)
    d = ImageDraw.Draw(s); r = random.Random(7)
    for _ in range(120): d.point((r.randrange(W), r.randrange(H)), fill=r.choice([(255, 170, 60, 255), (255, 110, 40, 255), (90, 30, 30, 255)]))   # embers and ash
    save(n, 'sky', s)
    far = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(far)
    d.polygon([(96, GY), (160, 70), (176, 66), (192, 70), (256, GY)], fill=(46, 14, 18, 255)); d.polygon([(160, 70), (176, 62), (192, 70), (176, 76)], fill=(255, 140, 40, 255))   # volcano with a glowing crater
    far.alpha_composite(silhouette(0, '#2e0e12', 24, 175, 14)); save(n, 'far', far)
    near = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(near)
    for x in range(20, W, 128):                                        # war camp: banner poles and torches
        d.rectangle([x, 100, x + 3, GY], fill=(40, 26, 24, 255)); d.polygon([(x + 3, 102), (x + 34, 112), (x + 3, 130)], fill=(150, 24, 24, 255))
        d.rectangle([x + 60, 150, x + 63, GY], fill=(40, 26, 24, 255)); d.ellipse([x + 56, 140, x + 68, 152], fill=(255, 170, 50, 255))
    save(n, 'near', near)
    save(n, 'ground', ground(n, '#6a2a24', '#2a1214', '#14080a', '#ff7a2c', pat_lava, 6)); save(n, 'fringe', fringe('ember', 5))
def build_keep():
    n = 'keep'
    s = sky('#050308', '#3a0c24', stars=40, seed=15, glow=(300, 50, 30, '#ff6a8a')); save(n, 'sky', s)
    far = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(far)
    for x in range(0, W, 64): d.rectangle([x + 8, 40, x + 24, GY], fill=(34, 14, 30, 255)); d.rectangle([x + 4, 36, x + 28, 44], fill=(46, 20, 40, 255))
    save(n, 'far', far)
    near = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(near)
    for x in range(0, W, 128):                                         # throne hall columns and hanging banners
        d.rectangle([x + 12, 20, x + 40, GY], fill=(70, 30, 56, 255)); d.rectangle([x + 8, 16, x + 44, 28], fill=(96, 44, 76, 255)); d.rectangle([x + 8, GY - 12, x + 44, GY], fill=(96, 44, 76, 255))
        d.polygon([(x + 70, 20), (x + 106, 20), (x + 106, 100), (x + 88, 88), (x + 70, 100)], fill=(150, 20, 50, 255)); d.ellipse([x + 80, 40, x + 96, 56], fill=(250, 200, 80, 255))
    save(n, 'near', near)
    save(n, 'ground', ground(n, '#a08098', '#564456', '#2a202c', '#6a4a62', pat_marble, 7)); save(n, 'fringe', fringe('keep', 6))

THEMES = {'fungal': build_fungal, 'crypt': build_crypt, 'bone': build_bone, 'ember': build_ember, 'keep': build_keep}
if __name__ == '__main__':
    os.makedirs(os.path.join(OUT, 'arenas'), exist_ok=True)
    out = {}
    for n, fn in THEMES.items():
        fn()
        out[n] = {'layers': [{'src': f'assets/arenas/{n}_{l}.png', 'parallax': p, 'shake': sk} for l, p, sk in (('sky', 0.1, 0.25), ('far', 0.25, 0.4), ('near', 0.5, 0.65), ('ground', 1.0, 1.0))],
                  'fringe': f'assets/arenas/{n}_fringe.png'}
    open(os.path.join(OUT, 'arenas.js'), 'w').write('// generated by tools/arenas/build_arenas.py\nwindow.BIBOO.themes = ' + json.dumps(out, separators=(',', ':')) + ';\n')
    print('ok')
