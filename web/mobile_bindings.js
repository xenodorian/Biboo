/* st127: on touch-first devices, same-side Dreamcast chords become sequences */
(function () {
  if (typeof matchMedia === 'undefined' || !matchMedia('(pointer: coarse)').matches) return;
  if (!window.BIBOO || !BIBOO.input || !BIBOO.input.bindings) return;
  const RIGHT = new Set(['A', 'B', 'X', 'Y']);
  const LEFT = new Set(['Up', 'Down', 'Left', 'Right', 'L1', 'L2', 'R1', 'R2', 'L', 'R']);
  function side(k) { return RIGHT.has(k) ? 'R' : LEFT.has(k) ? 'L' : '?'; }
  function sameSide(keys) {
    const s = keys.map(side);
    return s.length >= 2 && s.every(x => x === s[0] && x !== '?');
  }
  function mobileizeBindings(bindings) {
    return bindings.map(b => {
      const out = Object.assign({}, b);
      if (b.type === 'chord') {
        const keys = b.input.split('+');
        if (sameSide(keys)) {
          out.type = 'sequence';
          out.input = keys.join('-');
          delete out.held;
          delete out.loose;
        }
      } else if (b.type === 'sequence') {
        const steps = b.input.split('-');
        const flat = [];
        for (const step of steps) {
          const parts = step.split('+');
          if (parts.length > 1 && sameSide(parts)) flat.push(...parts);
          else flat.push(step);
        }
        out.input = flat.join('-');
      }
      return out;
    });
  }
  BIBOO.input.bindings = mobileizeBindings(BIBOO.input.bindings);
  BIBOO.input.note = (BIBOO.input.note || '') + ' Mobile: same-side chords are sequential taps.';
  window.__mobileBindings = true;
})();
