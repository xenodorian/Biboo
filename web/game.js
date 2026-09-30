/* Parry Perry — load base game and apply local patches */
(async function () {
  const res = await fetch('https://cdn.jsdelivr.net/gh/xenodorian/Biboo@4b0432e5c13bb7f13f627f8064409f230484b72a/web/game.js');
  if (!res.ok) throw new Error('failed to load base game');
  let src = await res.text();

  // 1) Zoom out
  src = src.replace(
    "  const D = window.BIBOO;\n  const V = D.view;\n  const canvas = document.getElementById('view');\n  const g = canvas.getContext('2d');\n  g.imageSmoothingEnabled = false;",
    "  const D = window.BIBOO;\n  const ZOOM = 0.72;\n  const V = {\n    w: Math.round(D.view.w / ZOOM),\n    h: Math.round(D.view.h / ZOOM),\n    margin: Math.round(D.view.margin / ZOOM),\n    anchorX: Math.round(D.view.anchorX / ZOOM),\n    feetRow: Math.round(D.view.feetRow / ZOOM),\n  };\n  const canvas = document.getElementById('view');\n  canvas.width = V.w;\n  canvas.height = V.h;\n  const g = canvas.getContext('2d');\n  g.imageSmoothingEnabled = false;"
  );

  // 2) slower respawn
  src = src.replace(
    'clock + 2 * (DIE_MS + 1200)',
    'clock + 2 * (DIE_MS + 4200)'
  );

  // 3) Initial enemies farther apart
  src = src.replace(
    "if (EN.orc) spawn('orc', 260);\n    if (EN.goblin) spawn('goblin', 360);",
    "if (EN.orc) spawn('orc', 420);\n    if (EN.goblin) spawn('goblin', 620);"
  );

  // 4) Beams from hilt base, not tip
  src = src.replace(
    "    const r = rootOf(cur), T = D.beams[f.beam.kind];\n    const len = Math.min(BEAM_LEN, 40 + el * BEAM_GROW);\n    const ox = x + r[0] + cur.face * f.beam.x, oy = r[1] + f.beam.y;      // world, y up",
    "    const r = rootOf(cur), T = D.beams[f.beam.kind];\n    const len = Math.min(BEAM_LEN, 40 + el * BEAM_GROW);\n    const HILT_X = 58, HILT_Y = 48;\n    const ox = x + r[0] + cur.face * HILT_X, oy = r[1] + HILT_Y;"
  );

  // 5) Camera lead scales with view width
  src = src.replace(
    "camLead += ((cur.face < 0 ? 192 : 0) - camLead)",
    "camLead += ((cur.face < 0 ? Math.round(V.w * 0.5) : 0) - camLead)"
  );

  // 6) Start menu gate
  src = src.replace(
    "  Promise.all(srcs.map(load)).then(() => {\n    document.getElementById('loading').remove();\n    if (EN.orc) spawn('orc', 420);\n    if (EN.goblin) spawn('goblin', 620);\n    canvas.focus();\n    requestAnimationFrame(frame);\n  }).catch(err => { document.getElementById('loading').textContent = String(err); });\n\n  canvas.addEventListener('pointerdown', () => canvas.focus());",
    "  let startedGame = false;\n  let assetsReady = false;\n  function beginGame() {\n    if (startedGame || !assetsReady) return;\n    startedGame = true;\n    const menu = document.getElementById('start-menu');\n    if (menu) menu.hidden = true;\n    if (EN.orc) spawn('orc', 420);\n    if (EN.goblin) spawn('goblin', 620);\n    canvas.focus();\n    requestAnimationFrame(frame);\n  }\n  Promise.all(srcs.map(load)).then(() => {\n    const loading = document.getElementById('loading');\n    if (loading) loading.remove();\n    assetsReady = true;\n    const startBtn = document.getElementById('btn-start');\n    if (startBtn) startBtn.disabled = false;\n    if (!document.getElementById('start-menu') || document.getElementById('start-menu').hidden) beginGame();\n  }).catch(err => {\n    const loading = document.getElementById('loading');\n    if (loading) loading.textContent = String(err);\n  });\n\n  canvas.addEventListener('pointerdown', () => canvas.focus());\n  document.getElementById('btn-start') && document.getElementById('btn-start').addEventListener('click', beginGame);\n  document.getElementById('btn-fullscreen') && document.getElementById('btn-fullscreen').addEventListener('click', () => {\n    const stage = document.getElementById('stage') || canvas;\n    if (!document.fullscreenElement) (stage.requestFullscreen && stage.requestFullscreen()) || (canvas.requestFullscreen && canvas.requestFullscreen());\n    else document.exitFullscreen && document.exitFullscreen();\n  });\n  addEventListener('keydown', e => {\n    if (startedGame) return;\n    if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); beginGame(); }\n  });"
  );

  // Guard missing #now overlay
  src = src.replace(
    "nowEl.innerHTML = label === 'stunned' ? 'Stunned' : label === 'falling' ? 'Landing'\n        : `${D.moves[id].title}<small>${D.moves[id].input}</small>`;",
    "if (nowEl) nowEl.innerHTML = label === 'stunned' ? 'Stunned' : label === 'falling' ? 'Landing'\n        : `${D.moves[id].title}<small>${D.moves[id].input}</small>`;"
  );

  const s = document.createElement('script');
  s.text = src;
  document.head.appendChild(s);
})().catch(err => {
  const el = document.getElementById('loading') || document.getElementById('start-menu');
  if (el) el.textContent = String(err);
  console.error(err);
});
