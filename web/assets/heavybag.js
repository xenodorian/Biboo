// Sunset Training heavy bag: a 6 frame sheet (`assets/training/bag_anim.png`, 180x180 cells, the supplied 450x450 gif scaled exactly 0.4 so its
// 5 px art pixels are 2 px). Frame 0 is the idle bag. Frames 1 to 5 are the hit animation (spark on the left, swing right, settle), which
// the game plays at 100 ms a frame when the bag is hit from the left and mirrored when it is hit from the right (see bagHit in
// 06_training.js and the heavybag branch in 15_draw_scenery.js). Hand authored, loaded after training.js: it replaces the generated bag.
(function () {
  const hurt = [-24, 0, 24, 104];
  window.BIBOO.enemies = window.BIBOO.enemies || {};
  window.BIBOO.enemies.heavybag = {
    title: 'Heavy bag', sheet: 'assets/training/bag_anim.png', cell: [180, 180], anchor: [88, 126],
    frames: [0, 1, 2, 3, 4, 5].map(i => ({ src: i, ms: 100, hurt: hurt.slice(), hit: null, ground: 0 })),
    anims: { idle: { frames: [0], loop: true } },
    ai: { speed: 0, reach: 0, attacks: [], rest: [1000, 1000], knock: [0, 0], parried: [0, 0], hp: 1000000, dmg: 0, atk: {}, prop: true }
  };
})();
