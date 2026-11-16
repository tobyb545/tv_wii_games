// Pie Face — a fairground booth full of pop-up clowns. Point, press A, and splat them with custard pies.
(() => {
  const { clamp, lerp, rand, pick, rr, text, outlined, avatar, shade } = Huddle.helpers;
  const TIME = 50, COLS = 5, ROWS = 3, FLIGHT = 0.3;
  const WX0 = 300, WY0 = 250, WW = 230, WH = 200, WGX = 44, WGY = 46; // windows

  function clown(c, x, y, r, kind, splat, t, wig) {
    c.save(); c.translate(x, y);
    if (kind === 'boss') {
      // ringmaster: moustache and a tall black hat. Don't hit him!
      c.fillStyle = '#f3c9a5'; c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#1e2630'; rr(c, -r * 0.7, -r * 1.75, r * 1.4, r * 1.0, 6); c.fill();
      c.fillRect(-r * 1.0, -r * 0.82, r * 2.0, r * 0.16);
      c.fillStyle = '#c8102e'; c.fillRect(-r * 0.7, -r * 1.02, r * 1.4, r * 0.18);
      c.fillStyle = '#5a3a22';
      c.beginPath(); c.ellipse(-r * 0.28, r * 0.28, r * 0.32, r * 0.12, 0.3, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.ellipse(r * 0.28, r * 0.28, r * 0.32, r * 0.12, -0.3, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#1e2630';
      c.beginPath(); c.arc(-r * 0.33, -r * 0.15, r * 0.1, 0, Math.PI * 2); c.arc(r * 0.33, -r * 0.15, r * 0.1, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#1e2630'; c.lineWidth = r * 0.08;
      c.beginPath(); c.moveTo(-r * 0.5, -r * 0.42); c.lineTo(-r * 0.15, -r * 0.32); c.moveTo(r * 0.5, -r * 0.42); c.lineTo(r * 0.15, -r * 0.32); c.stroke();
    } else {
      const gold = kind === 'gold';
      // wig puffs
      c.fillStyle = gold ? '#ffd43b' : wig;
      for (const s of [-1, 1]) for (let k = 0; k < 3; k++) { c.beginPath(); c.arc(s * r * (0.95 + k * 0.08), -r * 0.3 + k * r * 0.32, r * 0.36, 0, Math.PI * 2); c.fill(); }
      c.fillStyle = gold ? '#fff4c2' : '#fff';
      c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill();
      // hat
      c.fillStyle = gold ? '#ffb020' : shade(wig, -0.2);
      c.beginPath(); c.moveTo(-r * 0.5, -r * 0.82); c.lineTo(r * 0.5, -r * 0.82); c.lineTo(r * 0.1, -r * 1.7); c.closePath(); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(r * 0.1, -r * 1.72, r * 0.14, 0, Math.PI * 2); c.fill();
      // eyes
      c.fillStyle = '#2f8cff';
      for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * r * 0.35, -r * 0.5); c.lineTo(s * r * 0.48, -r * 0.18); c.lineTo(s * r * 0.22, -r * 0.18); c.closePath(); c.fill(); }
      c.fillStyle = '#1e2630';
      for (const s of [-1, 1]) { c.beginPath(); c.arc(s * r * 0.35, -r * 0.12, r * 0.09, 0, Math.PI * 2); c.fill(); }
      // mouth
      c.fillStyle = '#ff4d5e';
      c.beginPath(); c.ellipse(0, r * 0.45, r * 0.5, r * 0.22, 0, 0, Math.PI); c.fill();
      c.beginPath(); c.arc(0, r * 0.18, r * 0.2, 0, Math.PI * 2); c.fill(); // nose
      c.fillStyle = 'rgba(255,255,255,.6)'; c.beginPath(); c.arc(-r * 0.06, r * 0.12, r * 0.06, 0, Math.PI * 2); c.fill();
      if (gold) { c.fillStyle = '#fff'; for (let i = 0; i < 3; i++) { const a = t * 3 + i * 2.1; c.beginPath(); c.arc(Math.cos(a) * r * 1.3, Math.sin(a) * r * 1.3, r * 0.08, 0, Math.PI * 2); c.fill(); } }
    }
    if (splat) {
      c.fillStyle = '#fff6d8';
      c.beginPath(); c.arc(0, r * 0.1, r * 0.78, 0, Math.PI * 2); c.fill();
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + 0.3; c.beginPath(); c.arc(Math.cos(a) * r * 0.8, r * 0.1 + Math.sin(a) * r * 0.8, r * 0.22, 0, Math.PI * 2); c.fill(); }
      c.fillStyle = '#f7d77a'; c.beginPath(); c.arc(-r * 0.2, 0, r * 0.25, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#ffffff'; c.beginPath(); c.arc(r * 0.25, r * 0.2, r * 0.14, 0, Math.PI * 2); c.fill();
    }
    c.restore();
  }
  function pie(c, x, y, s, rot) {
    c.save(); c.translate(x, y); c.rotate(rot); c.scale(s, s);
    c.fillStyle = '#b9c3cf'; c.beginPath(); c.ellipse(0, 6, 34, 12, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#d9a35b'; c.beginPath(); c.ellipse(0, 0, 32, 12, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#fff6d8';
    for (let i = -2; i <= 2; i++) { c.beginPath(); c.arc(i * 11, -6 - (2 - Math.abs(i)) * 3, 11, 0, Math.PI * 2); c.fill(); }
    c.restore();
  }
  const winRect = i => ({ x: WX0 + (i % COLS) * (WW + WGX), y: WY0 + Math.floor(i / COLS) * (WH + WGY), w: WW, h: WH });

  Huddle.register({
    id: 'clowns',
    name: 'Pie Face',
    tagline: 'Splat the clowns!',
    desc: 'Clowns pop up in the windows of the fairground booth. Point at one and press A to throw a custard pie. Pies take a moment to fly, so aim where the clown will be. A clown is worth 1 point, and a golden clown is worth 3. Don’t pie the ringmaster in the top hat, or you lose 3 points. Most points in 50 seconds wins.',
    controls: 'point and press A to throw',
    minPlayers: 1,
    preview(c, w, h, t) {
      const k = h / 208;
      c.fillStyle = '#7a1f2b'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 10; i++) { c.fillStyle = i % 2 ? '#ffd43b' : '#ff4d5e'; c.beginPath(); c.moveTo(i * w / 10, 0); c.lineTo((i + 1) * w / 10, 0); c.lineTo((i + 0.5) * w / 10, 26 * k); c.fill(); }
      const wigs = ['#2fc46b', '#2f8cff', '#9b5de5'];
      for (let i = 0; i < 3; i++) {
        const x = w * (0.22 + i * 0.28), y = h * 0.62;
        c.fillStyle = '#2b1015'; rr(c, x - 44 * k, y - 60 * k, 88 * k, 104 * k, 10 * k); c.fill();
        const up = clamp(Math.sin(t * 2.2 + i * 2) * 1.6, 0, 1);
        c.save(); rr(c, x - 44 * k, y - 60 * k, 88 * k, 104 * k, 10 * k); c.clip();
        clown(c, x, y + 70 * k - up * 70 * k, 26 * k, i === 1 && Math.sin(t * 0.7) > 0.6 ? 'gold' : 'clown', (t * 2.2 + i * 2) % (Math.PI * 2) > 1.2, t, wigs[i]);
        c.restore();
        c.strokeStyle = '#ffd43b'; c.lineWidth = 4 * k; rr(c, x - 44 * k, y - 60 * k, 88 * k, 104 * k, 10 * k); c.stroke();
      }
      const f = (t * 0.9) % 1;
      pie(c, lerp(w * 0.5, w * 0.5, f), lerp(h * 1.1, h * 0.55, f), 0.7 * k * (1 - f * 0.4), f * 6);
    },
    create(api, players) {
      const W = api.W, H = api.H;
      const S = { phase: 'intro', t: 0, time: TIME, ended: false, spawnT: 0, pies: [], splats: [], pops: [], scores: {}, hits: {}, cool: {} };
      const wins = Array.from({ length: COLS * ROWS }, () => ({ c: null }));
      const WIGS = ['#2fc46b', '#2f8cff', '#9b5de5', '#ff9f1c', '#ff4d5e', '#00c2c7'];
      players.forEach(p => { S.scores[p.id] = 0; S.hits[p.id] = 0; S.cool[p.id] = 0; });
      api.setMode('wait', '', null, { text: 'Grab a pie…' });

      function spawn() {
        const free = wins.map((w, i) => (w.c ? -1 : i)).filter(i => i >= 0);
        if (!free.length) return;
        const i = pick(free);
        const prog = 1 - S.time / TIME;
        const r = Math.random();
        const kind = r < 0.09 ? 'gold' : r < 0.25 ? 'boss' : 'clown';
        const stay = kind === 'gold' ? rand(0.55, 0.8) : lerp(1.7, 0.9, prog) * rand(0.8, 1.2);
        wins[i].c = { kind, t: 0, stay, up: 0, splat: 0, wig: pick(WIGS), by: null };
      }
      function headPos(i) {
        const r = winRect(i), cl = wins[i].c;
        const rise = cl ? cl.up : 0;
        return { x: r.x + r.w / 2, y: r.y + r.h + 90 - rise * 175, r: 62 };
      }
      function land(pe) {
        const p = pe.p;
        let hit = -1;
        wins.forEach((w, i) => {
          if (!w.c || w.c.splat || w.c.up < 0.55) return;
          const h = headPos(i), r = winRect(i);
          if (pe.x < r.x || pe.x > r.x + r.w || pe.y < r.y || pe.y > r.y + r.h) return;
          if (Math.hypot(pe.x - h.x, pe.y - h.y) < h.r * 1.35) hit = i;
        });
        if (hit < 0) {
          S.splats.push({ x: pe.x, y: pe.y, life: 3, rot: rand(6) });
          api.sfx('miss');
          return;
        }
        const cl = wins[hit].c, h = headPos(hit);
        cl.splat = 0.001; cl.by = p;
        const v = cl.kind === 'gold' ? 3 : cl.kind === 'boss' ? -3 : 1;
        S.scores[p.id] += v; if (v > 0) S.hits[p.id]++;
        S.pops.push({ x: h.x, y: h.y - 90, v, col: p.color, t: 0 });
        api.sfx(v < 0 ? 'bad' : v > 1 ? 'gold' : 'pop');
        api.buzz(p.id, v < 0 ? 300 : 50, v < 0);
      }
      function finish() {
        if (S.ended) return; S.ended = true;
        api.end(players.map(p => ({ p, score: S.scores[p.id], label: `${S.scores[p.id]} pts · ${S.hits[p.id]} splats` })).sort((a, b) => b.score - a.score));
      }

      return {
        showCursors: false,
        update(dt) {
          S.t += dt;
          if (S.phase === 'intro' && S.t > 2.5) { S.phase = 'play'; S.t = 0; api.setMode('pointer', 'Aim at the clowns and press A to throw!'); api.sfx('go'); }
          for (const p of players) S.cool[p.id] -= dt;
          for (const pe of S.pies) { pe.t += dt; if (pe.t >= FLIGHT && !pe.done) { pe.done = true; land(pe); } }
          S.pies = S.pies.filter(pe => !pe.done);
          for (const s of S.splats) s.life -= dt;
          S.splats = S.splats.filter(s => s.life > 0);
          for (const q of S.pops) q.t += dt;
          S.pops = S.pops.filter(q => q.t < 1.1);
          if (S.phase === 'play') {
            S.time -= dt;
            S.spawnT -= dt;
            const prog = 1 - S.time / TIME;
            const busy = wins.filter(w => w.c).length;
            if (S.spawnT <= 0 && busy < 4 + Math.round(prog * 4) + Math.floor(players.length / 3)) { spawn(); S.spawnT = lerp(0.55, 0.22, prog); }
            if (S.time <= 0) { S.time = 0; S.phase = 'done'; S.t = 0; api.sfx('go'); api.setMode('wait', '', null, { text: 'Pies down!' }); }
          }
          for (const w of wins) {
            const cl = w.c; if (!cl) continue;
            cl.t += dt;
            if (cl.splat) { cl.splat += dt; if (cl.splat > 0.7) cl.up -= dt * 4; }
            else if (cl.t < 0.18) cl.up = cl.t / 0.18;
            else if (cl.t < 0.18 + cl.stay && S.phase === 'play') cl.up = 1;
            else cl.up -= dt / 0.16;
            if (cl.up <= 0 && cl.t > 0.2) w.c = null;
          }
          if (S.phase === 'done' && S.t > 2) finish();
        },
        input(p, m) {
          if (S.phase !== 'play' || m.t !== 'btn' || m.b !== 'a' || !m.d) return;
          if (S.cool[p.id] > 0) return;
          S.cool[p.id] = 0.28;
          const ox = W / 2 + (p.slot - 3.5) * 200;
          S.pies.push({ p, x: p.cx, y: p.cy, ox, oy: H + 60, t: 0, rot: rand(-1, 1) });
          api.sfx('whoosh');
        },
        draw(c, t) {
          // tent backdrop
          c.fillStyle = '#5a1420'; c.fillRect(0, 0, W, H);
          for (let i = 0; i < 16; i++) { c.fillStyle = i % 2 ? '#7a1f2b' : '#681826'; c.fillRect(i * W / 16, 0, W / 16, H); }
          for (let i = 0; i < 20; i++) {
            c.fillStyle = i % 2 ? '#ffd43b' : '#ff4d5e';
            c.beginPath(); c.moveTo(i * W / 20, 0); c.lineTo((i + 1) * W / 20, 0); c.lineTo((i + 0.5) * W / 20, 90); c.closePath(); c.fill();
          }
          // booth sign
          c.save(); c.shadowColor = 'rgba(0,0,0,.4)'; c.shadowBlur = 20;
          c.fillStyle = '#ffd43b'; rr(c, W / 2 - 300, 110, 600, 100, 50); c.fill(); c.restore();
          for (let i = 0; i < 18; i++) {
            const a = i / 18 * Math.PI * 2, on = Math.floor(t * 6 + i) % 2;
            c.fillStyle = on ? '#fff' : '#c98b00';
            c.beginPath(); c.arc(W / 2 + Math.cos(a) * 320 * (i % 9 < 9 ? 1 : 1), 160 + Math.sin(a) * 62, 6, 0, Math.PI * 2); c.fill();
          }
          outlined(c, 'PIE  FACE', W / 2, 162, 70, '#c8102e', '#fff', 10);
          // booth frame
          c.fillStyle = '#3a0d14'; rr(c, WX0 - 40, WY0 - 30, COLS * (WW + WGX) - WGX + 80, ROWS * (WH + WGY) - WGY + 60, 26); c.fill();
          wins.forEach((w, i) => {
            const r = winRect(i);
            c.fillStyle = '#1b0609'; rr(c, r.x, r.y, r.w, r.h, 14); c.fill();
            c.save(); rr(c, r.x, r.y, r.w, r.h, 14); c.clip();
            // curtain
            c.fillStyle = '#2a0a10';
            for (let k = 0; k < 6; k++) c.fillRect(r.x + k * r.w / 6, r.y, r.w / 12, r.h);
            if (w.c) {
              const h = headPos(i);
              // body
              c.fillStyle = w.c.kind === 'boss' ? '#c8102e' : w.c.wig;
              rr(c, h.x - 70, h.y + h.r * 0.8, 140, 160, 40); c.fill();
              if (w.c.kind !== 'boss') { c.fillStyle = '#fff'; for (let k = 0; k < 3; k++) { c.beginPath(); c.arc(h.x, h.y + h.r * 1.3 + k * 34, 9, 0, Math.PI * 2); c.fill(); } }
              clown(c, h.x, h.y, h.r, w.c.kind, !!w.c.splat, t, w.c.wig);
            }
            c.restore();
            c.lineWidth = 8; c.strokeStyle = '#ffd43b'; rr(c, r.x, r.y, r.w, r.h, 14); c.stroke();
            c.fillStyle = '#ffd43b';
            for (let k = 0; k < 5; k++) { c.beginPath(); c.arc(r.x + 18 + k * (r.w - 36) / 4, r.y + r.h + 14, 5, 0, Math.PI * 2); c.fill(); }
          });
          // missed pies on the booth
          for (const s of S.splats) {
            c.globalAlpha = clamp(s.life, 0, 1) * 0.9;
            c.fillStyle = '#fff6d8';
            c.save(); c.translate(s.x, s.y); c.rotate(s.rot);
            c.beginPath(); c.ellipse(0, 0, 46, 32, 0, 0, Math.PI * 2); c.fill();
            for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; c.beginPath(); c.arc(Math.cos(a) * 46, Math.sin(a) * 30, 12, 0, Math.PI * 2); c.fill(); }
            c.restore(); c.globalAlpha = 1;
          }
          // pies in flight
          for (const pe of S.pies) {
            const f = clamp(pe.t / FLIGHT, 0, 1);
            const x = lerp(pe.ox, pe.x, f), y = lerp(pe.oy, pe.y, f) - Math.sin(f * Math.PI) * 120;
            pie(c, x, y, lerp(1.7, 1, f), pe.rot * f * 3);
          }
          for (const q of S.pops) {
            c.globalAlpha = clamp(2 - q.t * 2, 0, 1);
            outlined(c, q.v > 0 ? `+${q.v}` : String(q.v), q.x, q.y - q.t * 60, 64, q.v < 0 ? '#ff4d5e' : q.v > 1 ? '#ffd43b' : q.col, '#fff', 10);
            c.globalAlpha = 1;
          }
          // reticles
          if (S.phase === 'play') for (const p of players) {
            if (!p.connected) continue;
            c.save(); c.translate(p.cx, p.cy);
            c.strokeStyle = '#fff'; c.lineWidth = 9; c.beginPath(); c.arc(0, 0, 30, 0, Math.PI * 2); c.stroke();
            c.strokeStyle = p.color; c.lineWidth = 5; c.beginPath(); c.arc(0, 0, 30, 0, Math.PI * 2); c.stroke();
            c.fillStyle = p.color; c.beginPath(); c.arc(0, 0, 7, 0, Math.PI * 2); c.fill();
            c.restore();
          }
          // scores
          const n = players.length, sw = Math.min(220, (W - 80) / n);
          players.forEach((p, i) => {
            const x = W / 2 + (i - (n - 1) / 2) * sw, y = H - 58;
            c.fillStyle = 'rgba(0,0,0,.35)'; rr(c, x - sw / 2 + 8, y - 36, sw - 16, 72, 36); c.fill();
            avatar(c, p, x - sw / 2 + 46, y, 24, 'happy', t);
            text(c, p.name, x - sw / 2 + 80, y - 12, 22, '#fff', 'left', 900);
            text(c, String(S.scores[p.id]), x - sw / 2 + 80, y + 16, 28, p.color, 'left', 900);
          });
          text(c, `${Math.ceil(S.time)}`, W - 70, 150, 64, S.time < 10 ? '#ffd43b' : '#fff', 'center', 900);
          if (S.phase === 'intro') outlined(c, 'Splat the clowns!', W / 2, H / 2, 120, '#ffd43b', '#7a1f2b', 16);
          if (S.phase === 'intro' && S.t > 1) text(c, 'but leave the ringmaster alone…', W / 2, H / 2 + 100, 44, '#fff', 'center', 800);
          if (S.phase === 'done') outlined(c, 'Pies down!', W / 2, H / 2, 140, '#ffd43b', '#7a1f2b', 16);
        },
        debug() { return { phase: S.phase, time: Math.round(S.time), scores: S.scores, up: wins.filter(w => w.c).length }; },
      };
    },
  });
})();
