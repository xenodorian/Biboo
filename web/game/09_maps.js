'use strict';
  // ------------------------------------------------------------------ levels: maps, barriers, platforms, crates
  // A level is 10 one-screen maps (web/levels.js). loadMap() builds the current one. The camera never scrolls sideways,
  // so world x is screen x. Barriers (solids) block walking and can be stood on; platforms can be stood on and jumped
  // up through. She is always standing on `floorY`; in the air her height above it comes from the jump animation, and
  // physics() lands her on a surface she falls onto or drops her off the edge of one.
  const surfaces = m => m.solids.concat(m.plats);
  const overSurf = (s, sp) => sp[1] >= s.x0 - 3 && sp[0] <= s.x1 + 3;
  function gravitySpan(bx) {
    const f = hf();
    const a = bx + Math.min(f * GRAVITY_FOOT_BACK, f * GRAVITY_FOOT_FRONT);
    const b = bx + Math.max(f * GRAVITY_FOOT_BACK, f * GRAVITY_FOOT_FRONT);
    return [a, b];
  }
  const gravityOverSurf = (s, sp) => sp[1] >= s.x0 && sp[0] <= s.x1;
  function supportBelow(bx, y) {
    let best = 0;
    if (!curMap) return 0;
    const sp = gravitySpan(bx);
    for (const s of surfaces(curMap)) if (gravityOverSurf(s, sp) && s.top <= y + 0.5 && s.top > best) best = s.top;
    return best;
  }
  function supportUnder(bx, y) {
    let best = 0;
    if (!curMap) return 0;
    const sp = gravitySpan(bx);
    for (const s of surfaces(curMap)) if (gravityOverSurf(s, sp) && s.top < y - 1 && s.top > best) best = s.top;
    return best;
  }
  function surfaceAt(m, bx, top) { return surfaces(m).find(s => s.top === top && bx >= s.x0 - 3 && bx <= s.x1 + 3) || null; }
  let lastHint = -1e9;
  function hint(text) { if (clock - lastHint > 2500) { lastHint = clock; banners.push({ title: text, t0: clock, ms: 2200 }); } }

  function startLevel(n, custom) {
    freeze = 0; screenFlash = null; flashes.length = 0;
    story = null; storyAt = null;                    // any story page still open (a test hook starting a level) is dropped
    const def = custom || LV.levels[n - 1];
    if (!def) return;
    level = { n, def, idx: 0, killed: new Set(), broken: new Set(), popped: new Set(), pending: new Map(), ankhGot: new Set(), leafGot: new Set() };
    if (n > 0 && P.state.ankhs < P.ANKH_START) P.state.ankhs = P.ANKH_START;          // every level starts with at least 3 ankhs
    kills = 0; hp = maxHp(); gameOver = false; paused = false; respawnOn = false;
    screen = 'level';
    hideMenu(); ignoreHeldButtons();
    loadMap(0, 'left');
    banners.push({ title: def.training ? def.name : `Level ${n}: ${def.name}`, sub: def.blurb, t0: clock, ms: 3200 });
    if (def.training) { Object.assign(train, { last: 0, total: 0, hits: 0, combo: 0, comboAt: -1e9, t0: clock }); }
    setStartLabel();
    canvas.focus();
  }
  function loadMap(idx, side) {
    level.idx = idx;
    const md = level.def.maps[idx];
    curMap = { idx, id: md.id, def: md, solids: md.solids, plats: md.plats,
               crates: md.crates.map((c, i) => ({ key: idx + ':' + i, x: c.x, fy: c.fy, item: null, loot: c.loot || null, broken: level.broken.has(idx + ':' + i) })),                                 // a golden crate exists only while its unlock is not owned
               pits: (md.pits || []).map(p => ({ x0: p.x0, x1: p.x1 })),
               bombs: (md.bombs || []).map((b, i) => ({ key: idx + ':b' + i, x: b.x, fy: b.fy || 0, gone: level.popped.has(idx + ':b' + i), fuse: 0 })) };
    shots.length = 0; pitFall = null;
    enemies.length = 0; respawns.length = 0; gems.length = 0; explosions.length = 0; floaters.length = 0;
    powerups.length = 0; particles.length = 0; hitQ.length = 0;
    md.enemies.forEach((d, i) => {
      const key = idx + ':' + i;
      const sf = d.fy > 0 ? surfaceAt(curMap, d.x, d.fy) : null;    // an enemy on a platform never leaves it
      let lo = sf ? sf.x0 + 8 : 8, hi = sf ? sf.x1 - 8 : MAP_W - 8;
      const lo0 = lo, hi0 = hi;
      if (!sf) for (const p of curMap.pits) { if (p.x1 <= d.x) lo = Math.max(lo, p.x1 + 2); else if (p.x0 >= d.x) hi = Math.min(hi, p.x0 - 2); }   // a ground enemy stays between the pits
      spawn(d.type, d.x, { fy: d.fy, path: d.path, sight: d.sight, key, lo, hi, lo0, hi0 });
    });
    (md.leaves || []).forEach((l, i) => {                            // Leaves lying on the map: gone for good once picked up (until the level restarts)
      const key = idx + ':l' + i;
      if (!level.leafGot.has(key)) gems.push({ x: l.x, y: l.fy + l.h, fy: l.fy, kind: 'leaf', val: 1, perm: true, key, bob: Math.random() * 6.28, t0: clock });
    });
    x = side === 'left' ? 26 : MAP_W - 26; facing = side === 'left' ? 1 : -1;
    floorY = 0; fall = null; stun = null; slide = null; cur = null; queued = null; hold = null; rumble = null; tint = null; flight = null; rainbow = null; ult = null;
    visFace = facing; invuln = clock + 600; prevFeet = null; lastCx = null; camX = V.anchorX; camY = 0; fadeUntil = clock + FADE_MS;
    if (killsEl) killsEl.textContent = '';
  }
  function exitMap(dir) {                        // true when the map changed (or the level ended)
    if (dir < 0) return false;                   // the left edge is a wall: no backtracking, so a knockback can never carry her to the map before
    if (!doorOpen()) { hint('Defeat every enemy to open the door'); return false; }
    const last = level.def.maps.length - 1;
    if (level.idx < last) { loadMap(level.idx + 1, 'left'); banners.push({ title: `Level ${level.n}.${level.idx + 1}`, t0: clock, ms: 1300 }); return true; }
    levelComplete();
    return true;
  }
  // She is a point on the ground (her anchor, `playerX()`) for standing and for the doors, and a narrow foot (FOOT px
  // each side) for barriers, so turning around never moves her against a wall or off a ledge.
  const FOOT = 9, EDGE = 14;
  function physics() {
    if (!curMap) return;
    let px = playerX();
    // 1. barriers stop her from the side while she is below their top; she is pushed out on the side she came from
    for (const sd of curMap.solids) {
      if (herY() >= sd.top - 2 || px + FOOT <= sd.x0 || px - FOOT >= sd.x1) continue;
      const mid = (sd.x0 + sd.x1) / 2;
      if ((lastCx !== null ? lastCx : px) < mid) x -= (px + FOOT) - sd.x0; else x += sd.x1 - (px - FOOT);
      px = playerX();
    }
    if (curMap.def.boss) {                        // boss arena: closed on the left; the right edge opens when the boss is dead
      if (px < EDGE + 1) x += EDGE + 1 - px;
      if (bossAlive() && px > MAP_W - EDGE - 1) x -= px - (MAP_W - EDGE - 1);
      px = playerX();
    }
    if (curMap.def.arena) {                       // test arena: one closed map, no doors
      if (px > MAP_W - EDGE - 1) x -= px - (MAP_W - EDGE - 1); else if (px < EDGE + 1) x += EDGE + 1 - px;
      px = playerX();
    }
    // 2. the doors: past the right edge is the next map, past the left edge the one before (while stunned she is only kept in)
    if (px >= MAP_W - EDGE) { if (!stun && exitMap(1)) return; x -= px - (MAP_W - EDGE); px = playerX(); }
    else if (px <= EDGE) { if (!stun && exitMap(-1)) return; x += EDGE - px; px = playerX(); }
    // 3. landing: falling (or a jump coming down) through the top of a surface under her
    const feet = herY();
    const flying = !stun && cur && (fall || cur.kind === 'fall' || (cur.kind === 'action' && cur.id === 'jump'));
    if (flying && prevFeet !== null && feet < prevFeet) {
      const sp = gravitySpan(px);
      for (const c of curMap.crates) {
        if (c.broken) continue;
        const bx = crateBox(c);
        if (sp[1] >= bx[0] && sp[0] <= bx[2] && prevFeet > bx[3] - 2 && feet <= bx[3] + 1) breakCrate(c);
      }
      let T = -1;
      for (const sf of surfaces(curMap)) if (sf.top > floorY && gravityOverSurf(sf, gravitySpan(px)) && prevFeet > sf.top && feet <= sf.top && sf.top > T) T = sf.top;
      if (T >= 0) {
        if (cur.kind === 'action') x += rootOf(cur)[0];
        floorY = T; fall = null;
        cur = { id: 'jump', k: LAND_K, t: 0, kind: 'land', face: cur.face };
      }
    }
    // 4. standing on a surface that is no longer under her (walked off the edge): fall to what is below
    if (floorY > 0 && !fall && !stun && (!cur || cur.kind === 'hold' || cur.kind === 'land')) {
      const S = supportBelow(playerX(), floorY);
      if (S < floorY - 0.5) {
        if (cur) x += rootOf(cur)[0];
        fall = { y: floorY - S, v: 0 }; floorY = S;
        cur = { id: 'jump', k: FALL_K, t: 0, kind: 'fall', face: cur ? cur.face : facing };
      }
    }
    prevFeet = herY(); lastCx = playerX();
  }
  const bossAlive = () => enemies.some(e => EN[e.type].ai.boss && e.state !== 'dying' && e.hp > 0);
  function levelComplete() {
    const n = level.n, next = LV.levels[n];
    P.completeLevel(n); syncProgress();
    paused = true; levelDone = true;
    const show = () => {
      UI.open('message', { title: `Level ${n} complete`,
        msg: next ? `Level ${n + 1}: ${next.name} is now open.` : 'You beat the last level. More are coming.',
        items: [{ label: 'Back to the overworld', fn: () => goOverworld(), primary: true, id: 'btn-start' }] });
      setStartLabel();
    };
    if (!next && !P.state.story.ending) playStory('ending', () => { P.state.story.ending = true; show(); });
    else show();
  }
  // After a K.O. the same map can be replayed only by spending an ankh. With none left the whole level starts over (and the ankhs go back to 3).
  function retryMap() {
    if (level.n > 0 && P.state.ankhs < 1) { P.state.ankhs = P.ANKH_START; gameOver = false; paused = false; startLevel(level.n); return; }
    if (level.n > 0) P.addAnkh(-1);
    hp = maxHp(); gameOver = false; paused = false;
    hideMenu(); ignoreHeldButtons();
    loadMap(level.idx, 'left');
    setStartLabel();
    canvas.focus();
  }

  // crates: any of her attacks that touches one smashes it. A golden crate holds an unlock; a plain one may drop a gem.
  const crateBox = c => [c.x - 9, c.fy, c.x + 9, c.fy + 18];
  function burst(wx, wy, n, colors) {
    for (let i = 0; i < n; i++) particles.push({ wx, wy, vx: (Math.random() - 0.5) * 0.22, vy: 0.04 + Math.random() * 0.16, t0: clock, life: 500 + Math.random() * 300, c: colors[i % colors.length] });
  }
  function breakCrate(c) {
    if (c.broken) return;
    c.broken = true; level.broken.add(c.key);
    burst(c.x, c.fy + 9, 9, c.loot ? ['#e8c050', '#c9962a', '#fff2a0'] : ['#8a5a2b', '#6b4420', '#b07a3c']);
    if (c.loot === 'ankh') { spawnGem(c.x, 'ankh', c.fy); floater(c.x, c.fy + 26, 'ANKH', '#ffd24a'); return; }
    if (c.loot && c.loot.startsWith('leaves:')) {                    // a cache: a shower of leaves, the big ones worth 5
      let n = +c.loot.split(':')[1]; const big = Math.floor(n / 5), small = n - big * 5, pieces = [...Array(big).fill(5), ...Array(small).fill(1)];
      pieces.forEach((v, k) => { const side = (k % 2 ? 1 : -1) * (6 + Math.floor(k / 2) * 6); gems.push({ x: c.x + Math.max(-60, Math.min(60, side)), y: c.fy + 14 + (k % 3) * 7, fy: c.fy, kind: 'leaf', val: v, bob: Math.random() * 6.28, t0: clock }); });
      burst(c.x, c.fy + 14, 14, ['#ffd24a', '#fff2a0', '#c9962a']); floater(c.x, c.fy + 26, n + ' LEAVES', '#ffd24a');
    }
    {                                            // every crate drops something useful: a health gem, a meter gem, or a +25 meter upgrade
      const pool = lootPool();
      if (pool.length) spawnGem(c.x, pool[Math.floor(Math.random() * pool.length)], c.fy);
    }
  }
  function crateHitsFrom(w) { if (curMap) for (const c of curMap.crates) if (!c.broken && touches(w, crateBox(c))) breakCrate(c); }
  function crateBlast(wx, wy, r) {
    if (!curMap) return;
    for (const c of curMap.crates) if (!c.broken && distBox(wx, wy, crateBox(c)) <= r) breakCrate(c);
    for (const b of curMap.bombs) if (!b.gone && distBox(wx, wy, bombBox(b)) <= r) detonate(b);
  }

  // the banner shown for a new unlock: the name, then each move it gives with its controller input
  function unlockLines(it) {
    const seen = new Set(), out = [];
    for (const r of moveRows()) {
      if (!it.moves.includes(r.move)) continue;
      const line = `${r.name || r.title}: ${r.pad}${r.note ? ' (' + r.note + ')' : ''}`;
      if (!seen.has(line)) { seen.add(line); out.push(line); }
    }
    return out.length ? out : [it.hint];
  }
  function stepEffects(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const q = particles[i];
      if (clock - q.t0 > q.life) { particles.splice(i, 1); continue; }
      q.wx += q.vx * dt; q.wy += q.vy * dt; q.vy -= 0.0007 * dt;
    }
    for (let i = banners.length - 1; i >= 0; i--) if (clock - banners[i].t0 > banners[i].ms) banners.splice(i, 1);
  }
