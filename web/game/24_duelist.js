'use strict';
  // Percy walks in from the left once the first door of a level opens (every enemy on map 1 is down).
  // He walks into melee, slashes three times, then walks off through the door on the right.
  // The frame Perry starts a melee attack, if that attack can reach him, he moves in and blocks.
  // A beam, a projectile, or an explosion makes him jump before it arrives.
  const DUEL_SPEED = 0.048;          // px per ms, a walk
  const DUEL_HOP_MS = 460;
  const DUEL_BLOCK_MS = 340;
  let duelMap = null, duelArmed = false;

  function duelistWatch() {
    if (typeof level === 'undefined' || !level || level.idx !== 0 || !curMap) { duelMap = null; return; }
    if (curMap !== duelMap) { duelMap = curMap; duelArmed = !doorOpen(); return; }
    if (!duelArmed || !doorOpen() || enemies.some(e => e.type === 'duelist')) return;
    const e = spawn('duelist', -80, { fy: 0 });
    e.scale = window.BIBOO.duelist.scale;
    e.duel = { mode: 'approach', strikes: 0, hop: 0, block: 0, next: clock + 700 };
    e.face = 1;
    e.state = 'walk';
    play(e, 'walk');
    duelArmed = false;
  }
  function duelistShow(e, anim) { if (e.anim !== anim) play(e, anim); }
  function duelistHop(e) {
    if (!e.duel) return;
    e.duel.hop = Math.max(e.duel.hop || 0, clock + DUEL_HOP_MS);
  }
  function duelistTouch(e) {
    if (!e.duel) return;
    e.tint = { color: '#ffffff', alpha: 0.7, until: clock + 140 };
    if ((e.duel.hop || 0) > clock) return;
    e.duel.block = clock + DUEL_BLOCK_MS;
  }
  function duelistBody(e) {
    const h = frameOf(e).hurt, s = SPRITE_SCALE * (e.scale || 1), fy = e.fy || 0;
    const y0 = h[1] * s + fy, y1 = h[3] * s + fy;
    return e.face < 0
      ? [e.base + h[0] * s - 12, y0, e.base + h[2] * s + 12, y1]
      : [e.base - h[2] * s - 12, y0, e.base - h[0] * s + 12, y1];
  }
  function duelistHazard(e) {
    const body = duelistBody(e);
    if (!body) return false;
    const beam = typeof beamNow === 'function' ? beamNow() : null;
    if (beam && overlap(body, beam.box)) return true;
    if (typeof shots !== 'undefined' && shots.some(sh => overlap(body, [sh.x - 10, sh.y - 10, sh.x + 10, sh.y + 10]))) return true;
    if (typeof explosions !== 'undefined' && explosions.some(ex => {
      const age = clock - ex.t0, r = (ex.r || 40) * Math.min(1, age / 180);
      const dx = Math.max(body[0] - ex.wx, 0, ex.wx - body[2]), dy = Math.max(body[1] - ex.wy, 0, ex.wy - body[3]);
      return dx * dx + dy * dy <= r * r;
    })) return true;
    if (typeof mageBlasts !== 'undefined' && mageBlasts.some(b => {
      const dx = Math.max(body[0] - b.wx, 0, b.wx - body[2]), dy = Math.max(body[1] - b.wy, 0, b.wy - body[3]);
      return dx * dx + dy * dy <= 50 * 50 && clock - b.t0 < 900;
    })) return true;
    if (curMap && curMap.pits.some(p => e.x > p.x0 - 8 && e.x < p.x1 + 8)) return true;
    return false;
  }
  // Beams and blasts are jumped. Everything else she swings is a melee attack and is blocked.
  const DUEL_JUMP = new Set(['beam_cloud', 'beam_fire', 'beam_laser', 'beam_plasma', 'energy_wave', 'earthquake', 'energy_burst', 'meteor_shower']);
  function duelReach(id) {
    const m = D.moves[id];
    if (!m || !m.frames) return 0;
    let reach = 0;
    for (const f of m.frames) {
      if (!f.hits) continue;
      for (const h of f.hits) for (const p of [h.a, h.b, h.c]) if (p) reach = Math.max(reach, p[0] + (h.radius || h.r || 0));
    }
    return reach;
  }
  function duelInReach(e, reach) {
    const eb = hurtOf(e);
    if (!eb || reach <= 0) return false;
    const her = playerX(), face = (cur && cur.face) || facing;
    const both = cur && (cur.id === 'spin_attack');
    if (both) return her - eb[2] <= reach && eb[0] - her <= reach;
    const ahead = face > 0 ? eb[0] - her : her - eb[2];
    return ahead <= reach;
  }
  function shotComing(sh, body) {
    const x1 = sh.x + (sh.vx || 0) * 420, y1 = sh.y + (sh.vy || 0) * 420;
    for (let i = 0; i <= 8; i++) {
      const u = i / 8, px = sh.x + (x1 - sh.x) * u, py = sh.y + (y1 - sh.y) * u;
      if (px >= body[0] - 18 && px <= body[2] + 18 && py >= body[1] - 12 && py <= body[3] + 28) return true;
    }
    return false;
  }
  function duelJumpThreat(e) {
    if (duelistHazard(e)) return true;
    const body = duelistBody(e);
    if (!body) return false;
    if (cur && cur.kind === 'action' && DUEL_JUMP.has(cur.id) && duelInReach(e, cur.id.indexOf('beam') === 0 || cur.id === 'beam_cloud' ? 500 : (duelReach(cur.id) || 400))) return true;
    const beam = typeof beamNow === 'function' ? beamNow() : null;
    if (beam) {
      const y = (beam.box[1] + beam.box[3]) / 2;
      if (y >= body[1] - 24 && y <= body[3] + 36 && duelInReach(e, 500)) return true;
    }
    if (typeof shots !== 'undefined' && shots.some(sh => shotComing(sh, body))) return true;
    if (typeof explosions !== 'undefined' && explosions.some(ex => {
      const dx = Math.max(body[0] - ex.wx, 0, ex.wx - body[2]), dy = Math.max(body[1] - ex.wy, 0, ex.wy - body[3]);
      return dx * dx + dy * dy <= (ex.r || 40) * (ex.r || 40);
    })) return true;
    return false;
  }
  function duelMeleeThreat(e) {
    if (!cur || cur.kind !== 'action' || DUEL_JUMP.has(cur.id)) return false;
    if (cur.id === 'jump' || cur.id === 'dash' || cur.id === 'block' || cur.id === 'parry' || cur.id === 'duck' || cur.id === 'taunt' || cur.id === 'sky_dash') return false;
    const id = cur.id === 'charge' ? 'slash' : cur.id;
    const reach = duelReach(id);
    if (!reach) return false;
    return duelInReach(e, reach);
  }
  function duelistAdvance(e, dt) {
    const T = EN[e.type], A = T.anims[e.anim];
    let ended = false;
    e.t += dt;
    while (e.t >= T.frames[A.frames[e.k]].ms) {
      e.t -= T.frames[A.frames[e.k]].ms;
      if (e.k + 1 < A.frames.length) e.k++;
      else if (A.loop) e.k = 0;
      else { ended = true; e.t = 0; break; }
    }
    return ended;
  }
  // How much clear ground is left before Percy's body box meets her hitbox. Positive means he has not reached her yet.
  // He does not stop at her sword or at a fixed melee range.
  function duelRoom(e) {
    const me = herBox(), eb = hurtOf(e);
    if (!eb) return 999;
    return e.face < 0 ? eb[0] - me[2] : me[0] - eb[2];
  }
  function duelistStep(e, dt) {
    const d = e.duel || (e.duel = { mode: 'approach', strikes: 0, hop: 0, block: 0, next: clock + 700 });
    if (duelJumpThreat(e)) duelistHop(e);
    const hopping = d.hop > clock;
    const ended = duelistAdvance(e, dt);
    if (e.state === 'attack' && ended) {
      d.strikes++;
      e.state = 'walk';
      e.hitDone = false;
      if (d.strikes >= 3) d.mode = 'leave';
      d.next = clock + 520;
    }
    const her = herMidX();
    let dir = 0, room = 0;
    if (d.mode === 'leave') { dir = 1; e.face = 1; }
    else {
      const toward = her >= e.x ? 1 : -1;
      e.face = toward;
      room = duelRoom(e);
      if (room > 0) { d.mode = 'approach'; dir = toward; }
      else { d.mode = 'melee'; }
    }
    if (dir) {
      const step = d.mode === 'approach' ? Math.min(DUEL_SPEED * dt, Math.max(0, room)) : DUEL_SPEED * dt;
      e.x += dir * step; e.base = e.x;
    }
    if (e.x > MAP_W + 36) {
      const i = enemies.indexOf(e);
      if (i >= 0) enemies.splice(i, 1);
      return;
    }
    e.jy = hopping ? 96 : 0;
    if (!hopping && duelMeleeThreat(e)) d.block = Math.max(d.block, clock + DUEL_BLOCK_MS);
    if ((hopping || d.block > clock) && e.state === 'attack') { e.state = 'walk'; e.hitDone = false; }
    if (hopping) { duelistShow(e, e.anim === 'up' && !ended ? 'up' : 'upHold'); e.state = 'walk'; return; }
    e.jy = 0;
    if (e.state === 'attack') return;
    if (d.mode === 'melee' && d.strikes < 3 && clock >= d.next && d.block <= clock) {
      e.state = 'attack';
      play(e, 'slash');
      return;
    }
    if (d.block > clock) {
      if (e.anim === 'blockIn' && !ended) duelistShow(e, 'blockIn');
      else if (e.anim !== 'block') duelistShow(e, e.anim === 'blockIn' ? 'block' : 'blockIn');
    } else duelistShow(e, d.mode === 'melee' ? 'idle' : 'walk');
  }
  function drawDuelistEnergy(e) {
    if (e.type !== 'duelist' || e.anim !== 'slash' || (e.k !== 3 && e.k !== 4)) return;
    const E = window.BIBOO.duelist && window.BIBOO.duelist.energy;
    const im = E && img[E.src] && img[E.src].im;
    if (!im) return;
    const f = Math.floor(clock / 25) % E.frames;
    g.drawImage(im, f * E.cell[0], 0, E.cell[0], E.cell[1], -E.w / 2, -(E.above + E.h / 2), E.w, E.h);
  }
