// The duelist from BeelzSpriteAnim @ 1254493. Sheet cells are 132x200, mirrored to face left like the other enemies.
// 0 idle, 1-6 the forward walk, 7-9 block-in (holds on 9), 10-11 block recover, 12-16 the slash, 17-19 the up-arrow jump.
(function () {
  const H = [-28, 0, 26, 178];
  const HIT = [-118, 58, 8, 142];
  const ms = [400, 120, 120, 120, 120, 120, 120, 50, 50, 80, 50, 50, 50, 50, 100, 100, 50, 50, 50, 80];
  const frames = ms.map((t, i) => ({ src: i, ms: t, hurt: H, hit: (i === 14 || i === 15) ? HIT : null, ground: 0 }));
  window.BIBOO.enemies = window.BIBOO.enemies || {};
  window.BIBOO.enemies.duelist = {
    title: 'Duelist', sheet: 'assets/duelist/sheet.png', cell: [132, 200], anchor: [66, 189],
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
    ai: { prop: true, duelist: true, hp: 9999, dmg: 18, speed: 0, reach: 90, attacks: ['slash'],
          rest: [400, 400], stun: 'block', knock: [0, 0], parried: [0, 0] }
  };
  window.BIBOO.duelist = { energy: { src: 'assets/duelist/energy.png', cell: [220, 28], frames: 3 } };
})();
