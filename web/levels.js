window.__lvParts = window.__lvParts || [];
(function () {
  const src = (window.__lvParts || []).join('');
  if (!src) throw new Error('levels parts missing');
  const s = document.createElement('script');
  s.text = src;
  document.documentElement.appendChild(s);
})();
