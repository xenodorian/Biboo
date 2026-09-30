/* Biboo: stages + limit fixes */
(async function () {
  const res = await fetch('https://cdn.jsdelivr.net/gh/xenodorian/Biboo@5d7573978e2c342ea1120b6ad1d92e5c1ddde324/web/game.js');
  if (!res.ok) throw new Error('failed to load prior game loader');
  let loaderSrc = await res.text();

  loaderSrc = loaderSrc.split("move: 'beam_fire' });\\n  const V = D.view;").join("move: 'beam_fire' });\\n  for (const b of D.input.bindings) {\\n    if (b.move === 'energy_wave') { b.input = 'R2'; b.type = 'press'; }\\n  }\\n  if (!D.input.bindings.some(b => b.move === 'energy_wave'))\\n    D.input.bindings.push({ input: 'R2', type: 'press', move: 'energy_wave' });\\n  D.input.bindings = D.input.bindings.filter(b => !(b.move === 'energy_wave' && b.input !== 'R2'));\\n  const V = D.view;");

  const inject = `
  src = src.replace(
    "const BOTH_SIDES = new Set(['spin_attack']);",
    "const BOTH_SIDES = new Set(['spin_attack', 'energy_wave']);"
  );
  src = src.replace(
    "const SPRITE_SCALE = 0.5;",
    "const SPRITE_SCALE = 0.5;\n  if (D.moves.beam_plasma) D.moves.beam_plasma.title = 'Empowerment Beam';\n  let energyMeter = 0, empowerMeter = 0;\n  const ENERGY_MAX = 100, EMPOWER_MAX = 100;\n  let gems = [];\n  function spawnGem(wx, kind) { gems.push({ x: wx, y: 18 + Math.random() * 8, kind, bob: Math.random() * 6.28 }); }\n  function stepGems(dt) {\n    for (const gm of gems) gm.bob += dt * 0.006;\n    gems = gems.filter(gm => {\n      if (Math.abs(gm.x - bodyX()) < 28) {\n        if (gm.kind === 'energy') { energyMeter = Math.min(ENERGY_MAX, energyMeter + 25); floater(gm.x, gm.y + 24, '+Energy', '#4af'); }\n        else { empowerMeter = Math.min(EMPOWER_MAX, empowerMeter + 25); floater(gm.x, gm.y + 24, '+Empower', '#fa4'); }\n        return false;\n      }\n      return true;\n    });\n  }\n  function drawGems() {\n    for (const gm of gems) {\n      const sx = Math.round(V.anchorX + (gm.x - camX));\n      const sy = Math.round(V.feetRow - gm.y - Math.sin(gm.bob) * 4);\n      g.save(); g.fillStyle = gm.kind === 'energy' ? '#4af' : '#fa4';\n      g.beginPath(); g.arc(sx, sy, 5, 0, Math.PI * 2); g.fill();\n      g.strokeStyle = '#fff'; g.lineWidth = 1; g.stroke(); g.restore();\n    }\n  }"
  );
  src = src.replace(
    "function kill(e) {\n    e.state = 'dying'; e.dead = 0; e.hp = 0;",
    "function kill(e) {\n    if (e.dropEnergy) spawnGem(e.x, 'energy');\n    if (e.dropEmpower) spawnGem(e.x, 'empower');\n    e.state = 'dying'; e.dead = 0; e.hp = 0;"
  );
  src = src.replace(
    "function stepHeal(dt) {\n    if (!cur || cur.id !== 'recover' || cur.kind !== 'hold' || stun || hp >= MAX_HP) { healAcc = 0; return; }\n    healAcc += dt;\n    while (healAcc >= HEAL_EVERY && hp < MAX_HP) {\n      healAcc -= HEAL_EVERY;\n      const n = Math.min(HEAL_AMOUNT, MAX_HP - hp);\n      hp += n;\n      floater(bodyX(), herY() + herTop() + 6, '+' + n, GREEN);\n    }\n  }",
    "function stepHeal(dt) {\n    if (typeof stepGems === 'function') stepGems(dt);\n    if (!cur || cur.id !== 'recover' || cur.kind !== 'hold' || stun || hp >= MAX_HP) { healAcc = 0; return; }\n    if (typeof empowerMeter === 'undefined' || empowerMeter < 1) { healAcc = 0; return; }\n    healAcc += dt;\n    while (healAcc >= HEAL_EVERY && hp < MAX_HP && empowerMeter >= 1) {\n      healAcc -= HEAL_EVERY;\n      empowerMeter = Math.max(0, empowerMeter - 8);\n      const n = Math.min(HEAL_AMOUNT, MAX_HP - hp);\n      hp += n;\n      floater(bodyX(), herY() + herTop() + 6, '+' + n, GREEN);\n    }\n  }"
  );
  src = src.replace(
    "function draw() {\n    if (!cur) return;",
    "function draw() {\n    try {\n      g.save();\n      g.fillStyle = '#222'; g.fillRect(8, 8, 80, 6); g.fillRect(8, 16, 80, 6);\n      g.fillStyle = '#4af'; g.fillRect(8, 8, 80 * (energyMeter / ENERGY_MAX), 6);\n      g.fillStyle = '#fa4'; g.fillRect(8, 16, 80 * (empowerMeter / EMPOWER_MAX), 6);\n      g.restore();\n      if (typeof drawGems === 'function') drawGems();\n    } catch (err) {}\n    if (!cur) return;"
  );
  src = src.replace(
    "hurtEnemy(e, BEAM_DMG[b.kind] || 8);",
    "if (b.kind === 'plasma') { if (empowerMeter < 10) continue; empowerMeter = Math.max(0, empowerMeter - 10); e.scale = Math.max(e.scale || 1, 1.6); e.dropEnergy = true; e.tint = { color: '#a0f', alpha: 0.4, until: clock + 400 }; }\n          else { if (energyMeter < 5) continue; energyMeter = Math.max(0, energyMeter - 5); }\n          hurtEnemy(e, BEAM_DMG[b.kind] || 8);"
  );
  src = src.replace(
    "if (kind === 'action') queueHit();",
    "if (kind === 'action') queueHit();\n    if (id === 'taunt') {\n      for (const en of enemies) {\n        if (!alive(en)) continue;\n        en.taunted = true; en.dropEmpower = true; en.speedMul = 2; en.dmgMul = 2;\n        en.tint = { color: '#e22', alpha: 0.55, until: clock + 999999 };\n      }\n    }"
  );
  src = src.replace("ai.speed * dt / 1000", "(ai.speed * (e.speedMul||1)) * dt / 1000");
  src = src.replace("hurtHer(ENEMY_DMG[e.type] || 10)", "hurtHer((ENEMY_DMG[e.type] || 10) * (e.dmgMul || 1))");
  src = src.replace("dist <= ai.reach", "dist <= ai.reach * 0.65");
  src = src.replace("dist - ai.reach", "dist - ai.reach * 0.65");
  src = src.replace(
    "blit(img[T.sheet].im, cell * cw, cw, ch, -ax * SPRITE_SCALE, -ay * SPRITE_SCALE, e.tint && clock < e.tint.until ? e.tint : null, SPRITE_SCALE);",
    "blit(img[T.sheet].im, cell * cw, cw, ch, -ax * SPRITE_SCALE * (e.scale||1), -ay * SPRITE_SCALE * (e.scale||1), e.tint && clock < e.tint.until ? e.tint : null, SPRITE_SCALE * (e.scale||1));"
  );
  src = src.replace(
    "const sc = (h.mv && h.mv.id === 'meteor_shower') ? 1 : SPRITE_SCALE;",
    "const sc = (h.mv && h.mv.id === 'meteor_shower') ? 1.4 : (h.mv && h.mv.id === 'energy_wave') ? 2.2 : SPRITE_SCALE;"
  );
  src = src.replace(
    "const f = cur.face, a = Math.min(f * HURT[0], f * HURT[2]), b = Math.max(f * HURT[0], f * HURT[2]);",
    "const f = cur.face, _bw = Math.max(8, HURT[2] * 0.55), a = Math.min(f * HURT[0], f * _bw), b = Math.max(f * HURT[0], f * _bw);"
  );
  `;

  const mark = "  const s = document.createElement('script');";
  if (!loaderSrc.includes('spawnGem')) {
    loaderSrc = loaderSrc.split(mark).join(inject + '\n' + mark);
  }

  const s = document.createElement('script');
  s.text = loaderSrc;
  document.head.appendChild(s);
})().catch(err => {
  const el = document.getElementById('loading') || document.getElementById('start-menu');
  if (el) el.textContent = String(err);
  console.error(err);
});
