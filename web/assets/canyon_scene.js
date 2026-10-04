// Level 3, Sunstone Canyon: one still 640x512 canyon painting (the format of the level 1 layers: the 640x480 view plus a 16 row margin above
// and below) fixed to the screen sideways, and a pebble ground drawn as the FOREGROUND, in front of the sprites. The ground wraps every 640 px
// and scrolls with the world. Its top edge is about row 432 of the 512 and Perry's feet stand on row 434, so she is 2 px below the top of the
// ground, with the ground in front of her. Hand authored, not generated: it overrides the generated `canyon` theme from bgs.js.
window.BIBOO.themes = window.BIBOO.themes || {};
window.BIBOO.themes.canyon = {
  layers: [
    { src: 'assets/canyon/bg.png', fixedX: true, parallax: 1.0, shake: 0.3 }
  ],
  fringe: 'assets/canyon/ground.png'
};
