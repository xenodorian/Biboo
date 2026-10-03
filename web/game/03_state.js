window.__stParts = window.__stParts || [];
(function () {
  const src = (window.__stParts || []).join('');
  if (!src) throw new Error('03_state parts missing');
  const s = document.createElement('script');
  s.text = src;
  document.documentElement.appendChild(s);
})();
