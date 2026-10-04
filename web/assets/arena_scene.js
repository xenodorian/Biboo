// Boss arena backgrounds in the 640x512 layer format (the 640x480 view plus a 16 row margin above and below), replacing the smaller ones:
//  - the four arenas that use one picture (fungal, crypt, bone, keep): each picture is the original story scene (assets/story/N_*.png)
//    scaled with nearest neighbour to 512 rows high and cropped to the centre 640 columns (assets/arenas512/still_*.png);
//  - the two layered arenas (ember, tide): every 384x232 layer scaled to 512 rows and cropped to 640 columns, same parallax and shake.
// Hand authored, not generated; loaded after story.js and bgs.js. The old arena and story files are no longer used for the arenas.
window.ARENA_STILLS = Object.assign(window.ARENA_STILLS || {}, {
  fungal: 'assets/arenas512/still_fungal.png',   // Wyrm Slug, level 1
  crypt: 'assets/arenas512/still_crypt.png',     // Ooze Wraith, level 2
  bone: 'assets/arenas512/still_bone.png',       // Horned Dread, level 3
  keep: 'assets/arenas512/still_keep.png'        // Mirror Perry, level 6
});
window.BIBOO.themes = window.BIBOO.themes || {};
Object.assign(window.BIBOO.themes, {"ember": {"layers": [{"src": "assets/arenas512/ember_sky.png", "parallax": 0.1, "shake": 0.25}, {"src": "assets/arenas512/ember_far.png", "parallax": 0.25, "shake": 0.4}, {"src": "assets/arenas512/ember_near.png", "parallax": 0.5, "shake": 0.65}, {"src": "assets/arenas512/ember_ground.png", "parallax": 1.0, "shake": 1.0}], "fringe": "assets/arenas512/ember_fringe.png"}, "tide": {"layers": [{"src": "assets/arenas512/tide_sky.png", "parallax": 0.1, "shake": 0.25}, {"src": "assets/arenas512/tide_far.png", "parallax": 0.25, "shake": 0.4}, {"src": "assets/arenas512/tide_near.png", "parallax": 0.5, "shake": 0.65}, {"src": "assets/arenas512/tide_ground.png", "parallax": 1.0, "shake": 1.0}], "fringe": "assets/arenas512/tide_fringe.png"}});
