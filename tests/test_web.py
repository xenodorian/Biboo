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
