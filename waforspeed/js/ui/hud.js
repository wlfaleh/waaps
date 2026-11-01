/* WaForSpeed — Affichage tête haute : chrono, score, nitro, compteur, classement du duel. */
'use strict';

/* ================= HUD ================= */
const hud = { tl: $('#timeLabel'), cpl: $('#cpLabel'), sl: $('#scoreLabel'), board: $('#duelBoard'), time: $('#time'), score: $('#score'), combo: $('#combo'), cpn: $('#cpn'), cpbar: $('#cpbar'), kmh: $('#kmh'), unit: $('.speedo-read .unit'), nitroPanel: $('#nitroPanel'), speedoBox: $('#speedoBox') };
const nitroCells = [...document.querySelectorAll('#nitroBar i')];
const sctx = $('#speedo').getContext('2d');
const last = {};
function setText(key, el, val) { if (last[key] !== val) { last[key] = val; el.textContent = val; } }
function drawSpeedo(k) {
  const s = 380, c = s / 2, r = 160;
  sctx.clearRect(0, 0, s, s);
  const a0 = Math.PI * 0.75, span = Math.PI * 1.5, max = 380;
  sctx.lineWidth = 14; sctx.strokeStyle = 'rgba(30,33,48,.85)';
  sctx.beginPath(); sctx.arc(c, c, r, a0, a0 + span); sctx.stroke();
  sctx.strokeStyle = 'rgba(255,31,75,.55)';
  sctx.beginPath(); sctx.arc(c, c, r, a0 + span * (300 / max), a0 + span); sctx.stroke();
  const pct = clamp(k / max, 0, 1);
  const grd = sctx.createLinearGradient(0, s, s, 0); grd.addColorStop(0, '#00E5FF'); grd.addColorStop(1, '#FF6A00');
  sctx.strokeStyle = k > 300 ? '#FF1F4B' : grd; sctx.lineWidth = 14;
  sctx.shadowColor = k > 300 ? '#FF1F4B' : '#00E5FF'; sctx.shadowBlur = 16;
  sctx.beginPath(); sctx.arc(c, c, r, a0, a0 + span * pct); sctx.stroke(); sctx.shadowBlur = 0;
  sctx.strokeStyle = 'rgba(242,244,248,.55)'; sctx.lineWidth = 3;
  for (let v = 0; v <= max; v += 20) {
    const a = a0 + span * (v / max), big = v % 60 === 0, r1 = r - 22, r2 = r - (big ? 40 : 30);
    sctx.beginPath(); sctx.moveTo(c + Math.cos(a) * r1, c + Math.sin(a) * r1); sctx.lineTo(c + Math.cos(a) * r2, c + Math.sin(a) * r2); sctx.stroke();
  }
}
const fmtTime = (t) => { const m = Math.floor(t / 60); return m + ':' + (t - m * 60).toFixed(1).padStart(4, '0'); };
let boardAt = 0;
function updateHud() {
  const k = Math.abs(kmh());
  const duel = mode === 'duel';
  setText('tl', hud.tl, duel ? 'Chrono' : 'Temps');
  setText('cpl', hud.cpl, duel ? 'Arrivée dans' : 'Checkpoint');
  setText('time', hud.time, duel ? fmtTime(raceTime) : timeLeft.toFixed(1));
  const low = !duel && timeLeft < 8;
  if (last.low !== low) { last.low = low; hud.time.classList.toggle('low', low); }
  let cp;
  if (duel) {
    const left = Math.max(0, FINISH - dist);
    setText('cpn', hud.cpn, (left * 0.006 / 1000).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' km');
    cp = clamp(dist / FINISH, 0, 1);
    const list = [...ghosts.values()];
    const rank = 1 + list.filter((g) => g.done || g.rd > dist).length;
    setText('sl', hud.sl, 'Position');
    setText('score', hud.score, `${rank}/${list.length + 1}`);
    setText('combo', hud.combo, combo > 1 ? `Combo ×${combo}` : '');
    const now = performance.now();
    if (now - boardAt > 100) { boardAt = now; renderBoard(list); }
  } else {
    setText('sl', hud.sl, 'Score');
    setText('score', hud.score, score().toLocaleString('fr-FR'));
    setText('combo', hud.combo, combo > 1 ? `Combo ×${combo}` : '');
    setText('cpn', hud.cpn, String(level + 1));
    cp = clamp(1 - (nextCp - dist) / CHECK_DIST, 0, 1);
  }
  if (last.boardHidden !== !duel) { last.boardHidden = !duel; hud.board.hidden = !duel; }
  const cpw = (cp * 100).toFixed(1) + '%';
  if (last.cpw !== cpw) { last.cpw = cpw; hud.cpbar.style.width = cpw; }
  setText('kmh', hud.kmh, String(k));
  setText('unit', hud.unit, speed < -1 ? 'R · KM/H' : 'KM/H');
  const cells = Math.round(nitro * 10);
  if (last.cells !== cells) { last.cells = cells; nitroCells.forEach((el, i) => el.classList.toggle('on', i < cells)); }
  if (last.nitroOn !== nitroOn) { last.nitroOn = nitroOn; hud.nitroPanel.classList.toggle('active', nitroOn); }
  const red = k > 300;
  if (last.red !== red) { last.red = red; hud.speedoBox.classList.toggle('red', red); }
  if (last.k !== k) { last.k = k; drawSpeedo(k); }
}
function renderBoard(list) {
  const rows = [{ n: (nick || 'Pilote') + ' (toi)', d: dist, me: true }]
    .concat(list.map((g) => ({ n: g.name, d: g.done ? FINISH : g.rd })))
    .sort((a, b) => b.d - a.d);
  const board = hud.board;
  while (board.children.length < rows.length) {
    const r = document.createElement('div'); r.className = 'drow';
    r.innerHTML = '<span class="nm"></span><span class="bar"><i></i></span><span class="km"></span>';
    board.appendChild(r);
  }
  while (board.children.length > rows.length) board.lastChild.remove();
  rows.forEach((row, i) => {
    const el = board.children[i];
    el.classList.toggle('me', !!row.me);
    el.children[0].textContent = row.n;
    el.children[1].firstChild.style.width = (clamp(row.d / FINISH, 0, 1) * 100).toFixed(1) + '%';
    el.children[2].textContent = row.d >= FINISH ? 'Arrivé' : (Math.min(row.d, FINISH) * 0.006 / 1000).toFixed(2) + ' km';
  });
}
