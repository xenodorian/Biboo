'use strict';
  // ---- the story: a prologue before level 1, Mirror Perry's confession when she falls, and the ending after the last level.
  // Each page is a full-screen scene: a 384x216 faux-pixel background (generated photo, sized down to 240p then nearest-neighbor)
  // with Perry's real idle sprite and Mirror Max (the enemy sheet) drawn on top. imageSmoothingEnabled stays off so pixels stay crisp.
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

  const IDLE_SRC = 'assets/moves/idle.png';
  const IDLE_CW  = 132, IDLE_CH = 93, IDLE_AX = 40, IDLE_AY = 91;      // the anchor is the middle of her boots
  const MM_SRC = 'assets/enemies/mirrormax.png';
  const MM_CW = 250, MM_CH = 176, MM_AX = 160, MM_AY = 172;

  // Where Perry stands in each scene, picked from the pictures: pan (0 left .. 1 right) says which part of the wide picture shows,
  // x and gy are where her feet go (gy is the ground line in that picture), s her size there (nearer ground, bigger).
  const SC = {
    calm:     { pan: 0,    x: 205, gy: 198, s: 1.05 },     // the path at the foot of the meadow
    fire:     { pan: 0.8,  x: 78,  gy: 202, s: 1.0, twinX: 338, twinGy: 204 },   // the dark lawn in front of the burning house
    crowd:    { pan: 0.5,  gy: 198, s: 0.95 },
    sea:      { pan: 0.35, boatX: 268, boatY: 170 },        // open water, raised so the bow stays clear of the shore
    double:   { pan: 0.5,  x: 96,  gy: 202, s: 1.15, twinX: 306, twinGy: 206 },  // the flagstone yard
    altar:    { pan: 0.5,  x: 236, gy: 180, s: 0.8 },       // the foot of the temple stairs
    rewind:   { pan: 0.35 },
    meditate: { pan: 0,    x: 104, gy: 178, s: 0.95 },      // the grassy cliff
    sunrise:  { pan: 0,    x: 104, gy: 178, s: 0.95 },
  };
  function drawStoryBg(name) {
    const im = img['story:' + name] && img['story:' + name].im;
    g.imageSmoothingEnabled = false;
    if (im) {                                                       // the picture is 216 px tall and wider than the view: show the part the scene wants
      const range = Math.max(0, im.width - V.w), u = (SC[name] || {}).pan || 0;
      g.drawImage(im, -Math.round(range * u), 0, im.width, V.h);
    }
    else { g.fillStyle = '#100818'; g.fillRect(0, 0, V.w, V.h); }
  }

  // Perry: real idle sprite, feet at (X, Y). Optional sit lowers her a little.
  function drawMax(X, Y, o) {
    o = o || {};
    const im = img[IDLE_SRC] && img[IDLE_SRC].im;
    if (!im) return;
    const s = o.s || 1.15;
    const fr = (o.frame != null ? o.frame : Math.floor(clock / 280) % 4);
    const dx = Math.round(X - IDLE_AX * s);
    const dy = Math.round(Y - IDLE_AY * s + (o.sit ? 10 * s : 0));
    g.save();
    if (o.alpha != null) g.globalAlpha = o.alpha;
    if (o.flip) { g.translate(Math.round(X), 0); g.scale(-1, 1); g.translate(-Math.round(X), 0); }
    g.imageSmoothingEnabled = false;
    g.drawImage(im, fr * IDLE_CW, 0, IDLE_CW, IDLE_CH, dx, dy, Math.round(IDLE_CW * s), Math.round(IDLE_CH * s));
    g.restore();
  }

  // Evil twin: Mirror Max sheet (already faces left), not a color invert.
  function drawTwin(X, Y, o) {
    o = o || {};
    const im = img[MM_SRC] && img[MM_SRC].im;
    if (!im) return;
    const s = o.s || 0.72;
    const fr = o.frame != null ? o.frame : Math.floor(clock / 280) % 4;
    const dx = Math.round(X - MM_AX * s);
    const dy = Math.round(Y - MM_AY * s + (o.sit ? 12 * s : 0));
    g.save();
    if (o.alpha != null) g.globalAlpha = o.alpha;
    g.imageSmoothingEnabled = false;
    g.drawImage(im, fr * MM_CW, 0, MM_CW, MM_CH, dx, dy, Math.round(MM_CW * s), Math.round(MM_CH * s));
    g.restore();
  }

  const figure = (X, Y, col, o) => {
    o = o || {}; const s = o.s || 1;
    g.fillStyle = col;
    if (o.sit) { g.fillRect(X - 4 * s, Y - 6 * s, 8 * s, 6 * s); g.fillRect(X - 3 * s, Y - 14 * s, 6 * s, 8 * s); g.fillRect(X - 3 * s, Y - 20 * s, 6 * s, 6 * s); }
    else { g.fillRect(X - 3 * s, Y - 7 * s, 2 * s, 7 * s); g.fillRect(X + s, Y - 7 * s, 2 * s, 7 * s); g.fillRect(X - 3 * s, Y - 16 * s, 6 * s, 9 * s); g.fillRect(X - 3 * s, Y - 22 * s, 6 * s, 6 * s); }
  };

  function drawStory() {
    const sc = story.pages[story.i][0], W = V.w, H = V.h, T = clock, c = SC[sc] || SC.sunrise;
    g.imageSmoothingEnabled = false;
    drawStoryBg(sc);

    if (sc === 'calm') {
      drawMax(c.x, c.gy, { s: c.s });
    }
    else if (sc === 'fire') {
      g.fillStyle = 'rgba(255,80,20,' + (0.08 + 0.06 * Math.sin(T * 0.01)) + ')';
      g.fillRect(0, 0, W, H);
      drawMax(c.x, c.gy, { s: c.s });
      drawTwin(c.twinX, c.twinGy, { s: 0.7 });
    }
    else if (sc === 'crowd') {
      drawMax(60 + ((T * 0.05) % 260), c.gy, { s: c.s });
    }
    else if (sc === 'sea') {                                        // Perry rows toward the island in her boat, rocking on the swell
      const boat = img['assets/story/view/boat.png'] && img['assets/story/view/boat.png'].im;
      const bob = Math.sin(T * 0.003) * 2, tilt = Math.sin(T * 0.0021) * 0.025;
      if (boat) {                                                   // half size, kept on the same bottom left corner it had at full size
        const left = c.boatX - 75, bottom = c.boatY + 4;
        g.save(); g.translate(Math.round(left + boat.width / 2), Math.round(bottom - boat.height / 2 + bob)); g.rotate(tilt);
        g.drawImage(boat, -Math.round(boat.width / 2), -Math.round(boat.height / 2));
        g.restore();
      }
    }
    else if (sc === 'double') {
      drawMax(c.x, c.gy, { s: c.s });
      const a = 0.5 + 0.4 * Math.sin(T * 0.012);
      drawTwin(c.twinX, c.twinGy, { s: 0.78, sit: true, alpha: a });
      for (let i = 0; i < 14; i++) {
        g.fillStyle = '#ff5060';
        g.fillRect(c.twinX - 20 + (i * 7) % 40, c.twinGy - 20 - ((T * 0.03 + i * 17) % 70), 2, 2);
      }
    }
    else if (sc === 'altar') {
      const gl = 0.15 + 0.12 * Math.sin(T * 0.004);
      g.fillStyle = `rgba(255,230,140,${gl})`;
      g.fillRect(c.x - 34, c.gy - 72, 68, 52);
      drawMax(c.x, c.gy, { s: c.s });
    }
    else if (sc === 'rewind') {
      g.globalAlpha = 0.15 + 0.1 * Math.sin(T * 0.008);
      g.fillStyle = '#fff';
      g.fillRect(0, 0, W, H);
      g.globalAlpha = 1;
    }
    else if (sc === 'meditate') {
      drawMax(c.x, c.gy, { s: c.s, sit: true });
      for (let i = 0; i < 14; i++) {
        g.fillStyle = i % 3 ? '#e8fff4' : '#a8e8ff';
        g.fillRect(c.x - 40 + (i * 13) % 90, c.gy - ((T * 0.025 + i * 23) % 120), 2, 2);
      }
    }
    else {
      drawMax(c.x, c.gy, { s: c.s });
      figure(c.x + 64, c.gy + 2, '#b89a7a');
      figure(c.x + 86, c.gy + 2, '#7a6a9a', { s: 0.8 });
    }
  }
