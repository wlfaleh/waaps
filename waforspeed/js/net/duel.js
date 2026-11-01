/* WaForSpeed — Duel en ligne via la capacité « room » des artifacts claude.ai. */
'use strict';

/* ================= Duel en ligne (capacité room) ================= */
let room = null, roomState = 'pending', sub = null, roomCode = null, round = 0, myStatus = 'lobby';
let nick = (store('waforspeed-nick') || '').slice(0, 14);
let advertised = undefined;
const ghosts = new Map();
const pres = (p, k) => (p && p.presence ? p.presence[k] : undefined);
const num = (v, d = 0) => (typeof v === 'number' && isFinite(v) ? v : d);
const cleanName = (n) => (typeof n === 'string' ? n.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 14) : '');
const peerName = (p) => cleanName(pres(p, 'n')) || 'Pilote';
const peerCar = (p) => { const c = pres(p, 'car'); return typeof c === 'string' && CARS.some((x) => x.id === c) ? c : 'golf'; };
const peerPaint = (p) => { const c = pres(p, 'paint'); return typeof c === 'string' && PAINTS.some((x) => x.id === c) ? c : carById(peerCar(p)).paint; };
const others = () => (sub ? sub.peers().filter((p) => !p.sameTab && p.kind === 'viewer') : []);
const CODE_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789';
function hashStr(str) { let h = 2166136261; for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

function initRoom() {
  $('#nick').value = nick;
  const c = window.claude;
  // sur claude.ai : capacité « room » ; ailleurs (GitHub Pages…) : connexion directe P2P
  const p = c && typeof c.use === 'function' ? c.use('room')
    : loadPeerJs().then((ok) => (ok ? makeP2PRoom() : null));
  Promise.resolve(p).catch(() => null).then((r) => {
    room = r || null; roomState = room ? 'ok' : 'none';
    if (room) room.onPeers(renderOpenRooms, () => { roomState = 'none'; renderLobby(); });
    renderLobby();
  });
}
function setNick() { nick = cleanName($('#nick').value) || nick || 'Pilote'; store('waforspeed-nick', nick); }
function advertise() {
  if (!room) return;
  const open = sub && others().length === 0 && myStatus !== 'race' ? roomCode : null;
  const key = open + '|' + nick;
  if (key === advertised) return;
  advertised = key;
  room.presence({ host: open, n: nick || 'Pilote' }).catch(() => {});
}
function renderOpenRooms() {
  const box2 = $('#openRooms'), list = $('#openList');
  if (!room || sub) { box2.hidden = true; return; }
  const open = room.peers().filter((p) => !p.sameTab && typeof pres(p, 'host') === 'string' && /^[a-z0-9]{4}$/.test(pres(p, 'host')));
  list.textContent = '';
  for (const p of open.slice(0, 6)) {
    const b = document.createElement('button');
    b.className = 'btn btn--room';
    b.textContent = `Rejoindre ${peerName(p)}`;
    b.addEventListener('click', () => joinRoom(pres(p, 'host')));
    list.appendChild(b);
  }
  box2.hidden = open.length === 0;
}
let iAmHost = false;
let duelKm = DUEL_KMS.includes(+store('waforspeed-km')) ? +store('waforspeed-km') : 4;
FINISH = duelKm * KM;
function setDuelKm(k, fromHost) {
  if (!DUEL_KMS.includes(k) || myStatus === 'race') return;
  if (sub && !iAmHost && !fromHost) return;
  duelKm = k; FINISH = k * KM;
  if (!fromHost) store('waforspeed-km', String(k));
  if (sub && iAmHost) sub.presence({ km: k }).catch(() => {});
  if (!screens.lobby.hidden) renderLobby();
}
async function joinRoom(code, host = false) {
  if (!room) return;
  setNick();
  code = String(code || '').toLowerCase();
  if (!/^[a-z0-9]{4}$/.test(code)) { lobbyNote('Le code fait 4 caractères, par exemple K7QX.', true); return; }
  lobbyNote('Connexion au salon…');
  try { sub = await room.join('wfs-' + code); } catch (e) {
    sub = null; lobbyNote(e && e.code === 'not_found' ? 'Aucun salon avec ce code. Vérifie les 4 lettres avec ton ami.' : 'Impossible de rejoindre ce salon pour le moment. Réessaie dans quelques secondes.', true); return;
  }
  roomCode = code; round = 0; myStatus = 'lobby'; ghosts.clear(); iAmHost = host;
  sub.presence({ n: nick, st: 'lobby', r: 0, d: 0, x: 0, v: 0, ft: null, car: myCar.id, paint: myPaint().id, host: host || null, map: host ? MAP.id : null, tod: host ? TOD : null, km: host ? duelKm : null }).catch(() => {});
  sub.onPeers(onRoomPeers, () => { lobbyNote('La connexion au salon a été perdue.', true); leaveRoom(); renderLobby(); });
  renderLobby(); renderOpenRooms(); advertise();
}
function createRoom() {
  let code = '';
  for (let i = 0; i < 4; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  joinRoom(code, true);
}
/* le terrain d'un duel est choisi par le créateur du salon */
function hostPeer() { return others().find((p) => pres(p, 'host') === true); }
function followHostMap() {
  if (!sub || iAmHost) return;
  const h = hostPeer(); if (!h) return;
  const id = pres(h, 'map'), tod = pres(h, 'tod'), km = pres(h, 'km');
  if (DUEL_KMS.includes(km) && km !== duelKm && state !== 'play' && state !== 'count') setDuelKm(km, true);
  if (typeof id !== 'string' || !MAPS.some((m) => m.id === id)) return;
  if ((id !== MAP.id || tod !== TOD) && (state === 'menu' || state === 'over')) {
    if (setMap(id, tod)) { const wasOver = state === 'over'; resetRace('menu', 7); if (wasOver) state = 'over'; }
  }
}
function leaveRoom() {
  if (sub) { try { sub.leave(); } catch (e) {} }
  sub = null; roomCode = null; myStatus = 'lobby'; ghosts.clear();
  advertise(); renderOpenRooms();
}
function onRoomPeers(change) {
  if (change && change.left) for (const p of change.left) {
    if (p.sameTab) continue;
    if (state === 'play' || state === 'count') toast(`${peerName(p)} a quitté`, '', 'bad');
  }
  if (myStatus === 'ready') {
    const mx = Math.max(round, ...others().filter((p) => pres(p, 'st') === 'ready').map((p) => num(pres(p, 'r'))));
    if (mx > round) { round = mx; sub.presence({ r: round }).catch(() => {}); }
  }
  followHostMap();
  checkStart();
  if (!screens.lobby.hidden) renderLobby();
  if (!screens.duelOver.hidden) renderDuelResult();
  advertise();
}
function checkStart() {
  if (!sub || myStatus !== 'ready') return;
  const os = others();
  if (!os.length) return;
  const ok = os.every((p) => {
    const st = pres(p, 'st'), r = num(pres(p, 'r'));
    return (st === 'ready' && r === round) || (st === 'race' && r === round + 1);
  });
  if (ok) startDuelRace();
}
function startDuelRace() {
  round += 1; myStatus = 'race'; mode = 'duel';
  audioInit();
  followHostMap();
  resetRace('play', hashStr(roomCode) + Math.imul(round, 977));
  for (const k in input) input[k] = false;
  state = 'count'; myFinish = 0; presenceTimer = 0; raceStartWall = performance.now();
  sub.presence({ st: 'race', r: round, d: 0, x: 0, v: 0, ft: null, car: myCar.id, paint: myPaint().id }).catch(() => {});
  show(null);
  Object.keys(last).forEach((k) => delete last[k]);
  updateHud(); advertise();
}
function sendRacePresence() {
  if (!sub) return;
  sub.presence({ d: Math.round(Math.min(dist, FINISH)), x: Math.round(playerX * 1000) / 1000, v: Math.round(speed), h: Math.round((heading + spinYaw) * 1000) / 1000, b: braking ? 1 : reversing ? 2 : 0 }).catch(() => {});
}
function updateGhosts(dt) {
  if (!sub || mode !== 'duel') { if (ghosts.size) ghosts.clear(); return; }
  const now = Date.now(), seen = new Set();
  for (const p of others()) {
    const st = pres(p, 'st');
    if ((st !== 'race' && st !== 'done') || num(pres(p, 'r')) !== round) continue;
    seen.add(p.peer);
    const v = st === 'race' ? clamp(num(pres(p, 'v')), 0, MAX_SPEED * 1.6) : 0;
    const est = clamp(num(pres(p, 'd')), 0, FINISH) + v * Math.min(0.5, Math.max(0, now - p.updatedAt) / 1000);
    let g = ghosts.get(p.peer);
    if (!g) { g = { rd: est, x: clamp(num(pres(p, 'x')), -2, 2) }; ghosts.set(p.peer, g); }
    g.rd = Math.abs(est - g.rd) > 4000 ? est : g.rd + (est - g.rd) * Math.min(1, dt * 8);
    g.x += (clamp(num(pres(p, 'x')), -2, 2) - g.x) * Math.min(1, dt * 10);
    g.h = clamp(num(pres(p, 'h')), -3.2, 3.2); g.b = num(pres(p, 'b')); g.v = v;
    g.name = peerName(p); g.car = peerCar(p); g.paint = peerPaint(p); g.done = st === 'done'; g.ft = num(pres(p, 'ft'), 0);
  }
  for (const key of [...ghosts.keys()]) if (!seen.has(key)) ghosts.delete(key);
}
function finishDuel() {
  myFinish = raceTime; myStatus = 'done'; state = 'over'; overTimer = 0; dist = Math.max(dist, FINISH);
  if (sub) sub.presence({ st: 'done', ft: Math.round(myFinish * 1000), d: Math.round(FINISH), v: 0 }).catch(() => {});
  beep(880, 0, 0.15); beep(1320, 0.15, 0.15); beep(1760, 0.3, 0.4);
  setTimeout(() => { if (mode === 'duel' && myStatus === 'done') { show('duelOver'); renderDuelResult(); $('#rematchBtn').focus({ preventScroll: true }); } }, 900);
}
function renderDuelResult() {
  const rows = [{ n: (nick || 'Pilote') + ' (toi)', done: true, ft: myFinish * 1000, d: FINISH, me: true }];
  for (const p of others()) {
    const st = pres(p, 'st'), r = num(pres(p, 'r'));
    if (r !== round) continue;
    if (st === 'done') rows.push({ n: peerName(p), done: true, ft: num(pres(p, 'ft'), 9e9), d: FINISH });
    else if (st === 'race') rows.push({ n: peerName(p), done: false, d: clamp(num(pres(p, 'd')), 0, FINISH) });
    else if (st === 'ready' || st === 'lobby') rows.push({ n: peerName(p), done: true, ft: num(pres(p, 'ft'), 9e9), d: FINISH });
  }
  rows.sort((a, b) => (a.done !== b.done ? (a.done ? -1 : 1) : a.done ? a.ft - b.ft : b.d - a.d));
  const rank = rows.findIndex((r) => r.me) + 1;
  const racing = rows.some((r) => !r.done);
  $('#duelTitle').textContent = rows.length === 1 ? 'Arrivé' : rank === 1 ? 'Victoire' : `${rank}e place`;
  $('#duelEyebrow').textContent = rows.length === 1 ? 'Ton adversaire a quitté le duel' : racing ? 'Arrivé · ton adversaire roule encore' : 'Duel terminé';
  $('#duelTime').textContent = fmtTime(myFinish);
  $('#dSpeed').textContent = maxKmh + ' km/h';
  $('#dNear').textContent = String(nearCount);
  const ol = $('#duelResults'); ol.textContent = '';
  const lead = rows[0] && rows[0].done ? rows[0].ft : null;
  rows.forEach((r, i) => {
    const li = document.createElement('li');
    li.className = (r.me ? 'me ' : '') + (i === 0 && r.done ? 'win' : '');
    const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = `${i + 1}. ${r.n}`;
    const tm = document.createElement('span'); tm.className = 'tm';
    if (!r.done) tm.textContent = (r.d * 0.006 / 1000).toFixed(2) + ' km';
    else if (r.ft >= 9e9) tm.textContent = 'Arrivé';
    else tm.textContent = i === 0 || lead === null ? fmtTime(r.ft / 1000) : '+' + ((r.ft - lead) / 1000).toFixed(1) + ' s';
    li.append(nm, tm); ol.appendChild(li);
  });
}
function lobbyNote(text, warn) { const n = $('#lobbyNote'); n.textContent = text; n.classList.toggle('warn', !!warn); }
function renderLobby() {
  const inRoom = !!sub;
  $('#lobbyHome').hidden = inRoom; $('#lobbyRoom').hidden = !inRoom;
  const can = roomState === 'ok';
  $('#createBtn').disabled = !can; $('#joinBtn').disabled = !can;
  $('#lobbyCar').textContent = myCar.name;
  $('#lobbyMap').textContent = MAP.name + ' · ' + (TOD === 'jour' ? 'Jour' : 'Nuit');
  $('#lobbyMapBtn').hidden = !!sub && !iAmHost;
  const hp = sub && !iAmHost ? hostPeer() : null;
  $('#lobbyMapNote').textContent = sub && !iAmHost ? (hp ? 'choisi par ' + peerName(hp) : '') : '';
  const kr = $('#kmRow');
  if (!kr.children.length) for (const k of DUEL_KMS) {
    const b = document.createElement('button'); b.className = 'km-btn'; b.dataset.km = k; b.textContent = k + ' km';
    b.addEventListener('click', () => setDuelKm(k)); kr.appendChild(b);
  }
  for (const b of kr.children) { b.setAttribute('aria-pressed', String(+b.dataset.km === duelKm)); b.disabled = !!sub && !iAmHost; }
  if (!inRoom) {
    if (roomState === 'pending') lobbyNote('Connexion au serveur de jeu…');
    else if (!can) lobbyNote(window.claude ? 'Le duel marche quand la page est ouverte sur claude.ai par des personnes connectées qui ont accès au lien. Ici, seule la course solo est disponible.' : 'Le service de connexion en ligne ne répond pas. Vérifie ta connexion internet puis recharge la page.', true);
    else if (!$('#lobbyNote').classList.contains('warn')) lobbyNote(room && room.p2p ? 'L\'un crée un salon, puis envoie le code à 4 lettres à l\'autre, qui le tape ci-dessus et clique sur Rejoindre.' : 'Chacun ouvre cette page de son côté. L\'un crée un salon, l\'autre le rejoint avec le code.');
    return;
  }
  $('#roomCode').textContent = roomCode.toUpperCase();
  const ul = $('#players'); ul.textContent = '';
  const os = others();
  const addRow = (name, car, st, me) => {
    const li = document.createElement('li');
    li.className = (me ? 'me ' : '') + (st === 'ready' ? 'ready' : '');
    const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = `${name} · ${carById(car).name}`;
    const s2 = document.createElement('span'); s2.className = 'st';
    s2.textContent = st === 'ready' ? 'Prêt' : st === 'race' ? 'En course' : st === 'done' ? 'Arrivé' : 'Pas prêt';
    li.append(nm, s2); ul.appendChild(li);
  };
  addRow((nick || 'Pilote') + ' (toi)', myCar.id, myStatus, true);
  os.forEach((p) => addRow(peerName(p), peerCar(p), pres(p, 'st'), false));
  if (!os.length) {
    const li = document.createElement('li');
    const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = 'En attente d\'un adversaire…';
    li.appendChild(nm); ul.appendChild(li);
  }
  $('#roomNote').textContent = !os.length
    ? `Donne le code ${roomCode.toUpperCase()} à ton adversaire : il ouvre cette page, clique sur Duel en ligne et rejoint ton salon.`
    : os.some((p) => pres(p, 'st') === 'race') ? 'Une course est en cours dans ce salon. Tu partiras avec les autres à la prochaine manche.'
    : `Course de ${duelKm} km avec le même trafic au départ. Le départ est lancé quand tout le monde est prêt.`;
  const rb = $('#readyBtn');
  rb.textContent = myStatus === 'ready' ? 'Annuler' : 'Prêt';
  rb.classList.toggle('btn--ghost', myStatus === 'ready');
}
function setReady(on) {
  if (!sub) return;
  audioInit();
  myStatus = on ? 'ready' : 'lobby';
  if (on) round = Math.max(round, ...others().map((p) => num(pres(p, 'r'))));
  sub.presence({ st: myStatus, r: round, n: nick, car: myCar.id, paint: myPaint().id }).catch(() => {});
  renderLobby(); checkStart();
}
function openLobby() {
  mode = 'solo'; state = 'menu';
  show('lobby'); renderLobby(); renderOpenRooms();
  (sub ? $('#readyBtn') : $('#nick')).focus({ preventScroll: true });
}
$('#duelBtn').addEventListener('click', () => { audioInit(); openLobby(); });
$('#createBtn').addEventListener('click', createRoom);
$('#joinBtn').addEventListener('click', () => joinRoom($('#codeIn').value.trim()));
$('#codeIn').addEventListener('keydown', (e) => { if (e.key === 'Enter') joinRoom($('#codeIn').value.trim()); });
$('#nick').addEventListener('change', () => { setNick(); advertise(); });
$('#lobbyBack').addEventListener('click', toMenu);
$('#lobbyGarage').addEventListener('click', () => openGarage('duel'));
$('#lobbyMapBtn').addEventListener('click', () => openMapSel('duel'));
$('#readyBtn').addEventListener('click', () => setReady(myStatus !== 'ready'));
$('#leaveBtn').addEventListener('click', () => { leaveRoom(); renderLobby(); });
$('#rematchBtn').addEventListener('click', () => {
  if (!sub) { toMenu(); return; }
  state = 'menu'; mode = 'solo'; raceStartWall = 0; resetRace('menu', 7);
  show('lobby'); setReady(true);
});
$('#duelQuit').addEventListener('click', toMenu);
