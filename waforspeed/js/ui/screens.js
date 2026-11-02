/* WaForSpeed — Écrans (menu, garage, pause, fin), clavier et commandes tactiles. */
'use strict';

/* ================= Écrans & états ================= */
const screens = { menu: $('#menu'), garage: $('#garage'), mapSel: $('#mapSel'), pause: $('#pause'), over: $('#over'), lobby: $('#lobby'), duelOver: $('#duelOver') };
const countEl = $('#countdown');
function showCount(txt) {
  countEl.hidden = !txt;
  countEl.className = 'countdown' + (txt === 'GO' ? ' go' : '');
  countEl.textContent = '';
  if (txt) { const sp = document.createElement('span'); sp.textContent = txt; countEl.appendChild(sp); }
}
function show(name) {
  for (const [k, el] of Object.entries(screens)) el.hidden = k !== name;
  $('#hud').hidden = !(name === null || name === 'pause');
  $('#touch').hidden = !(isTouch && name === null);
}
function startRace() {
  audioInit();
  mode = 'solo';
  resetRace('play', (Math.random() * 4294967296) >>> 0);
  for (const k in input) input[k] = false;
  state = 'count';
  show(null);
  Object.keys(last).forEach((k) => delete last[k]);
  updateHud();
}
function endRace() {
  state = 'over';
  const s = score();
  const isBest = s > best;
  if (isBest) { best = s; store('waforspeed-best', String(best)); }
  $('#finalScore').textContent = s.toLocaleString('fr-FR');
  $('#newBest').hidden = !isBest;
  $('#stDist').textContent = (dist * 0.006 / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 2, minimumFractionDigits: 2 }) + ' km';
  $('#stSpeed').textContent = maxKmh + ' km/h';
  $('#stNear').textContent = String(nearCount);
  $('#stCp').textContent = String(level);
  $('#best').textContent = best.toLocaleString('fr-FR');
  beep(660, 0, 0.2); beep(440, 0.2, 0.2); beep(330, 0.4, 0.4);
  setTimeout(() => { if (state === 'over') { show('over'); $('#againBtn').focus({ preventScroll: true }); } }, 900);
  $('#hud').hidden = false;
}
/* menu en course : réglages + quitter. En solo la course est en pause ; en duel elle continue. */
function pauseGame() {
  if (state !== 'play' && state !== 'count') return;
  if (mode === 'solo' && state === 'play') state = 'pause';
  for (const k in input) input[k] = false;
  $('#pauseEyebrow').textContent = mode === 'duel' ? 'Le duel continue pendant que tu règles' : 'Course en pause';
  $('#restartBtn').hidden = mode === 'duel';
  $('#quitBtn').textContent = mode === 'duel' ? 'Quitter le duel' : 'Quitter la course';
  renderSettings(); show('pause'); $('#resumeBtn').focus({ preventScroll: true });
}
function resumeGame() {
  if (screens.pause.hidden) return;
  if (state === 'pause') state = 'play';
  for (const k in input) input[k] = false; show(null); lastT = performance.now();
}
function renderSettings() {
  for (const b of $('#setCam').children) b.setAttribute('aria-pressed', String(+b.dataset.v === camMode));
  for (const b of $('#setGfx').children) b.setAttribute('aria-pressed', String(b.dataset.v === quality));
  for (const b of $('#setSnd').children) b.setAttribute('aria-pressed', String((b.dataset.v === 'off') === muted));
}
for (const b of $('#setCam').children) b.addEventListener('click', () => { while (camMode !== +b.dataset.v) cycleCamera(); renderSettings(); });
for (const b of $('#setGfx').children) b.addEventListener('click', () => { if (quality !== b.dataset.v) setQuality(b.dataset.v, true); renderSettings(); });
for (const b of $('#setSnd').children) b.addEventListener('click', () => { audioInit(); setMuted(b.dataset.v === 'off'); renderSettings(); });
$('#restartBtn').addEventListener('click', () => { if (mode === 'solo') startRace(); });
$('#menuBtnHud').addEventListener('click', (e) => { e.currentTarget.blur(); if (!screens.pause.hidden) resumeGame(); else pauseGame(); });
function toMenu() {
  raceStartWall = 0; leaveRoom(); mode = 'solo'; showCount(null); state = 'menu'; resetRace('menu', 7); show('menu');
  $('#best').textContent = best ? best.toLocaleString('fr-FR') : '—'; $('#myCarName').textContent = myCar.name; $('#startBtn').focus({ preventScroll: true });
}

/* ---------- Garage ---------- */
let garageFor = 'solo';
function renderGarageUI() {
  const i = CARS.indexOf(myCar), st = carStats(myCar), sp = myCar.spec;
  $('#carBrand').textContent = myCar.brand;
  $('#carIndex').textContent = String(i + 1).padStart(2, '0') + ' / ' + CARS.length;
  $('#carName').textContent = myCar.model;
  $('#carBody').textContent = myCar.body;
  $('#carTag').textContent = myCar.tag;
  $('#spCh').textContent = String(sp.ch);
  $('#spS100').textContent = sp.s100.toLocaleString('fr-FR');
  $('#spVmax').textContent = String(sp.vmax);
  const st2 = modelStatus.get(myCar.id);
  $('#carModelNote').textContent = st2 === 'ok' ? modelNote(myCar) : '';
  $('#carLoading').hidden = st2 === 'ok' || st2 === 'error' || !CAR_MODELS[myCar.id];
  const labels = [['v', 'Vitesse'], ['a', 'Accélération'], ['m', 'Maniabilité'], ['p', 'Puissance']];
  const box2 = $('#carStats');
  if (!box2.children.length) {
    for (const [k, lab] of labels) {
      const row = document.createElement('div'); row.className = 'stat'; row.dataset.k = k;
      row.innerHTML = '<span class="label"></span><span class="bar"><i></i></span><b></b>';
      row.children[0].textContent = lab; box2.appendChild(row);
    }
  }
  for (const row of box2.children) {
    const v = st[row.dataset.k] || 0;
    row.children[1].firstChild.style.width = v * 10 + '%';
    row.children[2].textContent = String(v);
  }
  const dots = $('#carGrid');
  if (!dots.children.length) {
    for (const c of CARS) {
      const b = document.createElement('button'); b.dataset.id = c.id;
      b.setAttribute('aria-label', c.name); b.title = c.name;
      b.addEventListener('click', () => selectCar(c.id));
      dots.appendChild(b);
    }
  }
  for (const b of dots.children) b.setAttribute('aria-pressed', String(b.dataset.id === myCar.id));
  const pr = $('#paintRow');
  if (!pr.children.length) {
    for (const p of PAINTS) {
      const b = document.createElement('button'); b.className = 'paint'; b.dataset.id = p.id;
      b.style.setProperty('--c', p.hex); b.setAttribute('aria-label', p.name); b.title = p.name;
      b.addEventListener('click', () => selectPaint(p.id));
      pr.appendChild(b);
    }
  }
  for (const b of pr.children) b.setAttribute('aria-pressed', String(b.dataset.id === myPaint().id));
  $('#paintName').textContent = myPaint().name;
  const go = $('#garageGo'), ready = st2 === 'ok' || st2 === 'error';
  go.disabled = !ready;
  go.textContent = !ready ? 'Chargement…' : garageFor === 'duel' ? 'Valider' : 'Choisir';
  $('#lobbyCar').textContent = myCar.name;
  $('#myCarName').textContent = myCar.name;
}
/* voiture suivante / précédente (flèches, clavier, glisser) */
function cycleCar(dir) {
  const i = CARS.indexOf(myCar) + dir;
  selectCar(CARS[(i + CARS.length) % CARS.length].id, dir);
}
$('#carPrev').addEventListener('click', () => cycleCar(-1));
$('#carNext').addEventListener('click', () => cycleCar(1));
$('#myCarBtn').addEventListener('click', () => openGarage('look'));
function selectPaint(id) {
  store('waforspeed-paint-' + myCar.id, id);
  if (renderer) { setGarageCar(); buildPlayer(); }
  renderGarageUI();
  if (sub) sub.presence({ paint: myPaint().id }).catch(() => {});
}
function selectCar(id, dir) {
  const prev = myCar;
  myCar = carById(id); PERF = carPerf(myCar); store('waforspeed-car', myCar.id);
  if (renderer) { setGarageCar(dir || (CARS.indexOf(myCar) > CARS.indexOf(prev) ? 1 : -1)); buildPlayer(); }
  renderGarageUI();
  if (sub) sub.presence({ car: myCar.id, paint: myPaint().id }).catch(() => {});
  noiseHit(0.18, 1400, 1.5, 0.25, 500);
}
function openGarage(forWhat) {
  audioInit();
  garageFor = forWhat;
  state = 'garage';
  if (renderer) setGarageCar();
  renderGarageUI();
  show('garage');
  $('#garageGo').focus({ preventScroll: true });
}
function leaveGarage(go) {
  if (garageFor === 'solo' && go) { openMapSel('solo'); return; }
  if (garageFor === 'duel') { state = 'menu'; mode = 'solo'; resetRace('menu', 7); show('lobby'); renderLobby(); $('#readyBtn').focus({ preventScroll: true }); return; }
  toMenu();
}
$('#garageGo').addEventListener('click', () => leaveGarage(true));

/* ---------- Choix du terrain et du moment ---------- */
let mapFor = 'solo';
function renderMapUI() {
  $('#mapName').textContent = MAP.name;
  $('#mapDesc').textContent = MAP.desc;
  const grid = $('#mapGrid');
  if (!grid.children.length) {
    for (const m of MAPS) {
      const b = document.createElement('button'); b.className = 'map-card'; b.dataset.id = m.id;
      const art = document.createElement('span'); art.className = 'map-art';
      const nm = document.createElement('span'); nm.textContent = m.name;
      b.append(art, nm);
      b.addEventListener('click', () => pickMap(m.id, TOD));
      grid.appendChild(b);
    }
  }
  const k = TOD === 'nuit' ? 0 : 1;
  for (const b of grid.children) {
    const m = mapById(b.dataset.id), art = b.firstChild;
    b.setAttribute('aria-pressed', String(m === MAP));
    art.style.setProperty('--sky', m.art.sky[k]); art.style.setProperty('--ground', m.art.ground[k]);
    art.style.setProperty('--road', m.road === 'circuit' ? (k ? '#55585f' : '#2a2c31') : (k ? '#45474d' : '#1c1e26'));
    art.style.setProperty('--accent', m.art.accent);
  }
  for (const b of document.querySelectorAll('.tod-btn')) b.setAttribute('aria-pressed', String(b.dataset.tod === TOD));
  $('#mapGo').textContent = mapFor === 'solo' ? 'Rouler' : 'Valider';
}
function pickMap(id, tod) {
  if (setMap(id, tod)) resetRace('menu', 7);
  renderMapUI();
  if (sub && iAmHost) sub.presence({ map: MAP.id, tod: TOD }).catch(() => {});
}
function openMapSel(forWhat) {
  audioInit();
  mapFor = forWhat;
  state = 'menu'; mode = 'solo';
  show('mapSel');
  renderMapUI();
  const cur = [...$('#mapGrid').children].find((b) => b.dataset.id === MAP.id);
  if (cur) cur.focus({ preventScroll: true });
}
document.querySelectorAll('.tod-btn').forEach((b) => b.addEventListener('click', () => pickMap(MAP.id, b.dataset.tod)));
$('#mapGo').addEventListener('click', () => {
  if (mapFor === 'solo') { startRace(); return; }
  show('lobby'); renderLobby(); $('#readyBtn').focus({ preventScroll: true });
});
$('#mapBack').addEventListener('click', () => {
  if (mapFor === 'solo') { openGarage('solo'); return; }
  show('lobby'); renderLobby();
});
$('#garageBack').addEventListener('click', () => leaveGarage(false));

$('#startBtn').addEventListener('click', () => openGarage('solo'));
$('#garageBtn').addEventListener('click', () => openGarage('look'));
$('#againBtn').addEventListener('click', startRace);
$('#menuBtn').addEventListener('click', toMenu);
$('#resumeBtn').addEventListener('click', resumeGame);
$('#quitBtn').addEventListener('click', toMenu);
function setQualityLabel() { $('#qualityBtn').firstChild.textContent = 'Graphismes : ' + (quality === 'high' ? 'haute' : 'rapide'); }
$('#qualityBtn').addEventListener('click', () => {
  setQuality(quality === 'high' ? 'low' : 'high', true);
});
function setQuality(q, byUser) {
  quality = q; if (byUser) store('waforspeed-quality', quality); setQualityLabel();
  if (renderer) { setupComposer(); setupReflections(); onResize(); applyEnv(); clearChunks(); ensureChunks(dist, true); clearTrafficMeshes(); }
}
let perfT = 0, perfN = 0, perfDone = qualityChosen;
function watchPerf(raw) {
  if (perfDone || state !== 'play' || quality !== 'high') return;
  perfT += raw; perfN++;
  if (perfT >= 5) {
    perfDone = true;
    if (perfN / perfT < 30) { setQuality('low', false); toast('Graphismes rapides', 'pour plus de fluidité', 'cp'); }
  }
}

/* ---------- Clavier & tactile ---------- */
const KEYMAP = {
  ArrowUp: 'up', KeyW: 'up', KeyZ: 'up', ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left', KeyQ: 'left', ArrowRight: 'right', KeyD: 'right',
  Space: 'nitro', ShiftLeft: 'nitro', ShiftRight: 'nitro'
};
addEventListener('keydown', (e) => {
  const k = KEYMAP[e.code];
  if ((state === 'play' || state === 'count') && k) { input[k] = true; e.preventDefault(); return; }
  if (e.target && e.target.tagName === 'INPUT' && e.target.type !== 'range') return;
  if (state === 'garage' && (e.code === 'ArrowLeft' || e.code === 'ArrowRight')) {
    cycleCar(e.code === 'ArrowRight' ? 1 : -1);
    e.preventDefault(); return;
  }
  if (e.code === 'KeyP' || e.code === 'Escape') { if (!screens.pause.hidden) resumeGame(); else if (state === 'play' || state === 'count') pauseGame(); e.preventDefault(); }
  else if (e.code === 'KeyM') { audioInit(); setMuted(!muted); }
  else if (e.code === 'KeyC') cycleCamera();
  else if (e.code === 'Enter' && ((state === 'menu' && !screens.menu.hidden) || (state === 'over' && overTimer > 1)) && document.activeElement === document.body) {
    if (state === 'menu') openGarage('solo'); else startRace();
  }
});
addEventListener('keyup', (e) => { const k = KEYMAP[e.code]; if (k) input[k] = false; });
addEventListener('blur', () => { for (const k in input) input[k] = false; pauseGame(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });
document.querySelectorAll('.tbtn').forEach((b) => {
  const k = b.dataset.key;
  const on = (e) => { e.preventDefault(); input[k] = true; b.classList.add('down'); };
  const off = (e) => { e.preventDefault(); input[k] = false; b.classList.remove('down'); };
  b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off);
  b.addEventListener('pointercancel', off); b.addEventListener('pointerleave', off);
  b.addEventListener('contextmenu', (e) => e.preventDefault());
});

$('#camBtn').addEventListener('click', (e) => { cycleCamera(); e.currentTarget.blur(); });
$('#camBtn').lastChild.textContent = CAM_MODES[camMode].name;
