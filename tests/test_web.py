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


def test_web_canvas_is_native_640x480():
    src = (ROOT / 'web' / 'index.html').read_text()
    assert '<canvas id="view" width="640" height="480"' in src
    assert 'aspect-ratio: 4 / 3;' in src
    assert '384 / 216' not in src


def test_web_game_uses_native_640x480_space():
    data_src = (ROOT / 'web' / 'assets' / 'data.js').read_text()
    data = json.loads(data_src[data_src.index('=') + 1:].strip().rstrip(';'))
    assert data['view']['w'] == 640 and data['view']['h'] == 480
    assert data['view']['feetRow'] == 418
    assert data['view']['anchorX'] == 160
    core = (ROOT / 'web' / 'game' / '00_core.js').read_text()
    assert 'const SPRITE_SCALE = 1.0;' in core
    levels = (ROOT / 'web' / 'levels.js').read_text()
    assert 'const MAP_W = 640' in levels
    assert 'const LEGACY_VIEW_H = 216, LEGACY_FEET_ROW = 188, NATIVE_FEET_ROW = 418;' in levels
    assert 'const WORLD_Y_SCALE = NATIVE_FEET_ROW / LEGACY_FEET_ROW, MAP_Y_SCALE = WORLD_Y_SCALE' in levels
    state = (ROOT / 'web' / 'game' / '03_state.js').read_text()
    assert 'const CAM_KEEP = 100 * WORLD_Y_SCALE;' in state
    assert 'WORLD_Y_SCALE' in state
    bg = (ROOT / 'swingkit' / 'bg.py').read_text()
    assert 'W, VH, M = 640, 480, 16' in bg
    fx = (ROOT / 'swingkit' / 'fx.py').read_text()
    assert 'X0, Y0 = 160, 337' in fx
    story = (ROOT / 'web' / 'game' / '18_story.js').read_text()
    assert 'g.drawImage(im, x0, 0);' in story
    assert 'g.drawImage(im, x0, 0, im.width, V.h)' not in story
    assert 'calm:     { pan: 0,    x: 250, gy: 418, s: 1.0' in story
    title = (ROOT / 'web' / 'game' / '20_title.js').read_text()
    assert 'sc = 1.0' in title
    prep = (ROOT / 'tools' / 'prepare_story_assets.py').read_text()
    assert 'VILLAGE_URL' in prep and 'W, H = 640, 480' in prep


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


def test_perry_native_gravity_and_jump_targets():
    state = (ROOT / 'web' / 'game' / '03_state.js').read_text()
    maps = (ROOT / 'web' / 'game' / '09_maps.js').read_text()
    attacks = (ROOT / 'web' / 'game' / '13_enemy_attacks.js').read_text()
    chain = (ROOT / 'web' / 'game' / '04_chain.js').read_text()

    assert 'const GRAVITY_FOOT_BACK = 13, GRAVITY_FOOT_FRONT = 92, GRAVITY_FOOT_WIDTH = 79;' in attacks
    assert 'function gravitySpan(bx)' in maps
    assert 'gravityOverSurf(sf, gravitySpan(px))' in maps
    assert 'const JUMP_H = 100, JUMP_APEX_MS = 280;' in state
    assert 'const AIR_JUMP_WIDTH = 120, DOUBLE_JUMP_WIDTH = 240;' in state
    assert 'const DOUBLE_JUMP_MAX_H = 200' in state
    assert 'const SKY_DASH_H = 300' in state
    assert 'const speed = dblUsed ? DOUBLE_AIR_SPEED : AIR_SPEED;' in chain
    assert 'xRange: AIR_JUMP_WIDTH' in chain
    assert 'overSurf(sd, span(px))' not in state
    assert 'gravityOverSurf(sd, gravitySpan(px))' in state
