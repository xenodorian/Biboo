"""Export the scene and every move for the browser game in web/.

Each move frame becomes one transparent "actor" image: effects behind, the character, effects in
front, drawn around a camera locked to the character, so the game can place it at the character's
world position. Frames are cropped to one box per move and packed left to right in a sheet.
Black-and-white impact frames are full-screen images drawn over the whole view. data.js holds the
timing, root motion, camera shake, loop points and the controller map, so index.html works when
opened straight from disk (no server needed).
"""
import json
from pathlib import Path

import numpy as np
from PIL import Image

from . import anim, bg, fx, rig, movefx, movekit, composite as cp
from .paths import ROOT

W, H, M, VH = bg.W, bg.H, bg.M, bg.VH
WEB = ROOT / 'web'


def _game_cam(root):
    """The game camera: locked to the character in x, rises once a jump clears 30 px."""
    return (root[0], max(0.0, root[1] - 30))


def move_frame(move, i):
    """(actor layer in layer coordinates with the character's anchor at (X0, GROUND_LY), bw view or None)."""
    fr = move.frames[i]
    C, sw, parts = anim.render_pose(fr)
    if fr.get('flip'):
        C = movekit.mirror(C)
    rx, ry = fr['root']
    ch, line = movekit.char_layer(C, (0.0, 0.0))            # camera on the character: root -> (0, 0)
    back, front = fx.Layer(), fx.Layer()
    ctx = movefx.Ctx(back, front, fr, movekit.Sword_at(fr), (0.0, 0.0), ch[..., 3] > 0, i, move)
    ctx.gy = fx.GROUND_LY + int(round(ry))                  # the ground, seen from the character
    ctx.char = ch
    ctx.ground = fx.Layer()
    for name, kw in fr.get('fx', []):
        movefx.EFFECTS[name](ctx, **kw)
    if ry <= 0:
        back.clip_below(ctx.gy); front.clip_below(ctx.gy + 1)
    actor = np.zeros((H, W, 4), np.uint8)
    for L in (ctx.ground.a, back.a, ch, front.a):
        cp.over(actor, L)
    bw = None
    if fr.get('bw'):                                        # full screen, as the game camera sees it
        cam = _game_cam((rx, ry))
        root = (rx - cam[0], ry - cam[1])
        ch2, line2 = movekit.char_layer(C, root)
        dx, dy = fr.get('shake', (0, 0))
        gy = fx.GROUND_LY + int(round(cam[1]))
        bw = fx.impact_frame_bw(movekit.view(ch2, dx, dy, False),
                                movekit.view(line2[..., None].repeat(4, 2).astype(np.uint8), dx, dy, False)[..., 0] > 0,
                                movekit._bw_point(fr, sw, root, dx, dy), gy - M + dy)
    return actor, bw


def heavy_frame(i):
    """The main chop: its own effects and character, same anchor as the move library."""
    parts = {}
    view = cp.render_frame(i, parts)
    actor = np.zeros((H, W, 4), np.uint8)
    for L in (parts['back'], cp.char_layer(parts['char']), parts['front']):
        cp.over(actor, L)
    return actor, (view if anim.FRAMES[i].get('bw') else None)


def _pack(actors):
    """Crop every frame to one shared box and pack them left to right."""
    alpha = np.any(np.stack([a[..., 3] > 0 for a in actors]), 0)
    ys, xs = np.nonzero(alpha)
    y0, y1, x0, x1 = int(ys.min()), int(ys.max()), int(xs.min()), int(xs.max())
    cw, chh = x1 - x0 + 1, y1 - y0 + 1
    sheet = Image.new('RGBA', (cw * len(actors), chh))
    for k, a in enumerate(actors):
        sheet.paste(Image.fromarray(a[y0:y1 + 1, x0:x1 + 1]), (k * cw, 0))
    return sheet, [cw, chh], [fx.X0 - x0, fx.GROUND_LY - y0]


def export(out_dir=WEB, log=print):
    from . import moves
    out = Path(out_dir)
    for d in ('assets/moves', 'assets/bw', 'assets/layers'):
        (out / d).mkdir(parents=True, exist_ok=True)
    for name, rgba in cp.layers().items():
        Image.fromarray(rgba).save(out / 'assets' / 'layers' / f'{name}.png', optimize=True)

    entries = {}

    def add(mid, title, inp, loop, loop_from, input_type, frames, results):
        actors = [r[0] for r in results]
        sheet, cell, anchor = _pack(actors)
        sheet.save(out / 'assets' / 'moves' / f'{mid}.png', optimize=True)
        fl = []
        for k, (f, (_, bw)) in enumerate(zip(frames, results)):
            bw_path = None
            if bw is not None:
                bw_path = f'assets/bw/{mid}_{k + 1:02d}.png'
                Image.fromarray(bw).save(out / bw_path, optimize=True)
            fl.append(dict(ms=int(f['ms']), root=[round(float(f['root'][0]), 1), round(float(f['root'][1]), 1)],
                           shake=[int(v) for v in f.get('shake', (0, 0))], bw=bw_path))
        entries[mid] = dict(title=title, input=inp, loop=bool(loop), loopFrom=int(loop_from),
                            inputType=input_type, sheet=f'assets/moves/{mid}.png', cell=cell, anchor=anchor, frames=fl)

    hf = [dict(f, root=(0.0, 0.0), shake=cp.SHAKE.get(i, (0, 0))) for i, f in enumerate(anim.FRAMES)]
    add('heavy', 'Heavy overhead chop', 'Up+A', False, 0, 'chord', hf, [heavy_frame(i) for i in range(len(anim.FRAMES))])
    for m in moves.all_moves():
        add(m.id, m.title, m.inputs, m.loop, m.loop_from, m.input_type, m.frames,
            [move_frame(m, i) for i in range(len(m.frames))])

    input_map = json.loads((ROOT / 'game' / 'input_map.json').read_text())
    data = dict(
        view=dict(w=W, h=VH, margin=M, anchorX=int(fx.X0), feetRow=int(fx.Y0 + rig.FEET_ROW)),
        layers=[dict(name=n, src=f'assets/layers/{n}.png', parallax=float(bg.PARALLAX.get(n, 1.0)),
                     shake=float(cp.SHAKE_PARALLAX.get(n, 1.0))) for n in bg.ORDER_BACK],
        fringe=dict(src='assets/layers/fringe.png'),
        moves=entries, input=input_map)
    (out / 'assets' / 'data.js').write_text(
        '// Generated by `python -m swingkit --web`. Do not edit by hand.\nwindow.BIBOO = '
        + json.dumps(data, separators=(',', ':')) + ';\n')
    log(f'web: {len(entries)} moves -> {out / "assets"}')
    return data
