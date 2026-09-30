/* Parry Perry runtime — loads patched game body */
(function () {
  const parts = [];
  const n = 4;
  let left = n;
  function go() {
    const src = atob(parts.join(''));
    const s = document.createElement('script');
    s.textContent = src;
    document.head.appendChild(s);
  }
  for (let i = 0; i < n; i++) {
    fetch('game.b64.' + i + '.txt')
      .then(function (r) { return r.text(); })
      .then(function (t) {
        parts[i] = t.trim();
        if (--left === 0) go();
      })
      .catch(function (e) {
        var el = document.getElementById('loading');
        if (el) el.textContent = String(e);
      });
  }
})();
