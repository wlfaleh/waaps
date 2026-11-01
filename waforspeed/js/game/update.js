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
/* point de contact entre le joueur et une voiture, dans le monde 3D */
function contactAt(dz, otherOffset) {
  const p = trackPoint(dist + dz / 2, (playerX + otherOffset) / 2 * RW, {});
  const v = speed * M;
  return { at: { x: p.x, y: p.y + 0.55, z: p.z, floor: p.y + 0.05 }, vel: { x: Math.sin(p.th) * v * 0.6, y: 1, z: -Math.cos(p.th) * v * 0.6 } };
}
/* gros choc : tête-à-queue, perte de contrôle, ralenti */
function playerAccident(impact, side) {
  playerSpin = side * (3 + impact * 9);
  controlLock = 0.6 + impact * 1.2;
  shake = reduceMotion ? 0 : 0.9; flash = 1;
  if (!reduceMotion) { timeScale = 0.35; slowmoT = 0.5; }
  toast('Accident !', '', 'bad');
  combo = 0; comboTimer = 0;
  noiseHit(0.6, 140, 0.7, 1, 45); noiseHit(0.4, 2600, 1.4, 0.55, 7000); noiseHit(0.25, 900, 2, 0.4, 300);
  if (navigator.vibrate) { try { navigator.vibrate([90, 40, 120]); } catch (e) {} }
}
/* petit choc : secousse */
function bump(impact) {
  shake = Math.max(shake, reduceMotion ? 0 : 0.25 + impact * 1.5); flash = Math.max(flash, 0.35);
  if (impact > 0.08) { if (combo > 1) toast('Combo perdu', '', 'bad'); combo = 0; comboTimer = 0; }
  noiseHit(0.3, 200, 0.8, 0.4 + impact, 70);
}
/* collision avec un décor (lampadaire, panneau) */
function crash() {
  const back = 300, side = playerX > 0 ? -1 : 1;
  speed = MAX_SPEED / 8;
  position = wrap(position - back); dist = Math.max(0, dist - back);
  playerAccident(0.45, side);
  const c = contactAt(0, playerX);
  emitSparks(c.at, c.vel, 50);
}
/* collision avec une voiture du trafic */
function hitCar(car, dz, lat, touchLat, touchZ) {
  const side = Math.sign(playerX - car.offset) || 1;
  const overlapZ = touchZ - Math.abs(dz), overlapX = touchLat - lat;
  const c = contactAt(dz, car.offset);
  if (overlapX * RW < overlapZ * M * 0.7) {
    // contact latéral : les carrosseries frottent, on s'écarte l'un de l'autre
    playerX += side * (overlapX + 0.004); car.offset -= side * overlapX * 0.35;
    speed *= 0.94; car.speed *= 0.97;
    if (scrapeCd <= 0) { scrapeCd = 0.18; noiseHit(0.22, 3200, 3, 0.35, 1600); emitSparks(c.at, c.vel, 14); shake = Math.max(shake, reduceMotion ? 0 : 0.15); }
    return;
  }
  if (dz > 0) {
    // on percute l'arrière : la voiture est poussée, on perd notre vitesse
    const rel = Math.max(0, speed - car.speed), impact = rel / MAX_SPEED, v0 = car.speed;
    const back = overlapZ + 0.25 / M;
    position = wrap(position - back); dist = Math.max(0, dist - back);
    car.speed = v0 + rel * 0.55;
    speed = v0 + rel * 0.12;
    emitSparks(c.at, c.vel, 20 + Math.round(impact * 80));
    if (impact > 0.28) { crashTraffic(car, impact, -side); playerAccident(impact, side); }
    else { bump(impact); if (impact > 0.15) crashTraffic(car, impact * 0.5, -side); }
  } else {
    // une voiture nous rentre dedans par l'arrière (on a pilé devant elle)
    const rel = Math.max(0, car.speed - speed), impact = rel / MAX_SPEED;
    car.z = wrap(position + PLAYER_Z - touchZ - 0.25 / M);
    speed += rel * 0.5; car.speed = speed - rel * 0.1;
    emitSparks(c.at, c.vel, 16 + Math.round(impact * 50));
    bump(impact);
  }
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
  advanceTraffic();
  // tête-à-queue après un accident : la voiture tourne puis se remet droite
  controlLock = Math.max(0, controlLock - dt); scrapeCd -= dt;
  if (Math.abs(playerSpin) > 0.25) { spinYaw += playerSpin * dt; playerSpin *= Math.max(0, 1 - 2.4 * dt); playerX += playerSpin * 0.012 * dt * Math.min(1, speedPct * 3); }
  else { playerSpin = 0; const tgt = Math.round(spinYaw / (Math.PI * 2)) * Math.PI * 2; spinYaw += (tgt - spinYaw) * Math.min(1, dt * 3); }
  const locked = controlLock > 0;

  position = wrap(position + dt * speed);
  dist += dt * speed;

  if (playing && !locked) {
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
  const accelerating = playing && !locked && input.up && !input.down;
  braking = playing && !locked && input.down;
  if (auto) speed = lerp(speed, MAX_SPEED * 0.62, Math.min(1, dt));
  else if (state === 'count') speed = 0;
  else if (locked) speed += BRAKE * 0.45 * dt;
  else if (braking) speed += BRAKE * dt;
  else if (accelerating) speed += ACCEL * PERF.acc * (nitroOn ? 2 : 1) * dt;
  else speed += DECEL * dt;
  if (speed > top) speed = Math.max(top, speed - MAX_SPEED * 0.5 * dt);

  if (Math.abs(playerX) > 1) {
    if (speed > OFF_LIMIT) speed += OFF_DECEL * dt;
    if (playing) for (const sp of playerSeg.sprites) {
      if (sp.collide && Math.abs(playerX - sp.offset) < sp.hit && speed > MAX_SPEED / 6) { crash(); break; }
    }
  }
  if (Math.abs(playerX) > MAP.edge) { playerX = Math.sign(playerX) * MAP.edge; speed *= 1 - dt * 2; if (playing) shake = Math.max(shake, reduceMotion ? 0 : 0.12); }
  speed = clamp(speed, 0, MAX_SPEED * 1.6);

  const pz = position + PLAYER_Z, myLen = myCar.d.L / M, myW = myCar.d.W / (2 * RW);
  for (const car of cars) {
    const dz = relZ(car.z - pz);
    const lat = Math.abs(playerX - car.offset);
    const touchLat = myW + car.w, touchZ = (myLen + car.len) / 2;
    if (playing) {
      if (lat < touchLat && Math.abs(dz) < touchZ) { hitCar(car, dz, lat, touchLat, touchZ); car.prevDz = relZ(car.z - (position + PLAYER_Z)); continue; }
      if (car.prevDz > 0 && dz <= 0 && dz > -2000 && lat >= touchLat && lat < touchLat + NEAR_MISS && speed > MAX_SPEED * 0.5 && !car.crash) {
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
