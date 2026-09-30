/* Parry Perry — load prior + apply feature patches */
(async function () {
  const [loaderRes, patchRes] = await Promise.all([
    fetch('https://cdn.jsdelivr.net/gh/xenodorian/Biboo@5d7573978e2c342ea1120b6ad1d92e5c1ddde324/web/game.js'),
    fetch('patches.js?v=3'),
  ]);
  if (!loaderRes.ok) throw new Error('failed to load base loader');
  if (!patchRes.ok) throw new Error('failed to load patches');
  let loaderSrc = await loaderRes.text();
  (0, eval)(await patchRes.text());

  loaderSrc = loaderSrc.split("move: 'beam_fire' });\\n  const V = D.view;").join(
    "move: 'beam_fire' });\\n  for (const b of D.input.bindings) {\\n    if (b.move === 'energy_wave') { b.input = 'R2'; b.type = 'press'; }\\n  }\\n  if (!D.input.bindings.some(b => b.move === 'energy_wave'))\\n    D.input.bindings.push({ input: 'R2', type: 'press', move: 'energy_wave' });\\n  D.input.bindings = D.input.bindings.filter(b => !(b.move === 'energy_wave' && b.input !== 'R2'));\\n  const V = D.view;"
  );

  const mark = "  const s = document.createElement('script');";
  const inject = "  if (typeof globalThis.__bibooExtraPatches === 'function') src = globalThis.__bibooExtraPatches(src);\n";
  if (!loaderSrc.includes('__bibooExtraPatches')) {
    loaderSrc = loaderSrc.split(mark).join(inject + mark);
  }

  const s = document.createElement('script');
  s.text = loaderSrc;
  document.head.appendChild(s);
})().catch(err => {
  const el = document.getElementById('loading') || document.getElementById('start-menu');
  if (el) el.textContent = String(err);
  console.error(err);
});
