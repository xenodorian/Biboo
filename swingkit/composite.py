"""Assemble the frames: background layers (with parallax camera shake), back FX,
character, front FX, foreground grass fringe. Writes the GIF and per-frame PNGs."""
import numpy as np
from . import bg, rig, anim, fx

W, H, M, VH = bg.W, bg.H, bg.M, bg.VH
_LAYERS = None

def layers():
    global _LAYERS
    if _LAYERS is None:
        _LAYERS = bg.build_all()
    return _LAYERS
SHAKE_BY_NAME = dict(impact=(0, 3), burst=(2, -2), plume=(-1, 1), settle=(0, -1))
SHAKE = {i: SHAKE_BY_NAME[fr['name']] for i, fr in enumerate(anim.FRAMES) if fr['name'] in SHAKE_BY_NAME}
# The blur arc ends this far through the swing (0 = high guard, 1 = impact), trailing the blade.
SMEAR_END = 0.85
SHAKE_PARALLAX = dict(sky=0.25, mountains_far=0.35, mountains_near=0.5, trees_back=0.65,
                      trees_front=0.8, ground=1.0, fx=1.0, char=1.0, fringe=1.0)

def shifted_view(rgba, dx, dy, wrap=True):
    """Return the VH-row view of a layer after a camera offset (dx,dy)."""
    a = np.roll(rgba, dx, axis=1) if wrap else rgba
    return a[M - dy: M - dy + VH]

def over(dst, src):
    m = src[..., 3] > 0
    dst[m] = src[m]

def char_layer(C):
    img = rig.to_rgba(C)
    L = np.zeros((H, W, 4), np.uint8)
    ox, oy = fx.X0 - rig.PX, fx.Y0 + M - rig.PY
    ys, xs = np.nonzero(img[..., 3])
    ly, lx = ys + oy, xs + ox
    ok = (ly >= 0) & (ly < H) & (lx >= 0) & (lx < W)
    L[ly[ok], lx[ok]] = img[ys[ok], xs[ok]]
    return L

def impact_times():
    """Time since the dust erupts (in 80 ms units) at the start of each frame from the burst on."""
    t = {}; acc = 0
    for i in range(anim.index('burst'), len(anim.FRAMES)):
        t[i] = 0.4 + acc / 80.0
        acc += anim.FRAMES[i]['ms']
    return t

def render_frame(i, parts_out=None):
    fr = anim.FRAMES[i]
    name = fr['name']
    back, front = fx.Layer(), fx.Layer()
    I = fx.impact_point()
    T = impact_times()
    if fr.get('glint'): fx.glint(front, fr)
    if 'smear_from' in fr:          # motion-blur arc swept by the blade from the high guard
        fx.smear(back, anim.by_name(fr['smear_from']), fr, u_head=40, s_to=SMEAR_END)
    if name == 'impact':
        fx.crown(front, I); fx.mound(front, I); fx.flash(front, I)
    elif name in ('burst', 'plume', 'settle'):
        fx.mound(front, I)
        fx.particles(front, I, T[i], back=back)
        if name == 'burst': fx.flash(front, I, remnant=True)
    elif name in ('return1', 'return2'):
        fx.particles(front, I, T[i], back=back)
        fx.clod(front, fr, 0 if name == 'return1' else 1.4)
    if name in ('impact', 'burst', 'plume', 'settle'):
        fx.stomp(front, fr, ('impact', 'burst', 'plume', 'settle').index(name))
    back.clip_below(fx.GROUND_LY); front.clip_below(fx.GROUND_LY + 1)
    C, sw, parts = anim.render_character(i)
    ch = char_layer(C)
    sx, sy = SHAKE.get(i, (0, 0))
    out = np.zeros((VH, W, 4), np.uint8)
    for name in bg.ORDER_BACK:
        f = SHAKE_PARALLAX[name]
        over(out, shifted_view(layers()[name], int(round(sx * f)), int(round(sy * f))))
    for L in (back.a, ch, front.a):
        over(out, shifted_view(L, sx, sy, wrap=False))
    over(out, shifted_view(layers()['fringe'], sx, sy))
    if parts_out is not None:
        parts_out.update(dict(char=C, back=back.a, front=front.a))
    return out
