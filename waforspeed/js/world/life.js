/* WaForSpeed — Vie dans les rues : piétons animés, cafés / restaurants / bars avec terrasses,
   plages (paillotes, serviettes, baigneurs, écume) et arbres plus réalistes.
   Principes (skill waforspeed-3d) : un seul InstancedMesh pour tous les piétons (1 appel de dessin),
   animation de la marche dans le shader (aucun calcul par os sur le processeur), décor fusionné par tronçon. */
'use strict';

/* ================= Piétons ================= */
const PEOPLE = [];   // { s: segment (flottant), lat: m (signé), pose: 0 marche 1 assis 2 allongé 3 debout, dir, v, yaw, colors, ph }
const PEOPLE_MAX = 220;
/* les silhouettes géométriques ne font pas assez réel : piétons masqués tant que de vrais modèles animés ne sont pas intégrés */
let PEOPLE_ON = false;
const _C = (arr) => (THREE ? arr.map((h) => new THREE.Color(h)) : []);
const SKINS = _C(['#f1c7a5', '#e0ac85', '#c68a62', '#8d5a3b', '#5c3a26', '#f6d6bd']);
const SHIRTS = _C(['#e8e8e8', '#1d3f8f', '#b3122b', '#2f6f4f', '#f2c14e', '#111216', '#7a4fa0', '#ff8a3d', '#5aa7d6', '#d9d0c0', '#c94f7c', '#3b3f48']);
const PANTS = _C(['#2a3550', '#1a1b20', '#6b5a44', '#3d4a5c', '#c9b28a', '#4a4f57', '#1d3f8f', '#e8e2d4']);
const SWIM = _C(['#e2262b', '#1d8fb8', '#ffd23a', '#111216', '#2f8f4f', '#ff6a00']);
let peopleMesh = null, peopleU = null;

/* ajoute une personne (appelé pendant la génération du décor) */
function addPerson(s, lat, pose, o = {}) {
  const R = Math.random;
  PEOPLE.push({ s, lat, pose, dir: o.dir || (R() < 0.5 ? -1 : 1), v: o.v || (1.1 + R() * 0.6), yaw: o.yaw || 0,
    skin: SKINS[(R() * SKINS.length) | 0], shirt: o.swim ? SKINS[(R() * SKINS.length) | 0] : SHIRTS[(R() * SHIRTS.length) | 0],
    pants: o.swim ? SWIM[(R() * SWIM.length) | 0] : PANTS[(R() * PANTS.length) | 0], ph: R() * 6.28, home: lat, dodge: 0, y: o.y || 0 });
}

/* piétons qui marchent sur les trottoirs (selon la zone) */
function populatePeople(map) {
  const len = segments.length, R = mulberry32(map.seed * 13 + 5);
  for (let n = 0; n < len; n += 3) {
    const z = segments[n].zone;
    const walk = (side, a, b, p) => { if (R() < p) addPerson(n + R() * 3, side * (a + R() * (b - a)), 0); };
    if (map.ground === 'city') {
      if (z === 'port') { walk(-1, RW + 1.5, RW + 4.5, 0.06); walk(1, RW + 1.5, RW + 4.5, 0.06); continue; }
      const k = z === 'centre' ? 0.55 : z === 'parc' ? 0.35 : 0.4;
      walk(-1, RW + 1.4, RW + 3.2, k); walk(1, RW + 1.4, RW + 3.2, k);
      if (z === 'parc' && R() < 0.3) addPerson(n, (segments[n].parkSide || 1) * (RW + 9 + R() * 30), 0, { v: 2.6 });   // joggeurs
    } else if (map.ground === 'beach') {
      walk(1, RW + 1, RW + 4.5, z === 'rochers' ? 0.1 : 0.5);
      walk(-1, RW + 0.8, RW + 2.6, z === 'village' || z === 'marina' ? 0.35 : 0.15);
    } else if (map.ground === 'country' && z === 'village') {
      walk(-1, RW + 0.3, RW + 1.4, 0.25); walk(1, RW + 0.3, RW + 1.4, 0.25);
    } else if (map.ground === 'circuit' && z === 'paddock') {
      if (R() < 0.35) addPerson(n, (segments[n].pitSide || 1) * (RW + 5 + R() * 6), 3);
    }
  }
}

/* géométrie d'une personne (1,75 m), une valeur aPart par sommet pour l'animation et les couleurs */
function personGeometry() {
  const parts = [];
  const add = (geo, part, x, y, z) => { const g = geo.toNonIndexed(); g.translate(x, y, z); const n = g.attributes.position.count; g.setAttribute('aPart', new THREE.Float32BufferAttribute(new Array(n).fill(part), 1)); parts.push(g); };
  const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  add(B(0.15, 0.84, 0.17), 2, -0.1, 0.46, 0); add(B(0.15, 0.84, 0.17), 3, 0.1, 0.46, 0);            // jambes
  add(B(0.15, 0.08, 0.27), 6, -0.1, 0.04, -0.05); add(B(0.15, 0.08, 0.27), 7, 0.1, 0.04, -0.05);   // chaussures
  add(B(0.4, 0.6, 0.23), 1, 0, 1.17, 0);                                                            // buste
  add(B(0.1, 0.6, 0.11), 4, -0.26, 1.15, 0); add(B(0.1, 0.6, 0.11), 5, 0.26, 1.15, 0);              // bras
  add(B(0.09, 0.07, 0.09), 9, 0, 1.5, 0);                                                           // cou
  const head = new THREE.IcosahedronGeometry(0.12, 1); head.scale(0.92, 1.1, 1); add(head, 0, 0, 1.64, 0);
  const hair = new THREE.IcosahedronGeometry(0.125, 1); hair.scale(0.95, 0.75, 1.02); add(hair, 8, 0, 1.7, 0.015);
  const pos = [], nor = [], prt = [];
  for (const g of parts) { pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array); prt.push(...g.attributes.aPart.array); g.dispose(); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('aPart', new THREE.Float32BufferAttribute(prt, 1));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(new Array(pos.length).fill(1), 3));
  return geo;
}
function setupPeople() {
  if (peopleMesh) return;
  const geo = personGeometry();
  const iShirt = new THREE.InstancedBufferAttribute(new Float32Array(PEOPLE_MAX * 3), 3), iPants = new THREE.InstancedBufferAttribute(new Float32Array(PEOPLE_MAX * 3), 3);
  const iSkin = new THREE.InstancedBufferAttribute(new Float32Array(PEOPLE_MAX * 3), 3), iAnim = new THREE.InstancedBufferAttribute(new Float32Array(PEOPLE_MAX * 2), 2);
  for (const a of [iShirt, iPants, iSkin, iAnim]) a.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('iShirt', iShirt); geo.setAttribute('iPants', iPants); geo.setAttribute('iSkin', iSkin); geo.setAttribute('iAnim', iAnim);
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 });
  peopleU = { uTime: { value: 0 } };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = peopleU.uTime;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
      attribute float aPart; attribute vec3 iShirt; attribute vec3 iPants; attribute vec3 iSkin; attribute vec2 iAnim; uniform float uTime;
      vec3 rotX(vec3 p, float py, float a) { p.y -= py; float c = cos(a), s = sin(a); return vec3(p.x, p.y * c - p.z * s, p.y * s + p.z * c) + vec3(0.0, py, 0.0); }`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
      float pose = iAnim.x, ph = iAnim.y;
      bool legL = aPart == 2.0 || aPart == 6.0, legR = aPart == 3.0 || aPart == 7.0, arm = aPart == 4.0 || aPart == 5.0;
      if (pose < 0.5) {
        // marche : jambes et bras opposés, léger balancement du corps
        float sw = sin(uTime * 6.5 + ph) * 0.5;
        if (legL) transformed = rotX(transformed, 0.88, sw);
        if (legR) transformed = rotX(transformed, 0.88, -sw);
        if (aPart == 4.0) transformed = rotX(transformed, 1.44, -sw * 0.8);
        if (aPart == 5.0) transformed = rotX(transformed, 1.44, sw * 0.8);
        transformed.y += abs(sin(uTime * 6.5 + ph)) * 0.03;
      } else if (pose < 1.5) {
        // assis : cuisses à l'horizontale, bras posés sur la table
        if (legL || legR) transformed = rotX(transformed, 0.88, 1.45);
        if (arm) transformed = rotX(transformed, 1.44, 0.9 + sin(uTime * 0.9 + ph) * 0.15);
        transformed.y -= 0.43;
      } else if (pose > 2.5) {
        if (arm) transformed = rotX(transformed, 1.44, sin(uTime * 1.3 + ph) * 0.12);
      }`)
      .replace('#include <color_vertex>', `#include <color_vertex>
      vColor = aPart == 0.0 || aPart == 9.0 ? iSkin : (aPart == 1.0 || aPart == 4.0 || aPart == 5.0) ? iShirt : (aPart == 2.0 || aPart == 3.0) ? iPants : aPart == 8.0 ? vec3(0.09, 0.06, 0.04) : vec3(0.07);`);
  };
  peopleMesh = new THREE.InstancedMesh(geo, mat, PEOPLE_MAX);
  peopleMesh.frustumCulled = false; peopleMesh.castShadow = true; peopleMesh.count = 0;
  peopleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(peopleMesh);
}
const _pm = THREE && new THREE.Matrix4(), _pq = THREE && new THREE.Quaternion(), _pe = THREE && new THREE.Euler(0, 0, 0, 'YXZ'), _pp = THREE && new THREE.Vector3(), _ps = THREE && new THREE.Vector3(1, 1, 1), _ptp = {};
/* chaque image : on avance les marcheurs et on affiche ceux qui sont près du joueur */
function updatePeople(dt, sP) {
  if (!segments.length || !PEOPLE_ON) { if (peopleMesh) peopleMesh.visible = false; return; }
  setupPeople();
  peopleU.uTime.value += dt;
  const len = segments.length, aP = sP / SEG, aMod = ((aP % len) + len) % len;
  const g = peopleMesh.geometry, iS = g.attributes.iShirt, iPa = g.attributes.iPants, iSk = g.attributes.iSkin, iA = g.attributes.iAnim;
  const carLat = playerX * RW;
  let n = 0;
  for (const P of PEOPLE) {
    if (P.pose === 0) { P.s += P.dir * P.v / SEG_M * dt; if (P.s >= len) P.s -= len; if (P.s < 0) P.s += len; }
    let rel = P.s - aMod; if (rel > len / 2) rel -= len; if (rel < -len / 2) rel += len;
    if (rel < -25 || rel > 190 || n >= PEOPLE_MAX) continue;
    // une voiture arrive sur le trottoir : la personne s'écarte vers les façades
    if (Math.abs(rel) < 6 && Math.abs(carLat - P.lat) < 2.4) P.dodge = Math.min(1, P.dodge + dt * 4); else P.dodge = Math.max(0, P.dodge - dt * 0.5);
    const lat = P.lat + Math.sign(P.lat) * P.dodge * 2.6;
    const s = (aP + rel) * SEG;
    const tp = trackPoint(s, lat, _ptp);
    curZone = zoneAt(Math.floor(P.s));
    const gy = P.y || groundY(Math.sign(lat) || 1, Math.abs(lat));
    _pp.set(tp.x, tp.y + gy, tp.z);
    const yaw = -tp.th + (P.pose === 0 ? (P.dir > 0 ? 0 : Math.PI) : P.yaw);
    _pe.set(P.pose === 2 ? -Math.PI / 2 : 0, yaw, 0); _pq.setFromEuler(_pe);
    if (P.pose === 2) _pp.y += 0.12;
    _pm.compose(_pp, _pq, _ps); peopleMesh.setMatrixAt(n, _pm);
    iS.setXYZ(n, P.shirt.r, P.shirt.g, P.shirt.b); iPa.setXYZ(n, P.pants.r, P.pants.g, P.pants.b); iSk.setXYZ(n, P.skin.r, P.skin.g, P.skin.b);
    iA.setXY(n, P.dodge > 0.3 && P.pose === 0 ? 3 : P.pose, P.ph);
    n++;
  }
  peopleMesh.count = n;
  peopleMesh.instanceMatrix.needsUpdate = true;
  iS.needsUpdate = iPa.needsUpdate = iSk.needsUpdate = iA.needsUpdate = true;
}

/* ================= Commerces : cafés, restaurants, bars ================= */
const SHOPS = [
  { name: 'CAFÉ DE LA GARE', bg: '#4a2a18', fg: '#f6e6c8', aw: ['#7a1f1f', '#f2e6cc'], terrace: true },
  { name: 'RESTAURANT', bg: '#7a1414', fg: '#ffffff', aw: ['#7a1414', '#f4efe6'], terrace: true },
  { name: 'BAR LE NÉON', bg: '#15142a', fg: '#ff4fa3', aw: ['#15142a', '#3a2a6a'], terrace: true },
  { name: 'PIZZERIA ROMA', bg: '#1f5a2c', fg: '#ffffff', aw: ['#1f5a2c', '#f4efe6'], terrace: true },
  { name: 'BOULANGERIE', bg: '#c99a4a', fg: '#3a2410', aw: ['#c99a4a', '#f6e8c8'], terrace: false },
  { name: 'BRASSERIE', bg: '#173450', fg: '#f2d48a', aw: ['#173450', '#d9c79a'], terrace: true },
  { name: 'GLACIER', bg: '#f39bb8', fg: '#ffffff', aw: ['#f39bb8', '#ffffff'], terrace: true },
  { name: 'SUSHI BAR', bg: '#101010', fg: '#ff3b30', aw: ['#101010', '#a01818'], terrace: true },
  { name: 'PHARMACIE', bg: '#0f7a3c', fg: '#ffffff', aw: ['#0f7a3c', '#e9f3ec'], terrace: false },
  { name: 'BEACH BAR', bg: '#1d8fb8', fg: '#ffe9a8', aw: ['#1d8fb8', '#ffe9a8'], terrace: true }
];
let shopMats = null;
function getShopMats() {
  if (shopMats) return shopMats;
  shopMats = SHOPS.map((sh) => {
    const [c, g] = makeCanvas(512, 96);
    g.fillStyle = sh.bg; g.fillRect(0, 0, 512, 96);
    g.strokeStyle = sh.fg; g.lineWidth = 4; g.strokeRect(8, 8, 496, 80);
    g.fillStyle = sh.fg; g.font = '700 54px Rajdhani, "Arial Narrow", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(sh.name, 256, 52, 470);
    return new THREE.MeshBasicMaterial({ map: canvasTex(c) });
  });
  return shopMats;
}
let signGeo = null;
/* longueur d'une terrasse et position de ses tables (partagé entre placement des clients et dessin) */
const terraceTables = (lenM) => { const out = []; for (let d = 1.4; d < lenM - 1; d += 2.6) out.push(d); return out; };

DECOR.shop = function (ctx, it, p, a) {
  const sh = SHOPS[it.kind], s = it.side, face = it.face || RW + 6.45;
  const pm = pose(a + Math.round(it.len / SEG_M / 2)), [r, f] = axes(pm.th);
  const col0 = hex3(sh.aw[0]), col1 = hex3(sh.aw[1]), lit = ENV && ENV.windowsLit;
  // vitrine (vitre sombre le jour, lumière chaude le soir) et encadrement
  const win = lateral(pm, s * (face - 0.06), 0.15 + (it.y0 || 0));
  box(ctx.side, win, r, f, 0.08, 3.1, it.len * 0.9, hex3('#2a2d33'));
  box(lit ? ctx.neon : ctx.side, lateral(pm, s * (face - 0.11), 0.45 + (it.y0 || 0)), r, f, 0.04, 2.2, it.len * 0.78, lit ? hex3('#ffcf8a') : hex3('#3b4a58'));
  // store à rayures incliné au-dessus du trottoir
  const n = Math.max(3, Math.round(it.len / 0.9)), w = it.len * 0.92 / n;
  for (let k = 0; k < n; k++) {
    const along = -it.len * 0.46 + w * (k + 0.5), c = lateral(pm, s * (face - 0.8), 3.0 + (it.y0 || 0));
    box(ctx.side, [c[0] + f[0] * along, c[1], c[2] + f[2] * along], r, f, 1.6, 0.06, w * 0.98, k % 2 ? col1 : col0, { topShift: 0 });
  }
  box(ctx.side, lateral(pm, s * (face - 1.62), 2.78 + (it.y0 || 0)), r, f, 0.05, 0.28, it.len * 0.92, col0);
  // enseigne
  if (!signGeo) signGeo = new THREE.PlaneGeometry(1, 1);
  const sign = new THREE.Mesh(signGeo, getShopMats()[it.kind]);
  const sc = lateral(pm, s * (face - 0.1), 3.75 + (it.y0 || 0));
  sign.position.set(sc[0], sc[1], sc[2]); sign.scale.set(Math.min(it.len * 0.7, 6.5), 0.8, 1);
  sign.rotation.y = -pm.th + (s > 0 ? -Math.PI / 2 : Math.PI / 2);
  ctx.group.add(sign);
  if (lit) poolQuad(ctx.pool, pm, s * (face - 2.2), 3.2, [0.45, 0.3, 0.14]);
  // terrasse : tables, chaises, parasols (jour), pots de fleurs
  if (!sh.terrace || !it.terrace) return;
  const P = prims(), tLat = s * (it.tLat || face - 2.2);
  for (const d of terraceTables(it.len)) {
    const pa = pose(a + Math.round(d / SEG_M)), [r2, f2] = axes(pa.th), b = lateral(pa, tLat, 0.15 + (it.y0 || 0));
    addGeo(ctx.side, P.cyl, b, 0, hex3('#2a2c30'), [0.04, 0.72, 0.04]);
    addGeo(ctx.side, P.cyl12, [b[0], b[1] + 0.72, b[2]], 0, hex3('#e9e4da'), [0.38, 0.04, 0.38]);
    for (const sd of [-1, 1]) {
      const cpos = [b[0] + f2[0] * sd * 0.62, b[1], b[2] + f2[2] * sd * 0.62];
      box(ctx.side, cpos, r2, f2, 0.42, 0.45, 0.42, hex3('#3a3d44'));
      box(ctx.side, [cpos[0] + f2[0] * sd * 0.19, cpos[1] + 0.45, cpos[2] + f2[2] * sd * 0.19], r2, f2, 0.42, 0.45, 0.05, hex3('#3a3d44'));
    }
    if (!lit) { addGeo(ctx.side, P.cyl, b, 0, hex3('#d8d8d8'), [0.03, 2.3, 0.03]); addGeo(ctx.side, P.cone, [b[0], b[1] + 2.0, b[2]], 0, d % 5 < 2.5 ? col0 : col1, [1.35, 0.45, 1.35]); }
    else addGeo(ctx.neon, P.ball, [b[0], b[1] + 0.82, b[2]], 0, hex3('#ffd9a0'), [0.05, 0.05, 0.05]);   // bougie
  }
  for (const d of [0.3, it.len - 0.3]) { const pa = pose(a + Math.round(d / SEG_M)), b = lateral(pa, tLat, 0.15 + (it.y0 || 0)); addGeo(ctx.side, P.cyl12, b, 0, hex3('#5a4a3a'), [0.25, 0.5, 0.25]); addGeo(ctx.side, P.ball, [b[0], b[1] + 0.75, b[2]], 0, hex3('#3f6f2a'), [0.4, 0.4, 0.4]); }
};
/* place un commerce (et ses clients attablés) devant un bâtiment */
function placeShop(item, n, side, lenM, kind, D, o = {}) {
  const sh = SHOPS[kind], terrace = sh.terrace && (o.terrace !== false);
  item(n, Object.assign({ t: 'shop', side, len: lenM, kind, terrace }, o));
  if (!terrace) return;
  const face = o.face || RW + 6.45, tLat = o.tLat || face - 2.2;
  for (const d of terraceTables(lenM)) for (const sd of [-1, 1]) if (D() < 0.65) {
    addPerson(n + (d + sd * 0.62) / SEG_M, side * tLat, 1, { yaw: sd > 0 ? 0 : Math.PI, y: (o.y0 || 0) + 0.15 });
  }
}

/* ================= Plage ================= */
DECOR.beachbar = function (ctx, it, p, a) {
  const P = prims(), [r, f] = axes(p.th), b = lateral(p, it.side * it.lat, groundY(it.side, it.lat));
  for (const dx of [-1.8, 1.8]) for (const dz of [-2.4, 2.4]) addGeo(ctx.side, P.cyl, [b[0] + r[0] * dx + f[0] * dz, b[1], b[2] + r[2] * dx + f[2] * dz], 0, hex3('#7a5a3a'), [0.1, 2.8, 0.1]);
  addGeo(ctx.side, P.cone, [b[0], b[1] + 2.7, b[2]], Math.PI / 4, hex3('#c9a45a'), [4.4, 1.6, 4.4]);   // toit de paille
  box(ctx.side, [b[0] - r[0] * it.side * 1.2, b[1], b[2] - r[2] * it.side * 1.2], r, f, 0.6, 1.1, 4.2, hex3('#8a6a46'));   // comptoir
  for (let k = -1; k <= 1; k++) addGeo(ctx.side, P.cyl, [b[0] - r[0] * it.side * 2 + f[0] * k * 1.3, b[1], b[2] - r[2] * it.side * 2 + f[2] * k * 1.3], 0, hex3('#d8d8d8'), [0.18, 0.75, 0.18]);
  if (!signGeo) signGeo = new THREE.PlaneGeometry(1, 1);
  const sign = new THREE.Mesh(signGeo, getShopMats()[9]); const sc = lateral(p, it.side * (it.lat - 2.3), groundY(it.side, it.lat) + 3.1);
  sign.position.set(sc[0], sc[1], sc[2]); sign.scale.set(3.6, 0.6, 1); sign.rotation.y = -p.th + (it.side > 0 ? -Math.PI / 2 : Math.PI / 2); ctx.group.add(sign);
  if (ENV && ENV.windowsLit) for (let k = -2; k <= 2; k++) addGeo(ctx.neon, P.ball, [b[0] + f[0] * k * 1.1 - r[0] * it.side * 2.2, b[1] + 2.5, b[2] + f[2] * k * 1.1 - r[2] * it.side * 2.2], 0, hex3(['#ff6a00', '#ffd23a', '#00E5FF'][(k + 3) % 3]), [0.08, 0.08, 0.08]);
};
DECOR.towel = function (ctx, it, p) {
  const [r, f] = axes(p.th + it.rot), b = lateral(p, it.side * it.lat, sandY(it.lat) + 0.02);
  box(ctx.side, b, r, f, 0.9, 0.02, 1.9, C2.flagC[it.col]);
};
/* bande d'eau turquoise près du bord et écume (au-dessus de la mer bleue) */
DECOR.shore = function (ctx, it, p, a) {
  const p1 = pose(a + 2), y = -1.56;
  quad(ctx.side, lateral(p, RW + 44.6, y + 0.02), lateral(p1, RW + 44.6, y + 0.02), lateral(p1, RW + 46.2, y + 0.02), lateral(p, RW + 46.2, y + 0.02), hex3('#f4f8f6'), null, [0, 1, 0]);
  quad(ctx.side, lateral(p, RW + 46.2, y), lateral(p1, RW + 46.2, y), lateral(p1, RW + 78, y), lateral(p, RW + 78, y), hex3('#3fb8c4'), null, [0, 1, 0]);
  for (const l of [52, 61]) quad(ctx.side, lateral(p, RW + l, y + 0.01), lateral(p1, RW + l, y + 0.01), lateral(p1, RW + l + 0.5, y + 0.01), lateral(p, RW + l + 0.5, y + 0.01), hex3('#bfe9ee'), null, [0, 1, 0]);
};

/* ================= Arbres plus réalistes ================= */
/* ajoute une géométrie avec un ombrage par sommet : dessous plus sombre (occlusion), dessus plus clair, variations de teinte */
function addGeoShaded(B, geo, pos, yaw, col, scale, rnd, pitch = 0, roll = 0) {
  const n0 = B.c.length;
  addGeo(B, geo, pos, yaw, col, scale, pitch, roll);
  for (let i = n0, v = n0 / 3; i < B.c.length; i += 3, v++) {
    const ny = B.n[v * 3 + 1], k = (0.68 + 0.42 * Math.max(0, ny) - 0.12 * Math.max(0, -ny)) * (0.92 + rnd() * 0.16);
    B.c[i] *= k; B.c[i + 1] *= k * (0.97 + rnd() * 0.06); B.c[i + 2] *= k;
  }
}
const LEAVES = ['#2f4a22', '#3a5a28', '#456a2e', '#2a4220', '#53723a'].map(hex3);
const NEEDLES = ['#24391f', '#2b4425', '#1f3320'].map(hex3);
/* touffe de feuillage : sphère bosselée (bruit déterministe sur la position → pas de trous), normales lisses */
let foliageGeo = null, foliageLow = null, pineGeo = null;
function makeFoliage(detail) {
  const g = new THREE.IcosahedronGeometry(1, detail), pos = g.attributes.position, nor = new Float32Array(pos.count * 3), v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    const k = 1 + 0.16 * Math.sin(v.x * 5.1 + 1.3) * Math.sin(v.y * 4.3 + 0.7) * Math.sin(v.z * 5.7 + 2.1) + 0.08 * Math.sin(v.x * 11 + v.z * 9);
    pos.setXYZ(i, v.x * k, v.y * k * 0.92, v.z * k); nor[i * 3] = v.x; nor[i * 3 + 1] = v.y; nor[i * 3 + 2] = v.z;
  }
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return g;
}
function pineTier() {
  // étage de sapin : cône à bord dentelé (branches) légèrement retombant
  const g = new THREE.ConeGeometry(1, 1, 14, 2), pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), a = Math.atan2(z, x), r = Math.hypot(x, z);
    const k = 1 + 0.18 * Math.sin(a * 7) * (r > 0.5 ? 1 : 0);
    pos.setXYZ(i, x * k, y - (r > 0.9 ? 0.08 : 0), z * k);
  }
  g.translate(0, 0.5, 0); g.computeVertexNormals();
  return g;
}
const _oldTree = DECOR.tree;
DECOR.tree = function (ctx, it, p, a) {
  if (it.kind === 'cypress') return _oldTree(ctx, it, p, a);
  const P = prims(), [, f] = axes(p.th), b0 = lateral(p, it.side * it.lat, 0);
  const b = [b0[0] + f[0] * (it.along || 0), p.y + groundY(it.side, it.lat) - 0.1, b0[2] + f[2] * (it.along || 0)];
  const R = mulberry32(((it.h * 1000) | 0) + a * 7 + (it.side > 0 ? 3 : 0)), h = it.h, low = ctx.lod;
  if (it.kind === 'pine') {
    // sapin : tronc fin, 5 à 7 étages de branches qui rétrécissent, légère irrégularité
    addGeo(ctx.side, P.cyl, b, 0, C.trunk, [0.18 + h * 0.008, h * 0.35, 0.18 + h * 0.008]);
    const tiers = low ? 2 : 5 + (R() * 2 | 0);
    for (let k = 0; k < tiers; k++) {
      const t = k / tiers, rad = h * (0.3 - t * 0.22), y = h * (0.18 + t * 0.66);
      if (!pineGeo) pineGeo = pineTier();
      addGeoShaded(ctx.side, pineGeo, [b[0] + (R() - 0.5) * 0.2, b[1] + y, b[2] + (R() - 0.5) * 0.2], R() * 6, NEEDLES[k % 3], [rad, h * 0.3, rad], R);
    }
    return;
  }
  // feuillu : tronc qui s'affine, 2 à 3 branches, houppier fait de plusieurs touffes
  addGeo(ctx.side, P.cyl, b, 0, C.trunk, [0.2 + h * 0.012, h * 0.55, 0.2 + h * 0.012]);
  if (!low) for (let k = 0; k < 3; k++) {
    const ang = R() * 6.28;
    addGeo(ctx.side, P.cyl, [b[0], b[1] + h * 0.42, b[2]], ang, C.trunk, [0.07 + h * 0.006, h * 0.3, 0.07 + h * 0.006], 0.7, 0);
  }
  const blobs = low ? 3 : 5 + (R() * 3 | 0), cy = b[1] + h * 0.68, cr = h * 0.32;
  const leaf = LEAVES[(R() * LEAVES.length) | 0];
  for (let k = 0; k < blobs; k++) {
    const ang = R() * 6.28, d = k === 0 ? 0 : cr * (0.45 + R() * 0.45), yy = (k === 0 ? 0.1 : (R() - 0.35)) * cr * 0.8;
    const s = cr * (k === 0 ? 0.85 : 0.5 + R() * 0.3);
    if (!foliageGeo) { foliageGeo = makeFoliage(1); foliageLow = makeFoliage(1); }
    addGeoShaded(ctx.side, low ? foliageLow : foliageGeo, [b[0] + Math.cos(ang) * d, cy + yy, b[2] + Math.sin(ang) * d], R() * 6, k % 3 === 2 ? LEAVES[(R() * 5) | 0] : leaf, [s, s * 0.85, s], R);
  }
};
DECOR.streettree = function (ctx, it, p, a) {
  // platane d'alignement : grille au pied, tronc clair tacheté, houppier en touffes
  const P = prims(), b = lateral(p, it.side * it.lat, 0.15), [r, f] = axes(p.th), R = mulberry32(a * 13 + (it.side > 0 ? 1 : 0)), h = it.h;
  box(ctx.side, [b[0], b[1] - 0.02, b[2]], r, f, 1.3, 0.05, 1.3, hex3('#3a3b3e'));
  addGeo(ctx.side, P.cyl, b, 0, hex3('#9a8c74'), [0.16, h * 0.55, 0.16]);
  const n = ctx.lod ? 2 : 5;
  for (let k = 0; k < n; k++) {
    const ang = R() * 6.28, d = k ? h * 0.18 : 0, s = h * (k ? 0.2 + R() * 0.08 : 0.26);
    if (!foliageGeo) { foliageGeo = makeFoliage(1); foliageLow = makeFoliage(1); }
    addGeoShaded(ctx.side, ctx.lod ? foliageLow : foliageGeo, [b[0] + Math.cos(ang) * d, b[1] + h * 0.72 + (R() - 0.3) * h * 0.15, b[2] + Math.sin(ang) * d], R() * 6, LEAVES[k % 5], [s, s * 0.9, s], R);
  }
};
