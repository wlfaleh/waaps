/* WaForSpeed — Duel en ligne hors de claude.ai (par ex. sur GitHub Pages).
   Même interface que la capacité « room » de claude.ai, mais en connexion directe
   entre navigateurs (WebRTC via PeerJS et son service de mise en relation gratuit).
   Le créateur du salon sert de relais : chaque joueur lui envoie sa présence,
   il renvoie la liste complète à tout le monde. */
'use strict';

const PEERJS_URL = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';
function loadPeerJs() {
  if (window.Peer) return Promise.resolve(true);
  return new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = PEERJS_URL; s.async = true;
    s.onload = () => resolve(!!window.Peer);
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
    setTimeout(() => resolve(!!window.Peer), 10000);
  });
}

/* « hall » P2P : pas de liste des salons ouverts (il faut le code) */
function makeP2PRoom() {
  return {
    p2p: true,
    peers: () => [],
    presence: () => Promise.resolve(),
    onPeers: () => () => {},
    join: (name) => joinP2P(name)
  };
}

function joinP2P(name) {
  return new Promise((resolve, reject) => {
    const hubId = 'waforspeed-' + name + '-v1';
    let me = null, myId = null, isHub = false, hubConn = null, settled = false, dead = false;
    let myPresence = {};
    const conns = new Map();          // (hub) id -> connexion
    const table = new Map();          // id -> { presence, updatedAt }
    const listeners = new Set(), errListeners = new Set();
    let snapshot = [];

    const build = () => {
      snapshot = [{ peer: myId, presence: myPresence, updatedAt: Date.now(), isMe: true, sameTab: true, kind: 'viewer', guest: false, by: null }];
      for (const [id, v] of table) if (id !== myId) snapshot.push({ peer: id, presence: v.presence, updatedAt: v.updatedAt, isMe: false, sameTab: false, kind: 'viewer', guest: false, by: null });
      return snapshot;
    };
    const notify = (left = []) => { const ps = build(); for (const f of listeners) f({ peers: ps, joined: [], left, updated: [] }); };
    const fail = (code) => { if (dead) return; dead = true; for (const f of errListeners) f({ code, message: 'connexion perdue' }); };
    const broadcast = () => {
      const list = [[myId, myPresence]];
      for (const [id, v] of table) list.push([id, v.presence]);
      for (const c of conns.values()) if (c.open) c.send({ t: 'all', list });
    };
    let sendTimer = 0;
    const sendMine = () => {
      if (isHub) { broadcast(); return; }
      if (sendTimer) return;
      sendTimer = setTimeout(() => { sendTimer = 0; if (hubConn && hubConn.open) hubConn.send({ t: 'p', presence: myPresence }); }, 30);
    };
    const api = {
      name,
      presence(patch) {
        myPresence = { ...myPresence };
        for (const k in patch) { if (patch[k] === null) delete myPresence[k]; else myPresence[k] = patch[k]; }
        sendMine(); notify();
        return Promise.resolve();
      },
      peers: () => snapshot,
      onPeers(fn, onErr) { listeners.add(fn); if (onErr) errListeners.add(onErr); setTimeout(() => notify(), 0); return () => { listeners.delete(fn); if (onErr) errListeners.delete(onErr); }; },
      emit: () => Promise.resolve(), on: () => () => {},
      connected: () => !dead,
      onConnection: (fn) => { setTimeout(() => fn(!dead), 0); return () => {}; },
      leave() { dead = true; listeners.clear(); errListeners.clear(); try { me && me.destroy(); } catch (e) {} return Promise.resolve(); }
    };
    const done = () => { if (!settled) { settled = true; build(); resolve(api); } };
    const timeout = setTimeout(() => { if (!settled) { settled = true; try { me && me.destroy(); } catch (e) {} reject({ code: 'upstream_error' }); } }, 12000);

    // 1) on essaie de devenir le relais du salon (le premier arrivé l'est)
    const startHub = () => {
      me = new window.Peer(hubId);
      me.on('open', (id) => { myId = id; isHub = true; clearTimeout(timeout); done(); });
      me.on('connection', (c) => {
        c.on('open', () => { conns.set(c.peer, c); broadcast(); });
        c.on('data', (m) => { if (m && m.t === 'p' && m.presence && typeof m.presence === 'object') { table.set(c.peer, { presence: m.presence, updatedAt: Date.now() }); broadcast(); notify(); } });
        const gone = () => { conns.delete(c.peer); const v = table.get(c.peer); table.delete(c.peer); broadcast(); notify(v ? [{ peer: c.peer, presence: v.presence }] : []); };
        c.on('close', gone); c.on('error', gone);
      });
      me.on('error', (e) => {
        if (e && e.type === 'unavailable-id' && !settled) { try { me.destroy(); } catch (x) {} startClient(); return; }
        if (!settled) { settled = true; clearTimeout(timeout); reject({ code: 'upstream_error' }); } else if (e && e.type !== 'peer-unavailable') fail('upstream_error');
      });
      me.on('disconnected', () => { try { me.reconnect(); } catch (x) {} });
    };
    // 2) le salon existe déjà : on se connecte à son relais
    const startClient = () => {
      me = new window.Peer();
      me.on('open', (id) => {
        myId = id;
        hubConn = me.connect(hubId, { reliable: true });
        hubConn.on('open', () => { clearTimeout(timeout); hubConn.send({ t: 'p', presence: myPresence }); done(); });
        hubConn.on('data', (m) => {
          if (!m || m.t !== 'all' || !Array.isArray(m.list)) return;
          const before = new Map(table);
          table.clear();
          const now = Date.now();
          for (const [id, presence] of m.list) {
            if (id === myId || typeof id !== 'string' || !presence || typeof presence !== 'object') continue;
            const old = before.get(id);
            table.set(id, { presence, updatedAt: old && JSON.stringify(old.presence) === JSON.stringify(presence) ? old.updatedAt : now });
          }
          const left = [...before.keys()].filter((id) => !table.has(id)).map((id) => ({ peer: id, presence: before.get(id).presence }));
          notify(left);
        });
        const lost = () => { const left = [...table.entries()].map(([id, v]) => ({ peer: id, presence: v.presence })); table.clear(); notify(left); fail('upstream_error'); };
        hubConn.on('close', lost);
      });
      me.on('error', (e) => { if (!settled) { settled = true; clearTimeout(timeout); reject({ code: e && e.type === 'peer-unavailable' ? 'not_found' : 'upstream_error' }); } });
    };
    startHub();
  });
}
