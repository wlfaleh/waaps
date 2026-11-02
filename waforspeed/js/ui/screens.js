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
  const touchOn = isTouch && name === null;
  if ($('#touch').hidden !== !touchOn) { $('#touch').hidden = !touchOn; resetTouch(); }
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
/* Carrousel horizontal de grandes cartes illustrées (SVG dessiné ici, de jour ou de nuit).
   On choisit en glissant, avec les flèches, au clavier (← →) ou en touchant une carte. */
let mapFor = 'solo';
/* longueur d'une carte : même tirage que buildTrack (track.js), sans construire la piste */
const mapLenCache = new Map();
function mapLengthKm(m) {
  if (mapLenCache.has(m.id)) return mapLenCache.get(m.id);
  const R = mulberry32(m.seed);
  let n = 120;
  for (let i = 0; i < m.sections; i++) {
    const t = R();
    if (R() < 0.5) R();
    if (t < 0.22) n += 50 + (40 + R() * 40 | 0);
    else if (t < 0.7) { R(); R(); n += 60 + (30 + R() * 50 | 0); }
    else { R(); n += 195; }
  }
  n += 180 + 70;
  const km = n * SEG * M / 1000;
  mapLenCache.set(m.id, km);
  return km;
}
const zoneNames = (m) => [...new Set((ZONES[m.ground] || []).map((z) => z[1]))];

/* ---- illustrations : une scène par carte, couleurs selon le moment ---- */
function mapArt(m, night) {
  const R = mulberry32(m.seed * 7 + (night ? 3 : 1)), u = m.id + (night ? 'n' : 'j');
  const W = 400, H = 250, HZ = 150, f = (v) => +v.toFixed(1);
  const sky = night ? ['#05050c', '#1a0f2e', '#43203f'] : ['#2f6cc0', '#79b1e2', '#dcebf5'];
  if (!night && m.id === 'ville') sky[2] = '#e6e3df';
  if (night && m.id === 'campagne') sky[2] = '#1d2640';
  if (night && m.id === 'plage') sky[2] = '#3a2448';
  let o = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false"><defs>`
    + `<linearGradient id="s${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky[0]}"/><stop offset=".62" stop-color="${sky[1]}"/><stop offset="1" stop-color="${sky[2]}"/></linearGradient>`
    + `<linearGradient id="r${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${night ? '#1a1b24' : '#5d6068'}"/><stop offset="1" stop-color="${night ? '#0b0c12' : '#3a3c42'}"/></linearGradient>`
    + `<radialGradient id="g${u}" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="${night ? '#fff6d8' : '#fffbe8'}" stop-opacity=".9"/><stop offset="1" stop-color="${night ? '#fff6d8' : '#fff3c4'}" stop-opacity="0"/></radialGradient>`
    + `</defs><rect width="${W}" height="${H}" fill="url(#s${u})"/>`;
  // astres et nuages
  if (night) {
    if (m.id !== 'ville') for (let i = 0; i < 40; i++) o += `<circle cx="${f(R() * W)}" cy="${f(R() * HZ * 0.75)}" r="${f(0.4 + R() * 0.9)}" fill="#fff" opacity="${f(0.4 + R() * 0.6)}"/>`;
    const mx = m.id === 'plage' ? 92 : 318;   // à la plage, la lune se lève au-dessus de la mer
    o += `<circle cx="${mx}" cy="46" r="34" fill="url(#g${u})"/><circle cx="${mx}" cy="46" r="13" fill="#f4f1ff"/><circle cx="${mx + 6}" cy="42" r="11" fill="${sky[0]}" opacity=".35"/>`;
  } else {
    const sy = m.id === 'plage' ? 108 : 52;
    o += `<circle cx="300" cy="${sy}" r="60" fill="url(#g${u})"/><circle cx="300" cy="${sy}" r="17" fill="#fff8e0"/>`;
    for (let i = 0; i < 4; i++) {
      const cx = 30 + R() * 340, cy = 26 + R() * 50, w = 40 + R() * 50;
      o += `<g fill="#fff" opacity=".85"><ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(w / 2)}" ry="9"/><ellipse cx="${f(cx - w * 0.15)}" cy="${f(cy - 7)}" rx="${f(w / 4)}" ry="9"/><ellipse cx="${f(cx + w * 0.15)}" cy="${f(cy - 5)}" rx="${f(w / 5)}" ry="8"/></g>`;
    }
  }
  // décor de fond selon la carte
  const ground = night ? m.art.ground[0] : m.art.ground[1];
  if (m.id === 'ville') {
    const tones = night ? ['#11121c', '#171826', '#0d0e17'] : ['#4a5f7c', '#a3b3c7', '#8b9db4'];
    for (let layer = 0; layer < 2; layer++) {
      let x = -10;
      while (x < W) {
        const w = 18 + R() * 30, h = (layer ? 40 : 70) + R() * (layer ? 50 : 70), y = HZ - h;
        o += `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="${layer ? tones[0] : tones[1 + (R() * 2 | 0)]}"/>`;
        if (layer) for (let wy = y + 6; wy < HZ - 6; wy += 7) for (let wx = x + 4; wx < x + w - 4; wx += 6) {
          if (R() < (night ? 0.42 : 0.25)) o += `<rect x="${f(wx)}" y="${f(wy)}" width="3" height="3.4" fill="${night ? (R() < 0.75 ? '#ffcf7a' : '#7ff0ff') : (R() < 0.8 ? '#c9def2' : '#ffe2a8')}" opacity="${night ? 0.85 : 0.8}"/>`;
        }
        x += w + 2;
      }
      if (!layer) o += `<rect y="${HZ - 70}" width="${W}" height="70" fill="${sky[2]}" opacity="${night ? 0.12 : 0.3}"/>`;
    }
    if (night) {
      o += `<rect x="54" y="96" width="44" height="12" fill="#00E5FF" opacity=".25"/><rect x="54" y="96" width="44" height="12" fill="none" stroke="#00E5FF" stroke-width="2.4"/>`
        + `<rect x="292" y="84" width="10" height="40" fill="#FF6A00" opacity=".25"/><rect x="292" y="84" width="10" height="40" fill="none" stroke="#FF6A00" stroke-width="2.4"/>`;
      for (let i = 0; i < 70; i++) o += `<path d="M${f(R() * W)} ${f(R() * H)}l-3 10" stroke="#9fb8ff" stroke-width=".7" opacity=".35"/>`;
    }
  } else if (m.id === 'plage') {
    o += `<rect y="${HZ - 2}" width="${W}" height="${H - HZ + 2}" fill="${night ? '#0c1a2e' : '#1f86b8'}"/>`;
    for (let i = 0; i < 9; i++) o += `<rect x="${f(R() * W)}" y="${HZ + 3 + i * 3}" width="${f(20 + R() * 50)}" height="1.2" fill="#fff" opacity="${night ? 0.18 : 0.5}"/>`;
    // reflet de la lune : traînée scintillante sur l'eau
    if (night) for (let i = 0; i < 22; i++) { const k = R(), y = HZ + 2 + k * k * 46, w = 3 + k * 22 + R() * 10; o += `<rect x="${f(92 - w / 2 + (R() - 0.5) * (8 + k * 26))}" y="${f(y)}" width="${f(w)}" height="${f(0.8 + k * 1.2)}" fill="#f4f1ff" opacity="${f(0.5 - k * 0.25)}"/>`; }
    o += `<path d="M0 ${HZ + 2}Q40 ${HZ - 18} 90 ${HZ - 8}T180 ${HZ}V${HZ + 4}H0z" fill="${night ? '#141a2a' : '#7e93a0'}" opacity=".9"/>`;
  } else if (m.id === 'campagne') {
    const hl = night ? ['#141c2c', '#101622'] : ['#9ab7a0', '#7fa45a'];
    o += `<path d="M0 ${HZ - 30}Q70 ${HZ - 62} 150 ${HZ - 34}T300 ${HZ - 40}T400 ${HZ - 52}V${HZ}H0z" fill="${hl[0]}"/>`;
    o += `<path d="M0 ${HZ - 8}Q90 ${HZ - 40} 190 ${HZ - 14}T400 ${HZ - 20}V${HZ + 4}H0z" fill="${hl[1]}"/>`;
    for (const [x, y, s] of [[70, HZ - 44, 1], [118, HZ - 38, 0.8], [338, HZ - 50, 1.1]]) {
      const c = night ? '#2a3350' : '#f4f6f8', a = R() * 120;
      o += `<g stroke="${c}" stroke-width="${f(1.4 * s)}" stroke-linecap="round"><path d="M${x} ${y}v${f(-34 * s)}"/>`
        + [0, 120, 240].map((d) => { const r = (a + d) * Math.PI / 180; return `<path d="M${x} ${f(y - 34 * s)}l${f(Math.cos(r) * 16 * s)} ${f(Math.sin(r) * 16 * s)}"/>`; }).join('') + '</g>';
      if (night) o += `<circle cx="${x}" cy="${f(y - 34 * s)}" r="1.6" fill="#FF1F4B"/>`;
    }
    o += `<path d="M250 ${HZ - 14}h22v-10l-11-8-11 8z" fill="${night ? '#1d2232' : '#b5523a'}"/>${night ? `<rect x="257" y="${HZ - 20}" width="4" height="4" fill="#ffcf7a"/>` : ''}`;
  } else {
    const st = night ? '#1b1e2c' : '#c4c9d2';
    o += `<path d="M0 ${HZ - 22}Q120 ${HZ - 46} 260 ${HZ - 28}T400 ${HZ - 34}V${HZ}H0z" fill="${night ? '#10161c' : '#5f8a52'}"/>`;
    o += `<path d="M14 ${HZ}V${HZ - 40}l120 -12V${HZ}z" fill="${st}"/>`;
    for (let r = 0; r < 4; r++) for (let i = 0; i < 22; i++) o += `<rect x="${f(20 + i * 5.2)}" y="${f(HZ - 36 + r * 7 - i * 0.5)}" width="3.2" height="3" fill="${['#e2262b', '#ffd23a', '#2a6fdb', '#f2f4f8'][(R() * 4) | 0]}" opacity="${night ? 0.55 : 0.85}"/>`;
    o += `<path d="M10 ${HZ - 52}l128 -14v5L10 ${HZ - 46}z" fill="${night ? '#2a2e40' : '#e9ecf1'}"/>`;
    if (night) for (const x of [180, 372]) o += `<path d="M${x} ${HZ}V${HZ - 70}" stroke="#2b2f40" stroke-width="2"/><circle cx="${x}" cy="${HZ - 72}" r="22" fill="url(#g${u})" opacity=".8"/><rect x="${x - 8}" y="${HZ - 76}" width="16" height="7" fill="#f8f6e6"/>`;
    // portique de départ
    o += `<path d="M150 ${HZ + 2}V${HZ - 46}M250 ${HZ + 2}V${HZ - 46}" stroke="${night ? '#3a3f55' : '#2d3038'}" stroke-width="3"/><rect x="148" y="${HZ - 52}" width="104" height="11" fill="${night ? '#202434' : '#2d3038'}"/>`;
    for (let i = 0; i < 5; i++) o += `<circle cx="${172 + i * 14}" cy="${HZ - 46.5}" r="3" fill="${night ? '#FF1F4B' : '#5b1020'}"/>`;
  }
  // sol + route en perspective
  if (m.id !== 'plage') o += `<rect y="${HZ}" width="${W}" height="${H - HZ}" fill="${ground}"/>`;
  else o += `<path d="M190 ${HZ}H${W}V${H}H40z" fill="${ground}"/>`;
  if (m.id === 'campagne') for (let i = 1; i < 7; i++) o += `<path d="M0 ${f(HZ + i * i * 2.6)}H${W}" stroke="${night ? '#0e140b' : '#a6c25d'}" stroke-width="${f(0.6 + i * 0.5)}" opacity=".7"/>`;
  const cx = m.id === 'plage' ? 230 : 200, top = 6, bot = 190;
  const at = (t) => [HZ + t * (H - HZ), top + t * (bot - top)];
  o += `<path d="M${cx - top} ${HZ}H${cx + top}L${cx + bot} ${H}H${cx - bot}z" fill="url(#r${u})"/>`;
  if (m.id === 'circuit') {
    for (let i = 0; i < 9; i++) {
      const [y0, w0] = at(Math.pow(i / 9, 2)), [y1, w1] = at(Math.pow((i + 1) / 9, 2)), e0 = 4 + (w0 - top) * 0.12, e1 = 4 + (w1 - top) * 0.12;
      for (const sgn of [-1, 1]) o += `<path d="M${f(cx + sgn * w0)} ${f(y0)}L${f(cx + sgn * (w0 + e0))} ${f(y0)}L${f(cx + sgn * (w1 + e1))} ${f(y1)}L${f(cx + sgn * w1)} ${f(y1)}z" fill="${i % 2 ? '#f2f4f8' : '#e2262b'}"/>`;
    }
  } else {
    o += `<path d="M${cx - top} ${HZ}L${cx - bot} ${H}M${cx + top} ${HZ}L${cx + bot} ${H}" stroke="${night ? '#c9cdda' : '#f2f4f8'}" stroke-width="2" opacity=".8"/>`;
  }
  for (const lane of [-1 / 3, 1 / 3]) for (let i = 0; i < 6; i++) {
    const [y0, w0] = at(Math.pow(i / 6, 2.2)), [y1, w1] = at(Math.pow((i + 0.45) / 6, 2.2));
    o += `<path d="M${f(cx + lane * w0)} ${f(y0)}L${f(cx + lane * w1)} ${f(y1)}" stroke="#f2f4f8" stroke-width="${f(0.6 + (y1 - HZ) / (H - HZ) * 3.4)}" opacity="${night ? 0.6 : 0.85}"/>`;
  }
  // lampadaires en perspective (ville, corniche) : halo et reflet sur la chaussée mouillée la nuit
  if (m.id === 'ville' || m.id === 'plage') for (const t of [0.06, 0.16, 0.34, 0.68]) for (const sgn of (m.id === 'plage' ? [1] : [-1, 1])) {
    const [y, w] = at(t), x = cx + sgn * (w * 1.1 + 3), h = 10 + 110 * t, arm = 4 + 22 * t, hx = x - sgn * arm, hy = y - h;
    o += `<path d="M${f(x)} ${f(y)}V${f(hy)}h${f(-sgn * arm)}" stroke="${night ? '#2c3042' : '#5b6170'}" stroke-width="${f(0.8 + 2.6 * t)}" fill="none"/>`;
    if (night) {
      o += `<circle cx="${f(hx)}" cy="${f(hy + 2)}" r="${f(5 + 26 * t)}" fill="url(#g${u})" opacity=".75"/>`
        + `<ellipse cx="${f(hx)}" cy="${f(y)}" rx="${f(6 + 34 * t)}" ry="${f(1.5 + 7 * t)}" fill="#ffcf7a" opacity="${f(0.14 + 0.1 * t)}"/>`;
    }
    o += `<rect x="${f(hx - 1.5 - 5 * t)}" y="${f(hy)}" width="${f(3 + 10 * t)}" height="${f(1.2 + 2.4 * t)}" fill="${night ? '#fff6d8' : '#3b3f4a'}"/>`;
  }
  if (m.id === 'plage') for (const [x, y, s] of [[352, 170, 1.15], [392, 150, 0.8], [300, HZ + 6, 0.55]]) {
    const c = night ? '#0a0d16' : '#3b5a2c';
    o += `<path d="M${x} ${y}q${f(-4 * s)} ${f(-36 * s)} ${f(6 * s)} ${f(-70 * s)}" stroke="${night ? '#0a0d16' : '#8a6a44'}" stroke-width="${f(3.4 * s)}" fill="none"/>`;
    for (const d of [-160, -120, -70, -25, 15]) {
      const r = d * Math.PI / 180;
      o += `<path d="M${f(x + 6 * s)} ${f(y - 70 * s)}q${f(Math.cos(r) * 14 * s)} ${f(-10 * s)} ${f(Math.cos(r) * 30 * s)} ${f(Math.sin(r) * 18 * s + 12 * s)}" stroke="${c}" stroke-width="${f(3 * s)}" fill="none" stroke-linecap="round"/>`;
    }
  }
  if (night) {
    // reflet néon sur la chaussée mouillée et feux d'une voiture au loin
    o += `<path d="M${cx - 26} ${H}L${cx - 3} ${HZ + 8}h6L${cx + 26} ${H}z" fill="${m.art.accent}" opacity=".14"/>`;
    o += `<circle cx="${cx - 3}" cy="${HZ + 24}" r="14" fill="#FF1F4B" opacity=".16"/><circle cx="${cx - 9}" cy="${HZ + 22}" r="2" fill="#FF1F4B"/><circle cx="${cx + 3}" cy="${HZ + 22}" r="2" fill="#FF1F4B"/>`;
  }
  return o + '</svg>';
}

function mapCard(m) {
  const b = document.createElement('button'); b.className = 'map-card'; b.dataset.id = m.id; b.type = 'button';
  const zones = zoneNames(m), km = '≈ ' + mapLengthKm(m).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' km';
  b.style.setProperty('--map-accent', m.art.accent);
  b.innerHTML = '<span class="map-art"></span><span class="map-shade"></span>'
    + '<span class="map-sel"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4.5 12.5 4.5 4.5L19.5 6.5"/></svg>Choisi</span>'
    + '<span class="map-info"><span class="map-title"></span><span class="map-desc"></span>'
    + '<span class="map-facts"><span class="fact"><span class="label">Longueur</span><b></b></span><span class="fact"><span class="label">Quartiers</span><b></b></span></span>'
    + '<span class="map-zones"></span></span>';
  b.querySelector('.map-title').textContent = m.name;
  b.querySelector('.map-desc').textContent = m.desc;
  const facts = b.querySelectorAll('.fact b');
  facts[0].textContent = km;
  facts[1].textContent = String(zones.length);
  const zl = b.querySelector('.map-zones');
  for (const z of zones) { const c = document.createElement('span'); c.textContent = z; zl.appendChild(c); }
  b.setAttribute('aria-label', `${m.name}. ${m.desc} Environ ${km.slice(2)}. Quartiers : ${zones.join(', ')}.`);
  b.addEventListener('click', () => {
    if (mapDrag.moved) return;
    pickMap(m.id, TOD); scrollToMap(m.id, true);
  });
  return b;
}
let mapArtTod = null, mapScrollLock = 0;
function renderMapUI() {
  $('#mapName').textContent = MAP.name;
  $('#mapDesc').textContent = MAP.desc;
  const grid = $('#mapGrid');
  if (!grid.children.length) {
    for (const m of MAPS) grid.appendChild(mapCard(m));
    for (let i = 0; i < MAPS.length; i++) $('#mapDots').appendChild(document.createElement('i'));
    $('#mapTotal').textContent = String(MAPS.length).padStart(2, '0');
  }
  if (mapArtTod !== TOD) {
    mapArtTod = TOD;
    for (const b of grid.children) b.firstChild.innerHTML = mapArt(mapById(b.dataset.id), TOD === 'nuit');
    screens.mapSel.dataset.tod = TOD;
  }
  const idx = MAPS.indexOf(MAP);
  [...grid.children].forEach((b, i) => {
    b.setAttribute('aria-pressed', String(i === idx));
    b.tabIndex = i === idx ? 0 : -1;   // une seule carte dans l'ordre de tabulation, ← → pour les autres
  });
  [...$('#mapDots').children].forEach((d, i) => d.classList.toggle('on', i === idx));
  $('#mapIdx').textContent = String(idx + 1).padStart(2, '0');
  $('#mapPrev').disabled = idx === 0;
  $('#mapNext').disabled = idx === MAPS.length - 1;
  for (const b of document.querySelectorAll('.tod-btn')) b.setAttribute('aria-pressed', String(b.dataset.tod === TOD));
  $('#mapGo').firstChild.textContent = mapFor === 'solo' ? 'Rouler' : 'Valider';
  $('#mapStep').textContent = mapFor === 'solo' ? 'Étape 2 sur 2 · Terrain' : 'Duel · Terrain du salon';
}
function scrollToMap(id, smooth) {
  const grid = $('#mapGrid'), card = [...grid.children].find((b) => b.dataset.id === id);
  if (!card) return;
  const left = card.offsetLeft - (grid.clientWidth - card.offsetWidth) / 2;
  mapScrollLock = performance.now() + (smooth ? 700 : 80);
  grid.scrollTo({ left, behavior: smooth && !reduceMotion ? 'smooth' : 'auto' });
}
function stepMap(dir) {
  const i = clamp(MAPS.indexOf(MAP) + dir, 0, MAPS.length - 1);
  if (MAPS[i] === MAP) return;
  const onCard = document.activeElement && document.activeElement.classList.contains('map-card');
  pickMap(MAPS[i].id, TOD); scrollToMap(MAP.id, true);
  if (onCard) $('#mapGrid').children[i].focus({ preventScroll: true });
  noiseHit(0.12, 1600, 1.4, 0.2, 500);
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
  scrollToMap(MAP.id, false);
  const cur = [...$('#mapGrid').children].find((b) => b.dataset.id === MAP.id);
  if (cur) cur.focus({ preventScroll: true });
}
/* glisser : la carte la plus proche du centre devient la carte choisie quand le défilement s'arrête */
let mapScrollT = 0;
const mapDrag = { id: null, x: 0, sl: 0, moved: false };
function settleMap() {
  if (screens.mapSel.hidden) return;
  if (performance.now() < mapScrollLock) { mapScrollT = setTimeout(settleMap, 120); return; }
  const grid = $('#mapGrid'), mid = grid.scrollLeft + grid.clientWidth / 2;
  let near = null, bd = Infinity;
  for (const b of grid.children) { const d = Math.abs(b.offsetLeft + b.offsetWidth / 2 - mid); if (d < bd) { bd = d; near = b; } }
  if (near && near.dataset.id !== MAP.id) { pickMap(near.dataset.id, TOD); noiseHit(0.12, 1600, 1.4, 0.2, 500); }
}
const mapGrid = $('#mapGrid');
mapGrid.addEventListener('scroll', () => { clearTimeout(mapScrollT); mapScrollT = setTimeout(settleMap, 140); }, { passive: true });
// souris : on peut aussi attraper le carrousel (le doigt et le pavé tactile le font défiler nativement)
mapGrid.addEventListener('pointerdown', (e) => {
  if (e.pointerType !== 'mouse' || e.button !== 0) return;
  Object.assign(mapDrag, { id: e.pointerId, x: e.clientX, sl: mapGrid.scrollLeft, moved: false });
});
mapGrid.addEventListener('pointermove', (e) => {
  if (mapDrag.id !== e.pointerId) return;
  const dx = e.clientX - mapDrag.x;
  if (!mapDrag.moved && Math.abs(dx) > 6) { mapDrag.moved = true; mapGrid.setPointerCapture(e.pointerId); mapGrid.classList.add('dragging'); }
  if (mapDrag.moved) mapGrid.scrollLeft = mapDrag.sl - dx;
});
const endMapDrag = (e) => {
  if (mapDrag.id !== e.pointerId) return;
  mapDrag.id = null; mapGrid.classList.remove('dragging');
  if (mapDrag.moved) { mapScrollLock = 0; settleMap(); scrollToMap(MAP.id, true); setTimeout(() => { mapDrag.moved = false; }, 0); }
};
mapGrid.addEventListener('pointerup', endMapDrag);
mapGrid.addEventListener('pointercancel', endMapDrag);
$('#mapPrev').addEventListener('click', () => stepMap(-1));
$('#mapNext').addEventListener('click', () => stepMap(1));
addEventListener('resize', () => { if (!screens.mapSel.hidden) scrollToMap(MAP.id, false); });
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
  if (!screens.mapSel.hidden && (e.code === 'ArrowLeft' || e.code === 'ArrowRight')) {
    stepMap(e.code === 'ArrowRight' ? 1 : -1);
    e.preventDefault(); return;
  }
  if (!screens.mapSel.hidden && e.code === 'Escape') { $('#mapBack').click(); e.preventDefault(); return; }
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
/* ---------- Commandes tactiles ----------
   Volant à gauche : on pose le pouce n'importe où dans la moitié gauche et on glisse (valeur analogique touchSteer, -1..1).
   Pédales à droite (frein large, accélérateur allongé) et bouton Nitro rond avec sa jauge.
   Pointer events + capture : chaque doigt garde sa commande, plusieurs doigts à la fois. */
var touchSteer = 0;   // var : aussi lisible comme window.touchSteer
const steerUI = { zone: $('#steerZone'), pad: $('#steerPad'), knob: $('#steerKnob'), fill: $('#steerFill'), id: null, x0: 0, raf: 0, full: false };
const STEER_DEAD = 0.15;
const buzz = (ms) => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* vibration non disponible */ } };
function steerRange() { return Math.max(40, (steerUI.pad.clientWidth - steerUI.knob.offsetWidth) / 2); }
function drawSteer() {
  const s = touchSteer, r = steerRange();
  steerUI.knob.style.transform = `translateX(${(s * r).toFixed(1)}px) rotate(${(s * 110).toFixed(1)}deg)`;
  steerUI.fill.style.transform = `scaleX(${Math.abs(s).toFixed(3)})`;
  steerUI.fill.style.transformOrigin = s < 0 ? '100% 50%' : '0 50%';
  steerUI.fill.parentNode.dataset.side = s < 0 ? 'l' : 'r';
  steerUI.pad.classList.toggle('active', steerUI.id !== null);
}
/* conversion analogique → booléens (update.js ne lit que input.left/right) :
   hors zone morte, on appuie tant que le braquage réel (steer) n'a pas rejoint la consigne, puis on relâche ;
   le volant de la voiture suit ainsi la position du pouce au lieu d'aller toujours en butée. */
function steerTick() {
  const a = Math.abs(touchSteer);
  if (a <= STEER_DEAD) { input.left = false; input.right = false; }
  else {
    const want = Math.min(1, (a - STEER_DEAD) / (0.9 - STEER_DEAD)), cur = touchSteer > 0 ? steer : -steer;
    const push = want >= 0.98 || cur < want - 0.04;
    input.right = touchSteer > 0 && push;
    input.left = touchSteer < 0 && push;
  }
  if (steerUI.id === null && touchSteer === 0) { steerUI.raf = 0; input.left = false; input.right = false; return; }
  steerUI.raf = requestAnimationFrame(steerTick);
}
function setSteer(v) {
  touchSteer = clamp(v, -1, 1);
  const full = Math.abs(touchSteer) > 0.97;
  if (full && !steerUI.full) buzz(6);
  steerUI.full = full;
  drawSteer();
  if (!steerUI.raf) steerUI.raf = requestAnimationFrame(steerTick);
}
steerUI.zone.addEventListener('pointerdown', (e) => {
  if (steerMode === 'fleches' || steerUI.id !== null) return;   // mode flèches : ce sont les boutons qui gèrent
  e.preventDefault();
  steerUI.id = e.pointerId;
  try { steerUI.zone.setPointerCapture(e.pointerId); } catch (err) { /* déjà relâché */ }
  // sur le pavé : le centre du pavé sert de repère ; ailleurs : là où le pouce s'est posé
  const pr = steerUI.pad.getBoundingClientRect();
  const onPad = e.clientX >= pr.left && e.clientX <= pr.right && e.clientY >= pr.top - 24 && e.clientY <= pr.bottom + 24;
  steerUI.x0 = onPad ? pr.left + pr.width / 2 : e.clientX;
  setSteer((e.clientX - steerUI.x0) / steerRange());
  buzz(4);
});
steerUI.zone.addEventListener('pointermove', (e) => {
  if (e.pointerId !== steerUI.id) return;
  const r = steerRange(), dx = e.clientX - steerUI.x0;
  // le repère suit le pouce au-delà de la butée : repartir dans l'autre sens est immédiat
  if (dx > r) steerUI.x0 = e.clientX - r; else if (dx < -r) steerUI.x0 = e.clientX + r;
  setSteer((e.clientX - steerUI.x0) / r);
});
const steerEnd = (e) => { if (e.pointerId !== steerUI.id) return; steerUI.id = null; setSteer(0); };
steerUI.zone.addEventListener('pointerup', steerEnd);
steerUI.zone.addEventListener('pointercancel', steerEnd);
steerUI.zone.addEventListener('lostpointercapture', steerEnd);

const pedals = [...document.querySelectorAll('#touch [data-key]')];
for (const b of pedals) {
  const k = b.dataset.key;
  b.dataset.pid = '';
  const on = (e) => {
    e.preventDefault();
    if (b.dataset.pid) return;
    b.dataset.pid = String(e.pointerId);
    try { b.setPointerCapture(e.pointerId); } catch (err) { /* déjà relâché */ }
    input[k] = true; b.classList.add('down');
    buzz(k === 'nitro' ? (nitro > 0.05 ? 18 : 4) : 9);
  };
  const off = (e) => {
    if (b.dataset.pid !== String(e.pointerId)) return;
    b.dataset.pid = ''; input[k] = false; b.classList.remove('down');
  };
  b.addEventListener('pointerdown', on);
  b.addEventListener('pointerup', off);
  b.addEventListener('pointercancel', off);
  b.addEventListener('lostpointercapture', off);
  b.addEventListener('contextmenu', (e) => e.preventDefault());
  b.addEventListener('click', (e) => e.preventDefault());
}
$('#touch').addEventListener('contextmenu', (e) => e.preventDefault());
/* remet toutes les commandes à zéro (changement d'écran, pause, perte de focus) */
function resetTouch() {
  steerUI.id = null; touchSteer = 0; steerUI.full = false; drawSteer();
  for (const b of pedals) { if (b.dataset.pid) input[b.dataset.key] = false; b.dataset.pid = ''; b.classList.remove('down'); }
}
/* direction au choix : « glisser » (volant analogique) ou « flèches » (deux boutons gauche / droite) */
let steerMode = store('waforspeed-steer') === 'fleches' ? 'fleches' : 'glisser';
function setSteerMode(m) {
  steerMode = m === 'fleches' ? 'fleches' : 'glisser'; store('waforspeed-steer', steerMode);
  resetTouch();
  steerUI.pad.hidden = steerMode === 'fleches'; $('#steerArrows').hidden = steerMode !== 'fleches';
  steerUI.zone.setAttribute('aria-label', steerMode === 'fleches' ? 'Direction : flèches gauche et droite' : 'Volant : glisse le pouce à gauche ou à droite');
  $('#steerModeBtn').firstChild.textContent = 'Direction : ' + (steerMode === 'fleches' ? 'flèches' : 'glisser');
  for (const b of $('#setSteer').children) b.setAttribute('aria-pressed', String(b.dataset.v === steerMode));
}
for (const b of $('#setSteer').children) b.addEventListener('click', () => setSteerMode(b.dataset.v));
$('#steerModeBtn').addEventListener('click', () => setSteerMode(steerMode === 'fleches' ? 'glisser' : 'fleches'));
$('#setSteerRow').hidden = !isTouch;
setSteerMode(steerMode);
// texte d'aide du menu (téléphone) accordé aux nouvelles commandes
{ const help = $('#menu .intro.only-touch'); if (help) help.textContent = 'Pouce gauche : glisse pour tourner. À droite : pédales Gaz et Frein (à l\'arrêt : marche arrière), bouton Nitro.'; }

$('#camBtn').addEventListener('click', (e) => { cycleCamera(); e.currentTarget.blur(); });
$('#camBtn').lastChild.textContent = CAM_MODES[camMode].name;
