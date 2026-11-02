/* WaForSpeed — Conducteurs dans toutes les voitures (joueur, trafic, adversaire du duel).
   On réutilise les vrais personnages des piétons (people.js, Quaternius CC0) : chaque personnage est posé
   assis (animation « Sitting ») puis « figé » une fois pour toutes en un maillage statique (buste + tête,
   le bas du corps est caché par la carrosserie). Aucun squelette ni animation par voiture : 1 appel de dessin,
   géométrie et matériaux partagés entre toutes les voitures. */
'use strict';

const DRV = { status: 'none', busts: [], mats: [] };

/* fige un personnage assis en maillage statique (positions déformées par le squelette, une seule fois) */
function bakeBust(kind, hair, clipName, phase) {
  const root = THREE.SkeletonUtils.clone(kind.scene);
  let mesh = null;
  root.traverse((o) => { if (o.isSkinnedMesh && !mesh) mesh = o; });
  mesh.geometry = kind.geos[0][hair % kind.geos[0].length];
  const mixer = new THREE.AnimationMixer(root), clip = PED.clips[clipName];
  if (clip) { const a = mixer.clipAction(clip); a.play(); mixer.update(phase * clip.duration); }
  root.updateMatrixWorld(true);
  const g = mesh.geometry, pos = g.attributes.position, n = pos.count, out = new Float32Array(n * 3), v = new THREE.Vector3();
  let maxY = -1e9;
  for (let i = 0; i < n; i++) {
    mesh.boneTransform(i, v); v.applyMatrix4(mesh.matrixWorld);
    out[i * 3] = v.x; out[i * 3 + 1] = v.y; out[i * 3 + 2] = v.z; if (v.y > maxY) maxY = v.y;
  }
  // on garde le haut du corps : tout triangle à moins de 0,85 m sous le sommet de la tête
  const cut = maxY - 0.85, idx = g.index.array, keep = [];
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t], b = idx[t + 1], c = idx[t + 2];
    if (out[a * 3 + 1] > cut && out[b * 3 + 1] > cut && out[c * 3 + 1] > cut) keep.push(a, b, c);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(out, 3));
  for (const k of ['uv', '_cloth']) if (g.attributes[k]) geo.setAttribute(k, g.attributes[k]);
  geo.setIndex(keep);
  geo.computeVertexNormals();
  // origine : sommet de la tête, centré sur la tête (pour poser le conducteur sous le toit)
  geo.computeBoundingBox();
  const bb = geo.boundingBox, hx = (bb.min.x + bb.max.x) / 2;
  // centre de la tête : moyenne des sommets les plus hauts (20 cm sous le sommet)
  let sz = 0, nz = 0;
  for (let i = 0; i < n; i++) if (out[i * 3 + 1] > maxY - 0.2) { sz += out[i * 3 + 2]; nz++; }
  geo.translate(-hx, -maxY, -(nz ? sz / nz : 0));
  geo.computeBoundingSphere();
  mixer.stopAllAction();
  return geo;
}
function setupDrivers() {
  if (DRV.status !== 'none' || typeof PED === 'undefined' || PED.status !== 'ok' || !THREE.SkeletonUtils) return false;
  DRV.status = 'ok';
  try {
    for (const sex of ['homme', 'femme']) for (let h = 0; h < 3; h++) DRV.busts.push(bakeBust(PED.kinds[sex], h, 'Sitting_Idle_Loop', 0.15 + h * 0.2));
    // 10 apparences (peau, cheveux, haut) partagées par toutes les voitures
    for (let i = 0; i < 10; i++) {
      const sex = i % 2 ? 'femme' : 'homme', kind = PED.kinds[sex];
      const m = pedMaterial(kind.src, kind.info);
      m.skinning = false; m.customProgramCacheKey = () => 'conducteur';
      const L = pedLook({ s: i * 37.3, lat: 0, pose: 1 }, i + 101);
      const u = m.userData.u;
      u.uSkin.value.copy(L.skin); u.uHair.value.copy(L.hairCol); u.uTop.value.copy(L.top); u.uBottom.value.copy(L.bottom);
      u.uShoe.value.copy(L.shoe); u.uSwim.value.copy(L.swimCol); u.uCloth.value.set(L.sleeve, L.legs, 1, 0);
      DRV.mats.push({ m, sex });
    }
  } catch (e) { console.warn('Conducteurs indisponibles', e); DRV.status = 'error'; return false; }
  // les voitures déjà construites reçoivent leur conducteur
  if (typeof buildPlayer === 'function' && playerMesh) buildPlayer();
  if (typeof clearTrafficMeshes === 'function') clearTrafficMeshes();
  if (typeof ghostMeshes !== 'undefined') for (const [peer, gm] of ghostMeshes) { scene.remove(gm.mesh); ghostMeshes.delete(peer); }
  if (state === 'garage' && typeof setGarageCar === 'function') setGarageCar();
  return true;
}
/* Place du conducteur mesurée sur la vraie carrosserie : on lance des rayons verticaux au-dessus de la
   place conducteur pour trouver le toit (hauteur et étendue avant/arrière). Calculé une fois par modèle. */
const seatCache = new Map();
function measureSeat(inner, car) {
  const d = car.d, key = car.id + (inner.children[0] && inner.children[0].userData.lod ? ':lod' : '');
  if (seatCache.has(key)) return seatCache.get(key);
  const meshes = [];
  inner.updateMatrixWorld(true);
  inner.traverse((o) => { if (o.isMesh && !o.isSprite && o.visible && o.geometry && o.geometry.attributes.position) meshes.push(o); });
  const ray = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0), from = new THREE.Vector3();
  const x = -d.W * 0.2, N = 40, tops = [];
  for (let i = 0; i <= N; i++) {
    const z = -d.L * 0.5 + (d.L * i) / N;
    from.set(x, d.H + 2, z); ray.set(from, down); ray.far = d.H + 2;
    const hit = meshes.length ? ray.intersectObjects(meshes, false)[0] : null;
    tops.push({ z, y: hit ? hit.point.y : -1 });
  }
  let maxY = -1; for (const t of tops) maxY = Math.max(maxY, t.y);
  let seat = null;
  if (maxY > d.H * 0.6) {
    // haut du pare-brise : premier point (depuis l'avant) à moins de 5 cm du sommet ; la tête est ~42 cm derrière
    const zW = tops.find((t) => t.y >= maxY - 0.05).z;
    let zEnd = zW; for (const t of tops) if (t.y > maxY - 0.09) zEnd = t.z;
    const zHead = Math.max(zW + 0.15, Math.min(zW + 0.42, zEnd - 0.3));
    // hauteur du toit juste au-dessus de la tête (interpolée sur le profil)
    const f = (zHead + d.L * 0.5) / d.L * N, i0 = Math.floor(f), a0 = tops[i0], a1 = tops[Math.min(N, i0 + 1)];
    const yRoof = Math.min(maxY, a0.y + (a1.y - a0.y) * (f - i0));
    seat = { x, z: zHead, top: yRoof - 0.13 };
  }
  seatCache.set(key, seat);
  return seat;
}
/* ajoute un conducteur dans une voiture (inner = groupe de la carrosserie, qui penche avec la suspension) */
function addDriver(inner, car, seed) {
  if (DRV.status !== 'ok' || !DRV.busts.length) return null;
  const R = mulberry32((seed >>> 0) + 7);
  const look = DRV.mats[(R() * DRV.mats.length) | 0];
  const busts = DRV.busts.filter((_, i) => (i < 3) === (look.sex === 'homme'));
  const d = car.d, m = new THREE.Mesh(busts[(R() * busts.length) | 0], look.m);
  let seat = null;
  try { seat = measureSeat(inner, car); } catch (e) { seat = null; }
  if (seat) m.position.set(seat.x, seat.top, seat.z);
  else {
    // pas de toit mesurable (silhouette procédurale) : estimation d'après les dimensions
    const mid = car.id === 'gallardo' || car.id === 'sf90';
    m.position.set(-d.W * 0.2, Math.min(d.H - 0.13, 1.33 + Math.max(0, d.H - 1.45) * 0.6), mid ? -d.L * 0.12 : -d.L * 0.02);
  }
  // le buste fait ~0,85 m : sur les voitures très basses on le rétrécit un peu pour qu'il reste dans l'habitacle
  const sc = Math.min(1, Math.max(0.86, (m.position.y - 0.35) / 0.85));
  m.scale.setScalar(sc * (0.97 + R() * 0.05));
  m.rotation.y = (R() - 0.5) * 0.12;
  m.castShadow = false; m.receiveShadow = false;
  m.name = 'conducteur';
  inner.add(m);
  return m;
}
