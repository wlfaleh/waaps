/* WaForSpeed — Terrains (cartes) et ambiances jour / nuit.
   Une carte décrit le tracé, les bas-côtés, le décor et le trafic ; l'ambiance
   règle le ciel, le soleil ou la lune, le brouillard, l'éclairage et la pluie. */
'use strict';

const MAPS = [
  { id: 'ville', name: 'Ville néon', desc: 'Avenues entre les gratte-ciel, enseignes au néon et chaussée qui brille.',
    seed: 88, curves: [2, 3, 4, 5], hills: 70, sections: 36, edge: 1.7, ground: 'city', road: 'city', skyline: 'city',
    traffic: { n: 42, min: 0.28, max: 0.55 }, art: { sky: ['#1a1030', '#7ab3e0'], ground: ['#14151c', '#55565c'], accent: '#00E5FF' } },
  { id: 'plage', name: 'Corniche', desc: 'Route du bord de mer : sable, palmiers, parasols et l\'océan à perte de vue.',
    seed: 301, curves: [1, 2, 3], hills: 0, sections: 32, edge: 1.6, ground: 'beach', road: 'city', skyline: 'coast',
    traffic: { n: 34, min: 0.3, max: 0.55 }, art: { sky: ['#122040', '#8cc8f0'], ground: ['#2a2a22', '#e6d3a1'], accent: '#1d8fb8' } },
  { id: 'campagne', name: 'Campagne', desc: 'Petites routes entre les champs, les haies, les fermes et les éoliennes.',
    seed: 512, curves: [2, 3, 4], hills: 120, sections: 36, edge: 1.38, ground: 'country', road: 'country', skyline: 'hills',
    traffic: { n: 26, min: 0.28, max: 0.5 }, art: { sky: ['#0c1424', '#9cc9ec'], ground: ['#18200f', '#8fae4c'], accent: '#cdb259' } },
  { id: 'circuit', name: 'Grand Prix', desc: 'Circuit fermé : vibreurs, tribunes, murs de pneus. Tu doubles d\'autres pilotes.',
    seed: 777, curves: [3, 5, 6], hills: 12, sections: 34, edge: 1.66, ground: 'circuit', road: 'circuit', skyline: 'hills',
    traffic: { n: 16, min: 0.5, max: 0.78 }, art: { sky: ['#0d1020', '#a8d0f0'], ground: ['#14200f', '#4f7f32'], accent: '#e2262b' } }
];
const mapById = (id) => MAPS.find((m) => m.id === id) || MAPS[0];

/* Ambiance : valeurs par défaut de jour et de nuit, ajustées par carte. */
function envFor(map, tod) {
  const night = tod === 'nuit';
  const E = night ? {
    skyTop: '#04040a', skyMid: '#150d24', skyHor: '#3a1a36', fog: '#120d1d', fogNear: 40, fogFar: 540,
    hemiSky: '#46327a', hemiGround: '#08080e', hemiI: 0.75, sunColor: '#8a96ff', sunI: 0.35, sunDir: [-0.4, 0.8, 0.3],
    headlight: 2.2, lamps: true, bloom: [0.8, 0.46], neonK: 1, poolK: 1, stars: true, sunDisc: false, moon: true,
    clouds: false, rain: false, windowsLit: true, vignette: 0.55, water: '#0a1828', skylineTint: '#ffffff'
  } : {
    skyTop: '#2a64b8', skyMid: '#74ace0', skyHor: '#d4e6f2', fog: '#c4d8e8', fogNear: 90, fogFar: 760,
    hemiSky: '#dcebff', hemiGround: '#6b6550', hemiI: 0.8, sunColor: '#fff0d4', sunI: 1.2, sunDir: [-0.45, 0.75, -0.5],
    headlight: 0, lamps: false, bloom: [0.3, 0.9], neonK: 0.5, poolK: 0, stars: false, sunDisc: true, moon: false,
    clouds: true, rain: false, windowsLit: false, vignette: 0.3, water: '#1e7fa8', skylineTint: '#ffffff'
  };
  if (map.id === 'ville') { E.stars = false; E.rain = night; if (!night) { E.fog = '#cdd3dc'; E.skyHor = '#dfe2e6'; E.fogFar = 620; } }
  if (map.id === 'plage') { if (night) { E.skyHor = '#2b2240'; E.fog = '#141428'; E.fogFar = 640; } else { E.fogFar = 950; E.fog = '#cfe3f0'; } }
  if (map.id === 'campagne') { if (night) { E.lamps = false; E.skyHor = '#1b2236'; E.fog = '#0d1218'; E.hemiSky = '#3a4670'; E.hemiI = 0.6; E.headlight = 3; } else { E.fog = '#d3e0d0'; E.fogFar = 820; } }
  if (map.id === 'circuit') { if (night) { E.skyHor = '#1f2440'; E.fog = '#0e1020'; E.hemiI = 0.95; E.hemiSky = '#5a5c90'; E.fogFar = 640; } else { E.fogFar = 820; } }
  // couverture nuageuse de jour (plus haut = moins de nuages) ; voile léger la nuit en ville
  E.cloudCover = { ville: 0.5, plage: 0.58, campagne: 0.46, circuit: 0.52 }[map.id] || 0.5;
  if (night && map.id === 'ville') { E.nightClouds = 0.35; E.cloudCover = 0.52; }
  if (quality !== 'high') E.fogFar = Math.min(E.fogFar, 420);
  return E;
}

let MAP = mapById(store('waforspeed-map') || 'ville');
let TOD = store('waforspeed-tod') === 'jour' ? 'jour' : 'nuit';
let ENV = null;

/* change de carte / d'ambiance ; renvoie true si la piste a été reconstruite */
function setMap(id, tod) {
  const m = mapById(id), t = tod === 'jour' ? 'jour' : 'nuit';
  const rebuild = m !== MAP || !segments.length;
  const changed = rebuild || t !== TOD || !ENV;
  MAP = m; TOD = t; ENV = envFor(MAP, TOD);
  store('waforspeed-map', MAP.id); store('waforspeed-tod', TOD);
  if (rebuild) buildTrack();
  if (renderer && changed) applyEnv();
  return changed;
}
