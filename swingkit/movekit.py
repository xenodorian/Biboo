"""Render, export and describe the move library (swingkit.moves).

For every move: composited preview frames (scene, effects, camera), transparent character
sprites on one shared anchor, GIFs, and an entry in game/moves.json with timing, root motion,
hitboxes and the controller input that triggers it.
"""
import json
import numpy as np
from pathlib import Path
from PIL import Image

from . import anim, bg, fx, rig, movefx, gifwrite
from . import composite as cp

W, H, M, VH = bg.W, bg.H, bg.M, bg.VH


def mirror(C, cx=32):
    """Mirror the sprite canvas about sprite column cx (turning around during a spin)."""
    out = np.full_like(C, -1)
    c = cx + rig.PX
    xs = np.arange(C.shape[1]); src = 2 * c - xs
    ok = (src >= 0) & (src < C.shape[1])
    out[:, xs[ok]] = C[:, src[ok]]
    return out


def char_layer(C, root):
    img = rig.to_rgba(C)
    Lr = np.zeros((H, W, 4), np.uint8)
    ox, oy = fx.X0 - rig.PX + int(round(root[0])), fx.Y0 + M - rig.PY - int(round(root[1]))
    ys, xs = np.nonzero(img[..., 3])
    ly, lx = ys + oy, xs + ox
    ok = (ly >= 0) & (ly < H) & (lx >= 0) & (lx < W)
    Lr[ly[ok], lx[ok]] = img[ys[ok], xs[ok]]
    line = np.zeros((H, W), bool)
    o = C[ys, xs] == rig.OUT
    line[ly[ok & o], lx[ok & o]] = True
    return Lr, line


def view(rgba, dx, dy, wrap):
    """VH rows of a layer after a camera offset: dx shifts right, dy shifts down. Rows beyond the
    layer margins repeat the edge row (sky above, soil below)."""
    a = rgba
    top, bot = max(0, dy - M), max(0, -dy - M)
    if top or bot:
        a = np.pad(a, ((top, bot), (0, 0), (0, 0)), mode='edge' if wrap else 'constant')
    dxi = int(round(dx))
    if wrap:
        a = np.roll(a, dxi, axis=1)
    elif dxi:
        b = np.zeros_like(a)
        if dxi > 0: b[:, dxi:] = a[:, :-dxi]
        else: b[:, :dxi] = a[:, -dxi:]
        a = b
    r0 = M - dy + top
    return a[r0: r0 + VH]


def camera(move, fr):
    rx, ry = fr['root']
    if move.camera == 'follow_x': return (rx, 0)
    if move.camera == 'follow': return (rx, max(0.0, ry - 30))
    if move.camera == 'follow_y': return (0, max(0.0, ry - 30))
    return (0, 0)


def render(move, i, offset=(0, 0)):
    """Composite frame i of a move. Returns (view rgba, parts) with parts for export. offset adds
    to the root (used to chain walk cycles in the preview)."""
    fr = move.frames[i]
    if offset != (0, 0):
        fr = dict(fr, root=(fr['root'][0] + offset[0], fr['root'][1] + offset[1]))
    C, sw, parts = anim.render_pose(fr)
    if fr.get('flip'): C = mirror(C)
    cam = camera(move, fr)
    # the character and effects are drawn relative to the camera; the ground moves with it
    root = (fr['root'][0] - cam[0], fr['root'][1] - cam[1])
    gy = fx.GROUND_LY + int(round(cam[1]))
    ch, line = char_layer(C, root)
    back, front = fx.Layer(), fx.Layer()
    ctx = movefx.Ctx(back, front, fr, Sword_at(fr), root, ch[..., 3] > 0, i, move)
    ctx.gy = gy
    ctx.char = ch                                  # character pixels in layer space (afterimages)
    ctx.ground = fx.Layer()                       # drawn over the ground, never clipped (cracks)
    for name, kw in fr.get('fx', []):
        movefx.EFFECTS[name](ctx, **kw)
    if fr['root'][1] <= 0:
        back.clip_below(gy); front.clip_below(gy + 1)
    sx, sy = fr.get('shake', (0, 0))
    dx, dy = sx, sy
    if fr.get('bw'):
        out = fx.impact_frame_bw(view(ch, dx, dy, False), view(line[..., None].repeat(4, 2).astype(np.uint8), dx, dy, False)[..., 0] > 0,
                                 _bw_point(fr, sw, root, dx, dy), gy - M + dy)
        return out, dict(char=C, back=back.a, front=front.a)
    out = np.zeros((VH, W, 4), np.uint8)
    for name in bg.ORDER_BACK:
        f = cp.SHAKE_PARALLAX[name]
        par = bg.PARALLAX.get(name, 1.0) if isinstance(bg.PARALLAX, dict) else 1.0
        cp.over(out, view(cp.layers()[name], -cam[0] * par + sx * f, int(round(cam[1] * par + sy * f)), True))
    for Lr in (ctx.ground.a, back.a, ch, front.a):
        cp.over(out, view(Lr, dx, int(round(dy)), False))
    cp.over(out, view(cp.layers()['fringe'], -cam[0] + sx, int(round(cam[1] + sy)), True))
    return out, dict(char=C, back=back.a, front=front.a)


def Sword_at(fr):
    return rig.Sword(fr['theta'], fr['H'])


def _bw_point(fr, sw, root, dx, dy):
    u = (rig.FEET_ROW - sw.B0[1]) / sw.d[1] if abs(sw.d[1]) > 1e-3 else rig.Sword.L
    p = fx.to_layer(sw.B0 + min(u, rig.Sword.L) * sw.d)
    return (p[0] + root[0] + dx, p[1] - root[1] - M + dy)


def hitbox(fr):
    """Active hit area in sprite coordinates relative to the anchor (x from sprite x=0, y up from
    the feet row): a capsule along the blade (guard to tip) or around the kicking foot."""
    if not fr.get('active'): return None
    if fr.get('hit') == 'foot':
        a = np.array(fr['legs']['right']['ankle'], float)
        p, q, r = a, a + np.array([12.0, 2.0]), 6.0
    else:
        sw = Sword_at(fr); p, q, r = sw.G, sw.tip, rig.Sword.HW + 1
    to = lambda v: [round(float(v[0]), 1), round(float(rig.FEET_ROW - v[1]), 1)]
    return dict(shape='capsule', a=to(p), b=to(q), radius=r)


def build_move(move, out_dir, scales=(2,)):
    d = Path(out_dir) / move.id
    (d / 'frames').mkdir(parents=True, exist_ok=True); (d / 'character').mkdir(exist_ok=True)
    frames, chars = [], []
    for i in range(len(move.frames)):
        v, parts = render(move, i)
        frames.append(v)
        Image.fromarray(v).save(d / 'frames' / f'{move.id}_{i + 1:02d}.png')
        chars.append(rig.to_rgba(parts['char']))
    ys0 = min(np.nonzero(c[..., 3])[0].min() for c in chars); ys1 = max(np.nonzero(c[..., 3])[0].max() for c in chars)
    xs0 = min(np.nonzero(c[..., 3])[1].min() for c in chars); xs1 = max(np.nonzero(c[..., 3])[1].max() for c in chars)
    cw, chh = int(xs1 - xs0 + 1), int(ys1 - ys0 + 1)
    sheet = Image.new('RGBA', (cw * len(chars), chh))
    for i, c in enumerate(chars):
        crop = Image.fromarray(c).crop((xs0, ys0, xs1 + 1, ys1 + 1))
        crop.save(d / 'character' / f'{move.id}_{i + 1:02d}.png'); sheet.paste(crop, (i * cw, 0))
    sheet.save(d / 'character' / f'{move.id}_sheet.png')
    durs = [f['ms'] for f in move.frames]
    gif_frames, gif_durs = frames, durs
    if move.preview_cycles > 1:                   # chain cycles so the preview walks on
        r = [f['root'][0] for f in move.frames]
        step = r[-1] + (r[-1] - r[-2])
        gif_frames, gif_durs = [], []
        for c in range(move.preview_cycles):
            off = step * (c - (move.preview_cycles - 1) / 2)
            gif_frames += [render(move, i, (off, 0))[0] for i in range(len(move.frames))]; gif_durs += durs
    for s in scales:
        gifwrite.write_gif(gif_frames, d / f'{move.id}_x{s}.gif', s, gif_durs)
    entry = dict(
        id=move.id, title=move.title, input=move.inputs, kind=move.kind, loop=move.loop, notes=move.notes,
        sheet=f'{move.id}/character/{move.id}_sheet.png', frame_size=[cw, chh],
        anchor_in_frame=[int(rig.PX - xs0), int(rig.PY + rig.FEET_ROW - ys0)],
        total_ms=sum(durs),
        frames=[dict(i=i + 1, name=f['name'], ms=f['ms'],
                     root=[round(float(f['root'][0]), 1), round(float(f['root'][1]), 1)],
                     active=bool(f.get('active', False)), hitbox=hitbox(f),
                     flip=bool(f.get('flip', False)), impact_frame_bw=bool(f.get('bw', False)),
                     shake=list(f.get('shake', (0, 0))), sword_angle_deg=round(float(f['theta']), 1))
                for i, f in enumerate(move.frames)])
    return frames, entry


def heavy_entry(frames_ms):
    """The heavy attack (up + A) from the main build, described like the library moves."""
    from . import composite
    return dict(id='heavy', title='Heavy overhead chop', input='Up+A', kind='basic', loop=False,
                notes='the main animation (swing_x3.gif); high damage; impact frame 5, black-and-white frame 6',
                sheet='character/char_sheet.png', total_ms=sum(frames_ms),
                frames=[dict(i=i + 1, name=f['name'], ms=f['ms'], root=[0.0, 0.0],
                             active=f['name'] == 'impact', impact_frame_bw=bool(f.get('bw', False)),
                             shake=list(composite.SHAKE.get(i, (0, 0))), sword_angle_deg=round(float(f['theta']), 1))
                        for i, f in enumerate(anim.FRAMES)])


def build_all(out_dir, scales=(2,), log=print):
    from . import moves
    out = Path(out_dir) / 'moves'
    out.mkdir(parents=True, exist_ok=True)
    entries = [heavy_entry([f['ms'] for f in anim.FRAMES])]
    for m in moves.all_moves():
        _, e = build_move(m, out, scales)
        e.update(input_type=m.input_type, loop_from=m.loop_from)
        entries.append(e)
    doc = dict(note='Frame data for every move. root = character position in px (y up), relative to where '
                    'the move starts; hitbox capsules are in sprite px relative to the anchor (x right, y up '
                    'from the feet row); loop moves repeat from loop_from (1-based frame index = loop_from + 1).',
               buttons=['A', 'B', 'X', 'Y', 'L', 'R', 'Up', 'Down', 'Left', 'Right'], moves=entries)
    (out / 'moves.json').write_text(json.dumps(doc, indent=1))
    log(f'moves: {len(entries)}')
    return entries
