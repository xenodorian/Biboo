"""Consistency checks for the animation. Each returns (ok, message)."""
import numpy as np

from . import bg, rig, anim, composite as cp, gifwrite

NEAR_ARM_RANGE = (15.5, 21.0)   # px, shoulder -> hand along the arm path
FAR_ARM_RANGE = (5.0, 21.0)     # far arm is foreshortened in the two-handed poses


def check_frame_count():
    n = len(anim.FRAMES)
    return n <= 12, f'{n} frames (limit 12)'


def check_arm_lengths():
    """Arms bend, never stretch or shrink: upper arm and forearm keep their fixed lengths and
    every hand is actually reached."""
    bad = []
    for i, fr in enumerate(anim.FRAMES):
        for k, (S, E, H) in anim.arm_joints(fr).items():
            L1, L2 = anim.ARM_LEN[k]
            u, f = float(np.linalg.norm(E - S)), float(np.linalg.norm(H - E))
            if abs(u - L1) > 0.05 or abs(f - L2) > 0.05:
                bad.append(f'frame {i+1} {k} arm upper {u:.1f}/{L1} fore {f:.1f}/{L2} (hand out of reach)')
    return not bad, 'arm segments fixed, hands reached' if not bad else '; '.join(bad)


def check_lead_upper_arm():
    """The lead (far) upper arm rises only until it is parallel to the ground; above that the
    elbow bends. Elbow must not be higher than the shoulder."""
    bad = []
    for i, fr in enumerate(anim.FRAMES):
        S, E, H = anim.arm_joints(fr)['far']
        if E[1] < S[1] - 0.3:
            bad.append(f'frame {i+1} lead upper arm {S[1] - E[1]:.1f} px above horizontal')
    return not bad, 'lead upper arm never above horizontal' if not bad else '; '.join(bad)


def check_leg_lengths():
    """Thigh and shin lengths must equal the fitted neutral lengths in every frame."""
    bad = []
    for i in range(len(anim.FRAMES)):
        _, _, parts = anim.render_character(i)
        for name, j in parts['legs'].items():
            L1, L2 = rig.LEG_LEN[name]
            t = float(np.hypot(*(j['knee'] - j['hip']))); s = float(np.hypot(*(j['ankle'] - j['knee'])))
            if abs(t - L1) > 0.05 or abs(s - L2) > 0.05:
                bad.append(f'frame {i+1} {name} thigh {t:.2f}/{L1:.2f} shin {s:.2f}/{L2:.2f}')
    return not bad, 'leg lengths constant' if not bad else '; '.join(bad)


def check_feet_planted():
    """Planted boots must sit exactly on the ground, measured on the drawn pixels: the lowest
    filled row of the boot is the row just above the feet row (the outline is on the feet
    row). Applies to the rear foot in every frame (a heel-up rear foot stands on its toe)
    and to the front foot whenever it is marked planted."""
    bad = []
    want = rig.PY + rig.FEET_ROW - 1
    for i, fr in enumerate(anim.FRAMES):
        _, _, parts = anim.render_character(i)
        for name in ('left', 'right'):
            if name == 'right' and not fr.get('front_planted', True):
                continue
            m = parts['legs'][name]['mask']
            low = int(np.nonzero(m.any(1))[0].max())
            if low != want:
                bad.append(f'frame {i+1} {name} sole {want - low:+d} px from the ground')
    return not bad, 'planted feet on the ground' if not bad else '; '.join(bad)


def check_rear_hand_on_pommel():
    """The rear (near) hand holds the base of the handle in every frame: it sits exactly
    GRIP_SPAN below the front hand along the grip, just above the pommel."""
    bad = []
    for i, fr in enumerate(anim.FRAMES):
        if fr.get('Hl') is None:
            bad.append(f'frame {i+1} rear hand off the grip'); continue
        th = np.radians(fr['theta']); d = np.array([np.cos(th), -np.sin(th)])
        want = np.array(fr['H'], float) - anim.GRIP_SPAN * d
        if np.linalg.norm(np.array(fr['Hl'], float) - want) > 0.01 or np.linalg.norm(np.array(fr['near']['to']) - want) > 0.01:
            bad.append(f'frame {i+1} rear hand not on the pommel end')
    return not bad, 'rear hand on the pommel end in every frame' if not bad else '; '.join(bad)


def check_lead_arm_behind_grip():
    """The lead (far) arm passes behind the handle: it is drawn before the grip, and the fists
    are drawn after it, in every frame."""
    bad = []
    for i, fr in enumerate(anim.FRAMES):
        o = fr['order']
        if not (o.index('far') < o.index('grip') < o.index('fists')):
            bad.append(f'frame {i+1} draw order {o}')
    return not bad, 'lead arm behind the handle' if not bad else '; '.join(bad)


def check_face_clear():
    hits = []
    for i, fr in enumerate(anim.FRAMES):
        _, _, parts = anim.render_character(i)
        x0, y0, x1, y1 = anim.face_box(fr)
        n = 0
        for k in ('far', 'near', 'grip', 'guard', 'blade'):
            m = parts.get(k)
            if m is not None:
                n += int(m[y0 + rig.PY:y1 + rig.PY + 1, x0 + rig.PX:x1 + rig.PX + 1].sum())
        hits.append(n)
    return sum(hits) == 0, f'arm/sword pixels over the face per frame: {hits}'


def check_tiling():
    """The seam (last column -> first column) must look like any other pair of
    neighbouring columns: no larger than the 99th percentile of in-layer differences."""
    bad = []
    for name, rgba in cp.layers().items():
        a = rgba.astype(int)
        diffs = np.abs(a[:, 1:] - a[:, :-1]).sum(axis=(0, 2))
        seam = np.abs(a[:, -1] - a[:, 0]).sum()
        if seam > np.percentile(diffs, 99):
            bad.append(name)
    return not bad, 'all layers tile' if not bad else f'seam visible in {bad}'


def check_gif(path, frames, scale):
    bad = gifwrite.verify_gif(path, frames, scale)
    return bad == 0, f'{path.name}: {bad} pixels differ from source frames'


def run_all(frames=None, gif_paths=()):
    results = [('frame count', check_frame_count()), ('arm lengths', check_arm_lengths()),
               ('lead upper arm', check_lead_upper_arm()),
               ('leg lengths', check_leg_lengths()), ('planted feet', check_feet_planted()),
               ('rear grip', check_rear_hand_on_pommel()), ('lead arm behind grip', check_lead_arm_behind_grip()),
               ('face clearance', check_face_clear()), ('layer tiling', check_tiling())]
    for p, s in gif_paths:
        results.append((f'gif x{s}', check_gif(p, frames, s)))
    return results
