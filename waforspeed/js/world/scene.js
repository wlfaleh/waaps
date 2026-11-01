/* WaForSpeed — Objets de course : portique, trafic, rivaux, caméra de poursuite, rendu de la course. */
'use strict';

/* --- portique (checkpoint, km, arrivée) --- */
let gantry = null, gantryKey = '';
function setGantry(label, col, sAbs) {
  const key = label ? label + '|' + col + '|' + Math.round(sAbs) : '';
  if (key === gantryKey) return;
  gantryKey = key;
  if (gantry) { scene.remove(gantry); gantry.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.map && o.material.map !== TEXS.radial) o.material.map.dispose(); }); gantry = null; }
  if (!label) return;
  const p = trackPoint(sAbs, 0, {});
  const B = newBuf(), N = newBuf(), [r, f] = axes(p.th), o = [p.x, p.y, p.z];
  const lat = (m) => [o[0] + r[0] * m, o[1], o[2] + r[2] * m];
  box(B, lat(-(RW + 1)), r, f, 0.6, 9, 0.6, POLE); box(B, lat(RW + 1), r, f, 0.6, 9, 0.6, POLE);
  box(B, o, r, f, (RW + 1.6) * 2, 2.4, 0.7, hex3('#0b0c14'), { y0: 9 });
  const c = hex3(col);
  box(N, o, r, f, (RW + 1.6) * 2, 0.16, 0.8, c, { y0: 11.4 }); box(N, o, r, f, (RW + 1.6) * 2, 0.16, 0.8, c, { y0: 8.86 });
  box(N, o, r, f, RW * 2, 0.02, 0.5, c, { y0: 0.02 });
  gantry = new THREE.Group();
  gantry.add(new THREE.Mesh(toGeo(B), MAT.side), new THREE.Mesh(toGeo(N), MAT.neon));
  const tex = canvasTex(textCanvas(label, col, 1024, 160, 'italic 700 110px Rajdhani, "Arial Narrow", sans-serif'));
  const panel = new THREE.Mesh(new THREE.PlaneGeometry((RW + 1.4) * 2, 2.2), new THREE.MeshBasicMaterial({ map: tex }));
  panel.position.set(o[0] - f[0] * 0.37, o[1] + 10.2, o[2] - f[2] * 0.37); panel.rotation.y = -p.th;
  gantry.add(panel);
  scene.add(gantry);
}

/* --- trafic & rivaux en 3D --- */
function trafficMesh(car) {
  if (!car.mesh) { car.mesh = makeCarMesh(CARS[car.type], TRAFFIC_PAINTS[car.color], { traffic: true }); scene.add(car.mesh); }
  return car.mesh;
}
function clearTrafficMeshes() { for (const c of cars) { if (c.mesh) scene.remove(c.mesh); c.mesh = null; } }
const ghostMeshes = new Map();
function nameSprite(name) {
  const [c, g] = makeCanvas(256, 64);
  g.fillStyle = 'rgba(10,11,16,.78)'; g.fillRect(0, 8, 256, 48);
  g.fillStyle = '#00E5FF'; g.fillRect(0, 8, 5, 48);
  g.font = '600 30px Inter, system-ui, sans-serif'; g.fillStyle = '#F2F4F8'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(name, 130, 33);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex(c), depthWrite: false }));
  s.scale.set(3.2, 0.8, 1); s.position.y = 2.6;
  return s;
}
function syncGhostMeshes() {
  for (const [peer, gm] of ghostMeshes) if (!ghosts.has(peer)) { scene.remove(gm.mesh); ghostMeshes.delete(peer); }
  for (const [peer, g] of ghosts) {
    let gm = ghostMeshes.get(peer);
    if (gm && (gm.car !== g.car || gm.name !== g.name || gm.paint !== g.paint)) { scene.remove(gm.mesh); gm = null; }
    if (!gm) {
      const spec = carById(g.car);
      const mesh = makeCarMesh(spec, paintById(g.paint).hex, { glow: spec.glow, hq: true });
      mesh.add(nameSprite(g.name));
      scene.add(mesh);
      gm = { mesh, car: g.car, name: g.name, paint: g.paint };
      ghostMeshes.set(peer, gm);
    }
  }
}

/* --- placement d'un objet sur la piste --- */
const TP = {};
function placeOnTrack(obj, sAbs, offset, yaw = 0, roll = 0) {
  trackPoint(sAbs, offset * RW, TP);
  obj.position.set(TP.x, TP.y + 0.15 * 0, TP.z);
  obj.rotation.set(TP.slope, -TP.th - yaw, roll);
}

/* --- caméra de poursuite --- */
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), tmpA = {}, tmpB = {};
let camInit = false, fovNow = 62;
function updateCamera(dt, sP) {
  const portrait = W < H;
  trackPoint(sP - (portrait ? 9.5 : 6.4) / M, playerX * RW * 0.82, tmpA);
  trackPoint(sP + 16 / M, playerX * RW * 0.55, tmpB);
  const p = speed / MAX_SPEED;
  const desired = new THREE.Vector3(tmpA.x, tmpA.y + (portrait ? 2.9 : 2.25) + p * 0.25, tmpA.z);
  const look = new THREE.Vector3(tmpB.x, tmpB.y + 0.9, tmpB.z);
  const k = camInit ? 1 - Math.exp(-dt * 10) : 1;
  camPos.lerp(desired, k); camLook.lerp(look, camInit ? 1 - Math.exp(-dt * 14) : 1); camInit = true;
  camera.position.copy(camPos);
  if (shake > 0) camera.position.add(new THREE.Vector3((Math.random() - 0.5) * shake * 0.6, (Math.random() - 0.5) * shake * 0.4, 0));
  camera.lookAt(camLook);
  camera.rotateZ(-steer * 0.03);
  const fov = (W < H ? 70 : 62) + Math.min(p, 1.3) * 9 + (nitroOn ? 7 : 0);
  fovNow += (fov - fovNow) * Math.min(1, dt * 4);
  camera.fov = fovNow; camera.updateProjectionMatrix();
  sky.position.copy(camera.position);
  skyline.position.set(camera.position.x, camera.position.y + 18, camera.position.z);
}

function render3D(dt, t) {
  if (state === 'garage') { renderGarage(dt); return; }
  const sP = dist;
  ensureChunks(sP, false);
  // joueur
  const sp = speed / MAX_SPEED;
  placeOnTrack(playerMesh, sP, playerX, steer * 0.12);
  const inner = playerMesh.userData.inner;
  inner.rotation.z = -steer * 0.035 * Math.min(1, sp + 0.2);
  inner.rotation.x = reduceMotion ? 0 : (braking ? -0.012 : 0) + Math.sin(t * 0.03) * 0.002 * sp;
  inner.position.y = reduceMotion ? 0 : Math.sin(t * 0.045) * 0.008 * sp;
  playerMesh.userData.setBrake(braking);
  for (const fl of flames) { fl.visible = nitroOn; if (nitroOn) { const k = 0.7 + Math.random() * 0.6; fl.scale.set(1, 1, k); } }
  // trafic
  for (const car of cars) {
    const rel = relZ(car.z - position);
    const m = trafficMesh(car);
    if (rel < -20 / M || rel > (VIEW * SEG_M + 30) / M) { m.visible = false; continue; }
    m.visible = true;
    placeOnTrack(m, sP + rel, car.offset, (car.offset - car.prevOff) * 2);
    car.prevOff = car.offset;
  }
  // rivaux
  syncGhostMeshes();
  for (const [peer, g] of ghosts) {
    const gm = ghostMeshes.get(peer);
    if (!gm) continue;
    const rel = g.rd - sP;
    gm.mesh.visible = !g.done && rel > -40 / M && rel < (VIEW * SEG_M) / M;
    if (gm.mesh.visible) placeOnTrack(gm.mesh, g.rd, g.x);
  }
  // repère
  if (mode === 'solo' && state === 'play') setGantry(`CHECKPOINT ${level + 1}`, '#00E5FF', nextCp);
  else if (mode === 'duel' && (state === 'play' || state === 'count')) {
    const mark = Math.min(FINISH, (Math.floor(dist / KM) + 1) * KM);
    setGantry(mark >= FINISH ? 'ARRIVÉE' : `${Math.round(mark / KM)} KM`, mark >= FINISH ? '#FF6A00' : '#00E5FF', mark);
  } else setGantry('', '', 0);
  // éclairage des lampadaires proches
  const aP = Math.floor(sP / SEG);
  let li = 0;
  for (let a = aP - 4; a < aP + 160 && li < lampLights.length; a++) {
    const d = segAt(a).deco;
    if (d && d.lamp) { const p = pose(a); const q = lateral(p, d.lamp * (RW - 1.9), 7.1); lampLights[li++].position.set(q[0], q[1], q[2]); }
  }
  updateCamera(dt, sP);
  if (composer) { renderPass.scene = scene; renderPass.camera = camera; bloom.threshold = 0.46; bloom.strength = 0.8; composer.render(dt); }
  else renderer.render(scene, camera);
  drawFx(dt);
}
