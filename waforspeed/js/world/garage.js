/* WaForSpeed — Scène 3D du garage (voiture sur plateau tournant). */
'use strict';

/* --- garage --- */
let gYaw = 0.6, gDrag = null;
function buildGarage() {
  gScene = new THREE.Scene();
  gScene.background = new THREE.Color(0x07070c);
  gScene.fog = new THREE.Fog(0x07070c, 14, 40);
  gCamera = new THREE.PerspectiveCamera(36, 1, 0.1, 200);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 64), new THREE.MeshStandardMaterial({ color: 0x101219, roughness: 0.22, metalness: 0.7 }));
  floor.rotation.x = -Math.PI / 2; gScene.add(floor);
  const turn = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.6, 0.08, 64), new THREE.MeshStandardMaterial({ color: 0x161925, roughness: 0.4, metalness: 0.6 }));
  turn.position.y = 0.04; gScene.add(turn);
  gRing = new THREE.Mesh(new THREE.TorusGeometry(3.62, 0.035, 8, 96), new THREE.MeshBasicMaterial({ color: 0x00e5ff }));
  gRing.rotation.x = Math.PI / 2; gRing.position.y = 0.08; gScene.add(gRing);
  for (let i = 0; i < 9; i++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 9, 0.08), new THREE.MeshBasicMaterial({ color: i % 3 === 1 ? 0xff6a00 : 0x00b8d4 }));
    const a = -0.9 + i * 0.32; bar.position.set(Math.sin(a) * 16, 4.5, -Math.cos(a) * 16 + 4); gScene.add(bar);
  }
  gScene.add(new THREE.HemisphereLight(0x5060a0, 0x050508, 0.6));
  const s1 = new THREE.SpotLight(0xff8a3a, 1.6, 30, 0.6, 0.6, 1.2); s1.position.set(-6, 8, 4); gScene.add(s1);
  const s2 = new THREE.SpotLight(0x40e0ff, 1.6, 30, 0.6, 0.6, 1.2); s2.position.set(6, 8, -3); gScene.add(s2);
  const s3 = new THREE.SpotLight(0xffffff, 1.4, 30, 0.5, 0.7, 1.2); s3.position.set(0, 10, 8); gScene.add(s3);
  const cv = $('#game');
  cv.addEventListener('pointerdown', (e) => { if (state === 'garage') { gDrag = { x: e.clientX, yaw: gYaw }; cv.setPointerCapture(e.pointerId); } });
  cv.addEventListener('pointermove', (e) => { if (gDrag) gYaw = gDrag.yaw + (e.clientX - gDrag.x) * 0.01; });
  const end = () => { gDrag = null; };
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
}
function setGarageCar() {
  if (gCar) gScene.remove(gCar);
  if (typeof requestModel === 'function') requestModel(myCar.id);
  gCar = makeCarMesh(myCar, myPaint().hex, { glow: myCar.glow, hq: true });
  gCar.position.y = 0.08;
  gScene.add(gCar);
  gRing.material.color.set(myCar.glow);
}
function renderGarage(dt) {
  if (!gDrag && !reduceMotion) gYaw += dt * 0.35;
  if (gCar) updateReflections(gCar.position, gCar);
  if (gCar) { gCar.rotation.y = gYaw; if (!reduceMotion) gCar.userData.animWheels(Math.sin(performance.now() / 900) * 0.4, 0); }
  const narrow = W < 760;
  const portrait = W < H;
  const dist2 = portrait ? 17 : narrow ? 12 : 9.2;
  gCamera.position.set(Math.sin(0.5) * dist2, portrait ? 4.6 : narrow ? 3.6 : 2.6, Math.cos(0.5) * dist2);
  gCamera.lookAt(narrow ? 0 : -1.9, portrait ? -2.6 : narrow ? -0.9 : 0.55, 0);
  if (composer) { renderPass.scene = gScene; renderPass.camera = gCamera; bloom.threshold = 0.7; bloom.strength = 0.55; composer.render(dt); }
  else renderer.render(gScene, gCamera);
  fctx.clearRect(0, 0, fx.width, fx.height);
}
