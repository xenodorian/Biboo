'use strict';
  // ------------------------------------------------------------------ hits
  function distBox(px, py, b) {          // point to box [x0, y0, x1, y1]
    const dx = Math.max(b[0] - px, 0, px - b[2]), dy = Math.max(b[1] - py, 0, py - b[3]);
    return Math.hypot(dx, dy);
  }
  // effect moves (meteor shower, energy wave) draw Max at SPRITE_SCALE and their effects at fxScale,
  // and their hit shapes follow the effects
  const BURST_SCALE = 1.0;               // energy burst effect scale: twice Max's, so twice the area of effect
  const FX_CENTER = { energy_burst: [32, 37] };   // where the burst ring is centred (native px from the anchor): it grows around this point
  function fxScaleOf(id) { const m = id && D.moves[id]; return m && m.fxScale ? m.fxScale : SPRITE_SCALE; }
  function worldShape(s, h) {
    const sc = fxScaleOf(h.mv && h.mv.id);
    const P = p => [h.px + h.face * p[0] * sc, h.py + p[1] * sc];
    if (s.shape === 'capsule') return { shape: 'capsule', a: P(s.a), b: P(s.b), r: s.radius * sc };
    if (s.shape === 'circle') return { shape: 'circle', c: P(s.c), r: s.r * (h.mv && h.mv.id === 'energy_burst' ? BURST_SCALE : sc) };   // the burst keeps its centre but its radius is doubled
    const a = P(s.a), b = P(s.b);
    return { shape: 'box', box: [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])] };
  }
  function touches(w, box) {
    if (w.shape === 'circle') return distBox(w.c[0], w.c[1], box) <= w.r;
    if (w.shape === 'box') return w.box[0] <= box[2] && box[0] <= w.box[2] && w.box[1] <= box[3] && box[1] <= w.box[3];
    for (let i = 0; i <= 16; i++) {      // capsule: samples along the segment
      const u = i / 16;
      if (distBox(w.a[0] + (w.b[0] - w.a[0]) * u, w.a[1] + (w.b[1] - w.a[1]) * u, box) <= w.r) return true;
    }
    return false;
  }
  function resolveHits() {
    for (const h of hitQ) {
      if (h.mv.id === 'energy_wave' && h.mv.blast && h.mv.blast[h.face]) continue;   // that projectile has burst
      const seen = h.mv.hit || (h.mv.hit = new Map()), gap = REHIT_MS[h.mv.id];
      for (const sh of h.f.hits) {
        const w = worldShape(sh, h);
        for (const e of enemies) {
          const box = hurtOf(e);
          if (!box || !touches(w, box)) continue;
          const last = seen.get(e);
          if (last !== undefined && !(gap && clock - last >= gap)) continue;
          seen.set(e, clock);
          hurtEnemy(e, dmgOf(h.mv));
          if (KNOCK[h.mv.id] && alive(e) && e.type !== 'heavybag') {                        // knocked back and stunned
            const [dist, ms] = KNOCK[h.mv.id];
            // a kick sends it the way she faces; the burst sends it away from her on either side
            const p = push(dist, ms), dir = BOTH_SIDES_PUSH.has(h.mv.id) ? (e.x >= h.px ? 1 : -1) : h.face;
            e.state = 'stunned'; play(e, (EN[e.type].ai.stun || 'idle'));
            e.push = { v: p.v * dir, a: p.a };
          }
          if (h.mv.id === 'energy_wave') {                          // impact: the wave explodes on the spot
            const b = hurtOf(e) || box;
            waveBlast(h.mv, h.face, (b[0] + b[2]) / 2, (b[1] + b[3]) / 2);
          }
        }
        crateHitsFrom(w);                                          // and any crate the shape touches
        bombHitsFrom(w);                                           // and any bomb
      }
      if (h.mv.id === 'heavy' && h.f.name === 'impact' && !h.mv.aoeDone) {   // the chop lands: a small blast where the blade meets the ground
        h.mv.aoeDone = true;
        const w = worldShape(h.f.hits[0], h);
        const cx = w.b[0], cy = Math.max(0, w.b[1]);
        explosions.push({ wx: cx, wy: cy, t0: clock, big: true, r: HEAVY_AOE_R });
        crateBlast(cx, cy, HEAVY_AOE_R);
        for (const o of enemies) {
          if (!alive(o) || seen.has(o)) continue;                   // a direct hit already took 200
          const b = hurtOf(o);
          if (!b || distBox(cx, cy, b) > HEAVY_AOE_R) continue;
          hurtEnemy(o, HEAVY_AOE_DMG);
          if (alive(o)) {
            const [dist, ms] = KNOCK.heavy, p = push(dist, ms);
            o.state = 'stunned'; play(o, (EN[o.type].ai.stun || 'idle'));
            o.push = { v: p.v * h.face, a: p.a };
          }
        }
      }
    }
    lastHits = hitQ.splice(0);
  }
  let lastHits = [];

  // The energy wave does no damage where it touches an enemy: it explodes there (one projectile each side),
  // and the blast hurts every enemy within WAVE_R px of the centre for WAVE_DMG. A projectile that touches
  // nothing explodes at the end of its flight.
  const explosions = [];                // {wx, wy, t0, big, r}
  let flashUntil = 0;
  const BLAST_MS = 650, FLASH_MS = 380, WAVE_R = 75, WAVE_DMG = 50, WAVE_END = 200;
  function waveBlast(mv, side, wx, wy) {
    mv.blast = mv.blast || {};
    if (mv.blast[side]) return;
    mv.blast[side] = true;
    explosions.push({ wx, wy, t0: clock, big: true, r: WAVE_R });
    crateBlast(wx, wy, WAVE_R);
    rumble = { t0: clock, ms: 350, amp: 5 };
    for (const o of enemies) {
      if (!alive(o)) continue;
      const b = hurtOf(o);
      if (b && distBox(wx, wy, b) <= WAVE_R) hurtEnemy(o, Math.round(WAVE_DMG * (mv.power || 1)));
    }
  }
