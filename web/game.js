(async function () {
  const n = 8;
  const parts = await Promise.all(
    Array.from({ length: n }, (_, i) =>
      fetch('game.p' + i + '.js').then(r => r.text())
    )
  );
  const s = document.createElement('script');
  s.text = parts.join('');
  document.head.appendChild(s);
})();
