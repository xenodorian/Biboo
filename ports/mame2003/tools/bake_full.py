#!/usr/bin/env python3
"""Bake the whole web game at 1:1 into art.bin and an integer header.

No floats in the header. Sheet pixels become view pixels here (the web
sprite scale is 1/2). The 68000 only reads the tables.

    python3 ports/mame2003/tools/bake_full.py
"""
import json
import os
import subprocess
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
PORT = os.path.dirname(HERE)
ROOT = os.path.dirname(os.path.dirname(PORT))
WEB = os.path.join(ROOT, "web")
sys.path.insert(0, os.path.join(ROOT, "ports", "dreamcast", "tools"))
import bake_game as bg  # noqa: E402

JSON_PATH = os.path.join(PORT, "build", "game_data.json")
ART = os.path.join(PORT, "roms", "art.bin")
HDR = os.path.join(PORT, "game", "data.h")
VIEW_SCALE = 1.0
CHAR_SCALE = 0.5

BTN = {
    "Up": 1, "Down": 2, "Left": 4, "Right": 8, "A": 16, "B": 32, "X": 64, "Y": 128,
    "L1": 0x100, "R1": 0x200, "L2": 0x400, "R2": 0x800, "L": 0x100, "R": 0x200,
}
TYPE = {"idle": 0, "press": 1, "tap": 2, "hold": 3, "chord": 4, "sequence": 5, "air": 6}
SPECIAL = {
    "ultimate": 32766, "sky_dash": 32765, "double_jump": 32764, "meter_charge": 32763,
    "fly": 32762, "rainbow": 32761, "chain_burst": 32760,
}
LIGHTS = {
    "trail": ("#1c140c", 0.28), "falls": ("#0c1a22", 0.32), "canyon": ("#3a1408", 0.30),
    "shore": ("#2a1018", 0.34), "mire": ("#06140c", 0.38), "sanctum": ("#080818", 0.42),
    "fungal": ("#081810", 0.26), "crypt": ("#060814", 0.40), "bone": ("#1a0c08", 0.32),
    "keep": ("#060810", 0.36), "training": ("#201008", 0.22), "tide": ("#0c1a22", 0.32),
    "ember": ("#3a1408", 0.30),
}
STILLS = {
    "fungal": "assets/story/view/forest_waterfall.png",
    "crypt": "assets/story/view/cave_shrine.png",
    "bone": "assets/story/view/mine_bridge.png",
    "keep": "assets/story/view/moonlit_courtyard.png",
}
STORY = [
    ("calm", "assets/story/view/village_meadow.png"),
    ("fire", "assets/story/view/burning_house.png"),
    ("crowd", "assets/story/view/village_meadow.png"),
    ("sea", "assets/story/view/sunset_island.png"),
    ("double", "assets/story/view/moonlit_courtyard.png"),
    ("altar", "assets/story/view/snow_temple.png"),
    ("rewind", "assets/story/view/sunset_island.png"),
    ("meditate", "assets/story/view/sunset_island.png"),
    ("sunrise", "assets/story/view/sunset_island.png"),
]
SCENES = ["trail", "falls", "canyon", "shore", "mire", "sanctum", "tide", "fungal", "crypt", "bone", "ember", "keep", "training"]
BEAMS = ["cloud", "fire", "laser", "plasma"]
JUMP_DIST = {"goblin": 200, "orc": 70, "hobgoblin": 130, "skullraider": 150, "dusksaur": 110, "darkknight": 90, "ogre": 60, "clubogre": 60}
LAND_OFF = {"goblin": 10, "orc": 4}


def cstr(s, n):
    b = "".join(ch if 32 <= ord(ch) < 127 and ch not in '\\"' else "?" for ch in str(s))[: n - 1]
    return '"' + b + '"'


def grade(rgba, key, row0, view_h):
    col, ga = LIGHTS.get(key, LIGHTS["trail"])
    c = np.array([int(col[i:i + 2], 16) for i in (1, 3, 5)], float) / 255.0
    out = rgba.astype(float)
    for r in range(rgba.shape[0]):
        t = min(1.0, max(0.0, (r + row0) / float(view_h)))
        k = t / 0.55 if t <= 0.55 else (1.0 - t) / 0.45
        src = c + (1.0 - c) * k
        out[r, :, :3] *= 1.0 - ga + ga * src
    return np.clip(out + 0.5, 0, 255).astype(np.uint8)


def half(v):
    return int(round(float(v) * CHAR_SCALE))


def add_im(pack, key, path, ax, ay, scale):
    if not os.path.exists(path):
        print(" missing", path)
        return -1
    im = np.asarray(Image.open(path).convert("RGBA"))
    h, w = im.shape[0], im.shape[1]
    if w > 384:
        x0 = (w - 384) // 2
        im = np.ascontiguousarray(im[:, x0:x0 + 384])
        w = im.shape[1]
    if h > 216:
        im = np.ascontiguousarray(im[:216])
        h = im.shape[0]
    if ax is None:
        ax = w // 2
    if ay is None:
        ay = h
    o, ox, oy = bg.sample(im, 0, 0, w, h, ax, ay, scale)
    return pack.add(key, bg.encode(o, ox, oy))


def mv_id(name, index):
    if not name:
        return -1
    if name in index:
        return index[name]
    return SPECIAL.get(name, -1)


def main():
    os.makedirs(os.path.dirname(JSON_PATH), exist_ok=True)
    os.makedirs(os.path.dirname(ART), exist_ok=True)
    if os.path.exists(JSON_PATH):
        os.remove(JSON_PATH)
    subprocess.check_call(["node", os.path.join(HERE, "dump_boot.cjs"), JSON_PATH])
    D = json.load(open(JSON_PATH))
    v = D["view"]
    pack = bg.Pack()
    margin = int(v["margin"])
    view_h = int(v["h"])

    scene_rows = []
    for name in SCENES:
        layers = []
        fringe = -1
        fringe_period = 0
        if name in STILLS:
            im = np.asarray(Image.open(os.path.join(WEB, STILLS[name])).convert("RGBA"))
            x0 = max(0, (im.shape[1] - int(v["w"])) // 2)
            im = np.ascontiguousarray(im[:, x0:x0 + int(v["w"])])
            im = grade(im, name, 0, view_h)
            o, ox, oy = bg.sample(im, 0, 0, im.shape[1], im.shape[0], 0, 0, VIEW_SCALE)
            layers.append((pack.add("still:" + name, bg.encode(o, ox, oy)), im.shape[1], 0, 0))
        else:
            if name == "trail":
                spec = [(L["src"], L["parallax"]) for L in D["layers"]]
                fr = D["fringe"]["src"]
            elif name in D.get("themes", {}):
                T = D["themes"][name]
                spec = [(L["src"], L["parallax"]) for L in T["layers"]]
                fr = T["fringe"]
            else:
                spec, fr = [], None
            for src, par in spec:
                im = np.asarray(Image.open(os.path.join(WEB, src)).convert("RGBA"))
                im = grade(im, name, -margin, view_h)
                o, ox, oy = bg.sample(im, 0, 0, im.shape[1], im.shape[0], 0, 0, VIEW_SCALE)
                layers.append((pack.add("layer:" + src, bg.encode(o, ox, oy)), im.shape[1], margin, int(round(float(par) * 256))))
            if fr:
                im = np.asarray(Image.open(os.path.join(WEB, fr)).convert("RGBA"))
                o, ox, oy = bg.sample(im, 0, 0, im.shape[1], im.shape[0], 0, 0, VIEW_SCALE)
                fringe = pack.add("fringe:" + name, bg.encode(o, ox, oy))
                fringe_period = int(im.shape[1])
        scene_rows.append((layers, fringe, fringe_period))
        print(" scene", name, "layers", len(layers))

    it = D["items"]
    leaf_im = np.asarray(Image.open(os.path.join(WEB, it["leaf"])).convert("RGBA"))
    c8 = it["cell"] / 2
    leaf_ids = []
    for k in range(it["leafFrames"]):
        leaf_ids.append(pack.add(f"leaf:{k}", bg.encode(*bg.sample(leaf_im, k * it["cell"], 0, it["cell"], it["cell"], c8, c8, VIEW_SCALE))))

    move_names = list(D["moves"])
    move_index = {n: i for i, n in enumerate(move_names)}
    frames = []
    moves = []
    hits = []
    fx_ids = {}

    def fx_of(f):
        p = f.get("bw")
        if not isinstance(p, str) or not p:
            return -1
        if p not in fx_ids:
            path = os.path.join(WEB, p)
            fx_ids[p] = add_im(pack, "fx:" + p, path, None, None, CHAR_SCALE) if os.path.exists(path) else -1
        return fx_ids[p]
    for name in move_names:
        m = D["moves"][name]
        path = os.path.join(WEB, m["sheet"])
        sheet = np.asarray(Image.open(path).convert("RGBA")) if os.path.exists(path) else None
        cw, ch = m["cell"]
        ax, ay = m["anchor"]
        f0 = len(frames)
        names = []
        for k, f in enumerate(m["frames"]):
            sid = -1
            if sheet is not None:
                o, ox, oy = bg.sample(sheet, k * cw, 0, cw, ch, ax, ay, CHAR_SCALE)
                sid = pack.add(f"move:{name}:{k}", bg.encode(o, ox, oy))
            hs = f.get("hits") or []
            h0 = len(hits)
            for h in hs:
                if h["shape"] == "capsule":
                    hits.append((0, half(h["a"][0]), half(h["a"][1]), half(h["b"][0]), half(h["b"][1]), half(h["radius"])))
                elif h["shape"] == "circle":
                    hits.append((1, half(h["c"][0]), half(h["c"][1]), 0, 0, half(h["r"])))
                else:
                    hits.append((2, half(h["a"][0]), half(h["a"][1]), half(h["b"][0]), half(h["b"][1]), 0))
            bm = f.get("beam")
            beam = BEAMS.index(bm["kind"]) if bm else -1
            nm = (f.get("name") or "")[:15]
            names.append(nm)
            frames.append((int(f["ms"]), sid, int(round(f["root"][0])), int(round(f["root"][1])), int(f.get("top", 0)), h0, len(hs), beam, nm, fx_of(f)))
        en = m.get("enter") or {}
        edef = names.index(en["default"]) if en.get("default") in names else 0
        efrom = -1
        ek = [-1] * 16
        for fm, mp in (en.get("fromMove") or {}).items():
            if fm in move_index:
                efrom = move_index[fm]
                src_names = [ff.get("name", "") for ff in D["moves"][fm]["frames"]]
                for si, sn in enumerate(src_names[:16]):
                    tgt = mp.get(sn, sn)
                    ek[si] = names.index(tgt) if tgt in names else -1
        moves.append((name, f0, len(m["frames"]), int(m.get("loopFrom") or 0), 1 if m.get("loop") else 0, edef, efrom, ek))
        print(" move", name, len(m["frames"]))

    # enemies
    eframes, anims, flat, edefs, enames = [], [], [], [], []
    for ename, e in D["enemies"].items():
        sheet_path = e["sheet"]
        path = os.path.join(ROOT, sheet_path) if sheet_path.startswith("ports/") else os.path.join(WEB, sheet_path)
        if not os.path.exists(path):
            print(" skip enemy, missing", path)
            continue
        sheet = np.asarray(Image.open(path).convert("RGBA"))
        cw, ch = e["cell"]
        ax, ay = e["anchor"]
        base = len(eframes)
        for k, f in enumerate(e["frames"]):
            o, ox, oy = bg.sample(sheet, k * cw, 0, cw, ch, ax, ay, CHAR_SCALE)
            sid = pack.add(f"enemy:{ename}:{k}", bg.encode(o, ox, oy))
            hu = f.get("hurt") or [0, 0, 0, 0]
            ht = f.get("hit")
            hh = ht or [0, 0, 0, 0]
            flags = (1 if f.get("pause") else 0) | (2 if ht else 0) | (4 if f.get("open") else 0) | (8 if f.get("tick") else 0)
            eframes.append((int(f["ms"]), sid, int(hu[0]), int(hu[1]), int(hu[2]), int(hu[3]), int(hh[0]), int(hh[1]), int(hh[2]), int(hh[3]), int(round(f.get("ground", 0))), flags))
        idx = {}
        for an, a in e["anims"].items():
            idx[an] = len(anims)
            anims.append((len(flat), len(a["frames"]), 1 if a.get("loop") else 0))
            flat.extend(base + k for k in a["frames"])
        ai = e["ai"]
        atk = ai.get("atk") or {}
        dmg0 = int(ai.get("dmg", 10))
        kd, kms = ai["knock"]
        pd, pms = ai["parried"]
        melee = [a for a in ai["attacks"] if a != "combo"][:4]
        dv = ai.get("dive") or {}
        reach = 0
        for an in ai["attacks"]:
            frs = e["anims"][an]["frames"]
            g0 = e["frames"][frs[0]].get("ground", 0) or 0
            for k in frs:
                h = e["frames"][k].get("hit")
                if h:
                    reach = max(reach, int(round(g0 - h[0] * CHAR_SCALE)))
        edefs.append(dict(
            id=ename[:15], speed=int(round(ai["speed"])), hp=min(32767, int(round(ai.get("hp", 60)))),
            r0=int(ai["rest"][0]), r1=int(ai["rest"][1]), kd=int(kd), kms=int(kms), pd=int(pd), pms=int(pms),
            dmg=[int((atk.get(a) or {}).get("dmg", dmg0)) for a in melee] + [0] * (4 - len(melee)),
            kdd=[int(((atk.get(a) or {}).get("knock") or [kd, kms])[0]) for a in melee] + [0] * (4 - len(melee)),
            kmm=[int(((atk.get(a) or {}).get("knock") or [kd, kms])[1]) for a in melee] + [0] * (4 - len(melee)),
            dmin=int(dv.get("min", 0)), dmax=int(dv.get("max", 0)), reach=reach,
            jd=int(JUMP_DIST.get(ename, 200)), lo=int(LAND_OFF.get(ename, 10)),
            f0=base, nf=len(e["frames"]),
            idle=idx.get("idle", -1), walk=idx.get("walk", -1), stun=idx.get(ai.get("stun") or "", -1),
            death=idx.get(ai.get("death") or "", -1), dive=idx.get(dv.get("anim", ""), -1),
            combo=idx.get("combo", -1), natk=len(melee),
            attack=[idx[a] for a in melee] + [-1] * (4 - len(melee)),
            boss=1 if ai.get("boss") else 0,
            prop=1 if ai.get("prop") else 0,
        ))
        enames.append(ename)
        print(" enemy", ename, len(e["frames"]))

    enum = {n: i for i, n in enumerate(enames)}
    plats, pits, crates, bombs, spawns, leaves, maps, levels = [], [], [], [], [], [], [], []
    for lv in D["levels"]["levels"]:
        if not lv:
            continue
        m0 = len(maps)
        for md in lv["maps"]:
            pl = (md.get("solids") or []) + (md.get("plats") or [])
            theme = md["theme"] if md.get("boss") and md.get("theme") else (lv.get("bg") or "trail")
            if theme not in SCENES:
                theme = "trail"
            maps.append((
                len(plats), len(pl), len(pits), len(md.get("pits") or []), len(crates), len(md.get("crates") or []),
                len(bombs), len(md.get("bombs") or []), len(spawns), len(md.get("enemies") or []),
                len(leaves), len(md.get("leaves") or []), SCENES.index(theme),
                1 if md.get("final") else 0, 1 if md.get("boss") else 0, str(md.get("id", ""))[:7],
            ))
            plats.extend((int(q["x0"]), int(q["x1"]), int(q["top"])) for q in pl)
            pits.extend((int(q["x0"]), int(q["x1"])) for q in md.get("pits") or [])
            for q in md.get("crates") or []:
                loot = q.get("loot")
                if loot == "ankh":
                    code = -1
                elif isinstance(loot, str) and loot.startswith("leaves:"):
                    code = int(loot.split(":")[1])
                else:
                    code = 0
                crates.append((int(q["x"]), int(q.get("fy", 0)), code))
            bombs.extend((int(q["x"]), int(q.get("fy", 0))) for q in md.get("bombs") or [])
            for q in md.get("enemies") or []:
                pa = q.get("path") or [-1, -1]
                spawns.append((enum.get(q["type"], 0), int(q["x"]), int(q.get("fy", 0)), int(pa[0]), int(pa[1]), int(q.get("sight", 100))))
            leaves.extend((int(q["x"]), int(q.get("fy", 0)), int(q.get("h", 12))) for q in md.get("leaves") or [])
        levels.append((m0, len(lv["maps"]), (lv.get("name") or "")[:23]))

    map_train = -1
    tl = D.get("trainingLevel") or {}
    if tl.get("maps"):
        map_train = len(maps)
        md = tl["maps"][0]
        theme = tl.get("bg") or "training"
        if theme not in SCENES:
            theme = "trail"
        maps.append((
            len(plats), 0, len(pits), 0, len(crates), 0, len(bombs), 0,
            len(spawns), len(md.get("enemies") or []), len(leaves), 0,
            SCENES.index(theme), 0, 0, str(md.get("id", "T"))[:7],
        ))
        for q in md.get("enemies") or []:
            pa = q.get("path") or [-1, -1]
            spawns.append((enum.get(q["type"], 0), int(q["x"]), int(q.get("fy", 0)), int(pa[0]), int(pa[1]), int(q.get("sight", 100))))
        print(" training map", map_train, "enemies", md.get("enemies"))

    gem_ids = []
    cell = int(it["cell"])
    gem_sheet = np.asarray(Image.open(os.path.join(WEB, it["gemSheet"])).convert("RGBA"))
    for name in ("bone", "powder", "quartz", "garnet", "diamond"):
        idx = int(it["gems"][name])
        o, ox, oy = bg.sample(gem_sheet, idx * cell, 0, cell, cell, cell // 2, cell // 2, VIEW_SCALE)
        gem_ids.append(pack.add("gem:" + name, bg.encode(o, ox, oy)))
    mer = it["merchant"]
    merchant_id = add_im(pack, "merchant", os.path.join(WEB, mer["src"]), mer["w"] // 2, mer["h"], VIEW_SCALE)
    beam_ids = []
    for kind in BEAMS:
        b = D["beams"][kind]
        beam_ids.append(add_im(pack, "beam:" + kind, os.path.join(WEB, b["src"]), 0, int(b["h"]) // 2, VIEW_SCALE))
    bunny_id = -1
    bun = (D.get("training") or {}).get("bunny") or {}
    if bun.get("sheet"):
        cw, ch = bun["cell"]
        ax, ay = bun["anchor"]
        im = np.asarray(Image.open(os.path.join(WEB, bun["sheet"])).convert("RGBA"))
        o, ox, oy = bg.sample(im, 0, 0, cw, ch, ax, ay, CHAR_SCALE)
        bunny_id = pack.add("bunny", bg.encode(o, ox, oy))
    story_ids = []
    seen_story = {}
    for key, rel in STORY:
        if rel not in seen_story:
            seen_story[rel] = add_im(pack, "story:" + key, os.path.join(WEB, rel), None, None, VIEW_SCALE)
        story_ids.append(seen_story[rel])
    boat_id = add_im(pack, "boat", os.path.join(WEB, "assets/story/view/boat.png"), None, None, VIEW_SCALE)

    binds = []
    seen_b = set()
    for b in D["input"]["bindings"]:
        typ, inp, mv = b["type"], b["input"], b["move"]
        if typ == "idle" or mv == "jump":
            continue
        if typ in ("press", "tap", "hold", "air"):
            steps = [BTN[inp]]
        elif typ == "chord":
            steps = [sum(BTN[k] for k in inp.split("+"))]
        else:
            steps = [sum(BTN[k] for k in st.split("+")) for st in inp.split("-")]
        rel = b.get("release_into")
        held = sum(BTN[k] for k in (b.get("held") or []))
        mid = mv_id(mv, move_index)
        rid = mv_id(rel, move_index) if rel else -1
        key = (TYPE[typ], mid, rid, held, tuple(steps))
        if key in seen_b:
            continue
        seen_b.add(key)
        binds.append((TYPE[typ], len(steps), 1 if b.get("loose") else 0, mid, rid, held, steps + [0] * (6 - len(steps))))
    chords = [b for b in binds if b[0] == 4]
    seqs = [b for b in binds if b[0] == 5]
    others = [b for b in binds if b[0] not in (4, 5)]
    chords.sort(key=lambda b: -bin(b[6][0]).count("1"))
    seqs.sort(key=lambda b: -b[1])

    ulines = []
    for u in D["unlocks"]:
        mids = []
        for m in (u.get("moves") or [])[:3]:
            mids.append(mv_id(m, move_index))
        while len(mids) < 3:
            mids.append(-1)
        shop = 1 if (u.get("meters") or u["id"] == "meter_charge") else 0
        price = 25 + 15 * int(u["level"]) if shop else 15 + 10 * int(u["level"])
        bt = 0
        for b_ in u.get("buttons") or []:
            bt |= BTN.get(b_, 0)
        mt = sum({"energy": 1, "empower": 2, "super": 4}[m] for m in (u.get("meters") or []))
        ulines.append((u["id"][:15], (u.get("name") or "")[:31], int(u["level"]), shop, mids, bt, mt, price))

    size = pack.write(ART)
    out = []
    a = out.append
    a("/* generated by tools/bake_full.py — do not edit */")
    a("#ifndef PP_DATA_H")
    a("#define PP_DATA_H")
    a(f"#define VIEW_W {int(v['w'])}")
    a(f"#define VIEW_H {int(v['h'])}")
    a(f"#define VIEW_MARGIN {margin}")
    a(f"#define ANCHOR_X {int(v['anchorX'])}")
    a(f"#define FEET_ROW {int(v['feetRow'])}")
    a(f"#define NLAYERS_MAX 6")
    a("enum { " + ", ".join("MV_" + n for n in move_names) + ", MV_COUNT };")
    a("#define MV_ULTIMATE 32766")
    a("#define MV_SKY 32765")
    a("#define MV_DBL 32764")
    a("#define MV_METER 32763")
    a("#define MV_FLY 32762")
    a("#define MV_RAINBOW 32761")
    a("#define MV_CHAINBURST 32760")
    a("enum { " + ", ".join("EN_" + n for n in enames) + ", EN_COUNT };")
    a("enum { " + ", ".join("SC_" + n.upper() for n in SCENES) + ", SC_COUNT };")
    a("enum { BT_IDLE, BT_PRESS, BT_TAP, BT_HOLD, BT_CHORD, BT_SEQ, BT_AIR };")
    a("enum { UL_" + ", UL_".join(u[0].upper() for u in ulines) + ", UL_COUNT };" if False else
      "enum { " + ", ".join("UL_" + "".join(ch if ch.isalnum() else "_" for ch in u[0]).upper() for u in ulines) + ", UL_COUNT };")
    a(f"#define NFRAMES {len(frames)}")
    a(f"#define NHITS {len(hits)}")
    a(f"#define NMOVES {len(moves)}")
    a("typedef struct { unsigned short ms, spr, hit0; short rx, ry, top; signed char nhit, beam; char name[16]; short fx; } Frame;")
    a("typedef struct { signed char shape, pad; short ax, ay, bx, by, r; } Hit;")
    a("typedef struct { unsigned short f0, n, loop_from; short enter_default, enter_from; unsigned char loop, pad; signed char enter_k[16]; char id[20]; } Move;")
    a("typedef struct { unsigned char type, nsteps, loose, pad; short move, release_into; unsigned short held, steps[6]; } Bind;")
    a("typedef struct { unsigned short ms; short spr, hx0, hy0, hx1, hy1, ax0, ay0, ax1, ay1, ground; unsigned char flags, pad; } EFrame;")
    a("typedef struct { unsigned short list0, n; unsigned char loop, pad; } EAnim;")
    a("typedef struct { short speed, hp, rest0, rest1, knock_d, knock_ms, parry_d, parry_ms; short atk_dmg[4], atk_kd[4], atk_km[4]; short dive_min, dive_max, reach, jump_dist, land_off; unsigned short f0, nf; signed char a_idle, a_walk, a_stun, a_death, a_dive, combo, attack[4]; unsigned char nattacks, boss, prop, pad2; char id[16]; } EDef;")
    a("typedef struct { short x0, x1, top; } Plat;")
    a("typedef struct { short x0, x1; } Pit;")
    a("typedef struct { short x, fy, loot; } Crate;")
    a("typedef struct { short x, fy; } Spot;")
    a("typedef struct { short type, x, fy, path0, path1, sight; } Spawn;")
    a("typedef struct { short x, fy, h; } LeafSpot;")
    a("typedef struct { unsigned short plat0, nplat, pit0, npit, crate0, ncrate, bomb0, nbomb, en0, nen, leaf0, nleaf; unsigned char scene, final_map, boss, pad; char id[8]; } MapDef;")
    a("typedef struct { unsigned short map0, nmaps; char name[24]; } LevelDef;")
    a("typedef struct { unsigned short spr; short period, margin, par; } Layer;")
    a("typedef struct { unsigned char n, pad; short fringe, fringe_period; Layer layer[6]; } Scene;")
    a("typedef struct { unsigned char level, shop, meters; unsigned char pad; short moves[3]; unsigned short buttons; unsigned short price; char id[16]; char name[32]; } UnlockDef;")
    a(f"#define LEAF_N {len(leaf_ids)}")
    a("static const short LEAF_SPR[" + str(len(leaf_ids)) + "] = {" + ",".join(str(i) for i in leaf_ids) + "};")

    def frame_c(t):
        ms, sid, rx, ry, top, h0, nh, beam, nm, fx = t
        return "{%d,%d,%d,%d,%d,%d,%d,%d,%s,%d}" % (ms, sid if sid is not None and sid >= 0 else 0, h0, rx, ry, top, nh, beam, cstr(nm, 16), fx)
    a("static const Frame FRAMES[NFRAMES] = {" + ",".join(frame_c(t) for t in frames) + "};")
    if hits:
        a("static const Hit HITS[NHITS] = {" + ",".join("{%d,0,%d,%d,%d,%d,%d}" % h for h in hits) + "};")
    else:
        a("static const Hit HITS[1] = {{0}};")
    a("static const Move MOVES[NMOVES] = {" + ",".join(
        "{%d,%d,%d,%d,%d,%d,0,{%s},%s}" % (f0, n, lf, ed, ef, loop, ",".join(str(x) for x in ek), cstr(name, 20))
        for name, f0, n, lf, loop, ed, ef, ek in moves) + "};")

    def bind_c(b):
        return "{%d,%d,%d,0,%d,%d,%d,{%s}}" % (b[0], b[1], b[2], b[3], b[4], b[5], ",".join(str(s) for s in b[6]))
    a(f"#define N_BIND_OTHER {len(others)}")
    a(f"#define N_BIND_CHORDS {len(chords)}")
    a(f"#define N_BIND_SEQS {len(seqs)}")
    a("static const Bind BIND_OTHER[N_BIND_OTHER] = {" + ",".join(bind_c(b) for b in others) + "};")
    a("static const Bind BIND_CHORDS[N_BIND_CHORDS] = {" + ("{0}" if not chords else ",".join(bind_c(b) for b in chords)) + "};")
    a("static const Bind BIND_SEQS[N_BIND_SEQS] = {" + ("{0}" if not seqs else ",".join(bind_c(b) for b in seqs)) + "};")

    a(f"#define NEFRAMES {len(eframes)}")
    a("static const EFrame EFRAMES[NEFRAMES] = {" + ",".join(
        "{%d,%d,%d,%d,%d,%d,%d,%d,%d,%d,%d,%d,0}" % t for t in eframes) + "};")
    a(f"#define NFLAT {len(flat)}")
    a("static const unsigned short EFLAT[NFLAT] = {" + ",".join(str(x) for x in flat) + "};")
    a(f"#define NANIMS {len(anims)}")
    a("static const EAnim EANIMS[NANIMS] = {" + ",".join("{%d,%d,%d,0}" % a_ for a_ in anims) + "};")
    def edef_c(r):
        return ("{%d,%d,%d,%d,%d,%d,%d,%d,{%s},{%s},{%s},%d,%d,%d,%d,%d,%d,%d,"
                "%d,%d,%d,%d,%d,%d,{%s},%d,%d,%d,0,%s}") % (
            r["speed"], r["hp"], r["r0"], r["r1"], r["kd"], r["kms"], r["pd"], r["pms"],
            ",".join(str(x) for x in r["dmg"]), ",".join(str(x) for x in r["kdd"]), ",".join(str(x) for x in r["kmm"]),
            r["dmin"], r["dmax"], r["reach"], r["jd"], r["lo"], r["f0"], r["nf"],
            r["idle"], r["walk"], r["stun"], r["death"], r["dive"], r["combo"],
            ",".join(str(x) for x in r["attack"]), r["natk"], r["boss"], r["prop"], cstr(r["id"], 16))
    a(f"#define NENDEF {len(edefs)}")
    a("static const EDef ENEMIES[NENDEF] = {" + ",".join(edef_c(r) for r in edefs) + "};")

    a(f"#define NPLATS {max(1, len(plats))}")
    a("static const Plat PLATS[NPLATS] = {" + ("{0,0,0}" if not plats else ",".join("{%d,%d,%d}" % t for t in plats)) + "};")
    a(f"#define NPITS {max(1, len(pits))}")
    a("static const Pit PITS[NPITS] = {" + ("{0,0}" if not pits else ",".join("{%d,%d}" % t for t in pits)) + "};")
    a(f"#define NCRATES {max(1, len(crates))}")
    a("static const Crate CRATES[NCRATES] = {" + ("{0,0,0}" if not crates else ",".join("{%d,%d,%d}" % t for t in crates)) + "};")
    a(f"#define NBOMBS {max(1, len(bombs))}")
    a("static const Spot BOMBS[NBOMBS] = {" + ("{0,0}" if not bombs else ",".join("{%d,%d}" % t for t in bombs)) + "};")
    a(f"#define NSPAWNS {len(spawns)}")
    a("static const Spawn SPAWNS[NSPAWNS] = {" + ",".join("{%d,%d,%d,%d,%d,%d}" % t for t in spawns) + "};")
    a(f"#define NLEAVES {len(leaves)}")
    a("static const LeafSpot LEAVES[NLEAVES] = {" + ",".join("{%d,%d,%d}" % t for t in leaves) + "};")
    a(f"#define NMAPS {len(maps)}")
    a("static const MapDef MAPS[NMAPS] = {" + ",".join(
        "{%d,%d,%d,%d,%d,%d,%d,%d,%d,%d,%d,%d,%d,%d,%d,0,%s}" % (*m[:15], cstr(m[15], 8)) for m in maps) + "};")
    a(f"#define NLEVELS {len(levels)}")
    a("static const LevelDef LEVELS[NLEVELS] = {" + ",".join("{%d,%d,%s}" % (a_, b_, cstr(c_, 24)) for a_, b_, c_ in levels) + "};")

    def scene_c(row):
        layers, fringe, fp = row
        slots = []
        for i in range(6):
            if i < len(layers):
                sid, per, mar, par = layers[i]
                slots.append("{%d,%d,%d,%d}" % (sid if sid >= 0 else 0, per, mar, par))
            else:
                slots.append("{0,0,0,0}")
        return "{%d,0,%d,%d,{%s}}" % (len(layers), fringe, fp, ",".join(slots))
    a("static const Scene SCENES[SC_COUNT] = {" + ",".join(scene_c(r) for r in scene_rows) + "};")
    a(f"#define NUNLOCKS {len(ulines)}")
    a("static const UnlockDef UNLOCKS[NUNLOCKS] = {" + ",".join(
        "{%d,%d,%d,0,{%d,%d,%d},%d,%d,%s,%s}" % (lv, shop, mt, m0, m1, m2, bt, price, cstr(i, 16), cstr(nm, 32))
        for i, nm, lv, shop, (m0, m1, m2), bt, mt, price in ulines) + "};")
    a("#define NGEMS " + str(len(gem_ids)))
    a("static const short GEM_SPR[NGEMS] = {" + ",".join(str(i) for i in gem_ids) + "};")
    a("#define SPR_MERCHANT " + str(merchant_id))
    a("#define SPR_BUNNY " + str(bunny_id))
    a("#define SPR_BOAT " + str(boat_id))
    a("#define MAP_TRAINING " + str(map_train))
    a("static const short BEAM_SPR[4] = {" + ",".join(str(i) for i in beam_ids) + "};")
    a("enum { " + ", ".join("ST_" + k.upper() for k, _ in STORY) + ", ST_COUNT };")
    a("static const short STORY_SPR[ST_COUNT] = {" + ",".join(str(i) for i in story_ids) + "};")
    a("#endif")
    with open(HDR, "w") as f:
        f.write("\n".join(out) + "\n")
    print(f"art.bin {size} bytes, {len(pack.blobs)} sprites; moves {len(moves)} frames {len(frames)}; enemies {len(edefs)} frames {len(eframes)}; maps {len(maps)}")


if __name__ == "__main__":
    main()
