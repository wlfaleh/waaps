/* WaForSpeed — Petites fonctions utilitaires partagées. */
'use strict';

/* ================= Utilitaires ================= */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, p) => a + (b - a) * p;
const easeIn = (a, b, p) => a + (b - a) * p * p;
const easeInOut = (a, b, p) => a + (b - a) * ((-Math.cos(p * Math.PI) / 2) + 0.5);
const pctRem = (n, total) => (n % total) / total;
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rnd = (a, b) => a + Math.random() * (b - a);
function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } return null; }
function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
const hex3 = (h, k = 1) => { const n = parseInt(h.slice(1), 16); return [((n >> 16) & 255) / 255 * k, ((n >> 8) & 255) / 255 * k, (n & 255) / 255 * k]; };
