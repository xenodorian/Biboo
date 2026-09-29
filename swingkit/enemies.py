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
            # frame ranges as specified by the user (inclusive; neighbours share a frame on purpose)
            slash=dict(frames=range(18, 28)),    # spin slash, then the long lunge smear
            dive=dict(frames=range(27, 36)),     # dive roll forward into a slash
            combo=dict(frames=range(35, 51)),    # crouch, leap, air slashes, green spin
        ),
        # frames whose blade or smear can hit (read off the art): the spin and lunge smears, the
        # slash out of the dive roll, the blue air slashes and the green spin
        active=[20, 21, 24, 25, 31, 32, 39, 40, 41, 47, 48, 49],
        around=[47, 48, 49],                     # the green spin circles the body: it hits all round
        # every attack returns to idle; dive is the gap closer, used from mid range.
        # knock: how far (px) and how long (ms) a clean hit pushes her back (the stun lasts as long)
        ai=dict(speed=48, reach=70, attacks=['slash', 'combo'], dive=dict(anim='dive', min=110, max=170),
                rest=[500, 1100], death=None, stun=None, knock=[40, 300], parried=[50, 450]),
    ),
    'orc': dict(
        # 5x: the swing (frames 27-28) then passes 70-105 px up, over a ducking Max (hurtbox top 69)
        # but into her standing hurtbox (top 81)
        title='Orc', src='orc.gif', px=12, bg=(113, 113, 113), scale=5,
        feet=47, anchor=19, body=8, tall=26,
        smear=(121, 126, 165, 169, 175),         # translucent white over the background
        anims=dict(
            idle=dict(frames=range(0, 4), loop=True),
            walk=dict(frames=range(8, 16), loop=True),
            attack=dict(frames=range(25, 32)),   # sword over the shield, overhead swing
            hurt=dict(frames=range(49, 51)),
            death=dict(frames=range(57, 61)),    # last frame held
        ),
        active=[27, 28],                         # the overhead swing and its smear
        front='anchor',                          # the sword swings close: count all of it ahead of the centre
        weapon=(235, 171),                       # blade greys: only the sword and its smear hit, not the body
        ai=dict(speed=40, reach=52, attacks=['attack'], rest=[700, 1300], death='death', stun='hurt',
                knock=[64, 400], parried=[40, 450]),
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


def hitbox(rgba, cfg, hurt):
    """[x0, y0, x1, y1] native: the weapon and smear in front of the body on an active frame."""
    vis = (rgba[..., 3] > 0) & (rgba[..., 3] != 80)          # anything drawn but the ground shadow
    if 'weapon' in cfg:                                      # just the blade and the translucent smear
        c = rgba[..., :3].astype(int)
        grey = (c[..., 0] == c[..., 1]) & (c[..., 1] == c[..., 2])
        vis = (grey & np.isin(c[..., 0], cfg['weapon']) & (rgba[..., 3] == 255)) | ((rgba[..., 3] > 0) & (rgba[..., 3] < 255))
    front = cfg['anchor'] if (cfg.get('front') == 'anchor' or not hurt) else hurt[2] - 2
    ys, xs = np.nonzero(vis[:, front:])
    if not len(xs):
        return None
    return [int(xs.min()) + front, int(ys.min()), int(xs.max()) + front, int(ys.max())]


def _flip_box(b, ax, cfg):
    """Native box -> px from the anchor after the flip (x right, y up from the feet row)."""
    s = cfg['scale']
    x0, y0, x1, y1 = b
    return [round((ax - x1 - 1) * s), (cfg['feet'] - y1) * s, round((ax - x0) * s), (cfg['feet'] + 1 - y0) * s]


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
            hn = hurtbox(a, cfg)
            hb = _flip_box(hn, ax, cfg) if hn is not None else None
            hit = None
            if i in cfg.get('active', ()):
                hn2 = hitbox(a, cfg, None if i in cfg.get('around', ()) else hn)
                if i in cfg.get('around', ()):   # whole drawing, both sides of the body
                    ys_, xs_ = np.nonzero((a[..., 3] > 0) & (a[..., 3] != 80))
                    hn2 = [int(xs_.min()), int(ys_.min()), int(xs_.max()), int(ys_.max())]
                hit = _flip_box(hn2, ax, cfg) if hn2 is not None else None
            # ground point this frame, px from the anchor (the art moves inside its frame during
            # rolls and leaps; the game carries that motion over when the animation ends)
            gx = round((ax - 0.5 - ground_x(a, cfg)) * s)
            fl.append(dict(src=i, ms=frames[i][1], hurt=hb, hit=hit, ground=gx))
        sheet.save(out / f'{name}.png', optimize=True)
        pos = {i: k for k, i in enumerate(used)}
        anims = {an: dict(frames=[pos[i] for i in a['frames']], loop=bool(a.get('loop', False)))
                 for an, a in cfg['anims'].items()}
        data[name] = dict(title=cfg['title'], sheet=f'assets/enemies/{name}.png', cell=[cw, ch],
                          anchor=[round((x1 + 1 - ax) * s), (cfg['feet'] - y0 + 1) * s - 1],
                          frames=fl, anims=anims, ai=cfg['ai'])
        log(f'enemy {name}: {len(used)} frames, {len(anims)} animations, cell {cw}x{ch}')
    return data
