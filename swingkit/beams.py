"""Beam strips: the four beam textures used by the beam attacks.

The sources (data/beams_src) are two images, each with a top and a bottom beam on a near black
background. Each beam is cut out, brought down to the game's pixel size, reduced to a small palette,
stripped of its background (transparent) and cut to one seamless period, so the game can tile it
along the beam and scroll it. Output: web/assets/beams/<kind>.png (one period wide).
"""
from pathlib import Path

import numpy as np
from PIL import Image

from .paths import ROOT

SRC = ROOT / 'data' / 'beams_src'
# kind: (source file, rows of the beam in the source, source pixels per game pixel, palette size)
BEAMS = {
    'cloud':  ('beams_cloud_fire.jpeg',   (30, 162),  3, 14),    # white and cyan wisps
    'fire':   ('beams_cloud_fire.jpeg',   (192, 309), 3, 14),    # twisting flame
    'laser':  ('beams_laser_plasma.webp', (107, 462), 6, 12),    # yellow-white bar with cyan lightning
    'plasma': ('beams_laser_plasma.webp', (637, 962), 6, 12),    # cyan, pink and white plasma
}


def _cutout(kind):
    fname, (r0, r1), k, ncol = BEAMS[kind]
    im = Image.open(SRC / fname).convert('RGB')
    a = np.array(im).astype(int)
    bg = np.median(np.concatenate([a[:6, :6].reshape(-1, 3), a[-6:, -6:].reshape(-1, 3)]), axis=0)
    band = im.crop((0, r0, im.width, r1 + 1))
    w, h = band.width // k, band.height // k
    small = band.resize((w, h), Image.NEAREST if k == 6 else Image.BOX)     # the webp is a clean 6x upscale
    s = np.array(small).astype(int)
    alpha = np.abs(s - bg).sum(2) > 90
    pal = Image.fromarray(np.where(alpha[..., None], s, 255).astype(np.uint8)).quantize(ncol, method=Image.MEDIANCUT, dither=Image.NONE)
    rgb = np.array(pal.convert('RGB'))
    out = np.dstack([rgb, np.where(alpha, 255, 0).astype(np.uint8)])
    out[~alpha, :3] = 0
    ys = np.nonzero(alpha.any(1))[0]
    return out[ys.min():ys.max() + 1]


def _period(rgba):
    """Smallest horizontal shift that maps the strip onto itself (its tile width)."""
    w = rgba.shape[1]
    f = rgba.astype(int)
    best = (1e18, w)
    for s in range(max(16, w // 10), int(w * 0.75)):
        d = np.abs(f[:, :w - s] - f[:, s:]).mean()
        if d < best[0] - 1e-6: best = (d, s)
    return best[1], best[0]


def build(out_dir, log=print):
    """Write web/assets/beams/*.png; returns {kind: {src, w, h}} for data.js."""
    out_dir = Path(out_dir); out_dir.mkdir(parents=True, exist_ok=True)
    info = {}
    for kind in BEAMS:
        strip = _cutout(kind)
        p, err = _period(strip)
        tile = strip[:, :p]
        Image.fromarray(tile).save(out_dir / f'{kind}.png', optimize=True)
        info[kind] = dict(src=f'assets/beams/{kind}.png', w=int(tile.shape[1]), h=int(tile.shape[0]))
        log(f'beam {kind}: {tile.shape[1]}x{tile.shape[0]} px tile (repeat error {err:.1f})')
    return info


if __name__ == '__main__':
    import sys
    build(sys.argv[1] if len(sys.argv) > 1 else 'out/beams')
