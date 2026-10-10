// Percy, from BeelzSpriteAnim @ 1254493. The HD frames are 480x730.
// This sheet is those frames scaled once to 150px tall and drawn 1:1. Not flipped. Not a resize of the old 200px sheet.
// The energy burst is the HD beam scaled once the same way, doubled in width and thickness, and 5px below its spot on his body.
(function () {
  const TALL = 150;
  const SCALE = 1;
  const fromSrc = TALL / 730;
  const thick = Math.round(340 * fromSrc * 0.1 * 2);
  const burstW = Math.round(960 * fromSrc * 2);
  const above = (189 / 200 * 730 - (0.397 * 730 + 17)) * fromSrc - 5;
  const HIT = [-(burstW / 2) / SCALE, (above - thick / 2) / SCALE, (burstW / 2) / SCALE, (above + thick / 2) / SCALE];
  const H = [-21, 0, 20, 134];
  const ms = [400, 120, 120, 120, 120, 120, 120, 50, 50, 80, 50, 50, 50, 50, 100, 100, 50, 50, 50, 80];
  const frames = ms.map((t, i) => ({ src: i, ms: t, hurt: H, hit: (i === 14 || i === 15) ? HIT : null, ground: 0 }));
  window.BIBOO.enemies = window.BIBOO.enemies || {};
  window.BIBOO.enemies.duelist = {
    title: 'Percy', sheet: 'assets/duelist/sheet.png', cell: [99, 150], anchor: [50, 139],
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
    energy: { src: 'assets/duelist/energy.png', cell: [395, 14], frames: 3, w: burstW, h: thick, above }
  };
})();
