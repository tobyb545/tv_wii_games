// Huddle phone controller
(() => {
  const $ = id => document.getElementById(id);
  const store = {
    get(k, d) { try { const v = localStorage.getItem('huddle.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem('huddle.' + k, JSON.stringify(v)); } catch {} },
  };

  let id = store.get('id', null);
  if (!id) { id = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2)); store.set('id', id); }
  const opts = Object.assign({ motion: true, sens: 26, invX: false, invY: false }, store.get('opts', {}));
  let ws = null, me = null, mode = 'pointer', retry = 0, wantConnected = false;
  let motionSeen = false, wakeLock = null;

  const vibrate = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch {} };
  const flash = () => { const f = $('flash'); f.classList.add('on'); requestAnimationFrame(() => requestAnimationFrame(() => f.classList.remove('on'))); };

  // ---------- networking ----------
  function connect() {
    wantConnected = true;
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const name = store.get('name', '');
    ws = new WebSocket(`${proto}://${location.host}/ws?role=pad&id=${encodeURIComponent(id)}&name=${encodeURIComponent(name)}`);
    ws.onopen = () => { retry = 0; $('net').classList.add('ok'); };
    ws.onclose = () => {
      $('net').classList.remove('ok');
      if (wantConnected) setTimeout(connect, Math.min(4000, 500 * ++retry));
    };
    ws.onmessage = e => {
      let m; try { m = JSON.parse(e.data); } catch { return; }
      if (m.t === 'info') {
        me = m;
        document.documentElement.style.setProperty('--pc', m.color);
        document.querySelector('meta[name=theme-color]').content = m.color;
        $('slotBadge').textContent = 'P' + (m.slot + 1);
        $('nameLabel').textContent = m.name;
        $('renameInput').value = m.name;
      } else if (m.t === 'mode') {
        setMode(m.mode, m.hint, m);
      } else if (m.t === 'buzz') {
        vibrate(m.ms || 30);
        if (m.flash) flash();
      } else if (m.t === 'full') {
        wantConnected = false;
        alertBox('The game is full (8 players).');
      }
    };
  }
  const send = m => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); };

  function alertBox(msg) { $('joinNote').textContent = msg; document.body.dataset.screen = 'join'; }

  function setMode(m, hint, extra = {}) {
    mode = m;
    document.body.dataset.mode = m;
    $('hint').textContent = hint || '';
    if (m === 'wait') $('waitText').textContent = extra.text || hint || 'Hang tight…';
    if (m === 'bomb') $('bombText').textContent = extra.text || 'TAP TO THROW';
    if (m === 'buzzer') $('buzzerText').textContent = extra.text || 'TAP!';
    if (m === 'shake') { shakes = 0; $('shakeCount').textContent = motionSeen ? 'shake it like you mean it' : 'tap here as fast as you can'; }
  }

  // ---------- join ----------
  $('nameInput').value = store.get('name', '');
  $('joinBtn').addEventListener('click', async () => {
    const name = $('nameInput').value.trim().slice(0, 14);
    store.set('name', name);
    // iOS needs an explicit permission prompt from a tap.
    try {
      if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
        const r = await DeviceMotionEvent.requestPermission();
        if (r !== 'granted') opts.motion = false;
      }
    } catch {}
    if (!window.isSecureContext) opts.motion = false;
    refreshMotionChip();
    requestWake();
    document.body.dataset.screen = 'pad';
    if (me) send({ t: 'name', name }); else connect();
    try { document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(() => {}); } catch {}
  });
  if (!window.isSecureContext) $('joinNote').textContent = 'Motion controls need the secure link (https) from the TV QR code. Touch controls still work here.';

  async function requestWake() {
    try { if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen'); } catch {}
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      if (document.body.dataset.screen === 'pad') requestWake();
      if (wantConnected && (!ws || ws.readyState > 1)) connect();
    }
  });

  // ---------- buttons ----------
  function pressable(el, onDown, onUp) {
    el.addEventListener('pointerdown', e => { e.preventDefault(); el.classList.add('pressed'); vibrate(12); onDown && onDown(e); });
    const up = e => { if (!el.classList.contains('pressed')) return; el.classList.remove('pressed'); onUp && onUp(e); };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', up);
  }
  const btn = (b, d) => send({ t: 'btn', b, d });
  pressable($('aBtn'), () => btn('a', true), () => btn('a', false));
  pressable($('bBtn'), () => btn('b', true), () => btn('b', false));
  pressable($('homeBtn'), () => btn('home', true), () => btn('home', false));
  pressable($('buzzer'), () => btn('a', true), () => btn('a', false));
  pressable($('bombBtn'), () => btn('a', true), () => btn('a', false));

  let shakes = 0;
  function shake(s) {
    shakes++;
    $('shakeCount').textContent = shakes + (shakes === 1 ? ' shake' : ' shakes');
    send({ t: 'shake', s });
  }
  pressable($('shakeZone'), () => { shake(18); vibrate(8); });

  // ---------- touchpad (pointer) ----------
  let accDx = 0, accDy = 0;
  {
    const tp = $('touchpad');
    let last = null, start = null, moved = 0;
    tp.addEventListener('pointerdown', e => {
      if (e.target.id === 'motionChip') return;
      e.preventDefault(); tp.setPointerCapture(e.pointerId); tp.classList.add('active');
      last = { x: e.clientX, y: e.clientY }; start = performance.now(); moved = 0;
    });
    tp.addEventListener('pointermove', e => {
      if (!last) return;
      const dx = e.clientX - last.x, dy = e.clientY - last.y;
      moved += Math.abs(dx) + Math.abs(dy);
      const k = 3.2 * (1 + Math.min(2, Math.hypot(dx, dy) / 18)); // a touch of acceleration
      accDx += dx * k; accDy += dy * k;
      last = { x: e.clientX, y: e.clientY };
    });
    const end = () => {
      if (!last) return;
      tp.classList.remove('active');
      if (moved < 12 && performance.now() - start < 300) { btn('a', true); setTimeout(() => btn('a', false), 60); vibrate(12); }
      last = null;
    };
    tp.addEventListener('pointerup', end);
    tp.addEventListener('pointercancel', end);
  }

  // ---------- aim strip (bowling line-up) ----------
  {
    const el = $('aimStrip'); let last = null;
    el.addEventListener('pointerdown', e => { e.preventDefault(); el.setPointerCapture(e.pointerId); last = e.clientX; });
    el.addEventListener('pointermove', e => { if (last == null) return; accDx += (e.clientX - last) * 2.4; last = e.clientX; });
    const end = () => (last = null);
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  }

  // ---------- swing zone (bowling throw) ----------
  let swing = null;
  {
    const el = $('swingZone');
    el.addEventListener('pointerdown', e => {
      e.preventDefault(); el.setPointerCapture(e.pointerId); el.classList.add('holding');
      swing = { x0: e.clientX, y0: e.clientY, t0: performance.now(), x: e.clientX, y: e.clientY, peak: 0, spin: 0, trail: [{ y: e.clientY, x: e.clientX, t: performance.now() }] };
      vibrate(10);
    });
    el.addEventListener('pointermove', e => {
      if (!swing) return;
      swing.x = e.clientX; swing.y = e.clientY;
      swing.trail.push({ x: e.clientX, y: e.clientY, t: performance.now() });
      if (swing.trail.length > 12) swing.trail.shift();
    });
    const end = () => {
      if (!swing) return;
      el.classList.remove('holding');
      const s = swing; swing = null;
      const dur = performance.now() - s.t0;
      const dy = s.y0 - s.y, dx = s.x - s.x0;
      if (dy > 50 && dur < 900) {
        // speed over the last part of the swipe
        const a = s.trail[0], b = s.trail[s.trail.length - 1];
        const v = (a.y - b.y) / Math.max(16, b.t - a.t); // px per ms
        const power = Math.max(0.12, Math.min(1, v / 2.6));
        const curve = Math.max(-1, Math.min(1, (dx / Math.max(1, dy)) * 1.6));
        send({ t: 'swing', power, curve, spin: 0, via: 'swipe' });
        vibrate(40);
      } else if (motionSeen && dur > 200 && s.peak > 9) {
        const power = Math.max(0.15, Math.min(1, (s.peak - 9) / 24));
        const spin = Math.max(-1, Math.min(1, s.spin / 50));
        send({ t: 'swing', power, curve: 0, spin, via: 'motion' });
        vibrate(40);
      } else {
        $('swingNote').textContent = 'Swipe up faster — or hold, swing your arm and let go';
      }
    };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  }

  // ---------- motion ----------
  const grav = { x: 0, y: 0, z: 0 }; let gravInit = false;
  let lastMotionT = 0, armed = true, lastShakeT = 0;
  window.addEventListener('devicemotion', e => {
    const now = performance.now();
    const dt = lastMotionT ? Math.min((now - lastMotionT) / 1000, 0.05) : 0.016;
    lastMotionT = now;
    const aig = e.accelerationIncludingGravity;
    if (aig && aig.x != null) {
      if (!gravInit) { grav.x = aig.x; grav.y = aig.y; grav.z = aig.z; gravInit = true; }
      grav.x += (aig.x - grav.x) * 0.1; grav.y += (aig.y - grav.y) * 0.1; grav.z += (aig.z - grav.z) * 0.1;
    }
    let lin = e.acceleration;
    if (!lin || lin.x == null) lin = aig && aig.x != null ? { x: aig.x - grav.x, y: aig.y - grav.y, z: aig.z - grav.z } : null;
    if (!lin) return;
    if (!motionSeen) { motionSeen = true; refreshMotionChip(); }
    const mag = Math.hypot(lin.x, lin.y, lin.z);

    if (mode === 'shake') {
      if (mag < 5) armed = true;
      if (armed && mag > 13 && now - lastShakeT > 90) { armed = false; lastShakeT = now; shake(mag); }
    }
    if (swing) {
      swing.peak = Math.max(swing.peak, mag);
      if (e.rotationRate && e.rotationRate.gamma != null) swing.spin += e.rotationRate.gamma * dt;
    }
    const rr = e.rotationRate;
    if (mode === 'pointer' && opts.motion && rr && rr.alpha != null) {
      // Air-mouse: project the gyro onto the world "up" axis (yaw) and the phone's right axis (pitch).
      const gl = Math.hypot(grav.x, grav.y, grav.z) || 1;
      let u = { x: grav.x / gl, y: grav.y / gl, z: grav.z / gl };
      if (u.y + u.z < 0) u = { x: -u.x, y: -u.y, z: -u.z }; // platforms disagree on the gravity sign
      const w = { x: rr.beta, y: rr.gamma, z: rr.alpha }; // deg/s about device x, y, z
      const yaw = w.x * u.x + w.y * u.y + w.z * u.z;
      let r = { x: 1 - u.x * u.x, y: -u.x * u.y, z: -u.x * u.z };
      const rl = Math.hypot(r.x, r.y, r.z) || 1; r = { x: r.x / rl, y: r.y / rl, z: r.z / rl };
      const pitch = w.x * r.x + w.y * r.y + w.z * r.z;
      const dz = v => (Math.abs(v) < 1.2 ? 0 : v);
      accDx += -dz(yaw) * dt * opts.sens * (opts.invX ? -1 : 1);
      accDy += -dz(pitch) * dt * opts.sens * (opts.invY ? -1 : 1);
    }
  });

  // flush pointer movement at display rate
  (function loop() {
    if (Math.abs(accDx) > 0.05 || Math.abs(accDy) > 0.05) {
      send({ t: 'p', dx: +accDx.toFixed(2), dy: +accDy.toFixed(2) });
      accDx = 0; accDy = 0;
    }
    requestAnimationFrame(loop);
  })();

  // keyboard (handy when testing from a laptop browser tab)
  addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    if (e.repeat) return;
    if (e.code === 'Space' || e.code === 'Enter') { mode === 'shake' ? shake(18) : btn('a', true); }
    if (e.code === 'KeyB' || e.code === 'Escape') btn('b', true);
    if (e.code === 'KeyH') btn('home', true);
    if (e.code === 'ArrowUp' && mode === 'swing') send({ t: 'swing', power: 0.75, curve: (Math.random() - 0.5) * 0.3, spin: 0 });
  });
  addEventListener('keyup', e => {
    if (e.code === 'Space' || e.code === 'Enter') btn('a', false);
    if (e.code === 'KeyB' || e.code === 'Escape') btn('b', false);
    if (e.code === 'KeyH') btn('home', false);
  });
  addEventListener('keydown', e => {
    const step = 40;
    if (mode !== 'pointer' && mode !== 'swing') return;
    if (e.code === 'ArrowLeft') accDx -= step;
    if (e.code === 'ArrowRight') accDx += step;
    if (mode === 'pointer' && e.code === 'ArrowUp') accDy -= step;
    if (mode === 'pointer' && e.code === 'ArrowDown') accDy += step;
  });

  // ---------- settings ----------
  function refreshMotionChip() {
    const chip = $('motionChip');
    const on = opts.motion && motionSeen;
    chip.textContent = !motionSeen ? 'Motion aim unavailable' : 'Motion aim: ' + (on ? 'on' : 'off');
    chip.classList.toggle('on', on);
    $('motionStatus').textContent = motionSeen
      ? 'Motion sensors detected. Point the top of your phone at the TV; if the cursor drifts, push it against a screen edge to re-centre.'
      : (window.isSecureContext ? 'No motion data yet — on iPhone, rejoin and allow Motion & Orientation access.' : 'Open the secure (https) link from the TV QR code to enable motion.');
  }
  $('motionChip').addEventListener('click', () => { opts.motion = !opts.motion; store.set('opts', opts); refreshMotionChip(); });
  $('gearBtn').addEventListener('click', () => {
    $('optMotion').checked = opts.motion; $('optSens').value = opts.sens;
    $('optInvX').checked = opts.invX; $('optInvY').checked = opts.invY;
    refreshMotionChip();
    $('sheet').classList.remove('hidden');
  });
  $('sheetClose').addEventListener('click', () => {
    opts.motion = $('optMotion').checked; opts.sens = +$('optSens').value;
    opts.invX = $('optInvX').checked; opts.invY = $('optInvY').checked;
    store.set('opts', opts); refreshMotionChip();
    const nn = $('renameInput').value.trim().slice(0, 14);
    if (nn && me && nn !== me.name) { store.set('name', nn); send({ t: 'name', name: nn }); }
    $('sheet').classList.add('hidden');
  });
  refreshMotionChip();
})();
