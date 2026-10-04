'use strict';
  window.bibooGame = {
    facing: () => cur ? cur.face : facing,
    beam: () => { const b = beamNow(); return b && { kind: b.kind, face: b.face, len: b.len, ox: b.ox, oy: b.oy }; },
    started, current: () => cur && { id: cur.id, k: cur.k, kind: cur.kind, y: fall ? fall.y : rootOf(cur)[1], air: !!cur.air }, x: () => x,
    playerX: () => playerX(),
    enemies: () => enemies.map(e => ({ type: e.type, x: e.x, face: e.face, state: e.state, anim: e.anim,
                                       scale: e.scale || 1, tint: e.tint && clock < e.tint.until ? e.tint.color : null })),
    kills: () => kills,
    hp: () => hp,
    meters: () => ({ energy: energyMeter, empower: empowerMeter, super: superMeter }),
    setMeters: (e, m, sp) => { energyMeter = e; empowerMeter = m; if (sp !== undefined) superMeter = sp; },
    gems: () => gems.map(gm => ({ x: gm.x, kind: gm.kind })),
    dropGem: (dx, kind) => spawnGem(bodyX() + dx, kind),
    enemyHp: () => enemies.map(e => e.hp),
    floaters: () => floaters.map(f => f.text),
    setEnemyHp: n => { hpOverride = n; },
    setHp: n => { if (n > maxHp()) P.state.maxes.hp = Math.min(P.MAX_CAP, n); hp = n; },      // test hook: asking for more than Max HP raises Max HP to match
    heavy: () => cur && (cur.id === 'heavy' || cur.id === 'jump_crash') ? { id: cur.id, lite: !!cur.lite, charged: cur.charged, height: cur.height } : null,
    herBox: () => herBox(),
    story: () => story ? { id: story.id, i: story.i } : null, skipStory: () => { if (story) storyEnd(); }, playStory: id => playStory(id, () => { paused = false; }),
    music: () => ({ want: window.BibooMusic ? BibooMusic.wanted : null, track: wantedTrack(), playing: window.BibooMusic ? BibooMusic.current : null, volume: window.BibooMusic ? BibooMusic.volume : 0 }),
    fx: () => ({ freeze, flashes: flashes.length, flash: !!screenFlash, shake: !!rumble }),
    powers: () => ({ flying: !!flight, rainbow: rainbowOn(), ult: !!ult, y: herY(), hp }),
    combat: () => ({ stun: !!stun, hits, blocks, parries, tint: tint && clock < tint.until ? tint.color : null }),
    setRespawn: on => { respawnOn = on; },
    attack: (i, anim) => { const e = enemies[i]; e.state = 'attack'; play(e, anim); },
    // state and controls for the browser tests of levels, unlocks, menus and the dev console
    state: () => ({ screen, paused, gameOver, levelDone, devOpen, hp, floorY, feet: herY(), px: playerX(), cheats: { ...cheats },
                    level: level ? { n: level.n, idx: level.idx, id: curMap && curMap.id } : null,
                    crates: curMap ? curMap.crates.map(c => ({ x: c.x, fy: c.fy, item: c.item, loot: c.loot, broken: c.broken })) : [],
                    powerups: powerups.map(u => ({ item: u.item, x: u.x, y: u.y })),
                    foes: enemies.map(e => ({ type: e.type, x: e.x, fy: e.fy, anim: e.anim, taunted: !!e.taunted, jumping: !!e.jump, hp: e.hp, state: e.state, alive: alive(e), path: e.path, dir: e.dir })),
                    solids: curMap ? curMap.solids : [], plats: curMap ? curMap.plats : [], pits: curMap ? curMap.pits : [], bombs: curMap ? curMap.bombs.map(b => ({ x: b.x, fy: b.fy, gone: b.gone })) : [], shots: shots.map(q => ({ x: q.x, y: q.y, vx: q.vx, vy: q.vy, from: q.from })), pitFall: !!pitFall, feetNow: herY(), fx: { gems: gems.length } }),
    ankhs: () => P.state.ankhs, setAnkhs: n => { P.state.ankhs = n; }, moveRows: () => moveRows(), enterLevel: n => enterLevel(n), warp: idx => { loadMap(idx, 'left'); }, setX: v => { x = v; }, goOverworld: () => goOverworld(),
    menuOpen: () => !!(UI && UI.isOpen()),
    charging: () => ({ cur: cur && cur.id, kind: cur && cur.kind, chargeMs: Math.round(chargeMs), full: isCharged(), energy: Math.round(energyMeter * 10) / 10, power: cur && cur.power, hold: hold && hold.move }),
    beamStats: () => ({ cost: { ...BEAM_TICK_COST }, dmg: { ...BEAM_DMG } }),
    doorOpen: () => doorOpen(),
    unlockLines: id => unlockLines(P.byId[id]), banners: () => banners.map(b => ({ title: b.title, sub: b.sub })),
    unlock: id => unlockItem(id), resetAll: () => { P.reset(); energyMeter = empowerMeter = superMeter = 0; refreshUnlocks(); },
    // the old combat tests: everything unlocked, one closed map with no scenery, enemies as the test places them
    // a one-map level built from the given data (plats, pits, bombs, crates, enemies), doors closed, for the hazard tests
    enterTraining: () => enterTraining(), training: () => ({ ...train, tip: TIPS[Math.floor((clock - train.t0) / 8500) % TIPS.length], on: !!(level && level.def.training) }),
    custom: md => {
      startLevel(0, { n: 0, name: 'Test', blurb: '', tint: null, maps: [Object.assign({ id: 'test', solids: [], plats: [], pits: [], bombs: [], crates: [], enemies: [], arena: true }, md)] });
      respawnOn = false; paused = false; hideMenu();
    },
    addShot: (sx, sy, vx, vy) => shots.push({ x: sx, y: sy, vx, vy, from: 'foe', t0: clock }),
    spawnMage: x => spawn('firemage', x), mageBlasts: () => mageBlasts.length,
    maxHp: () => maxHp(), addGem: (kind, x, fy) => spawnGem(x, kind, fy || 0), lootPool: () => lootPool(),
    doubleUsed: () => dblUsed, spinning: () => !!(cur && cur.spin && clock - cur.spin < SPIN_MS),
    smash: i => { if (curMap && curMap.crates[i]) breakCrate(curMap.crates[i]); },
    setFloor: v => { floorY = v; prevFeet = null; },
    shove: (i, dx) => { const e = enemies[i]; if (e) { e.x += dx; e.base += dx; e.shoved = clock; } },
    maxes: () => ({ energy: maxOf('energy'), empower: maxOf('empower'), super: maxOf('super') }),
    arena: () => {
      unlockEverything();
      startLevel(0, { n: 0, name: 'Arena', blurb: '', tint: null, maps: [{ id: 'arena', solids: [], plats: [], crates: [], enemies: [], arena: true }] });
      respawnOn = true; paused = false; hideMenu();
    },
    hurtFoe: (i, dmg) => { if (enemies[i]) hurtEnemy(enemies[i], dmg); }, killFoe: i => { if (enemies[i]) kill(enemies[i]); },
    hurtHer: d => hurtHer(d), gemBag: () => ({ ...P.state.gems }), pickups: () => gems.map(g => ({ x: g.x, kind: g.kind })),
    // test setup: clear the field and place enemies at distances from her anchor
    setEnemies: list => {
      enemies.length = 0; respawns.length = 0; facing = 1; hp = maxHp();
      for (const [type, dx, rest] of list) {                  // rest: stand still this long first (ms)
        const e = spawn(type, playerX() + dx);
        if (rest) { e.state = 'idle'; e.rest = rest; play(e, 'idle'); }
      }
    },
  };
