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
const LOD_CAR_M = 70;   // au-delà, voiture simplifiée en une seule pièce (1 appel de dessin)
function trafficMesh(car, far) {
  if (far) {
    if (!car.lowMesh) { car.lowMesh = makeCarLow(CARS[car.type], TRAFFIC_PAINTS[car.color]); scene.add(car.lowMesh); }
    if (car.mesh) car.mesh.visible = false;
    return car.lowMesh;
  }
  if (!car.mesh) { car.mesh = makeCarMesh(CARS[car.type], TRAFFIC_PAINTS[car.color], { traffic: true }); scene.add(car.mesh); }
  if (car.lowMesh) car.lowMesh.visible = false;
  return car.mesh;
}
function clearTrafficMeshes() {
  for (const c of cars) { if (c.mesh) scene.remove(c.mesh); if (c.lowMesh) scene.remove(c.lowMesh); c.mesh = null; c.lowMesh = null; }
}
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
      requestModel(spec.id);
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
const sus = { y: 0, v: 0, prev: null, smoke: 0 };   // suspension du joueur
function placeOnTrack(obj, sAbs, offset, yaw = 0, roll = 0) {
  trackPoint(sAbs, offset * RW, TP);
  obj.position.set(TP.x, TP.y + 0.15 * 0, TP.z);
  obj.rotation.set(TP.slope, -TP.th - yaw, roll);
}

/* --- caméra de poursuite --- */
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), tmpA = {}, tmpB = {};
let camInit = false, fovNow = 62;
/* trois vues : proche (par défaut), loin, capot */
const CAM_MODES = [
  { id: 'proche', name: 'Proche', dist: 4.6, h: 1.28, ahead: 7, lookH: 0.78, fov: 58 },
  { id: 'loin', name: 'Loin', dist: 8, h: 2.5, ahead: 14, lookH: 0.9, fov: 62 },
  { id: 'capot', name: 'Cockpit', hood: true, cockpit: true, fov: 72 }
];
let camHd = 0, camDistDyn = 0;
const _eye = new THREE.Vector3(), _fwd = new THREE.Vector3();
/* vue cockpit : tableau de bord, montants de pare-brise et volant qui tourne (attachés à la caméra) */
let cockpit = null;
function buildCockpit() {
  if (cockpit) return cockpit;
  const g = new THREE.Group(), dark = new THREE.MeshStandardMaterial({ color: 0x2a2c33, roughness: 0.7, metalness: 0.15 });
  const leather = new THREE.MeshStandardMaterial({ color: 0x23242a, roughness: 0.5, metalness: 0.1, emissive: 0x08090c });
  const alu = new THREE.MeshStandardMaterial({ color: 0x9aa0a8, roughness: 0.3, metalness: 0.9 });
  const dash = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.3, 1.1), dark); dash.position.set(0.32, -0.66, -0.9); dash.rotation.x = 0.16; g.add(dash);
  const hood2 = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.12, 0.3), dark); hood2.position.set(0, -0.43, -0.8); g.add(hood2);
  for (const [x, rz] of [[-1.12, -0.1], [1.78, 0.1]]) { const pil = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.3, 0.05), dark); pil.position.set(x, 0.05, -0.85); pil.rotation.set(-0.55, 0, rz); g.add(pil); }
  const roof = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.08, 0.5), dark); roof.position.set(0.32, 0.56, -0.5); g.add(roof);
  // compteur : fond lumineux et aiguille
  const gauge = new THREE.Mesh(new THREE.CircleGeometry(0.1, 32), new THREE.MeshBasicMaterial({ color: 0x0b1a22 })); gauge.position.set(0, -0.33, -0.93); g.add(gauge);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.095, 0.104, 40), new THREE.MeshBasicMaterial({ color: 0x00e5ff })); ring.position.set(0, -0.33, -0.929); g.add(ring);
  const needle = new THREE.Mesh(new THREE.PlaneGeometry(0.008, 0.085), new THREE.MeshBasicMaterial({ color: 0xff6a00 })); needle.geometry.translate(0, 0.04, 0); needle.position.set(0, -0.33, -0.928); g.add(needle);
  // volant : jante, trois branches, moyeu ; tourne autour de son axe
  const wheel = new THREE.Group(); wheel.position.set(0, -0.47, -0.62); wheel.rotation.x = -0.28; wheel.scale.setScalar(0.88);
  wheel.add(new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.022, 10, 40), leather));
  for (const a of [0, Math.PI * 0.62, -Math.PI * 0.62]) { const sp = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.17, 0.018), alu); sp.geometry.translate(0, -0.085, 0); sp.rotation.z = a; wheel.add(sp); }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.04, 20), leather); hub.rotation.x = Math.PI / 2; wheel.add(hub);
  const mark = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.03, 0.025), new THREE.MeshBasicMaterial({ color: 0xff6a00 })); mark.position.set(0, 0.19, 0); wheel.add(mark);
  g.add(wheel);
  g.userData = { wheel, needle };
  g.visible = false;
  camera.add(g); scene.add(camera);
  cockpit = g; return g;
}
let camMode = Math.max(0, CAM_MODES.findIndex((m) => m.id === store('waforspeed-cam')));
function cycleCamera() {
  camMode = (camMode + 1) % CAM_MODES.length;
  store('waforspeed-cam', CAM_MODES[camMode].id); camInit = false;
  const b = $('#camBtn'); if (b) b.lastChild.textContent = CAM_MODES[camMode].name;
}
function updateCamera(dt, sP) {
  const portrait = W < H, C = CAM_MODES[camMode], p = Math.abs(speed) / MAX_SPEED;
  trackPoint(sP, playerX * RW, tmpA);
  const car = playerMesh.position;
  // la caméra suit en partie l'orientation de la voiture : dans les virages on voit son flanc
  // pendant un tête-à-queue la caméra ne suit qu'un peu la rotation (elle reste derrière la route)
  // la caméra suit le cap de la voiture AVEC UN RETARD : quand on tourne, la voiture pivote d'abord
  // dans l'image (on voit son flanc), puis la caméra la rattrape → mouvement vivant, pas une image collée
  const hdT = tmpA.th + playerYaw + spinYaw * (C.hood ? 1 : 0.15);
  if (!camInit) { camHd = hdT; camDistDyn = C.dist || 0; }
  let dh = hdT - camHd; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
  camHd += dh * Math.min(1, dt * (C.hood ? 40 : 3.4));
  const hd = camHd;
  const fx = Math.sin(hd), fz = -Math.cos(hd), rx = Math.cos(hd), rz = Math.sin(hd);
  let desired, look;
  if (C.cockpit) {
    // œil du conducteur (à gauche), lié à la carrosserie : on ressent roulis, tangage et suspension
    const inner = playerMesh.userData.inner, d = myCar.d;
    inner.localToWorld(_eye.set(-0.36, d.H * 0.74, -d.L * 0.02));
    inner.localToWorld(_fwd.set(-0.36, d.H * 0.66, -d.L * 0.02 - 30));
    desired = _eye.clone(); look = _fwd.clone();
  } else {
    // distance : la voiture s'éloigne quand elle accélère, se rapproche au freinage
    const distT = C.dist * (portrait ? 0.92 : 1) + p * 0.6 + clamp(lonAcc * 0.05, -0.4, 0.6);
    camDistDyn += (distT - camDistDyn) * Math.min(1, dt * 2.5);
    const dist = camDistDyn, side = -steer * 0.35 * Math.min(1, p * 2);
    desired = new THREE.Vector3(car.x - fx * dist + rx * side, car.y + C.h * (portrait ? 1.08 : 1) + p * 0.12, car.z - fz * dist + rz * side);
    const ground = trackPoint(sP - dist / M, playerX * RW, tmpB).y + 0.6;
    if (desired.y < ground) desired.y = ground;   // jamais sous la route dans les côtes
    // regarde la voiture et un peu le virage qui arrive
    const ahead = trackPoint(sP + C.ahead * 1.6 / M, playerX * RW, tmpB);
    look = new THREE.Vector3((car.x + fx * C.ahead) * 0.6 + ahead.x * 0.4, car.y + C.lookH, (car.z + fz * C.ahead) * 0.6 + ahead.z * 0.4);
  }
  const k = camInit ? 1 - Math.exp(-dt * (C.hood ? 60 : 14)) : 1;
  camPos.lerp(desired, k); camLook.lerp(look, camInit ? 1 - Math.exp(-dt * (C.hood ? 60 : 16)) : 1); camInit = true;
  // volant et compteur de la vue cockpit
  const ck = buildCockpit(); ck.visible = !!C.cockpit;
  if (C.cockpit) { ck.userData.wheel.rotation.z += (-steer * 2.3 - ck.userData.wheel.rotation.z) * Math.min(1, dt * 14); ck.userData.needle.rotation.z = 2.2 - Math.min(Math.abs(kmh()), 300) / 300 * 4.4; }
  camera.position.copy(camPos);
  if (shake > 0) camera.position.add(new THREE.Vector3((Math.random() - 0.5) * shake * 0.6, (Math.random() - 0.5) * shake * 0.4, 0));
  camera.lookAt(camLook);
  if (!C.cockpit) camera.rotateZ(-steer * 0.015 - (reduceMotion ? 0 : clamp(latAcc * 0.0018, -0.03, 0.03)));
  else camera.rotateZ(playerMesh.userData.inner.rotation.z * -0.6);
  // vibration légère à très haute vitesse (sensation de vitesse)
  if (!reduceMotion && p > 0.75) { const k = (p - 0.75) * (nitroOn ? 0.02 : 0.01); camera.position.x += Math.sin(performance.now() * 0.05) * k; camera.position.y += Math.sin(performance.now() * 0.071) * k; }
  const fov = C.fov + (portrait ? 5 : 0) + Math.min(p, 1.3) * 7 + (nitroOn ? 6 : 0);
  fovNow += (fov - fovNow) * Math.min(1, dt * 4);
  camera.fov = fovNow; camera.updateProjectionMatrix();
  sky.position.copy(camera.position); sky.material.uniforms.uTime.value += dt;
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
  // la voiture pointe là où elle va : son cap (heading) vient directement de la physique
  playerYaw += (heading - playerYaw) * Math.min(1, dt * 20);
  placeOnTrack(playerMesh, sP, playerX, playerYaw + spinYaw);
  const inner = playerMesh.userData.inner;
  // roulis vers l'extérieur du virage, tangage à l'accélération et au freinage (suspension)
  const rollT = reduceMotion ? 0 : clamp(latAcc * 0.0045, -0.06, 0.06);
  const pitchT = reduceMotion ? 0 : clamp(lonAcc * 0.0028, -0.035, 0.03);
  inner.rotation.z += (rollT - inner.rotation.z) * Math.min(1, dt * 7);
  inner.rotation.x += (pitchT - inner.rotation.x) * Math.min(1, dt * 6);
  const wa = steer * 0.6 / (1 + Math.abs(speed * M) / 14);
  playerMesh.userData.animWheels(clamp(wa * 1.6, -0.6, 0.6), speed * M * dt * Math.cos(heading));
  // suspension : ressort amorti excité par les changements de pente (bosses, sommets de côte) et le grain de la route
  const slope = TP.slope, vms = Math.abs(speed * M);
  if (sus.prev !== null && !reduceMotion) sus.v += (slope - sus.prev) / Math.max(dt, 1e-3) * vms * 0.004;
  sus.prev = slope;
  const grain = reduceMotion ? 0 : (Math.sin(dist * M * 2.3) * 0.5 + Math.sin(dist * M * 5.1 + 1.3) * 0.3) * 0.004 * Math.min(1, vms / 30);
  sus.v += (-sus.y * 160 - sus.v * 14) * dt; sus.y = clamp(sus.y + sus.v * dt, -0.08, 0.08);
  inner.position.y = sus.y + grain;
  inner.rotation.x += clamp(-sus.v * 0.01, -0.02, 0.02);
  // fumée des pneus : gros freinage, tête-à-queue, dérapage à haute vitesse
  const skid = (braking && vms > 18) || Math.abs(spinYaw) > 0.3 || (Math.abs(latAcc) > PHYS.grip * 0.92 && vms > 20);
  sus.smoke -= dt;
  if (skid && sus.smoke <= 0 && !reduceMotion) {
    sus.smoke = 0.05;
    for (const sx of [-1, 1]) { const q = trackPoint(sP - myCar.d.L * 0.35 / M, (playerX * RW + sx * myCar.d.W * 0.4), {}); emitSmoke({ x: q.x, y: q.y + 0.25, z: q.z }, 1); }
  }
  // feux : arrière allumés la nuit, stop au freinage, feux de recul blancs en marche arrière
  playerMesh.userData.setLights(TOD === 'nuit', braking, reversing || speed < -1);
  for (const fl of flames) { fl.visible = nitroOn; if (nitroOn) { const k = 0.7 + Math.random() * 0.6; fl.scale.set(1, 1, k); } }
  // trafic
  for (const car of cars) {
    const rel = relZ(car.z - position);
    if (rel < -20 / M || rel > (VIEW * SEG_M + 30) / M) { if (car.mesh) car.mesh.visible = false; if (car.lowMesh) car.lowMesh.visible = false; continue; }
    const m = trafficMesh(car, Math.abs(rel * M) > LOD_CAR_M);
    m.visible = true;
    const lat = (car.offset - car.prevOff) * RW / Math.max(dt, 1e-3);
    const yaw = car.crash ? car.crash.yaw : clamp(Math.atan2(lat, Math.max(car.speed * M, 2)), -0.3, 0.3);
    placeOnTrack(m, sP + rel, car.offset, yaw, car.crash ? Math.sin(car.crash.t * 9) * Math.max(0, 0.06 - car.crash.t * 0.03) : 0);
    m.userData.animWheels(car.crash ? 0 : yaw * 1.6, car.speed * M * dt);
    m.userData.setLights(TOD === 'nuit', !!car.crash, false);
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
    // cap envoyé par l'adversaire (rotation réelle de sa voiture), sinon estimé par son déplacement
    const yawT = g.h !== undefined ? g.h : clamp(Math.atan2(dx * RW, Math.max(moved, 0.05)), -0.42, 0.42);
    gm.yaw = (gm.yaw || 0) + (yawT - (gm.yaw || 0)) * Math.min(1, dt * 8);
    if (gm.mesh.visible) { placeOnTrack(gm.mesh, g.rd, g.x, gm.yaw); gm.mesh.userData.animWheels(gm.yaw * 1.4, moved); gm.mesh.userData.setBrake(g.b === 1, g.b === 2); }
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
  if (typeof updatePeople === 'function') updatePeople(dt, sP);
  updateParticles(dt);
  updateCamera(dt, sP);
  lastDt = Math.max(dt, 1e-3);
  updateReflections(playerMesh.position, playerMesh);
  // pales des éoliennes
  for (const g of chunks.values()) for (const r of g.userData.rotors || []) r.rotation.z += r.userData.spin * dt;
  if (headlight) headlight.intensity = ENV.headlight;
  if (revLight) revLight.intensity += (((reversing || speed < -1) ? (TOD === 'nuit' ? 2.2 : 0.8) : 0) - revLight.intensity) * Math.min(1, dt * 12);
  playerMesh.visible = !CAM_MODES[camMode].hood;   // vue capot : on ne voit pas sa propre voiture
  if (composer) { renderPass.scene = scene; renderPass.camera = camera; bloom.strength = ENV.bloom[0]; bloom.threshold = ENV.bloom[1]; composer.render(dt); }
  else renderer.render(scene, camera);
  drawFx(dt);
}
