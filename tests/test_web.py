"""The browser game's input reader and exported data (web/)."""
import json
import shutil
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent


@pytest.mark.skipif(shutil.which('node') is None, reason='node is not installed')
def test_input_reader_handles_every_binding():
    r = subprocess.run(['node', str(ROOT / 'web' / 'tests' / 'input.test.js')], capture_output=True, text=True)
    assert r.returncode == 0, r.stdout + r.stderr


def test_web_data_covers_every_binding():
    src = (ROOT / 'web' / 'assets' / 'data.js').read_text()
    data = json.loads(src[src.index('=') + 1:].strip().rstrip(';'))
    bindings = json.loads((ROOT / 'game' / 'input_map.json').read_text())['bindings']
    missing = sorted({b['move'] for b in bindings} - set(data['moves']))
    assert not missing, f'moves in the input map but not exported: {missing}'
    for mid, m in data['moves'].items():
        assert (ROOT / 'web' / m['sheet']).exists(), mid
        for f in m['frames']:
            assert f['bw'] is None or (ROOT / 'web' / f['bw']).exists(), mid


def test_crash_plays_the_full_dust_cloud():
    """The crash reuses the heavy chop's dust cloud, frame by frame, and only its flash is an impact frame."""
    from PIL import Image, ImageChops
    src = (ROOT / 'web' / 'assets' / 'data.js').read_text()
    data = json.loads(src[src.index('=') + 1:].strip().rstrip(';'))
    m = data['moves']['jump_crash']
    names = [f['name'] for f in m['frames']]
    k = names.index('crash')
    assert names[k:k + 5] == ['crash', 'flash', 'burst', 'plume', 'settle']
    assert [f['name'] for f in m['frames'] if f['bw']] == ['flash']
    assert sum(f['ms'] for f in m['frames'][names.index('burst'):names.index('settle') + 1]) >= 300
    sheet = Image.open(ROOT / 'web' / m['sheet']).convert('RGBA')
    w, h = m['cell']
    cells = [sheet.crop((names.index(n) * w, 0, (names.index(n) + 1) * w, h)) for n in ('burst', 'plume', 'settle')]
    for a, b in zip(cells, cells[1:]):
        assert ImageChops.difference(a, b).getbbox() is not None, 'consecutive cloud frames are identical'
