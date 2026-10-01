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
  // Shadows: L says which way the light falls. sx leans the shadow sideways with height (+ right), sy lays it toward the viewer (+) or away (-),
  // a is its darkness. steps: tread lines (screen y, nearest first) a shadow is stepped up across, stepDy px per tread. clip: the ground polygon the
  // shadow may fall on (it is cut at a cliff edge). Sunset island: the sun sits low on the right, so the shadow runs long to the left and front.
  const LOW_SUN = { sx: -1.3, sy: 0.3, a: 1.0, col: '#14041c', clip: [[0, 148], [150, 148], [160, 184], [168, 200], [182, 216], [0, 216]] };
  const SC = {
    calm:     { pan: 0,    x: 205, gy: 188, s: 1.0, L: { sx: 0.8, sy: 0.28, a: 1.0, col: '#050d08' } },     // the path at the foot of the meadow
    fire:     { pan: 0.8,  x: 78,  gy: 194, s: 0.95, twinX: 338, twinGy: 190, L: { sx: -1.0, sy: 0.28, a: 1.0, col: '#0a0000', flick: true } },   // the dark lawn in front of the burning house
    crowd:    { pan: 0.5,  gy: 188, s: 0.95, L: { sx: 0.8, sy: 0.28, a: 1.0, col: '#050d08' } },
    sea:      { pan: 0.35, boatX: 268, boatY: 185 },        // open water, raised so the bow stays clear of the shore
    double:   { pan: 0.5,  x: 96,  gy: 190, s: 1.1, twinX: 306, twinGy: 194, L: { sx: 0.9, sy: 0.25, a: 1.0, col: '#01030a' } },  // the flagstone yard
    altar:    { pan: 0.5,  x: 236, gy: 181, s: 0.8,
                L: { sx: 0.45, sy: -0.4, a: 1.0, col: '#000008', steps: [181, 172, 164, 156, 148, 141, 133, 125], stepDy: 3 } },       // the foot of the temple stairs
    rewind:   { pan: 0.35 },
    meditate: { pan: 0,    x: 104, gy: 178, s: 0.95, L: LOW_SUN },      // the grassy cliff
    sunrise:  { pan: 0,    x: 104, gy: 178, s: 0.95, L: LOW_SUN },
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

  // A silhouette of one sprite frame in one colour, cached.
  const _sil = {};
  function silhouette(key, im, sx0, sy0, sw, sh, w, h, col) {
    const k = key + col;
    if (_sil[k]) return _sil[k];
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
    x.drawImage(im, sx0, sy0, sw, sh, 0, 0, w, h);
    x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, w, h);
    return (_sil[k] = c);
  }
  const _scratch = document.createElement('canvas'); _scratch.width = 384; _scratch.height = 216;
  // Cast a shadow of the silhouette (drawn at dx, dy, standing on groundY) along the light L, laid flat on the ground.
  function castShadow(sil, dx, dy, groundY, L, alpha) {
    const sx = L.sx + (L.flick ? Math.sin(clock * 0.011) * 0.15 : 0), sy = L.sy;
    const lay = c => { c.setTransform(1, 0, -sx, -sy, sx * groundY, groundY * (1 + sy)); c.drawImage(sil, dx, dy); c.setTransform(1, 0, 0, 1, 0, 0); };
    g.save();
    g.globalAlpha = (L.a || 0.35) * (alpha == null ? 1 : alpha);
    if (L.clip) { g.beginPath(); L.clip.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); g.clip(); }   // cut off at a cliff edge
    if (L.steps) {                                                // stairs: each tread the shadow climbs lifts it a little, in a hard step
      const c = _scratch.getContext('2d'); c.clearRect(0, 0, 384, 216); c.imageSmoothingEnabled = false; lay(c);
      const ys = L.steps;
      for (let k = 0; k < ys.length; k++) {
        const top = k + 1 < ys.length ? ys[k + 1] : 0, bot = k === 0 ? 216 : ys[k];   // the rows between tread k+1 and tread k
        const sh = bot - top; if (sh <= 0) continue;
        g.drawImage(_scratch, 0, top, 384, sh, 0, top - k * (L.stepDy || 3), 384, sh);
      }
    } else lay(g);
    g.restore();
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
    if (o.L) castShadow(silhouette('idle' + fr + ':' + s.toFixed(3), im, fr * IDLE_CW, 0, IDLE_CW, IDLE_CH, Math.round(IDLE_CW * s), Math.round(IDLE_CH * s), o.L.col), dx, dy, Y + (o.sit ? 10 * s : 0), o.L, o.alpha);
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
    if (o.L) castShadow(silhouette('twin' + fr + ':' + s.toFixed(3), im, fr * MM_CW, 0, MM_CW, MM_CH, Math.round(MM_CW * s), Math.round(MM_CH * s), o.L.col), dx, dy, Y + (o.sit ? 12 * s : 0), o.L, o.alpha);
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
      drawMax(c.x, c.gy, { s: c.s, L: c.L });
    }
    else if (sc === 'fire') {
      g.fillStyle = 'rgba(255,80,20,' + (0.08 + 0.06 * Math.sin(T * 0.01)) + ')';
      g.fillRect(0, 0, W, H);
      drawMax(c.x, c.gy, { s: c.s, L: c.L });
      drawTwin(c.twinX, c.twinGy, { s: c.s, L: c.L });
    }
    else if (sc === 'crowd') {
      drawMax(60 + ((T * 0.05) % 260), c.gy, { s: c.s, L: c.L });
    }
    else if (sc === 'sea') {                                        // Perry rows toward the island in her boat, rocking on the swell
      const boat = img['assets/story/view/boat.png'] && img['assets/story/view/boat.png'].im;
      const bob = Math.sin(T * 0.003) * 2, tilt = Math.sin(T * 0.0021) * 0.025;
      if (boat) {                                                   // her reflection first: the boat mirrored in the water, rippled and fading with depth
        const left0 = c.boatX - 75, bw = boat.width, bh = boat.height, hb = bh - 5, hull = c.boatY + 4 + bob - 5;   // mirrored about the keel, so it touches the hull
        g.save();
        for (let r = 0; r < hb; r++) {
          const depth = r / hb, off = Math.round(Math.sin(r * 0.9 + T * 0.004) * (0.4 + depth * 2.6));
          g.globalAlpha = Math.min(1, 1.0 * (1 - depth * 0.85) * (Math.sin(r * 1.7 + T * 0.006) > -0.5 ? 1 : 0.6));
          g.drawImage(boat, 0, hb - r, bw, 1, left0 + off, Math.round(hull + r), bw, 1);
        }
        g.restore();
      }
      if (boat) {                                                   // half size, kept on the same bottom left corner it had at full size
        const left = c.boatX - 75, bottom = c.boatY + 4;
        g.save(); g.translate(Math.round(left + boat.width / 2), Math.round(bottom - boat.height / 2 + bob)); g.rotate(tilt);
        g.drawImage(boat, -Math.round(boat.width / 2), -Math.round(boat.height / 2));
        g.restore();
      }
    }
    else if (sc === 'double') {
      drawMax(c.x, c.gy, { s: c.s, L: c.L });
      const a = 0.5 + 0.4 * Math.sin(T * 0.012);
      drawTwin(c.twinX, c.twinGy, { s: c.s, sit: true, alpha: a, L: c.L });
      for (let i = 0; i < 14; i++) {
        g.fillStyle = '#ff5060';
        g.fillRect(c.twinX - 20 + (i * 7) % 40, c.twinGy - 20 - ((T * 0.03 + i * 17) % 70), 2, 2);
      }
    }
    else if (sc === 'altar') {
      const gl = 0.15 + 0.12 * Math.sin(T * 0.004);
      g.fillStyle = `rgba(255,230,140,${gl})`;
      g.fillRect(c.x - 34, c.gy - 72, 68, 52);
      drawMax(c.x, c.gy, { s: c.s, L: c.L });
    }
    else if (sc === 'rewind') {
      g.globalAlpha = 0.15 + 0.1 * Math.sin(T * 0.008);
      g.fillStyle = '#fff';
      g.fillRect(0, 0, W, H);
      g.globalAlpha = 1;
    }
    else if (sc === 'meditate') {
      drawMax(c.x, c.gy, { s: c.s, sit: true, L: c.L });
      for (let i = 0; i < 14; i++) {
        g.fillStyle = i % 3 ? '#e8fff4' : '#a8e8ff';
        g.fillRect(c.x - 40 + (i * 13) % 90, c.gy - ((T * 0.025 + i * 23) % 120), 2, 2);
      }
    }
    else {
      drawMax(c.x, c.gy, { s: c.s, L: c.L });
      figure(c.x - 52, c.gy + 2, '#b89a7a');                      // on the grass beside her, not out over the cliff
      figure(c.x - 74, c.gy + 2, '#7a6a9a', { s: 0.8 });
    }
  }
