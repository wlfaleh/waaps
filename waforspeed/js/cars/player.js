/* WaForSpeed — Voiture du joueur : modèle, flammes de nitro, phares. */
'use strict';

/* --- voiture du joueur --- */
let playerMesh = null, playerTailMat = null, flames = [], headlight = null, revLight = null;
function buildPlayer() {
  if (playerMesh) scene.remove(playerMesh);
  if (beamMesh) { scene.remove(beamMesh); beamMesh.geometry.dispose(); beamMesh = null; }
  playerTailMat = new THREE.MeshBasicMaterial({ color: 0xff3050 });
  playerMesh = makeCarMesh(myCar, myPaint().hex, { tailMat: playerTailMat, hq: true })   // en course : pas de lueur colorée, ombre naturelle;
  flames = [];
  const fg = new THREE.ConeGeometry(0.11, 1.1, 8); fg.rotateX(Math.PI / 2); fg.translate(0, 0, 0.55);
  for (const x of [-0.45, 0.45]) {
    const fl = new THREE.Mesh(fg, new THREE.MeshBasicMaterial({ color: 0x66f0ff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    fl.position.set(x, myCar.d.gc + 0.2, myCar.d.L / 2 + 0.05); fl.visible = false;
    playerMesh.userData.inner.add(fl); flames.push(fl);
  }
  // phares : projecteur large et long, à hauteur des phares, qui éclaire la route et le décor devant
  headlight = new THREE.SpotLight(0xfff1dd, 2.2, 170, 0.7, 0.65, 1);
  headlight.position.set(0, Math.max(0.6, myCar.d.nose - 0.12), -myCar.d.L / 2 - 0.2);
  const tgt = new THREE.Object3D(); tgt.position.set(0, -0.5, -60);   // feux de route : portée longue
  playerMesh.add(tgt); headlight.target = tgt; playerMesh.add(headlight);
  // lumière blanche derrière la voiture en marche arrière (éclaire la route la nuit)
  revLight = new THREE.PointLight(0xe8eeff, 0, 14, 2); revLight.position.set(0, 0.6, myCar.d.L / 2 + 0.8); playerMesh.add(revLight);
  scene.add(playerMesh);
}

/* Feux de route du joueur : la tache de lumière épouse la surface de la route (côtes, creux, virages)
   au lieu d'être un plan rigide. Grille de points recalculée à chaque image le long de la route. */
const BEAM_ROWS = [0, 1, 2.5, 4.5, 7, 10, 14, 19, 25, 32, 40, 50, 61, 73, 86, 100, 110], BEAM_COLS = 11;
let beamMesh = null;
function buildBeam() {
  const n = BEAM_ROWS.length * BEAM_COLS, pos = new Float32Array(n * 3), uv = new Float32Array(n * 2), idx = [];
  for (let r = 0; r < BEAM_ROWS.length; r++) for (let c = 0; c < BEAM_COLS; c++) {
    const k = r * BEAM_COLS + c; uv[k * 2] = c / (BEAM_COLS - 1); uv[k * 2 + 1] = BEAM_ROWS[r] / BEAM.len;
    if (r && c) { const a = k - BEAM_COLS - 1, b = k - BEAM_COLS, d = k - 1; idx.push(a, d, b, b, d, k); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx);
  beamMesh = new THREE.Mesh(g, MAT.headPool); beamMesh.frustumCulled = false; beamMesh.renderOrder = 2; beamMesh.visible = false;
  // deuxième passage sur la même grille : la lumière multiplie le sol jusqu'à ~4× au cœur du faisceau
  const twice = new THREE.Mesh(g, MAT.headPool); twice.frustumCulled = false; twice.renderOrder = 3; beamMesh.add(twice);
  scene.add(beamMesh);
}
const _bp = {};
function updateBeam(on, sP, latM, yaw) {
  if (!MAT.headPool) return;
  if (!beamMesh) buildBeam();
  beamMesh.visible = on;
  if (!on) return;
  // sans éclairage public (campagne), les phares sont la seule lumière : double passage ; en ville, un seul
  beamMesh.children[0].visible = !(typeof ENV !== 'undefined' && ENV && ENV.lamps);
  const pos = beamMesh.geometry.attributes.position, a = pos.array, cy = Math.cos(yaw), sy = Math.sin(yaw), front = myCar.d.L / 2 - 0.3;
  for (let r = 0; r < BEAM_ROWS.length; r++) {
    const d = front + BEAM_ROWS[r];
    for (let c = 0; c < BEAM_COLS; c++) {
      const x = (c / (BEAM_COLS - 1) - 0.5) * BEAM.wid;
      // point (x, d) dans le repère de la voiture → position sur la route (abscisse, écart latéral)
      trackPoint(sP + (d * cy - x * sy) / M, latM + x * cy + d * sy, _bp);
      const k = (r * BEAM_COLS + c) * 3; a[k] = _bp.x; a[k + 1] = _bp.y + 0.07; a[k + 2] = _bp.z;
    }
  }
  pos.needsUpdate = true;
}
