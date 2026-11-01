/* WaForSpeed — Vrais modèles 3D (GLB / glTF) et construction de toutes les voitures du jeu.
   Pour chaque voiture, makeCarMesh() utilise le vrai modèle s'il a été chargé,
   sinon la voiture provisoire de procedural.js. Le reste du jeu ne voit pas la différence. */
'use strict';

const realModels = new Map();   // id -> { root, repaint, tris }
const modelStatus = new Map();  // id -> 'none' | 'loading' | 'ok' | 'error'
const MODEL_RX = {
  paint: /(car_?paint|paint|body|carros|kaross|exterior|lack)/i,
  notPaint: /(glass|window|vitre|tire|tyre|pneu|rim|jante|wheel|chrome|light|lamp|feu|interior|seat|plate|grill|black|trim|rubber|mirror_glass)/i,
  tail: /(tail|brake|rear.?light|stop.?light|backlight|feu.?arr)/i,
  head: /(head.?light|front.?light|phare)/i
};

function loadRealModels() {
  for (const car of CARS) modelStatus.set(car.id, 'none');
  if (!THREE.GLTFLoader) return;
  const loader = new THREE.GLTFLoader();
  for (const car of CARS) {
    const spec = CAR_MODELS[car.id];
    if (!spec || !spec.file) continue;
    modelStatus.set(car.id, 'loading');
    loader.load(spec.file, (gltf) => {
      try {
        realModels.set(car.id, prepareModel(gltf.scene, car, spec));
        modelStatus.set(car.id, 'ok');
        onModelReady(car);
      } catch (e) { console.warn('Modèle 3D inutilisable pour ' + car.name, e); modelStatus.set(car.id, 'error'); }
    }, undefined, (e) => {
      console.warn('Modèle 3D introuvable pour ' + car.name + ' (' + spec.file + '), voiture provisoire utilisée.', e);
      modelStatus.set(car.id, 'error');
      if (state === 'garage') renderGarageUI();
    });
  }
}

/* Met le modèle à l'échelle (longueur réelle de la voiture), le pose au sol,
   l'oriente avant vers -Z et repère les matériaux de carrosserie et de feux. */
function prepareModel(root, car, spec) {
  const wrap = new THREE.Group();
  wrap.add(root);
  root.rotation.y = THREE.MathUtils.degToRad(spec.rotateY || 0);
  const v = new THREE.Vector3();
  let box = new THREE.Box3().setFromObject(wrap);
  box.getSize(v);
  if (spec.rotateY === undefined && v.x > v.z) { root.rotation.y += Math.PI / 2; box = new THREE.Box3().setFromObject(wrap); box.getSize(v); }
  root.scale.multiplyScalar(car.d.L / Math.max(v.z, 0.001));
  box = new THREE.Box3().setFromObject(wrap);
  const c = box.getCenter(new THREE.Vector3());
  root.position.x -= c.x; root.position.z -= c.z; root.position.y -= box.min.y;

  const rx = { paint: spec.paint ? new RegExp(spec.paint, 'i') : MODEL_RX.paint, tail: spec.tail ? new RegExp(spec.tail, 'i') : MODEL_RX.tail };
  let repaint = false, tris = 0;
  root.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry;
    tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      const n = (m.name || '') + ' ' + (o.name || '');
      if (m.isMeshStandardMaterial && !m.envMap) { m.envMap = MAT.env; m.envMapIntensity = 0.5; m.needsUpdate = true; }
      if (rx.tail.test(n)) m.userData.wfs = 'tail';
      else if (MODEL_RX.head.test(n)) { m.userData.wfs = 'head'; if (m.emissive) { m.emissive.set(0xfff3dc); m.emissiveIntensity = 1; } }
      else if (rx.paint.test(n) && !MODEL_RX.notPaint.test(n)) { m.userData.wfs = 'paint'; repaint = true; }
    }
  });
  return { root: wrap, repaint: spec.repaint === false ? false : repaint, tris };
}

const repaintCache = new Map();
function repaintMat(m, hex) {
  const key = m.uuid + hex;
  if (!repaintCache.has(key)) { const c = m.clone(); c.color.set(hex); repaintCache.set(key, c); }
  return repaintCache.get(key);
}
/* Le trafic n'utilise les vrais modèles qu'en graphismes « haute » et s'ils sont assez légers. */
const realInTraffic = (R) => quality === 'high' && R.tris < 120000;

function realBody(car, paintHex, opts) {
  const R = realModels.get(car.id);
  if (!R || (opts.traffic && !realInTraffic(R))) return null;
  const obj = R.root.clone(true);
  const tails = [];
  obj.traverse((o) => {
    if (!o.isMesh) return;
    const arr = Array.isArray(o.material);
    const mats = (arr ? o.material : [o.material]).map((m) => {
      if (m.userData.wfs === 'paint' && R.repaint) return repaintMat(m, paintHex);
      if (m.userData.wfs === 'tail' && opts.tailMat) { const t = m.clone(); tails.push(t); return t; }
      return m;
    });
    o.material = arr ? mats : mats[0];
  });
  const { wheels, rw } = rigWheels(obj, car);
  return {
    object: obj, wheels, rw,
    setBrake: (on) => { for (const t of tails) if (t.emissive) { t.emissive.set(0xff2040); t.emissiveIntensity = on ? 2.5 : 0.7; } }
  };
}

/* Roues d'un vrai modèle : on repère les nœuds nommés « wheel », « roue », « tire »…
   et on les accroche à un pivot (braquage) puis à un axe (rotation). Sans nœud de roue,
   la voiture roule simplement sans animation de roues. */
const WHEEL_RX = /(wheel|roue|tire|tyre|pneu)/i;
function rigWheels(obj, car) {
  const spec = CAR_MODELS[car.id] || {};
  const rx = spec.wheel ? new RegExp(spec.wheel, 'i') : WHEEL_RX;
  const found = [];
  obj.traverse((o) => {
    if (!rx.test(o.name || '')) return;
    for (let p = o.parent; p; p = p.parent) if (found.includes(p)) return;
    found.push(o);
  });
  obj.updateMatrixWorld(true);
  const wheels = [];
  let rw = car.d.rw;
  for (const node of found) {
    const box = new THREE.Box3().setFromObject(node);
    if (box.isEmpty()) continue;
    const c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
    if (sz.y > 1.2 || sz.y < 0.2) continue;
    rw = sz.y / 2;
    const steerG = new THREE.Group(); steerG.position.copy(c);
    const spinG = new THREE.Group(); steerG.add(spinG);
    obj.add(steerG); obj.updateMatrixWorld(true);
    spinG.attach(node);
    wheels.push({ steer: steerG, spin: spinG, front: c.z < 0 });
  }
  return { wheels, rw };
}

/* Point d'entrée unique : construit une voiture (vraie ou provisoire) prête à poser sur la piste. */
function makeCarMesh(car, paintHex, opts = {}) {
  const body = realBody(car, paintHex, opts) || proceduralBody(car, paintHex, opts);
  const L = car.d.L, Wd = car.d.W;
  const g = new THREE.Group();
  g.rotation.order = 'YXZ';
  const inner = new THREE.Group();
  inner.add(body.object);
  body.object.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = !o.material.isMeshBasicMaterial; } });
  g.add(inner);
  const sh = new THREE.Mesh(shadowGeo, MAT.shadow);
  sh.scale.set(Wd * 1.5, 1, L * 1.25); sh.position.y = 0.02; g.add(sh);
  const tg = new THREE.Mesh(glowGeo, MAT.tailGlow);
  tg.scale.set(Wd * 1.6, 1, 2.6); tg.position.set(0, 0.03, L / 2 + 0.9); g.add(tg);
  if (opts.glow) {
    const ug = new THREE.Mesh(glowGeo, new THREE.MeshBasicMaterial({ map: TEXS.radial, color: new THREE.Color(opts.glow), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
    ug.scale.set(Wd * 2.2, 1, L * 1.35); ug.position.y = 0.04; g.add(ug);
  }
  // clignotants : un feu orange à chaque coin + un halo bien visible de loin
  const blinkers = { left: [], right: [] };
  const by = car.d.tail - 0.22, fy = car.d.nose - 0.14;
  for (const side of [-1, 1]) {
    const list = side < 0 ? blinkers.left : blinkers.right;
    for (const [z, y, w] of [[L / 2 + 0.03, by, 0.2], [-L / 2 - 0.03, fy, 0.16]]) {
      const lamp = new THREE.Mesh(blinkGeo, MAT.blinkOff);
      lamp.scale.set(w, 0.09, 0.04); lamp.position.set(side * (Wd / 2 - 0.1), y, z);
      inner.add(lamp);
      const halo = new THREE.Sprite(MAT.blinkHalo);
      halo.scale.set(1.5, 1.5, 1); halo.position.set(side * (Wd / 2 - 0.05), y, z + Math.sign(z) * 0.08); halo.visible = false;
      inner.add(halo);
      list.push({ lamp, halo });
    }
  }
  const setLamp = (arr, on) => { for (const b of arr) { b.lamp.material = on ? MAT.blinkOn : MAT.blinkOff; b.halo.visible = on; } };
  const wheels = body.wheels || [], rw = body.rw || car.d.rw;
  g.userData = {
    inner, len: L, tailGlow: tg,
    /* clignotants : left / right allumés ou non (l'appelant gère le clignotement) */
    setIndicators: (left, right) => { setLamp(blinkers.left, left); setLamp(blinkers.right, right); }, setBrake: body.setBrake || (() => {}),
    /* braquage des roues avant (radians, + = à droite) et distance parcourue (mètres) */
    animWheels: (steerAngle, meters) => {
      const blurK = clamp((Math.abs(meters) / Math.max(1e-3, lastDt) - 6) / 14, 0, 0.92);
      for (const w of wheels) {
        if (w.front) w.steer.rotation.y = -steerAngle;
        w.spin.rotation.x -= meters / rw;
        if (w.blur) { w.blur.material.opacity = blurK; w.blur.rotation.z += meters / rw * 0.05; }
      }
    }
  };
  return g;
}
let shadowGeo = null, glowGeo = null, blinkGeo = null, blurGeo = null;
let lastDt = 1 / 60;

/* Un vrai modèle vient d'arriver : on remplace les voitures provisoires déjà affichées. */
function onModelReady(car) {
  if (myCar.id === car.id) buildPlayer();
  if (state === 'garage') { if (myCar.id === car.id) setGarageCar(); renderGarageUI(); }
  for (const c of cars) if (c.mesh && CARS[c.type] === car) { scene.remove(c.mesh); c.mesh = null; }
  for (const [peer, gm] of ghostMeshes) if (gm.car === car.id) { scene.remove(gm.mesh); ghostMeshes.delete(peer); }
}
function modelNote(car) {
  const st = modelStatus.get(car.id), spec = CAR_MODELS[car.id] || {};
  if (st === 'ok') return spec.credit ? 'Modèle 3D : ' + spec.credit : '';
  if (st === 'loading') return 'Chargement du modèle 3D…';
  if (st === 'error') return 'Le modèle 3D n\'a pas pu être chargé : voiture provisoire affichée.';
  return 'Voiture provisoire : le vrai modèle 3D sera ajouté bientôt.';
}
