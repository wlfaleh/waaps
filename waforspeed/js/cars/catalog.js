/* WaForSpeed — Catalogue des voitures : dimensions, stats, couleurs et emplacement des vrais modèles 3D. */
'use strict';

/* ================= Voitures ================= */
const PAINTS = [
  { id: 'blanc', name: 'Blanc', hex: '#c9ccd2' }, { id: 'noir', name: 'Noir', hex: '#0f1014' }, { id: 'gris', name: 'Gris', hex: '#7b808a' },
  { id: 'rouge', name: 'Rouge', hex: '#b3122b' }, { id: 'bleu', name: 'Bleu', hex: '#1d3f8f' }, { id: 'orange', name: 'Orange', hex: '#ff6a00' }
];
const paintById = (id) => PAINTS.find((p) => p.id === id) || PAINTS[0];
const TRAFFIC_PAINTS = ['#c9ccd2', '#0f1014', '#7b808a', '#a7acb5', '#1d3f8f', '#7a1426', '#2f4b3e', '#3b3f48', '#c9b28a'];
const CARS = [
  { id: 'golf', name: 'Golf 8 GTI', tag: 'La compacte sportive de référence : équilibrée et précise.', glow: '#00E5FF', paint: 'bleu', style: 'golf', stats: { v: 7, a: 7, m: 8, n: 6 },
    d: { L: 4.28, W: 1.79, H: 1.46, gc: 0.14, rw: 0.33, oh: 0.86, wb: 2.62, nose: 0.72, belt: 0.98, beltR: 1.02, hood: 1.15, wsl: 0.75, re: -0.33, drop: 0.06, rearOh: 0.18, tail: 1.0, pc: 0.32 } },
  { id: 'x1', name: 'BMW X5', tag: 'Grand SUV premium : haut et solide, un peu moins agile.', glow: '#00E5FF', paint: 'blanc', style: 'x1', stats: { v: 7, a: 8, m: 6, n: 7 },
    d: { L: 4.92, W: 2.0, H: 1.75, gc: 0.2, rw: 0.37, oh: 0.88, wb: 2.69, nose: 0.86, belt: 1.1, beltR: 1.14, hood: 1.25, wsl: 0.72, re: -0.4, drop: 0.05, rearOh: 0.2, tail: 1.1, pc: 0.28 } },
  { id: 'clio', name: 'Clio', tag: 'Citadine légère : la plus agile pour se faufiler dans le trafic.', glow: '#FF6A00', paint: 'rouge', style: 'clio', stats: { v: 6, a: 7, m: 9, n: 6 },
    d: { L: 4.05, W: 1.77, H: 1.44, gc: 0.13, rw: 0.32, oh: 0.82, wb: 2.58, nose: 0.7, belt: 0.95, beltR: 1.0, hood: 1.1, wsl: 0.8, re: -0.08, drop: 0.08, rearOh: 0.28, tail: 0.98, pc: 0.3 } },
  { id: 'troc', name: 'VW T-Cross', tag: 'SUV compact : grosses relances et nitro généreuse.', glow: '#B6FF00', paint: 'orange', roof: '#0f1014', style: 'troc', stats: { v: 6, a: 8, m: 7, n: 7 },
    d: { L: 4.23, W: 1.82, H: 1.57, gc: 0.18, rw: 0.35, oh: 0.85, wb: 2.6, nose: 0.82, belt: 1.05, beltR: 1.08, hood: 1.15, wsl: 0.7, re: -0.1, drop: 0.1, rearOh: 0.32, tail: 1.04, pc: 0.3 } },
  { id: 'cabrio', name: 'BMW M4', tag: 'Coupé sportif : le plus rapide en ligne droite.', glow: '#FF6A00', paint: 'noir', style: 'cabrio', stats: { v: 9, a: 8, m: 6, n: 5 },
    d: { L: 4.79, W: 1.89, H: 1.39, gc: 0.13, rw: 0.34, oh: 0.85, wb: 2.85, nose: 0.68, belt: 0.92, beltR: 0.95, hood: 1.55, wsl: 0.55, deck: 1.2, tail: 0.96, cabrio: true } },
  { id: 'a3', name: 'Audi A3 berline', tag: 'Compacte sportive : vive et stable dans les courbes.', glow: '#00E5FF', paint: 'gris', style: 'a3', stats: { v: 8, a: 7, m: 7, n: 6 },
    d: { L: 4.34, W: 1.82, H: 1.43, gc: 0.14, rw: 0.33, oh: 0.88, wb: 2.64, nose: 0.72, belt: 0.97, beltR: 1.0, hood: 1.2, wsl: 0.78, re: -0.15, drop: 0.06, rearOh: 0.3, tail: 0.98, pc: 0.32 } }
];
/* Vrais modèles 3D — à remplir quand les fichiers seront dans waforspeed/models/ (voir models/README.md).
   file     : chemin du fichier .glb ou .gltf ; null = voiture provisoire générée par le code
   rotateY  : rotation en degrés si la voiture n'est pas tournée dans le bon sens (avant vers -Z)
   paint    : (option) motif du nom du matériau de carrosserie à repeindre, ex. 'Body_Paint'
   tail     : (option) motif du nom du matériau des feux arrière (allumés au freinage)
   repaint  : false pour garder la couleur d'origine du modèle
   credit   : auteur et licence, affichés dans le garage (obligatoire pour une licence CC-BY) */
const CAR_MODELS = {
  golf:   { file: 'models/golf-8/golf-8.json', paint: 'uniqueid1500011Mtl$', credit: '« Volkswagen Golf 8. GTI (A8) » par GT Cars: Hyperspeed (Sketchfab), licence CC BY 4.0' },
  x1:     { file: 'models/bmw-x5/bmw-x5.json', rotateY: 180, paint: '^CARPAINT$', credit: '« 2024 BMW X5 xDrive40i » par Ddiaz Design (Sketchfab), licence CC BY-NC-SA 4.0' },
  clio:   { file: null, credit: '' },   // aucun modèle de Clio libre au format glTF trouvé pour l'instant
  troc:   { file: 'models/vw-t-cross/vw-t-cross.json', rotateY: 180, paint: '^carpaint$', credit: '« 2021 Volkswagen T-Cross 280 TSI » par Ddiaz Design (Sketchfab), licence CC BY-NC-SA 4.0' },
  cabrio: { file: 'models/bmw-m4/bmw-m4.json', rotateY: 180, paint: '^Material_692$', credit: '« 2021 BMW M4 Competition » par Ricy (Sketchfab), licence CC BY 4.0' },
  a3:     { file: 'models/audi-a3/audi-a3.json', rotateY: 180, paint: '^carpaint$', credit: '« 2014 Audi S3 Limousine » par tonielpro520 (Sketchfab), licence CC BY 4.0' }
};
const carById = (id) => CARS.find((c) => c.id === id) || CARS[0];
function carPerf(c) {
  const s = c.stats;
  return { top: 0.9 + s.v * 0.016, acc: 0.7 + s.a * 0.05, handling: 0.78 + s.m * 0.045, nitroMult: 1.26 + s.n * 0.012, nitroGain: 0.08 + s.n * 0.007, nitroBurn: 0.34 - s.n * 0.01 };
}
let myCar = carById(store('waforspeed-car') || 'golf');
const myPaint = () => paintById(store('waforspeed-paint-' + myCar.id) || myCar.paint);
let PERF = carPerf(myCar);
