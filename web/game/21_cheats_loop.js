'use strict';
  // ---- the Cheats menu: after L1+R1+L2+R2 together in the pause menu it is listed there. It pauses the game.
  let devReturn = null, resetArmed = false;
  function openDev() {
    devReturn = UI.isOpen() ? { view: UI.view, opts: UI.opts } : null;
    devOpen = true; resetArmed = false;
    UI.open('dev', {});
  }
  function closeDev() {                              // back to the menu that was open under it, or to the game
    devOpen = false; resetArmed = false;
    if (devReturn) UI.open(devReturn.view, devReturn.opts); else { UI.close(); ignoreHeldButtons(); canvas.focus(); }
    devReturn = null;
  }
  function leaveDev() {                              // close the console and the menus under it: play on
    devOpen = false; devReturn = null; resetArmed = false;
    paused = false; gameOver = false; levelDone = false;
    if (hp <= 0) hp = maxHp();
    UI.close(); ignoreHeldButtons(); setStartLabel();
  }
  function toggleDev() { if (devOpen) closeDev(); else if (assetsReady) openDev(); }
  function devItems() {
    const onoff = v => v ? 'ON' : 'OFF', act = fn => () => { resetArmed = false; fn(); };
    return [
      { label: 'God Mode', state: onoff(cheats.invincible), fn: act(() => { cheats.invincible = !cheats.invincible; }) },
      { label: 'Infinite Meter', state: onoff(cheats.infinite), fn: act(() => { cheats.infinite = !cheats.infinite; }) },
      { label: 'Level Unlock', fn: act(() => { P.unlockAllLevels(); }) },
      { label: 'Master Unlock', fn: act(() => unlockEverything()) },
      { label: 'No Pitfalls', state: onoff(cheats.nopit), fn: act(() => { cheats.nopit = !cheats.nopit; }) },
      { label: 'Close', fn: closeDev, primary: true },
    ];
  }

  function setStartLabel() {
    const b = document.getElementById('btn-hud-start');
    if (b) b.textContent = screen === 'title' ? 'Start' : gameOver ? 'Retry' : paused ? 'Resume' : 'Menu';
  }
  function showMenu(msg) { newGameArmed = false; if (UI) UI.open('main', { msg: msg != null ? msg : '' }); }
  function hideMenu() { newGameArmed = false; if (UI) UI.close(); }
  function toggleFullscreen() {
    const stage = document.getElementById('stage') || canvas;
    if (!document.fullscreenElement) (stage.requestFullscreen && stage.requestFullscreen()) || (canvas.requestFullscreen && canvas.requestFullscreen());
    else document.exitFullscreen && document.exitFullscreen();
  }
  // B or Escape on the main list: back to the game (not from the title menu, Game Over or Level Complete)
  function closeMenu() {
    if (story) return;
    if (devOpen) { closeDev(); return; }
    if (screen === 'title' || gameOver || levelDone || !paused) return;
    togglePause();
  }
  // Saving is manual only. Progress lives in memory; "Save game" writes one snapshot to the browser, "Continue" loads it,
  // "New game" wipes it and starts level 1.1 with nothing unlocked. Closing or reloading the page loses unsaved progress.
  let newGameArmed = false;
  function newGame() {
    P.wipe(); P.reset();
    energyMeter = empowerMeter = superMeter = 0;
    refreshUnlocks();
    goOverworld();
    playStory('prologue', () => { goOverworld(); ow.sel = LV.levels.length + 1; banners.push({ title: 'You start with 100 Leaves', sub: 'Visit the Bone Merchant to buy moves', t0: clock, ms: 4200 }); });
  }
  function continueGame() {
    if (!P.loadSave()) { showMenu('No saved game'); return; }
    energyMeter = P.state.meters.energy; empowerMeter = P.state.meters.empower; superMeter = P.state.meters.super;
    refreshUnlocks();
    goOverworld();
  }
  function saveGame() {
    syncProgress();
    showMenu(P.saveToDisk() ? 'Game saved' : 'Could not save: the browser blocked storage');
  }
  function mainItems() {
    const items = [], hasSave = P.hasSave();
    if (screen === 'title') {
      if (hasSave) items.push({ label: 'Continue', fn: () => continueGame(), primary: true, id: 'btn-start' });
      items.push({ label: !hasSave ? 'New game' : newGameArmed ? 'Press again to erase the save' : 'New game (erases save)', primary: !hasSave, id: hasSave ? 'btn-new-game' : 'btn-start',
        fn: () => { if (hasSave && !newGameArmed) { newGameArmed = true; UI.refresh(); return; } newGame(); } });
    }
    else if (gameOver) items.push({ label: level && level.n > 0 && P.state.ankhs < 1 ? 'Out of ankhs: restart the level' : level && level.n > 0 ? `Retry this map (costs 1 ankh, ${P.state.ankhs} left)` : 'Retry this map', fn: () => retryMap(), primary: true, id: 'btn-start' });
    else items.push({ label: 'Resume', fn: () => togglePause(), primary: true, id: 'btn-start' });
    items.push({ label: 'Moves: Gamepad', fn: () => UI.open('moves', { msg: UI.opts.msg, device: 'pad' }) });
    items.push({ label: 'Moves: Keyboard', fn: () => UI.open('moves', { msg: UI.opts.msg, device: 'keys' }) });
    if (window.BibooMusic) items.push({ label: 'Music: ' + BibooMusic.label(), id: 'btn-music', fn: () => { BibooMusic.cycle(); UI.refresh(); } });
    if (cheatsShown) items.push({ label: 'Cheats', fn: () => openDev() });
    items.push({ label: 'Items', fn: () => UI.open('gems', { msg: UI.opts.msg }) });
    if (screen === 'overworld' || screen === 'title') items.push({ label: 'Bone Merchant', fn: () => UI.open('shop', { msg: 'Spend your Leaves. Press B to go back.', back: () => UI.open('main', { msg: '' }) }), id: 'btn-shop' });
    if (screen === 'level') items.push({ label: 'Back to the overworld', fn: () => goOverworld() });
    if (screen !== 'title') items.push({ label: 'Save game', fn: () => saveGame(), id: 'btn-save' });
    items.push({ label: 'Fullscreen', fn: toggleFullscreen, id: 'btn-fullscreen' });
    if (screen !== 'title') items.push({ label: newGameArmed ? 'Press again: erase everything and start over' : 'New game (erases save)', id: 'btn-new-game',
      fn: () => { if (!newGameArmed) { newGameArmed = true; UI.refresh(); return; } newGame(); } });
    return items;
  }
  function triggerGameOver() {
    if (gameOver) return;
    gameOver = true;
    paused = true;
    showMenu('Game Over');
    setStartLabel();
  }
  function togglePause() {
    if (!assetsReady || story) return;
    if (devOpen) { closeDev(); return; }
    if (screen === 'title') { goOverworld(); return; }
    if (levelDone) { goOverworld(); return; }
    if (gameOver) { retryMap(); return; }
    paused = !paused;
    if (paused) showMenu(screen === 'level' ? 'Paused' : 'Menu');
    else { hideMenu(); ignoreHeldButtons(); canvas.focus(); }
    setStartLabel();
  }
  if (UI) UI.init({ isTitle: () => screen === 'title' && !story, mainItems, closeMenu, moveRows, lockedCount, padStatus, gemRows, useGem, devItems, shopRows, buy, leaves: () => P.state.leaves,
    sprite: spriteCss,
    moveNotes: dev => dev === 'keys'
      ? ['Keyboard: arrows = d-pad, Z = A (attack), X = B, A = X, S = Y, Up = jump. Shoulders: Q = L1, W = R1 (hold to recover), 1 = L2, 2 = R2. Enter, Space or Escape opens and closes this menu. Hold Left or Right while jumping to steer. Double tap Down on a platform to drop through it. Press H to show hurtboxes and hit shapes.']
      : ['A gamepad works too, wired or Bluetooth, also on an Android phone in Chrome: A (bottom) jumps, Y (top) attacks, B is right, X is left. Start opens and closes this menu. Click the game first if buttons do nothing.'] });
  function showTitle() {
    // Startup is an explicit title/splash state. Do not route through the overworld first:
    // the splash must be the first playable screen after assets finish loading.
    story = null; storyAt = null; level = null; curMap = null;
    paused = false; gameOver = false; levelDone = false; devOpen = false;
    enemies.length = 0; respawns.length = 0; gems.length = 0; explosions.length = 0; floaters.length = 0;
    powerups.length = 0; particles.length = 0; banners.length = 0; hitQ.length = 0;
    stun = null; slide = null; fall = null; cur = null; queued = null; hold = null; tint = null;
    floorY = 0; camY = 0; rumble = null; flight = null; rainbow = null; ult = null;
    ow.sel = 0; clock = 0;
    screen = 'title';
    hideMenu(); ignoreHeldButtons(); setStartLabel();
    showMenu('Defeat the goblins and orcs');
    canvas.focus();
  }
  Promise.all(srcs.map(load)).then(() => {
    const loading = document.getElementById('loading');
    if (loading) loading.remove();
    assetsReady = true;
    const hb = document.getElementById('btn-hud-start');
    if (hb) hb.disabled = false;
    showTitle();
  }).catch(err => {
    const loading = document.getElementById('loading');
    if (loading) loading.textContent = String(err) + '. Reload the page (hard refresh) to try again.';
  });
  requestAnimationFrame(frame);

  canvas.addEventListener('pointerdown', ev => {
    canvas.focus();
    if (screen !== 'overworld' || paused) return;      // tap or click a level on the overworld: first selects, second enters
    const r = canvas.getBoundingClientRect(), px = (ev.clientX - r.left) * V.w / r.width, py = (ev.clientY - r.top) * V.h / r.height;
    for (let i = 0; i <= LV.levels.length + 1; i++) {
      const [nx, ny] = i === LV.levels.length + 1 ? [MERCHANT_AT[0], MERCHANT_AT[1] - 25] : nodeAt(i);
      if (Math.hypot(px - nx, py - ny) < (i === LV.levels.length + 1 ? 32 : 18)) { if (ow.sel === i) enterLevel(i + 1); else ow.sel = i; return; }
    }
  });
  window.togglePause = togglePause;
  addEventListener('pagehide', syncProgress);
  document.addEventListener('visibilitychange', () => { if (document.hidden) syncProgress(); });
  const hudBtn = document.getElementById('btn-hud-start');
  if (hudBtn) hudBtn.addEventListener('click', ev => { ev.preventDefault(); togglePause(); });
  addEventListener('keydown', e => {
    if (e.code === 'Escape') {
      e.preventDefault();
      if (UI && UI.isOpen()) UI.back(); else if (screen !== 'title' && !gameOver) togglePause();
      return;
    }
    if (e.code === 'Enter' || e.code === 'Space') {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'BUTTON')) return;
      e.preventDefault();
      togglePause();
    }
  });
  // read-only hooks for the browser test
