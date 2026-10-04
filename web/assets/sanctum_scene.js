// Level 6, Moonlit Sanctum: one still 640x512 temple hall painting (the format of the level 1 layers: the 640x480 view plus a 16 row margin
// above and below) fixed to the screen sideways. No foreground layer and no floor tile: the floor is implied. Perry's feet stand on row 434
// of the 512 in the game, and the owner wants the ground 60 px above the bottom of the picture (row 452), so the picture is drawn 18 px
// higher (offsetY); the missing bottom rows are the picture's last row stretched, which is plain floor. Hand authored, not generated:
// it overrides the generated `sanctum` theme from bgs.js.
window.BIBOO.themes = window.BIBOO.themes || {};
window.BIBOO.themes.sanctum = {
  layers: [
    { src: 'assets/sanctum/bg.png', fixedX: true, offsetY: -18, parallax: 1.0, shake: 0.3 }
  ],
  fringe: null
};
