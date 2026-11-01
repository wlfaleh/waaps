/* WaForSpeed — Catalogue des voitures : dimensions, stats, couleurs et emplacement des vrais modèles 3D. */
'use strict';

/* ================= Voitures ================= */
const PAINTS = [
  { id: 'blanc', name: 'Blanc', hex: '#c9ccd2' }, { id: 'noir', name: 'Noir', hex: '#0f1014' }, { id: 'gris', name: 'Gris', hex: '#7b808a' },
  { id: 'rouge', name: 'Rouge', hex: '#b3122b' }, { id: 'bleu', name: 'Bleu', hex: '#1d3f8f' }, { id: 'orange', name: 'Orange', hex: '#ff6a00' },
  { id: 'jaune', name: 'Jaune', hex: '#c8940a' }, { id: 'vert', name: 'Vert', hex: '#1f5a3c' }
];
const paintById = (id) => PAINTS.find((p) => p.id === id) || PAINTS[0];
const TRAFFIC_PAINTS = ['#c9ccd2', '#0f1014', '#7b808a', '#a7acb5', '#1d3f8f', '#7a1426', '#2f4b3e', '#3b3f48', '#c9b28a'];
/* Fiche réelle : ch = puissance, s100 = 0-100 km/h (s), vmax = km/h, kg = masse.
   Les performances en jeu sont calculées à partir de ces chiffres (carPerf). */
const CARS = [
  { id: 'golf', brand: 'Volkswagen', model: 'Golf 8 GTI', name: 'Volkswagen Golf 8 GTI', body: 'Compacte', tag: 'La compacte sportive de référence : équilibrée et précise.', glow: '#00E5FF', paint: 'bleu', style: 'golf', spec: { ch: 245, s100: 6.2, vmax: 250, kg: 1430 }, grip: 8,
    d: { L: 4.29, W: 1.79, H: 1.46, gc: 0.14, rw: 0.33, oh: 0.86, wb: 2.62, nose: 0.72, belt: 0.98, beltR: 1.02, hood: 1.15, wsl: 0.75, re: -0.33, drop: 0.06, rearOh: 0.18, tail: 1.0, pc: 0.32 } },
  { id: 'p208', brand: 'Peugeot', model: '208', name: 'Peugeot 208', body: 'Citadine', tag: 'Citadine vive et légère : idéale pour se faufiler dans le trafic.', glow: '#FF6A00', paint: 'jaune', style: 'clio', spec: { ch: 130, s100: 8.7, vmax: 208, kg: 1160 }, grip: 9,
    d: { L: 4.06, W: 1.75, H: 1.43, gc: 0.13, rw: 0.32, oh: 0.82, wb: 2.54, nose: 0.7, belt: 0.95, beltR: 1.0, hood: 1.1, wsl: 0.8, re: -0.08, drop: 0.08, rearOh: 0.28, tail: 0.98, pc: 0.3 } },
  { id: 'abarth', brand: 'Abarth', model: '500', name: 'Abarth 500', body: 'Mini sportive', tag: 'Petite bombe italienne : minuscule, nerveuse, très agile.', glow: '#FF6A00', paint: 'rouge', style: 'clio', spec: { ch: 135, s100: 7.9, vmax: 205, kg: 1035 }, grip: 10,
    d: { L: 3.66, W: 1.63, H: 1.49, gc: 0.13, rw: 0.3, oh: 0.7, wb: 2.3, nose: 0.72, belt: 0.98, beltR: 1.02, hood: 1.0, wsl: 0.8, re: -0.05, drop: 0.08, rearOh: 0.2, tail: 1.0, pc: 0.3 } },
  { id: 'tcross', brand: 'Volkswagen', model: 'T-Cross', name: 'Volkswagen T-Cross', body: 'SUV compact', tag: 'SUV compact facile à conduire, stable dans les chocs.', glow: '#B6FF00', paint: 'orange', style: 'troc', spec: { ch: 150, s100: 8.9, vmax: 200, kg: 1270 }, grip: 6,
    d: { L: 4.11, W: 1.76, H: 1.58, gc: 0.18, rw: 0.35, oh: 0.85, wb: 2.6, nose: 0.82, belt: 1.05, beltR: 1.08, hood: 1.15, wsl: 0.7, re: -0.1, drop: 0.1, rearOh: 0.32, tail: 1.04, pc: 0.3 } },
  { id: 'compass', brand: 'Jeep', model: 'Compass', name: 'Jeep Compass', body: 'SUV', tag: 'SUV robuste : haut, lourd, solide quand ça frotte.', glow: '#B6FF00', paint: 'vert', style: 'troc', spec: { ch: 150, s100: 9.5, vmax: 196, kg: 1505 }, grip: 5,
    d: { L: 4.40, W: 1.82, H: 1.64, gc: 0.2, rw: 0.36, oh: 0.86, wb: 2.64, nose: 0.85, belt: 1.08, beltR: 1.12, hood: 1.2, wsl: 0.72, re: -0.3, drop: 0.06, rearOh: 0.22, tail: 1.08, pc: 0.28 } },
  { id: 's3', brand: 'Audi', model: 'S3 berline', name: 'Audi S3 berline', body: 'Berline', tag: 'Berline compacte 4 roues motrices : rapide et sûre.', glow: '#00E5FF', paint: 'gris', style: 'a3', spec: { ch: 300, s100: 4.9, vmax: 250, kg: 1450 }, grip: 8,
    d: { L: 4.47, W: 1.80, H: 1.40, gc: 0.14, rw: 0.33, oh: 0.88, wb: 2.64, nose: 0.72, belt: 0.97, beltR: 1.0, hood: 1.2, wsl: 0.78, re: -0.15, drop: 0.06, rearOh: 0.3, tail: 0.98, pc: 0.32 } },
  { id: 'x5', brand: 'BMW', model: 'X5', name: 'BMW X5', body: 'Grand SUV', tag: 'Grand SUV premium : puissant mais lourd dans les virages.', glow: '#00E5FF', paint: 'blanc', style: 'x1', spec: { ch: 381, s100: 5.4, vmax: 243, kg: 2135 }, grip: 5,
    d: { L: 4.92, W: 2.0, H: 1.75, gc: 0.2, rw: 0.37, oh: 0.88, wb: 2.69, nose: 0.86, belt: 1.1, beltR: 1.14, hood: 1.25, wsl: 0.72, re: -0.4, drop: 0.05, rearOh: 0.2, tail: 1.1, pc: 0.28 } },
  { id: 'giulia', brand: 'Alfa Romeo', model: 'Giulia Quadrifoglio', name: 'Alfa Romeo Giulia Quadrifoglio', body: 'Berline sport', tag: 'Berline italienne de 510 ch : vitesse de pointe énorme.', glow: '#FF1F4B', paint: 'rouge', style: 'a3', spec: { ch: 510, s100: 3.9, vmax: 307, kg: 1580 }, grip: 8,
    d: { L: 4.64, W: 1.87, H: 1.43, gc: 0.13, rw: 0.34, oh: 0.88, wb: 2.82, nose: 0.7, belt: 0.96, beltR: 0.99, hood: 1.3, wsl: 0.72, re: -0.2, drop: 0.06, rearOh: 0.3, tail: 0.97, pc: 0.32 } },
  { id: 'm4', brand: 'BMW', model: 'M4 Competition', name: 'BMW M4 Competition', body: 'Coupé', tag: 'Coupé de course pour la route : brutal en accélération.', glow: '#FF6A00', paint: 'noir', style: 'cabrio', spec: { ch: 510, s100: 3.9, vmax: 290, kg: 1725 }, grip: 7,
    d: { L: 4.79, W: 1.89, H: 1.39, gc: 0.13, rw: 0.34, oh: 0.85, wb: 2.85, nose: 0.68, belt: 0.92, beltR: 0.95, hood: 1.55, wsl: 0.55, deck: 1.2, tail: 0.96, cabrio: true } },
  { id: 'p911', brand: 'Porsche', model: '911 Carrera 4S', name: 'Porsche 911 Carrera 4S', body: 'Sportive', tag: 'La sportive absolue : 4 roues motrices, freins et virages parfaits.', glow: '#00E5FF', paint: 'gris', style: 'golf', spec: { ch: 450, s100: 3.6, vmax: 306, kg: 1565 }, grip: 9,
    d: { L: 4.52, W: 1.85, H: 1.30, gc: 0.12, rw: 0.34, oh: 0.85, wb: 2.45, nose: 0.66, belt: 0.9, beltR: 0.93, hood: 1.15, wsl: 0.6, re: -0.6, drop: 0.1, rearOh: 0.1, tail: 0.95, pc: 0.3 } },
];
/* Vrais modèles 3D (dossier models/, voir models/README.md).
   file : glTF JSON ; rotateY : 180 si la voiture arrive de face ; paint : nom du matériau de carrosserie ;
   credit : auteur et licence affichés dans le garage (obligatoire). */
const CAR_MODELS = {
  golf:    { file: 'models/golf-8/golf-8.json', paint: 'uniqueid1500011Mtl$', credit: '« Volkswagen Golf 8. GTI (A8) » par GT Cars: Hyperspeed (Sketchfab), CC BY 4.0' },
  p208:    { file: 'models/peugeot-208/peugeot-208.json', rotateY: 180, paint: '^Carro_Pintura$', credit: '« 2021 Peugeot 208 » par tonielpro520 (Sketchfab), CC BY 4.0' },
  abarth:  { file: 'models/abarth-500/abarth-500.json', rotateY: 180, paint: '^CAR_Livrea$', credit: '« Fiat Abarth 500 » par Luquita (Sketchfab), CC BY 4.0' },
  tcross:  { file: 'models/vw-t-cross/vw-t-cross.json', rotateY: 180, paint: '^carpaint$', credit: '« 2021 Volkswagen T-Cross 280 TSI » par Ddiaz Design (Sketchfab), CC BY-NC-SA 4.0' },
  compass: { file: 'models/jeep-compass/jeep-compass.json', rotateY: 180, paint: '^00_-_BODY$', credit: '« JEEP COMPASS 2021 » par fazt.3ds (Sketchfab), CC BY 4.0' },
  s3:      { file: 'models/audi-a3/audi-a3.json', rotateY: 180, paint: '^carpaint$', credit: '« 2014 Audi S3 Limousine » par tonielpro520 (Sketchfab), CC BY 4.0' },
  x5:      { file: 'models/bmw-x5/bmw-x5.json', rotateY: 180, paint: '^CARPAINT$', credit: '« 2024 BMW X5 xDrive40i » par Ddiaz Design (Sketchfab), CC BY-NC-SA 4.0' },
  giulia:  { file: 'models/alfa-giulia/alfa-giulia.json', rotateY: 180, paint: '^EXT_carpaint$', credit: '« Alfa Romeo Giulia Quadrifoglio » par ijiklvn (Sketchfab), CC BY 4.0' },
  m4:      { file: 'models/bmw-m4/bmw-m4.json', rotateY: 180, paint: '^Material_692$', credit: '« 2021 BMW M4 Competition » par Ricy (Sketchfab), CC BY 4.0' },
  p911:    { file: 'models/porsche-911/porsche-911.json', rotateY: 180, paint: '^paint$', credit: '« (FREE) Porsche 911 Carrera 4S » par Karol Miklas (Sketchfab), CC BY-SA 4.0' }
};
const carById = (id) => CARS.find((c) => c.id === id) || CARS[0];
/* Performances en jeu tirées de la fiche réelle (arcade : accélérations x1.25 pour le rythme).
   top : vitesse max relative (1 = 260 km/h) ; acc : accélération relative ; handling : agilité ;
   mass : masse relative (les lourdes gagnent les chocs, tournent moins vite). */
function carPerf(c) {
  const s = c.spec;
  return {
    top: s.vmax / 260,
    a0: (27.8 / s.s100) * 1.45,          // accélération à bas régime (m/s²), arcade x1.25 incluse
    wb: c.d.wb || 2.6,                    // empattement (m) : rayon de braquage
    acc: clampN((27.8 / s.s100) / 4.6, 0.55, 1.8),
    handling: 0.75 + c.grip * 0.05,
    mass: s.kg / 1450,
    nitroMult: 1.3, nitroGain: 0.12, nitroBurn: 0.26
  };
}
const clampN = (v, a, b) => Math.max(a, Math.min(b, v));
/* barres de stats du garage (0-10), calculées depuis la fiche réelle */
function carStats(c) {
  const s = c.spec;
  return { v: Math.round(clampN((s.vmax - 170) / 14, 1, 10)), a: Math.round(clampN(13 - s.s100 * 1.05, 1, 10)), m: c.grip, p: Math.round(clampN(s.ch / 55, 1, 10)) };
}
let myCar = carById(store('waforspeed-car') || 'golf');
const myPaint = () => paintById(store('waforspeed-paint-' + myCar.id) || myCar.paint);
let PERF = carPerf(myCar);
