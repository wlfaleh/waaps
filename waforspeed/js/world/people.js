/* WaForSpeed — Piétons réalistes : vrais personnages 3D animés (squelette + animations).
   Modèles : « Universal Base Characters » et « Universal Animation Library » de Quaternius (CC0),
   assemblés pour le jeu (models/people/) : 1 maillage skinné + 1 matériau (atlas) par personnage,
   coiffures choisies par plage d'indices, vêtements peints dans le shader (couleurs variées par personne).
   Le placement (PEOPLE, populatePeople, placeShop) reste dans life.js ; ici on affiche les plus proches
   du joueur avec un petit groupe de clones réutilisés (pool), sans rien allouer à chaque image.
   Si les modèles ne se chargent pas : aucun piéton (pas de silhouettes de repli). */
'use strict';

const PED_FILES = { homme: 'models/people/homme.json', femme: 'models/people/femme.json', anims: 'models/people/animations.json' };
const PED_RANGE = [-10, 115];          // tronçons (≈ 1,2 m) derrière / devant le joueur
const PED_WALK_SPEED = 1.1;            // vitesse (m/s) de l'animation de marche d'origine
const PED_JOG_SPEED = 2.9;             // vitesse (m/s) de l'animation de course légère d'origine
const PED_LAYER = 1;                   // calque à part : vus par la caméra du jeu, pas par la caméra des reflets
const PED_LOD_M = [16, 50];            // distances (m) des niveaux de détail
const PED_SHADOWS = 10;                // seuls les plus proches projettent une ombre
const PED_FULL = 8;                    // seuls les plus proches gardent le maillage complet
const PED = { status: 'none', kinds: {}, clips: {}, pool: [], frame: 0, keys: new Float64Array(1024) };

/* ---------- apparence : couleurs crédibles (peau, cheveux, vêtements) ---------- */
const _pc = (a) => a.map((h) => new THREE.Color(h));
const PED_SKIN = [[1.04, 1.02, 1.0], [1.0, 0.96, 0.93], [0.93, 0.84, 0.76], [0.8, 0.66, 0.55], [0.6, 0.45, 0.36], [0.44, 0.32, 0.25]].map((c) => new THREE.Vector3(...c));
const PED_HAIR = _pc(['#17110d', '#2a1b12', '#3e2817', '#5b3b22', '#8a6a3e', '#b89a68', '#5a2414', '#7d7a76']);
const PED_TOPS = _pc(['#f2f2ee', '#e9e4d8', '#1c2333', '#2b4a7a', '#8f1d24', '#2f5a43', '#d8b04a', '#141416', '#6a4b8c', '#c96f3b', '#7fa7c9', '#b9b2a6', '#d06a8a', '#3b4048', '#556b2f', '#efe0c4']);
const PED_BOTTOMS = _pc(['#2b3a55', '#25324a', '#3a4a66', '#17181c', '#2d2f33', '#6b6f75', '#c2b08c', '#8a7a5c', '#e8e4da', '#4a3b2c', '#1f2a3a']);
const PED_SHOES = _pc(['#f0f0ec', '#e6e3dc', '#18181a', '#2a2522', '#5a3a22', '#8a8f96', '#1d2a44']);
const PED_SWIM = _pc(['#d42a2f', '#1d6fb8', '#f2c230', '#141416', '#2f8f4f', '#ff6a00', '#e2558a', '#1aa3a3', '#f4f4f0']);

/* tire l'apparence d'une personne (une fois, déterministe selon sa place dans la liste) */
function pedLook(P, i) {
  const R = mulberry32(((P.s * 977) | 0) + i * 7919 + 13), pick = (a) => a[(R() * a.length) | 0];
  const beach = MAP.ground === 'beach';
  // baigneurs : allongés, debout sur la plage ou dans l'eau, et une partie des promeneurs côté mer
  const swim = P.pose === 2 || (beach && P.lat > RW + 8) || (beach && P.pose === 0 && P.lat > 0 && R() < 0.55);
  const sex = R() < 0.5 ? 'femme' : 'homme';
  const formal = !swim && R() < 0.18;
  return {
    sex, hair: (R() * 3) | 0, swim,
    skin: pick(PED_SKIN), hairCol: pick(PED_HAIR),
    top: formal ? pick([PED_TOPS[2], PED_TOPS[7], PED_TOPS[13], PED_TOPS[0]]) : pick(PED_TOPS),
    bottom: formal ? pick([PED_BOTTOMS[3], PED_BOTTOMS[4], PED_BOTTOMS[10]]) : pick(PED_BOTTOMS),
    shoe: formal ? PED_SHOES[2] : pick(PED_SHOES), swimCol: pick(PED_SWIM),
    // manches : 0,45 t-shirt, 1,95 manches longues (le poignet est à 2) ; bas : 1,9 pantalon, 0,72 short
    sleeve: formal || R() < 0.3 ? 1.95 : (sex === 'femme' && R() < 0.25 ? 0.12 : 0.45),
    legs: beach && !formal ? (R() < 0.6 ? 0.72 : 1.9) : (R() < 0.18 ? 0.72 : 1.9),
    walk: formal ? 'Walk_Formal_Loop' : 'Walk_Loop',
    idle: R() < 0.5 ? 'Idle_Loop' : 'Idle_Talking_Loop',
    sit: R() < 0.55 ? 'Sitting_Talking_Loop' : 'Sitting_Idle_Loop',
    scale: (sex === 'femme' ? 0.95 : 0.97) + R() * 0.08
  };
}

/* ---------- matériau : peau, yeux, cheveux, vêtements peints (un seul programme partagé) ---------- */
function pedMaterial(src, info) {
  const m = new THREE.MeshStandardMaterial({ map: src.map, normalMap: src.normalMap, roughness: 0.6, metalness: 0, skinning: true });
  if (src.normalScale) m.normalScale.copy(src.normalScale);
  const u = m.userData.u = {
    uSkin: { value: new THREE.Vector3(1, 1, 1) }, uHair: { value: new THREE.Color() }, uTop: { value: new THREE.Color() },
    uBottom: { value: new THREE.Color() }, uShoe: { value: new THREE.Color() }, uSwim: { value: new THREE.Color() },
    uCloth: { value: new THREE.Vector4(0.45, 1.9, 1, 0) },                    // manches, longueur du bas, habillé, -
    uBody: { value: new THREE.Vector4(info.neck[1], info.waistY, info.neck[2], 0) }   // articulation du cou (hauteur, profondeur), taille
  };
  m.customProgramCacheKey = () => 'pieton';
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 _cloth;\nvarying vec4 vCloth;\nvarying vec3 vBind;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvCloth = _cloth; vBind = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec4 vCloth; varying vec3 vBind; uniform vec3 uSkin; uniform vec3 uHair; uniform vec3 uTop; uniform vec3 uBottom; uniform vec3 uShoe; uniform vec3 uSwim;
        uniform vec4 uCloth; uniform vec4 uBody;`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        float part = vCloth.w, cm = 0.0;
        vec3 tex = diffuseColor.rgb;
        float lum = dot(tex, vec3(0.299, 0.587, 0.114));
        if (part < 0.5) {
          // corps : la peau garde la texture (visage, mains), teinte selon la personne
          float sat = max(tex.r, max(tex.g, tex.b)) - min(tex.r, min(tex.g, tex.b));
          float under = 1.0 - smoothstep(0.05, 0.13, sat);            // sous-vêtements gris du modèle d'origine
          vec3 skin = tex * uSkin;
          float arm = vCloth.x, y = vCloth.y, leg = vCloth.z;
          float isArm = step(-0.5, arm), isLeg = step(-0.5, leg), dressed = uCloth.z;
          // col rond : on découvre le cou (distance à l'axe du cou, en pose de repos)
          float hd = length(vec2(vBind.x, (vBind.z - uBody.z) * 1.15)), ny = y - uBody.x;
          float collar = 1.0 - step(0.0, ny + 0.05) * step(hd, 0.085 + max(0.0, -ny) * 0.4);
          float top = dressed * collar * step(ny, 0.05) * max((1.0 - isArm) * (1.0 - isLeg) * step(uBody.y, y), isArm * step(arm, uCloth.x));
          float bot = dressed * (1.0 - isArm) * step(y, uBody.y + 0.001) * (1.0 - isLeg * step(uCloth.y, leg));
          float shoe = isLeg * step(1.93, leg);
          vec3 base = mix(skin, uSwim * (0.25 + lum * 1.6), under * (1.0 - dressed));
          // vêtements : couleur unie, un peu du relief de la texture pour les plis et l'ombre
          float shade = mix(1.0, clamp(lum / 0.5, 0.55, 1.2), 0.3);
          float hem = 1.0 - 0.25 * (1.0 - smoothstep(0.0, 0.035, abs(arm - uCloth.x))) * isArm * dressed;
          vec3 cloth = shoe > 0.5 ? uShoe : (top > 0.5 ? uTop : uBottom);
          cm = max(max(top, bot), shoe);
          diffuseColor.rgb = mix(base, cloth * shade * hem, cm);
        } else if (part > 1.5) {
          diffuseColor.rgb = uHair * (0.35 + lum * 1.25);              // sourcils et cheveux : texture grise teintée
        }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = part < 0.5 ? mix(0.52, 0.9, cm) : (part < 1.5 ? 0.15 : 0.72);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        normal = normalize(mix(normal, geometryNormal, cm * 0.85));`);   // tissus : pas les muscles du modèle nu
  };
  return m;
}
function pedDress(c, L) {
  const u = c.mat.userData.u;
  u.uSkin.value.copy(L.skin); u.uHair.value.copy(L.hairCol); u.uTop.value.copy(L.top); u.uBottom.value.copy(L.bottom);
  u.uShoe.value.copy(L.shoe); u.uSwim.value.copy(L.swimCol);
  u.uCloth.value.set(L.sleeve, L.legs, L.swim ? 0 : 1, 0);
  c.hair = L.hair; c.lod = -1;
  c.root.scale.setScalar(L.scale);
}

/* ---------- chargement ---------- */
function pedLoad() {
  if (PED.status !== 'none' || !THREE.GLTFLoader || !THREE.SkeletonUtils) { if (PED.status === 'none') PED.status = 'error'; return; }
  PED.status = 'loading';
  const loader = new THREE.GLTFLoader();
  const get = (url) => new Promise((ok, ko) => loader.load(url, ok, undefined, ko));
  Promise.all([get(PED_FILES.homme), get(PED_FILES.femme), get(PED_FILES.anims)]).then(([h, f, a]) => {
    for (const clip of a.animations) PED.clips[clip.name] = clip;
    PED.kinds.homme = pedKind(h); PED.kinds.femme = pedKind(f);
    const n = isTouch ? 12 : quality === 'high' ? 30 : 18;
    for (let i = 0; i < n; i++) PED.pool.push(pedClone(i % 2 ? PED.kinds.femme : PED.kinds.homme));
    camera.layers.enable(PED_LAYER);
    PED.status = 'ok';
  }).catch((e) => { console.warn('Piétons 3D indisponibles (models/people/), aucun piéton affiché.', e); PED.status = 'error'; });
}
function pedKind(gltf) {
  let mesh = null;
  gltf.scene.traverse((o) => { if (o.isSkinnedMesh && !mesh) mesh = o; });
  const info = mesh.geometry.userData && Object.keys(mesh.geometry.userData).length ? mesh.geometry.userData : mesh.userData;
  const g0 = mesh.geometry, idx = g0.index.array;
  const sphere = new THREE.Sphere(new THREE.Vector3(0, 0.9, 0), 1.4), box = new THREE.Box3(new THREE.Vector3(-1, -0.3, -1), new THREE.Vector3(1, 2.1, 1));
  // par niveau de détail et par coiffure : mêmes attributs (même mémoire GPU), indices = corps + coiffure
  const lods = info.lods || [{ base: [0, info.baseCount], hairs: info.hairRanges }];
  const geos = lods.map((l) => l.hairs.map(([start, count]) => {
    const [b0, bn] = l.base, ia = new idx.constructor(bn + count);
    ia.set(idx.subarray(b0, b0 + bn), 0); ia.set(idx.subarray(start, start + count), bn);
    const g = new THREE.BufferGeometry();
    for (const k in g0.attributes) g.setAttribute(k, g0.attributes[k]);
    g.setIndex(new THREE.BufferAttribute(ia, 1));
    g.boundingSphere = sphere; g.boundingBox = box;
    return g;
  }));
  // mobile : atlas couleur réduit à 1024 px (mémoire)
  const src = mesh.material;
  if (isTouch && src.map && src.map.image && src.map.image.width > 1024) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 1024;
    cv.getContext('2d').drawImage(src.map.image, 0, 0, 1024, 1024);
    if (src.map.image.close) src.map.image.close();
    src.map.image = cv; src.map.needsUpdate = true;
  }
  src.map.anisotropy = 2;
  return { scene: gltf.scene, mesh, geos, info, src };
}
function pedClone(kind) {
  const root = THREE.SkeletonUtils.clone(kind.scene);
  let mesh = null;
  root.traverse((o) => { if (o.isSkinnedMesh) mesh = o; });
  const mat = pedMaterial(kind.src, kind.info);
  mesh.material = mat; mesh.castShadow = !isTouch; mesh.receiveShadow = false;
  const mixer = new THREE.AnimationMixer(root), actions = {};
  for (const name in PED.clips) actions[name] = mixer.clipAction(PED.clips[name]);
  root.visible = false;
  root.traverse((o) => o.layers.set(PED_LAYER));
  scene.add(root);
  return { root, mesh, mat, mixer, actions, kind, P: null, cur: null, sex: kind === PED.kinds.femme ? 'femme' : 'homme' };
}
function pedPlay(c, name, t) {
  const a = c.actions[name];
  if (!a || c.cur === a) return;
  if (c.cur) c.cur.stop();
  a.reset(); a.play(); a.time = t * a.getClip().duration; c.cur = a;
}

/* ---------- chaque image ---------- */
const _pdp = {};
function pedRelease(c) { c.root.visible = false; if (c.P) c.P._ped = null; c.P = null; if (c.cur) c.cur.stop(); c.cur = null; }
function updatePeopleReal(dt, sP) {
  if (PED.status === 'none') pedLoad();
  const len = segments.length, aP = sP / SEG, aMod = ((aP % len) + len) % len;
  // les marcheurs avancent tous, même invisibles (comme avant)
  for (const P of PEOPLE) if (P.pose === 0) { P.s += P.dir * P.v / SEG_M * dt; if (P.s >= len) P.s -= len; if (P.s < 0) P.s += len; }
  if (PED.status !== 'ok') return;
  const frame = ++PED.frame, pool = PED.pool;
  // 1. les plus proches (devant comptent plus que derrière), un petit bonus pour ceux déjà affichés (pas de clignotement)
  let nk = 0;
  if (PED.keys.length < PEOPLE.length) PED.keys = new Float64Array(PEOPLE.length * 2);
  const keys = PED.keys;
  for (let i = 0; i < PEOPLE.length; i++) {
    const P = PEOPLE[i];
    let rel = P.s - aMod; if (rel > len / 2) rel -= len; if (rel < -len / 2) rel += len;
    P._rel = rel;
    if (rel < PED_RANGE[0] || rel > PED_RANGE[1]) continue;
    const sc = Math.max(0, (rel >= 0 ? rel : -rel * 2.5) + Math.abs(P.lat) * 0.15 - (P._ped ? 6 : 0));
    keys[nk++] = Math.floor(sc * 64) * 65536 + i;
  }
  const sub = keys.subarray(0, nk); sub.sort();
  const want = Math.min(nk, pool.length);
  for (let k = 0; k < want; k++) { const P = PEOPLE[sub[k] % 65536]; P._sel = frame; P._rank = k; }
  for (const c of pool) if (c.P && c.P._sel !== frame) pedRelease(c);
  // 2. attribuer un clone libre (du bon sexe) aux nouveaux
  for (let k = 0; k < want; k++) {
    const i = sub[k] % 65536, P = PEOPLE[i];
    if (P._ped) continue;
    if (!P._look) P._look = pedLook(P, i);
    let c = null;
    for (const q of pool) if (!q.P && q.sex === P._look.sex) { c = q; break; }
    if (!c) continue;
    c.P = P; P._ped = c; c.root.visible = true; c.ph = (P.ph || 0) / 6.283;
    pedDress(c, P._look);
    c.pose = -1;
  }
  // 3. placer et animer
  const carLat = playerX * RW;
  for (const c of pool) {
    const P = c.P;
    if (!P) continue;
    const rel = P._rel, L = P._look;
    // une voiture arrive sur le trottoir : la personne s'écarte vers les façades
    if (Math.abs(rel) < 6 && Math.abs(carLat - P.lat) < 2.4) P.dodge = Math.min(1, P.dodge + dt * 4); else P.dodge = Math.max(0, P.dodge - dt * 0.5);
    const side = Math.sign(P.lat) || 1, lat = P.lat + side * P.dodge * 2.6;
    const tp = trackPoint((aP + rel) * SEG, lat, _pdp);
    curZone = zoneAt(Math.floor(P.s));
    const gy = P.y || groundY(side, Math.abs(lat));
    c.root.position.set(tp.x, tp.y + gy, tp.z);
    let yaw = -tp.th, pitch = 0, anim, rate = 1;
    if (P.pose === 0) {
      yaw += P.dir > 0 ? 0 : Math.PI;
      if (P.dodge > 0.05) { const out = Math.atan2(side * Math.cos(tp.th), side * Math.sin(tp.th)); yaw += Math.atan2(Math.sin(out - yaw), Math.cos(out - yaw)) * Math.min(1, P.dodge * 1.5); }
      const v = P.v * (1 + P.dodge * 0.6);
      if (v > 2.2) { anim = 'Jog_Fwd_Loop'; rate = v / PED_JOG_SPEED; } else { anim = L.walk; rate = v / PED_WALK_SPEED; }
    } else if (P.pose === 1) { yaw += P.yaw === 0 ? Math.PI : 0; anim = L.sit; c.root.position.y += PED_SIT_DY; }
    else if (P.pose === 2) {
      // allongé sur sa serviette (dans l'axe de la serviette, centré dessus), immobile
      yaw = -tp.th - (P.yaw || 0); pitch = -Math.PI / 2; anim = 'Idle_Loop'; rate = 0;
      c.root.position.x += Math.sin(yaw) * 0.86 * L.scale; c.root.position.z += Math.cos(yaw) * 0.86 * L.scale; c.root.position.y += 0.11;
    }
    else { yaw += P.yaw || 0; anim = L.idle; }
    if (P.pose === 1) { c.root.position.x += Math.sin(yaw) * PED_SIT_FWD; c.root.position.z += Math.cos(yaw) * PED_SIT_FWD; }   // le bassin de l'animation est en retrait des pieds
    c.root.rotation.set(pitch, yaw, 0, 'YXZ');
    const dm = Math.abs(rel) * SEG_M, lod = dm < PED_LOD_M[0] && P._rank < PED_FULL ? 0 : dm < PED_LOD_M[1] ? 1 : 2, kg = c.kind.geos;
    if (lod !== c.lod) { c.lod = lod; c.mesh.geometry = kg[Math.min(lod, kg.length - 1)][c.hair]; }
    c.mesh.castShadow = !isTouch && P._rank < PED_SHADOWS;
    if (c.pose !== anim) { pedPlay(c, anim, c.ph); c.pose = anim; c.mixer.update(0); }
    if (rate > 0) c.mixer.update(dt * rate / L.scale);
  }
}
const PED_SIT_DY = 0, PED_SIT_FWD = 0.3;
