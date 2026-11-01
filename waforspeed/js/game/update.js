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
  // vise la voie choisie en braquant (même physique que le joueur)
  const want = clamp((autoTarget - playerX) * 5 - heading * 4, -1, 1);
  steer += (want - steer) * Math.min(1, dt * 5);
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
    playerX += side * (overlapX + 0.004); car.offset -= side * overlapX * 0.35 * PERF.mass;
    heading *= 0.5;   // le frottement redresse la voiture
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
    speed = v0 + rel * clamp(0.04 + 0.08 * PERF.mass, 0.06, 0.2);   // une voiture lourde garde plus de vitesse
    emitSparks(c.at, c.vel, 20 + Math.round(impact * 80));
    if (impact / PERF.mass > 0.28) { crashTraffic(car, impact, -side); playerAccident(impact, side); }
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

/* duel : contact avec la voiture de l'adversaire (chaque joueur gère sa propre voiture ;
   l'autre fait le même calcul de son côté, l'effet est donc symétrique) */
function hitGhosts(dt, myLen, myW) {
  for (const g of ghosts.values()) {
    g.hitCd = Math.max(0, (g.hitCd || 0) - dt);
    if (g.done) continue;
    const oc = carById(g.car), oLen = oc.d.L / M, oW = oc.d.W / (2 * RW);
    const dz = g.rd - dist, lat = Math.abs(playerX - g.x);
    const touchZ = (myLen + oLen) / 2, touchLat = myW + oW;
    if (Math.abs(dz) >= touchZ || lat >= touchLat) continue;
    const side = Math.sign(playerX - g.x) || (g.x > 0 ? -1 : 1);
    const overlapZ = touchZ - Math.abs(dz), overlapX = touchLat - lat;
    const mid = trackPoint(dist + dz / 2, (playerX + g.x) / 2 * RW, {});
    const at = { x: mid.x, y: mid.y + 0.55, z: mid.z, floor: mid.y + 0.05 }, vel = { x: Math.sin(mid.th) * speed * M * 0.6, y: 1, z: -Math.cos(mid.th) * speed * M * 0.6 };
    const gv = g.v || 0, oMass = oc.spec.kg / 1450, share = oMass / (oMass + PERF.mass);   // la plus lourde bouge moins
    if (overlapX * RW < overlapZ * M * 0.7) {
      // côte à côte : les carrosseries frottent et se repoussent
      playerX += side * Math.min(overlapX * share * 2 + 0.003, dt * 2.5 + 0.004);   // séparation progressive (pas de téléportation)
      heading += side * 0.06 * share; speed *= 1 - 0.8 * dt;
      if (g.hitCd <= 0) {
        g.hitCd = 0.2; noiseHit(0.25, 3000, 3, 0.45, 1500); noiseHit(0.2, 220, 1, 0.5, 90); emitSparks(at, vel, 22);
        shake = Math.max(shake, reduceMotion ? 0 : 0.3); flash = Math.max(flash, 0.25);
        if (navigator.vibrate) { try { navigator.vibrate(40); } catch (e) {} }
      }
      continue;
    }
    const rel = Math.abs(speed - gv), impact = rel / MAX_SPEED;
    if (dz > 0) {
      // je percute l'arrière de l'adversaire : je recule derrière lui et perds ma vitesse
      position = wrap(position - overlapZ - 0.15 / M); dist = Math.max(0, dist - overlapZ - 0.15 / M);
      speed = Math.min(speed, gv + rel * (0.15 + 0.3 * (1 - share)));
    } else {
      // il me percute par l'arrière : je suis poussé vers l'avant
      speed = Math.max(speed, gv * (0.6 + 0.4 * share));
      heading += (Math.random() - 0.5) * 0.12 * Math.min(1, impact * 4);
    }
    if (g.hitCd <= 0) {
      g.hitCd = 0.35;
      emitSparks(at, vel, 25 + Math.round(impact * 90));
      noiseHit(0.5, 160, 0.8, 0.7 + impact, 50); noiseHit(0.3, 2400, 1.5, 0.5, 6000);
      if (impact * share > 0.22) playerAccident(Math.min(1, impact * share * 1.5), side); else bump(impact);
    }
  }
}
function update(dt) {
  if (state === 'pause' || state === 'garage') return;
  const playing = state === 'play';
  const auto = state === 'menu' || state === 'over';
  const playerSeg = findSegment(position + PLAYER_Z);
  const speedPct = speed / MAX_SPEED;

  if (mode === 'duel' && raceStartWall) trafficClock = (performance.now() - raceStartWall) / 1000 - 3;
  else trafficClock += dt;
  advanceTraffic();
  // tête-à-queue après un accident : la voiture tourne puis se remet droite
  controlLock = Math.max(0, controlLock - dt); scrapeCd -= dt;
  if (Math.abs(playerSpin) > 0.25) { spinYaw += playerSpin * dt; playerSpin *= Math.max(0, 1 - 2.4 * dt); playerX += playerSpin * 0.012 * dt * Math.min(1, speedPct * 3); }
  else { playerSpin = 0; spinYaw += (0 - spinYaw) * Math.min(1, dt * 3); if (Math.abs(spinYaw) < 0.002) spinYaw = 0; }
  // angle ramené entre -π et +π : après un tour complet, la voiture et la caméra reviennent vraiment à 0
  spinYaw = Math.atan2(Math.sin(spinYaw), Math.cos(spinYaw));
  const locked = controlLock > 0;

  // ---------- conduite : braquage progressif, la voiture tourne, son cap la déplace ----------
  const v = speed * M;                                   // vitesse en m/s (négative en marche arrière)
  if (playing && !locked) {
    const target = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const rate = target === 0 || Math.sign(target) !== Math.sign(steer) ? PHYS.steerOut : PHYS.steerIn;
    steer += clamp(target - steer, -dt * rate, dt * rate);
  } else if (auto) autopilot(dt);
  else steer += -steer * Math.min(1, dt * 4);
  // angle des roues : plus petit à haute vitesse (direction moins sensible, comme une vraie voiture)
  const wheelAngle = steer * PHYS.maxSteer / (1 + Math.abs(v) / PHYS.steerV);
  let yawRate = v / PERF.wb * Math.tan(wheelAngle) * PERF.handling;
  const yawLim = PHYS.grip * PERF.handling / Math.max(Math.abs(v), 1);   // limite d'adhérence
  yawRate = clamp(yawRate, -yawLim, yawLim);
  if (!locked) heading += yawRate * dt;
  // sans volant, la voiture se réaligne doucement sur la route (aide à la conduite)
  if (Math.abs(steer) < 0.05 || locked) heading *= Math.exp(-dt * PHYS.align * (locked ? 2 : 1));
  // angle max par rapport à la route : large à basse vitesse (manœuvres), serré à haute vitesse (changements de voie)
  const maxH = clamp(PHYS.maxHeading - Math.abs(v) * 0.0045, 0.16, PHYS.maxHeading);
  heading = clamp(heading, -maxH, maxH);
  latAcc = v * yawRate;
  const prevSpeed = speed;
  position = wrap(position + dt * speed * Math.cos(heading));
  dist += dt * speed * Math.cos(heading);
  playerX += v * Math.sin(heading) * dt / RW;
  // force centrifuge dans les virages de la route
  playerX -= dt * 2 * Math.min(speedPct, 1.1) * Math.min(speedPct, 1.1) * playerSeg.curve * CENTRIFUGAL;

  // ---------- moteur, freins, frottements (en m/s²) ----------
  nitroOn = playing && input.nitro && nitro > 0.01;
  if (nitroOn) nitro = Math.max(0, nitro - dt * PERF.nitroBurn);
  const top = MAX_SPEED * PERF.top * (nitroOn ? PERF.nitroMult : 1);
  const accelerating = playing && !locked && input.up && !input.down;
  // frein : ralentit ; maintenu à l'arrêt, il passe la marche arrière
  reversing = playing && !locked && input.down && !input.up && speed <= 0;
  braking = playing && !locked && input.down && speed > 0;
  const av = Math.abs(v);
  const resist = (PHYS.roll + PHYS.drag * av * av + (accelerating ? 0 : PHYS.engineBrake)) / M;   // frottements + frein moteur
  const off = Math.abs(playerX) > 1 ? PHYS.offRoad / M : 0;
  if (auto) speed = lerp(speed, MAX_SPEED * 0.62, Math.min(1, dt));
  else if (state === 'count') speed = 0;
  else if (locked) speed = speed > 0 ? Math.max(0, speed - PHYS.brake * 0.5 / M * dt) : Math.min(0, speed + PHYS.brake * 0.5 / M * dt);
  else if (reversing) speed = Math.max(REV_MAX, speed - REV_ACC * dt);
  else if (braking) speed = Math.max(0, speed - (PHYS.brake / M + resist) * dt);
  else if (accelerating && speed < 0) speed = Math.min(0, speed + PHYS.brake / M * dt);
  else if (accelerating) {
    // la poussée baisse quand on approche de la vitesse max (courbe d'un vrai moteur)
    const push = PERF.a0 / M * (nitroOn ? 1.6 : 1) * Math.max(0, 1 - Math.pow(Math.max(0, speed) / top, 2.2));
    speed += (push - resist * 0.35 - off) * dt;
  } else speed = speed < 0 ? Math.min(0, speed + resist * dt) : Math.max(0, speed - (resist + off) * dt);
  if (speed > top) speed = Math.max(top, speed - MAX_SPEED * 0.4 * dt);
  lonAcc = (speed - prevSpeed) * M / Math.max(dt, 1e-3);

  if (Math.abs(playerX) > 1) {
    if (playing) for (const sp of playerSeg.sprites) {
      if (sp.collide && Math.abs(playerX - sp.offset) < sp.hit && speed > MAX_SPEED / 6) { crash(); break; }
    }
  }
  if (Math.abs(playerX) > MAP.edge) {
    // bordure : on glisse le long, la voiture est redressée (rebond symétrique des deux côtés)
    playerX = Math.sign(playerX) * MAP.edge;
    if (Math.sign(heading) === Math.sign(playerX)) heading *= -0.25;
    speed *= 1 - dt * 2; if (playing) shake = Math.max(shake, reduceMotion ? 0 : 0.12);
  }
  speed = clamp(speed, REV_MAX, MAX_SPEED * 1.6);

  // emprise réelle de la voiture tournée d'un angle « heading » (rectangle orienté)
  const ch = Math.cos(heading), sh = Math.abs(Math.sin(heading));
  const pz = position + PLAYER_Z, myLen = (myCar.d.L * ch + myCar.d.W * sh) / M, myW = (myCar.d.W * ch + myCar.d.L * sh) / (2 * RW);
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

  if (playing && mode === 'duel') hitGhosts(dt, myLen, myW);
  // nouveau quartier : son nom s'affiche
  if (playing) { const zs = findSegment(position + PLAYER_Z); if (zs && zs.zoneName) { const key = zs.zoneIdx + ':' + Math.floor(zs.index / ZONE_LEN); if (zoneSeen !== null && key !== zoneSeen) toast(zs.zoneName, '', 'cp'); zoneSeen = key; } }
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
