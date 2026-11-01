/* WaForSpeed — État de la partie (le trafic est dans traffic.js). */
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

/* Accidents : tête-à-queue du joueur, perte de contrôle, ralenti. */
let playerSpin = 0, spinYaw = 0, controlLock = 0, timeScale = 1, slowmoT = 0, scrapeCd = 0;

function resetRace(kind, seed) {
  if (renderer) clearTrafficMeshes();
  cars = [];
  trafficSeed = (seed >>> 0) || 1; trafficClock = kind === 'menu' ? 0 : -3; trafficSim = trafficClock;
  playerSpin = 0; spinYaw = 0; controlLock = 0; timeScale = 1; slowmoT = 0;
  position = 0; playerX = 0; speed = kind === 'menu' ? MAX_SPEED * 0.6 : 0; steer = 0; dist = 0; raceTime = 0;
  timeLeft = 30; nextCp = CHECK_DIST; level = 0; bonus = 0; nitro = 0.4; nitroOn = false;
  combo = 0; comboTimer = 0; nearCount = 0; maxKmh = 0; shake = 0; flash = 0; overTimer = 0; lastCount = null;
  addCars(kind === 'menu' ? 50 : mode === 'duel' ? 55 : 42);
  if (renderer) { clearChunks(); resetPoses(); ensureChunks(0, true); camInit = false; setGantry('', '', 0); }
}
const score = () => Math.floor(dist * 0.006) * 5 + bonus;
const kmh = () => Math.round(speed / MAX_SPEED * 260);
