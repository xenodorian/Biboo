'use strict';
  // ---- hit feedback: a brief freeze on impact (hit-stop), a starburst and sparks where it lands, a screen flash and shake on big hits
  let freeze = 0, screenFlash = null, beamTick = false;
  const flashes = [];                                            // {wx, wy, t0, ms, r, c}: starbursts
  const hitStop = ms => { freeze = Math.min(160, Math.max(freeze, ms)); };
  const shakeFor = (ms, amp) => { if (!rumble || rumble.amp * (1 - (clock - rumble.t0) / rumble.ms) < amp) rumble = { t0: clock, ms, amp }; };
  function impact(wx, wy, dmg, color, killed) {
    const big = dmg >= 100 || killed, mid = dmg >= 30;
    flashes.push({ wx, wy, t0: clock, ms: big ? 260 : mid ? 200 : 150, r: big ? 26 : mid ? 18 : 12, c: color || '#fff6c0' });
    burst(wx, wy, big ? 16 : mid ? 10 : 6, [color || '#fff6c0', '#ffd24a', '#ffffff']);
    hitStop(big ? 130 : mid ? 80 : 45);
    if (big) { screenFlash = { c: '#ffffff', a: 0.4, t0: clock, ms: 120 }; shakeFor(220, 3); }
    else if (mid) shakeFor(140, 1.5);
  }
  function herHitFx() {                                          // she is hurt: a short freeze, a red flash, a shake and a red starburst
    hitStop(100); shakeFor(200, 2.5); screenFlash = { c: '#ff2020', a: 0.35, t0: clock, ms: 200 };
    flashes.push({ wx: bodyX(), wy: herY() + 22, t0: clock, ms: 220, r: 20, c: '#ff6060' });
  }
  function hurtEnemy(e, dmg) {
    if (!alive(e)) return;
    if (e.type === 'heavybag') { bagHit(e, dmg); return; }
    aggro(e, false);                                  // being hit wakes a patrolling enemy, even for 0 damage
    if (dmg <= 0) return;
    e.hp = Math.max(0, e.hp - dmg);
    const b = hurtOf(e);
    if (b) floater((b[0] + b[2]) / 2, b[3] + 4, '-' + dmg, RED);
    if (!e.tint || clock >= e.tint.until) e.tint = { color: RED, alpha: 0.55, until: clock + 110 };
    if (b && !beamTick) impact((b[0] + b[2]) / 2, (b[1] + b[3]) / 2, dmg, null, e.hp <= 0);
    if (e.hp <= 0) kill(e);
  }
  const cheats = { invincible: false, infinite: false, nopit: false };   // set from the Cheats menu (L1+R1+L2+R2 in the pause menu reveals it)
  let cheatsShown = false;
  function hurtHer(dmg) {
    if (dmg <= 0 || cheats.invincible || rainbowOn()) return;
    hp = Math.max(0, hp - dmg);
    floater(bodyX(), herY() + herTop() + 6, '-' + dmg, RED);
  }
  function stepHeal(dt) {
    stepGems(dt);
    if (cur && cur.id === 'charge' && cur.kind === 'hold' && !stun) {
      if (metersHeld()) {                                          // L1+R1: ENG, EMP and SUP each fill by 1 per tick
        meterAcc += dt;
        while (meterAcc >= METER_CHARGE_TICK) {
          meterAcc -= METER_CHARGE_TICK;
          energyMeter = Math.min(maxOf('energy'), energyMeter + METER_CHARGE_STEP);
          empowerMeter = Math.min(maxOf('empower'), empowerMeter + METER_CHARGE_STEP);
          superMeter = Math.min(maxOf('super'), superMeter + METER_CHARGE_STEP);
        }
      } else if (!hold || ENERGY_HOLD.has(hold.move)) stepCharge(dt);
    } else meterAcc = 0;
    if (!cur || cur.id !== 'recover' || cur.kind !== 'hold' || stun || hp >= maxHp()) { healAcc = 0; return; }
    healAcc += dt;
    while (healAcc >= HEAL_EVERY && hp < maxHp() && empowerMeter >= HEAL_COST) {
      healAcc -= HEAL_EVERY;
      empowerMeter = Math.max(0, empowerMeter - HEAL_COST);
      const n = Math.min(HEAL_AMOUNT, maxHp() - hp);
      hp += n;
      floater(bodyX(), herY() + herTop() + 6, '+' + n, GREEN);
    }
  }
