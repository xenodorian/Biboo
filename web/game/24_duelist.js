'use strict';
  // The duelist walks in from the left once the first door of a level opens (every enemy on map 1 is down).
  // He walks into melee and blocks. He slashes three times, then walks off through the door on the right.
  // Beams, shots and explosions get the up-arrow hop. Player swings are blocked and do not hurt him.
  const DUEL_SPEED = 0.048;          // px per ms, a walk
  const DUEL_MELEE = 88;
  const DUEL_HOP_MS = 460;
  const DUEL_BLOCK_MS = 340;
  let duelMapKey = '', duelArmed = false;

  function duelistWatch() {
    if (typeof level === 'undefined' || !level || level.idx !== 0) { duelMapKey = ''; return; }
    const key = level.n + ':' + level.idx;
    if (key !== duelMapKey) { duelMapKey = key; duelArmed = !doorOpen(); return; }
    if (!duelArmed || !doorOpen() || enemies.some(e => e.type === 'duelist')) return;
    const e = spawn('duelist', -80, { fy: 0 });
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
  function duelistStep(e, dt) {
    const d = e.duel || (e.duel = { mode: 'approach', strikes: 0, hop: 0, block: 0, next: clock + 700 });
    if (duelistHazard(e)) duelistHop(e);
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
    let dir = 0;
    if (d.mode === 'leave') { dir = 1; e.face = 1; }
    else if (Math.abs(her - e.x) > DUEL_MELEE) { d.mode = 'approach'; dir = her > e.x ? 1 : -1; e.face = dir; }
    else { d.mode = 'melee'; e.face = her >= e.x ? 1 : -1; }
    if (dir) { e.x += dir * DUEL_SPEED * dt; e.base = e.x; }
    if (e.x > MAP_W + 36) {
      const i = enemies.indexOf(e);
      if (i >= 0) enemies.splice(i, 1);
      return;
    }
    e.jy = hopping ? 96 : 0;
    if (hopping) { duelistShow(e, e.anim === 'up' && !ended ? 'up' : 'upHold'); e.state = 'walk'; return; }
    e.jy = 0;
    if (e.state === 'attack') return;
    if (d.mode === 'melee' && d.strikes < 3 && clock >= d.next) {
      e.state = 'attack';
      play(e, 'slash');
      return;
    }
    if ((d.block > clock && d.mode !== 'approach') || d.mode === 'melee') {
      if (e.anim === 'blockIn' && !ended) duelistShow(e, 'blockIn');
      else if (e.anim !== 'block') duelistShow(e, e.anim === 'blockIn' ? 'block' : 'blockIn');
    } else duelistShow(e, 'walk');
  }
  function drawDuelistEnergy(e) {
    if (e.type !== 'duelist' || e.anim !== 'slash' || (e.k !== 3 && e.k !== 4)) return;
    const E = window.BIBOO.duelist && window.BIBOO.duelist.energy;
    const im = E && img[E.src] && img[E.src].im;
    if (!im) return;
    const f = Math.floor(clock / 25) % E.frames;
    g.drawImage(im, f * E.cell[0], 0, E.cell[0], E.cell[1], -150, -128, E.cell[0], E.cell[1]);
  }
