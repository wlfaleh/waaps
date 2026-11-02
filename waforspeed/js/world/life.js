/* WaForSpeed — Vie dans les rues : piétons animés, cafés / restaurants / bars avec terrasses,
   plages (paillotes, serviettes, baigneurs, écume) et végétation réaliste (arbres, haies, herbe).
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

/* ================= Végétation réaliste ================= */
/* Arbres faits comme dans les jeux actuels : tronc et vraies branches (géométrie, buffer « side »),
   feuillage en cartes de feuilles alpha-testées (buffer « leaf », 1 seul matériau partagé, 1 appel de dessin par tronçon).
   - texture de feuillage dessinée en canvas (atlas 1024² en 4 cases) : feuillus, rameau de sapin, palme, éventail d'aiguilles / herbe ;
     mipmaps faits à la main qui conservent la couverture (le feuillage ne s'éclaircit pas au loin) ;
   - normales orientées vers l'extérieur du houppier, éclairage Lambert par sommet (doux, peu coûteux), même lumière sur les deux faces ;
   - ombres portées avec un matériau de profondeur alpha-testé (customDepthMaterial), léger vent dans le shader ;
   - niveau de détail : ctx.lod = 1 au-delà de LOD_FAR_M → 3 à 5 fois moins de cartes et de facettes.
   Espèces : platane d'alignement (ville), tilleul / chêne (parcs, campagne), sapins (forêt), pins sylvestres (bois de pins, parcs),
   pins parasols et chênes verts (bord de mer), palmiers, cyprès (vignobles), haies, fougères et touffes d'herbe. */
const VEG_TS = 512, VEG_AS = 1024;   // taille d'une case, taille de l'atlas
let FOL = null;
/* ---- petits outils vectoriels (génération seulement, jamais dans la boucle de rendu) ---- */
const vAdd = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const vMul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const vNorm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const vCross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const vDot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const vCol = (c, k, R) => { const j = R ? 0.92 + R() * 0.16 : 1; return [c[0] * k * j, c[1] * k * (R ? 0.95 + R() * 0.1 : 1) * j, c[2] * k * j]; };
const vRandUnit = (R) => { const z = R() * 2 - 1, t = R() * 6.283, s = Math.sqrt(1 - z * z); return [s * Math.cos(t), z, s * Math.sin(t)]; };
/* repère d'une carte de normale n, tournée de spin autour de n (V reste proche de la verticale) */
function vBasis(n, spin) {
  const t = Math.abs(n[1]) < 0.96 ? [0, 1, 0] : [1, 0, 0];
  const U = vNorm(vCross(t, n)), V = vCross(n, U), c = Math.cos(spin), s = Math.sin(spin);
  return [vAdd(vMul(U, c), V, s), vAdd(vMul(V, c), U, -s)];
}

/* ---- atlas de feuillage dessiné en canvas ---- */
function vegDrawLeaves(g, ox, oy, R) {
  const cx = ox + 256, cy = oy + 262;
  g.lineCap = 'round';
  // brindilles qui partent du bas de la case
  g.strokeStyle = '#3d3024';
  for (let k = 0; k < 9; k++) {
    const a = -Math.PI / 2 + (R() - 0.5) * 2.4, l = 120 + R() * 110;
    g.lineWidth = 2 + R() * 2.5; g.beginPath(); g.moveTo(ox + 256 + (R() - 0.5) * 30, oy + 420);
    g.quadraticCurveTo(cx + Math.cos(a) * l * 0.4, cy + 60 + Math.sin(a) * l * 0.4, cx + Math.cos(a) * l, cy + 40 + Math.sin(a) * l); g.stroke();
  }
  // feuilles : les plus sombres d'abord (intérieur à l'ombre), les claires par-dessus
  const L = [];
  for (let i = 0; i < 520; i++) {
    const th = R() * 6.283, edge = 0.74 + 0.26 * Math.sin(th * 5 + 1.3) * Math.sin(th * 3 + 0.4), rr = Math.pow(R(), 0.6) * 196 * edge;
    L.push({ x: cx + Math.cos(th) * rr, y: cy + Math.sin(th) * rr * 0.94, rot: th + (R() - 0.5) * 1.9, len: 20 + R() * 17, w: 0.38 + R() * 0.16, sh: R() * 0.55 + (rr / 196) * 0.45 });
  }
  L.sort((a, b) => a.sh - b.sh);
  for (const f of L) {
    const hue = 82 + R() * 34, sat = 38 + R() * 22, lum = 14 + f.sh * 30 + R() * 6;
    g.save(); g.translate(f.x, f.y); g.rotate(f.rot);
    g.fillStyle = `hsl(${hue},${sat}%,${lum}%)`;
    g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(f.len * 0.45, -f.len * f.w, f.len, 0); g.quadraticCurveTo(f.len * 0.45, f.len * f.w, 0, 0); g.fill();
    g.strokeStyle = `hsla(${hue - 10},${sat}%,${lum + 14}%,0.55)`; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(1, 0); g.lineTo(f.len * 0.85, 0); g.stroke();
    g.restore();
  }
}
function vegDrawSpray(g, ox, oy, R) {
  // rameau de sapin : tige de gauche (tronc) à droite (pointe), rameaux latéraux couverts d'aiguilles
  const y0 = oy + 256, x0 = ox + 6, x1 = ox + 500;
  const stem = (t) => [x0 + (x1 - x0) * t, y0 + Math.sin(t * 3.1) * 10];
  const cols = ['#152a1c', '#1b3322', '#21402a', '#2a4b2e', '#36603a', '#4c7a3e'];
  let bucket = cols.map(() => []);
  // les aiguilles sont regroupées par couleur et tracées en un seul chemin (des milliers de traits : beaucoup plus rapide)
  const flush = () => { cols.forEach((c, i) => { const a = bucket[i]; if (!a.length) return; g.strokeStyle = c; g.beginPath(); for (let k = 0; k < a.length; k += 4) { g.moveTo(a[k], a[k + 1]); g.lineTo(a[k + 2], a[k + 3]); } g.stroke(); }); bucket = cols.map(() => []); };
  const needles = (ax, ay, bx, by, len, tipK) => {
    const dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l, steps = Math.floor(l / 3.2);
    for (let k = 0; k <= steps; k++) {
      const t = k / steps, px = ax + dx * t, py = ay + dy * t, nl = len * (0.75 + R() * 0.4) * (1 - t * 0.35);
      for (const sd of [-1, 1]) {
        const a = (0.75 + R() * 0.45) * sd, c = Math.cos(a), s = Math.sin(a);
        const nx = ux * c - uy * s, ny = ux * s + uy * c;
        bucket[Math.min(5, Math.floor(R() * 3.2 + t * tipK * 3))].push(px, py, px + nx * nl, py + ny * nl);
      }
    }
  };
  g.lineCap = 'round';
  for (let i = 0; i < 26; i++) {
    const t = 0.04 + i / 26 * 0.92, [sx, sy] = stem(t), lt = (1 - t * 0.72) * (150 + R() * 40);
    for (const sd of [-1, 1]) {
      const a = sd * (0.85 + R() * 0.25), ex = sx + Math.cos(a) * lt * 0.75, ey = sy + Math.sin(a) * lt;
      g.strokeStyle = '#3a2c1e'; g.lineWidth = 2; g.beginPath(); g.moveTo(sx, sy); g.lineTo(ex, Math.max(oy + 14, Math.min(oy + 498, ey))); g.stroke();
      needles(sx, sy, ex, Math.max(oy + 30, Math.min(oy + 482, ey)), 17, 1);
    }
    g.lineWidth = 2.2; flush();
  }
  g.strokeStyle = '#4a3624'; g.lineWidth = 6; g.beginPath(); g.moveTo(x0, y0);
  for (let t = 0; t <= 1; t += 0.05) { const [sx, sy] = stem(t); g.lineTo(sx, sy); g.lineWidth = 6 - t * 4; }
  g.stroke();
  for (let t = 0; t < 1; t += 0.04) { const [ax, ay] = stem(t), [bx, by] = stem(t + 0.04); needles(ax, ay, bx, by, 19, 1.2); }
  g.lineWidth = 2.4; flush();
}
function vegDrawFrond(g, ox, oy, R) {
  // palme : rachis du bas (base) vers le haut (pointe), folioles de part et d'autre
  const bx = ox + 256, by = oy + 506, ty = oy + 8;
  const rach = (t) => [bx + Math.sin(t * 2.2) * 8, by + (ty - by) * t];
  g.lineCap = 'round';
  for (let i = 0; i < 92; i++) {
    const t = 0.05 + i / 92 * 0.93;
    for (const sd of [-1, 1]) {
      if (R() < 0.07) continue;
      const [px, py] = rach(t), Lf = 236 * Math.pow(Math.sin(Math.PI * (0.1 + 0.9 * t)), 0.55) * (0.85 + R() * 0.2);
      const a = (0.95 + R() * 0.2 - t * 0.35), ex = px + sd * Math.sin(a) * Lf, ey = py - Math.cos(a) * Lf * 0.55 + Lf * 0.12;
      const lum = 20 + R() * 16 + (1 - t) * 4, hue = 78 + R() * 22;
      g.strokeStyle = `hsl(${hue},${42 + R() * 18}%,${lum}%)`;
      // foliole effilée : trois traits de largeur décroissante
      for (const [w, k] of [[6, 0.45], [4, 0.75], [2, 1]]) {
        g.lineWidth = w; g.beginPath(); g.moveTo(px, py);
        g.quadraticCurveTo(px + (ex - px) * 0.5, py + (ey - py) * 0.5 - 10, px + (ex - px) * k, py + (ey - py) * k + 6 * k * k); g.stroke();
      }
    }
  }
  g.strokeStyle = '#8a8a4a'; g.beginPath(); g.moveTo(bx, by);
  for (let t = 0; t <= 1; t += 0.05) { const [x, y] = rach(t); g.lineTo(x, y); }
  g.lineWidth = 5; g.stroke();
}
function vegDrawFan(g, ox, oy, R) {
  // éventail de brins depuis le bas de la case : touffe d'herbe, aiguilles de pin, fougère
  const bx = ox + 256, by = oy + 504, B = [];
  for (let i = 0; i < 110; i++) {
    const a = (R() - 0.5) * 2.3, len = (230 + R() * 250) * (1 - Math.abs(a) * 0.3);
    B.push({ a, len, sh: R(), bend: a * (0.1 + R() * 0.25) + (R() - 0.5) * 0.2 });
  }
  B.sort((p, q) => p.sh - q.sh);
  g.lineCap = 'round';
  for (const b of B) {
    const hue = 72 + R() * 40, lum = 16 + b.sh * 30;
    g.strokeStyle = `hsl(${hue},${34 + R() * 24}%,${lum}%)`;
    const ex = bx + Math.sin(b.a + b.bend) * b.len, ey = by - Math.cos(b.a + b.bend) * b.len;
    const cx = bx + Math.sin(b.a) * b.len * 0.55, cy = by - Math.cos(b.a) * b.len * 0.55;
    for (const [w, k] of [[5, 0.35], [3.2, 0.7], [1.6, 1]]) {
      g.lineWidth = w; g.beginPath(); g.moveTo(bx + (R() - 0.5) * 16, by);
      const qx = bx + (cx - bx) * k, qy = by + (cy - by) * k;
      g.quadraticCurveTo(qx, qy, bx + (ex - bx) * k + (cx - bx) * (1 - k) * 0.5, by + (ey - by) * k + (cy - by) * (1 - k) * 0.5); g.stroke();
    }
  }
}
/* mipmaps qui conservent la couverture : à chaque niveau on remonte l'alpha pour garder la même proportion de pixels opaques
   (sinon les cartes alpha-testées fondent et deviennent transparentes au loin) */
function vegMipmaps(data) {
  const levels = [{ data, width: VEG_AS, height: VEG_AS }];
  // histogramme de l'alpha d'une case : la couverture pour un facteur k se lit sans reparcourir les pixels
  const hist = (d, w, x0, y0, ts) => { const hh = new Float64Array(256); for (let y = y0; y < y0 + ts; y++) for (let x = x0; x < x0 + ts; x++) hh[d[(y * w + x) * 4 + 3]]++; for (let i = 0; i < 256; i++) hh[i] /= ts * ts; return hh; };
  const cover = (hh, k) => { let n = 0; for (let a = 255; a > 0 && a * k >= 127.5; a--) n += hh[a]; return n; };
  const c0 = []; for (let t = 0; t < 4; t++) c0.push(cover(hist(data, VEG_AS, (t % 2) * VEG_TS, (t >> 1) * VEG_TS, VEG_TS), 1));
  let src = data, w = VEG_AS;
  while (w > 1) {
    const h = w >> 1, d = new Uint8Array(h * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < h; x++) {
      const i = (y * h + x) * 4, a = ((2 * y) * w + 2 * x) * 4, b = a + 4, c = a + w * 4, e = c + 4;
      for (let k = 0; k < 4; k++) d[i + k] = (src[a + k] + src[b + k] + src[c + k] + src[e + k] + 2) >> 2;
    }
    const ts = h >> 1;
    if (ts >= 2) for (let t = 0; t < 4; t++) {
      const x0 = (t % 2) * ts, y0 = (t >> 1) * ts;
      const hh = hist(d, h, x0, y0, ts); let lo = 1, hi = 6;
      for (let it = 0; it < 12; it++) { const m = (lo + hi) / 2; if (cover(hh, m) < c0[t]) lo = m; else hi = m; }
      for (let y = y0; y < y0 + ts; y++) for (let x = x0; x < x0 + ts; x++) { const i = (y * h + x) * 4 + 3; d[i] = Math.min(255, d[i] * hi); }
    }
    levels.push({ data: d, width: h, height: h });
    src = d; w = h;
  }
  return levels;
}
function makeFoliageAtlas() {
  // canvas lu une seule fois : rendu sur le processeur (willReadFrequently) pour éviter une relecture GPU lente
  const c = document.createElement('canvas'); c.width = c.height = VEG_AS;
  const g = c.getContext('2d', { willReadFrequently: true }), R = mulberry32(4242);
  g.clearRect(0, 0, VEG_AS, VEG_AS);
  const draws = [vegDrawLeaves, vegDrawSpray, vegDrawFrond, vegDrawFan];
  for (let t = 0; t < 4; t++) {
    const ox = (t % 2) * VEG_TS, oy = (t >> 1) * VEG_TS;
    g.save(); g.beginPath(); g.rect(ox + 4, oy + 4, VEG_TS - 8, VEG_TS - 8); g.clip();
    draws[t](g, ox, oy, R); g.restore();
  }
  const data = new Uint8Array(g.getImageData(0, 0, VEG_AS, VEG_AS).data.buffer.slice(0));
  // couleur sous les pixels transparents = couleur moyenne de la case (pas de liseré noir au filtrage)
  for (let t = 0; t < 4; t++) {
    const ox = (t % 2) * VEG_TS, oy = (t >> 1) * VEG_TS; let r = 0, gg = 0, b = 0, n = 0;
    for (let y = oy; y < oy + VEG_TS; y += 2) for (let x = ox; x < ox + VEG_TS; x += 2) { const i = (y * VEG_AS + x) * 4; if (data[i + 3] > 200) { r += data[i]; gg += data[i + 1]; b += data[i + 2]; n++; } }
    n = n || 1;
    for (let y = oy; y < oy + VEG_TS; y++) for (let x = ox; x < ox + VEG_TS; x++) {
      const i = (y * VEG_AS + x) * 4, a = data[i + 3] / 255;
      if (a < 1) { data[i] = data[i] * a + r / n * (1 - a); data[i + 1] = data[i + 1] * a + gg / n * (1 - a); data[i + 2] = data[i + 2] * a + b / n * (1 - a); }
    }
  }
  const tex = new THREE.DataTexture(data, VEG_AS, VEG_AS, THREE.RGBAFormat);
  tex.mipmaps = vegMipmaps(data);
  tex.generateMipmaps = false; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}
/* matériau du feuillage (partagé, jamais libéré avec les tronçons) */
function foliage() {
  if (FOL) return FOL;
  const tex = makeFoliageAtlas(), u = { uTime: { value: 0 } };
  // Lambert : éclairage calculé par sommet (normales du houppier → lumière douce) et pixel très bon marché (beaucoup de recouvrement)
  const mat = new THREE.MeshLambertMaterial({ map: tex, vertexColors: true, alphaTest: 0.5, side: THREE.DoubleSide });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = u.uTime;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float wph = position.x * 0.23 + position.z * 0.19 + position.y * 0.31;
        transformed.x += sin(uTime * 1.7 + wph) * 0.045 + sin(uTime * 4.3 + wph * 2.7) * 0.015;
        transformed.z += cos(uTime * 1.3 + wph) * 0.045;
        transformed.y += sin(uTime * 3.1 + wph * 1.9) * 0.015;`);
    // normales « houppier » : même éclairage sur les deux faces d'une carte (pas de face arrière sombre)
    sh.fragmentShader = sh.fragmentShader.replace('( gl_FrontFacing ) ? vIndirectFront : vIndirectBack', 'vIndirectFront').replace('( gl_FrontFacing ) ? vLightFront : vLightBack', 'vLightFront');
  };
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.5, side: THREE.DoubleSide });
  FOL = { tex, mat, depth, u };
  return FOL;
}
const vegTick = () => { FOL.u.uTime.value = performance.now() * 0.001; };
/* appelé par buildChunk (renderer.js) : transforme le buffer de feuillage du tronçon en un maillage */
function addFoliageMesh(group, B) {
  if (!B || !B.p.length) return null;
  const F = foliage(), m = new THREE.Mesh(toGeo(B, true), F.mat);
  m.customDepthMaterial = F.depth; m.castShadow = true; m.receiveShadow = true;
  m.onBeforeRender = vegTick;
  group.add(m);
  return m;
}
const leafBuf = (ctx) => ctx.leaf || (ctx.leaf = newBuf());

/* ---- primitives de végétation ---- */
function vegRect(t) {   // [u0, u1, v bas (base), v haut] dans l'atlas (v = ligne du canvas / 1024)
  const e = 3 / VEG_AS, cx = t % 2, cy = t >> 1;
  return [cx * 0.5 + e, cx * 0.5 + 0.5 - e, (cy + 1) * 0.5 - e, cy * 0.5 + e];
}
function vegVert(B, p, n, c, u, v) { B.p.push(p[0], p[1], p[2]); B.n.push(n[0], n[1], n[2]); B.c.push(c[0], c[1], c[2]); B.u.push(u, v); }
/* bande de feuillage entre deux bords EA[i] et EB[i] (polylignes), normales nrm[i], couleurs col[i] ;
   la texture avance le long de la bande (u si alongU : rameau de sapin, tige à gauche ; sinon v : base en bas)
   et va de a0 à a1 en travers (0..1 : case entière, 0..0.5 / 0.5..1 : demi-palme) */
function vegStrip(B, EA, EB, t, nrm, col, alongU, a0 = 0, a1 = 1) {
  const [u0, u1, vb, vt] = vegRect(t), n = EA.length - 1;
  const uv = (s, w) => alongU ? [u0 + (u1 - u0) * s, vb + (vt - vb) * w] : [u0 + (u1 - u0) * w, vb + (vt - vb) * s];
  for (let i = 0; i < n; i++) {
    const s0 = i / n, s1 = (i + 1) / n, ua = uv(s0, a0), ub = uv(s0, a1), uc = uv(s1, a1), ud = uv(s1, a0);
    vegVert(B, EA[i], nrm[i], col[i], ua[0], ua[1]); vegVert(B, EB[i], nrm[i], col[i], ub[0], ub[1]); vegVert(B, EB[i + 1], nrm[i + 1], col[i + 1], uc[0], uc[1]);
    vegVert(B, EA[i], nrm[i], col[i], ua[0], ua[1]); vegVert(B, EB[i + 1], nrm[i + 1], col[i + 1], uc[0], uc[1]); vegVert(B, EA[i + 1], nrm[i + 1], col[i + 1], ud[0], ud[1]);
  }
}
/* ruban centré sur pts[i], de demi-largeur sides[i] */
function vegRibbon(B, pts, sides, t, nrm, col, alongU) {
  vegStrip(B, pts.map((q, i) => vAdd(q, sides[i], -1)), pts.map((q, i) => vAdd(q, sides[i])), t, nrm, col, alongU);
}
/* carte plane : base au centre bas, V = demi-hauteur… ici V = vecteur base → sommet complet, U = demi-largeur */
function vegCard(B, base, U, V, t, n, cb, ct) {
  vegRibbon(B, [base, vAdd(base, V)], [U, U], t, [n, n], [cb, ct], false);
}
/* branche ou tronc : cylindre effilé de a vers b, normales lisses, écorce tachetée (couleurs par sommet) */
function vegLimb(B, a, b, r0, r1, col, sides, R, mottle = 0.18, col2) {
  const d = vNorm([b[0] - a[0], b[1] - a[1], b[2] - a[2]]);
  const e1 = vNorm(vCross(Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0], d)), e2 = vCross(d, e1);
  const ring = (c, r, k) => { const out = []; for (let i = 0; i <= sides; i++) { const t = i / sides * 6.283 + k; const n = vAdd(vMul(e1, Math.cos(t)), e2, Math.sin(t)); out.push([vAdd(c, n, r), n]); } return out; };
  const ra = ring(a, r0, 0), rb = ring(b, r1, 0);
  const cc = () => { const base = col2 && R() < 0.45 ? col2 : col, k = 1 - mottle / 2 + R() * mottle; return [base[0] * k, base[1] * k, base[2] * k]; };
  const ca = [], cb = []; for (let i = 0; i <= sides; i++) { ca.push(cc()); cb.push(cc()); }
  ca[sides] = ca[0]; cb[sides] = cb[0];
  for (let i = 0; i < sides; i++) {
    const P = [ra[i], ra[i + 1], rb[i + 1], rb[i]], Cc = [ca[i], ca[i + 1], cb[i + 1], cb[i]];
    for (const k of [0, 1, 2, 0, 2, 3]) { B.p.push(P[k][0][0], P[k][0][1], P[k][0][2]); B.n.push(P[k][1][0], P[k][1][1], P[k][1][2]); B.c.push(Cc[k][0], Cc[k][1], Cc[k][2]); }
  }
}
/* masse sombre au cœur du houppier : évite de voir le ciel à travers et donne l'ombre interne */
function vegCore(B, c, sx, sy, sz, col) { addGeo(B, prims().ball, c, 0, col, [sx, sy, sz]); }

/* ---- espèces ---- */
const BARK = { oak: hex3('#4a3b2e'), oak2: hex3('#5c4c3c'), plane: hex3('#a59a80'), plane2: hex3('#6f6a55'), fir: hex3('#3a2e26'), pine: hex3('#8a5236'), pineLow: hex3('#4e4038'), palm: hex3('#7d6a52'), palm2: hex3('#5e5040'), olive: hex3('#6b665c') };
/* feuillu : tronc, 3 à 6 charpentières qui portent chacune une masse de feuillage couverte de cartes */
function vegBroadleaf(ctx, b, h, R, o) {
  const lo = ctx.lod, S = ctx.side, L = leafBuf(ctx);
  const rT = (o.trunkR || 0.1) + h * 0.017, th = h * (o.trunkH || 0.42);
  const lean = [(R() - 0.5) * h * 0.05, 0, (R() - 0.5) * h * 0.05];
  const top = [b[0] + lean[0], b[1] + th, b[2] + lean[2]];
  vegLimb(S, b, [b[0], b[1] + 0.6, b[2]], rT * 1.45, rT * 1.05, o.bark, lo ? 5 : 8, R, 0.25, o.bark2);   // empattement
  vegLimb(S, [b[0], b[1] + 0.55, b[2]], top, rT * 1.05, rT * 0.72, o.bark, lo ? 5 : 8, R, 0.25, o.bark2);
  const cc = [top[0], b[1] + h * (o.cy || 0.66), top[2]], Rx = h * (o.cw || 0.33), Ry = h * (o.ch || 0.27);
  const n = lo ? 3 : (o.clusters || 6) + ((R() * 3) | 0), tint = o.tint;
  for (let k = 0; k < n; k++) {
    const az = (k / n) * 6.283 + R() * 0.8, el = k === 0 && !lo ? 1 : 0.15 + R() * 0.7, hr = k === 0 && !lo ? 0.1 : 0.62 + R() * 0.3;
    const cpos = [cc[0] + Math.cos(az) * Rx * hr * (lo ? 0.55 : 0.85), cc[1] + (el - 0.45) * Ry * 0.9, cc[2] + Math.sin(az) * Rx * hr * (lo ? 0.55 : 0.85)];
    const ri = (lo ? 0.7 : 0.5 + R() * 0.15) * Rx;
    if (!lo) vegLimb(S, vAdd(top, [0, -0.3, 0]), vAdd(cpos, [0, -ri * 0.3, 0]), rT * 0.62, rT * 0.16, o.bark, 5, R, 0.2, o.bark2);
    vegCore(S, [cpos[0], cpos[1] + ri * 0.1, cpos[2]], ri * 0.42, ri * 0.36, ri * 0.42, vCol(o.core, 1, R));
    const m = lo ? 6 : (o.cards || 11);
    for (let j = 0; j < m; j++) {
      const d = vRandUnit(R); d[1] = d[1] * 0.9 + 0.05;
      const dn = vNorm(d), pos = [cpos[0] + dn[0] * ri * (0.45 + R() * 0.4), cpos[1] + dn[1] * ri * 0.75 * (0.45 + R() * 0.4), cpos[2] + dn[2] * ri * (0.45 + R() * 0.4)];
      const s = ri * (lo ? 1.3 : 0.95 + R() * 0.35), [U, V] = vBasis(vNorm(vAdd(dn, vRandUnit(R), 0.35)), (R() - 0.5) * 1.3);
      // normale d'éclairage : vers l'extérieur du houppier (forme globale) + un peu de la masse locale + ciel
      const ln = vNorm([(pos[0] - cc[0]) / Rx + dn[0] * 0.6, (pos[1] - cc[1]) / Ry * 0.8 + dn[1] * 0.6 + 0.3, (pos[2] - cc[2]) / Rx + dn[2] * 0.6]);
      const hk = Math.max(0, Math.min(1, (pos[1] - (cc[1] - Ry)) / (2 * Ry))), out = Math.max(0, vDot(ln, dn));
      const k0 = 0.62 + 0.3 * hk + 0.14 * out, col = vCol(tint, k0, R);
      vegCard(L, vAdd(pos, V, -s * 0.55), vMul(U, s * 0.55), vMul(V, s * 1.1), 0, ln, vMul(col, 0.82), col);
    }
  }
}
/* sapin / épicéa : étages de rameaux (cartes « rameau » qui partent du tronc et retombent), cône sombre au cœur */
function vegFir(ctx, b, h, R, o) {
  const lo = ctx.lod, S = ctx.side, L = leafBuf(ctx), tint = o.tint;
  const y0 = h * (o.clear || 0.12), Rm = h * (o.w || 0.21) * (0.9 + R() * 0.2), topY = h * 0.98;
  vegLimb(S, b, [b[0], b[1] + topY, b[2]], 0.1 + h * 0.016, 0.03, BARK.fir, lo ? 4 : 6, R, 0.2);
  vegCore(S, [b[0], b[1] + y0 + (topY - y0) * 0.42, b[2]], Rm * 0.34, (topY - y0) * 0.48, Rm * 0.34, vCol(o.core, 1, R));
  const nw = lo ? 4 : 7 + (h > 17 ? 1 : 0);
  for (let k = 0; k < nw; k++) {
    const t = (k + R() * 0.4) / nw, y = y0 + (topY - y0) * t * 0.94, rad = Rm * Math.pow(1 - t, 0.9) + 0.45;
    const m = lo ? 4 : 5 + ((R() * 2) | 0), az0 = R() * 6.283;
    for (let j = 0; j < m; j++) {
      const az = az0 + j * 6.283 / m + (R() - 0.5) * 0.6, ca = Math.cos(az), sa = Math.sin(az);
      const len = rad * (0.85 + R() * 0.3), dir = vNorm([ca, -0.12 - R() * 0.22, sa]), droop = (o.droop || 0.22) * len;
      const roll = (R() - 0.5) * (lo ? 1.2 : 2.1), T = [-sa, 0, ca], side0 = vAdd(vMul(T, Math.cos(roll)), vCross(dir, T), Math.sin(roll));
      const w = len * (lo ? 0.5 : 0.42), segs = lo ? 1 : 2, pts = [], sides = [], nrm = [], col = [];
      const base = [b[0] + ca * 0.12, b[1] + y, b[2] + sa * 0.12];
      for (let i = 0; i <= segs; i++) {
        const s = i / segs;
        pts.push([base[0] + dir[0] * len * s, base[1] + dir[1] * len * s - droop * s * s, base[2] + dir[2] * len * s]);
        sides.push(vMul(side0, w * (0.55 + 0.45 * s)));
        nrm.push(vNorm([ca, 0.45 + t * 0.5, sa]));
        col.push(vCol(tint, 0.5 + 0.3 * t + 0.28 * s, R));
      }
      vegRibbon(L, pts, sides, 1, nrm, col, true);
      // second rameau croisé (de près) : volume quel que soit l'angle de vue
      if (!lo) { const s2 = vCross(dir, side0); vegRibbon(L, [pts[0], pts[segs]], [vMul(s2, w * 0.4), vMul(s2, w * 0.75)], 1, [nrm[0], nrm[segs]], [col[0], col[segs]], true); }
    }
  }
  // flèche (pousse terminale)
  for (const T of [[1, 0, 0], [0, 0, 1]]) vegRibbon(L, [[b[0], b[1] + topY - 1.4, b[2]], [b[0], b[1] + topY + 0.5, b[2]]], [vMul(T, 0.45), vMul(T, 0.2)], 1, [[0, 1, 0], [0, 1, 0]], [vCol(tint, 0.85), vCol(tint, 1.05)], true);
}
/* pin sylvestre / pin parasol : long fût nu, charpentières qui portent des plateaux d'aiguilles (cartes « éventail ») */
function vegPine(ctx, b, h, R, o) {
  const lo = ctx.lod, S = ctx.side, L = leafBuf(ctx), umb = o.umbrella, tint = o.tint;
  const rT = 0.08 + h * 0.011, lean = umb ? 0.08 + R() * 0.1 : R() * 0.05, az = R() * 6.283;
  const mid = [b[0] + Math.cos(az) * h * lean * 0.3, b[1] + h * 0.35, b[2] + Math.sin(az) * h * lean * 0.3];
  const top = [b[0] + Math.cos(az) * h * lean, b[1] + h * (umb ? 0.62 : 0.66), b[2] + Math.sin(az) * h * lean];
  vegLimb(S, b, mid, rT * 1.25, rT, BARK.pineLow, lo ? 5 : 7, R, 0.2);
  vegLimb(S, mid, top, rT, rT * 0.7, o.bark || BARK.pine, lo ? 5 : 7, R, 0.25, BARK.pineLow);
  const n = lo ? 2 : 3 + ((R() * 3) | 0);
  for (let k = 0; k < n; k++) {
    const a = az + k * 6.283 / n + (R() - 0.5) * 0.9, rr = h * (umb ? 0.2 : 0.11) * (0.6 + R() * 0.5);
    const c = [top[0] + Math.cos(a) * rr, b[1] + h * (umb ? 0.8 + R() * 0.07 : 0.74 + R() * 0.2), top[2] + Math.sin(a) * rr];
    const rx = h * (umb ? 0.19 : 0.12) * (0.8 + R() * 0.4), ry = rx * (umb ? 0.38 : 0.62);
    if (!lo) vegLimb(S, top, vAdd(c, [0, -ry * 0.5, 0]), rT * 0.7, rT * 0.25, o.bark || BARK.pine, 5, R, 0.25, BARK.pineLow);
    vegCore(S, [c[0], c[1] - ry * 0.1, c[2]], rx * 0.55, ry * 0.5, rx * 0.55, vCol(o.core, 1, R));
    const m = lo ? 5 : (umb ? 12 : 9);
    for (let j = 0; j < m; j++) {
      const d = vRandUnit(R); d[1] = Math.abs(d[1]) * (umb ? 0.7 : 0.9) + (j % 4 === 0 ? -0.4 : 0.1);
      const dn = vNorm(d), s = rx * (lo ? 0.95 : 0.6 + R() * 0.25);
      const basePos = [c[0] + dn[0] * rx * 0.35, c[1] + dn[1] * ry * 0.35, c[2] + dn[2] * rx * 0.35];
      const V = vMul(dn, s * 1.25), U = vMul(vNorm(vCross(dn, vRandUnit(R))), s * 0.75);
      const ln = vNorm([(basePos[0] - c[0]) / rx + dn[0], (basePos[1] - c[1]) / ry + 0.5, (basePos[2] - c[2]) / rx + dn[2]]);
      const k0 = 0.6 + 0.35 * Math.max(0, dn[1]) + 0.1 * R();
      vegCard(L, basePos, U, V, 3, ln, vCol(tint, k0 * 0.75, R), vCol(tint, k0 * 1.05, R));
    }
  }
}
/* cyprès : fuseau sombre et dense couvert de rameaux dressés */
function vegCypress(ctx, b, h, R, o) {
  const lo = ctx.lod, S = ctx.side, L = leafBuf(ctx), tint = o.tint, rmax = h * 0.085;
  vegLimb(S, b, [b[0], b[1] + h * 0.25, b[2]], 0.16, 0.1, BARK.fir, 5, R, 0.2);
  addGeo(S, prims().ball, [b[0], b[1] + h * 0.52, b[2]], R() * 6, vCol(o.core, 1, R), [rmax * 0.82, h * 0.47, rmax * 0.82]);
  const nl = lo ? 3 : 8, m = lo ? 3 : 5;
  const rad = (t) => rmax * (t < 0.3 ? 0.72 + t / 0.3 * 0.28 : 1 - Math.pow((t - 0.3) / 0.7, 1.5) * 0.9);
  for (let k = 0; k < nl; k++) {
    const t = (k + 0.5) / nl, y = h * (0.07 + 0.86 * t), r = rad(t), az0 = R() * 6.283;
    for (let j = 0; j < m; j++) {
      const az = az0 + j * 6.283 / m, ca = Math.cos(az), sa = Math.sin(az), len = h * (lo ? 0.34 : 0.2);
      const base = [b[0] + ca * r * 0.55, b[1] + y - len * 0.45, b[2] + sa * r * 0.55], dir = vNorm([ca * 0.22, 1, sa * 0.22]);
      const T = [-sa, 0, ca], w = r * (lo ? 1.1 : 0.85), n0 = vNorm([ca, 0.35, sa]);
      vegRibbon(L, [base, vAdd(base, dir, len)], [vMul(T, w * 0.8), vMul(T, w * 0.6)], 1, [n0, n0], [vCol(tint, 0.6 + 0.25 * t, R), vCol(tint, 0.85 + 0.2 * t, R)], true);
    }
  }
}
/* palmier : stipe annelé et courbé, palmes en V qui retombent, palmes sèches et régimes de dattes */
function vegPalm(ctx, it, p) {
  const lo = ctx.lod, S = ctx.side, L = leafBuf(ctx), R = mulberry32(((it.h * 977) | 0) + ((it.rot * 1000) | 0));
  const base = lateral(p, it.side * it.lat, groundY(it.side, it.lat) - 0.05), h = it.h, yaw = it.rot, lean = Math.abs(it.lean);
  const ns = lo ? 4 : 9; let prev = base;
  for (let i = 0; i < ns; i++) {
    const t = (i + 1) / ns, bend = lean * t * t * h * 0.5;
    const pt = [base[0] + Math.sin(yaw) * bend, base[1] + h * t, base[2] + Math.cos(yaw) * bend];
    const r0 = 0.27 - 0.08 * (i / ns) + (i === 0 ? 0.08 : 0), r1 = 0.27 - 0.08 * t;
    vegLimb(S, prev, pt, r0, r1, i % 2 ? BARK.palm : BARK.palm2, lo ? 5 : 8, R, 0.12);
    prev = pt;
  }
  const top = prev, P = prims();
  addGeo(S, P.ball, vAdd(top, [0, -0.25, 0]), 0, hex3('#5a4a30'), [0.42, 0.55, 0.42]);   // gaines des palmes
  if (!lo) for (let k = 0; k < 5; k++) { const a = R() * 6.283; addGeo(S, P.ball, [top[0] + Math.cos(a) * 0.3, top[1] - 0.55, top[2] + Math.sin(a) * 0.3], 0, hex3('#b8862a'), [0.22, 0.32, 0.22]); }
  const nf = lo ? 7 : 15;
  for (let k = 0; k < nf; k++) {
    const az = yaw + k * 2.4 + R() * 0.3, ca = Math.cos(az), sa = Math.sin(az);
    const young = k < 3, dead = !young && !lo && k >= nf - 2;
    const el = young ? 0.9 + R() * 0.35 : dead ? -1.1 : 0.15 + R() * 0.45, len = h * (0.36 + R() * 0.12) * (young ? 0.75 : 1);
    const dir = [ca * Math.cos(el), Math.sin(el), sa * Math.cos(el)], T = [-sa, 0, ca];
    const segs = lo ? 2 : 4, pts = [], sl = [], sr = [], nrm = [], col = [];
    const tint = dead ? hex3('#9a7a4a') : young ? [0.95, 1.05, 0.8] : [0.88 + R() * 0.12, 0.95 + R() * 0.1, 0.78];
    for (let i = 0; i <= segs; i++) {
      const s = i / segs, w = len * 0.26 * Math.sin(Math.PI * (0.15 + 0.85 * s)) + 0.08;
      const pt = [top[0] + dir[0] * len * s, top[1] + dir[1] * len * s - len * s * s * (dead ? 0.1 : 0.42), top[2] + dir[2] * len * s];
      pts.push(pt);
      // folioles relevées en V de chaque côté du rachis
      const up = [0, 1, 0];
      sl.push(vAdd(vMul(T, -w * 0.94), up, w * 0.32)); sr.push(vAdd(vMul(T, w * 0.94), up, w * 0.32));
      nrm.push(vNorm([dir[0] * 0.4, 1, dir[2] * 0.4]));
      col.push(vCol(tint, 0.68 + 0.32 * s, R));
    }
    // demi-palme gauche et droite (case 2 coupée en deux le long du rachis)
    vegStrip(L, pts.map((q, i) => vAdd(q, sl[i])), pts, 2, nrm, col, false, 0, 0.5);
    vegStrip(L, pts, pts.map((q, i) => vAdd(q, sr[i])), 2, nrm, col, false, 0.5, 1);
  }
}
/* sous-bois : fougères et petits buissons au pied des arbres de forêt */
function vegUnder(ctx, b, R, tint, kind) {
  const L = leafBuf(ctx), n = kind === 'fern' ? 5 : 4, s = 0.6 + R() * 0.5;
  for (let k = 0; k < n; k++) {
    const az = k * 6.283 / n + R() * 0.5, d = [Math.cos(az), 0.7, Math.sin(az)];
    const U = vMul(vNorm(vCross(d, [0, 1, 0])), s * 0.6), V = vMul(vNorm(d), s * 1.3);
    vegCard(L, [b[0], b[1] - 0.05, b[2]], U, V, kind === 'fern' ? 3 : 0, vNorm([d[0], 1.2, d[2]]), vCol(tint, 0.5, R), vCol(tint, 0.85, R));
  }
}
/* touffe d'herbe : deux cartes croisées « éventail » */
function vegTuft(L, b, hgt, yaw, col) {
  for (const a of [yaw, yaw + 1.57]) {
    const U = [Math.cos(a) * hgt * 0.65, 0, Math.sin(a) * hgt * 0.65];
    vegCard(L, b, U, [0, hgt, 0], 3, [Math.sin(a) * 0.3, 1, -Math.cos(a) * 0.3], vMul(col, 0.62), col);
  }
}

/* ---- branchement sur le décor ---- */
const VEG_TINT = {
  oak: [[0.95, 1, 0.82], [0.85, 0.95, 0.8], [1.05, 1.02, 0.78]], linden: [[1.08, 1.12, 0.82], [1, 1.08, 0.8]], plane: [[1.12, 1.12, 0.78], [1.05, 1.1, 0.8]],
  holm: [[0.72, 0.82, 0.72]], fir: [[0.92, 1, 0.98], [0.85, 0.95, 0.95], [1, 1.02, 0.95]], pine: [[0.66, 0.8, 0.74], [0.72, 0.84, 0.74]], stone: [[0.74, 0.88, 0.72]],
  cypress: [[0.62, 0.78, 0.66]]
};
const CORE = { leaf: hex3('#2a4020'), fir: hex3('#1a2b20'), pine: hex3('#22321d'), cyp: hex3('#18281a') };
const pick = (arr, R) => arr[(R() * arr.length) | 0];
DECOR.tree = function (ctx0, it, p, a) {
  // arbres loin de la route (fond de parc, forêt profonde) : version allégée même de près
  leafBuf(ctx0);
  const ctx = !ctx0.lod && it.lat > RW + 28 ? Object.assign({}, ctx0, { lod: 1 }) : ctx0;
  const [, f] = axes(p.th), b0 = lateral(p, it.side * it.lat, 0), al = it.along || 0;
  const b = [b0[0] + f[0] * al, p.y + groundY(it.side, it.lat) - 0.1, b0[2] + f[2] * al];
  const R = mulberry32(((it.h * 1000) | 0) + a * 7 + (it.side > 0 ? 3 : 0) + ((it.lat * 10) | 0)), h = it.h, g = MAP.ground;
  const zn = (segAt(a) && segAt(a).zoneName) || '';
  if (it.kind === 'cypress') return vegCypress(ctx, b, h, R, { tint: VEG_TINT.cypress[0], core: CORE.cyp });
  if (it.kind === 'pine') {
    if (g === 'beach') return vegPine(ctx, b, h, R, { umbrella: true, tint: VEG_TINT.stone[0], core: CORE.pine });
    if (g === 'city' || /pins/i.test(zn)) return vegPine(ctx, b, h, R, { umbrella: false, tint: pick(VEG_TINT.pine, R), core: CORE.pine });
    vegFir(ctx, b, h, R, { tint: pick(VEG_TINT.fir, R), core: CORE.fir, clear: curZone === 'foret' ? 0.1 + R() * 0.15 : 0.04, w: 0.19 + R() * 0.05 });
  } else if (g === 'beach') {
    vegBroadleaf(ctx, b, h * 0.75, R, { tint: VEG_TINT.holm[0], core: CORE.leaf, bark: BARK.olive, bark2: BARK.oak2, cw: 0.42, ch: 0.26, cy: 0.62, trunkH: 0.35 });
  } else if (g === 'city') {
    vegBroadleaf(ctx, b, h, R, { tint: pick(VEG_TINT.linden, R), core: CORE.leaf, bark: BARK.oak2, bark2: BARK.oak, cw: 0.3, ch: 0.3, cy: 0.65 });
  } else {
    const forest = curZone === 'foret';
    vegBroadleaf(ctx, b, h, R, { tint: pick(VEG_TINT.oak, R), core: CORE.leaf, bark: BARK.oak, bark2: BARK.oak2, cw: forest ? 0.27 : 0.36, ch: forest ? 0.3 : 0.27, cy: forest ? 0.7 : 0.62, trunkH: forest ? 0.5 : 0.4 });
  }
  if (curZone === 'foret' && !ctx.lod && R() < 0.55) {
    const d = (R() - 0.5) * 3;
    vegUnder(ctx, [b[0] + f[0] * d + 0.8, b[1] + 0.05, b[2] + f[2] * d], R, R() < 0.6 ? [0.8, 1, 0.75] : [0.9, 0.95, 0.75], R() < 0.6 ? 'fern' : 'bush');
  }
};
DECOR.streettree = function (ctx, it, p, a) {
  // platane d'alignement : grille au pied, tronc clair tacheté (écorce qui pèle), large houppier au-dessus du trottoir
  const b = lateral(p, it.side * it.lat, 0.15), [r, f] = axes(p.th), R = mulberry32(a * 13 + (it.side > 0 ? 1 : 0)), h = it.h * 1.4 + 1.2;
  box(ctx.side, [b[0], b[1] - 0.02, b[2]], r, f, 1.3, 0.05, 1.3, hex3('#3a3b3e'));
  vegBroadleaf(ctx, b, h, R, { tint: pick(VEG_TINT.plane, R), core: CORE.leaf, bark: BARK.plane, bark2: BARK.plane2, trunkR: 0.06, trunkH: 0.45, cw: 0.36, ch: 0.26, cy: 0.7, clusters: 6, cards: 11 });
};
DECOR.palm = vegPalm;
/* haie champêtre : masse sombre + cartes de feuilles sur les faces visibles */
DECOR.hedge = function (ctx, it, p, a) {
  const pm = pose(a + Math.round(it.l / SEG_M / 2)), [r, f] = axes(pm.th), c = lateral(pm, it.side * it.lat, -0.2);
  box(ctx.side, c, r, f, 1.1, 1.5, it.l, hex3('#2b4520'));
  const L = leafBuf(ctx), R = mulberry32(a * 31 + (it.side > 0 ? 7 : 0)), step = ctx.lod ? 2.2 : 0.8;
  for (let d = -it.l / 2 + 0.3; d < it.l / 2; d += step) {
    const o = [c[0] + f[0] * d, c[1], c[2] + f[2] * d];
    for (const face of [-1, 1, 0]) {
      if (ctx.lod && face === 1) continue;
      const nn = face ? vNorm([r[0] * face * -it.side, 0.35, r[2] * face * -it.side]) : [0, 1, 0];
      const pos = face ? vAdd(o, r, face * -it.side * (0.62 + R() * 0.12)) : vAdd(o, [0, 1.35, 0]);
      pos[1] += face ? 0.6 + R() * 0.45 : 0;
      const s = (ctx.lod ? 1.9 : 1.15) + R() * 0.35, [U, V] = vBasis(vNorm(vAdd(nn, vRandUnit(R), 0.3)), (R() - 0.5) * 1.2);
      const col = vCol([0.9, 1, 0.78], face ? 0.88 : 1.02, R);
      vegCard(L, vAdd(pos, V, -s * 0.45), vMul(U, s * 0.55), vMul(V, s * (face ? 1.2 : 0.9)), 0, vNorm(vAdd(nn, [0, 0.5, 0])), vMul(col, 0.8), col);
    }
  }
};
/* herbe en touffes sur les bas-côtés (campagne, circuit) ; rien au loin */
DECOR.verge = function (ctx, it, p, a) {
  if (ctx.lod) return;
  const L = leafBuf(ctx), R = mulberry32(a * 7919 + 17), [, f] = axes(p.th), z = curZone;
  const cols = z === 'champs' ? [[1.05, 1.05, 0.7], [0.95, 1, 0.65], [1.15, 1.05, 0.62]] : z === 'foret' ? [[0.7, 0.85, 0.65], [0.8, 0.9, 0.6]] : [[0.95, 1.02, 0.7], [0.88, 0.98, 0.66]];
  for (const side of [-1, 1]) {
    const n = 7 + ((R() * 4) | 0);
    for (let k = 0; k < n; k++) {
      const far = k > n - 3, lat = far ? RW + 3 + R() * 7 : RW + 0.35 + R() * 2.9, al = R() * 2 * SEG_M;
      const c = lateral(p, side * lat, groundY(side, lat) - 0.04);
      vegTuft(L, [c[0] + f[0] * al, c[1], c[2] + f[2] * al], (far ? 0.55 : 0.32) + R() * 0.4, R() * 3.14, vCol(pick(cols, R), 1, R));
    }
  }
};
