/* WaForSpeed — Moteur 3D : renderer, textures procédurales, tronçons de ville. */
'use strict';

/* ================= Rendu 3D ================= */
let renderer = null, scene = null, camera = null, composer = null, renderPass = null, bloom = null;
let gScene = null, gCamera = null, gCar = null, gRing = null;
let quality = store('waforspeed-quality') || 'high';
const qualityChosen = !!store('waforspeed-quality');
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
  // façade de jour : vitres qui reflètent le ciel, encadrements clairs
  {
    const [c, g] = makeCanvas(512, 512), R = mulberry32(32);
    g.fillStyle = '#b9b6b0'; g.fillRect(0, 0, 512, 512);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const k = R();
      const gr = g.createLinearGradient(0, y * 32 + 6, 0, y * 32 + 26);
      gr.addColorStop(0, k < 0.5 ? '#6f8fae' : '#57718c'); gr.addColorStop(1, k < 0.5 ? '#3b4f66' : '#2f3e52');
      g.fillStyle = gr; g.fillRect(x * 32 + 5, y * 32 + 6, 22, 20);
      g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(x * 32 + 5, y * 32 + 6, 22, 3);
    }
    g.fillStyle = '#55524e'; g.fillRect(0, 496, 16, 16);
    TEXS.facadeDay = canvasTex(c, true);
    // rugosité (vert) / métal (bleu) de la même façade : vitres lisses qui reflètent le ciel, murs mats
    const [c2, g2] = makeCanvas(512, 512);
    g2.fillStyle = 'rgb(0,235,0)'; g2.fillRect(0, 0, 512, 512);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { g2.fillStyle = 'rgb(0,18,40)'; g2.fillRect(x * 32 + 5, y * 32 + 6, 22, 20); }
    TEXS.facadeRM = canvasTex(c2, true);
  }
  // route de jour : asphalte sec, sans flaques
  {
    const [c, g] = makeCanvas(256, 512), R = mulberry32(7);
    g.fillStyle = '#35373d'; g.fillRect(0, 0, 256, 512);
    for (let i = 0; i < 2600; i++) { const v = 44 + R() * 22 | 0; g.fillStyle = `rgb(${v},${v + 1},${v + 4})`; g.fillRect(R() * 256, R() * 512, 2, 2); }
    g.fillStyle = 'rgba(236,238,242,.9)'; g.fillRect(5, 0, 4, 512); g.fillRect(247, 0, 4, 512);
    for (const x of [256 / 3, 512 / 3]) g.fillRect(x - 2, 0, 4, 170);
    TEXS.roadDay = canvasTex(c, true);
  }
  // asphalte de circuit : plus clair, sans pointillés
  {
    const [c, g] = makeCanvas(256, 512), R = mulberry32(6);
    g.fillStyle = '#2b2d33'; g.fillRect(0, 0, 256, 512);
    for (let i = 0; i < 2600; i++) { const v = 34 + R() * 20 | 0; g.fillStyle = `rgb(${v},${v + 1},${v + 4})`; g.fillRect(R() * 256, R() * 512, 2, 2); }
    g.fillStyle = 'rgba(16,17,20,.35)'; g.fillRect(70, 0, 30, 512); g.fillRect(150, 0, 30, 512);
    g.fillStyle = 'rgba(236,238,242,.95)'; g.fillRect(4, 0, 6, 512); g.fillRect(246, 0, 6, 512);
    TEXS.roadCircuit = canvasTex(c, true);
  }
  // nuage
  {
    const [c, g] = makeCanvas(256, 128), R = mulberry32(9);
    for (let i = 0; i < 26; i++) {
      const x = 40 + R() * 176, y = 50 + R() * 40, r = 18 + R() * 30;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(255,255,255,.85)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    TEXS.cloud = canvasTex(c);
  }
  // panneaux publicitaires du circuit
  TEXS.ads = AD_TEXTS.map(([t, bg, fg]) => {
    const [c, g] = makeCanvas(1024, 112);
    g.fillStyle = bg; g.fillRect(0, 0, 1024, 112);
    g.fillStyle = fg; g.font = 'italic 700 80px Rajdhani, "Arial Narrow", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const x of [256, 768]) g.fillText(t, x, 60);
    return canvasTex(c);
  });
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
  // texture de détail en niveaux de gris, multipliée par la couleur du sol et des décors
  {
    const [c, g] = makeCanvas(256, 256), R = mulberry32(12);
    g.fillStyle = '#e6e6e6'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 40; i++) {
      const x = R() * 256, y = R() * 256, r = 20 + R() * 60, v = 200 + R() * 55 | 0;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `rgba(${v},${v},${v},.55)`); gr.addColorStop(1, `rgba(${v},${v},${v},0)`);
      for (const dx of [-256, 0, 256]) for (const dy of [-256, 0, 256]) { g.save(); g.translate(dx, dy); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); g.restore(); }
    }
    for (let i = 0; i < 9000; i++) { const v = 150 + R() * 105 | 0; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(R() * 256, R() * 256, 1 + (R() < 0.2), 1 + (R() < 0.2)); }
    TEXS.detail = canvasTex(c, true);
  }
  // relief de l'asphalte (carte de normales) : grain, fissures, raccords
  {
    const N = 512, [hc, hg] = makeCanvas(N, N), R = mulberry32(44);
    hg.fillStyle = '#808080'; hg.fillRect(0, 0, N, N);
    for (let i = 0; i < 26000; i++) { const v = 100 + R() * 120 | 0; hg.fillStyle = `rgb(${v},${v},${v})`; hg.fillRect(R() * N, R() * N, 1 + (R() < 0.3), 1 + (R() < 0.3)); }
    hg.strokeStyle = 'rgba(40,40,40,.8)'; hg.lineWidth = 1.5;
    for (let i = 0; i < 6; i++) { hg.beginPath(); let x = R() * N, y = R() * N; hg.moveTo(x, y); for (let k = 0; k < 8; k++) { x += (R() - 0.5) * 40; y += R() * 30; hg.lineTo(x, y); } hg.stroke(); }
    const h = hg.getImageData(0, 0, N, N).data, [nc, ng] = makeCanvas(N, N), out = ng.createImageData(N, N);
    const H = (x, y) => h[(((y + N) % N) * N + ((x + N) % N)) * 4] / 255;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) * 2.2, dy = (H(x, y + 1) - H(x, y - 1)) * 2.2, l = Math.hypot(dx, dy, 1), o = (y * N + x) * 4;
      out.data[o] = (-dx / l * 0.5 + 0.5) * 255; out.data[o + 1] = (-dy / l * 0.5 + 0.5) * 255; out.data[o + 2] = (1 / l * 0.5 + 0.5) * 255; out.data[o + 3] = 255;
    }
    ng.putImageData(out, 0, 0);
    TEXS.roadNormal = canvasTex(nc, true);
    TEXS.roadNormal.repeat.set(3, 1);
  }
  // dalles de trottoir (2 x 2 dalles par répétition de 3 m)
  {
    const [c, g] = makeCanvas(256, 256), R = mulberry32(15);
    g.fillStyle = '#d6d6d6'; g.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
      const v = 205 + R() * 40 | 0; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x * 128 + 3, y * 128 + 3, 122, 122);
      for (let i = 0; i < 500; i++) { const w = 180 + R() * 70 | 0; g.fillStyle = `rgb(${w},${w},${w})`; g.fillRect(x * 128 + 3 + R() * 122, y * 128 + 3 + R() * 122, 1, 1); }
    }
    g.fillStyle = '#7a7a7a'; for (const k of [0, 128]) { g.fillRect(k, 0, 3, 256); g.fillRect(0, k, 256, 3); }
    TEXS.paving = canvasTex(c, true);
  }
  // jante floue (rayons en mouvement)
  {
    const [c, g] = makeCanvas(128, 128);
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(160,165,175,.95)'); gr.addColorStop(0.18, 'rgba(60,62,68,.95)'); gr.addColorStop(0.3, 'rgba(150,155,165,.8)');
    gr.addColorStop(0.8, 'rgba(130,135,145,.75)'); gr.addColorStop(0.92, 'rgba(200,205,215,.95)'); gr.addColorStop(1, 'rgba(200,205,215,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    TEXS.wheelBlur = canvasTex(c);
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
  TEXS.skylines = {
    'city-nuit': TEXS.skyline,
    'city-jour': skylineTex('city', '#8e9bb0', '#a9b4c4', 19),
    'coast-jour': skylineTex('coast', '#7f9db6', '#9fb6c9', 23),
    'coast-nuit': skylineTex('coast', '#141a2b', '#1b2236', 23),
    'hills-jour': skylineTex('hills', '#7d9a6a', '#a3b8a4', 29),
    'hills-nuit': skylineTex('hills', '#0f1517', '#151c22', 29)
  };
  TEXS.boards = BOARD_TEXTS.map(([t, col]) => canvasTex(textCanvas(t, col, 512, 200, 'italic 700 96px Rajdhani, "Arial Narrow", sans-serif')));
}
/* silhouettes lointaines : ville, côte (caps et îles) ou collines */
function skylineTex(kind, near, far, seed) {
  const [c, g] = makeCanvas(2048, 256), R = mulberry32(seed);
  if (kind === 'city') {
    for (const [col, k] of [[far, 0.7], [near, 1]]) {
      let x = 0;
      while (x < 2048) { const bw = 20 + R() * 70, bh = (40 + R() * 200) * k; g.fillStyle = col; g.fillRect(x, 256 - bh, bw + 1, bh); x += bw + R() * 6; }
    }
  } else {
    const layers = kind === 'coast' ? [[far, 0.35], [near, 0.22]] : [[far, 0.55], [near, 0.38]];
    for (const [col, amp] of layers) {
      g.fillStyle = col; g.beginPath(); g.moveTo(0, 256);
      const ph = R() * 10, ph2 = R() * 10;
      for (let x = 0; x <= 2048; x += 8) {
        const u = x / 2048 * Math.PI * 2;
        let h = (Math.sin(u * 3 + ph) * 0.5 + Math.sin(u * 7 + ph2) * 0.3 + Math.sin(u * 13) * 0.12 + 1) * 0.5;
        if (kind === 'coast' && Math.sin(u * 2 + ph) < 0.3) h *= 0.08;
        g.lineTo(x, 256 - 18 - h * 256 * amp);
      }
      g.lineTo(2048, 256); g.closePath(); g.fill();
    }
  }
  return canvasTex(c, true);
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
  renderer = new THREE.WebGLRenderer({ canvas: $('#game'), antialias: true, powerPreference: 'high-performance' });
  // perte du contexte WebGL (mémoire GPU saturée, onglet en arrière-plan sur mobile) : pause, puis on recharge proprement
  $('#game').addEventListener('webglcontextlost', (e) => { e.preventDefault(); if (typeof pauseGame === 'function') pauseGame(); });
  $('#game').addEventListener('webglcontextrestored', () => { if (mode === 'solo') location.reload(); });
  // ombres portées douces (soleil de jour)
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x0a0812);
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0812);
  camera = new THREE.PerspectiveCamera(62, 1, 0.1, 1400);
  makeTextures();

  MAT.road = new THREE.MeshStandardMaterial({ map: TEXS.road, roughness: 0.55, metalness: 0.2, color: 0xffffff });
  MAT.side = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.05, map: TEXS.detail });
  MAT.walk = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0.02, map: TEXS.paving });
  MAT.road.normalMap = TEXS.roadNormal; MAT.road.normalScale = new THREE.Vector2(0.55, 0.55);
  roadShader(MAT.road);
  MAT.bld = new THREE.MeshBasicMaterial({ map: TEXS.facade, vertexColors: true });
  MAT.bldDayLow = new THREE.MeshLambertMaterial({ map: TEXS.facadeDay, vertexColors: true });
  // qualité haute : façade PBR, les vitres reflètent le ciel (carte d'environnement PMREM)
  MAT.bldDayHigh = new THREE.MeshStandardMaterial({ map: TEXS.facadeDay, vertexColors: true, roughnessMap: TEXS.facadeRM, metalnessMap: TEXS.facadeRM, roughness: 1, metalness: 1, envMapIntensity: 1, color: 0xd8d8d8 });
  MAT.bldDay = MAT.bldDayLow;
  MAT.ads = TEXS.ads.map((t) => new THREE.MeshLambertMaterial({ map: t, side: THREE.DoubleSide }));
  MAT.neon = new THREE.MeshBasicMaterial({ vertexColors: true });
  MAT.pool = new THREE.MeshBasicMaterial({ map: TEXS.radial, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  MAT.boards = TEXS.boards.map((t) => new THREE.MeshBasicMaterial({ map: t }));
  MAT.shadow = new THREE.MeshBasicMaterial({ map: TEXS.radial, color: 0x000000, transparent: true, opacity: 0.75, depthWrite: false });
  MAT.tailGlow = new THREE.MeshBasicMaterial({ map: TEXS.radial, color: 0xff2040, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false });
  makeCarMaterials();

  hemi = new THREE.HemisphereLight(0x46327a, 0x08080e, 0.75); scene.add(hemi);
  sunLight = new THREE.DirectionalLight(0x8a96ff, 0.35); sunLight.position.set(-40, 80, 30); scene.add(sunLight); scene.add(sunLight.target);
  stableShadow(sunLight);
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
    skyGeo = g;
    sky = new THREE.Mesh(g, makeSkyMaterial());
    sky.renderOrder = -2; scene.add(sky);
    TEXS.skyline.repeat.set(4, 1);
    skyline = new THREE.Mesh(new THREE.CylinderGeometry(820, 820, 190, 64, 1, true),
      new THREE.MeshBasicMaterial({ map: TEXS.skyline, transparent: true, side: THREE.BackSide, fog: false, depthWrite: false }));
    skyline.renderOrder = -1; scene.add(skyline);
  }
  // soleil, lune, étoiles, nuages, mer : suivent la caméra (décor à l'infini)
  sunDisc = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEXS.radial, color: 0xfff4d8, fog: false, depthWrite: false, blending: THREE.AdditiveBlending, transparent: true }));
  sunDisc.scale.set(170, 170, 1); sunDisc.renderOrder = -1; scene.add(sunDisc);
  moonDisc = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEXS.radial, color: 0xdfe6ff, fog: false, depthWrite: false, transparent: true }));
  moonDisc.scale.set(60, 60, 1); moonDisc.renderOrder = -1; scene.add(moonDisc);
  {
    const R = mulberry32(77), pts = [];
    for (let i = 0; i < 700; i++) { const u = R() * Math.PI * 2, v = 0.08 + R() * 0.9; pts.push(Math.cos(u) * Math.cos(v) * 900, Math.sin(v) * 900, Math.sin(u) * Math.cos(v) * 900); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85, depthWrite: false }));
    stars.renderOrder = -1; scene.add(stars);
  }
  clouds = new THREE.Group();
  {
    const R = mulberry32(55);
    for (let i = 0; i < 16; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEXS.cloud, fog: false, depthWrite: false, transparent: true, opacity: 0.85 }));
      const u = R() * Math.PI * 2, d = 600 + R() * 250;
      s.position.set(Math.cos(u) * d, 90 + R() * 160, Math.sin(u) * d); s.scale.set(260 + R() * 200, 110 + R() * 60, 1);
      clouds.add(s);
    }
  }
  scene.add(clouds);
  water = new THREE.Mesh(new THREE.PlaneGeometry(5000, 5000), new THREE.MeshStandardMaterial({ color: 0x1e7fa8, roughness: 0.18, metalness: 0.2 }));
  water.rotation.x = -Math.PI / 2; scene.add(water);
  adGeo = new THREE.PlaneGeometry(11, 1.2);
  applyEnv();
  buildGarage();
  onResize();
}
/* Ciel : dégradé atmosphérique + halo du soleil + nuages procéduraux (bruit fractal projeté sur une voûte).
   Un seul dessin pour tout le ciel ; les nuages défilent lentement avec le vent et sont éclairés côté soleil. */
function makeSkyMaterial() {
  const oct = quality === 'high' && !isTouch ? 6 : 4;
  return new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      uTop: { value: new THREE.Color('#2a64b8') }, uMid: { value: new THREE.Color('#74ace0') }, uHor: { value: new THREE.Color('#d4e6f2') },
      uSun: { value: new THREE.Vector3(-0.45, 0.75, -0.5).normalize() }, uSunCol: { value: new THREE.Color('#fff0d4') },
      uCloud: { value: 1 }, uCover: { value: 0.5 }, uTime: { value: 0 }, uNight: { value: 0 }, uFog: { value: new THREE.Color('#c4d8e8') }
    },
    vertexShader: 'varying vec3 vDir; void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      precision mediump float;
      varying vec3 vDir;
      uniform vec3 uTop, uMid, uHor, uSun, uSunCol, uFog; uniform float uCloud, uCover, uTime, uNight;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
      float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < ${oct}; i++) { v += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; } return v; }
      void main() {
        vec3 d = normalize(vDir); float h = d.y;
        // dégradé : horizon laiteux, zénith profond
        vec3 col = h > 0.25 ? mix(uMid, uTop, clamp((h - 0.25) / 0.6, 0.0, 1.0)) : mix(uHor, uMid, clamp((h + 0.05) / 0.3, 0.0, 1.0));
        float mu = max(dot(d, uSun), 0.0);
        col += uSunCol * (pow(mu, 6.0) * 0.18 + pow(mu, 60.0) * 0.35) * (1.0 - uNight);
        if (uCloud > 0.0 && h > 0.0) {
          vec2 uv = d.xz / (h + 0.18) * 1.6 + vec2(uTime * 0.012, uTime * 0.004);
          float n = fbm(uv);
          float c = smoothstep(uCover, uCover + 0.28, n) * smoothstep(0.0, 0.16, h);
          // éclairage : on compare avec le bruit un peu plus loin vers le soleil (bords lumineux, ventre gris)
          float n2 = fbm(uv + uSun.xz * 0.14);
          float lit = clamp(0.62 + (n - n2) * 3.2, 0.0, 1.0);
          vec3 shadowC = mix(vec3(0.58, 0.63, 0.72), uHor * 0.8, 0.3), litC = mix(vec3(1.0), uSunCol, 0.25);
          vec3 cc = mix(shadowC, litC, lit) + uSunCol * pow(mu, 12.0) * 0.4 * (1.0 - c);
          if (uNight > 0.5) cc = mix(uMid, uHor, 0.5) * 0.9;
          col = mix(col, cc, c * uCloud);
        }
        // atmosphère : l'horizon se fond dans le brouillard, voile chaud du côté du soleil
        float haze = 1.0 - smoothstep(-0.03, 0.14, h);
        col = mix(col, uFog, haze * 0.65);
        col += uSunCol * pow(mu, 3.0) * haze * 0.14 * (1.0 - uNight);
        gl_FragColor = vec4(col, 1.0);
        #include <encodings_fragment>
      }`
  });
}
let sky = null, skyGeo = null, skyline = null, lampLights = [], hemi = null, sunLight = null, sunDisc = null, moonDisc = null, stars = null, clouds = null, water = null;
function setFog() {
  VIEW = quality === 'high' ? 470 : 330;
  if (ENV) scene.fog = new THREE.Fog(new THREE.Color(ENV.fog), ENV.fogNear, ENV.fogFar);
}
/* applique l'ambiance (ENV) de la carte : ciel, lumière, brouillard, matériaux */
function applyEnv() {
  ENV = envFor(MAP, TOD);
  const E = ENV;
  scene.background = new THREE.Color(E.fog);
  setFog();
  const U = sky.material.uniforms;
  U.uTop.value.set(E.skyTop); U.uMid.value.set(E.skyMid); U.uHor.value.set(E.skyHor);
  U.uSun.value.set(E.sunDir[0], E.sunDir[1], E.sunDir[2]).normalize(); U.uSunCol.value.set(E.sunColor);
  U.uCloud.value = E.clouds ? 1 : E.nightClouds || 0; U.uCover.value = E.cloudCover || 0.5; U.uNight.value = TOD === 'nuit' ? 1 : 0;
  U.uFog.value.set(E.fog);
  const envTex = updateSkyEnv(E);   // reflets et lumière ambiante du ciel (qualité haute)
  const sk = TEXS.skylines[MAP.skyline + '-' + TOD] || TEXS.skyline;
  sk.repeat.set(4, 1);
  skyline.material.map = sk; skyline.material.needsUpdate = true;
  hemi.color.set(E.hemiSky); hemi.groundColor.set(E.hemiGround); hemi.intensity = E.hemiI;
  sunLight.color.set(E.sunColor); sunLight.intensity = E.sunI;
  // ombres en temps réel coûteuses : réservées à l'ordinateur ; sur mobile, ombre simulée sous chaque voiture
  const shadows = quality === 'high' && E.sunDisc && !isTouch;
  sunLight.castShadow = shadows;
  if (shadows) {
    const s = sunLight.shadow, sz = isTouch ? 1024 : 2048;
    if (s.mapSize.x !== sz) { s.mapSize.set(sz, sz); if (s.map) { s.map.dispose(); s.map = null; } }
    Object.assign(s.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 260 });
    s.camera.updateProjectionMatrix();
    s.bias = -0.0003; s.normalBias = 0.035; s.radius = 3;
  }
  MAT.shadow.opacity = shadows ? 0.35 : 0.75;
  sunDisc.visible = E.sunDisc; moonDisc.visible = E.moon; stars.visible = E.stars; clouds.visible = false;   // nuages dessinés dans le ciel
  water.visible = MAP.ground === 'beach'; water.material.color.set(E.water);
  water.material.envMap = envTex; water.material.envMapIntensity = 1; water.material.needsUpdate = true;
  MAT.road.map = MAP.road === 'circuit' ? TEXS.roadCircuit : TOD === 'jour' ? TEXS.roadDay : TEXS.road;
  const wet = TOD === 'nuit' && (MAP.ground === 'city' || MAP.ground === 'beach');
  MAT.road.roughness = wet ? 0.22 : 0.66; MAT.road.metalness = wet ? 0.4 : 0.05;
  // chaussée mouillée : reflets temps réel (néons, phares) ; sèche : reflet doux du ciel
  MAT.road.envMap = wet && cubeRT ? cubeRT.texture : envTex; MAT.road.envMapIntensity = wet ? 0.95 : 0.2;
  RU.wet.value = wet && quality === 'high' ? 1 : 0;
  MAT.road.needsUpdate = true;
  // sol, trottoirs et façades de jour : même environnement que le ciel
  for (const m of [MAT.side, MAT.walk]) { m.envMap = envTex; m.envMapIntensity = E.envK; m.needsUpdate = true; }
  MAT.bldDay = quality === 'high' ? MAT.bldDayHigh : MAT.bldDayLow;
  MAT.bldDayHigh.envMap = envTex; MAT.bldDayHigh.envMapIntensity = E.glassK; MAT.bldDayHigh.needsUpdate = true;
  MAT.neon.color.setScalar(E.neonK);
  MAT.pool.opacity = E.poolK;
  for (const l of lampLights) l.visible = E.lamps;
}
/* ================= Lookdev : route, ombres, environnement, étalonnage ================= */
const RU = { wet: { value: 0 } };   // uniforms partagés de la route
/* Route PBR : rugosité variable (usure, traces de roues), réparations plus sombres, flaques miroir la nuit sous la pluie.
   Bruit calculé en coordonnées monde : pas de motif répété malgré la texture qui se répète tous les 9 m. */
function roadShader(mat) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uWet = RU.wet;
    sh.vertexShader = 'varying vec3 vRoadW;\n' + sh.vertexShader.replace('#include <worldpos_vertex>',
      '#include <worldpos_vertex>\n vRoadW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = `varying vec3 vRoadW; uniform float uWet;
      float rh12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
      float rnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(rh12(i), rh12(i + vec2(1.0, 0.0)), f.x), mix(rh12(i + vec2(0.0, 1.0)), rh12(i + vec2(1.0, 1.0)), f.x), f.y); }
      ` + sh.fragmentShader
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        float rn = rnoise(vRoadW.xz * 0.11) * 0.62 + rnoise(vRoadW.xz * 0.43 + 7.0) * 0.38;
        float lane = fract(vUv.x * 3.0);
        float trk = exp(-pow((lane - 0.3) * 13.0, 2.0)) + exp(-pow((lane - 0.7) * 13.0, 2.0));
        float puddle = smoothstep(0.6, 0.7, rn - trk * 0.08) * uWet;
        diffuseColor.rgb *= (0.9 + 0.2 * rnoise(vRoadW.xz * 0.031 + 3.0)) * (1.0 - trk * 0.07) * mix(1.0, 0.5, puddle);
        roughnessFactor = clamp(roughnessFactor * (0.8 + rn * 0.4) - trk * 0.08, 0.04, 1.0);
        roughnessFactor = mix(roughnessFactor, 0.02, puddle);`)
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n normal = normalize(mix(normal, geometryNormal, puddle));');
  };
  mat.customProgramCacheKey = () => 'wfsRoad';
}

/* Ombre stable : la boîte d'ombre est décalée vers l'avant (on voit ce qui arrive, pas ce qui est derrière)
   et calée sur la grille des texels de la carte d'ombre, ce qui supprime le scintillement des bords en roulant. */
const SHADOW_AHEAD = 20;
const _shA = new THREE.Vector3(), _shB = new THREE.Vector3(), _shC = new THREE.Vector3(), _shM = new THREE.Matrix4();
function stableShadow(light) {
  const sh = light.shadow;
  sh.updateMatrices = function (l) {
    const cam = this.camera;
    _shA.setFromMatrixPosition(l.target.matrixWorld);                     // centre (la voiture)
    _shB.setFromMatrixPosition(l.matrixWorld).sub(_shA);                  // vers la lumière
    if (camera) { camera.getWorldDirection(_shC); _shC.y = 0; if (_shC.lengthSq() > 1e-6) _shA.addScaledVector(_shC.normalize(), SHADOW_AHEAD); }
    cam.position.copy(_shA).add(_shB); cam.lookAt(_shA); cam.updateMatrixWorld();
    // calage sur les texels
    const texel = (cam.right - cam.left) / this.mapSize.x;
    _shC.copy(_shA).applyMatrix4(cam.matrixWorldInverse);
    const dx = Math.round(_shC.x / texel) * texel - _shC.x, dy = Math.round(_shC.y / texel) * texel - _shC.y;
    _shM.extractRotation(cam.matrixWorld);
    _shC.set(-dx, -dy, 0).applyMatrix4(_shM);
    cam.position.add(_shC); cam.updateMatrixWorld();
    _shM.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    this._frustum.setFromProjectionMatrix(_shM);
    this.matrix.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    this.matrix.multiply(cam.projectionMatrix).multiply(cam.matrixWorldInverse);
  };
}

/* Éclairage d'environnement cohérent avec le ciel : la voûte (même shader) + un sol sombre, filtrés en PMREM.
   Recalculé seulement au changement d'ambiance ; réservé à la qualité haute. */
let skyEnvRT = null, envScene = null, envGround = null, pmremGen = null;
function updateSkyEnv(E) {
  if (skyEnvRT) { skyEnvRT.dispose(); skyEnvRT = null; }
  if (quality !== 'high') return null;
  try {
    if (!envScene) {
      envScene = new THREE.Scene();
      envScene.add(new THREE.Mesh(skyGeo, sky.material));
      envGround = new THREE.Mesh(new THREE.CircleGeometry(1500, 24), new THREE.MeshBasicMaterial({ color: 0x404040 }));
      envGround.rotation.x = -Math.PI / 2; envGround.position.y = -25; envScene.add(envGround);
      pmremGen = new THREE.PMREMGenerator(renderer);
    }
    envGround.material.color.set(E.envGround || E.hemiGround);
    skyEnvRT = pmremGen.fromScene(envScene, 0.02, 0.1, 2000);
    return skyEnvRT.texture;
  } catch (e) { skyEnvRT = null; return null; }
}

/* Étalonnage final (une seule passe plein écran) :
   flou radial léger + aberration chromatique à très haute vitesse / nitro, éclat du soleil discret,
   courbe filmique ACES appliquée dans un espace quasi linéaire (les couleurs du jeu sont réglées en sRGB),
   exposition, contraste, saturation, teinte des ombres et des hautes lumières, tramage anti-bandes. */
function makeGradeShader(taps) {
  return {
    uniforms: {
      tDiffuse: { value: null }, uExposure: { value: 1 }, uWhite: { value: 1.6 }, uContrast: { value: 1 }, uSat: { value: 1 },
      uLift: { value: new THREE.Vector3() }, uGain: { value: new THREE.Vector3(1, 1, 1) },
      uBlur: { value: 0 }, uCA: { value: 0 }, uFlare: { value: 0 }, uSunUV: { value: new THREE.Vector2(0.5, 0.8) },
      uFlareCol: { value: new THREE.Color('#fff0d4') }, uAspect: { value: 1.7 }
    },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      precision highp float;
      #define TAPS ${taps}
      uniform sampler2D tDiffuse; varying vec2 vUv;
      uniform float uExposure, uWhite, uContrast, uSat, uBlur, uCA, uFlare, uAspect;
      uniform vec3 uLift, uGain, uFlareCol; uniform vec2 uSunUV;
      vec3 aces(vec3 x) { return (x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14); }
      float ring(vec2 p, float r, float w) { return smoothstep(w, 0.0, abs(length(p) - r)); }
      void main() {
        vec2 d = vUv - vec2(0.5, 0.47);
        vec3 col = texture2D(tDiffuse, vUv).rgb;
        // branche sur un uniform (identique pour tous les pixels) : aucun coût quand on roule doucement
        if (uBlur > 0.0) {
          vec2 dir = d * uBlur * smoothstep(0.06, 0.5, length(d));   // centre de l'image net
          vec3 acc = col; float ws = 1.0;
          for (int i = 1; i < TAPS; i++) { float t = float(i) / float(TAPS - 1), w = 1.0 - 0.55 * t; acc += texture2D(tDiffuse, vUv - dir * t).rgb * w; ws += w; }
          col = acc / ws;
          col.r = mix(col.r, texture2D(tDiffuse, vUv - d * uCA).r, 0.6);
          col.b = mix(col.b, texture2D(tDiffuse, vUv + d * uCA).b, 0.6);
        }
        if (uFlare > 0.0) {
          // visibilité : le soleil est-il masqué (immeuble, nuage) ? on lit l'image à sa position
          vec3 s = texture2D(tDiffuse, uSunUV).rgb + texture2D(tDiffuse, uSunUV + vec2(0.004, 0.0)).rgb + texture2D(tDiffuse, uSunUV - vec2(0.004, 0.0)).rgb;
          float vis = smoothstep(2.55, 2.9, dot(s, vec3(0.333))) * uFlare;
          vec2 a = vec2(uAspect, 1.0), sv = (vUv - uSunUV) * a;
          float glare = exp(-length(sv) * 7.0) * 0.28 + exp(-abs(sv.y) * 90.0) * exp(-abs(sv.x) * 2.2) * 0.1;
          vec2 ax = (vec2(0.5) - uSunUV) * a;
          vec3 gh = vec3(1.0, 0.75, 0.45) * smoothstep(0.05, 0.0, length(sv - ax * 0.7)) * 0.07
                  + vec3(0.45, 0.8, 1.0) * ring(sv - ax * 1.25, 0.07, 0.012) * 0.06
                  + vec3(0.7, 1.0, 0.6) * smoothstep(0.025, 0.0, length(sv - ax * 1.6)) * 0.08
                  + vec3(1.0, 0.5, 0.8) * smoothstep(0.11, 0.0, length(sv - ax * 2.1)) * 0.035;
          col += (uFlareCol * glare + gh) * vis;
        }
        // courbe filmique dans un espace quasi linéaire, blanc normalisé
        vec3 lin = pow(max(col, 0.0), vec3(2.2)) * uExposure;
        col = pow(clamp(aces(lin) / aces(vec3(uWhite)), 0.0, 1.0), vec3(1.0 / 2.2));
        float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
        col = mix(vec3(l), col, uSat);
        col = (col - 0.5) * uContrast + 0.5;
        col = col * uGain + uLift * (1.0 - col);
        // tramage : supprime les bandes dans le ciel et le brouillard
        vec3 p3 = fract(vec3(gl_FragCoord.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33);
        col += (fract((p3.x + p3.y) * p3.z) - 0.5) / 255.0;
        gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
      }`
  };
}
let gradePass = null, gradeBlur = 0;
const _gv = new THREE.Vector3(), _gd = new THREE.Vector3();
const GARAGE_GRADE = { exposure: 0.8, white: 1.5, contrast: 1.0, sat: 1.02, lift: [0.004, 0.006, 0.012], gain: [1, 1, 1] };
/* réglages de l'étalonnage lus à chaque image (aucune allocation) */
function updateGrade(dt) {
  const U = gradePass.uniforms, garage = state === 'garage' || !ENV;
  const G = garage ? GARAGE_GRADE : (ENV.grade || GARAGE_GRADE);
  U.uExposure.value = G.exposure; U.uWhite.value = G.white; U.uContrast.value = G.contrast; U.uSat.value = G.sat;
  U.uLift.value.set(G.lift[0], G.lift[1], G.lift[2]); U.uGain.value.set(G.gain[0], G.gain[1], G.gain[2]);
  U.uAspect.value = W / Math.max(1, H);
  // flou radial : seulement au-delà de 80 % de la vitesse max, plus fort en nitro
  const p = garage ? 0 : Math.abs(speed) / MAX_SPEED;
  const target = reduceMotion || garage ? 0 : clamp((p - 0.8) / 0.35, 0, 1) * 0.022 + (nitroOn ? 0.016 : 0);
  gradeBlur += (target - gradeBlur) * Math.min(1, dt * 4);
  if (target === 0 && gradeBlur < 0.0008) gradeBlur = 0;
  U.uBlur.value = gradeBlur; U.uCA.value = gradeBlur * 0.12;
  // éclat du soleil : soleil devant la caméra et dans le cadre
  let fl = 0;
  if (!garage && ENV.sunDisc && ENV.flare && camera) {
    const sd = ENV.sunDir;
    _gd.set(sd[0], sd[1], sd[2]).normalize();
    camera.getWorldDirection(_gv);
    const facing = _gv.dot(_gd);
    if (facing > 0.2) {
      _gv.copy(camera.position).addScaledVector(_gd, 900).project(camera);
      const x = _gv.x * 0.5 + 0.5, y = _gv.y * 0.5 + 0.5;
      U.uSunUV.value.set(x, y);
      fl = ENV.flare * clamp((facing - 0.2) * 3, 0, 1) * (x > 0 && x < 1 && y > 0 && y < 1 ? 1 : 0);
    }
    if (gradePass.userData !== ENV.sunColor) { gradePass.userData = ENV.sunColor; U.uFlareCol.value.set(ENV.sunColor); }
  }
  U.uFlare.value = fl;
}

function setupComposer() {
  if (composer) { for (const p of composer.passes) if (p.dispose) p.dispose(); composer.renderTarget1.dispose(); composer.renderTarget2.dispose(); }
  composer = null; bloom = null; gradePass = null;
  if (quality !== 'high' || !THREE.EffectComposer || !THREE.UnrealBloomPass) return;
  try {
    const caps = renderer.capabilities;
    // ordinateur WebGL2 : cible en virgule flottante (HDR) pour que le bloom et la courbe filmique travaillent au-delà du blanc
    const hdr = caps.isWebGL2 && !isTouch && !!renderer.extensions.get('EXT_color_buffer_float');
    const rt = caps.isWebGL2 && THREE.WebGLMultisampleRenderTarget
      ? new THREE.WebGLMultisampleRenderTarget(Math.max(1, W * DPR), Math.max(1, H * DPR), { format: THREE.RGBAFormat, type: hdr ? THREE.HalfFloatType : THREE.UnsignedByteType })
      : undefined;
    if (rt) rt.samples = 4;
    composer = new THREE.EffectComposer(renderer, rt);
    renderPass = new THREE.RenderPass(scene, camera);
    composer.addPass(renderPass);
    bloom = new THREE.UnrealBloomPass(new THREE.Vector2(W, H), 0.8, 0.45, 0.46);
    composer.addPass(bloom);
    if (THREE.ShaderPass) {
      gradePass = new THREE.ShaderPass(makeGradeShader(isTouch ? 4 : 7));
      let last = performance.now();
      gradePass.render = function (r, wb, rb, dt, mask) {
        const now = performance.now(); updateGrade(Math.min(0.05, (now - last) / 1000)); last = now;
        THREE.ShaderPass.prototype.render.call(this, r, wb, rb, dt, mask);
      };
      composer.addPass(gradePass);
    }
    composer.setSize(W, H);
  } catch (e) { composer = null; gradePass = null; }
}
function onResize() {
  W = innerWidth; H = innerHeight;
  DPR = Math.min(window.devicePixelRatio || 1, quality === 'high' ? (isTouch ? 1.5 : 1.75) : 1.25);   // mobile : 1.5 max (coût x2 au-delà)
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

/* --- tronçons de décor (chunks) --- */
const chunks = new Map();
const TINTS = [[1, 0.96, 0.9], [0.85, 0.92, 1], [0.72, 0.72, 0.8], [1, 0.9, 0.85]];
function lateral(p, lat, dy = 0) { return [p.x + Math.cos(p.th) * lat, p.y + dy, p.z + Math.sin(p.th) * lat]; }
function axes(th) { return [[Math.cos(th), 0, Math.sin(th)], [Math.sin(th), 0, -Math.cos(th)]]; }
/* coordonnées de texture tirées de la position (1 répétition = 3 m) : donne du grain au sol et aux décors */
function worldUV(geo) {
  const p = geo.attributes.position.array, n = geo.attributes.normal.array, uv = new Float32Array(p.length / 3 * 2);
  for (let i = 0, j = 0; i < p.length; i += 3, j += 2) {
    const up = Math.abs(n[i + 1]) > 0.6;
    uv[j] = (up ? p[i] : p[i] + p[i + 2]) / 3;
    uv[j + 1] = (up ? p[i + 2] : p[i + 1]) / 3;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}
const SMALL_DECOR = new Set(['fence', 'bales', 'umbrella', 'tires', 'pole', 'marshal', 'tower', 'streettree', 'parked', 'bench', 'bollard', 'railing', 'mesh', 'guard', 'vines', 'sign', 'flag', 'pitwall', 'busstop']);
const chunkLod = new Map();
const LOD_FAR_M = 200;   // au-delà, les petits décors ne sont pas dessinés
function buildChunk(ci, lod = 0) {
  const a0 = ci * CH, a1 = a0 + CH;
  const road = newBuf(), side = newBuf(), bld = newBuf(), neon = newBuf(), pool = newBuf(), walk = newBuf();
  const group = new THREE.Group();
  const ctx = { side, bld, neon, pool, group, rotors: [], lod, leaf: newBuf() };   // leaf : feuillage en cartes alpha-testées (life.js)
  curZone = zoneAt(a0);   // tout le tronçon est dans la même zone (zones alignées sur les tronçons)
  const profiles = { '-1': GROUND[MAP.ground](-1, curZone), '1': GROUND[MAP.ground](1, curZone) };
  for (let a = a0; a < a1; a++) {
    const p0 = pose(a), p1 = pose(a + 1);
    const v0 = a * SEG_M / 9, v1 = (a + 1) * SEG_M / 9;
    quad(road, lateral(p0, -RW), lateral(p0, RW), lateral(p1, RW), lateral(p1, -RW), [1, 1, 1], [[0, v0], [1, v0], [1, v1], [0, v1]], [0, 1, 0]);
    // ligne de départ en damier
    if (segAt(a).index === 0) {
      for (let k = 0; k < 10; k++) {
        const x0 = -RW + k * RW / 5, col = k % 2 ? [0.95, 0.95, 0.95] : [0.06, 0.06, 0.07];
        quad(side, lateral(p0, x0, 0.02), lateral(p0, x0 + RW / 5, 0.02), lateral(p1, x0 + RW / 5, 0.02), lateral(p1, x0, 0.02), col, null, [0, 1, 0]);
      }
    }
    for (const s of [-1, 1]) {
      for (const st of profiles[s]) {
        const col = typeof st.col === 'function' ? st.col(a, s) : st.col;
        if (st.curb) quad(side, lateral(p0, st.a * s), lateral(p1, st.a * s), lateral(p1, st.a * s, st.ya), lateral(p0, st.a * s, st.ya), col, null, [-Math.cos(p0.th) * s, 0, -Math.sin(p0.th) * s]);
        quad(st.walk ? walk : side, lateral(p0, st.a * s, st.ya), lateral(p1, st.a * s, st.ya), lateral(p1, st.b * s, st.yb), lateral(p0, st.b * s, st.yb), col, null, [0, 1, 0]);
      }
    }
    const deco = segAt(a).deco;
    if (!deco) continue;
    for (const it of deco.items) { if (lod && SMALL_DECOR.has(it.t)) continue; const fn = DECOR[it.t]; if (fn) fn(ctx, it, p0, a); }
  }
  const add = (B, mat, uv, cast, recv) => {
    if (!B.p.length) return null;
    const m = new THREE.Mesh(toGeo(B, uv), mat);
    m.castShadow = !!cast; m.receiveShadow = !!recv;
    group.add(m); return m;
  };
  add(road, MAT.road, true, false, true);
  const sm = add(side, MAT.side, false, true, true);
  if (sm) worldUV(sm.geometry);
  const wm = add(walk, MAT.walk, false, false, true);
  if (wm) worldUV(wm.geometry);
  add(bld, ENV.windowsLit ? MAT.bld : MAT.bldDay, true, true, !ENV.windowsLit); add(neon, MAT.neon, false);
  if (ENV.poolK > 0) add(pool, MAT.pool, true);
  if (typeof addFoliageMesh === 'function') addFoliageMesh(group, ctx.leaf);   // végétation : 1 maillage, 1 matériau partagé (life.js)
  group.userData.rotors = ctx.rotors;
  scene.add(group);
  chunks.set(ci, group);
}
let boardGeo = null;
function disposeChunk(ci) {
  const g = chunks.get(ci); if (!g) return;
  g.children.forEach((m) => { if (m.geometry !== boardGeo && m.geometry !== adGeo) m.geometry.dispose(); });
  scene.remove(g); chunks.delete(ci); chunkLod.delete(ci);
}
function ensureChunks(sAbs, all) {
  const aP = Math.floor(sAbs / SEG);
  const c0 = Math.floor((aP - 30) / CH), c1 = Math.floor((aP + VIEW) / CH);
  for (const ci of [...chunks.keys()]) if (ci < c0 || ci > c1) disposeChunk(ci);
  let built = 0;
  for (let ci = c0; ci <= c1; ci++) {
    const lod = (ci * CH - aP) * SEG_M > LOD_FAR_M ? 1 : 0;
    if (chunks.has(ci)) {
      if (chunkLod.get(ci) <= lod) continue;
      disposeChunk(ci);               // le tronçon se rapproche : on le reconstruit en détail
    }
    buildChunk(ci, lod); chunkLod.set(ci, lod);
    if (!all && ++built >= 2) break;
  }
  trimPoses(aP);
}
function clearChunks() { for (const ci of [...chunks.keys()]) disposeChunk(ci); }
