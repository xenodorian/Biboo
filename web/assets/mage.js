// Fire mage: a stationary caster. Its sheet (`assets/mage/mage.png`) has 17 cells of 241x160, already mirrored to face left like the other
// enemies: cells 0 to 7 the fireball cast, 8 to 10 hurt, 11 to 16 death. The cast is played as 0,1,2,3,2,3,2,3,4,5,6,7,6,7,6,5,4,3,2,1 at 150 ms
// a frame (see `mageStep` in game/23_mage.js): a reticle shows under Perry from the 2nd frame to the 11th, and the 12th frame explodes there.
// `window.BIBOO.mage` holds the reticle and the explosion art (100x96 cells, 15 frames, 60 ms each, scaled so the blast is about 100 px
// across, a 50 px radius). Hand authored, loaded after training.js and heavybag.js.
(function () {
  const hurt = [[-26, 0, 26, 131], [-26, 0, 26, 131], [-26, 0, 26, 131], [-26, 0, 26, 131], [-26, 0, 26, 130], [-26, 0, 26, 123], [-26, 0, 26, 124], [-26, 0, 26, 124], [-26, 0, 26, 102], [-26, 0, 26, 104], [-26, 0, 26, 102], [-26, 0, 26, 114], [-26, 0, 26, 112], [-26, 0, 26, 108], [-43, 0, 32, 88], [-60, 0, 47, 42], [-61, 0, 62, 22]];
  const ms = i => (i < 8 ? 150 : i < 11 ? 140 : i === 16 ? 700 : 150);
  window.BIBOO.enemies = window.BIBOO.enemies || {};
  window.BIBOO.enemies.firemage = {
    title: 'Fire mage', sheet: 'assets/mage/mage.png', cell: [241, 160], anchor: [120, 160],
    frames: hurt.map((h, i) => ({ src: i, ms: ms(i), hurt: h, hit: null, ground: 0 })),
    anims: {
      idle: { frames: [0], loop: true }, walk: { frames: [0], loop: true },
      fireball: { frames: [0, 1, 2, 3, 2, 3, 2, 3, 4, 5, 6, 7, 6, 7, 6, 5, 4, 3, 2, 1], loop: false },
      hurt: { frames: [8, 9, 10], loop: false },
      death: { frames: [11, 12, 13, 14, 15, 16], loop: false }
    },
    ai: { speed: 0, reach: 0, attacks: [], rest: [1500, 2500], death: 'death', stun: 'hurt', knock: [40, 300], parried: [40, 450], hp: 90, dmg: 0,
          mage: true, range: 460, atk: { fireball: { dmg: 50, knock: [40, 300] } } }
  };
  window.BIBOO.mage = {
    blast: { src: 'assets/mage/blast.png', cell: [100, 96], frames: 15, ms: 60, radius: 50, damage: 50, lift: 50 },
    reticle: { src: 'assets/mage/reticle.png', w: 100, h: 51 }
  };
})();
