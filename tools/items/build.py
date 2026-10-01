"""Shop and pickup art: the spinning Leaf coin (from source/leaf.mp4), the five gem sprites (Bone, Bone Powder, Quartz, Garnet, Diamond)
and the Bone Merchant (source/merchant.webp). Writes web/assets/items/{leaf,gems,merchant}.png and web/assets/items.js (BIBOO.items).
Needs ffmpeg for the video. Run: python3 build.py (from tools/items)"""
import json, os, subprocess, tempfile
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '..', 'web', 'assets')
CELL = 16

def knock_out(im, thresh):                                             # flood the background from the corners to transparent
    im = im.convert('RGBA')
    for pt in [(0, 0), (im.width - 1, 0), (0, im.height - 1), (im.width - 1, im.height - 1)]:
        if im.getpixel(pt)[3]: ImageDraw.floodfill(im, pt, (255, 0, 255, 0), thresh=thresh)
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            if px[x, y][3] == 0: px[x, y] = (0, 0, 0, 0)
    return im

def leaf_sheet(n=12):
    d = tempfile.mkdtemp()
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', os.path.join(HERE, 'source', 'leaf.mp4'), os.path.join(d, 'f_%02d.png')], check=True)
    files = sorted(f for f in os.listdir(d) if f.endswith('.png'))
    pick = [files[int(i * len(files) / n)] for i in range(n)]
    frames = [knock_out(Image.open(os.path.join(d, f)), 18) for f in pick]
    box = None
    for f in frames:
        b = f.getbbox(); box = b if box is None else (min(box[0], b[0]), min(box[1], b[1]), max(box[2], b[2]), max(box[3], b[3]))
    side = max(box[2] - box[0], box[3] - box[1]); cx, cy = (box[0] + box[2]) // 2, (box[1] + box[3]) // 2
    sq = (cx - side // 2, cy - side // 2, cx + side // 2, cy + side // 2)
    small = [f.crop(sq).resize((CELL, CELL), Image.BOX) for f in frames]
    alpha = [s.getchannel('A').point(lambda v: 255 if v > 100 else 0) for s in small]
    big = Image.new('RGB', (CELL * n, CELL)); [big.paste(s.convert('RGB'), (i * CELL, 0)) for i, s in enumerate(small)]
    q = big.quantize(colors=20, method=Image.MEDIANCUT, dither=Image.NONE).convert('RGBA')
    for i, a in enumerate(alpha):
        cell = q.crop((i * CELL, 0, (i + 1) * CELL, CELL)); cell.putalpha(a); q.paste(cell, (i * CELL, 0))
    return q

# ---- the five gems, drawn straight onto a 16x16 grid
def hexa(c): c = c.lstrip('#'); return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4)) + (255,)
def gem_bone():
    im = Image.new('RGBA', (CELL, CELL), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    O, L, M, D = hexa('#3a2c1a'), hexa('#fbf3da'), hexa('#e0d2a8'), hexa('#a89468')
    for (x, y) in [(2, 10), (2, 12), (4, 12), (1, 11)]: pass
    # a diagonal bone: shaft from lower left to upper right, a two-lobed knob at each end
    shaft = [(5, 11), (6, 10), (7, 9), (8, 8), (9, 7), (10, 6)]
    for x, y in shaft:
        for dx, dy in [(0, 0), (1, 0), (0, -1), (1, -1), (-1, 0), (0, 1), (1, 1), (-1, -1)]: im.putpixel((x + dx, y + dy), O)
    for x, y in shaft:
        im.putpixel((x, y), L); im.putpixel((x + 1, y - 1) if (x + 1, y - 1) in [] else (x, y), L)
    for lobe in [(3, 11), (4, 12), (3, 13), (2, 12), (12, 4), (11, 3), (13, 3), (12, 2)]:
        pass
    # knobs as small circles with outline
    def ball(cx, cy):
        d.ellipse([cx - 2, cy - 2, cx + 2, cy + 2], fill=O)
        d.ellipse([cx - 1, cy - 1, cx + 1, cy + 1], fill=M)
        im.putpixel((cx - 1, cy - 1), L)
    ball(3, 13); ball(5, 14) if False else None; ball(2, 11); ball(13, 2); ball(11, 4) if False else None; ball(12, 4) if False else None
    ball(14, 4) if False else None
    d.line([(4, 12), (11, 5)], fill=O, width=3); d.line([(4, 12), (11, 5)], fill=M, width=1)
    im.putpixel((5, 11), L); im.putpixel((7, 9), L); im.putpixel((9, 7), L)
    for cx, cy in [(3, 12), (4, 14), (12, 3), (14, 4)]:
        d.ellipse([cx - 2, cy - 2, cx + 1, cy + 1], fill=O); d.ellipse([cx - 1, cy - 1, cx, cy], fill=M); im.putpixel((cx - 1, cy - 1), L)
    return im
def gem_powder():
    im = Image.new('RGBA', (CELL, CELL), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    O, L, M, D, W = hexa('#3a2c1a'), hexa('#fbf3da'), hexa('#d8c9a0'), hexa('#8a7448'), hexa('#9a5a2a')
    d.ellipse([2, 5, 13, 15], fill=O); d.ellipse([3, 6, 12, 14], fill=M)                 # the sack
    d.rectangle([5, 2, 10, 6], fill=O); d.rectangle([6, 3, 9, 6], fill=M)                # the neck
    d.rectangle([5, 6, 10, 7], fill=W)                                                   # the tie
    d.ellipse([4, 8, 7, 11], fill=L); d.rectangle([9, 11, 11, 13], fill=D)               # light and shade
    d.point([(6, 1), (9, 1), (7, 0), (8, 0)], fill=L)                                    # powder puffing from the top
    return im
def facet(fill, light, dark, out, pts, hi, lo):
    im = Image.new('RGBA', (CELL, CELL), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.polygon(pts, fill=hexa(out))
    inner = [(round(8 + (x - 8) * 0.72), round(8 + (y - 8) * 0.72)) for x, y in pts]
    d.polygon(inner, fill=hexa(fill))
    d.polygon([inner[i] for i in hi], fill=hexa(light)); d.polygon([inner[i] for i in lo], fill=hexa(dark))
    return im
def gem_quartz():                                                                        # a hexagonal prism, pointed top
    im = facet('#6cc8ee', '#e4faff', '#2a78b8', '#103060', [(8, 0), (14, 4), (14, 12), (8, 15), (2, 12), (2, 4)], [0, 5, 1], [3, 2, 4]) if False else None
    im = Image.new('RGBA', (CELL, CELL), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    O, L, M, D = hexa('#103060'), hexa('#e4faff'), hexa('#6cc8ee'), hexa('#2a78b8')
    d.polygon([(8, 0), (13, 4), (13, 12), (8, 15), (3, 12), (3, 4)], fill=O)
    d.polygon([(8, 2), (12, 5), (12, 11), (8, 14), (4, 11), (4, 5)], fill=M)
    d.polygon([(8, 2), (4, 5), (4, 11), (7, 9), (7, 5)], fill=L)
    d.polygon([(9, 5), (12, 5), (12, 11), (8, 14), (9, 9)], fill=D)
    return im
def gem_garnet():                                                                        # a round cut gem
    im = Image.new('RGBA', (CELL, CELL), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    O, L, M, D = hexa('#3a0a0a'), hexa('#ffd2a0'), hexa('#f0602a'), hexa('#9a2a12')
    d.polygon([(5, 1), (11, 1), (15, 5), (15, 10), (11, 14), (5, 14), (1, 10), (1, 5)], fill=O)
    d.polygon([(5, 2), (11, 2), (14, 5), (14, 10), (11, 13), (5, 13), (2, 10), (2, 5)], fill=M)
    d.polygon([(5, 2), (11, 2), (9, 5), (7, 5)], fill=L); d.polygon([(2, 5), (5, 2), (7, 5), (5, 8)], fill=L)
    d.polygon([(14, 10), (11, 13), (5, 13), (8, 9)], fill=D)
    d.point([(4, 4), (5, 3)], fill=hexa('#ffffff'))
    return im
def gem_diamond():                                                                       # a classic cut diamond
    im = Image.new('RGBA', (CELL, CELL), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    O, L, M, D = hexa('#341a6a'), hexa('#ffffff'), hexa('#d8b8ff'), hexa('#8a58d0')
    d.polygon([(4, 2), (11, 2), (15, 6), (8, 15), (1, 6)], fill=O)
    d.polygon([(4, 3), (11, 3), (14, 6), (8, 14), (2, 6)], fill=M)
    d.polygon([(4, 3), (7, 3), (6, 6), (2, 6)], fill=L); d.polygon([(8, 3), (11, 3), (14, 6), (10, 6)], fill=hexa('#efe0ff'))
    d.polygon([(2, 6), (14, 6), (8, 14)], fill=M); d.polygon([(8, 6), (14, 6), (8, 14)], fill=D); d.polygon([(2, 6), (6, 6), (8, 14)], fill=hexa('#e8d4ff'))
    d.point([(5, 4), (6, 4)], fill=L)
    return im

if __name__ == '__main__':
    os.makedirs(os.path.join(OUT, 'items'), exist_ok=True)
    leaf = leaf_sheet(); leaf.save(os.path.join(OUT, 'items', 'leaf.png'), optimize=True)
    names = ['bone', 'powder', 'quartz', 'garnet', 'diamond']
    gems = Image.new('RGBA', (CELL * len(names), CELL), (0, 0, 0, 0))
    for i, im in enumerate([gem_bone(), gem_powder(), gem_quartz(), gem_garnet(), gem_diamond()]): gems.paste(im, (i * CELL, 0))
    gems.save(os.path.join(OUT, 'items', 'gems.png'), optimize=True)
    m = knock_out(Image.open(os.path.join(HERE, 'source', 'merchant.webp')), 20)
    m = m.crop(m.getbbox()); k = 66 / m.width
    m = m.resize((66, max(1, round(m.height * k))), Image.BOX)
    a = m.getchannel('A').point(lambda v: 255 if v > 110 else 0)
    m = m.convert('RGB').quantize(colors=40, method=Image.MEDIANCUT, dither=Image.NONE).convert('RGBA'); m.putalpha(a)
    m.save(os.path.join(OUT, 'items', 'merchant.png'), optimize=True)
    info = {'cell': CELL, 'leafFrames': leaf.width // CELL, 'gems': {n: i for i, n in enumerate(names)}, 'merchant': {'src': 'assets/items/merchant.png', 'w': m.width, 'h': m.height},
            'leaf': 'assets/items/leaf.png', 'gemSheet': 'assets/items/gems.png'}
    open(os.path.join(OUT, 'items.js'), 'w').write('// generated by tools/items/build.py\nwindow.BIBOO.items = ' + json.dumps(info, separators=(',', ':')) + ';\n')
    print('ok', leaf.size, m.size)
