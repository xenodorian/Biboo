// Every binding in game/input_map.json, driven through the reader with realistic timing.
// Run: node web/tests/input.test.js
'use strict';
const fs = require('fs');
const path = require('path');
const { Reader } = require('../input.js');

const map = JSON.parse(fs.readFileSync(path.join(__dirname, '../../game/input_map.json'), 'utf8'));
map.bindings = map.bindings.filter(b => b.move !== 'sky_dash').concat([{ input: 'Down-Up', type: 'sequence', move: 'sky_dash' }]);   // game.js moves Sky Dash from Down-Y to Down-Up
const CHARGE_READY_MS = 400;

// script: [[t, 'down'|'up', button], ...]; returns resolved moves in order plus hold states sampled at `samples`
function run(script, samples = []) {
  const r = new Reader(map, { holdReady: (b, ms) => ms >= CHARGE_READY_MS });
  const moves = [], holds = {};
  const end = Math.max(...script.map(s => s[0]), ...samples) + 200;
  let si = 0;
  for (let t = 0; t <= end; t += 5) {
    while (si < script.length && script[si][0] <= t) {
      const [, kind, b] = script[si++];
      kind === 'down' ? r.down(b, t) : r.up(b, t);
    }
    for (const e of r.update(t)) moves.push(e.move);
    if (samples.includes(t)) holds[t] = r.holdMove(t);
  }
  return { moves, holds };
}
const tap = (t, b, len = 60) => [[t, 'down', b], [t + len, 'up', b]];
const seq = (bs, gap = 150) => bs.flatMap((b, i) => tap(i * gap, b, 50));

const cases = [
  ['idle: nothing held', run([], [100]).holds[100], 'idle'],
  ['walk_right: hold Right', run([[0, 'down', 'Right'], [600, 'up', 'Right']], [300]).holds[300], 'walk_right'],
  ['walk_left: hold Left', run([[0, 'down', 'Left'], [600, 'up', 'Left']], [300]).holds[300], 'walk_left'],
  ['duck: hold Down', run([[0, 'down', 'Down'], [600, 'up', 'Down']], [300]).holds[300], 'duck'],
  ['charge: hold Up', run([[0, 'down', 'Up'], [900, 'up', 'Up']], [300]).holds[300], 'charge'],
  ['releasing a charge does nothing', run([[0, 'down', 'Up'], [900, 'up', 'Up']]).moves.join(), ''],
  ['no heavy from a quick Up tap', run(tap(0, 'Up', 80)).moves.join(), ''],
  ['block: hold B', run([[0, 'down', 'B'], [700, 'up', 'B']], [400]).holds[400], 'block'],
  ['parry: tap B', run(tap(0, 'B', 90)).moves.join(), 'parry'],
  ['no parry from a long B hold', run([[0, 'down', 'B'], [700, 'up', 'B']]).moves.join(), ''],
  ['recover: hold R', run([[0, 'down', 'R'], [700, 'up', 'R']], [300]).holds[300], 'recover'],
  ['jump: Y', run(tap(0, 'Y')).moves.join(), 'jump'],
  ['dash: X', run(tap(0, 'X')).moves.join(), 'dash'],
  ['slash: A', run(tap(0, 'A')).moves.join(), 'slash'],
  ['push_kick: L', run(tap(0, 'L')).moves.join(), 'push_kick'],
  ['heavy: Up-A (tap Up, then A)', run(seq(['Up', 'A'])).moves.join(), 'heavy'],
  ['heavy: hold Up, press A', run([[0, 'down', 'Up'], [900, 'down', 'A'], [960, 'up', 'A'], [1000, 'up', 'Up']]).moves.join(), 'heavy'],
  ['a stale Up tap is just A', run([...tap(0, 'Up'), ...tap(700, 'A')]).moves.join(), 'slash'],
  ['thrust: Right+A', run([[0, 'down', 'Right'], [200, 'down', 'A'], [260, 'up', 'A'], [400, 'up', 'Right']]).moves.join(), 'thrust'],
  ['upswing: Down+A', run([[0, 'down', 'Down'], [200, 'down', 'A'], [260, 'up', 'A'], [400, 'up', 'Down']]).moves.join(), 'upswing'],
  ['beam_fire: A+B', run([[0, 'down', 'A'], [20, 'down', 'B'], [90, 'up', 'A'], [95, 'up', 'B']]).moves.join(), 'beam_fire'],
  ['beam_fire: hold B, tap A', run([[0, 'down', 'B'], [600, 'down', 'A'], [660, 'up', 'A'], [800, 'up', 'B']]).moves.join(), 'beam_fire'],
  ['heavy_kick: B+L', run([[0, 'down', 'B'], [25, 'down', 'L'], [90, 'up', 'B'], [95, 'up', 'L']]).moves.join(), 'heavy_kick'],
  ['energy_kick: A+B+L', run([[0, 'down', 'A'], [15, 'down', 'B'], [30, 'down', 'L'], [100, 'up', 'A'], [100, 'up', 'B'], [100, 'up', 'L']]).moves.join(), 'energy_kick'],
  ['energy_kick: A, B, L one after another', run(seq(['A', 'B', 'L'])).moves.join(), 'slash,parry,energy_kick'],
  ['energy_kick: L, B, A one after another', run(seq(['L', 'B', 'A'])).moves.join(), 'push_kick,parry,energy_kick'],
  ['energy_kick fires once, not again on the next A', run([...seq(['A', 'B', 'L']), ...tap(500, 'A')]).moves.join(), 'slash,parry,energy_kick,slash'],
  ['energy_burst: L+R', run([[0, 'down', 'L'], [20, 'down', 'R'], [90, 'up', 'L'], [95, 'up', 'R']]).moves.join(), 'energy_burst'],
  ['taunt: X+Y', run([[0, 'down', 'X'], [20, 'down', 'Y'], [90, 'up', 'X'], [95, 'up', 'Y']]).moves.join(), 'taunt'],
  ['dash_thrust: X+A', run([[0, 'down', 'X'], [20, 'down', 'A'], [90, 'up', 'X'], [95, 'up', 'A']]).moves.join(), 'dash_thrust'],
  ['Y then A is jump then slash (the game turns A in the air into the crash)', run(seq(['Y', 'A'])).moves.join(), 'jump,slash'],
  ['sky_dash: Down-Up', run(seq(['Down', 'Up'])).moves.join(), 'sky_dash'],
  ['sky_dash: hold Down, press Up', run([[0, 'down', 'Down'], [900, 'down', 'Up'], [960, 'up', 'Up'], [1000, 'up', 'Down']]).moves.join(), 'sky_dash'],
  ['beam_laser: A+L', run([[0, 'down', 'A'], [20, 'down', 'L'], [90, 'up', 'A'], [95, 'up', 'L']]).moves.join(), 'beam_laser'],
  ['beam_plasma: A+R', run([[0, 'down', 'A'], [20, 'down', 'R'], [90, 'up', 'A'], [95, 'up', 'R']]).moves.join(), 'beam_plasma'],
  ['beam_cloud: Left-Right-A', run(seq(['Left', 'Right', 'A'])).moves.join(), 'beam_cloud'],
  ['spin_attack: Left+A', run([[0, 'down', 'Left'], [200, 'down', 'A'], [260, 'up', 'A'], [400, 'up', 'Left']]).moves.join(), 'spin_attack'],
  ['energy_dash_thrust: tap B, then X+A', run([...tap(0, 'B', 60), [150, 'down', 'X'], [165, 'down', 'A'], [230, 'up', 'X'], [235, 'up', 'A']]).moves.join(), 'parry,energy_dash_thrust'],
  ['energy_dash_thrust: hold B, then X+A', run([[0, 'down', 'B'], [600, 'down', 'X'], [615, 'down', 'A'], [680, 'up', 'X'], [685, 'up', 'A'], [800, 'up', 'B']]).moves.join(), 'energy_dash_thrust'],
  ['X, A one after another is dash then slash', run(seq(['X', 'A'])).moves.join(), 'dash,slash'],
  ['energy_wave: Down-Right-A-B', run(seq(['Down', 'Right', 'A', 'B'])).moves.join(), 'slash,energy_wave'],
  ['earthquake: Down x4, A', run(seq(['Down', 'Down', 'Down', 'Down', 'A'])).moves.join(), 'earthquake'],
  ['meteor_shower: B x5 (the first four taps are parries)', run(seq(['B', 'B', 'B', 'B', 'B'])).moves.join(), 'parry,parry,parry,parry,meteor_shower'],
  ['a slow sequence is two presses', run(seq(['Y', 'A'], 600)).moves.join(), 'jump,slash'],
  ['chord partners too far apart are two presses', run([[0, 'down', 'X'], [120, 'down', 'A'], [180, 'up', 'X'], [200, 'up', 'A']]).moves.join(), 'dash,slash'],
];

let fail = 0;
for (const [name, got, want] of cases) {
  const ok = got === want;
  if (!ok) fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  (got "${got}", want "${want}")`}`);
}
// every move in the map is covered by a case
// ('air' bindings are the game's: A in the air becomes the crash; web/tests/browser.test.js covers them)
const moves = new Set(map.bindings.filter(b => b.type !== 'air').map(b => b.move));
const covered = new Set(cases.map(c => c[0].split(':')[0]));
const missing = [...moves].filter(m => !covered.has(m));
if (missing.length) { fail++; console.log('FAIL  bindings without a case: ' + missing.join(', ')); }
console.log(`${cases.length - fail + (missing.length ? 1 : 0)}/${cases.length} passed`);
process.exit(fail ? 1 : 0);
