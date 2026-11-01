/* WaForSpeed — Physique, collisions, quasi-contacts, checkpoints : une étape de jeu. */
'use strict';

/* ================= Mise à jour ================= */
function autopilot(dt) {
  autoTimer -= dt;
  if (autoTimer <= 0) {
    autoTimer = 0.4;
    let bestLane = autoTarget, bestGap = -1;
    for (const lx of LANE_X) {
      let gap = 9000;
      for (const c of cars) {
        if (Math.abs(c.offset - lx) > 0.3) continue;
        const dz = relZ(c.z - (position + PLAYER_Z));
        if (dz > -800 && dz < gap) gap = dz;
      }
      const g = gap + (lx === autoTarget ? 600 : 0);
      if (g > bestGap) { bestGap = g; bestLane = lx; }
    }
    autoTarget = bestLane;
  }
  const d = autoTarget - playerX;
  steer += (clamp(d * 3, -1, 1) - steer) * Math.min(1, dt * 6);
  playerX += clamp(d, -dt * 1.4, dt * 1.4);
}
function crash(car, dz) {
  const back = car ? Math.max(150, 800 - (dz || 0)) : 300;
  speed = car ? car.speed * 0.5 : MAX_SPEED / 6;
  position = wrap(position - back); dist = Math.max(0, dist - back);
  shake = reduceMotion ? 0 : 0.5; flash = 1;
  if (combo > 1) toast('Combo perdu', '', 'bad');
  combo = 0; comboTimer = 0;
  noiseHit(0.45, 180, 0.8, 0.9, 60);
  if (navigator.vibrate) { try { navigator.vibrate(80); } catch (e) {} }
}

function update(dt) {
  if (state === 'pause' || state === 'garage') return;
  const playing = state === 'play';
  const auto = state === 'menu' || state === 'over';
  const playerSeg = findSegment(position + PLAYER_Z);
  const speedPct = speed / MAX_SPEED;
  const dx = dt * 2.2 * PERF.handling * Math.min(speedPct, 1.1);

  if (mode === 'duel' && raceStartWall) trafficClock = (performance.now() - raceStartWall) / 1000 - 3;
  else trafficClock += dt;
  for (const car of cars) positionCar(car, trafficClock);

  position = wrap(position + dt * speed);
  dist += dt * speed;

  if (playing) {
    const left = input.left, right = input.right;
    if (left && !right) { playerX -= dx; steer = Math.max(-1, steer - dt * 6); }
    else if (right && !left) { playerX += dx; steer = Math.min(1, steer + dt * 6); }
    else steer += -steer * Math.min(1, dt * 8);
  } else if (auto) autopilot(dt);
  else steer += -steer * Math.min(1, dt * 4);
  playerX -= dt * 2 * Math.min(speedPct, 1.1) * Math.min(speedPct, 1.1) * playerSeg.curve * CENTRIFUGAL;

  nitroOn = playing && input.nitro && nitro > 0.01;
  if (nitroOn) nitro = Math.max(0, nitro - dt * PERF.nitroBurn);
  const top = MAX_SPEED * PERF.top * (nitroOn ? PERF.nitroMult : 1);
  const accelerating = playing && (input.up || isTouch) && !input.down;
  braking = playing && input.down;
  if (auto) speed = lerp(speed, MAX_SPEED * 0.62, Math.min(1, dt));
  else if (state === 'count') speed = 0;
  else if (braking) speed += BRAKE * dt;
  else if (accelerating) speed += ACCEL * PERF.acc * (nitroOn ? 2 : 1) * dt;
  else speed += DECEL * dt;
  if (speed > top) speed = Math.max(top, speed - MAX_SPEED * 0.5 * dt);

  if (Math.abs(playerX) > 1) {
    if (speed > OFF_LIMIT) speed += OFF_DECEL * dt;
    if (playing) for (const sp of playerSeg.sprites) {
      if (sp.collide && Math.abs(playerX - sp.offset) < sp.hit && speed > MAX_SPEED / 6) { crash(null); break; }
    }
  }
  if (Math.abs(playerX) > 1.7) { playerX = Math.sign(playerX) * 1.7; speed *= 1 - dt * 2; if (playing) shake = Math.max(shake, reduceMotion ? 0 : 0.12); }
  speed = clamp(speed, 0, MAX_SPEED * 1.6);

  const pz = position + PLAYER_Z;
  for (const car of cars) {
    const dz = relZ(car.z - pz);
    const lat = Math.abs(playerX - car.offset);
    if (playing) {
      if (lat < CAR_HIT && dz > -350 && dz < 760 && speed > car.speed) { crash(car, dz); car.prevDz = relZ(car.z - (position + PLAYER_Z)); continue; }
      if (car.prevDz > 0 && dz <= 0 && dz > -2000 && lat >= CAR_HIT && lat < NEAR_MISS && speed > MAX_SPEED * 0.5) {
        combo = comboTimer > 0 ? combo + 1 : 1; comboTimer = 3;
        const pts = 250 * combo; bonus += pts; nearCount++;
        nitro = Math.min(1, nitro + PERF.nitroGain);
        toast(combo > 1 ? `Quasi-contact ×${combo}` : 'Quasi-contact', '+' + pts);
        noiseHit(0.28, 900, 1.2, 0.5, 2600);
      }
    }
    car.prevDz = dz;
  }

  if (comboTimer > 0) { comboTimer -= dt; if (comboTimer <= 0) combo = 0; }
  shake = Math.max(0, shake - dt); flash = Math.max(0, flash - dt * 3);

  if (state === 'count') {
    const n = trafficClock < 0 ? Math.ceil(-trafficClock) : 0;
    if (n !== lastCount) { lastCount = n; showCount(n ? String(n) : 'GO'); if (n) beep(440, 0, 0.15); else beep(880, 0, 0.35); }
    if (trafficClock >= 0) { state = 'play'; setTimeout(() => { if (lastCount === 0) showCount(null); }, 700); }
  }
  if (playing) {
    raceTime = mode === 'duel' ? Math.max(0, trafficClock) : raceTime + dt;
    maxKmh = Math.max(maxKmh, kmh());
    if (mode === 'solo') {
      timeLeft -= dt;
      if (dist >= nextCp) {
        const add = Math.max(5, 11 - level * 0.4);
        timeLeft += add; level++; nextCp += CHECK_DIST;
        toast(`Checkpoint ${level}`, `+${add.toFixed(1)} s`, 'cp');
        beep(880, 0, 0.12); beep(1320, 0.12, 0.18);
        if (cars.length < 110) addCars(6);
      }
      if (timeLeft <= 0) { timeLeft = 0; endRace(); }
    } else if (dist >= FINISH) finishDuel();
  } else if (state === 'over') {
    overTimer += dt;
  }
  updateGhosts(dt);
  if (mode === 'duel' && (state === 'play' || state === 'count')) {
    presenceTimer -= dt;
    if (presenceTimer <= 0) { presenceTimer = 0.1; sendRacePresence(); }
  }
}
