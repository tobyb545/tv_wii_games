// Shake Dash — a 100 m sprint powered by shaking your phone.
(() => {
  const { clamp, rand, rr, text, outlined, avatar } = Huddle.helpers;
  const DIST = 100, PX = 70; // px per metre
  const CROWD = ['#ff4d5e', '#2f8cff', '#2fc46b', '#ffb020', '#a35cff', '#ff5fb4', '#16c2b0', '#ffffff'];

  function scene(c, w, h, cam, t, k = 1) {
    const g = c.createLinearGradient(0, 0, 0, h * 0.4);
    g.addColorStop(0, '#6cc4ff'); g.addColorStop(1, '#d4f0ff');
    c.fillStyle = g; c.fillRect(0, 0, w, h * 0.4);
    // stands
    const sy = h * 0.14, sh = h * 0.26;
    c.fillStyle = '#5b6575'; c.fillRect(0, sy, w, sh);
    const step = 26 * k, off = (cam * 0.5) % step;
    for (let row = 0; row < 6; row++) {
      for (let x = -off - step; x < w + step; x += step) {
        const i = Math.floor((x + cam * 0.5) / step) + row * 7;
        const bob = Math.sin(t * 8 + i) > 0.6 ? -4 * k : 0;
        c.fillStyle = CROWD[((i % 8) + 8) % 8];
        c.beginPath(); c.arc(x + (row % 2) * step / 2, sy + 20 * k + row * (sh - 30 * k) / 5 + bob, 8 * k, 0, Math.PI * 2); c.fill();
      }
    }
    c.fillStyle = '#e9edf2'; c.fillRect(0, sy + sh, w, 14 * k);
    // grass + track
    c.fillStyle = '#58b947'; c.fillRect(0, h * 0.4, w, h * 0.6);
    c.fillStyle = '#d0654a'; c.fillRect(0, h * 0.44, w, h * 0.52);
  }

  function runner(c, p, x, y, s, legT, speed, t, mood) {
    c.save(); c.translate(x, y);
    const bounce = Math.abs(Math.sin(legT * 2)) * 10 * s * Math.min(1, speed / 3);
    // legs
    c.strokeStyle = '#2b3440'; c.lineWidth = 9 * s; c.lineCap = 'round';
    const sw = Math.sin(legT * 2) * 0.9 * Math.min(1, speed / 2 + 0.1);
    for (const d of [1, -1]) {
      c.beginPath(); c.moveTo(0, -30 * s - bounce);
      c.lineTo(Math.sin(sw * d) * 34 * s, 8 * s - Math.max(0, Math.cos(sw * d)) * 4 * s);
      c.stroke();
    }
    // arms
    for (const d of [1, -1]) {
      c.beginPath(); c.moveTo(0, -62 * s - bounce);
      c.lineTo(-Math.sin(sw * d) * 30 * s, -42 * s - bounce);
      c.stroke();
    }
    avatar(c, p, 0, -70 * s - bounce, 38 * s, mood, t);
    c.restore();
  }

  Huddle.register({
    id: 'sprint',
    name: 'Shake Dash',
    tagline: 'Shake it to make it.',
    desc: 'A 100-metre dash where your legs are your phone. Shake it as hard and as fast as you can to run. If your phone has no motion sensors, tap the screen really fast instead. First to the tape wins.',
    controls: 'shake (or tap) like mad',
    minPlayers: 1,
    preview(c, w, h, t) {
      const k = h / 208;
      scene(c, w, h, t * 200, t, k * 0.6);
      const cols = ['#2f8cff', '#ff4d5e', '#2fc46b'];
      cols.forEach((col, i) => {
        const x = w * (0.25 + 0.22 * i) + Math.sin(t * 1.3 + i) * 30 * k;
        runner(c, { color: col, slot: i }, x, h * (0.6 + i * 0.12), 0.55 * k, t * 6 + i, 5, t, 'happy');
      });
    },
    create(api, players) {
      const W = api.W, H = api.H;
      const runners = players.map((p, i) => ({ p, d: 0, v: 0, legT: rand(3), finish: null, place: 0, lane: i, lastStep: 0 }));
      const S = { phase: 'count', t: 3, race: 0, cam: 0, firstFin: null, ended: false, places: 0 };
      let lastCount = 4;
      api.setMode('shake', 'Shake your phone to run! (or tap fast)');
      const trackTop = H * 0.47, trackH = H * 0.47;
      const laneH = Math.min(150, trackH / runners.length);
      const laneY = i => trackTop + (trackH - laneH * runners.length) / 2 + laneH * (i + 0.8);

      function finish() {
        if (S.ended) return; S.ended = true;
        const res = runners.map(r => ({
          p: r.p,
          score: r.finish != null ? 1000 - r.finish : r.d / 100,
          label: r.finish != null ? r.finish.toFixed(2) + ' s' : Math.floor(r.d) + ' m',
        })).sort((a, b) => b.score - a.score);
        api.end(res);
      }
      return {
        update(dt) {
          if (S.phase === 'count') {
            S.t -= dt; const n = Math.ceil(S.t);
            if (n !== lastCount) { lastCount = n; api.sfx(n > 0 ? 'count' : 'go'); }
            if (S.t <= 0) S.phase = 'race';
          } else if (S.phase === 'race') {
            S.race += dt;
            for (const r of runners) {
              r.v *= Math.pow(0.33, dt);
              if (r.finish == null) r.d += r.v * dt;
              else r.d += r.v * dt * 0.5;
              r.legT += r.v * dt * 0.9;
              if (r.finish == null && r.d >= DIST) {
                r.finish = S.race; r.place = ++S.places;
                if (S.firstFin == null) S.firstFin = S.race;
                api.sfx(r.place === 1 ? 'win' : 'join'); api.buzz(r.p.id, 300);
              }
              if (r.v > 2 && S.race - r.lastStep > 2.2 / r.v) { r.lastStep = S.race; if (runners.length < 5) api.sfx('step'); }
            }
            const all = runners.every(r => r.finish != null);
            if (all || (S.firstFin != null && S.race - S.firstFin > 12) || S.race > 90) { S.phase = 'done'; S.t = 2.5; }
          } else if (S.phase === 'done') {
            for (const r of runners) { r.v *= Math.pow(0.2, dt); r.d += r.v * dt * 0.5; r.legT += r.v * dt; }
            S.t -= dt; if (S.t <= 0) finish();
          }
          const lead = Math.max(...runners.map(r => r.d));
          const target = Math.max(0, lead * PX - W * 0.6);
          S.cam += (target - S.cam) * Math.min(1, dt * 4);
        },
        input(p, m) {
          const r = runners.find(r => r.p === p); if (!r) return;
          const isShake = m.t === 'shake' || (m.t === 'btn' && m.b === 'a' && m.d);
          if (!isShake || S.phase !== 'race' || r.finish != null) return;
          const s = m.t === 'shake' ? m.s : 18;
          r.v = Math.min(12, r.v + 1.05 * clamp(s / 18, 0.6, 1.4));
        },
        draw(c, t) {
          scene(c, W, H, S.cam, t, 1);
          const x0 = 200 - S.cam;
          // distance markers & lanes
          c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 4;
          for (let i = 0; i <= runners.length; i++) {
            const y = laneY(i - 1) + laneH * 0.2;
            c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke();
          }
          for (let m = 0; m <= DIST + 20; m += 10) {
            const x = x0 + m * PX;
            if (x < -100 || x > W + 100) continue;
            c.fillStyle = 'rgba(255,255,255,.5)'; c.fillRect(x - 3, trackTop, 6, trackH);
            text(c, m + ' m', x, trackTop - 22, 26, '#fff', 'center', 900);
          }
          // finish line
          const fx = x0 + DIST * PX;
          for (let yy = trackTop; yy < trackTop + trackH; yy += 24) for (let j = 0; j < 2; j++) {
            c.fillStyle = ((yy - trackTop) / 24 + j) % 2 ? '#fff' : '#222'; c.fillRect(fx + j * 24 - 24, yy, 24, 24);
          }
          // start line
          c.fillStyle = '#fff'; c.fillRect(x0 - 3, trackTop, 6, trackH);
          // runners (back lanes first)
          runners.forEach((r, i) => {
            const y = laneY(i), s = laneH / 150;
            const mood = r.finish != null ? (r.place === 1 ? 'happy' : 'flat') : r.v > 7 ? 'shock' : 'happy';
            runner(c, r.p, x0 + r.d * PX, y, Math.max(0.55, s), r.legT, r.v, t, mood);
            text(c, r.p.name, x0 + r.d * PX, y + 28 * s + 10, 22, '#fff', 'center', 900);
            if (r.place) outlined(c, ['1st', '2nd', '3rd'][r.place - 1] || r.place + 'th', x0 + r.d * PX + 70, y - 90 * s, 44, r.p.color, '#fff', 8);
          });
          // progress bar
          c.save(); c.shadowColor = 'rgba(0,0,0,.15)'; c.shadowBlur = 16;
          rr(c, 260, 26, W - 520, 70, 35); c.fillStyle = '#fff'; c.fill(); c.restore();
          c.fillStyle = '#e8edf2'; rr(c, 310, 55, W - 620, 12, 6); c.fill();
          runners.forEach(r => {
            const x = 310 + clamp(r.d / DIST, 0, 1) * (W - 620);
            c.fillStyle = r.p.color; c.beginPath(); c.arc(x, 61, 18, 0, Math.PI * 2); c.fill();
            c.strokeStyle = '#fff'; c.lineWidth = 4; c.stroke();
            text(c, String(r.p.slot + 1), x, 62, 20, '#fff', 'center', 900);
          });
          text(c, S.race.toFixed(1) + ' s', W - 70, 62, 40, '#fff', 'right', 900);
          if (S.phase === 'count') outlined(c, String(Math.max(1, Math.ceil(S.t))), W / 2, H * 0.32, 220, '#3a4654', '#fff', 22);
          if (S.phase === 'race' && S.race < 0.7) outlined(c, 'GO!', W / 2, H * 0.32, 240, '#2fc46b', '#fff', 22);
          if (S.phase === 'count') outlined(c, 'Get ready to shake!', W / 2, H * 0.5, 60, '#fff', '#3a4654', 10);
        },
      };
    },
  });
})();
