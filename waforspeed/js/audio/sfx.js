/* WaForSpeed — Bruit du moteur et effets sonores (Web Audio). */
'use strict';

/* ================= Audio : moteur et effets (Web Audio) ================= */
let actx = null, sfxGain = null, engA = null, engB = null, engFilter = null, engGain = null, noiseBuf = null;
let muted = store('waforspeed-muted') === '1';
function audioInit() {
  if (actx) { if (actx.state === 'suspended') actx.resume(); return; }
  try {
    actx = new (window.AudioContext || window.webkitAudioContext)();
    sfxGain = actx.createGain(); sfxGain.gain.value = muted ? 0 : 0.5; sfxGain.connect(actx.destination);
    engFilter = actx.createBiquadFilter(); engFilter.type = 'lowpass'; engFilter.frequency.value = 500; engFilter.Q.value = 3;
    engGain = actx.createGain(); engGain.gain.value = 0;
    engA = actx.createOscillator(); engA.type = 'sine'; engA.frequency.value = 200;   // utilisé seulement pour la voiture électrique
    engB = actx.createOscillator(); engB.type = 'triangle'; engB.frequency.value = 100;
    const bGain = actx.createGain(); bGain.gain.value = 0.8;
    engA.connect(engFilter); engB.connect(bGain); bGain.connect(engFilter);
    engFilter.connect(engGain); engGain.connect(sfxGain);
    engA.start(); engB.start();
    for (const set of Object.values(ENGINE_SET)) loadEngineBuffer(set[0]);
    noiseBuf = actx.createBuffer(1, actx.sampleRate * 0.6, actx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch (e) { actx = null; }
}
/* ---------- Moteur : vrais enregistrements en boucle (voir audio/engines/license.txt) ----------
   Chaque voiture a un son (V8, sportive, citadine, SUV…) et une hauteur de base.
   Le régime suit la vitesse avec une boîte à 6 rapports simulée ; la hauteur suit le régime,
   le filtre s'ouvre et le volume monte quand on accélère, le son devient sourd au lever de pied. */
const ENGINE_SET = {
  golf: ['sport', 1.0], p208: ['citadine', 1.0], abarth: ['citadine', 1.14], tcross: ['citadine', 0.9], compass: ['thermique', 1.0],
  s3: ['sport', 0.95], x5: ['thermique', 0.88], giulia: ['sport', 0.86], m4: ['v8', 1.25], p911: ['v8', 1.45],
  a45: ['sport', 1.06], model3: ['electrique', 1], corsa: ['citadine', 0.96], gt86: ['sport', 1.12], elantra: ['sport', 1.0],
  v60: ['thermique', 1.1], rrsport: ['gros', 1.0], mustang: ['v8', 0.9], gallardo: ['v8', 1.62], sf90: ['v8', 1.72]
};
const engBuffers = new Map();   // nom -> AudioBuffer (ou promesse)
function loadEngineBuffer(name) {
  if (engBuffers.has(name) || name === 'electrique' || !actx) return;
  engBuffers.set(name, null);
  fetch('audio/engines/' + name + '.wav').then((r) => r.arrayBuffer()).then((ab) => new Promise((ok, ko) => actx.decodeAudioData(ab, ok, ko)))
    .then((buf) => engBuffers.set(name, buf)).catch(() => engBuffers.delete(name));
}
const ENG = { id: null, set: null, src: null, srcHi: null, filter: null, gain: null, hiGain: null, hiFilter: null, gear: 1, load: 0, rpm: 0.12, shiftT: 0, shiftDip: 0 };
/* courbe de saturation : le son « en charge » est plus rauque, comme un moteur qui pousse */
let driveCurve = null;
function getDriveCurve() {
  if (driveCurve) return driveCurve;
  const n = 1024; driveCurve = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; driveCurve[i] = Math.tanh(x * 2.6) / Math.tanh(2.6); }
  return driveCurve;
}
function engineVoice() {
  const set = ENGINE_SET[myCar.id] || ['sport', 1];
  if (ENG.id === myCar.id && (ENG.src || set[0] === 'electrique')) return set;
  const buf = engBuffers.get(set[0]);
  if (set[0] !== 'electrique' && !buf) { loadEngineBuffer(set[0]); if (ENG.id !== myCar.id) stopEngineVoice(); return set; }
  stopEngineVoice();
  ENG.id = myCar.id; ENG.set = set;
  if (buf) {
    // deux voix sur le même enregistrement : « lever de pied » (sourde) et « en charge » (claire, saturée)
    const off = 0.37 + Math.random() * 0.2, at = actx.currentTime + 0.02;
    const src = actx.createBufferSource(); src.buffer = buf; src.loop = true;
    const f = actx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 0.7; f.frequency.value = 900;
    const g = actx.createGain(); g.gain.value = 0;
    src.connect(f); f.connect(g); g.connect(sfxGain);
    const srcHi = actx.createBufferSource(); srcHi.buffer = buf; srcHi.loop = true;
    const shape = actx.createWaveShaper(); shape.curve = getDriveCurve(); shape.oversample = '2x';
    const pre = actx.createGain(); pre.gain.value = 1.8;
    const hf = actx.createBiquadFilter(); hf.type = 'peaking'; hf.frequency.value = 1400; hf.Q.value = 0.8; hf.gain.value = 5;
    const lp = actx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.5; lp.frequency.value = 6000;
    const hg = actx.createGain(); hg.gain.value = 0;
    srcHi.connect(pre); pre.connect(shape); shape.connect(hf); hf.connect(lp); lp.connect(hg); hg.connect(sfxGain);
    src.start(at, off * buf.duration); srcHi.start(at, ((off + 0.5) % 1) * buf.duration);
    Object.assign(ENG, { src, filter: f, gain: g, srcHi, hiGain: hg, hiFilter: lp });
  }
  return set;
}
function stopEngineVoice() {
  for (const k of ['src', 'srcHi']) if (ENG[k]) { try { ENG[k].stop(); } catch (e) { /* déjà arrêté */ } ENG[k].disconnect(); }
  if (ENG.gain) ENG.gain.disconnect(); if (ENG.hiGain) ENG.hiGain.disconnect();
  ENG.src = null; ENG.srcHi = null; ENG.id = null;
}
/* Régime moteur : il suit la vitesse (boîte à 5 rapports) ET la pédale :
   on appuie → le régime grimpe tout de suite et le son devient plus fort et rauque ;
   on relâche → le régime retombe, le son devient sourd. Passage de rapport : chute de régime audible. */
const GEAR_EDGES = [0, 0.16, 0.34, 0.54, 0.76, 1.3];
function engineUpdate() {
  if (!actx) return;
  const t = actx.currentTime, active = state === 'play' || state === 'count', dt = Math.min(0.05, lastDt || 0.016);
  const set = engineVoice(), electric = set[0] === 'electrique';
  const throttle = active && (input.up || nitroOn) ? 1 : 0;
  ENG.load += (throttle - ENG.load) * Math.min(1, dt * (throttle ? 10 : 5));
  const v = Math.min(1.25, Math.abs(speed) / (MAX_SPEED * PERF.top));
  const E = GEAR_EDGES;
  let gear = 1; while (gear < 5 && v >= E[gear]) gear++;
  if (gear > ENG.gear && speed > 0 && throttle) { ENG.shiftT = 0.16; ENG.shiftDip = 1; }
  ENG.gear = gear;
  const inGear = Math.min(1, (v - E[gear - 1]) / (E[gear] - E[gear - 1]));
  let rpmT;
  if (Math.abs(speed) < MAX_SPEED * 0.01) rpmT = throttle ? 0.85 : 0.1;          // à l'arrêt : coup d'accélérateur = montée en régime
  else rpmT = 0.22 + 0.7 * inGear + ENG.load * 0.1 - (1 - ENG.load) * 0.1;      // en roulant : la pédale pousse le régime
  if (gear === 1 && throttle) rpmT = Math.max(rpmT, 0.5);                         // démarrage : le moteur prend des tours
  const up = rpmT > ENG.rpm;
  ENG.rpm += (rpmT - ENG.rpm) * Math.min(1, dt * (up ? (throttle ? 9 : 4) : (throttle ? 6 : 2.5)));
  ENG.rpm = clamp(ENG.rpm, 0.06, 1.05);
  ENG.shiftT = Math.max(0, ENG.shiftT - dt); ENG.shiftDip = Math.max(0, ENG.shiftDip - dt * 7);
  if (electric) {
    // électrique : pas de moteur thermique, seulement le sifflement de l'onduleur qui monte avec la vitesse
    engA.frequency.setTargetAtTime(180 + v * 1400, t, 0.05); engB.frequency.setTargetAtTime(90 + v * 700, t, 0.05);
    engFilter.frequency.setTargetAtTime(1800 + v * 2500, t, 0.08);
    engGain.gain.setTargetAtTime(active ? 0.01 + v * 0.025 * (0.6 + ENG.load * 0.6) : 0, t, 0.12);
    return;
  }
  engGain.gain.setTargetAtTime(0, t, 0.1);
  if (!ENG.src) return;
  // hauteur : du ralenti (~0,55×) au rupteur (~1,9×), avec le timbre propre à chaque voiture
  const rpm = Math.max(0, ENG.rpm - ENG.shiftDip * 0.12);
  const rate = clamp(set[1] * (0.55 + rpm * 1.15) * (nitroOn ? 1.06 : 1), 0.4, 2.6);
  ENG.src.playbackRate.setTargetAtTime(rate, t, 0.03);
  ENG.srcHi.playbackRate.setTargetAtTime(rate, t, 0.03);
  const cut = ENG.shiftT > 0 ? 0.45 : 1;
  const base = active ? 0.13 + rpm * 0.1 : 0;
  ENG.gain.gain.setTargetAtTime(base * (1 - ENG.load * 0.55) * cut, t, 0.05);
  ENG.filter.frequency.setTargetAtTime(500 + rpm * 1600, t, 0.06);
  ENG.hiGain.gain.setTargetAtTime(active ? ENG.load * (0.17 + rpm * 0.2) * cut : 0, t, ENG.shiftT > 0 ? 0.015 : 0.04);
  ENG.hiFilter.frequency.setTargetAtTime(2200 + rpm * 6000, t, 0.05);
}
function noiseHit(dur, freq, q, vol, sweep) {
  if (!actx || !noiseBuf) return;
  const t = actx.currentTime, src = actx.createBufferSource(); src.buffer = noiseBuf;
  const f = actx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
  if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + dur);
  const g = actx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f); f.connect(g); g.connect(sfxGain); src.start(t); src.stop(t + dur);
}
function beep(freq, at, dur) {
  if (!actx) return;
  const t = actx.currentTime + at, o = actx.createOscillator(), g = actx.createGain();
  o.type = 'triangle'; o.frequency.value = freq; g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(sfxGain); o.start(t); o.stop(t + dur);
}
function setMuted(m) {
  muted = m; store('waforspeed-muted', m ? '1' : '0');
  if (sfxGain) sfxGain.gain.value = m ? 0 : 0.5;
}
