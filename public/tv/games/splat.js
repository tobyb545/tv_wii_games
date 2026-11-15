// Splat Turf — your cursor is a paint roller. Cover the most floor in your colour.
(() => {
  const { clamp, rand, rr, text, outlined, avatar } = Huddle.helpers;
  const DURATION = 45, CELL = 20, BRUSH = 40, BOMB = 150, BOMB_CD = 4;

  function floor(c, w, h) {
    c.fillStyle = '#f4f1ea'; c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(0,0,0,.05)'; c.lineWidth = 2;
    const s = Math.max(40, w / 24);
    for (let x = 0; x < w; x += s) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
    for (let y = 0; y < h; y += s) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
  }
  function blob(c, x, y, r, col, seed) {
    c.fillStyle = col;
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    for (let i = 0; i < 7; i++) {
      const a = seed * 13.7 + i * 0.9, d = r * (0.8 + ((seed * 31 + i * 17) % 10) / 20);
      c.beginPath(); c.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, r * (0.18 + ((i * 7 + seed) % 5) / 25), 0, Math.PI * 2); c.fill();
    }
  }

  Huddle.register({
    id: 'splat',
    name: 'Splat Turf',
    tagline: 'Paint the town your colour.',
    desc: 'Your cursor is a paint roller that paints in your colour wherever you point. Paint over other players’ colour to take their ground. Press A for a big paint bomb, which recharges after 4 seconds. Whoever covers the most floor after 45 seconds wins.',
    controls: 'point to paint · A = paint bomb',
    minPlayers: 1,
    preview(c, w, h, t) {
      floor(c, w, h);
      const cols = ['#2f8cff', '#ff4d5e', '#2fc46b', '#ffb020'];
      const n = Math.floor((t * 6) % 60);
      for (let i = 0; i < n; i++) {
        const col = cols[i % 4];
        const x = ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1 * w, y = ((Math.sin(i * 78.233) * 12543.123) % 1 + 1) % 1 * h;
        blob(c, x, y, h * 0.09, col, i);
      }
    },
    create(api, players) {
      const W = api.W, H = api.H, GW = Math.ceil(W / CELL), GH = Math.ceil(H / CELL);
      const grid = new Int8Array(GW * GH).fill(-1);
      const counts = players.map(() => 0);
      const layer = document.createElement('canvas'); layer.width = W; layer.height = H;
      const L = layer.getContext('2d');
      const S = { phase: 'count', t: 0, time: DURATION, lastCount: 4, ended: false, last: {}, cd: {}, splashes: [], tickN: 0 };
      players.forEach((p, i) => { S.last[p.id] = null; S.cd[p.id] = 0; p._idx = i; });
      api.setMode('pointer', 'Point to paint! Press A for a paint bomb');

      function paintCells(x, y, r, idx) {
        const x0 = Math.max(0, Math.floor((x - r) / CELL)), x1 = Math.min(GW - 1, Math.floor((x + r) / CELL));
        const y0 = Math.max(0, Math.floor((y - r) / CELL)), y1 = Math.min(GH - 1, Math.floor((y + r) / CELL));
        const r2 = r * r;
        for (let gy = y0; gy <= y1; gy++) for (let gx = x0; gx <= x1; gx++) {
          const cx = gx * CELL + CELL / 2 - x, cy = gy * CELL + CELL / 2 - y;
          if (cx * cx + cy * cy > r2) continue;
          const k = gy * GW + gx, old = grid[k];
          if (old === idx) continue;
          if (old >= 0) counts[old]--;
          grid[k] = idx; counts[idx]++;
        }
      }
      function stamp(p, x, y, r) {
        L.fillStyle = p.color;
        L.beginPath(); L.arc(x, y, r, 0, Math.PI * 2); L.fill();
        paintCells(x, y, r, p._idx);
      }
      function finish() {
        if (S.ended) return; S.ended = true;
        const total = GW * GH;
        api.end(players.map(p => { const pc = counts[p._idx] / total * 100; return { p, score: counts[p._idx], label: pc.toFixed(1) + '%' }; }).sort((a, b) => b.score - a.score));
      }

      return {
        update(dt) {
          S.t += dt;
          if (S.phase === 'count') {
            const n = Math.ceil(3 - S.t);
            if (n !== S.lastCount) { S.lastCount = n; api.sfx(n > 0 ? 'count' : 'go'); }
            if (S.t >= 3) { S.phase = 'play'; S.t = 0; players.forEach(p => (S.last[p.id] = null)); }
            return;
          }
          if (S.phase === 'play') {
            S.time -= dt;
            const n = Math.ceil(S.time);
            if (S.time <= 5 && n !== S.tickN) { S.tickN = n; api.sfx('tick'); }
            for (const p of players) {
              if (!p.connected) continue;
              S.cd[p.id] = Math.max(0, S.cd[p.id] - dt);
              const last = S.last[p.id] || { x: p.cx, y: p.cy };
              const dist = Math.hypot(p.cx - last.x, p.cy - last.y), steps = Math.max(1, Math.ceil(dist / 10));
              for (let i = 1; i <= steps; i++) stamp(p, last.x + (p.cx - last.x) * i / steps, last.y + (p.cy - last.y) * i / steps, BRUSH);
              S.last[p.id] = { x: p.cx, y: p.cy };
            }
            if (S.time <= 0) { S.phase = 'done'; S.t = 0; api.sfx('go'); api.setMode('wait', '', null, { text: 'Brushes down!' }); }
          }
          for (const s of S.splashes) s.t += dt;
          S.splashes = S.splashes.filter(s => s.t < 0.5);
          if (S.phase === 'done' && S.t > 2.5) finish();
        },
        input(p, m) {
          if (!(m.t === 'btn' && m.b === 'a' && m.d) || S.phase !== 'play' || S.cd[p.id] > 0) return;
          S.cd[p.id] = BOMB_CD;
          L.fillStyle = p.color;
          const seed = Math.random() * 100;
          blob(L, p.cx, p.cy, BOMB * 0.75, p.color, seed);
          paintCells(p.cx, p.cy, BOMB, p._idx);
          S.splashes.push({ x: p.cx, y: p.cy, col: p.color, t: 0 });
          api.sfx('pop'); api.buzz(p.id, 80);
        },
        draw(c, t) {
          floor(c, W, H);
          c.drawImage(layer, 0, 0);
          for (const s of S.splashes) {
            c.strokeStyle = s.col; c.globalAlpha = 1 - s.t / 0.5; c.lineWidth = 10;
            c.beginPath(); c.arc(s.x, s.y, BOMB * (0.6 + s.t * 1.2), 0, Math.PI * 2); c.stroke();
          }
          c.globalAlpha = 1;
          // rollers
          for (const p of players) {
            if (!p.connected) continue;
            c.save(); c.translate(p.cx, p.cy);
            c.strokeStyle = '#fff'; c.lineWidth = 10; c.beginPath(); c.arc(0, 0, BRUSH, 0, Math.PI * 2); c.stroke();
            c.strokeStyle = '#33404d'; c.lineWidth = 4; c.stroke();
            if (S.cd[p.id] <= 0 && S.phase === 'play') { c.strokeStyle = p.color; c.lineWidth = 6; c.setLineDash([10, 10]); c.lineDashOffset = -t * 40; c.beginPath(); c.arc(0, 0, BRUSH + 14, 0, Math.PI * 2); c.stroke(); c.setLineDash([]); }
            avatar(c, p, 0, 0, 22, 'happy', t);
            c.restore();
          }
          // HUD: share bar
          const total = GW * GH, bx = 360, bw = W - 720;
          c.save(); c.shadowColor = 'rgba(0,0,0,.2)'; c.shadowBlur = 14;
          rr(c, bx - 20, 18, bw + 40, 74, 37); c.fillStyle = '#fff'; c.fill(); c.restore();
          c.save(); rr(c, bx, 40, bw, 30, 15); c.clip();
          c.fillStyle = '#e8edf2'; c.fillRect(bx, 40, bw, 30);
          let x = bx;
          players.forEach(p => { const w = bw * counts[p._idx] / total; c.fillStyle = p.color; c.fillRect(x, 40, w, 30); x += w; });
          c.restore();
          c.save(); c.shadowColor = 'rgba(0,0,0,.2)'; c.shadowBlur = 14;
          rr(c, W / 2 - 80, 96, 160, 70, 35); c.fillStyle = '#fff'; c.fill(); c.restore();
          text(c, String(Math.max(0, Math.ceil(S.phase === 'count' ? DURATION : S.time))), W / 2, 132, 48, S.time < 6 ? '#ff4d5e' : '#33404d', 'center', 900);
          players.forEach((p, i) => {
            const left = i % 2 === 0, row = Math.floor(i / 2);
            const xx = left ? 30 : W - 300, yy = 18 + row * 64;
            c.save(); c.shadowColor = 'rgba(0,0,0,.15)'; c.shadowBlur = 10;
            rr(c, xx, yy, 270, 56, 28); c.fillStyle = 'rgba(255,255,255,.95)'; c.fill(); c.restore();
            avatar(c, p, xx + 30, yy + 28, 18, 'happy', t);
            text(c, p.name, xx + 58, yy + 30, 24, '#4a5866', 'left', 800);
            text(c, (counts[p._idx] / total * 100).toFixed(0) + '%', xx + 252, yy + 30, 28, p.color, 'right', 900);
          });
          if (S.phase === 'count') outlined(c, String(Math.max(1, Math.ceil(3 - S.t))), W / 2, H / 2, 220, '#33404d', '#fff', 22);
          if (S.phase === 'play' && S.t < 0.7) outlined(c, 'PAINT!', W / 2, H / 2, 220, '#a35cff', '#fff', 22);
          if (S.phase === 'done') outlined(c, 'Brushes down!', W / 2, H / 2, 160, '#33404d', '#fff', 20);
        },
      };
    },
  });
})();
