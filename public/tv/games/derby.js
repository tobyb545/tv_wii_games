// Derby Dash — the fairground horse race. Roll balls up your board into the holes: the harder the hole, the further your horse gallops.
(() => {
  const { clamp, lerp, rand, rr, text, outlined, avatar, shade } = Huddle.helpers;
  const FINISH = 24, LIMIT = 150;
  // holes on the board: x from -1 (left) to 1 (right), d from 0 (bottom) to 1 (top)
  const HOLES = [
    { x: -0.62, d: 0.38, v: 1 }, { x: 0, d: 0.38, v: 1 }, { x: 0.62, d: 0.38, v: 1 },
    { x: -0.33, d: 0.62, v: 2 }, { x: 0.33, d: 0.62, v: 2 },
    { x: 0, d: 0.85, v: 3 },
  ];
  const HOLE_COL = { 1: '#2f8cff', 2: '#ffb020', 3: '#ff4d5e' };
  const RX = 0.17, RD = 0.075;

  function horse(c, x, y, s, col, ph, moving) {
    c.save(); c.translate(x, y); c.scale(s, s);
    const bob = moving ? Math.sin(ph * 2) * 3 : 0;
    c.translate(0, bob);
    c.strokeStyle = shade(col, -0.35); c.lineWidth = 6; c.lineCap = 'round';
    const sw = moving ? Math.sin(ph) * 0.7 : 0.1;
    [[-26, sw], [-16, -sw], [18, -sw], [28, sw]].forEach(([lx, a]) => {
      c.beginPath(); c.moveTo(lx, 8); c.lineTo(lx + Math.sin(a) * 18, 8 + Math.cos(a) * 26); c.stroke();
    });
    // tail
    c.lineWidth = 7; c.beginPath(); c.moveTo(-38, -4); c.quadraticCurveTo(-58, -2 + Math.sin(ph * 2) * 6, -54, 22); c.stroke();
    // body
    c.fillStyle = col;
    c.beginPath(); c.ellipse(0, 0, 42, 19, 0, 0, Math.PI * 2); c.fill();
    // neck + head
    c.beginPath(); c.moveTo(22, -12); c.lineTo(46, -40); c.lineTo(58, -30); c.lineTo(38, 4); c.closePath(); c.fill();
    c.save(); c.translate(60, -36); c.rotate(0.45); c.beginPath(); c.ellipse(0, 0, 18, 10, 0, 0, Math.PI * 2); c.fill(); c.restore();
    c.fillStyle = shade(col, -0.35);
    c.beginPath(); c.moveTo(46, -50); c.lineTo(52, -58); c.lineTo(54, -46); c.fill(); // ear
    c.beginPath(); c.moveTo(24, -14); c.quadraticCurveTo(36, -48, 48, -46); c.lineTo(44, -36); c.quadraticCurveTo(36, -24, 30, -8); c.fill(); // mane
    c.fillStyle = '#1e2630'; c.beginPath(); c.arc(62, -40, 2.6, 0, Math.PI * 2); c.fill();
    // saddle cloth
    c.fillStyle = '#fff'; rr(c, -14, -16, 26, 22, 5); c.fill();
    c.restore();
  }

  function boardRect(i, n, W) {
    const bw = Math.min(300, (W - 120) / n - 18), gap = 18;
    const total = n * bw + (n - 1) * gap;
    return { x: W / 2 - total / 2 + i * (bw + gap), y: 640, w: bw, h: 400 };
  }
  function toBoard(r, x, d) { // board coords -> screen; board narrows slightly towards the top
    const inset = 0.12 * d;
    return { x: r.x + r.w / 2 + x * (r.w / 2 - 22) * (1 - inset), y: r.y + r.h - 50 - d * (r.h - 110), k: 1 - inset * 0.8 };
  }

  Huddle.register({
    id: 'derby',
    name: 'Derby Dash',
    tagline: 'Roll up, roll up!',
    desc: 'The fairground horse race. Everyone has a ball board, and swiping up on your phone rolls a ball up it. Land in a blue hole to move your horse 1 step, yellow for 2, or the red hole at the top for 3. Swipe harder to roll further, and drag the strip to aim left or right. The first horse past the finish wins.',
    controls: 'drag to aim · swipe up to roll',
    minPlayers: 1,
    preview(c, w, h, t) {
      const k = h / 208;
      const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#1f2f5a'); g.addColorStop(1, '#3b4f8a');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 12; i++) { c.fillStyle = i % 2 ? '#ff4d5e' : '#fff'; c.fillRect(i * w / 12, 0, w / 12, 22 * k); }
      for (let i = 0; i < 14; i++) { c.fillStyle = Math.floor(t * 4 + i) % 2 ? '#ffe27a' : '#a8873a'; c.beginPath(); c.arc((i + 0.5) * w / 14, 28 * k, 3.5 * k, 0, Math.PI * 2); c.fill(); }
      const cols = ['#ffb020', '#2fc46b', '#2f8cff'];
      cols.forEach((col, i) => {
        const y = h * (0.36 + i * 0.2);
        c.fillStyle = i % 2 ? '#3f7a3a' : '#468a40'; c.fillRect(0, y - 20 * k, w, 40 * k);
        const x = w * (0.18 + ((t * (0.08 + i * 0.025)) % 0.7));
        horse(c, x, y, 0.55 * k, col, t * 12 + i, true);
      });
      c.fillStyle = '#fff';
      for (let j = 0; j < 8; j++) { c.fillStyle = j % 2 ? '#fff' : '#1e2630'; c.fillRect(w * 0.9, h * 0.26 + j * h * 0.075, 8 * k, h * 0.075); }
    },
    create(api, players) {
      const W = api.W, H = api.H;
      const solo = players.length === 1;
      const S = { phase: 'intro', t: 0, time: 0, ended: false, order: [], house: null, confetti: [] };
      const R = players.map((p, i) => ({ p, i, steps: 0, shown: 0, ph: rand(6), aim: 0, ball: null, last: null, rolls: 0, finished: 0 }));
      if (solo) S.house = { steps: 0, shown: 0, ph: 0, next: 2.4, finished: 0 };
      const racers = () => R.length;

      api.setMode('wait', '', null, { text: 'The horses are lining up…' });

      function startRace() {
        S.phase = 'race'; S.t = 0;
        api.setMode('swing', 'Drag to aim · swipe up to roll the ball', null, { text: 'Swipe up to roll', aimText: '◀ drag to aim ▶' });
        api.sfx('go');
      }
      function roll(r, m) {
        if (r.ball || r.finished) return;
        const power = clamp(+m.power || 0, 0, 1);
        const D = clamp(power * 1.05 + rand(-0.035, 0.035), 0.05, 1.08);
        const curve = clamp(+m.curve || 0, -1, 1) * 0.22 + (m.spin ? clamp(+m.spin, -1, 1) * 0.15 : 0);
        const endX = clamp(r.aim + curve, -0.95, 0.95);
        r.ball = { x0: r.aim, x1: endX, D, t: 0, up: 0.45 + D * 0.4, state: 'up' };
        r.rolls++;
        api.sfx('whoosh');
      }
      function land(r) {
        const b = r.ball;
        const hole = b.D <= 1 ? HOLES.find(h => ((b.x1 - h.x) / RX) ** 2 + ((b.D - h.d) / RD) ** 2 <= 1) : null;
        if (hole) {
          b.state = 'drop'; b.t = 0; b.hole = hole;
          r.steps = Math.min(FINISH, r.steps + hole.v);
          r.last = { v: hole.v, t: 0 };
          api.sfx(hole.v === 3 ? 'gold' : 'catch'); api.buzz(r.p.id, 40 + hole.v * 30, hole.v === 3);
          if (r.steps >= FINISH && !r.finished) { r.finished = S.order.length + 1; S.order.push(r); }
        } else {
          b.state = 'back'; b.t = 0;
          r.last = { v: 0, t: 0 };
          api.sfx(b.D > 1 ? 'clack' : 'miss');
        }
      }
      function finish() {
        if (S.ended) return; S.ended = true;
        const rows = R.map(r => ({ p: r.p, score: r.finished ? 1000 - r.finished : r.steps, label: r.finished === 1 ? 'Winner!' : r.finished ? `Finished #${r.finished}` : `${r.steps} / ${FINISH}` }));
        api.end(rows.sort((a, b) => b.score - a.score), { title: S.house && S.house.finished && !R[0].finished ? 'Lucky Star wins!' : 'Results' });
      }

      return {
        update(dt) {
          S.t += dt;
          for (const q of S.confetti) { q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 300 * dt; q.life -= dt; }
          S.confetti = S.confetti.filter(q => q.life > 0);
          if (S.phase === 'intro' && S.t > 3.2) startRace();
          for (const r of R) {
            const moving = r.shown < r.steps - 0.01;
            r.shown = Math.min(r.steps, r.shown + dt * 2.6);
            r.ph += dt * (moving ? 14 : 2);
            if (r.last) r.last.t += dt;
            const b = r.ball;
            if (b) {
              b.t += dt;
              if (b.state === 'up' && b.t >= b.up) land(r);
              else if (b.state === 'drop' && b.t > 0.35) r.ball = null;
              else if (b.state === 'back' && b.t > 0.55) r.ball = null;
            }
          }
          if (S.house) {
            const h = S.house;
            const moving = h.shown < h.steps - 0.01;
            h.shown = Math.min(h.steps, h.shown + dt * 2.6); h.ph += dt * (moving ? 14 : 2);
            if (S.phase === 'race' && !h.finished) {
              h.next -= dt;
              if (h.next <= 0) { h.steps = Math.min(FINISH, h.steps + (Math.random() < 0.25 ? 2 : 1)); h.next = rand(1.4, 2.6); if (h.steps >= FINISH) h.finished = 1; }
            }
          }
          if (S.phase === 'race') {
            S.time += dt;
            const done = S.order.length > 0 || (S.house && S.house.finished) || S.time > LIMIT;
            if (done) {
              S.phase = 'finish'; S.t = 0;
              const w = S.order[0];
              api.setMode('wait', '', null, { text: w ? `${w.p.name} wins the derby!` : S.time > LIMIT ? 'Time’s up!' : 'Lucky Star wins!' });
              if (w) api.setMode('wait', '', [w.p.id], { text: 'Your horse won! 🏆' });
              api.sfx('win');
              for (let i = 0; i < 90; i++) S.confetti.push({ x: W * 0.82, y: 300, vx: rand(-500, 500), vy: rand(-700, -150), life: rand(1, 2.5), col: ['#ff4d5e', '#ffd43b', '#2fc46b', '#2f8cff', '#fff'][i % 5] });
            }
          }
          if (S.phase === 'finish' && S.t > 3.5) finish();
        },
        input(p, m) {
          const r = R.find(q => q.p === p); if (!r) return;
          if (m.t === 'p' && S.phase !== 'finish') r.aim = clamp(r.aim + m.dx / 320, -0.85, 0.85);
          if (m.t === 'swing' && S.phase === 'race') roll(r, m);
        },
        draw(c, t) {
          // night sky + tent
          const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#16224a'); g.addColorStop(1, '#2e3f78');
          c.fillStyle = g; c.fillRect(0, 0, W, H);
          for (let i = 0; i < 24; i++) {
            c.fillStyle = i % 2 ? '#ff4d5e' : '#fff8ec';
            c.beginPath(); c.moveTo(i * W / 24, 0); c.lineTo((i + 1) * W / 24, 0); c.lineTo((i + 0.5) * W / 24, 70); c.closePath(); c.fill();
          }
          for (let i = 0; i < 40; i++) {
            const on = Math.floor(t * 5 + i) % 3 !== 0;
            c.fillStyle = on ? '#ffe27a' : '#8a6d2a';
            if (on) { c.shadowColor = '#ffd43b'; c.shadowBlur = 12; }
            c.beginPath(); c.arc((i + 0.5) * W / 40, 84, 7, 0, Math.PI * 2); c.fill(); c.shadowBlur = 0;
          }
          // track
          const n = R.length + (S.house ? 1 : 0);
          const ty = 110, th = 500, lh = Math.min(80, th / n);
          const tx0 = 260, tx1 = W - 170;
          const top = ty + (th - lh * n) / 2;
          for (let i = 0; i < n; i++) {
            c.fillStyle = i % 2 ? '#3f7a3a' : '#4a8c43'; c.fillRect(0, top + i * lh, W, lh);
            c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(0, top + i * lh, W, 2);
          }
          for (let s = 0; s <= FINISH; s += 4) {
            const x = lerp(tx0, tx1, s / FINISH);
            c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(x - 1, top, 2, lh * n);
          }
          for (let j = 0; j < Math.ceil(lh * n / 16); j++) for (let k2 = 0; k2 < 2; k2++) { c.fillStyle = (j + k2) % 2 ? '#fff' : '#1e2630'; c.fillRect(tx1 + 40 + k2 * 12, top + j * 16, 12, 16); }
          const lane = (name, col, steps, shown, ph, i, who) => {
            const y = top + i * lh + lh / 2;
            const x = lerp(tx0, tx1, shown / FINISH);
            const s = Math.min(1, lh / 80);
            horse(c, x, y + 4 * s, 0.9 * s, col, ph, shown < steps - 0.01);
            if (who) avatar(c, who, x - 2 * s, y - 24 * s, 15 * s, 'happy', t);
            text(c, name, 30, y, Math.min(30, lh * 0.42), '#fff', 'left', 900);
          };
          R.forEach((r, i) => lane(r.p.name, r.p.color, r.steps, r.shown, r.ph, i, r.p));
          if (S.house) lane('Lucky Star', '#d9c7a3', S.house.steps, S.house.shown, S.house.ph, R.length, null);

          // ball boards
          R.forEach((r, i) => {
            const b = boardRect(i, R.length, W);
            c.save(); c.shadowColor = 'rgba(0,0,0,.35)'; c.shadowBlur = 20;
            c.fillStyle = '#7a4b22'; rr(c, b.x, b.y, b.w, b.h, 22); c.fill(); c.restore();
            c.fillStyle = shade(r.p.color, -0.15);
            c.beginPath();
            const bl = toBoard(b, -1, 0), br = toBoard(b, 1, 0), tl = toBoard(b, -1, 1), tr = toBoard(b, 1, 1);
            c.moveTo(bl.x - 10, bl.y + 30); c.lineTo(br.x + 10, br.y + 30); c.lineTo(tr.x + 10, tr.y - 24); c.lineTo(tl.x - 10, tl.y - 24); c.closePath(); c.fill();
            for (const h of HOLES) {
              const q = toBoard(b, h.x, h.d), rx = RX * (b.w / 2 - 22) * q.k, ry = RD * (b.h - 110);
              c.fillStyle = HOLE_COL[h.v];
              c.beginPath(); c.ellipse(q.x, q.y, rx + 6, ry + 6, 0, 0, Math.PI * 2); c.fill();
              c.fillStyle = '#1b1208'; c.beginPath(); c.ellipse(q.x, q.y + 2, rx, ry, 0, 0, Math.PI * 2); c.fill();
              text(c, String(h.v), q.x, q.y - ry - 16, 20, '#fff', 'center', 900);
            }
            // aim arrow
            const a = toBoard(b, r.aim, 0);
            c.fillStyle = 'rgba(255,255,255,.85)';
            c.beginPath(); c.moveTo(a.x, a.y - 4); c.lineTo(a.x - 12, a.y + 16); c.lineTo(a.x + 12, a.y + 16); c.closePath(); c.fill();
            // ball
            const ball = r.ball;
            if (ball) {
              let x, d, sc = 1;
              if (ball.state === 'up') { const f = clamp(ball.t / ball.up, 0, 1), e = 1 - (1 - f) * (1 - f); x = lerp(ball.x0, ball.x1, e); d = ball.D * e; }
              else if (ball.state === 'drop') { x = ball.hole.x; d = ball.hole.d; sc = 1 - clamp(ball.t / 0.35, 0, 1) * 0.7; }
              else { const f = clamp(ball.t / 0.55, 0, 1); x = ball.x1; d = Math.min(1, ball.D) * (1 - f * f); }
              const q = toBoard(b, x, Math.min(1.02, d));
              const br2 = 14 * q.k * sc;
              const bg = c.createRadialGradient(q.x - br2 * 0.3, q.y - br2 * 0.3, 1, q.x, q.y, br2);
              bg.addColorStop(0, '#fff'); bg.addColorStop(1, '#c9d3dd');
              c.fillStyle = bg; c.beginPath(); c.arc(q.x, q.y, br2, 0, Math.PI * 2); c.fill();
            }
            text(c, r.p.name, b.x + b.w / 2, b.y + b.h - 18, 24, '#ffe9c9', 'center', 900);
            if (r.last && r.last.t < 1.2) {
              const al = clamp(1.6 - r.last.t * 1.3, 0, 1);
              c.globalAlpha = al;
              outlined(c, r.last.v ? `+${r.last.v}` : 'miss', b.x + b.w / 2, b.y + 40 - r.last.t * 30, r.last.v ? 54 : 36, r.last.v ? HOLE_COL[r.last.v] : '#c9d3dd', '#fff', 8);
              c.globalAlpha = 1;
            }
          });
          for (const q of S.confetti) { c.globalAlpha = clamp(q.life, 0, 1); c.fillStyle = q.col; c.fillRect(q.x - 6, q.y - 4, 12, 8); }
          c.globalAlpha = 1;
          if (S.phase === 'race') text(c, `${Math.max(0, Math.ceil(LIMIT - S.time))}s`, W - 40, 130, 32, 'rgba(255,255,255,.7)', 'right', 900);
          if (S.phase === 'intro') {
            const cd = 3 - Math.floor(S.t);
            outlined(c, S.t < 1.2 ? 'And they’re off in…' : cd > 0 ? String(cd) : 'GO!', W / 2, 360, S.t < 1.2 ? 90 : 170, '#ffd43b', '#7a2b00', 14);
            if (cd !== S.lastCd && S.t > 1.2) { S.lastCd = cd; api.sfx('count'); }
          }
          if (S.phase === 'finish') {
            const w = S.order[0];
            outlined(c, w ? `${w.p.name} wins!` : S.house && S.house.finished ? 'Lucky Star wins!' : 'Time’s up!', W / 2, 360, 120, '#ffd43b', '#7a2b00', 16);
          }
        },
        debug() { return { phase: S.phase, time: Math.round(S.time), steps: R.map(r => r.steps), rolls: R.map(r => r.rolls), house: S.house && S.house.steps }; },
      };
    },
  });
})();
