// Strike Lane — ten-pin bowling with a perspective lane and simple 2D pin physics.
(() => {
  const { clamp, rand, lerp, rr, text, outlined, shade, avatar } = Huddle.helpers;
  const LANE_W = 1.05, HALF = LANE_W / 2, GUT = 0.24, LEN = 18.3;
  const BALL_R = 0.109, PIN_R = 0.06, PIN_H = 0.38;
  const HEAD = 16.4, SP = 0.305;
  const PIN_POS = [];
  for (let row = 0; row < 4; row++) for (let j = 0; j <= row; j++) PIN_POS.push([(j - row / 2) * SP, HEAD + row * SP * 0.866]);

  // ---------- rendering ----------
  function makeView(w, h, camY, camX = 0) {
    const u = h / 1080;
    const F = 1150 * u, HOR = h * 0.3, CX = w / 2, CAMH = 1.25;
    return {
      camY, w, h, u,
      p(x, y, z = 0) {
        const d = Math.max(0.25, y - camY), s = F / d;
        return { x: CX + (x - camX) * s, y: HOR + (CAMH - z) * s, s };
      },
    };
  }
  function quad(c, v, x0, x1, y0, y1, fill) {
    const a = v.p(x0, y0), b = v.p(x1, y0), d = v.p(x1, y1), e = v.p(x0, y1);
    c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.lineTo(d.x, d.y); c.lineTo(e.x, e.y); c.closePath();
    c.fillStyle = fill; c.fill();
  }
  function drawLane(c, v, t) {
    const { w, h } = v;
    // room
    const bg = c.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#1b2036'); bg.addColorStop(1, '#2b2f45');
    c.fillStyle = bg; c.fillRect(0, 0, w, h);
    const near = v.camY + 0.3, far = LEN + 0.9;
    // neighbouring lanes / floor
    quad(c, v, -6, 6, near, far, '#3a3550');
    for (const off of [-1.9, 1.9]) quad(c, v, off - HALF, off + HALF, near, far, 'rgba(201,160,108,.35)');
    // back wall + masking panel
    const bw0 = v.p(-4, far, 0), bw1 = v.p(4, far, 1.7);
    c.fillStyle = '#12162a'; c.fillRect(bw0.x, bw1.y, bw1.x - bw0.x, bw0.y - bw1.y);
    const m0 = v.p(-HALF - GUT, far - 0.05, 0.55), m1 = v.p(HALF + GUT, far - 0.05, 1.05);
    const mg = c.createLinearGradient(m0.x, 0, m1.x, 0);
    mg.addColorStop(0, '#2f8cff'); mg.addColorStop(0.5, '#a35cff'); mg.addColorStop(1, '#ff5fb4');
    c.fillStyle = mg; c.fillRect(m0.x, m1.y, m1.x - m0.x, m0.y - m1.y);
    c.font = `900 ${(m0.y - m1.y) * 0.55}px ${Huddle.FONT}`; c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('STRIKE LANE', (m0.x + m1.x) / 2, (m0.y + m1.y) / 2);
    // gutters
    for (const s of [-1, 1]) {
      const x0 = s < 0 ? -HALF - GUT : HALF, x1 = s < 0 ? -HALF : HALF + GUT;
      quad(c, v, x0, x1, near, LEN, '#8b93a3');
      quad(c, v, s < 0 ? x0 + GUT * 0.25 : x0, s < 0 ? x1 : x1 - GUT * 0.25, near, LEN, '#6f7788');
    }
    // lane wood
    const a = v.p(0, near), b = v.p(0, LEN);
    const lg = c.createLinearGradient(0, a.y, 0, b.y);
    lg.addColorStop(0, '#e9c48f'); lg.addColorStop(1, '#d6a66b');
    quad(c, v, -HALF, HALF, near, LEN, lg);
    quad(c, v, -HALF, HALF, LEN - 2.3, LEN, 'rgba(255,240,215,.35)'); // pin deck
    quad(c, v, -HALF - GUT, HALF + GUT, LEN, far, '#0c0f1c'); // pit
    // boards
    c.strokeStyle = 'rgba(140,90,40,.18)'; c.lineWidth = Math.max(1, v.u * 1.5);
    for (let i = 1; i < 39; i++) {
      const x = -HALF + i * LANE_W / 39, p0 = v.p(x, near), p1 = v.p(x, LEN);
      c.beginPath(); c.moveTo(p0.x, p0.y); c.lineTo(p1.x, p1.y); c.stroke();
    }
    // foul line
    if (near < 0.05) quad(c, v, -HALF, HALF, 0, 0.04, '#26324a');
    // dots and arrows
    c.fillStyle = 'rgba(70,40,20,.65)';
    for (const bd of [3, 5, 8, 11, 14]) for (const s of [-1, 1]) {
      const x = s * (HALF - bd * LANE_W / 39);
      const p = v.p(x, 2.2); if (2.2 > near) { c.beginPath(); c.ellipse(p.x, p.y, 0.012 * p.s, 0.006 * p.s, 0, 0, Math.PI * 2); c.fill(); }
    }
    for (let i = 0; i < 7; i++) {
      const x = (i - 3) * 5 * LANE_W / 39, y = 4.6 + Math.abs(i - 3) * 0.3;
      if (y < near) continue;
      const tip = v.p(x, y + 0.25), l = v.p(x - 0.025, y), r = v.p(x + 0.025, y);
      c.beginPath(); c.moveTo(tip.x, tip.y); c.lineTo(l.x, l.y); c.lineTo(r.x, r.y); c.fill();
    }
    // lane lights reflection
    c.save(); c.globalAlpha = 0.12;
    const r0 = v.p(-0.15, near), r1 = v.p(0.15, LEN);
    const rg = c.createLinearGradient(0, r0.y, 0, r1.y);
    rg.addColorStop(0, '#fff'); rg.addColorStop(1, 'rgba(255,255,255,0)');
    quad(c, v, -0.15, 0.15, near, LEN, rg);
    c.restore();
  }
  function drawPin(c, v, pin, t) {
    if (pin.gone) return;
    const p = v.p(pin.x, pin.y, pin.inGutter ? -0.06 : 0), s = p.s;
    if (p.y < 0 || p.y > v.h + 200) return;
    c.save(); c.translate(p.x, p.y);
    c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(0, 0, 0.07 * s, 0.022 * s, 0, 0, Math.PI * 2); c.fill();
    c.rotate(pin.tilt * pin.tdir);
    const g = c.createLinearGradient(-0.06 * s, 0, 0.06 * s, 0);
    g.addColorStop(0, '#d9dde3'); g.addColorStop(0.4, '#ffffff'); g.addColorStop(1, '#b8bec8');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(-0.03 * s, 0);
    c.bezierCurveTo(-0.072 * s, -0.11 * s, -0.062 * s, -0.2 * s, -0.022 * s, -0.255 * s);
    c.bezierCurveTo(-0.017 * s, -0.275 * s, -0.036 * s, -0.31 * s, -0.034 * s, -0.335 * s);
    c.arc(0, -0.338 * s, 0.034 * s, Math.PI, 0);
    c.bezierCurveTo(0.036 * s, -0.31 * s, 0.017 * s, -0.275 * s, 0.022 * s, -0.255 * s);
    c.bezierCurveTo(0.062 * s, -0.2 * s, 0.072 * s, -0.11 * s, 0.03 * s, 0);
    c.closePath(); c.fill();
    c.fillStyle = '#e23b4c';
    c.fillRect(-0.022 * s, -0.272 * s, 0.044 * s, 0.009 * s);
    c.fillRect(-0.021 * s, -0.255 * s, 0.042 * s, 0.009 * s);
    c.restore();
  }
  function drawBall(c, v, b, col, t) {
    const z = b.gutter ? BALL_R - 0.07 : BALL_R;
    const p = v.p(b.x, b.y, z), r = BALL_R * p.s;
    const sh = v.p(b.x, b.y, b.gutter ? -0.07 : 0);
    c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(sh.x, sh.y, r * 0.95, r * 0.3, 0, 0, Math.PI * 2); c.fill();
    const g = c.createRadialGradient(p.x - r * 0.35, p.y - r * 0.4, r * 0.1, p.x, p.y, r);
    g.addColorStop(0, shade(col, 0.55)); g.addColorStop(0.5, col); g.addColorStop(1, shade(col, -0.45));
    c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, r, 0, Math.PI * 2); c.fill();
    // finger holes rolling
    const ang = b.spin || 0;
    const hy = Math.cos(ang), vis = Math.sin(ang);
    if (vis > 0) {
      c.fillStyle = 'rgba(10,10,20,.7)';
      for (const [dx, dy] of [[-0.22, 0], [0.22, 0], [0, 0.32]]) {
        c.beginPath(); c.ellipse(p.x + dx * r, p.y - hy * r * 0.6 + dy * r * vis * 0.6, r * 0.09, r * 0.09 * vis, 0, 0, Math.PI * 2); c.fill();
      }
    }
  }
  function newRack() {
    return PIN_POS.map(([x, y]) => ({ x, y, vx: 0, vy: 0, hit: false, tilt: 0, tdir: 1, gone: false, inGutter: false }));
  }

  // ---------- scoring ----------
  function marks(fr, last) {
    const m = [];
    if (!last) {
      if (fr[0] === 10) return ['', 'X'];
      if (fr.length > 0) m.push(fr[0] === 0 ? '-' : String(fr[0]));
      if (fr.length > 1) m.push(fr[0] + fr[1] === 10 ? '/' : fr[1] === 0 ? '-' : String(fr[1]));
      return m;
    }
    let standing = 10;
    for (const r of fr) {
      m.push(r === standing ? (standing === 10 ? 'X' : '/') : r === 0 ? '-' : String(r));
      standing -= r; if (standing === 0) standing = 10;
    }
    return m;
  }
  function cumulative(frames, FR) {
    const rolls = frames.slice(0, FR - 1).flat(), cum = []; let s = 0, i = 0;
    const lastFr = frames[FR - 1] || [];
    const after = j => (j < rolls.length ? rolls[j] : lastFr[j - rolls.length]);
    for (let f = 0; f < FR; f++) {
      if (f === FR - 1) {
        const done = lastFr.length === 3 || (lastFr.length === 2 && lastFr[0] + lastFr[1] < 10);
        s += lastFr.reduce((a, b) => a + b, 0); cum.push(done ? s : null); continue;
      }
      const fr = frames[f] || [];
      if (!fr.length) { cum.push(null); i += 2; continue; }
      if (fr[0] === 10) {
        const b1 = after(i + 1), b2 = after(i + 2);
        if (b1 != null && b2 != null) { s += 10 + b1 + b2; cum.push(s); } else cum.push(null);
        i += 1;
      } else if (fr.length === 2) {
        if (fr[0] + fr[1] === 10) { const b1 = after(i + 2); if (b1 != null) { s += 10 + b1; cum.push(s); } else cum.push(null); }
        else { s += fr[0] + fr[1]; cum.push(s); }
        i += 2;
      } else { cum.push(null); i += 1; }
    }
    return cum;
  }
  const total = (frames, FR) => { const c = cumulative(frames, FR); let t = 0; c.forEach(v => { if (v != null) t = v; }); return t; };

  Huddle.register({
    id: 'bowling',
    name: 'Strike Lane',
    tagline: 'Ten pins. Zero shoes.',
    desc: 'Take turns bowling. Drag on your phone to line up, then flick it upwards to bowl: a faster swipe rolls harder, and swiping at an angle curves the shot. You can also hold the button, swing your arm and let go. 1–2 players play 5 frames; bigger groups play 3.',
    controls: 'line up, then swipe up / swing',
    minPlayers: 1,
    preview(c, w, h, t) {
      const f = (t * 0.45) % 1;
      const by = 0.4 + f * (LEN + 0.4);
      const v = makeView(w, h * 1.12, clamp(by - 3.2, -2.2, 12.2));
      drawLane(c, v, t);
      const pins = newRack();
      const items = pins.map(p => ({ y: p.y, d: () => drawPin(c, v, p, t) }));
      const ball = { x: Math.sin(f * 2.5) * 0.12, y: by, spin: f * 120 };
      items.push({ y: ball.y, d: () => drawBall(c, v, ball, '#2f8cff', t) });
      items.sort((a, b) => b.y - a.y).forEach(o => o.d());
    },
    create(api, players) {
      const W = api.W, H = api.H;
      const FR = players.length <= 2 ? 5 : 3;
      const frames = {}; players.forEach(p => (frames[p.id] = []));
      const S = { phase: 'intro', t: 0, cur: 0, frame: 0, aimX: 0, ball: null, pins: newRack(), cam: -2.2, msg: null, standingAtStart: 10, firstContact: false, clackT: 0, ended: false };
      const rumble = api.Sound.loop(220);
      const bowler = () => players[S.cur];

      function beginTurn() {
        const p = bowler(), fr = frames[p.id][S.frame] || (frames[p.id][S.frame] = []);
        if (fr.length === 0) S.pins = newRack();
        S.pins = S.pins.filter(q => !q.hit);
        S.standingAtStart = S.pins.length;
        S.phase = 'aim'; S.t = 0; S.ball = null; S.firstContact = false;
        S.aimX = clamp(S.aimX, -HALF + BALL_R, HALF - BALL_R);
        players.forEach(q => {
          if (q === p) api.setMode('swing', 'Drag the strip to line up, then swipe up to bowl!', [q.id]);
          else api.setMode('wait', '', [q.id], { text: `${p.name} is bowling…` });
        });
        api.buzz(p.id, 120);
      }
      function throwBall(m) {
        const speed = 4.5 + clamp(m.power, 0, 1) * 5.8;
        S.ball = { x: S.aimX, y: 0.4, vx: clamp(m.curve || 0, -1, 1) * speed * 0.028, vy: speed, hook: clamp(m.spin || 0, -1, 1) * 0.4, gutter: false, done: false, spin: 0 };
        S.phase = 'roll'; S.t = 0;
        api.sfx('whoosh');
        api.setMode('wait', '', [bowler().id], { text: 'Rolling…' });
      }
      function collide(a, b, ra, rb, ma, mb, isBall) {
        const dx = b.x - a.x, dy = b.y - a.y, rs = ra + rb, d2 = dx * dx + dy * dy;
        if (d2 >= rs * rs) return;
        const d = Math.sqrt(d2) || 1e-6, nx = dx / d, ny = dy / d, ov = rs - d, tm = ma + mb;
        a.x -= nx * ov * mb / tm; a.y -= ny * ov * mb / tm; b.x += nx * ov * ma / tm; b.y += ny * ov * ma / tm;
        const vrel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (vrel >= 0) return;
        const j = -(1 + 0.62) * vrel / (1 / ma + 1 / mb);
        a.vx -= j / ma * nx; a.vy -= j / ma * ny; b.vx += j / mb * nx; b.vy += j / mb * ny;
        const jit = Math.abs(vrel) * 0.12;
        b.vx += rand(-jit, jit);
        b.hit = true; if (a.hit !== undefined && !isBall) a.hit = true;
        if (b.tilt === 0) b.tdir = b.vx >= 0 ? 1 : -1;
        if (isBall && !S.firstContact) { S.firstContact = true; api.sfx('pins'); api.buzz(bowler().id, 120); }
        else if (Math.abs(vrel) > 0.6 && S.clackT <= 0) { api.sfx('clack'); S.clackT = 0.04; }
      }
      function step(h) {
        const b = S.ball;
        if (b && !b.done) {
          if (!b.gutter && b.y > 6) b.vx += b.hook * h;
          b.x += b.vx * h; b.y += b.vy * h; b.spin += b.vy * h / BALL_R * 0.25;
          if (!b.gutter && Math.abs(b.x) > HALF - BALL_R * 0.35) {
            b.gutter = true; b.x = Math.sign(b.x) * (HALF + GUT / 2); b.vx = 0; api.sfx('gutter');
          }
          if (b.y > LEN + 0.7) b.done = true;
        }
        for (const p of S.pins) {
          if (p.gone) continue;
          p.x += p.vx * h; p.y += p.vy * h;
          const fr = Math.pow(0.12, h); p.vx *= fr; p.vy *= fr;
          if (Math.abs(p.x) > HALF + 0.02) { p.hit = true; p.inGutter = true; p.x = clamp(p.x, -HALF - GUT * 0.6, HALF + GUT * 0.6); p.vx *= 0.3; }
          if (p.y > LEN + 0.45 || p.y < HEAD - 2.5) { p.hit = true; p.gone = true; }
        }
        if (b && !b.gutter && !b.done) for (const p of S.pins) if (!p.gone && !p.inGutter) collide(b, p, BALL_R, p.hit ? 0.085 : PIN_R, 7, 1.5, true);
        for (let i = 0; i < S.pins.length; i++) for (let j = i + 1; j < S.pins.length; j++) {
          const a = S.pins[i], c2 = S.pins[j];
          if (a.gone || c2.gone || a.inGutter || c2.inGutter) continue;
          collide(a, c2, a.hit ? 0.085 : PIN_R, c2.hit ? 0.085 : PIN_R, 1.5, 1.5, false);
        }
      }
      function scoreRoll() {
        const p = bowler(), fr = frames[p.id][S.frame];
        const knocked = S.pins.filter(q => q.hit).length;
        fr.push(knocked);
        const last = S.frame === FR - 1;
        const cleared = knocked === S.standingAtStart;
        let msg;
        if (cleared && S.standingAtStart === 10) { msg = 'STRIKE!'; api.sfx('strike'); api.buzz(p.id, 400, true); }
        else if (cleared) { msg = 'SPARE!'; api.sfx('spare'); api.buzz(p.id, 250, true); }
        else if (knocked === 0) msg = S.ball && S.ball.gutter ? 'Gutter ball' : 'Missed!';
        else msg = knocked === 1 ? '1 pin' : `${knocked} pins`;
        S.msg = { text: msg, big: cleared, col: cleared ? p.color : '#fff' };
        let done;
        if (!last) done = fr[0] === 10 || fr.length === 2;
        else done = fr.length === 3 || (fr.length === 2 && fr[0] + fr[1] < 10);
        S.nextAction = done ? 'next' : (cleared ? 'rerack' : 'again');
        S.phase = 'show'; S.t = 0;
      }
      function advance() {
        if (S.nextAction === 'rerack') { S.pins = newRack(); beginTurnKeep(); return; }
        if (S.nextAction === 'again') { beginTurnKeep(); return; }
        S.cur++;
        if (S.cur >= players.length) { S.cur = 0; S.frame++; }
        if (S.frame >= FR) { finish(); return; }
        S.aimX = 0;
        beginTurn();
      }
      function beginTurnKeep() {
        // next roll by the same bowler, keeping whatever pins are standing
        S.pins = S.pins.filter(q => !q.hit);
        S.standingAtStart = S.pins.length;
        S.phase = 'aim'; S.t = 0; S.ball = null; S.firstContact = false;
        api.setMode('swing', 'Drag the strip to line up, then swipe up to bowl!', [bowler().id]);
      }
      function finish() {
        if (S.ended) return; S.ended = true;
        rumble.stop();
        api.end(players.map(p => { const s = total(frames[p.id], FR); return { p, score: s, label: s + ' pts' }; }).sort((a, b) => b.score - a.score));
      }

      return {
        destroy() { rumble.stop(); },
        debug: () => ({ phase: S.phase, cur: bowler().name, frame: S.frame, frames: JSON.parse(JSON.stringify(frames)) }),
        update(dt) {
          S.t += dt; S.clackT -= dt;
          if (S.phase === 'intro' && S.t > 1.2) beginTurn();
          if (S.phase === 'roll' || S.phase === 'show') {
            const n = 8; for (let i = 0; i < n; i++) step(dt / n);
            for (const p of S.pins) if (p.hit && p.tilt < Math.PI / 2) p.tilt = Math.min(Math.PI / 2, p.tilt + dt * 7);
          }
          if (S.phase === 'roll') {
            const b = S.ball;
            rumble.set(b.done ? 0 : 0.22 * clamp(18 / (b.y - S.cam + 2), 0.2, 1), b.gutter ? 140 : 260);
            const still = S.pins.every(p => p.gone || Math.hypot(p.vx, p.vy) < 0.05);
            if (b.done && (still || S.t > 6)) { rumble.set(0); scoreRoll(); }
          }
          if (S.phase === 'show' && S.t > 2.2) advance();
          // camera follow
          const target = S.ball ? clamp(S.ball.y - 3.2, -2.2, 12.4) : -2.2;
          const speed = S.phase === 'aim' ? 3 : 2.2;
          S.cam += (target - S.cam) * Math.min(1, dt * speed);
        },
        input(p, m) {
          if (p !== bowler() || S.phase !== 'aim') return;
          if (m.t === 'p') S.aimX = clamp(S.aimX + m.dx * 0.0011, -HALF + BALL_R, HALF - BALL_R);
          if (m.t === 'swing' && S.t > 0.3) throwBall(m);
        },
        draw(c, t) {
          const v = makeView(W, H, S.cam);
          drawLane(c, v, t);
          const bp = bowler();
          const items = S.pins.map(q => ({ y: q.y, d: () => drawPin(c, v, q, t) }));
          const ball = S.ball || (S.phase === 'aim' ? { x: S.aimX, y: 0.4, spin: 0, gutter: false } : null);
          if (ball && !ball.done) items.push({ y: ball.y, d: () => drawBall(c, v, ball, bp.color, t) });
          if (S.phase === 'aim') {
            c.fillStyle = 'rgba(255,255,255,.7)';
            for (let y = 1; y < 9; y += 0.6) {
              const q = v.p(S.aimX, y + ((t * 1.5) % 0.6));
              c.beginPath(); c.ellipse(q.x, q.y, 0.025 * q.s, 0.01 * q.s, 0, 0, Math.PI * 2); c.fill();
            }
          }
          items.sort((a, b) => b.y - a.y).forEach(o => o.d());

          // scorecard for the current bowler
          const fr = frames[bp.id], cum = cumulative(fr, FR);
          const bw = 86, cx0 = 300, cy0 = 34;
          c.save(); c.shadowColor = 'rgba(0,0,0,.3)'; c.shadowBlur = 20;
          rr(c, 30, 24, cx0 + FR * bw + 140, 160, 28); c.fillStyle = 'rgba(255,255,255,.95)'; c.fill(); c.restore();
          avatar(c, bp, 90, 104, 44, 'happy', t);
          text(c, bp.name, 150, 80, 36, '#33404d', 'left', 900);
          text(c, `Frame ${S.frame + 1} of ${FR}`, 150, 124, 24, '#8994a1', 'left', 800);
          for (let f = 0; f < FR; f++) {
            const x = cx0 + f * bw;
            c.strokeStyle = f === S.frame ? bp.color : '#cfd8e1'; c.lineWidth = f === S.frame ? 4 : 2;
            c.strokeRect(x, cy0 + 10, bw - 6, 120);
            const mk = marks(fr[f] || [], f === FR - 1);
            const n = f === FR - 1 ? 3 : 2;
            for (let r = 0; r < n; r++) {
              const bx = x + (bw - 6) - (n - r) * 26;
              c.strokeStyle = '#dbe2ea'; c.lineWidth = 2; c.strokeRect(bx, cy0 + 10, 26, 34);
              const off = f === FR - 1 ? r : r;
              if (mk[off]) text(c, mk[off], bx + 13, cy0 + 29, 24, mk[off] === 'X' || mk[off] === '/' ? bp.color : '#4a5866', 'center', 900);
            }
            if (cum[f] != null) text(c, String(cum[f]), x + (bw - 6) / 2, cy0 + 92, 34, '#33404d', 'center', 900);
          }
          text(c, String(total(fr, FR)), cx0 + FR * bw + 60, cy0 + 72, 54, bp.color, 'center', 900);
          // standings
          if (players.length > 1) {
            const sorted = players.slice();
            c.save(); c.shadowColor = 'rgba(0,0,0,.3)'; c.shadowBlur = 20;
            rr(c, W - 330, 24, 300, 30 + sorted.length * 56, 28); c.fillStyle = 'rgba(255,255,255,.92)'; c.fill(); c.restore();
            sorted.forEach((p, i) => {
              const y = 66 + i * 56;
              if (p === bp) { c.fillStyle = 'rgba(47,140,255,.12)'; rr(c, W - 318, y - 24, 276, 48, 24); c.fill(); }
              avatar(c, p, W - 290, y, 18, 'happy', t);
              text(c, p.name, W - 260, y + 2, 26, '#4a5866', 'left', 800);
              text(c, String(total(frames[p.id], FR)), W - 54, y + 2, 30, p.color, 'right', 900);
            });
          }
          if (S.phase === 'aim') {
            const a = 0.6 + 0.4 * Math.sin(t * 4);
            c.globalAlpha = a; outlined(c, `${bp.name}: line up, then swipe up!`, W / 2, H - 70, 50, '#fff', '#1b2036', 10); c.globalAlpha = 1;
          }
          if (S.phase === 'show' && S.msg) {
            const k = Math.min(1, S.t * 4), s = S.msg.big ? 1 + 0.15 * Math.sin(S.t * 10) * Math.max(0, 1 - S.t) : 1;
            c.save(); c.translate(W / 2, H * 0.5); c.scale(k * s, k * s);
            outlined(c, S.msg.text, 0, 0, S.msg.big ? 200 : 110, S.msg.col, S.msg.big ? '#fff' : '#1b2036', 20);
            c.restore();
          }
        },
      };
    },
  });
})();
