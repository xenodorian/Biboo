'use strict';
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
    const all = ctrl.concat(combos);
    for (const r of all) r.info = (MOVE_INFO[r.move] || MOVE_INFO[r.uid] || r.how) + ' How: ' + r.pad + (r.how ? ', ' + r.how : '') + '.';
    return all;
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
