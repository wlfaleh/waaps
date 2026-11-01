/* WaForSpeed — Effets 2D par-dessus la 3D : pluie, lignes de vitesse, vignette, flash. */
'use strict';

/* --- effets 2D par-dessus : pluie, lignes de vitesse, vignette, flash --- */
let rain = [];
function initRain() {
  const n = reduceMotion ? 0 : Math.round(Math.min(160, (innerWidth * innerHeight) / 9000));
  const k = fx.width / Math.max(1, innerWidth);
  rain = Array.from({ length: n }, () => ({ x: Math.random() * fx.width, y: Math.random() * fx.height, l: rnd(10, 24) * k, s: rnd(900, 1500) * k }));
}
function drawFx(dt) {
  const w = fx.width, h = fx.height;
  fctx.clearRect(0, 0, w, h);
  const p = speed / MAX_SPEED;
  if (rain.length && ENV.rain) {
    const slant = (-0.12 - steer * 0.25) * (0.4 + p);
    fctx.strokeStyle = 'rgba(170,190,255,.2)'; fctx.lineWidth = Math.max(1, w / innerWidth); fctx.beginPath();
    for (const d of rain) {
      d.y += d.s * dt * (0.7 + p * 0.6); d.x += d.s * dt * slant * 0.3;
      if (d.y > h) { d.y = -d.l; d.x = Math.random() * w; }
      if (d.x < 0) d.x += w; else if (d.x > w) d.x -= w;
      fctx.moveTo(d.x, d.y); fctx.lineTo(d.x + slant * d.l, d.y + d.l * (1 + p));
    }
    fctx.stroke();
  }
  if (nitroOn && !reduceMotion) {
    fctx.strokeStyle = 'rgba(230,240,255,.14)'; fctx.lineWidth = 2; fctx.beginPath();
    const u = Math.min(w, h);
    for (let i = 0; i < 28; i++) {
      const ang = Math.random() * Math.PI * 2, r0 = u * rnd(0.32, 0.5), r1 = r0 + u * rnd(0.2, 0.45);
      fctx.moveTo(w / 2 + Math.cos(ang) * r0, h * 0.45 + Math.sin(ang) * r0 * 0.7);
      fctx.lineTo(w / 2 + Math.cos(ang) * r1, h * 0.45 + Math.sin(ang) * r1 * 0.7);
    }
    fctx.stroke();
  }
  const v = fctx.createRadialGradient(w / 2, h * 0.55, Math.min(w, h) * 0.38, w / 2, h * 0.55, Math.max(w, h) * 0.78);
  v.addColorStop(0, 'rgba(5,6,10,0)'); v.addColorStop(1, nitroOn ? 'rgba(0,30,40,.5)' : `rgba(5,6,10,${ENV.vignette})`);
  fctx.fillStyle = v; fctx.fillRect(0, 0, w, h);
  if (flash > 0) { fctx.fillStyle = `rgba(255,31,75,${flash * 0.28})`; fctx.fillRect(0, 0, w, h); }
}
