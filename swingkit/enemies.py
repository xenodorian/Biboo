"""Enemy sprites for the browser game, cut from the packed GIFs in data/enemies.

Each source GIF is an upscaled pixel-art sheet with several animations played back to back on a
flat background. This module samples it down to native pixels, keys out the background (the
goblin's ground shadow and the orc's sword smear become translucent), flips it to face left (toward
the player, who starts on the left facing right), scales it for the game and packs one sheet per
enemy. The animation split below was read off the frames by hand; frame numbers are 0-based GIF
frames.

Coordinates in the output match the move hitboxes: px relative to the enemy's anchor (a point on
the ground under its body), x right, y up. Enemies face left, so their front is at negative x.
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageSequence

from .paths import DATA

SRC = DATA / 'enemies'

ENEMIES = {
    'goblin': dict(
        title='Goblin', src='goblin.gif', px=4, bg=(94, 92, 92), shadow=(73, 75, 81), scale=2,
        feet=96, anchor=62,                     # native feet row and ground x (shadow centre, frame 0)
        body=9, lead=4, tall=30,                # hurtbox half width, forward shift from the ground point, max height (native px)
        anims=dict(
            idle=dict(frames=range(0, 6), loop=True),
            # the sheet has no walk cycle: the goblin slides forward in its ready stance
            walk=dict(frames=range(0, 6), loop=True),
            spin=dict(frames=range(18, 24)),     # spinning slash, white smear
            lunge=dict(frames=range(24, 28)),    # forward lunge, long smear
            combo=dict(frames=range(28, 64)),    # roll and slash, leap, green spin, energy blast, land
        ),
        ai=dict(speed=48, reach=70, attacks=['spin', 'lunge', 'lunge', 'combo'], rest=[500, 1100], death=None),
    ),
    'orc': dict(
        title='Orc', src='orc.gif', px=12, bg=(113, 113, 113), scale=3,
        feet=47, anchor=19, body=8, tall=26,
        smear=(121, 126, 165, 169, 175),         # translucent white over the background
        anims=dict(
            idle=dict(frames=range(0, 4), loop=True),
            walk=dict(frames=range(8, 16), loop=True),
            attack=dict(frames=range(25, 32)),   # sword over the shield, overhead swing
            hurt=dict(frames=range(49, 51)),
            death=dict(frames=range(57, 61)),    # last frame held
        ),
        ai=dict(speed=30, reach=52, attacks=['attack'], rest=[700, 1300], death='death'),
    ),
}


def native_frames(cfg):
    """[(rgb uint8 HxWx3, ms)] at native resolution (one sample from the middle of each block)."""
    im = Image.open(SRC / cfg['src'])
    k = cfg['px']
    out = []
    for fr in ImageSequence.Iterator(im):
        a = np.asarray(fr.convert('RGB'))
        out.append((a[k // 2::k, k // 2::k].copy(), int(fr.info.get('duration', 100))))
    return out


def cut(rgb, cfg):
    """RGBA with the background keyed out."""
    h, w, _ = rgb.shape
    out = np.zeros((h, w, 4), np.uint8)
    out[..., :3] = rgb
    out[..., 3] = 255
    bg = np.array(cfg['bg'])
    out[np.all(rgb == bg, 2), 3] = 0
    if 'shadow' in cfg:                          # ground shadow: soft black
        m = np.all(rgb == np.array(cfg['shadow']), 2)
        out[m] = (0, 0, 0, 80)
    grey = (rgb[..., 0] == rgb[..., 1]) & (rgb[..., 1] == rgb[..., 2])
    for v in cfg.get('smear', ()):              # white laid over the background at some opacity
        m = grey & (rgb[..., 0] == v)
        out[m] = (255, 255, 255, int(round(255 * (v - bg[0]) / (255 - bg[0]))))
    return out


def ground_x(rgba, cfg):
    """x of the enemy on the ground this frame: centre of its shadow if it has one."""
    if 'shadow' in cfg:
        sy, sx = np.nonzero(rgba[..., 3] == 80)
        if len(sx):
            return (sx.min() + sx.max()) / 2
    return float(cfg['anchor'])


def hurtbox(rgba, cfg):
    """[x0, y0, x1, y1] native, around the body over its ground point (effects mostly left out)."""
    gx = ground_x(rgba, cfg) + cfg.get('lead', 0)   # the source art faces right: forward is +x
    b = cfg['body']
    x0, x1 = int(round(gx - b)), int(round(gx + b))
    solid = rgba[..., 3] == 255
    ys = np.nonzero(solid[:, max(0, x0):x1 + 1].any(1))[0]
    if not len(ys):
        return None
    y1 = int(ys.max()); y0 = max(int(ys.min()), y1 - cfg['tall'])
    return [x0, y0, x1, y1]


def export(out_dir, log=print):
    out = Path(out_dir) / 'assets' / 'enemies'
    out.mkdir(parents=True, exist_ok=True)
    data = {}
    for name, cfg in ENEMIES.items():
        frames = native_frames(cfg)
        used = sorted({i for a in cfg['anims'].values() for i in a['frames']})
        cutf = {i: cut(frames[i][0], cfg) for i in used}
        alpha = np.any(np.stack([cutf[i][..., 3] > 0 for i in used]), 0)
        ys, xs = np.nonzero(alpha)
        y0, y1 = int(ys.min()), max(int(ys.max()), cfg['feet'])
        x0, x1 = int(xs.min()), int(xs.max())
        s = cfg['scale']
        cw, ch = (x1 - x0 + 1) * s, (y1 - y0 + 1) * s
        sheet = Image.new('RGBA', (cw * len(used), ch))
        ax = cfg['anchor'] + 0.5                 # anchor: middle of the anchor column, bottom of the feet row
        fl = []
        for k, i in enumerate(used):
            a = cutf[i]
            crop = Image.fromarray(a[y0:y1 + 1, x0:x1 + 1]).transpose(Image.FLIP_LEFT_RIGHT)
            sheet.paste(crop.resize((cw, ch), Image.NEAREST), (k * cw, 0))
            hb = hurtbox(a, cfg)
            if hb is not None:                   # flipped: native x -> -(x - ax)
                bx0, by0, bx1, by1 = hb
                hb = [round((ax - bx1 - 1) * s), (cfg['feet'] - by1) * s, round((ax - bx0) * s), (cfg['feet'] + 1 - by0) * s]
            fl.append(dict(src=i, ms=frames[i][1], hurt=hb))
        sheet.save(out / f'{name}.png', optimize=True)
        pos = {i: k for k, i in enumerate(used)}
        anims = {an: dict(frames=[pos[i] for i in a['frames']], loop=bool(a.get('loop', False)))
                 for an, a in cfg['anims'].items()}
        data[name] = dict(title=cfg['title'], sheet=f'assets/enemies/{name}.png', cell=[cw, ch],
                          anchor=[round((x1 + 1 - ax) * s), (cfg['feet'] - y0 + 1) * s - 1],
                          frames=fl, anims=anims, ai=cfg['ai'])
        log(f'enemy {name}: {len(used)} frames, {len(anims)} animations, cell {cw}x{ch}')
    return data
