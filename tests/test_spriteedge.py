"""tools/edge/spriteedge.py: the built-in picture test, and the colour suggestions."""
import importlib.util
from pathlib import Path

import numpy as np

SPEC = importlib.util.spec_from_file_location('spriteedge', Path(__file__).resolve().parent.parent / 'tools' / 'edge' / 'spriteedge.py')
se = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(se)


def test_self_test_passes():
    assert se.self_test(verbose=False)


def test_suggests_backdrop_and_shadow():
    img = np.zeros((60, 80, 4), np.uint8)
    img[..., :3] = (99, 99, 99); img[..., 3] = 255
    img[40:50, 10:70, :3] = (49, 49, 49)                    # a flat gray shadow that does not touch the edge
    img[10:40, 25:55, :3] = (40, 44, 44)                    # the sprite
    kinds = {r['hex']: r['kind'] for r in se.suggest_outside(img, min_pixels=100)}
    assert kinds.get('#636363') == 'backdrop' and kinds.get('#313131') == 'shadow-like'


def test_border_ignores_shadow_and_inside_lines():
    img = np.zeros((40, 40, 3), np.uint8); img[:] = (99, 99, 99)
    img[30:36, 2:38] = (49, 49, 49)
    img[5:30, 10:30] = (8, 9, 9); img[6:29, 11:29] = (40, 44, 44); img[15, 13:27] = (8, 9, 9)
    r = se.find_border(img, outside=[(99, 99, 99), (49, 49, 49)])
    assert r.border.sum() == 2 * (20 + 25) - 4 and not r.border[15, 13:27].any() and not (r.border & r.outside).any()
