// Percy, from BeelzSpriteAnim @ 1254493. The sheet cells are 132x200 (the 730px frames scaled down).
// He is drawn at `scale` so the original 340px-tall energy art plays at 75px tall. The slash hit box is that burst.
// 0 idle, 1-6 the forward walk, 7-9 block-in (holds on 9), 10-11 block recover, 12-16 the slash, 17-19 the up-arrow jump.
(function () {
  const BURST_H = 75, BURST_W = 212;
  const SCALE = (730 * BURST_H / 340) / 200;
  const above = (189 / 200 * 730 - (0.397 * 730 + 17)) * (BURST_H / 340);
  const HIT = [-(BURST_W / 2) / SCALE, (above - BURST_H / 2) / SCALE, (BURST_W / 2) / SCALE, (above + BURST_H / 2) / SCALE];
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
    energy: { src: 'assets/duelist/energy.png', cell: [212, 75], frames: 3, w: BURST_W, h: BURST_H, above }
  };
})();
