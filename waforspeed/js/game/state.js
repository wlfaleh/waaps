/* WaForSpeed — État de la partie et trafic déterministe. */
'use strict';

/* ================= État du jeu ================= */
let state = 'menu';
let position = 0, playerX = 0, speed = 0, steer = 0, dist = 0;
let timeLeft = 30, nextCp = CHECK_DIST, level = 0, bonus = 0, nitro = 0.4, nitroOn = false;
let combo = 0, comboTimer = 0, nearCount = 0, maxKmh = 0, shake = 0, flash = 0, overTimer = 0;
let autoTarget = 0, autoTimer = 0, braking = false;
let best = parseInt(store('waforspeed-best') || '0', 10) || 0;
let cars = [];
let raceStartWall = 0;
let mode = 'solo', raceTime = 0, lastCount = null, presenceTimer = 0, myFinish = 0;
const input = { up: false, down: false, left: false, right: false, nitro: false };

/* Le trafic est une fonction du temps de course et d'une graine : deux joueurs
   avec la même graine et le même chrono voient exactement les mêmes voitures. */
let trafficSeed = 1, trafficClock = 0;
function laneIdx(car, k) {
  const R = mulberry32((car.salt + Math.imul(k, 2654435761)) >>> 0);
  return R() < 0.6 ? car.base : Math.floor(R() * LANES);
}
function carOffset(car, t) {
  const u = (t + car.ph) / car.P, k = Math.floor(u), f = u - k, w = 1.4 / car.P;
  let tr = clamp((f - (1 - w)) / w, 0, 1); tr = tr * tr * (3 - 2 * tr);
  return lerp(LANE_X[laneIdx(car, k)], LANE_X[laneIdx(car, k + 1)], tr);
}
function positionCar(car, t) {
  car.z = wrap(car.z0 + car.speed * t);
  car.offset = carOffset(car, t);
}
function addCars(n) {
  for (let i = 0; i < n; i++) {
    const R = mulberry32((Math.imul(trafficSeed, 7919) + Math.imul(cars.length + 1, 104729)) >>> 0);
    const speed0 = MAX_SPEED * (0.28 + R() * 0.27);
    const car = {
      z0: wrap(position + PLAYER_Z + 6000 + R() * (trackLength - 12000) - speed0 * trafficClock),
      speed: speed0, type: Math.floor(R() * CARS.length), color: Math.floor(R() * TRAFFIC_PAINTS.length),
      base: Math.floor(R() * LANES), P: 6 + R() * 8, ph: R() * 20,
      salt: (R() * 4294967296) >>> 0, z: 0, offset: 0, prevOff: 0, prevDz: 0, mesh: null
    };
    positionCar(car, trafficClock); car.prevOff = car.offset;
    car.prevDz = relZ(car.z - (position + PLAYER_Z));
    cars.push(car);
  }
}
function resetRace(kind, seed) {
  if (renderer) clearTrafficMeshes();
  cars = [];
  trafficSeed = (seed >>> 0) || 1; trafficClock = kind === 'menu' ? 0 : -3;
  position = 0; playerX = 0; speed = kind === 'menu' ? MAX_SPEED * 0.6 : 0; steer = 0; dist = 0; raceTime = 0;
  timeLeft = 30; nextCp = CHECK_DIST; level = 0; bonus = 0; nitro = 0.4; nitroOn = false;
  combo = 0; comboTimer = 0; nearCount = 0; maxKmh = 0; shake = 0; flash = 0; overTimer = 0; lastCount = null;
  addCars(kind === 'menu' ? 50 : mode === 'duel' ? 55 : 42);
  if (renderer) { clearChunks(); resetPoses(); ensureChunks(0, true); camInit = false; setGantry('', '', 0); }
}
const score = () => Math.floor(dist * 0.006) * 5 + bonus;
const kmh = () => Math.round(speed / MAX_SPEED * 260);
