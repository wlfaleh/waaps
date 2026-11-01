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
  box(B, lat(-(RW + 1)), r, f, 0.6, 9, 0.6, C.pole); box(B, lat(RW + 1), r, f, 0.6, 9, 0.6, C.pole);
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
let playerYaw = 0, prevPlayerX = 0;
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
  // soleil / lune / étoiles / nuages restent « à l'infini » ; la mer suit la caméra au niveau de la plage
  const sd = ENV.sunDir;
  sunDisc.position.set(camera.position.x + sd[0] * 900, camera.position.y + sd[1] * 900, camera.position.z + sd[2] * 900);
  moonDisc.position.copy(sunDisc.position);
  stars.position.copy(camera.position); clouds.position.set(camera.position.x, camera.position.y, camera.position.z);
  const sp = playerMesh ? playerMesh.position : camera.position;
  sunLight.target.position.set(sp.x, sp.y, sp.z);
  sunLight.position.set(sp.x + sd[0] * 120, sp.y + sd[1] * 120, sp.z + sd[2] * 120);
  water.position.set(camera.position.x, -1.6, camera.position.z);
}

function render3D(dt, t) {
  if (state === 'garage') { renderGarage(dt); return; }
  const sP = dist;
  ensureChunks(sP, false);
  // joueur
  const sp = speed / MAX_SPEED;
  // la voiture pointe là où elle va : vitesse latérale comparée à la vitesse d'avance
  const dX = playerX - prevPlayerX; prevPlayerX = playerX;
  const latVel = Math.abs(dX) > 0.3 ? 0 : dX * RW / Math.max(dt, 1e-3);
  const targetYaw = clamp(Math.atan2(latVel, Math.max(speed * M, 3)), -0.42, 0.42) + steer * 0.04 * Math.min(1, sp * 2);
  playerYaw += (targetYaw - playerYaw) * Math.min(1, dt * 9);
  placeOnTrack(playerMesh, sP, playerX, playerYaw + spinYaw);
  const inner = playerMesh.userData.inner;
  inner.rotation.z = steer * 0.045 * Math.min(1, sp + 0.15);
  playerMesh.userData.animWheels(steer * (0.55 - 0.3 * Math.min(sp, 1)), speed * M * dt);
  inner.rotation.x = reduceMotion ? 0 : (braking ? -0.012 : 0) + Math.sin(t * 0.03) * 0.002 * sp;
  inner.position.y = reduceMotion ? 0 : Math.sin(t * 0.045) * 0.008 * sp;
  playerMesh.userData.setBrake(braking || reversing);
  for (const fl of flames) { fl.visible = nitroOn; if (nitroOn) { const k = 0.7 + Math.random() * 0.6; fl.scale.set(1, 1, k); } }
  // trafic
  for (const car of cars) {
    const rel = relZ(car.z - position);
    const m = trafficMesh(car);
    if (rel < -20 / M || rel > (VIEW * SEG_M + 30) / M) { m.visible = false; continue; }
    m.visible = true;
    const lat = (car.offset - car.prevOff) * RW / Math.max(dt, 1e-3);
    const yaw = car.crash ? car.crash.yaw : clamp(Math.atan2(lat, Math.max(car.speed * M, 2)), -0.3, 0.3);
    placeOnTrack(m, sP + rel, car.offset, yaw, car.crash ? Math.sin(car.crash.t * 9) * Math.max(0, 0.06 - car.crash.t * 0.03) : 0);
    m.userData.animWheels(car.crash ? 0 : yaw * 1.6, car.speed * M * dt);
    // clignotants (feux de détresse si accidentée) ; chaque voiture a son propre rythme
    const blinkOn = ((t / 1000) + (car.rng % 997) / 997) % 0.72 < 0.38;
    if (car.crash) m.userData.setIndicators(blinkOn, blinkOn);
    else m.userData.setIndicators(blinkOn && car.signal < 0, blinkOn && car.signal > 0);
    if (car.crash) {
      // fumée du capot
      car.crash.smoke -= dt;
      if (car.crash.t < 5 && car.crash.smoke <= 0) { car.crash.smoke = 0.12; const q = trackPoint(sP + rel - car.len * 0.35, car.offset * RW, {}); emitSmoke({ x: q.x, y: q.y + 1.1, z: q.z }, 1); }
    }
    car.prevOff = car.offset;
  }
  // rivaux
  syncGhostMeshes();
  for (const [peer, g] of ghosts) {
    const gm = ghostMeshes.get(peer);
    if (!gm) continue;
    const rel = g.rd - sP;
    gm.mesh.visible = !g.done && rel > -40 / M && rel < (VIEW * SEG_M) / M;
    const moved = Math.max(0, g.rd - (gm.prevRd ?? g.rd)) * M, dx = g.x - (gm.prevX ?? g.x);
    gm.prevRd = g.rd; gm.prevX = g.x;
    gm.yaw = (gm.yaw || 0) + (clamp(Math.atan2(dx * RW, Math.max(moved, 0.05)), -0.42, 0.42) - (gm.yaw || 0)) * Math.min(1, dt * 8);
    if (gm.mesh.visible) { placeOnTrack(gm.mesh, g.rd, g.x, gm.yaw); gm.mesh.userData.animWheels(gm.yaw * 1.4, moved); }
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
    if (d && d.lamp && ENV.lamps) {
      const p = pose(a), st = d.lampStyle, l = lampLights[li++];
      const q = st === 'flood' ? lateral(p, d.lamp * (RW + 4), 16) : st === 'beach' ? lateral(p, d.lamp * (RW + 0.6), 5.6) : lateral(p, d.lamp * (RW - 1.9), 7.1);
      l.position.set(q[0], q[1], q[2]);
      l.color.set(st === 'flood' ? 0xeaf2ff : 0xffb46b); l.distance = st === 'flood' ? 60 : 26; l.intensity = st === 'flood' ? 1.8 : 1.1;
    }
  }
  updateParticles(dt);
  updateCamera(dt, sP);
  lastDt = Math.max(dt, 1e-3);
  updateReflections(playerMesh.position, playerMesh);
  // pales des éoliennes
  for (const g of chunks.values()) for (const r of g.userData.rotors || []) r.rotation.z += r.userData.spin * dt;
  if (headlight) headlight.intensity = ENV.headlight;
  if (composer) { renderPass.scene = scene; renderPass.camera = camera; bloom.strength = ENV.bloom[0]; bloom.threshold = ENV.bloom[1]; composer.render(dt); }
  else renderer.render(scene, camera);
  drawFx(dt);
}
