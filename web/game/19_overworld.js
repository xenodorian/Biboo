'use strict';
  // ---- music: which track belongs to what is on screen (BibooMusic crossfades when it changes)
  function wantedTrack() {
    if (story) return story.id === 'ending' ? 'ending' : 'prologue';
    if (UI && UI.isOpen() && UI.view === 'shop') return 'shop';
    if (screen === 'title' || screen === 'overworld') return 'overworld';
    if (screen === 'level' && level) {
      if (level.n === 0) return 'training';
      return curMap && curMap.def && curMap.def.boss ? 'boss' + level.n : 'level' + level.n;
    }
    return null;
  }
  function frame(t) {
    pollPad();
    if (window.BibooMusic) { BibooMusic.pollPad(); BibooMusic.want(gameOver ? null : wantedTrack()); }
    navPoll(t);
    const dt = Math.min(100, last ? t - last : 16);
    last = t;
    if (assetsReady) {
      if (story) { clock += dt; drawStory(); }
      else if (screen === 'level') { if (!paused && !gameOver && !devOpen) tickLevel(t, dt); }
      else { clock += dt; stepEffects(dt); if (screen === 'title') drawTitle(); else drawOverworld(); hud(); }
    }
    requestAnimationFrame(frame);
  }

  // ---- the overworld: five level nodes on a path; a level opens when the one before it is beaten
  // Overworld authored for 384x216 (16:9). Fit uniformly into 640x480 (4:3) so the path is not stretched.
  const OW_NODES_BASE = [[36, 150], [90, 112], [144, 146], [198, 106], [252, 144], [306, 108], [348, 60]];
  const OW_SCALE = Math.min(V.w / 384, V.h / 216);
  const OW_OX = Math.round((V.w - 384 * OW_SCALE) / 2);
  const OW_OY = Math.round((V.h - 216 * OW_SCALE) / 2);
  const OW_NODES = OW_NODES_BASE.map(([x, y]) => [Math.round(OW_OX + x * OW_SCALE), Math.round(OW_OY + y * OW_SCALE)]);
  const nodeAt = i => i === LV.levels.length + 1 ? MERCHANT_AT : i === LV.levels.length ? TRAIN_AT : OW_NODES[i % OW_NODES.length];
  // The Bone Merchant and Sunset Training are two separate panels above the level path (not on it). AT is the ground point, centred.
  const OW_PANEL_W = 190, OW_PANEL_H = 150, OW_PANEL_Y = 64;
  const MERCHANT_AT = [165, OW_PANEL_Y + 126], TRAIN_AT = [475, OW_PANEL_Y + 126];
  const OW_PANEL_CENTER = { merchant: [MERCHANT_AT[0], OW_PANEL_Y + OW_PANEL_H / 2], training: [TRAIN_AT[0], OW_PANEL_Y + OW_PANEL_H / 2] };
  function openShop() {
    if (!UI) return;
    UI.open('shop', { msg: 'Spend your Leaves. Press B to leave.', back: () => { UI.close(); ignoreHeldButtons(); canvas.focus(); } });
  }
