/* WaForSpeed — Vrais modèles 3D (GLB / glTF) et construction de toutes les voitures du jeu.
   Pour chaque voiture, makeCarMesh() utilise le vrai modèle s'il a été chargé,
   sinon la voiture provisoire de procedural.js. Le reste du jeu ne voit pas la différence. */
'use strict';

const realModels = new Map();
const envMats = new Set();   // matériaux des vrais modèles qui affichent les reflets   // id -> { root, repaint, tris }
const modelStatus = new Map();  // id -> 'none' | 'loading' | 'ok' | 'error'
const MODEL_RX = {
  paint: /(car_?paint|paint|body|carros|kaross|exterior|lack)/i,
  notPaint: /(glass|window|vitre|tire|tyre|pneu|rim|jante|wheel|chrome|light|lamp|feu|interior|seat|plate|grill|black|trim|rubber|mirror_glass)/i,
  tail: /(tail|brake|rear.?light|stop.?light|backlight|feu.?arr)/i,
  head: /(head.?light|front.?light|phare)/i
};

/* chargeurs selon le format : GLB / glTF (déjà chargé) ou Collada .dae (chargé à la demande) */
const COLLADA_URLS = ['https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/TGALoader.js', 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/ColladaLoader.js'];
let colladaReady = null;
function loadScript(src) {
  return new Promise((ok, ko) => { const el = document.createElement('script'); el.src = src; el.onload = ok; el.onerror = ko; document.head.appendChild(el); });
}
function getLoader(file) {
  if (/\.dae$/i.test(file)) {
    if (!colladaReady) colladaReady = THREE.ColladaLoader ? Promise.resolve() : COLLADA_URLS.reduce((p, u) => p.then(() => loadScript(u)), Promise.resolve());
    return colladaReady.then(() => new THREE.ColladaLoader());
  }
  return Promise.resolve(THREE.GLTFLoader ? new THREE.GLTFLoader() : null);
}
/* Chargement progressif : une voiture à la fois, la voiture du joueur d'abord.
   Sur ordinateur, toutes les voitures suivent en arrière-plan ; sur mobile, seulement
   celles qu'on affiche (garage, adversaire du duel), pour ne pas tout télécharger. */
const modelQueue = [];
let modelBusy = false;
function loadRealModels() {
  for (const car of CARS) modelStatus.set(car.id, 'none');
  requestModel(myCar.id);
  if (!isTouch) for (const car of CARS) requestModel(car.id, true);
}
function requestModel(id, later) {
  const spec = CAR_MODELS[id];
  if (!spec || !spec.file || modelStatus.get(id) !== 'none') return;
  const i = modelQueue.indexOf(id);
  if (i >= 0) { if (!later) { modelQueue.splice(i, 1); modelQueue.unshift(id); } return; }
  if (later) modelQueue.push(id); else modelQueue.unshift(id);
  nextModel();
}
function nextModel() {
  if (modelBusy || !modelQueue.length) return;
  const car = carById(modelQueue.shift()), spec = CAR_MODELS[car.id];
  modelBusy = true;
  modelStatus.set(car.id, 'loading');
  if (state === 'garage') renderGarageUI();
  const done = () => { modelBusy = false; nextModel(); };
  const fail = (e) => {
    console.warn('Modèle 3D introuvable ou illisible pour ' + car.name + ' (' + spec.file + '), voiture provisoire utilisée.', e);
    modelStatus.set(car.id, 'error');
    if (state === 'garage') renderGarageUI();
    done();
  };
  getLoader(spec.file).then((loader) => {
    if (!loader) throw new Error('chargeur indisponible');
    loader.load(spec.file, (res) => {
      try {
        // GLB/glTF et Collada renvoient tous deux une scène dans .scene
        realModels.set(car.id, prepareModel(res.scene, car, spec));
        modelStatus.set(car.id, 'ok');
        onModelReady(car);
      } catch (e) { fail(e); return; }
      done();
    }, undefined, fail);
  }).catch(fail);
}

/* Boîte englobante exacte (sommet par sommet). Box3.setFromObject de three r128 transforme la boîte
   locale de chaque pièce : pour une pièce tournée elle est bien trop grande (voiture qui flotte, mauvaise taille). */
const _pv = new THREE.Vector3();
function preciseBox(obj) {
  const box = new THREE.Box3();
  obj.updateWorldMatrix(true, true);
  obj.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    const pos = o.geometry.attributes.position, idx = o.geometry.index;
    if (!pos) return;
    const n = idx ? idx.count : pos.count;
    // seuls les sommets réellement dessinés comptent
    for (let i = 0; i < n; i++) { _pv.fromBufferAttribute(pos, idx ? idx.getX(i) : i).applyMatrix4(o.matrixWorld); box.expandByPoint(_pv); }
  });
  return box;
}

/* Met le modèle à l'échelle (longueur réelle de la voiture), le pose au sol,
   l'oriente avant vers -Z et repère les matériaux de carrosserie et de feux. */
function prepareModel(root, car, spec) {
  const wrap = new THREE.Group();
  wrap.add(root);
  // nettoyage : pièces animées par squelette (mal placées hors animation) et plans d'ombre plats sous la voiture
  root.updateMatrixWorld(true);
  const junk = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    if (o.isSkinnedMesh) { junk.push(o); return; }
    const b = preciseBox(o), sz = b.getSize(new THREE.Vector3());
    const dims = [sz.x, sz.y, sz.z].sort((p, q) => p - q);
    if (dims[2] > 1.5 && dims[0] < 0.002 * dims[2] && dims[1] > 0.4 * dims[2] && /plane|shadow|ombre|ground|floor/i.test(o.name + ' ' + (o.material.name || '') + ' Plane')) junk.push(o);
  });
  for (const o of junk) o.parent.remove(o);
  root.rotation.y = THREE.MathUtils.degToRad(spec.rotateY || 0);
  const v = new THREE.Vector3();
  let box = preciseBox(wrap);
  box.getSize(v);
  if (spec.rotateY === undefined && v.x > v.z) { root.rotation.y += Math.PI / 2; box = preciseBox(wrap); box.getSize(v); }
  root.scale.multiplyScalar(car.d.L / Math.max(v.z, 0.001));
  box = preciseBox(wrap);
  const c = box.getCenter(new THREE.Vector3());
  root.position.x -= c.x; root.position.z -= c.z; root.position.y -= box.min.y;
  splitWheels(wrap, car, spec);

  const rx = { paint: spec.paint ? new RegExp(spec.paint, 'i') : MODEL_RX.paint, tail: spec.tail ? new RegExp(spec.tail, 'i') : MODEL_RX.tail };
  let repaint = false, tris = 0;
  // un matériau peut servir à plusieurs pièces : on regarde les noms de toutes ses pièces
  const users = new Map();
  root.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry;
    tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (!users.has(m)) users.set(m, []);
      users.get(m).push((o.name || '') + ' ' + (o.parent ? o.parent.name || '' : ''));
    }
  });
  const NOT_LAMP = /(brake(?!.?l(ight|amp))|disc|disk|calip|callip|tire|tyre|rim|wheel|bottom|under|interior|seat|door)/i;
  for (const [m, names] of users) {
    const mn = m.name || '';
    // vrai si le nom du matériau correspond, ou si toutes les pièces qui l'utilisent correspondent
    const all = (re) => re.test(mn) || names.every((n) => re.test(n) && !NOT_LAMP.test(n));
    if (m.isMeshStandardMaterial) { if (!m.envMap) { m.envMap = MAT.env; m.envMapIntensity = 0.5; m.needsUpdate = true; } envMats.add(m); }
    if (spec.paint ? rx.paint.test(mn) : (all(rx.paint) && !MODEL_RX.notPaint.test(mn + ' ' + names.join(' ')))) { m.userData.wfs = 'paint'; repaint = true; }
    else if (all(rx.tail)) m.userData.wfs = 'tail';
    else if (all(MODEL_RX.head)) { m.userData.wfs = 'head'; if (m.emissive) { m.emissive.set(0xfff3dc); m.emissiveIntensity = 1; } }
  }
  // hauteur des feux arrière / phares du modèle (pour placer les halos)
  const lampAt = (tag) => { const b = new THREE.Box3(); wrap.traverse((o) => { if (o.isMesh && !Array.isArray(o.material) && o.material.userData.wfs === tag) b.union(preciseBox(o)); }); return b.isEmpty() ? null : b; };
  const tb = lampAt('tail'), hb = lampAt('head');
  const lampY = tb && tb.max.z > car.d.L * 0.3 && tb.getSize(new THREE.Vector3()).y < 0.5 ? (tb.min.y + tb.max.y) / 2 : null;
  const headY = hb && hb.min.z < -car.d.L * 0.3 && hb.getSize(new THREE.Vector3()).y < 0.5 ? (hb.min.y + hb.max.y) / 2 : null;
  return { lampY, headY, root: wrap, repaint: spec.repaint === false ? false : repaint, tris };
}

const repaintCache = new Map();
function repaintMat(m, hex) {
  const key = m.uuid + hex;
  if (!repaintCache.has(key)) {
    // même peinture pour toutes les voitures : vernis métallisé (les modèles d'origine ont des réglages très différents)
    const c = m.clone(); c.color.set(hex);
    if (c.isMeshStandardMaterial) { c.metalness = 0.45; c.roughness = 0.32; c.metalnessMap = null; c.roughnessMap = null; c.envMapIntensity = 0.9; c.emissive && c.emissive.set(0); c.needsUpdate = true; }
    repaintCache.set(key, c); if (c.envMap) envMats.add(c);
  }
  return repaintCache.get(key);
}
/* Le trafic n'utilise les vrais modèles qu'en graphismes « haute » et s'ils sont assez légers. */
const realInTraffic = (R) => quality === 'high' && !isTouch && R.tris < 120000;

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
      if (m.userData.wfs === 'tail' && (opts.tailMat || opts.hq)) { const t = m.clone(); tails.push(t); if (t.envMap) envMats.add(t); return t; }
      return m;
    });
    o.material = arr ? mats : mats[0];
  });
  const { wheels, rw } = rigWheels(obj, car, !opts.traffic);
  return {
    object: obj, wheels, rw, lampY: R.lampY, headY: R.headY,
    setBrake: (on) => { for (const t of tails) if (t.emissive) { t.emissive.set(0xff2040); t.emissiveIntensity = on ? 2.5 : 0.4; } }
  };
}

/* Roues d'un vrai modèle : on repère les nœuds nommés « wheel », « roue », « tire »…
   et on les accroche à un pivot (braquage) puis à un axe (rotation). Sans nœud de roue,
   la voiture roule simplement sans animation de roues. */
/* Certains modèles regroupent les 4 roues dans un seul objet (une pièce par matériau).
   On découpe alors cet objet en 4 morceaux, un par coin de la voiture, pour que chaque roue
   puisse braquer et tourner. Les objets sans nom reconnaissable sont aussi testés par leur forme :
   4 morceaux ronds posés au sol, de la taille d'une roue. */
function subGeometry(g, tris) {
  const src = g.index, map = new Map(), order = [];
  const vid = (t, k) => (src ? src.getX(t * 3 + k) : t * 3 + k);
  const idx = [];
  for (const t of tris) for (let k = 0; k < 3; k++) {
    const v = vid(t, k);
    if (!map.has(v)) { map.set(v, order.length); order.push(v); }
    idx.push(map.get(v));
  }
  const out = new THREE.BufferGeometry();
  for (const name in g.attributes) {
    const a = g.attributes[name], n = a.itemSize, arr = new a.array.constructor(order.length * n);
    const get = [a.getX, a.getY, a.getZ, a.getW];
    order.forEach((v, i) => { for (let c = 0; c < n; c++) arr[i * n + c] = get[c].call(a, v); });
    out.setAttribute(name, new THREE.BufferAttribute(arr, n, a.normalized));
  }
  out.setIndex(idx);
  return out;
}
function splitWheels(wrap, car, spec) {
  const rx = spec.wheel ? new RegExp(spec.wheel, 'i') : WHEEL_RX;
  wrap.updateMatrixWorld(true);
  const list = [];
  wrap.traverse((o) => { if (o.isMesh && !Array.isArray(o.material) && !o.isSkinnedMesh) list.push(o); });
  const p = new THREE.Vector3(), q = new THREE.Vector3(), r = new THREE.Vector3();
  for (const o of list) {
    const name = (o.name || '') + ' ' + (o.parent ? o.parent.name || '' : '') + ' ' + (o.material.name || '');
    if (/calip|callip|brake|etrier/i.test(name)) continue;
    const named = rx.test(name);
    const bb = preciseBox(o), sz = bb.getSize(new THREE.Vector3());
    if (bb.min.y > 0.12 || bb.max.y > car.d.rw * 2.8) continue;       // pas posé au sol, ou trop haut
    if (sz.x < 1.0 && sz.z < 1.0) { if (!named && looksLikeWheel(bb, sz, car)) o.userData.wfsWheel = true; continue; }   // déjà une seule roue
    const g = o.geometry, pos = g.attributes.position, nt = (g.index ? g.index.count : pos.count) / 3;
    const parts = { LF: [], RF: [], LB: [], RB: [] }, cen = [];
    for (let t = 0; t < nt; t++) {
      const v = (k) => (g.index ? g.index.getX(t * 3 + k) : t * 3 + k);
      p.fromBufferAttribute(pos, v(0)).applyMatrix4(o.matrixWorld);
      q.fromBufferAttribute(pos, v(1)).applyMatrix4(o.matrixWorld);
      r.fromBufferAttribute(pos, v(2)).applyMatrix4(o.matrixWorld);
      const cx = (p.x + q.x + r.x) / 3, cy = (p.y + q.y + r.y) / 3, cz = (p.z + q.z + r.z) / 3;
      cen.push(cy, cz, cx);
      parts[(cx > 0 ? 'R' : 'L') + (cz < 0 ? 'F' : 'B')].push(t);
    }
    // dans chaque coin, on ne garde que ce qui entoure le centre de la roue (médiane) ; le reste ne tourne pas
    const rest = [];
    for (const k in parts) {
      const list = parts[k]; if (!list.length) continue;
      // rayon de roue ≈ moitié de la hauteur de la pièce (posée au sol) ; deux passes pour recentrer
      const R = Math.min(bb.max.y, car.d.rw * 2.4) * 0.52, my = R;
      const med = (arr, j) => { const a = arr.map((t) => cen[t * 3 + j]).sort((x, y) => x - y); return a[a.length >> 1]; };
      let sel = list;
      for (let pass = 0; pass < 2; pass++) {
        const mz = med(sel, 1), mx = med(sel, 2);
        sel = list.filter((t) => Math.abs(cen[t * 3] - my) < R && Math.abs(cen[t * 3 + 1] - mz) < R && Math.abs(cen[t * 3 + 2] - mx) < 0.25);
        if (!sel.length) break;
      }
      const keep = new Set(sel);
      for (const t of list) if (!keep.has(t)) rest.push(t);
      parts[k] = sel;
    }
    const keys = Object.keys(parts).filter((k) => parts[k].length);
    if (keys.length < 4) continue;
    const subs = keys.map((k) => { const m = new THREE.Mesh(subGeometry(g, parts[k]), o.material); m.name = (o.name || 'roue') + '_wheel_' + k; return m; });
    // chaque morceau doit avoir la taille d'une roue
    const ok = subs.every((m) => {
      m.matrix.copy(o.matrixWorld); m.matrix.decompose(m.position, m.quaternion, m.scale); m.updateMatrixWorld(true);
      const b = preciseBox(m), s2 = b.getSize(new THREE.Vector3());
      return s2.z < 1.0 && s2.y < 1.0 && s2.x < 0.6 && (named || looksLikeWheel(b, s2, car));
    });
    if (!ok) continue;
    for (const m of subs) { m.userData.wfsWheel = true; m.castShadow = o.castShadow; wrap.add(m); }
    if (rest.length) { const m = new THREE.Mesh(subGeometry(g, rest), o.material); m.name = (o.name || '') + '_fixe'; m.matrix.copy(o.matrixWorld); m.matrix.decompose(m.position, m.quaternion, m.scale); wrap.add(m); }
    o.parent.remove(o);
  }
}
const looksLikeWheel = (b, s, car) => b.min.y < 0.08 && s.y > car.d.rw * 1.5 && s.y < car.d.rw * 2.6 && Math.abs(s.y - s.z) < 0.12 && s.x < 0.45;

const WHEEL_RX = /(wheel|roue|tire|tyre|pneu|(^|[^a-z])rim([^a-z]|$))/i;   // « rim » seul, pas « trim »
/* Roues d'un vrai modèle : on repère les morceaux de roue (nom contenant wheel, roue, tire, rim…),
   on les regroupe par coin de la voiture, puis chaque roue est accrochée à un pivot (braquage)
   et à un axe (rotation). Les étriers et le reste ne bougent pas. */
function rigWheels(obj, car, withBlur) {
  const spec = CAR_MODELS[car.id] || {};
  const rx = spec.wheel ? new RegExp(spec.wheel, 'i') : WHEEL_RX;
  obj.updateMatrixWorld(true);
  const groups = new Map();
  obj.traverse((o) => {
    if (!o.isMesh) return;
    const name = (o.name || '') + ' ' + (o.parent ? o.parent.name || '' : '') + ' ' + (Array.isArray(o.material) ? '' : o.material.name || '');
    if (!(rx.test(name) || o.userData.wfsWheel) || /calip|callip|brake|etrier/i.test(name)) return;
    const bb = preciseBox(o), c = bb.getCenter(new THREE.Vector3()), sz = bb.getSize(new THREE.Vector3());
    // une pièce de roue est près du sol et pas plus grande qu'une roue
    if (c.y > car.d.rw * 1.8 || sz.y > 1.0 || sz.z > 1.0) return;
    const key = (c.x > 0 ? 'R' : 'L') + (c.z < 0 ? 'F' : 'B');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(o);
  });
  const wheels = [];
  let rw = car.d.rw;
  for (const [key, meshes] of groups) {
    const box = new THREE.Box3();
    for (const m of meshes) box.union(preciseBox(m));
    const c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
    if (sz.y > 1.3 || sz.y < 0.25) continue;
    rw = sz.y / 2;
    const steerG = new THREE.Group(); steerG.position.copy(c);
    const spinG = new THREE.Group(); steerG.add(spinG);
    obj.add(steerG); obj.updateMatrixWorld(true);
    for (const m of meshes) spinG.attach(m);
    // disque de flou de vitesse sur la face extérieure : à haute vitesse les rayons deviennent flous
    // (comme sur une vraie photo) au lieu de « stroboscoper »
    let blur = null;
    if (withBlur && TEXS.wheelBlur) {
      blur = new THREE.Mesh(blurGeo, new THREE.MeshBasicMaterial({ map: TEXS.wheelBlur, transparent: true, opacity: 0, depthWrite: false, color: 0x8a8d94 }));
      const side = c.x > 0 ? 1 : -1;
      blur.scale.setScalar(sz.y * 0.43); blur.position.x = side * (sz.x / 2 + 0.006); blur.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
      steerG.add(blur);
    }
    wheels.push({ steer: steerG, spin: spinG, front: key[1] === 'F', blur });
  }
  return { wheels, rw };
}

/* Point d'entrée unique : construit une voiture (vraie ou provisoire) prête à poser sur la piste. */
function makeCarMesh(car, paintHex, opts = {}) {
  const real = realBody(car, paintHex, opts);
  const body = real || proceduralBody(car, paintHex, opts);
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
      if (real) lamp.visible = false;   // le vrai modèle a ses propres feux : on ne garde que le halo
      inner.add(lamp);
      const halo = new THREE.Sprite(MAT.blinkHalo);
      halo.scale.set(1.5, 1.5, 1); halo.position.set(side * (Wd / 2 - 0.05), y, z + Math.sign(z) * 0.08); halo.visible = false;
      inner.add(halo);
      list.push({ lamp, halo });
    }
  }
  const setLamp = (arr, on) => { for (const b of arr) { b.lamp.material = on ? MAT.blinkOn : MAT.blinkOff; b.halo.visible = on; } };
  // feux : halos arrière (rouges), feux de recul (blancs), phares (avant) ; allumés selon jour/nuit, frein, marche arrière
  if (!MAT.haloTail) {
    const sm = (c, o) => new THREE.SpriteMaterial({ map: TEXS.radial, color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false });
    MAT.haloTail = sm(0xff1a30, 0.55); MAT.haloBrake = sm(0xff2038, 1); MAT.haloRev = sm(0xf4f6ff, 0.7); MAT.haloHead = sm(0xfff1d6, 0.9);
    MAT.revGlow = new THREE.MeshBasicMaterial({ map: TEXS.radial, color: 0xdfe6ff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
  }
  const ly = real && real.lampY ? real.lampY : car.d.tail - 0.25, hy = real && real.headY ? real.headY : car.d.nose - 0.12;
  const lamps = { tail: [], rev: [], head: [] };
  for (const side of [-1, 1]) {
    const t = new THREE.Sprite(MAT.haloTail); t.position.set(side * (Wd / 2 - 0.18), ly, L / 2 + 0.06); t.scale.set(0.55, 0.55, 1); t.visible = false; inner.add(t); lamps.tail.push(t);
    if (!opts.traffic) {
      const r = new THREE.Sprite(MAT.haloRev); r.position.set(side * (Wd / 2 - 0.42), ly - 0.04, L / 2 + 0.07); r.scale.set(0.3, 0.3, 1); r.visible = false; inner.add(r); lamps.rev.push(r);
      const h = new THREE.Sprite(MAT.haloHead); h.position.set(side * (Wd / 2 - 0.25), hy, -L / 2 - 0.08); h.scale.set(0.9, 0.9, 1); h.visible = false; inner.add(h); lamps.head.push(h);
    }
  }
  const lightState = { k: '' };
  const setLights = (night, brake, rev) => {
    const k = (night ? 1 : 0) + (brake ? 2 : 0) + (rev ? 4 : 0);
    if (lightState.k === k) return; lightState.k = k;
    for (const t of lamps.tail) { t.visible = night || brake; t.material = brake ? MAT.haloBrake : MAT.haloTail; t.scale.setScalar(brake ? 0.9 : 0.55); }
    for (const r of lamps.rev) r.visible = !!rev;
    for (const h of lamps.head) h.visible = !!night;
    tg.visible = night || brake || rev; tg.material = rev ? MAT.revGlow : MAT.tailGlow;
    if (body.setBrake) body.setBrake(brake || night, rev);
  };
  const wheels = body.wheels || [], rw = body.rw || car.d.rw;
  g.userData = {
    inner, len: L, tailGlow: tg,
    /* clignotants : left / right allumés ou non (l'appelant gère le clignotement) */
    setIndicators: (left, right) => { setLamp(blinkers.left, left); setLamp(blinkers.right, right); },
    setLights, setBrake: (on, rev) => setLights(TOD === 'nuit', on, rev),
    /* braquage des roues avant (radians, + = à droite) et distance parcourue (mètres) */
    animWheels: (steerAngle, meters) => {
      const blurK = clamp((Math.abs(meters) / Math.max(1e-3, lastDt) - 6) / 14, 0, 0.92);
      // la caisse bouge (roulis, tangage, suspension) mais les roues restent posées sur la route
      const rz = inner.rotation.z, rx = inner.rotation.x, ly = inner.position.y;
      for (const w of wheels) {
        if (!w.base) w.base = w.steer.position.clone();
        const x = w.base.x, z = w.base.z;
        w.steer.position.y = w.base.y + clamp(-(ly + x * rz - z * rx), -0.07, 0.07);
        w.steer.rotation.z = -rz;
        // épure d'Ackermann : la roue intérieure au virage braque plus que l'extérieure
        if (w.front) { const inside = (steerAngle > 0) === (x > 0); w.steer.rotation.y = -steerAngle * (inside ? 1.12 : 0.9); }
        w.spin.rotation.x -= meters / rw;
        if (w.blur) { w.blur.material.opacity = blurK; w.blur.rotation.z += meters / rw * 0.05; }
      }
    }
  };
  return g;
}
let shadowGeo = null, glowGeo = null, blinkGeo = null, blurGeo = null;
let lastDt = 1 / 60;

/* Version lointaine d'une voiture : une seule géométrie (couleurs par sommet), roues comprises.
   Même silhouette, coût minimal : utilisée pour le trafic éloigné. */
const lowGeoCache = new Map();
const LOW_COLORS = { glass: '#0a0e16', trim: '#0c0d12', liner: '#08090c', seam: '#050608', tire: '#141416', rimIn: '#2a2c32',
  chrome: '#9aa0aa', rim: '#9aa0aa', disc: '#6d7078', head: '#fff3dc', tail: '#ff4868', plate: '#e8eaee', seat: '#3a2a22' };
function makeCarLow(car, paintHex) {
  const key = car.id + paintHex;
  if (!lowGeoCache.has(key)) {
    const m = buildModel(car), parts = [];
    for (const k in m.geos) parts.push([m.geos[k], k === 'paint' ? paintHex : k === 'roof' ? (car.roof || paintHex) : LOW_COLORS[k] || '#222222']);
    for (const w of m.wheelPos) for (const k in m.wheelGeo[w.side]) {
      const g = m.wheelGeo[w.side][k].clone(); g.translate(w.x, w.y, w.z); parts.push([g, LOW_COLORS[k] || '#222222']);
    }
    let n = 0;
    const list = parts.map(([g, c]) => { const q = g.index ? g.toNonIndexed() : g; n += q.attributes.position.count; return [q, new THREE.Color(c)]; });
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
    let o = 0;
    for (const [q, c] of list) {
      pos.set(q.attributes.position.array, o * 3); nor.set(q.attributes.normal.array, o * 3);
      for (let i = 0; i < q.attributes.position.count; i++) { col[(o + i) * 3] = c.r; col[(o + i) * 3 + 1] = c.g; col[(o + i) * 3 + 2] = c.b; }
      o += q.attributes.position.count;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.computeBoundingSphere();
    lowGeoCache.set(key, geo);
  }
  if (!MAT.carLow) { MAT.carLow = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.3, envMap: MAT.env, envMapIntensity: 0.4 }); envMats.add(MAT.carLow); }
  const g = new THREE.Group();
  g.rotation.order = 'YXZ';
  const inner = new THREE.Group();
  inner.add(new THREE.Mesh(lowGeoCache.get(key), MAT.carLow));
  g.add(inner);
  g.userData = { inner, len: car.d.L, tailGlow: { visible: true }, setBrake: () => {}, setLights: () => {}, setIndicators: () => {}, animWheels: () => {} };
  return g;
}

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
