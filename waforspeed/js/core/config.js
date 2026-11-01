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
const OFF_DECEL = -MAX_SPEED / 2, OFF_LIMIT = MAX_SPEED / 4;
const CENTRIFUGAL = 0.2;
const CAR_HIT = 0.26, NEAR_MISS = 0.5;
const CHECK_DIST = 100000;
const LANE_X = [-2 / 3, 0, 2 / 3];
const KM = 1000 / 0.006, FINISH = 4 * KM;
/* Rendu 3D : 1 unité de jeu = 6 mm */
const M = 0.006, SEG_M = SEG * M, RW = 7.5, CURVE_K = 0.003, ELEV = 0.5, CH = 32;
