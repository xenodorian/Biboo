#!/usr/bin/env python3
"""Bake the web game's art and tables into what the Dreamcast program uses. ON-DEMAND tool (see ../README.md).

    node ports/dreamcast/tools/dump_game_data.js          # the game's JS data -> build/game_data.json
    python3 ports/dreamcast/tools/bake_game.py            # -> build/ART.BIN and src/gen/game_data.h

ART.BIN is one pack of sprites (the program embeds it with .incbin). A sprite is a trimmed picture stored as colour keyed
runs, RGB565, so the SH-4 only touches pixels that are drawn:

    pack   : u32 magic 'PPK1', u32 count, count x { u32 offset, u32 bytes }, then the sprites (4 byte aligned)
    sprite : s16 ox, s16 oy   top left of the trimmed picture relative to the sprite's anchor (output pixels, y down)
             u16 w, u16 h
             u32 rowoff[h]    byte offset of each row from the start of the sprite
             rows: u16 nspans, then nspans x { u16 x, u16 len, u16 pixel[len] }   (pixels RGB565, never 0xF81F)

Scale: the web view is 384x216 and one map is exactly one screen, so the whole view is shown on the 320x240 Dreamcast screen at
5/6 size (320x180, centered, 30 pixel bars above and below for the HUD). Everything is sampled ONCE here, nearest-neighbour, from
the sheets: move and enemy sheets are drawn by the web game at SPRITE_SCALE 0.5, so they are baked at 0.5 * 5/6; background layers
at 5/6. The anchor of a sprite sits exactly on the origin of its output grid. Alpha below 128 is transparent: the Dreamcast has no
alpha blending, and the background layers have only 0 or 255 anyway.
"""
import json
import os
import re
import struct
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
PORT = os.path.dirname(HERE)
ROOT = os.path.dirname(os.path.dirname(PORT))
WEB = os.path.join(ROOT, 'web')
BUILD = os.path.join(PORT, 'build')
GEN = os.path.join(PORT, 'src', 'gen')
KEY = 0xF81F
VIEW_SCALE = 5.0 / 6.0                                      # web view pixels -> Dreamcast screen pixels
SPRITE_SCALE = 0.5                                          # sheet pixels -> web view pixels (web game)
SCALE = SPRITE_SCALE * VIEW_SCALE                           # sheet pixels -> screen pixels


def rgb565(a):
    r, g, b = a[..., 0].astype(np.uint16), a[..., 1].astype(np.uint16), a[..., 2].astype(np.uint16)
    v = ((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3)
    v[v == KEY] = KEY - 1                                   # an opaque pixel must never equal the key
    return v


def encode(rgba, ox, oy):
    """rgba: HxWx4 uint8 already at output scale. Returns the sprite bytes, or None if it is fully transparent."""
    op = rgba[..., 3] >= 128
    if not op.any():
        return None
    ys, xs = np.nonzero(op)
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1      # trim
    rgba = rgba[y0:y1, x0:x1]
    op = op[y0:y1, x0:x1]
    px = rgb565(rgba[..., :3])
    h, w = op.shape
    rows = []
    for y in range(h):
        spans = []
        x = 0
        while x < w:
            if not op[y, x]:
                x += 1
                continue
            s = x
            while x < w and op[y, x]:
                x += 1
            spans.append((s, x - s))
        buf = struct.pack('<H', len(spans))
        for s, n in spans:
            buf += struct.pack('<HH', s, n) + px[y, s:s + n].astype('<u2').tobytes()
        if len(buf) % 4:
            buf += b'\0' * (4 - len(buf) % 4)
        rows.append(buf)
    head = struct.pack('<hhHH', int(ox + x0), int(oy + y0), w, h)
    off = len(head) + 4 * h
    tab = b''
    for r in rows:
        tab += struct.pack('<I', off)
        off += len(r)
    return head + tab + b''.join(rows)


class Pack:
    def __init__(self):
        self.blobs = []
        self.index = {}

    def add(self, key, blob):
        if blob is None:
            return -1
        if key in self.index:
            return self.index[key]
        self.index[key] = len(self.blobs)
        self.blobs.append(blob)
        return self.index[key]

    def write(self, path):
        n = len(self.blobs)
        head = struct.pack('<4sI', b'PPK1', n)
        off = len(head) + 8 * n
        ent = b''
        body = b''
        for b in self.blobs:
            pad = (-len(b)) % 4
            ent += struct.pack('<II', off + len(body), len(b))
            body += b + b'\0' * pad
        with open(path, 'wb') as f:
            f.write(head + ent + body)
        return len(head) + len(ent) + len(body)


def sample(img, cx, cy, cw, ch, ax, ay, sc):
    """Resample the cell (cx, cy, cw, ch) of img by sc with nearest-neighbour sampling, on an output grid whose origin is the
    anchor (ax, ay) (cell pixels). Returns (rgba, ox, oy): the output picture and its top left relative to that origin."""
    X0, X1 = int(np.floor(-ax * sc)), int(np.ceil((cw - ax) * sc))
    Y0, Y1 = int(np.floor(-ay * sc)), int(np.ceil((ch - ay) * sc))
    xs = np.floor(ax + (np.arange(X0, X1) + 0.5) / sc).astype(int)
    ys = np.floor(ay + (np.arange(Y0, Y1) + 0.5) / sc).astype(int)
    inx, iny = (xs >= 0) & (xs < cw), (ys >= 0) & (ys < ch)
    out = np.zeros((len(ys), len(xs), 4), np.uint8)
    cell = img[cy:cy + ch, cx:cx + cw]
    out[np.ix_(iny, inx)] = cell[np.ix_(ys[iny], xs[inx])]
    return out, X0, Y0


def F(x):
    """a C float literal"""
    return repr(float(x)) + 'f'


def ident(s):
    return re.sub(r'[^A-Za-z0-9_]', '_', s)


def hit_rows(hits):
    """hits (list of shapes in sheet px, y up) -> list of (shape code, ax, ay, bx, by, r); 0 capsule, 1 circle, 2 box"""
    out = []
    for h in hits or []:
        if h['shape'] == 'capsule':
            out.append((0, h['a'][0], h['a'][1], h['b'][0], h['b'][1], h['radius']))
        elif h['shape'] == 'circle':
            out.append((1, h['c'][0], h['c'][1], 0, 0, h['r']))
        else:
            out.append((2, h['a'][0], h['a'][1], h['b'][0], h['b'][1], 0))
    return out


def main():
    src = os.path.join(BUILD, 'game_data.json')
    if not os.path.exists(src):
        sys.exit('run node ports/dreamcast/tools/dump_game_data.js first')
    D = json.load(open(src))
    os.makedirs(GEN, exist_ok=True)
    pack = Pack()
    H = []
    H.append('/* GENERATED by ports/dreamcast/tools/bake_game.py from the web game data. Do not edit by hand. */')
    H.append('#ifndef GAME_DATA_H\n#define GAME_DATA_H')
    v = D['view']
    H.append(f'#define VIEW_W {v["w"]}\n#define VIEW_H {v["h"]}\n#define VIEW_MARGIN {v["margin"]}\n#define ANCHOR_X {v["anchorX"]}\n#define FEET_ROW {v["feetRow"]}')
    H.append('/* the 384x216 web view is shown at 5/6 size: screen = view * 5 / 6, centered in 320x240 (see bake_game.py) */\n#define SCR_W 320\n#define SCR_H 240\n#define VIEW_SCR_H 180\n#define VIEW_TOP 30')

    # ---- background layers (not scaled)
    layer_ids, par = [], []
    for l in D['layers']:
        im = np.asarray(Image.open(os.path.join(WEB, l['src'])).convert('RGBA'))
        o, ox, oy = sample(im, 0, 0, im.shape[1], im.shape[0], 0, 0, VIEW_SCALE)
        layer_ids.append(pack.add('layer:' + l['name'], encode(o, ox, oy)))
        par.append(l['parallax'])
    im = np.asarray(Image.open(os.path.join(WEB, D['fringe']['src'])).convert('RGBA'))
    o, ox, oy = sample(im, 0, 0, im.shape[1], im.shape[0], 0, 0, VIEW_SCALE)
    fringe_id = pack.add('layer:fringe', encode(o, ox, oy))
    H.append(f'#define NUM_LAYERS {len(layer_ids)}')
    H.append('static const unsigned short LAYER_SPRITE[NUM_LAYERS] = {' + ','.join(map(str, layer_ids)) + '};')
    H.append('static const float LAYER_PARALLAX[NUM_LAYERS] = {' + ','.join(F(p) for p in par) + '};')
    H.append(f'#define FRINGE_SPRITE {fringe_id}')

    # ---- moves
    names = list(D['moves'])
    H.append('typedef struct { unsigned char shape; float ax, ay, bx, by, r; } Hit;')
    H.append('typedef struct { unsigned short ms; short sprite; float rx, ry; signed char shx, shy; short top; unsigned short hit0; unsigned char nhit; unsigned char bw; } MoveFrame;')
    H.append('typedef struct { const char *id; unsigned short frame0, nframes, loop_from; unsigned char loop; } MoveDef;')
    hits_c, frames_c, moves_c = [], [], []
    for mi, name in enumerate(names):
        m = D['moves'][name]
        path = os.path.join(WEB, m['sheet'])
        if not os.path.exists(path):
            print('missing sheet', path)
            continue
        sheet = np.asarray(Image.open(path).convert('RGBA'))
        cw, ch = m['cell']
        ax, ay = m['anchor']
        f0 = len(frames_c)
        for k, f in enumerate(m['frames']):
            o, ox, oy = sample(sheet, k * cw, 0, cw, ch, ax, ay, SCALE)
            sp = pack.add(f'move:{name}:{k}', encode(o, ox, oy))
            hs = hit_rows(f.get('hits'))
            h0 = len(hits_c)
            hits_c.extend(hs)
            frames_c.append((f['ms'], sp, f['root'][0], f['root'][1], f['shake'][0], f['shake'][1], f.get('top', 0), h0, len(hs), 1 if f.get('bw') else 0))
        moves_c.append((name, f0, len(m['frames']), m.get('loopFrom', 0), 1 if m.get('loop') else 0))
    H.append('enum { ' + ', '.join(f'MV_{ident(n)}' for n, *_ in moves_c) + ', MV_COUNT };')
    H.append('static const Hit HITS[] = {' + ','.join('{%d,%s,%s,%s,%s,%s}' % (s, F(a), F(b), F(c), F(d), F(r)) for s, a, b, c, d, r in hits_c) + ',{0,0,0,0,0,0}};')
    H.append('static const MoveFrame MOVE_FRAMES[] = {' + ','.join('{%d,%d,%s,%s,%d,%d,%d,%d,%d,%d}' % (t[0], t[1], F(t[2]), F(t[3]), *t[4:]) for t in frames_c) + '};')
    H.append('static const MoveDef MOVES[MV_COUNT] = {' + ','.join('{"%s",%d,%d,%d,%d}' % t for t in moves_c) + '};')

    # ---- enemies
    H.append('typedef struct { unsigned short ms; short sprite; short hx0, hy0, hx1, hy1; short ax0, ay0, ax1, ay1; short ground; unsigned char pause; unsigned char has_hit; } EnemyFrame;')
    flat, anim_rows, enemy_rows, ef = [], [], [], []
    done = []
    for ename, e in D['enemies'].items():
        path = os.path.join(WEB, e['sheet'])
        if not os.path.exists(path):
            print('missing enemy sheet', path)
            continue
        sheet = np.asarray(Image.open(path).convert('RGBA'))
        cw, ch = e['cell']
        ax, ay = e['anchor']
        base = len(ef)                                              # this enemy's first frame in ENEMY_FRAMES
        for k, f in enumerate(e['frames']):
            o, ox, oy = sample(sheet, k * cw, 0, cw, ch, ax, ay, SCALE)
            sp = pack.add(f'enemy:{ename}:{k}', encode(o, ox, oy))
            hu = f.get('hurt') or [0, 0, 0, 0]
            ht = f.get('hit')
            hh = ht or [0, 0, 0, 0]
            ef.append((f['ms'], sp, round(hu[0]), round(hu[1]), round(hu[2]), round(hu[3]), round(hh[0]), round(hh[1]), round(hh[2]), round(hh[3]),
                       round(f.get('ground', 0)), 1 if f.get('pause') else 0, 1 if ht else 0))
        a0 = len(anim_rows)
        for an, a in e['anims'].items():
            off = len(flat)
            flat.extend(base + k for k in a['frames'])             # frame numbers are indexes into the enemy's own frame list
            anim_rows.append((an, off, len(a['frames']), 1 if a.get('loop') else 0))
        ai = e['ai']
        enemy_rows.append((ename, a0, len(e['anims']), round(ai.get('speed', 40)), round(ai.get('hp', 60)), round(ax), round(ay)))
        done.append(ename)
    H.append('enum { ' + ', '.join(f'EN_{ident(n)}' for n in done) + ', EN_COUNT };')
    H.append('static const EnemyFrame ENEMY_FRAMES[] = {' + ','.join('{%d,%d,%d,%d,%d,%d,%d,%d,%d,%d,%d,%d,%d}' % t for t in ef) + '};')
    H.append('static const unsigned short ENEMY_ANIM_FRAME_LIST[] = {' + ','.join(map(str, flat)) + '};')
    H.append('typedef struct { const char *id; unsigned short list0, n; unsigned char loop; } EnemyAnimDef;')
    H.append('static const EnemyAnimDef ENEMY_ANIMS[] = {' + ','.join('{"%s",%d,%d,%d}' % r for r in anim_rows) + '};')
    H.append('typedef struct { const char *id; unsigned short anim0, nanims; short speed, hp, anchor_x, anchor_y; } EnemyDef;')
    H.append('static const EnemyDef ENEMIES[EN_COUNT] = {' + ','.join('{"%s",%d,%d,%d,%d,%d,%d}' % r for r in enemy_rows) + '};')
    n_en_frames = len(ef)
    H.append('#endif')
    os.makedirs(BUILD, exist_ok=True)
    size = pack.write(os.path.join(BUILD, 'ART.BIN'))
    open(os.path.join(GEN, 'game_data.h'), 'w').write('\n'.join(H) + '\n')
    # an index of what was packed, for people
    print(f'ART.BIN: {len(pack.blobs)} sprites, {size / 1048576:.2f} MB; moves {len(moves_c)}, frames {len(frames_c)}; enemies {len(done)}, frames {n_en_frames}')


if __name__ == '__main__':
    main()
