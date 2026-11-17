// Huddle phone controller
(() => {
  const $ = id => document.getElementById(id);
  const store = {
    get(k, d) { try { const v = localStorage.getItem('huddle.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem('huddle.' + k, JSON.stringify(v)); } catch {} },
  };

  let id = store.get('id', null);
  if (!id) { id = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2)); store.set('id', id); }
  // speed is a multiplier on the pointer (1 = default). It replaced the old 'sens' value, which is ignored
  // so everyone gets the new, calmer default.
  const opts = Object.assign({ motion: true, speed: 1, invX: false, invY: false }, store.get('opts', {}));
  delete opts.sens;
  const MOTION_GAIN = 15, TOUCH_GAIN = 2.4; // were 26 and 3.2: the pointer felt too twitchy
  const SPEED_MIN = 0.3, SPEED_MAX = 2;
  const clampSpeed = v => Math.round(Math.max(SPEED_MIN, Math.min(SPEED_MAX, +v || 1)) * 100) / 100;
  opts.speed = clampSpeed(opts.speed);
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
      } else if (m.t === 'fb') {
        guessFeedback(m.text, m.kind, m.guess);
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
    if (m === 'tilt') { calibrate = true; }
    if (m === 'drive') {
      wheelCal = true;
      $('itemName').textContent = extra.item || 'No item';
      $('itemBtn').classList.toggle('has', !!extra.item);
    }
    if (m === 'choice') {
      const o = extra.options || ['', '', '', ''];
      document.querySelectorAll('.choice').forEach((b, i) => { b.querySelector('.ctext').textContent = o[i] || ''; b.style.visibility = o[i] === null ? 'hidden' : ''; });
    }
    if (m === 'swing') {
      $('swingText').textContent = extra.text || 'Swipe up to bowl';
      $('aimStrip').style.display = extra.noAim ? 'none' : '';
      if (extra.aimText) $('aimStrip').querySelector('span').textContent = extra.aimText;
    }
    if (m === 'draw') startDrawing(extra);
    if (m === 'guess' && extra.round !== guessRound) {
      guessRound = extra.round; $('guessList').innerHTML = ''; $('guessInput').value = '';
      guessFeedback(extra.text || 'Watch the TV and type your guess', '');
    }
    if (m !== 'guess') try { $('guessInput').blur(); } catch {}
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
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        await DeviceOrientationEvent.requestPermission();
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
      if (e.target.id === 'motionChip' || e.target.closest('.speed-chip')) return;
      e.preventDefault(); tp.setPointerCapture(e.pointerId); tp.classList.add('active');
      last = { x: e.clientX, y: e.clientY }; start = performance.now(); moved = 0;
    });
    tp.addEventListener('pointermove', e => {
      if (!last) return;
      const dx = e.clientX - last.x, dy = e.clientY - last.y;
      moved += Math.abs(dx) + Math.abs(dy);
      const k = TOUCH_GAIN * opts.speed * (1 + Math.min(2, Math.hypot(dx, dy) / 18)); // a touch of acceleration
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

  // ---------- tilt joystick ----------
  let calibrate = true, tiltBase = null, orient = null, drag = null, lastTiltSend = 0, lastTilt = { x: 0, y: 0 };
  window.addEventListener('deviceorientation', e => {
    if (e.beta == null || e.gamma == null) return;
    if (calibrate || !tiltBase) { tiltBase = { b: e.beta, g: e.gamma }; calibrate = false; }
    const cl = v => Math.max(-1, Math.min(1, v));
    orient = { x: cl((e.gamma - tiltBase.g) / 22), y: cl((e.beta - tiltBase.b) / 22) };
    if (mode === 'tilt' && !drag) $('stickLabel').textContent = 'Tilting! Drag here to steer by touch instead';
  });
  {
    const el = $('stick');
    const setDrag = e => {
      const r = el.getBoundingClientRect(), R = 110;
      let x = (e.clientX - (r.left + r.width / 2)) / R, y = (e.clientY - (r.top + r.height / 2)) / R;
      const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
      drag = { x, y };
    };
    el.addEventListener('pointerdown', e => { e.preventDefault(); el.setPointerCapture(e.pointerId); setDrag(e); });
    el.addEventListener('pointermove', e => { if (drag) setDrag(e); });
    const end = () => (drag = null);
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  }
  $('recenterBtn').addEventListener('click', () => { calibrate = true; vibrate(20); });
  pressable($('dashBtn'), () => send({ t: 'dash' }));
  function tiltTick(now) {
    if (mode !== 'tilt') return;
    const v = drag || (opts.motion && orient) || { x: 0, y: 0 };
    $('stickKnob').style.transform = `translate(${v.x * 110}px, ${v.y * 110}px)`;
    const changed = Math.abs(v.x - lastTilt.x) + Math.abs(v.y - lastTilt.y) > 0.02;
    if ((changed && now - lastTiltSend > 33) || now - lastTiltSend > 250) {
      send({ t: 'tilt', x: +v.x.toFixed(3), y: +v.y.toFixed(3) });
      lastTilt = v; lastTiltSend = now;
    }
  }

  // ---------- steering wheel (kart) ----------
  // Steering = how far the phone is rotated about its screen axis, compared with how it was held
  // when the race started. Using the cross product of the two gravity directions makes this work
  // whichever sign convention the phone uses, and in portrait or landscape.
  let wheelCal = true, wheelRest = null, gravFast = null, wheelTouch = null, steer = 0, lastSteer = 0, lastSteerSend = 0;
  window.addEventListener('devicemotion', e => {
    const a = e.accelerationIncludingGravity; if (!a || a.x == null) return;
    gravFast = gravFast ? { x: gravFast.x + (a.x - gravFast.x) * 0.35, y: gravFast.y + (a.y - gravFast.y) * 0.35 } : { x: a.x, y: a.y };
  });
  {
    const z = $('wheelZone');
    const set = e => { const r = z.getBoundingClientRect(); wheelTouch = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (r.width * 0.3))); };
    z.addEventListener('pointerdown', e => { e.preventDefault(); z.setPointerCapture(e.pointerId); set(e); });
    z.addEventListener('pointermove', e => { if (wheelTouch != null) set(e); });
    const end = () => (wheelTouch = null);
    z.addEventListener('pointerup', end); z.addEventListener('pointercancel', end);
  }
  $('wheelCenter').addEventListener('click', () => { wheelCal = true; vibrate(20); });
  pressable($('brakeBtn'), () => btn('b', true), () => btn('b', false));
  pressable($('itemBtn'), () => send({ t: 'item' }));
  function driveTick(now) {
    if (mode !== 'drive') return;
    let s = 0, tilt = false;
    if (gravFast && opts.motion) {
      const l = Math.hypot(gravFast.x, gravFast.y);
      if (l > 3) { // phone is upright enough to steer with
        const g = { x: gravFast.x / l, y: gravFast.y / l };
        if (wheelCal || !wheelRest) { wheelRest = g; wheelCal = false; }
        const cross = wheelRest.x * g.y - wheelRest.y * g.x, dot = wheelRest.x * g.x + wheelRest.y * g.y;
        s = Math.max(-1, Math.min(1, Math.atan2(cross, dot) / 0.6)) * (opts.invX ? -1 : 1);
        if (Math.abs(s) < 0.04) s = 0;
        tilt = true;
      }
    }
    if (wheelTouch != null) s = wheelTouch;
    if (keyHeld.left || keyHeld.right) s = (keyHeld.right ? 1 : 0) - (keyHeld.left ? 1 : 0);
    steer = s;
    $('wheel').style.transform = `rotate(${s * 100}deg)`;
    $('wheelZone').classList.toggle('left', wheelTouch != null && s < -0.1);
    $('wheelZone').classList.toggle('right', wheelTouch != null && s > 0.1);
    if (tilt) $('wheelLabel').textContent = 'Steering by tilt · tap ⟲ Centre if it pulls to one side';
    if ((Math.abs(s - lastSteer) > 0.02 && now - lastSteerSend > 33) || now - lastSteerSend > 250) {
      send({ t: 'steer', s: +s.toFixed(3) }); lastSteer = s; lastSteerSend = now;
    }
  }
  const keyHeld = { left: false, right: false };
  addEventListener('keydown', e => { if (e.code === 'ArrowLeft') keyHeld.left = true; if (e.code === 'ArrowRight') keyHeld.right = true; if (mode === 'drive' && e.code === 'KeyI') send({ t: 'item' }); });
  addEventListener('keyup', e => { if (e.code === 'ArrowLeft') keyHeld.left = false; if (e.code === 'ArrowRight') keyHeld.right = false; });

  // ---------- quiz answers ----------
  document.querySelectorAll('.choice').forEach(b => pressable(b, () => { send({ t: 'choice', i: +b.dataset.i }); vibrate(30); }));

  // ---------- drawing (Doodle Dash) ----------
  // The board is always 3:4 (width:height) so the TV can show it exactly as drawn.
  // Points are sent as fractions of the board size.
  const COLORS = ['#1e2630', '#ff4d5e', '#ff9f1c', '#ffd43b', '#2fc46b', '#2f8cff', '#9b5de5', '#8d5b3a'];
  const SIZES = [0.012, 0.026, 0.05];
  const dc = $('drawCanvas'), dctx = dc.getContext('2d');
  let drawWord = null, strokes = [], curStroke = null, pendingPts = [], strokeSeq = 0;
  let penColor = COLORS[0], penSize = 1, erasing = false, lastDrawSend = 0;
  COLORS.forEach((c, i) => {
    const b = document.createElement('button'); b.className = 'swatch' + (i ? '' : ' on'); b.style.background = c;
    b.addEventListener('click', () => { penColor = c; erasing = false; refreshTools(); vibrate(10); });
    $('swatches').appendChild(b);
  });
  function refreshTools() {
    document.querySelectorAll('.swatch').forEach((b, i) => b.classList.toggle('on', !erasing && COLORS[i] === penColor));
    $('eraseBtn').classList.toggle('on', erasing);
    $('sizeBtn').style.setProperty('--d', [8, 16, 28][penSize] + 'px');
  }
  refreshTools();
  $('sizeBtn').addEventListener('click', () => { penSize = (penSize + 1) % SIZES.length; refreshTools(); vibrate(10); });
  $('eraseBtn').addEventListener('click', () => { erasing = !erasing; refreshTools(); vibrate(10); });
  $('undoBtn').addEventListener('click', () => { flushDraw(); strokes.pop(); redraw(); send({ t: 'undo' }); vibrate(15); });
  $('clearBtn').addEventListener('click', () => { strokes = []; redraw(); send({ t: 'clear' }); vibrate(30); });
  $('passBtn').addEventListener('click', () => { send({ t: 'pass' }); $('passBtn').classList.add('used'); vibrate(20); });
  function sizeBoard() {
    const r = $('drawWrap').getBoundingClientRect();
    if (!r.width || !r.height) return;
    let w = r.width, h = w * 4 / 3;
    if (h > r.height) { h = r.height; w = h * 3 / 4; }
    const dpr = window.devicePixelRatio || 1;
    dc.style.width = w + 'px'; dc.style.height = h + 'px';
    dc.width = Math.round(w * dpr); dc.height = Math.round(h * dpr);
    redraw();
  }
  function paint(st) {
    const W = dc.width, H = dc.height;
    dctx.strokeStyle = st.c; dctx.fillStyle = st.c; dctx.lineWidth = st.w * W; dctx.lineCap = 'round'; dctx.lineJoin = 'round';
    const p = st.pts;
    if (p.length === 1) { dctx.beginPath(); dctx.arc(p[0][0] * W, p[0][1] * H, st.w * W / 2, 0, Math.PI * 2); dctx.fill(); return; }
    dctx.beginPath(); dctx.moveTo(p[0][0] * W, p[0][1] * H);
    for (let i = 1; i < p.length; i++) dctx.lineTo(p[i][0] * W, p[i][1] * H);
    dctx.stroke();
  }
  function redraw() { dctx.fillStyle = '#fff'; dctx.fillRect(0, 0, dc.width, dc.height); strokes.forEach(paint); }
  function startDrawing(extra) {
    $('drawWord').textContent = extra.word || '…';
    $('passBtn').classList.toggle('used', !extra.canPass);
    if (extra.word !== drawWord) { drawWord = extra.word; strokes = []; curStroke = null; pendingPts = []; }
    requestAnimationFrame(sizeBoard);
  }
  addEventListener('resize', () => { if (mode === 'draw') sizeBoard(); });
  const boardPt = e => { const r = dc.getBoundingClientRect(); return [+Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)).toFixed(4), +Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)).toFixed(4)]; };
  dc.addEventListener('pointerdown', e => {
    e.preventDefault(); dc.setPointerCapture(e.pointerId);
    flushDraw();
    const pt = boardPt(e);
    curStroke = { id: ++strokeSeq, c: erasing ? '#ffffff' : penColor, w: SIZES[penSize] * (erasing ? 2 : 1), pts: [pt] };
    strokes.push(curStroke); paint(curStroke);
    send({ t: 'stroke', id: curStroke.id, c: curStroke.c, w: curStroke.w, pts: [pt] });
  });
  dc.addEventListener('pointermove', e => {
    if (!curStroke) return;
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of evs) {
      const pt = boardPt(ev), last = curStroke.pts[curStroke.pts.length - 1];
      if (Math.hypot(pt[0] - last[0], pt[1] - last[1]) < 0.004) continue;
      curStroke.pts.push(pt); pendingPts.push(pt);
    }
    const W = dc.width, H = dc.height, p = curStroke.pts, n = p.length;
    if (n > 1) {
      dctx.strokeStyle = curStroke.c; dctx.lineWidth = curStroke.w * W; dctx.lineCap = 'round'; dctx.lineJoin = 'round';
      dctx.beginPath(); dctx.moveTo(p[Math.max(0, n - 1 - evs.length)][0] * W, p[Math.max(0, n - 1 - evs.length)][1] * H);
      for (let i = Math.max(1, n - evs.length); i < n; i++) dctx.lineTo(p[i][0] * W, p[i][1] * H);
      dctx.stroke();
    }
  });
  const endStroke = () => { if (!curStroke) return; flushDraw(); curStroke = null; };
  dc.addEventListener('pointerup', endStroke); dc.addEventListener('pointercancel', endStroke);
  function flushDraw() {
    if (curStroke && pendingPts.length) { send({ t: 'stroke', id: curStroke.id, pts: pendingPts }); pendingPts = []; }
    lastDrawSend = performance.now();
  }
  function drawTick(now) { if (mode === 'draw' && pendingPts.length && now - lastDrawSend > 40) flushDraw(); }

  // ---------- guessing (Doodle Dash) ----------
  let guessRound = null;
  function guessFeedback(text, kind, guess) {
    const fb = $('guessFeedback'); fb.textContent = text; fb.className = 'guess-fb ' + (kind || '');
    if (guess && (kind === 'no' || kind === 'close')) {
      const s = document.createElement('span'); s.textContent = guess; if (kind === 'close') s.className = 'close';
      $('guessList').prepend(s);
      while ($('guessList').children.length > 12) $('guessList').lastChild.remove();
    }
    if (kind === 'close') vibrate([30, 40, 30]); else if (kind === 'no') vibrate(20);
  }
  $('guessForm').addEventListener('submit', e => {
    e.preventDefault();
    const g = $('guessInput').value.trim();
    if (!g) return;
    send({ t: 'guess', text: g.slice(0, 24) });
    $('guessInput').value = '';
    $('guessInput').focus();
  });

  // ---------- motion ----------
  const grav = { x: 0, y: 0, z: 0 }; let gravInit = false;
  let lastMotionT = 0, armed = true, lastShakeT = 0, smYaw = 0, smPitch = 0;
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
      // Smooth out hand tremor, then use a gentle curve: small, slow turns move the pointer less
      // (precise aiming) while big sweeps still cross the screen quickly.
      smYaw += (yaw - smYaw) * 0.5; smPitch += (pitch - smPitch) * 0.5;
      const curve = v => { const a = Math.abs(v); return a < 1.5 ? 0 : v * (0.5 + 0.5 * Math.min(1, a / 60)); };
      const gain = MOTION_GAIN * opts.speed * dt;
      accDx += -curve(smYaw) * gain * (opts.invX ? -1 : 1);
      accDy += -curve(smPitch) * gain * (opts.invY ? -1 : 1);
    }
  });

  // flush pointer movement at display rate
  (function loop(now) {
    tiltTick(now || performance.now());
    driveTick(now || performance.now());
    drawTick(now || performance.now());
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
  const keysDown = new Set();
  addEventListener('keydown', e => {
    keysDown.add(e.code);
    if (mode === 'tilt' && e.code.startsWith('Arrow')) {
      drag = { x: (keysDown.has('ArrowRight') ? 1 : 0) - (keysDown.has('ArrowLeft') ? 1 : 0), y: (keysDown.has('ArrowDown') ? 1 : 0) - (keysDown.has('ArrowUp') ? 1 : 0) };
    }
    if (mode === 'tilt' && e.code === 'KeyD') send({ t: 'dash' });
    if (mode === 'choice' && /^Digit[1-4]$/.test(e.code)) send({ t: 'choice', i: +e.code.slice(5) - 1 });
  });
  addEventListener('keyup', e => {
    keysDown.delete(e.code);
    if (mode === 'tilt' && e.code.startsWith('Arrow') && ![...keysDown].some(k => k.startsWith('Arrow'))) drag = null;
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
  function setSpeed(v, save = true) {
    opts.speed = clampSpeed(v);
    const pct = Math.round(opts.speed * 100) + '%';
    $('spdVal').textContent = 'Speed ' + pct;
    $('optSpeedVal').textContent = pct;
    $('optSpeed').value = opts.speed;
    if (save) store.set('opts', opts);
  }
  $('spdDown').addEventListener('click', () => { setSpeed(opts.speed - 0.1); vibrate(10); });
  $('spdUp').addEventListener('click', () => { setSpeed(opts.speed + 0.1); vibrate(10); });
  $('optSpeed').addEventListener('input', e => setSpeed(e.target.value)); // applies live, so you can feel it
  setSpeed(opts.speed, false);
  $('gearBtn').addEventListener('click', () => {
    $('optMotion').checked = opts.motion; setSpeed(opts.speed, false);
    $('optInvX').checked = opts.invX; $('optInvY').checked = opts.invY;
    refreshMotionChip();
    $('sheet').classList.remove('hidden');
  });
  $('sheetClose').addEventListener('click', () => {
    opts.motion = $('optMotion').checked; opts.speed = clampSpeed($('optSpeed').value);
    opts.invX = $('optInvX').checked; opts.invY = $('optInvY').checked;
    store.set('opts', opts); refreshMotionChip();
    const nn = $('renameInput').value.trim().slice(0, 14);
    if (nn && me && nn !== me.name) { store.set('name', nn); send({ t: 'name', name: nn }); }
    $('sheet').classList.add('hidden');
  });
  refreshMotionChip();
})();
