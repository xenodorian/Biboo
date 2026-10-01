/* Parry Perry: the move library of Max Perry played live from the Dreamcast pad.
 *
 * World: the parallax scene from swingkit (layers tile in x). Max faces right; pressing Left turns
 * her to face left (art, hit shapes and motion mirrored) and pressing Right turns her back.
 * Each move frame is one actor image (effects + character) placed at the character's world
 * position: start of the move + that frame's root motion (y up). Black-and-white impact frames
 * replace the whole view for their duration. Camera: follows the character in x, rises once a
 * jump clears 30 px (the same camera the exporter drew the impact frames with).
 *
 * Beam moves draw a scrolling beam from the blade tip (D.beams) that kills what it touches.
 *
 * Game structure: title menu -> overworld -> level (10 one-screen maps, "Level 1.1" and so on). Progress
 * (unlocked moves and buttons, gems, meters, open levels) is in progress.js; map data is in levels.js; the
 * menus are in ui.js. Only A, B, X, Y and the d-pad work at first; buy unlocks from the Bone Merchant with Leaves. Meters show once
 * a move that uses them is unlocked. Enemies (goblin, orc) patrol a set path and chase when hit or when she is
 * within their sight range. Max and the enemies have HP: her hit shapes (blade, foot, energy, beams) take HP off
 * an enemy's hurtbox they touch. Enemies drop gems into a bag (Gems menu). An enemy attack that reaches her: a
 * clean hit turns her red and knocks her back; blocking flashes white; a well timed parry knocks the enemy back.
 * L1+R1+L2+R2 together in the pause menu reveals the Cheats entry.
 */
(function () {
  'use strict';
  const D = window.BIBOO;
  D.input.sequence_window_ms = 700;
  if (!D.input.bindings.some(b => b.input === 'Left-Right+A'))
    D.input.bindings.push({ input: 'Left-Right+A', type: 'sequence', move: 'beam_cloud' });
  for (const inp of ['Right-Left-A', 'Right-Left+A']) {
    if (!D.input.bindings.some(b => b.input === inp))
      D.input.bindings.push({ input: inp, type: 'sequence', move: 'beam_cloud' });
  }
  for (const b of D.input.bindings) {
    if (b.input === 'Left+A' && b.type === 'chord') b.move = 'thrust';
  }
  for (const inp of ['Down-Down-A', 'Down-Down+A']) {
    if (!D.input.bindings.some(b => b.input === inp))
      D.input.bindings.push({ input: inp, type: 'sequence', move: 'spin_attack' });
  }
  // spin attack: the Y button, a move she starts with. Overhead chop: hold A to charge, release to chop (tap A is still the slash)
  D.input.bindings = D.input.bindings.filter(b => b.move !== 'spin_attack' && b.move !== 'heavy' && b.move !== 'charge');
  D.input.bindings.push({ input: 'Y', type: 'press', move: 'spin_attack' });
  D.moves.spin_attack.input = 'Y'; D.moves.spin_attack.inputType = 'press';
  D.moves.heavy.input = 'A (release)';
  // The push kick's hurtbox (the part that damages) is a box from her pivot (38 px in the sheet) forward to 95 px, from 1 px above the
  // bottom of the frame (y -1) up to 34.8 px, on both active frames. It replaces the small capsule around the foot.
  for (const k of [1, 2]) D.moves.push_kick.frames[k].hits = [{ shape: 'box', a: [38, -1], b: [95, 34.8] }];            // ends on the last white arc (sheet x 95 from the anchor)
  // The energy kick uses the same box, 38 to 102.9 from its own anchor (its arcs end at 101).
  for (const k of [1, 2]) D.moves.energy_kick.frames[k].hits = [{ shape: 'box', a: [38, -1], b: [102.9, 34.8] }];
  // sky dash is Down then Up (taunt stays X+Y)
  D.input.bindings = D.input.bindings.filter(b => b.move !== 'sky_dash');
  D.input.bindings.push({ input: 'Down-Up', type: 'sequence', move: 'sky_dash' });
  D.moves.sky_dash.input = 'Down-Up';
  D.input.bindings.push({ input: 'A', type: 'hold', move: 'charge', release_into: 'heavy' });
  for (const b of D.input.bindings) {
    if (b.input === 'Down-Right-A-B' && b.type === 'sequence') b.input = 'Down-Right-A';
  }
  if (!D.input.bindings.some(b => b.input === 'Down-Right+A'))
    D.input.bindings.push({ input: 'Down-Right+A', type: 'sequence', move: 'energy_wave' });
  // energy dash thrust: double tap the forward button (either way), then X and A together
  D.input.bindings = D.input.bindings.filter(b => b.move !== 'energy_dash_thrust');
  for (const inp of ['Right-Right-X+A', 'Left-Left-X+A'])
    D.input.bindings.push({ input: inp, type: 'sequence', move: 'energy_dash_thrust' });
  const LRmap = { L: 'L1', 'A+L': 'A+L1', 'A+R': 'A+R1', 'B+L': 'B+L1', 'A+B+L': 'B+L1', 'L+R': 'L1+R1' };
  for (const b of D.input.bindings) {
    if (LRmap[b.input]) b.input = LRmap[b.input];
    if (b.move === 'heavy_kick') b.move = 'energy_kick';
  }
  const seenEk = new Set();
  D.input.bindings = D.input.bindings.filter(b => {
    if (b.move !== 'energy_kick') return true;
    if (seenEk.has(b.input)) return false;
    seenEk.add(b.input); return true;
  });
  D.input.bindings = D.input.bindings.filter(b => b.move !== 'heavy_kick');
  for (const b of D.input.bindings) { if (b.move === 'energy_wave') { b.input = 'R2'; b.type = 'press'; } }
  if (!D.input.bindings.some(b => b.move === 'energy_wave')) D.input.bindings.push({ input: 'R2', type: 'press', move: 'energy_wave' });
  D.input.bindings = D.input.bindings.filter(b => !(b.move === 'energy_wave' && b.input !== 'R2'));
  for (const b of D.input.bindings) { if (b.move === 'recover') { b.input = 'R'; b.type = 'hold'; } }
  if (!D.input.bindings.some(b => b.move === 'recover')) D.input.bindings.push({ input: 'R', type: 'hold', move: 'recover' });
  for (const b of D.input.bindings) {
    if (b.input === 'A+L2') b.move = 'beam_cloud';
    if (b.input === 'A+R2') b.move = 'beam_fire';
  }
  if (!D.input.bindings.some(b => b.input === 'A+L2'))
    D.input.bindings.push({ input: 'A+L2', type: 'chord', move: 'beam_cloud' });
  if (!D.input.bindings.some(b => b.input === 'A+R2'))
    D.input.bindings.push({ input: 'A+R2', type: 'chord', move: 'beam_fire' });
  for (const b of D.input.bindings) {
    if (b.move === 'energy_wave') { b.input = 'R2'; b.type = 'press'; }
  }
  if (!D.input.bindings.some(b => b.move === 'energy_wave'))
    D.input.bindings.push({ input: 'R2', type: 'press', move: 'energy_wave' });
  D.input.bindings = D.input.bindings.filter(b => !(b.move === 'energy_wave' && b.input !== 'R2'));
  // Beams: only A plus a shoulder button fires one. L2 cloud, R2 fire, L1 laser, R1 Empowerment Beam. Every
  // other beam binding (A+B, the Left-Right-A style sequences, the old A+L and A+R) is deleted.
  const BEAM_KEYS = { beam_cloud: 'A+L2', beam_fire: 'A+R2', beam_laser: 'A+L1', beam_plasma: 'A+R1' };
  D.input.bindings = D.input.bindings.filter(b => !b.move.startsWith('beam_') || BEAM_KEYS[b.move] === b.input);
  for (const [mv, inp] of Object.entries(BEAM_KEYS))
    if (!D.input.bindings.some(b => b.move === mv && b.input === inp)) D.input.bindings.push({ input: inp, type: 'chord', move: mv });
  // Energy burst is L2 on its own. L1+R1 is no longer a burst: holding both charges the meters (see metersHeld).
  D.input.bindings = D.input.bindings.filter(b => b.move !== 'energy_burst');
  D.input.bindings.push({ input: 'L2', type: 'press', move: 'energy_burst' });
  // Heavy Horizontal: hold B, tap A. It plays the horizontal slash animation with its own damage and pushback.
  if (!D.moves.heavy_horizontal)
    D.moves.heavy_horizontal = Object.assign({}, D.moves.slash, { title: 'Heavy Horizontal', input: 'A+B', inputType: 'chord' });
  D.input.bindings.push({ input: 'A+B', type: 'chord', move: 'heavy_horizontal', held: ['B'] });
  D.input.bindings.push({ input: 'A-A-A-A-R1+R2+L1+L2', type: 'sequence', move: 'ultimate' });   // the Ultimate Chain
  const V = D.view;
  const P = window.BibooProgress;
  // The player starts with the d-pad and A, B, X, Y only. Every other move is an unlock bought from the Bone Merchant
  // (web/progress.js). A move that is not open is not in the input reader at all, so the button that would have
  // triggered it falls back to the plain move (Down+A is just a slash until the upswing is unlocked).
  const BASE_MOVES = new Set(['idle', 'walk_right', 'walk_left', 'duck', 'block', 'parry', 'jump', 'dash', 'slash', 'spin_attack']);
  const moveOpen = move => BASE_MOVES.has(move) || P.hasMove(move);
  const SPRITE_SCALE = 0.5;
  if (D.moves.beam_plasma) D.moves.beam_plasma.title = 'Empowerment Beam';
  if (D.moves.jump) D.moves.jump.title = 'Jump (floaty; hold Left or Right to steer)';
  // Energy (blue) and empower (orange) meters. Gems dropped by defeated enemies fill them: taunted enemies
  // always drop an empower gem, enemies hit by the Empowerment Beam always drop an energy gem, and any
  // other kill drops a random gem GEM_CHANCE of the time. Energy pays for the beams and the energy wave,
  // empower for the Empowerment Beam and for kneeling to recover. A move whose meter cannot pay does not
  // play at all, and a beam or recovery stops the moment the meter runs dry.
  // Each meter has its own capacity: 50 at first, +25 for every upgrade pickup (P.maxOf, saved with the progress).
  const maxOf = k => P.maxOf(k);
  const maxHp = () => P.maxOf('hp');                  // starts at 50; each +25 Max HP gem adds 25 (cap 200)
  // The super meter (purple, SUP) starts empty and is filled only by Super Gems: one drops when an enemy is
  // killed by a beam. A full meter pays for the earthquake and the meteor shower.
  let energyMeter = P.state.meters.energy, empowerMeter = P.state.meters.empower, superMeter = P.state.meters.super;   // saved with the progress
  const GEM_VALUE = 25, GEM_CHANCE = 0.35, MAXHP_CHANCE = 0.12, GEM_LIFE = 20000, GEM_PICKUP = 28;
  const BEAM_TICK_COST = { cloud: 1, fire: 3, laser: 5, plasma: 5 };         // per beam tick (100 ms)
  const MOVE_COST = { jump_crash: ['energy', 30], earthquake: ['super', 'full'], meteor_shower: ['super', 'full'] };   // earthquake and meteor shower need a full super meter and use all of it                          // paid once, when the move starts
  const HEAL_COST = 1;                                                        // empower per recover tick
  const meterOf = k => k === 'energy' ? energyMeter : k === 'super' ? superMeter : empowerMeter;
  function spend(k, n) {                               // n < 0 adds (capped at the meter's maximum)
    const v = Math.max(0, Math.min(maxOf(k), meterOf(k) - n));
    if (k === 'energy') energyMeter = v; else if (k === 'super') superMeter = v; else empowerMeter = v;
  }
  let gems = [], meterFlash = { energy: 0, empower: 0, super: 0 }, lastDeny = 0;
  // A drop is never redundant: no gem for a meter she has not unlocked, none of a kind whose bag is full, no upgrade for a meter at its cap.
  const gemUseful = k => level && level.n === 1 && k !== 'health' ? false : k === 'health' ? (P.state.gems.health || 0) < P.MAX_GEMS : P.meterOn(k) && (P.state.gems[k] || 0) < P.MAX_GEMS;
  function lootGem(wx, kind, fy) { if (gemUseful(kind)) spawnGem(wx, kind, fy); }
  function lootPool() {
    const pool = [];
    if (gemUseful('health')) pool.push('health', 'health', 'health');
    if (P.maxOf('hp') < P.MAX_CAP) pool.push('up_hp');                    // a +25 Max HP gem drops alongside the health gems
    for (const m of ['energy', 'empower', 'super']) {
      if (!P.meterOn(m) || (level && level.n === 1)) continue;          // level 1 drops only health gems
      if (gemUseful(m)) pool.push(m);
      if (P.maxOf(m) < P.MAX_CAP) pool.push('up_' + m, 'up_' + m);
    }
    return pool;
  }
  // A locked door level (door: 'key'): the door at the end stays locked until every unlock in the level is owned. There are no keys.
  // Every map's door (the right edge) stays shut until every enemy on the map is defeated. There is no way back to the map before.
  const doorOpen = () => !enemies.some(e => alive(e) && !EN[e.type].ai.prop);
  function spawnGem(wx, kind, fy) { gems.push({ x: wx, y: (fy || 0) + 14 + Math.random() * 8, fy: fy || 0, kind, bob: Math.random() * 6.28, t0: clock }); }
  // Progress is kept in progress.js; the meters live here while playing and are copied over when it is saved.
  function syncProgress() { P.state.meters = { energy: energyMeter, empower: empowerMeter, super: superMeter }; P.save(); }
  function meterStarts(had) {                        // a meter that has just become available starts full (50, the super meter 100)
    if (!had.energy && P.meterOn('energy')) energyMeter = Math.max(energyMeter, maxOf('energy'));
    if (!had.empower && P.meterOn('empower')) empowerMeter = Math.max(empowerMeter, maxOf('empower'));
    if (!had.super && P.meterOn('super')) superMeter = Math.max(superMeter, maxOf('super'));
  }
  const meterState = () => ({ energy: P.meterOn('energy'), empower: P.meterOn('empower'), super: P.meterOn('super') });
  function unlockItem(id) {                          // from the shop or the dev console
    const had = meterState();
    if (!P.unlock(id)) return false;
    meterStarts(had); refreshUnlocks(); syncProgress();
    return true;
  }
  function unlockEverything() {
    const had = meterState();
    P.unlockAll(); meterStarts(had); refreshUnlocks(); syncProgress();
  }
  // what a move needs before it may start: [meter, amount] or null
  function needOf(move) {
    if (MOVE_COST[move]) { const c = MOVE_COST[move]; return c[1] === 'full' ? [c[0], maxOf(c[0])] : c; }
    const b = D.moves[move] && D.moves[move].frames.find(f => f.beam);
    if (b) return [b.beam.kind === 'plasma' ? 'empower' : 'energy', BEAM_TICK_COST[b.beam.kind] || 5];
    if (move === 'recover') return ['empower', HEAL_COST];
    return null;
  }
  function canAfford(move) { const n = needOf(move); return !n || meterOf(n[0]) >= n[1]; }
  function deny(move) {
    const n = needOf(move);
    meterFlash[n[0]] = clock + 500;
    if (clock - lastDeny > 500) { lastDeny = clock; floater(bodyX(), herY() + herTop() + 8, n[0] === 'energy' ? 'No energy' : n[0] === 'super' ? 'No super' : 'No empower', n[0] === 'energy' ? '#4af' : n[0] === 'super' ? '#c6f' : '#fa4'); }
  }
  // Walking over a gem puts it in the gem bag (the Gems menu); nothing is applied until the player uses it there.
  const GEM_LABEL = { health: 'Bone', energy: 'Quartz', empower: 'Garnet', super: 'Diamond' };      // the gems, renamed (they work as before)
  const GEM_COLOR = { health: '#3ddc5f', energy: '#4af', empower: '#fa4', super: '#c6f' };
  const UP_LABEL = { energy: 'ENG', empower: 'EMP', super: 'SUP' };
  const GEM_SPRITE = { health: 'bone', up_hp: 'powder', energy: 'quartz', empower: 'garnet', super: 'diamond' };
  const gemHeal = () => Math.ceil(maxHp() / 4);                                // a health gem: +25 percent of Max HP
  function stepGems(dt) {
    for (const gm of gems) gm.bob += dt * 0.006;
    gems = gems.filter(gm => {
      if (clock - gm.t0 > GEM_LIFE && !gm.perm && gm.kind !== 'ankh' && gm.kind !== 'leaf') return false;
      const hy = herY();
      if (Math.abs(gm.x - bodyX()) < GEM_PICKUP && hy < gm.fy + 50 && hy > gm.fy - 20) {
        if (gm.kind === 'leaf') {                          // a Leaf (gold coin): straight into the purse
          P.addLeaves(gm.val || 1); floater(gm.x, gm.y + 20, '+' + (gm.val || 1), '#ffd24a');
          if (gm.key && level) level.leafGot.add(gm.key);
          return false;
        }
        if (gm.kind === 'ankh') {
          if (P.addAnkh(1) > 0) { floater(gm.x, gm.y + 24, '+1 ANKH', '#ffd24a'); if (gm.key && level) level.ankhGot.add(gm.key); return false; }
          floater(gm.x, gm.y + 24, 'ANKHS FULL', '#ffd24a'); return true;
        }
        if (gm.kind.startsWith('up_')) {                   // a meter upgrade: applied at once, the meter grows by 25 and fills by 25
          const m = gm.kind.slice(3);
          if (m === 'hp') {                                // +25 Max HP: the cap and the current health both grow by 25
            if (P.raiseMax('hp') > 0) { hp = Math.min(maxHp(), hp + P.MAX_STEP); floater(gm.x, gm.y + 24, 'BONE POWDER +25 MAX HP', GEM_COLOR.health); }
            else floater(gm.x, gm.y + 24, 'HP at its limit', GEM_COLOR.health);
            return false;
          }
          if (P.raiseMax(m) > 0) { spend(m, -P.MAX_STEP); meterFlash[m] = clock + 600; syncProgress(); floater(gm.x, gm.y + 24, '+25 MAX ' + UP_LABEL[m], GEM_COLOR[m]); }
          else floater(gm.x, gm.y + 24, UP_LABEL[m] + ' at its limit', GEM_COLOR[m]);
          return false;
        }
        if (P.addGem(gm.kind, 1) > 0) {
          floater(gm.x, gm.y + 24, '+' + GEM_LABEL[gm.kind], GEM_COLOR[gm.kind]);
          return false;
        }
      }
      return true;
    });
  }
  function canUseGem(kind) {
    if ((P.state.gems[kind] || 0) < 1) return false;
    if (kind === 'health') return !!level && hp < maxHp();                      // health only matters inside a level
    if (!P.meterOn(kind)) return false;
    return meterOf(kind) < maxOf(kind);
  }
  function useGem(kind) {
    if (!canUseGem(kind)) return;
    P.takeGem(kind);
    if (kind === 'health') hp = Math.min(maxHp(), hp + gemHeal());
    else if (kind === 'energy') { energyMeter = Math.min(maxOf('energy'), energyMeter + GEM_VALUE); meterFlash.energy = clock + 400; }
    else if (kind === 'empower') { empowerMeter = Math.min(maxOf('empower'), empowerMeter + GEM_VALUE); meterFlash.empower = clock + 400; }
    else { superMeter = Math.min(maxOf('super'), superMeter + GEM_VALUE); meterFlash.super = clock + 400; }
    syncProgress();
  }
  // ---- the Bone Merchant (on the overworld): Leaves buy Bones (health), Bone Powder (+25 max HP), Quartz, Garnet and Diamonds (meter refills),
  // Mutagens (the unlocks that use a meter) and Warrior Scrolls (every other unlock). An unlock goes on sale once its level's predecessor is beaten.
  function shopRows() {
    const PR = P.PRICE, L = P.state.leaves, sections = [];
    const gemRow = (kind, key, label, sprite) => {
      const need = kind !== 'health' && !P.meterOn(kind), full = (P.state.gems[kind] || 0) >= P.MAX_GEMS, price = PR[key];
      return { key, label, sprite, price, desc: kind === 'health' ? `Restores ${gemHeal()} HP. Use it from the Gems menu.` : `Refills ${GEM_VALUE} ${kind}. Use it from the Gems menu.`,
               have: `You hold ${P.state.gems[kind] || 0}`, canBuy: !need && !full && L >= price, note: need ? `Needs a ${kind[0].toUpperCase() + kind.slice(1)} Mutagen` : full ? 'Bag full' : L < price ? 'Not enough Leaves' : '' };
    };
    sections.push({ title: 'Supplies', rows: [
      gemRow('health', 'bone', 'Bone', 'bone'), gemRow('energy', 'quartz', 'Quartz', 'quartz'), gemRow('empower', 'garnet', 'Garnet', 'garnet'), gemRow('super', 'diamond', 'Diamond', 'diamond'),
      { key: 'powder', label: 'Bone Powder', sprite: 'powder', price: PR.powder, desc: `Raises your maximum HP by ${P.MAX_STEP} (now ${maxHp()}, limit ${P.MAX_CAP}).`, have: '',
        canBuy: maxHp() < P.MAX_CAP && L >= PR.powder, note: maxHp() >= P.MAX_CAP ? 'Max HP reached' : L < PR.powder ? 'Not enough Leaves' : '' } ] });
    for (const [kind, title, noun] of [['mutagen', 'Mutagens', 'Mutagen'], ['scroll', 'Warrior Scrolls', 'Scroll']]) {
      const rows = P.UNLOCKS.filter(u => u.shop === kind).sort((a, b) => a.level - b.level).map(u => {
        const own = P.has(u.id), open = u.level <= P.state.levelsUnlocked, price = P.priceOf(u);
        return { key: 'unlock:' + u.id, label: `${noun}: ${u.name}`, sprite: kind === 'mutagen' ? 'quartz' : 'scroll', price, desc: u.hint, have: `Level ${u.level}`, owned: own,
                 canBuy: !own && open && L >= price, note: own ? 'Owned' : !open ? `Beat level ${u.level - 1} first` : L < price ? 'Not enough Leaves' : '' };
      });
      sections.push({ title, rows });
    }
    return sections;
  }
  function buy(key) {                                              // returns the message to show, or '' when nothing was bought
    const row = shopRows().flatMap(sct => sct.rows).find(r => r.key === key);
    if (!row || !row.canBuy) return row && row.note ? row.note : '';
    P.addLeaves(-row.price);
    if (key === 'powder') { P.raiseMax('hp'); if (level) hp = Math.min(maxHp(), hp + P.MAX_STEP); }
    else if (key.startsWith('unlock:')) {
      const it = P.byId[key.slice(7)]; unlockItem(it.id);
      syncProgress();
      return `Bought ${row.label}. ${unlockLines(it).join('  |  ')}`;
    } else P.addGem({ bone: 'health', quartz: 'energy', garnet: 'empower', diamond: 'super' }[key], 1);
    syncProgress();
    return `Bought ${row.label}.`;
  }
  function spriteCss(name) {
    const I = D.items; if (!I) return null;
    if (name === 'leaf') return { backgroundImage: `url(${I.leaf})`, backgroundSize: `${I.cell * I.leafFrames * 2}px 32px`, backgroundPosition: '0 0' };
    if (name in I.gems) return { backgroundImage: `url(${I.gemSheet})`, backgroundSize: `${I.cell * 5 * 2}px 32px`, backgroundPosition: `${-I.gems[name] * 32}px 0` };
    return null;
  }
  function gemRows() {
    return P.GEM_KINDS.map(kind => {
      let note = '';
      if (kind === 'health') note = level ? `+${gemHeal()} HP  (${hp}/${maxHp()})` : `+${gemHeal()} HP, use it inside a level`;
      else if (!P.meterOn(kind)) note = 'meter not unlocked yet';
      else note = `+${GEM_VALUE}  (${Math.round(meterOf(kind))}/${maxOf(kind)})`;
      return { kind, sprite: GEM_SPRITE[kind], label: GEM_LABEL[kind], color: GEM_COLOR[kind], count: P.state.gems[kind] || 0, canUse: canUseGem(kind), note };
    });
  }

  const canvas = document.getElementById('view');
  const g = canvas.getContext('2d');
  g.imageSmoothingEnabled = false;

  // ------------------------------------------------------------------ assets
  const img = {};
  function load(src) {
    if (img[src]) return img[src].p;
    const ent = { im: null, p: null };
    // a failed load is retried (a build being published, a dropped connection on a phone) before it is reported
    const attempt = n => new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => { ent.im = im; res(); };
      im.onerror = () => { if (n < 4) setTimeout(() => attempt(n + 1).then(res, rej), 400 * (n + 1)); else rej(new Error('missing ' + src)); };
      im.src = src + (window.BIBOO_VER ? '?v=' + window.BIBOO_VER : '') + (n ? (window.BIBOO_VER ? '&' : '?') + 'retry=' + n : '');   // version in the URL so a new build is never served from the cache
      ent.im = im;
    });
    ent.p = attempt(0);
    img[src] = ent;
    return ent.p;
  }
  const THEMES = D.themes || {};                                     // boss arena scenery (tools/arenas/build_arenas.py)
  const srcs = [...D.layers.map(l => l.src), D.fringe.src];
  for (const t of Object.values(THEMES)) { for (const l of t.layers) srcs.push(l.src); srcs.push(t.fringe); }
  for (const m of Object.values(D.moves)) {
    srcs.push(m.sheet);
    if (m.fxSheet) srcs.push(m.fxSheet);                       // effects drawn apart from Max (own scale)
    for (const f of m.frames) if (f.bw) srcs.push(f.bw);
  }
  for (const b of Object.values(D.beams || {})) srcs.push(b.src);
  const EN = D.enemies || {};
  for (const e of Object.values(EN)) srcs.push(e.sheet);
  if (D.training) srcs.push(D.training.bunny.sheet);
  if (D.items) srcs.push(D.items.leaf, D.items.gemSheet, D.items.merchant.src);

  // ------------------------------------------------------------------ input
  const BUTTONS = ['Up', 'Down', 'Left', 'Right', 'A', 'B', 'X', 'Y', 'L1', 'L2', 'R1', 'R2', 'R'];
  const KEYS = { ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right',
                 KeyZ: 'A', KeyX: 'B', KeyA: 'X', KeyS: 'Y', KeyQ: 'L1', KeyW: 'R1', Digit1: 'L2', Digit2: 'R2' };   // W is R1 and also the recover hold, like the pad's R1
  const KEY_LABEL = { Up: '↑', Down: '↓', Left: '←', Right: '→', A: 'Z', B: 'X', X: 'A', Y: 'S', L1: 'Q', L2: '1', R1: 'W', R2: '2', R: 'W' };
  const PAD = { 0: 'A', 1: 'B', 2: 'X', 3: 'Y', 4: 'L1', 5: 'R1', 6: 'L2', 7: 'R2', 12: 'Up', 13: 'Down', 14: 'Left', 15: 'Right' };
  const keyDown = new Set(), padDown = new Set(), isDown = new Set();
  // A attacks, Up jumps (tap Up; a second tap in the air is the double jump). Y is the spin attack; X+Y is the taunt. Sky dash is Down then Up.
  const btnHeld = b => keyDown.has(b) || padDown.has(b);

  let reader = null;
  function activeInput() {                       // the bindings whose move is open (air and idle bindings are always kept)
    let bs = D.input.bindings.filter(b => b.type === 'idle' || b.type === 'air' || moveOpen(b.move)).filter(b => b.move !== 'jump');
    // with the chop unlocked A is tap = slash, hold = charge (release = chop), like B's parry and block
    if (moveOpen('charge')) bs = bs.map(b => b.move === 'slash' && b.type === 'press' ? Object.assign({}, b, { type: 'tap' }) : b);
    return Object.assign({}, D.input, { bindings: bs });   // jump is the Up button, read in readButtons
  }
  function makeReader() {
    return new BibooInput.Reader(activeInput(), {
      // releasing Up turns the charge into the heavy chop once the aura loop has started
      holdReady: (b) => { const hb = D.input.bindings.find(x => x.input === b && x.type === 'hold'); return !!cur && !!hb && cur.id === hb.move && cur.k >= D.moves[cur.id].loopFrom; },
    });
  }
  reader = makeReader();
  let lastT = 0;                                 // time of the last frame, for rebuilding the reader mid-game
  function refreshUnlocks() {                    // an unlock changed: rebuild the reader and tell it what is held
    reader = makeReader();
    for (const b of isDown) reader.held.set(b, lastT);
  }

  // Some controllers reach the page as key events (Android can send a pad's d-pad as arrow keys),
  // and those can come with an empty e.code, so the key name and legacy keyCode are checked too.
  const KEY_NAMES = { ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right',
                      z: 'A', x: 'B', a: 'X', s: 'Y', q: 'L1', w: 'R1', 1: 'L2', 2: 'R2', Z: 'A', X: 'B', A: 'X', S: 'Y', Q: 'L1', W: 'R1' };
  const KEY_CODES = { 37: 'Left', 38: 'Up', 39: 'Right', 40: 'Down' };
  const keyButton = e => KEYS[e.code] || KEY_NAMES[e.key] || KEY_CODES[e.keyCode];
  addEventListener('keydown', e => {
    if (e.code === 'KeyH' && !e.repeat) { showBoxes = !showBoxes; return; }
    const b = keyButton(e);
    if (!e.repeat) monitor(`key down  key "${e.key}"  code "${e.code}"  keyCode ${e.keyCode}  -> ${b || 'not used'}`);
    if (!b) return;
    e.preventDefault();
    keyDown.add(b); if (b === 'R1') keyDown.add('R');
  });
  addEventListener('keyup', e => {
    const b = keyButton(e);
    monitor(`key up    key "${e.key}"  code "${e.code}"  keyCode ${e.keyCode}  -> ${b || 'not used'}`);
    if (b) { e.preventDefault(); keyDown.delete(b); if (b === 'R1') keyDown.delete('R'); }
  });
  addEventListener('blur', () => { if (keyDown.size) monitor('page lost focus: held keys released'); keyDown.clear(); });

  // input monitor: raw key and controller events, to see what a controller really sends
  const monEl = document.getElementById('monitor'), monOn = document.getElementById('monitor-on');
  const monLines = [];
  let padSnap = {};                     // last seen button and axis values per pad index
  function monitor(text) {
    if (!monOn || !monOn.checked) return;
    monLines.unshift(`${(performance.now() / 1000).toFixed(2)}s  ${text}`);
    monLines.length = Math.min(monLines.length, 14);
  }
  function monitorPads(pads) {
    if (!monOn || !monOn.checked) return;
    for (const p of pads) {
      if (!p) continue;
      const old = padSnap[p.index] || { b: [], a: [] };
      p.buttons.forEach((bt, i) => {
        const on = bt.pressed || bt.value > 0.5;
        if (on !== !!old.b[i]) monitor(`pad ${p.index} button ${i} ${on ? 'down' : 'up'}  -> ${PAD[i] || 'not used'}`);
      });
      p.axes.forEach((v, i) => {
        const r = Math.round(v * 2) / 2;
        if (r !== (old.a[i] || 0)) monitor(`pad ${p.index} axis ${i} = ${v.toFixed(2)}`);
      });
      padSnap[p.index] = { b: p.buttons.map(bt => bt.pressed || bt.value > 0.5), a: p.axes.map(v => Math.round(v * 2) / 2) };
    }
  }
  function drawMonitor() {
    if (!monEl) return;
    if (!monOn.checked) { if (monEl.textContent) monEl.textContent = ''; return; }
    const held = `held  keys [${[...keyDown].join(' ')}]  pad [${[...padDown].join(' ')}]  game [${[...isDown].join(' ')}]`;
    const text = [held, ...monLines].join('\n');
    if (monEl.textContent !== text) monEl.textContent = text;
  }

  // Controllers (USB or Bluetooth, including on Android) come through the browser's Gamepad API.
  // Browsers report most pads with the "standard" layout (A bottom, B right, X left, Y top, d-pad
  // 12-15). Pads without it are read with the same button numbers, and their d-pad is also read
  // from axes 6-7, where many of them put it. A pad only shows up after one of its buttons is
  // pressed while the page is open.
  let padName = '';
  let padStartWas = false;
  function pollPad() {
    padDown.clear();
    let pads = [];
    try { pads = navigator.getGamepads ? navigator.getGamepads() : []; } catch (e) { pads = []; }
    monitorPads(pads);
    let name = '';
    let startNow = false;
    for (const p of pads) {
      if (!p || !p.connected) continue;
      name = name || `${p.id}${p.mapping === 'standard' ? '' : ' (non-standard layout)'}`;
      const pressed = (bt, thr) => {
        if (bt == null) return false;
        if (typeof bt === 'number') return bt > thr;
        return !!(bt.pressed || (bt.value != null && bt.value > thr));
      };
      const thr = (i) => (i === 6 || i === 7) ? 0.12 : 0.35;
      p.buttons.forEach((bt, i) => {
        if (!PAD[i]) return;
        if (pressed(bt, thr(i))) padDown.add(PAD[i]);
      });
      // Some non-standard pads put the shoulder buttons on buttons 8 to 11. On a standard-mapping pad, and on
      // Sony pads, 8 is Select, 9 is Start or Options and 10 and 11 are the stick clicks, so they are not
      // read as shoulder buttons there (Options used to fire the energy wave, which is R2).
      const shoulderAlias = p.mapping !== 'standard' && !/054c|sony|playstation|ps3|ps4|ps5|dualshock|dualsense|wireless controller/i.test(p.id || '');
      if (shoulderAlias) {
        if (!padDown.has('L1') && pressed(p.buttons[10], 0.35)) padDown.add('L1');
        if (!padDown.has('R1') && pressed(p.buttons[11], 0.35)) padDown.add('R1');
        if (!padDown.has('L2') && pressed(p.buttons[8], 0.12)) padDown.add('L2');
        if (!padDown.has('R2') && pressed(p.buttons[9], 0.12)) padDown.add('R2');
      }
      const axn = (i) => (p.axes && p.axes.length > i ? p.axes[i] : 0);
      if (!padDown.has('L2') && axn(2) > 0.2) padDown.add('L2');
      if (!padDown.has('R2') && axn(5) > 0.2) padDown.add('R2');
      if (padDown.has('R1')) padDown.add('R');
      if (padDown.has('L1')) padDown.add('L');
      for (const bi of [8, 9]) {
        if (pressed(p.buttons[bi], 0.35)) startNow = true;
      }
      const axis = i => (p.axes.length > i ? p.axes[i] : 0);
      const [ax, ay] = [axis(0), axis(1)];
      if (ax < -0.5) padDown.add('Left'); if (ax > 0.5) padDown.add('Right');
      if (ay < -0.5) padDown.add('Up'); if (ay > 0.5) padDown.add('Down');
      if (p.mapping !== 'standard') {
        if (axis(6) < -0.5) padDown.add('Left'); if (axis(6) > 0.5) padDown.add('Right');
        if (axis(7) < -0.5) padDown.add('Up'); if (axis(7) > 0.5) padDown.add('Down');
      }
    }
    if (startNow && !padStartWas) {
      const tp = (typeof togglePause === 'function') ? togglePause : window.togglePause;
      if (typeof tp === 'function') tp();
    }
    padStartWas = startNow;
    padName = name;
  }
  addEventListener('gamepadconnected', () => pollPad());

  // L1 and R1 held together charge all three meters (+METER_CHARGE_STEP each METER_CHARGE_TICK ms). While they are
  // held the reader is not shown L1, R1 or the pad's R1-as-R, so no push kick or recover starts.
  const METER_CHARGE_STEP = 1, METER_CHARGE_TICK = 500;
  const metersHeld = () => P.has('meter_charge') && P.buttonOn('L1') && P.buttonOn('R1') && (keyDown.has('L1') || padDown.has('L1')) && (keyDown.has('R1') || padDown.has('R1')) && !keyDown.has('L2') && !padDown.has('L2') && !keyDown.has('R2') && !padDown.has('R2');   // L1+R1 with L2 or R2 is the Ultimate Chain's chord, not a charge
  // Up also finishes the Sky Dash, so it does not jump right after Down when Sky Dash is owned
  const upIsCombo = t => (P.has('sky_dash') && (isDown.has('Down') || t - lastDownRel < D.input.sequence_window_ms));
  let lastDownRel = -1e9;
  // Flight (A, B, A, B, Up) and the Rainbow Guard (A, B, A, B, A, B) are read from the raw button log here, not by the reader
  const comboLog = []; let lastBClock = -1e9;
  function comboSeq(list, t, includesLast) {                         // the last presses were exactly `list`, each within the sequence window of the next
    const w = D.input.sequence_window_ms, n = list.length, tail = comboLog.slice(-n);
    if (tail.length < n || tail.some((e, i) => e.b !== list[i])) return false;
    for (let i = 1; i < n; i++) if (tail[i].t - tail[i - 1].t > w) return false;
    return includesLast || t - tail[n - 1].t <= w;
  }
  function readButtons(t) {
    pollPad();
    lastT = t;
    const charging = metersHeld();
    for (const b of BUTTONS) {
      let now = btnHeld(b);
      if (ignoreUntilUp.has(b)) { if (now) now = false; else ignoreUntilUp.delete(b); }   // held when a menu closed
      if (!P.buttonOn(b)) now = false;                             // a shoulder button that is not unlocked yet
      if (charging && (b === 'L1' || b === 'R1')) now = false;
      else if (charging && b === 'R') now = false;
      if (now && !isDown.has(b)) {
        isDown.add(b); reader.down(b, t);
        if (b === 'Up' && !charging) {
          if (P.has('fly') && comboSeq(['A', 'B', 'A', 'B'], t)) { comboLog.length = 0; startFlight(); }      // A, B, A, B, Up
          else if (!upIsCombo(t)) request('jump', 'press');   // Up jumps (and double jumps in the air)
        }
        if (b === 'A' || b === 'B') {
          comboLog.push({ b, t }); if (comboLog.length > 8) comboLog.shift();
          if (b === 'B') lastBClock = clock;
          if (b === 'B' && P.has('rainbow') && comboSeq(['A', 'B', 'A', 'B', 'A', 'B'], t + 1, true)) { comboLog.length = 0; startRainbow(); }   // A, B, A, B, A, B
        }
        if (b === 'Down') { if (t - lastDownT < DROP_TAP_MS && dropThrough()) lastDownT = -1e9; else lastDownT = t; }
        if (b === 'Left') facing = -1; else if (b === 'Right') facing = 1;
      } else if (!now && isDown.has(b)) {
        isDown.delete(b); reader.up(b, t); if (b === 'Down') lastDownRel = t;
        if (hold && hold.keys.includes(b)) { const m = hold.move; hold = null; request(m, 'release'); }   // (energy moves: see request)   // let go: the charged attack fires
        if (b === 'Left' && isDown.has('Right')) facing = 1;        // let go of the newer one: the other still held
        else if (b === 'Right' && isDown.has('Left')) facing = -1;
      }
    }
  }

  // ------------------------------------------------------------------ state
  // cur: {id, k: frame index, t: ms into the frame, base: [x, y] where the move started, kind}
  let cur = null, queued = null, x = 0, camX = 0, camY = 0;
  // Hold-and-release attacks: the chord (B+L1 energy kick, direction+A lunging thrust) starts a charge; letting go of a button fires the move.
  // Every attack named "energy" is charged: press and hold its buttons (the charge pose plays, energy drains, Max turns blue
  // when full) and let go to fire. A release before MIN_FIRE ms does nothing; a partial charge fires at 50% to 100% power.
  const HOLD_FIRE = { energy_kick: ['B', 'L1'], energy_burst: ['L2'], energy_wave: ['R2'], energy_dash_thrust: ['X', 'A'] };
  const ENERGY_HOLD = new Set(['energy_kick', 'energy_burst', 'energy_wave', 'energy_dash_thrust']);
  const MIN_FIRE = 250;
  let hold = null;                      // {move, keys}: the charge in progress
  let facing = 1, camLead = 0;          // facing: 1 right, -1 left (each move keeps the one it started with)
  let fall = null;                      // {y, v}: coming back down after a move that ends in the air
  let rumble = null;                    // {t0, ms, amp}: shake that outlasts a move (the earthquake)
  let clock = 0;
  // levels: the level being played, its loaded map, and the surface she stands on (see "levels" below)
  const LV = window.BIBOO_LEVELS, MAP_W = LV.MAP_W;
  let level = null, curMap = null;
  let screen = 'title';                 // 'title', 'overworld' or 'level'
  let floorY = 0;                       // height of the surface she stands on: 0 is the ground, a platform or barrier top is more
  let prevFeet = null, lastCx = null;   // her feet height and anchor x on the last frame, for landing and blocking
  const powerups = [], particles = [], banners = [];
  const AIR_SPEED = 0.16;               // px/ms she can steer sideways in the air (a jump reaches about 65 px)
  const CAM_KEEP = 100;                 // the camera only rises when she is higher than this above the ground
  let showBoxes = false;                // H: draw hurtboxes and hit shapes
  let stun = null;                      // {v: px/ms (signed), a: px/ms^2, y, vy}: knocked back, no control
  let slide = null;                     // {v, a}: the small push back of a blocked hit
  let tint = null;                      // {color, until}: her flash (red hit, white block)
  let invuln = 0;                       // clock time until she can be hit again
  const hitQ = [];                      // attack frames shown this tick: {f, px, py}
  const started = [];                   // every move started, for the log and the browser test
  const JUMP = D.moves.jump;
  const FALL_K = JUMP.frames.findIndex((f, i) => i > 0 && f.root[1] < JUMP.frames[i - 1].root[1]);
  const LAND_K = JUMP.frames.findIndex((f, i) => i > FALL_K && f.root[1] === 0);

  // root motion of frame k; the crash started in the air is scaled to begin at her height
  function rootOf(c, k = c.k) {
    if (c.phys) return [0, c.phys.y];                            // the plain jump is driven by physics, not by frame root motion
    const r = D.moves[c.id].frames[k].root, s = c.face || 1;
    return c.air ? [s * (r[0] - c.air.x0), r[1] * c.air.s] : [s * r[0], r[1]];
  }
  function airborne() {
    if (fall || (cur && cur.kind === 'fall')) return true;
    return !!cur && cur.kind === 'action' && cur.id !== 'jump_crash' && rootOf(cur)[1] > 0;
  }
  // A in the air: the crash starts at its raised-sword frame, at her current height and x
  function airCrash(via) {
    if (!canAfford('jump_crash')) { if (cur) cur.crash = false; deny('jump_crash'); return; }   // 30 energy, or no crash
    spend('energy', MOVE_COST.jump_crash[1]);
    const h = fall ? fall.y : rootOf(cur)[1];
    if (cur && !fall && cur.kind !== 'fall') x += rootOf(cur)[0];
    fall = null; queued = null;
    const m = D.moves.jump_crash, k0 = m.frames.findIndex(f => f.name === 'apex');
    const a = m.frames[k0].root;
    cur = { id: 'jump_crash', k: k0, t: 0, kind: 'action', from: x, face: facing, air: { x0: a[0], s: h / a[1] }, lite: h <= CRASH_HIGH, height: h };
    started.push({ id: 'jump_crash', via: via || 'air' });
    logMove('jump_crash', 'air');
    queueHit();
  }
  const AIR = D.input.bindings.filter(b => b.type === 'air');
  const usesButton = (input, b) => input.split(/[-+]/).includes(b);

  // first frame of a move: some moves skip their opening, or pick up from the pose of the move
  // they interrupt (the heavy chop starts from the charge pose, not from the idle guard)
  function entryFrame(id) {
    const m = D.moves[id], en = m.enter;
    if (!en) return 0;
    const find = name => m.frames.findIndex(f => f.name === name);
    if (cur && en.fromMove && en.fromMove[cur.id]) {
      const now = D.moves[cur.id].frames[cur.k].name;
      const k = find(en.fromMove[cur.id][now] || now);
      if (k >= 0) return k;
    }
    return Math.max(0, find(en.default));
  }

  // The heavy chop gets its black-and-white impact frame and camera shake only after a full charge
  // (Up held FULL_CHARGE ms); the crash only when it starts more than two body lengths up.
  // Without them the move plays its other frames and effects (the dirt plume) with no shake.
  const FULL_CHARGE = 1000, BODY_LEN = 82, CRASH_HIGH = 2 * BODY_LEN;
  // A full impact also holds its black-and-white frame a little longer and shakes the ground: the
  // shake starts on the frame where the blade lands and fades out over QUAKE_MS.
  const BW_HOLD = 110, QUAKE_AT = { heavy: 'impact', jump_crash: 'crash' }, QUAKE_MS = 1000, QUAKE_AMP = 14;
  const CHARGED_TINT = { color: '#2f7bff', alpha: 0.5 };   // Max turns blue once the charge is complete
  // Charging costs energy: CHARGE_ENERGY for a full charge, drawn evenly while Up is held. The charge only
  // grows while the meter can pay, so with no energy it stops where it is.
  const CHARGE_ENERGY = 20;
  let meterAcc = 0;                                          // ms toward the next L1+R1 meter tick
  let chargeMs = 0;                                          // charge built up so far, 0 to FULL_CHARGE
  const isCharged = () => !!cur && cur.id === 'charge' && chargeMs >= FULL_CHARGE;
  function stepCharge(dt) {
    if (chargeMs >= FULL_CHARGE) return;
    const want = dt * CHARGE_ENERGY / FULL_CHARGE, pay = Math.min(want, energyMeter);
    if (pay <= 0) return;
    spend('energy', pay);
    chargeMs = Math.min(FULL_CHARGE, chargeMs + dt * pay / want);
  }
  function impactQuake() {
    if (!cur || cur.kind !== 'action' || cur.lite) return;
    if (QUAKE_AT[cur.id] === D.moves[cur.id].frames[cur.k].name) rumble = { t0: clock, ms: QUAKE_MS, amp: QUAKE_AMP };
  }
  // The plain jump (Y) is a physics jump: a short crouch, then launch at JUMP_V0 (px/ms) under gravity JUMP_G. Gravity is
  // halved near the top so she hangs a moment, which makes it slower, smoother and floatier than the old frame by frame hop.
  // It rises about 135 px in 280 ms and stays up about 670 ms (the old hop was about 410 ms); with Left or Right held she covers about 107 px sideways. Steering in the air is
  // in step(). The sky dash (Down then Up) is a separate move and is unchanged.
  const FLY_MS = 5000, FLY_VY = 0.11, FLY_MIN = 6, FLY_MAX = 150;
  let flight = null, trailAcc = 0;
  function startFlight() {
    if (stun || flight || pitFall) return;
    const y0 = Math.max(heightAbove(), 0);
    if (cur && !fall && cur.kind !== 'fall') x += rootOf(cur)[0];
    fall = null; queued = null; slide = null; hold = null;
    cur = { id: 'jump', k: 3, t: 0, kind: 'action', face: facing, phys: { y: Math.max(y0, FLY_MIN) + 6, v: 0 } };
    flight = { until: clock + FLY_MS };
    floater(bodyX(), herY() + herTop() + 8, 'Flight', '#7fd0ff');
  }
  // Rainbow Guard: 5 seconds of complete invulnerability, cycling through the rainbow, and pitfalls count as solid ground
  const RAINBOW_MS = 5000, RAINBOW_CYCLE = 450;
  let rainbow = null;
  const rainbowOn = () => !!rainbow && clock < rainbow.until;
  function startRainbow() {
    if (stun || pitFall) return;
    rainbow = { until: clock + RAINBOW_MS }; invuln = Math.max(invuln, clock + RAINBOW_MS);
    floater(bodyX(), herY() + herTop() + 8, 'Rainbow', '#ffd24a');
  }
  const rainbowTint = () => ({ color: `hsl(${Math.floor(((clock - rainbow.until + RAINBOW_MS) % RAINBOW_CYCLE) / RAINBOW_CYCLE * 360)},100%,50%)`, alpha: 0.6, until: clock + 40 });
  // Ultimate Chain: after the four chain strikes, L1+R1+L2+R2 together: taunt, then the four beams one after another
  const ULT_STEPS = ['taunt', 'beam_plasma', 'beam_cloud', 'beam_fire', 'beam_laser'];
  let ult = null;
  function startUltimate() { if (!stun && !ult) ult = { steps: ULT_STEPS.slice() }; }
  function ultTick() {
    if (!ult) return;
    if (stun) { ult = null; return; }
    if (chainQueue.length || (cur && cur.kind === 'action') || fall || (cur && cur.kind === 'land')) return;
    const id = ult.steps.shift();
    if (!id) { ult = null; return; }
    if (D.moves[id] && !canAfford(id)) { deny(id); return; }       // no meter for this beam: on to the next
    queued = null; start(id, 'action', 'ultimate');
  }
  const JUMP_H = 130, JUMP_UP = 280, JUMP_G = 2 * JUMP_H / (JUMP_UP * JUMP_UP), JUMP_V0 = JUMP_G * JUMP_UP;
  const JUMP_HANG_V = 0.2 * JUMP_V0, JUMP_HANG_G = 0.5;
  function stepJump(dt) {
    const j = cur.phys;
    if (flight) {
      if (clock >= flight.until) flight = null;
      else {                                                       // flying: no gravity; Up and Down climb and dive
        const vy = ((isDown.has('Up') ? 1 : 0) - (isDown.has('Down') ? 1 : 0)) * FLY_VY;
        j.v = 0; j.y = Math.min(FLY_MAX, Math.max(FLY_MIN, j.y + vy * dt)); cur.k = 3;
        trailAcc += dt;
        while (trailAcc >= 25) {                                   // a trail of blue particles
          trailAcc -= 25;
          particles.push({ wx: legsX() + (Math.random() - 0.5) * 8, wy: herY() + 10 + Math.random() * 12, vx: (Math.random() - 0.5) * 0.04 - hf() * 0.02, vy: (Math.random() - 0.5) * 0.03, t0: clock, life: 450 + Math.random() * 250, c: ['#2f7bff', '#7fd0ff', '#1b46d8', '#bfe8ff'][Math.floor(Math.random() * 4)] });
        }
        return;
      }
    }
    j.v -= JUMP_G * (Math.abs(j.v) < JUMP_HANG_V ? JUMP_HANG_G : 1) * dt;
    j.y += j.v * dt;
    cur.k = j.v > 0.6 * JUMP_V0 ? 1 : j.v > 0.2 * JUMP_V0 ? 2 : j.v > -0.2 * JUMP_V0 ? 3 : 4;   // takeoff, rise, apex, fall frames
    if (j.y <= 0 && j.v < 0) {                                   // back down to the height she left from
      const y = j.y, vv = -j.v;
      if (floorY > 0) {                                          // she left a platform and walked off it in the air: keep falling
        const S = supportUnder(playerX(), floorY + 0.5);
        if (S < floorY - 0.5) {
          fall = { y: (floorY - S) + y, v: vv }; floorY = S;
          cur = { id: 'jump', k: FALL_K, t: 0, kind: 'fall', face: cur.face };
          return;
        }
      }
      cur = { id: 'jump', k: LAND_K, t: 0, kind: 'land', face: cur.face };
    }
  }
  // Double jump (an unlock): tap jump again in the air for a spinning second jump that rises about two more of her heights
  // (81 px). One per trip through the air; it resets when she touches down.
  const DJ_H = 2 * 81, SPIN_MS = 420;
  const DJ_V = Math.sqrt(2 * JUMP_G * 0.75 * DJ_H);            // the top of the arc is slower (halved gravity), so a little less than 2 g H
  let dblUsed = false;
  function tryDoubleJump() {
    if (!P.has('double_jump') || dblUsed || stun) return false;
    if (cur && cur.id === 'jump' && cur.kind === 'action' && cur.phys) { /* in the flight */ }
    else if (fall || (cur && cur.id === 'jump' && cur.kind === 'fall')) {           // dropped off a ledge or from a drop-through
      cur = { id: 'jump', k: 3, t: 0, kind: 'action', face: cur ? cur.face : facing, phys: { y: fall ? fall.y : 0, v: 0 } };
      fall = null;
    } else return false;
    cur.phys.v = Math.max(cur.phys.v, DJ_V);
    cur.spin = clock; dblUsed = true; queued = null;
    return true;
  }
  // double tap Down on a platform: drop through it to whatever is below
  const DROP_TAP_MS = 300;
  let lastDownT = -1e9;
  function dropThrough() {
    if (!curMap || floorY <= 0 || fall || stun) return false;
    if (cur && cur.kind !== 'hold' && cur.kind !== 'land') return false;
    const px = playerX();
    if (curMap.solids.some(sd => sd.top === floorY && overSurf(sd, span(px)))) return false;   // a block is not a plank
    const S = supportUnder(px, floorY);
    if (S >= floorY - 0.5) return false;
    if (cur) x += rootOf(cur)[0];
    fall = { y: floorY - S, v: 0.05 }; floorY = S;
    cur = { id: 'jump', k: FALL_K, t: 0, kind: 'fall', face: cur ? cur.face : facing };
    prevFeet = herY();
    return true;
  }
  function start(id, kind, via) {
    const k0 = entryFrame(id);
    let charged = cur && cur.id === 'charge' ? chargeMs : 0;
    if (via === 'chain' && (id === 'heavy' || id === 'energy_burst')) {          // the chain's finishers: no charging, but the energy is paid
      const pay = Math.min(CHARGE_ENERGY, energyMeter); spend('energy', pay); charged = FULL_CHARGE * pay / CHARGE_ENERGY;
    }
    if (id === 'charge' && !(cur && cur.id === 'charge')) chargeMs = 0;
    if (cur) x += rootOf(cur)[0];       // keep the ground covered so far; height resets
    cur = { id, k: k0, t: 0, kind, from: x, face: facing };
    if (id === 'parry') lastParryT = clock;
    if (id === 'heavy') { cur.lite = charged < FULL_CHARGE; cur.charged = charged; }
    if (ENERGY_HOLD.has(id) && (via === 'release' || via === 'chain')) cur.power = 0.5 + 0.5 * Math.min(1, charged / FULL_CHARGE);   // the charge sets the power
    if (kind === 'action' && MOVE_COST[id]) { const n = needOf(id); spend(n[0], n[1]); }
    if (kind === 'action') queueHit();
    if (id === 'taunt') {
      for (const en of enemies) {
        if (!alive(en) || isBoss(en)) continue;                      // bosses are immune to the taunt
        aggro(en, false);
        en.taunted = true; en.dropEmpower = true; en.speedMul = 2; en.dmgMul = 2;
        en.tint = TAUNT_TINT;
      }
    }
    if (kind === 'action' || kind === 'land') {
      started.push({ id, via: via || kind });
      logMove(id, via);
    }
  }

  // ---- The attack chain (unlocks 'chain', 'chain_burst'): mash A. The 1st press is the normal slash, the 2nd to 4th are the chain strikes
  // (chain2 to chain4, no knockback), the 5th is the heavy chop without charging it (it still costs CHARGE_ENERGY). With 'chain_burst', a B tap
  // after the 4th A ends the chain in an energy burst instead. A press cancels the recovery of the move before it once its hit frames are over.
  const CHAIN_MS = 750, CHAIN_MOVES = ['slash', 'chain2', 'chain3', 'chain4'];
  let chain = { n: 0, t: -1e9 }, chainQueue = [];
  const lastHitFrame = id => { const fr = D.moves[id].frames; let k = -1; fr.forEach((f, i) => { if (f.hits && f.hits.length) k = i; }); return k; };
  const chainBusy = () => !!cur && cur.kind === 'action' && cur.k <= lastHitFrame(cur.id);      // the move before it is still hitting
  function chainGo(move) {                                           // play it now, or in order as soon as the move before it has finished hitting
    if (!chainQueue.length && !chainBusy()) { queued = null; start(move, 'action', 'chain'); }
    else chainQueue.push(move);
  }
  function chainTick() {
    if (!chainQueue.length) return;
    if (stun) { chainQueue.length = 0; return; }
    if (chainBusy()) return;
    queued = null; start(chainQueue.shift(), 'action', 'chain');
  }
  function chainPress() {                                            // an A press with the chain unlocked; true when the chain handled it
    if (!P.has('chain') || stun || fall || airborne() || (hold && ENERGY_HOLD.has(hold.move))) { chain.n = 0; return false; }
    const n = clock - chain.t <= CHAIN_MS && lastBClock <= chain.t ? chain.n + 1 : 1;   // a B in between starts the count over
    if (n === 1) { chain = { n: 1, t: clock }; return false; }       // the plain slash
    if (n <= 4) { chain = { n, t: clock }; chainGo(CHAIN_MOVES[n - 1]); return true; }
    chain = { n: 0, t: -1e9 };                                       // 5th press: the heavy chop, uncharged
    if (energyMeter < 1) return true;                                // no energy for the chop: the chain simply ends
    chainGo('heavy');
    return true;
  }
  function chainBurst() {                                            // a B tap right after the 4th A
    if (!P.has('chain_burst') || chain.n !== 4 || clock - chain.t > CHAIN_MS || stun || airborne()) return false;
    chain = { n: 0, t: -1e9 };
    if (energyMeter < 1) return true;
    chainGo('energy_burst');
    return true;
  }
  function request(move, via) {
    if (!D.moves[move] || stun || !moveOpen(move)) return;
    if (move === 'jump' && tryDoubleJump()) return;
    if (!canAfford(move)) { deny(move); return; }             // no meter: the move does not play
    const air = via === 'sequence' && (/^Up-/.test(D.moves[move].input) || move === 'meteor_shower') ? null     // Up then A (heavy, meteor shower) is not the air A
              : AIR.find(b => usesButton(D.moves[move].input, b.input));
    const inAir = airborne() || (cur && cur.id === 'jump' && cur.kind === 'action');
    if (ENERGY_HOLD.has(move) && via === 'release') {                   // let go of an energy charge: fire it if it was held long enough
      if (!(cur && cur.id === 'charge' && chargeMs >= MIN_FIRE)) return;
    } else if (ENERGY_HOLD.has(move)) {                                 // press and hold to charge (on the ground only)
      if (inAir || fall || (cur && cur.kind === 'action' && cur.id !== 'charge')) return;
      if (energyMeter < 1) { meterFlash.energy = clock + 500; return; }
      hold = { move, keys: HOLD_FIRE[move] }; queued = null;
      return;
    }
    if (air && inAir && !moveOpen('jump_crash')) return;      // A in the air does nothing until the crash is unlocked
    if (air) {
      if ((airborne() || (cur && cur.id === 'jump' && cur.kind === 'action')) && !canAfford('jump_crash')) { deny('jump_crash'); return; }
      if (airborne()) { airCrash(via); return; }
      // pressed during the jump's crouch: crash as soon as she leaves the ground
      if (cur && cur.id === 'jump' && cur.kind === 'action') { cur.crash = true; return; }
    }
    if (fall || (cur && cur.kind === 'land')) { queued = { move, via }; return; }
    const busy = cur && cur.kind === 'action';
    if (!busy || via !== 'press') start(move, 'action', via);   // chords, sequences, taps, releases cancel
    else queued = { move, via };                                 // a plain press waits its turn
  }

  function finishAction(t) {
    const m = D.moves[cur.id];
    if (m.aftershake && cur.kind === 'action') rumble = { t0: clock, ms: m.aftershake.ms, amp: m.aftershake.amp };
    const end = rootOf(cur, m.frames.length - 1);
    if (end[1] > 0) {                                            // ended in the air: fall back down
      x += end[0];
      fall = { y: end[1], v: 0 };
      cur = { id: 'jump', k: FALL_K, t: 0, kind: 'fall', face: cur.face };
      return;
    }
    x += end[0];
    cur = null;
    if (queued && !canAfford(queued.move)) { deny(queued.move); queued = null; }
    if (queued) { const q = queued; queued = null; start(q.move, 'action', q.via); }
    else holdState(t);
  }

  // Left and Right both walk with the forward walk; which way she goes and faces is `facing`
  const holdId = id => id === 'walk_left' ? 'walk_right' : id;
  const holdWant = t => { if (metersHeld() || hold) return 'charge'; const w = holdId(reader.holdMove(t)); return w === 'recover' && empowerMeter < HEAL_COST ? 'idle' : w; };
  function holdState(t) {
    const want = holdWant(t);
    if (!cur || cur.id !== want || cur.face !== facing) start(want, 'hold');
  }

  // a light heavy chop or crash passes straight over its black-and-white frame
  function msOf(c, k) { const f = D.moves[c.id].frames[k]; return f.bw ? (c.lite ? 0 : BW_HOLD) : f.ms; }

  function step(dt, t) {
    if (stun) { hold = null; stepStun(dt); return; }
    if (slide) {
      x += slide.v * dt;
      const v = slide.v - Math.sign(slide.v) * slide.a * dt;
      slide.v = Math.sign(v) === Math.sign(slide.v) ? v : 0;
      slide.vy += 0.0018 * dt; slide.y = Math.max(0, slide.y - slide.vy * dt);      // the KNOCK_UP hop
      if (slide.v === 0 && slide.y === 0 && slide.vy >= 0) slide = null;
    }
    // steering in the air: hold Left or Right while a jump is up or she is falling
    const steer = (isDown.has('Right') ? 1 : 0) - (isDown.has('Left') ? 1 : 0);
    if (steer && (fall || (cur && (cur.kind === 'fall' || (cur.kind === 'action' && cur.id === 'jump' && rootOf(cur)[1] > 0))))) {
      x += steer * AIR_SPEED * dt; facing = steer; if (cur) cur.face = steer;
    }
    if (fall) {                                                  // simple gravity, px/ms^2
      fall.v += 0.0018 * dt;
      fall.y -= fall.v * dt;
      if (fall.y <= 0) { fall = null; cur = { id: 'jump', k: LAND_K, t: 0, kind: 'land', face: cur ? cur.face : facing }; }
      return;
    }
    if (!cur) holdState(t);
    if (cur.id === 'jump' && cur.kind === 'action') {            // the plain jump: crouch, then physics until she lands
      if (cur.phys) { stepJump(dt); return; }
      cur.t += dt;
      if (cur.t >= msOf(cur, 0)) { cur.phys = { y: 0, v: JUMP_V0 }; cur.k = 1; cur.t = 0; }
      return;
    }
    if (cur.kind === 'hold') {
      const want = holdWant(t);
      if (want !== cur.id || cur.face !== facing) { start(want, 'hold'); }
    }
    const m = D.moves[cur.id];
    cur.t += dt;
    while (cur.t >= msOf(cur, cur.k)) {
      cur.t -= msOf(cur, cur.k);
      cur.k++;
      if (cur.k < m.frames.length) { if (cur.kind === 'action') { queueHit(); impactQuake(); } continue; }
      if (cur.kind === 'land') { cur.k = m.frames.length - 1; finishAction(t); return; }
      if (cur.kind === 'action') { if (cur.id === 'beam_cloud' && btnHeld('A') && energyMeter >= BEAM_TICK_COST.cloud) { cur.beamCut = false;  const bi = D.moves.beam_cloud.frames.findIndex(f => f.beam); cur.k = bi >= 0 ? bi : 2; continue; } cur.k = m.frames.length - 1; finishAction(t); return; }
      if (m.loop) {                                              // next cycle carries on from here
        const r = m.frames.map(f => f.root[0]);
        const n = r.length;
        x += cur.face * (r[n - 1] + (n > 1 ? r[n - 1] - r[n - 2] : 0) - r[m.loopFrom]);
        cur.k = m.loopFrom;
      } else cur.k = m.frames.length - 1;
    }
  }

  const BOTH_SIDES = new Set(['spin_attack', 'energy_wave']);
  function queueHit() {
    const f = D.moves[cur.id].frames[cur.k];
    const r = rootOf(cur);
    if (cur.id === 'energy_wave' && f.name === 'plow') {                        // a projectile that touched nothing bursts at the end of its flight
      const px = x + r[0];
      for (const side of [cur.face, -cur.face]) waveBlast(cur, side, px + side * WAVE_END, 20);
    }
    if (f.hits) {
      hitQ.push({ f, px: x + r[0], py: r[1] + floorY, face: cur.face, mv: cur });
      if (BOTH_SIDES.has(cur.id)) hitQ.push({ f, px: x + r[0], py: r[1] + floorY, face: -cur.face, mv: cur });   // the spin also cuts behind her
    }
  }

  // ------------------------------------------------------------------ health and damage
  // Tunable numbers. A move hurts each enemy once per use (moves in REHIT_MS again after that many ms);
  // beams hurt on every tick they touch. The heavy chop and the crash do more when full.
  const ENEMY_HP = { goblin: 60, orc: 200 }, ENEMY_DMG = { goblin: 12, orc: 30 };
  const DAMAGE = { slash: 25, heavy_horizontal: 50, thrust: 15, upswing: 15, push_kick: 10, heavy_kick: 25, energy_kick: 30, energy_burst: 50,
                   dash_thrust: 25, energy_dash_thrust: 50, spin_attack: 20, energy_wave: 0, earthquake: 250, meteor_shower: 200,
                   chain2: 15, chain3: 18, chain4: 22 };      // the chain strikes (no knockback: they are not in KNOCK)
  // knockback of the moves that push an enemy: [distance px, duration ms]
  const KNOCK = { heavy: [25, 100], slash: [25, 100], heavy_horizontal: [50, 100], push_kick: [100, 200], energy_kick: [200, 300], energy_burst: [100, 500] };
  const BOTH_SIDES_PUSH = new Set(['energy_burst']);
  const PARRY_KNOCK = [100, 400];                                    // an enemy parried: pushed back this far, stunned this long
  const REHIT_MS = { earthquake: 250, meteor_shower: 300 };
  const BEAM_DMG = { cloud: 5, fire: 15, laser: 15, plasma: 0 };
  const BEAM_PUSH = { cloud: 0, fire: 5, laser: 20, plasma: 30 };     // px an enemy is shoved back on every tick it is touched
  // the heavy overhead chop: 200 on a direct hit; where the blade lands it also blasts every other enemy within
  // HEAVY_AOE_R px for HEAVY_AOE_DMG and pushes it back (KNOCK.heavy). The charge no longer scales the damage.
  const HEAVY_DMG = 200, HEAVY_AOE_DMG = 150, HEAVY_AOE_R = 25
  const CRASH_DMG = 300, CRASH_COST = 30;      // the jump crash: flat damage, energy paid when it starts
  const HEAL_EVERY = 350, HEAL_AMOUNT = 5, KO_MS = 1500;
  const dmgOf = c => c.id === 'heavy' ? HEAVY_DMG : c.id === 'jump_crash' ? CRASH_DMG : (c.id in DAMAGE ? Math.round(DAMAGE[c.id] * (c.power || 1)) : 15);   // 0 is a real value (the wave hurts only by its blast)
  let hp = maxHp(), hpOverride = null, healAcc = 0;
  const floaters = [];                  // {wx, wy, text, color, t0}: numbers that rise and fade
  const FLOAT_MS = 900;
  const GREEN = '#3dff6e';
  function floater(wx, wy, text, color) { floaters.push({ wx, wy, text, color, t0: clock }); }
  // ---- Sunset Training: the heavy bag swings and counts, Slime Bunny gives tips. Nothing here touches progress.
  const train = { last: 0, total: 0, hits: 0, combo: 0, comboAt: -1e9, t0: 0 };
  const TIPS = [
    "Hi, I'm Slime Bunny! Welcome to Sunset Training. Hit the heavy bag with any move you own.",
    "To see your moves: press Start (pad) or Enter, Space or Escape (keyboard), then pick Moves: Gamepad or Moves: Keyboard.",
    "The lists only show moves you own. Buy more from the Bone Merchant on the overworld with Leaves.",
    "The bag never breaks. Your last hit, total damage, hits and combo are at the top right.",
    "Your meters and health refill here, so try everything, even the beams.",
    "Tap B to parry, hold B to block. A parry pushes enemies back and reflects shards.",
    "Mash A for the attack chain once you have it. More combos hide in the later levels.",
    "Ready to go? Open the menu and choose Back to the overworld.",
  ];
  function bagHit(e, dmg) {                                       // any hit on the bag: count it, swing it, spark
    if (dmg <= 0) return;
    const b = hurtOf(e), cx = b ? (b[0] + b[2]) / 2 : e.x, cy = b ? (b[1] + b[3]) / 2 : 30;
    train.total += dmg;
    if (!beamTick) { train.last = dmg; train.hits++; train.combo = clock - train.comboAt < 1400 ? train.combo + 1 : 1; train.comboAt = clock; }
    const dir = bodyX() <= e.x ? 1 : -1;
    e.sw = e.sw || { a: 0, v: 0 };
    e.sw.v += dir * Math.min(0.012, 0.0025 + dmg * 0.00007);
    floater(cx, (b ? b[3] : 60) + 4, '-' + dmg, RED);
    if (!beamTick) impact(cx, cy, dmg, null, false);
    e.tint = { color: WHITE, alpha: 0.5, until: clock + 70 };
  }
  function stepBag(e, dt) {                                        // a pendulum: it swings back and settles
    e.hp = e.maxHp; e.scale = 1; e.state = 'idle'; e.taunted = false;
    const w = e.sw = e.sw || { a: 0, v: 0 };
    w.v += (-0.00016 * w.a - 0.0035 * w.v) * dt * 4; w.a += w.v * dt;
    w.a = Math.max(-1.2, Math.min(1.2, w.a));
  }
  function drawTraining(sx, sy) {                                  // Slime Bunny: bobbing on the right
    const B = D.training && D.training.bunny; if (!B || !level || !level.def.training) return;
    const gy = V.feetRow + camY + sy, X = BUNNY_X + sx, ph = (clock % 1800) / 1800, hop = ph < 0.25 ? Math.sin(ph / 0.25 * Math.PI) * 9 : 0;
    const sq = ph < 0.25 ? 1.08 : 1 + 0.05 * Math.sin(clock / 260), sc = SPRITE_SCALE;
    g.save(); g.translate(Math.round(X), Math.round(gy - hop)); g.scale(1 / sq, sq);
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(0, hop, 14, 3, 0, 0, 7); g.fill();
    g.drawImage(img[B.sheet].im, 0, 0, B.cell[0], B.cell[1], -B.anchor[0] * sc, -B.anchor[1] * sc, B.cell[0] * sc, B.cell[1] * sc);
    g.restore();
  }
  const BUNNY_X = 338;
  function wrapText(txt, maxW) {
    const words = txt.split(' '), lines = []; let cur = '';
    for (const w of words) { const t = cur ? cur + ' ' + w : w; if (g.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
    if (cur) lines.push(cur); return lines;
  }
  function drawTrainingHud() {
    if (!level || !level.def.training) return;
    g.save(); g.textBaseline = 'top'; g.lineJoin = 'round';
    g.font = 'bold 7px monospace'; g.textAlign = 'right'; g.lineWidth = 2;
    const rows = [['LAST HIT', train.last], ['TOTAL', train.total], ['HITS', train.hits], ['COMBO', clock - train.comboAt < 1400 ? train.combo : 0]];
    rows.forEach(([k, v], i) => { const y = 20 + i * 10; g.strokeStyle = '#000'; g.fillStyle = '#ffb0f0'; g.strokeText(k, V.w - 52, y); g.fillText(k, V.w - 52, y); g.fillStyle = '#fff'; g.strokeText(String(v), V.w - 8, y); g.fillText(String(v), V.w - 8, y); });
    // the speech bubble
    const tip = TIPS[Math.floor((clock - train.t0) / 8500) % TIPS.length];
    g.font = '7px monospace'; g.textAlign = 'left';
    const lines = wrapText(tip, 150), w = Math.min(166, Math.max(...lines.map(l => g.measureText(l).width)) + 12), h = lines.length * 9 + 8;
    const bx = Math.max(6, Math.min(V.w - w - 6, BUNNY_X - w / 2)), by = V.feetRow - 36 - h;
    g.fillStyle = 'rgba(255,255,255,0.95)'; g.strokeStyle = '#7a2a8a'; g.lineWidth = 1.5;
    g.beginPath(); g.rect(bx, by, w, h); g.fill(); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.95)'; g.beginPath(); g.moveTo(BUNNY_X - 6, by + h); g.lineTo(BUNNY_X + 4, by + h); g.lineTo(BUNNY_X, by + h + 8); g.closePath(); g.fill(); g.stroke();
    g.fillRect(BUNNY_X - 5, by + h - 1, 9, 3);
    g.fillStyle = '#3a1048'; lines.forEach((l, i) => g.fillText(l, bx + 6, by + 5 + i * 9));
    g.restore();
  }
  // ---- hit feedback: a brief freeze on impact (hit-stop), a starburst and sparks where it lands, a screen flash and shake on big hits
  let freeze = 0, screenFlash = null, beamTick = false;
  const flashes = [];                                            // {wx, wy, t0, ms, r, c}: starbursts
  const hitStop = ms => { freeze = Math.min(160, Math.max(freeze, ms)); };
  const shakeFor = (ms, amp) => { if (!rumble || rumble.amp * (1 - (clock - rumble.t0) / rumble.ms) < amp) rumble = { t0: clock, ms, amp }; };
  function impact(wx, wy, dmg, color, killed) {
    const big = dmg >= 100 || killed, mid = dmg >= 30;
    flashes.push({ wx, wy, t0: clock, ms: big ? 260 : mid ? 200 : 150, r: big ? 26 : mid ? 18 : 12, c: color || '#fff6c0' });
    burst(wx, wy, big ? 16 : mid ? 10 : 6, [color || '#fff6c0', '#ffd24a', '#ffffff']);
    hitStop(big ? 130 : mid ? 80 : 45);
    if (big) { screenFlash = { c: '#ffffff', a: 0.4, t0: clock, ms: 120 }; shakeFor(220, 3); }
    else if (mid) shakeFor(140, 1.5);
  }
  function herHitFx() {                                          // she is hurt: a short freeze, a red flash, a shake and a red starburst
    hitStop(100); shakeFor(200, 2.5); screenFlash = { c: '#ff2020', a: 0.35, t0: clock, ms: 200 };
    flashes.push({ wx: bodyX(), wy: herY() + 22, t0: clock, ms: 220, r: 20, c: '#ff6060' });
  }
  function hurtEnemy(e, dmg) {
    if (!alive(e)) return;
    if (e.type === 'heavybag') { bagHit(e, dmg); return; }
    aggro(e, false);                                  // being hit wakes a patrolling enemy, even for 0 damage
    if (dmg <= 0) return;
    e.hp = Math.max(0, e.hp - dmg);
    const b = hurtOf(e);
    if (b) floater((b[0] + b[2]) / 2, b[3] + 4, '-' + dmg, RED);
    if (!e.tint || clock >= e.tint.until) e.tint = { color: RED, alpha: 0.55, until: clock + 110 };
    if (b && !beamTick) impact((b[0] + b[2]) / 2, (b[1] + b[3]) / 2, dmg, null, e.hp <= 0);
    if (e.hp <= 0) kill(e);
  }
  const cheats = { invincible: false, infinite: false, nopit: false };   // set from the Cheats menu (L1+R1+L2+R2 in the pause menu reveals it)
  let cheatsShown = false;
  function hurtHer(dmg) {
    if (dmg <= 0 || cheats.invincible || rainbowOn()) return;
    hp = Math.max(0, hp - dmg);
    floater(bodyX(), herY() + herTop() + 6, '-' + dmg, RED);
  }
  function stepHeal(dt) {
    stepGems(dt);
    if (cur && cur.id === 'charge' && cur.kind === 'hold' && !stun) {
      if (metersHeld()) {                                          // L1+R1: ENG, EMP and SUP each fill by 1 per tick
        meterAcc += dt;
        while (meterAcc >= METER_CHARGE_TICK) {
          meterAcc -= METER_CHARGE_TICK;
          energyMeter = Math.min(maxOf('energy'), energyMeter + METER_CHARGE_STEP);
          empowerMeter = Math.min(maxOf('empower'), empowerMeter + METER_CHARGE_STEP);
          superMeter = Math.min(maxOf('super'), superMeter + METER_CHARGE_STEP);
        }
      } else if (!hold || ENERGY_HOLD.has(hold.move)) stepCharge(dt);
    } else meterAcc = 0;
    if (!cur || cur.id !== 'recover' || cur.kind !== 'hold' || stun || hp >= maxHp()) { healAcc = 0; return; }
    healAcc += dt;
    while (healAcc >= HEAL_EVERY && hp < maxHp() && empowerMeter >= HEAL_COST) {
      healAcc -= HEAL_EVERY;
      empowerMeter = Math.max(0, empowerMeter - HEAL_COST);
      const n = Math.min(HEAL_AMOUNT, maxHp() - hp);
      hp += n;
      floater(bodyX(), herY() + herTop() + 6, '+' + n, GREEN);
    }
  }

  // ------------------------------------------------------------------ beams
  // A beam move's frames carry beam: {kind, x, y}: where the beam leaves the blade tip (px from her
  // anchor, y up). The beam is a tiled texture from D.beams that scrolls away from her, grows out over
  // its first moments and reaches BEAM_LEN px; every BEAM_TICK ms it hits the enemies it touches.
  const BEAM_LEN = 500, BEAM_GROW = 8, BEAM_SPEED = 0.45, BEAM_TICK = 100, BEAM_CORE = 0.7;
  function beamNow() {
    if (!cur || cur.kind !== 'action' || cur.beamCut) return null;
    const m = D.moves[cur.id], f = m.frames[cur.k];
    if (!f.beam) return null;
    let k0 = cur.k;
    while (k0 > 0 && m.frames[k0 - 1].beam) k0--;
    let el = cur.t;
    for (let k = k0; k < cur.k; k++) el += m.frames[k].ms;
    const r = rootOf(cur), T = D.beams[f.beam.kind];
    const len = Math.min(BEAM_LEN, 40 + el * BEAM_GROW);
    const HILT_X = 58 * SPRITE_SCALE, HILT_Y = 48 * SPRITE_SCALE;
    const ox = x + r[0] + cur.face * HILT_X, oy = r[1] + floorY + HILT_Y;
    const last = cur.k + 1 >= m.frames.length || !m.frames[cur.k + 1].beam;
    return { kind: f.beam.kind, face: cur.face, ox, oy, len, el, last, T,
             box: [Math.min(ox, ox + cur.face * len), oy - T.h * BEAM_CORE / 2, Math.max(ox, ox + cur.face * len), oy + T.h * BEAM_CORE / 2] };
  }
  function beamHits() {
    const b = beamNow();
    if (!b) { if (cur) cur.beamT = 0; return; }
    if (clock < (cur.beamT || 0)) return;
    cur.beamT = clock + BEAM_TICK;
    const k = b.kind === 'plasma' ? 'empower' : 'energy', cost = BEAM_TICK_COST[b.kind] || 5;
    if (meterOf(k) < cost) {                                     // the meter ran dry: the beam stops and she recovers
      cur.beamCut = true; meterFlash[k] = clock + 500;
      const fr = D.moves[cur.id].frames;
      let j = cur.k; while (j < fr.length && fr[j].beam) j++;
      cur.k = Math.min(j, fr.length - 1); cur.t = 0;
      return;
    }
    spend(k, cost);                                              // every tick costs, whether or not it hits
    for (const e of enemies) { const box = hurtOf(e); if (box && overlap(box, b.box)) beamHit(e, b); }
    if (curMap) for (const c of curMap.crates) if (!c.broken && overlap(crateBox(c), b.box)) breakCrate(c);
    bombsInBox(b.box);
  }
  function beamHit(e, b) {
    if (b.kind === 'plasma' && isBoss(e)) return;                  // bosses are immune to the Empowerment Beam (no growing, no shove)
    if (b.kind === 'plasma') {
      e.scale = Math.max(e.scale || 1, 1.6);
      e.dropEnergy = true;
      e.tint = { color: '#a0f', alpha: 0.4, until: clock + 400 };
    }
    const was = alive(e);
    beamTick = true; hurtEnemy(e, BEAM_DMG[b.kind] || 0); beamTick = false;
    if (was && !alive(e)) lootGem(e.x, 'super', e.fy);                 // killed by a beam: a Super Gem
    const push = BEAM_PUSH[b.kind] || 0;
    if (push && alive(e)) { e.x += b.face * push; e.base += b.face * push; e.shoved = clock; }   // shoved away along the beam
  }
  function drawBeam(sx, sy) {
    const b = beamNow();
    if (!b) return;
    const X = V.anchorX + (b.ox - camX) + sx, Y = V.feetRow + camY + sy - b.oy;
    const im = img[b.T.src].im, w = b.T.w, h = b.T.h;
    const off = Math.floor(clock * BEAM_SPEED) % w;
    g.save();
    g.translate(Math.round(X), Math.round(Y));
    if (b.face < 0) g.scale(-1, 1);
    g.beginPath(); g.rect(0, -h, Math.ceil(b.len), h * 2); g.clip();
    if (b.last) g.globalAlpha = 0.6;
    for (let xx = off - w; xx < b.len; xx += w) g.drawImage(im, xx, -Math.round(h / 2));
    g.restore();
  }

  // ------------------------------------------------------------------ levels: maps, barriers, platforms, crates
  // A level is 10 one-screen maps (web/levels.js). loadMap() builds the current one. The camera never scrolls sideways,
  // so world x is screen x. Barriers (solids) block walking and can be stood on; platforms can be stood on and jumped
  // up through. She is always standing on `floorY`; in the air her height above it comes from the jump animation, and
  // physics() lands her on a surface she falls onto or drops her off the edge of one.
  const surfaces = m => m.solids.concat(m.plats);
  // Her sprite counts as touching a surface when ANY part of it is over the surface: bx is the anchor, and the span
  // is her drawn body (hurtbox plus SPRITE_PAD each side), not just the anchor point.
  const SPRITE_PAD = 6;
  function span(bx) {
    const f = hf(), a = bx + Math.min(f * HURT[0], f * HURT[2]) - SPRITE_PAD, b = bx + Math.max(f * HURT[0], f * HURT[2]) + SPRITE_PAD;
    return [Math.min(a, bx), Math.max(b, bx)];
  }
  const overSurf = (s, sp) => sp[1] >= s.x0 - 3 && sp[0] <= s.x1 + 3;
  function supportBelow(bx, y) {                 // the highest surface at or below height y under her (the ground is 0)
    let best = 0;
    if (!curMap) return 0;
    const sp = span(bx);
    for (const s of surfaces(curMap)) if (overSurf(s, sp) && s.top <= y + 0.5 && s.top > best) best = s.top;
    return best;
  }
  function supportUnder(bx, y) {                 // the highest surface strictly below height y under her (the ground is 0)
    let best = 0;
    const sp = span(bx);
    for (const s of surfaces(curMap)) if (overSurf(s, sp) && s.top < y - 1 && s.top > best) best = s.top;
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
      const sp = span(px);                                         // coming down onto a crate smashes it (any part of her over it)
      for (const c of curMap.crates) {
        if (c.broken) continue;
        const bx = crateBox(c);
        if (sp[1] >= bx[0] && sp[0] <= bx[2] && prevFeet > bx[3] - 2 && feet <= bx[3] + 1) breakCrate(c);
      }
      let T = -1;
      for (const sf of surfaces(curMap)) if (sf.top > floorY && overSurf(sf, span(px)) && prevFeet > sf.top && feet <= sf.top && sf.top > T) T = sf.top;
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


  // ------------------------------------------------------------------ hazards: goblin shots, bombs, pitfalls
  // Shots: the goblin's backflip (its "dive" animation) throws two blue shards at frames SHOT_AT. Each flies in a straight line
  // at where she was when it was thrown and does SHOT_DMG. Holding B blocks one for no damage; a parry reflects it straight
  // forward (the way she faces) and the reflected shard hurts enemies and sets off bombs.
  const SHOT_SPEED = 0.24, SHOT_DMG = 20, SHOT_R = 5, SHOT_AT = [1, 3];
  const shots = [];                      // {x, y, vx, vy, from: 'foe' | 'her', t0, home?}
  // The combo's backflip leaves three streak shards. Each flies up and away at first, then after HOME_DELAY ms curves toward her
  // (turning at most HOME_TURN rad/ms) until it hits, is blocked, or is reflected. Parry is generous: a parry pressed up to
  // PARRY_EARLY ms before a shard arrives counts, and a shard that has reached her waits PARRY_LATE ms for a parry before it hurts.
  const COMBO_SHOT_AT = [3, 4, 6], COMBO_ANGLES = [28, 48, 72], COMBO_SHOT_DMG = 10;
  const COMBO_SPEED = 0.2, HOME_SPEED = 0.17, HOME_DELAY = 500, HOME_TURN = 0.0035, PARRY_EARLY = 450, PARRY_LATE = 300;
  let lastParryT = -1e9;
  function fireComboShard(e, n) {
    const a = COMBO_ANGLES[n] * Math.PI / 180, ox = e.x + e.face * 10, oy = (e.fy || 0) + 44;
    shots.push({ x: ox, y: oy, vx: e.face * Math.cos(a) * COMBO_SPEED, vy: Math.sin(a) * COMBO_SPEED, from: 'foe', t0: clock, home: true, streak: true, dmg: COMBO_SHOT_DMG });
  }
  function fireShot(e) {
    const ox = e.x + e.face * 14, oy = (e.fy || 0) + 40;
    const dx = bodyX() - ox, dy = herY() + herTop() * SPRITE_SCALE * 0.5 - oy, L = Math.hypot(dx, dy) || 1;
    shots.push({ x: ox, y: oy, vx: SHOT_SPEED * dx / L, vy: SHOT_SPEED * dy / L, from: 'foe', t0: clock });
  }
  function stepShots(dt) {
    for (let i = shots.length - 1; i >= 0; i--) {
      const sh = shots[i];
      if (sh.home && sh.from === 'foe' && clock - sh.t0 > HOME_DELAY && !sh.contactAt) {          // after the delay: curve toward her body
        const ta = Math.atan2(herY() + herTop() * SPRITE_SCALE * 0.5 - sh.y, bodyX() - sh.x), ca = Math.atan2(sh.vy, sh.vx);
        let d = ta - ca; d = Math.atan2(Math.sin(d), Math.cos(d));
        const na = ca + Math.max(-HOME_TURN * dt, Math.min(HOME_TURN * dt, d));
        sh.vx = Math.cos(na) * HOME_SPEED; sh.vy = Math.sin(na) * HOME_SPEED;
      }
      if (!sh.contactAt) { sh.x += sh.vx * dt; sh.y += sh.vy * dt; }                              // a shard that reached her holds still while she can parry
      if (clock - sh.t0 > (sh.home ? 7000 : 4000) || sh.x < -30 || sh.x > MAP_W + 30 || sh.y < -4 || sh.y > 400) { shots.splice(i, 1); continue; }
      const box = [sh.x - SHOT_R, sh.y - SHOT_R, sh.x + SHOT_R, sh.y + SHOT_R];
      if (sh.from === 'foe') {
        if (!overlap(box, herBox())) { sh.contactAt = 0; continue; }
        const dir = sh.vx >= 0 ? 1 : -1;
        if (sh.home && !sh.contactAt) sh.contactAt = clock;
        const reflect = parrying() || (sh.home && lastParryT >= sh.contactAt - PARRY_EARLY);
        if (sh.home && !reflect && !blocking() && clock - sh.contactAt < PARRY_LATE) continue;       // wait out the late-parry window
        if (reflect) {                                          // reflected: straight forward, a little faster
          sh.from = 'her'; sh.home = false; sh.contactAt = 0; sh.vx = hf() * SHOT_SPEED * 1.5; sh.vy = 0; sh.x = playerX() + hf() * 22; sh.t0 = clock;
          tint = { color: WHITE, alpha: 0.75, until: clock + 150 }; parries++;
          floater(bodyX(), herY() + herTop() * SPRITE_SCALE + 10, 'Reflect', '#8fd0ff');
          burst(sh.x, sh.y, 8, ['#ffffff', '#8fd0ff']);
        } else if (blocking()) {                                   // blocked: no damage
          const p = push(8, 120); slide = newSlide(p, dir); lastPushT = clock;
          tint = { color: WHITE, alpha: 0.75, until: clock + 150 }; blocks++;
          burst(sh.x, sh.y, 6, ['#ffffff', '#8fd0ff']);
          shots.splice(i, 1);
        } else if (clock >= invuln && !stun) {                     // a hit: damage, a short red flash and a small flinch
          hurtHer(sh.dmg || SHOT_DMG);
          herHitFx();
          const p = push(14, 180); slide = newSlide(p, dir); lastPushT = clock;
          tint = { color: RED, alpha: 0.6, until: clock + 220 }; invuln = clock + 500; hits++;
          burst(sh.x, sh.y, 8, ['#ff2b2b', '#8fd0ff']);
          shots.splice(i, 1);
        }
      } else {
        let hit = false;
        for (const e of enemies) { const hb = hurtOf(e); if (hb && overlap(box, hb)) { hurtEnemy(e, SHOT_DMG); hit = true; break; } }
        if (!hit && curMap) {
          for (const c of curMap.crates) if (!c.broken && overlap(box, crateBox(c))) { breakCrate(c); hit = true; break; }
          for (const b of curMap.bombs) if (!b.gone && overlap(box, bombBox(b))) { detonate(b); hit = true; break; }
        }
        if (hit) { burst(sh.x, sh.y, 8, ['#ffffff', '#8fd0ff']); shots.splice(i, 1); }
      }
    }
  }
  function drawShots(sx, sy) {
    for (const sh of shots) {
      const X = V.anchorX + (sh.x - camX) + sx, Y = V.feetRow + camY + sy - sh.y, a = Math.atan2(-sh.vy, sh.vx), mine = sh.from === 'her';
      g.save();
      g.translate(Math.round(X), Math.round(Y)); g.rotate(a);
      if (sh.streak) {                                                  // a combo shard: the long white and blue streak drawn in the backflip
        g.globalAlpha = 0.3; g.fillStyle = mine ? '#ffe14d' : '#4da6ff'; g.beginPath(); g.moveTo(8, 0); g.lineTo(-22, 3); g.lineTo(-22, -3); g.closePath(); g.fill();
        g.globalAlpha = 1; g.fillStyle = mine ? '#ffd24a' : '#8fb4ff'; g.beginPath(); g.moveTo(10, 0); g.lineTo(-14, 2); g.lineTo(-14, -2); g.closePath(); g.fill();
        g.fillStyle = '#fff'; g.beginPath(); g.moveTo(10, 0); g.lineTo(-6, 1); g.lineTo(-6, -1); g.closePath(); g.fill();
        g.restore(); continue;
      }
      g.globalAlpha = 0.35; g.fillStyle = mine ? '#ffe14d' : '#4da6ff'; g.beginPath(); g.ellipse(0, 0, 11, 6, 0, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 1; g.fillStyle = '#000'; g.beginPath(); g.moveTo(9, 0); g.lineTo(0, 4); g.lineTo(-8, 0); g.lineTo(0, -4); g.closePath(); g.fill();
      g.fillStyle = mine ? '#ffe680' : '#9fd0ff'; g.beginPath(); g.moveTo(8, 0); g.lineTo(0, 3); g.lineTo(-6, 0); g.lineTo(0, -3); g.closePath(); g.fill();
      g.fillStyle = '#fff'; g.fillRect(-2, -1, 7, 2);
      g.restore();
    }
  }

  // Bombs sit on the ground or a platform. Only she sets one off: by touching it, or with anything of hers that does damage
  // (a blade, a kick, a beam, a blast, a reflected shard). The blast does BOMB_DMG to her and to every enemy within BOMB_R px,
  // breaks crates and sets off other bombs in range a moment later. Enemies walk over bombs without harm.
  const BOMB_DMG = 50, BOMB_R = 50, BOMB_CHAIN_MS = 180;
  const bombBox = b => [b.x - 8, b.fy, b.x + 8, b.fy + 22];   // a little taller than it is drawn, so chest-high shards and blades can set it off
  function detonate(b) {
    if (b.gone) return;
    b.gone = true; if (level) level.popped.add(b.key);
    const cx = b.x, cy = b.fy + 7;
    explosions.push({ wx: cx, wy: cy, t0: clock, big: true, r: BOMB_R });
    burst(cx, cy, 14, ['#ffd060', '#ff6a20', '#444444']);
    rumble = { t0: clock, ms: 300, amp: 4 };
    for (const e of enemies) { const hb = alive(e) && hurtOf(e); if (hb && distBox(cx, cy, hb) <= BOMB_R) { e.shoved = clock; hurtEnemy(e, BOMB_DMG); } }
    if (!rainbowOn() && distBox(cx, cy, herBox()) <= BOMB_R) {
      hurtHer(BOMB_DMG);
      herHitFx();
      tint = { color: RED, alpha: 0.6, until: clock + 300 }; invuln = Math.max(invuln, clock + 500); hits++;
    }
    crateBlast(cx, cy, BOMB_R);
    if (curMap) for (const o of curMap.bombs) if (!o.gone && !o.fuse && Math.hypot(o.x - cx, o.fy - b.fy) <= BOMB_R) o.fuse = clock + BOMB_CHAIN_MS;
  }
  function stepBombs() {
    if (!curMap) return;
    const me = herBox();
    for (const b of curMap.bombs) {
      if (b.gone) continue;
      if (b.fuse && clock >= b.fuse) { detonate(b); continue; }
      if (overlap(me, bombBox(b))) detonate(b);
    }
  }
  function bombHitsFrom(w) { if (curMap) for (const b of curMap.bombs) if (!b.gone && touches(w, bombBox(b))) detonate(b); }
  function bombsInBox(box) { if (curMap) for (const b of curMap.bombs) if (!b.gone && overlap(box, bombBox(b))) detonate(b); }
  function drawBombs(sx, sy) {
    for (const b of curMap.bombs) {
      if (b.gone) continue;
      const X = Math.round(b.x + sx), Y = Math.round(groundY(sy) - b.fy), lit = !!b.fuse;
      g.fillStyle = '#000'; g.beginPath(); g.arc(X, Y - 6, 7, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#2b2b33'; g.beginPath(); g.arc(X, Y - 6, 6, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#5a5a68'; g.fillRect(X - 3, Y - 10, 2, 2);
      g.strokeStyle = '#8a6a3a'; g.lineWidth = 1; g.beginPath(); g.moveTo(X + 2, Y - 12); g.lineTo(X + 5, Y - 16); g.stroke();
      const on = lit ? Math.floor(clock / 50) % 2 : Math.floor(clock / 240) % 2;   // the fuse spark blinks
      g.fillStyle = on ? '#ffe14d' : '#ff6a20'; g.fillRect(X + 4, Y - 18, 3, 3);
      if (lit) { g.globalAlpha = 0.4; g.fillStyle = '#ff2b2b'; g.beginPath(); g.arc(X, Y - 6, 9, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1; }
    }
  }

  // Pitfalls: gaps in the ground. Her feet on the ground inside one mean instant death (she falls out of sight, then Game Over).
  // Enemies stop at the edge instead of walking in; only a push (a hit, a beam, a blast) can send one over, and then it falls.
  const inPit = px => (curMap && curMap.pits.find(p => px > p.x0 + 2 && px < p.x1 - 2)) || null;
  let lastPushT = -1e9;                  // when she was last pushed by an enemy or shot
  let pitFall = null;                    // {t0}: she is falling
  const PIT_GRAV = 0.0006;                // px/ms^2: she drops out of the bottom of the view; only then does the run end
  const pitSink = () => pitFall ? PIT_GRAV * (clock - pitFall.t0) * (clock - pitFall.t0) : 0;
  const pitOffScreen = () => pitSink() > V.h - V.feetRow + herTop() * SPRITE_SCALE + 8;   // her head has left the bottom of the view
  // She falls only when BOTH feet are over the gap: the feet span from 1 px behind to 38 px ahead of the anchor (measured from
  // the sprite, mirrored when she faces left). Standing with one foot over the edge is safe. Pits are at least 50 px wide
  // (levels.js) so both feet always fit.
  const FEET_BACK = 1, FEET_FRONT = 38;
  function feetSpan() { const px = playerX(), f = hf(); return f > 0 ? [px - FEET_BACK, px + FEET_FRONT] : [px - FEET_FRONT, px + FEET_BACK]; }
  function pitUnderFeet() {
    const fs = feetSpan();
    for (const p of curMap.pits) if (fs[0] >= p.x0 - 1 && fs[1] <= p.x1 + 1) return p;
    return null;
  }
  const pitsSolid = () => rainbowOn();                             // the rainbow guard: pitfalls count as solid ground
  function checkPit() {
    if (pitFall || !curMap || !curMap.pits.length || floorY !== 0 || herY() > 1.5) return;
    if (cheats.nopit || pitsSolid()) return;                          // pitfalls count as solid ground
    if (stun || slide) return;                                     // still being pushed: wait and see where it ends
    const p = pitUnderFeet();
    if (!p) return;
    if (cheats.invincible) {                                       // the cheat keeps her out of the hole: back to the nearer edge
      const px = legsX();
      x += (px - p.x0 < p.x1 - px) ? p.x0 - 4 - px : p.x1 + 4 - px;
      floater(bodyX(), 40, 'Saved', '#ffd24a');
      return;
    }
    pitFall = { t0: clock };
    invuln = clock + 1e9; stun = null; slide = null; fall = null; queued = null;
    cur = { id: 'jump', k: FALL_K, t: 0, kind: 'fall', face: hf() };
    floater(bodyX(), 40, 'FELL', RED);
  }
  // while something falls into a pit it is drawn only above the ground line or inside the pit, so the edges of the hole hide it
  function pitClip(sx, sy) {
    const gl = Math.round(groundY(sy));
    g.beginPath(); g.rect(0, 0, V.w, gl);
    for (const p of curMap.pits) g.rect(Math.round(p.x0 + sx), gl, p.x1 - p.x0, V.h - gl);
    g.clip();
  }
  function drawPits(sx, sy) {
    const top = Math.round(groundY(sy)) - 5;
    for (const p of curMap.pits) {
      const x0 = Math.round(p.x0 + sx), w = p.x1 - p.x0;
      g.fillStyle = '#05030a'; g.fillRect(x0, top, w, V.h - top + 40);
      g.fillStyle = '#1b1024'; for (let yy = top + 10; yy < V.h; yy += 14) g.fillRect(x0, yy, w, 3);   // dark bands: a deep shaft
      g.fillStyle = '#6b4a2a'; g.fillRect(x0 - 2, top, 2, 10); g.fillRect(x0 + w, top, 2, 10);        // the dirt rim
      g.fillStyle = '#3f8f3a'; g.fillRect(x0 - 3, top - 1, 3, 2); g.fillRect(x0 + w, top - 1, 3, 2);
      g.fillStyle = '#c8b4e0'; for (let k = 0; k < w; k += 8) g.fillRect(x0 + k + 2, top + 1, 3, 2);       // teeth of the hole
    }
  }
  // an enemy sent over a pit by a push falls in and is gone (no drops)
  function plunge(e) {
    if (e.state === 'dying') return;
    kill(e, true);
    e.sink = 0; e.sinkAt = clock;
  }

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
  const DIE_MS = 900;                   // death: animation or flicker, then fade

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
                path: o.path || null, sight: o.sight || 100, pause: 0, far: 0, prevX: wx, dir: 1, comboReady: true, meleeSeen: false };
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
    const bxp = bodyX(), dx = bxp - e.x;
    if (dx * e.face <= 0 || Math.abs(dx) > e.sight) return false;      // only in front of it, and only within sight
    if (Math.abs(herY() - e.fy) > 60) return false;                    // she is on another level
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
  const CLIMBERS = new Set(['goblin']), HOP_UP = 70, HOP_X = 130;
  function planHop(e) {
    const fy = e.fy || 0, her = floorY, bx = bodyX(), surf = surfaces(curMap);
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
  const ENEMY_JUMP_H = 22, ENEMY_JUMP_MAX = 140, ENEMY_JUMP_DIST = { goblin: 200, orc: 70, hobgoblin: 130, skullraider: 150, dusksaur: 110, darkknight: 90, ogre: 60 }, ENEMY_LAND_OFF = { goblin: 10, orc: 4 };     // arc height, widest gap an enemy will leap
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
  function stepEnemyCore(e, dt) {
    const T = EN[e.type], ai = T.ai;
    let A = T.anims[e.anim], ended = false;
    dt *= (e.speedMul || 1);            // taunted: everything it does, walking, swinging and resting, runs 2x as fast
    if (e.taunted && (!e.tint || clock >= e.tint.until)) e.tint = TAUNT_TINT;   // back to red after a flash
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
    if (e.state === 'stunned') {        // parried: slides back, no control until it stops
      e.x += e.push.v * dt; e.base += e.push.v * dt;
      const v = e.push.v - Math.sign(e.push.v) * e.push.a * dt;
      if (Math.sign(v) === Math.sign(e.push.v)) { e.push.v = v; return; }
      e.state = 'idle'; e.rest = ai.rest[0]; play(e, 'idle');
      return;
    }
    if (e.state === 'patrol') { patrol(e, dt); return; }
    const d = bodyX() - e.x, dist = Math.abs(d);
    if (e.path && (e.state === 'idle' || e.state === 'walk')) {       // chasing: give up when she is gone for a while
      e.far = dist > e.sight * 2.5 || Math.abs(herY() - e.fy) > 110 ? e.far + dt : 0;
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
      if (CLIMBERS.has(e.type) && curMap && (!sameLevel || (e.fy || 0) > 0)) {
        const plan = planHop(e);
        if (plan) {
          const dir = plan.launch >= e.x ? 1 : -1;
          const at = Math.abs(e.x - plan.launch) <= 3 || (dir > 0 && e.x >= e.hi - 1 && plan.launch >= e.hi - 1) || (dir < 0 && e.x <= e.lo + 1 && plan.launch <= e.lo + 1);
          if (at) {
            const dy = plan.fy1 - (e.fy || 0), fall = plan.kind === 'drop';
            e.jump = { x0: e.x, x1: plan.land, fy0: e.fy || 0, fy1: plan.fy1, fall, H: plan.kind === 'up' ? 16 : ENEMY_JUMP_H,
                       t: 0, dur: fall ? Math.sqrt(2 * Math.abs(dy) / 0.0018) + 80 : 420 + Math.abs(plan.land - e.x) * 3 + Math.max(0, dy) * 2 };
            return;
          }
          turn(e, dir); if (e.anim !== 'walk') play(e, 'walk');
          const mv = dir * Math.min(espeed(e, ai) * dt / 1000, Math.abs(plan.launch - e.x));
          e.x += mv; e.base += mv;
          return;
        }
      }
    }
    if (gap <= reach - 1 && !pitBetween && sameLevel) {
      e.state = 'attack'; e.meleeSeen = true;
      const melee = ai.attacks.filter(a => a !== 'combo');
      play(e, (melee.length ? melee : ai.attacks)[Math.floor(Math.random() * (melee.length ? melee : ai.attacks).length)]);
    } else if (ai.dive && e.dive && !blocked && sameLevel && dist >= ai.dive.min && dist <= ai.dive.max) {
      e.state = 'attack'; e.dive = false;
      play(e, ai.dive.anim);
    } else if (blocked) {
      if (e.anim !== 'idle') play(e, 'idle');
    } else {
      if (e.anim !== 'walk') play(e, 'walk');
      if ((e.fy || 0) === 0 && curMap && curMap.pits.length) {       // a pit between it and her: jump it when it reaches the edge
        if (e.hopAt == null) e.hopAt = 3 + Math.random() * 10;                 // how close to the edge it takes off (rerolled after each jump)
        const q = curMap.pits.find(p => e.face > 0 ? (p.x0 - e.x >= -2 && p.x0 - e.x < e.hopAt && bodyX() > p.x1)
                                                    : (e.x - p.x1 >= -2 && e.x - p.x1 < e.hopAt && bodyX() < p.x0));
        if (q && q.x1 - q.x0 <= ENEMY_JUMP_MAX && Math.abs(herY() - e.fy) < 40) {
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
      if (mv === 0 && e.anim !== 'idle') play(e, 'idle');
      e.x += mv; e.base += mv;
    }
  }

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

  // ------------------------------------------------------------------ enemy attacks on her
  // her hurtbox: x from her anchor, up to the top of her drawn body on this frame (hair, head and
  // arms, not the sword); while ducking it stops DUCK_TRIM px under the top of her head
  const HURT = [10 * SPRITE_SCALE, 0, 60 * SPRITE_SCALE];
  const DUCK_TRIM = 5;
  function herTop() {
    if (!cur) return D.moves.idle.frames[0].top;
    const top = D.moves[cur.id].frames[cur.k].top;
    return cur.id === 'duck' ? top - DUCK_TRIM : top;
  }
  const RED = '#ff2b2b', WHITE = '#ffffff';
  const DASH_HOP = 5, DASH_MOVES = new Set(['dash', 'dash_thrust', 'energy_dash_thrust', 'push_kick', 'energy_kick']);
  function dashHop() {                  // the dash, its thrusts and the push kicks rise 5 px and settle again over the move
    if (!cur || !DASH_MOVES.has(cur.id) || cur.kind === 'fall') return 0;
    const F = D.moves[cur.id].frames; let tot = 0, at = 0;
    for (let i = 0; i < F.length; i++) { if (i === cur.k) at = tot + Math.min(cur.t || 0, F[i].ms); tot += F[i].ms; }
    const u = Math.min(1, at / tot);
    return 4 * DASH_HOP * u * (1 - u);
  }
  const heightAbove = () => (stun ? stun.y : (fall ? fall.y : (cur && cur.kind !== 'fall' ? rootOf(cur)[1] : 0)) + (slide ? slide.y : 0) + (stun ? 0 : dashHop()));   // above the surface she stands on
  function herY() { return floorY + heightAbove() - pitSink(); }                                                              // world height of her feet
  const hf = () => cur ? cur.face : facing;
  const legsX = () => playerX() + hf() * LEGS;          // between her feet
  const bodyX = () => playerX() + hf() * BODY;         // her body centre
  function herBox() {
    const px = playerX(), py = herY(), f = hf();
    return [px + Math.min(f * HURT[0], f * HURT[2]), py + HURT[1], px + Math.max(f * HURT[0], f * HURT[2]), py + herTop() * SPRITE_SCALE];
  }
  function boxOf(e, h) {
    if (!h) return null;
    const s = SPRITE_SCALE * (e.scale || 1), fy = e.fy || 0;
    return e.face < 0
      ? [e.base + h[0] * s, h[1] * s + fy + (e.jy || 0), e.base + h[2] * s, h[3] * s + fy + (e.jy || 0)]
      : [e.base - h[2] * s, h[1] * s + fy + (e.jy || 0), e.base - h[0] * s, h[3] * s + fy + (e.jy || 0)];
  }
  const overlap = (a, b) => a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];
  // a push that starts at speed v0 and slows evenly to a stop: covers d px in ms
  const push = (d, ms) => ({ v: 2 * d / ms, a: 2 * d / (ms * ms) });
  const HIGH_K = D.moves.heavy.frames.findIndex(f => f.name === 'high');
  const parrying = () => cur && cur.id === 'parry' && cur.kind === 'action' && cur.k <= 2;
  const blocking = () => cur && cur.id === 'block';

  function parried(e) {
    const T = EN[e.type], [d, ms] = PARRY_KNOCK, p = push(d, ms);
    e.hitDone = true;
    e.state = 'stunned';
    play(e, T.ai.stun || 'idle');
    e.push = { v: p.v * (e.x >= bodyX() ? 1 : -1), a: p.a };
    e.tint = { color: WHITE, alpha: 0.75, until: clock + ms };
    parries++;
    flashes.push({ wx: (bodyX() + e.x) / 2, wy: herY() + 24, t0: clock, ms: 240, r: 22, c: '#bfe8ff' }); hitStop(90); screenFlash = { c: '#ffffff', a: 0.3, t0: clock, ms: 110 };
  }
  const KNOCK_UP = 5;
  const newSlide = (p, dir) => ({ v: p.v * dir, a: p.a, y: 0, vy: -Math.sqrt(2 * 0.0018 * KNOCK_UP) });   // a block or a shot hit: slid back and up KNOCK_UP px
  function knocked(e) {                 // a clean hit: red, pushed away from the enemy, stunned
    const AT = (EN[e.type].ai.atk || {})[e.anim];                      // per-attack damage and knockback (new creatures)
    const [d, ms] = (AT && AT.knock) || EN[e.type].ai.knock, p = push(d, ms);
    const dir = bodyX() >= e.x ? 1 : -1;
    const y = heightAbove();
    if (cur && !fall && cur.kind !== 'fall') x += rootOf(cur)[0];
    fall = null; queued = null; slide = null;
    stun = { v: p.v * dir, a: p.a, y, vy: -Math.sqrt(2 * 0.0018 * KNOCK_UP) }; lastPushT = clock;   // knocked back and up KNOCK_UP px (so she clears the ground and ledge edges)
    cur = { id: 'heavy', k: HIGH_K, t: 0, kind: 'stun', from: x, face: cur ? cur.face : facing };
    tint = { color: RED, alpha: 0.6, until: clock + ms };
    invuln = clock + ms + 400;
    hits++;
    herHitFx();
    hurtHer(((AT && AT.dmg) || ENEMY_DMG[e.type] || EN[e.type].ai.dmg || 10) * (e.dmgMul || 1));
    if (hp <= 0) { stun.until = clock + KO_MS; floater(bodyX(), herY() + herTop() + 18, 'K.O.', RED); if (typeof triggerGameOver === 'function') triggerGameOver(); }
  }
  function blocked(e) {                 // white, a small slide back, no stun
    const dir = bodyX() >= e.x ? 1 : -1, p = push(8, 120);
    slide = newSlide(p, dir); lastPushT = clock;
    tint = { color: WHITE, alpha: 0.75, until: clock + 150 };
    blocks++;
    flashes.push({ wx: bodyX() + hf() * 12, wy: herY() + 22, t0: clock, ms: 160, r: 12, c: '#ffffff' }); hitStop(40);
  }
  function stepStun(dt) {
    x += stun.v * dt;
    const v = stun.v - Math.sign(stun.v) * stun.a * dt;
    stun.v = Math.sign(v) === Math.sign(stun.v) ? v : 0;
    if (stun.y > 0 || stun.vy < 0) {
      const f0 = floorY + stun.y;
      stun.vy += 0.0018 * dt; stun.y = Math.max(0, stun.y - stun.vy * dt);
      if (curMap) {                                   // knocked while in the air: land on a platform or block she falls through, not below it
        let T = -1; const sp = span(playerX());
        for (const sf of surfaces(curMap)) if (sf.top > floorY && overSurf(sf, sp) && f0 > sf.top && floorY + stun.y <= sf.top && sf.top > T) T = sf.top;
        if (T >= 0) { floorY = T; stun.y = 0; }
      }
    }
    if (stun.v === 0 && stun.y === 0 && (!stun.until || clock >= stun.until)) {
      if (stun.until) { if (typeof gameOver !== 'undefined' && gameOver) { stun = null; cur = null; return; } hp = maxHp(); floater(bodyX(), herY() + herTop() + 6, '+' + maxHp(), GREEN); }
      stun = null; cur = null; holdState(clock);
    }
  }
  let hits = 0, blocks = 0, parries = 0;

  // An enemy attack that reaches her lands HIT_DELAY ms after first contact. Until then a parry
  // still works, so the window covers the frames just before the swing and the start of its first
  // hitting frame. 90 ms is about one enemy frame: long enough to react to the swing appearing,
  // short enough that the hit does not feel late. Raised to 300 ms so a late parry still works.
  const HIT_DELAY = 300;
  function enemyAttacks() {
    const me = herBox();
    for (const e of enemies) {
      if (e.state !== 'attack' || e.hitDone) continue;
      if (parrying() && e.landAt) { parried(e); continue; }   // parried during the first hitting frame
      const T = EN[e.type], A = T.anims[e.anim];
      if (parrying()) {                 // the attack lands this frame or within the next two
        let soon = false;
        for (let j = e.k; j <= Math.min(e.k + 2, A.frames.length - 1) && !soon; j++) {
          const h = boxOf(e, T.frames[A.frames[j]].hit);
          soon = !!h && overlap(h, me);
        }
        if (soon) { parried(e); continue; }
      }
      if (!e.landAt) {
        const h = boxOf(e, frameOf(e).hit);
        if (!h || !overlap(h, me)) continue;
        e.landAt = clock + HIT_DELAY;   // contact: the hit lands shortly, parry still possible
      }
      if (clock < e.landAt) continue;
      e.hitDone = true;
      if (blocking()) blocked(e);
      else if (clock >= invuln && !stun) knocked(e);
    }
  }

  // walking and the plain dash stop at an enemy instead of passing through it: her body (HURT x
  // range) may not move into an enemy's hurtbox from the side it was on before this step
  const BLOCKED = new Set(['dash', 'walk_right', 'walk_left']);
  function blockMove(before) {
    if (!cur || !BLOCKED.has(cur.id) || before === null) return;
    const f = cur.face, _bw = Math.max(8, HURT[2] * 0.55), a = Math.min(f * HURT[0], f * _bw), b = Math.max(f * HURT[0], f * _bw);   // her body: [px + a, px + b]
    const px = playerX();
    let front = Infinity, back = -Infinity;
    for (const e of enemies) {
      const bx = hurtOf(e);
      if (!bx) continue;
      const me = herBox(); if (bx[1] > me[3] || bx[3] < me[1]) continue;      // above or below her: not in the way
      if (bx[0] >= before + b - 1) front = Math.min(front, bx[0] - b);       // to her right
      else if (bx[2] <= before + a + 1) back = Math.max(back, bx[2] - a);    // to her left
    }
    if (px > front) x -= px - front;
    else if (px < back) x += back - px;
  }

  function stepEnemies(dt) {
    for (const e of enemies) stepEnemy(e, dt);
    for (let i = enemies.length - 1; i >= 0; i--) if (enemies[i].state === 'dying' && enemies[i].dead > DIE_MS) enemies.splice(i, 1);
    if (!respawnOn) respawns.length = 0;
    for (let i = respawns.length - 1; i >= 0; i--) {
      if (clock < respawns[i].at) continue;
      spawn(respawns[i].type, respawns[i].side < 0 ? camX - V.anchorX - 40 : camX + V.w - V.anchorX + 40);   // just past an edge of the view
      respawns.splice(i, 1);
    }
  }

  // ------------------------------------------------------------------ drawing
  function drawLayer(im, dx, dy) {
    // the layer's top-left sits at view (dx mod width, dy - margin); edge rows stretch past its ends
    const w = im.width, h = im.height, top = Math.round(dy) - V.margin;
    let x0 = (Math.round(dx) % w + w) % w - w;
    for (let xx = x0; xx < V.w; xx += w) {
      g.drawImage(im, xx, top);
      if (top > 0) g.drawImage(im, 0, 0, w, 1, xx, 0, w, top);
      if (top + h < V.h) g.drawImage(im, 0, h - 1, w, 1, xx, top + h, w, V.h - top - h);
    }
  }

  function draw() {
    if (!cur) return;
    const m = D.moves[cur.id];
    const f = m.frames[cur.k];
    const rel = stun ? [0, stun.y] : fall ? [0, fall.y] : (cur.kind === 'fall' ? [0, 0] : rootOf(cur));
    const rx = rel[0], ry = rel[1] + floorY - pitSink();                     // ry: world height of her feet
    let [sx, sy] = cur.kind === 'fall' || cur.kind === 'land' || cur.lite ? [0, 0] : f.shake;
    if (rumble) {                                                // fading aftershock
      const e = clock - rumble.t0;
      if (e >= rumble.ms) rumble = null;
      else {
        const a = rumble.amp * Math.pow(1 - e / rumble.ms, 1.5);
        sx += Math.round(a * Math.sin(e * 0.11)); sy += Math.round(a * Math.cos(e * 0.083));
      }
    }
    const px = x + rx;
    const targetY = Math.max(0, ry - CAM_KEEP);
    if (f.bw && cur.kind === 'action') {                         // impact frame: the whole view (the picture has her at anchorX, so it is slid to where she is)
      camY = targetY;
      const sh = Math.round(px - V.anchorX);
      g.fillStyle = '#000'; g.fillRect(0, 0, V.w, V.h);
      if (cur.face < 0) {                                        // mirrored about her position, black beyond it
        g.save(); g.translate((V.anchorX + sh) * 2, 0); g.scale(-1, 1);
        g.drawImage(img[f.bw].im, 0, 0); g.drawImage(img[f.bw].im, V.w, 0);
        g.restore();
      } else g.drawImage(img[f.bw].im, sh, 0);
      return;
    }
    const bgx = camX + (level ? level.idx * MAP_W : 0);          // the scenery carries on from map to map
    const TH = curMap ? THEMES[curMap.def.theme || (level && level.def.bg)] || null : null;       // boss arenas set def.theme; levels 2 to 6 set def.bg
    for (const l of TH ? TH.layers : D.layers) drawLayer(img[l.src].im, -bgx * l.parallax + sx * l.shake, camY * l.parallax + sy * l.shake);
    if (level && level.def.tint && !TH) { g.globalAlpha = level.def.tint.alpha; g.fillStyle = level.def.tint.color; g.fillRect(0, 0, V.w, V.h); g.globalAlpha = 1; }
    if (curMap) { drawPits(sx, sy); drawGeometry(sx, sy); drawCrates(sx, sy); drawBombs(sx, sy); }
    drawEnemies(sx, sy);
    drawTraining(sx, sy);
    drawTraining(sx, sy);
    const cw = m.cell[0], ch = m.cell[1];
    const ax = V.anchorX + (px - camX) + sx;
    const ay = V.feetRow - (ry - camY) + sy;
    const tc = tint && clock < tint.until ? tint : (isCharged() ? CHARGED_TINT : null);
    g.save();
    if (pitFall && curMap) pitClip(sx, sy);
    g.translate(Math.round(ax), Math.round(ay));
    if (cur.face < 0) g.scale(-1, 1);
    if (cur.spin && clock - cur.spin < SPIN_MS && cur.id === 'jump') {       // the double jump's spin: a full turn about her middle
      const c = -herTop() * SPRITE_SCALE * 0.5;
      g.translate(0, c); g.rotate(2 * Math.PI * (clock - cur.spin) / SPIN_MS); g.translate(0, -c);
    }
    if (m.fxSheet) {                                             // effects at their own scale, behind Max
      const fs = m.fxScale || SPRITE_SCALE, fim = img[m.fxSheet].im;
      const fc = FX_CENTER[cur.id];
      g.save();
      if (fc) g.translate(fc[0] * (SPRITE_SCALE - fs), fc[1] * (fs - SPRITE_SCALE));   // keep the enlarged ring centred on Max's body
      const gone = side => cur.id === 'energy_wave' && cur.blast && cur.blast[side] && cur.k >= 2;   // that projectile burst
      if (!gone(cur.face)) blit(fim, cur.k * cw, cw, ch, -m.anchor[0] * fs, -m.anchor[1] * fs, null, fs);
      if (BOTH_SIDES.has(cur.id) && !gone(-cur.face)) { g.save(); g.scale(-1, 1); blit(fim, cur.k * cw, cw, ch, -m.anchor[0] * fs, -m.anchor[1] * fs, null, fs); g.restore(); }
      g.restore();
    }
    blit(img[m.sheet].im, cur.k * cw, cw, ch, -m.anchor[0] * SPRITE_SCALE, -m.anchor[1] * SPRITE_SCALE, tc, SPRITE_SCALE);
    g.restore();
    drawBeam(sx, sy);
    drawExplosions(sx, sy);
    drawParticles(sx, sy);
    drawFlashes(sx, sy);
    drawShots(sx, sy);
    g.save();                                                     // the foreground grass is cut away over the pits
    if (curMap && curMap.pits.length) { g.beginPath(); g.rect(0, 0, V.w, V.h); for (const p of curMap.pits) g.rect(Math.round(p.x0 + sx), 0, p.x1 - p.x0, V.h); g.clip('evenodd'); }
    drawLayer(img[TH ? TH.fringe : D.fringe.src].im, -bgx + sx, camY + sy);
    g.restore();
    drawGems(sx, sy);
    drawBars(sx, sy);
    drawMeters();
    drawFloaters(sx, sy);
    drawBanners();
    drawTrainingHud();
    if (screenFlash) { const a = (clock - screenFlash.t0) / screenFlash.ms; if (a >= 1) screenFlash = null; else { g.globalAlpha = screenFlash.a * (1 - a); g.fillStyle = screenFlash.c; g.fillRect(0, 0, V.w, V.h); g.globalAlpha = 1; } }
    if (fadeUntil > clock) { g.globalAlpha = Math.min(1, (fadeUntil - clock) / FADE_MS); g.fillStyle = '#000'; g.fillRect(0, 0, V.w, V.h); g.globalAlpha = 1; }
    if (showBoxes) drawBoxes(sx, sy);
  }

  // ------------------------------------------------------------------ drawing: level scenery, crates, banners
  let fadeUntil = 0;
  const FADE_MS = 350;
  const groundY = sy => V.feetRow + camY + sy;                    // screen row of the ground line
  function drawGeometry(sx, sy) {
    const Y = wy => Math.round(groundY(sy) - wy);
    for (const s of curMap.solids) {                              // barriers: stone blocks
      const x0 = Math.round(s.x0 + sx), w = s.x1 - s.x0, top = Y(s.top), bot = Y(0);
      g.fillStyle = '#3d3949'; g.fillRect(x0, top, w, bot - top + 12);
      g.fillStyle = '#2b2735';
      for (let yy = top + 8; yy < bot + 12; yy += 8) g.fillRect(x0, yy, w, 1);
      for (let yy = top, r = 0; yy < bot + 12; yy += 8, r++) g.fillRect(x0 + (r % 2 ? 4 : 10), yy, 1, 8);
      g.fillStyle = '#635e7a'; g.fillRect(x0, top, w, 3);
      g.strokeStyle = '#111'; g.lineWidth = 1; g.strokeRect(x0 + 0.5, top + 0.5, w - 1, bot - top + 11);
    }
    for (const p of curMap.plats) {                               // platforms: a plank on two posts
      const x0 = Math.round(p.x0 + sx), w = p.x1 - p.x0, top = Y(p.top), bot = Y(0);
      g.fillStyle = 'rgba(58,38,22,0.75)';
      g.fillRect(x0 + 4, top + 7, 3, bot - top - 7); g.fillRect(x0 + w - 7, top + 7, 3, bot - top - 7);
      g.fillStyle = '#7a5230'; g.fillRect(x0, top, w, 7);
      g.fillStyle = '#b07c44'; g.fillRect(x0, top, w, 2);
      g.fillStyle = '#4a3018'; g.fillRect(x0, top + 6, w, 1);
      g.fillStyle = '#2a1a0c'; for (let nx = x0 + 6; nx < x0 + w - 3; nx += 16) g.fillRect(nx, top + 3, 2, 2);
      g.strokeStyle = '#111'; g.strokeRect(x0 + 0.5, top + 0.5, w - 1, 6);
    }
    // the door at the right edge: barred while an enemy is alive, a green glow and arrow once the map is clear
    const open = doorOpen(), pulse = 0.55 + 0.35 * Math.sin(clock / 260), gx = MAP_W - 10 + sx;
    g.fillStyle = open ? 'rgba(90,220,120,0.35)' : 'rgba(30,30,40,0.85)';
    g.fillRect(gx, Y(70), 10, Y(0) - Y(70));
    if (!open) { g.fillStyle = '#8a8a99'; for (let yy = Y(70); yy < Y(0); yy += 6) g.fillRect(gx + 2, yy, 6, 2); }
    else { g.save(); g.globalAlpha = pulse; g.fillStyle = '#7dff9a'; g.beginPath(); g.moveTo(gx - 4, Y(28) - 7); g.lineTo(gx + 5, Y(28)); g.lineTo(gx - 4, Y(28) + 7); g.closePath(); g.fill(); g.restore(); }
  }
  function drawCrates(sx, sy) {
    for (const c of curMap.crates) {
      if (c.broken) continue;
      const X = Math.round(c.x + sx), Y = Math.round(groundY(sy) - c.fy), gold = !!c.item;
      if (gold) {                                                 // a soft pulsing glow so golden crates stand out
        g.save(); g.globalAlpha = 0.22 + 0.12 * Math.sin(clock / 220);
        g.fillStyle = '#ffd24a'; g.beginPath(); g.arc(X, Y - 9, 16, 0, Math.PI * 2); g.fill(); g.restore();
      }
      g.fillStyle = '#000'; g.fillRect(X - 10, Y - 19, 20, 19);
      g.fillStyle = gold ? '#c9962a' : '#8a5a2b'; g.fillRect(X - 9, Y - 18, 18, 17);
      g.fillStyle = gold ? '#f0cf66' : '#b07a3c'; g.fillRect(X - 9, Y - 18, 18, 2);
      g.strokeStyle = gold ? '#7a5a10' : '#5a3a18'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(X - 8, Y - 17); g.lineTo(X + 8, Y - 2); g.moveTo(X + 8, Y - 17); g.lineTo(X - 8, Y - 2); g.stroke();
      g.strokeRect(X - 8.5, Y - 17.5, 17, 16);
      if (gold) { g.font = 'bold 9px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 2; g.strokeText('?', X, Y - 10); g.fillText('?', X, Y - 10); g.textAlign = 'left'; }
    }
  }
  function drawFlashes(sx, sy) {
    for (let i = flashes.length - 1; i >= 0; i--) {
      const f = flashes[i], a = (clock - f.t0) / f.ms;
      if (a >= 1) { flashes.splice(i, 1); continue; }
      const X = Math.round(f.wx + sx), Y = Math.round(groundY(sy) - f.wy), r = f.r * (0.4 + 0.6 * Math.min(1, a * 3)), inner = r * 0.25;
      g.save(); g.globalAlpha = 1 - a; g.strokeStyle = f.c; g.lineWidth = a < 0.35 ? 2 : 1; g.beginPath();
      for (let k = 0; k < 8; k++) { const ang = k * Math.PI / 4 + 0.4, len = k % 2 ? r * 0.6 : r; g.moveTo(X + Math.cos(ang) * inner, Y + Math.sin(ang) * inner); g.lineTo(X + Math.cos(ang) * len, Y + Math.sin(ang) * len); }
      g.stroke();
      if (a < 0.4) { g.fillStyle = '#fff'; g.beginPath(); g.arc(X, Y, r * 0.3 * (1 - a), 0, 7); g.fill(); }
      g.restore();
    }
  }
  function drawParticles(sx, sy) {
    for (const q of particles) {
      g.globalAlpha = Math.max(0, 1 - (clock - q.t0) / q.life);
      g.fillStyle = q.c; g.fillRect(Math.round(q.wx + sx) - 1, Math.round(groundY(sy) - q.wy) - 1, 3, 3);
    }
    g.globalAlpha = 1;
  }
  // banners: a dark strip near the top with a title and an optional second line; they fade in and out
  function drawBanners() {
    let y = 62;
    for (const b of banners) {
      const age = clock - b.t0, a = Math.max(0, Math.min(1, age / 200, (b.ms - age) / 350));
      const lines = Array.isArray(b.sub) ? b.sub : b.sub ? [b.sub] : [], h = lines.length ? 21 + 9 * lines.length : 20;
      g.save();
      g.globalAlpha = a * 0.82; g.fillStyle = '#0c0a12'; g.fillRect(52, y, V.w - 104, h);
      g.globalAlpha = a; g.strokeStyle = '#ffd24a'; g.lineWidth = 1; g.strokeRect(52.5, y + 0.5, V.w - 105, h - 1);
      g.textAlign = 'center'; g.textBaseline = 'top'; g.lineWidth = 2; g.lineJoin = 'round';
      g.font = 'bold 9px monospace'; g.strokeStyle = '#000'; g.fillStyle = '#ffe14d';
      g.strokeText(b.title, V.w / 2, y + 5); g.fillText(b.title, V.w / 2, y + 5);
      g.font = '7px monospace'; g.fillStyle = '#e6e6ec';
      lines.forEach((ln, i) => { g.strokeText(ln, V.w / 2, y + 18 + 9 * i); g.fillText(ln, V.w / 2, y + 18 + 9 * i); });
      g.restore();
      y += h + 4;
    }
    g.textAlign = 'left';
  }

  // explosions: an expanding fireball with a shock ring, and a white flash over the view for the big one
  function drawExplosions(sx, sy) {
    for (let i = explosions.length - 1; i >= 0; i--) {
      const ex = explosions[i], age = clock - ex.t0;
      if (age > BLAST_MS) { explosions.splice(i, 1); continue; }
      if (age < 0) continue;
      const u = age / BLAST_MS, R = (ex.r || (ex.big ? 90 : 34)) * (0.25 + 0.75 * Math.sqrt(u));
      const X = Math.round(V.anchorX + (ex.wx - camX) + sx), Y = Math.round(V.feetRow + camY + sy - ex.wy);
      g.save();
      g.globalAlpha = Math.max(0, 1 - u);
      const gr = g.createRadialGradient(X, Y, 0, X, Y, R);
      gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.35, '#ffd060'); gr.addColorStop(0.7, '#ff6a20'); gr.addColorStop(1, 'rgba(255,60,0,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(X, Y, R, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#8fd0ff'; g.lineWidth = ex.big ? 4 : 2;
      g.beginPath(); g.arc(X, Y, R, 0, Math.PI * 2); g.stroke();
      g.restore();
    }
    if (clock < flashUntil) {
      g.save(); g.globalAlpha = 0.75 * (flashUntil - clock) / FLASH_MS; g.fillStyle = '#fff'; g.fillRect(0, 0, V.w, V.h); g.restore();
    }
  }
  // gems on the ground: a bobbing diamond with a glow, blinking for the last 4 s
  // a golden ankh (the loop on top, a bar across, a stem), the ankh pickup and the counter icon
  function drawAnkh(X, Y, k) {
    g.save();
    g.translate(X, Y); g.scale(k, k);
    g.fillStyle = '#000';
    g.fillRect(-2, -9, 5, 1); g.fillRect(-3, -8, 1, 4); g.fillRect(3, -8, 1, 4); g.fillRect(-2, -4, 5, 1); g.fillRect(-5, -3, 11, 4); g.fillRect(-2, 1, 5, 9);
    g.fillStyle = '#ffd24a';
    g.fillRect(-1, -8, 3, 1); g.fillRect(-2, -7, 1, 3); g.fillRect(2, -7, 1, 3); g.fillRect(-1, -4, 3, 1); g.fillRect(-4, -2, 9, 2); g.fillRect(-1, 0, 3, 9);
    g.fillStyle = '#fff2a8'; g.fillRect(-1, -8, 3, 1); g.fillRect(-4, -2, 9, 1);
    g.fillStyle = '#b8801a'; g.fillRect(-1, 8, 3, 1); g.fillRect(-4, -1, 9, 1);
    g.restore();
  }
  function drawGems(sx, sy) {
    for (const gm of gems) {
      const left = GEM_LIFE - (clock - gm.t0);
      if (gm.kind !== 'ankh' && left < 4000 && Math.floor(clock / 120) % 2) continue;
      const X = Math.round(V.anchorX + (gm.x - camX) + sx), Y = Math.round(V.feetRow + camY + sy - gm.y - Math.sin(gm.bob) * 3);
      if (gm.kind === 'ankh') { drawAnkh(X, Y, 1); continue; }
      const IT = D.items, up = gm.kind.startsWith('up_'), base = up ? gm.kind.slice(3) : gm.kind;
      if (gm.kind === 'leaf') {                                   // the spinning Leaf coin (a 5-leaf piece is drawn larger)
        const f = Math.floor((clock + gm.bob * 97) / 85) % IT.leafFrames, sc = (gm.val || 1) >= 5 ? 1.5 : 1;
        g.drawImage(img[IT.leaf].im, f * IT.cell, 0, IT.cell, IT.cell, X - IT.cell * sc / 2, Y - IT.cell * sc / 2, IT.cell * sc, IT.cell * sc);
        continue;
      }
      const c = base === 'energy' ? ['#bfe6ff', '#4af', '#1d5fb0'] : base === 'super' ? ['#f0d6ff', '#c6f', '#6a2a9a'] : base === 'health' || base === 'hp' ? ['#c9ffd6', '#3ddc5f', '#15803d'] : ['#ffe3b0', '#fa4', '#b25a10'];
      g.save();
      g.globalAlpha = 0.25 + 0.1 * Math.sin(gm.bob * 2); g.fillStyle = c[1];
      g.beginPath(); g.arc(X, Y, 9, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 1;
      const spr = GEM_SPRITE[gm.kind] || GEM_SPRITE[base];            // Bone, Bone Powder, Quartz, Garnet, Diamond
      g.drawImage(img[IT.gemSheet].im, IT.gems[spr] * IT.cell, 0, IT.cell, IT.cell, X - IT.cell / 2, Y - IT.cell / 2, IT.cell, IT.cell);
      if (up && gm.kind !== 'up_hp') {                            // a meter upgrade (the gem's powder): a ring and a plus sign
        g.strokeStyle = '#fff'; g.lineWidth = 1; g.beginPath(); g.arc(X, Y, 11, 0, Math.PI * 2); g.stroke();
        g.fillStyle = '#fff'; g.fillRect(X - 3, Y - 1, 7, 2); g.fillRect(X, Y - 4, 1, 8);
      }
      g.restore();
    }
  }
  // meters under the health bar: ENG (blue) and EMP (orange); a bar flashes white when a move was refused
  function drawMeters() {
    g.font = 'bold 7px monospace'; g.textBaseline = 'top'; g.textAlign = 'left'; g.lineWidth = 2; g.lineJoin = 'round';
    let y = 24;                                                    // only the meters the player has unlocked are drawn
    for (const [lab, k, v, max, col] of [['ENG', 'energy', energyMeter, maxOf('energy'), '#4af'], ['EMP', 'empower', empowerMeter, maxOf('empower'), '#fa4'], ['SUP', 'super', superMeter, maxOf('super'), '#c6f']]) {
      if (!P.meterOn(k)) continue;
      g.strokeStyle = '#000'; g.fillStyle = '#fff';
      g.strokeText(lab, 8, y - 1); g.fillText(lab, 8, y - 1);
      const flash = clock < meterFlash[k];
      g.fillStyle = '#000'; g.fillRect(27, y - 1, max + 2, 8);          // the bar is as long as the meter's maximum: upgrades make it longer
      g.fillStyle = '#16202e'; g.fillRect(28, y, max, 6);
      const fw = Math.max(0, Math.min(max, Math.round(v)));
      g.fillStyle = flash && Math.floor(clock / 70) % 2 ? '#fff' : col; g.fillRect(28, y, fw, 6);
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(28, y, fw, 1);
      const t = `${Math.round(v)}/${max}`;
      g.strokeStyle = '#000'; g.fillStyle = '#fff'; g.strokeText(t, 32 + max, y - 1); g.fillText(t, 32 + max, y - 1);
      y += 9;
    }
  }

  // health bars: hers at the top left of the view, each living enemy's over its head
  function bar(x0, y0, w, h, frac) {
    g.fillStyle = '#000'; g.fillRect(x0 - 1, y0 - 1, w + 2, h + 2);
    g.fillStyle = '#4a1414'; g.fillRect(x0, y0, w, h);
    const fw = Math.round(w * Math.max(0, Math.min(1, frac)));
    g.fillStyle = frac > 0.5 ? '#3ddc5f' : frac > 0.25 ? '#f0c030' : '#e63b2e';
    g.fillRect(x0, y0, fw, h);
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x0, y0, fw, 1);
  }
  function drawBars(sx, sy) {
    const X = wx => V.anchorX + (wx - camX) + sx, Y = wy => V.feetRow + camY + sy - wy;
    for (const e of enemies) {
      const b = hurtOf(e);
      if (!b || EN[e.type].ai.boss || EN[e.type].ai.prop) continue;
      bar(Math.round(X((b[0] + b[2]) / 2)) - 15, Math.round(Y(b[3])) - 8, 30, 3, e.hp / e.maxHp);
    }
    g.font = 'bold 7px monospace'; g.textBaseline = 'top'; g.lineWidth = 2; g.lineJoin = 'round';
    g.strokeStyle = '#000'; g.fillStyle = '#fff';
    g.strokeText('MAX', 8, 14); g.fillText('MAX', 8, 14);
    bar(28, 15, 200, 6, hp / maxHp());
    if (level) {                                                     // Leaves counter
      const IT = D.items; g.drawImage(img[IT.leaf].im, 0, 0, IT.cell, IT.cell, 318, 12, 10, 10);
      g.strokeText('x' + P.state.leaves, 330, 14); g.fillText('x' + P.state.leaves, 330, 14);
    }
    if (level && level.n > 0) {                                      // ankh counter
      drawAnkh(284, 17, 0.8);
      g.strokeText('x' + P.state.ankhs, 291, 14); g.fillText('x' + P.state.ankhs, 291, 14);
    }
    const bo = enemies.find(e => EN[e.type].ai.boss && alive(e));
    if (bo) {                                                         // boss bar along the bottom
      g.textAlign = 'center'; g.strokeText(EN[bo.type].ai.bossName || EN[bo.type].title, V.w / 2, 196); g.fillText(EN[bo.type].ai.bossName || EN[bo.type].title, V.w / 2, 196); g.textAlign = 'left';
      bar(64, 206, 256, 6, bo.hp / bo.maxHp);
    }
    const t = `${hp}/${maxHp()}`;
    g.strokeText(t, 232, 14); g.fillText(t, 232, 14);
  }
  function drawFloaters(sx, sy) {
    const X = wx => V.anchorX + (wx - camX) + sx, Y = wy => V.feetRow + camY + sy - wy;
    g.font = 'bold 10px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 3; g.lineJoin = 'round';
    for (let i = floaters.length - 1; i >= 0; i--) {
      const f = floaters[i], age = clock - f.t0;
      if (age > FLOAT_MS) { floaters.splice(i, 1); continue; }
      g.globalAlpha = age < FLOAT_MS - 300 ? 1 : (FLOAT_MS - age) / 300;
      const fx = Math.round(X(f.wx)), fy = Math.round(Y(f.wy) - age * 0.035);
      g.strokeStyle = '#000'; g.strokeText(f.text, fx, fy);
      g.fillStyle = f.color; g.fillText(f.text, fx, fy);
    }
    g.globalAlpha = 1; g.textAlign = 'left';
  }

  // one sheet cell, optionally washed with a colour (a red hit, a white block or parry)
  const wash = document.createElement('canvas'), wg = wash.getContext('2d');
  function blit(im, sx, w, h, dx, dy, tc, sc) {
    sc = sc == null ? 1 : sc;
    const dw = w * sc, dh = h * sc;
    if (!tc) { g.drawImage(im, sx, 0, w, h, dx, dy, dw, dh); return; }
    if (wash.width < w || wash.height < h) { wash.width = Math.max(wash.width, w); wash.height = Math.max(wash.height, h); }
    wg.globalCompositeOperation = 'source-over'; wg.globalAlpha = 1;
    wg.clearRect(0, 0, wash.width, wash.height);
    wg.drawImage(im, sx, 0, w, h, 0, 0, w, h);
    wg.globalCompositeOperation = 'source-atop'; wg.globalAlpha = tc.alpha || 0.7;
    wg.fillStyle = tc.color; wg.fillRect(0, 0, w, h);
    g.drawImage(wash, 0, 0, w, h, dx, dy, dw, dh);
  }

  function drawEnemies(sx, sy) {
    const gy = V.feetRow + camY + sy;
    for (const e of enemies) {
      const T = EN[e.type];
      let alpha = 1;
      if (e.state === 'dying') {
        const fade = T.ai.death ? 500 : 400;
        if (!T.ai.death && !e.sinkAt && e.dead < DIE_MS - fade && Math.floor(e.dead / 60) % 2) continue;   // no death art: flicker
        alpha = Math.max(0, Math.min(1, (DIE_MS - e.dead) / fade));
      }
      const cell = T.anims[e.anim].frames[e.k];
      const [cw, ch] = T.cell, [ax, ay] = T.anchor;
      const vx = Math.round(V.anchorX + (e.base - camX) + sx);
      g.save();
      if (e.sinkAt && curMap) pitClip(sx, sy);
      g.globalAlpha = alpha;
      g.translate(vx, Math.round(gy - (e.fy || 0) - (e.jy || 0) + (e.sinkAt ? PIT_GRAV * (clock - e.sinkAt) * (clock - e.sinkAt) : 0)));
      if (e.face > 0) g.scale(-1, 1);
      if (e.type === 'heavybag' && e.sw) { const top = ay * SPRITE_SCALE; g.translate(0, -top); g.rotate(e.sw.a); g.translate(0, top); }   // it swings from its top
      blit(img[T.sheet].im, cell * cw, cw, ch, -ax * SPRITE_SCALE * (e.scale||1), -ay * SPRITE_SCALE * (e.scale||1), e.tint && clock < e.tint.until ? e.tint : null, SPRITE_SCALE * (e.scale||1));
      g.restore();
    }
  }

  function drawBoxes(sx, sy) {
    const X = wx => V.anchorX + (wx - camX) + sx, Y = wy => V.feetRow + camY + sy - wy;
    g.save();
    g.lineWidth = 1;
    g.strokeStyle = '#ffe14d';
    for (const e of enemies) {
      const b = hurtOf(e);
      if (b) g.strokeRect(X(b[0]) + 0.5, Y(b[3]) + 0.5, b[2] - b[0], b[3] - b[1]);
    }
    g.strokeStyle = '#4dd2ff';
    { const b = herBox(); g.strokeRect(X(b[0]) + 0.5, Y(b[3]) + 0.5, b[2] - b[0], b[3] - b[1]); }
    g.strokeStyle = '#ff8a3d';
    for (const e of enemies) {
      const b = e.state === 'attack' ? boxOf(e, frameOf(e).hit) : null;
      if (b) g.strokeRect(X(b[0]) + 0.5, Y(b[3]) + 0.5, b[2] - b[0], b[3] - b[1]);
    }
    g.strokeStyle = '#ff4d4d';
    for (const h of lastHits) for (const s of h.f.hits) {
      const w = worldShape(s, h);
      g.beginPath();
      if (w.shape === 'box') g.rect(X(w.box[0]), Y(w.box[3]), w.box[2] - w.box[0], w.box[3] - w.box[1]);
      else if (w.shape === 'circle') g.arc(X(w.c[0]), Y(w.c[1]), w.r, 0, Math.PI * 2);
      else {
        g.lineWidth = w.r * 2; g.lineCap = 'round'; g.globalAlpha = 0.45; g.strokeStyle = '#ff4d4d';
        g.moveTo(X(w.a[0]), Y(w.a[1])); g.lineTo(X(w.b[0]), Y(w.b[1]));
        g.stroke(); g.lineWidth = 1; g.globalAlpha = 1; continue;
      }
      g.stroke();
    }
    g.restore();
  }

  function follow(dt) {
    camX = V.anchorX;                    // one map is one screen: no sideways scrolling, world x is screen x
    if (!cur) return;
    const ease = 1 - Math.exp(-dt / 70);
    camY += (Math.max(0, herY() - CAM_KEEP) - camY) * ease;
  }

  // ------------------------------------------------------------------ HUD
  const logEl = document.getElementById('log');
  function logMove(id, via) {
    if (!logEl) return;
    const li = document.createElement('li');
    li.textContent = `${id}  (${id === 'jump' ? 'Up' : D.moves[id].input}${via && via !== 'action' ? ', ' + via : ''})`;
    logEl.prepend(li);
    while (logEl.children.length > 8) logEl.lastChild.remove();
  }
  const HOLDABLE = b => BibooInput.DIRS.includes(b) || D.input.bindings.some(x => x.input === b && x.type === 'hold');
  const keysOf = input => input === 'none' ? '' :
    input.split('-').map(step => step.split('+').map(b => KEY_LABEL[b] || b).join('+')).join(' then ');
  function how(b) {
    const steps = b.input.split('-');
    if (b.type === 'idle') return 'nothing pressed';
    if (HOLD_FIRE[b.move] && ENERGY_HOLD.has(b.move)) return 'press and hold to charge (uses energy, Max glows blue when full), let go to fire';
    if (b.type === 'hold') return b.release_into ? 'hold to charge, let go to swing the chop' : 'hold';
    if (b.type === 'tap') return 'tap';
    if (b.type === 'press') return 'press';
    if (b.type === 'air') return 'press while in the air (jumping or falling); crashes down from that height';
    if (b.type === 'chord') {
      const keys = b.input.split('+');
      if (HOLD_FIRE[b.move]) return 'hold together to charge, let go to fire';
      if (b.loose) return 'together, or one after another in any order';
      if (b.held) return `together, or hold ${b.held.join('+')} and press ${keys.filter(k => !b.held.includes(k)).join('+')}`;
      const dirs = keys.filter(k => BibooInput.DIRS.includes(k));
      if (dirs.length) return `hold ${dirs.join('+')}, press ${keys.filter(k => !dirs.includes(k)).join('+')}`;
      return 'together';
    }
    if (steps.length === 2 && HOLDABLE(steps[0])) {
      const last = steps[1].includes('+') ? steps[1] + ' together' : steps[1];
      return `tap or hold ${steps[0]}, then ${last}`;
    }
    return 'one after another' + (b.input.includes('+') ? ' (+ together)' : '');
  }
  // Rows for the Moves menu: the base controls first, then every combo or button the player has unlocked.
  function moveRows() {
    const rows = [];
    for (const b of D.input.bindings) {
      if (b.type === 'idle' || b.move === 'ultimate' || !moveOpen(b.move)) continue;
      const m = D.moves[b.move];
      const sb = b.move === 'jump' ? Object.assign({}, b, { input: 'Up' }) : b;
      const held = b.release_into || HOLD_FIRE[b.move];                       // hold-and-release moves
      rows.push({ move: b.move, note: held ? 'hold, then let go' : '', name: b.release_into && D.moves[b.release_into] ? D.moves[b.release_into].title : null,
                  section: BASE_MOVES.has(b.move) ? 'Controls' : 'Unlocked combos',
                  pad: (b.move === 'recover' ? 'R1' : sb.input === 'none' ? '(nothing)' : sb.input) + (b.type === 'air' ? ' (air)' : ''),
                  keys: keysOf(sb.input), title: m ? m.title : b.move, how: how(sb) });
    }
    if (P.has('meter_charge')) rows.push({ move: 'meter_charge', note: 'hold', section: 'Unlocked combos', pad: 'L1+R1', keys: 'Q+W', title: 'Meter charge', how: 'hold both: every meter you own slowly fills' });
    const extra = (uid, pad, keys, title, how) => { if (P.has(uid)) rows.push({ move: uid, uid, note: '', section: 'Unlocked combos', pad, keys, title, how }); };
    extra('chain', 'A x5', 'Z x5', 'Attack chain', 'mash A: slash, three chain strikes (no knockback), then the heavy chop without charging (uses energy)');
    extra('chain_burst', 'A x4, B', 'Z x4, X', 'Burst chain', 'after the fourth A, tap B: the chain ends in an energy burst (uses energy)');
    extra('fly', 'A, B, A, B, Up', 'Z, X, Z, X, Up', 'Flight', 'fly for 5 seconds with a blue particle trail; Up and Down climb and dive, Left and Right steer');
    extra('rainbow', 'A, B, A, B, A, B', 'Z, X, Z, X, Z, X', 'Rainbow guard', '5 seconds untouchable while cycling the rainbow; pitfalls are solid ground');
    extra('ultimate', 'A x4, L1+R1+L2+R2', 'Z x4, Q+W+1+2', 'Ultimate chain', 'the chain, then a taunt, then the empowerment, cloud, fire and laser beams in turn');
    if (P.has('double_jump')) rows.push({ move: 'double_jump', note: '', section: 'Unlocked combos', pad: 'Up, Up (air)', keys: 'Up then Up', title: 'Double jump', how: 'press jump again in the air: a spinning second jump' });
    // one line per move: the Left/Right variants of an input (Right+A, Left+A) become a single "Left/Right+A", duplicates go,
    // and the unlocked combos are listed in the order the player unlocked them
    const merge = (list) => {
      const out = [];
      for (const r of list) {
        const prev = out.find(o => o.move === r.move && o.section === r.section && (o.title === r.title));
        if (!prev) { out.push(Object.assign({}, r, { alts: [r] })); continue; }
        if (!prev.alts.some(a => a.pad === r.pad)) prev.alts.push(r);
      }
      for (const o of out) {
        if (o.alts.length < 2) continue;
        const dir = t => t.replace(/\bLeft\b|\bRight\b/g, 'Left/Right').replace(/←|→/g, '←/→');
        const pads = [...new Set(o.alts.map(a => dir(a.pad)))], keys = [...new Set(o.alts.map(a => dir(a.keys)))];
        o.pad = pads.join(' or '); o.keys = keys.join(' or ');
        o.how = o.how.replace(/hold Right/, 'hold Left or Right');
      }
      return out;
    };
    const squash = (t, sep, join) => {                           // Down-Down-Down-Down-A -> Down x4, A
      const toks = t.split(sep), out = [];
      for (let i = 0; i < toks.length;) { let j = i; while (j + 1 < toks.length && toks[j + 1] === toks[i]) j++; out.push(j > i ? `${toks[i]} x${j - i + 1}` : toks[i]); i = j + 1; }
      return out.join(join);
    };
    const tidy = r => {
      if (/-/.test(r.pad)) r.pad = squash(r.pad.replace(/Left\/Right-Left\/Right/g, 'Left/Right x2'), '-', ', ');
      if (/ then /.test(r.keys)) r.keys = squash(r.keys.replace(/←\/→ then ←\/→/g, '←/→ x2'), ' then ', ', ');
    };
    const order = r => { const u = P.UNLOCKS.find(x => r.uid ? x.id === r.uid : (x.moves || []).includes(r.move)); const i = u ? P.state.unlocked.indexOf(u.id) : -1; return i < 0 ? 1e6 : i; };
    const ctrl = merge(rows.filter(r => r.section === 'Controls'));
    const combos = merge(rows.filter(r => r.section !== 'Controls'));
    combos.forEach(tidy);
    combos.forEach((r, i) => { r._i = i; });
    combos.sort((a, b) => order(a) - order(b) || a._i - b._i);
    return ctrl.concat(combos);
  }
  function lockedCount() {
    const seen = new Set();
    for (const b of D.input.bindings) if (b.type !== 'idle' && !moveOpen(b.move)) seen.add(b.move);
    if (!P.has('double_jump')) seen.add('double_jump');
    if (!P.has('meter_charge')) seen.add('meter_charge');
    return seen.size;
  }
  const killsEl = document.getElementById('kills');
  const padStatus = () => padName ? `Controller: ${padName}` : 'Controller: none seen yet. Connect it, then press any button on it.';
  function hud() {
    if (killsEl) killsEl.textContent = (level ? (level.def.training ? 'Sunset Training' : `Level ${level.n}.${level.idx + 1}   Kills ${kills}`) : '') + (cheats.invincible ? '  [GOD]' : '') + (cheats.infinite ? '  [INF]' : '') + (cheats.nopit ? '  [NOPIT]' : '');
  }

  // ------------------------------------------------------------------ menus, screens and the loop
  // Screens: 'title' (the menu over the overworld), 'overworld' (pick a level) and 'level' (playing). A menu (Start,
  // Enter, Escape) pauses the level. Game time (`clock`) only advances while a level runs.
  const UI = window.BibooUI;
  let last = 0;
  let assetsReady = false, paused = false, gameOver = false, levelDone = false, devOpen = false;
  const ow = { sel: 0 };                                             // overworld cursor: index of the selected level

  // Menu navigation: while a menu is open, Up and Down (arrows, d-pad or stick) move the highlight, A activates and
  // B goes back. On the overworld, Left/Right or Up/Down pick a level and A enters it. Edge detected, with key repeat.
  const navPrev = { Up: false, Down: false, Left: false, Right: false, A: false, B: false, dev: false }, navNext = { Up: 0, Down: 0 };
  function navPoll(t) {
    const on = k => keyDown.has(k) || padDown.has(k);
    const now = { Up: on('Up'), Down: on('Down'), Left: on('Left'), Right: on('Right'), A: on('A'), B: on('B') };
    const chord = ['L1', 'L2', 'R1', 'R2'].every(on);                  // all four shoulder buttons together, in the pause menu: the Cheats entry appears
    if (chord && !navPrev.dev && assetsReady && UI && UI.isOpen() && UI.view === 'main' && !cheatsShown) { cheatsShown = true; UI.refresh(); }
    navPrev.dev = chord;
    if (UI && UI.isOpen()) {
      for (const k of ['Up', 'Down']) {
        if (now[k] && (!navPrev[k] || t >= navNext[k])) { UI.nav(k === 'Up' ? -1 : 1); navNext[k] = t + (navPrev[k] ? 110 : 320); }
      }
      if (now.A && !navPrev.A) UI.activate();
      if (now.B && !navPrev.B) UI.back();
    } else if (screen === 'overworld' && !paused && !devOpen) {
      const n = LV.levels.length + 2;                                  // the six levels, Sunset Training and the Bone Merchant
      if ((now.Left && !navPrev.Left) || (now.Up && !navPrev.Up)) ow.sel = (ow.sel + n - 1) % n;
      if ((now.Right && !navPrev.Right) || (now.Down && !navPrev.Down)) ow.sel = (ow.sel + 1) % n;
      if (now.A && !navPrev.A) enterLevel(ow.sel + 1);
    }
    Object.assign(navPrev, now);
  }
  // buttons still held when a menu closes are ignored until they are let go, so pressing A on "Resume" does not slash
  const ignoreUntilUp = new Set();
  function ignoreHeldButtons() { for (const b of BUTTONS) if (btnHeld(b)) ignoreUntilUp.add(b); }

  // Turning mirrors the sprite about her anchor, but the point between her legs sits LEGS px ahead of it, so a bare flip would swing
  // her feet 2*LEGS px across. Instead the anchor moves so that point stays where it was. Skipped where that would
  // push the anchor into a block or a map edge.
  let visFace = 1;
  function turnShift(from, to) {
    const shift = (from - to) * LEGS, ax = playerX() + shift, feet = herY();
    if (ax < EDGE + 2 || ax > MAP_W - EDGE - 2) return;
    if (curMap && curMap.solids.some(sd => feet < sd.top - 2 && ax + FOOT > sd.x0 && ax - FOOT < sd.x1)) return;
    x += shift;
  }
  function tickLevel(t, dt) {
    if (freeze > 0) { freeze -= dt; readButtons(t); draw(); hud(); return; }   // (presses made during the freeze are still read)      // hit-stop: the world holds still for a moment
    clock += dt;                                      // game time: it does not run while a menu is open
    if (storyAt !== null && clock >= storyAt) { storyAt = null; P.state.story.double = true; playStory('double', () => { paused = false; }); return; }
    if (pitFall) {                                    // she fell into a pit: the rest of the world goes on while she drops out of sight
      if (pitOffScreen() && !gameOver) { hp = 0; triggerGameOver(); }
      stepEffects(dt); stepEnemies(dt); follow(dt); draw(); hud(); drawMonitor();
      return;
    }
    if (level && level.def.training) { hp = maxHp(); energyMeter = maxOf('energy'); empowerMeter = maxOf('empower'); superMeter = maxOf('super'); }   // training: nothing runs out
    if (cheats.infinite) { energyMeter = maxOf('energy'); empowerMeter = maxOf('empower'); superMeter = maxOf('super'); }
    readButtons(t);
    for (const e of reader.update(t)) {
      if (e.move === 'ultimate') { startUltimate(); continue; }
      const via = e.move === 'slash' && e.via === 'tap' ? 'press' : e.via;
      if (e.move === 'slash' && via === 'press' && chainPress()) continue;
      if (e.move === 'parry' && via === 'tap' && chainBurst()) continue;
      request(e.move, via);
    }
    chainTick(); ultTick();
    const before = cur && BLOCKED.has(cur.id) ? playerX() : null;
    step(dt, t);
    { const vf = hf(); if (vf !== visFace) { if (!stun) turnShift(visFace, vf); visFace = vf; } }
    if (cur && cur.crash && cur.id === 'jump' && rootOf(cur)[1] > 0) airCrash('air');
    blockMove(before);
    physics();
    if (screen !== 'level' || !curMap) return;        // the level just ended
    if (flight && (stun || !(cur && cur.id === 'jump' && cur.phys))) flight = null;
    if (rainbow) { if (rainbowOn() && !stun) tint = rainbowTint(); else if (!rainbowOn()) rainbow = null; }
    checkPit();
    if (!fall && (!cur || cur.kind === 'hold' || cur.kind === 'land' || (cur.id === 'jump' && cur.kind === 'action' && !cur.phys))) dblUsed = false;   // back on her feet
    if (hp <= 0 && !gameOver) triggerGameOver();     // any source of damage ends the run, not only an enemy hit
    beamHits();
    stepHeal(dt);
    stepEffects(dt);
    stepShots(dt);
    stepBombs();
    if (cur && cur.kind === 'action' && !hitQ.length) queueHit();   // the frame still on screen
    stepEnemies(dt);
    resolveHits();
    enemyAttacks();
    follow(dt);
    draw();
    hud();
    drawMonitor();
  }

  // ---- the story: a prologue before level 1, Mirror Max's confession when she falls, and the ending after the last level.
  // Each page is a full-screen scene drawn on the canvas with the text panel (the message menu) on top. "Skip story" ends it.
  const STORY = {
    prologue: [
      ['calm', 'Max Wishbone', 'Max was ten years old. She had a mom, a dad, and a little brother. The house was small and loud. It was home.'],
      ['fire', 'The Fire', 'One night the house went up in flames. Max saw a figure on the lawn, lit by the fire. The figure looked exactly like her.'],
      ['fire', 'The Fire', 'Her parents and her little brother never came out.'],
      ['crowd', 'The Village', 'The village came running. They saw the smoke, and they saw Max. "She did it," they said. Nobody would listen. Max ran.'],
      ['sea', 'Miracle Island', 'She found a boat and sailed to Miracle Island. It is full of monsters. At its center lies the Legendary Wish Scroll, which can grant any wish.'],
      ['sea', 'Miracle Island', 'Max gripped her sword. She would fight her way to the center.'],
    ],
    double: [
      ['double', 'Max, fallen', 'The other Max drops to one knee. Her body flickers like a candle in the wind.'],
      ['double', 'The Double', '"You still do not get it," she says. "I am not a stranger. I came from you."'],
      ['double', 'The Double', '"I was born from your magic and your worst feelings. I am every angry thought you ever had, with a body."'],
      ['double', 'The Double', '"You can beat me. It will not last. Unless you let your anger out in a healthy way, I will rise again."'],
      ['double', 'Max', 'The double fades into red sparks. The way to the center of the island is open.'],
    ],
    ending: [
      ['altar', 'The Center', 'Max walked on, past the last of the monsters, to the very center of the island.'],
      ['altar', 'The Scroll', 'Behind a ring of old stones lay the Legendary Wish Scroll. It glowed softly. Max opened it. "Take me back," she said. "To before the fire."'],
      ['rewind', 'Back in Time', 'The world spun backward. Days and nights blurred past, until the sky settled on that last evening.'],
      ['calm', 'Home', 'Max stood outside her house. Through the window she saw her mom, her dad, and her little brother, laughing at supper. They were alive. This was what her anger had burned down.'],
      ['calm', 'Home', 'All that hatred had never made her strong. It had only made her alone. It had hurt her far more than it ever helped.'],
      ['meditate', 'Max', 'Max sat down in the grass. She took a deep breath. In, and out. Again. She let the anger go a little at a time, until it floated away like smoke.'],
      ['sunrise', 'Max', '"Holding on to anger is self-destructive," Max said. "I have to appreciate what I have, before it is all gone."'],
      ['sunrise', 'THE END', 'Thank you for playing Parry Perry.'],
    ],
  };
  let story = null, storyAt = null;
  function playStory(id, done) {
    story = { id, i: 0, pages: STORY[id], done };
    hold = null; queued = null; paused = true;
    storyPage();
  }
  function storyEnd() {
    const d = story && story.done; story = null; hideMenu(); ignoreHeldButtons();
    if (d) d();
  }
  function storyPage() {
    const pg = story.pages[story.i], last = story.i === story.pages.length - 1;
    UI.open('message', { story: true, title: pg[1], msg: pg[2], items: [
      { label: last ? 'Continue' : 'Next', primary: true, id: 'btn-start', fn: () => { if (last) storyEnd(); else { story.i++; storyPage(); } } },
      ...(last ? [] : [{ label: 'Skip story', fn: storyEnd }]),
    ] });
  }
  const figure = (X, Y, col, o) => {                            // a small standing or sitting figure with feet at (X, Y)
    o = o || {}; const s = o.s || 1;
    g.fillStyle = col;
    if (o.sit) { g.fillRect(X - 4 * s, Y - 6 * s, 8 * s, 6 * s); g.fillRect(X - 3 * s, Y - 14 * s, 6 * s, 8 * s); g.fillRect(X - 3 * s, Y - 20 * s, 6 * s, 6 * s); }
    else { g.fillRect(X - 3 * s, Y - 7 * s, 2 * s, 7 * s); g.fillRect(X + s, Y - 7 * s, 2 * s, 7 * s); g.fillRect(X - 3 * s, Y - 16 * s, 6 * s, 9 * s); g.fillRect(X - 3 * s, Y - 22 * s, 6 * s, 6 * s); }
    if (o.sword) { g.fillStyle = '#c8ccd8'; g.fillRect(X + 3 * s, Y - 22 * s, 2 * s, 14 * s); g.fillRect(X + s, Y - 12 * s, 6 * s, s); }
  };
  function drawStory() {
    const sc = story.pages[story.i][0], W = V.w, H = V.h, T = clock, gy = 140;
    const sky = (a, b) => { const gr = g.createLinearGradient(0, 0, 0, gy); gr.addColorStop(0, a); gr.addColorStop(1, b); g.fillStyle = gr; g.fillRect(0, 0, W, H); };
    const ground = c => { g.fillStyle = c; g.fillRect(0, gy, W, H - gy); };
    const house = (X, lit) => { g.fillStyle = '#4a3226'; g.fillRect(X, gy - 40, 70, 40); g.fillStyle = '#2c1c16'; g.beginPath(); g.moveTo(X - 6, gy - 40); g.lineTo(X + 35, gy - 68); g.lineTo(X + 76, gy - 40); g.fill(); g.fillStyle = lit ? '#ffd870' : '#2a2018'; g.fillRect(X + 10, gy - 28, 14, 12); g.fillRect(X + 46, gy - 28, 14, 12); };
    const flames = X => { for (let i = 0; i < 16; i++) { const fx = X - 4 + i * 5, fh = 14 + 12 * Math.abs(Math.sin(T * 0.008 + i * 1.7)) + (i % 3) * 5; g.fillStyle = i % 2 ? '#ff6a1a' : '#ffb02e'; g.beginPath(); g.moveTo(fx, gy - 8); g.lineTo(fx + 2.5, gy - 8 - fh * 1.6); g.lineTo(fx + 5, gy - 8); g.fill(); } g.fillStyle = 'rgba(255,120,40,0.18)'; g.fillRect(0, 0, W, H); };
    const stars = n => { g.fillStyle = '#fff'; for (let i = 0; i < n; i++) { const a = (i * 97) % W, b = (i * 53) % 110; g.globalAlpha = 0.5 + 0.5 * Math.sin(T * 0.003 + i); g.fillRect(a, b, 1, 1); } g.globalAlpha = 1; };
    const MAXC = '#c9b8ff';
    if (sc === 'calm') { sky('#1b2a52', '#e9a15a'); stars(30); ground('#2d4a2a'); house(150, true); figure(110, gy + 2, MAXC, { s: 1 }); }
    else if (sc === 'fire') { sky('#150a14', '#a63a14'); ground('#241a14'); house(150, false); flames(146); figure(100, gy + 4, MAXC); figure(270, gy + 4, '#8a1a2a'); }
    else if (sc === 'crowd') { sky('#0b0e1e', '#27223a'); stars(40); ground('#1b1a24'); g.fillStyle = '#ff9a3a'; for (let i = 0; i < 6; i++) { const fx = 40 + i * 60; g.fillRect(fx, gy - 22, 2, 14); g.globalAlpha = 0.6 + 0.4 * Math.sin(T * 0.01 + i); g.fillRect(fx - 1, gy - 28, 4, 6); g.globalAlpha = 1; } for (let i = 0; i < 6; i++) figure(30 + i * 28, gy + 6, '#3a3550'); figure(300 + ((T * 0.06) % 120), gy + 6, MAXC); }
    else if (sc === 'sea') { sky('#0d1a33', '#31527a'); stars(25); g.fillStyle = '#10264a'; g.fillRect(0, 120, W, H - 120); g.fillStyle = '#1b3a6a'; for (let i = 0; i < 24; i++) g.fillRect((i * 29 + T * 0.02) % W, 130 + (i * 11) % 80, 14, 1); g.fillStyle = '#0a0f14'; g.beginPath(); g.moveTo(200, 120); g.lineTo(250, 70); g.lineTo(285, 95); g.lineTo(320, 55); g.lineTo(384, 120); g.fill(); g.fillStyle = '#6b4a2a'; g.fillRect(60 + Math.sin(T * 0.002) * 4, 140, 34, 6); figure(76 + Math.sin(T * 0.002) * 4, 141, MAXC, { sword: true }); }
    else if (sc === 'double') { sky('#1a0610', '#6a1424'); ground('#1a0a10'); g.fillStyle = 'rgba(255,40,60,0.12)'; g.fillRect(0, 0, W, H); figure(120, gy + 6, MAXC, { sword: true, s: 1.4 }); g.globalAlpha = 0.6 + 0.3 * Math.sin(T * 0.012); figure(264, gy + 6, '#e33a4a', { sit: true, s: 1.4 }); g.globalAlpha = 1; for (let i = 0; i < 14; i++) { g.fillStyle = '#ff5060'; g.fillRect(250 + (i * 7) % 30, gy - 20 - ((T * 0.03 + i * 17) % 60), 2, 2); } }
    else if (sc === 'altar') { sky('#0c1a14', '#1f4a3a'); stars(10); ground('#16241c'); g.fillStyle = '#5a6a60'; for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; g.fillRect(192 + Math.cos(a) * 80 - 4, gy - 14 + Math.sin(a) * 6 - 20, 8, 22); } g.fillStyle = '#7a8a80'; g.fillRect(180, gy - 18, 24, 14); const gl = 0.5 + 0.4 * Math.sin(T * 0.004); g.fillStyle = `rgba(255,230,140,${gl})`; g.beginPath(); g.arc(192, gy - 28, 22, 0, 7); g.fill(); g.fillStyle = '#f4e4b0'; g.fillRect(186, gy - 26, 12, 8); figure(140, gy + 4, MAXC); }
    else if (sc === 'rewind') { g.fillStyle = '#0a0a1e'; g.fillRect(0, 0, W, H); for (let i = 0; i < 8; i++) { g.strokeStyle = `hsl(${(i * 40 + T * 0.1) % 360},70%,60%)`; g.lineWidth = 2; g.beginPath(); g.arc(192, 108, 14 + i * 12, -T * 0.004 * (i % 2 ? 1 : -1) * (1 + i * 0.2), -T * 0.004 * (i % 2 ? 1 : -1) * (1 + i * 0.2) + Math.PI * 1.4); g.stroke(); } g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.moveTo(192, 108); g.lineTo(192 + Math.cos(-T * 0.01) * 30, 108 + Math.sin(-T * 0.01) * 30); g.stroke(); }
    else if (sc === 'meditate') { sky('#16304a', '#7fc4a8'); ground('#2f5a38'); const gl = 0.25 + 0.15 * Math.sin(T * 0.003); g.fillStyle = `rgba(190,255,230,${gl})`; g.beginPath(); g.arc(192, gy - 20, 46, 0, 7); g.fill(); figure(192, gy + 2, MAXC, { sit: true, s: 1.5 }); for (let i = 0; i < 18; i++) { g.fillStyle = i % 3 ? '#e8fff4' : '#a8e8ff'; g.fillRect(150 + (i * 13) % 90, gy - ((T * 0.025 + i * 23) % 150), 2, 2); } }
    else { sky('#3a2a60', '#ffb870'); g.fillStyle = '#ffe9a0'; g.beginPath(); g.arc(192, 140 - Math.min(40, T * 0.01 % 60), 26, 0, 7); g.fill(); ground('#2f5a38'); house(250, true); figure(120, gy + 2, MAXC, {}); figure(150, gy + 4, '#b89a7a', {}); figure(172, gy + 4, '#7a6a9a', { s: 0.8 }); }
  }
  // ---- music: which track belongs to what is on screen (BibooMusic crossfades when it changes)
  function wantedTrack() {
    if (story) return story.id === 'ending' ? 'ending' : 'prologue';
    if (UI && UI.isOpen() && UI.view === 'shop') return 'shop';
    if (screen === 'title' || screen === 'overworld') return 'overworld';
    if (screen === 'level' && level) {
      if (level.n === 0) return 'training';
      return curMap && curMap.def && curMap.def.boss ? 'boss' + level.n : 'level' + level.n;
    }
    return null;
  }
  function frame(t) {
    pollPad();
    if (window.BibooMusic) { BibooMusic.pollPad(); BibooMusic.want(gameOver ? null : wantedTrack()); }
    navPoll(t);
    const dt = Math.min(100, last ? t - last : 16);
    last = t;
    if (assetsReady) {
      if (story) { clock += dt; drawStory(); }
      else if (screen === 'level') { if (!paused && !gameOver && !devOpen) tickLevel(t, dt); }
      else { clock += dt; stepEffects(dt); if (screen === 'title') drawTitle(); else drawOverworld(); hud(); }
    }
    requestAnimationFrame(frame);
  }

  // ---- the overworld: five level nodes on a path; a level opens when the one before it is beaten
  const OW_NODES = [[36, 150], [90, 112], [144, 146], [198, 106], [252, 144], [306, 108], [348, 60]];   // six levels, then the optional training node
  const nodeAt = i => i === LV.levels.length + 1 ? MERCHANT_AT : OW_NODES[i % OW_NODES.length];
  const MERCHANT_AT = [50, 92];                                     // the Bone Merchant's feet; selection index levels+1
  function openShop() {
    if (!UI) return;
    UI.open('shop', { msg: 'Spend your Leaves. Press B to leave.', back: () => { UI.close(); ignoreHeldButtons(); canvas.focus(); } });
  }
  // ---- the title screen: drifting level 1 scenery, the logo with a sword slash sweeping through it, and Max on guard
  function drawTitle() {
    const W = V.w, H = V.h, T = clock;
    g.fillStyle = '#10151c'; g.fillRect(0, 0, W, H);
    for (const l of D.layers) drawLayer(img[l.src].im, -T * 0.02 * l.parallax, 0);
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(10,8,24,0.55)'); gr.addColorStop(0.55, 'rgba(10,8,24,0.1)'); gr.addColorStop(1, 'rgba(10,8,24,0.55)');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    // Max, idle, large, on the left
    const m = D.moves.idle, cw = m.cell[0], ch = m.cell[1], total = m.frames.reduce((a, f) => a + f.ms, 0);
    let t = T % total, k = 0; while (k < m.frames.length - 1 && t >= m.frames[k].ms) { t -= m.frames[k].ms; k++; }
    const sc = 0.85, ax = 78, ay = H - 30;
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(ax, ay + 2, 26, 4, 0, 0, 7); g.fill();
    blit(img[m.sheet].im, k * cw, cw, ch, ax - m.anchor[0] * sc, ay - m.anchor[1] * sc, null, sc);
    // the logo
    g.save(); g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    const draw = (txt, cx, cy, size) => {
      g.font = `bold ${size}px monospace`;
      const gap = size * 0.78, x0 = cx - (txt.length - 1) * gap / 2;
      for (let i = 0; i < txt.length; i++) {
        const bob = Math.sin(T * 0.003 + i * 0.7) * 1.5, X = x0 + i * gap, Y = cy + bob;
        g.lineWidth = 6; g.strokeStyle = '#1a0c06'; g.strokeText(txt[i], X + 1, Y + 2);
        const fg = g.createLinearGradient(0, Y - size / 2, 0, Y + size / 2); fg.addColorStop(0, '#fff3b0'); fg.addColorStop(0.5, '#ffc83a'); fg.addColorStop(1, '#d8641c');
        g.fillStyle = fg; g.lineWidth = 3; g.strokeStyle = '#3a1608'; g.strokeText(txt[i], X, Y); g.fillText(txt[i], X, Y);
      }
    };
    const intro = Math.min(1, T / 700);
    g.globalAlpha = intro; draw('PARRY', 232, 52 - (1 - intro) * 14, 34); draw('PERRY', 232, 88 - (1 - intro) * 14, 34); g.globalAlpha = 1;
    // a sword slash sweeping across the logo, now and then
    const sweep = (T % 4200) / 4200, sx0 = 60 + sweep * 3 * 360;
    if (sweep < 0.34) { g.globalAlpha = 0.85 * Math.sin(sweep / 0.34 * Math.PI); g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.moveTo(sx0 - 40, 120); g.lineTo(sx0 + 10, 28); g.stroke(); g.lineWidth = 1; g.beginPath(); g.moveTo(sx0 - 30, 120); g.lineTo(sx0 + 20, 28); g.stroke(); g.globalAlpha = 1; }
    g.font = 'bold 8px monospace'; g.fillStyle = '#e8e0ff'; g.strokeStyle = '#000'; g.lineWidth = 3;
    g.strokeText('A MAX WISHBONE ADVENTURE', 232, 112); g.fillText('A MAX WISHBONE ADVENTURE', 232, 112);
    g.font = '7px monospace'; g.textAlign = 'right'; g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillText(window.BIBOO_VER || '', W - 4, H - 6);
    g.restore();
  }
  function drawOverworld() {
    const n = LV.levels.length;
    g.fillStyle = '#10151c'; g.fillRect(0, 0, V.w, V.h);
    for (const l of D.layers) drawLayer(img[l.src].im, -clock * 0.012 * l.parallax, 0);
    g.fillStyle = 'rgba(8,12,20,0.6)'; g.fillRect(0, 0, V.w, V.h);
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = '#000'; g.lineWidth = 7; g.beginPath();
    for (let i = 0; i < n; i++) { const [px, py] = nodeAt(i); if (i) g.lineTo(px, py); else g.moveTo(px, py); }
    g.stroke();
    g.strokeStyle = '#8a7a55'; g.lineWidth = 3; g.setLineDash([6, 5]); g.beginPath();
    for (let i = 0; i < n; i++) { const [px, py] = nodeAt(i); if (i) g.lineTo(px, py); else g.moveTo(px, py); }
    g.stroke(); g.setLineDash([]);
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 2;
    for (let i = 0; i < n; i++) {
      const [px, py] = nodeAt(i), open = P.levelOpen(i + 1), done = P.state.cleared.includes(i + 1), sel = i === ow.sel;
      g.fillStyle = '#000'; g.beginPath(); g.arc(px, py, 13, 0, Math.PI * 2); g.fill();
      g.fillStyle = done ? '#3ddc5f' : open ? '#c9962a' : '#3a3a44'; g.beginPath(); g.arc(px, py, 11, 0, Math.PI * 2); g.fill();
      g.font = 'bold 10px monospace'; g.fillStyle = open ? '#1a1206' : '#777'; g.fillText(String(i + 1), px, py + 1);
      if (!open) { g.fillStyle = '#9a9aa8'; g.fillRect(px - 4, py + 4, 8, 6); g.strokeStyle = '#9a9aa8'; g.lineWidth = 1.5; g.beginPath(); g.arc(px, py + 4, 3, Math.PI, 0); g.stroke(); }
      if (sel) { g.strokeStyle = '#ffe14d'; g.lineWidth = 2; g.globalAlpha = 0.6 + 0.4 * Math.sin(clock / 160); g.beginPath(); g.arc(px, py, 16, 0, Math.PI * 2); g.stroke(); g.globalAlpha = 1; }
    }
    { const [px, py] = nodeAt(n), sel = ow.sel === n;                  // the optional training node, off the main path
      g.strokeStyle = '#ff7ad8'; g.lineWidth = 1.5; g.setLineDash([3, 4]); g.beginPath(); g.moveTo(...nodeAt(0)); g.quadraticCurveTo(160, 40, px, py); g.stroke(); g.setLineDash([]);
      g.fillStyle = '#000'; g.beginPath(); g.arc(px, py, 13, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#c04ab8'; g.beginPath(); g.arc(px, py, 11, 0, Math.PI * 2); g.fill();
      g.font = 'bold 10px monospace'; g.fillStyle = '#fff'; g.fillText('T', px, py + 1);
      if (sel) { g.strokeStyle = '#ffe14d'; g.lineWidth = 2; g.globalAlpha = 0.6 + 0.4 * Math.sin(clock / 160); g.beginPath(); g.arc(px, py, 16, 0, Math.PI * 2); g.stroke(); g.globalAlpha = 1; } }
    { const mi = n + 1, sel = ow.sel === mi, M = D.items && D.items.merchant, im2 = M && img[M.src] && img[M.src].im;   // the Bone Merchant sits by the first level
      if (im2) {
        const bob2 = Math.sin(clock / 400) * 1;
        g.fillStyle = 'rgba(0,0,0,0.4)'; g.beginPath(); g.ellipse(MERCHANT_AT[0], MERCHANT_AT[1] + 1, 24, 5, 0, 0, Math.PI * 2); g.fill();
        g.drawImage(im2, Math.round(MERCHANT_AT[0] - M.w / 2), Math.round(MERCHANT_AT[1] - M.h + bob2), M.w, M.h);
        g.font = 'bold 7px monospace'; g.textAlign = 'center'; g.textBaseline = 'top'; g.strokeStyle = '#000'; g.lineWidth = 3; g.fillStyle = '#ffe14d';
        g.strokeText('BONE MERCHANT', MERCHANT_AT[0], MERCHANT_AT[1] - M.h - 11); g.fillText('BONE MERCHANT', MERCHANT_AT[0], MERCHANT_AT[1] - M.h - 11);
        if (sel) { g.strokeStyle = '#ffe14d'; g.lineWidth = 2; g.globalAlpha = 0.6 + 0.4 * Math.sin(clock / 160); g.strokeRect(MERCHANT_AT[0] - M.w / 2 - 3, MERCHANT_AT[1] - M.h - 3, M.w + 6, M.h + 8); g.globalAlpha = 1; }
        g.textBaseline = 'middle';
      } }
    // Max stands on the selected node and bobs a little
    const [mx, my] = ow.sel === n + 1 ? [MERCHANT_AT[0] + 44, MERCHANT_AT[1] + 4] : nodeAt(ow.sel), im = D.moves.idle, sc = 0.4, bob = Math.sin(clock / 260) * 1.5;
    g.save(); g.translate(Math.round(mx), Math.round(my - 14 + bob));
    blit(img[im.sheet].im, 0, im.cell[0], im.cell[1], -im.anchor[0] * sc, -im.anchor[1] * sc, null, sc);
    g.restore();
    // header and the info strip for the selected level
    const isM = ow.sel === n + 1, isT = ow.sel >= n, L = isM ? { name: 'Bone Merchant', blurb: `Bones, Bone Powder, Quartz, Garnet, Diamonds, Mutagens and Scrolls. You have ${P.state.leaves} Leaves.` } : isT ? LV.training : LV.levels[ow.sel], open = isT || P.levelOpen(ow.sel + 1), got = P.state.unlocked.length;
    g.textAlign = 'center'; g.textBaseline = 'top'; g.lineJoin = 'round'; g.lineWidth = 3;
    g.font = 'bold 12px monospace'; g.strokeStyle = '#000'; g.fillStyle = '#ffe14d';
    g.strokeText('OVERWORLD', V.w / 2, 10); g.fillText('OVERWORLD', V.w / 2, 10);
    g.fillStyle = 'rgba(12,10,18,0.85)'; g.fillRect(24, 170, V.w - 48, 38);
    g.strokeStyle = '#ffd24a'; g.lineWidth = 1; g.strokeRect(24.5, 170.5, V.w - 49, 37);
    g.font = 'bold 9px monospace'; g.fillStyle = '#fff';
    g.fillText(isT ? L.name : `Level ${L.n}: ${L.name}${P.state.cleared.includes(L.n) ? '  (cleared)' : ''}`, V.w / 2, 175);
    g.font = '7px monospace'; g.fillStyle = '#e6e6ec';
    g.fillText(open ? L.blurb : `Locked. Beat level ${L.n - 1} first.`, V.w / 2, 188);
    g.fillStyle = '#9a9aa8';
    g.fillText(`${isM ? 'A or Enter: shop   ' : open ? 'A or Enter: play   ' : ''}Left and Right: choose   Start: menu   Moves found: ${got}/${P.UNLOCKS.length}`, V.w / 2, 198);
    g.textAlign = 'left';
    drawBanners();
  }
  function enterTraining() { startLevel(0, LV.training); }
  function enterLevel(n) {
    if (n === LV.levels.length + 2) { openShop(); return; }
    if (n > LV.levels.length) { enterTraining(); return; }
    if (!P.levelOpen(n)) { hint(`Locked: beat level ${n - 1} first`); return; }
    startLevel(n);
  }
  function goOverworld() {
    if (level) syncProgress();
    storyAt = null; level = null; curMap = null; screen = 'overworld'; paused = false; gameOver = false; levelDone = false;
    enemies.length = 0; respawns.length = 0; gems.length = 0; explosions.length = 0; floaters.length = 0;
    powerups.length = 0; particles.length = 0; banners.length = 0; hitQ.length = 0;
    stun = null; slide = null; fall = null; cur = null; queued = null; hold = null; tint = null; floorY = 0; camY = 0; rumble = null; flight = null; rainbow = null; ult = null;
    ow.sel = Math.max(0, Math.min(LV.levels.length, P.state.levelsUnlocked) - 1);
    hideMenu(); ignoreHeldButtons(); setStartLabel();
    if (killsEl) killsEl.textContent = '';
    canvas.focus();
  }


  // ---- the Cheats menu: after L1+R1+L2+R2 together in the pause menu it is listed there. It pauses the game.
  let devReturn = null, resetArmed = false;
  function openDev() {
    devReturn = UI.isOpen() ? { view: UI.view, opts: UI.opts } : null;
    devOpen = true; resetArmed = false;
    UI.open('dev', {});
  }
  function closeDev() {                              // back to the menu that was open under it, or to the game
    devOpen = false; resetArmed = false;
    if (devReturn) UI.open(devReturn.view, devReturn.opts); else { UI.close(); ignoreHeldButtons(); canvas.focus(); }
    devReturn = null;
  }
  function leaveDev() {                              // close the console and the menus under it: play on
    devOpen = false; devReturn = null; resetArmed = false;
    paused = false; gameOver = false; levelDone = false;
    if (hp <= 0) hp = maxHp();
    UI.close(); ignoreHeldButtons(); setStartLabel();
  }
  function toggleDev() { if (devOpen) closeDev(); else if (assetsReady) openDev(); }
  function devItems() {
    const onoff = v => v ? 'ON' : 'OFF', act = fn => () => { resetArmed = false; fn(); };
    return [
      { label: 'God Mode', state: onoff(cheats.invincible), fn: act(() => { cheats.invincible = !cheats.invincible; }) },
      { label: 'Infinite Meter', state: onoff(cheats.infinite), fn: act(() => { cheats.infinite = !cheats.infinite; }) },
      { label: 'Level Unlock', fn: act(() => { P.unlockAllLevels(); }) },
      { label: 'Master Unlock', fn: act(() => unlockEverything()) },
      { label: 'No Pitfalls', state: onoff(cheats.nopit), fn: act(() => { cheats.nopit = !cheats.nopit; }) },
      { label: 'Close', fn: closeDev, primary: true },
    ];
  }

  function setStartLabel() {
    const b = document.getElementById('btn-hud-start');
    if (b) b.textContent = screen === 'title' ? 'Start' : gameOver ? 'Retry' : paused ? 'Resume' : 'Menu';
  }
  function showMenu(msg) { newGameArmed = false; if (UI) UI.open('main', { msg: msg != null ? msg : '' }); }
  function hideMenu() { newGameArmed = false; if (UI) UI.close(); }
  function toggleFullscreen() {
    const stage = document.getElementById('stage') || canvas;
    if (!document.fullscreenElement) (stage.requestFullscreen && stage.requestFullscreen()) || (canvas.requestFullscreen && canvas.requestFullscreen());
    else document.exitFullscreen && document.exitFullscreen();
  }
  // B or Escape on the main list: back to the game (not from the title menu, Game Over or Level Complete)
  function closeMenu() {
    if (story) return;
    if (devOpen) { closeDev(); return; }
    if (screen === 'title' || gameOver || levelDone || !paused) return;
    togglePause();
  }
  // Saving is manual only. Progress lives in memory; "Save game" writes one snapshot to the browser, "Continue" loads it,
  // "New game" wipes it and starts level 1.1 with nothing unlocked. Closing or reloading the page loses unsaved progress.
  let newGameArmed = false;
  function newGame() {
    P.wipe(); P.reset();
    energyMeter = empowerMeter = superMeter = 0;
    refreshUnlocks();
    goOverworld();
    playStory('prologue', () => { goOverworld(); ow.sel = LV.levels.length + 1; banners.push({ title: 'You start with 100 Leaves', sub: 'Visit the Bone Merchant to buy moves', t0: clock, ms: 4200 }); });
  }
  function continueGame() {
    if (!P.loadSave()) { showMenu('No saved game'); return; }
    energyMeter = P.state.meters.energy; empowerMeter = P.state.meters.empower; superMeter = P.state.meters.super;
    refreshUnlocks();
    goOverworld();
  }
  function saveGame() {
    syncProgress();
    showMenu(P.saveToDisk() ? 'Game saved' : 'Could not save: the browser blocked storage');
  }
  function mainItems() {
    const items = [], hasSave = P.hasSave();
    if (screen === 'title') {
      if (hasSave) items.push({ label: 'Continue', fn: () => continueGame(), primary: true, id: 'btn-start' });
      items.push({ label: !hasSave ? 'New game' : newGameArmed ? 'Press again to erase the save' : 'New game (erases save)', primary: !hasSave, id: hasSave ? 'btn-new-game' : 'btn-start',
        fn: () => { if (hasSave && !newGameArmed) { newGameArmed = true; UI.refresh(); return; } newGame(); } });
    }
    else if (gameOver) items.push({ label: level && level.n > 0 && P.state.ankhs < 1 ? 'Out of ankhs: restart the level' : level && level.n > 0 ? `Retry this map (costs 1 ankh, ${P.state.ankhs} left)` : 'Retry this map', fn: () => retryMap(), primary: true, id: 'btn-start' });
    else items.push({ label: 'Resume', fn: () => togglePause(), primary: true, id: 'btn-start' });
    items.push({ label: 'Moves: Gamepad', fn: () => UI.open('moves', { msg: UI.opts.msg, device: 'pad' }) });
    items.push({ label: 'Moves: Keyboard', fn: () => UI.open('moves', { msg: UI.opts.msg, device: 'keys' }) });
    if (window.BibooMusic) items.push({ label: 'Music: ' + BibooMusic.label(), id: 'btn-music', fn: () => { BibooMusic.cycle(); UI.refresh(); } });
    if (cheatsShown) items.push({ label: 'Cheats', fn: () => openDev() });
    items.push({ label: 'Gems', fn: () => UI.open('gems', { msg: UI.opts.msg }) });
    if (screen === 'overworld' || screen === 'title') items.push({ label: 'Bone Merchant', fn: () => UI.open('shop', { msg: 'Spend your Leaves. Press B to go back.', back: () => UI.open('main', { msg: '' }) }), id: 'btn-shop' });
    if (screen === 'level') items.push({ label: 'Back to the overworld', fn: () => goOverworld() });
    if (screen !== 'title') items.push({ label: 'Save game', fn: () => saveGame(), id: 'btn-save' });
    items.push({ label: 'Fullscreen', fn: toggleFullscreen, id: 'btn-fullscreen' });
    if (screen !== 'title') items.push({ label: newGameArmed ? 'Press again: erase everything and start over' : 'New game (erases save)', id: 'btn-new-game',
      fn: () => { if (!newGameArmed) { newGameArmed = true; UI.refresh(); return; } newGame(); } });
    return items;
  }
  function triggerGameOver() {
    if (gameOver) return;
    gameOver = true;
    paused = true;
    showMenu('Game Over');
    setStartLabel();
  }
  function togglePause() {
    if (!assetsReady || story) return;
    if (devOpen) { closeDev(); return; }
    if (screen === 'title') { goOverworld(); return; }
    if (levelDone) { goOverworld(); return; }
    if (gameOver) { retryMap(); return; }
    paused = !paused;
    if (paused) showMenu(screen === 'level' ? 'Paused' : 'Menu');
    else { hideMenu(); ignoreHeldButtons(); canvas.focus(); }
    setStartLabel();
  }
  if (UI) UI.init({ isTitle: () => screen === 'title' && !story, mainItems, closeMenu, moveRows, lockedCount, padStatus, gemRows, useGem, devItems, shopRows, buy, leaves: () => P.state.leaves,
    sprite: spriteCss,
    moveNotes: dev => dev === 'keys'
      ? ['Keyboard: arrows = d-pad, Z = A (attack), X = B, A = X, S = Y, Up = jump. Shoulders: Q = L1, W = R1 (hold to recover), 1 = L2, 2 = R2. Enter, Space or Escape opens and closes this menu. Hold Left or Right while jumping to steer. Double tap Down on a platform to drop through it. Press H to show hurtboxes and hit shapes.']
      : ['A gamepad works too, wired or Bluetooth, also on an Android phone in Chrome: A (bottom) jumps, Y (top) attacks, B is right, X is left. Start opens and closes this menu. Click the game first if buttons do nothing.'] });
  Promise.all(srcs.map(load)).then(() => {
    const loading = document.getElementById('loading');
    if (loading) loading.remove();
    assetsReady = true;
    const hb = document.getElementById('btn-hud-start');
    if (hb) hb.disabled = false;
    goOverworld(); screen = 'title';                  // the title menu sits over the overworld
    ow.sel = 0;
    setStartLabel();
    showMenu('Defeat the goblins and orcs');
  }).catch(err => {
    const loading = document.getElementById('loading');
    if (loading) loading.textContent = String(err) + '. Reload the page (hard refresh) to try again.';
  });
  requestAnimationFrame(frame);

  canvas.addEventListener('pointerdown', ev => {
    canvas.focus();
    if (screen !== 'overworld' || paused) return;      // tap or click a level on the overworld: first selects, second enters
    const r = canvas.getBoundingClientRect(), px = (ev.clientX - r.left) * V.w / r.width, py = (ev.clientY - r.top) * V.h / r.height;
    for (let i = 0; i <= LV.levels.length + 1; i++) {
      const [nx, ny] = i === LV.levels.length + 1 ? [MERCHANT_AT[0], MERCHANT_AT[1] - 25] : nodeAt(i);
      if (Math.hypot(px - nx, py - ny) < (i === LV.levels.length + 1 ? 32 : 18)) { if (ow.sel === i) enterLevel(i + 1); else ow.sel = i; return; }
    }
  });
  window.togglePause = togglePause;
  addEventListener('pagehide', syncProgress);
  document.addEventListener('visibilitychange', () => { if (document.hidden) syncProgress(); });
  const hudBtn = document.getElementById('btn-hud-start');
  if (hudBtn) hudBtn.addEventListener('click', ev => { ev.preventDefault(); togglePause(); });
  addEventListener('keydown', e => {
    if (e.code === 'Escape') {
      e.preventDefault();
      if (UI && UI.isOpen()) UI.back(); else if (screen !== 'title' && !gameOver) togglePause();
      return;
    }
    if (e.code === 'Enter' || e.code === 'Space') {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'BUTTON')) return;
      e.preventDefault();
      togglePause();
    }
  });
  // read-only hooks for the browser test
  window.bibooGame = {
    facing: () => cur ? cur.face : facing,
    beam: () => { const b = beamNow(); return b && { kind: b.kind, face: b.face, len: b.len, ox: b.ox, oy: b.oy }; },
    started, current: () => cur && { id: cur.id, k: cur.k, kind: cur.kind, y: fall ? fall.y : rootOf(cur)[1], air: !!cur.air }, x: () => x,
    playerX: () => playerX(),
    enemies: () => enemies.map(e => ({ type: e.type, x: e.x, face: e.face, state: e.state, anim: e.anim,
                                       scale: e.scale || 1, tint: e.tint && clock < e.tint.until ? e.tint.color : null })),
    kills: () => kills,
    hp: () => hp,
    meters: () => ({ energy: energyMeter, empower: empowerMeter, super: superMeter }),
    setMeters: (e, m, sp) => { energyMeter = e; empowerMeter = m; if (sp !== undefined) superMeter = sp; },
    gems: () => gems.map(gm => ({ x: gm.x, kind: gm.kind })),
    dropGem: (dx, kind) => spawnGem(bodyX() + dx, kind),
    enemyHp: () => enemies.map(e => e.hp),
    floaters: () => floaters.map(f => f.text),
    setEnemyHp: n => { hpOverride = n; },
    setHp: n => { if (n > maxHp()) P.state.maxes.hp = Math.min(P.MAX_CAP, n); hp = n; },      // test hook: asking for more than Max HP raises Max HP to match
    heavy: () => cur && (cur.id === 'heavy' || cur.id === 'jump_crash') ? { id: cur.id, lite: !!cur.lite, charged: cur.charged, height: cur.height } : null,
    herBox: () => herBox(),
    story: () => story ? { id: story.id, i: story.i } : null, skipStory: () => { if (story) storyEnd(); }, playStory: id => playStory(id, () => { paused = false; }),
    music: () => ({ want: window.BibooMusic ? BibooMusic.wanted : null, track: wantedTrack(), playing: window.BibooMusic ? BibooMusic.current : null, volume: window.BibooMusic ? BibooMusic.volume : 0 }),
    fx: () => ({ freeze, flashes: flashes.length, flash: !!screenFlash, shake: !!rumble }),
    powers: () => ({ flying: !!flight, rainbow: rainbowOn(), ult: !!ult, y: herY(), hp }),
    combat: () => ({ stun: !!stun, hits, blocks, parries, tint: tint && clock < tint.until ? tint.color : null }),
    setRespawn: on => { respawnOn = on; },
    attack: (i, anim) => { const e = enemies[i]; e.state = 'attack'; play(e, anim); },
    // state and controls for the browser tests of levels, unlocks, menus and the dev console
    state: () => ({ screen, paused, gameOver, levelDone, devOpen, hp, floorY, feet: herY(), px: playerX(), cheats: { ...cheats },
                    level: level ? { n: level.n, idx: level.idx, id: curMap && curMap.id } : null,
                    crates: curMap ? curMap.crates.map(c => ({ x: c.x, fy: c.fy, item: c.item, loot: c.loot, broken: c.broken })) : [],
                    powerups: powerups.map(u => ({ item: u.item, x: u.x, y: u.y })),
                    foes: enemies.map(e => ({ type: e.type, x: e.x, fy: e.fy, anim: e.anim, taunted: !!e.taunted, jumping: !!e.jump, hp: e.hp, state: e.state, alive: alive(e), path: e.path, dir: e.dir })),
                    solids: curMap ? curMap.solids : [], plats: curMap ? curMap.plats : [], pits: curMap ? curMap.pits : [], bombs: curMap ? curMap.bombs.map(b => ({ x: b.x, fy: b.fy, gone: b.gone })) : [], shots: shots.map(q => ({ x: q.x, y: q.y, vx: q.vx, vy: q.vy, from: q.from })), pitFall: !!pitFall, feetNow: herY(), fx: { gems: gems.length } }),
    ankhs: () => P.state.ankhs, setAnkhs: n => { P.state.ankhs = n; }, moveRows: () => moveRows(), enterLevel: n => enterLevel(n), warp: idx => { loadMap(idx, 'left'); }, setX: v => { x = v; }, goOverworld: () => goOverworld(),
    menuOpen: () => !!(UI && UI.isOpen()),
    charging: () => ({ cur: cur && cur.id, kind: cur && cur.kind, chargeMs: Math.round(chargeMs), full: isCharged(), energy: Math.round(energyMeter * 10) / 10, power: cur && cur.power, hold: hold && hold.move }),
    beamStats: () => ({ cost: { ...BEAM_TICK_COST }, dmg: { ...BEAM_DMG } }),
    doorOpen: () => doorOpen(),
    unlockLines: id => unlockLines(P.byId[id]), banners: () => banners.map(b => ({ title: b.title, sub: b.sub })),
    unlock: id => unlockItem(id), resetAll: () => { P.reset(); energyMeter = empowerMeter = superMeter = 0; refreshUnlocks(); },
    // the old combat tests: everything unlocked, one closed map with no scenery, enemies as the test places them
    // a one-map level built from the given data (plats, pits, bombs, crates, enemies), doors closed, for the hazard tests
    enterTraining: () => enterTraining(), training: () => ({ ...train, tip: TIPS[Math.floor((clock - train.t0) / 8500) % TIPS.length], on: !!(level && level.def.training) }),
    custom: md => {
      startLevel(0, { n: 0, name: 'Test', blurb: '', tint: null, maps: [Object.assign({ id: 'test', solids: [], plats: [], pits: [], bombs: [], crates: [], enemies: [], arena: true }, md)] });
      respawnOn = false; paused = false; hideMenu();
    },
    addShot: (sx, sy, vx, vy) => shots.push({ x: sx, y: sy, vx, vy, from: 'foe', t0: clock }),
    maxHp: () => maxHp(), addGem: (kind, x, fy) => spawnGem(x, kind, fy || 0), lootPool: () => lootPool(),
    doubleUsed: () => dblUsed, spinning: () => !!(cur && cur.spin && clock - cur.spin < SPIN_MS),
    smash: i => { if (curMap && curMap.crates[i]) breakCrate(curMap.crates[i]); },
    setFloor: v => { floorY = v; prevFeet = null; },
    shove: (i, dx) => { const e = enemies[i]; if (e) { e.x += dx; e.base += dx; e.shoved = clock; } },
    maxes: () => ({ energy: maxOf('energy'), empower: maxOf('empower'), super: maxOf('super') }),
    arena: () => {
      unlockEverything();
      startLevel(0, { n: 0, name: 'Arena', blurb: '', tint: null, maps: [{ id: 'arena', solids: [], plats: [], crates: [], enemies: [], arena: true }] });
      respawnOn = true; paused = false; hideMenu();
    },
    hurtFoe: (i, dmg) => { if (enemies[i]) hurtEnemy(enemies[i], dmg); }, killFoe: i => { if (enemies[i]) kill(enemies[i]); },
    hurtHer: d => hurtHer(d), gemBag: () => ({ ...P.state.gems }), pickups: () => gems.map(g => ({ x: g.x, kind: g.kind })),
    // test setup: clear the field and place enemies at distances from her anchor
    setEnemies: list => {
      enemies.length = 0; respawns.length = 0; facing = 1; hp = maxHp();
      for (const [type, dx, rest] of list) {                  // rest: stand still this long first (ms)
        const e = spawn(type, playerX() + dx);
        if (rest) { e.state = 'idle'; e.rest = rest; play(e, 'idle'); }
      }
    },
  };
})();
