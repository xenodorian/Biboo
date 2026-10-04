// Level 2, Mossy Falls: one animated 640x512 painting (the same format as the level 1 layers: the 640x480 view plus a 16 row margin above
// and below) drawn behind the sprites, and one 640x512 foreground (the bush with the turtle climbing it) drawn in front of them.
// There is no floor tile: the ground is part of the painting and the floor is only implied. The picture is fixed to the screen
// sideways (fixedX) and follows the camera vertically. Hand authored, not generated: it overrides the generated `falls` theme from bgs.js.
window.BIBOO.themes = window.BIBOO.themes || {};
window.BIBOO.themes.falls = {
  fixedX: true,
  layers: [{
    src: 'assets/falls/bg_0.png',
    frames: [0, 1, 2, 3, 4, 5, 6, 7].map(i => 'assets/falls/bg_' + i + '.png'),
    ms: 140,
    parallax: 1.0,
    shake: 0.3
  }],
  fringe: 'assets/falls/fg.png'
};
