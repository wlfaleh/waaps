/* WaForSpeed — Tracé de la piste (logique) et sa géométrie 3D (poses le long de la route). */
'use strict';

/* ================= Piste (logique) ================= */
let segments = [], trackLength = 0;
const lastY = () => (segments.length ? segments[segments.length - 1].p2.world.y : 0);
function addSegment(curve, y) {
  const n = segments.length;
  segments.push({ index: n, curve, sprites: [], deco: null, cars: [],
    p1: { world: { y: lastY(), z: n * SEG } }, p2: { world: { y, z: (n + 1) * SEG } } });
}
function addRoad(enter, hold, leave, curve, y) {
  const startY = lastY(), endY = startY + y * SEG, total = enter + hold + leave;
  for (let n = 0; n < enter; n++) addSegment(easeIn(0, curve, n / enter), easeInOut(startY, endY, n / total));
  for (let n = 0; n < hold; n++) addSegment(curve, easeInOut(startY, endY, (enter + n) / total));
  for (let n = 0; n < leave; n++) addSegment(easeInOut(curve, 0, n / leave), easeInOut(startY, endY, (enter + hold + n) / total));
}
const BOARD_TEXTS = [['WAFORSPEED', '#FF6A00'], ['GARAGE 88', '#00E5FF'], ['TURBO CAFÉ', '#FF6A00'], ['NUIT BLANCHE', '#00E5FF'], ['PNEUS 24/7', '#00E5FF']];
function buildTrack() {
  segments = [];
  const R = mulberry32(88);
  addRoad(30, 60, 30, 0, 0);
  for (let i = 0; i < 18; i++) {
    const t = R();
    const hill = R() < 0.5 ? Math.round((R() - 0.5) * 70) : 0;
    if (t < 0.22) addRoad(25, 40 + R() * 40 | 0, 25, 0, hill);
    else if (t < 0.7) {
      const dir = R() < 0.5 ? -1 : 1, c = [2, 3, 4, 5][Math.floor(R() * 4)];
      addRoad(30, 30 + R() * 50 | 0, 30, dir * c, hill);
    } else {
      const c = 2 + R() * 2;
      addRoad(20, 25, 20, -c, hill / 2); addRoad(20, 25, 20, c, 0); addRoad(20, 25, 20, -c, -hill / 2);
    }
  }
  addRoad(50, 50, 80, 0, -lastY() / SEG);
  addRoad(20, 30, 20, 0, 0);
  trackLength = segments.length * SEG;
  const len = segments.length;
  const D = mulberry32(4242);
  for (let n = 0; n < len; n++) segments[n].deco = { bld: [], lamp: 0, board: null };
  // immeubles : un tous les 11 segments de chaque côté (décalés)
  for (const side of [-1, 1]) {
    for (let n = side < 0 ? 0 : 5; n < len - 11; n += 11) {
      if (D() < 0.1) continue;
      const tall = D();
      segments[n].deco.bld.push({
        side, len: 11 * SEG_M - 0.6 - D() * 2, d: 10 + D() * 14,
        h: tall < 0.15 ? 55 + D() * 40 : tall < 0.6 ? 22 + D() * 30 : 10 + D() * 14,
        tint: Math.floor(D() * 4), u0: Math.floor(D() * 16) / 16, v0: Math.floor(D() * 16) / 16,
        neon: D() < 0.4 ? (D() < 0.5 ? '#00E5FF' : '#FF6A00') : null, sign: D() < 0.3
      });
    }
  }
  for (let n = 12; n < len; n += 24) {
    const side = (n / 24 | 0) % 2 ? 1 : -1;
    segments[n].deco.lamp = side;
    segments[n].sprites.push({ offset: side * (RW + 0.8) / RW, collide: true, hit: 0.14 });
  }
  for (let n = 75; n < len - 40; n += 140 + Math.floor(D() * 60)) {
    const side = D() < 0.5 ? -1 : 1;
    if (segments[n].deco.lamp) { segments[n].deco.lamp = 0; segments[n].sprites = []; }
    segments[n].deco.board = { side, t: Math.floor(D() * BOARD_TEXTS.length) };
    segments[n].sprites.push({ offset: side * (RW + 1) / RW, collide: true, hit: 0.15 });
  }
}
const segAt = (a) => segments[((a % segments.length) + segments.length) % segments.length];
const findSegment = (z) => segments[Math.floor(z / SEG) % segments.length];
const wrap = (z) => ((z % trackLength) + trackLength) % trackLength;
const relZ = (d) => { d = wrap(d); return d > trackLength / 2 ? d - trackLength : d; };

/* ================= Géométrie de la piste en 3D ================= */
/* pose(a) : position et cap du début du segment absolu a (la course ne « reboucle » jamais en 3D) */
const poses = new Map();
let poseMin = 0, poseMax = 0;
function resetPoses() { poses.clear(); poses.set(0, { x: 0, y: segAt(0).p1.world.y * M * ELEV, z: 0, th: 0 }); poseMin = 0; poseMax = 0; }
function pose(a) {
  let p = poses.get(a);
  if (p) return p;
  while (poseMax < a) {
    const q = poses.get(poseMax), s = segAt(poseMax);
    const n = { x: q.x + Math.sin(q.th) * SEG_M, z: q.z - Math.cos(q.th) * SEG_M, th: q.th + s.curve * CURVE_K, y: segAt(poseMax + 1).p1.world.y * M * ELEV };
    poseMax++; poses.set(poseMax, n);
  }
  while (poseMin > a) {
    const q = poses.get(poseMin), s = segAt(poseMin - 1);
    const th = q.th - s.curve * CURVE_K;
    const n = { x: q.x - Math.sin(th) * SEG_M, z: q.z + Math.cos(th) * SEG_M, th, y: s.p1.world.y * M * ELEV };
    poseMin--; poses.set(poseMin, n);
  }
  return poses.get(a);
}
function trimPoses(aP) {
  const lo = aP - 600;
  if (poseMin < lo - 400) { for (let a = poseMin; a < lo; a++) poses.delete(a); poseMin = lo; }
}
/* point sur la piste : s = coordonnée absolue (unités), lat = mètres à droite du centre */
function trackPoint(s, lat, out) {
  const fa = s / SEG, a = Math.floor(fa), f = fa - a;
  const p0 = pose(a), p1 = pose(a + 1);
  const th = p0.th + (p1.th - p0.th) * f;
  out.x = p0.x + (p1.x - p0.x) * f + Math.cos(th) * lat;
  out.z = p0.z + (p1.z - p0.z) * f + Math.sin(th) * lat;
  out.y = p0.y + (p1.y - p0.y) * f;
  out.th = th; out.slope = Math.atan2(p1.y - p0.y, SEG_M);
  return out;
}
