/* WaForSpeed — Environnement, constantes de jeu et échelle du rendu 3D. */
'use strict';

const $ = (s) => document.querySelector(s);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isTouch = matchMedia('(pointer: coarse)').matches;
const THREE = window.THREE;

/* ================= Constantes de jeu ================= */
const SEG = 200, RUMBLE = 3, LANES = 3;
const PLAYER_Z = 0;
const MAX_SPEED = SEG * 60;
const ACCEL = MAX_SPEED / 5, BRAKE = -MAX_SPEED, DECEL = -MAX_SPEED / 5;
/* physique réaliste (en m/s et m/s²) : freinage, frottements, adhérence, braquage */
const PHYS = { brake: 12.5, roll: 0.35, drag: 0.00042, engineBrake: 0.9, grip: 18, maxSteer: 0.6, steerV: 14, steerIn: 4, steerOut: 6, align: 3, maxHeading: 0.5, offRoad: 7 };
const OFF_DECEL = -MAX_SPEED / 2, OFF_LIMIT = MAX_SPEED / 4;
const CENTRIFUGAL = 0.2;
const REV_MAX = -MAX_SPEED * 0.12, REV_ACC = MAX_SPEED * 0.1;   // marche arrière : ~30 km/h
const NEAR_MISS = 0.24;   // marge latérale (en demi-route) d'un quasi-contact
const CHECK_DIST = 100000;
const LANE_X = [-2 / 3, 0, 2 / 3];
const KM = 1000 / 0.006;
const DUEL_KMS = [2, 4, 6, 10];   // distances proposées pour un duel
let FINISH = 4 * KM;             // ligne d'arrivée du duel (choisie par le créateur du salon)
/* Rendu 3D : 1 unité de jeu = 6 mm */
const M = 0.006, SEG_M = SEG * M, RW = 7.5, CURVE_K = 0.003, ELEV = 0.5, CH = 32;
