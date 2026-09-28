"""Build every deliverable: layers, frames, character sprites, FX overlays, manifest, GIFs."""
import json
import shutil
from pathlib import Path

import numpy as np
from PIL import Image

from . import bg, rig, anim, fx, composite as cp, gifwrite


def build(out_dir, scales=(3, 1), clean=True, log=print):
    out = Path(out_dir)
    if clean and out.exists():
        shutil.rmtree(out)
    for d in ('layers', 'character', 'fx_back', 'fx_front', 'frames'):
        (out / d).mkdir(parents=True, exist_ok=True)

    # 1. background layers: 384 wide (tile in x), view height + margin rows top and bottom
    for name, rgba in cp.layers().items():
        Image.fromarray(rgba).save(out / 'layers' / f'{name}.png')
    log(f'layers: {len(cp.layers())}')

    # 2. frames, character sprites, fx overlays
    frames, chars = [], []
    for i in range(len(anim.FRAMES)):
        parts = {}
        frame = cp.render_frame(i, parts)
        frames.append(frame)
        Image.fromarray(frame).save(out / 'frames' / f'frame_{i + 1:02d}.png')
        chars.append(rig.to_rgba(parts['char']))
        Image.fromarray(parts['back']).save(out / 'fx_back' / f'fx_back_{i + 1:02d}.png')
        Image.fromarray(parts['front']).save(out / 'fx_front' / f'fx_front_{i + 1:02d}.png')
    log(f'frames: {len(frames)}')

    # 3. character frames cropped to one shared box (same size, same anchor every frame)
    ys0 = min(np.nonzero(c[..., 3])[0].min() for c in chars)
    ys1 = max(np.nonzero(c[..., 3])[0].max() for c in chars)
    xs0 = min(np.nonzero(c[..., 3])[1].min() for c in chars)
    xs1 = max(np.nonzero(c[..., 3])[1].max() for c in chars)
    cw, chh = int(xs1 - xs0 + 1), int(ys1 - ys0 + 1)
    sheet = Image.new('RGBA', (cw * len(chars), chh))
    for i, c in enumerate(chars):
        crop = Image.fromarray(c).crop((xs0, ys0, xs1 + 1, ys1 + 1))
        crop.save(out / 'character' / f'char_{i + 1:02d}.png')
        sheet.paste(crop, (i * cw, 0))
    sheet.save(out / 'character' / 'char_sheet.png')
    origin_x = int(rig.PX - xs0)                 # sprite-space x=0 inside the crop
    feet_y = int(rig.PY + rig.FEET_ROW - ys0)    # boot-sole row inside the crop

    # 4. GIFs (exact palette, no dithering) and a contact sheet
    durs = [f['ms'] for f in anim.FRAMES]
    for s in scales:
        gifwrite.write_gif(frames, out / f'swing_x{s}.gif', s, durs)
    cols = 4; rows = -(-len(frames) // cols)
    cs = Image.new('RGB', (cols * bg.W + (cols - 1) * 4, rows * bg.VH + (rows - 1) * 4), (20, 20, 24))
    for i, f in enumerate(frames):
        cs.paste(Image.fromarray(f).convert('RGB'), ((i % cols) * (bg.W + 4), (i // cols) * (bg.VH + 4)))
    cs.save(out / 'contact_sheet.png')

    # 5. manifest
    I = fx.impact_point()
    manifest = dict(
        view=dict(width=bg.W, height=bg.VH, integer_scales={'3x': [bg.W * 3, bg.VH * 3], '5x': [bg.W * 5, bg.VH * 5]}),
        layers=dict(order_back_to_front=bg.ORDER_BACK + ['fx_back', 'character', 'fx_front', 'fringe'],
                    parallax=bg.PARALLAX, tile_width=bg.W, layer_height=bg.H, margin_rows=bg.M,
                    note='layer row = view row + margin_rows; every layer tiles seamlessly in x'),
        ground=dict(grass_surface_view_row=bg.GROUND_TOP, feet_view_row=fx.Y0 + rig.FEET_ROW,
                    note='boot soles rest on feet_view_row; the blade is clipped below it'),
        character=dict(frame_size=[cw, chh], sheet='character/char_sheet.png',
                       sprite_origin_in_frame=[origin_x, 0], feet_row_in_frame=feet_y,
                       demo_placement=dict(frame_left_view_x=int(fx.X0 - origin_x),
                                           frame_top_view_y=int(fx.Y0 + rig.FEET_ROW - feet_y)),
                       palette_colours=int(len(rig.PAL))),
        fx=dict(note='fx_back / fx_front are full layer-size overlays (same size and margins as the layers)',
                impact_point_view=[float(I[0]), float(I[1] - bg.M)]),
        animation=[dict(frame=i + 1, name=f['name'], ms=f['ms'], sword_angle_deg=f['theta'],
                        hip_offset_px=list(f.get('hip', (0, 0))), lean_px=f.get('lean', 0), waist_bend_deg=f.get('bend', 0),
                        front_foot_ankle=[round(float(v), 2) for v in f['legs']['right']['ankle']],
                        front_foot_planted=bool(f.get('front_planted', True)),
                        skirt=f.get('cloth', {}), hair=dict(sway=f.get('sway', 0), lift=f.get('hair_lift', 0)),
                        gaze=f.get('gaze', 0), rear_heel_up=bool(f['legs']['left'].get('heel_up', False)),
                        shoulders=f.get('shoulders', {}),
                        camera_shake_px=list(cp.SHAKE.get(i, (0, 0)))) for i, f in enumerate(anim.FRAMES)],
        camera_shake_parallax=cp.SHAKE_PARALLAX,
        total_ms=sum(durs), loops=True)
    (out / 'scene_manifest.json').write_text(json.dumps(manifest, indent=2))
    log(f'wrote {out}')
    return frames
