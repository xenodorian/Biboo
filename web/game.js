/* Stages 1-4 meta-loader */
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

  loaderSrc = loaderSrc.split(
    "const f = cur.face, a = Math.min(f * HURT[0], f * HURT[2]), b = Math.max(f * HURT[0], f * HURT[2]);"
  ).join(
    "const f = cur.face, _bw = Math.max(8, HURT[2] * 0.55), a = Math.min(f * HURT[0], f * _bw), b = Math.max(f * HURT[0], f * _bw);"
  );
  loaderSrc = loaderSrc.split("dist <= ai.reach").join("dist <= ai.reach * 0.65");
  loaderSrc = loaderSrc.split("dist - ai.reach").join("dist - ai.reach * 0.65");

  const bootMark = "const V = D.view;\\n  const SPRITE_SCALE = 0.5;";
  const bootExtra =
    "const V = D.view;\\n  const SPRITE_SCALE = 0.5;\\n" +
    "  if (D.moves.beam_plasma) { D.moves.beam_plasma.title = 'Empowerment Beam'; }\\n" +
    "  let energyMeter = 0, empowerMeter = 0, ENERGY_MAX = 100, EMPOWER_MAX = 100;\\n" +
    "  window.__bibooMeters = () => ({ energy: energyMeter, empower: empowerMeter });\\n";
  if (loaderSrc.includes(bootMark) && !loaderSrc.includes('Empowerment Beam')) {
    loaderSrc = loaderSrc.split(bootMark).join(bootExtra);
  }

  loaderSrc = loaderSrc.split("if (e.hp <= 0) kill(e);").join(
    "if (e.hp <= 0) { if (e.dropEnergy) energyMeter = Math.min(ENERGY_MAX, energyMeter + 25); if (e.dropEmpower) empowerMeter = Math.min(EMPOWER_MAX, empowerMeter + 25); kill(e); }"
  );

  const plasmaHook =
    "hurtEnemy(e, BEAM_DMG[b.kind] || 8);" +
    " if (b.kind === 'plasma') { e.scale = Math.max(e.scale || 1, 1.6); e.dropEnergy = true; e.tint = { color: '#a0f', alpha: 0.4, until: clock + 400 }; }";
  loaderSrc = loaderSrc.split("hurtEnemy(e, BEAM_DMG[b.kind] || 8);").join(plasmaHook);

  loaderSrc = loaderSrc.split(
    "blit(img[T.sheet].im, cell * cw, cw, ch, -ax * SPRITE_SCALE, -ay * SPRITE_SCALE, e.tint && clock < e.tint.until ? e.tint : null, SPRITE_SCALE);"
  ).join(
    "blit(img[T.sheet].im, cell * cw, cw, ch, -ax * SPRITE_SCALE * (e.scale||1), -ay * SPRITE_SCALE * (e.scale||1), e.tint && clock < e.tint.until ? e.tint : null, SPRITE_SCALE * (e.scale||1));"
  );

  loaderSrc = loaderSrc.split("if (kind === 'action') queueHit();").join(
    "if (kind === 'action') queueHit(); if (id === 'taunt') { for (const en of enemies) { if (!alive(en)) continue; en.taunted = true; en.dropEmpower = true; en.speedMul = 2; en.dmgMul = 2; en.tint = { color: '#e22', alpha: 0.55, until: clock + 999999 }; } }"
  );

  loaderSrc = loaderSrc.split("ai.speed * dt / 1000").join("(ai.speed * (e.speedMul||1)) * dt / 1000");
  loaderSrc = loaderSrc.split("hurtHer(ENEMY_DMG[e.type] || 10)").join("hurtHer((ENEMY_DMG[e.type] || 10) * (e.dmgMul || 1))");

  loaderSrc = loaderSrc.split("function hud()").join(
    "function hud(){ try { g.save(); g.fillStyle='#222'; g.fillRect(8,8,80,6); g.fillRect(8,16,80,6); g.fillStyle='#4af'; g.fillRect(8,8,80*(energyMeter/ENERGY_MAX),6); g.fillStyle='#fa4'; g.fillRect(8,16,80*(empowerMeter/EMPOWER_MAX),6); g.restore(); } catch (err) {} "
  );

  loaderSrc = loaderSrc.split("function beamHit(e, b) {").join(
    "function beamHit(e, b) { if (b.kind !== 'plasma' && energyMeter < 5) return; if (b.kind !== 'plasma') energyMeter = Math.max(0, energyMeter - 5); if (b.kind === 'plasma') { if (empowerMeter < 10) return; empowerMeter = Math.max(0, empowerMeter - 10); }"
  );

  const s = document.createElement('script');
  s.text = loaderSrc;
  document.head.appendChild(s);
})().catch(err => {
  const el = document.getElementById('loading') || document.getElementById('start-menu');
  if (el) el.textContent = String(err);
  console.error(err);
});
