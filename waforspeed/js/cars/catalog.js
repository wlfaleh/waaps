/* WaForSpeed — Catalogue des voitures : dimensions, stats, couleurs et emplacement des vrais modèles 3D. */
'use strict';

/* ================= Voitures ================= */
const PAINTS = [
  { id: 'blanc', name: 'Blanc', hex: '#c9ccd2' }, { id: 'noir', name: 'Noir', hex: '#0f1014' }, { id: 'gris', name: 'Gris', hex: '#7b808a' },
  { id: 'rouge', name: 'Rouge', hex: '#b3122b' }, { id: 'bleu', name: 'Bleu', hex: '#1d3f8f' }, { id: 'orange', name: 'Orange', hex: '#ff6a00' },
  { id: 'jaune', name: 'Jaune', hex: '#c8940a' }, { id: 'vert', name: 'Vert', hex: '#1f5a3c' },
  { id: 'nacre', name: 'Blanc nacré', hex: '#e6e2d6' }, { id: 'bleunuit', name: 'Bleu nuit', hex: '#141c3a' }, { id: 'anglais', name: 'Vert anglais', hex: '#0f3324' },
  { id: 'bordeaux', name: 'Bordeaux', hex: '#5a0f1e' }, { id: 'sable', name: 'Sable', hex: '#b39a72' }, { id: 'violet', name: 'Violet', hex: '#4b2380' },
  { id: 'turquoise', name: 'Turquoise', hex: '#0f8f8c' }, { id: 'taxi', name: 'Jaune taxi', hex: '#e8b400' }
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
  { id: 'a45', brand: 'Mercedes-AMG', model: 'A 45', name: 'Mercedes-AMG A 45', body: 'Compacte sportive', tag: 'Compacte de 381 ch à 4 roues motrices : une fusée de poche.', glow: '#00E5FF', paint: 'gris', style: 'golf', spec: { ch: 381, s100: 4.2, vmax: 270, kg: 1555 }, grip: 8,
    d: { L: 4.36, W: 1.78, H: 1.42, gc: 0.14, rw: 0.33, oh: 0.86, wb: 2.70, nose: 0.72, belt: 0.98, beltR: 1.02, hood: 1.15, wsl: 0.75, re: -0.33, drop: 0.06, rearOh: 0.18, tail: 1.0, pc: 0.32 } },
  { id: 'model3', brand: 'Tesla', model: 'Model 3', name: 'Tesla Model 3', body: 'Berline électrique', tag: 'Électrique : couple instantané, silence et grosse accélération.', glow: '#00E5FF', paint: 'blanc', style: 'a3', spec: { ch: 440, s100: 4.4, vmax: 233, kg: 1844 }, grip: 7,
    d: { L: 4.69, W: 1.85, H: 1.44, gc: 0.14, rw: 0.34, oh: 0.88, wb: 2.88, nose: 0.72, belt: 0.97, beltR: 1.0, hood: 1.2, wsl: 0.72, re: -0.2, drop: 0.06, rearOh: 0.3, tail: 0.98, pc: 0.32 } },
  { id: 'corsa', brand: 'Opel', model: 'Corsa', name: 'Opel Corsa', body: 'Citadine', tag: 'Citadine légère et maniable : parfaite pour les petites rues.', glow: '#B6FF00', paint: 'jaune', style: 'clio', spec: { ch: 130, s100: 8.7, vmax: 208, kg: 1165 }, grip: 9,
    d: { L: 4.06, W: 1.77, H: 1.43, gc: 0.13, rw: 0.32, oh: 0.82, wb: 2.54, nose: 0.7, belt: 0.95, beltR: 1.0, hood: 1.1, wsl: 0.8, re: -0.08, drop: 0.08, rearOh: 0.28, tail: 0.98, pc: 0.3 } },
  { id: 'gt86', brand: 'Toyota', model: 'GT86', name: 'Toyota GT86', body: 'Coupé', tag: 'Petit coupé propulsion : léger, joueur et facile à faire glisser.', glow: '#FF1F4B', paint: 'rouge', style: 'golf', spec: { ch: 200, s100: 7.6, vmax: 226, kg: 1240 }, grip: 9,
    d: { L: 4.24, W: 1.78, H: 1.29, gc: 0.12, rw: 0.32, oh: 0.85, wb: 2.57, nose: 0.66, belt: 0.9, beltR: 0.93, hood: 1.2, wsl: 0.62, re: -0.45, drop: 0.1, rearOh: 0.12, tail: 0.95, pc: 0.3 } },
  { id: 'elantra', brand: 'Hyundai', model: 'Elantra N', name: 'Hyundai Elantra N', body: 'Berline sport', tag: 'Berline coréenne affûtée sur circuit : vive et précise.', glow: '#00E5FF', paint: 'bleu', style: 'a3', spec: { ch: 280, s100: 5.3, vmax: 250, kg: 1440 }, grip: 8,
    d: { L: 4.68, W: 1.83, H: 1.42, gc: 0.13, rw: 0.34, oh: 0.88, wb: 2.72, nose: 0.7, belt: 0.96, beltR: 0.99, hood: 1.25, wsl: 0.72, re: -0.2, drop: 0.06, rearOh: 0.3, tail: 0.97, pc: 0.32 } },
  { id: 'v60', brand: 'Volvo', model: 'V60 Polestar', name: 'Volvo V60 Polestar', body: 'Break sport', tag: 'Break suédois de 350 ch : rapide, sûr et stable.', glow: '#00E5FF', paint: 'bleu', style: 'golf', spec: { ch: 350, s100: 4.9, vmax: 250, kg: 1796 }, grip: 7,
    d: { L: 4.63, W: 1.87, H: 1.48, gc: 0.14, rw: 0.34, oh: 0.88, wb: 2.78, nose: 0.72, belt: 0.98, beltR: 1.02, hood: 1.2, wsl: 0.75, re: -0.1, drop: 0.04, rearOh: 0.25, tail: 1.02, pc: 0.32 } },
  { id: 'rrsport', brand: 'Land Rover', model: 'Range Rover Sport', name: 'Range Rover Sport', body: 'Grand SUV', tag: 'SUV de luxe massif : imposant dans les chocs, lourd en virage.', glow: '#B6FF00', paint: 'noir', style: 'x1', spec: { ch: 400, s100: 5.9, vmax: 242, kg: 2330 }, grip: 5,
    d: { L: 4.95, W: 2.05, H: 1.82, gc: 0.21, rw: 0.38, oh: 0.88, wb: 3.0, nose: 0.86, belt: 1.12, beltR: 1.16, hood: 1.25, wsl: 0.72, re: -0.4, drop: 0.05, rearOh: 0.2, tail: 1.12, pc: 0.28 } },
  { id: 'mustang', brand: 'Ford', model: 'Mustang Shelby GT500', name: 'Ford Mustang Shelby GT500', body: 'Muscle car', tag: 'V8 de 760 ch : la plus puissante, mais lourde à placer.', glow: '#FF6A00', paint: 'bleu', style: 'cabrio', spec: { ch: 760, s100: 3.6, vmax: 290, kg: 1916 }, grip: 6,
    d: { L: 4.82, W: 1.92, H: 1.38, gc: 0.13, rw: 0.35, oh: 0.85, wb: 2.72, nose: 0.68, belt: 0.92, beltR: 0.95, hood: 1.6, wsl: 0.55, re: -0.5, drop: 0.08, rearOh: 0.15, tail: 0.96, pc: 0.3 } },
  { id: 'gallardo', brand: 'Lamborghini', model: 'Gallardo LP560-4 Spyder', name: 'Lamborghini Gallardo Spyder', body: 'Supercar cabriolet', tag: 'V10 à ciel ouvert : 4 roues motrices et plus de 320 km/h.', glow: '#B6FF00', paint: 'jaune', style: 'cabrio', spec: { ch: 560, s100: 4.0, vmax: 324, kg: 1550 }, grip: 9,
    d: { L: 4.35, W: 1.90, H: 1.18, gc: 0.12, rw: 0.34, oh: 0.85, wb: 2.56, nose: 0.62, belt: 0.86, beltR: 0.9, hood: 1.35, wsl: 0.5, deck: 1.3, tail: 0.92, cabrio: true } },
  { id: 'sf90', brand: 'Ferrari', model: 'SF90 XX Stradale', name: 'Ferrari SF90 XX', body: 'Hypercar hybride', tag: 'Hybride de 1030 ch : la plus rapide du garage, à manier avec soin.', glow: '#FF1F4B', paint: 'rouge', style: 'golf', spec: { ch: 1030, s100: 2.3, vmax: 320, kg: 1560 }, grip: 10,
    d: { L: 4.85, W: 1.97, H: 1.19, gc: 0.11, rw: 0.35, oh: 0.85, wb: 2.65, nose: 0.62, belt: 0.86, beltR: 0.9, hood: 1.3, wsl: 0.55, re: -0.7, drop: 0.12, rearOh: 0.1, tail: 0.92, pc: 0.3 } },
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
  p911:    { file: 'models/porsche-911/porsche-911.json', rotateY: 180, paint: '^paint$', credit: '« (FREE) Porsche 911 Carrera 4S » par Karol Miklas (Sketchfab), CC BY-SA 4.0' },
  a45:      { file: 'models/mercedes-a45/mercedes-a45.json', paint: '^Material\\.004$', tail: '^Material\\.013$', credit: '« Mercedes-Benz A45 AMG 2018 » par Lexyc16 (Sketchfab), CC BY-NC 4.0' },
  model3:   { file: 'models/tesla-model-3/tesla-model-3.json', rotateY: 180, paint: '^primary$', tail: '^breaklight_l$', credit: '« Tesla model 3 (free model) » par retro_player (Sketchfab), CC BY 4.0' },
  corsa:    { file: 'models/opel-corsa/opel-corsa.json', rotateY: 180, paint: '^body$', tail: '^(r_glass|r_lights)$', credit: '« Opel Corsa 2020 » par Nieve5677 (Sketchfab), CC BY 4.0' },
  gt86:     { file: 'models/toyota-gt86/toyota-gt86.json', rotateY: 180, paint: '^body\\.001$', credit: '« Toyota GT86 3D Model (Free) » par Mpgs.studio3DModels (Sketchfab), CC BY 4.0' },
  elantra:  { file: 'models/hyundai-elantra-n/hyundai-elantra-n.json', rotateY: 180, paint: '^HHyundai_ElantraNRewardRecycled_2022Paint_Material1$', credit: '« 2024 Hyundai Elantra N » par Ddiaz Design (Sketchfab), CC BY-NC 4.0' },
  v60:      { file: 'models/volvo-v60/volvo-v60.json', paint: '^body_paint$', tail: '^lamp_backglass$', credit: '« Volvo V60 Polestar (2013) » par Myedsu (Sketchfab), CC BY 4.0' },
  rrsport:  { file: 'models/range-rover-sport/range-rover-sport.json', rotateY: 180, paint: '^2023_Land_Rover_Range_Rover_Sport_Firenze_Red$', credit: '« Land Rover Range Rover Sport - 2023 » par Unn Interativa (Sketchfab), CC BY 4.0' },
  mustang:  { file: 'models/ford-mustang/ford-mustang.json', rotateY: 180, paint: '^fFord_MustangShelbyGT500RewardRecycled_2019Paint_Material1$', credit: '« 2020 Ford Mustang Shelby GT500 » par Ddiaz Design (Sketchfab), CC BY-NC-SA 4.0' },
  gallardo: { file: 'models/lambo-gallardo/lambo-gallardo.json', rotateY: 180, paint: '^MMAT_Gallardo_Base1$', tail: '^sans-feu-stop$', credit: '« 2009 Lamborghini Gallardo LP560-4 Spyder » par Ddiaz Design (Sketchfab), CC BY 4.0' },
  sf90:     { file: 'models/ferrari-sf90/ferrari-sf90.json', rotateY: 180, paint: '^PLASTIC_INT_10$', credit: '« Ferrari SF90 XX | www.vecarz.com » par vecarz (Sketchfab), CC BY 4.0' }
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
