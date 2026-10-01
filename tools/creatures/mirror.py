"""Mirror Max: an enemy built from Max's own move sheets (web/assets/moves/*.png), flipped to face left and tinted dark,
with her real frame timings, root motion (ground) and hit shapes (converted to the enemy's single hit box per frame).
Used by build.py as the level 5 final boss."""
import json, os
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.join(HERE, '..', '..', 'web')
SC = 0.5                                     # sprite scale: world px = sheet px * SC
CW, CH, AX, AY = 250, 176, 160, 172          # common cell and anchor (forward = left)
# (anim name, move id, damage, knock [px, ms]); idle and walk are separate
ATTACKS = [('slash', 'slash', 30, [60, 300]), ('thrust', 'thrust', 30, [60, 300]), ('upswing', 'upswing', 35, [70, 300]),
           ('push_kick', 'push_kick', 40, [100, 350]), ('heavy', 'heavy', 50, [110, 400]), ('spin', 'spin_attack', 40, [90, 350])]
def tint(im):
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a:
                l = (r * 3 + g * 6 + b) // 10
                px[x, y] = (min(255, int(l * 0.45 + r * 0.30 + 10)), int(l * 0.22 + g * 0.05), min(255, int(l * 0.40 + b * 0.25 + 12)), a)
    return im
def build():
    s = open(os.path.join(WEB, 'assets', 'data.js')).read()
    D = json.loads(s[s.index('=') + 1:].rstrip().rstrip(';'))
    cells, frames, anims, stats = [], [], {}, {}
    def add(mv, k, ms, ground=0.0, hits=None, flipy=0):
        m = D['moves'][mv]; cw, ch = m['cell']; ax, ay = m['anchor']
        sheet = Image.open(os.path.join(WEB, m['sheet'])).convert('RGBA')
        c = sheet.crop((k * cw, 0, k * cw + cw, ch)).transpose(Image.FLIP_LEFT_RIGHT)       # art now faces left
        ax2 = cw - 1 - ax                                                                       # anchor x after the flip
        out = Image.new('RGBA', (CW, CH), (0, 0, 0, 0)); out.alpha_composite(c, (AX - ax2, AY - ay))
        tint(out)
        bb = out.getchannel('A').getbbox(); L, T, R, B = bb
        hurt = [round(L + (R - L) * 0.2 - AX), 0, round(R - (R - L) * 0.2 - AX), max(2, AY - T)]
        hit = None
        if hits:
            xs, ys = [], []
            for sh in hits:
                if sh['shape'] == 'capsule': r = sh['radius']; pts = [(sh['a'][0] - r, sh['a'][1] - r), (sh['a'][0] + r, sh['a'][1] + r), (sh['b'][0] - r, sh['b'][1] - r), (sh['b'][0] + r, sh['b'][1] + r)]
                elif sh['shape'] == 'circle': r = sh['r']; pts = [(sh['c'][0] - r, sh['c'][1] - r), (sh['c'][0] + r, sh['c'][1] + r)]
                else: pts = [tuple(sh['a']), tuple(sh['b'])]
                for p in pts: xs.append(p[0]); ys.append(p[1])
            # her hit shapes are in sheet px (scaled by 0.5 when used), forward positive -> forward = left
            hit = [round(-max(xs)), round(min(ys)), round(-min(xs)), round(max(ys))]
        i = len(cells); cells.append(out)
        frames.append({'src': i, 'ms': ms, 'hurt': hurt, 'hit': hit, 'ground': round(-ground)})
        return i
    def seq(mv, name, loop, ids=None):
        m = D['moves'][mv]; fr = m['frames']
        a = [add(mv, k, f['ms'], f['root'][0], f['hits']) for k, f in enumerate(fr) if ids is None or k in ids]
        anims[name] = {'frames': a, 'loop': loop}
    seq('idle', 'idle', True); seq('walk_right', 'walk', True)
    for name, mv, dmg, kn in ATTACKS:
        seq(mv, name, False); stats[name] = {'dmg': dmg, 'knock': kn}
    # hurt: the block pose; death: the last frame of the jump's landing is not suitable, so use the duck pose held low
    seq('block', 'hurt', False, ids=[1]); seq('duck', 'death', False)
    n = len(cells)
    sheet = Image.new('RGBA', (CW * n, CH), (0, 0, 0, 0))
    for i, c in enumerate(cells): sheet.paste(c, (i * CW, 0))
    sheet.save(os.path.join(WEB, 'assets', 'enemies', 'mirrormax.png'), optimize=True)
    ai = {'speed': 62, 'reach': 70, 'attacks': [a[0] for a in ATTACKS], 'rest': [350, 700], 'death': 'death', 'stun': 'hurt', 'knock': [10, 150], 'parried': [30, 400],
          'hp': 200, 'dmg': 30, 'atk': stats, 'boss': True, 'bossName': 'Mirror Max'}
    return {'title': 'Mirror Max', 'sheet': 'assets/enemies/mirrormax.png', 'cell': [CW, CH], 'anchor': [AX, AY], 'frames': frames, 'anims': anims, 'ai': ai}, (CW, CH, n)
