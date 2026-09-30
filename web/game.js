/* Stage1+2 meta-loader */
(async function () {
  const res = await fetch('https://cdn.jsdelivr.net/gh/xenodorian/Biboo@5d7573978e2c342ea1120b6ad1d92e5c1ddde324/web/game.js');
  if (!res.ok) throw new Error('failed to load prior game loader');
  let loaderSrc = await res.text();

  const a = "move: 'beam_fire' });\\n  const V = D.view;";
  const b = "move: 'beam_fire' });\\n  for (const b of D.input.bindings) {\\n    if (b.move === 'energy_wave') { b.input = 'R2'; b.type = 'press'; }\\n  }\\n  if (!D.input.bindings.some(b => b.move === 'energy_wave'))\\n    D.input.bindings.push({ input: 'R2', type: 'press', move: 'energy_wave' });\\n  D.input.bindings = D.input.bindings.filter(b => !(b.move === 'energy_wave' && b.input !== 'R2'));\\n  const V = D.view;";
  loaderSrc = loaderSrc.split(a).join(b);

  const bothOld = "const BOTH_SIDES = new Set(['spin_attack']);";
  const bothNew = "const BOTH_SIDES = new Set(['spin_attack', 'energy_wave']);";
  if (!loaderSrc.includes(bothNew)) {
    const inject = 'src = src.replace(' + JSON.stringify(bothOld) + ', ' + JSON.stringify(bothNew) + ');\n  ';
    const mark = 'src = src.replace("  const BEAM_LEN = 330';
    const i = loaderSrc.indexOf(mark);
    if (i >= 0) {
      const end = loaderSrc.indexOf('");', i) + 3;
      loaderSrc = loaderSrc.slice(0, end) + '\n  ' + inject + loaderSrc.slice(end);
    }
  }

  const kickEnd = "e.push = { v: p.v * dir, a: p.a };\\n          }";
  if (loaderSrc.includes(kickEnd) && loaderSrc.indexOf("h.mv.id === 'energy_wave'") < 0) {
    const explode = kickEnd +
      "\\n          if (h.mv.id === 'energy_wave') {\\n" +
      "            rumble = { t0: clock, ms: 280, amp: 8 };\\n" +
      "            for (const o of enemies) {\\n" +
      "              if (o === e || !alive(o)) continue;\\n" +
      "              hurtEnemy(o, Math.max(dmgOf(h.mv), 80));\\n" +
      "              const p2 = push(120, 400), dir2 = o.x >= bodyX() ? 1 : -1;\\n" +
      "              o.state = 'stunned'; play(o, (EN[o.type].ai.stun || 'idle'));\\n" +
      "              o.push = { v: p2.v * dir2, a: p2.a };\\n" +
      "            }\\n" +
      "          }";
    loaderSrc = loaderSrc.split(kickEnd).join(explode);
  }

  loaderSrc = loaderSrc.split(
    "const sc = (h.mv && h.mv.id === 'meteor_shower') ? 1 : SPRITE_SCALE;"
  ).join(
    "const sc = (h.mv && h.mv.id === 'meteor_shower') ? 1 : (h.mv && h.mv.id === 'energy_wave') ? 2.2 : SPRITE_SCALE;"
  );

  // Stage2: tighter walk-block body so plow/sword does not keep enemies out of melee range
  loaderSrc = loaderSrc.split(
    "const f = cur.face, a = Math.min(f * HURT[0], f * HURT[2]), b = Math.max(f * HURT[0], f * HURT[2]);"
  ).join(
    "const f = cur.face, _bw = Math.max(8, HURT[2] * 0.55), a = Math.min(f * HURT[0], f * _bw), b = Math.max(f * HURT[0], f * _bw);"
  );
  loaderSrc = loaderSrc.split("dist <= ai.reach").join("dist <= ai.reach * 0.65");
  loaderSrc = loaderSrc.split("dist - ai.reach").join("dist - ai.reach * 0.65");

  const s = document.createElement('script');
  s.text = loaderSrc;
  document.head.appendChild(s);
})().catch(err => {
  const el = document.getElementById('loading') || document.getElementById('start-menu');
  if (el) el.textContent = String(err);
  console.error(err);
});
