// Huddle — TV side. Draws everything on one 1920×1080 canvas.
(() => {
  const W = 1920, H = 1080;
  const FONT = '"Nunito","Avenir Next","Segoe UI",system-ui,sans-serif';
  const cv = document.getElementById('screen');
  const ctx = cv.getContext('2d');
  let scale = 1;

  // ---------------- helpers ----------------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
  const pick = arr => arr[(Math.random() * arr.length) | 0];
  const ease = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
  const easeBack = t => { t = clamp(t, 0, 1); const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };

  function rr(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }
  function text(c, s, x, y, size, color = '#33404d', align = 'center', weight = 800, base = 'middle') {
    c.font = `${weight} ${size}px ${FONT}`;
    c.fillStyle = color; c.textAlign = align; c.textBaseline = base;
    c.fillText(s, x, y);
  }
  function outlined(c, s, x, y, size, fill, stroke = '#fff', lw = 10, align = 'center') {
    c.font = `900 ${size}px ${FONT}`;
    c.textAlign = align; c.textBaseline = 'middle';
    c.lineJoin = 'round'; c.lineWidth = lw; c.strokeStyle = stroke;
    c.strokeText(s, x, y); c.fillStyle = fill; c.fillText(s, x, y);
  }
  function shade(hex, amt) { // amt -1..1
    const n = parseInt(hex.slice(1), 16);
    let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    const t = amt < 0 ? 0 : 255, p = Math.abs(amt);
    r = Math.round((t - r) * p + r); g = Math.round((t - g) * p + g); b = Math.round((t - b) * p + b);
    return `rgb(${r},${g},${b})`;
  }
  // Friendly blob avatar
  function avatar(c, p, x, y, r, mood = 'happy', t = 0) {
    const col = p.color || '#999';
    c.save();
    c.translate(x, y);
    c.fillStyle = 'rgba(0,0,0,.12)';
    c.beginPath(); c.ellipse(0, r * 0.95, r * 0.8, r * 0.18, 0, 0, Math.PI * 2); c.fill();
    const g = c.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
    g.addColorStop(0, shade(col, 0.35)); g.addColorStop(1, col);
    c.fillStyle = g;
    c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill();
    const blink = (Math.sin(t * 1.3 + (p.slot || 0) * 2.1) > 0.985) ? 0.15 : 1;
    const ex = r * 0.34, ey = -r * 0.12, er = r * 0.2;
    for (const s of [-1, 1]) {
      c.fillStyle = '#fff';
      c.beginPath(); c.ellipse(s * ex, ey, er, er * 1.15 * blink, 0, 0, Math.PI * 2); c.fill();
      if (mood !== 'ko') {
        c.fillStyle = '#1e2630';
        c.beginPath(); c.arc(s * ex + er * 0.15, ey + er * 0.1, er * 0.5 * Math.max(blink, .3), 0, Math.PI * 2); c.fill();
      } else {
        c.strokeStyle = '#1e2630'; c.lineWidth = r * 0.07;
        c.beginPath(); c.moveTo(s * ex - er * .5, ey - er * .5); c.lineTo(s * ex + er * .5, ey + er * .5);
        c.moveTo(s * ex + er * .5, ey - er * .5); c.lineTo(s * ex - er * .5, ey + er * .5); c.stroke();
      }
    }
    c.strokeStyle = '#1e2630'; c.lineWidth = r * 0.08; c.lineCap = 'round';
    c.beginPath();
    if (mood === 'happy') c.arc(0, r * 0.22, r * 0.28, 0.15 * Math.PI, 0.85 * Math.PI);
    else if (mood === 'sad' || mood === 'ko') c.arc(0, r * 0.55, r * 0.22, 1.2 * Math.PI, 1.8 * Math.PI);
    else if (mood === 'shock') { c.ellipse(0, r * 0.38, r * 0.12, r * 0.16, 0, 0, Math.PI * 2); }
    else { c.moveTo(-r * 0.18, r * 0.35); c.lineTo(r * 0.18, r * 0.35); }
    c.stroke();
    c.restore();
  }

  // ---------------- sound (all synthesised) ----------------
  const Sound = {
    ac: null, master: null, sfxGain: null, musicGain: null, sfxOn: true, musicOn: true,
    init() {
      if (this.ac) { this.ac.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ac = new AC();
      this.master = this.ac.createGain(); this.master.gain.value = 0.7; this.master.connect(this.ac.destination);
      this.sfxGain = this.ac.createGain(); this.sfxGain.connect(this.master);
      this.musicGain = this.ac.createGain(); this.musicGain.gain.value = 0; this.musicGain.connect(this.master);
      const len = this.ac.sampleRate * 2;
      this.noiseBuf = this.ac.createBuffer(1, len, this.ac.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      Music.start();
    },
    tone(freq, dur, o = {}) {
      if (!this.ac || !this.sfxOn) return;
      const t = this.ac.currentTime + (o.delay || 0);
      const osc = this.ac.createOscillator(), g = this.ac.createGain();
      osc.type = o.type || 'sine';
      osc.frequency.setValueAtTime(freq, t);
      if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + dur);
      const v = o.vol == null ? 0.25 : o.vol;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(v, t + (o.attack || 0.006));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g); g.connect(o.dest || this.sfxGain);
      osc.start(t); osc.stop(t + dur + 0.05);
    },
    noise(dur, o = {}) {
      if (!this.ac || !this.sfxOn) return;
      const t = this.ac.currentTime + (o.delay || 0);
      const src = this.ac.createBufferSource(); src.buffer = this.noiseBuf;
      src.playbackRate.value = o.rate || 1;
      const f = this.ac.createBiquadFilter(); f.type = o.filter || 'bandpass'; f.frequency.value = o.freq || 1500; f.Q.value = o.q || 1;
      if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + dur);
      const g = this.ac.createGain(); const v = o.vol == null ? 0.3 : o.vol;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + (o.attack || 0.005));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f); f.connect(g); g.connect(this.sfxGain);
      src.start(t, Math.random()); src.stop(t + dur + 0.05);
    },
    loop(freq = 300) { // continuous filtered noise, e.g. a rolling ball
      if (!this.ac) return { set() {}, stop() {} };
      const src = this.ac.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
      const f = this.ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
      const g = this.ac.createGain(); g.gain.value = 0;
      src.connect(f); f.connect(g); g.connect(this.sfxGain); src.start();
      return {
        set: (v, fq) => { g.gain.setTargetAtTime(this.sfxOn ? v : 0, this.ac.currentTime, 0.05); if (fq) f.frequency.setTargetAtTime(fq, this.ac.currentTime, 0.05); },
        stop: () => { try { g.gain.setTargetAtTime(0, this.ac.currentTime, 0.05); src.stop(this.ac.currentTime + 0.3); } catch {} },
      };
    },
    play(name) {
      const T = this;
      switch (name) {
        case 'hover': T.tone(2200, 0.035, { vol: 0.05 }); break;
        case 'click': T.tone(880, 0.08, { vol: 0.18, type: 'triangle' }); T.tone(1320, 0.12, { vol: 0.14, type: 'triangle', delay: 0.05 }); break;
        case 'back': T.tone(700, 0.08, { vol: 0.16, type: 'triangle' }); T.tone(470, 0.12, { vol: 0.14, type: 'triangle', delay: 0.06 }); break;
        case 'open': [523, 659, 784].forEach((f, i) => T.tone(f, 0.18, { vol: 0.13, type: 'triangle', delay: i * 0.05 })); break;
        case 'start': [523, 659, 784, 1047].forEach((f, i) => T.tone(f, 0.25, { vol: 0.16, type: 'triangle', delay: i * 0.07 })); break;
        case 'join': T.tone(660, 0.1, { vol: 0.15, type: 'triangle' }); T.tone(990, 0.16, { vol: 0.15, type: 'triangle', delay: 0.08 }); break;
        case 'leave': T.tone(500, 0.12, { vol: 0.12, type: 'triangle' }); T.tone(330, 0.18, { vol: 0.12, type: 'triangle', delay: 0.08 }); break;
        case 'pop': T.noise(0.09, { freq: 2500, vol: 0.45, q: 0.8 }); T.tone(900, 0.1, { to: 250, vol: 0.12 }); break;
        case 'gold': T.noise(0.08, { freq: 3000, vol: 0.35 }); [1319, 1568, 2093].forEach((f, i) => T.tone(f, 0.15, { vol: 0.1, delay: i * 0.05 })); break;
        case 'bad': T.tone(220, 0.35, { type: 'sawtooth', vol: 0.12, to: 90 }); break;
        case 'miss': T.noise(0.05, { freq: 800, vol: 0.08 }); break;
        case 'tick': T.tone(1000, 0.05, { type: 'square', vol: 0.06 }); break;
        case 'tock': T.tone(700, 0.05, { type: 'square', vol: 0.06 }); break;
        case 'count': T.tone(660, 0.18, { type: 'square', vol: 0.09 }); break;
        case 'go': T.tone(1320, 0.45, { type: 'square', vol: 0.1 }); break;
        case 'step': T.noise(0.03, { freq: 600, vol: 0.06 }); break;
        case 'bang': T.noise(0.5, { filter: 'lowpass', freq: 3000, to: 200, vol: 0.9 }); T.tone(120, 0.3, { to: 40, vol: 0.4 }); break;
        case 'boom': T.noise(1.4, { filter: 'lowpass', freq: 1800, to: 60, vol: 1, rate: 0.6 }); T.tone(80, 0.9, { to: 30, vol: 0.6 }); break;
        case 'whoosh': T.noise(0.35, { freq: 400, to: 2400, vol: 0.2, q: 2 }); break;
        case 'catch': T.tone(300, 0.08, { vol: 0.2, type: 'triangle' }); break;
        case 'pins': T.noise(0.4, { freq: 2600, vol: 0.5, q: 0.6 }); for (let i = 0; i < 6; i++) T.tone(rand(1400, 2600), 0.06, { type: 'square', vol: 0.05, delay: rand(0.2) }); break;
        case 'clack': T.tone(rand(1500, 2400), 0.04, { type: 'square', vol: 0.04 }); break;
        case 'gutter': T.noise(0.25, { filter: 'lowpass', freq: 300, vol: 0.4 }); break;
        case 'strike': [784, 988, 1175, 1568].forEach((f, i) => T.tone(f, 0.3, { vol: 0.16, type: 'square', delay: i * 0.09 })); T.tone(2093, 0.6, { vol: 0.12, type: 'triangle', delay: 0.36 }); break;
        case 'spare': [659, 880, 1319].forEach((f, i) => T.tone(f, 0.25, { vol: 0.14, type: 'triangle', delay: i * 0.08 })); break;
        case 'win': [523, 523, 659, 784, 659, 784, 1047].forEach((f, i) => T.tone(f, i === 6 ? 0.7 : 0.16, { vol: 0.15, type: 'square', delay: [0, .12, .24, .36, .54, .66, .84][i] })); break;
        case 'heart': T.tone(70, 0.12, { vol: 0.35 }); T.tone(60, 0.14, { vol: 0.3, delay: 0.16 }); break;
      }
    },
  };

  // Gentle original menu loop: soft electric-piano arpeggios over a slow chord cycle.
  const Music = {
    timer: null, step: 0, nextT: 0, target: 0,
    chords: [[60, 64, 67, 71], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 67], [52, 55, 59, 64], [57, 60, 64, 69], [50, 53, 57, 60], [55, 59, 62, 65]],
    pattern: [0, 2, 1, 3, 2, 1, 3, 2],
    start() {
      if (this.timer) return;
      this.nextT = Sound.ac.currentTime + 0.1;
      this.timer = setInterval(() => this.sched(), 40);
    },
    set(on) { this.target = on && Sound.musicOn ? 0.16 : 0; if (Sound.musicGain) Sound.musicGain.gain.setTargetAtTime(this.target, Sound.ac.currentTime, 0.4); },
    note(midi, t, dur, vol) {
      const ac = Sound.ac, f = 440 * Math.pow(2, (midi - 69) / 12);
      const o1 = ac.createOscillator(), o2 = ac.createOscillator(), g = ac.createGain();
      o1.type = 'sine'; o2.type = 'triangle'; o1.frequency.value = f; o2.frequency.value = f * 2.001;
      const g2 = ac.createGain(); g2.gain.value = 0.18;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o1.connect(g); o2.connect(g2); g2.connect(g); g.connect(Sound.musicGain);
      o1.start(t); o2.start(t); o1.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
    },
    sched() {
      const ac = Sound.ac; if (!ac) return;
      const spb = 60 / 96 / 2; // eighth notes at 96 bpm
      while (this.nextT < ac.currentTime + 0.2) {
        if (this.target > 0) {
          const bar = Math.floor(this.step / 8) % this.chords.length, ch = this.chords[bar], s = this.step % 8;
          const n = ch[this.pattern[s]] + 12;
          this.note(n, this.nextT, 0.6, 0.35);
          if (s === 0) { this.note(ch[0] - 12, this.nextT, 1.8, 0.4); this.note(ch[2], this.nextT, 1.6, 0.12); }
          if (s === 4 && Math.random() < 0.5) this.note(ch[1] + 24, this.nextT + spb / 2, 0.4, 0.12);
        }
        this.nextT += spb; this.step++;
      }
    },
  };

  // ---------------- players & network ----------------
  const players = new Map(); // id -> player
  const roster = () => [...players.values()].filter(p => p.connected).sort((a, b) => a.slot - b.slot);
  let padMode = { mode: 'pointer', hint: 'Point at the screen and press A' };
  const padOverride = new Map(); // id -> mode msg

  const Net = {
    ws: null,
    connect() {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(`${proto}://${location.host}/ws?role=host`);
      this.ws = ws;
      ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch { return; } this.handle(m); };
      ws.onclose = () => setTimeout(() => this.connect(), 1000);
    },
    to(id, m) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify({ t: 'to', id, m })); },
    handle(m) {
      if (m.t === 'list') m.pads.forEach(p => upsert(p, true));
      else if (m.t === 'join') upsert(m, false);
      else if (m.t === 'leave') { const p = players.get(m.id); if (p) { p.connected = false; toast(`${p.name} disconnected`, p.color); Sound.play('leave'); } }
      else if (m.t === 'gone') players.delete(m.id);
      else if (m.t === 'in') { const p = players.get(m.id); if (p) input(p, m.m); }
    },
  };
  function upsert(info, quiet) {
    let p = players.get(info.id);
    const isNew = !p, wasOff = p && !p.connected;
    if (!p) { p = { id: info.id, cx: W / 2 + rand(-120, 120), cy: H / 2 + rand(-80, 80), lastMove: now(), hoverId: null, a: false }; players.set(info.id, p); }
    Object.assign(p, { slot: info.slot, name: info.name, color: info.color, connected: true });
    sendMode(p);
    if (!quiet && (isNew || wasOff)) { toast(`${p.name} joined`, p.color); Sound.play('join'); buzz(p.id, 60); }
  }
  function sendMode(p) { Net.to(p.id, Object.assign({ t: 'mode' }, padOverride.get(p.id) || padMode)); }
  function setMode(mode, hint, ids, extra = {}) {
    const msg = Object.assign({ mode, hint }, extra);
    if (!ids) { padMode = msg; padOverride.clear(); roster().forEach(sendMode); }
    else [].concat(ids).forEach(id => { padOverride.set(id, msg); const p = players.get(id); if (p) sendMode(p); });
  }
  const buzz = (id, ms = 30, flash = false) => Net.to(id, { t: 'buzz', ms, flash });

  // ---------------- immediate-mode UI ----------------
  let hits = [], frameHits = [];
  const mouse = { x: -100, y: -100, last: -1e9 };
  function hitAt(x, y) {
    for (let i = hits.length - 1; i >= 0; i--) { const h = hits[i]; if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) return h; }
    return null;
  }
  const hovered = new Set();
  function region(id, x, y, w, h, onClick, opt = {}) { frameHits.push({ id, x, y, w, h, onClick, disabled: opt.disabled }); return hovered.has(id) && !opt.disabled; }
  function button(id, x, y, w, h, label, onClick, opt = {}) {
    const hov = region(id, x, y, w, h, onClick, opt);
    const a = hoverAnim(id, hov);
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2); ctx.scale(1 + a * 0.05, 1 + a * 0.05); ctx.translate(-w / 2, -h / 2);
    ctx.shadowColor = hov ? 'rgba(52,170,255,.55)' : 'rgba(0,0,0,.12)'; ctx.shadowBlur = hov ? 28 : 12; ctx.shadowOffsetY = hov ? 0 : 4;
    rr(ctx, 0, 0, w, h, h / 2);
    const g = ctx.createLinearGradient(0, 0, 0, h);
    if (opt.primary && !opt.disabled) { g.addColorStop(0, '#5cc1ff'); g.addColorStop(1, '#2f8cff'); }
    else { g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#e7edf3'); }
    ctx.fillStyle = g; ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.lineWidth = 4; ctx.strokeStyle = hov ? '#34aaff' : (opt.primary ? '#2f8cff' : '#c9d3dd'); ctx.stroke();
    text(ctx, label, w / 2, h / 2 + 2, opt.size || 40, opt.disabled ? '#a7b2bd' : (opt.primary ? '#fff' : '#4a5866'), 'center', 900);
    ctx.restore();
    return hov;
  }
  const hoverState = new Map();
  function hoverAnim(id, on) {
    const v = lerp(hoverState.get(id) || 0, on ? 1 : 0, 0.25);
    hoverState.set(id, v); return v;
  }
  function cursors() {
    const list = [];
    if (state !== 'game' || paused || (current && current.showCursors)) roster().forEach(p => list.push(p));
    if (now() - mouse.last < 4000) list.push(mouse);
    return list;
  }
  function updateHover() {
    hovered.clear();
    for (const c of cursors()) {
      const h = hitAt(c.cx ?? c.x, c.cy ?? c.y);
      const hid = h && !h.disabled ? h.id : null;
      if (hid) hovered.add(hid);
      if (hid !== c.hoverId) { c.hoverId = hid; if (hid) { Sound.play('hover'); if (c.id) buzz(c.id, 12); } }
    }
  }
  function clickAt(x, y) {
    const h = hitAt(x, y);
    if (h && !h.disabled && h.onClick) { h.onClick(); return true; }
    return false;
  }

  // ---------------- state ----------------
  const games = [];
  let state = 'splash', paused = false, current = null, currentDef = null, lastRoster = [];
  let stateT = 0, results = null, preview = null, toastList = [];
  let info = { joinUrl: '', qrImg: null };
  const now = () => performance.now();
  let T = 0;

  function toast(msg, color = '#2f8cff') { toastList.push({ msg, color, t: 0 }); if (toastList.length > 4) toastList.shift(); }

  function go(s) {
    state = s; stateT = 0; paused = false;
    if (s === 'menu' || s === 'preview' || s === 'players' || s === 'settings' || s === 'results') {
      Music.set(s !== 'results');
      setMode('pointer', s === 'results' ? 'Point and press A to continue' : 'Point at the screen and press A');
    }
  }

  function startGame(def) {
    const list = roster();
    if (list.length < (def.minPlayers || 1)) return;
    Sound.play('start');
    Music.set(false);
    currentDef = def; lastRoster = list;
    state = 'game'; stateT = 0; paused = false;
    current = def.create(makeApi(def), list.slice());
  }
  function endGame(res, opt = {}) {
    if (current && current.destroy) current.destroy();
    current = null;
    // assign ranks (ties share a rank)
    let rank = 0, prev = null;
    res.forEach((r, i) => { if (prev === null || r.score !== prev) rank = i + 1; r.rank = rank; prev = r.score; });
    results = { def: currentDef, rows: res, title: opt.title || 'Results' };
    go('results');
    Sound.play('win');
  }
  function quitGame() {
    if (current && current.destroy) current.destroy();
    current = null; go('menu'); Sound.play('back');
  }
  function makeApi(def) {
    return {
      W, H, FONT, ctx, Sound, sfx: n => Sound.play(n), setMode, buzz, toast,
      end: (res, opt) => endGame(res, opt),
      helpers: { clamp, lerp, rand, pick, ease, easeBack, rr, text, outlined, shade, avatar },
      get time() { return T; },
    };
  }

  // ---------------- input ----------------
  function input(p, m) {
    if (m.t === 'p') {
      p.cx = clamp(p.cx + m.dx, 0, W); p.cy = clamp(p.cy + m.dy, 0, H); p.lastMove = now();
    }
    if (m.t === 'btn') {
      if (m.b === 'a') p.a = m.d;
      if (m.d) p.lastMove = now();
    }
    // Home button pauses any game
    if (m.t === 'btn' && m.b === 'home' && m.d) {
      if (state === 'game') {
        paused = !paused; Sound.play(paused ? 'open' : 'back');
        if (paused) setMode('pointer', 'Paused — point and press A'); else restoreGameModes();
        return;
      }
      if (state !== 'menu' && state !== 'splash') { Sound.play('back'); go('menu'); return; }
    }
    if (state === 'game' && !paused) {
      if (current && current.input && lastRoster.includes(p)) current.input(p, m);
      return;
    }
    if (m.t === 'btn' && m.d && m.b === 'a') {
      if (state === 'splash') { begin(); return; }
      clickAt(p.cx, p.cy);
    }
    if (m.t === 'btn' && m.d && m.b === 'b') {
      if (paused) { paused = false; Sound.play('back'); restoreGameModes(); }
      else if (state === 'preview' || state === 'players' || state === 'settings') { Sound.play('back'); go('menu'); }
    }
  }
  // After unpausing, games re-send their controller modes
  let savedModes = null;
  function restoreGameModes() {
    if (savedModes) { padMode = savedModes.mode; padOverride.clear(); savedModes.over.forEach((v, k) => padOverride.set(k, v)); roster().forEach(sendMode); }
  }
  const _setMode = setMode;

  cv.addEventListener('mousemove', e => {
    const r = cv.getBoundingClientRect();
    mouse.x = (e.clientX - r.left) / r.width * W; mouse.y = (e.clientY - r.top) / r.height * H; mouse.last = now();
  });
  cv.addEventListener('mousedown', e => {
    mouse.last = now();
    if (state === 'splash') return begin();
    if (state === 'game' && !paused) return;
    clickAt(mouse.x, mouse.y);
  });
  addEventListener('keydown', e => {
    if (state === 'splash') return begin();
    if (e.code === 'KeyF') toggleFullscreen();
    if (e.code === 'Escape' || e.code === 'Backspace') {
      if (state === 'game') { paused = !paused; if (!paused) restoreGameModes(); }
      else if (state !== 'menu') go('menu');
    }
  });
  function toggleFullscreen() {
    try { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen(); } catch {}
  }
  function begin() {
    Sound.init();
    try { if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {}); } catch {}
    Sound.play('open');
    go('menu');
  }

  // ---------------- drawing: shared backdrop ----------------
  function backdrop(t) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#fbfcfe'); g.addColorStop(1, '#e4eaf1');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // slow drifting soft shapes
    ctx.save(); ctx.globalAlpha = 0.5;
    for (let i = 0; i < 5; i++) {
      const x = (i * 470 + t * 12 * (i % 2 ? 1 : -1)) % (W + 600) - 300;
      const y = 200 + i * 150 + Math.sin(t * 0.3 + i) * 30;
      const rg = ctx.createRadialGradient(x, y, 0, x, y, 340);
      rg.addColorStop(0, ['#dff1ff', '#efe6ff', '#e2fbef', '#fff1df', '#ffe6f2'][i]); rg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = rg; ctx.fillRect(x - 340, y - 340, 680, 680);
    }
    ctx.restore();
    // fine scan lines
    ctx.fillStyle = 'rgba(120,140,160,0.035)';
    for (let y = 0; y < H; y += 6) ctx.fillRect(0, y, W, 2);
  }

  // ---------------- menu ----------------
  const COLS = 4, ROWS = 3, TW = 390, TH = 220, GAP = 30;
  const GX = (W - (COLS * TW + (COLS - 1) * GAP)) / 2, GY = 64;
  const tileRect = i => ({ x: GX + (i % COLS) * (TW + GAP), y: GY + Math.floor(i / COLS) * (TH + GAP), w: TW, h: TH });
  const utilTiles = [
    { util: 'players', name: 'Players', preview: previewPlayers },
    { util: 'settings', name: 'Settings', preview: previewSettings },
  ];
  function menuTiles() { const list = [...games, ...utilTiles]; while (list.length < COLS * ROWS) list.push(null); return list; }

  function drawTile(i, tile, t) {
    const r = tileRect(i), id = 'tile' + i;
    const hov = tile ? region(id, r.x, r.y, r.w, r.h, () => openTile(tile, i)) : false;
    const a = hoverAnim(id, hov);
    ctx.save();
    ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
    const s = 1 + a * 0.07; ctx.scale(s, s);
    ctx.translate(-r.w / 2, -r.h / 2);
    ctx.shadowColor = a > 0.05 ? `rgba(52,170,255,${0.6 * a})` : 'rgba(0,0,0,.10)';
    ctx.shadowBlur = 14 + a * 30; ctx.shadowOffsetY = 4 * (1 - a);
    rr(ctx, 0, 0, r.w, r.h, 30);
    ctx.fillStyle = tile ? '#fff' : 'rgba(255,255,255,.55)'; ctx.fill();
    ctx.shadowColor = 'transparent';
    if (tile) {
      ctx.save(); rr(ctx, 6, 6, r.w - 12, r.h - 12, 25); ctx.clip();
      tile.preview(ctx, r.w - 12, r.h - 12, t, 6);
      ctx.restore();
      // glossy top sheen
      ctx.save(); rr(ctx, 6, 6, r.w - 12, r.h - 12, 25); ctx.clip();
      const sg = ctx.createLinearGradient(0, 0, 0, r.h * 0.5);
      sg.addColorStop(0, 'rgba(255,255,255,.35)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = sg; ctx.fillRect(0, 0, r.w, r.h * 0.5); ctx.restore();
      outlined(ctx, tile.name, r.w / 2, r.h - 32, 34, '#3a4654', 'rgba(255,255,255,.95)', 9);
    } else {
      ctx.save(); rr(ctx, 6, 6, r.w - 12, r.h - 12, 25); ctx.clip();
      const sx = ((t * 120 + i * 90) % (r.w * 3)) - r.w;
      const sg = ctx.createLinearGradient(sx, 0, sx + 140, r.h);
      sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.5, 'rgba(255,255,255,.8)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = '#e9eef3'; ctx.fillRect(0, 0, r.w, r.h);
      ctx.fillStyle = sg; ctx.fillRect(0, 0, r.w, r.h); ctx.restore();
    }
    rr(ctx, 0, 0, r.w, r.h, 30);
    ctx.lineWidth = 4 + a * 2; ctx.strokeStyle = a > 0.05 ? `rgba(52,170,255,${0.4 + a * 0.6})` : '#cfd8e1'; ctx.stroke();
    ctx.restore();
  }
  function openTile(tile, i) {
    Sound.play('open');
    if (tile.util) { go(tile.util); return; }
    preview = { def: tile, from: tileRect(i) };
    go('preview');
  }

  function drawDock(t) {
    const y0 = 820;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, y0 + 30);
    ctx.bezierCurveTo(500, y0 + 30, 600, y0 - 10, W / 2, y0 - 10);
    ctx.bezierCurveTo(W - 600, y0 - 10, W - 500, y0 + 30, W, y0 + 30);
    ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
    const g = ctx.createLinearGradient(0, y0, 0, H);
    g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#dde4ec');
    ctx.fillStyle = g;
    ctx.shadowColor = 'rgba(0,0,0,.08)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = -6;
    ctx.fill(); ctx.shadowColor = 'transparent';
    ctx.lineWidth = 3; ctx.strokeStyle = '#c3ced9'; ctx.stroke();
    ctx.restore();

    // clock
    const d = new Date();
    const hh = d.getHours(), mm = String(d.getMinutes()).padStart(2, '0');
    const blink = Math.floor(t * 1) % 2 === 0;
    text(ctx, `${hh}${blink ? ':' : ' '}${mm}`, W / 2, y0 + 95, 104, '#8994a1', 'center', 800);
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    text(ctx, `${days[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`, W / 2, y0 + 185, 40, '#9aa5b1', 'center', 800);

    // join card (left)
    const qx = 54, qy = y0 + 50, qs = 190;
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.12)'; ctx.shadowBlur = 16;
    rr(ctx, qx, qy, qs, qs, 20); ctx.fillStyle = '#fff'; ctx.fill(); ctx.restore();
    if (info.qrImg) ctx.drawImage(info.qrImg, qx + 10, qy + 10, qs - 20, qs - 20);
    text(ctx, 'Scan to join', qx + qs + 24, qy + 46, 38, '#4a5866', 'left', 900);
    text(ctx, 'with your phone camera', qx + qs + 24, qy + 92, 26, '#8994a1', 'left', 700);
    text(ctx, info.joinUrl.replace(/^https?:\/\//, ''), qx + qs + 24, qy + 136, 24, '#2f8cff', 'left', 800);

    // players (right)
    const list = roster();
    const px0 = W - 70;
    if (!list.length) {
      text(ctx, 'No players yet', px0, y0 + 110, 34, '#a0abb6', 'right', 800);
      text(ctx, 'Up to 8 phones can join', px0, y0 + 152, 26, '#b3bcc6', 'right', 700);
    }
    list.forEach((p, i) => {
      const row = i < 4 ? 0 : 1, col = i % 4;
      const x = px0 - 40 - col * 104, y = y0 + 95 + row * 110;
      avatar(ctx, p, x, y - 8, 36, 'happy', t);
      text(ctx, p.name.length > 8 ? p.name.slice(0, 7) + '…' : p.name, x, y + 46, 20, '#5a6876', 'center', 800);
    });
  }

  function drawMenu(t) {
    backdrop(t);
    menuTiles().forEach((tile, i) => drawTile(i, tile, t));
    drawDock(t);
  }

  // ---------------- preview (game info) ----------------
  function drawPreview(t) {
    const def = preview.def;
    const k = ease(stateT / 0.4);
    backdrop(t);
    const to = { x: 60, y: 46, w: W - 120, h: 650 };
    const f = preview.from;
    const r = { x: lerp(f.x, to.x, k), y: lerp(f.y, to.y, k), w: lerp(f.w, to.w, k), h: lerp(f.h, to.h, k) };
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.15)'; ctx.shadowBlur = 30;
    rr(ctx, r.x, r.y, r.w, r.h, 36); ctx.fillStyle = '#fff'; ctx.fill(); ctx.restore();
    ctx.save(); rr(ctx, r.x + 8, r.y + 8, r.w - 16, r.h - 16, 30); ctx.clip();
    ctx.translate(r.x + 8, r.y + 8);
    def.preview(ctx, r.w - 16, r.h - 16, t, 8);
    ctx.restore();
    rr(ctx, r.x, r.y, r.w, r.h, 36); ctx.lineWidth = 5; ctx.strokeStyle = '#cfd8e1'; ctx.stroke();

    ctx.globalAlpha = k;
    const by = 730;
    outlined(ctx, def.name, 110, by + 40, 76, '#33404d', '#fff', 12, 'left');
    text(ctx, def.tagline || '', 112, by + 102, 32, '#6b7886', 'left', 800);
    wrap(def.desc, 112, by + 160, 1040, 28, 40, '#7d8a97');
    const n = roster().length, need = def.minPlayers || 1;
    text(ctx, `${need === 1 ? '1' : need}–8 players  ·  ${def.controls}`, 112, by + 268, 26, '#2f8cff', 'left', 800);
    const ok = n >= need;
    if (!ok) text(ctx, n === 0 ? 'Scan the QR code on the menu to join first' : `Needs at least ${need} players`, W - 140, by + 50, 30, '#ff5a6a', 'right', 800);
    button('pv-back', 1250, by + 100, 260, 110, 'Back', () => { Sound.play('back'); go('menu'); });
    button('pv-start', 1550, by + 100, 300, 110, 'Start', () => startGame(def), { primary: true, disabled: !ok });
    ctx.globalAlpha = 1;
  }
  function wrap(str, x, y, maxW, size, lh, color) {
    ctx.font = `700 ${size}px ${FONT}`;
    const words = (str || '').split(' '); let line = '', yy = y;
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && line) { text(ctx, line, x, yy, size, color, 'left', 700); line = w; yy += lh; }
      else line = test;
    }
    if (line) text(ctx, line, x, yy, size, color, 'left', 700);
  }

  // ---------------- players & settings screens ----------------
  function previewPlayers(c, w, h, t) {
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#e9f5ff'); g.addColorStop(1, '#cfe6ff');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    const k = h / 208;
    const cols = ['#2f8cff', '#ff4d5e', '#2fc46b', '#ffb020'];
    cols.forEach((col, i) => avatar(c, { color: col, slot: i }, w / 2 + (i - 1.5) * 70 * k, h * 0.42 + Math.sin(t * 3 + i) * 6 * k, 28 * k, 'happy', t));
  }
  function previewSettings(c, w, h, t) {
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#f3f5f8'); g.addColorStop(1, '#dfe5ec');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    const k = h / 208;
    c.save(); c.translate(w / 2, h * 0.42); c.rotate(t * 0.6);
    c.fillStyle = '#9aa7b4';
    for (let i = 0; i < 8; i++) { c.rotate(Math.PI / 4); c.fillRect(-10 * k, -48 * k, 20 * k, 22 * k); }
    c.beginPath(); c.arc(0, 0, 34 * k, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#e8edf2'; c.beginPath(); c.arc(0, 0, 14 * k, 0, Math.PI * 2); c.fill();
    c.restore();
  }
  function drawPlayers(t) {
    backdrop(t);
    outlined(ctx, 'Players', 110, 100, 80, '#33404d', '#fff', 12, 'left');
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.12)'; ctx.shadowBlur = 24;
    rr(ctx, 110, 180, 520, 520, 36); ctx.fillStyle = '#fff'; ctx.fill(); ctx.restore();
    if (info.qrImg) ctx.drawImage(info.qrImg, 140, 210, 460, 460);
    text(ctx, 'Point your phone camera at the code', 370, 750, 30, '#4a5866', 'center', 800);
    text(ctx, info.joinUrl, 370, 795, 26, '#2f8cff', 'center', 800);
    wrap('First time? Your phone will warn that the connection isn’t private — that’s just this laptop’s home-made certificate. Tap "Show details" → "visit this website" (iPhone) or "Advanced" → "Proceed" (Android). That unlocks motion aiming.', 110, 860, 560, 22, 32, '#8994a1');
    const list = roster();
    list.forEach((p, i) => {
      const x = 760 + (i % 4) * 270, y = 290 + Math.floor(i / 4) * 330;
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.08)'; ctx.shadowBlur = 16;
      rr(ctx, x, y - 110, 240, 290, 30); ctx.fillStyle = '#fff'; ctx.fill(); ctx.restore();
      avatar(ctx, p, x + 120, y + 10, 70, 'happy', t);
      text(ctx, p.name, x + 120, y + 125, 34, '#4a5866', 'center', 900);
      text(ctx, 'Player ' + (p.slot + 1), x + 120, y - 75, 24, p.color, 'center', 900);
    });
    if (!list.length) text(ctx, 'Waiting for players to join…', 1300, 420, 44, '#a0abb6', 'center', 800);
    else text(ctx, 'Rename yourself from the ⚙︎ button on your phone', 1300, 950, 28, '#a0abb6', 'center', 800);
    button('pl-back', W - 360, 60, 260, 100, 'Back', () => { Sound.play('back'); go('menu'); });
  }
  function drawSettings(t) {
    backdrop(t);
    outlined(ctx, 'Settings', 110, 100, 80, '#33404d', '#fff', 12, 'left');
    const rows = [
      ['Menu music', Sound.musicOn ? 'On' : 'Off', () => { Sound.musicOn = !Sound.musicOn; Music.set(true); }],
      ['Sound effects', Sound.sfxOn ? 'On' : 'Off', () => { Sound.sfxOn = !Sound.sfxOn; }],
      ['Full screen', document.fullscreenElement ? 'On' : 'Off', toggleFullscreen],
    ];
    rows.forEach(([label, val, fn], i) => {
      const y = 240 + i * 170;
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.08)'; ctx.shadowBlur = 16;
      rr(ctx, 110, y, 1100, 130, 30); ctx.fillStyle = '#fff'; ctx.fill(); ctx.restore();
      text(ctx, label, 160, y + 66, 44, '#4a5866', 'left', 900);
      button('set' + i, 900, y + 18, 260, 94, val, () => { Sound.play('click'); fn(); }, { primary: val === 'On' });
    });
    wrap('Tip: plug this laptop into the TV with HDMI and press F for full screen. Or open ' + (info.tvUrl || '') + ' in the TV’s own web browser.', 110, 790, 1100, 30, 44, '#8994a1');
    button('st-back', W - 360, 60, 260, 100, 'Back', () => { Sound.play('back'); go('menu'); });
  }

  // ---------------- results ----------------
  function drawResults(t) {
    backdrop(t);
    const rows = results.rows;
    outlined(ctx, results.title, W / 2, 100, 88, '#33404d', '#fff', 14);
    text(ctx, results.def.name, W / 2, 170, 34, '#8994a1', 'center', 800);
    const rowH = Math.min(96, 620 / Math.max(1, rows.length));
    rows.forEach((r, i) => {
      const k = easeBack((stateT - 0.15 * i) / 0.5);
      if (k <= 0) return;
      const y = 230 + i * (rowH + 10);
      ctx.save(); ctx.globalAlpha = clamp(k, 0, 1);
      ctx.translate(W / 2, y + rowH / 2); ctx.scale(k, k); ctx.translate(-W / 2, -(y + rowH / 2));
      ctx.shadowColor = 'rgba(0,0,0,.08)'; ctx.shadowBlur = 14;
      rr(ctx, 360, y, 1200, rowH, rowH / 2);
      ctx.fillStyle = r.rank === 1 ? '#fff7d6' : '#fff'; ctx.fill(); ctx.shadowColor = 'transparent';
      ctx.lineWidth = 4; ctx.strokeStyle = r.rank === 1 ? '#ffcf3d' : '#dbe2ea'; ctx.stroke();
      const medal = ['#ffcf3d', '#c4ccd6', '#e0a36c'][r.rank - 1] || '#eef2f6';
      ctx.fillStyle = medal; ctx.beginPath(); ctx.arc(360 + rowH / 2, y + rowH / 2, rowH * 0.36, 0, Math.PI * 2); ctx.fill();
      text(ctx, String(r.rank), 360 + rowH / 2, y + rowH / 2 + 2, rowH * 0.42, '#4a5866', 'center', 900);
      avatar(ctx, r.p, 360 + rowH * 1.55, y + rowH / 2, rowH * 0.36, r.rank === 1 ? 'happy' : 'flat', t);
      text(ctx, r.p.name, 360 + rowH * 2.2, y + rowH / 2 + 2, rowH * 0.42, '#3a4654', 'left', 900);
      text(ctx, r.label, 1520, y + rowH / 2 + 2, rowH * 0.4, r.p.color, 'right', 900);
      ctx.restore();
    });
    if (rows[0] && stateT > 0.6) {
      const k = easeBack((stateT - 0.6) / 0.5);
      ctx.save(); ctx.translate(W / 2, 935); ctx.scale(k, k);
      text(ctx, `${rows.filter(r => r.rank === 1).map(r => r.p.name).join(' & ')} win${rows.filter(r => r.rank === 1).length > 1 ? '' : 's'}!`, 0, -40, 44, '#ffb020', 'center', 900);
      ctx.restore();
    }
    button('rs-again', W / 2 - 430, 960, 400, 96, 'Play again', () => startGame(results.def), { primary: true, disabled: roster().length < (results.def.minPlayers || 1) });
    button('rs-menu', W / 2 + 30, 960, 400, 96, 'Menu', () => { Sound.play('back'); go('menu'); });
    // confetti
    if (stateT < 6) for (let i = 0; i < 60; i++) {
      const x = (i * 97.3) % W, y = ((stateT * (200 + (i % 7) * 40)) + i * 37) % (H + 100) - 50;
      ctx.save(); ctx.translate(x + Math.sin(stateT * 3 + i) * 20, y); ctx.rotate(stateT * 4 + i);
      ctx.fillStyle = ['#2f8cff', '#ff4d5e', '#2fc46b', '#ffb020', '#a35cff', '#ff5fb4'][i % 6];
      ctx.globalAlpha = clamp(1 - stateT / 6, 0, 1) * 0.8;
      ctx.fillRect(-7, -4, 14, 8); ctx.restore();
    }
  }

  // ---------------- splash ----------------
  function drawSplash(t) {
    backdrop(t);
    const k = easeBack(t / 0.9);
    ctx.save(); ctx.translate(W / 2, 430); ctx.scale(k, k);
    const g = ctx.createLinearGradient(-400, 0, 400, 0);
    g.addColorStop(0, '#2f8cff'); g.addColorStop(0.55, '#a35cff'); g.addColorStop(1, '#ff5fb4');
    ctx.font = `900 230px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 26; ctx.lineJoin = 'round'; ctx.strokeStyle = '#fff'; ctx.strokeText('huddle', 0, 0);
    ctx.fillStyle = g; ctx.fillText('huddle', 0, 0);
    ctx.restore();
    text(ctx, 'party games for the whole room', W / 2, 590, 44, '#8994a1', 'center', 800);
    const a = 0.55 + 0.45 * Math.sin(t * 3);
    ctx.globalAlpha = a;
    text(ctx, 'Click, or press any key, to start', W / 2, 800, 46, '#4a5866', 'center', 900);
    ctx.globalAlpha = 1;
    text(ctx, 'Press F any time for full screen', W / 2, 870, 28, '#a0abb6', 'center', 700);
  }

  // ---------------- overlay bits ----------------
  function drawPause(t) {
    ctx.fillStyle = 'rgba(20,28,38,.6)'; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.3)'; ctx.shadowBlur = 40;
    rr(ctx, W / 2 - 460, 250, 920, 560, 44); ctx.fillStyle = '#f6f8fb'; ctx.fill(); ctx.restore();
    outlined(ctx, 'Paused', W / 2, 360, 90, '#33404d', '#fff', 12);
    text(ctx, currentDef ? currentDef.name : '', W / 2, 440, 34, '#8994a1', 'center', 800);
    button('ps-resume', W / 2 - 340, 520, 680, 110, 'Resume', () => { paused = false; Sound.play('back'); restoreGameModes(); }, { primary: true });
    button('ps-quit', W / 2 - 340, 660, 680, 110, 'Quit to menu', quitGame);
  }
  function drawCursors(t) {
    const list = state === 'game' && !paused ? (current && current.showCursors ? roster() : []) : roster();
    for (const p of list) {
      const idle = (now() - p.lastMove) / 1000;
      const alpha = idle > 8 ? 0.35 : 1;
      ctx.save(); ctx.globalAlpha = alpha;
      ctx.translate(p.cx, p.cy);
      ctx.rotate(-0.35);
      ctx.shadowColor = 'rgba(0,0,0,.3)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 4;
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(26, 58); ctx.quadraticCurveTo(30, 66, 22, 66); ctx.lineTo(12, 66);
      ctx.lineTo(10, 86); ctx.quadraticCurveTo(0, 96, -10, 86); ctx.lineTo(-12, 66); ctx.lineTo(-22, 66);
      ctx.quadraticCurveTo(-30, 66, -26, 58); ctx.closePath();
      ctx.fillStyle = p.color; ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.lineWidth = 6; ctx.strokeStyle = '#fff'; ctx.lineJoin = 'round'; ctx.stroke();
      ctx.rotate(0.35);
      text(ctx, String(p.slot + 1), 18, 66, 30, '#fff', 'center', 900);
      ctx.restore();
    }
  }
  function drawToasts(dt) {
    toastList.forEach(tt => (tt.t += dt));
    toastList = toastList.filter(tt => tt.t < 3);
    toastList.forEach((tt, i) => {
      const a = Math.min(1, tt.t * 4, (3 - tt.t) * 3);
      ctx.save(); ctx.globalAlpha = a;
      ctx.font = `900 32px ${FONT}`; const w = ctx.measureText(tt.msg).width + 90;
      const x = W / 2 - w / 2, y = 24 + i * 76 - (1 - a) * 20;
      ctx.shadowColor = 'rgba(0,0,0,.18)'; ctx.shadowBlur = 16;
      rr(ctx, x, y, w, 62, 31); ctx.fillStyle = '#fff'; ctx.fill(); ctx.shadowColor = 'transparent';
      ctx.fillStyle = tt.color; ctx.beginPath(); ctx.arc(x + 34, y + 31, 12, 0, Math.PI * 2); ctx.fill();
      text(ctx, tt.msg, x + 56, y + 33, 32, '#3a4654', 'left', 900);
      ctx.restore();
    });
  }

  // ---------------- main loop ----------------
  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const s = Math.min(innerWidth / W, innerHeight / H);
    cv.style.width = W * s + 'px'; cv.style.height = H * s + 'px';
    cv.width = Math.round(W * s * dpr); cv.height = Math.round(H * s * dpr);
    scale = s * dpr;
  }
  addEventListener('resize', resize);

  let lastT = 0;
  function frame(ms) {
    const dt = Math.min(0.05, (ms - lastT) / 1000 || 0.016);
    lastT = ms; T += dt; stateT += dt;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    updateHover();
    frameHits = [];
    if (state === 'splash') drawSplash(T);
    else if (state === 'menu') drawMenu(T);
    else if (state === 'preview') drawPreview(T);
    else if (state === 'players') drawPlayers(T);
    else if (state === 'settings') drawSettings(T);
    else if (state === 'results') drawResults(T);
    else if (state === 'game' && current) {
      if (!paused) current.update(dt);
      if (current) { ctx.save(); current.draw(ctx, T); ctx.restore(); }
      if (paused) drawPause(T);
    }
    drawCursors(T);
    drawToasts(dt);
    hits = frameHits;
    document.body.classList.toggle('hide-cursor', now() - mouse.last > 3000);
    requestAnimationFrame(frame);
  }

  // Wrap setMode so a pause can restore what the game asked for.
  function trackedSetMode(mode, hint, ids, extra) {
    _setMode(mode, hint, ids, extra);
    if (state === 'game' && !paused) savedModes = { mode: padMode, over: new Map(padOverride) };
  }
  setMode = trackedSetMode; // eslint-disable-line no-func-assign

  window.Huddle = {
    register(def) { games.push(def); },
    helpers: { clamp, lerp, rand, pick, ease, easeBack, rr, text, outlined, shade, avatar, wrap },
    FONT, W, H,
    async boot() {
      resize();
      Net.connect();
      const loadInfo = async () => {
        try {
          const r = await fetch('/api/info'); info = await r.json();
          if (!info.qrSvg) return setTimeout(loadInfo, 800);
          const img = new Image();
          img.onload = () => (info.qrImg = img);
          img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(info.qrSvg);
        } catch { setTimeout(loadInfo, 2000); }
      };
      loadInfo();
      try { await document.fonts.load(`900 40px Nunito`); } catch {}
      requestAnimationFrame(frame);
    },
  };
})();
