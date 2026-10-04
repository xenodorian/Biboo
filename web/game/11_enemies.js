'use strict';
  // ------------------------------------------------------------------ enemies
  // e: {type, x: world x of its ground point, base: world x its frames are drawn from, face (-1 left,
  //     1 right), anim, k, t, state, rest, dead, dive: may dive roll on this approach}
  // Rolls and leaps move the art inside its frames; each frame's ground offset keeps e.x on the
  // body, so the enemy stays where an animation leaves it when the next one starts.
  const enemies = [];
  const respawns = [];                  // {type, at}
  let kills = 0, respawnOn = true;
  const TAUNT_TINT = { color: '#e22', alpha: 0.55, until: Infinity };     // taunted enemies stay red
  const BODY = 32;                      // her body centre, px ahead of her anchor
  const LEGS = 19;                      // the point between her legs, px ahead of her anchor (measured from the sprite: feet at -1..8 and 27..38): she turns about this point
  // An enemy walks in until it is APPROACH x its reach from her body centre. Her plow guard holds the blade
  // out in front of her body, but only her body (herBox) is hit, so the enemy has to close in far enough
  // that its swing overlaps the body on the first hitting frames, not just the last ones (0.65 left the
  // orc 3 px inside and the goblin's first slash frames out of reach).
  const APPROACH = 0.5;
  // Enemy reach: how far ahead of its ground point the longest attack hurtbox (the damaging box) of an enemy's attack animations
  // extends, measured from where it stands when the attack starts (goblin slash 63.5, orc 39). An enemy starts attacking once the
  // gap from its ground point to her hitbox is under that reach (by 1 px), and until then walks on until its hitbox touches hers.
  const ENEMY_REACH = {};
  for (const t of Object.keys(EN)) {
    let r = 0;
    for (const a of EN[t].ai.attacks) {
      const fr = EN[t].anims[a].frames, g0 = EN[t].frames[fr[0]].ground || 0;
      for (const k of fr) { const h = EN[t].frames[k].hit; if (h) r = Math.max(r, g0 - h[0] * SPRITE_SCALE); }
    }
    ENEMY_REACH[t] = r;
  }
  const SIGHT_MUL = 2;                  // every enemy sees twice as far as its level data says (and spots her up to twice as far above or below)
  const DIE_MS = 900;                   // death: animation or flicker, then fade

  // Enemies only ever look at two things of hers: her hurtbox (herBox, where she takes damage) and the hit shapes of her own attacks.
  // Where she is, for sight, chasing, facing and hopping, is the middle of that hurtbox: no other body point or collision box counts.
  const herMidX = () => { const b = herBox(); return (b[0] + b[2]) / 2; };
  function playerX() {
    if (!cur || fall || cur.kind === 'fall' || cur.kind === 'land') return x;
    return x + rootOf(cur)[0];
  }
  // o (level enemies): fy surface height it stands on, path [a, b] it patrols, sight px, key for the level's killed list,
  // lo and hi the x range it may not leave. With no path it walks straight at her (the old arena behaviour, used by tests).
  function spawn(type, wx, o) {
    o = o || {};
    const hp0 = hpOverride || ENEMY_HP[type] || (EN[type] && EN[type].ai.hp) || 60;
    const e = { type, hp: hp0, maxHp: hp0, x: wx, base: wx, face: -1, anim: 'walk', k: 0, t: 0, state: 'walk', rest: 0, dead: 0, dive: Math.random() < 0.5, scale: 1,   // scale 1 = the normal (already scaled down) size; only the Empowerment Beam makes one larger
                fy: o.fy || 0, lo: o.lo != null ? o.lo : 8, hi: o.hi != null ? o.hi : MAP_W - 8, lo0: o.lo0 != null ? o.lo0 : 8, hi0: o.hi0 != null ? o.hi0 : MAP_W - 8, shotK: 0, key: o.key || null,
                path: o.path || null, sight: (o.sight || 100) * SIGHT_MUL, pause: 0, far: 0, prevX: wx, dir: 1, comboReady: true, meleeSeen: false };
    enemies.push(e);
    if (EN[type] && EN[type].ai.prop) { e.anim = 'idle'; e.state = 'idle'; e.face = -1; return e; }          // a training prop (the heavy bag): no walking, no attacks
    if (e.path) {                                    // patrol: walk between the two ends until hit or until she comes into view
      e.state = 'patrol';
      e.dir = wx <= (e.path[0] + e.path[1]) / 2 ? 1 : -1;
      e.face = e.dir;
      play(e, 'walk');
    }
    return e;
  }
  function frameOf(e) { const T = EN[e.type]; return T.frames[T.anims[e.anim].frames[e.k]]; }
  function groundOff(e) { const gx = frameOf(e).ground || 0; return e.face < 0 ? gx : -gx; }
  function play(e, anim) { e.anim = anim; e.k = 0; e.t = 0; e.hitDone = false; e.landAt = 0; e.shotK = 0; e.base = e.x - groundOff(e); }
  function turn(e, face) { if (face !== e.face) { e.face = face; e.base = e.x - groundOff(e); } }
  function alive(e) { return e.state !== 'dying'; }

  // hurtbox in world coordinates (y up from the ground)
  function hurtOf(e) {
    const h = frameOf(e).hurt;
    if (!h || !alive(e)) return null;
    const s = SPRITE_SCALE * (e.scale || 1), fy = e.fy || 0;
    return e.face < 0
      ? [e.base + h[0] * s, h[1] * s + fy + (e.jy || 0), e.base + h[2] * s, h[3] * s + fy + (e.jy || 0)]
      : [e.base - h[2] * s, h[1] * s + fy + (e.jy || 0), e.base - h[0] * s, h[3] * s + fy + (e.jy || 0)];
  }

  const isBoss = e => !!(EN[e.type] && EN[e.type].ai.boss);
  function kill(e, quiet) {
    // Drops: a taunted enemy 2 empower gems, one hit by the Empowerment Beam 2 energy gems. Every kill also rolls
    // GEM_CHANCE for a health gem (+25 percent health) and, separately, GEM_CHANCE for one energy or empower gem of a
    // meter the player has unlocked (nothing if none). All of them go to the gem bag when walked over.
    const fy = e.fy || 0;
    if (!quiet) {
    if (e.dropEnergy) { lootGem(e.x - 6, 'energy', fy); lootGem(e.x + 6, 'energy', fy); }
    if (e.dropEmpower) { lootGem(e.x - 6, 'empower', fy); lootGem(e.x + 6, 'empower', fy); }
    if (Math.random() < GEM_CHANCE) lootGem(e.x - 3, 'health', fy);
    if (Math.random() < MAXHP_CHANCE && P.maxOf('hp') < P.MAX_CAP) spawnGem(e.x - 9, 'up_hp', fy);
    const pool = [];
    if (P.meterOn('energy')) pool.push('energy');
    if (P.meterOn('empower')) pool.push('empower');
    if (P.meterOn('super')) pool.push('super');
    if (pool.length && Math.random() < GEM_CHANCE) lootGem(e.x + 3, pool[Math.floor(Math.random() * pool.length)], fy);
    }
    if (level && e.key) level.killed.add(e.key);
    e.state = 'dying'; e.dead = 0; e.hp = 0;
    const death = EN[e.type].ai.death;
    if (death) play(e, death);
    if (e.type === 'mirrormax' && !P.state.story.double) storyAt = clock + 2600;
    if (EN[e.type].ai.boss) {
      banners.push({ title: 'Boss defeated', sub: 'The way on is open', t0: clock, ms: 2600 });
      const kinds = ['health', 'health', 'health'];                      // a bunch of random gems of the kinds the player can use, and ankhs
      if (P.meterOn('energy')) kinds.push('energy', 'energy');
      if (P.meterOn('empower')) kinds.push('empower', 'empower');
      if (P.meterOn('super')) kinds.push('super');
      for (let k = 0; k < 9; k++) spawnGem(e.x - 56 + k * 14, kinds[Math.floor(Math.random() * kinds.length)], fy);
      for (let k = 0; k < 3; k++) spawnGem(e.x - 20 + k * 20, 'ankh', fy);
      if (P.maxOf('hp') < P.MAX_CAP) spawnGem(e.x + 62, 'up_hp', fy);
    }
    kills++;
    respawns.push({ type: e.type, at: clock + 2 * (DIE_MS + 4200), side: Math.random() < 0.5 ? -1 : 1 });
  }

  // Patrolling enemies (level enemies) walk between the ends of their path at half speed and pause at each end.
  // They chase only after being hit (or taunted), or when she is in front of them within `sight` px on about the same
  // level with no tall barrier between. A chasing enemy that loses her (far away, or on another level) for 3.5 s goes
  // back to its patrol.
  const PATROL_SPEED = 0.5;
  const espeed = (e, ai) => ai.speed * (ai.boss && e.hp < e.maxHp / 2 ? 1.45 : 1);     // a boss below half HP is enraged: faster
  function sees(e) {
    if (!curMap) return false;
    const bxp = herMidX(), dx = bxp - e.x;
    if (dx * e.face <= 0 || Math.abs(dx) > e.sight) return false;      // only in front of it, and only within sight
    if (Math.abs(herY() - e.fy) > 60 * SIGHT_MUL) return false;        // she is too far above or below
    for (const s of curMap.solids)                                     // a barrier taller than its eyes and than her blocks the view
      if (s.x1 > Math.min(e.x, bxp) && s.x0 < Math.max(e.x, bxp) && s.top > e.fy + 36 && s.top > herY() + 20) return false;
    return true;
  }
  function aggro(e, noticed) {
    if (e.state !== 'patrol') return;
    e.state = 'idle'; e.rest = noticed ? 250 : 0; e.far = 0; e.comboReady = true; e.meleeSeen = false; play(e, 'idle');
    if (noticed) { const b = hurtOf(e); floater(e.x, (b ? b[3] : e.fy + 40) + 8, '!', '#ffd24a'); }
  }
  function patrol(e, dt) {
    const ai = EN[e.type].ai;
    if (sees(e)) { aggro(e, true); return; }
    if (e.pause > 0) {
      e.pause -= dt;
      if (e.anim !== 'idle') play(e, 'idle');
      if (e.pause <= 0) e.dir = -e.dir;
      return;
    }
    const target = e.dir > 0 ? e.path[1] : e.path[0], dist = target - e.x;
    turn(e, dist >= 0 ? 1 : -1);
    if (e.anim !== 'walk') play(e, 'walk');
    const step = espeed(e, ai) * PATROL_SPEED * dt / 1000;
    if (Math.abs(dist) <= step) { e.x += dist; e.base += dist; e.pause = 700 + Math.random() * 900; play(e, 'idle'); }
    else { const mv = Math.sign(dist) * step; e.x += mv; e.base += mv; }
  }
  // keep an enemy inside its range and out of barriers taller than the surface it stands on
  // The goblin climbs: it jumps up onto a platform up to HOP_UP px above it, drops off a platform edge toward her, and hops a gap
  // between two platforms of the same height. planHop picks the launch point and the landing (null when there is nothing to do).
  const HOP_UP = 70, HOP_X = 130;           // every enemy climbs, drops and hops like this once it has noticed her
  function planHop(e) {
    const fy = e.fy || 0, her = floorY, bx = herMidX(), surf = surfaces(curMap);
    const inPit = x => curMap.pits.some(p => x > p.x0 - 2 && x < p.x1 + 2);
    if (her > fy + 1) {                                                   // she is higher: jump up
      let best = null;
      const mine = fy > 0 ? surfaceAt(curMap, e.x, fy) : null;
      for (const sf of surf) {
        if (sf.top <= fy + 1 || sf.top > fy + HOP_UP || sf.top > her + 0.5) continue;
        const dx = e.x < sf.x0 ? sf.x0 - e.x : e.x > sf.x1 ? e.x - sf.x1 : 0;
        if (dx > HOP_X) continue;
        const launch = dx === 0 ? e.x : (e.x < sf.x0 ? sf.x0 - 6 : sf.x1 + 6);
        if (fy === 0 && inPit(launch)) continue;
        if (fy > 0 && (!mine || launch < mine.x0 + 6 || launch > mine.x1 - 6)) continue;
        const land = dx === 0 ? Math.max(sf.x0 + 10, Math.min(sf.x1 - 10, e.x)) : (e.x < sf.x0 ? sf.x0 + 12 : sf.x1 - 12);
        const cost = dx + (her - sf.top) * 0.6 + Math.abs((sf.x0 + sf.x1) / 2 - bx) * 0.2;
        if (!best || cost < best.cost) best = { cost, launch, land, fy1: sf.top, kind: 'up' };
      }
      return best;
    }
    if (her < fy - 1) {                                                   // she is lower: walk to the edge on her side and drop
      const sf = surfaceAt(curMap, e.x, fy);
      if (!sf) return null;
      const d0 = bx >= e.x ? 1 : -1;
      for (const d of [d0, -d0]) {
        const land = d > 0 ? sf.x1 + 14 : sf.x0 - 14;
        let fy1 = 0;
        for (const o of surf) if (o.top < fy - 1 && land >= o.x0 - 3 && land <= o.x1 + 3 && o.top > fy1) fy1 = o.top;
        if (land < 8 || land > MAP_W - 8 || (fy1 === 0 && inPit(land))) continue;
        return { launch: d > 0 ? sf.x1 - 8 : sf.x0 + 8, land, fy1, kind: 'drop' };
      }
      return null;
    }
    if (fy > 0) {                                                         // same height, another platform: hop the gap
      const a = surfaceAt(curMap, e.x, fy), b = surfaceAt(curMap, bx, her);
      if (a && b && a !== b) {
        const d = bx >= e.x ? 1 : -1, gapw = d > 0 ? b.x0 - a.x1 : a.x0 - b.x1;
        if (gapw <= HOP_X) return { kind: 'gap', launch: d > 0 ? a.x1 - 8 : a.x0 + 8, land: d > 0 ? b.x0 + 12 : b.x1 - 12, fy1: fy };
      }
    }
    return null;
  }
  // They try any gap up to ENEMY_JUMP_MAX wide, but the orc's jump only carries ENEMY_JUMP_DIST px (70), so wherever that falls short of
  // the far edge it lands in the pit and is lost (a goblin always makes the 140 it attempts).
  const ENEMY_JUMP_H = 22 * WORLD_Y_SCALE, ENEMY_JUMP_MAX = 140, ENEMY_JUMP_DIST = { goblin: 200, orc: 70, hobgoblin: 130, skullraider: 150, dusksaur: 110, darkknight: 90, ogre: 60, clubogre: 60 }, ENEMY_LAND_OFF = { goblin: 10, orc: 4 };     // arc height, widest gap an enemy will leap
  function setRange(e) {                          // the stretch of surface that holds the enemy where it stands: a platform, or the ground between pits
    if ((e.fy || 0) > 0) {
      const sf = surfaceAt(curMap, e.x, e.fy);
      if (sf) { e.lo = e.lo0 = sf.x0 + 8; e.hi = e.hi0 = sf.x1 - 8; return; }
    }
    let lo = 8, hi = MAP_W - 8;
    for (const p of curMap.pits) { if (p.x1 <= e.x) lo = Math.max(lo, p.x1 + 2); else if (p.x0 >= e.x) hi = Math.min(hi, p.x0 - 2); }
    e.lo = lo; e.hi = hi; e.lo0 = 8; e.hi0 = MAP_W - 8;
  }
  function clampEnemy(e, free) {                 // free: it was pushed, so only the walls of the map hold it (pits can take it)
    let nx = Math.max(free ? e.lo0 : e.lo, Math.min(free ? e.hi0 : e.hi, e.x));
    if (curMap) for (const s of curMap.solids) {
      if (s.top <= e.fy + 1) continue;
      const pad = 10;
      if (nx > s.x0 - pad && nx < s.x1 + pad) nx = e.prevX <= (s.x0 + s.x1) / 2 ? s.x0 - pad : s.x1 + pad;
    }
    if (nx !== e.x) { e.base += nx - e.x; e.x = nx; }
    e.prevX = e.x;
  }
  function stepEnemy(e, dt) {
    if (e.type === 'heavybag') { stepBag(e, dt); return; }
    stepEnemyCore(e, dt);
    if (e.anim === 'combo' && e.state === 'attack') {        // the backflip's streaks of light also leave as homing shards
      while (e.shotK < e.k) { e.shotK++; const n = COMBO_SHOT_AT.indexOf(e.shotK); if (n >= 0) fireComboShard(e, n); }
    }
    // the goblin's roll (its 'dive' animation) is a melee attack: its low hit box on frames 19 and 20 does the damage, and it throws nothing
    if (e.state === 'dying') return;
    let free = false;
    if (e.jump) return;
    if ((e.fy || 0) === 0 && curMap && curMap.pits.length) {
      free = e.state === 'stunned' || clock - (e.shoved || 0) < 150;
      if (free && curMap.pits.some(p => e.x > p.x0 + 6 && e.x < p.x1 - 6)) { plunge(e); return; }
    }
    clampEnemy(e, free);
  }
  // The attacks whose damage box would touch her hurtbox on one of its hitting frames, from where the enemy stands now.
  function strikeAttacks(e, me) {
    const T = EN[e.type], out = [];
    for (const a of T.ai.attacks) {
      if (a === 'combo') continue;
      const fr = T.anims[a].frames, g0 = T.frames[fr[0]].ground || 0;
      const probe = { face: e.face, scale: e.scale, fy: e.fy, jy: e.jy, base: e.x - (e.face < 0 ? g0 : -g0) };
      if (fr.some(k => { const h = boxOf(probe, T.frames[k].hit); return h && overlap(h, me); })) out.push(a);
    }
    return out;
  }
  function stepEnemyCore(e, dt) {
    const T = EN[e.type], ai = T.ai;
    let A = T.anims[e.anim], ended = false;
    dt *= (e.speedMul || 1);            // taunted: everything it does, walking, swinging and resting, runs 2x as fast
    if (e.taunted && (!e.tint || clock >= e.tint.until)) e.tint = TAUNT_TINT;   // back to red after a flash
    if (e.state === 'attack' && e.landAt && !e.hitDone && clock < e.landAt) {          // it touched her: hold the striking pose until the hit lands (or she parries), so the damage always lands on a frame that is touching her
      const sf = T.frames[A.frames[e.k]];
      // a frame flagged `pause` (the Club Ogre's club-down frame) IS the parry window: its own 200 ms run while the hit is pending, so the pose lasts 200 ms, not 200 plus its time again
      dt = sf.pause ? Math.max(0, Math.min(dt, sf.ms - 1 - e.t)) : 0;
    }
    e.t += dt;
    while (e.t >= T.frames[A.frames[e.k]].ms) {
      e.t -= T.frames[A.frames[e.k]].ms;
      if (e.k + 1 < A.frames.length) e.k++;
      else if (A.loop) e.k = 0;
      else { ended = true; e.t = 0; break; }
    }
    e.x = e.base + groundOff(e);
    if (e.state === 'dying') { e.dead += dt; return; }
    if (e.jump) {                       // leaping a pit: a straight run over the gap with a 22 px arc
      if (e.state === 'stunned') { e.jump = null; e.jy = 0; }
      else {
        const j = e.jump; j.t += dt;
        const u = Math.min(1, j.t / j.dur), nx = j.x0 + (j.x1 - j.x0) * u, dy = j.fy1 - j.fy0;
        e.base += nx - e.x; e.x = nx;
        e.jy = j.fall ? dy * u * u : dy * u + 4 * j.H * u * (1 - u);          // a jump arcs, a drop falls
        if (u >= 1) {
          e.jump = null; e.jy = 0; e.fy = j.fy1; setRange(e); e.prevX = e.x;
          if (j.doom) { plunge(e); return; }                                       // it came down in the pit
          if (e.path && j.fy1 !== j.fy0) e.path = [e.lo + 6, Math.max(e.lo + 6, e.hi - 6)];   // a patrol resumes on the surface it landed on
        }
        return;
      }
    }
    if (e.state === 'stunned') {        // slides back, then stays down until stunUntil if this hit asked for a longer stun
      if (e.push && e.push.v) {
        e.x += e.push.v * dt; e.base += e.push.v * dt;
        const v = e.push.v - Math.sign(e.push.v) * e.push.a * dt;
        if (Math.sign(v) === Math.sign(e.push.v) && v !== 0) { e.push.v = v; return; }
        e.push.v = 0;
      }
      if (e.stunUntil && clock < e.stunUntil) return;
      e.stunUntil = 0; e.tilt = 0;
      e.state = 'idle'; e.rest = ai.rest[0]; play(e, 'idle');
      return;
    }
    if (e.state === 'patrol') { patrol(e, dt); return; }
    const d = herMidX() - e.x, dist = Math.abs(d);
    if (e.path && (e.state === 'idle' || e.state === 'walk')) {       // chasing: give up when she is gone for a while
      e.far = dist > e.sight * 2.5 || Math.abs(herY() - e.fy) > 110 * WORLD_Y_SCALE * SIGHT_MUL ? e.far + dt : 0;
      if (e.far > 3500) { e.state = 'patrol'; e.far = 0; e.pause = 0; e.dir = e.x < (e.path[0] + e.path[1]) / 2 ? 1 : -1; play(e, 'walk'); return; }
    }
    // wait behind another enemy that is already closer to her
    const blocked = enemies.some(o => o !== e && alive(o) && Math.sign(o.x - e.x) === Math.sign(d)
                                      && Math.abs(o.x - e.x) < 40);
    if (e.state === 'attack') {
      if (!ended) return;
      e.state = 'idle'; e.rest = ai.rest[0] + Math.random() * (ai.rest[1] - ai.rest[0]); play(e, 'idle');
      e.dive = Math.random() < 0.5;
      return;
    }
    turn(e, d < 0 ? -1 : 1);
    if (e.state === 'idle') {
      e.rest -= dt;
      if (e.rest > 0) return;
      e.state = 'walk';
    }
    const goblinLike = EN[e.type].ai.attacks.includes('combo');
    const sameLevel = Math.abs(floorY - (e.fy || 0)) <= 1;
    const me = herBox(), edge = d < 0 ? me[2] : me[0];              // the near edge of her hitbox
    const gap = d < 0 ? e.x - edge : edge - e.x;                     // from its ground point to her hitbox
    const lo = Math.min(e.x, edge), hi = Math.max(e.x, edge);
    const pitBetween = (e.fy || 0) === 0 && curMap && curMap.pits.some(q => q.x1 > lo && q.x0 < hi);
    const reach = ENEMY_REACH[e.type] * (e.scale || 1);
    if (goblinLike) {
      // Goblin pattern: a combo the moment it detects her, then only forward and melee. Another combo only if she leaves melee
      // range after melee range was reached; each combo resets it to forward and melee only.
      if (e.comboReady || (e.meleeSeen && sameLevel && gap > reach + 2)) {
        e.comboReady = false; e.meleeSeen = false; e.state = 'attack'; play(e, 'combo');
        return;
      }
    }
    // An attack goes out as soon as the damage box of one of its attacks would reach her hurtbox from where the enemy stands.
    const strike = strikeAttacks(e, me);
    if (strike.length) {
      e.state = 'attack'; e.meleeSeen = true;
      play(e, strike[Math.floor(Math.random() * strike.length)]);
      return;
    }
    // Every enemy that has noticed her climbs up onto a platform she is on, drops off the edge of its own toward her,
    // and hops the gap between two platforms of the same height.
    if (curMap && (!sameLevel || (e.fy || 0) > 0)) {
      const plan = planHop(e);
      if (plan) {
        const dir = plan.launch >= e.x ? 1 : -1;
        const at = Math.abs(e.x - plan.launch) <= 3 || (dir > 0 && e.x >= e.hi - 1 && plan.launch >= e.hi - 1) || (dir < 0 && e.x <= e.lo + 1 && plan.launch <= e.lo + 1);
        if (at) {
          const dy = plan.fy1 - (e.fy || 0), fall = plan.kind === 'drop';
          e.jump = { x0: e.x, x1: plan.land, fy0: e.fy || 0, fy1: plan.fy1, fall, H: plan.kind === 'up' ? 16 * WORLD_Y_SCALE : ENEMY_JUMP_H,
                     t: 0, dur: fall ? Math.sqrt(2 * Math.abs(dy) / (0.0018 * WORLD_Y_SCALE)) + 80 : 420 + Math.abs(plan.land - e.x) * 3 + Math.max(0, dy) * 2 };
          return;
        }
        turn(e, dir); if (e.anim !== 'walk') play(e, 'walk');
        const mv = dir * Math.min(espeed(e, ai) * dt / 1000, Math.abs(plan.launch - e.x));
        e.x += mv; e.base += mv;
        return;
      }
    }
    if (ai.dive && e.dive && !blocked && sameLevel && dist >= ai.dive.min && dist <= ai.dive.max) {
      e.state = 'attack'; e.dive = false;
      play(e, ai.dive.anim);
    } else if (blocked) {
      if (e.anim !== 'idle') play(e, 'idle');
    } else {
      if (e.anim !== 'walk') play(e, 'walk');
      if ((e.fy || 0) === 0 && curMap && curMap.pits.length) {       // a pit between it and her: jump it when it reaches the edge
        if (e.hopAt == null) e.hopAt = 3 + Math.random() * 10;                 // how close to the edge it takes off (rerolled after each jump)
        const q = curMap.pits.find(p => e.face > 0 ? (p.x0 - e.x >= -2 && p.x0 - e.x < e.hopAt && herMidX() > p.x1)
                                                    : (e.x - p.x1 >= -2 && e.x - p.x1 < e.hopAt && herMidX() < p.x0));
        if (q && q.x1 - q.x0 <= ENEMY_JUMP_MAX && Math.abs(herY() - e.fy) < 40 * WORLD_Y_SCALE) {
          const off = ENEMY_LAND_OFF[e.type] || 10, want = e.face > 0 ? q.x1 + off : q.x0 - off;     // where it means to land
          if (!curMap.pits.some(o => want > o.x0 - 4 && want < o.x1 + 4)) {
            const far = ENEMY_JUMP_DIST[e.type] || 200, reach = Math.min(Math.abs(want - e.x), far), tx = e.x + e.face * reach;
            const doom = curMap.pits.some(o => tx > o.x0 && tx < o.x1);                          // a jump that is too short drops it into the pit
            e.jump = { x0: e.x, x1: tx, fy0: e.fy || 0, fy1: e.fy || 0, H: ENEMY_JUMP_H, t: 0, dur: 420 + reach * 4, doom };
            e.hopAt = null;
            return;
          }
        }
      }
      const eb = hurtOf(e), room = eb ? (e.face < 0 ? eb[0] - me[2] : me[0] - eb[2]) : gap;   // free ground until its hitbox meets hers
      const mv = e.face * Math.max(0, Math.min(espeed(e, ai) * dt / 1000, room));
      if (mv === 0 && sameLevel && !pitBetween) {                    // its body is against hers and nothing reached: swing anyway
        const melee = ai.attacks.filter(a => a !== 'combo'), pool = melee.length ? melee : ai.attacks;
        e.state = 'attack'; e.meleeSeen = true; play(e, pool[Math.floor(Math.random() * pool.length)]);
        return;
      }
      if (mv === 0 && e.anim !== 'idle') play(e, 'idle');
      e.x += mv; e.base += mv;
    }
  }
