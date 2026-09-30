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

from . import anim, bg, beams, fx, rig, movefx, movekit, enemies, composite as cp
from .paths import ROOT

W, H, M, VH = bg.W, bg.H, bg.M, bg.VH
WEB = ROOT / 'web'
# the ground keeps rumbling after these moves end: fading camera shake (ms, peak px)
AFTERSHAKE = {'earthquake': dict(ms=1500, amp=6)}
# where a move starts in the game: skip its opening frames, or pick up from the pose of the move
# it interrupts (frames with the same name; loop frames listed here map onto a named frame)
ENTER = {'heavy': dict(default='raise1',
                       fromMove={'charge': {'charge1': 'high', 'charge2': 'high', 'charge3': 'high'}})}


# moves that never hurt anything even on their active frames
NO_HIT = {'parry'}
# moves whose raised sword is only the pose: the energy they call down is what hits
EFFECT_ONLY = {'energy_burst', 'meteor_shower'}
# moves whose art is exported as two sheets: Max alone, and the effects alone. The game draws Max at
# her own scale and the effects at FX_SCALE, so an effect can be scaled up without scaling Max up.
# The hit shapes of these moves use the same FX_SCALE (see worldShape in web/game.js).
FX_SCALE = {'meteor_shower': 1.4, 'energy_wave': 0.6}   # 0.6: the wave projectile is about Max's height (67 px x 0.6 = 40 px)
# dash attacks cover up to 60 px a frame: their dash and lunge frames also hit everything along the
# stretch of ground she crossed since the last frame, so an enemy in her path is not skipped
SWEEP = {'dash_thrust', 'energy_dash_thrust'}
SWEEP_REACH, SWEEP_HEIGHT = 100, 90          # px ahead of her anchor, px up
# upswings: the blade swings from behind her, under and up through the front between the wind-up
# frame and the first hit frame, where it already points up over an enemy's head. That frame also
# hits along the arc (blade positions every 15 degrees, turning counter-clockwise, y up).
ARC = {'upswing'}


def _arc(prev, fr):
    hp = movekit.hitbox(dict(prev, active=True)); hc = movekit.hitbox(dict(fr, active=True))
    if not hp or not hc or hp['shape'] != 'capsule' or hc['shape'] != 'capsule':
        return []
    off = np.array(prev['root'], float) - np.array(fr['root'], float)
    pa, pb = np.array(hp['a']) + off, np.array(hp['b']) + off
    ca, cb = np.array(hc['a']), np.array(hc['b'])
    a0 = np.arctan2(*(pb - pa)[::-1]); a1 = np.arctan2(*(cb - ca)[::-1])
    while a1 <= a0: a1 += 2 * np.pi
    L = float(np.linalg.norm(cb - ca))
    n = max(2, int(np.degrees(a1 - a0) / 15))
    out = []
    for t in np.linspace(0, 1, n + 1)[:-1]:
        g = pa + (ca - pa) * t; ang = a0 + (a1 - a0) * t
        tip = g + L * np.array([np.cos(ang), np.sin(ang)])
        out.append(dict(shape='capsule', a=[round(float(g[0]), 1), round(float(g[1]), 1)],
                        b=[round(float(tip[0]), 1), round(float(tip[1]), 1)], radius=hc['radius']))
    return out


def _pt(p):
    """Sprite point -> hit coordinates: x from the anchor, y up from the feet row."""
    return [round(float(p[0]), 1), round(float(rig.FEET_ROW - p[1]), 1)]


def _ground_point(fr):
    sw = movekit.Sword_at(fr)
    u = (rig.FEET_ROW - sw.B0[1]) / sw.d[1] if abs(sw.d[1]) > 1e-3 else rig.Sword.L
    return sw.B0 + u * sw.d


def _meteor_hits(t, n=9, seed=17):
    """Circles where the meteors of movefx.meteors are landing at time t (same random draws)."""
    rng = np.random.default_rng(seed)
    gy = fx.GROUND_LY
    out = []
    for k in range(n):
        t0 = rng.uniform(0, 3.0); x_land = rng.uniform(150, 380); spd = rng.uniform(55, 80)
        tt = t - t0
        if tt < 0: continue
        y = -20 + tt * spd
        if y < gy - 40: continue
        if y < gy:                                      # the fireball coming down
            x = x_land - (gy + 20 - tt * spd) * 0.55
            out.append(dict(shape='circle', c=[round(x - fx.X0, 1), round(gy - y, 1)], r=6))
        elif (y - gy) / spd < 1.4:                      # the blast where it lands
            out.append(dict(shape='circle', c=[round(x_land - fx.X0, 1), 4.0], r=12))
    return out


def hit_shapes(move_id, fr, prev=None):
    """Everything that can hit on this frame: the blade or foot capsule on active frames, plus the
    energy effects that do damage (burst ring, ground quake, flying wave, meteors). Shapes are in px
    relative to the character's anchor, x right, y up from the feet row."""
    if move_id in NO_HIT:
        return None
    out = []
    hb = None if move_id in EFFECT_ONLY else movekit.hitbox(fr)
    if hb:
        if fr.get('flip'):                              # drawn mirrored about sprite x = 32
            hb['a'][0] = round(64 - hb['a'][0], 1); hb['b'][0] = round(64 - hb['b'][0], 1)
        out.append(hb)
    if move_id in ARC and prev is not None and fr.get('active') and not prev.get('active'):
        out += _arc(prev, fr)
    if move_id in SWEEP and prev is not None and (fr['name'].startswith('blur') or fr['name'] == 'lunge'):
        back = float(prev['root'][0] - fr['root'][0])
        out.append(dict(shape='box', a=[round(back + 20, 1), 0.0], b=[float(SWEEP_REACH), float(SWEEP_HEIGHT)]))
    for name, kw in fr.get('fx', []):
        if name == 'burst' and fr.get('active'):
            c = kw.get('center', (32, 44))
            out.append(dict(shape='circle', c=_pt(c), r=float(kw.get('r', 40))))
        elif name == 'quake' and fr.get('active'):
            I = _ground_point(fr)
            L = kw.get('reach', 150) * min(1.0, 0.35 + kw.get('t', 0.0) * 0.4)
            out.append(dict(shape='box', a=[round(float(I[0] - L), 1), 0.0], b=[round(float(I[0] + L), 1), 30.0]))
        elif name == 'projectile':
            x, y, R = kw.get('x', 90), kw.get('y', 40), 40 * kw.get('size', 1.0)
            out.append(dict(shape='box', a=[round(x - R * 0.3, 1), round(rig.FEET_ROW - y - R * 0.8, 1)],
                            b=[round(x + R * 0.55, 1), round(rig.FEET_ROW - y + R * 0.8, 1)]))
        elif name == 'meteors':
            out += _meteor_hits(kw.get('t', 0.0))
    return out or None


SWORD_OPS = ('grip', 'guard', 'blade')


def body_top(fr):
    """Height of the top of her drawn body (hair, head, arms; not the sword) above the feet row, px."""
    C, _, _ = anim.render_pose(dict(fr, order=[o for o in fr['order'] if o not in SWORD_OPS]))
    rows = np.nonzero((C >= 0).any(1))[0]
    return int(rig.PY + rig.FEET_ROW - rows.min())


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
    fxonly = np.zeros((H, W, 4), np.uint8)                  # the effects without Max (split moves)
    for L in (ctx.ground.a, back.a, front.a):
        cp.over(fxonly, L)
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
    return actor, bw, ch.copy(), fxonly


def heavy_frame(i):
    """The main chop: its own effects and character, same anchor as the move library."""
    parts = {}
    view = cp.render_frame(i, parts)
    actor = np.zeros((H, W, 4), np.uint8)
    for L in (parts['back'], cp.char_layer(parts['char']), parts['front']):
        cp.over(actor, L)
    return actor, (view if anim.FRAMES[i].get('bw') else None), None, None


def _box(actors):
    """The one crop box (y0, y1, x0, x1) that holds every frame."""
    alpha = np.any(np.stack([a[..., 3] > 0 for a in actors]), 0)
    ys, xs = np.nonzero(alpha)
    return int(ys.min()), int(ys.max()), int(xs.min()), int(xs.max())


def _sheet(actors, box):
    y0, y1, x0, x1 = box
    cw, chh = x1 - x0 + 1, y1 - y0 + 1
    sheet = Image.new('RGBA', (cw * len(actors), chh))
    for k, a in enumerate(actors):
        sheet.paste(Image.fromarray(a[y0:y1 + 1, x0:x1 + 1]), (k * cw, 0))
    return sheet, [cw, chh], [fx.X0 - x0, fx.GROUND_LY - y0]


def _pack(actors):
    """Crop every frame to one shared box and pack them left to right."""
    return _sheet(actors, _box(actors))


def export(out_dir=WEB, log=print):
    from . import moves
    out = Path(out_dir)
    for d in ('assets/moves', 'assets/bw', 'assets/layers'):
        (out / d).mkdir(parents=True, exist_ok=True)
    for name, rgba in cp.layers().items():
        Image.fromarray(rgba).save(out / 'assets' / 'layers' / f'{name}.png', optimize=True)

    entries = {}

    def hits(mid, f, prev):
        if mid == 'heavy':                              # the main chop: the blade on the impact frame
            return [movekit.hitbox(dict(f, active=True))] if f['name'] == 'impact' else None
        return hit_shapes(mid, f, prev)

    def add(mid, title, inp, loop, loop_from, input_type, frames, results):
        actors = [r[0] for r in results]
        split = mid in FX_SCALE
        if split:                                       # Max alone and the effects alone, same box and anchor
            chars, fxs = [r[2] for r in results], [r[3] for r in results]
            box = _box(chars + fxs)
            sheet, cell, anchor = _sheet(chars, box)
            fxsheet = _sheet(fxs, box)[0]
            fxsheet.save(out / 'assets' / 'moves' / f'{mid}_fx.png', optimize=True)
        else:
            sheet, cell, anchor = _pack(actors)
        sheet.save(out / 'assets' / 'moves' / f'{mid}.png', optimize=True)
        fl = []
        for k, (f, r) in enumerate(zip(frames, results)):
            bw = r[1]
            bw_path = None
            if bw is not None:
                bw_path = f'assets/bw/{mid}_{k + 1:02d}.png'
                Image.fromarray(bw).save(out / bw_path, optimize=True)
            d = dict(name=f['name'], ms=int(f['ms']), root=[round(float(f['root'][0]), 1), round(float(f['root'][1]), 1)],
                     shake=[int(v) for v in f.get('shake', (0, 0))], bw=bw_path, hits=hits(mid, f, frames[k - 1] if k else None), top=body_top(f))
            if f.get('beam'):                           # the beam leaves the blade tip (px from the anchor, y up from the feet)
                tip = movekit.Sword_at(f).tip
                d['beam'] = dict(kind=f['beam'], x=round(float(tip[0]), 1), y=round(float(rig.FEET_ROW - tip[1]), 1))
            fl.append(d)
        entries[mid] = dict(title=title, input=inp, loop=bool(loop), loopFrom=int(loop_from),
                            inputType=input_type, sheet=f'assets/moves/{mid}.png', cell=cell, anchor=anchor, frames=fl,
                            aftershake=AFTERSHAKE.get(mid), enter=ENTER.get(mid))
        if split:
            entries[mid].update(fxSheet=f'assets/moves/{mid}_fx.png', fxScale=FX_SCALE[mid])

    hf = [dict(f, root=(0.0, 0.0), shake=cp.SHAKE.get(i, (0, 0))) for i, f in enumerate(anim.FRAMES)]
    add('heavy', 'Heavy overhead chop', 'Up-A', False, 0, 'sequence', hf, [heavy_frame(i) for i in range(len(anim.FRAMES))])
    for m in moves.all_moves():
        add(m.id, m.title, m.inputs, m.loop, m.loop_from, m.input_type, m.frames,
            [move_frame(m, i) for i in range(len(m.frames))])

    input_map = json.loads((ROOT / 'game' / 'input_map.json').read_text())
    data = dict(
        view=dict(w=W, h=VH, margin=M, anchorX=int(fx.X0), feetRow=int(fx.Y0 + rig.FEET_ROW)),
        layers=[dict(name=n, src=f'assets/layers/{n}.png', parallax=float(bg.PARALLAX.get(n, 1.0)),
                     shake=float(cp.SHAKE_PARALLAX.get(n, 1.0))) for n in bg.ORDER_BACK],
        fringe=dict(src='assets/layers/fringe.png'),
        moves=entries, input=input_map, enemies=enemies.export(out, log),
        beams=beams.build(out / 'assets' / 'beams', log))
    (out / 'assets' / 'data.js').write_text(
        '// Generated by `python -m swingkit --web`. Do not edit by hand.\nwindow.BIBOO = '
        + json.dumps(data, separators=(',', ':')) + ';\n')
    log(f'web: {len(entries)} moves -> {out / "assets"}')
    return data
