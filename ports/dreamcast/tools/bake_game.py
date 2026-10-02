#!/usr/bin/env python3
"""Bake the web game's art and tables into what the Dreamcast program uses. ON-DEMAND tool (see ../README.md).

    node ports/dreamcast/tools/dump_game_data.js          # the game's JS data -> build/game_data.json
    python3 ports/dreamcast/tools/bake_game.py            # -> build/ART.BIN, src/gen/game_data.h and game_data.c

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
    H, C = [], []                                           # the header (types, externs, enums) and the C file (the tables)
    H.append('/* GENERATED by ports/dreamcast/tools/bake_game.py from the web game data. Do not edit by hand. */')
    H.append('#ifndef GAME_DATA_H\n#define GAME_DATA_H')
    C.append('/* GENERATED by ports/dreamcast/tools/bake_game.py from the web game data. Do not edit by hand. */\n#include "game_data.h"')
    v = D['view']
    H.append(f'#define VIEW_W {v["w"]}\n#define VIEW_H {v["h"]}\n#define VIEW_MARGIN {v["margin"]}\n#define ANCHOR_X {v["anchorX"]}\n#define FEET_ROW {v["feetRow"]}')
    H.append('/* the 384x216 web view is shown at 5/6 size: screen = view * 5 / 6, centered in 320x240 */\n#define SCR_W 320\n#define SCR_H 240\n#define VIEW_SCR_H 180\n#define VIEW_TOP 30')

    def table(ctype, name, rows, fmt, count_name=None):
        """declare `extern const ctype name[]` in the header and define it in the C file (one spare zero row so it is never empty)"""
        H.append(f'extern const {ctype} {name}[{len(rows) + 1}];')
        body = ','.join(fmt(r) for r in rows)
        C.append(f'const {ctype} {name}[{len(rows) + 1}] = {{' + (body + ',' if body else '') + '{0}};')
        if count_name:
            H.append(f'#define {count_name} {len(rows)}')

    # ---- scenery: one scene per backdrop (Green Trail, the five themed levels, the six boss arenas). Layers are sampled once at 5/6 and the
    # web game's vertical grade (web/game/15_draw_scenery.js LIGHTS and drawGrade, a multiply gradient) is baked in. Boss arenas
    # that use one picture (web/assets/story.js ARENA_STILLS) are baked as a fixed 384x216 crop of it.
    LIGHTS = {'trail': ('#1c140c', .28), 'falls': ('#0c1a22', .32), 'canyon': ('#3a1408', .30), 'shore': ('#2a1018', .34), 'mire': ('#06140c', .38),
              'sanctum': ('#080818', .42), 'fungal': ('#081810', .26), 'crypt': ('#060814', .40), 'bone': ('#1a0c08', .32), 'keep': ('#060810', .36)}
    STILLS = {'fungal': 'assets/story/view/forest_waterfall.png', 'crypt': 'assets/story/view/cave_shrine.png',
              'bone': 'assets/story/view/mine_bridge.png', 'keep': 'assets/story/view/moonlit_courtyard.png'}
    SCENE_NAMES = ['trail', 'falls', 'canyon', 'shore', 'mire', 'sanctum', 'tide', 'fungal', 'crypt', 'bone', 'ember', 'keep']

    def grade(rgba, key, row0):
        """multiply the vertical grade over rows whose view row is (row index + row0)"""
        col, ga = LIGHTS.get(key, LIGHTS['trail'])
        c = np.array([int(col[i:i + 2], 16) for i in (1, 3, 5)], float) / 255.0
        out = rgba.astype(float)
        h = rgba.shape[0]
        for r in range(h):
            t = min(1.0, max(0.0, (r + row0) / VIEW_H_))
            k = t / 0.55 if t <= 0.55 else (1.0 - t) / 0.45                 # 0 at the ends (the grade colour), 1 at 55 percent (white)
            src = c + (1.0 - c) * k
            out[r, :, :3] *= (1.0 - ga + ga * src)
        return np.clip(out + 0.5, 0, 255).astype(np.uint8)

    VIEW_H_ = float(v['h'])
    scene_rows = []                                            # per scene: layers [(sprite, parallax, period, margin)], fringe sprite
    for name in SCENE_NAMES:
        layers, fringe = [], -1
        if name in STILLS:
            im = np.asarray(Image.open(os.path.join(WEB, STILLS[name])).convert('RGBA'))
            x0 = int(round((im.shape[1] - v['w']) * 0.5))
            im = grade(np.ascontiguousarray(im[:, x0:x0 + v['w']]), name, 0)
            o, ox, oy = sample(im, 0, 0, im.shape[1], im.shape[0], 0, 0, VIEW_SCALE)
            layers.append((pack.add('still:' + name, encode(o, ox, oy)), 0.0, v['w'], 0))
        else:
            if name == 'trail':
                spec = [(l['src'], l['parallax']) for l in D['layers']]; fr = D['fringe']['src']
            else:
                T = D['themes'][name]
                spec = [(l['src'], l['parallax']) for l in T['layers']]; fr = T['fringe']
            for src, par in spec:
                im = np.asarray(Image.open(os.path.join(WEB, src)).convert('RGBA'))
                im = grade(im, name, -v['margin'])
                o, ox, oy = sample(im, 0, 0, im.shape[1], im.shape[0], 0, 0, VIEW_SCALE)
                layers.append((pack.add('layer:' + src, encode(o, ox, oy)), par, im.shape[1], v['margin']))
            im = np.asarray(Image.open(os.path.join(WEB, fr)).convert('RGBA'))
            o, ox, oy = sample(im, 0, 0, im.shape[1], im.shape[0], 0, 0, VIEW_SCALE)
            fringe = pack.add('fringe:' + name, encode(o, ox, oy))
        scene_rows.append((layers, fringe, im.shape[1]))
    IT = D['items']                                                    # leaf coin frames (small and 1.5x for the 5 leaf piece) and the two gems she can pick up
    leaf_im = np.asarray(Image.open(os.path.join(WEB, IT['leaf'])).convert('RGBA'))
    gem_im = np.asarray(Image.open(os.path.join(WEB, IT['gemSheet'])).convert('RGBA'))
    c8 = IT['cell'] / 2
    leaf_ids = [pack.add(f'leaf:{k}', encode(*sample(leaf_im, k * IT['cell'], 0, IT['cell'], IT['cell'], c8, c8, VIEW_SCALE))) for k in range(IT['leafFrames'])]
    leaf_big = [pack.add(f'leafbig:{k}', encode(*sample(leaf_im, k * IT['cell'], 0, IT['cell'], IT['cell'], c8, c8, VIEW_SCALE * 1.5))) for k in range(IT['leafFrames'])]
    gem_ids = [pack.add('gem:' + n, encode(*sample(gem_im, IT['gems'][n] * IT['cell'], 0, IT['cell'], IT['cell'], c8, c8, VIEW_SCALE))) for n in ('bone', 'powder')]
    H.append(f'#define LEAF_FRAMES {len(leaf_ids)}\nextern const unsigned short LEAF_SPRITES[LEAF_FRAMES], LEAF_BIG_SPRITES[LEAF_FRAMES], GEM_SPRITES[2];   /* GEM_SPRITES: bone (health), powder (max HP) */')
    C.append('const unsigned short LEAF_SPRITES[LEAF_FRAMES] = {' + ','.join(map(str, leaf_ids)) + '};')
    C.append('const unsigned short LEAF_BIG_SPRITES[LEAF_FRAMES] = {' + ','.join(map(str, leaf_big)) + '};')
    C.append('const unsigned short GEM_SPRITES[2] = {' + ','.join(map(str, gem_ids)) + '};')
    H.append('typedef struct { unsigned short sprite; short period, margin; float parallax; } SceneLayer;')
    H.append('typedef struct { unsigned char nlayers; short fringe, fringe_period; SceneLayer layers[6]; } Scene;')
    H.append('enum { ' + ', '.join(f'SC_{n.upper()}' for n in SCENE_NAMES) + ', SC_COUNT };')
    H.append('extern const Scene SCENES[SC_COUNT];')
    C.append('const Scene SCENES[SC_COUNT] = {' + ','.join(
        '{%d,%d,%d,{%s}}' % (len(L_), fr_, fp_, ','.join('{%d,%d,%d,%s}' % (sp, pe, ma, F(pa)) for sp, pa, pe, ma in L_)) for L_, fr_, fp_ in scene_rows) + '};')

    # ---- Max's moves
    H.append('typedef struct { unsigned char shape; float ax, ay, bx, by, r; } Hit;')
    H.append('typedef struct { unsigned short ms; short sprite; float rx, ry; signed char shx, shy; short top; unsigned short hit0; unsigned char nhit; unsigned char bw; } MoveFrame;')
    H.append('typedef struct { const char *id; unsigned short frame0, nframes, loop_from; unsigned char loop; } MoveDef;')
    hits_c, frames_c, moves_c = [], [], []
    for name in D['moves']:
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
    table('Hit', 'HITS', hits_c, lambda t: '{%d,%s,%s,%s,%s,%s}' % (t[0], F(t[1]), F(t[2]), F(t[3]), F(t[4]), F(t[5])))
    table('MoveFrame', 'MOVE_FRAMES', frames_c, lambda t: '{%d,%d,%s,%s,%d,%d,%d,%d,%d,%d}' % (t[0], t[1], F(t[2]), F(t[3]), *t[4:]))
    H.append('extern const MoveDef MOVES[MV_COUNT + 1];')
    C.append('const MoveDef MOVES[MV_COUNT + 1] = {' + ','.join('{"%s",%d,%d,%d,%d}' % t for t in moves_c) + ',{0}};')

    # ---- enemies: frames, animations, and the numbers the AI uses
    ENEMY_HP = {'goblin': 60, 'orc': 200}                     # web/game/05_health.js, for the two enemies that predate the table
    ENEMY_DMG = {'goblin': 12, 'orc': 30}
    JUMP_DIST = {'goblin': 200, 'orc': 70, 'hobgoblin': 130, 'skullraider': 150, 'dusksaur': 110, 'darkknight': 90, 'ogre': 60, 'clubogre': 60}   # web/game/11_enemies.js ENEMY_JUMP_DIST
    LAND_OFF = {'goblin': 10, 'orc': 4}
    H.append('typedef struct { unsigned short ms; short sprite; short hx0, hy0, hx1, hy1; short ax0, ay0, ax1, ay1; short ground; unsigned char pause; unsigned char has_hit; } EnemyFrame;')
    H.append('typedef struct { unsigned short list0, n; unsigned char loop; } EnemyAnim;')
    H.append('\n'.join([
        'typedef struct {',
        '    const char *id;',
        '    unsigned short frame0, nframes;                      /* its frames in ENEMY_FRAMES */',
        '    short anchor_x, anchor_y;',
        '    short speed, hp, rest0, rest1;',
        '    short knock_d, knock_ms, parried_d, parried_ms;      /* default knock on her, and when it is parried */',
        '    signed char a_idle, a_walk, a_stun, a_death, a_dive; /* animation numbers in ENEMY_ANIMS, -1 if none */',
        '    unsigned char nattacks;',
        '    signed char attack[4];                               /* animation numbers of its attacks */',
        '    short atk_dmg[4], atk_knock_d[4], atk_knock_ms[4];',
        '    signed char attack_combo;                            /* the goblin\'s combo animation, -1 if none */',
        '    short dive_min, dive_max;',
        '    unsigned char boss;',
        '    const char *boss_name;                               /* shown on the boss bar */',
        '    short jump_dist, land_off;                           /* how far its leap over a pit carries, and where it means to land past the far edge */',
        '    float reach;                                         /* how far ahead of its ground point its longest attack box reaches (view px) */',
        '} EnemyDef;']))
    ef, anim_rows, flat, edefs, done = [], [], [], [], []
    for ename, e in D['enemies'].items():
        path = os.path.join(WEB, e['sheet'])
        if not os.path.exists(path):
            print('missing enemy sheet', path)
            continue
        sheet = np.asarray(Image.open(path).convert('RGBA'))
        cw, ch = e['cell']
        ax, ay = e['anchor']
        base = len(ef)                                         # this enemy's first frame in ENEMY_FRAMES
        for k, f in enumerate(e['frames']):
            o, ox, oy = sample(sheet, k * cw, 0, cw, ch, ax, ay, SCALE)
            sp = pack.add(f'enemy:{ename}:{k}', encode(o, ox, oy))
            hu = f.get('hurt') or [0, 0, 0, 0]
            ht = f.get('hit')
            hh = ht or [0, 0, 0, 0]
            ef.append((f['ms'], sp, round(hu[0]), round(hu[1]), round(hu[2]), round(hu[3]), round(hh[0]), round(hh[1]), round(hh[2]), round(hh[3]),
                       round(f.get('ground', 0)), 1 if f.get('pause') else 0, 1 if ht else 0))
        idx = {}
        for an, a in e['anims'].items():
            idx[an] = len(anim_rows)
            anim_rows.append((len(flat), len(a['frames']), 1 if a.get('loop') else 0))
            flat.extend(base + k for k in a['frames'])         # frame numbers become indexes into ENEMY_FRAMES
        ai = e['ai']
        atk = ai.get('atk') or {}
        dmg0 = ai.get('dmg', ENEMY_DMG.get(ename, 10))
        kd, kms = ai['knock']
        pd, pms = ai['parried']
        melee = [a for a in ai['attacks'] if a != 'combo'][:4]
        pad = 4 - len(melee)
        reach = 0.0
        for an in ai['attacks']:
            fr = e['anims'][an]['frames']
            g0 = e['frames'][fr[0]].get('ground', 0) or 0
            for k in fr:
                h = e['frames'][k].get('hit')
                if h:
                    reach = max(reach, g0 - h[0] * SPRITE_SCALE)
        dv = ai.get('dive') or {}
        edefs.append(dict(
            id=ename, f0=base, nf=len(e['frames']), ax=round(ax), ay=round(ay), speed=round(ai['speed']),
            hp=round(ai.get('hp', ENEMY_HP.get(ename, 60))), r0=ai['rest'][0], r1=ai['rest'][1], kd=kd, kms=kms, pd=pd, pms=pms,
            idle=idx.get('idle', -1), walk=idx.get('walk', -1), stun=idx.get(ai.get('stun') or '', -1), death=idx.get(ai.get('death') or '', -1),
            dive=idx.get(dv.get('anim', ''), -1), natk=len(melee),
            attack=[idx[a] for a in melee] + [-1] * pad,
            dmg=[(atk.get(a) or {}).get('dmg', dmg0) for a in melee] + [0] * pad,
            kdd=[((atk.get(a) or {}).get('knock') or [kd, kms])[0] for a in melee] + [0] * pad,
            kmm=[((atk.get(a) or {}).get('knock') or [kd, kms])[1] for a in melee] + [0] * pad,
            combo=idx.get('combo', -1), dmin=dv.get('min', 0), dmax=dv.get('max', 0), boss=1 if ai.get('boss') else 0, bn=(ai.get('bossName') or e.get('title') or ename), rf=F(reach), jd=JUMP_DIST.get(ename, 200), lo_=LAND_OFF.get(ename, 10)))
        done.append(ename)
    H.append('enum { ' + ', '.join(f'EN_{ident(n)}' for n in done) + ', EN_COUNT };')
    table('EnemyFrame', 'ENEMY_FRAMES', ef, lambda t: '{%d,%d,%d,%d,%d,%d,%d,%d,%d,%d,%d,%d,%d}' % t)
    H.append(f'extern const unsigned short ENEMY_ANIM_FRAME_LIST[{len(flat) + 1}];')
    C.append('const unsigned short ENEMY_ANIM_FRAME_LIST[%d] = {%s,0};' % (len(flat) + 1, ','.join(map(str, flat))))
    table('EnemyAnim', 'ENEMY_ANIMS', anim_rows, lambda r: '{%d,%d,%d}' % r)
    H.append('extern const EnemyDef ENEMIES[EN_COUNT + 1];')

    def arr(a):
        return '{' + ','.join(str(x) for x in a) + '}'
    C.append('const EnemyDef ENEMIES[EN_COUNT + 1] = {' + ','.join(
        ('{"%(id)s",%(f0)d,%(nf)d,%(ax)d,%(ay)d,%(speed)d,%(hp)d,%(r0)d,%(r1)d,%(kd)d,%(kms)d,%(pd)d,%(pms)d,%(idle)d,%(walk)d,%(stun)d,%(death)d,%(dive)d,%(natk)d,' % r)
        + arr(r['attack']) + ',' + arr(r['dmg']) + ',' + arr(r['kdd']) + ',' + arr(r['kmm'])
        + (',%(combo)d,%(dmin)d,%(dmax)d,%(boss)d,"%(bn)s",%(jd)d,%(lo_)d,%(rf)s}' % r) for r in edefs) + ',{0}};')

    # ---- levels and maps (web/levels.js builds them with a fixed seed, so they are the same every time)
    ENUM = {n: i for i, n in enumerate(done)}
    H.append('typedef struct { short x0, x1, top; } Plat;\ntypedef struct { short x0, x1; } Pit;\ntypedef struct { short x, fy; } Spot;\ntypedef struct { short x, fy, loot; } Crate;       /* loot: 0 none, -1 an ankh, n > 0 a shower of n leaves */')
    H.append('typedef struct { short type, x, fy, path0, path1, sight; } EnemySpawn;\ntypedef struct { short x, fy, h; } Leaf;')
    H.append('typedef struct { const char *id; unsigned short plat0, nplat, pit0, npit, crate0, ncrate, bomb0, nbomb, en0, nen, leaf0, nleaf; unsigned char final, boss, scene; } MapDef;')
    H.append('typedef struct { const char *name; unsigned short map0, nmaps; } LevelDef;')
    plats, pits, crates, bombs, spawns, leaves, maps, levels = [], [], [], [], [], [], [], []
    for lv in D['levels']['levels']:
        if not lv:
            continue
        m0 = len(maps)
        for md in lv['maps']:
            pl = (md.get('solids') or []) + (md.get('plats') or [])
            maps.append([md.get('id', ''), len(plats), len(pl), len(pits), len(md.get('pits') or []), len(crates), len(md.get('crates') or []),
                         len(bombs), len(md.get('bombs') or []), len(spawns), len(md.get('enemies') or []), len(leaves), len(md.get('leaves') or []),
                         1 if md.get('final') else 0, 1 if md.get('boss') else 0, SCENE_NAMES.index(md['theme'] if md.get('boss') and md.get('theme') else (lv.get('bg') or 'trail'))])
            plats.extend((q['x0'], q['x1'], q['top']) for q in pl)
            pits.extend((q['x0'], q['x1']) for q in md.get('pits') or [])
            crates.extend((q['x'], q.get('fy', 0), -1 if q.get('loot') == 'ankh' else int(q['loot'].split(':')[1]) if (q.get('loot') or '').startswith('leaves:') else 0) for q in md.get('crates') or [])
            bombs.extend((q['x'], q.get('fy', 0)) for q in md.get('bombs') or [])
            for q in md.get('enemies') or []:
                pa = q.get('path') or [-1, -1]
                spawns.append((ENUM.get(q['type'], 0), q['x'], q.get('fy', 0), pa[0], pa[1], q.get('sight', 100)))
            leaves.extend((q['x'], q.get('fy', 0), q.get('h', 12)) for q in md.get('leaves') or [])
        levels.append((lv.get('name', ''), m0, len(lv['maps'])))
    table('Plat', 'PLATS', plats, lambda t: '{%d,%d,%d}' % t)
    table('Pit', 'PITS', pits, lambda t: '{%d,%d}' % t)
    table('Crate', 'CRATES', crates, lambda t: '{%d,%d,%d}' % t)
    table('Spot', 'BOMBS', bombs, lambda t: '{%d,%d}' % t)
    table('EnemySpawn', 'SPAWNS', spawns, lambda t: '{%d,%d,%d,%d,%d,%d}' % t)
    table('Leaf', 'LEAVES', leaves, lambda t: '{%d,%d,%d}' % t)
    table('MapDef', 'MAPS', maps, lambda r: '{"%s",%s}' % (r[0], ','.join(str(x) for x in r[1:])))
    table('LevelDef', 'LEVELS', levels, lambda r: '{"%s",%d,%d}' % r, 'NUM_LEVELS')
    H.append('#endif')
    os.makedirs(BUILD, exist_ok=True)
    size = pack.write(os.path.join(BUILD, 'ART.BIN'))
    open(os.path.join(GEN, 'game_data.h'), 'w').write('\n'.join(H) + '\n')
    open(os.path.join(GEN, 'game_data.c'), 'w').write('\n'.join(C) + '\n')
    print(f'ART.BIN: {len(pack.blobs)} sprites, {size / 1048576:.2f} MB; moves {len(moves_c)}, frames {len(frames_c)}; enemies {len(done)}, frames {len(ef)}; '
          f'levels {len(levels)}, maps {len(maps)}, spawns {len(spawns)}')


if __name__ == '__main__':
    main()
