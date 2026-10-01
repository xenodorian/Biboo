"""Builds procedural animation sheets and enemy data from the cleaned stills in clean/.
Output: web/assets/enemies/<name>.png and web/assets/creatures.js (merged into BIBOO.enemies at load).
Sheets are horizontal strips, art faces LEFT, anchor = ground point under the body centre.
Run: python3 build.py   (from tools/creatures)"""
import json, math, os, sys
from PIL import Image, ImageChops, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '..', 'web', 'assets')
FLIP = {2, 4, 6}           # source art faces right
# name: source index, world height (px), stats
# Attack styles: lunge, slam, sweep, stomp.  hit = (x0,x1,y0,y1): x as fractions of sprite width from the sprite's front edge
# (negative = ahead of it), y as fractions of sprite height above the ground.
C = {
 'hobgoblin': dict(src=5, H=34, speed=44, hp=80, rest=[600, 1100], knock=[40, 300], parried=[40, 450], atk=[
     dict(name='slash', style='lunge', dmg=14, knock=[40, 250], hit=(-0.45, 0.35, 0.25, 0.85)),
     dict(name='bash', style='slam', dmg=18, knock=[55, 300], hit=(-0.40, 0.30, 0.10, 0.60))]),
 'skullraider': dict(src=6, H=40, speed=52, hp=110, rest=[600, 1100], knock=[40, 300], parried=[40, 450], atk=[
     dict(name='cut', style='lunge', dmg=18, knock=[45, 250], hit=(-0.55, 0.30, 0.25, 0.80)),
     dict(name='torch', style='sweep', dmg=20, knock=[60, 300], hit=(-0.50, 0.45, 0.30, 0.95))]),
 'dusksaur': dict(src=2, H=46, speed=46, hp=140, rest=[700, 1200], knock=[50, 300], parried=[40, 450], atk=[
     dict(name='bite', style='lunge', dmg=22, knock=[50, 250], hit=(-0.60, 0.30, 0.45, 0.95)),
     dict(name='tail', style='sweep', dmg=24, knock=[70, 350], hit=(-0.55, 0.30, 0.05, 0.50))]),
 'darkknight': dict(src=4, H=46, speed=50, hp=170, rest=[600, 1000], knock=[45, 300], parried=[40, 450], atk=[
     dict(name='stab', style='lunge', dmg=26, knock=[50, 250], hit=(-0.80, 0.25, 0.25, 0.65)),
     dict(name='cleave', style='slam', dmg=32, knock=[70, 350], hit=(-0.70, 0.25, 0.10, 0.80))]),
 'ogre': dict(src=7, H=70, speed=36, hp=320, rest=[900, 1500], knock=[64, 400], parried=[40, 450], atk=[
     dict(name='club', style='slam', dmg=40, knock=[90, 400], hit=(-0.55, 0.45, 0.0, 0.70)),
     dict(name='swat', style='sweep', dmg=36, knock=[80, 350], hit=(-0.60, 0.40, 0.25, 0.85))]),
 # bosses
 'wyrmslug': dict(title='Wyrm Slug', src=3, H=70, speed=38, hp=700, rest=[500, 900], knock=[12, 150], parried=[30, 400], boss=True, atk=[
     dict(name='bite', style='lunge', dmg=18, knock=[70, 300], hit=(-0.45, 0.30, 0.10, 0.75)),
     dict(name='slam', style='slam', dmg=23, knock=[90, 350], hit=(-0.40, 0.35, 0.0, 0.50)),
     dict(name='lash', style='sweep', dmg=20, knock=[80, 350], hit=(-0.55, 0.45, 0.10, 0.85))]),
 'oozewraith': dict(title='Ooze Wraith', src=9, H=84, speed=34, hp=900, rest=[500, 900], knock=[12, 150], parried=[30, 400], boss=True, atk=[
     dict(name='lunge', style='lunge', dmg=22, knock=[80, 300], hit=(-0.45, 0.30, 0.10, 0.80)),
     dict(name='crush', style='slam', dmg=26, knock=[100, 400], hit=(-0.40, 0.40, 0.0, 0.55)),
     dict(name='sweep', style='sweep', dmg=24, knock=[90, 350], hit=(-0.55, 0.45, 0.10, 0.90))]),
 'horneddread': dict(title='Horned Dread', src=0, H=104, speed=36, hp=1100, rest=[500, 800], knock=[12, 150], parried=[30, 400], boss=True, atk=[
     dict(name='gore', style='lunge', dmg=26, knock=[100, 300], hit=(-0.50, 0.30, 0.25, 0.95)),
     dict(name='stomp', style='stomp', dmg=30, knock=[110, 400], hit=(-0.45, 0.45, 0.0, 0.40)),
     dict(name='claw', style='sweep', dmg=28, knock=[100, 350], hit=(-0.55, 0.45, 0.10, 0.80))]),
 'ogrechief': dict(title='Ogre Chief', src=7, H=96, hue=0.45, speed=38, hp=1250, rest=[500, 850], knock=[12, 150], parried=[30, 400], boss=True, atk=[
     dict(name='club', style='slam', dmg=26, knock=[100, 400], hit=(-0.55, 0.45, 0.0, 0.70)),
     dict(name='swat', style='sweep', dmg=24, knock=[90, 350], hit=(-0.60, 0.40, 0.25, 0.85)),
     dict(name='quake', style='stomp', dmg=30, knock=[110, 400], hit=(-0.50, 0.50, 0.0, 0.40))]),
 'boarlord': dict(title='Boar Lord', src=8, rig=True, H=112, speed=44, hp=1400, rest=[450, 750], knock=[12, 150], parried=[30, 400], boss=True, atk=[
     dict(name='charge', style='lunge', dmg=31, knock=[120, 350], hit=(-0.60, 0.30, 0.05, 0.60)),
     dict(name='spear', style='rig', dmg=29, knock=[100, 350], hit=None),
     dict(name='trample', style='stomp', dmg=34, knock=[130, 400], hit=(-0.45, 0.45, 0.0, 0.45))]),
}
# frame recipe: (dx frac of w (neg = forward), dy frac of h (up), sx, sy, rot deg (+ = lean forward), ms, hit?)
def idle(b): return [(0, 0, 1, 1, 0, 180), (0, 0.012, 1, 1.02, 0, 180), (0, 0, 1, 1, 0, 180), (0, -0.01, 1.01, 0.985, 0, 180)][:b]
def walk(boss):
    n = 4 if boss else 6
    return [(-0.01 * math.sin(i / n * 2 * math.pi), 0.025 * abs(math.sin(i / n * math.pi)), 1, 1 + 0.02 * math.sin(i / n * 2 * math.pi), 3 * math.sin(i / n * 2 * math.pi), 100 if not boss else 130) for i in range(n)]
def attack(style):
    if style == 'lunge':
        return [(0.04, 0, 1.02, 0.98, -6, 110, 0), (0.10, 0, 1.04, 0.96, -10, 160, 0), (-0.28, 0, 1.0, 1.0, 9, 90, 1), (-0.34, 0, 1.0, 1.0, 12, 110, 1), (-0.15, 0, 1, 1, 5, 110, 0), (-0.04, 0, 1, 1, 1, 110, 0)]
    if style == 'slam':
        return [(0.03, 0.02, 0.98, 1.06, -8, 130, 0), (0.06, 0.07, 0.96, 1.12, -13, 190, 0), (-0.10, -0.01, 1.04, 0.94, 14, 90, 1), (-0.14, -0.04, 1.08, 0.88, 18, 150, 1), (-0.06, -0.02, 1.04, 0.94, 8, 110, 0), (0, 0, 1, 1, 0, 110, 0)]
    if style == 'sweep':
        return [(0.05, 0, 1.0, 1.0, -10, 130, 0), (0.09, 0, 1.0, 1.02, -15, 180, 0), (-0.12, 0, 1.03, 0.98, 5, 80, 1), (-0.22, 0, 1.04, 0.97, 12, 100, 1), (-0.08, 0, 1.0, 1.0, 4, 110, 0), (0, 0, 1, 1, 0, 110, 0)]
    if style == 'stomp':
        return [(0, 0.10, 0.97, 1.08, -4, 150, 0), (0, 0.17, 0.95, 1.14, -6, 210, 0), (-0.05, -0.04, 1.08, 0.90, 10, 90, 1), (-0.08, -0.06, 1.12, 0.86, 8, 150, 1), (-0.03, -0.02, 1.04, 0.95, 3, 110, 0), (0, 0, 1, 1, 0, 110, 0)]
# The Boar Lord's spear thrust, drawn from the split arm and spear (boar_rig.py).
# (body dx, dy, sx, sy, lean rot, ms, hit?, arm turn in degrees (+ = tip swings back, - = tip swings forward and up), arm slide x, arm slide y in still pixels)
def _mix(a, b, t): return tuple(x + (y - x) * t for x, y in zip(a, b))
_WIND = [(0.03, 0, 1.0, 1.0, -8, 120, 0, 10, 4, 0), (0.07, 0, 1.0, 1.01, -13, 190, 0, 38, 12, 4)]
_A, _B, _C = ((-0.08, 0, 1.02, 0.99, 2, 30, 1, -8, -30, -4), (-0.20, 0, 1.03, 0.98, 7, 30, 1, -34, -70, -10), (-0.28, 0, 1.04, 0.97, 10, 130, 1, -40, -85, -8))
_REC = [(-0.14, 0, 1.0, 1.0, 5, 110, 0, -25, -45, -6), (-0.05, 0, 1.0, 1.0, 2, 110, 0, -8, -15, -2), (0, 0, 1, 1, 0, 110, 0, 0, 0, 0)]
# the thrust is drawn in small steps so the tip's box travels with it and never skips over her
SPEAR = _WIND + [_A, _mix(_A, _B, 1 / 3)[:5] + (30, 1) + _mix(_A, _B, 1 / 3)[7:], _mix(_A, _B, 2 / 3)[:5] + (30, 1) + _mix(_A, _B, 2 / 3)[7:],
                 _B, _mix(_B, _C, 0.5)[:5] + (30, 1) + _mix(_B, _C, 0.5)[7:], _C] + _REC
TIP_HALF = 14                                              # the spear tip's damage box is this many sheet pixels each way


def hurt(): return [(0.06, 0, 0.98, 1.0, -9, 130), (0.10, 0, 0.97, 1.0, -14, 130)]
def death(boss):
    seq = [(0.06, 0, 1.0, 0.95, -10, 120), (0.12, 0, 1.08, 0.80, -20, 150), (0.18, 0, 1.16, 0.62, -30, 170), (0.22, 0, 1.22, 0.46, -34, 400)]
    return seq[:3] if boss else seq

def render(S, w, h, pf, pb, pt, pbot, cw, ch, cx, by, dx, dy, sx, sy, rot, pad=0):
    # pad: S carries `pad` extra sheet pixels on every side (the swinging arm); w and h stay the plain body size
    sw, sh = max(1, round(w * sx)), max(1, round(h * sy))
    s = S.resize((max(1, round(S.width * sx)), max(1, round(S.height * sy))), Image.NEAREST)
    big = Image.new('RGBA', (cw, ch), (0, 0, 0, 0))
    px = round(cx + dx * w - sw / 2 - pad * sx); py = round(by - dy * h - sh - pad * sy)
    sw, sh = s.size
    big.alpha_composite(s, (px, py)) if 0 <= px and 0 <= py and px + sw <= cw and py + sh <= ch else big.paste(s, (px, py), s)
    if rot: big = big.rotate(rot, resample=Image.NEAREST, center=(cx + dx * w, by - dy * h))
    return big

def build(name, c):
    im = Image.open(os.path.join(HERE, 'clean', f"creature{c['src']}.png")).convert('RGBA')
    if c.get('rig'):                                                    # white removed from the rider, arm and spear split out (boar_rig.py)
        import boar_rig
        fixed, body_n, arm_n = boar_rig.make()
        im = fixed
    if c['src'] in FLIP: im = im.transpose(Image.FLIP_LEFT_RIGHT)
    if c.get('hue'):                                                    # recolour a reused sprite
        import colorsys
        px = im.load()
        for y in range(im.height):
            for x in range(im.width):
                r, g, b, a = px[x, y]
                if a:
                    hh, ss, vv = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255); r2, g2, b2 = colorsys.hsv_to_rgb((hh + c['hue']) % 1, ss, vv); px[x, y] = (round(r2 * 255), round(g2 * 255), round(b2 * 255), a)
    k = 2 * c['H'] / im.height
    w, h = round(im.width * k), round(im.height * k)
    S = im.resize((w, h), Image.LANCZOS if k < 1 else Image.NEAREST)
    # clean up partial alpha made by resampling
    a = S.getchannel('A').point(lambda v: 255 if v > 110 else 0); S.putalpha(a)
    pf, pb, pt, pbot = round(0.5 * w), round(0.4 * w), round(0.3 * h), 6
    cw, ch = pf + w + pb, pt + h + pbot
    cx, by = pf + w // 2, pt + h
    boss = c.get('boss', False)
    frames, cells, anims = [], [], {}
    def add(rec, hit=None, ms=100):
        dx, dy, sx, sy, rot = rec[:5]
        fr = render(S, w, h, pf, pb, pt, pbot, cw, ch, cx, by, dx, dy, sx, sy, rot)
        bb = fr.getchannel('A').getbbox()
        L, T, R, B = bb
        hx0, hx1 = (L + (R - L) * 0.12) - cx, (R - (R - L) * 0.12) - cx
        hurtb = [round(hx0), 0, round(hx1), max(2, round(by - T))]
        hitb = None
        if hit:
            x0, x1, y0, y1 = hit
            hitb = [round(L - cx + x0 * w), round(y0 * h + max(0, dy) * 0), round(L - cx + x1 * w), round(y1 * h)]
            hitb[1] = round(y0 * h * (sy if sy else 1) + dy * h); hitb[3] = round(y1 * h * (sy if sy else 1) + dy * h)
        i = len(cells); cells.append(fr)
        frames.append({'src': i, 'ms': ms, 'hurt': hurtb, 'hit': hitb, 'ground': 0})
        return i
    def scaled(T):                                                      # a still-sized image -> sheet size, like S
        out = T.resize((max(1, round(T.width * k)), max(1, round(T.height * k))), Image.LANCZOS if k < 1 else Image.NEAREST)
        out.putalpha(out.getchannel('A').point(lambda v: 255 if v > 110 else 0)); return out
    if c.get('rig'):
        import boar_rig
        PADN = 150                                                      # still pixels of room around the still for the swinging arm
        S_body = scaled(body_n)
        px0, py0 = boar_rig.PIVOT
        prev = {'tip': None}
        def add_rig(rec):
            dx, dy, sx, sy, rot, ms, hit, th, tx, ty = rec
            T = Image.new('RGBA', (im.width + 2 * PADN, im.height + 2 * PADN), (0, 0, 0, 0))
            T.alpha_composite(body_n, (PADN, PADN))
            A = Image.new('RGBA', T.size, (0, 0, 0, 0)); A.alpha_composite(arm_n, (PADN, PADN))
            A = A.rotate(th, resample=Image.NEAREST, center=(PADN + px0, PADN + py0))
            A = ImageChops.offset(A, round(tx), round(ty))
            boar_rig.close_gaps(A)                                         # nearest rotation opens pinholes along the shaft and the sleeve
            T.alpha_composite(A)
            # the spear tip, found by turning and sliding a marker the same way
            t = math.radians(th); ddx, ddy = boar_rig.TIP[0] - px0, boar_rig.TIP[1] - py0
            tipx = px0 + ddx * math.cos(t) + ddy * math.sin(t) + tx; tipy = py0 - ddx * math.sin(t) + ddy * math.cos(t) + ty
            args = (w, h, pf, pb, pt, pbot, cw, ch, cx, by, dx, dy, sx, sy, rot)
            fr = render(scaled(T), *args, pad=PADN * k)
            boar_rig.close_gaps(fr)                                        # the lean is another nearest rotation; close what it opens
            bb = render(S_body, *args).getchannel('A').getbbox()        # the body only, so the swinging arm does not stretch its hitbox
            L, T0, R, B = bb
            hurtb = [round((L + (R - L) * 0.12) - cx), 0, round((R - (R - L) * 0.12) - cx), max(2, round(by - T0))]
            # the tip through the same steps the picture takes: still pixels -> sheet pixels -> squash and place -> lean about the anchor
            swb, shb = max(1, round(w * sx)), max(1, round(h * sy))
            qx = cx + dx * w - swb / 2 + (PADN + tipx) * k * sx - PADN * k * sx; qy = by - dy * h - shb + (PADN + tipy) * k * sy - PADN * k * sy
            ox, oy = cx + dx * w, by - dy * h; rr = math.radians(rot)
            tx_ = ox + (qx - ox) * math.cos(rr) + (qy - oy) * math.sin(rr); ty_ = oy - (qx - ox) * math.sin(rr) + (qy - oy) * math.cos(rr)
            tipc = (tx_ - cx, by - ty_)                                  # sheet pixels from the anchor, y up
            hitb = None
            if hit:
                xs = [tipc[0]]; ys = [tipc[1]]                              # a small box on the tip itself
                hitb = [round(min(xs) - TIP_HALF), max(-4, round(min(ys) - TIP_HALF)), round(max(xs) + TIP_HALF), round(max(ys) + TIP_HALF)]
            prev['tip'] = tipc if hit else None                          # the sweep only joins consecutive striking frames, never the wind-up
            i = len(cells); cells.append(fr)
            frames.append({'src': i, 'ms': ms, 'hurt': hurtb, 'hit': hitb, 'ground': 0, 'rig': True})
            return i
    anims['idle'] = {'frames': [add(r, None, r[5]) for r in idle(2 if boss else 4)], 'loop': True}
    anims['walk'] = {'frames': [add(r, None, r[5]) for r in walk(boss)], 'loop': True}
    stats = {}
    for a in c['atk']:
        ids = []
        if a['style'] == 'rig':
            prev['tip'] = None
            ids = [add_rig(r) for r in SPEAR]
        else:
          for r in attack(a['style']):
            ids.append(add(r, a['hit'] if r[6] else None, r[5]))
        anims[a['name']] = {'frames': ids, 'loop': False}
        stats[a['name']] = {'dmg': a['dmg'], 'knock': a['knock']}
    anims['hurt'] = {'frames': [add(r, None, r[5]) for r in (hurt()[:1] if boss else hurt())], 'loop': False}
    anims['death'] = {'frames': [add(r, None, r[5]) for r in death(boss)], 'loop': False}
    sheet = Image.new('RGBA', (cw * len(cells), ch), (0, 0, 0, 0))
    for i, f in enumerate(cells): sheet.paste(f, (i * cw, 0))
    os.makedirs(os.path.join(OUT, 'enemies'), exist_ok=True)
    sheet.save(os.path.join(OUT, 'enemies', f'{name}.png'), optimize=True)
    ai = {'speed': c['speed'], 'reach': 70, 'attacks': [a['name'] for a in c['atk']], 'rest': c['rest'], 'death': 'death', 'stun': 'hurt',
          'knock': c['knock'], 'parried': c['parried'], 'hp': c['hp'], 'dmg': c['atk'][0]['dmg'], 'atk': stats}
    if boss: ai['boss'] = True; ai['bossName'] = c['title']
    return {'title': name, 'sheet': f'assets/enemies/{name}.png', 'cell': [cw, ch], 'anchor': [cx, by], 'frames': frames, 'anims': anims, 'ai': ai}, (cw, ch, len(cells))

if __name__ == '__main__':
    only = sys.argv[1:]                                                  # python3 build.py boarlord   rebuilds just that one and keeps the rest of creatures.js
    data = {}
    if only:
        old = open(os.path.join(OUT, 'creatures.js')).read(); i = old.index('{"hobgoblin"'); j = old.rindex('}')
        data = json.loads(old[i:j + 1])
    for n, c in C.items():
        if only and n not in only: continue
        data[n], info = build(n, c); print(n, info)
    if not only:
        import mirror
        data['mirrormax'], info = mirror.build(); print('mirrormax', info)
    open(os.path.join(OUT, 'creatures.js'), 'w').write('// generated by tools/creatures/build.py\nwindow.BIBOO.enemies = Object.assign(window.BIBOO.enemies || {}, ' + json.dumps(data, separators=(',', ':')) + ');\n')
