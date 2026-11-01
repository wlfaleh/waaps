/* WaForSpeed — Voiture du joueur : modèle, flammes de nitro, phares. */
'use strict';

/* --- voiture du joueur --- */
let playerMesh = null, playerTailMat = null, flames = [], headlight = null, revLight = null;
function buildPlayer() {
  if (playerMesh) scene.remove(playerMesh);
  playerTailMat = new THREE.MeshBasicMaterial({ color: 0xff3050 });
  playerMesh = makeCarMesh(myCar, myPaint().hex, { glow: myCar.glow, tailMat: playerTailMat, hq: true });
  flames = [];
  const fg = new THREE.ConeGeometry(0.11, 1.1, 8); fg.rotateX(Math.PI / 2); fg.translate(0, 0, 0.55);
  for (const x of [-0.45, 0.45]) {
    const fl = new THREE.Mesh(fg, new THREE.MeshBasicMaterial({ color: 0x66f0ff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    fl.position.set(x, myCar.d.gc + 0.2, myCar.d.L / 2 + 0.05); fl.visible = false;
    playerMesh.userData.inner.add(fl); flames.push(fl);
  }
  headlight = new THREE.SpotLight(0xfff1dd, 2.2, 90, 0.5, 0.6, 1.2);
  headlight.position.set(0, 0.8, -myCar.d.L / 2);
  const tgt = new THREE.Object3D(); tgt.position.set(0, -0.6, -40);
  playerMesh.add(tgt); headlight.target = tgt; playerMesh.add(headlight);
  // lumière blanche derrière la voiture en marche arrière (éclaire la route la nuit)
  revLight = new THREE.PointLight(0xe8eeff, 0, 14, 2); revLight.position.set(0, 0.6, myCar.d.L / 2 + 0.8); playerMesh.add(revLight);
  scene.add(playerMesh);
}
