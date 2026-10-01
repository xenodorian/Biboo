/* Progress for Parry Perry: what the player has unlocked, the gems in the bag, the meters, and which levels are open.
 * Nothing is saved automatically: only the Save game button writes to localStorage, and New game wipes it.
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
  const GEM_KINDS = ['health', 'energy', 'empower', 'super'];
  const SHOULDERS = new Set(['L1', 'L2', 'R1', 'R2', 'R']);

  // id, what the player sees, which button or combo it is, the moves it switches on, the buttons and meters it brings
  const UNLOCKS = [
    { id: 'thrust', kind: 'Combo', name: 'Lunging Thrust', hint: 'Hold Right (or Left) and press A to lunge', moves: ['thrust'] },
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
    { id: 'meteor', kind: 'Combo', name: 'Meteor Shower', hint: 'B five times (full super meter)', moves: ['meteor_shower'], meters: ['super'] },
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
    { id: 'chain', kind: 'Combo', name: 'Attack Chain', hint: 'Mash A: slash, three chain strikes, then the heavy chop (uses energy)', moves: [], meters: ['energy'] },
    { id: 'chain_burst', kind: 'Combo', name: 'Burst Chain', hint: 'A, A, A, A, then B: the chain ends in an energy burst', moves: [], meters: ['energy'] },
    { id: 'fly', kind: 'Combo', name: 'Flight', hint: 'A, B, A, B, then Up: fly for 5 seconds', moves: [] },
    { id: 'rainbow', kind: 'Combo', name: 'Rainbow Guard', hint: 'A, B, A, B, A, B: 5 seconds untouchable, walk over pits', moves: [] },
    { id: 'ultimate', kind: 'Combo', name: 'Ultimate Chain', hint: 'A x4, then L1+L2+R1+R2 together: the chain, a taunt, then all four beams', moves: [], buttons: ['L1', 'L2', 'R1', 'R2'], meters: ['energy', 'empower'] },
  ];
  const byId = {};
  for (const u of UNLOCKS) byId[u.id] = u;

  const fresh = () => ({
    v: 2,                                                // save format: bumped when unlock points move, so an old save cannot carry unlocks or meters from a retired layout
    unlocked: [],                                        // unlock ids owned
    levelsUnlocked: 1,                                   // levels 1..levelsUnlocked can be entered
    cleared: [],                                         // level numbers beaten
    gems: { health: 0, energy: 0, empower: 0, super: 0 },
    meters: { energy: 0, empower: 0, super: 0 },
    maxes: { hp: 50, energy: 50, empower: 50, super: 100 },      // meter capacity: 50 (super 100), +25 per upgrade pickup
    ankhs: 3,                                            // retries: a K.O. restarts the same map only by spending one; with none left the level starts over
  });

  const P = { UNLOCKS, byId, GEM_KINDS, MAX_GEMS: 99, state: fresh() };
  P.MAX_START = { hp: 50, energy: 50, empower: 50, super: 100 }; P.MAX_STEP = 25; P.MAX_CAP = 200;
  P.maxOf = k => (P.state.maxes && P.state.maxes[k]) || P.MAX_START[k] || 50;
  P.raiseMax = (k, n) => { const before = P.maxOf(k); P.state.maxes[k] = Math.min(P.MAX_CAP, before + (n == null ? P.MAX_STEP : n)); P.save(); return P.state.maxes[k] - before; };
  P.ANKH_START = 3; P.ANKH_CAP = 9;
  P.addAnkh = n => { const b = P.state.ankhs; P.state.ankhs = Math.max(0, Math.min(P.ANKH_CAP, b + (n == null ? 1 : n))); return P.state.ankhs - b; };
  P.levelCount = () => (root.BIBOO_LEVELS && root.BIBOO_LEVELS.levels.length) || 6;

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

  // Nothing is saved automatically. Progress lives in memory (P.state) and is gone when the page is closed or reloaded.
  // The only thing written to the browser is the manual save (P.saveToDisk, from the Save game button); New game wipes it.
  const SAVE_KEY = 'parryperry.manualsave.v1', LEGACY_KEYS = ['parryperry.save.v1'];
  P.save = () => {};                                           // kept so the game can say "progress changed"; it does not persist anything
  P.saveToDisk = () => {
    try { if (!root.localStorage) return false; root.localStorage.setItem(SAVE_KEY, JSON.stringify(Object.assign({}, P.state, { v: 4 }))); return true; }
    catch (e) { return false; }                                // storage blocked: the save did not happen
  };
  const readSave = () => {
    try {
      const raw = root.localStorage && root.localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (!s) return null;
      if (s.v === 3) {                                         // before level 4 was added: old levels 4 and 5 are now 5 and 6
        s.v = 4;
        if (Array.isArray(s.cleared)) s.cleared = s.cleared.map(n => (n >= 4 ? n + 1 : n));
        if (Number.isFinite(s.levelsUnlocked) && s.levelsUnlocked > 4) s.levelsUnlocked += 1;
      }
      return s.v === 4 ? s : null;
    } catch (e) { return null; }
  };
  P.hasSave = () => !!readSave();
  P.loadSave = () => {                                         // Continue: the manual save becomes the current progress
    const s = readSave();
    if (!s) return false;
    const f = fresh();
    if (Array.isArray(s.unlocked)) f.unlocked = s.unlocked.filter((id, i) => byId[id] && s.unlocked.indexOf(id) === i);
    if (Number.isFinite(s.levelsUnlocked)) f.levelsUnlocked = Math.max(1, s.levelsUnlocked | 0);
    if (Array.isArray(s.cleared)) f.cleared = s.cleared.filter(n => Number.isFinite(n));
    for (const k of GEM_KINDS) if (s.gems && Number.isFinite(s.gems[k])) f.gems[k] = Math.max(0, Math.min(P.MAX_GEMS, s.gems[k] | 0));
    for (const k of ['energy', 'empower', 'super']) if (s.meters && Number.isFinite(s.meters[k])) f.meters[k] = Math.max(0, Math.min(200, s.meters[k]));
    for (const k of ['hp', 'energy', 'empower', 'super']) if (s.maxes && Number.isFinite(s.maxes[k])) f.maxes[k] = Math.max(P.MAX_START[k], Math.min(P.MAX_CAP, s.maxes[k]));
    if (Number.isFinite(s.ankhs)) f.ankhs = Math.max(0, Math.min(P.ANKH_CAP, s.ankhs | 0));
    P.state = f;
    return true;
  };
  P.wipe = () => {                                             // New game: erase everything the game ever stored in this browser
    try { if (root.localStorage) for (const k of Object.keys(root.localStorage)) if (k.indexOf('parryperry') === 0) root.localStorage.removeItem(k); } catch (e) {}
    try { if (root.sessionStorage) for (const k of Object.keys(root.sessionStorage)) if (k.indexOf('parryperry') === 0) root.sessionStorage.removeItem(k); } catch (e) {}
  };
  P.reset = () => { P.state = fresh(); };
  try { if (root.localStorage) for (const k of LEGACY_KEYS) root.localStorage.removeItem(k); } catch (e) {}   // the old automatic save is never read again

  root.BibooProgress = P;
  if (typeof module !== 'undefined' && module.exports) module.exports = P;
})(typeof window !== 'undefined' ? window : globalThis);
