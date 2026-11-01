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
    engA = actx.createOscillator(); engA.type = 'sawtooth'; engA.frequency.value = 50;
    engB = actx.createOscillator(); engB.type = 'triangle'; engB.frequency.value = 25;
    const bGain = actx.createGain(); bGain.gain.value = 0.8;
    engA.connect(engFilter); engB.connect(bGain); bGain.connect(engFilter);
    engFilter.connect(engGain); engGain.connect(sfxGain);
    engA.start(); engB.start();
    noiseBuf = actx.createBuffer(1, actx.sampleRate * 0.6, actx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch (e) { actx = null; }
}
function engineUpdate() {
  if (!actx) return;
  const t = actx.currentTime, p = Math.abs(speed) / MAX_SPEED;
  const gearPct = (Math.min(p, 1.4) * 4.2) % 1;
  const f = 38 + gearPct * 62 + p * 55 + (nitroOn ? 20 : 0);
  engA.frequency.setTargetAtTime(f, t, 0.06);
  engB.frequency.setTargetAtTime(f / 2, t, 0.06);
  engFilter.frequency.setTargetAtTime(320 + p * 900 + (nitroOn ? 600 : 0), t, 0.08);
  const g = state === 'play' ? 0.05 + p * 0.04 : state === 'count' ? 0.04 : 0;
  engGain.gain.setTargetAtTime(g, t, 0.12);
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
