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
  // Heavy Horizontal: hold B, tap A. Same swing as the slash, but she steps HH_STEP px
  // forward across the move and is not stunned. Frames are copied so the slash stays in place.
  const HH_STEP = 50;
  {
    const src = D.moves.slash;
    const frames = src.frames.map(f => Object.assign({}, f, { root: [0, f.root[1]] }));
    const total = frames.reduce((s, f) => s + f.ms, 0) || 1;
    let acc = 0;
    for (const f of frames) { acc += f.ms; f.root[0] = HH_STEP * acc / total; }
    D.moves.heavy_horizontal = Object.assign({}, src, { title: 'Heavy Horizontal', input: 'A+B', inputType: 'chord', frames });
  }
  D.input.bindings.push({ input: 'A+B', type: 'chord', move: 'heavy_horizontal', held: ['B'] });
  D.input.bindings.push({ input: 'A-A-A-A-R1+R2+L1+L2', type: 'sequence', move: 'ultimate' });   // the Ultimate Chain
  const V = D.view;
  const P = window.BibooProgress;
  // The player starts with the d-pad and A, B, X, Y only. Every other move is an unlock bought from the Bone Merchant
  // (web/progress.js). A move that is not open is not in the input reader at all, so the button that would have
  // triggered it falls back to the plain move (Down+A is just a slash until the upswing is unlocked).
  const BASE_MOVES = new Set(['idle', 'walk_right', 'walk_left', 'duck', 'block', 'parry', 'jump', 'dash', 'slash', 'spin_attack']);
  const moveOpen = move => BASE_MOVES.has(move) || P.hasMove(move);
  const SPRITE_SCALE = 1.0;
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
  // Plain-language descriptions shown when the player presses Y over a move, item or unlockable in the menus (a move without an entry falls back to its "how" text)
  const MOVE_INFO = {
    idle: 'Standing still. Nothing to press.', walk_right: 'Walk to the right with the d-pad or stick.', walk_left: 'Walk to the left with the d-pad or stick.',
    duck: 'Crouch under high attacks. Double tap Down on a platform to drop through it.', block: 'Hold B to raise the guard. A blocked hit does no damage but slides you back.',
    parry: 'Tap B just before a melee hit lands. A parry deals 10 damage, pushes the enemy back and stuns it. It also reflects shards.', jump: 'Jump. Hold Left or Right in the air to steer.',
    dash: 'A quick burst of speed along the ground. Double tap forward.', slash: 'Your basic sword attack. Fast, light damage.', spin_attack: 'A spinning slash that hits both sides.',
    heavy_horizontal: 'A hard horizontal swing. She steps 50 px forward and is not stunned. The enemy is stunned and tipped.', dash_thrust: 'A running stab that crosses the screen and hits hard at the end.',
    energy_dash_thrust: 'The dash thrust charged with energy: longer, harder and it costs energy.', taunt: 'Provoke every enemy on screen so they rush you and drop gems when they fall.',
    double_jump: 'Press Up again in the air for a second, spinning jump. Reaches high ledges.', sky_dash: 'An air dash: press Down, then Up. Covers pits.',
    jump_crash: 'Slam down from a jump. Costs 30 energy and hits what is below you.', heavy: 'The overhead chop. Hold A to charge it, release to swing. Costs energy.',
    earthquake: 'Shakes the whole screen and damages every grounded enemy. Needs a full super meter.', meteor_shower: 'Calls meteors down across the screen. Needs a full super meter.',
    push_kick: 'A quick kick on L1 that shoves enemies away.', meter_charge: 'Hold L1 and R1 together: every meter you own slowly fills.',
    recover: 'Hold R1 to kneel and heal. Uses the empower meter.', beam_plasma: 'Fire the empowerment beam with A and R1. Uses empower.', energy_kick: 'Hold B and L1 to charge, let go to kick with a burst of energy.',
    energy_burst: 'Hold L2 to charge, let go for a burst of energy around you.', energy_wave: 'Hold R2 to charge, let go to send a wave of energy along the ground.',
    beam_cloud: 'A cloud beam fired with A and L2. Uses energy.', beam_laser: 'A straight laser beam fired with A and L1. Uses energy.', beam_fire: 'A fire beam fired with A and R2. Uses energy.',
    chain: 'Mash A: a slash, three chain strikes with no knockback, then the heavy chop without charging. Uses energy.', chain_burst: 'After the fourth A of the chain, tap B to end it in an energy burst.',
    fly: 'Fly for 5 seconds. Up and Down climb and dive, Left and Right steer.', rainbow: 'Five seconds of invulnerability. Pitfalls are solid ground while it lasts.',
    ultimate: 'The full show: the chain, a taunt, then the empowerment, cloud, fire and laser beams in turn.', heavy_chop: 'The overhead chop. Hold A to charge it, release to swing. Costs energy.',
    thrust: 'A straight stab.', upswing: 'An upward swing that hits things above you.' };
  const GEM_INFO = {
    health: 'A Bone restores some of your HP when used from this menu inside a level. You can hold a limited number.',
    energy: 'Quartz refills the blue energy meter. Needs the Energy Mutagen.', empower: 'Garnet refills the orange empower meter. Needs the Empower Mutagen.',
    super: 'A Diamond fills the purple super meter. Needs the Super Mutagen.' };
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
  function unlockInfo(u) {                                         // what an unlockable does, in a sentence or two
    const m = (u.moves || []).find(k => MOVE_INFO[k]) || (MOVE_INFO[u.id] ? u.id : null);
    const kind = u.shop === 'mutagen' ? 'A Mutagen switches on a meter-powered move.' : 'A Warrior Scroll teaches a move.';
    return `${u.name}. ${m ? MOVE_INFO[m] || MOVE_INFO[u.id] : u.hint} ${kind} How: ${u.hint}.`;
  }
  function shopRows() {
    const PR = P.PRICE, L = P.state.leaves, sections = [];
    const gemRow = (kind, key, label, sprite) => {
      const need = kind !== 'health' && !P.meterOn(kind), full = (P.state.gems[kind] || 0) >= P.MAX_GEMS, price = PR[key];
      return { key, label, sprite, price, hidden: need, info: GEM_INFO[kind], desc: kind === 'health' ? `Restores ${gemHeal()} HP. Use it from the Items menu.` : `Refills ${GEM_VALUE} ${kind}. Use it from the Items menu.`,
               have: `You hold ${P.state.gems[kind] || 0}`, canBuy: !need && !full && L >= price, note: need ? `Needs a ${kind[0].toUpperCase() + kind.slice(1)} Mutagen` : full ? 'Bag full' : L < price ? 'Not enough Leaves' : '' };
    };
    sections.push({ title: 'Supplies', rows: [
      gemRow('health', 'bone', 'Bone', 'bone'), gemRow('energy', 'quartz', 'Quartz', 'quartz'), gemRow('empower', 'garnet', 'Garnet', 'garnet'), gemRow('super', 'diamond', 'Diamond', 'diamond'),
      { key: 'powder', label: 'Bone Powder', sprite: 'powder', price: PR.powder, info: 'Bone Powder permanently raises your maximum HP. It stacks until the limit is reached.', desc: `Raises your maximum HP by ${P.MAX_STEP} (now ${maxHp()}, limit ${P.MAX_CAP}).`, have: '',
        canBuy: maxHp() < P.MAX_CAP && L >= PR.powder, note: maxHp() >= P.MAX_CAP ? 'Max HP reached' : L < PR.powder ? 'Not enough Leaves' : '' } ] });
    for (const [kind, title, noun] of [['mutagen', 'Mutagens', 'Mutagen'], ['scroll', 'Warrior Scrolls', 'Scroll']]) {
      const rows = P.UNLOCKS.filter(u => u.shop === kind).sort((a, b) => a.level - b.level).map(u => {
        const own = P.has(u.id), open = u.level <= P.state.levelsUnlocked, price = P.priceOf(u);
        return { key: 'unlock:' + u.id, label: `${noun}: ${u.name}`, sprite: kind === 'mutagen' ? 'quartz' : 'scroll', price, desc: u.hint, info: unlockInfo(u), have: `Level ${u.level}`, owned: own,
                 locked: !own && !open, canBuy: !own && open && L >= price, note: own ? 'Owned' : !open ? `Beat level ${u.level - 1} first` : L < price ? 'Not enough Leaves' : '' };
      });
      sections.push({ title, rows: rows.filter(r => !r.locked) });          // an unlock whose level is not yet beaten is not on sale at all
    }
    for (const sct of sections) sct.rows = sct.rows.filter(r => !r.hidden);   // a gem for a meter not yet unlocked is not on sale either
    return sections.filter(sct => sct.rows.length);
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
      return { kind, sprite: GEM_SPRITE[kind], label: GEM_LABEL[kind], color: GEM_COLOR[kind], count: P.state.gems[kind] || 0, info: GEM_INFO[kind], canUse: canUseGem(kind), note };
    });
  }

  const canvas = document.getElementById('view');
  const g = canvas.getContext('2d');
  g.imageSmoothingEnabled = false;
