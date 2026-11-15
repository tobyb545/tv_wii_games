// Pump & Pop — hold to inflate, let go to bank. Push your luck too far and it pops.
(() => {
  const { clamp, rand, rr, text, outlined, avatar, shade } = Huddle.helpers;
  const ROUNDS = 5, RATE = 22, START_WINDOW = 12;

  function balloonShape(c, x, y, r, col, wob, t) {
    const sx = 1 + Math.sin(t * 40) * wob * 0.04, sy = 1 + Math.cos(t * 37) * wob * 0.04;
    c.save(); c.translate(x, y); c.scale(sx, sy);
    const g = c.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r * 1.1);
    g.addColorStop(0, shade(col, 0.45)); g.addColorStop(1, col);
    c.fillStyle = g;
    c.beginPath(); c.ellipse(0, 0, r * 0.88, r, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.moveTo(-r * 0.12, r * 1.08); c.lineTo(r * 0.12, r * 1.08); c.lineTo(0, r * 0.95); c.fill();
    c.fillStyle = 'rgba(255,255,255,.5)';
    c.beginPath(); c.ellipse(-r * 0.35, -r * 0.42, r * 0.15, r * 0.27, -0.5, 0, Math.PI * 2); c.fill();
    c.restore();
  }
  function pumpBox(c, x, y, s, press) {
    c.fillStyle = '#5a6576';
    rr(c, x - 50 * s, y, 100 * s, 60 * s, 12 * s); c.fill();
    c.fillStyle = '#8994a1'; c.fillRect(x - 6 * s, y - 70 * s + press * 40 * s, 12 * s, 70 * s - press * 40 * s);
    rr(c, x - 45 * s, y - 82 * s + press * 40 * s, 90 * s, 16 * s, 8 * s); c.fillStyle = '#ff7a2b'; c.fill();
  }

  Huddle.register({
    id: 'pump',
    name: 'Pump & Pop',
    tagline: 'How far will you push it?',
    desc: 'Everyone pumps up their own balloon at the same time. Hold the button to pump and let go to bank the balloon’s size as points. Every balloon has a secret popping point, and if yours pops you get nothing that round. It starts to wobble when it’s getting close. Most points after 5 rounds wins.',
    controls: 'hold to pump, let go to bank',
    minPlayers: 1,
    preview(c, w, h, t) {
      const k = h / 208;
      const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#ffe3ef'); g.addColorStop(1, '#ffd0b5');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      const cols = ['#2f8cff', '#ff4d5e', '#2fc46b'];
      cols.forEach((col, i) => {
        const ph = (t * 0.5 + i * 0.33) % 1;
        const x = w * (0.25 + i * 0.25);
        pumpBox(c, x, h * 0.8, 0.4 * k, (Math.sin(t * 8 + i) + 1) / 2);
        if (ph < 0.85) balloonShape(c, x, h * 0.45, (14 + ph * 34) * k, col, ph > 0.7 ? 1 : 0, t);
      });
    },
    create(api, players) {
      const W = api.W, H = api.H;
      const S = { phase: 'intro', t: 0, round: 0, b: {}, scores: {}, ended: false, parts: [] };
      players.forEach(p => (S.scores[p.id] = 0));

      function newRound() {
        S.round++; S.phase = 'play'; S.t = 0;
        players.forEach(p => {
          // popping point: somewhere between 25 and 100, weighted towards the middle
          const limit = 25 + (Math.random() + Math.random()) / 2 * 75;
          S.b[p.id] = { size: 0, limit, holding: false, state: 'idle', banked: 0, press: 0 };
        });
        api.setMode('buzzer', 'Hold to pump · let go to bank', null, { text: 'HOLD TO PUMP' });
        api.sfx('open');
      }
      function bank(p) {
        const b = S.b[p.id];
        b.state = 'banked'; b.banked = Math.round(b.size); S.scores[p.id] += b.banked;
        api.sfx('catch'); api.buzz(p.id, 60);
        api.setMode('wait', '', [p.id], { text: b.banked ? `Banked ${b.banked}!` : 'Banked nothing…' });
      }
      function pop(p) {
        const b = S.b[p.id]; b.state = 'popped'; b.holding = false;
        const x = xOf(p), y = H * 0.5;
        for (let i = 0; i < 26; i++) { const a = rand(Math.PI * 2), s = rand(200, 700); S.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.5, 1), col: p.color }); }
        api.sfx('bang'); api.buzz(p.id, 500, true);
        api.setMode('wait', '', [p.id], { text: 'POP! Nothing this round.' });
      }
      const xOf = p => { const n = players.length, i = players.indexOf(p), gap = Math.min(380, (W - 160) / n); return W / 2 + (i - (n - 1) / 2) * gap; };
      function finish() {
        if (S.ended) return; S.ended = true;
        api.end(players.map(p => ({ p, score: S.scores[p.id], label: S.scores[p.id] + ' pts' })).sort((a, b) => b.score - a.score));
      }
      api.setMode('wait', '', null, { text: 'Get ready to pump…' });

      return {
        update(dt) {
          S.t += dt;
          for (const q of S.parts) { q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 900 * dt; q.life -= dt; }
          S.parts = S.parts.filter(q => q.life > 0);
          if (S.phase === 'intro' && S.t > 2.5) newRound();
          if (S.phase === 'play') {
            for (const p of players) {
              const b = S.b[p.id];
              b.press = Math.max(0, b.press - dt * 4);
              if (b.state === 'pumping') {
                b.size += RATE * dt * (1 + b.size / 120);
                b.press = 0.5 + 0.5 * Math.sin(S.t * 18);
                if (b.size >= b.limit) pop(p);
              }
              if (b.state === 'idle' && S.t > START_WINDOW) bank(p);
            }
            if (players.every(p => S.b[p.id].state === 'banked' || S.b[p.id].state === 'popped')) { S.phase = 'roundEnd'; S.t = 0; }
          }
          if (S.phase === 'roundEnd' && S.t > 3) { if (S.round >= ROUNDS) finish(); else newRound(); }
        },
        input(p, m) {
          if (S.phase !== 'play' || m.t !== 'btn' || m.b !== 'a') return;
          const b = S.b[p.id];
          if (m.d && b.state === 'idle') { b.state = 'pumping'; api.sfx('whoosh'); }
          else if (!m.d && b.state === 'pumping') bank(p);
        },
        draw(c, t) {
          const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#ffe7f1'); g.addColorStop(1, '#ffcfae');
          c.fillStyle = g; c.fillRect(0, 0, W, H);
          c.fillStyle = 'rgba(255,255,255,.35)';
          for (let i = 0; i < 20; i++) { c.beginPath(); c.arc((i * 211) % W, (i * 137 + t * 15) % H, 6 + (i % 4) * 4, 0, Math.PI * 2); c.fill(); }
          // floor
          c.fillStyle = '#e8a77f'; c.fillRect(0, H * 0.82, W, H * 0.18);
          const gap = Math.min(380, (W - 160) / players.length), sc = Math.min(1, gap / 300);
          players.forEach(p => {
            const x = xOf(p), b = S.b[p.id] || { size: 0, state: 'idle', press: 0, limit: 100 };
            pumpBox(c, x, H * 0.82 - 60 * sc, sc, b.press);
            // hose
            c.strokeStyle = '#5a6576'; c.lineWidth = 6 * sc;
            c.beginPath(); c.moveTo(x + 50 * sc, H * 0.82 - 30 * sc); c.quadraticCurveTo(x + 120 * sc, H * 0.7, x, H * 0.5 + 20 + (42 + b.size * 2.4) * sc); c.stroke();
            if (b.state !== 'popped') {
              const r = (42 + b.size * 2.4) * sc;
              const near = b.state === 'pumping' ? clamp((b.size - (b.limit - 18)) / 18, 0, 1) : 0;
              balloonShape(c, x, H * 0.5 - r * 0.2, r, p.color, near * 2.5, t);
              text(c, String(Math.round(b.size)), x, H * 0.5 - r * 0.2, Math.max(26, r * 0.5), 'rgba(255,255,255,.95)', 'center', 900);
            } else {
              outlined(c, 'POP!', x, H * 0.45, 70 * sc + 20, '#ff4d5e', '#fff', 10);
            }
            avatar(c, p, x - 80 * sc, H * 0.82 + 70, 40 * sc, b.state === 'popped' ? 'sad' : b.state === 'pumping' ? 'shock' : 'happy', t);
            text(c, p.name, x + 10 * sc, H * 0.82 + 60, 28, '#6b3a22', 'left', 900);
            text(c, `${S.scores[p.id]} pts`, x + 10 * sc, H * 0.82 + 98, 26, p.color, 'left', 900);
            if (b.state === 'banked') outlined(c, `+${b.banked}`, x, H * 0.18, 56, '#2fc46b', '#fff', 10);
          });
          for (const q of S.parts) { c.globalAlpha = clamp(q.life * 2, 0, 1); c.fillStyle = q.col; c.fillRect(q.x - 8, q.y - 5, 16, 10); }
          c.globalAlpha = 1;
          text(c, `Round ${Math.max(1, S.round)} of ${ROUNDS}`, 40, 50, 36, '#8a4a2c', 'left', 900);
          if (S.phase === 'intro') outlined(c, 'Don’t get greedy!', W / 2, H * 0.3, 110, '#ff4d5e', '#fff', 16);
          if (S.phase === 'play' && S.t < 1.2) outlined(c, 'PUMP!', W / 2, H * 0.12, 120, '#ff7a2b', '#fff', 16);
          if (S.phase === 'play' && S.t > START_WINDOW - 4 && players.some(p => S.b[p.id].state === 'idle')) text(c, `Start pumping! ${Math.max(0, Math.ceil(START_WINDOW - S.t))}`, W / 2, 50, 36, '#ff4d5e', 'center', 900);
          if (S.phase === 'roundEnd') outlined(c, 'Round over', W / 2, H * 0.12, 90, '#8a4a2c', '#fff', 12);
        },
      };
    },
  });
})();
