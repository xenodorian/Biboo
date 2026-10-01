/* Levels for Parry Perry. Data only: no drawing, no game rules (those are in game.js).
 *
 * A level is 10 maps (level 1 is 9: its last map, 1.9, ends at a locked door); a map is exactly one screen (MAP_W px wide, the same as the view). The player walks off the right
 * edge to reach the next map and off the left edge to go back. Level 1 is drawn by hand below; Levels 2 to 5 are
 * generated from a fixed seed by genMap(), so they are the same every time.
 *
 * Coordinates: x is px from the left of the screen, heights are px above the ground line (0).
 *   solids   {x0, x1, top}   barriers. None are used any more (a block she could stand on let her hit enemies in safety), but the
 *                            engine still supports them.
 *   pits     {x0, x1}        a gap in the ground: her feet on the ground inside it mean instant death. Keep them 50 to 75 px
 *                            wide (a jump with Left or Right held covers about 107 px) and away from the first and last 40 px.
 *   bombs    {x, fy}         sits on the ground or a platform; only she sets it off (touch or damage): 50 damage within 50 px to
 *                            her and to enemies.
 *   plats    {x0, x1, top}   platforms: land on them from above, jump up through them from below.
 *   crates   {x, fy, item?}  fy is the surface it sits on. With an item it is a golden crate holding that unlock
 *                            (an id from progress.js); without one it is a plain crate that may drop a gem.
 *   enemies  {type, x, fy, path:[a, b], sight}  walks between a and b, chases only when hit or when the player is
 *                            within `sight` px in front of it (see stepEnemy / patrol in game.js).
 * The player's jump is about 135 px high and reaches about 107 px sideways, so platforms stay at or under 110 px. Ground enemies
 * stay inside the stretch of ground between pits, so their paths must not cross a pit.
 */
(function (root) {
  'use strict';
  const MAP_W = 384, MAPS_PER_LEVEL = 10;
  const S = (x0, x1, top) => ({ x0, x1, top });
  const P = (x0, x1, top) => ({ x0, x1, top });
  const X = (x0, x1) => ({ x0, x1 });                     // a pit in the ground
  const B = (x, fy) => ({ x, fy: fy || 0 });              // a bomb
  const C = (x, fy, item) => (item ? { x, fy: fy || 0, item } : { x, fy: fy || 0 });
  const E = (type, x, a, b, sight, fy) => ({ type, x, fy: fy || 0, path: [a, b], sight: sight || 100 });
  const G = (x, a, b, sight, fy) => E('goblin', x, a, b, sight, fy);
  const O = (x, a, b, sight, fy) => E('orc', x, a, b, sight, fy);
  const H = (x, a, b, sight, fy) => E('hobgoblin', x, a, b, sight, fy);
  // Enemy ladder, easiest to hardest (by HP and damage, see tools/creatures/build.py and Current_Work.md). Levels 2 to 5 slide up it map by map.
  const LADDER = ['goblin', 'hobgoblin', 'skullraider', 'dusksaur', 'darkknight', 'orc', 'ogre'];
  const map = o => Object.assign({ solids: [], plats: [], pits: [], bombs: [], crates: [], enemies: [] }, o);

  // ------------------------------------------------------------------ Level 1: Green Trail (hand built)
  const L1 = [
    // 1.1 a first jump and one goblin
    map({ plats: [P(150, 214, 44)], crates: [C(110), C(182, 44)], enemies: [G(270, 230, 330, 90)] }),
    // 1.2 the first pit; the golden crate is on the far side
    map({ pits: [X(150, 200)], crates: [C(60), C(300, 0, 'thrust')], enemies: [G(265, 215, 330, 100)] }),
    // 1.3 stepping stones over a chasm up to a golden crate
    map({ pits: [X(120, 300)], plats: [P(90, 150, 50), P(170, 230, 80), P(250, 310, 50)], crates: [C(60), C(200, 80, 'push_kick'), C(350)],
          enemies: [G(280, 255, 305, 80, 50), G(345, 318, 370, 90)] }),
    // 1.4 two pits with a goblin on the island between them
    map({ pits: [X(120, 170), X(240, 290)], crates: [C(190, 0, 'upswing'), C(340)], bombs: [B(90)],
          enemies: [G(205, 182, 228, 100), G(335, 305, 365, 100)] }),
    // 1.5 a high ledge with a goblin guarding the crate
    map({ plats: [P(60, 140, 60), P(160, 200, 90), P(220, 320, 110)], crates: [C(100, 60), C(270, 110, 'heavy_horizontal')], bombs: [B(185)],
          enemies: [G(270, 235, 305, 80, 110), G(300, 215, 340, 100)] }),
    // 1.6 the first orc, across a pit, with a bomb on its patrol
    map({ pits: [X(170, 225)], crates: [C(100), C(140, 0, 'double_jump')], bombs: [B(300)], enemies: [H(285, 245, 345, 110), G(120, 90, 160, 90)] }),
    // 1.7 a row of platforms over a chasm and a golden crate at the far end
    map({ pits: [X(120, 285)], plats: [P(40, 110, 40), P(120, 190, 70), P(200, 270, 40)], crates: [C(155, 70), C(330, 0, 'dash_thrust')],
          enemies: [G(75, 50, 100, 90), G(235, 210, 260, 80, 40)] }),
    // 1.8 two pits, bombs and three enemies
    map({ pits: [X(100, 150), X(205, 260)], crates: [C(178), C(320), C(60)], bombs: [B(178, 0), B(300)],
          enemies: [G(60, 30, 90, 90), G(178, 165, 192, 90), H(320, 275, 355, 100)] }),
    // 1.9 the ridge and the locked door at its right edge: an orc below, a goblin above, the sky dash up top
    map({ pits: [X(140, 215)], plats: [P(50, 120, 60), P(140, 210, 90), P(230, 300, 60)], crates: [C(85, 60), C(265, 60, 'sky_dash')], bombs: [B(300)],
          enemies: [H(270, 230, 345, 110), G(175, 150, 200, 80, 90)] }),
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
  const COUNT = { 2: 9, 3: 9, 4: 9 };                      // levels 2 to 4 end at x.9 (a locked door); level 5 has MAPS_PER_LEVEL maps
  function genMap(n, i, item) {
    const r = rng(n * 7919 + i * 104729 + 17);
    const pick = (a, b) => a + Math.floor(r() * (b - a + 1));
    const chance = p => r() < p;
    const final = i === (COUNT[n] || MAPS_PER_LEVEL) - 1;
    const m = map({});
    // pits: centred on distinct slots 80 px apart, 50 to 70 px wide (none on the first map of a level)
    const slots = [110, 190, 270];
    for (let k = slots.length - 1; k > 0; k--) { const j = pick(0, k); [slots[k], slots[j]] = [slots[j], slots[k]]; }
    const nb = i === 0 ? 0 : final ? 1 : pick(0, n > 2 ? 2 : 1);
    for (const c of slots.slice(0, nb).sort((a, b) => a - b)) { const w = Math.max(50, pick(4, 7) * 10); m.pits.push(X(c - w / 2, c + w / 2)); }
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
    // ground segments between the pits
    const segs = [];
    let from = 12;
    for (const s of m.pits) { segs.push([from, s.x0 - 4]); from = s.x1 + 4; }
    segs.push([from, MAP_W - 12]);
    const wide = segs.filter(s => Math.min(s[1] - 14, 300) - Math.max(s[0] + 14, 90) >= 40);
    // enemies
    const count = final ? Math.min(6, n + 2) : Math.min(5, 1 + (n >= 2 ? 1 : 0) + (n >= 4 ? 1 : 0) + (i >= 4 ? 1 : 0) + (i >= 7 ? 1 : 0));
    const prog = Math.min(1, (((n - 2) * 9 + i + 2) / 33) + (final ? 0.05 : 0));       // 0 at map 2.1 up to 1 at the end of level 5; picks the rung of LADDER
    const sight = 90 + n * 8;
    for (let k = 0; k < count; k++) {
      const type = LADDER[Math.max(0, Math.min(LADDER.length - 1, Math.round(prog * (LADDER.length - 1) - 0.4 + (r() - 0.5) * 2.2)))];
      const tall = m.plats.filter(p => p.x1 - p.x0 >= 60);
      if (tall.length && chance(0.3)) {
        const p = tall[pick(0, tall.length - 1)];
        m.enemies.push(E(type, (p.x0 + p.x1) / 2, p.x0 + 14, p.x1 - 14, sight - 20, p.top));
      } else if (wide.length) {
        const s = wide[pick(0, wide.length - 1)];
        const a0 = Math.max(s[0] + 14, 90), b0 = Math.min(s[1] - 14, 300);
        const w = Math.min(b0 - a0, pick(6, 14) * 10), a = pick(a0, b0 - w);
        m.enemies.push(E(type, a + w / 2, a, a + w, sight));
      }
    }
    // crates: plain ones on the ground or a platform, and the unlock (if this map holds one) on a platform when there is one
    const free = x => !m.pits.some(s => x > s.x0 - 14 && x < s.x1 + 14);
    for (let k = pick(1, 2); k > 0; k--) {
      if (m.plats.length && chance(0.4)) { const p = m.plats[pick(0, m.plats.length - 1)]; m.crates.push(C(pick(p.x0 + 12, p.x1 - 12), p.top)); }
      else { let x = pick(30, 350); for (let t = 0; t < 8 && !free(x); t++) x = pick(30, 350); if (free(x)) m.crates.push(C(x, 0)); }
    }
    if (item) {
      if (m.plats.length) { const p = m.plats[pick(0, m.plats.length - 1)]; m.crates.push(C(Math.round((p.x0 + p.x1) / 2), p.top, item)); }
      else { let x = pick(60, 330); for (let t = 0; t < 12 && !free(x); t++) x = pick(60, 330); m.crates.push(C(x, 0, item)); }
      const g = m.crates[m.crates.length - 1];                     // no plain crate may sit on top of the golden one
      m.crates = m.crates.filter(c => c === g || c.fy !== g.fy || Math.abs(c.x - g.x) >= 20);
    }
    m.crates = m.crates.filter((c, i) => c.item || !m.crates.some((o, j) => j !== i && o.fy === c.fy && Math.abs(o.x - c.x) < 18 && (o.item || j < i)));   // no two crates stacked on one spot
    // bombs on open ground, away from pits and crates
    const nbomb = final ? 1 : pick(0, 1) + (n >= 3 ? 1 : 0);
    for (let k = 0; k < nbomb; k++) {
      for (let t = 0; t < 12; t++) {
        const x = pick(90, 300);
        if (!free(x) || m.crates.some(c => c.fy === 0 && Math.abs(c.x - x) < 26) || m.bombs.some(b => Math.abs(b.x - x) < 40)) continue;
        m.bombs.push(B(x, 0));
        break;
      }
    }
    m.final = final;
    return m;
  }
  const ITEMS = {                                          // level number -> map index (0 based) -> unlock id
    // level 2 (maps 2.1 to 2.8), then the locked door at the end of 2.9
    2: { 0: 'recover', 1: 'taunt', 2: 'empower_beam', 3: 'energy_kick', 4: 'energy_dash', 5: 'energy_burst', 6: 'energy_wave', 7: 'cloud_beam' },
    3: { 0: 'heavy_chop', 2: 'crash', 4: 'fire_beam', 6: 'laser_beam' },   // 3.8 holds the key drop, 3.9 the locked door
    4: { 0: 'meter_charge', 3: 'earthquake', 6: 'meteor' },   // 4.9 has the locked door
    5: {},
  };
  const gen = n => Array.from({ length: COUNT[n] || MAPS_PER_LEVEL }, (_, i) => genMap(n, i, (ITEMS[n] || {})[i]));

  L1[L1.length - 1].final = true;              // level 1 ends at map 1.9, behind the locked door
  const levels = [
    { n: 1, name: 'Green Trail', blurb: 'Goblins in the grass. Find every move to open the door at the end.', tint: null, door: 'key', maps: L1 },
    { n: 2, name: 'Mossy Ruins', blurb: 'Old walls and ledges. Hobgoblins and raiders join the patrols.', tint: { color: '#7a5a1a', alpha: 0.18 }, door: 'key', maps: gen(2) },
    { n: 3, name: 'Dusk Bridge', blurb: 'Night falls. The guards look farther.', tint: { color: '#2a2a80', alpha: 0.25 }, door: 'key', maps: gen(3) },
    { n: 4, name: 'Ember Caves', blurb: 'Hot and crowded.', tint: { color: '#802a10', alpha: 0.22 }, door: 'key', maps: gen(4) },
    { n: 5, name: 'Crimson Keep', blurb: 'The last gate.', tint: { color: '#600020', alpha: 0.28 }, maps: gen(5) },
  ];
  const nameOf = { }; // filled below: unlock id -> 'level.map' where its crate is
  levels.forEach(L => L.maps.forEach((m, i) => m.crates.forEach(c => { if (c.item) nameOf[c.item] = `${L.n}.${i + 1}`; })));
  L1.forEach((m, i) => { m.id = `1.${i + 1}`; });
  levels.slice(1).forEach(L => L.maps.forEach((m, i) => { m.id = `${L.n}.${i + 1}`; }));

  root.BIBOO_LEVELS = { MAP_W, MAPS_PER_LEVEL, levels, whereIs: nameOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.BIBOO_LEVELS;
})(typeof window !== 'undefined' ? window : globalThis);
