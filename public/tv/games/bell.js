// Ring the Bell — the fairground strength tester. Swing hard, and time it with the power needle.
(() => {
  const { clamp, lerp, rand, rr, text, outlined, avatar, shade } = Huddle.helpers;
  const ROUNDS = 3, WINDOW = 12;
  const LABELS = [[0.2, 'Wet noodle'], [0.4, 'Warming up'], [0.6, 'Not bad'], [0.8, 'Muscles!'], [0.95, 'Mighty!']];

  function tower(c, x, y0, h, w, col, puck, bell, t) {
    // track
    c.fillStyle = '#f6efe2'; rr(c, x - w / 2, y0 - h, w, h, 10); c.fill();
    c.strokeStyle = '#c8102e'; c.lineWidth = 3;
    for (let i = 1; i < 10; i++) {
      const y = y0 - h * (i / 10);
      c.beginPath(); c.moveTo(x - w / 2, y); c.lineTo(x - w / 2 + (i % 5 ? 12 : 22), y); c.stroke();
    }
    const g = c.createLinearGradient(0, y0, 0, y0 - h);
    g.addColorStop(0, '#2fc46b'); g.addColorStop(0.5, '#ffd43b'); g.addColorStop(1, '#ff4d5e');
    c.fillStyle = g; c.fillRect(x - 5, y0 - h, 10, h);
    // bell
    const ring = bell > 0 ? Math.sin(t * 50) * bell * 0.25 : 0;
    c.save(); c.translate(x, y0 - h - 34); c.rotate(ring);
    c.fillStyle = '#ffd43b';
    c.beginPath(); c.moveTo(-30, 20); c.quadraticCurveTo(-30, -26, 0, -28); c.quadraticCurveTo(30, -26, 30, 20); c.closePath(); c.fill();
    c.fillStyle = '#c98b00'; c.fillRect(-34, 18, 68, 8);
    c.beginPath(); c.arc(0, 30, 6, 0, Math.PI * 2); c.fill();
    c.restore();
    if (bell > 0) { c.strokeStyle = `rgba(255,212,59,${bell})`; c.lineWidth = 5; for (let k = 1; k <= 3; k++) { c.beginPath(); c.arc(x, y0 - h - 34, 40 + k * 18 + (1 - bell) * 40, -2.6, -0.5); c.stroke(); } }
    // puck
    const py = y0 - puck * h;
    c.fillStyle = col; rr(c, x - w / 2 - 6, py - 16, w + 12, 26, 10); c.fill();
    c.fillStyle = 'rgba(255,255,255,.5)'; c.fillRect(x - w / 2, py - 12, w, 5);
    // base + lever
    c.fillStyle = '#7a4b22'; rr(c, x - 80, y0, 160, 40, 10); c.fill();
    c.fillStyle = '#c8102e'; rr(c, x - 50, y0 - 12, 100, 16, 6); c.fill();
  }

  Huddle.register({
    id: 'bell',
    name: 'Ring the Bell',
    tagline: 'Test your strength!',
    desc: 'The classic fairground strength test. Each player has a tower with a power needle swinging beneath it. Swing your phone down like a hammer, or swipe up hard, when the needle is in the green. A strong hit at the right moment sends the puck up to ring the bell. Everyone swings at the same time, and the best total after 3 swings wins.',
    controls: 'swing your phone or swipe up hard',
    minPlayers: 1,
    preview(c, w, h, t) {
      const k = h / 208;
      const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#2a3a74'); g.addColorStop(1, '#5b3a7a');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 10; i++) { c.fillStyle = i % 2 ? '#ff4d5e' : '#fff'; c.beginPath(); c.moveTo(i * w / 10, 0); c.lineTo((i + 1) * w / 10, 0); c.lineTo((i + 0.5) * w / 10, 20 * k); c.fill(); }
      const ph = (t * 0.7) % 1.6;
      const up = ph < 0.5 ? Math.sin(ph / 0.5 * Math.PI / 2) : ph < 1 ? 1 - (ph - 0.5) * 2 : 0;
      c.save(); c.translate(w / 2, 0); c.scale(k * 0.55, k * 0.55);
      tower(c, 0, 330, 240, 30, '#2f8cff', up, ph > 0.45 && ph < 0.9 ? 1 - (ph - 0.45) * 2 : 0, t);
      c.restore();
      const sw = ph > 1.3 ? (ph - 1.3) / 0.3 : 0;
      c.save(); c.translate(w * 0.7, h * 0.82); c.rotate(-1.2 + sw * 1.4);
      c.fillStyle = '#8d5b3a'; c.fillRect(-4 * k, -50 * k, 8 * k, 50 * k);
      c.fillStyle = '#5a6576'; rr(c, -22 * k, -64 * k, 44 * k, 22 * k, 5 * k); c.fill();
      c.restore();
    },
    create(api, players) {
      const W = api.W, H = api.H;
      const S = { phase: 'intro', t: 0, round: 0, ended: false, parts: [] };
      const R = players.map((p, i) => ({ p, i, total: 0, hit: null, puck: 0, vel: 0, bell: 0, speed: rand(2.4, 3.2), off: rand(6), best: 0, swung: false, bells: 0 }));
      const needle = (r, t) => 0.5 + 0.5 * Math.sin(t * r.speed + r.off); // 0..1, 1 = green
      api.setMode('wait', '', null, { text: 'Roll up your sleeves…' });

      function newRound() {
        S.round++; S.phase = 'swing'; S.t = 0;
        R.forEach(r => { r.swung = false; r.hit = null; r.speed = rand(2.2, 3.4) + S.round * 0.3; });
        api.setMode('swing', 'Swing when the needle is in the green!', null, { text: 'SWING!', noAim: true });
        api.sfx('open');
      }
      function swing(r, m) {
        if (r.swung) return;
        const power = clamp(+m.power || 0, 0, 1);
        const timing = needle(r, api.time);
        const eff = clamp(power * (0.62 + 0.38 * timing) + (power > 0.9 && timing > 0.9 ? 0.05 : 0), 0, 1);
        r.swung = true;
        r.hit = { eff, timing, power };
        r.vel = Math.sqrt(2 * 9 * eff) * 1.02; // puck rises to ~eff
        r.puck = 0.001;
        const pts = Math.round(eff * 100) + (eff >= 0.97 ? 25 : 0);
        r.hit.pts = pts; r.total += pts; r.best = Math.max(r.best, pts);
        api.sfx('clack'); api.buzz(r.p.id, 60 + eff * 200, eff >= 0.97);
        api.setMode('wait', '', [r.p.id], { text: eff >= 0.97 ? `DING! +${pts}` : `+${pts} — ${label(eff)}` });
      }
      const label = e => (e >= 0.97 ? 'BELL!' : (LABELS.slice().reverse().find(([v]) => e >= v) || [0, 'Try again'])[1]);
      function finish() {
        if (S.ended) return; S.ended = true;
        api.end(R.map(r => ({ p: r.p, score: r.total, label: `${r.total} pts${r.bells ? ` · ${r.bells} 🔔` : ''}` })).sort((a, b) => b.score - a.score));
      }
      const layout = () => {
        const n = R.length, gap = Math.min(230, (W - 160) / n);
        return R.map((r, i) => ({ x: W / 2 + (i - (n - 1) / 2) * gap, w: Math.min(60, gap * 0.26) }));
      };

      return {
        update(dt) {
          S.t += dt;
          for (const q of S.parts) { q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 600 * dt; q.life -= dt; }
          S.parts = S.parts.filter(q => q.life > 0);
          if (S.phase === 'intro' && S.t > 2.5) newRound();
          const L = layout();
          R.forEach((r, i) => {
            r.bell = Math.max(0, r.bell - dt * 0.8);
            if (r.puck > 0) {
              r.puck += r.vel * dt; r.vel -= 9 * dt;
              if (r.puck >= 1) {
                r.puck = 1; r.vel = -Math.abs(r.vel) * 0.3;
                if (r.bell < 0.5) { r.bell = 1; r.bells++; api.sfx('gold'); api.sfx('strike');
                  for (let k = 0; k < 30; k++) S.parts.push({ x: L[i].x, y: 200, vx: rand(-300, 300), vy: rand(-500, -100), life: rand(0.6, 1.4), col: ['#ffd43b', '#fff', r.p.color][k % 3] }); }
              }
              if (r.puck <= 0) { r.puck = 0; r.vel = 0; }
            }
          });
          if (S.phase === 'swing') {
            if (S.t > WINDOW) R.forEach(r => { if (!r.swung) { r.swung = true; r.hit = { eff: 0, pts: 0, timing: 0 }; api.setMode('wait', '', [r.p.id], { text: 'Too slow!' }); } });
            if (R.every(r => r.swung) && R.every(r => r.puck === 0)) { S.phase = 'roundEnd'; S.t = 0; }
          }
          if (S.phase === 'roundEnd' && S.t > 2.6) { if (S.round >= ROUNDS) finish(); else newRound(); }
        },
        input(p, m) {
          const r = R.find(q => q.p === p);
          if (r && S.phase === 'swing' && m.t === 'swing') swing(r, m);
        },
        draw(c, t) {
          const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#1f2c5e'); g.addColorStop(1, '#4b2f6e');
          c.fillStyle = g; c.fillRect(0, 0, W, H);
          for (let i = 0; i < 30; i++) { c.fillStyle = `rgba(255,255,255,${0.3 + 0.3 * Math.sin(t * 2 + i)})`; c.beginPath(); c.arc((i * 397) % W, 120 + (i * 151) % 300, 2, 0, Math.PI * 2); c.fill(); }
          for (let i = 0; i < 24; i++) {
            c.fillStyle = i % 2 ? '#ff4d5e' : '#fff8ec';
            c.beginPath(); c.moveTo(i * W / 24, 0); c.lineTo((i + 1) * W / 24, 0); c.lineTo((i + 0.5) * W / 24, 60); c.closePath(); c.fill();
          }
          c.fillStyle = '#3b2a18'; c.fillRect(0, H - 190, W, 190);
          c.fillStyle = '#4a3520'; for (let i = 0; i < 24; i++) c.fillRect(i * 80, H - 190, 4, 190);
          const L = layout();
          const y0 = H - 230, th = 640;
          R.forEach((r, i) => {
            const { x, w } = L[i];
            tower(c, x, y0, th, w, r.p.color, r.puck, r.bell, t);
            // labels on the first tower only
            if (i === 0) LABELS.forEach(([v, s]) => text(c, s, x - w / 2 - 14, y0 - th * v, 18, 'rgba(255,255,255,.55)', 'right', 800));
            // power needle
            const gx = x, gy = H - 86, gr = 52;
            c.lineWidth = 14; c.lineCap = 'butt';
            [['#ff4d5e', 0, 0.35], ['#ffd43b', 0.35, 0.75], ['#2fc46b', 0.75, 1]].forEach(([col, a, b]) => {
              c.strokeStyle = col; c.beginPath(); c.arc(gx, gy, gr, Math.PI + a * Math.PI, Math.PI + b * Math.PI); c.stroke();
            });
            const nv = S.phase === 'swing' && !r.swung ? needle(r, api.time) : r.hit ? r.hit.timing : 0;
            const na = Math.PI + nv * Math.PI;
            c.strokeStyle = '#fff'; c.lineWidth = 5; c.lineCap = 'round';
            c.beginPath(); c.moveTo(gx, gy); c.lineTo(gx + Math.cos(na) * (gr + 6), gy + Math.sin(na) * (gr + 6)); c.stroke();
            c.fillStyle = '#fff'; c.beginPath(); c.arc(gx, gy, 7, 0, Math.PI * 2); c.fill();
            avatar(c, r.p, x - 44, H - 34, 22, r.hit && r.hit.eff >= 0.97 ? 'happy' : r.swung ? 'flat' : 'shock', t);
            text(c, r.p.name, x - 14, H - 34, 22, '#ffe9c9', 'left', 900);
            text(c, `${r.total}`, x, 108, 40, r.p.color, 'center', 900);
            if (r.hit && r.puck === 0 && S.phase !== 'intro') {
              outlined(c, r.hit.eff >= 0.97 ? 'DING!' : String(r.hit.pts), x, y0 - th * Math.max(0.1, r.hit.eff) - 40, 40, r.hit.eff >= 0.97 ? '#ffd43b' : '#fff', 'rgba(0,0,0,.5)', 6);
            }
          });
          for (const q of S.parts) { c.globalAlpha = clamp(q.life, 0, 1); c.fillStyle = q.col; c.fillRect(q.x - 5, q.y - 3, 10, 6); }
          c.globalAlpha = 1;
          text(c, `Swing ${Math.max(1, S.round)} of ${ROUNDS}`, 40, 100, 32, '#fff', 'left', 900);
          if (S.phase === 'swing' && S.t > WINDOW - 4 && R.some(r => !r.swung)) text(c, `Swing! ${Math.ceil(WINDOW - S.t)}`, W - 40, 100, 32, '#ffd43b', 'right', 900);
          if (S.phase === 'intro') outlined(c, 'Test your strength!', W / 2, H * 0.42, 120, '#ffd43b', '#7a1f2b', 16);
          if (S.phase === 'intro' && S.t > 1) text(c, 'Swing when your needle is in the green', W / 2, H * 0.42 + 100, 40, '#fff', 'center', 800);
          if (S.phase === 'swing' && S.t < 1.1) outlined(c, 'SWING!', W / 2, H * 0.3, 130, '#2fc46b', '#fff', 16);
        },
        debug() { return { phase: S.phase, round: S.round, totals: R.map(r => r.total), bells: R.map(r => r.bells) }; },
      };
    },
  });
})();
