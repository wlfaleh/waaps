/* WaForSpeed — Démarrage et boucle principale. */
'use strict';

/* ================= Boucle ================= */
let lastT = 0, dtSmooth = 0;
function frame(t) {
  const raw0 = Math.min(0.05, Math.max(0, (t - lastT) / 1000));
  // pas de temps lissé : les petites irrégularités du navigateur ne font plus « sauter » la voiture
  dtSmooth = dtSmooth ? dtSmooth + (raw0 - dtSmooth) * 0.25 : raw0;
  const raw = Math.abs(raw0 - dtSmooth) > 0.02 ? raw0 : dtSmooth;
  // ralenti bref après un accident
  if (slowmoT > 0) slowmoT -= raw; else timeScale += (1 - timeScale) * Math.min(1, raw * 4);
  const dt = raw * timeScale;
  lastT = t;
  update(dt);
  watchPerf(raw);
  if (renderer) render3D(dt, t);
  if (state === 'play' || state === 'pause' || state === 'over' || state === 'count') updateHud();
  engineUpdate();
  requestAnimationFrame(frame);
}
function boot() {
  ENV = envFor(MAP, TOD);
  buildTrack();
  if (THREE) {
    try {
      setupThree();
      shadowGeo = new THREE.PlaneGeometry(1, 1); shadowGeo.rotateX(-Math.PI / 2);
      glowGeo = shadowGeo;
      blinkGeo = new THREE.BoxGeometry(1, 1, 1);
      boardGeo = new THREE.PlaneGeometry(8, 3.2);
      blurGeo = new THREE.CircleGeometry(1, 32);
      resetPoses();
      setupReflections();
      buildPlayer();
      setupParticles();
      applyEnv();
      loadRealModels();
      setupComposer();
    } catch (e) { console.error(e); renderer = null; }
  }
  if (!renderer) {
    const n = $('.intro'); if (n) { n.textContent = 'Le moteur 3D n\'a pas pu démarrer sur cet appareil (WebGL indisponible ou bibliothèque bloquée).'; n.classList.add('warn'); }
    $('#startBtn').disabled = true; $('#duelBtn').disabled = true; $('#garageBtn').disabled = true;
  }
  resetRace('menu', 7);
  setMuted(muted);
  setQualityLabel();
  renderGarageUI();
  initRoom();
  $('#best').textContent = best ? best.toLocaleString('fr-FR') : '—';
  drawSpeedo(0);
  show('menu');
  lastT = performance.now();
  requestAnimationFrame(frame);
}
const fontsReady = document.fonts && document.fonts.load
  ? Promise.all(['700 20px Rajdhani', '800 20px Orbitron', '600 20px Inter'].map((f) => document.fonts.load(f))).catch(() => {})
  : Promise.resolve();
Promise.race([fontsReady, new Promise((r) => setTimeout(r, 1500))]).then(boot);
