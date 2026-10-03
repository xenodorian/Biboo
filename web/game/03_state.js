/* st121: load prior 03_state and ungated double jump */
(function () {
  const xhr = new XMLHttpRequest();
  xhr.open('GET', 'https://cdn.jsdelivr.net/gh/xenodorian/Biboo@9d1dbdd61847901658ebd45dd250bbd627f5c5fd/web/game/03_state.js', false);
  xhr.send(null);
  if (xhr.status !== 200) throw new Error('failed to load 03_state');
  let src = xhr.responseText;
  src = src.replace(
    "if (!P.has('double_jump') || dblUsed || stun) return false;",
    "if (dblUsed || stun) return false;"
  );
  (0, eval)(src);
})();
