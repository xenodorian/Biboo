/* Dreamcast pad reader for the Biboo move library.
 *
 * Reads game/input_map.json (embedded in assets/data.js) and turns button presses into moves:
 *   press     one button                          Y, X, A, L
 *   hold      held button, loops while held       Right, Left, Down, Up, B, R
 *   tap       quick press and release             B (parry)
 *   chord     pressed together                    Right+A, A+B, A+B+L ... ('+')
 *   sequence  pressed one after another           Up-A, Down-Y, Left-Right-A, B-X+A ... ('-')
 * Directions in a chord only need to be held (hold Right, press A = thrust), and so do buttons a
 * chord lists under "held" (A+B: hold B, tap A); other buttons must go down within
 * chord_window_ms of each other. A press waits chord_window_ms before
 * it resolves, so a chord is not mistaken for its first button. Priority, from the map's note:
 * the longest sequence, then the largest chord, then a single button. In a two-step sequence that
 * starts with a direction (Up-A, Down-Y), holding the direction counts the same as tapping it.
 *
 * Pure logic, no DOM: the game calls down()/up()/update() with timestamps in ms. Works in the
 * browser (window.BibooInput) and in Node (module.exports) for the tests.
 */
(function (root) {
  'use strict';
  const DIRS = ['Up', 'Down', 'Left', 'Right'];

  function parse(map) {
    const B = { press: {}, tap: {}, hold: {}, chords: [], sequences: [], releaseInto: {}, idle: 'idle' };
    for (const b of map.bindings) {
      if (b.type === 'idle') B.idle = b.move;
      else if (b.type === 'press') B.press[b.input] = b.move;
      else if (b.type === 'tap') B.tap[b.input] = b.move;
      else if (b.type === 'hold') {
        B.hold[b.input] = b.move;
        if (b.release_into) B.releaseInto[b.input] = b.release_into;
      } else if (b.type === 'chord') B.chords.push({ keys: b.input.split('+'), move: b.move, held: b.held || [], loose: !!b.loose });
      else if (b.type === 'sequence') B.sequences.push({ steps: b.input.split('-').map(s => s.split('+')), move: b.move });
    }
    B.chords.sort((a, b) => b.keys.length - a.keys.length);
    B.sequences.sort((a, b) => b.steps.length - a.steps.length || b.steps.flat().length - a.steps.flat().length);
    return B;
  }


  class Reader {
    /* map: the input_map.json object. opts.holdReady(button, ms) -> true once a hold move has
     * reached the point where releasing it may trigger release_into (the charge loop). */
    constructor(map, opts) {
      this.map = map;
      this.B = parse(map);
      this.chordMs = map.chord_window_ms;
      this.seqMs = map.sequence_window_ms;
      this.tapMs = map.tap_max_ms;
      this.opts = opts || {};
      this.held = new Map();        // button -> time it went down
      this.history = [];            // every press: {b, t}
      this.group = null;            // presses waiting out the chord window: {t, keys: []}
      this.consumed = new Set();    // held buttons already used by a chord or sequence
      this.events = [];             // resolved: {move, via}
    }

    down(b, t) {
      if (this.held.has(b)) return;                     // key repeat
      this.held.set(b, t);
      this.consumed.delete(b);
      this.history.push({ b, t, u: null, used: false });   // u: when it was released
      if (this.history.length > 16) this.history.shift();
      if (this.group && t - this.group.t <= this.chordMs) this.group.keys.push(b);
      else {
        if (this.group) this.resolve(t);
        this.group = { t, keys: [b] };
      }
    }

    up(b, t) {
      const t0 = this.held.get(b);
      if (t0 === undefined) return;
      // a release settles any press still waiting out the chord window, while everything it
      // was pressed with (a held direction included) still counts as down
      if (this.group) this.resolve(t);
      this.held.delete(b);
      for (let i = this.history.length - 1; i >= 0; i--) if (this.history[i].b === b) { if (this.history[i].u === null) this.history[i].u = t; break; }
      const was = this.consumed.has(b);
      this.consumed.delete(b);
      if (was) return;
      if (this.B.tap[b] && t - t0 <= this.tapMs) this.emit(this.B.tap[b], 'tap');
      const into = this.B.releaseInto[b];
      if (into && (!this.opts.holdReady || this.opts.holdReady(b, t - t0))) this.emit(into, 'release');
    }

    update(t) {
      if (this.group && t - this.group.t > this.chordMs) this.resolve(t);
      const out = this.events;
      this.events = [];
      return out;
    }

    emit(move, via) { this.events.push({ move, via }); }

    resolve(t) {
      const g = this.group;
      this.group = null;
      if (!g) return;
      // 1. sequences: the earlier steps are the presses just before this group, oldest first, each
      //    within the sequence window of the next; the last step (one button or a chord) is this group.
      //    In a two-step sequence whose first button is a direction or a hold button (Up-A, Down-Y,
      //    B-X+A), holding that button counts the same as tapping it.
      const prior = this.history.filter(e => e.t < g.t);
      for (const s of this.B.sequences) {
        const n = s.steps.length, last = s.steps[n - 1];
        let earlier, lastT;
        if (last.length === 1) {                         // ends in one button: the last n presses
          if (this.history.length < n) continue;
          const tail = this.history.slice(-n);
          if (tail[n - 1].b !== last[0] || !g.keys.includes(last[0])) continue;
          earlier = tail.slice(0, n - 1); lastT = tail[n - 1].t;
        } else {                                         // ends in a chord: all of it in this group
          if (!last.every(k => g.keys.includes(k)) || prior.length < n - 1) continue;
          earlier = prior.slice(prior.length - (n - 1)); lastT = g.t;
        }
        let ok = true;
        for (let i = 0; i < n - 1 && ok; i++) {
          const e = earlier[i], next = i < n - 2 ? earlier[i + 1].t : lastT;
          if (s.steps[i].length !== 1 || e.b !== s.steps[i][0]) ok = false;
          else if (next - e.t > this.seqMs) {
            const holdable = DIRS.includes(e.b) || !!this.B.hold[e.b];
            ok = n === 2 && holdable && (e.u === null || e.u >= next);
          }
        }
        if (ok) {
          for (const k of s.steps.flat()) if (this.held.has(k)) this.consumed.add(k);
          this.history = [];                             // a finished sequence starts fresh
          return this.emit(s.move, 'sequence');
        }
      }
      // 2. chords: directions may just be held, other buttons must be in this press group
      //    a loose chord (A+B+L) also takes its buttons one after another, in any order, each
      //    held or pressed within the sequence window
      const now = g.t + this.chordMs;
      const recent = k => this.history.some(e => e.b === k && !e.used && now - e.t <= this.seqMs);
      for (const c of this.B.chords) {
        const may = k => DIRS.includes(k) || c.held.includes(k);   // may already be held down
        const ok = c.keys.every(k => g.keys.includes(k) || (may(k) || c.loose) && this.held.has(k) && !this.consumed.has(k)
                                     || c.loose && recent(k));
        const fresh = c.keys.some(k => g.keys.includes(k) && !DIRS.includes(k));
        if (ok && fresh) {
          for (const k of c.keys) if (this.held.has(k) && !DIRS.includes(k)) this.consumed.add(k);
          if (c.loose) for (const e of this.history) if (c.keys.includes(e.b)) e.used = true;
          return this.emit(c.move, 'chord');
        }
      }
      // 3. single buttons: the last non-direction button of the group
      const btns = g.keys.filter(k => !DIRS.includes(k));
      const b = btns[btns.length - 1];
      if (b && this.B.press[b]) this.emit(this.B.press[b], 'press');
      // tap and hold buttons (B, R) and directions act through up() and holdMove()
    }

    /* The hold move to loop while nothing else plays, from what is held right now. */
    holdMove(t) {
      const order = ['R', 'B', 'Up', 'Down', 'Right', 'Left'];
      for (const b of order) {
        if (!this.held.has(b) || this.consumed.has(b) || !this.B.hold[b]) continue;
        if (this.B.tap[b] && t - this.held.get(b) <= this.tapMs) continue;   // could still be a tap
        return this.B.hold[b];
      }
      return this.B.idle;
    }

    heldButtons() { return [...this.held.keys()]; }
  }

  const api = { Reader, parse, DIRS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BibooInput = api;
})(typeof window !== 'undefined' ? window : globalThis);
