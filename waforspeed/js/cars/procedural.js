/* WaForSpeed — Voitures PROVISOIRES générées par le code (utilisées tant que les vrais modèles ne sont pas fournis). */
'use strict';

/* --- voitures provisoires : profil latéral extrudé + détails par modèle ---
   Elles servent tant que le vrai modèle 3D d'une voiture n'est pas fourni (voir models.js). */
const BEV = 0.06;
const modelCache = new Map();
function extrudeX(shape, width, bevel = BEV, segs = 3) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.01, width - 2 * bevel), bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: segs, curveSegments: 10 });
  g.translate(0, 0, -(width - 2 * bevel) / 2);
  g.rotateY(Math.PI / 2);
  return g;
}
function mergeGeos(list) {
  let n = 0;
  const parts = list.map((g) => { const q = g.index ? g.toNonIndexed() : g; if (!q.attributes.normal) q.computeVertexNormals(); n += q.attributes.position.count; return q; });
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
  let o = 0;
  for (const q of parts) { pos.set(q.attributes.position.array, o * 3); nor.set(q.attributes.normal.array, o * 3); o += q.attributes.position.count; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.computeBoundingSphere();
  return g;
}
function lowerShape(d, P) {
  const s = new THREE.Shape(), rA = d.rw + 0.07, gc = d.gc, f = P.f, cy = d.rw * 0.95;
  s.moveTo(-f + 0.12, gc + 0.12);
  s.lineTo(P.wr - rA - 0.02, gc + 0.05);
  s.lineTo(P.wr - rA, cy);
  s.absarc(P.wr, cy, rA, Math.PI, 0, true);
  s.lineTo(P.wr + rA + 0.02, gc + 0.04);
  s.lineTo(P.wf - rA - 0.02, gc + 0.04);
  s.lineTo(P.wf - rA, cy);
  s.absarc(P.wf, cy, rA, Math.PI, 0, true);
  s.lineTo(P.wf + rA + 0.02, gc + 0.05);
  s.lineTo(f - 0.12, gc + 0.1);
  s.quadraticCurveTo(f, gc + 0.14, f, gc + 0.3);
  s.lineTo(f, d.nose - 0.14);
  s.quadraticCurveTo(f, d.nose - 0.02, f - 0.22, d.nose);
  s.quadraticCurveTo((f + P.ws) / 2, d.belt - 0.03, P.ws, d.belt - 0.04);
  if (d.cabrio) {
    s.lineTo(P.deck, d.belt - 0.03);
    s.quadraticCurveTo(-f + 0.45, d.tail + 0.02, -f + 0.06, d.tail - 0.04);
  } else {
    s.lineTo(P.cs, d.beltR - 0.05);
    s.quadraticCurveTo(-f + 0.02, d.beltR - 0.07, -f + 0.02, d.tail - 0.12);
  }
  s.lineTo(-f, gc + 0.36);
  s.quadraticCurveTo(-f, gc + 0.14, -f + 0.12, gc + 0.12);
  return s;
}
function glassShape(d, P) {
  const s = new THREE.Shape(), top = d.H - 0.05;
  s.moveTo(P.ws - 0.02, d.belt - 0.06);
  s.quadraticCurveTo(P.ws - (P.ws - P.rs) * 0.6, top - 0.03, P.rs, top);
  s.quadraticCurveTo((P.rs + P.re) / 2, top + 0.03, P.re, top - d.drop);
  s.quadraticCurveTo(P.re - 0.12, top - d.drop - 0.05, P.cs + 0.02, d.beltR - 0.06);
  s.lineTo(P.ws - 0.02, d.belt - 0.06);
  return s;
}
function roofShape(d, P) {
  const s = new THREE.Shape(), top = d.H - 0.05, mid = (P.rs + P.re) / 2;
  s.moveTo(P.rs + 0.02, top - 0.005);
  s.quadraticCurveTo(mid, top + 0.035, P.re + 0.02, top - d.drop + 0.005);
  s.lineTo(P.re + 0.06, top - d.drop + 0.05);
  s.quadraticCurveTo(mid, top + 0.085, P.rs + 0.06, top + 0.04);
  s.closePath();
  return s;
}
/* Carrosserie par sections, de l'avant (sx = +L/2) vers l'arrière (sx = -L/2).
   Chaque section est un profil arrondi : soubassement, flanc galbé, épaule, vitres qui rentrent
   vers l'intérieur, toit bombé. Les surfaces sont lissées ; vitres, montants et toit font partie
   de la même coque (matériau choisi selon la zone). */
function loftBody(car, P, part, roofKey) {
  const d = car.d, f = d.L / 2, H = d.H - 0.03, rw = d.rw, rA = rw + 0.07, cy = rw * 0.95, rc = 0.42;
  const tumble = d.tumble || 0.8, bp = (P.rs + P.re) / 2 + 0.12, pc = d.pc || 0.3;
  const smooth = (u) => u * u * (3 - 2 * u);
  const top = (sx) => {
    if (sx > f - 0.22) return lerp(d.nose - 0.07, d.nose, Math.sqrt(clamp((f - sx) / 0.22, 0, 1)));
    if (sx > P.ws) { const u = (f - 0.22 - sx) / (f - 0.22 - P.ws); return d.nose + (d.belt - 0.02 - d.nose) * (u * 0.7 + u * u * 0.3); }
    if (d.cabrio) {
      if (sx > P.deck) return d.belt - 0.02;
      if (sx > -f + 0.08) return lerp(d.belt - 0.02, d.tail, smooth((P.deck - sx) / (P.deck + f - 0.08)));
      return lerp(d.tail, d.tail - 0.06, (-f + 0.08 - sx) / 0.08);
    }
    if (sx > P.rs) { const u = (P.ws - sx) / (P.ws - P.rs); return d.belt - 0.02 + (H - d.belt + 0.02) * (1 - Math.pow(1 - u, 1.7)); }
    if (sx > P.re) { const u = (P.rs - sx) / (P.rs - P.re); return H - d.drop * u * u; }
    if (sx > P.cs) { const u = (P.re - sx) / (P.re - P.cs); return H - d.drop + (d.beltR + 0.02 - H + d.drop) * Math.pow(u, 0.9); }
    if (sx > -f + 0.07) return lerp(d.beltR + 0.02, d.tail, smooth((P.cs - sx) / (P.cs + f - 0.07)));
    return lerp(d.tail, d.tail - 0.06, (-f + 0.07 - sx) / 0.07);
  };
  const beltAt = (sx) => lerp(d.belt, d.beltR, clamp((P.ws - sx) / (P.ws - (d.cabrio ? -f : P.cs)), 0, 1));
  const bottom = (sx) => {
    const dEnd = Math.min(f - sx, sx + f);
    let b = d.gc + (dEnd < 0.3 ? 0.2 * Math.pow(1 - dEnd / 0.3, 2) : 0);
    for (const wz of [P.wf, P.wr]) { const q = sx - wz; if (Math.abs(q) < rA) b = Math.max(b, cy + Math.sqrt(rA * rA - q * q)); }
    return b;
  };
  const halfW = (sx) => {
    const dEnd = Math.min(f - sx, sx + f), w = d.W / 2;
    return dEnd < rc ? w - (rc - Math.sqrt(Math.max(0, rc * rc - (rc - dEnd) * (rc - dEnd)))) : w;
  };
  const N = 150, K = 16, pos = [];
  const rings = [];
  for (let i = 0; i < N; i++) {
    const sx = f - i * (2 * f) / (N - 1);
    const t = top(sx), b = bottom(sx), bl = Math.min(beltAt(sx), t - 0.005), hw = halfW(sx);
    const g = clamp((t - bl) / 0.3, 0, 1);
    const half = [
      [0, b], [hw * 0.86, b], [hw * 0.98, b + 0.1], [hw, b + (bl - b) * 0.55], [hw * 0.985, bl - 0.045], [hw * 0.95, bl],
      [hw * lerp(0.9, tumble, g), lerp(bl + 0.006, lerp(bl, t, 0.84), g)], [hw * lerp(0.6, tumble * 0.88, g), t - 0.012 * g], [0, t + 0.004 + 0.018 * g]
    ];
    const ring = [half[0]];
    for (let j = 1; j <= 7; j++) ring.push(half[j]);
    ring.push(half[8]);
    for (let j = 7; j >= 1; j--) ring.push([-half[j][0], half[j][1]]);
    rings.push({ sx, t, bl, ring });
    for (const [x, y] of ring) pos.push(x, y, -sx);
  }
  const level = (k) => (k <= 7 ? k : 15 - k);
  const matFor = (lv, sx, t, bl) => {
    const gh = !d.cabrio && t - bl > 0.05;
    if (lv === 0) return 'trim';
    if (lv <= 4) return 'paint';
    if (d.cabrio) return sx < P.ws - 0.05 && sx > P.deck && lv >= 6 ? 'trim' : 'paint';
    if (!gh) return 'paint';
    if (lv === 5) {
      if (Math.abs(sx - bp) < 0.06) return 'trim';
      if (sx > P.rs + 0.12) return 'paint';
      if (sx < P.re + pc && sx > P.cs) return roofKey;
      return 'glass';
    }
    const ws = sx > P.rs + 0.02, rear = sx < P.re - 0.02 && sx > P.cs;
    if (ws || rear) return lv === 6 ? roofKey : 'glass';
    return roofKey;
  };
  const idx = {};
  const all = [];
  for (let i = 0; i < N - 1; i++) {
    const r0 = rings[i], r1 = rings[i + 1], sxm = (r0.sx + r1.sx) / 2, tm = (r0.t + r1.t) / 2, blm = (r0.bl + r1.bl) / 2;
    for (let k = 0; k < K; k++) {
      const a = i * K + k, b = i * K + (k + 1) % K, c = (i + 1) * K + k, e = (i + 1) * K + (k + 1) % K;
      const m = matFor(level(k), sxm, tm, blm);
      (idx[m] = idx[m] || []).push(a, c, b, b, c, e);
      all.push(a, c, b, b, c, e);
    }
  }
  const posAttr = new THREE.Float32BufferAttribute(pos, 3);
  const full = new THREE.BufferGeometry();
  full.setAttribute('position', posAttr); full.setIndex(all);
  full.computeVertexNormals();
  // orientation : la normale d'un flanc droit doit pointer vers +x
  const nrm = full.attributes.normal, probe = Math.floor(N / 2) * K + 3;
  const flip = nrm.getX(probe) < 0;
  if (flip) { for (let i = 0; i < nrm.array.length; i++) nrm.array[i] = -nrm.array[i]; }
  for (const m in idx) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', posAttr); g.setAttribute('normal', nrm);
    const list = idx[m];
    if (flip) for (let i = 0; i < list.length; i += 3) { const tmp = list[i + 1]; list[i + 1] = list[i + 2]; list[i + 2] = tmp; }
    g.setIndex(list);
    part(m, g);
  }
  // faces avant et arrière (bouclier) : facettes planes
  for (const [i, dir] of [[0, -1], [N - 1, 1]]) {
    const r = rings[i], cyy = r.ring.reduce((s, q) => s + q[1], 0) / K, z = -r.sx, B = [];
    for (let k = 0; k < K; k++) {
      const p0 = r.ring[k], p1 = r.ring[(k + 1) % K];
      const tri = dir < 0 ? [[0, cyy, z], [p1[0], p1[1], z], [p0[0], p0[1], z]] : [[0, cyy, z], [p0[0], p0[1], z], [p1[0], p1[1], z]];
      for (const q of tri) B.push(q[0], q[1], q[2]);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(B, 3)); g.computeVertexNormals();
    if ((dir < 0 && g.attributes.normal.getZ(0) > 0) || (dir > 0 && g.attributes.normal.getZ(0) < 0)) {
      const a = g.attributes.position.array;
      for (let q = 0; q < a.length; q += 9) for (let c = 0; c < 3; c++) { const tmp = a[q + 3 + c]; a[q + 3 + c] = a[q + 6 + c]; a[q + 6 + c] = tmp; }
      g.computeVertexNormals();
    }
    part('paint', g);
  }
  return { top, beltAt, halfW, H };
}
function buildModel(car) {
  if (modelCache.has(car.id)) return modelCache.get(car.id);
  const d = car.d, bk = {};
  const part = (k, g) => { (bk[k] = bk[k] || []).push(g); };
  const bx = (k, w, h, dz, x, y, z) => { const g = new THREE.BoxGeometry(w, h, dz); g.translate(x, y, z); part(k, g); };
  const f = d.L / 2, wf = d.L / 2 - d.oh, wr = wf - d.wb, ws = d.L / 2 - d.hood, rs = ws - d.wsl;
  const P = { f, wf, wr, ws, rs, re: d.cabrio ? 0 : wr + d.re, cs: d.cabrio ? 0 : -d.L / 2 + d.rearOh, deck: d.cabrio ? -d.L / 2 + d.deck : 0 };
  const roofKey = car.roof ? 'roof' : 'paint';
  const L0 = loftBody(car, P, part, roofKey);
  if (!d.cabrio) {
    // feu stop central et becquet au bout du pavillon
    const yr = L0.H - d.drop;
    bx('tail', 0.46, 0.035, 0.04, 0, yr + 0.035, -P.re + 0.1);
    if (['golf', 'clio', 'a3', 'troc'].includes(car.style)) bx('trim', d.W * 0.66, 0.035, 0.32, 0, yr + 0.005, -P.re + 0.06);
  } else {
    // habitacle ouvert : bac, sièges, pare-brise
    bx('trim', d.W * 0.8, 0.03, P.ws - P.deck - 0.1, 0, d.belt + 0.01, -((P.ws + P.deck) / 2));
    for (const x of [-0.38, 0.38]) for (const zs of [P.ws - 1.0, P.ws - 1.75]) {
      const k = zs < P.ws - 1.2 ? 0.85 : 1;
      bx('seat', 0.46 * k, 0.42 * k, 0.12, x, d.belt + 0.1, -zs);
      bx('seat', 0.22 * k, 0.14, 0.1, x, d.belt + 0.1 + 0.28 * k, -zs + 0.01);
    }
    const w = new THREE.Shape();
    w.moveTo(P.ws + 0.02, d.belt - 0.05); w.lineTo(P.ws - 0.5, 1.3); w.lineTo(P.ws - 0.57, 1.28); w.lineTo(P.ws - 0.05, d.belt - 0.05); w.closePath();
    part('glass', extrudeX(w, d.W * 0.86, 0.02, 1));
    bx('paint', d.W * 0.86, 0.05, 0.1, 0, 1.31, -(P.ws - 0.53));
    for (const sx of [-1, 1]) bx('paint', 0.05, 0.42, 0.06, sx * d.W * 0.43, d.belt + 0.2, -(P.ws - 0.27));
  }
  // rétroviseurs, bas de caisse
  for (const sx of [-1, 1]) {
    bx('paint', 0.2, 0.11, 0.13, sx * (d.W / 2 + 0.06), d.belt + 0.06, -(P.ws - 0.18));
    bx('trim', 0.05, 0.06, 0.06, sx * (d.W / 2 - 0.02), d.belt + 0.04, -(P.ws - 0.18));
  }
  bx('trim', d.W + 0.02, 0.06, d.wb - 2 * (d.rw + 0.12), 0, d.gc + 0.1, -(wf + wr) / 2);
  // détails de carrosserie : liseré chromé sous les vitres, joints de portières, poignées, passages de roue noirs
  const doorH = d.belt - d.gc - 0.2, doorY = d.gc + 0.16 + doorH / 2;
  const seams = d.cabrio ? [P.ws - 0.08, P.ws - 1.3] : [P.ws - 0.08, (P.rs + P.re) / 2 + 0.1, P.cs + 0.55];
  for (const sx of [-1, 1]) {
    for (const z of seams) bx('seam', 0.012, doorH, 0.012, sx * (d.W / 2 + 0.004), doorY, -z);
    for (const z of seams.slice(0, -1)) bx('chrome', 0.03, 0.03, 0.16, sx * (d.W / 2 + 0.012), d.belt - 0.16, -z + 0.3);
  }
  const liner = new THREE.CylinderGeometry(d.rw + 0.06, d.rw + 0.06, d.W * 0.86, 16, 1, true, 0, Math.PI);
  liner.rotateZ(Math.PI / 2);
  for (const az of [-wf, -wr]) { const g = liner.clone(); g.translate(0, d.rw * 0.95, az); part('liner', g); }

  // roues : pneu au profil arrondi, jante à rayons (style selon la voiture), disque de frein, moyeu
  const rw = d.rw, tw = 0.235, ri = rw * 0.66;
  const tp = [];
  for (let i = 0; i <= 8; i++) { const a = -Math.PI / 2 + i / 8 * Math.PI; tp.push(new THREE.Vector2(rw - 0.035 + Math.cos(a) * 0.035, Math.sin(a) * (tw / 2))); }
  tp.unshift(new THREE.Vector2(ri, -tw / 2 + 0.01)); tp.push(new THREE.Vector2(ri, tw / 2 - 0.01));
  const tire = new THREE.LatheGeometry(tp, 28); tire.rotateZ(Math.PI / 2);
  const barrel = new THREE.CylinderGeometry(ri, ri, tw - 0.03, 24, 1, true); barrel.rotateZ(Math.PI / 2);
  const lip = new THREE.TorusGeometry(ri - 0.008, 0.012, 6, 32); lip.rotateY(Math.PI / 2);
  const face = new THREE.CircleGeometry(ri * 0.98, 24); face.rotateY(Math.PI / 2);
  const disc = new THREE.CylinderGeometry(ri * 0.82, ri * 0.82, 0.025, 24); disc.rotateZ(Math.PI / 2);
  const hub = new THREE.CylinderGeometry(0.055, 0.055, 0.03, 12); hub.rotateZ(Math.PI / 2);
  const nut = new THREE.CylinderGeometry(0.012, 0.012, 0.025, 6); nut.rotateZ(Math.PI / 2);
  const rimStyle = { golf: 'y', x1: 'twin', clio: 'five', troc: 'ten', cabrio: 'twin', a3: 'five' }[car.style] || 'five';
  const wheelGeo = {};
  for (const sx of [-1, 1]) {
    const wb = {};
    const wp = (k, g) => { (wb[k] = wb[k] || []).push(g); };
    const out = sx * (tw / 2 - 0.02);
    wp('tire', tire.clone());
    wp('rimIn', barrel.clone());
    wp('rimIn', face.clone().rotateY(sx > 0 ? 0 : Math.PI).translate(sx * (tw / 2 - 0.09), 0, 0));
    wp('disc', disc.clone().translate(sx * (tw / 2 - 0.07), 0, 0));
    wp('rim', lip.clone().translate(out, 0, 0));
    const spoke = (ang, wdt, len = ri * 0.95, inner = 0.05) => {
      const g = new THREE.BoxGeometry(0.025, len - inner, wdt);
      g.translate(0, inner + (len - inner) / 2, 0); g.rotateX(ang); g.translate(out - sx * 0.005, 0, 0); wp('rim', g);
    };
    const n = rimStyle === 'ten' ? 10 : 5;
    for (let k = 0; k < n; k++) {
      const a = k * Math.PI * 2 / n;
      if (rimStyle === 'twin') { spoke(a - 0.09, 0.035); spoke(a + 0.09, 0.035); }
      else if (rimStyle === 'y') { spoke(a, 0.05, ri * 0.55); spoke(a - 0.16, 0.03, ri * 0.95, ri * 0.5); spoke(a + 0.16, 0.03, ri * 0.95, ri * 0.5); }
      else spoke(a, rimStyle === 'ten' ? 0.032 : 0.06);
      const nn = nut.clone(); nn.translate(out + sx * 0.008, 0.085, 0); nn.rotateX(a); wp('chrome', nn);
    }
    wp('chrome', hub.clone().translate(out + sx * 0.008, 0, 0));
    wheelGeo[sx] = {};
    for (const k in wb) wheelGeo[sx][k] = mergeGeos(wb[k]);
  }
  // étrier de frein (ne tourne pas avec la roue)
  const caliperGeo = new THREE.BoxGeometry(0.05, 0.16, 0.11);
  const wheelPos = [];
  for (const sx of [-1, 1]) for (const [az, front] of [[-wf, true], [-wr, false]]) wheelPos.push({ x: sx * (d.W / 2 - 0.15), y: d.rw, z: az, side: sx, front });
  // signatures lumineuses
  const Z = (front) => (front ? -(d.L / 2 + 0.012) : d.L / 2 + 0.012);
  const pair = (k, w, h, xo, y, front, dz = 0.03) => { for (const s of [-1, 1]) bx(k, w, h, dz, s * xo, y, Z(front)); };
  const hw = d.W / 2;
  bx('plate', 0.52, 0.12, 0.02, 0, d.gc + 0.3, Z(true));
  bx('plate', 0.52, 0.12, 0.02, 0, d.gc + 0.52, Z(false));
  bx('trim', d.W * 0.62, 0.1, 0.04, 0, d.gc + 0.2, Z(false));
  const exhaust = (xs) => { const e = new THREE.CylinderGeometry(0.045, 0.045, 0.14, 12); e.rotateX(Math.PI / 2); for (const x of xs) part('chrome', e.clone().translate(x, d.gc + 0.2, d.L / 2 + 0.02)); };
  switch (car.style) {
    case 'golf':
      pair('head', 0.4, 0.085, hw - 0.32, d.nose - 0.1, true);
      bx('head', 0.98, 0.022, 0.03, 0, d.nose - 0.085, Z(true));
      bx('trim', 0.92, 0.12, 0.03, 0, d.nose - 0.22, Z(true));
      bx('trim', 1.2, 0.16, 0.03, 0, d.gc + 0.3, Z(true) + 0.004);
      pair('tail', 0.42, 0.1, hw - 0.3, d.tail - 0.16, false);
      pair('tail', 0.2, 0.05, hw - 0.6, d.tail - 0.14, false);
      exhaust([-0.5, 0.5]);
      break;
    case 'x1':
      for (const s of [-1, 1]) { bx('chrome', 0.3, 0.34, 0.03, s * 0.17, d.nose - 0.17, Z(true)); bx('trim', 0.25, 0.29, 0.03, s * 0.17, d.nose - 0.17, Z(true) - 0.01); }
      pair('head', 0.36, 0.08, hw - 0.3, d.nose - 0.08, true);
      bx('trim', 1.3, 0.16, 0.03, 0, d.gc + 0.34, Z(true) + 0.004);
      bx('chrome', 0.8, 0.05, 0.03, 0, d.gc + 0.18, Z(true));
      pair('tail', 0.42, 0.09, hw - 0.3, d.tail - 0.17, false);
      pair('tail', 0.08, 0.22, hw - 0.13, d.tail - 0.25, false);
      bx('chrome', 0.8, 0.05, 0.03, 0, d.gc + 0.14, Z(false));
      break;
    case 'clio':
      pair('head', 0.34, 0.08, hw - 0.33, d.nose - 0.1, true);
      pair('head', 0.035, 0.22, hw - 0.2, d.gc + 0.38, true);
      pair('head', 0.12, 0.03, hw - 0.25, d.gc + 0.48, true);
      pair('head', 0.12, 0.03, hw - 0.25, d.gc + 0.28, true);
      bx('trim', 0.8, 0.12, 0.03, 0, d.nose - 0.23, Z(true));
      pair('tail', 0.06, 0.26, hw - 0.14, d.tail - 0.24, false);
      pair('tail', 0.26, 0.05, hw - 0.25, d.tail - 0.12, false);
      pair('tail', 0.26, 0.05, hw - 0.25, d.tail - 0.36, false);
      break;
    case 'troc':
      pair('head', 0.4, 0.1, hw - 0.33, d.nose - 0.11, true);
      bx('trim', 0.95, 0.12, 0.03, 0, d.nose - 0.11, Z(true));
      pair('head', 0.14, 0.05, hw - 0.3, d.gc + 0.36, true);
      bx('trim', 1.1, 0.18, 0.03, 0, d.gc + 0.28, Z(true) + 0.004);
      pair('tail', 0.5, 0.1, hw - 0.33, d.tail - 0.16, false);
      bx('trim', 0.62, 0.08, 0.03, 0, d.tail - 0.16, Z(false));
      pair('tail', 0.18, 0.03, hw - 0.25, d.gc + 0.32, false);
      break;
    case 'cabrio':
      for (const s of [-1, 1]) { bx('chrome', 0.24, 0.3, 0.03, s * 0.15, d.nose - 0.17, Z(true)); bx('trim', 0.2, 0.25, 0.03, s * 0.15, d.nose - 0.17, Z(true) - 0.01); }
      pair('head', 0.42, 0.065, hw - 0.33, d.nose - 0.09, true);
      bx('trim', 1.3, 0.14, 0.03, 0, d.gc + 0.28, Z(true) + 0.004);
      pair('tail', 0.44, 0.08, hw - 0.3, d.tail - 0.12, false);
      pair('tail', 0.07, 0.15, hw - 0.12, d.tail - 0.18, false);
      exhaust([-0.55, -0.45, 0.45, 0.55]);
      break;
    case 'a3': {
      const hx = new THREE.Shape();
      hx.moveTo(-0.42, 0.18); hx.lineTo(0.42, 0.18); hx.lineTo(0.5, 0.02); hx.lineTo(0.36, -0.2); hx.lineTo(-0.36, -0.2); hx.lineTo(-0.5, 0.02); hx.closePath();
      const g1 = new THREE.ExtrudeGeometry(hx, { depth: 0.03, bevelEnabled: false }); g1.translate(0, d.gc + 0.4, Z(true) - 0.03); part('trim', g1);
      const g2 = new THREE.ExtrudeGeometry(hx, { depth: 0.03, bevelEnabled: false }); g2.scale(1.07, 1.08, 1); g2.translate(0, d.gc + 0.4, Z(true) - 0.022); part('chrome', g2);
      pair('head', 0.42, 0.08, hw - 0.32, d.nose - 0.1, true);
      pair('tail', 0.42, 0.08, hw - 0.3, d.tail - 0.14, false);
      pair('tail', 0.28, 0.05, hw - 0.42, d.tail - 0.23, false);
      exhaust([-0.52, 0.52]);
      break;
    }
  }
  const geos = {};
  for (const k in bk) geos[k] = mergeGeos(bk[k]);
  const out = { geos, L: d.L, W: d.W, wheelGeo, wheelPos, rw: d.rw, ri, tw, caliperGeo };
  modelCache.set(car.id, out);
  return out;
}
function makeEnv() {
  const pm = new THREE.PMREMGenerator(renderer);
  const es = new THREE.Scene();
  es.background = new THREE.Color(0x06060c);
  const add = (color, w, h, x, y, z) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.lookAt(0, 0, 0); es.add(m);
  };
  add(0xff6a00, 34, 2, -22, 5, 0); add(0x00e5ff, 34, 2, 22, 7, 4); add(0xd8dcff, 24, 10, 0, 26, 0);
  add(0xff2a6a, 12, 1.5, 0, 4, -26); add(0x5a4aff, 40, 3, 0, 2, 26); add(0xffd9a8, 6, 6, 12, 16, -14);
  const env = pm.fromScene(es, 0.02).texture;
  pm.dispose();
  return env;
}
const paintMats = new Map();
function paintMat(hex, hq) {
  const key = hex + (hq ? 'h' : 'l');
  if (!paintMats.has(key)) {
    const o = { color: new THREE.Color(hex), metalness: 0.5, roughness: 0.32, envMap: MAT.env, envMapIntensity: hq ? 0.6 : 0.35 };
    paintMats.set(key, hq ? new THREE.MeshPhysicalMaterial({ ...o, clearcoat: 1, clearcoatRoughness: 0.06 }) : new THREE.MeshStandardMaterial(o));
  }
  return paintMats.get(key);
}
/* reflets en temps réel : une petite caméra 360° autour du joueur capte le décor (ciel, néons, immeubles)
   et sert de reflet aux carrosseries, vitres, chromes et à la chaussée mouillée. */
let cubeRT = null, cubeCam = null, cubeTick = 0, cubeRTs = null, cubeW = 0;
/* deux textures de reflet en alternance : on écrit dans l'une pendant que les matériaux lisent l'autre
   (sinon la carte graphique lit et écrit la même texture : « boucle » et image fausse) */
const envUsers = () => [...paintMats.values(), MAT.glass, MAT.chrome, MAT.rim, ...envMats].concat(MAT.road && MAT.road.envMap ? [MAT.road] : []);
function setupReflections() {
  if (cubeRTs || quality !== 'high') return;
  const size = isTouch ? 64 : 128;
  const mk = () => new THREE.WebGLCubeRenderTarget(size, { format: THREE.RGBFormat, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
  cubeRTs = [mk(), mk()];
  cubeRT = cubeRTs[0]; cubeW = 1;
  cubeCam = new THREE.CubeCamera(0.5, 900, cubeRTs[1]);
  scene.add(cubeCam);
  for (const m of envUsers()) { m.envMap = cubeRT.texture; m.needsUpdate = true; }
  MAT.env = cubeRT.texture;
}
/* Reflets : une seule face du cube par image (6 images pour un cube complet), au lieu de 6 rendus
   d'un coup toutes les 4 images (à-coups visibles). Coût constant et faible → animation fluide. */
let cubeFace = 0;
function updateReflections(at, hideObj) {
  if (!cubeCam || quality !== 'high') return;
  if (isTouch && (++cubeTick % 2)) return;   // mobile : une face toutes les 2 images
  const write = cubeRTs[cubeW], read = cubeRTs[1 - cubeW];
  if (cubeFace === 0) cubeCam.position.set(at.x, at.y + 0.9, at.z);
  cubeCam.updateMatrixWorld(true);
  const cam = cubeCam.children[cubeFace];
  if (cam.far !== 320) { for (const c of cubeCam.children) { c.far = 320; c.updateProjectionMatrix(); } }
  if (hideObj) hideObj.visible = false;
  const prevRT = renderer.getRenderTarget(), prevXr = renderer.xr.enabled;
  renderer.xr.enabled = false;
  write.texture.generateMipmaps = false;
  if (cubeFace === 5) write.texture.generateMipmaps = true;
  renderer.setRenderTarget(write, cubeFace);
  renderer.render(state === 'garage' ? gScene : scene, cam);
  renderer.setRenderTarget(prevRT); renderer.xr.enabled = prevXr;
  if (hideObj) hideObj.visible = true;
  cubeFace = (cubeFace + 1) % 6;
  if (cubeFace === 0) {
    // cube complet : les matériaux lisent la texture fraîche ; la prochaine fois on écrira dans l'autre
    for (const m of envUsers()) if (m.envMap === read.texture) m.envMap = write.texture;
    cubeRT = write; MAT.env = write.texture; cubeW = 1 - cubeW;
  }
}
function makeCarMaterials() {
  MAT.env = makeEnv();
  MAT.glass = new THREE.MeshStandardMaterial({ color: 0x0a0e16, metalness: 0.9, roughness: 0.08, envMap: MAT.env, envMapIntensity: 0.55 });
  MAT.trim = new THREE.MeshStandardMaterial({ color: 0x0c0d12, metalness: 0.3, roughness: 0.6 });
  MAT.seat = new THREE.MeshStandardMaterial({ color: 0x3a2a22, metalness: 0.1, roughness: 0.7 });
  MAT.chrome = new THREE.MeshStandardMaterial({ color: 0xb8bcc6, metalness: 1, roughness: 0.25, envMap: MAT.env, envMapIntensity: 0.45 });
  MAT.rim = new THREE.MeshStandardMaterial({ color: 0xb4b8c0, metalness: 0.95, roughness: 0.22, envMap: MAT.env, envMapIntensity: 0.8 });
  MAT.rimIn = new THREE.MeshStandardMaterial({ color: 0x2a2c32, metalness: 0.7, roughness: 0.45, side: THREE.DoubleSide });
  MAT.disc = new THREE.MeshStandardMaterial({ color: 0x6d7078, metalness: 0.9, roughness: 0.4 });
  MAT.caliper = new THREE.MeshStandardMaterial({ color: 0xc81e24, metalness: 0.3, roughness: 0.4 });
  MAT.liner = new THREE.MeshStandardMaterial({ color: 0x08090c, metalness: 0, roughness: 0.95, side: THREE.DoubleSide });
  MAT.seam = new THREE.MeshBasicMaterial({ color: 0x050608 });
  MAT.tire = new THREE.MeshStandardMaterial({ color: 0x141416, metalness: 0, roughness: 0.85 });
  MAT.head = new THREE.MeshBasicMaterial({ color: 0xfff3dc });
  MAT.tail = new THREE.MeshBasicMaterial({ color: 0xff4868 });
  MAT.plate = new THREE.MeshStandardMaterial({ color: 0xe8eaee, metalness: 0, roughness: 0.5 });
  MAT.blinkOn = new THREE.MeshBasicMaterial({ color: 0xffa21a });
  MAT.blinkOff = new THREE.MeshStandardMaterial({ color: 0x5a3a12, metalness: 0.2, roughness: 0.4 });
  MAT.blinkHalo = new THREE.SpriteMaterial({ map: TEXS.radial, color: 0xff9a10, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
}
/* Carrosserie provisoire (sans ombre ni halo : makeCarMesh, dans models.js, les ajoute). */
function proceduralBody(car, paintHex, opts = {}) {
  const m = buildModel(car);
  const obj = new THREE.Group();
  const tail = opts.tailMat || MAT.tail;
  const mats = { paint: paintMat(paintHex, opts.hq), roof: paintMat(car.roof || paintHex, opts.hq), glass: MAT.glass, trim: MAT.trim, seat: MAT.seat,
    chrome: MAT.chrome, rim: MAT.rim, rimIn: MAT.rimIn, disc: MAT.disc, liner: MAT.liner, seam: MAT.seam, tire: MAT.tire, head: MAT.head, tail, plate: MAT.plate };
  for (const k in m.geos) obj.add(new THREE.Mesh(m.geos[k], mats[k]));
  const wheels = [];
  for (const w of m.wheelPos) {
    const steerG = new THREE.Group(); steerG.position.set(w.x, w.y, w.z);
    const spinG = new THREE.Group(); steerG.add(spinG);
    for (const k in m.wheelGeo[w.side]) spinG.add(new THREE.Mesh(m.wheelGeo[w.side][k], mats[k]));
    const cal = new THREE.Mesh(m.caliperGeo, MAT.caliper);
    cal.position.set(w.side * (m.tw / 2 - 0.1), m.ri * 0.52, 0.06); cal.rotation.x = -0.5;
    steerG.add(cal);
    // flou de vitesse des rayons
    const blur = new THREE.Mesh(blurGeo, new THREE.MeshBasicMaterial({ map: TEXS.wheelBlur, transparent: true, opacity: 0, depthWrite: false }));
    blur.scale.setScalar(m.ri); blur.position.x = w.side * (m.tw / 2 + 0.004); blur.rotation.y = w.side > 0 ? Math.PI / 2 : -Math.PI / 2;
    steerG.add(blur);
    obj.add(steerG);
    wheels.push({ steer: steerG, spin: spinG, front: w.front, blur });
  }
  return { object: obj, wheels, rw: m.rw, setBrake: opts.tailMat ? (on) => tail.color.set(on ? 0xff8098 : 0xff4868) : null };
}
