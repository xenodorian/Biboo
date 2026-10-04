// Level 3, Sunstone Canyon: one still 640x512 canyon painting (the format of the level 1 layers: the 640x480 view plus a 16 row margin above
// and below) fixed to the screen sideways, and a tiled stone ground layer that scrolls with the world and acts as the floor. Its top edge
// is row 432 of the 512, just above the row where Perry's feet stand (418 + 16). No foreground layer.
// Hand authored, not generated: it overrides the generated `canyon` theme from bgs.js.
window.BIBOO.themes = window.BIBOO.themes || {};
window.BIBOO.themes.canyon = {
  layers: [
    { src: 'assets/canyon/bg.png', fixedX: true, parallax: 1.0, shake: 0.3 },
    { src: 'assets/canyon/ground.png', parallax: 1.0, shake: 1.0 }
  ],
  fringe: null
};
