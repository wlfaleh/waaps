/* WaForSpeed — Trafic simulé : les voitures se suivent sans jamais se chevaucher,
   freinent derrière plus lent qu'elles, ne changent de file que si la place est libre,
   tiennent compte du joueur et contournent les voitures accidentées.
   La simulation avance par pas fixes de 1/60 s à partir d'une graine : au départ d'un duel,
   les deux joueurs ont exactement le même trafic (il réagit ensuite à chacun). */
'use strict';

const T_STEP = 1 / 60;
let trafficSeed = 1, trafficClock = 0, trafficSim = 0;
const LANE_HALF = 0.36;            // écart latéral (en largeur de demi-route) à partir duquel deux voitures se gênent
const SAFE_TIME = 1.1;             // temps de sécurité derrière la voiture de devant (s)
const SAFE_MIN = 5 / M;            // distance minimale à l'arrêt (unités)

function nextRand(car) {
  car.rng = (Math.imul(car.rng ^ (car.rng >>> 15), 2246822507) + 0x9e3779b9) >>> 0;
  return car.rng / 4294967296;
}
function addCars(n) {
  for (let i = 0; i < n; i++) {
    const R = mulberry32((Math.imul(trafficSeed, 7919) + Math.imul(cars.length + 1, 104729)) >>> 0);
    const type = Math.floor(R() * CARS.length), len = CARS[type].d.L / M;
    const want = MAX_SPEED * (MAP.traffic.min + R() * (MAP.traffic.max - MAP.traffic.min));
    const lane = Math.floor(R() * LANES);
    let z = 0;
    for (let k = 0; k < 24; k++) {
      z = wrap(position + PLAYER_Z + 6000 + R() * (trackLength - 12000));
      if (!cars.some((c) => c.lane === lane && Math.abs(relZ(c.z - z)) < (c.len + len) / 2 + 30 / M)) break;
    }
    cars.push({
      type, color: Math.floor(R() * TRAFFIC_PAINTS.length), len, w: CARS[type].d.W / (2 * RW),
      lane, target: lane, offset: LANE_X[lane], prevOff: LANE_X[lane], z, speed: want, want,
      rng: (R() * 4294967296) >>> 0, think: 1 + R() * 4, crash: null, signal: 0, pending: null, prevDz: relZ(z - (position + PLAYER_Z)), mesh: null
    });
  }
}
/* la file « lane » est-elle libre autour de la voiture ? */
function laneFree(car, lane) {
  const lx = LANE_X[lane];
  for (const o of cars) {
    if (o === car || (Math.abs(o.offset - lx) > LANE_HALF && o.target !== lane)) continue;
    const dz = relZ(o.z - car.z);
    if (dz >= 0 && dz < (o.len + car.len) / 2 + Math.max(8 / M, (car.speed - o.speed) * 1.6)) return false;
    if (dz < 0 && -dz < (o.len + car.len) / 2 + Math.max(10 / M, (o.speed - car.speed) * 2.2)) return false;
  }
  if (Math.abs(playerX - lx) < LANE_HALF + 0.1 && Math.abs(relZ(position - car.z)) < 22 / M) return false;
  return true;
}
function stepTraffic(h) {
  const myLen = myCar.d.L / M;
  for (const car of cars) {
    if (car.crash) {
      // voiture accidentée : glisse, tourne sur elle-même, s'arrête puis repart
      const c = car.crash;
      c.t += h;
      car.speed = Math.max(0, car.speed - MAX_SPEED * 0.55 * h);
      car.offset = clamp(car.offset + c.vx * h, -1.12, 1.12);
      c.vx *= Math.max(0, 1 - 2.5 * h);
      c.yaw += c.spin * h; c.spin *= Math.max(0, 1 - 1.8 * h);
      if (c.t > 7 && Math.abs(relZ(position - car.z)) > 60 / M) {
        car.crash = null; car.speed = 0; car.signal = 0; car.pending = null;
        let best = 0, bd = 9;
        for (let l = 0; l < LANES; l++) { const d = Math.abs(LANE_X[l] - car.offset); if (d < bd) { bd = d; best = l; } }
        car.lane = car.target = best;
      }
      car.z = wrap(car.z + car.speed * h);
      continue;
    }
    // voiture de devant : dans la même file ou en train d'y entrer (+ le joueur)
    let gap = Infinity, leadSpeed = car.want;
    const tx = LANE_X[car.target];
    for (const o of cars) {
      if (o === car) continue;
      if (Math.abs(o.offset - car.offset) > LANE_HALF && Math.abs(o.offset - tx) > LANE_HALF) continue;
      const dz = relZ(o.z - car.z);
      if (dz <= 0) continue;
      const g = dz - (o.len + car.len) / 2;
      if (g < gap) { gap = g; leadSpeed = o.speed; }
    }
    if (state !== 'garage') {
      const dz = relZ(position - car.z);
      if (dz > 0 && (Math.abs(playerX - car.offset) < LANE_HALF || Math.abs(playerX - tx) < LANE_HALF)) {
        const g = dz - (myLen + car.len) / 2;
        if (g < gap) { gap = g; leadSpeed = speed; }
      }
    }
    // vitesse visée : sa vitesse de croisière, ou celle qui garde la distance de sécurité
    const safe = SAFE_MIN + car.speed * SAFE_TIME;
    let target = car.want;
    if (gap < safe) target = Math.min(target, Math.max(0, leadSpeed - (safe - gap) * 1.2));
    const acc = target > car.speed ? MAX_SPEED * 0.1 : MAX_SPEED * 0.7;
    car.speed = Math.max(0, car.speed + clamp(target - car.speed, -acc * h, acc * h));
    if (gap < 0.8 / M) car.speed = Math.min(car.speed, leadSpeed * 0.95);
    // envie de changer de file (bloqué derrière plus lent, ou de temps en temps)
    car.think -= h;
    if (car.think <= 0 && car.target === car.lane && !car.pending) {
      const r = nextRand(car);
      car.think = 1.5 + r * 4;
      const blocked = gap < safe * 1.6 && leadSpeed < car.want * 0.85;
      if (blocked || r < 0.12) {
        const dir = nextRand(car) < 0.5 ? -1 : 1;
        // d'abord le clignotant, le changement de file vient ~1 s plus tard
        for (const nl of [car.lane + dir, car.lane - dir]) if (nl >= 0 && nl < LANES && laneFree(car, nl)) { car.pending = { lane: nl, t: 0.9 + nextRand(car) * 0.5 }; car.signal = Math.sign(nl - car.lane); break; }
      }
    }
    if (car.pending) {
      car.pending.t -= h;
      if (car.pending.t <= 0) {
        if (laneFree(car, car.pending.lane)) car.target = car.pending.lane; else car.signal = 0;
        car.pending = null;
      }
    }
    // abandonne le changement si la file se remplit, sinon glisse vers elle
    if (car.target !== car.lane && !laneFree(car, car.target) && Math.abs(car.offset - LANE_X[car.lane]) < 0.2) { car.target = car.lane; car.signal = 0; }
    const d = LANE_X[car.target] - car.offset;
    car.offset += clamp(d, -0.5 * h, 0.5 * h);
    if (Math.abs(d) < 0.01) { car.lane = car.target; if (!car.pending) car.signal = 0; }
    car.z = wrap(car.z + car.speed * h);
  }
}
/* avance la simulation jusqu'à l'horloge du trafic */
function advanceTraffic() {
  let steps = Math.floor((trafficClock - trafficSim) / T_STEP);
  if (steps > 600) { trafficSim = trafficClock - 600 * T_STEP; steps = 600; }
  for (let i = 0; i < steps; i++) { stepTraffic(T_STEP); trafficSim += T_STEP; }
}
/* la voiture percutée part en glissade */
function crashTraffic(car, impact, side) {
  car.crash = { t: 0, vx: side * (0.4 + impact * 1.6), yaw: 0, spin: side * (1.5 + impact * 7), smoke: 0 };
  car.target = car.lane;
}
