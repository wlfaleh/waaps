/* WaForSpeed — Radio : morceaux synthwave originaux (Tone.js) et fichiers audio du joueur. */
'use strict';

/* ================= Musique : radio synthwave (Tone.js) + tes fichiers ================= */
const Music = (() => {
  const T = window.Tone;
  const SCALE = [0, 2, 3, 5, 7, 8, 10];
  const TRACKS = [
    { name: 'Néon Boulevard', bpm: 112, root: 57, prog: [[0, 'm'], [-4, 'M'], [3, 'M'], [-2, 'M']], bass: 'oct8', drums: 'four', race: true,
      mel: ['8 . . . 7 . 5 . . . . . 3 . 5 .', '6 . . . 5 . 3 . . . . . 1 . 3 .', '5 . . . 3 . 5 . 8 . . . 7 . 5 .', '7 . . . . . . . 5 . 6 . 7 . . .'],
      form: [[4, 'pad hat'], [8, 'pad hat kick bass'], [8, 'pad hat kick bass arp snare'], [8, 'pad hat16 kick bass arp snare lead'], [4, 'pad arp'], [8, 'pad hat16 kick bass arp snare lead']], loop: 1 },
    { name: 'Minuit Turbo', bpm: 124, root: 50, prog: [[0, 'm'], [-4, 'M'], [3, 'M'], [-2, 'M']], bass: 'pulse16', drums: 'four', race: true,
      mel: ['5 . 5 . 6 . 5 . 3 . . . 1 . . .', '3 . 3 . 4 . 3 . 1 . . . -1 . . .', '5 . 5 . 7 . 8 . 7 . . . 5 . . .', '4 . 4 . 5 . 4 . 2 . . . 0 . . .'],
      form: [[4, 'hat kick bass'], [8, 'pad hat kick bass snare'], [8, 'pad hat16 kick bass snare arp'], [8, 'pad hat16 kick bass snare arp lead'], [4, 'pad kick bass'], [8, 'pad hat16 kick bass snare arp lead']], loop: 1 },
    { name: 'Pluie Chrome', bpm: 96, root: 52, prog: [[0, 'm'], [-4, 'M'], [3, 'M'], [-2, 'M']], bass: 'half', drums: 'half',
      mel: ['1 . . . . . 3 . 5 . . . . . . .', '6 . . . . . 5 . 3 . . . . . . .', '5 . . . . . 7 . 8 . . . . . . .', '7 . . . . . 4 . 2 . . . . . . .'],
      form: [[4, 'pad'], [8, 'pad hat arp'], [8, 'pad hat kick bass arp snare'], [8, 'pad hat kick bass arp snare lead']], loop: 1 }
  ];
  TRACKS.forEach((tr) => {
    tr.melEvents = tr.mel.map((bar) => {
      const tok = bar.trim().split(/\s+/), ev = [];
      tok.forEach((t, i) => {
        if (t === '.' || t === '-') { if (t === '.' && ev.length && ev[ev.length - 1].end === i) ev[ev.length - 1].end = i + 1; return; }
        const d = parseInt(t, 10) - 1, oct = Math.floor(d / 7), deg = ((d % 7) + 7) % 7;
        ev.push({ step: i, midi: tr.root + 12 + SCALE[deg] + 12 * oct, end: i + 1 });
      });
      return ev;
    });
    tr.formBars = tr.form.reduce((s, f) => s + f[0], 0);
  });
  const playlist = TRACKS.map((t, i) => ({ name: t.name, builtin: i }));
  let N = null, built = false, idx = 2, playing = false, step = 0, curTrack = TRACKS[2], audio = null, vol = (parseInt(store('waforspeed-musicvol') || '70', 10) || 0) / 100, mutedM = false, unlocked = false;
  const listeners = new Set();
  const emit = () => listeners.forEach((f) => f());
  const fq = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const dB = () => (mutedM || vol <= 0.001 ? -Infinity : 20 * Math.log10(vol) - 4);
  function build() {
    if (built || !T) return;
    built = true;
    const master = new T.Volume(dB()).toDestination();
    const limiter = new T.Limiter(-1).connect(master);
    const comp = new T.Compressor({ threshold: -16, ratio: 3, attack: 0.008, release: 0.18 }).connect(limiter);
    const duck = new T.Gain(1).connect(comp);
    const rev = new T.Freeverb({ roomSize: 0.82, dampening: 2600 }); rev.wet.value = 1;
    const revRet = new T.Gain(0.32).connect(comp); rev.connect(revRet);
    const dly = new T.FeedbackDelay('8n.', 0.34); dly.wet.value = 1;
    const dlyRet = new T.Gain(0.22).connect(comp); dly.connect(dlyRet);
    const send = (node, r, d) => { if (r) { const g = new T.Gain(r); node.connect(g); g.connect(rev); } if (d) { const g = new T.Gain(d); node.connect(g); g.connect(dly); } };
    const kick = new T.MembraneSynth({ pitchDecay: 0.045, octaves: 6, envelope: { attack: 0.001, decay: 0.42, sustain: 0, release: 0.1 } });
    kick.connect(new T.Gain(0.95).connect(comp));
    const snare = new T.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.2, sustain: 0 } });
    const snF = new T.Filter(1900, 'bandpass'); snF.Q.value = 0.8;
    const snG = new T.Gain(0.42).connect(comp); snare.connect(snF); snF.connect(snG); send(snF, 0.9, 0);
    const snBody = new T.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.05 } });
    snBody.connect(new T.Gain(0.3).connect(comp));
    const hat = new T.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.045, sustain: 0 } });
    const hatF = new T.Filter(8000, 'highpass'); hat.connect(hatF); hatF.connect(new T.Gain(0.13).connect(comp));
    const bass = new T.MonoSynth({ oscillator: { type: 'sawtooth' }, filter: { Q: 2, type: 'lowpass', rolloff: -24 },
      envelope: { attack: 0.004, decay: 0.2, sustain: 0.45, release: 0.08 }, filterEnvelope: { attack: 0.004, decay: 0.16, sustain: 0.2, release: 0.1, baseFrequency: 110, octaves: 3.4 } });
    bass.connect(new T.Gain(0.38).connect(duck));
    const pad = new T.PolySynth(T.Synth, { oscillator: { type: 'fatsawtooth', count: 3, spread: 28 }, envelope: { attack: 0.5, decay: 0.6, sustain: 0.75, release: 1.6 } });
    const padF = new T.Filter(1500, 'lowpass');
    const chorus = new T.Chorus(2.2, 3.2, 0.55).start();
    pad.connect(padF); padF.connect(chorus);
    const padG = new T.Gain(0.15); chorus.connect(padG); padG.connect(duck); send(padG, 0.8, 0);
    const arp = new T.Synth({ oscillator: { type: 'square' }, envelope: { attack: 0.004, decay: 0.14, sustain: 0.08, release: 0.15 } });
    const arpF = new T.Filter(2800, 'lowpass'); arp.connect(arpF);
    const arpG = new T.Gain(0.06); arpF.connect(arpG); arpG.connect(duck); send(arpG, 0.5, 0.8);
    const lead = new T.MonoSynth({ oscillator: { type: 'fatsawtooth', count: 2, spread: 18 }, portamento: 0.03, filter: { Q: 1, type: 'lowpass' },
      envelope: { attack: 0.02, decay: 0.3, sustain: 0.6, release: 0.35 }, filterEnvelope: { attack: 0.02, decay: 0.4, sustain: 0.5, release: 0.4, baseFrequency: 700, octaves: 2.6 } });
    const leadG = new T.Gain(0.1); lead.connect(leadG); leadG.connect(comp); send(leadG, 0.6, 0.9);
    N = { master, duck, kick, snare, snBody, hat, bass, pad, arp, lead };
    T.Transport.scheduleRepeat(tick, '16n');
  }
  function layersFor(tr, bar) {
    let b = bar;
    if (b >= tr.formBars) {
      const loopStart = tr.form.slice(0, tr.loop).reduce((s, f) => s + f[0], 0);
      b = loopStart + (b - loopStart) % (tr.formBars - loopStart);
    }
    for (const [n, l] of tr.form) { if (b < n) return l; b -= n; }
    return '';
  }
  function chordNotes(tr, bar) {
    const [off, q] = tr.prog[bar % tr.prog.length];
    let r = tr.root + off; while (r < 52) r += 12; while (r > 63) r -= 12;
    return [r, r + (q === 'm' ? 3 : 4), r + 7];
  }
  function tick(time) {
    if (!N || !curTrack) return;
    const tr = curTrack, bar = Math.floor(step / 16), s = step % 16, L = layersFor(tr, bar);
    const has = (k) => (' ' + L + ' ').includes(' ' + k + ' ');
    const sixteenth = 60 / tr.bpm / 4;
    const ch = chordNotes(tr, bar);
    if (has('pad') && s === 0) N.pad.triggerAttackRelease(ch.map(fq), sixteenth * 15.5, time, 0.55);
    const kickSteps = tr.drums === 'half' ? [0, 10] : [0, 4, 8, 12];
    if (has('kick') && kickSteps.includes(s)) {
      N.kick.triggerAttackRelease(46, '8n', time, 0.95);
      N.duck.gain.cancelScheduledValues(time); N.duck.gain.setValueAtTime(0.3, time); N.duck.gain.linearRampToValueAtTime(1, time + sixteenth * 3.2);
    }
    const snSteps = tr.drums === 'half' ? [8] : [4, 12];
    if (has('snare') && snSteps.includes(s)) { N.snare.triggerAttackRelease('16n', time, 0.8); N.snBody.triggerAttackRelease(185, '32n', time, 0.6); }
    if (has('hat16') || has('hat')) {
      const on = has('hat16') ? true : (tr.drums === 'half' ? s % 2 === 0 : s % 4 === 2);
      if (on) N.hat.triggerAttackRelease('32n', time, has('hat16') ? (s % 4 === 2 ? 0.7 : 0.35) : 0.6);
    }
    if (has('bass')) {
      const root = ch[0] - 24 + (ch[0] - 24 < 33 ? 12 : 0);
      if (tr.bass === 'oct8' && s % 2 === 0) N.bass.triggerAttackRelease(fq(s % 4 === 2 ? root + 12 : root), sixteenth * 1.6, time, 0.85);
      else if (tr.bass === 'pulse16') N.bass.triggerAttackRelease(fq(s % 4 === 0 ? root : (s % 8 === 6 ? root + 12 : root)), sixteenth * 0.8, time, s % 4 === 0 ? 0.95 : 0.6);
      else if (tr.bass === 'half' && (s === 0 || s === 10 || s === 12)) N.bass.triggerAttackRelease(fq(root), sixteenth * (s === 0 ? 8 : 2), time, 0.85);
    }
    if (has('arp')) {
      const seq = [0, 1, 2, 3, 4, 3, 2, 1];
      const notes = [ch[0] + 12, ch[1] + 12, ch[2] + 12, ch[0] + 24, ch[1] + 24];
      N.arp.triggerAttackRelease(fq(notes[seq[s % 8]]), sixteenth * 0.9, time, 0.55);
    }
    if (has('lead')) {
      const ev = tr.melEvents[bar % 4].find((e) => e.step === s);
      if (ev) N.lead.triggerAttackRelease(fq(ev.midi), sixteenth * (ev.end - ev.step) * 0.95, time, 0.8);
    }
    step++;
  }
  function stopAll() {
    if (T && built) { T.Transport.stop(); N.pad.releaseAll(); }
    if (audio) { audio.pause(); }
  }
  function play(i) {
    if (!unlocked) { idx = i; emit(); return; }
    stopAll();
    idx = (i + playlist.length) % playlist.length;
    const item = playlist[idx];
    if (item.builtin !== undefined) {
      if (!T) { playing = false; emit(); return; }
      build();
      curTrack = TRACKS[item.builtin];
      step = 0; T.Transport.bpm.value = curTrack.bpm;
      T.Transport.start('+0.05');
      playing = true;
    } else {
      if (!audio) { audio = new Audio(); audio.addEventListener('ended', () => next()); audio.addEventListener('error', () => { msg('Ce fichier ne peut pas être lu par le navigateur.'); next(); }); }
      audio.src = item.url; audio.volume = mutedM ? 0 : vol;
      audio.play().then(() => { playing = true; emit(); }).catch(() => { playing = false; emit(); });
      playing = true;
    }
    emit();
    if (state === 'play' || state === 'count') toast('♪ ' + item.name, '', 'music');
  }
  function next() { play(idx + 1); }
  function prev() { play(idx - 1); }
  function toggle() {
    if (playing) { stopAll(); playing = false; emit(); }
    else play(idx);
  }
  function unlock() {
    if (unlocked) return;
    unlocked = true;
    const go = () => play(idx);
    if (T) T.start().then(go).catch(go); else go();
  }
  function forRace() {
    const item = playlist[idx];
    if (item && item.builtin !== undefined && !TRACKS[item.builtin].race) play(Math.random() < 0.5 ? 0 : 1);
  }
  function setVolume(v) {
    vol = v; store('waforspeed-musicvol', String(Math.round(v * 100)));
    if (N) N.master.volume.value = dB();
    if (audio) audio.volume = mutedM ? 0 : vol;
  }
  function setMuted(m) { mutedM = m; setVolume(vol); }
  function addFiles(files) {
    let added = 0, first = -1;
    for (const f of files) {
      if (!f.type.startsWith('audio/') && !/\.(mp3|m4a|aac|ogg|oga|wav|flac|opus|webm)$/i.test(f.name)) continue;
      playlist.push({ name: f.name.replace(/\.[^.]+$/, '').slice(0, 60), url: URL.createObjectURL(f) });
      if (first < 0) first = playlist.length - 1;
      added++;
    }
    if (added) { unlocked = true; if (T) T.start().catch(() => {}); play(first); msg(added > 1 ? `${added} morceaux ajoutés à ta radio.` : 'Morceau ajouté à ta radio.'); }
    else msg('Aucun fichier audio reconnu. Choisis des fichiers MP3, M4A, OGG ou WAV.');
  }
  return {
    available: !!T, play, next, prev, toggle, unlock, forRace, setVolume, setMuted, addFiles,
    get name() { return playlist[idx] ? playlist[idx].name : ''; }, get playing() { return playing; }, get volume() { return vol; },
    onChange: (f) => listeners.add(f)
  };
})();
let msgTimer = 0;
function msg(text) {
  const el = $('#radioMsg'); el.textContent = text; el.hidden = false;
  clearTimeout(msgTimer); msgTimer = setTimeout(() => { el.hidden = true; }, 3500);
}
