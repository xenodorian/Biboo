// Level 4, Sunset Shore: one animated 640x512 sunset-sea painting (8 frames, the format of the level 1 layers: the 640x480 view plus a
// 16 row margin above and below) fixed to the screen sideways, and a sandy shore layer in the BACKGROUND (behind the sprites) that wraps
// every 640 px and scrolls with the world. Its sea foam line is at about row 404 of the 512 and Perry's feet stand on row 434, so the ground
// level is on the sand below the foam. Hand authored, not generated: it overrides the generated `shore` theme from bgs.js.
window.BIBOO.themes = window.BIBOO.themes || {};
window.BIBOO.themes.shore = {
  layers: [
    {
      src: 'assets/shore/bg_0.png',
      frames: [0, 1, 2, 3, 4, 5, 6, 7].map(i => 'assets/shore/bg_' + i + '.png'),
      ms: 140, fixedX: true, parallax: 1.0, shake: 0.3
    },
    { src: 'assets/shore/ground.png', parallax: 1.0, shake: 1.0 }
  ],
  fringe: null
};
