import numpy as np
from PIL import Image

def write_gif(frames, path, scale, durs):
    allc = np.unique(np.concatenate([f[..., :3].reshape(-1, 3) for f in frames]), axis=0)
    assert len(allc) <= 256, len(allc)
    key = lambda a: (a[..., 0].astype(np.int64) << 16) | (a[..., 1].astype(np.int64) << 8) | a[..., 2]
    ks = key(allc); order = np.argsort(ks); ks_sorted = ks[order]
    flatpal = [int(v) for c in allc for v in c] + [0] * (768 - 3 * len(allc))
    ims = []
    for f in frames:
        idx = order[np.searchsorted(ks_sorted, key(f[..., :3]))]
        if scale > 1: idx = np.repeat(np.repeat(idx, scale, 0), scale, 1)
        im = Image.fromarray(idx.astype(np.uint8), 'P'); im.putpalette(flatpal); ims.append(im)
    ims[0].save(path, save_all=True, append_images=ims[1:], duration=durs, loop=0, optimize=False, disposal=1)


def verify_gif(path, frames, scale=1):
    """Return the number of pixels that differ between a written GIF and its frames."""
    g = Image.open(path); bad = 0
    for i, f in enumerate(frames):
        g.seek(i); a = np.asarray(g.convert('RGB'))
        if scale > 1: a = a[::scale, ::scale]
        bad += int((a != f[..., :3]).any(2).sum())
    return bad
