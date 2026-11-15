// Bumper Bash — tilt to roll, knock everyone else off a shrinking arena.
(() => {
  const { clamp, rand, rr, text, outlined, avatar, shade } = Huddle.helpers;
  const WIN_POINTS = 3, MAX_ROUNDS = 7, BR = 48;

  function arena(c, cx, cy, R, t, k = 1, warn = 0) {
    // water / void
    const g = c.createRadialGradient(cx, cy, R * 0.5, cx, cy, R * 3);
    g.addColorStop(0, '#1d3b6e'); g.addColorStop(1, '#0b1630');
    c.fillStyle = g; c.fillRect(0, 0, cx * 2, cy * 2 + 400);
    c.strokeStyle = 'rgba(255,255,255,.05)'; c.lineWidth = 3 * k;
    for (let i = 1; i < 9; i++) { c.beginPath(); c.arc(cx, cy, R + i * 70 * k + (t * 30 * k) % (70 * k), 0, Math.PI * 2); c.stroke(); }
    // platform side
    c.fillStyle = '#7a4fd6';
    c.beginPath(); c.ellipse(cx, cy + 26 * k, R, R, 0, 0, Math.PI * 2); c.fill();
    // platform top
    const tg = c.createRadialGradient(cx - R * 0.3, cy - R * 0.3, R * 0.1, cx, cy, R);
    tg.addColorStop(0, '#f6f1ff'); tg.addColorStop(1, '#d9ccff');
    c.fillStyle = tg; c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.fill();
    c.strokeStyle = warn > 0 ? `rgba(255,77,94,${0.5 + 0.5 * Math.sin(t * 12)})` : '#b7a3f5';
    c.lineWidth = 10 * k; c.stroke();
    c.strokeStyle = 'rgba(122,79,214,.25)'; c.lineWidth = 4 * k;
    c.beginPath(); c.arc(cx, cy, R * 0.55, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.arc(cx, cy, R * 0.12, 0, Math.PI * 2); c.stroke();
  }

  Huddle.register({
    id: 'bumper',
    name: 'Bumper Bash',
    tagline: 'Last ball on the platform wins.',
    desc: 'Tilt your phone to roll your ball around the arena, or drag the joystick on screen. Hit DASH to charge into someone. If you fall off, you’re out for that round. The arena shrinks as time goes on. First to 3 round wins takes it.',
    controls: 'tilt (or drag) + DASH',
    minPlayers: 2,
    preview(c, w, h, t) {
      const k = h / 208;
      arena(c, w / 2, h * 0.5, 80 * k, t, k * 0.4);
      const cols = ['#2f8cff', '#ff4d5e', '#2fc46b', '#ffb020'];
      cols.forEach((col, i) => {
        const a = t * (0.8 + i * 0.2) + i * 1.6, r = (30 + 25 * Math.sin(t * 0.7 + i)) * k;
        avatar(c, { color: col, slot: i }, w / 2 + Math.cos(a) * r, h * 0.5 + Math.sin(a) * r * 0.9, 13 * k, 'shock', t);
      });
    },
    create(api, players) {
      const W = api.W, H = api.H, CX = W / 2, CY = H / 2 + 50;
      const S = { phase: 'intro', t: 0, round: 0, R: 420, balls: [], points: {}, winner: null, ended: false, lastCount: 4, bumpT: 0 };
      players.forEach(p => (S.points[p.id] = 0));

      function newRound() {
        S.round++; S.phase = 'count'; S.t = 0; S.R = 420; S.winner = null; S.lastCount = 4;
        const n = players.length;
        S.balls = players.map((p, i) => {
          const a = -Math.PI / 2 + i / n * Math.PI * 2, r = 260;
          return { p, x: CX + Math.cos(a) * r, y: CY + Math.sin(a) * r, vx: 0, vy: 0, tx: 0, ty: 0, alive: true, fall: 0, dashCD: 0, dashT: 0, lastHit: null };
        });
        api.setMode('tilt', 'Tilt to roll · DASH to charge!');
      }
      function finish() {
        if (S.ended) return; S.ended = true;
        api.end(players.map(p => ({ p, score: S.points[p.id], label: `${S.points[p.id]} round${S.points[p.id] === 1 ? '' : 's'}` })).sort((a, b) => b.score - a.score));
      }
      api.setMode('wait', '', null, { text: 'Get ready to roll…' });

      return {
        update(dt) {
          S.t += dt; S.bumpT -= dt;
          if (S.phase === 'intro' && S.t > 2) newRound();
          if (S.phase === 'count') {
            const n = Math.ceil(3 - S.t);
            if (n !== S.lastCount) { S.lastCount = n; api.sfx(n > 0 ? 'count' : 'go'); }
            if (S.t >= 3) { S.phase = 'play'; S.t = 0; }
          }
          if (S.phase === 'play' || S.phase === 'roundEnd') {
            if (S.phase === 'play' && S.t > 12) S.R = Math.max(170, S.R - dt * 14);
            const steps = 4, h = dt / steps;
            for (let s = 0; s < steps; s++) {
              for (const b of S.balls) {
                if (!b.alive) continue;
                if (b.fall > 0) { b.fall += h; b.x += b.vx * h * 0.6; b.y += b.vy * h * 0.6; continue; }
                const acc = S.phase === 'play' ? 1500 : 0;
                b.vx += b.tx * acc * h; b.vy += b.ty * acc * h;
                const fr = Math.pow(0.35, h); b.vx *= fr; b.vy *= fr;
                const sp = Math.hypot(b.vx, b.vy), max = b.dashT > 0 ? 1500 : 620;
                if (sp > max) { b.vx *= max / sp; b.vy *= max / sp; }
                b.x += b.vx * h; b.y += b.vy * h;
                b.dashT -= h; b.dashCD -= h;
                if (S.phase === 'roundEnd') { const k = Math.hypot(b.x - CX, b.y - CY); if (k > S.R - BR) { b.x = CX + (b.x - CX) * (S.R - BR) / k; b.y = CY + (b.y - CY) * (S.R - BR) / k; b.vx *= 0.5; b.vy *= 0.5; } continue; }
                if (Math.hypot(b.x - CX, b.y - CY) > S.R + BR * 0.2) {
                  b.fall = 0.0001; api.sfx('whoosh'); api.buzz(b.p.id, 500, true);
                }
              }
              // collisions
              for (let i = 0; i < S.balls.length; i++) for (let j = i + 1; j < S.balls.length; j++) {
                const a = S.balls[i], c = S.balls[j];
                if (!a.alive || !c.alive || a.fall || c.fall) continue;
                const dx = c.x - a.x, dy = c.y - a.y, d = Math.hypot(dx, dy) || 1;
                if (d >= BR * 2) continue;
                const nx = dx / d, ny = dy / d, ov = BR * 2 - d;
                a.x -= nx * ov / 2; a.y -= ny * ov / 2; c.x += nx * ov / 2; c.y += ny * ov / 2;
                const vrel = (c.vx - a.vx) * nx + (c.vy - a.vy) * ny;
                if (vrel >= 0) continue;
                const j2 = -(1 + 1.15) * vrel / 2; // a bit bouncier than real life
                a.vx -= j2 * nx; a.vy -= j2 * ny; c.vx += j2 * nx; c.vy += j2 * ny;
                a.lastHit = c.p; c.lastHit = a.p;
                if (Math.abs(vrel) > 150 && S.bumpT <= 0) {
                  S.bumpT = 0.05; api.sfx(Math.abs(vrel) > 700 ? 'bang' : 'catch');
                  api.buzz(a.p.id, Math.min(200, Math.abs(vrel) / 5)); api.buzz(c.p.id, Math.min(200, Math.abs(vrel) / 5));
                }
              }
            }
            for (const b of S.balls) if (b.fall > 1) { b.alive = false; b.fall = 0; api.setMode('wait', '', [b.p.id], { text: 'Splash! Out this round.' }); }
            const alive = S.balls.filter(b => b.alive && !b.fall);
            if (S.phase === 'play' && alive.length <= 1) {
              S.phase = 'roundEnd'; S.t = 0;
              S.winner = alive[0] ? alive[0].p : null;
              if (S.winner) { S.points[S.winner.id]++; api.sfx('win'); api.buzz(S.winner.id, 300, true); }
              api.setMode('wait', '', null, { text: S.winner ? `${S.winner.name} wins the round!` : 'Nobody survived!' });
            }
          }
          if (S.phase === 'roundEnd' && S.t > 3) {
            const top = Math.max(...Object.values(S.points));
            if (top >= WIN_POINTS || S.round >= MAX_ROUNDS) finish(); else newRound();
          }
        },
        input(p, m) {
          const b = S.balls.find(x => x.p === p); if (!b) return;
          if (m.t === 'tilt') { b.tx = clamp(m.x, -1, 1); b.ty = clamp(m.y, -1, 1); }
          if (m.t === 'dash' && S.phase === 'play' && b.alive && !b.fall && b.dashCD <= 0) {
            let dx = b.tx, dy = b.ty, l = Math.hypot(dx, dy);
            if (l < 0.15) { dx = b.vx; dy = b.vy; l = Math.hypot(dx, dy); }
            if (l < 0.01) return;
            b.vx += dx / l * 900; b.vy += dy / l * 900; b.dashT = 0.35; b.dashCD = 1.6;
            api.sfx('whoosh');
          }
        },
        draw(c, t) {
          arena(c, CX, CY, S.R, t, 1, S.phase === 'play' && S.t > 10 ? 1 : 0);
          // falling balls behind the platform edge
          const sorted = S.balls.slice().sort((a, b) => a.y - b.y);
          for (const b of sorted) {
            if (!b.alive) continue;
            const f = b.fall, sc = f > 0 ? Math.max(0.05, 1 - f) : 1;
            c.save(); c.globalAlpha = f > 0 ? Math.max(0, 1 - f) : 1;
            if (!f) { c.fillStyle = 'rgba(0,0,0,.18)'; c.beginPath(); c.ellipse(b.x, b.y + BR * 0.85, BR * 0.9, BR * 0.3, 0, 0, Math.PI * 2); c.fill(); }
            if (b.dashT > 0) {
              c.strokeStyle = b.p.color; c.lineWidth = 8; c.globalAlpha = 0.5;
              c.beginPath(); c.moveTo(b.x, b.y); c.lineTo(b.x - b.vx * 0.08, b.y - b.vy * 0.08); c.stroke(); c.globalAlpha = 1;
            }
            avatar(c, b.p, b.x, b.y + f * 120, BR * sc, f ? 'shock' : Math.hypot(b.vx, b.vy) > 500 ? 'shock' : 'happy', t);
            c.restore();
            if (!f) {
              text(c, b.p.name, b.x, b.y - BR - 18, 24, '#fff', 'center', 900);
              if (b.dashCD > 0) { c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(b.x - 30, b.y + BR + 12, 60 * (1 - b.dashCD / 1.6), 6); }
            }
          }
          // scoreboard
          const n = players.length, cw = Math.min(220, (W - 100) / n);
          players.forEach((p, i) => {
            const x = W / 2 + (i - (n - 1) / 2) * (cw + 10) - cw / 2;
            c.save(); c.shadowColor = 'rgba(0,0,0,.25)'; c.shadowBlur = 14;
            rr(c, x, 18, cw, 70, 35); c.fillStyle = 'rgba(255,255,255,.95)'; c.fill(); c.restore();
            avatar(c, p, x + 36, 53, 22, 'happy', t);
            for (let k = 0; k < WIN_POINTS; k++) {
              c.fillStyle = k < S.points[p.id] ? '#ffcf3d' : '#e3e8ee';
              c.beginPath(); c.arc(x + 76 + k * 30, 53, 11, 0, Math.PI * 2); c.fill();
            }
          });
          if (S.phase === 'intro') outlined(c, 'Knock them off!', W / 2, H * 0.5, 110, '#fff', '#0b1630', 14);
          if (S.phase === 'count') outlined(c, String(Math.max(1, Math.ceil(3 - S.t))), W / 2, H * 0.5, 200, '#fff', '#0b1630', 20);
          if (S.phase === 'play' && S.t < 0.7) outlined(c, 'BUMP!', W / 2, H * 0.5, 200, '#ffcf3d', '#0b1630', 20);
          if (S.phase === 'roundEnd') outlined(c, S.winner ? `${S.winner.name} wins round ${S.round}!` : 'Double knockout!', W / 2, 160, 80, S.winner ? S.winner.color : '#fff', '#fff', 12);
          text(c, `Round ${Math.max(1, S.round)}`, 40, H - 40, 34, 'rgba(255,255,255,.7)', 'left', 900);
        },
      };
    },
  });
})();
