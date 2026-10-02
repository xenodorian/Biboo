// Loads the web game's data files the way index.html does (a fake `window`) and writes them as plain JSON for the Python baker.
// Usage: node ports/dreamcast/tools/dump_game_data.js [out.json]      ON-DEMAND tool, see ../README.md
const fs = require('fs'), path = require('path'), vm = require('vm');
const WEB = path.resolve(__dirname, '../../../web');
const out = process.argv[2] || path.resolve(__dirname, '../build/game_data.json');
const win = {}; win.window = win;
vm.createContext(win);
const run = f => vm.runInContext(fs.readFileSync(path.join(WEB, f), 'utf8'), win, { filename: f });
for (const f of ['assets/data.js', 'assets/moves_extra.js', 'assets/creatures.js', 'assets/arenas.js', 'assets/bgs.js', 'assets/items.js']) {
  try { run(f); } catch (e) { console.error('skipped', f, String(e).split('\n')[0]); }
}
for (const f of ['progress.js', 'levels.js']) { try { run(f); } catch (e) { console.error('skipped', f, String(e).split('\n')[0]); } }
const B = win.BIBOO;
// web/game/00_core.js rewrites the pad bindings and a few move tables at start-up (spin on Y, the charged chop on A, the beams on shoulder
// buttons, the heavy horizontal copy of the slash, new push-kick hit boxes ...). Run exactly that section so the port starts from the final tables.
{
  const core = fs.readFileSync(path.join(WEB, 'game/00_core.js'), 'utf8').split('\n');
  const a = core.findIndex(l => l.includes("const D = window.BIBOO;")), b = core.findIndex(l => l.includes("A-A-A-A-R1+R2+L1+L2"));
  vm.runInContext("(function(){'use strict';\n" + core.slice(a, b + 1).join('\n') + "\n})()", win, { filename: 'game/00_core.js (bindings)' });
}
const dump = { view: B.view, layers: B.layers, fringe: B.fringe, moves: B.moves, input: B.input, enemies: B.enemies || {}, items: B.items || {}, themes: B.themes || {}, beams: B.beams || {}, unlocks: (win.BibooProgress && win.BibooProgress.UNLOCKS) || [], training: B.training || null };
if (win.BIBOO_LEVELS) {
  const L = win.BIBOO_LEVELS;
  // each entry of L.levels is a level definition (name, maps, theme ...); keep only plain data
  dump.levels = { MAP_W: L.MAP_W, levels: (L.levels || []).map(l => l && JSON.parse(JSON.stringify(l))) };
  dump.levelKeys = Object.keys(L);
}
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(dump));
console.log('wrote', out, (fs.statSync(out).size / 1024 | 0) + ' KB', 'moves', Object.keys(dump.moves).length, 'enemies', Object.keys(dump.enemies).length, 'level keys', dump.levelKeys);
