'use strict';
  // ---- the story: a prologue before level 1, Mirror Perry's confession when she falls, and the ending after the last level.
  // Each page is a full-screen scene drawn on the canvas with the text panel (the message menu) on top. "Skip story" ends it.
  const STORY = {
    prologue: [
      ['calm', 'Perry', 'Peregrine "Perry" Riposte was ten years old. She had a mom, a dad, and a little brother. The house was small and loud. It was home.'],
      ['fire', 'The Fire', 'One night the house went up in flames. Perry saw a figure on the lawn, lit by the fire. The figure looked exactly like her.'],
      ['fire', 'The Fire', 'Her parents and her little brother never came out.'],
      ['crowd', 'The Village', 'The village came running. They saw the smoke, and they saw Perry. "She did it," they said. Nobody would listen. Perry ran.'],
      ['sea', 'Miracle Island', 'She found a boat and sailed to Miracle Island. It is full of monsters. At its center lies the Legendary Wish Scroll, which can grant any wish.'],
      ['sea', 'Miracle Island', 'Perry gripped her sword. She would fight her way to the center.'],
    ],
    double: [
      ['double', 'Perry, fallen', 'The other Perry drops to one knee. Her body flickers like a candle in the wind.'],
      ['double', 'The Double', '"You still do not get it," she says. "I am not a stranger. I came from you."'],
      ['double', 'The Double', '"I was born from your magic and your worst feelings. I am every angry thought you ever had, with a body."'],
      ['double', 'The Double', '"You can beat me. It will not last. Unless you let your anger out in a healthy way, I will rise again."'],
      ['double', 'Perry', 'The double fades into red sparks. The way to the center of the island is open.'],
    ],
    ending: [
      ['altar', 'The Center', 'Perry walked on, past the last of the monsters, to the very center of the island.'],
      ['altar', 'The Scroll', 'Behind a ring of old stones lay the Legendary Wish Scroll. It glowed softly. Perry opened it. "Take me back," she said. "To before the fire."'],
      ['rewind', 'Back in Time', 'The world spun backward. Days and nights blurred past, until the sky settled on that last evening.'],
      ['calm', 'Home', 'Perry stood outside her house. Through the window she saw her mom, her dad, and her little brother, laughing at supper. They were alive. This was what her anger had burned down.'],
      ['calm', 'Home', 'All that hatred had never made her strong. It had only made her alone. It had hurt her far more than it ever helped.'],
      ['meditate', 'Perry', 'Perry sat down in the grass. She took a deep breath. In, and out. Again. She let the anger go a little at a time, until it floated away like smoke.'],
      ['sunrise', 'Perry', '"Holding on to anger is self-destructive," Perry said. "I have to appreciate what I have, before it is all gone."'],
      ['sunrise', 'THE END', 'Thank you for playing Perry Riposte.'],
    ],
  };
  let story = null, storyAt = null;
  function playStory(id, done) {
    story = { id, i: 0, pages: STORY[id], done };
    hold = null; queued = null; paused = true;
    storyPage();
  }
  function storyEnd() {
    const d = story && story.done; story = null; hideMenu(); ignoreHeldButtons();
    if (d) d();
  }
  function storyPage() {
    const pg = story.pages[story.i], last = story.i === story.pages.length - 1;
    UI.open('message', { story: true, title: pg[1], msg: pg[2], items: [
      { label: last ? 'Continue' : 'Next', primary: true, id: 'btn-start', fn: () => { if (last) storyEnd(); else { story.i++; storyPage(); } } },
      ...(last ? [] : [{ label: 'Skip story', fn: storyEnd }]),
    ] });
  }
  const figure = (X, Y, col, o) => {                            // a small standing or sitting figure with feet at (X, Y)
    o = o || {}; const s = o.s || 1;
    g.fillStyle = col;
    if (o.sit) { g.fillRect(X - 4 * s, Y - 6 * s, 8 * s, 6 * s); g.fillRect(X - 3 * s, Y - 14 * s, 6 * s, 8 * s); g.fillRect(X - 3 * s, Y - 20 * s, 6 * s, 6 * s); }
    else { g.fillRect(X - 3 * s, Y - 7 * s, 2 * s, 7 * s); g.fillRect(X + s, Y - 7 * s, 2 * s, 7 * s); g.fillRect(X - 3 * s, Y - 16 * s, 6 * s, 9 * s); g.fillRect(X - 3 * s, Y - 22 * s, 6 * s, 6 * s); }
    if (o.sword) { g.fillStyle = '#c8ccd8'; g.fillRect(X + 3 * s, Y - 22 * s, 2 * s, 14 * s); g.fillRect(X + s, Y - 12 * s, 6 * s, s); }
  };
  function drawStory() {
    const sc = story.pages[story.i][0], W = V.w, H = V.h, T = clock, gy = 140;
    const sky = (a, b) => { const gr = g.createLinearGradient(0, 0, 0, gy); gr.addColorStop(0, a); gr.addColorStop(1, b); g.fillStyle = gr; g.fillRect(0, 0, W, H); };
    const ground = c => { g.fillStyle = c; g.fillRect(0, gy, W, H - gy); };
    const house = (X, lit) => { g.fillStyle = '#4a3226'; g.fillRect(X, gy - 40, 70, 40); g.fillStyle = '#2c1c16'; g.beginPath(); g.moveTo(X - 6, gy - 40); g.lineTo(X + 35, gy - 68); g.lineTo(X + 76, gy - 40); g.fill(); g.fillStyle = lit ? '#ffd870' : '#2a2018'; g.fillRect(X + 10, gy - 28, 14, 12); g.fillRect(X + 46, gy - 28, 14, 12); };
    const flames = X => { for (let i = 0; i < 16; i++) { const fx = X - 4 + i * 5, fh = 14 + 12 * Math.abs(Math.sin(T * 0.008 + i * 1.7)) + (i % 3) * 5; g.fillStyle = i % 2 ? '#ff6a1a' : '#ffb02e'; g.beginPath(); g.moveTo(fx, gy - 8); g.lineTo(fx + 2.5, gy - 8 - fh * 1.6); g.lineTo(fx + 5, gy - 8); g.fill(); } g.fillStyle = 'rgba(255,120,40,0.18)'; g.fillRect(0, 0, W, H); };
    const stars = n => { g.fillStyle = '#fff'; for (let i = 0; i < n; i++) { const a = (i * 97) % W, b = (i * 53) % 110; g.globalAlpha = 0.5 + 0.5 * Math.sin(T * 0.003 + i); g.fillRect(a, b, 1, 1); } g.globalAlpha = 1; };
    const MAXC = '#c9b8ff';
    if (sc === 'calm') { sky('#1b2a52', '#e9a15a'); stars(30); ground('#2d4a2a'); house(150, true); figure(110, gy + 2, MAXC, { s: 1 }); }
    else if (sc === 'fire') { sky('#150a14', '#a63a14'); ground('#241a14'); house(150, false); flames(146); figure(100, gy + 4, MAXC); figure(270, gy + 4, '#8a1a2a'); }
    else if (sc === 'crowd') { sky('#0b0e1e', '#27223a'); stars(40); ground('#1b1a24'); g.fillStyle = '#ff9a3a'; for (let i = 0; i < 6; i++) { const fx = 40 + i * 60; g.fillRect(fx, gy - 22, 2, 14); g.globalAlpha = 0.6 + 0.4 * Math.sin(T * 0.01 + i); g.fillRect(fx - 1, gy - 28, 4, 6); g.globalAlpha = 1; } for (let i = 0; i < 6; i++) figure(30 + i * 28, gy + 6, '#3a3550'); figure(300 + ((T * 0.06) % 120), gy + 6, MAXC); }
    else if (sc === 'sea') { sky('#0d1a33', '#31527a'); stars(25); g.fillStyle = '#10264a'; g.fillRect(0, 120, W, H - 120); g.fillStyle = '#1b3a6a'; for (let i = 0; i < 24; i++) g.fillRect((i * 29 + T * 0.02) % W, 130 + (i * 11) % 80, 14, 1); g.fillStyle = '#0a0f14'; g.beginPath(); g.moveTo(200, 120); g.lineTo(250, 70); g.lineTo(285, 95); g.lineTo(320, 55); g.lineTo(384, 120); g.fill(); g.fillStyle = '#6b4a2a'; g.fillRect(60 + Math.sin(T * 0.002) * 4, 140, 34, 6); figure(76 + Math.sin(T * 0.002) * 4, 141, MAXC, { sword: true }); }
    else if (sc === 'double') { sky('#1a0610', '#6a1424'); ground('#1a0a10'); g.fillStyle = 'rgba(255,40,60,0.12)'; g.fillRect(0, 0, W, H); figure(120, gy + 6, MAXC, { sword: true, s: 1.4 }); g.globalAlpha = 0.6 + 0.3 * Math.sin(T * 0.012); figure(264, gy + 6, '#e33a4a', { sit: true, s: 1.4 }); g.globalAlpha = 1; for (let i = 0; i < 14; i++) { g.fillStyle = '#ff5060'; g.fillRect(250 + (i * 7) % 30, gy - 20 - ((T * 0.03 + i * 17) % 60), 2, 2); } }
    else if (sc === 'altar') { sky('#0c1a14', '#1f4a3a'); stars(10); ground('#16241c'); g.fillStyle = '#5a6a60'; for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; g.fillRect(192 + Math.cos(a) * 80 - 4, gy - 14 + Math.sin(a) * 6 - 20, 8, 22); } g.fillStyle = '#7a8a80'; g.fillRect(180, gy - 18, 24, 14); const gl = 0.5 + 0.4 * Math.sin(T * 0.004); g.fillStyle = `rgba(255,230,140,${gl})`; g.beginPath(); g.arc(192, gy - 28, 22, 0, 7); g.fill(); g.fillStyle = '#f4e4b0'; g.fillRect(186, gy - 26, 12, 8); figure(140, gy + 4, MAXC); }
    else if (sc === 'rewind') { g.fillStyle = '#0a0a1e'; g.fillRect(0, 0, W, H); for (let i = 0; i < 8; i++) { g.strokeStyle = `hsl(${(i * 40 + T * 0.1) % 360},70%,60%)`; g.lineWidth = 2; g.beginPath(); g.arc(192, 108, 14 + i * 12, -T * 0.004 * (i % 2 ? 1 : -1) * (1 + i * 0.2), -T * 0.004 * (i % 2 ? 1 : -1) * (1 + i * 0.2) + Math.PI * 1.4); g.stroke(); } g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.moveTo(192, 108); g.lineTo(192 + Math.cos(-T * 0.01) * 30, 108 + Math.sin(-T * 0.01) * 30); g.stroke(); }
    else if (sc === 'meditate') { sky('#16304a', '#7fc4a8'); ground('#2f5a38'); const gl = 0.25 + 0.15 * Math.sin(T * 0.003); g.fillStyle = `rgba(190,255,230,${gl})`; g.beginPath(); g.arc(192, gy - 20, 46, 0, 7); g.fill(); figure(192, gy + 2, MAXC, { sit: true, s: 1.5 }); for (let i = 0; i < 18; i++) { g.fillStyle = i % 3 ? '#e8fff4' : '#a8e8ff'; g.fillRect(150 + (i * 13) % 90, gy - ((T * 0.025 + i * 23) % 150), 2, 2); } }
    else { sky('#3a2a60', '#ffb870'); g.fillStyle = '#ffe9a0'; g.beginPath(); g.arc(192, 140 - Math.min(40, T * 0.01 % 60), 26, 0, 7); g.fill(); ground('#2f5a38'); house(250, true); figure(120, gy + 2, MAXC, {}); figure(150, gy + 4, '#b89a7a', {}); figure(172, gy + 4, '#7a6a9a', { s: 0.8 }); }
  }
