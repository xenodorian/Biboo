// Level 5, Mire Wood: one still 640x512 dark red forest painting (the format of the level 1 layers: the 640x480 view plus a 16 row margin
// above and below) fixed to the screen sideways, and a dark red pixel-art grass foreground drawn in front of the sprites. The grass wraps
// every 640 px and scrolls with the world. There is no floor tile: the floor is implied. Hand authored, not generated: it overrides the
// generated `mire` theme from bgs.js.
window.BIBOO.themes = window.BIBOO.themes || {};
window.BIBOO.themes.mire = {
  layers: [
    { src: 'assets/mire/bg.png', fixedX: true, parallax: 1.0, shake: 0.3 }
  ],
  fringe: 'assets/mire/fg.png'
};
