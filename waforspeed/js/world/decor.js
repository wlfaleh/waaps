/* WaForSpeed — Décors et bas-côtés de chaque carte.
   generateDecor() place les objets le long du tracé (données, une fois par carte) ;
   GROUND donne le profil des bas-côtés ; DECOR[type] dessine un objet dans un tronçon. */
'use strict';

const BOARD_TEXTS = [['WAFORSPEED', '#FF6A00'], ['GARAGE 88', '#00E5FF'], ['TURBO CAFÉ', '#FF6A00'], ['NUIT BLANCHE', '#00E5FF'], ['PNEUS 24/7', '#00E5FF']];
const AD_TEXTS = [['WAFORSPEED', '#e2262b', '#ffffff'], ['GRAND PRIX', '#101014', '#ffd23a'], ['PNEUS 24/7', '#ffd23a', '#101014'], ['TURBO', '#1d3f8f', '#ffffff']];

/* ---------- placement des objets (données) ---------- */
function generateDecor(map) {
  const len = segments.length, D = mulberry32(map.seed * 31 + 7);
  const item = (n, o) => { segments[((n % len) + len) % len].deco.items.push(o); };
  const collide = (n, offsetM, hit) => { segments[((n % len) + len) % len].sprites.push({ offset: offsetM / RW, collide: true, hit }); };
  for (let n = 0; n < len; n++) segments[n].deco = { items: [], lamp: 0, lampStyle: null };
  const lamp = (n, side, style) => {
    const s = segments[n % len]; s.deco.lamp = side; s.deco.lampStyle = style;
    item(n, { t: 'lamp', side, style });
    collide(n, side * (RW + (style === 'flood' ? 7 : 0.8)), 0.14);
  };

  if (map.ground === 'city') {
    for (const side of [-1, 1]) for (let n = side < 0 ? 0 : 5; n < len - 11; n += 11) {
      if (D() < 0.1) continue;
      const tall = D();
      item(n, { t: 'bld', side, len: 11 * SEG_M - 0.6 - D() * 2, d: 10 + D() * 14,
        h: tall < 0.15 ? 55 + D() * 40 : tall < 0.6 ? 22 + D() * 30 : 10 + D() * 14,
        tint: Math.floor(D() * 4), u0: Math.floor(D() * 16) / 16, v0: Math.floor(D() * 16) / 16,
        neon: D() < 0.4 ? (D() < 0.5 ? '#00E5FF' : '#FF6A00') : null, sign: D() < 0.3 });
    }
    for (let n = 12; n < len; n += 24) lamp(n, (n / 24 | 0) % 2 ? 1 : -1, 'city');
    for (let n = 40; n < len; n += 150) item(n, { t: 'zebra' });
    for (const side of [-1, 1]) for (let n = side < 0 ? 4 : 10; n < len; n += 16) {
      if (segments[n].deco.lamp || segments[(n + 1) % len].deco.lamp || D() < 0.15) continue;
      item(n, { t: 'streettree', side, lat: RW + 3.6, h: 5 + D() * 2.5 }); collide(n, side * (RW + 3.6), 0.08);
    }
    for (let n = 75; n < len - 40; n += 140 + Math.floor(D() * 60)) {
      const side = D() < 0.5 ? -1 : 1;
      if (segments[n].deco.lamp) continue;
      item(n, { t: 'board', side, text: Math.floor(D() * BOARD_TEXTS.length) });
      collide(n, side * (RW + 1), 0.15);
    }
  } else if (map.ground === 'beach') {
    // côté mer (droite) : promenade, palmiers, parasols, postes de secours ; côté terre : villas et palmiers
    for (let n = 6; n < len; n += 9 + Math.floor(D() * 4)) { item(n, { t: 'palm', side: 1, lat: RW + 3.2, h: 7 + D() * 4, lean: (D() - 0.5) * 0.5, rot: D() * 6 }); collide(n, RW + 3.2, 0.1); }
    for (let n = 3; n < len; n += 7 + Math.floor(D() * 6)) item(n, { t: 'umbrella', side: 1, lat: RW + 12 + D() * 20, col: Math.floor(D() * 5), along: (D() - 0.5) * 4 });
    for (let n = 40; n < len; n += 160 + Math.floor(D() * 80)) item(n, { t: 'tower', side: 1, lat: RW + 22 });
    for (let n = 2; n < len - 12; n += 12 + Math.floor(D() * 10)) {
      if (D() < 0.25) continue;
      item(n, { t: 'villa', side: -1, lat: RW + 12 + D() * 6, w: 8 + D() * 6, d: 8 + D() * 5, h: 4 + D() * 5, roof: Math.floor(D() * 3), floors: D() < 0.4 ? 2 : 1 });
    }
    for (let n = 9; n < len; n += 14 + Math.floor(D() * 8)) item(n, { t: 'palm', side: -1, lat: RW + 5 + D() * 3, h: 6 + D() * 4, lean: (D() - 0.5) * 0.4, rot: D() * 6 });
    for (let n = 15; n < len; n += 30) lamp(n, 1, 'beach');
    for (let n = 70; n < len; n += 200) item(n, { t: 'zebra' });
    for (let n = 90; n < len - 40; n += 180 + Math.floor(D() * 60)) { item(n, { t: 'board', side: -1, text: Math.floor(D() * BOARD_TEXTS.length) }); collide(n, -(RW + 1), 0.15); }
  } else if (map.ground === 'country') {
    for (const side of [-1, 1]) {
      // haies et clôtures alternées, arbres isolés ou en bosquets, fermes, bottes de foin, éoliennes au loin
      for (let n = 0; n < len; n += 3) if (Math.floor((n + (side > 0 ? 40 : 0)) / 90) % 2 === 0) item(n, { t: 'fence', side, lat: RW + 3.4 });
      for (let n = 0; n < len; n += 24) if (Math.floor((n + (side > 0 ? 40 : 0)) / 90) % 2 === 1 && D() < 0.8) item(n, { t: 'hedge', side, lat: RW + 4.2, l: 24 * SEG_M - 2 });
      for (let n = Math.floor(D() * 10); n < len; n += 6 + Math.floor(D() * 18)) item(n, { t: 'tree', side, lat: RW + 6 + D() * (D() < 0.3 ? 70 : 20), h: 6 + D() * 7, kind: D() < 0.35 ? 'pine' : 'round', along: (D() - 0.5) * 6 });
      for (let n = 30 + Math.floor(D() * 60); n < len; n += 140 + Math.floor(D() * 120)) item(n, { t: 'farm', side, lat: RW + 28 + D() * 30, barn: D() < 0.5 });
      for (let n = Math.floor(D() * 40); n < len; n += 40 + Math.floor(D() * 60)) item(n, { t: 'bales', side, lat: RW + 16 + D() * 40, k: 2 + Math.floor(D() * 4) });
      for (let n = 60 + Math.floor(D() * 50); n < len; n += 180 + Math.floor(D() * 150)) item(n, { t: 'turbine', side, lat: RW + 90 + D() * 80, h: 55 + D() * 25 });
    }
    for (let n = 20; n < len; n += 50) { const side = (n / 50 | 0) % 2 ? 1 : -1; item(n, { t: 'pole', side, lat: RW + 2.6 }); collide(n, side * (RW + 2.6), 0.08); }
  } else if (map.ground === 'circuit') {
    for (const side of [-1, 1]) {
      for (let n = 0; n < len; n += 4) item(n, { t: 'tires', side, lat: RW + 5.6 });
      for (let n = 0; n < len; n += 20) item(n, { t: 'adboard', side, lat: RW + 5.0, text: Math.floor(D() * AD_TEXTS.length) });
      for (let n = Math.floor(D() * 30); n < len; n += 8 + Math.floor(D() * 16)) item(n, { t: 'tree', side, lat: RW + 40 + D() * 60, h: 8 + D() * 8, kind: D() < 0.5 ? 'pine' : 'round', along: 0 });
      for (let n = 60; n < len; n += 110) item(n, { t: 'marshal', side, lat: RW + 8 });
    }
    // tribunes sur les lignes droites
    for (let n = 0; n < len; n++) {
      const s = segments[n];
      if (Math.abs(s.curve) < 0.2 && n % 26 === 0) for (const side of [-1, 1]) if (D() < 0.8) item(n, { t: 'stand', side, lat: RW + 14, l: 26 * SEG_M - 1, rows: 6 + Math.floor(D() * 5) });
    }
    for (let n = 10; n < len; n += 34) lamp(n, (n / 34 | 0) % 2 ? 1 : -1, 'flood');
  }
}

/* ---------- bas-côtés : bandes depuis le bord de la route ----------
   a, b : distance au centre (m) ; ya, yb : hauteurs ; col : couleur ou fonction(a, s) */
const GCOL = {
  kerbA: hex3('#8a3a08'), kerbB: hex3('#2a2420'), walk: hex3('#8a8884'), cityGround: hex3('#3a3a3c'),
  white: hex3('#e8e8e8'), grey: hex3('#9a9a9a'), prom: hex3('#b8ab8c'), sand: hex3('#cdb683'), wet: hex3('#a38d60'),
  dune: hex3('#9aa65e'), hill: hex3('#7a8a4c'), verge: hex3('#6d8a3a'), ditch: hex3('#4f6b2b'), farHill: hex3('#6c8a3e'),
  red: hex3('#d81e24'), grass: hex3('#4f7f32'), grass2: hex3('#4a7a2e')
};
const FIELDS = ['#9bb04f', '#8aa043', '#cdb259', '#bfa34c', '#7e9a3c', '#a9a35a'].map((h) => hex3(h));
const fieldCol = (a, s) => FIELDS[(mulberry32(Math.floor(a / 70) * 7 + (s > 0 ? 3 : 0))() * FIELDS.length) | 0];
const GROUND = {
  city: (s) => [
    { a: RW, b: RW + 0.5, ya: 0.15, yb: 0.15, col: (a) => (Math.floor(a / RUMBLE) % 2 ? GCOL.kerbA : GCOL.kerbB), curb: true },
    { a: RW + 0.5, b: RW + 6, ya: 0.15, yb: 0.15, col: GCOL.walk, walk: true },
    { a: RW + 6, b: RW + 70, ya: 0.15, yb: -0.3, col: GCOL.cityGround }
  ],
  beach: (s) => s > 0 ? [
    { a: RW, b: RW + 0.4, ya: 0.1, yb: 0.1, col: (a) => (Math.floor(a / RUMBLE) % 2 ? GCOL.white : GCOL.grey), curb: true },
    { a: RW + 0.4, b: RW + 5, ya: 0.1, yb: 0.1, col: GCOL.prom, walk: true },
    { a: RW + 5, b: RW + 38, ya: 0.05, yb: -1.1, col: GCOL.sand },
    { a: RW + 38, b: RW + 48, ya: -1.1, yb: -1.9, col: GCOL.wet }
  ] : [
    { a: RW, b: RW + 0.4, ya: 0.1, yb: 0.1, col: (a) => (Math.floor(a / RUMBLE) % 2 ? GCOL.white : GCOL.grey), curb: true },
    { a: RW + 0.4, b: RW + 3, ya: 0.1, yb: 0.1, col: GCOL.prom, walk: true },
    { a: RW + 3, b: RW + 30, ya: 0.1, yb: 1.6, col: GCOL.dune },
    { a: RW + 30, b: RW + 170, ya: 1.6, yb: 30, col: GCOL.hill }
  ],
  country: (s) => [
    { a: RW, b: RW + 1.6, ya: 0, yb: -0.05, col: GCOL.verge },
    { a: RW + 1.6, b: RW + 3, ya: -0.05, yb: -0.4, col: GCOL.ditch },
    { a: RW + 3, b: RW + 95, ya: -0.4, yb: 0.2, col: fieldCol },
    { a: RW + 95, b: RW + 220, ya: 0.2, yb: 9, col: GCOL.farHill }
  ],
  circuit: (s) => [
    { a: RW, b: RW + 1.3, ya: 0.04, yb: 0.04, col: (a) => (a % 2 ? GCOL.red : GCOL.white) },
    { a: RW + 1.3, b: RW + 14, ya: 0.02, yb: 0, col: GCOL.grass },
    { a: RW + 14, b: RW + 100, ya: 0, yb: 0.5, col: GCOL.grass2 }
  ]
};

/* ---------- petits outils de dessin ---------- */
const _m4 = THREE && new THREE.Matrix4(), _q = THREE && new THREE.Quaternion(), _e = THREE && new THREE.Euler(), _v = THREE && new THREE.Vector3(), _s = THREE && new THREE.Vector3();
/* ajoute une géométrie three.js (déplacée, tournée, mise à l'échelle) dans un buffer, avec une couleur */
function addGeo(B, geo, pos, yaw, col, scale = [1, 1, 1], pitch = 0, roll = 0) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  _e.set(pitch, yaw, roll, 'YXZ'); _q.setFromEuler(_e);
  _m4.compose(_v.set(pos[0], pos[1], pos[2]), _q, _s.set(scale[0], scale[1], scale[2]));
  g.applyMatrix4(_m4);
  const p = g.attributes.position.array, n = g.attributes.normal.array;
  for (let i = 0; i < p.length; i += 3) { B.p.push(p[i], p[i + 1], p[i + 2]); B.n.push(n[i], n[i + 1], n[i + 2]); B.c.push(col[0], col[1], col[2]); }
  g.dispose();
}
const PRIM = {};
function prims() {
  if (PRIM.cyl) return PRIM;
  PRIM.cyl = new THREE.CylinderGeometry(1, 1, 1, 8); PRIM.cyl.translate(0, 0.5, 0);
  PRIM.cyl12 = new THREE.CylinderGeometry(1, 1, 1, 12); PRIM.cyl12.translate(0, 0.5, 0);
  PRIM.cone = new THREE.ConeGeometry(1, 1, 8); PRIM.cone.translate(0, 0.5, 0);
  PRIM.ball = new THREE.IcosahedronGeometry(1, 0);
  PRIM.ball1 = new THREE.IcosahedronGeometry(1, 1);
  PRIM.box = new THREE.BoxGeometry(1, 1, 1); PRIM.box.translate(0, 0.5, 0);
  PRIM.roof = new THREE.CylinderGeometry(0.71, 0.71, 1, 4, 1); PRIM.roof.rotateZ(Math.PI / 2); PRIM.roof.rotateX(Math.PI / 4);
  PRIM.prism = new THREE.CylinderGeometry(1, 1, 1, 3); PRIM.prism.rotateZ(Math.PI / 2);
  return PRIM;
}
const C = {
  pole: hex3('#2a2e3b'), lampWarm: hex3('#ffd9a8'), lampCool: hex3('#e8f4ff'), trunk: hex3('#6b4a2e'), palmTrunk: hex3('#8a6a46'),
  frond: hex3('#3f7a32'), frond2: hex3('#4f8f3a'), leaf: hex3('#3f6f2a'), leaf2: hex3('#557f34'), pine: hex3('#2f5a2c'),
  wood: hex3('#8a6a46'), hedge: hex3('#2f5a26'), wall: hex3('#f2efe6'), wall2: hex3('#e8dcc4'), barnRed: hex3('#8e2a1e'),
  roofs: [hex3('#b5532e'), hex3('#2f5f8f'), hex3('#6b6b6b')], glassDark: hex3('#1d2a38'), hay: hex3('#d7b85a'),
  turb: hex3('#e9edf2'), tire: hex3('#141416'), tireRed: hex3('#c81e24'), tireWhite: hex3('#e8e8e8'), steel: hex3('#9aa0a8'),
  standRoof: hex3('#d9dde2'), standSeat: [hex3('#1d3f8f'), hex3('#c81e24'), hex3('#e8e8e8'), hex3('#2f8f4f')],
  umbr: [hex3('#e2262b'), hex3('#ffd23a'), hex3('#1d8fb8'), hex3('#ffffff'), hex3('#ff6a00')], lounger: hex3('#f2efe6'),
  towerRed: hex3('#d63a2a'), pool: [0.5, 0.32, 0.16], poolCool: [0.35, 0.38, 0.45]
};

/* ---------- dessin de chaque objet ---------- */
/* ctx : { side, bld, neon, pool, group, rotors } buffers du tronçon ; p : pose du segment ; a : segment absolu */
const DECOR = {
  bld(ctx, b, p, a) {
    const pm = pose(a + Math.round(b.len / SEG_M / 2));
    const [r, f] = axes(pm.th);
    const o = lateral(pm, b.side * (RW + 6.5 + b.d / 2), -3);
    box(ctx.bld, o, r, f, b.d, b.h + 3, b.len, TINTS[b.tint], {
      uv: (face, span, hh) => {
        if (face === 'top') return [[0.01, 0.01], [0.02, 0.01], [0.02, 0.02], [0.01, 0.02]];
        const u1 = b.u0 + span / 51.2, v1 = b.v0 + hh / 54.4;
        return [[b.u0, b.v0], [u1, b.v0], [u1, v1], [b.u0, v1]];
      }
    });
    const facade = b.side * (RW + 6.45);
    if (b.neon) {
      const c = hex3(b.neon), fo = lateral(pm, facade), along = (b.u0 - 0.5) * b.len * 0.6;
      box(ctx.neon, [fo[0] + f[0] * along, fo[1], fo[2] + f[2] * along], r, f, 0.12, b.h * 0.5, 0.35, c, { y0: b.h * 0.3 });
    }
    if (b.sign) {
      const c = hex3(b.neon || '#00E5FF');
      box(ctx.neon, lateral(pm, facade), r, f, 0.12, 0.25, b.len * 0.7, c, { y0: 4.2 });
      box(ctx.neon, lateral(pm, facade), r, f, 0.12, 0.25, b.len * 0.7, c, { y0: 5.6 });
    }
  },
  lamp(ctx, it, p) {
    const s = it.side, [r, f] = axes(p.th), P = prims();
    if (it.style === 'flood') {
      // projecteur de circuit : grand mât et rampe de lumières
      const base = lateral(p, s * (RW + 7), 0);
      addGeo(ctx.side, P.cyl, base, 0, C.steel, [0.25, 18, 0.25]);
      box(ctx.side, lateral(p, s * (RW + 6.4), 17.6), r, f, 1.6, 1.4, 3.2, C.pole);
      box(ctx.neon, lateral(p, s * (RW + 5.58), 17.75), r, f, 0.06, 1.1, 2.9, C.lampCool);
      poolQuad(ctx.pool, p, s * (RW - 3), 14, C.poolCool);
      return;
    }
    const beach = it.style === 'beach';
    box(ctx.side, lateral(p, s * (RW + 0.8), 0.1), r, f, 0.18, beach ? 5.8 : 7.6, 0.18, beach ? hex3('#e8e8e8') : C.pole);
    if (beach) {
      addGeo(ctx.neon, P.ball, lateral(p, s * (RW + 0.8), 6.1), 0, C.lampWarm, [0.35, 0.35, 0.35]);
      poolQuad(ctx.pool, p, s * (RW - 0.5), 7, C.pool);
    } else {
      box(ctx.side, lateral(p, s * (RW - 0.6), 7.5), r, f, 2.9, 0.14, 0.14, C.pole);
      box(ctx.neon, lateral(p, s * (RW - 1.9), 7.36), r, f, 0.9, 0.12, 0.38, C.lampWarm);
      poolQuad(ctx.pool, p, s * (RW - 2.4), 8, C.pool);
    }
  },
  board(ctx, it, p) {
    const s = it.side, [r, f] = axes(p.th), col = BOARD_TEXTS[it.text][1];
    box(ctx.side, lateral(p, s * (RW + 1), 0.15), r, f, 0.3, 6.2, 0.3, C.pole);
    box(ctx.side, lateral(p, s * (RW + 5), 0.15), r, f, 0.3, 6.2, 0.3, C.pole);
    box(ctx.side, lateral(p, s * (RW + 2), 6), r, f, 8.6, 3.6, 0.3, hex3('#0b0c14'));
    const nc = hex3(col);
    box(ctx.neon, lateral(p, s * (RW + 2), 9.6), r, f, 8.6, 0.14, 0.34, nc);
    box(ctx.neon, lateral(p, s * (RW + 2), 5.88), r, f, 8.6, 0.14, 0.34, nc);
    const panel = new THREE.Mesh(boardGeo, MAT.boards[it.text]);
    const pc = lateral(p, s * (RW + 2), 7.8);
    panel.position.set(pc[0] - f[0] * 0.17, pc[1], pc[2] - f[2] * 0.17);
    panel.rotation.y = -p.th;
    ctx.group.add(panel);
    if (MAP.ground === 'city') {
      // reflet du néon sur la route mouillée
      const rc = lateral(p, s * (RW - 1.5), 0.04), L = 16, Wd = 2.6, k = 0.45;
      const cx = rc[0] - f[0] * L * 0.5, cz = rc[2] - f[2] * L * 0.5;
      quad(ctx.pool, [cx - r[0] * Wd - f[0] * L, rc[1], cz - r[2] * Wd - f[2] * L], [cx + r[0] * Wd - f[0] * L, rc[1], cz + r[2] * Wd - f[2] * L],
        [cx + r[0] * Wd + f[0] * L, rc[1], cz + r[2] * Wd + f[2] * L], [cx - r[0] * Wd + f[0] * L, rc[1], cz - r[2] * Wd + f[2] * L], [nc[0] * k, nc[1] * k, nc[2] * k], [[0, 0], [1, 0], [1, 1], [0, 1]], [0, 1, 0]);
    }
  },
  palm(ctx, it, p) {
    const P = prims(), base = lateral(p, it.side * it.lat, groundY(it.side, it.lat));
    // tronc légèrement courbé en 4 tronçons, penché dans la direction it.rot
    let x = base[0], y = base[1], z = base[2];
    const segH = it.h / 4, yaw = it.rot;
    for (let i = 0; i < 4; i++) {
      const tilt = Math.abs(it.lean) * (i + 1) / 4;
      addGeo(ctx.side, P.cyl, [x, y, z], yaw, C.palmTrunk, [0.22 - i * 0.03, segH * 1.02, 0.22 - i * 0.03], tilt, 0);
      x += Math.sin(tilt) * segH * Math.sin(yaw); z += Math.sin(tilt) * segH * Math.cos(yaw); y += Math.cos(tilt) * segH;
    }
    // palmes : 8 feuilles retombantes
    for (let k = 0; k < 8; k++) {
      const ang = it.rot + k * Math.PI / 4;
      addGeo(ctx.side, P.box, [x, y - 0.1, z], ang, k % 2 ? C.frond : C.frond2, [0.9, 0.06, 3.6], 0, 0);
      const g = ctx.side; const n0 = g.p.length;
      // inclinaison vers le bas : on abaisse l'extrémité des feuilles
      for (let i = n0 - 36 * 3; i < g.p.length; i += 3) {
        const dx = g.p[i] - x, dz = g.p[i + 2] - z, d = Math.hypot(dx, dz);
        g.p[i + 1] -= d * d * 0.09;
      }
    }
    addGeo(ctx.side, P.ball, [x, y - 0.2, z], 0, hex3('#5b4a2a'), [0.35, 0.3, 0.35]);
  },
  umbrella(ctx, it, p) {
    const P = prims(), [r, f] = axes(p.th), base = lateral(p, it.side * it.lat, 0);
    const b = [base[0] + f[0] * it.along, sandY(it.lat), base[2] + f[2] * it.along];
    b[1] = p.y + b[1];
    addGeo(ctx.side, P.cyl, b, 0, C.wall, [0.04, 2.3, 0.04]);
    addGeo(ctx.side, P.cone, [b[0], b[1] + 1.9, b[2]], 0, C.umbr[it.col], [1.5, 0.55, 1.5]);
    box(ctx.side, [b[0] + r[0] * 1.2, b[1], b[2] + r[2] * 1.2], r, f, 0.7, 0.3, 1.9, C.lounger);
  },
  tower(ctx, it, p) {
    const P = prims(), [r, f] = axes(p.th), b = lateral(p, it.side * it.lat, sandY(it.lat));
    for (const dx of [-0.8, 0.8]) for (const dz of [-0.8, 0.8]) addGeo(ctx.side, P.cyl, [b[0] + r[0] * dx + f[0] * dz, b[1], b[2] + r[2] * dx + f[2] * dz], 0, C.wall, [0.08, 2.4, 0.08]);
    box(ctx.side, [b[0], b[1] + 2.4, b[2]], r, f, 2.2, 1.6, 2.2, C.towerRed);
    box(ctx.side, [b[0], b[1] + 4.0, b[2]], r, f, 2.6, 0.12, 2.6, C.wall);
  },
  villa(ctx, it, p) {
    const P = prims(), [r, f] = axes(p.th), base = lateral(p, it.side * (it.lat + it.d / 2), 0);
    const y0 = p.y + groundY(it.side, it.lat + it.d / 2) - 0.2;
    const o = [base[0], y0, base[2]];
    const wall = it.roof === 1 ? C.wall : C.wall2;
    box(ctx.side, o, r, f, it.d, it.h, it.w, wall);
    // fenêtres sur la façade côté route
    for (let i = -1; i <= 1; i++) for (let fl = 0; fl < it.floors; fl++) {
      box(ctx.side, [o[0] + r[0] * (-it.side * (it.d / 2 + 0.02)) + f[0] * i * it.w * 0.3, o[1] + 1 + fl * 2.6, o[2] + r[2] * (-it.side * (it.d / 2 + 0.02)) + f[2] * i * it.w * 0.3], r, f, 0.06, 1.3, 1.2, C.glassDark);
    }
    addGeo(ctx.side, P.roof, [o[0], o[1] + it.h + 0.9, o[2]], -p.th, C.roofs[it.roof], [it.d * 1.05, 1.8, it.w * 1.05]);
  },
  tree(ctx, it, p) {
    const P = prims(), [, f] = axes(p.th), b0 = lateral(p, it.side * it.lat, 0);
    const b = [b0[0] + f[0] * it.along, p.y + groundY(it.side, it.lat) - 0.1, b0[2] + f[2] * it.along];
    if (it.kind === 'pine') {
      addGeo(ctx.side, P.cyl, b, 0, C.trunk, [0.25, it.h * 0.3, 0.25]);
      addGeo(ctx.side, P.cone, [b[0], b[1] + it.h * 0.2, b[2]], 0, C.pine, [it.h * 0.28, it.h * 0.55, it.h * 0.28]);
      addGeo(ctx.side, P.cone, [b[0], b[1] + it.h * 0.48, b[2]], 0.4, C.pine, [it.h * 0.21, it.h * 0.5, it.h * 0.21]);
    } else {
      addGeo(ctx.side, P.cyl, b, 0, C.trunk, [0.3, it.h * 0.45, 0.3]);
      addGeo(ctx.side, P.ball1, [b[0], b[1] + it.h * 0.62, b[2]], it.h, C.leaf, [it.h * 0.36, it.h * 0.32, it.h * 0.36]);
      addGeo(ctx.side, P.ball, [b[0] + it.h * 0.15, b[1] + it.h * 0.78, b[2]], 0.6, C.leaf2, [it.h * 0.24, it.h * 0.22, it.h * 0.24]);
    }
  },
  fence(ctx, it, p) {
    const [r, f] = axes(p.th);
    box(ctx.side, lateral(p, it.side * it.lat, 0), r, f, 0.12, 1.2, 0.12, C.wood);
    for (const y of [0.45, 0.95]) box(ctx.side, lateral(p, it.side * it.lat, y), r, f, 0.06, 0.1, 3 * SEG_M, C.wood);
  },
  hedge(ctx, it, p, a) {
    const pm = pose(a + Math.round(it.l / SEG_M / 2)), [r, f] = axes(pm.th);
    box(ctx.side, lateral(pm, it.side * it.lat, -0.2), r, f, 1.4, 1.7, it.l, C.hedge);
  },
  farm(ctx, it, p) {
    const P = prims(), [r, f] = axes(p.th), b = lateral(p, it.side * it.lat, groundY(it.side, it.lat) - 0.2);
    box(ctx.side, b, r, f, 8, 4.5, 11, C.wall2);
    addGeo(ctx.side, P.roof, [b[0], b[1] + 4.5 + 1.1, b[2]], -p.th, C.roofs[0], [8.6, 2.2, 11.6]);
    if (it.barn) {
      const bb = [b[0] + f[0] * 16, b[1], b[2] + f[2] * 16];
      box(ctx.side, bb, r, f, 10, 6, 14, C.barnRed);
      addGeo(ctx.side, P.roof, [bb[0], bb[1] + 6 + 1.4, bb[2]], -p.th, C.roofs[2], [10.6, 2.8, 14.6]);
    }
  },
  zebra(ctx, it, p, a) {
    // passage piéton : bandes blanches parallèles à la route
    const p1 = pose(a + 3);
    for (let k = 0; k < 8; k++) {
      const x0 = -RW + 0.6 + k * (2 * RW - 1.2) / 8, x1 = x0 + 0.95;
      quad(ctx.side, lateral(p, x0, 0.015), lateral(p, x1, 0.015), lateral(p1, x1, 0.015), lateral(p1, x0, 0.015), hex3('#e9e9e6'), null, [0, 1, 0]);
    }
  },
  streettree(ctx, it, p) {
    const P = prims(), b = lateral(p, it.side * it.lat, 0.15), [r, f] = axes(p.th);
    box(ctx.side, [b[0], b[1] - 0.02, b[2]], r, f, 1.3, 0.05, 1.3, hex3('#3a3b3e'));
    addGeo(ctx.side, P.cyl, b, 0, C.trunk, [0.14, it.h * 0.5, 0.14]);
    addGeo(ctx.side, P.ball1, [b[0], b[1] + it.h * 0.68, b[2]], it.h, C.leaf2, [it.h * 0.3, it.h * 0.34, it.h * 0.3]);
    addGeo(ctx.side, P.ball, [b[0] + 0.4, b[1] + it.h * 0.85, b[2] - 0.3], 0.5, C.leaf, [it.h * 0.2, it.h * 0.2, it.h * 0.2]);
  },
  bales(ctx, it, p) {
    const P = prims(), [r, f] = axes(p.th), b = lateral(p, it.side * it.lat, groundY(it.side, it.lat));
    for (let i = 0; i < it.k; i++) addGeo(ctx.side, P.cyl12, [b[0] + f[0] * i * 3.2 + r[0] * (i % 2) * 2, b[1] + 0.75, b[2] + f[2] * i * 3.2 + r[2] * (i % 2) * 2], -p.th, C.hay, [0.75, 1.4, 0.75], 0, Math.PI / 2);
  },
  turbine(ctx, it, p) {
    const P = prims(), b = lateral(p, it.side * it.lat, groundY(it.side, it.lat) - 0.5);
    addGeo(ctx.side, P.cyl, b, 0, C.turb, [1.0, it.h, 1.0]);
    const hub = [b[0], b[1] + it.h, b[2]];
    addGeo(ctx.side, P.box, [hub[0], hub[1] - 1, hub[2]], -p.th, C.turb, [2, 2, 4]);
    // pales : objet séparé qui tourne (animé dans scene.js)
    const B = newBuf();
    for (let k = 0; k < 3; k++) addGeo(B, P.box, [0, 0, 0], 0, C.turb, [1.2, it.h * 0.42, 0.25], 0, k * Math.PI * 2 / 3);
    const rotor = new THREE.Mesh(toGeo(B), MAT.side);
    rotor.position.set(hub[0] - Math.sin(p.th) * 2.2, hub[1], hub[2] + Math.cos(p.th) * 2.2);
    rotor.rotation.set(0, -p.th, 0);
    rotor.userData.spin = 0.6 + (it.h % 7) * 0.05;
    ctx.group.add(rotor); ctx.rotors.push(rotor);
  },
  pole(ctx, it, p) {
    const P = prims(), [r, f] = axes(p.th), b = lateral(p, it.side * it.lat, -0.2);
    addGeo(ctx.side, P.cyl, b, 0, C.wood, [0.14, 8.5, 0.14]);
    box(ctx.side, [b[0], b[1] + 7.8, b[2]], r, f, 1.6, 0.12, 0.12, C.wood);
  },
  tires(ctx, it, p) {
    const P = prims(), [, f] = axes(p.th), b = lateral(p, it.side * it.lat, 0);
    for (let i = 0; i < 4; i++) for (let k = 0; k < 3; k++) {
      const col = k === 2 ? (Math.floor(i + it.side) % 2 ? C.tireRed : C.tireWhite) : C.tire;
      addGeo(ctx.side, P.cyl12, [b[0] + f[0] * i * 1.2, b[1] + k * 0.3, b[2] + f[2] * i * 1.2], 0, col, [0.6, 0.3, 0.6]);
    }
  },
  adboard(ctx, it, p, a) {
    const [r, f] = axes(p.th), pm = pose(a + 5);
    box(ctx.side, lateral(pm, it.side * (it.lat + 0.15), 0), r, f, 0.1, 1.3, 11.5, hex3('#2a2e3b'));
    const panel = new THREE.Mesh(adGeo, MAT.ads[it.text]);
    const pc = lateral(pm, it.side * it.lat, 0.75);
    panel.position.set(pc[0], pc[1], pc[2]);
    panel.rotation.y = -pm.th + (it.side > 0 ? -Math.PI / 2 : Math.PI / 2);
    ctx.group.add(panel);
  },
  marshal(ctx, it, p) {
    const [r, f] = axes(p.th), b = lateral(p, it.side * it.lat, 0);
    box(ctx.side, b, r, f, 1.6, 2.4, 1.6, hex3('#e8e8e8'));
    box(ctx.side, [b[0], b[1] + 2.4, b[2]], r, f, 2, 0.15, 2, hex3('#ff8a00'));
  },
  stand(ctx, it, p, a) {
    const pm = pose(a + Math.round(it.l / SEG_M / 2)), [r, f] = axes(pm.th);
    const base = lateral(pm, it.side * it.lat, 0);
    const out = [r[0] * it.side, 0, r[2] * it.side];
    for (let k = 0; k < it.rows; k++) {
      const o = [base[0] + out[0] * k * 0.9, base[1], base[2] + out[2] * k * 0.9];
      box(ctx.side, o, r, f, 0.9, 0.6 + k * 0.55, it.l, hex3('#7a7f88'));
      // spectateurs : bande de couleurs par rangée
      box(ctx.side, [o[0], o[1] + 0.6 + k * 0.55, o[2]], r, f, 0.5, 0.45, it.l * 0.98, C.standSeat[(((k + a) % 4) + 4) % 4]);
    }
    const back = it.rows * 0.9;
    box(ctx.side, [base[0] + out[0] * back, base[1], base[2] + out[2] * back], r, f, 0.4, it.rows * 0.55 + 4.5, it.l, hex3('#5a5f68'));
    box(ctx.side, [base[0] + out[0] * back * 0.5, base[1] + it.rows * 0.55 + 4.5, base[2] + out[2] * back * 0.5], r, f, back + 2, 0.3, it.l + 1, C.standRoof);
  }
};
/* hauteur du sol (par rapport à la route) à une distance donnée du centre, d'après le profil des bas-côtés */
function groundY(side, lat) {
  for (const st of GROUND[MAP.ground](side)) if (lat >= st.a && lat <= st.b) return lerp(st.ya, st.yb, (lat - st.a) / (st.b - st.a));
  const last = GROUND[MAP.ground](side).slice(-1)[0];
  return last ? last.yb : 0;
}
const sandY = (lat) => groundY(1, lat);
function poolQuad(B, p, latC, R2, col) {
  const [r, f] = axes(p.th), c = lateral(p, latC, 0.03);
  quad(B, [c[0] - r[0] * R2 - f[0] * R2, c[1], c[2] - r[2] * R2 - f[2] * R2], [c[0] + r[0] * R2 - f[0] * R2, c[1], c[2] + r[2] * R2 - f[2] * R2],
    [c[0] + r[0] * R2 + f[0] * R2, c[1], c[2] + r[2] * R2 + f[2] * R2], [c[0] - r[0] * R2 + f[0] * R2, c[1], c[2] - r[2] * R2 + f[2] * R2], col, [[0, 0], [1, 0], [1, 1], [0, 1]], [0, 1, 0]);
}
let adGeo = null;
