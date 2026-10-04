// Sunset Training: one still 640x512 synthwave painting (the format of the level 1 layers: the 640x480 view plus a 16 row margin above and
// below) fixed to the screen sideways. The grid floor is part of the picture, so there is no floor tile and no foreground layer; the floor
// is implied at Perry's usual ground row (434 of the 512). Replaces the generated `training` theme from bgs.js (the old training_*.png layers
// are no longer used and the earlier `fit` option is not needed). Hand authored, loaded after bgs.js.
window.BIBOO.themes = window.BIBOO.themes || {};
window.BIBOO.themes.training = {
  layers: [
    { src: 'assets/training/bg.png', fixedX: true, parallax: 1.0, shake: 0.3 }
  ],
  fringe: null
};
