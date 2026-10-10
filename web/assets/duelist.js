// Percy, from BeelzSpriteAnim @ 1254493. The sheet cells are 132x200. He is drawn 100px tall.
// The energy burst uses that same scale, then its thickness is 10% of the height it has at that scale.
// The slash hit box is that thinner burst. 0 idle, 1-6 walk, 7-9 block-in, 10-11 recover, 12-16 slash, 17-19 jump.
(function () {
  const TALL = 100;
  const SCALE = TALL / 200;
  const fromSrc = TALL / 730;
  const scaledH = 340 * fromSrc;
  const thick = scaledH * 0.1;
  const burstW = 960 * fromSrc;
  const above = (189 / 200 * 730 - (0.397 * 730 + 17)) * fromSrc;
  const HIT = [-(burstW / 2) / SCALE, (above - thick / 2) / SCALE, (burstW / 2) / SCALE, (above + thick / 2) / SCALE];
  const H = [-28, 0, 26, 178];
  const ms = [400, 120, 120, 120, 120, 120, 120, 50, 50, 80, 50, 50, 50, 50, 100, 100, 50, 50, 50, 80];
  const frames = ms.map((t, i) => ({ src: i, ms: t, hurt: H, hit: (i === 14 || i === 15) ? HIT : null, ground: 0 }));
  window.BIBOO.enemies = window.BIBOO.enemies || {};
  window.BIBOO.enemies.duelist = {
    title: 'Percy', sheet: 'assets/duelist/sheet.png', cell: [132, 200], anchor: [66, 189],
    frames,
    anims: {
      idle: { frames: [0], loop: true },
      walk: { frames: [1, 2, 3, 4, 5, 6], loop: true },
      blockIn: { frames: [7, 8, 9], loop: false },
      block: { frames: [9], loop: true },
      slash: { frames: [12, 13, 8, 14, 15, 11, 16], loop: false },
      up: { frames: [17, 18, 19], loop: false },
      upHold: { frames: [19], loop: true }
    },
    ai: { prop: true, duelist: true, hp: 9999, dmg: 50, speed: 0, reach: 90, attacks: ['slash'],
          rest: [400, 400], stun: 'block', knock: [40, 220], parried: [0, 0],
          atk: { slash: { dmg: 50, knock: [40, 220] } } }
  };
  window.BIBOO.duelist = {
    scale: SCALE,
    energy: { src: 'assets/duelist/energy.png', cell: [212, 75], frames: 3, w: burstW, h: thick, above }
  };
})();
