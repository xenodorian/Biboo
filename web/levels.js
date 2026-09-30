/* Levels for Parry Perry. Data only: no drawing, no game rules (those are in game.js).
 *
 * A level is 10 maps; a map is exactly one screen (MAP_W px wide, the same as the view). The player walks off the right
 * edge to reach the next map and off the left edge to go back. Level 1 is drawn by hand below; Levels 2 to 5 are
 * generated from a fixed seed by genMap(), so they are the same every time.
 *
 * Coordinates: x is px from the left of the screen, heights are px above the ground line (0).
 *   solids   {x0, x1, top}   barriers: block walking below their top; the top can be landed on and stood on.
 *   plats    {x0, x1, top}   platforms: land on them from above, jump up through them from below.
 *   crates   {x, fy, item?}  fy is the surface it sits on. With an item it is a golden crate holding that unlock
 *                            (an id from progress.js); without one it is a plain crate that may drop a gem.
 *   enemies  {type, x, fy, path:[a, b], sight}  walks between a and b, chases only when hit or when the player is
 *                            within `sight` px in front of it (see stepEnemy / patrol in game.js).
 * The player's jump is 164 px high and reaches about 65 px sideways, so barriers stay at or under 64 px and platforms
 * at or under 110 px. Keep the first and last 40 px of the ground free of barriers so the doors stay open.
 */
(function (root) {
  'use strict';
  const MAP_W = 384, MAPS_PER_LEVEL = 10;
  const S = (x0, x1, top) => ({ x0, x1, top });
  const P = (x0, x1, top) => ({ x0, x1, top });
  const C = (x, fy, item) => (item ? { x, fy: fy || 0, item } : { x, fy: fy || 0 });
  const E = (type, x, a, b, sight, fy) => ({ type, x, fy: fy || 0, path: [a, b], sight: sight || 100 });
  const G = (x, a, b, sight, fy) => E('goblin', x, a, b, sight, fy);
  const O = (x, a, b, sight, fy) => E('orc', x, a, b, sight, fy);
  const map = o => Object.assign({ solids: [], plats: [], crates: [], enemies: [] }, o);

  // ------------------------------------------------------------------ Level 1: Green Trail (hand built)
  const L1 = [
    // 1.1 a first jump and one goblin
    map({ plats: [P(150, 214, 44)], crates: [C(110), C(182, 44)], enemies: [G(270, 230, 330, 90)] }),
    // 1.2 a log to jump over; the golden crate is on the far side
    map({ solids: [S(150, 166, 34)], crates: [C(60), C(300, 0, 'thrust')], enemies: [G(260, 200, 330, 100)] }),
    // 1.3 stepping stones up to a golden crate
    map({ plats: [P(90, 150, 50), P(170, 230, 80), P(250, 310, 50)], crates: [C(60), C(200, 80, 'L1'), C(350)],
          enemies: [G(220, 110, 330, 90)] }),
    // 1.4 two logs, a goblin in each gap
    map({ solids: [S(120, 136, 30), S(240, 256, 44)], crates: [C(190, 0, 'upswing'), C(340)],
          enemies: [G(180, 150, 230, 100), G(310, 270, 350, 100)] }),
    // 1.5 a high ledge with a goblin guarding the crate
    map({ plats: [P(60, 140, 60), P(160, 200, 90), P(220, 320, 110)], crates: [C(100, 60), C(270, 110, 'heavy_horizontal')],
          enemies: [G(270, 235, 305, 80, 110), G(300, 130, 340, 100)] }),
    // 1.6 the first orc, behind a barrier
    map({ solids: [S(180, 196, 56)], crates: [C(100), C(140)], enemies: [O(280, 230, 340, 110), G(120, 90, 160, 90)] }),
    // 1.7 a row of platforms and a golden crate at the far end
    map({ plats: [P(40, 110, 40), P(120, 190, 70), P(200, 270, 40)], crates: [C(155, 70), C(320, 0, 'dash_thrust')],
          enemies: [G(150, 100, 300, 100), G(240, 130, 330, 100)] }),
    // 1.8 three barriers of rising height
    map({ solids: [S(100, 116, 40), S(190, 206, 52), S(280, 296, 64)], crates: [C(150), C(240), C(340)],
          enemies: [G(150, 125, 180, 90), O(240, 215, 270, 100), G(335, 305, 350, 90)] }),
    // 1.9 the ridge: an orc below, a goblin above, the spin attack up top
    map({ plats: [P(50, 120, 60), P(140, 210, 90), P(230, 300, 60)], crates: [C(85, 60), C(265, 60, 'spin')],
          enemies: [O(150, 110, 330, 110), G(175, 150, 200, 80, 90)] }),
    // 1.10 gate guard: clear the map to finish the level
    map({ solids: [S(180, 196, 36)], crates: [C(80), C(300)],
          enemies: [O(120, 90, 165, 110), G(150, 100, 170, 100), O(260, 215, 330, 110), G(320, 230, 350, 100)] }),
  ];

  // ------------------------------------------------------------------ Levels 2 to 5: generated
  function rng(seed) {                                    // mulberry32: same seed, same numbers
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function genMap(n, i, item) {
    const r = rng(n * 7919 + i * 104729 + 17);
    const pick = (a, b) => a + Math.floor(r() * (b - a + 1));
    const chance = p => r() < p;
    const final = i === MAPS_PER_LEVEL - 1;
    const m = map({});
    // barriers: distinct slots, 80 px apart, 16 px wide, 30 to 64 px high
    const slots = [96, 176, 256, 336];
    for (let k = slots.length - 1; k > 0; k--) { const j = pick(0, k); [slots[k], slots[j]] = [slots[j], slots[k]]; }
    const nb = final ? 1 : pick(0, 2 + (n > 2 ? 1 : 0));
    for (const c of slots.slice(0, nb).sort((a, b) => a - b)) m.solids.push(S(c - 8, c + 8, pick(15, 32) * 2));
    // platforms: 60 to 100 px wide, 40 to 100 px high, not overlapping each other
    const np = final ? 1 : pick(0, 2);
    for (let k = 0; k < np; k++) {
      for (let tries = 0; tries < 8; tries++) {
        const w = pick(6, 10) * 10, x0 = pick(3, 30) * 10, top = pick(4, 10) * 10;
        if (x0 + w > 350) continue;
        if (m.plats.some(p => x0 < p.x1 + 20 && x0 + w > p.x0 - 20)) continue;
        m.plats.push(P(x0, x0 + w, top));
        break;
      }
    }
    // ground segments between the barriers
    const segs = [];
    let from = 12;
    for (const s of m.solids) { segs.push([from, s.x0 - 4]); from = s.x1 + 4; }
    segs.push([from, MAP_W - 12]);
    const wide = segs.filter(s => s[1] - s[0] >= 90);
    // enemies
    const count = final ? Math.min(6, n + 2) : Math.min(5, 1 + (n >= 2 ? 1 : 0) + (n >= 4 ? 1 : 0) + (i >= 4 ? 1 : 0) + (i >= 7 ? 1 : 0));
    const orcP = Math.min(0.6, 0.12 * (n - 1) + 0.05 * i + (final ? 0.15 : 0));
    const sight = 90 + n * 8;
    for (let k = 0; k < count; k++) {
      const type = chance(orcP) ? 'orc' : 'goblin';
      const tall = m.plats.filter(p => p.x1 - p.x0 >= 60);
      if (tall.length && chance(0.3)) {
        const p = tall[pick(0, tall.length - 1)];
        m.enemies.push(E(type, (p.x0 + p.x1) / 2, p.x0 + 14, p.x1 - 14, sight - 20, p.top));
      } else if (wide.length) {
        const s = wide[pick(0, wide.length - 1)];
        const a0 = Math.max(s[0] + 14, 90), b0 = Math.min(s[1] - 14, 300);
        if (b0 - a0 < 50) { const q = wide[0]; m.enemies.push(E(type, (q[0] + q[1]) / 2, q[0] + 20, q[1] - 20, sight)); continue; }
        const w = Math.min(b0 - a0, pick(6, 14) * 10), a = pick(a0, b0 - w);
        m.enemies.push(E(type, a + w / 2, a, a + w, sight));
      }
    }
    // crates: plain ones on the ground or a platform, and the unlock (if this map holds one) on a platform when there is one
    const free = x => !m.solids.some(s => x > s.x0 - 14 && x < s.x1 + 14);
    for (let k = pick(1, 2); k > 0; k--) {
      if (m.plats.length && chance(0.4)) { const p = m.plats[pick(0, m.plats.length - 1)]; m.crates.push(C(pick(p.x0 + 12, p.x1 - 12), p.top)); }
      else { let x = pick(30, 350); for (let t = 0; t < 8 && !free(x); t++) x = pick(30, 350); if (free(x)) m.crates.push(C(x, 0)); }
    }
    if (item) {
      if (m.plats.length) { const p = m.plats[pick(0, m.plats.length - 1)]; m.crates.push(C(Math.round((p.x0 + p.x1) / 2), p.top, item)); }
      else { let x = pick(60, 330); for (let t = 0; t < 12 && !free(x); t++) x = pick(60, 330); m.crates.push(C(x, 0, item)); }
    }
    m.final = final;
    return m;
  }
  const ITEMS = {                                          // level number -> map index (0 based) -> unlock id
    2: { 1: 'R2', 2: 'L2', 4: 'crash', 5: 'heavy_chop', 7: 'energy_dash', 8: 'taunt' },
    3: { 1: 'R1', 3: 'sky_dash', 6: 'earthquake' },
    4: { 2: 'meteor' },
    5: {},
  };
  const gen = n => Array.from({ length: MAPS_PER_LEVEL }, (_, i) => genMap(n, i, (ITEMS[n] || {})[i]));

  L1[MAPS_PER_LEVEL - 1].final = true;
  const levels = [
    { n: 1, name: 'Green Trail', blurb: 'Goblins in the grass. Learn to jump and to smash crates.', tint: null, maps: L1 },
    { n: 2, name: 'Mossy Ruins', blurb: 'Old walls and ledges. Orcs join the patrols.', tint: { color: '#7a5a1a', alpha: 0.18 }, maps: gen(2) },
    { n: 3, name: 'Dusk Bridge', blurb: 'Night falls. The guards look farther.', tint: { color: '#2a2a80', alpha: 0.25 }, maps: gen(3) },
    { n: 4, name: 'Ember Caves', blurb: 'Hot and crowded.', tint: { color: '#802a10', alpha: 0.22 }, maps: gen(4) },
    { n: 5, name: 'Crimson Keep', blurb: 'The last gate.', tint: { color: '#600020', alpha: 0.28 }, maps: gen(5) },
  ];
  const nameOf = { }; // filled below: unlock id -> 'level.map' where its crate is
  levels.forEach(L => L.maps.forEach((m, i) => m.crates.forEach(c => { if (c.item) nameOf[c.item] = `${L.n}.${i + 1}`; })));
  L1.forEach((m, i) => { m.id = `1.${i + 1}`; });
  levels.slice(1).forEach(L => L.maps.forEach((m, i) => { m.id = `${L.n}.${i + 1}`; }));

  root.BIBOO_LEVELS = { MAP_W, MAPS_PER_LEVEL, levels, whereIs: nameOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.BIBOO_LEVELS;
})(typeof window !== 'undefined' ? window : globalThis);
