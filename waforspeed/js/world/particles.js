/* WaForSpeed — Particules 3D : étincelles des chocs et fumée des voitures accidentées. */
'use strict';

const PARTS = { sparks: null, smoke: null };
function makeParticleSystem(n, size, blending, opacity) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
  const mat = new THREE.PointsMaterial({ size, map: TEXS.radial, vertexColors: true, transparent: true, opacity, depthWrite: false, blending, sizeAttenuation: true });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false;
  scene.add(pts);
  return { pts, n, next: 0, p: Array.from({ length: n }, () => ({ life: 0, max: 1, x: 0, y: -999, z: 0, vx: 0, vy: 0, vz: 0, c: [0, 0, 0] })) };
}
function setupParticles() {
  PARTS.sparks = makeParticleSystem(220, 0.22, THREE.AdditiveBlending, 1);
  PARTS.smoke = makeParticleSystem(140, 2.4, THREE.NormalBlending, 0.45);
}
function emit(sys, at, count, spread, base, colorFn, life) {
  if (!sys || reduceMotion) return;
  for (let i = 0; i < count; i++) {
    const q = sys.p[sys.next]; sys.next = (sys.next + 1) % sys.n;
    q.x = at.x; q.y = at.y; q.z = at.z;
    q.vx = base.x + (Math.random() - 0.5) * spread; q.vy = base.y + Math.random() * spread * 0.6; q.vz = base.z + (Math.random() - 0.5) * spread;
    q.max = q.life = life * (0.6 + Math.random() * 0.6); q.c = colorFn(); q.floor = at.floor !== undefined ? at.floor : at.y - 0.5;
  }
}
/* étincelles au point de contact ; `vel` = vitesse du véhicule (m/s) dans le monde */
function emitSparks(at, vel, count = 40) {
  emit(PARTS.sparks, at, count, 9, vel, () => (Math.random() < 0.3 ? [1, 0.95, 0.8] : [1, 0.45 + Math.random() * 0.3, 0.1]), 0.55);
}
function emitSmoke(at, count = 2) {
  emit(PARTS.smoke, at, count, 0.8, { x: 0, y: 1.2, z: 0 }, () => { const k = 0.25 + Math.random() * 0.15; return [k, k, k * 1.1]; }, 2.2);
}
function updateParticles(dt) {
  for (const key of ['sparks', 'smoke']) {
    const sys = PARTS[key]; if (!sys) continue;
    const pos = sys.pts.geometry.attributes.position, col = sys.pts.geometry.attributes.color;
    const grav = key === 'sparks' ? 14 : -0.4, drag = key === 'sparks' ? 1.5 : 0.8;
    for (let i = 0; i < sys.n; i++) {
      const q = sys.p[i];
      if (q.life <= 0) { pos.setXYZ(i, 0, -999, 0); continue; }
      q.life -= dt;
      q.vy -= grav * dt; q.vx *= 1 - drag * dt; q.vz *= 1 - drag * dt;
      q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
      if (key === 'sparks' && q.y < q.floor) { q.y = q.floor; q.vy *= -0.35; }
      const k = Math.max(0, q.life / q.max);
      pos.setXYZ(i, q.x, q.y, q.z);
      col.setXYZ(i, q.c[0] * k, q.c[1] * k, q.c[2] * k);
    }
    pos.needsUpdate = true; col.needsUpdate = true;
  }
}
