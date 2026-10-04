'use strict';
  // ------------------------------------------------------------------ assets
  const img = {};
  let _loadDone = 0, _loadTotal = 0;
  function load(src) {
    if (img[src]) return img[src].p;
    const ent = { im: null, p: null };
    const attempt = n => new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => {
        ent.im = im;
        _loadDone++;
        if (window.bibooLoad && _loadTotal) {
          const pct = 25 + 70 * (_loadDone / _loadTotal);
          window.bibooLoad.set('Loading art ' + _loadDone + '/' + _loadTotal + '\u2026', pct);
        }
        res();
      };
      im.onerror = () => { if (n < 4) setTimeout(() => attempt(n + 1).then(res, rej), 250 * (n + 1)); else rej(new Error('missing ' + src)); };
      if (src.startsWith('story:')) {
        const url = (window.STORY_BGS || {})[src.slice(6)];
        if (!url) { rej(new Error('missing ' + src)); return; }
        im.src = url.startsWith('data:') ? url : url + (window.BIBOO_VER ? '?v=' + window.BIBOO_VER : '') + (n ? (window.BIBOO_VER ? '&' : '?') + 'retry=' + n : '');
      } else {
        im.src = src + (window.BIBOO_VER ? '?v=' + window.BIBOO_VER : '') + (n ? (window.BIBOO_VER ? '&' : '?') + 'retry=' + n : '');
      }
      ent.im = im;
    });
    ent.p = attempt(0);
    img[src] = ent;
    return ent.p;
  }
  const THEMES = D.themes || {};
  const srcs = [...D.layers.map(l => l.src), D.fringe.src];
  for (const t of Object.values(THEMES)) { for (const l of t.layers) { srcs.push(l.src); if (l.frames) srcs.push(...l.frames); } if (t.fringe) srcs.push(t.fringe); }
  for (const m of Object.values(D.moves)) {
    srcs.push(m.sheet);
    if (m.fxSheet) srcs.push(m.fxSheet);
    for (const f of m.frames) if (f.bw) srcs.push(f.bw);
  }
  if (D.mage) srcs.push(D.mage.blast.src, D.mage.reticle.src);
  for (const b of Object.values(D.beams || {})) srcs.push(b.src);
  const EN = D.enemies || {};
  for (const e of Object.values(EN)) srcs.push(e.sheet);
  if (D.training) srcs.push(D.training.bunny.sheet);
  if (D.items) srcs.push(D.items.leaf, D.items.gemSheet, D.items.merchant.src);
  if (window.STORY_BGS) for (const k of Object.keys(window.STORY_BGS)) srcs.push('story:' + k);
  if (window.STORY_BGS) srcs.push('assets/story/view/boat.png');
  const STILLS = window.ARENA_STILLS || {};
  for (const k of Object.keys(STILLS)) srcs.push('story:arena_' + k);
  if (window.STORY_BGS) for (const k of Object.keys(STILLS)) window.STORY_BGS['arena_' + k] = STILLS[k];
  _loadTotal = new Set(srcs).size;
  if (window.bibooLoad) window.bibooLoad.set('Loading art 0/' + _loadTotal + '\u2026', 25);
