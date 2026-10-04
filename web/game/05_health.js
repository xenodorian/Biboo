'use strict';
  // ------------------------------------------------------------------ health and damage
  // Tunable numbers. A move hurts each enemy once per use (moves in REHIT_MS again after that many ms);
  // beams hurt on every tick they touch. The heavy chop and the crash do more when full.
  const ENEMY_HP = { goblin: 60, orc: 200 }, ENEMY_DMG = { goblin: 12, orc: 30 };
  const DAMAGE = { slash: 25, heavy_horizontal: 50, thrust: 15, upswing: 15, push_kick: 10, heavy_kick: 25, energy_kick: 30, energy_burst: 50,
                   dash_thrust: 25, energy_dash_thrust: 50, spin_attack: 20, energy_wave: 0, earthquake: 250, meteor_shower: 200,
                   chain2: 15, chain3: 18, chain4: 22 };      // the chain strikes (no knockback: they are not in KNOCK)
  // knockback of the moves that push an enemy: [distance px, duration ms]
  const KNOCK = { heavy: [25, 100], slash: [25, 100], heavy_horizontal: [50, 100], push_kick: [100, 200], energy_kick: [200, 300], energy_burst: [100, 500] };
  const HH_STUN_MS = 200;                                    // heavy horizontal: the 50 px slide still takes 100 ms; the enemy stays stunned after it stops
  const HH_TILT = Math.PI / 6;                               // 30 degrees clockwise, drawn while that stun lasts
  const BOTH_SIDES_PUSH = new Set(['energy_burst']);
  const PARRY_DMG = 10;                                              // damage a parried melee attacker takes
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
