/* WaForSpeed — Moteur 3D : renderer, textures procédurales, tronçons de ville. */
'use strict';

/* ================= Rendu 3D ================= */
let renderer = null, scene = null, camera = null, composer = null, renderPass = null, bloom = null;
let gScene = null, gCamera = null, gCar = null, gRing = null;
let quality = store('waforspeed-quality') || (isTouch ? 'low' : 'high');
let VIEW = quality === 'high' ? 470 : 330;
const MAT = {};
const TEXS = {};
const fx = $('#fx'), fctx = fx.getContext('2d');
let W = 0, H = 0, DPR = 1;

/* --- buffers de géométrie fusionnée --- */
function newBuf() { return { p: [], n: [], c: [], u: [] }; }
function pushTri(B, a, b, c, col, ua, ub, uc) {
  const e1x = b[0] - a[0], e1y = b[1] - a[1], e1z = b[2] - a[2];
  const e2x = c[0] - a[0], e2y = c[1] - a[1], e2z = c[2] - a[2];
  let nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
  const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
  B.p.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
  B.n.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
  B.c.push(col[0], col[1], col[2], col[0], col[1], col[2], col[0], col[1], col[2]);
  if (ua) B.u.push(ua[0], ua[1], ub[0], ub[1], uc[0], uc[1]);
}
function quad(B, a, b, c, d, col, uv, hint) {
  if (hint) {
    const e1x = b[0] - a[0], e1y = b[1] - a[1], e1z = b[2] - a[2], e2x = c[0] - a[0], e2y = c[1] - a[1], e2z = c[2] - a[2];
    const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
    if (nx * hint[0] + ny * hint[1] + nz * hint[2] < 0) { [b, d] = [d, b]; if (uv) uv = [uv[0], uv[3], uv[2], uv[1]]; }
  }
  pushTri(B, a, b, c, col, uv && uv[0], uv && uv[1], uv && uv[2]);
  pushTri(B, a, c, d, col, uv && uv[0], uv && uv[2], uv && uv[3]);
}
/* boîte posée au sol : o = centre de la base, r/f = axes droite/avant, w le long de r, l le long de f */
function box(B, o, r, f, w, h, l, col, opt = {}) {
  const t = opt.taper || 1, tl = opt.taperL || t, y0 = opt.y0 || 0;
  const C = (sx, sy, sz) => {
    const kx = sy ? t : 1, kz = sy ? tl : 1, zo = sy ? (opt.topShift || 0) : 0;
    const x = sx * w / 2 * kx, z = sz * l / 2 * kz + zo;
    return [o[0] + r[0] * x + f[0] * z, o[1] + y0 + sy * h, o[2] + r[2] * x + f[2] * z];
  };
  const up = [0, 1, 0], R = r, Lf = [-r[0], 0, -r[2]], F = f, Bk = [-f[0], 0, -f[2]];
  const uv = opt.uv;
  quad(B, C(-1, 1, -1), C(1, 1, -1), C(1, 1, 1), C(-1, 1, 1), opt.top || col, uv && uv('top'), up);
  quad(B, C(1, 0, -1), C(1, 0, 1), C(1, 1, 1), C(1, 1, -1), opt.side || col, uv && uv('r', l, h), R);
  quad(B, C(-1, 0, 1), C(-1, 0, -1), C(-1, 1, -1), C(-1, 1, 1), opt.side || col, uv && uv('-r', l, h), Lf);
  quad(B, C(1, 0, 1), C(-1, 0, 1), C(-1, 1, 1), C(1, 1, 1), opt.front || col, uv && uv('f', w, h), F);
  quad(B, C(-1, 0, -1), C(1, 0, -1), C(1, 1, -1), C(-1, 1, -1), opt.back || col, uv && uv('-f', w, h), Bk);
  if (opt.bottom) quad(B, C(-1, 0, -1), C(-1, 0, 1), C(1, 0, 1), C(1, 0, -1), col, null, [0, -1, 0]);
}
function cylX(B, cx, cy, cz, r, wd, col, segs = 10) {
  for (let i = 0; i < segs; i++) {
    const a0 = i / segs * Math.PI * 2, a1 = (i + 1) / segs * Math.PI * 2;
    const y0 = cy + Math.cos(a0) * r, z0 = cz + Math.sin(a0) * r, y1 = cy + Math.cos(a1) * r, z1 = cz + Math.sin(a1) * r;
    const hint = [0, Math.cos((a0 + a1) / 2), Math.sin((a0 + a1) / 2)];
    quad(B, [cx - wd / 2, y0, z0], [cx + wd / 2, y0, z0], [cx + wd / 2, y1, z1], [cx - wd / 2, y1, z1], col, null, hint);
    for (const sx of [-1, 1]) {
      const x = cx + sx * wd / 2;
      const p = [[x, cy, cz], [x, y0, z0], [x, y1, z1]];
      const e1 = [0, y0 - cy, z0 - cz], e2 = [0, y1 - cy, z1 - cz];
      const nx = e1[1] * e2[2] - e1[2] * e2[1];
      if (nx * sx < 0) pushTri(B, p[0], p[2], p[1], col); else pushTri(B, p[0], p[1], p[2], col);
    }
  }
}
function toGeo(B, withUv) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(B.p, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(B.n, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(B.c, 3));
  if (withUv && B.u.length) g.setAttribute('uv', new THREE.Float32BufferAttribute(B.u, 2));
  g.computeBoundingSphere();
  return g;
}

/* --- textures procédurales --- */
function canvasTex(c, repeat) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = renderer ? Math.min(8, renderer.capabilities.getMaxAnisotropy()) : 1;
  return t;
}
function makeTextures() {
  // façade : 16 x 16 fenêtres, case = 3,2 m x 3,4 m ; coin bas-gauche noir pour les toits
  {
    const [c, g] = makeCanvas(512, 512), R = mulberry32(31);
    g.fillStyle = '#0d0f17'; g.fillRect(0, 0, 512, 512);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const r = R();
      g.fillStyle = r < 0.24 ? `rgb(${95 + R() * 20 | 0},${68 + R() * 14 | 0},${40 + R() * 10 | 0})`
        : r < 0.32 ? `rgb(${55 + R() * 15 | 0},${78 + R() * 14 | 0},${100 + R() * 15 | 0})`
        : r < 0.335 ? (R() < 0.5 ? '#007f8c' : '#8c3b00') : '#161a26';
      g.fillRect(x * 32 + 6, y * 32 + 7, 20, 18);
      g.fillStyle = 'rgba(255,255,255,.025)'; g.fillRect(x * 32, y * 32, 32, 2);
    }
    g.fillStyle = '#07080c'; g.fillRect(0, 496, 16, 16);
    TEXS.facade = canvasTex(c, true);
  }
  // route : largeur 15 m, 9 m de long par répétition
  {
    const [c, g] = makeCanvas(256, 512), R = mulberry32(5);
    g.fillStyle = '#1c1e27'; g.fillRect(0, 0, 256, 512);
    for (let i = 0; i < 2600; i++) { const v = 22 + R() * 18 | 0; g.fillStyle = `rgb(${v},${v + 1},${v + 6})`; g.fillRect(R() * 256, R() * 512, 2, 2); }
    for (let i = 0; i < 14; i++) { g.fillStyle = 'rgba(8,9,14,.35)'; g.beginPath(); g.ellipse(R() * 256, R() * 512, 10 + R() * 30, 30 + R() * 80, 0, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = 'rgba(214,220,232,.85)'; g.fillRect(5, 0, 4, 512); g.fillRect(247, 0, 4, 512);
    for (const x of [256 / 3, 512 / 3]) g.fillRect(x - 2, 0, 4, 170);
    TEXS.road = canvasTex(c, true);
  }
  // halo radial
  {
    const [c, g] = makeCanvas(128, 128);
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    TEXS.radial = canvasTex(c);
  }
  // silhouette de la ville au loin
  {
    const [c, g] = makeCanvas(2048, 256), R = mulberry32(19);
    let x = 0;
    while (x < 2048) {
      const bw = 20 + R() * 70, bh = 40 + R() * 200;
      g.fillStyle = R() < 0.5 ? '#171a2e' : '#1d1f35'; g.fillRect(x, 256 - bh, bw + 1, bh);
      for (let yy = 256 - bh + 6; yy < 250; yy += 7) for (let xx = x + 3; xx < x + bw - 3; xx += 6) if (R() < 0.07) { g.fillStyle = `rgba(255,190,120,${0.25 + R() * 0.4})`; g.fillRect(xx, yy, 2, 2); }
      if (R() < 0.12) { g.fillStyle = R() < 0.5 ? '#00E5FF' : '#FF6A00'; g.fillRect(x + bw * 0.3, 256 - bh + 8, bw * 0.4, 2); }
      if (R() < 0.2) { g.fillStyle = '#FF1F4B'; g.fillRect(x + bw / 2, 256 - bh - 4, 2, 2); }
      x += bw + R() * 4;
    }
    TEXS.skyline = canvasTex(c, true);
  }
  TEXS.boards = BOARD_TEXTS.map(([t, col]) => canvasTex(textCanvas(t, col, 512, 200, 'italic 700 96px Rajdhani, "Arial Narrow", sans-serif')));
}
function textCanvas(text, col, w, h, font, bg = '#0b0c14') {
  const [c, g] = makeCanvas(w, h);
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.strokeStyle = col; g.lineWidth = 8; g.shadowColor = col; g.shadowBlur = 20; g.strokeRect(12, 12, w - 24, h - 24);
  g.fillStyle = col; g.textAlign = 'center'; g.textBaseline = 'middle';
  let size = parseInt(font.match(/(\d+)px/)[1], 10);
  g.font = font;
  while (g.measureText(text).width > w - 70 && size > 20) { size -= 4; g.font = font.replace(/\d+px/, size + 'px'); }
  g.fillText(text, w / 2, h / 2 + 4);
  return c;
}

function setupThree() {
  renderer = new THREE.WebGLRenderer({ canvas: $('#game'), antialias: !isTouch, powerPreference: 'high-performance' });
  renderer.setClearColor(0x0a0812);
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0812);
  camera = new THREE.PerspectiveCamera(62, 1, 0.1, 1400);
  makeTextures();

  MAT.road = new THREE.MeshStandardMaterial({ map: TEXS.road, roughness: 0.55, metalness: 0.2, color: 0xffffff });
  MAT.side = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0.05 });
  MAT.bld = new THREE.MeshBasicMaterial({ map: TEXS.facade, vertexColors: true });
  MAT.neon = new THREE.MeshBasicMaterial({ vertexColors: true });
  MAT.pool = new THREE.MeshBasicMaterial({ map: TEXS.radial, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  MAT.boards = TEXS.boards.map((t) => new THREE.MeshBasicMaterial({ map: t }));
  MAT.shadow = new THREE.MeshBasicMaterial({ map: TEXS.radial, color: 0x000000, transparent: true, opacity: 0.75, depthWrite: false });
  MAT.tailGlow = new THREE.MeshBasicMaterial({ map: TEXS.radial, color: 0xff2040, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false });
  makeCarMaterials();

  scene.add(new THREE.HemisphereLight(0x46327a, 0x08080e, 0.75));
  const moon = new THREE.DirectionalLight(0x8a96ff, 0.35); moon.position.set(-40, 80, 30); scene.add(moon);
  lampLights = [];
  for (let i = 0; i < 4; i++) { const l = new THREE.PointLight(0xffb46b, 1.1, 26, 2); scene.add(l); lampLights.push(l); }

  // ciel + ville lointaine
  {
    const g = new THREE.SphereGeometry(1000, 24, 16), cols = [], pos = g.attributes.position;
    const top = new THREE.Color('#04040a'), mid = new THREE.Color('#150d24'), hor = new THREE.Color('#3a1a36');
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / 1000, c = new THREE.Color();
      if (y > 0.25) c.copy(mid).lerp(top, clamp((y - 0.25) / 0.6, 0, 1)); else c.copy(hor).lerp(mid, clamp((y + 0.05) / 0.3, 0, 1));
      cols.push(c.r, c.g, c.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    sky = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
    sky.renderOrder = -2; scene.add(sky);
    TEXS.skyline.repeat.set(4, 1);
    skyline = new THREE.Mesh(new THREE.CylinderGeometry(820, 820, 190, 64, 1, true),
      new THREE.MeshBasicMaterial({ map: TEXS.skyline, transparent: true, side: THREE.BackSide, fog: false, depthWrite: false }));
    skyline.renderOrder = -1; scene.add(skyline);
  }
  setFog();
  buildGarage();
  onResize();
}
let sky = null, skyline = null, lampLights = [];
function setFog() { scene.fog = new THREE.Fog(0x120d1d, 40, quality === 'high' ? 540 : 380); VIEW = quality === 'high' ? 470 : 330; }
function setupComposer() {
  composer = null; bloom = null;
  if (quality !== 'high' || !THREE.EffectComposer || !THREE.UnrealBloomPass) return;
  try {
    composer = new THREE.EffectComposer(renderer);
    renderPass = new THREE.RenderPass(scene, camera);
    composer.addPass(renderPass);
    bloom = new THREE.UnrealBloomPass(new THREE.Vector2(W, H), 0.8, 0.45, 0.46);
    composer.addPass(bloom);
    composer.setSize(W, H);
  } catch (e) { composer = null; }
}
function onResize() {
  W = innerWidth; H = innerHeight;
  DPR = Math.min(window.devicePixelRatio || 1, quality === 'high' ? 1.5 : 1);
  if (renderer) {
    renderer.setPixelRatio(DPR);
    renderer.setSize(W, H, false);
    camera.aspect = W / H; camera.updateProjectionMatrix();
    if (gCamera) { gCamera.aspect = W / H; gCamera.updateProjectionMatrix(); }
    if (composer) composer.setSize(W, H); else setupComposer();
  }
  fx.width = Math.round(W * Math.min(devicePixelRatio || 1, 1.5)); fx.height = Math.round(H * Math.min(devicePixelRatio || 1, 1.5));
  initRain();
}
addEventListener('resize', onResize);

/* --- tronçons de ville (chunks) --- */
const chunks = new Map();
const TINTS = [[1, 0.96, 0.9], [0.85, 0.92, 1], [0.72, 0.72, 0.8], [1, 0.9, 0.85]];
const KERB_A = hex3('#8a3a08'), KERB_B = hex3('#2a2420'), WALK = hex3('#1b1d26'), GROUND = hex3('#0b0c11');
const POLE = hex3('#2a2e3b'), LAMP = hex3('#ffd9a8'), POOL = [0.5, 0.32, 0.16];
function lateral(p, lat, dy = 0) { return [p.x + Math.cos(p.th) * lat, p.y + dy, p.z + Math.sin(p.th) * lat]; }
function axes(th) { return [[Math.cos(th), 0, Math.sin(th)], [Math.sin(th), 0, -Math.cos(th)]]; }
function buildChunk(ci) {
  const a0 = ci * CH, a1 = a0 + CH;
  const road = newBuf(), side = newBuf(), bld = newBuf(), neon = newBuf(), pool = newBuf();
  const group = new THREE.Group();
  for (let a = a0; a < a1; a++) {
    const p0 = pose(a), p1 = pose(a + 1);
    const v0 = a * SEG_M / 9, v1 = (a + 1) * SEG_M / 9;
    quad(road, lateral(p0, -RW), lateral(p0, RW), lateral(p1, RW), lateral(p1, -RW), [1, 1, 1], [[0, v0], [1, v0], [1, v1], [0, v1]], [0, 1, 0]);
    const kc = Math.floor(a / RUMBLE) % 2 ? KERB_A : KERB_B;
    for (const s of [-1, 1]) {
      const k0 = RW * s, k1 = (RW + 0.5) * s, w1 = (RW + 6) * s, g1 = (RW + 70) * s;
      quad(side, lateral(p0, k0), lateral(p1, k0), lateral(p1, k0, 0.15), lateral(p0, k0, 0.15), kc, null, [-Math.cos(p0.th) * s, 0, -Math.sin(p0.th) * s]);
      quad(side, lateral(p0, k0, 0.15), lateral(p1, k0, 0.15), lateral(p1, k1, 0.15), lateral(p0, k1, 0.15), kc, null, [0, 1, 0]);
      quad(side, lateral(p0, k1, 0.15), lateral(p1, k1, 0.15), lateral(p1, w1, 0.15), lateral(p0, w1, 0.15), WALK, null, [0, 1, 0]);
      quad(side, lateral(p0, w1, 0.15), lateral(p1, w1, 0.15), lateral(p1, g1, -0.3), lateral(p0, g1, -0.3), GROUND, null, [0, 1, 0]);
    }
    const deco = segAt(a).deco;
    if (!deco) continue;
    for (const b of deco.bld) {
      const pm = pose(a + Math.round(b.len / SEG_M / 2));
      const [r, f] = axes(pm.th);
      const o = lateral(pm, b.side * (RW + 6.5 + b.d / 2), -3);
      const tint = TINTS[b.tint];
      box(bld, o, r, f, b.d, b.h + 3, b.len, tint, {
        uv: (face, span, hh) => {
          if (face === 'top') return [[0.01, 0.01], [0.02, 0.01], [0.02, 0.02], [0.01, 0.02]];
          const u1 = b.u0 + span / 51.2, v1 = b.v0 + hh / 54.4;
          return [[b.u0, b.v0], [u1, b.v0], [u1, v1], [b.u0, v1]];
        }
      });
      const facade = b.side * (RW + 6.45);
      if (b.neon) {
        const c = hex3(b.neon);
        const fo = lateral(pm, facade); const along = (b.u0 - 0.5) * b.len * 0.6;
        box(neon, [fo[0] + f[0] * along, fo[1], fo[2] + f[2] * along], r, f, 0.12, b.h * 0.5, 0.35, c, { y0: b.h * 0.3 });
      }
      if (b.sign) {
        const c = hex3(b.neon || '#00E5FF');
        box(neon, lateral(pm, facade), r, f, 0.12, 0.25, b.len * 0.7, c, { y0: 4.2 });
        box(neon, lateral(pm, facade), r, f, 0.12, 0.25, b.len * 0.7, c, { y0: 5.6 });
      }
    }
    if (deco.lamp) {
      const s = deco.lamp, [r, f] = axes(p0.th);
      box(side, lateral(p0, s * (RW + 0.8), 0.15), r, f, 0.18, 7.6, 0.18, POLE);
      box(side, lateral(p0, s * (RW - 0.6), 7.5), r, f, 2.9, 0.14, 0.14, POLE);
      box(neon, lateral(p0, s * (RW - 1.9), 7.36), r, f, 0.9, 0.12, 0.38, LAMP);
      const c = lateral(p0, s * (RW - 2.4), 0.03), R2 = 8;
      quad(pool, [c[0] - r[0] * R2 - f[0] * R2, c[1], c[2] - r[2] * R2 - f[2] * R2], [c[0] + r[0] * R2 - f[0] * R2, c[1], c[2] + r[2] * R2 - f[2] * R2],
        [c[0] + r[0] * R2 + f[0] * R2, c[1], c[2] + r[2] * R2 + f[2] * R2], [c[0] - r[0] * R2 + f[0] * R2, c[1], c[2] - r[2] * R2 + f[2] * R2], POOL, [[0, 0], [1, 0], [1, 1], [0, 1]], [0, 1, 0]);
    }
    if (deco.board) {
      const s = deco.board.side, [r, f] = axes(p0.th), col = BOARD_TEXTS[deco.board.t][1];
      box(side, lateral(p0, s * (RW + 1), 0.15), r, f, 0.3, 6.2, 0.3, POLE);
      box(side, lateral(p0, s * (RW + 5), 0.15), r, f, 0.3, 6.2, 0.3, POLE);
      box(side, lateral(p0, s * (RW + 2), 6), r, f, 8.6, 3.6, 0.3, hex3('#0b0c14'));
      const nc = hex3(col);
      box(neon, lateral(p0, s * (RW + 2), 9.6), r, f, 8.6, 0.14, 0.34, nc);
      box(neon, lateral(p0, s * (RW + 2), 5.88), r, f, 8.6, 0.14, 0.34, nc);
      const panel = new THREE.Mesh(boardGeo, MAT.boards[deco.board.t]);
      const pc = lateral(p0, s * (RW + 2), 7.8);
      panel.position.set(pc[0] - f[0] * 0.17, pc[1], pc[2] - f[2] * 0.17);
      panel.rotation.y = -p0.th;
      group.add(panel);
      // reflet du néon sur la route mouillée
      const rc = lateral(p0, s * (RW - 1.5), 0.04), L = 16, Wd = 2.6;
      const cx = rc[0] - f[0] * L * 0.5, cz = rc[2] - f[2] * L * 0.5, k = 0.45;
      quad(pool, [cx - r[0] * Wd - f[0] * L, rc[1], cz - r[2] * Wd - f[2] * L], [cx + r[0] * Wd - f[0] * L, rc[1], cz + r[2] * Wd - f[2] * L],
        [cx + r[0] * Wd + f[0] * L, rc[1], cz + r[2] * Wd + f[2] * L], [cx - r[0] * Wd + f[0] * L, rc[1], cz - r[2] * Wd + f[2] * L], [nc[0] * k, nc[1] * k, nc[2] * k], [[0, 0], [1, 0], [1, 1], [0, 1]], [0, 1, 0]);
    }
  }
  const add = (B, mat, uv) => { if (B.p.length) group.add(new THREE.Mesh(toGeo(B, uv), mat)); };
  add(road, MAT.road, true); add(side, MAT.side, false); add(bld, MAT.bld, true); add(neon, MAT.neon, false); add(pool, MAT.pool, true);
  scene.add(group);
  chunks.set(ci, group);
}
let boardGeo = null;
function disposeChunk(ci) {
  const g = chunks.get(ci); if (!g) return;
  g.children.forEach((m) => { if (m.geometry !== boardGeo) m.geometry.dispose(); });
  scene.remove(g); chunks.delete(ci);
}
function ensureChunks(sAbs, all) {
  const aP = Math.floor(sAbs / SEG);
  const c0 = Math.floor((aP - 30) / CH), c1 = Math.floor((aP + VIEW) / CH);
  for (const ci of [...chunks.keys()]) if (ci < c0 || ci > c1) disposeChunk(ci);
  let built = 0;
  for (let ci = c0; ci <= c1; ci++) {
    if (chunks.has(ci)) continue;
    buildChunk(ci);
    if (!all && ++built >= 2) break;
  }
  trimPoses(aP);
}
function clearChunks() { for (const ci of [...chunks.keys()]) disposeChunk(ci); }
