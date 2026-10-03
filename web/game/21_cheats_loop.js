'use strict';
  // ------------------------------------------------------------------ menus, screens and the loop
  // Screens: 'title' (the menu over the overworld), 'overworld' (pick a level) and 'level' (playing). A menu (Start,
  // Enter, Escape) pauses the level. Game time (`clock`) only advances while a level runs.
  const UI = window.BibooUI;
  let screen = 'title', paused = false, gameOver = false, levelDone = false, story = false;
  let devOpen = false, devReturn = null, newGameArmed = false;
  const cheats = { infinite: false, god: false, oneHit: false, unlockAll: false };
  function btnHeld(b) { return !!(pad && pad.buttons[b] && pad.buttons[b].pressed); }
  function updateHudBtn() {
    const b = document.getElementById('btn-hud-start');
    if (b) b.textContent = screen === 'title' ? 'Start' : gameOver ? 'Retry' : paused ? 'Resume' : 'Menu';
  }
  function showMenu(msg) { newGameArmed = false; if (UI) UI.open('main', { msg: msg != null ? msg : '' }); }
  function hideMenu() { newGameArmed = false; if (UI) UI.close(); }
  function toggleFullscreen() {
    const stage = document.getElementById('stage') || canvas;
    const docFs = document.fullscreenElement || document.webkitFullscreenElement;
    // Prefer Fullscreen API when available; otherwise CSS "fs-fit" letterboxes the 4:3 stage on mobile.
    if (docFs) {
      (document.exitFullscreen && document.exitFullscreen()) || (document.webkitExitFullscreen && document.webkitExitFullscreen());
      document.documentElement.classList.remove('fs-fit');
      return;
    }
    if (document.documentElement.classList.contains('fs-fit')) {
      document.documentElement.classList.remove('fs-fit');
      return;
    }
    const req = (stage.requestFullscreen && stage.requestFullscreen.bind(stage))
      || (stage.webkitRequestFullscreen && stage.webkitRequestFullscreen.bind(stage))
      || (canvas.requestFullscreen && canvas.requestFullscreen.bind(canvas));
    if (req) {
      try {
        const p = req();
        if (p && p.catch) p.catch(() => document.documentElement.classList.add('fs-fit'));
        return;
      } catch (e) { /* fall through to CSS fit */ }
    }
    document.documentElement.classList.add('fs-fit');
  }
