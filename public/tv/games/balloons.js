// Balloon Blitz — point & shoot, everybody at once.
(() => {
  const { clamp, rand, pick, rr, text, outlined, shade, avatar } = Huddle.helpers;
  const COLS = ['#ff4d5e', '#2f8cff', '#2fc46b', '#ffb020', '#a35cff', '#ff5fb4', '#16c2b0'];
  const DURATION = 45;

  function sky(c, w, h, t) {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#5ab8ff'); g.addColorStop(1, '#cdeeff');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(255,255,255,.85)';
    for (let i = 0; i < 5; i++) {
      const s = h / 1080;
      const x = ((i * 520 + t * (18 + i * 6)) % (w + 600)) - 300, y = h * (0.12 + (i % 3) * 0.2);
      for (const [dx, dy, r] of [[0, 0, 70], [70, -20, 90], [150, 0, 70], [80, 25, 70]]) {
        c.beginPath(); c.arc(x + dx * s * 1.4, y + dy * s * 1.4, r * s * 1.4, 0, Math.PI * 2); c.fill();
      }
    }
    // hills
    c.fillStyle = '#7fd36b';
    c.beginPath(); c.moveTo(0, h);
    for (let x = 0; x <= w; x += w / 40) c.lineTo(x, h * 0.9 - Math.sin(x / w * 7 + 1) * h * 0.04);
    c.lineTo(w, h); c.fill();
  }
  function balloon(c, x, y, r, col, t, kind) {
    c.save(); c.translate(x, y);
    // string
    c.strokeStyle = 'rgba(80,90,100,.6)'; c.lineWidth = Math.max(1, r * 0.04);
    c.beginPath(); c.moveTo(0, r * 1.05);
    c.bezierCurveTo(r * 0.3 * Math.sin(t * 3), r * 1.6, -r * 0.3 * Math.sin(t * 3), r * 2.1, 0, r * 2.6); c.stroke();
    const g = c.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r * 1.1);
    if (kind === 'bomb') { g.addColorStop(0, '#6b7280'); g.addColorStop(1, '#1f2430'); }
    else if (kind === 'gold') { g.addColorStop(0, '#fff5bf'); g.addColorStop(0.5, '#ffd23f'); g.addColorStop(1, '#d99a00'); }
    else { g.addColorStop(0, shade(col, 0.45)); g.addColorStop(1, col); }
    c.fillStyle = g;
    c.beginPath(); c.ellipse(0, 0, r * 0.86, r, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.moveTo(-r * 0.12, r * 1.08); c.lineTo(r * 0.12, r * 1.08); c.lineTo(0, r * 0.94); c.fill();
    c.fillStyle = 'rgba(255,255,255,.55)';
    c.beginPath(); c.ellipse(-r * 0.35, -r * 0.42, r * 0.16, r * 0.28, -0.5, 0, Math.PI * 2); c.fill();
    if (kind === 'bomb') {
      c.strokeStyle = '#ff5a5a'; c.lineWidth = r * 0.12; c.lineCap = 'round';
      c.beginPath(); c.moveTo(-r * 0.3, -r * 0.2); c.lineTo(r * 0.3, r * 0.3); c.moveTo(r * 0.3, -r * 0.2); c.lineTo(-r * 0.3, r * 0.3); c.stroke();
    }
    if (kind === 'gold') { c.fillStyle = '#b37400'; c.font = `900 ${r * 0.7}px ${Huddle.FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('5', 0, 4); }
    c.restore();
  }

  Huddle.register({
    id: 'balloons',
    name: 'Balloon Blitz',
    tagline: 'Point. Pop. Brag.',
    desc: 'Balloons drift up the screen. Aim by pointing your phone (or dragging on it) and press A to pop them. Gold balloons are worth 5 points, and black ones take 3 off. You have 45 seconds.',
    controls: 'point & press A',
    minPlayers: 1,
    preview(c, w, h, t) {
      sky(c, w, h, t);
      const k = h / 208;
      for (let i = 0; i < 7; i++) {
        const x = ((i * 0.15 + 0.05) % 1) * w + Math.sin(t + i) * 10 * k;
        const y = h + 40 * k - ((t * 28 * k + i * 61 * k) % (h + 120 * k));
        balloon(c, x, y, (22 + (i % 3) * 5) * k, COLS[i % COLS.length], t + i, i === 3 ? 'gold' : i === 5 ? 'bomb' : '');
      }
    },
    create(api, players) {
      const W = api.W, H = api.H;
      const S = { phase: 'count', t: 3, time: DURATION, balloons: [], parts: [], floats: [], spawnT: 0, scores: {}, ended: false };
      players.forEach(p => (S.scores[p.id] = 0));
      api.setMode('pointer', 'Aim at balloons and press A to pop!');
      let lastCount = 4;

      function spawn() {
        const r = Math.random();
        const kind = r < 0.07 ? 'gold' : r < 0.17 ? 'bomb' : '';
        const rad = kind === 'gold' ? 36 : rand(46, 62);
        S.balloons.push({
          x: rand(120, W - 120), y: H + 90, r: rad, kind, col: pick(COLS),
          vy: kind === 'gold' ? rand(320, 400) : rand(110, 190) + (DURATION - S.time) * 2.2,
          ph: rand(10), wob: rand(14, 40),
        });
      }
      function burst(x, y, col, n = 18) {
        for (let i = 0; i < n; i++) {
          const a = rand(Math.PI * 2), s = rand(160, 520);
          S.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.4, 0.8), col, r: rand(5, 11) });
        }
      }
      return {
        update(dt) {
          if (S.phase === 'count') {
            S.t -= dt;
            const n = Math.ceil(S.t);
            if (n !== lastCount) { lastCount = n; api.sfx(n > 0 ? 'count' : 'go'); }
            if (S.t <= 0) S.phase = 'play';
          } else if (S.phase === 'play') {
            S.time -= dt;
            S.spawnT -= dt;
            if (S.spawnT <= 0) { spawn(); S.spawnT = 0.5 / (1 + players.length * 0.22); }
            if (S.time <= 0) { S.phase = 'done'; S.t = 2; api.sfx('go'); }
          } else if (S.phase === 'done') {
            S.t -= dt;
            if (S.t <= 0 && !S.ended) {
              S.ended = true;
              api.end(players.map(p => ({ p, score: S.scores[p.id], label: S.scores[p.id] + ' pts' })).sort((a, b) => b.score - a.score));
              return;
            }
          }
          for (const b of S.balloons) { b.y -= b.vy * dt; b.x += Math.sin(api.time * 1.6 + b.ph) * b.wob * dt; }
          S.balloons = S.balloons.filter(b => b.y > -200);
          for (const q of S.parts) { q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 900 * dt; q.life -= dt; }
          S.parts = S.parts.filter(q => q.life > 0);
          for (const f of S.floats) { f.y -= 80 * dt; f.life -= dt; }
          S.floats = S.floats.filter(f => f.life > 0);
        },
        input(p, m) {
          if (!(m.t === 'btn' && m.b === 'a' && m.d) || S.phase !== 'play') return;
          let hit = null;
          for (let i = S.balloons.length - 1; i >= 0; i--) {
            const b = S.balloons[i];
            const dx = (p.cx - b.x) / (b.r * 0.86), dy = (p.cy - b.y) / b.r;
            if (dx * dx + dy * dy <= 1.25) { hit = b; break; }
          }
          if (!hit) { api.sfx('miss'); S.parts.push({ x: p.cx, y: p.cy, vx: 0, vy: 0, life: 0.2, col: 'rgba(255,255,255,.8)', r: 16 }); return; }
          S.balloons.splice(S.balloons.indexOf(hit), 1);
          const pts = hit.kind === 'gold' ? 5 : hit.kind === 'bomb' ? -3 : 1;
          S.scores[p.id] += pts;
          burst(hit.x, hit.y, hit.kind === 'bomb' ? '#444' : hit.kind === 'gold' ? '#ffd23f' : hit.col, hit.kind === 'gold' ? 30 : 18);
          S.floats.push({ x: hit.x, y: hit.y, txt: (pts > 0 ? '+' : '') + pts, col: pts < 0 ? '#ff4d5e' : p.color, life: 0.9 });
          api.sfx(hit.kind === 'gold' ? 'gold' : hit.kind === 'bomb' ? 'bad' : 'pop');
          api.buzz(p.id, hit.kind === 'bomb' ? 250 : 35);
        },
        draw(c, t) {
          sky(c, W, H, t);
          for (const b of S.balloons) balloon(c, b.x, b.y, b.r, b.col, t + b.ph, b.kind);
          for (const q of S.parts) { c.globalAlpha = Math.min(1, q.life * 2); c.fillStyle = q.col; c.beginPath(); c.arc(q.x, q.y, q.r, 0, Math.PI * 2); c.fill(); }
          c.globalAlpha = 1;
          for (const f of S.floats) { c.globalAlpha = Math.min(1, f.life * 2); outlined(c, f.txt, f.x, f.y, 56, f.col, '#fff', 10); }
          c.globalAlpha = 1;
          // crosshairs
          for (const p of players) {
            if (!p.connected) continue;
            c.save(); c.translate(p.cx, p.cy);
            c.strokeStyle = '#fff'; c.lineWidth = 12;
            c.beginPath(); c.arc(0, 0, 34, 0, Math.PI * 2); c.stroke();
            c.strokeStyle = p.color; c.lineWidth = 7; c.stroke();
            for (const a of [0, 1, 2, 3]) {
              c.save(); c.rotate(a * Math.PI / 2);
              c.strokeStyle = '#fff'; c.lineWidth = 11; c.beginPath(); c.moveTo(22, 0); c.lineTo(52, 0); c.stroke();
              c.strokeStyle = p.color; c.lineWidth = 6; c.stroke(); c.restore();
            }
            c.fillStyle = p.color; c.beginPath(); c.arc(0, 0, 6, 0, Math.PI * 2); c.fill();
            outlined(c, String(p.slot + 1), 46, -46, 32, p.color, '#fff', 8);
            c.restore();
          }
          // HUD
          c.save(); c.shadowColor = 'rgba(0,0,0,.15)'; c.shadowBlur = 16;
          rr(c, W / 2 - 110, 20, 220, 100, 50); c.fillStyle = '#fff'; c.fill(); c.restore();
          text(c, String(Math.max(0, Math.ceil(S.time))), W / 2, 72, 64, S.time < 10 ? '#ff4d5e' : '#3a4654', 'center', 900);
          const n = players.length, cw = Math.min(210, (W - 360) / n);
          players.forEach((p, i) => {
            const left = i < Math.ceil(n / 2);
            const idx = left ? i : i - Math.ceil(n / 2);
            const x = left ? 30 + idx * (cw + 10) : W - 30 - cw - idx * (cw + 10);
            c.save(); c.shadowColor = 'rgba(0,0,0,.12)'; c.shadowBlur = 12;
            rr(c, x, 26, cw, 86, 43); c.fillStyle = '#fff'; c.fill(); c.restore();
            avatar(c, p, x + 43, 69, 28, 'happy', t);
            text(c, String(S.scores[p.id]), x + cw - 24, 72, 44, p.color, 'right', 900);
          });
          if (S.phase === 'count') {
            const n2 = Math.ceil(S.t), f = S.t % 1;
            outlined(c, n2 > 0 ? String(n2) : 'GO!', W / 2, H / 2, 220 + f * 60, '#3a4654', '#fff', 22);
          }
          if (S.phase === 'play' && S.time > DURATION - 0.7) outlined(c, 'GO!', W / 2, H / 2, 240, '#2fc46b', '#fff', 22);
          if (S.phase === 'done') outlined(c, "Time's up!", W / 2, H / 2, 170, '#ff4d5e', '#fff', 22);
        },
      };
    },
  });
})();
