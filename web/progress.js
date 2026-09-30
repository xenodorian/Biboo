/* Progress for Parry Perry: what the player has unlocked, the gems in the bag, the meters, and which levels are open.
 * Saved in localStorage (every read and write is wrapped, so a browser that blocks storage just plays without saving).
 *
 * A new game starts with only the d-pad and A, B, X, Y (A jumps, Y slashes, B blocks and parries, X dashes).
 * Everything else is an "unlock": a golden crate holds one, and smashing the crate then touching the item unlocks it.
 * An unlock can give buttons (L1, L2, R1, R2), moves (ids from data.js) and meters. A meter is drawn only once
 * some unlock that uses it is owned. The health bar is always drawn.
 *
 * game.js reads this through window.BibooProgress; it holds no game logic of its own.
 */
(function (root) {
  'use strict';
  const KEY = 'parryperry.save.v1';
  const GEM_KINDS = ['health', 'energy', 'empower', 'super'];
  const SHOULDERS = new Set(['L1', 'L2', 'R1', 'R2', 'R']);

  // id, what the player sees, which button or combo it is, the moves it switches on, the buttons and meters it brings
  const UNLOCKS = [
    { id: 'thrust', kind: 'Combo', name: 'Lunging Thrust', hint: 'Hold Right (or Left) and A, let go to lunge', moves: ['thrust'] },
    { id: 'upswing', kind: 'Combo', name: 'Ducking Upswing', hint: 'Hold Down and press A', moves: ['upswing'] },
    { id: 'heavy_horizontal', kind: 'Combo', name: 'Heavy Horizontal', hint: 'Hold B and tap A', moves: ['heavy_horizontal'] },
    { id: 'dash_thrust', kind: 'Combo', name: 'Dash Thrust', hint: 'Press X and A together', moves: ['dash_thrust'] },
    { id: 'energy_dash', kind: 'Combo', name: 'Energy Dash Thrust', hint: 'Double tap forward, then hold X and A and let go', moves: ['energy_dash_thrust'], meters: ['energy'] },
    { id: 'taunt', kind: 'Combo', name: 'Taunt', hint: 'Press X and Y together', moves: ['taunt'] },
    { id: 'double_jump', kind: 'Combo', name: 'Double Jump', hint: 'Press Up again in the air', moves: ['double_jump'] },
    { id: 'sky_dash', kind: 'Combo', name: 'Sky Dash', hint: 'Press Down, then Up', moves: ['sky_dash'] },
    { id: 'crash', kind: 'Combo', name: 'Jumping Crash', hint: 'Press A in the air (30 energy)', moves: ['jump_crash'], meters: ['energy'] },
    { id: 'heavy_chop', kind: 'Combo', name: 'Heavy Overhead Chop', hint: 'Hold A to charge, release to chop', moves: ['heavy', 'charge'], meters: ['energy'] },
    { id: 'earthquake', kind: 'Combo', name: 'Earthquake', hint: 'Down four times, then A (full super meter)', moves: ['earthquake'], meters: ['super'] },
    { id: 'meteor', kind: 'Combo', name: 'Meteor Shower', hint: 'Up four times, then A (full super meter)', moves: ['meteor_shower'], meters: ['super'] },
    { id: 'push_kick', kind: 'Button', name: 'L1 button: Push Kick', hint: 'Press L1 for the push kick', moves: ['push_kick'], buttons: ['L1'] },
    { id: 'meter_charge', kind: 'Combo', name: 'Meter Charge', hint: 'Hold L1+R1: every meter you own slowly fills', moves: ['meter_charge'], buttons: ['L1', 'R1'] },
    { id: 'recover', kind: 'Button', name: 'R1 button: Recover', hint: 'Hold R1 to kneel and heal (uses empower). Empower gems and the EMP meter are now on', moves: ['recover'], buttons: ['R1', 'R'], meters: ['empower'] },
    { id: 'empower_beam', kind: 'Combo', name: 'Empowerment Beam', hint: 'Press A+R1 (uses empower)', moves: ['beam_plasma'], buttons: ['R1'], meters: ['empower'] },
    { id: 'energy_kick', kind: 'Combo', name: 'Energy Kick', hint: 'Hold B+L1 to charge, let go to kick. The ENG meter and energy gems are now on', moves: ['energy_kick'], buttons: ['L1'], meters: ['energy'] },
    { id: 'energy_burst', kind: 'Button', name: 'L2 button: Energy Burst', hint: 'Hold L2 to charge, let go to burst', moves: ['energy_burst'], buttons: ['L2'], meters: ['energy'] },
    { id: 'energy_wave', kind: 'Button', name: 'R2 button: Energy Wave', hint: 'Hold R2 to charge, let go to fire the wave', moves: ['energy_wave'], buttons: ['R2'], meters: ['energy'] },
    { id: 'cloud_beam', kind: 'Combo', name: 'Cloud Beam', hint: 'Press A+L2, or Left, Right, A (uses energy)', moves: ['beam_cloud'], buttons: ['L2'], meters: ['energy'] },
    { id: 'laser_beam', kind: 'Combo', name: 'Laser Beam', hint: 'Press A+L1 (uses energy)', moves: ['beam_laser'], buttons: ['L1'], meters: ['energy'] },
    { id: 'fire_beam', kind: 'Combo', name: 'Fire Beam', hint: 'Press A+R2 (uses energy)', moves: ['beam_fire'], buttons: ['R2'], meters: ['energy'] },
  ];
  const byId = {};
  for (const u of UNLOCKS) byId[u.id] = u;

  const fresh = () => ({
    v: 2,                                                // save format: bumped when unlock points move, so an old save cannot carry unlocks or meters from a retired layout
    unlocked: [],                                        // unlock ids owned
    levelsUnlocked: 1,                                   // levels 1..levelsUnlocked can be entered
    cleared: [],                                         // level numbers beaten
    gems: { health: 0, energy: 0, empower: 0, super: 0 },
    keys: [],                                            // level door keys owned (the level number as a string)
    meters: { energy: 0, empower: 0, super: 0 },
    maxes: { energy: 50, empower: 50, super: 100 },      // meter capacity: 50 (super 100), +25 per upgrade pickup
  });

  const P = { UNLOCKS, byId, GEM_KINDS, MAX_GEMS: 99, state: fresh() };
  P.MAX_START = { energy: 50, empower: 50, super: 100 }; P.MAX_STEP = 25; P.MAX_CAP = 200;
  P.maxOf = k => (P.state.maxes && P.state.maxes[k]) || P.MAX_START[k] || 50;
  P.raiseMax = (k, n) => { const before = P.maxOf(k); P.state.maxes[k] = Math.min(P.MAX_CAP, before + (n == null ? P.MAX_STEP : n)); P.save(); return P.state.maxes[k] - before; };
  P.levelCount = () => (root.BIBOO_LEVELS && root.BIBOO_LEVELS.levels.length) || 5;

  P.has = id => P.state.unlocked.includes(id);
  P.hasMove = move => P.state.unlocked.some(id => byId[id] && (byId[id].moves || []).includes(move));
  P.buttonOn = b => !SHOULDERS.has(b) || P.state.unlocked.some(id => byId[id] && (byId[id].buttons || []).includes(b));
  P.meterOn = k => P.state.unlocked.some(id => byId[id] && (byId[id].meters || []).includes(k));
  P.unlock = id => {
    if (!byId[id] || P.has(id)) return false;
    P.state.unlocked.push(id);
    P.save();
    return true;
  };
  P.unlockAll = () => { for (const u of UNLOCKS) if (!P.has(u.id)) P.state.unlocked.push(u.id); P.save(); };
  P.unlockAllLevels = () => { P.state.levelsUnlocked = P.levelCount(); P.save(); };
  P.levelOpen = n => n >= 1 && n <= P.state.levelsUnlocked;
  P.completeLevel = n => {
    if (!P.state.cleared.includes(n)) P.state.cleared.push(n);
    P.state.levelsUnlocked = Math.max(P.state.levelsUnlocked, Math.min(P.levelCount(), n + 1));
    P.save();
  };
  P.hasKey = id => P.state.keys.includes(String(id));
  P.addKey = id => { if (P.hasKey(id)) return false; P.state.keys.push(String(id)); P.save(); return true; };
  P.addGem = (kind, n) => {
    const before = P.state.gems[kind] || 0;
    P.state.gems[kind] = Math.min(P.MAX_GEMS, before + (n == null ? 1 : n));
    return P.state.gems[kind] - before;
  };
  P.takeGem = kind => {
    if ((P.state.gems[kind] || 0) < 1) return false;
    P.state.gems[kind]--;
    return true;
  };

  P.save = () => {
    try { if (root.localStorage) root.localStorage.setItem(KEY, JSON.stringify(P.state)); } catch (e) { /* storage blocked: play without saving */ }
  };
  P.load = () => {
    try {
      const raw = root.localStorage && root.localStorage.getItem(KEY);
      if (!raw) return;
      const s = JSON.parse(raw), f = fresh();
      if (s.v !== f.v) return;                                 // a save from an older layout: start a new game
      if (Array.isArray(s.unlocked)) {
        const OLD = { L1: ['energy_kick', 'laser_beam'], L2: ['energy_burst', 'cloud_beam'], R1: ['recover', 'empower_beam'], R2: ['energy_wave', 'fire_beam'] };   // saves from before the unlocks were split
        const ids = [];
        for (const id of s.unlocked) for (const n of (OLD[id] || [id])) if (!ids.includes(n)) ids.push(n);
        f.unlocked = ids.filter(id => byId[id]);
      }
      if (Array.isArray(s.keys)) f.keys = s.keys.filter(k => typeof k === 'string');
      if (Number.isFinite(s.levelsUnlocked)) f.levelsUnlocked = Math.max(1, s.levelsUnlocked | 0);
      if (Array.isArray(s.cleared)) f.cleared = s.cleared.filter(n => Number.isFinite(n));
      for (const k of GEM_KINDS) if (s.gems && Number.isFinite(s.gems[k])) f.gems[k] = Math.max(0, Math.min(P.MAX_GEMS, s.gems[k] | 0));
      for (const k of ['energy', 'empower', 'super']) if (s.meters && Number.isFinite(s.meters[k])) f.meters[k] = Math.max(0, Math.min(200, s.meters[k]));
      for (const k of ['energy', 'empower', 'super']) if (s.maxes && Number.isFinite(s.maxes[k])) f.maxes[k] = Math.max(P.MAX_START[k], Math.min(P.MAX_CAP, s.maxes[k]));
      if (f.unlocked.includes('energy_kick') && !f.unlocked.includes('push_kick')) f.unlocked.push('push_kick');   // older saves: the L1 unlock used to include the push kick
      P.state = f;
    } catch (e) { P.state = fresh(); }
  };
  P.reset = () => { P.state = fresh(); P.save(); };

  P.load();
  root.BibooProgress = P;
  if (typeof module !== 'undefined' && module.exports) module.exports = P;
})(typeof window !== 'undefined' ? window : globalThis);
