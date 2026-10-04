'use strict';
  // ------------------------------------------------------------------ menus, screens and the loop
  // Screens: 'title' (the menu over the overworld), 'overworld' (pick a level) and 'level' (playing). A menu (Start,
  // Enter, Escape) pauses the level. Game time (`clock`) only advances while a level runs.
  const UI = window.BibooUI;
  let last = 0;
  let assetsReady = false, paused = false, gameOver = false, levelDone = false, devOpen = false;
  const ow = { sel: 0 };                                             // overworld cursor: index of the selected level

  // Menu navigation: while a menu is open, Up and Down (arrows, d-pad or stick) move the highlight, A activates and
  // B goes back. On the overworld, Left/Right or Up/Down pick a level and A enters it. Edge detected, with key repeat.
  const navPrev = { Up: false, Down: false, Left: false, Right: false, A: false, B: false, Y: false, dev: false }, navNext = { Up: 0, Down: 0 };
  function navPoll(t) {
    const on = k => keyDown.has(k) || padDown.has(k);
    const now = { Up: on('Up'), Down: on('Down'), Left: on('Left'), Right: on('Right'), A: on('A'), B: on('B'), Y: on('Y') };
    const chord = ['L1', 'L2', 'R1', 'R2'].every(on);                  // all four shoulder buttons together, in the pause menu: the Cheats entry appears
    if (chord && !navPrev.dev && assetsReady && UI && UI.isOpen() && UI.view === 'main' && !cheatsShown) { cheatsShown = true; UI.refresh(); }
    navPrev.dev = chord;
    if (UI && UI.isOpen()) {
      for (const k of ['Up', 'Down']) {
        if (now[k] && (!navPrev[k] || t >= navNext[k])) { UI.nav(k === 'Up' ? -1 : 1); navNext[k] = t + (navPrev[k] ? 110 : 320); }
      }
      if (now.A && !navPrev.A) UI.activate();
      if (now.B && !navPrev.B) UI.back();
      if (now.Y && !navPrev.Y) UI.info();
    } else if (screen === 'overworld' && !paused && !devOpen) {
      const n = LV.levels.length, TR = n, MR = n + 1;                  // the levels, Sunset Training and the Bone Merchant
      const l = now.Left && !navPrev.Left, r = now.Right && !navPrev.Right, u = now.Up && !navPrev.Up, d = now.Down && !navPrev.Down;
      if (ow.sel < n) { if (l) ow.sel = (ow.sel + n - 1) % n; if (r) ow.sel = (ow.sel + 1) % n; if (u) ow.sel = MR; }   // Up from a level: the Bone Merchant
      else if (ow.sel === MR) { if (r) ow.sel = TR; if (d) ow.sel = 0; }     // Right: Sunset Training; Down: level 1
      else { if (l) ow.sel = MR; if (d) ow.sel = 0; }                        // Training: Left is the merchant, Down is level 1
      if (now.A && !navPrev.A) enterLevel(ow.sel + 1);
    }
    Object.assign(navPrev, now);
  }
  // buttons still held when a menu closes are ignored until they are let go, so pressing A on "Resume" does not slash
  const ignoreUntilUp = new Set();
  function ignoreHeldButtons() { for (const b of BUTTONS) if (btnHeld(b)) ignoreUntilUp.add(b); }

  // Turning mirrors the sprite about her anchor, but the point between her legs sits LEGS px ahead of it, so a bare flip would swing
  // her feet 2*LEGS px across. Instead the anchor moves so that point stays where it was. Skipped where that would
  // push the anchor into a block or a map edge.
  let visFace = 1;
  function turnShift(from, to) {
    const shift = (from - to) * LEGS, ax = playerX() + shift, feet = herY();
    if (ax < EDGE + 2 || ax > MAP_W - EDGE - 2) return;
    if (curMap && curMap.solids.some(sd => feet < sd.top - 2 && ax + FOOT > sd.x0 && ax - FOOT < sd.x1)) return;
    x += shift;
  }
  function tickLevel(t, dt) {
    if (freeze > 0) { freeze -= dt; readButtons(t); draw(); hud(); return; }   // (presses made during the freeze are still read)      // hit-stop: the world holds still for a moment
    clock += dt;                                      // game time: it does not run while a menu is open
    if (storyAt !== null && clock >= storyAt) { storyAt = null; P.state.story.double = true; playStory('double', () => { paused = false; }); return; }
    if (pitFall) {                                    // she fell into a pit: the rest of the world goes on while she drops out of sight
      if (pitOffScreen() && !gameOver) { hp = 0; triggerGameOver(); }
      stepEffects(dt); stepEnemies(dt); follow(dt); draw(); hud(); drawMonitor();
      return;
    }
    if (level && level.def.training) { hp = maxHp(); energyMeter = maxOf('energy'); empowerMeter = maxOf('empower'); superMeter = maxOf('super'); }   // training: nothing runs out
    if (cheats.infinite) { energyMeter = maxOf('energy'); empowerMeter = maxOf('empower'); superMeter = maxOf('super'); }
    readButtons(t);
    for (const e of reader.update(t)) {
      if (e.move === 'ultimate') { startUltimate(); continue; }
      const via = e.move === 'slash' && e.via === 'tap' ? 'press' : e.via;
      if (e.move === 'slash' && via === 'press' && chainPress()) continue;
      if (e.move === 'parry' && via === 'tap' && chainBurst()) continue;
      request(e.move, via);
    }
    chainTick(); ultTick();
    const before = cur && BLOCKED.has(cur.id) ? playerX() : null;
    step(dt, t);
    { const vf = hf(); if (vf !== visFace) { if (!stun) turnShift(visFace, vf); visFace = vf; } }
    if (cur && cur.crash && cur.id === 'jump' && rootOf(cur)[1] > 0) airCrash('air');
    blockMove(before);
    physics();
    if (screen !== 'level' || !curMap) return;        // the level just ended
    if (flight && (stun || !(cur && cur.id === 'jump' && cur.phys))) flight = null;
    if (rainbow) { if (rainbowOn() && !stun) tint = rainbowTint(); else if (!rainbowOn()) rainbow = null; }
    checkPit();
    if (!fall && (!cur || cur.kind === 'hold' || cur.kind === 'land' || (cur.id === 'jump' && cur.kind === 'action' && !cur.phys))) dblUsed = false;   // back on her feet
    if (hp <= 0 && !gameOver) triggerGameOver();     // any source of damage ends the run, not only an enemy hit
    beamHits();
    stepHeal(dt);
    stepEffects(dt);
    stepShots(dt);
    stepBombs();
    if (cur && cur.kind === 'action' && !hitQ.length) queueHit();   // the frame still on screen
    stepEnemies(dt);
    resolveHits();
    enemyAttacks();
    follow(dt);
    draw();
    hud();
    drawMonitor();
  }
