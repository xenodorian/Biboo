"""Assemble the 12 frames: background layers (with parallax camera shake), back FX,
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
SHAKE = {6: (0, 3), 7: (2, -2), 8: (-1, 1), 9: (0, -1)}
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
    t = {}; acc = 0
    for i in range(6, 12):
        t[i] = 0.4 + acc / 80.0
        acc += anim.FRAMES[i]['ms']
    return t

def render_frame(i, parts_out=None):
    fr = anim.FRAMES[i]
    back, front = fx.Layer(), fx.Layer()
    I = fx.impact_point()
    T = impact_times()
    if fr.get('glint'): fx.glint(front, fr)
    if 'smear_from' in fr:
        frA = anim.FRAMES[fr['smear_from']]
        if fr.get('residual'):
            fx.smear(back, frA, fr, u_head=56, s_from=0.5, residual=True)
        else:
            fx.smear(back, frA, fr, u_head=50 if i == 4 else 46)
    if i == 6:
        fx.crown(front, I); fx.mound(front, I)
        fx.particles(front, I, T[i], back=back); fx.flash(front, I)
    elif i in (7, 8, 9):
        fx.mound(front, I)
        fx.particles(front, I, T[i], back=back)
        if i == 7: fx.flash(front, I, remnant=True)
    elif i in (10, 11):
        fx.particles(front, I, T[i], back=back)
        fx.clod(front, fr, 0 if i == 10 else 1.4)
    if i in (6, 7, 8):
        fx.stomp(front, fr, i - 6)
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
