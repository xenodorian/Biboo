/* st121: load levels from prior commit */
(function () {
  const xhr = new XMLHttpRequest();
  xhr.open('GET', 'https://cdn.jsdelivr.net/gh/xenodorian/Biboo@9d1dbdd61847901658ebd45dd250bbd627f5c5fd/web/levels.js', false);
  xhr.send(null);
  if (xhr.status !== 200) throw new Error('failed to load levels');
  (0, eval)(xhr.responseText);
})();
