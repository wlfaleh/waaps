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
const ENG = { id: null, set: null, src: null, filter: null, gain: null, gear: 1, load: 0, rpm: 0.12, shiftT: 0 };
function engineVoice() {
  const set = ENGINE_SET[myCar.id] || ['sport', 1];
  if (ENG.id === myCar.id && (ENG.src || set[0] === 'electrique')) return set;
  const buf = engBuffers.get(set[0]);
  if (set[0] !== 'electrique' && !buf) { loadEngineBuffer(set[0]); if (ENG.id !== myCar.id) stopEngineVoice(); return set; }
  stopEngineVoice();
  ENG.id = myCar.id; ENG.set = set;
  if (buf) {
    const src = actx.createBufferSource(); src.buffer = buf; src.loop = true;
    const f = actx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 0.7; f.frequency.value = 1500;
    const g = actx.createGain(); g.gain.value = 0;
    src.connect(f); f.connect(g); g.connect(sfxGain);
    src.start(0, Math.random() * buf.duration);
    Object.assign(ENG, { src, filter: f, gain: g });
  }
  return set;
}
function stopEngineVoice() {
  if (ENG.src) { try { ENG.src.stop(); } catch (e) { /* déjà arrêté */ } ENG.src.disconnect(); ENG.gain.disconnect(); }
  ENG.src = null; ENG.id = null;
}
function engineUpdate() {
  if (!actx) return;
  const t = actx.currentTime, active = state === 'play' || state === 'count';
  const set = engineVoice(), electric = set[0] === 'electrique';
  // régime : rapport engagé selon la vitesse (relative à la vitesse max de la voiture)
  const v = Math.min(1.25, Math.abs(speed) / (MAX_SPEED * PERF.top));
  const edges = [0, 0.13, 0.27, 0.43, 0.6, 0.79, 1.3];
  let gear = 1; while (gear < 6 && v >= edges[gear]) gear++;
  if (gear > ENG.gear && speed > 0) ENG.shiftT = 0.12;   // passage de rapport : bref creux
  ENG.gear = gear;
  const inGear = (v - edges[gear - 1]) / (edges[gear] - edges[gear - 1]);
  const rpmT = Math.abs(speed) < MAX_SPEED * 0.01 ? (input.up && state === 'count' ? 0.55 : 0.12) : 0.32 + 0.68 * Math.min(1, inGear);
  ENG.rpm += (rpmT - ENG.rpm) * Math.min(1, lastDt * (rpmT > ENG.rpm ? 7 : 4));
  const loadT = active && (input.up || nitroOn) ? 1 : 0;
  ENG.load += (loadT - ENG.load) * Math.min(1, lastDt * 6);
  ENG.shiftT = Math.max(0, ENG.shiftT - lastDt);
  const vol = active ? (0.16 + ENG.load * 0.2 + ENG.rpm * 0.12) * (ENG.shiftT > 0 ? 0.55 : 1) : 0;
  if (electric) {
    // électrique : pas de moteur thermique, seulement le sifflement de l'onduleur qui monte avec la vitesse
    engA.frequency.setTargetAtTime(180 + v * 1400, t, 0.05); engB.frequency.setTargetAtTime(90 + v * 700, t, 0.05);
    engFilter.frequency.setTargetAtTime(1800 + v * 2500, t, 0.08);
    engGain.gain.setTargetAtTime(active ? 0.01 + v * 0.025 * (0.6 + ENG.load * 0.6) : 0, t, 0.12);
    return;
  }
  engGain.gain.setTargetAtTime(0, t, 0.1);
  if (!ENG.src) return;
  const rate = clamp(set[1] * (0.6 + ENG.rpm * 1.05) * (nitroOn ? 1.05 : 1), 0.45, 2.4);
  ENG.src.playbackRate.setTargetAtTime(rate, t, 0.04);
  ENG.filter.frequency.setTargetAtTime(700 + ENG.rpm * 3200 + ENG.load * 3500, t, 0.06);
  ENG.gain.gain.setTargetAtTime(vol, t, ENG.shiftT > 0 ? 0.02 : 0.08);
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
