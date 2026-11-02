// WaForSpeed — version allégée « trafic » des vrais modèles (LOD).
// usage (depuis un dossier qui contient node_modules : three@0.128, @gltf-transform/*, meshoptimizer, sharp) :
//   node <dépôt>/.claude/skills/waforspeed-3d/scripts/make-lod.mjs <dossier waforspeed> [id ...] [--tris=12000]
// Pour chaque voiture de CAR_MODELS (ou celles nommées), lit CAR_MODELS[id].file et écrit à côté
// <dossier>/<nom>-lod.json, que le jeu charge tout seul pour le trafic (aucune modification du catalogue).
//
// Étapes :
//  1. le modèle est préparé avec le code du jeu (js/cars/models.js : échelle, sol, roues, peinture, feux),
//     exécuté dans Node avec three r128 → le LOD est déjà en mètres, avant vers −Z, posé au sol ;
//  2. intérieur supprimé : noms (INT_, seat, dashboard…) + test de visibilité par voxels
//     (une pièce qu'aucun vide extérieur ne touche est invisible de dehors : sièges, moteur, disques…) ;
//  3. textures réduites à 256 px puis « cuites » dans les couleurs de sommet (plus aucune texture) ;
//  4. regroupement par rôle : peinture, carrosserie, chrome, vitres, feux arrière, phares, 4 roues
//     → environ 10 appels de dessin par voiture au lieu de 20 à 175 ;
//  5. simplification (meshoptimizer, couleurs et normales préservées) vers ~12 000 triangles ;
//  6. silhouette lointaine « wfs_far » (~1 800 triangles, 1 seul maillage, attributs _PAINT et _LAMP).
import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';
import vm from 'vm';

const req = createRequire(path.join(process.cwd(), 'index.js'));
const THREE = req('three');
const { NodeIO, Document } = req('@gltf-transform/core');
const { ALL_EXTENSIONS } = req('@gltf-transform/extensions');
const { dequantize } = req('@gltf-transform/functions');
const { MeshoptDecoder, MeshoptSimplifier } = req('meshoptimizer');
const sharp = req('sharp');

const args = process.argv.slice(2);
const opt = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('=')));
const [siteDir, ...ids] = args.filter((a) => !a.startsWith('--'));
if (!siteDir) { console.error('usage: node make-lod.mjs <dossier waforspeed> [id ...] [--tris=12000] [--far=1800] [--tex=256]'); process.exit(1); }
const TARGET = +(opt.tris || 12000), FAR = +(opt.far || 1800), TEX = +(opt.tex || 256), VOX = +(opt.vox || 0.04);

await MeshoptDecoder.ready; await MeshoptSimplifier.ready;
MeshoptSimplifier.useExperimentalFeatures = true;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });

/* --- code du jeu (catalogue + préparation des modèles) dans un bac à sable --- */
const ctx = vm.createContext({ THREE, console, Math, Map, Set, Array, Object, Number, RegExp, Float32Array, Uint32Array, Uint16Array });
vm.runInContext('var MAT = {}; var isTouch = false; var quality = "high"; var state = "menu"; function store() { return null; }', ctx);
for (const f of ['js/cars/catalog.js', 'js/cars/models.js']) vm.runInContext(fs.readFileSync(path.join(siteDir, f), 'utf8'), ctx, { filename: f });
const game = vm.runInContext('({ CARS, CAR_MODELS, carById, prepareModel, rigWheels, lodPathOf: typeof lodPathOf === "function" ? lodPathOf : null })', ctx);
const lodPath = (file) => (game.lodPathOf ? game.lodPathOf(file) : file.replace(/\.[^./]+$/, '') + '-lod.json');

/* --- glTF (gltf-transform) → objets three.js, comme le fait GLTFLoader (mêmes noms) --- */
const san = (n) => THREE.PropertyBinding.sanitizeNodeName(n || '');
async function texSampler(tinfo, tex) {
  if (!tex) return null;
  const img = tex.getImage();
  if (!img) return null;
  const { data, info } = await sharp(Buffer.from(img)).resize(TEX, TEX, { fit: 'fill' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const wrapS = tinfo ? tinfo.getWrapS() : 10497, wrapT = tinfo ? tinfo.getWrapT() : 10497;
  const tt = tinfo && tinfo.getExtension && tinfo.getExtension('KHR_texture_transform');
  const off = tt ? tt.getOffset() : [0, 0], sc = tt ? tt.getScale() : [1, 1];
  const wrap = (v, m) => (m === 33071 ? Math.min(1, Math.max(0, v)) : m === 33648 ? (Math.floor(v) % 2 ? 1 - (v - Math.floor(v)) : v - Math.floor(v)) : v - Math.floor(v));
  const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const LUT = new Float32Array(256); for (let i = 0; i < 256; i++) LUT[i] = lin(i);
  let aSum = 0; for (let i = 3; i < data.length; i += 4) aSum += data[i]; const meanA = aSum / (data.length / 4) / 255;
  return {
    meanA,
    at(u, v, out) {   // bilinéaire, sRGB → linéaire
      u = wrap(u * sc[0] + off[0], wrapS) * W - 0.5; v = wrap(v * sc[1] + off[1], wrapT) * H - 0.5;
      const x0 = Math.max(0, Math.min(W - 1, Math.floor(u))), y0 = Math.max(0, Math.min(H - 1, Math.floor(v)));
      const x1 = Math.min(W - 1, x0 + 1), y1 = Math.min(H - 1, y0 + 1), fx = Math.min(1, Math.max(0, u - x0)), fy = Math.min(1, Math.max(0, v - y0));
      for (let c = 0; c < 3; c++) {
        const p = (x, y) => LUT[data[(y * W + x) * 4 + c]];
        out[c] = (p(x0, y0) * (1 - fx) + p(x1, y0) * fx) * (1 - fy) + (p(x0, y1) * (1 - fx) + p(x1, y1) * fx) * fy;
      }
      return out;
    }
  };
}
async function toThree(doc) {
  const root = doc.getRoot(), matCache = new Map();
  const mat = async (m) => {
    if (matCache.has(m)) return matCache.get(m);
    const t = new THREE.MeshStandardMaterial({ name: m ? m.getName() : '' });
    if (m) {
      const f = m.getBaseColorFactor();
      t.userData.src = { factor: f, twoSided: m.getDoubleSided(), metal: m.getMetallicFactor(), rough: m.getRoughnessFactor(), alpha: m.getAlphaMode(),
        tex: await texSampler(m.getBaseColorTextureInfo(), m.getBaseColorTexture()), uvSet: m.getBaseColorTextureInfo() ? m.getBaseColorTextureInfo().getTexCoord() : 0 };
      t.transparent = m.getAlphaMode() === 'BLEND';
    } else t.userData.src = { factor: [1, 1, 1, 1], metal: 0, rough: 1, alpha: 'OPAQUE', tex: null, uvSet: 0 };
    matCache.set(m, t); return t;
  };
  const geo = (p) => {
    const g = new THREE.BufferGeometry();
    const put = (name, sem) => { const a = p.getAttribute(sem); if (a) g.setAttribute(name, new THREE.BufferAttribute(Float32Array.from(a.getArray()), a.getElementSize())); };
    put('position', 'POSITION'); put('normal', 'NORMAL'); put('uv', 'TEXCOORD_0'); put('uv2', 'TEXCOORD_1'); put('color', 'COLOR_0');
    const c = p.getAttribute('COLOR_0'); if (c && c.getNormalized()) { const a = g.attributes.color, d = c.getComponentType() === 5121 ? 255 : 65535; for (let i = 0; i < a.array.length; i++) a.array[i] /= d; }
    if (p.getIndices()) g.setIndex(Array.from(p.getIndices().getArray()));
    if (!g.attributes.normal) g.computeVertexNormals();
    return g;
  };
  const build = async (n) => {
    let obj;
    const me = n.getSkin() ? null : n.getMesh();
    if (me) {
      const prims = me.listPrimitives().filter((p) => p.getMode() === 4 && p.getAttribute('POSITION'));
      const meshes = [];
      for (let i = 0; i < prims.length; i++) { const m = new THREE.Mesh(geo(prims[i]), await mat(prims[i].getMaterial())); m.name = san(me.getName()) + (prims.length > 1 ? '_' + i : ''); meshes.push(m); }
      if (meshes.length === 1) obj = meshes[0]; else { obj = new THREE.Group(); for (const m of meshes) obj.add(m); }
    } else obj = new THREE.Group();
    obj.name = san(n.getName());
    obj.matrix.fromArray(n.getMatrix()); obj.matrix.decompose(obj.position, obj.quaternion, obj.scale);
    for (const c of n.listChildren()) obj.add(await build(c));
    return obj;
  };
  const scene = new THREE.Group();
  const sc = root.getDefaultScene() || root.listScenes()[0];
  for (const n of sc.listChildren()) scene.add(await build(n));
  return scene;
}

/* --- rôles des pièces --- */
const INTERIOR_RX = /((^|[^a-z])(int|inner|inside)([^a-z]|$)|interior|intcrom|plasticint|cockpit|dashboard|plancia|seat|sedil|steer|volante|carpet|tappet|pedal|belt|cintur|speaker|altoparl|airbag|display|lcd|gauge|dials|cluster|lether|leather|alcnt|stitch|stit([^a-z]|$)|seam|cuciture|fabric|tessuto|engine|ecran|botoes|ponteiro|chair)/i;
const DROP_RX = /(blur|damage|dmg|(^|[^a-z])coat([^a-z]|$))/i;   // disques de flou, vitres cassées, couche de vernis transparente
const LENS_RX = /(light|lamp|fari|fanal|farol|faro|head|tail|refletor|lens|glass_light|red_glass|redclear)/i;
const GLASS_RX = /(glass|window|vitre|vidro|vetro|windscreen|windshield)/i;

function classify(o) {
  const m = o.material, s = m.userData.src, name = (o.name || '') + ' ' + (o.parent ? o.parent.name || '' : '') + ' ' + (m.name || '');
  if (DROP_RX.test(name)) return null;
  if (m.userData.wfs === 'paint') return 'paint';
  if (INTERIOR_RX.test(name)) return null;
  if (m.userData.wfs === 'tail') return 'tail';
  if (m.userData.wfs === 'head') return 'head';
  const a = s.factor[3] * (s.tex ? s.tex.meanA : 1);
  if (s.alpha === 'MASK' && a < 0.45) return null;
  if (s.alpha === 'BLEND') {
    if (LENS_RX.test(name) && !/window|windscreen|windshield/i.test(name)) return a < 0.6 ? null : 'body';
    if (a < 0.9 || GLASS_RX.test(name)) return 'glass';
  }
  if (GLASS_RX.test(name) && s.alpha !== 'OPAQUE') return 'glass';
  return s.metal >= 0.7 && s.rough <= 0.45 ? 'chrome' : 'body';
}

/* --- soupe de triangles en espace voiture --- */
function bake(o, cls) {
  const g = o.geometry, s = o.material.userData.src, pos = g.attributes.position, nor = g.attributes.normal;
  const uv = s.uvSet === 1 ? g.attributes.uv2 : g.attributes.uv, col = g.attributes.color;
  const nm = new THREE.Matrix3().getNormalMatrix(o.matrixWorld), v = new THREE.Vector3(), c = [0, 0, 0];
  const n = pos.count, P = new Float32Array(n * 3), N = new Float32Array(n * 3), C = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld); P.set([v.x, v.y, v.z], i * 3);
    v.fromBufferAttribute(nor, i).applyMatrix3(nm).normalize(); N.set([v.x, v.y, v.z], i * 3);
    if (cls === 'paint' || cls === 'glass') { C.set([1, 1, 1], i * 3); continue; }
    if (s.tex && uv) s.tex.at(uv.getX(i), uv.getY(i), c); else { c[0] = c[1] = c[2] = 1; }
    for (let k = 0; k < 3; k++) C[i * 3 + k] = Math.min(1, c[k] * s.factor[k] * (col ? col.array[i * col.itemSize + k] : 1));
  }
  const I = g.index ? Uint32Array.from(g.index.array) : Uint32Array.from({ length: n }, (_, i) => i);
  if (o.matrixWorld.determinant() < 0) for (let t = 0; t < I.length; t += 3) { const x = I[t + 1]; I[t + 1] = I[t + 2]; I[t + 2] = x; }
  return { P, N, C, I, m: o.material };
}

/* --- intérieur invisible : voxels + remplissage du vide extérieur --- */
function exteriorMask(parts, keepAll) {
  const box = new THREE.Box3();
  for (const p of parts) for (let i = 0; i < p.P.length; i += 3) box.expandByPoint(new THREE.Vector3(p.P[i], p.P[i + 1], p.P[i + 2]));
  box.expandByScalar(VOX * 2);
  const nx = Math.ceil((box.max.x - box.min.x) / VOX), ny = Math.ceil((box.max.y - box.min.y) / VOX), nz = Math.ceil((box.max.z - box.min.z) / VOX);
  const grid = new Uint8Array(nx * ny * nz);   // 1 = surface, 2 = vide extérieur
  const id = (x, y, z) => (z * ny + y) * nx + x;
  const cell = (px, py, pz) => id(Math.min(nx - 1, Math.max(0, Math.floor((px - box.min.x) / VOX))), Math.min(ny - 1, Math.max(0, Math.floor((py - box.min.y) / VOX))), Math.min(nz - 1, Math.max(0, Math.floor((pz - box.min.z) / VOX))));
  const triCells = (p, t, fn) => {
    const a = p.I[t] * 3, b = p.I[t + 1] * 3, c = p.I[t + 2] * 3, P = p.P;
    const L = Math.max(Math.hypot(P[a] - P[b], P[a + 1] - P[b + 1], P[a + 2] - P[b + 2]), Math.hypot(P[a] - P[c], P[a + 1] - P[c + 1], P[a + 2] - P[c + 2]), Math.hypot(P[b] - P[c], P[b + 1] - P[c + 1], P[b + 2] - P[c + 2]));
    const s = Math.max(1, Math.ceil(L / (VOX * 0.5)));
    for (let i = 0; i <= s; i++) for (let j = 0; j <= s - i; j++) {
      const u = i / s, w = j / s, q = 1 - u - w;
      if (fn(cell(P[a] * q + P[b] * u + P[c] * w, P[a + 1] * q + P[b + 1] * u + P[c + 1] * w, P[a + 2] * q + P[b + 2] * u + P[c + 2] * w))) return true;
    }
    return false;
  };
  for (const p of parts) for (let t = 0; t < p.I.length; t += 3) triCells(p, t, (k) => { grid[k] = 1; return false; });
  // remplissage depuis les bords de la grille (6 voisins)
  const stack = [];
  const push = (x, y, z) => { if (x < 0 || y < 0 || z < 0 || x >= nx || y >= ny || z >= nz) return; const k = id(x, y, z); if (grid[k]) return; grid[k] = 2; stack.push(k); };
  for (let x = 0; x < nx; x++) for (let y = 0; y < ny; y++) { push(x, y, 0); push(x, y, nz - 1); }
  for (let x = 0; x < nx; x++) for (let z = 0; z < nz; z++) { push(x, 0, z); push(x, ny - 1, z); }
  for (let y = 0; y < ny; y++) for (let z = 0; z < nz; z++) { push(0, y, z); push(nx - 1, y, z); }
  while (stack.length) { const k = stack.pop(), x = k % nx, y = ((k / nx) | 0) % ny, z = (k / (nx * ny)) | 0; push(x + 1, y, z); push(x - 1, y, z); push(x, y + 1, z); push(x, y - 1, z); push(x, y, z + 1); push(x, y, z - 1); }
  const touchesAir = (k) => {
    const x = k % nx, y = ((k / nx) | 0) % ny, z = (k / (nx * ny)) | 0;
    return (x + 1 < nx && grid[k + 1] === 2) || (x > 0 && grid[k - 1] === 2) || (y + 1 < ny && grid[k + nx] === 2) || (y > 0 && grid[k - nx] === 2) || (z + 1 < nz && grid[k + nx * ny] === 2) || (z > 0 && grid[k - nx * ny] === 2);
  };
  // face visible de dehors : en partant du triangle dans le sens de sa face avant (ordre des sommets),
  // on atteint le vide extérieur en moins de 4 voxels. Retire aussi les doublures intérieures des panneaux.
  const seesAir = (p, t, twoSided) => {
    const a = p.I[t] * 3, b = p.I[t + 1] * 3, c = p.I[t + 2] * 3, P = p.P;
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
    let nx_ = uy * vz - uz * vy, ny_ = uz * vx - ux * vz, nz_ = ux * vy - uy * vx; const l = Math.hypot(nx_, ny_, nz_);
    if (!l) return false;
    nx_ /= l; ny_ /= l; nz_ /= l;
    const L = Math.max(Math.hypot(ux, uy, uz), Math.hypot(vx, vy, vz), Math.hypot(P[b] - P[c], P[b + 1] - P[c + 1], P[b + 2] - P[c + 2]));
    const s = Math.max(1, Math.ceil(L / VOX));
    for (let i = 0; i <= s; i++) for (let j = 0; j <= s - i; j++) {
      const u = i / s, w = j / s, q = 1 - u - w;
      const x = P[a] * q + P[b] * u + P[c] * w, y = P[a + 1] * q + P[b + 1] * u + P[c + 1] * w, z = P[a + 2] * q + P[b + 2] * u + P[c + 2] * w;
      for (const sg of twoSided ? [1, -1] : [1]) for (let d = 0.5; d <= 4; d += 0.5) {
        if (grid[cell(x + nx_ * d * VOX * sg, y + ny_ * d * VOX * sg, z + nz_ * d * VOX * sg)] === 2) return true;
      }
    }
    return false;
  };
  let removed = 0;
  for (const p of parts) {
    if (keepAll(p)) continue;
    const keep = [], two = !!p.m.userData.src.twoSided;
    for (let t = 0; t < p.I.length; t += 3) { if (triCells(p, t, touchesAir) && seesAir(p, t, two)) keep.push(p.I[t], p.I[t + 1], p.I[t + 2]); else removed++; }
    p.I = Uint32Array.from(keep);
  }
  return removed;
}

/* --- fusion d'une classe : soudure par position et matériau d'origine (couleur du premier sommet ; les normales sont recalculées après) --- */
function merge(parts) {
  const map = new Map(), P = [], C = [], F = [], I = [];
  const q = (x, s) => Math.round(x * s);
  for (const p of parts) {
    const local = new Map();
    for (let t = 0; t < p.I.length; t++) {
      const i = p.I[t];
      let k = local.get(i);
      if (k === undefined) {
        const f0 = p.F ? p.F[i * 2] : 0, f1 = p.F ? p.F[i * 2 + 1] : 0;
        const key = q(p.P[i * 3], 1e4) + ',' + q(p.P[i * 3 + 1], 1e4) + ',' + q(p.P[i * 3 + 2], 1e4) + ',' + (p.m ? p.m.uuid : q(p.C[i * 3], 64) + ',' + q(p.C[i * 3 + 1], 64) + ',' + q(p.C[i * 3 + 2], 64)) + ',' + f0 + ',' + f1;
        k = map.get(key);
        if (k === undefined) { k = P.length / 3; map.set(key, k); for (let c = 0; c < 3; c++) { P.push(p.P[i * 3 + c]); C.push(p.C[i * 3 + c]); } F.push(f0, f1); }
        local.set(i, k);
      }
      I.push(k);
    }
  }
  // triangles dégénérés (soudure) retirés
  const J = [];
  for (let t = 0; t < I.length; t += 3) if (I[t] !== I[t + 1] && I[t] !== I[t + 2] && I[t + 1] !== I[t + 2]) J.push(I[t], I[t + 1], I[t + 2]);
  return { P: Float32Array.from(P), C: Float32Array.from(C), F: Float32Array.from(F), I: Uint32Array.from(J) };
}
function simplifyTo(m, target, maxErr = 0.06, prune = false, esc = 3) {
  let out = m.I;
  if (m.I.length / 3 > target) {
    const nv = m.P.length / 3, attrs = new Float32Array(nv * 5);
    for (let i = 0; i < nv; i++) attrs.set([m.C[i * 3], m.C[i * 3 + 1], m.C[i * 3 + 2], m.F[i * 2], m.F[i * 2 + 1]], i * 5);
    const flags = prune ? ['Prune'] : [];
    for (let err = 0.003; err <= maxErr * 1.01; err *= 1.5) {
      const [ix] = MeshoptSimplifier.simplifyWithAttributes(m.I, m.P, 3, attrs, 5, [0.6, 0.6, 0.6, 4, 4], null, Math.floor(target) * 3, err, flags);
      out = ix;
      if (ix.length / 3 <= target * 1.08) break;
    }
    // en dernier recours : sans contrainte de couleur, erreur plus large, petites pièces isolées retirées
    for (let err = maxErr; out.length / 3 > target * 1.3 && err <= maxErr * esc; err *= 1.5) out = MeshoptSimplifier.simplify(out, m.P, 3, Math.floor(target) * 3, err, flags)[0];
    if (out.length / 3 > target * 1.3) out = MeshoptSimplifier.simplify(out, m.P, 3, Math.floor(target) * 3, maxErr * 0.5, ['Prune'])[0];
  }
  return creaseNormals(compact({ ...m, I: out }));
}
function compact(m) {
  const remap = new Map(), P = [], C = [], F = [], I = new Uint32Array(m.I.length);
  for (let t = 0; t < m.I.length; t++) {
    const i = m.I[t]; let k = remap.get(i);
    if (k === undefined) { k = remap.size; remap.set(i, k); for (let c = 0; c < 3; c++) { P.push(m.P[i * 3 + c]); C.push(m.C[i * 3 + c]); } F.push(m.F[i * 2], m.F[i * 2 + 1]); }
    I[t] = k;
  }
  return { P: Float32Array.from(P), C: Float32Array.from(C), F: Float32Array.from(F), I };
}
/* normales lissées sauf sur les arêtes vives (> 50°) : chaque coin de triangle moyenne les faces voisines proches de la sienne */
function creaseNormals(m, deg = 50) {
  const cos = Math.cos(deg * Math.PI / 180), nf = m.I.length / 3, FN = new Float32Array(nf * 3), FU = new Float32Array(nf * 3);
  const inc = Array.from({ length: m.P.length / 3 }, () => []);
  for (let f = 0; f < nf; f++) {
    const a = m.I[f * 3] * 3, b = m.I[f * 3 + 1] * 3, c = m.I[f * 3 + 2] * 3, P = m.P;
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz) || 1;
    FN.set([nx, ny, nz], f * 3); FU.set([nx / l, ny / l, nz / l], f * 3);
    for (let k = 0; k < 3; k++) inc[m.I[f * 3 + k]].push(f);
  }
  const map = new Map(), P = [], N = [], C = [], F = [], I = new Uint32Array(m.I.length);
  for (let f = 0; f < nf; f++) for (let k = 0; k < 3; k++) {
    const v = m.I[f * 3 + k]; let x = 0, y = 0, z = 0;
    for (const g of inc[v]) if (FU[g * 3] * FU[f * 3] + FU[g * 3 + 1] * FU[f * 3 + 1] + FU[g * 3 + 2] * FU[f * 3 + 2] >= cos) { x += FN[g * 3]; y += FN[g * 3 + 1]; z += FN[g * 3 + 2]; }
    const l = Math.hypot(x, y, z) || 1; x /= l; y /= l; z /= l;
    const key = v + ',' + Math.round(x * 100) + ',' + Math.round(y * 100) + ',' + Math.round(z * 100);
    let id = map.get(key);
    if (id === undefined) { id = P.length / 3; map.set(key, id); for (let c = 0; c < 3; c++) { P.push(m.P[v * 3 + c]); C.push(m.C[v * 3 + c]); } N.push(x, y, z); F.push(m.F[v * 2], m.F[v * 2 + 1]); }
    I[f * 3 + k] = id;
  }
  return { P: Float32Array.from(P), N: Float32Array.from(N), C: Float32Array.from(C), F: Float32Array.from(F), I };
}
const tris = (m) => m.I.length / 3;

/* --- écriture du glTF (données intégrées en data:) --- */
const MATS = {
  paint: { name: 'wfs_paint', metal: 0.45, rough: 0.32, vc: false },
  body: { name: 'wfs_body', metal: 0.15, rough: 0.55, vc: true },
  chrome: { name: 'wfs_chrome', metal: 0.85, rough: 0.28, vc: true },
  glass: { name: 'wfs_glass', metal: 0.9, rough: 0.08, color: [0.004, 0.006, 0.01, 0.84], blend: true, vc: false },
  tail: { name: 'wfs_tail_light', metal: 0.1, rough: 0.25, vc: true },
  head: { name: 'wfs_head_light', metal: 0.3, rough: 0.15, vc: true },
  wheel: { name: 'wfs_wheel', metal: 0.35, rough: 0.5, vc: true },
  far: { name: 'wfs_far', metal: 0.3, rough: 0.45, vc: true }
};
function writeDoc(meshes, extras, out) {
  const doc = new Document(), buf = doc.createBuffer(), scene = doc.createScene('wfs_lod');
  doc.getRoot().getAsset().generator = 'WaForSpeed make-lod.mjs';
  doc.getRoot().getAsset().extras = extras;
  const acc = (arr, type, norm) => { const a = doc.createAccessor().setType(type).setArray(arr).setBuffer(buf); if (norm) a.setNormalized(true); return a; };
  const mats = {};
  for (const { name, kind, m } of meshes) {
    const M = MATS[kind];
    if (!mats[kind]) {
      mats[kind] = doc.createMaterial(M.name).setBaseColorFactor(M.color || [1, 1, 1, 1]).setMetallicFactor(M.metal).setRoughnessFactor(M.rough);
      if (M.blend) mats[kind].setAlphaMode('BLEND');
      if (kind === 'paint' && m.paintColor) mats[kind].setBaseColorFactor(m.paintColor);
    }
    const prim = doc.createPrimitive().setMaterial(mats[kind])
      .setAttribute('POSITION', acc(m.P, 'VEC3')).setAttribute('NORMAL', acc(m.N, 'VEC3'))
      .setIndices(acc(m.P.length / 3 < 65536 ? Uint16Array.from(m.I) : m.I, 'SCALAR'));
    if (M.vc) prim.setAttribute('COLOR_0', acc(Uint8Array.from(m.C, (x) => Math.round(Math.min(1, Math.max(0, x)) * 255)), 'VEC3', true));
    if (kind === 'far') { // drapeaux de la silhouette lointaine : peinture, feux
      const pa = new Float32Array(m.F.length / 2), la = new Float32Array(m.F.length / 2);
      for (let i = 0; i < pa.length; i++) { pa[i] = m.F[i * 2]; la[i] = m.F[i * 2 + 1]; }
      prim.setAttribute('_PAINT', acc(pa, 'SCALAR')).setAttribute('_LAMP', acc(la, 'SCALAR'));
    }
    scene.addChild(doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(prim)));
  }
  doc.getRoot().setDefaultScene(scene);
  return io.writeJSON(doc, { format: 'gltf', basename: 'm' }).then(({ json, resources }) => {
    for (const b of json.buffers || []) if (b.uri) b.uri = 'data:application/octet-stream;base64,' + Buffer.from(resources[b.uri]).toString('base64');
    fs.writeFileSync(out, JSON.stringify(json));
    return fs.statSync(out).size;
  });
}

/* --- une voiture --- */
async function makeLod(id) {
  const car = game.carById(id), spec = game.CAR_MODELS[id];
  if (!spec || !spec.file || car.id !== id) { console.warn(id, ': pas de modèle dans CAR_MODELS'); return; }
  const src = path.join(siteDir, spec.file), out = path.join(siteDir, lodPath(spec.file));
  const doc = await io.read(src);
  await doc.transform(dequantize());
  const scene = await toThree(doc);
  const R = game.prepareModel(scene, car, spec), wrap = R.root;
  const { wheels } = game.rigWheels(wrap, car);
  wrap.updateMatrixWorld(true);
  const corner = new Map();
  for (const w of wheels) { const key = (w.steer.position.x > 0 ? 'R' : 'L') + (w.front ? 'F' : 'B'); w.spin.traverse((o) => { if (o.isMesh) corner.set(o, key); }); }
  const parts = [], before = { all: 0 };
  wrap.traverse((o) => {
    if (!o.isMesh || Array.isArray(o.material)) return;
    const n = (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3;
    before.all += n;
    const cls = corner.has(o) ? 'wheel' : classify(o);
    if (!cls) return;
    const p = bake(o, cls); p.cls = cls; p.corner = corner.get(o); parts.push(p);
  });
  const removed = exteriorMask(parts, (p) => p.cls === 'wheel' || p.cls === 'glass');
  // regroupement
  const groups = {};
  // feux : chaque triangle va du côté où il se trouve (un bandeau LED arrière nommé « headlight » devient un feu arrière)
  for (const p of [...parts]) if (p.cls === 'head' || p.cls === 'tail') {
    const front = [], rear = [];
    for (let t = 0; t < p.I.length; t += 3) ((p.P[p.I[t] * 3 + 2] + p.P[p.I[t + 1] * 3 + 2] + p.P[p.I[t + 2] * 3 + 2]) / 3 < 0 ? front : rear).push(p.I[t], p.I[t + 1], p.I[t + 2]);
    p.cls = 'head'; p.I = Uint32Array.from(front);
    parts.push({ ...p, cls: 'tail', I: Uint32Array.from(rear) });
  }
  for (const p of parts) { const k = p.cls === 'wheel' ? 'wheel_' + p.corner : p.cls; (groups[k] = groups[k] || []).push(p); }
  const merged = {}; let total = 0, wheelT = 0;
  for (const k in groups) { merged[k] = merge(groups[k]); total += tris(merged[k]); if (k.startsWith('wheel')) wheelT += tris(merged[k]); }
  const wheelBudget = Math.min(wheelT, TARGET * 0.2), bodyBudget = TARGET - wheelBudget;
  const out_ = [], farParts = [];
  let paintColor = null;
  for (const p of parts) if (p.cls === 'paint') { const f = p.m.userData.src.factor; paintColor = [f[0], f[1], f[2], 1]; break; }
  for (const k in merged) {
    const m = merged[k], w = k.startsWith('wheel');
    const share = w ? wheelBudget * tris(m) / wheelT : bodyBudget * tris(m) / (total - wheelT);
    const s = simplifyTo(m, Math.max(w ? 150 : 40, share), w ? 0.04 : 0.05);
    if (opt.v) console.log('  ', k, tris(m), '→', tris(s), 'sommets', s.P.length / 3);
    if (!tris(s)) continue;
    if (k === 'paint') s.paintColor = paintColor;
    out_.push({ name: w ? 'wfs_' + k : 'wfs_' + k, kind: w ? 'wheel' : k, m: s });
    farParts.push({ k, m: s });
  }
  // silhouette lointaine : tout en un, couleurs fixes pour vitres, drapeaux _PAINT (peinture) et _LAMP (feux)
  const fp = [], near0 = farParts.reduce((a, o) => a + tris(o.m), 0);
  for (const { k, m } of farParts) {
    const C = new Float32Array(m.C), F = new Float32Array(m.P.length / 3 * 2);
    if (k === 'glass') for (let i = 0; i < C.length; i += 3) { C[i] = 0.01; C[i + 1] = 0.012; C[i + 2] = 0.018; }
    for (let i = 0; i < F.length; i += 2) { F[i] = k === 'paint' ? 1 : 0; F[i + 1] = k === 'tail' || k === 'head' ? 1 : 0; }
    // chaque rôle est simplifié à part (une simplification commune déchire certaines carrosseries)
    const part = simplifyTo(merge([{ P: m.P, C, F, I: m.I }]), Math.max(24, FAR * tris(m) / near0), 0.03, false, 1);
    fp.push(part);
  }
  const farS = simplifyTo(merge(fp), FAR * 1.1, 0.01, false, 1);
  out_.push({ name: 'wfs_far', kind: 'far', m: farS });
  const near = out_.filter((o) => o.kind !== 'far').reduce((a, o) => a + tris(o.m), 0);
  const size = await writeDoc(out_, { credit: spec.credit || '', source: spec.file, lod: 'trafic', tris: near, farTris: tris(farS) }, out);
  console.log(`${id}: ${before.all} tri → intérieur −${removed} → ${near} tri (${out_.length - 1} maillages, roues ${wheels.length}) ; lointain ${tris(farS)} tri ; ${(size / 1e6).toFixed(2)} Mo → ${path.relative(siteDir, out)}`);
}

for (const id of ids.length ? ids : Object.keys(game.CAR_MODELS)) {
  try { await makeLod(id); } catch (e) { console.error(id, 'échec :', e.stack || e); }
}
