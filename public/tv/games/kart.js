// Turbo Tracks — top-down kart racing on a shared screen. Steer with your phone like a wheel.
(() => {
  const { clamp, rand, pick, lerp, rr, text, outlined, avatar, shade } = Huddle.helpers;
  const LAPS = 3, N = 900, WIDTH = 300, KR = 34, GRID = 6, OFFROAD = 75;
  const MAX = 880, GRASS_MAX = 360, ACCEL = 780;
  const GP_POINTS = [10, 8, 6, 5, 4, 3, 2, 1];
  const CPU_NAMES = ['Bolt', 'Nitro', 'Sprocket', 'Piston', 'Turbo', 'Gizmo'];
  const CPU_COLS = ['#8a94a6', '#6c7a89', '#9b8ea8', '#7f9c8f', '#a3917a', '#7a8fa8'];

  const TRACKS = [
    {
      id: 'meadow', name: 'Meadow Loop', blurb: 'Gentle curves. Good for learning.',
      pts: [[800, 600], [2600, 450], [4400, 600], [4850, 1200], [4500, 1900], [3500, 2050], [2600, 2500], [1300, 2450], [500, 1900], [450, 1100]],
      grass: '#7ccf62', grass2: '#6fc157', road: '#5d6572', edge: ['#ffffff', '#ff4d5e'], line: 'rgba(255,255,255,.55)', deco: 'tree', bg: '#6ab955',
    },
    {
      id: 'canyon', name: 'Canyon Run', blurb: 'Twisty desert switchbacks.',
      pts: [[700, 500], [1900, 400], [2500, 950], [3100, 500], [4300, 450], [4800, 1100], [4500, 1850], [3500, 1750], [2600, 2050], [2300, 2650], [1300, 2700], [550, 2300], [600, 1650], [1300, 1450], [1350, 1000], [800, 900]],
      grass: '#e7b878', grass2: '#ddaa66', road: '#8a6a52', edge: ['#fff1d6', '#c0583a'], line: 'rgba(255,240,210,.5)', deco: 'rock', bg: '#d9a464',
    },
    {
      id: 'neon', name: 'Neon Night', blurb: 'Fast and glowing. Hold on tight.',
      pts: [[600, 700], [2000, 350], [3400, 750], [4600, 450], [5000, 1150], [4550, 1650], [4900, 2250], [4000, 2750], [2850, 2350], [1700, 2750], [750, 2650], [450, 2050], [1050, 1550]],
      grass: '#1a1440', grass2: '#211a52', road: '#2c2f4a', edge: ['#3df2ff', '#ff3dcf'], line: 'rgba(61,242,255,.45)', deco: 'pillar', bg: '#140f33', glow: true,
    },
  ];

  // ---------- track geometry ----------
  function catmull(p0, p1, p2, p3, t) {
    const t2 = t * t, t3 = t2 * t;
    return [0, 1].map(k => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3));
  }
  const built = {};
  function build(def) {
    if (built[def.id]) return built[def.id];
    const P = def.pts, n = P.length, per = N / n, s = [];
    for (let i = 0; i < n; i++) for (let j = 0; j < per; j++) s.push(catmull(P[(i - 1 + n) % n], P[i], P[(i + 1) % n], P[(i + 2) % n], j / per));
    const M = s.length;
    const pts = s.map((p, i) => {
      const a = s[(i - 1 + M) % M], b = s[(i + 1) % M];
      const tx = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tx, ty) || 1;
      return { x: p[0], y: p[1], tx: tx / l, ty: ty / l, nx: -ty / l, ny: tx / l };
    });
    const path = new Path2D();
    pts.forEach((p, i) => (i ? path.lineTo(p.x, p.y) : path.moveTo(p.x, p.y)));
    path.closePath();
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
    const bounds = { x0: Math.min(...xs) - 250, x1: Math.max(...xs) + 250, y0: Math.min(...ys) - 250, y1: Math.max(...ys) + 250 };
    // decorations: scattered away from the road
    const deco = [];
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let k = 0; k < 900 && deco.length < 120; k++) {
      const x = bounds.x0 - 300 + rnd() * (bounds.x1 - bounds.x0 + 600), y = bounds.y0 - 300 + rnd() * (bounds.y1 - bounds.y0 + 600);
      let near = 1e9; for (let i = 0; i < M; i += 6) near = Math.min(near, Math.hypot(pts[i].x - x, pts[i].y - y));
      if (near > WIDTH / 2 + 130) deco.push({ x, y, r: 40 + rnd() * 50, v: rnd() });
    }
    const t = { def, pts, M, path, bounds, deco };
    built[def.id] = t;
    return t;
  }
  function locate(t, x, y, hint) {
    let best = -1, bd = 1e18;
    const scan = (i0, i1) => { for (let k = i0; k <= i1; k++) { const i = ((k % t.M) + t.M) % t.M, p = t.pts[i], d = (p.x - x) ** 2 + (p.y - y) ** 2; if (d < bd) { bd = d; best = i; } } };
    if (hint == null) scan(0, t.M - 1); else scan(hint - 60, hint + 60);
    const p = t.pts[best];
    return { idx: best, lat: (x - p.x) * p.nx + (y - p.y) * p.ny, dist: Math.sqrt(bd) };
  }

  // ---------- drawing ----------
  function drawTrack(c, t, time) {
    const d = t.def, b = t.bounds;
    c.fillStyle = d.grass; c.fillRect(b.x0 - 3000, b.y0 - 3000, b.x1 - b.x0 + 6000, b.y1 - b.y0 + 6000);
    c.fillStyle = d.grass2;
    for (let x = Math.floor((b.x0 - 1000) / 400) * 400; x < b.x1 + 1000; x += 400) c.fillRect(x, b.y0 - 1000, 200, b.y1 - b.y0 + 2000);
    c.lineJoin = 'round'; c.lineCap = 'round';
    // tyre-wall barrier marking how far off the road you can go, then the grass verge inside it
    const wall = WIDTH + 2 * (OFFROAD + KR);
    c.lineWidth = wall + 36; c.strokeStyle = d.glow ? '#ff3dcf' : '#2b2f38'; c.stroke(t.path);
    c.lineWidth = wall + 36; c.setLineDash([36, 36]); c.strokeStyle = d.glow ? '#3df2ff' : '#f2f4f7'; c.stroke(t.path); c.setLineDash([]);
    c.lineWidth = wall; c.strokeStyle = d.grass; c.stroke(t.path);
    // kerbs
    c.lineWidth = WIDTH + 34; c.strokeStyle = d.edge[0]; c.stroke(t.path);
    c.setLineDash([60, 60]); c.strokeStyle = d.edge[1]; c.stroke(t.path); c.setLineDash([]);
    if (d.glow) { c.save(); c.shadowColor = d.edge[0]; c.shadowBlur = 40; c.lineWidth = WIDTH + 20; c.strokeStyle = d.edge[0]; c.stroke(t.path); c.restore(); }
    c.lineWidth = WIDTH; c.strokeStyle = d.road; c.stroke(t.path);
    c.lineWidth = 8; c.setLineDash([50, 70]); c.lineDashOffset = 0; c.strokeStyle = d.line; c.stroke(t.path); c.setLineDash([]);
    // start/finish line
    const s = t.pts[0];
    c.save(); c.translate(s.x, s.y); c.rotate(Math.atan2(s.ty, s.tx));
    for (let i = -5; i < 5; i++) for (let j = 0; j < 2; j++) { c.fillStyle = (i + j) % 2 ? '#fff' : '#1e2630'; c.fillRect(j * 30 - 30, i * 30, 30, 30); }
    c.restore();
    // decorations
    for (const o of t.deco) {
      if (d.deco === 'tree') {
        c.fillStyle = 'rgba(0,0,0,.12)'; c.beginPath(); c.ellipse(o.x + 12, o.y + 16, o.r, o.r * 0.8, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = o.v > 0.5 ? '#3f9d48' : '#4fae4a'; c.beginPath(); c.arc(o.x, o.y, o.r, 0, Math.PI * 2); c.fill();
        c.fillStyle = 'rgba(255,255,255,.12)'; c.beginPath(); c.arc(o.x - o.r * 0.3, o.y - o.r * 0.3, o.r * 0.45, 0, Math.PI * 2); c.fill();
      } else if (d.deco === 'rock') {
        c.fillStyle = o.v > 0.6 ? '#4f8a4a' : '#a86f4c';
        if (o.v > 0.6) { rr(c, o.x - 12, o.y - o.r * 0.9, 24, o.r * 1.8, 12); c.fill(); rr(c, o.x - 40, o.y - o.r * 0.4, 30, 14, 7); c.fill(); }
        else { c.beginPath(); c.ellipse(o.x, o.y, o.r, o.r * 0.7, o.v * 3, 0, Math.PI * 2); c.fill(); c.fillStyle = 'rgba(255,255,255,.15)'; c.beginPath(); c.ellipse(o.x - 10, o.y - 10, o.r * 0.5, o.r * 0.3, o.v * 3, 0, Math.PI * 2); c.fill(); }
      } else {
        const col = o.v > 0.5 ? '#3df2ff' : '#ff3dcf', pulse = 0.5 + 0.5 * Math.sin(time * 3 + o.v * 10);
        c.save(); c.shadowColor = col; c.shadowBlur = 30 * pulse; c.fillStyle = col; c.globalAlpha = 0.5 + 0.5 * pulse;
        c.beginPath(); c.arc(o.x, o.y, o.r * 0.35, 0, Math.PI * 2); c.fill(); c.restore();
      }
    }
  }
  function drawKart(c, k, t) {
    c.save(); c.translate(k.x, k.y);
    c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(6, 10, 46, 32, k.h, 0, Math.PI * 2); c.fill();
    c.rotate(k.h + (k.spin > 0 ? k.spin * 14 : 0));
    if (k.boost > 0) {
      for (let i = 0; i < 3; i++) { c.fillStyle = ['#ffd23f', '#ff8a2b', '#ff4d5e'][i]; c.beginPath(); c.ellipse(-56 - i * 12 - Math.random() * 10, 0, 22 - i * 5, 12 - i * 3, 0, 0, Math.PI * 2); c.fill(); }
    }
    c.fillStyle = '#1e2630';
    for (const [x, y] of [[-26, -30], [-26, 30], [24, -28], [24, 28]]) { rr(c, x - 12, y - 8, 24, 16, 5); c.fill(); }
    rr(c, -40, -26, 80, 52, 18); c.fillStyle = k.p.color; c.fill();
    rr(c, 22, -22, 22, 44, 10); c.fillStyle = shade(k.p.color, -0.25); c.fill();
    c.fillStyle = 'rgba(255,255,255,.35)'; rr(c, -34, -20, 40, 12, 6); c.fill();
    c.rotate(-(k.h + (k.spin > 0 ? k.spin * 14 : 0)));
    avatar(c, k.p, 0, 0, 22, k.spin > 0 ? 'ko' : k.boost > 0 ? 'shock' : 'happy', t);
    if (k.shield > 0) { c.strokeStyle = `rgba(120,220,255,${0.5 + 0.3 * Math.sin(t * 10)})`; c.lineWidth = 8; c.beginPath(); c.arc(0, 0, 62, 0, Math.PI * 2); c.stroke(); }
    c.restore();
  }
  const ITEMS = {
    turbo: { name: 'Turbo', col: '#ff8a2b' },
    goo: { name: 'Goo', col: '#7bd94f' },
    shock: { name: 'Shockwave', col: '#a35cff' },
    shield: { name: 'Shield', col: '#3db7ff' },
  };
  function itemIcon(c, kind, x, y, r) {
    c.save(); c.translate(x, y);
    c.fillStyle = ITEMS[kind].col; c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#fff'; c.fillStyle = '#fff'; c.lineWidth = r * 0.16; c.lineCap = 'round'; c.lineJoin = 'round';
    if (kind === 'turbo') { c.beginPath(); c.moveTo(-r * 0.45, -r * 0.4); c.lineTo(0, 0); c.lineTo(-r * 0.45, r * 0.4); c.moveTo(0, -r * 0.4); c.lineTo(r * 0.45, 0); c.lineTo(0, r * 0.4); c.stroke(); }
    if (kind === 'goo') { c.beginPath(); c.arc(0, r * 0.1, r * 0.4, 0, Math.PI * 2); c.fill(); c.beginPath(); c.arc(-r * 0.4, -r * 0.3, r * 0.15, 0, Math.PI * 2); c.arc(r * 0.35, -r * 0.35, r * 0.12, 0, Math.PI * 2); c.fill(); }
    if (kind === 'shock') { c.beginPath(); c.arc(0, 0, r * 0.25, 0, Math.PI * 2); c.stroke(); c.beginPath(); c.arc(0, 0, r * 0.55, 0, Math.PI * 2); c.stroke(); }
    if (kind === 'shield') { c.beginPath(); c.moveTo(0, -r * 0.55); c.lineTo(r * 0.45, -r * 0.3); c.quadraticCurveTo(r * 0.4, r * 0.35, 0, r * 0.55); c.quadraticCurveTo(-r * 0.4, r * 0.35, -r * 0.45, -r * 0.3); c.closePath(); c.fill(); }
    c.restore();
  }
  const fmt = s => { const m = Math.floor(s / 60), r = s - m * 60; return `${m}:${r < 10 ? '0' : ''}${r.toFixed(2)}`; };

  Huddle.register({
    id: 'kart',
    name: 'Turbo Tracks',
    tagline: 'Pedal to the metal.',
    desc: 'Kart racing for the whole room. Hold your phone sideways or upright and turn it like a steering wheel, or hold the left or right side of the screen. Drive through item orbs to grab a Turbo, Goo, Shockwave or Shield, then tap ITEM to use it. Pick one of three tracks, or race all three in a Grand Prix. CPU racers make up the numbers.',
    controls: 'steer with your phone · ITEM · BRAKE',
    minPlayers: 1,
    preview(c, w, h, t) {
      const tr = build(TRACKS[0]), b = tr.bounds;
      const s = Math.min(w / (b.x1 - b.x0), h / (b.y1 - b.y0));
      c.save(); c.translate(w / 2, h / 2); c.scale(s, s); c.translate(-(b.x0 + b.x1) / 2, -(b.y0 + b.y1) / 2);
      drawTrack(c, tr, t);
      ['#2f8cff', '#ff4d5e', '#2fc46b', '#ffb020'].forEach((col, i) => {
        const f = ((t * 0.09 + i * 0.025) % 1), idx = Math.floor(f * tr.M), p = tr.pts[idx];
        drawKart(c, { x: p.x + p.nx * (i % 2 ? 60 : -60), y: p.y + p.ny * (i % 2 ? 60 : -60), h: Math.atan2(p.ty, p.tx), p: { color: col, slot: i }, spin: 0, boost: i === 0 ? 1 : 0, shield: 0 }, t);
      });
      c.restore();
    },
    create(api, players) {
      const W = api.W, H = api.H;
      const S = {
        phase: 'select', t: 0, track: null, queue: [], gp: false, gpPts: {}, raceNo: 0,
        karts: [], pickups: [], goo: [], fx: [], cam: { x: 0, y: 0, z: 0.4 }, finishOrder: [], firstFinish: null, ended: false, lastCount: 4, raceT: 0, standings: null,
      };
      const inst = { showCursors: true };
      api.setMode('pointer', 'Pick a track: point and press A');
      const cards = [
        ...TRACKS.map((tr, i) => ({ x: 120 + i * 440, y: 300, w: 400, h: 420, track: tr })),
        { x: 120 + 3 * 440, y: 300, w: 400, h: 420, gp: true },
      ];

      function cpuRacers() {
        const n = Math.max(0, GRID - players.length);
        return Array.from({ length: n }, (_, i) => ({ id: 'cpu' + i, name: CPU_NAMES[i], color: CPU_COLS[i], slot: 10 + i, cpu: true }));
      }
      let cpus = [];
      function startRace(def) {
        const tr = build(def);
        S.track = tr; S.phase = 'count'; S.t = 0; S.lastCount = 4; S.raceT = 0; S.finishOrder = []; S.firstFinish = null; S.goo = []; S.fx = [];
        inst.showCursors = false;
        if (!cpus.length) cpus = cpuRacers();
        const racers = [...players, ...cpus];
        S.karts = racers.map((p, i) => {
          const back = 140 + Math.floor(i / 2) * 150, side = (i % 2 ? 1 : -1) * 70;
          const idx = (tr.M - Math.round(back / 15)) % tr.M, q = tr.pts[idx];
          return {
            p, cpu: !!p.cpu, x: q.x + q.nx * side, y: q.y + q.ny * side, h: Math.atan2(q.ty, q.tx), vx: 0, vy: 0, speed: 0,
            steer: 0, brake: false, idx, lap: 0, mid: false, done: null, place: 0, item: null, boost: 0, spin: 0, shield: 0, hitCD: 0,
            skill: rand(0.86, 0.95), lane: rand(-70, 70), itemT: rand(2, 6),
          };
        });
        // item orbs: two rows; boost pads
        S.pickups = [];
        for (const f of [0.28, 0.68]) {
          const i0 = Math.floor(f * tr.M), q = tr.pts[i0];
          for (let j = -1.5; j <= 1.5; j++) S.pickups.push({ x: q.x + q.nx * j * 62, y: q.y + q.ny * j * 62, t: 0 });
        }
        S.pads = [0.12, 0.5, 0.85].map(f => { const q = tr.pts[Math.floor(f * tr.M)]; return { x: q.x, y: q.y, h: Math.atan2(q.ty, q.tx) }; });
        const b = tr.bounds; S.cam = { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2, z: zoomMin() };
        players.forEach(p => api.setMode('drive', 'Turn your phone to steer · ITEM to use', [p.id], { item: null }));
        api.sfx('open');
      }
      const zoomMin = () => { const b = S.track.bounds; return Math.min(W / (b.x1 - b.x0), H / (b.y1 - b.y0)); };
      const progress = k => (k.done != null ? 1e9 - k.place : k.lap * S.track.M + k.idx);

      function giveItem(k) {
        const order = S.karts.slice().sort((a, b) => progress(b) - progress(a)), pos = order.indexOf(k) / Math.max(1, order.length - 1);
        const w = { turbo: 5 + pos * 45, goo: 40 - pos * 30, shock: 15 + pos * 20, shield: 35 - pos * 25 };
        let r = Math.random() * Object.values(w).reduce((a, b) => a + b, 0), item = 'turbo';
        for (const [kname, v] of Object.entries(w)) { r -= v; if (r <= 0) { item = kname; break; } }
        k.item = item;
        if (!k.cpu) { api.setMode('drive', `Got ${ITEMS[item].name}! Tap ITEM`, [k.p.id], { item: ITEMS[item].name }); api.buzz(k.p.id, 40); api.sfx('gold'); }
      }
      function useItem(k) {
        if (!k.item || k.spin > 0) return;
        const it = k.item; k.item = null;
        if (!k.cpu) api.setMode('drive', 'Turn your phone to steer · ITEM to use', [k.p.id], { item: null });
        if (it === 'turbo') { k.boost = 1.4; k.speed = Math.max(k.speed, MAX * 1.2); api.sfx('whoosh'); }
        if (it === 'shield') { k.shield = 6; api.sfx('spare'); }
        if (it === 'goo') { S.goo.push({ x: k.x - Math.cos(k.h) * 80, y: k.y - Math.sin(k.h) * 80, t: 0, owner: k }); api.sfx('pop'); }
        if (it === 'shock') {
          S.fx.push({ kind: 'ring', x: k.x, y: k.y, t: 0, col: ITEMS.shock.col });
          for (const o of S.karts) if (o !== k && Math.hypot(o.x - k.x, o.y - k.y) < 300) hit(o);
          api.sfx('bang');
        }
      }
      function hit(k) {
        if (k.hitCD > 0 || k.done != null) return;
        if (k.shield > 0) { k.shield = 0; k.hitCD = 0.5; api.sfx('catch'); return; }
        k.spin = 1; k.speed *= 0.25; k.hitCD = 1.6;
        if (!k.cpu) api.buzz(k.p.id, 350, true);
      }
      function finishRace() {
        const tr = S.track.def;
        const order = S.karts.slice().sort((a, b) => progress(b) - progress(a));
        if (S.gp) order.forEach((k, i) => (S.gpPts[k.p.id] = (S.gpPts[k.p.id] || 0) + (GP_POINTS[i] || 0)));
        if (S.gp && S.queue.length) {
          S.phase = 'standings'; S.t = 0;
          S.standings = S.karts.map(k => k.p).sort((a, b) => S.gpPts[b.id] - S.gpPts[a.id]);
          players.forEach(p => api.setMode('wait', '', [p.id], { text: `Next up: ${S.queue[0].name}` }));
          return;
        }
        if (S.ended) return; S.ended = true;
        const res = S.gp
          ? S.karts.map(k => ({ p: k.p, score: S.gpPts[k.p.id], label: `${S.gpPts[k.p.id]} pts${k.cpu ? ' · CPU' : ''}` })).sort((a, b) => b.score - a.score)
          : order.map((k, i) => ({ p: k.p, score: order.length - i, label: k.done != null ? fmt(k.done) + (k.cpu ? ' · CPU' : '') : k.cpu ? 'CPU' : 'DNF' }));
        api.end(res, { title: S.gp ? 'Grand Prix results' : `${tr.name} results` });
      }

      function physics(dt) {
        const tr = S.track;
        for (const k of S.karts) {
          k.hitCD -= dt; k.boost = Math.max(0, k.boost - dt); k.shield = Math.max(0, k.shield - dt);
          if (k.spin > 0) k.spin = Math.max(0, k.spin - dt);
          const loc = locate(tr, k.x, k.y, k.idx);
          const off = Math.abs(loc.lat) > WIDTH / 2 + 6;
          // CPU driving
          if ((k.cpu || window.__huddleAutopilot) && S.phase === 'race') { // autopilot is a test-only switch
            const ahead = tr.pts[(loc.idx + 34) % tr.M];
            const tx = ahead.x + ahead.nx * k.lane, ty = ahead.y + ahead.ny * k.lane;
            let da = Math.atan2(ty - k.y, tx - k.x) - k.h; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
            k.steer = clamp(da * 2.2, -1, 1);
            k.corner = Math.abs(da);
            k.itemT -= dt; if (k.item && k.itemT <= 0) { useItem(k); k.itemT = rand(2, 7); }
          }
          let target = 0;
          if (S.phase === 'race' || (S.phase === 'done' && k.done == null) || k.done != null) {
            target = (off ? GRASS_MAX : MAX) * (k.boost > 0 ? 1.4 : 1);
            if (k.cpu) {
              // light rubber-banding so CPUs stay in the mix
              const best = Math.max(...S.karts.filter(o => !o.cpu).map(progress));
              const gap = (progress(k) - best) / tr.M;
              target *= k.skill * (gap > 0.25 ? 0.9 : gap < -0.25 ? 1.08 : 1);
            }
            if ((k.cpu || window.__huddleAutopilot) && k.corner > 0.45) target *= clamp(1.3 - k.corner, 0.45, 1); // ease off for hairpins
            if (k.done != null) target *= 0.5;
          }
          if (k.brake) target = Math.min(target, 150);
          if (k.spin > 0) target = 0;
          k.speed += clamp(target - k.speed, -ACCEL * 1.6 * dt, ACCEL * dt);
          const turn = 2.7 * Math.min(1, Math.abs(k.speed) / 320) * (k.brake ? 1.3 : 1);
          if (k.spin <= 0) k.h += k.steer * turn * dt;
          const grip = 1 - Math.exp(-(off ? 5 : 9) * dt);
          k.vx = lerp(k.vx, Math.cos(k.h) * k.speed, grip); k.vy = lerp(k.vy, Math.sin(k.h) * k.speed, grip);
          k.x += k.vx * dt; k.y += k.vy * dt;
          // keep karts from wandering miles off course
          const loc2 = locate(tr, k.x, k.y, loc.idx);
          if (Math.abs(loc2.lat) > WIDTH / 2 + OFFROAD) {
            const q = tr.pts[loc2.idx], lim = Math.sign(loc2.lat) * (WIDTH / 2 + OFFROAD);
            k.x = q.x + q.nx * lim; k.y = q.y + q.ny * lim; k.speed *= 0.5;
          }
          // lap counting
          const prev = k.idx; k.idx = loc2.idx;
          if (k.idx > tr.M * 0.4 && k.idx < tr.M * 0.6) k.mid = true;
          if (prev > tr.M * 0.85 && k.idx < tr.M * 0.15 && (k.mid || k.lap === 0)) {
            k.lap++; k.mid = false;
            if (k.lap > LAPS && k.done == null) {
              k.done = S.raceT; k.place = S.finishOrder.push(k);
              if (!k.cpu) {
                if (S.firstFinish == null) S.firstFinish = S.raceT;
                api.sfx(k.place === 1 ? 'win' : 'spare'); api.buzz(k.p.id, 300, true);
                api.setMode('wait', '', [k.p.id], { text: `Finished ${['1st', '2nd', '3rd'][k.place - 1] || k.place + 'th'}! ${fmt(k.done)}` });
              }
            } else if (k.lap > 1 && !k.cpu) { api.sfx(k.lap === LAPS ? 'go' : 'count'); }
          } else if (prev < tr.M * 0.15 && k.idx > tr.M * 0.85) { k.lap--; }
          // pickups and pads
          for (const pu of S.pickups) if (pu.t <= 0 && Math.hypot(pu.x - k.x, pu.y - k.y) < 60) { pu.t = 3; if (!k.item) giveItem(k); }
          for (const pd of S.pads) if (Math.hypot(pd.x - k.x, pd.y - k.y) < 90 && k.boost < 0.6) { k.boost = 0.8; k.speed = Math.max(k.speed, MAX * 1.15); if (!k.cpu) api.sfx('whoosh'); }
          for (const g of S.goo) if (g.t > 0.5 && Math.hypot(g.x - k.x, g.y - k.y) < 70) { g.t = 99; hit(k); api.sfx('bad'); }
        }
        // kart-kart bumps
        for (let i = 0; i < S.karts.length; i++) for (let j = i + 1; j < S.karts.length; j++) {
          const a = S.karts[i], b = S.karts[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
          if (d > KR * 2) continue;
          const nx = dx / d, ny = dy / d, ov = KR * 2 - d;
          a.x -= nx * ov / 2; a.y -= ny * ov / 2; b.x += nx * ov / 2; b.y += ny * ov / 2;
          const vr = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
          if (vr < 0) { a.vx += vr * nx * 0.8; a.vy += vr * ny * 0.8; b.vx -= vr * nx * 0.8; b.vy -= vr * ny * 0.8; if (vr < -250) { api.sfx('catch'); if (!a.cpu) api.buzz(a.p.id, 60); if (!b.cpu) api.buzz(b.p.id, 60); } }
        }
        for (const pu of S.pickups) pu.t -= dt;
        for (const g of S.goo) g.t += dt;
        S.goo = S.goo.filter(g => g.t < 15);
        for (const f of S.fx) f.t += dt;
        S.fx = S.fx.filter(f => f.t < 0.6);
      }
      function camera(dt) {
        const tr = S.track, humans = S.karts.filter(k => !k.cpu && k.p.connected);
        const focus = humans.length ? humans : S.karts.slice(0, 1);
        let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
        for (const k of focus) { const lx = k.x + k.vx * 0.5, ly = k.y + k.vy * 0.5; x0 = Math.min(x0, k.x, lx); x1 = Math.max(x1, k.x, lx); y0 = Math.min(y0, k.y, ly); y1 = Math.max(y1, k.y, ly); }
        const zmin = zoomMin();
        const z = clamp(Math.min(W / (x1 - x0 + 1500), H / (y1 - y0 + 1000)), zmin, 0.62);
        const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, a = 1 - Math.exp(-dt * 2.5);
        S.cam.z += (z - S.cam.z) * a; S.cam.x += (cx - S.cam.x) * a; S.cam.y += (cy - S.cam.y) * a;
        // never show beyond the track area
        const b = tr.bounds, hw = W / 2 / S.cam.z, hh = H / 2 / S.cam.z;
        S.cam.x = (b.x1 - b.x0) < hw * 2 ? (b.x0 + b.x1) / 2 : clamp(S.cam.x, b.x0 + hw, b.x1 - hw);
        S.cam.y = (b.y1 - b.y0) < hh * 2 ? (b.y0 + b.y1) / 2 : clamp(S.cam.y, b.y0 + hh, b.y1 - hh);
      }

      inst.update = dt => {
        S.t += dt;
        if (S.phase === 'select') return;
        if (S.phase === 'standings') { if (S.t > 5) { S.raceNo++; startRace(S.queue.shift()); } return; }
        if (S.phase === 'count') {
          const n = Math.ceil(3 - S.t);
          if (n !== S.lastCount) { S.lastCount = n; api.sfx(n > 0 ? 'count' : 'go'); }
          if (S.t >= 3) { S.phase = 'race'; S.t = 0; }
        }
        if (S.phase === 'race' || S.phase === 'done') S.raceT += dt;
        physics(dt);
        camera(dt);
        if (S.phase === 'race') {
          const humans = S.karts.filter(k => !k.cpu);
          if (humans.every(k => k.done != null || !k.p.connected) || (S.firstFinish != null && S.raceT - S.firstFinish > 20) || S.raceT > 300) { S.phase = 'done'; S.t = 0; }
        }
        if (S.phase === 'done' && S.t > 3) finishRace();
      };
      inst.input = (p, m) => {
        if (S.phase === 'select') {
          if (m.t === 'btn' && m.b === 'a' && m.d) {
            const card = cards.find(cd => p.cx >= cd.x && p.cx <= cd.x + cd.w && p.cy >= cd.y && p.cy <= cd.y + cd.h);
            if (!card) return;
            api.sfx('start');
            if (card.gp) { S.gp = true; S.queue = TRACKS.slice(); S.raceNo = 1; startRace(S.queue.shift()); }
            else startRace(card.track);
          }
          return;
        }
        const k = S.karts.find(x => x.p === p); if (!k) return;
        if (m.t === 'steer') k.steer = clamp(m.s, -1, 1);
        if (m.t === 'tilt') k.steer = clamp(m.x, -1, 1);
        if (m.t === 'btn' && m.b === 'b') k.brake = m.d;
        if (m.t === 'item' && S.phase === 'race') useItem(k);
      };
      inst.resume = () => {};
      inst.debug = () => ({ phase: S.phase, track: S.track && S.track.def.id, raceT: +S.raceT.toFixed(1), karts: S.karts.map(k => [k.p.name, k.lap, k.idx, k.done]) });

      inst.draw = (c, t) => {
        if (S.phase === 'select') return drawSelect(c, t);
        if (S.phase === 'standings') return drawStandings(c, t);
        const tr = S.track;
        c.fillStyle = tr.def.bg; c.fillRect(0, 0, W, H);
        c.save();
        c.translate(W / 2, H / 2); c.scale(S.cam.z, S.cam.z); c.translate(-S.cam.x, -S.cam.y);
        drawTrack(c, tr, t);
        for (const pd of S.pads) {
          c.save(); c.translate(pd.x, pd.y); c.rotate(pd.h);
          rr(c, -70, -60, 140, 120, 16); c.fillStyle = '#ffb020'; c.fill();
          c.strokeStyle = '#fff'; c.lineWidth = 14; c.lineJoin = 'round';
          for (const o of [-30, 20]) { c.beginPath(); c.moveTo(o, -35); c.lineTo(o + 30, 0); c.lineTo(o, 35); c.stroke(); }
          c.restore();
        }
        for (const pu of S.pickups) {
          if (pu.t > 0) continue;
          const bob = Math.sin(t * 4 + pu.x) * 6;
          c.save(); c.translate(pu.x, pu.y + bob); c.rotate(t * 1.5);
          const g = c.createRadialGradient(-8, -8, 4, 0, 0, 34);
          g.addColorStop(0, '#fff'); g.addColorStop(0.5, `hsl(${(t * 120 + pu.x) % 360},90%,65%)`); g.addColorStop(1, `hsl(${(t * 120 + pu.x + 60) % 360},90%,50%)`);
          c.fillStyle = g; c.beginPath();
          for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2, r = i % 2 ? 22 : 36; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
          c.closePath(); c.fill(); c.restore();
        }
        for (const g of S.goo) {
          if (g.t > 14.5) continue;
          c.fillStyle = '#7bd94f'; c.globalAlpha = g.t > 14 ? (14.5 - g.t) * 2 : 1;
          c.beginPath(); c.ellipse(g.x, g.y, 54, 40, 0, 0, Math.PI * 2); c.fill();
          c.fillStyle = '#5bb52f'; c.beginPath(); c.ellipse(g.x - 12, g.y - 6, 20, 14, 0, 0, Math.PI * 2); c.fill();
          c.globalAlpha = 1;
        }
        S.karts.slice().sort((a, b) => a.y - b.y).forEach(k => drawKart(c, k, t));
        for (const k of S.karts) if (!k.cpu) {
          const ly = k.y - 78;
          c.font = `900 30px ${Huddle.FONT}`; c.textAlign = 'center'; c.lineWidth = 8; c.strokeStyle = '#fff'; c.lineJoin = 'round';
          c.strokeText(k.p.name, k.x, ly); c.fillStyle = k.p.color; c.fillText(k.p.name, k.x, ly);
          if (k.item) itemIcon(c, k.item, k.x + 70, k.y - 70, 22);
        }
        for (const f of S.fx) { c.strokeStyle = f.col; c.globalAlpha = 1 - f.t / 0.6; c.lineWidth = 16; c.beginPath(); c.arc(f.x, f.y, 60 + f.t * 400, 0, Math.PI * 2); c.stroke(); c.globalAlpha = 1; }
        c.restore();

        // HUD: positions
        const order = S.karts.slice().sort((a, b) => progress(b) - progress(a));
        c.save(); c.shadowColor = 'rgba(0,0,0,.25)'; c.shadowBlur = 16;
        rr(c, 20, 20, 330, 30 + order.length * 50, 26); c.fillStyle = 'rgba(255,255,255,.92)'; c.fill(); c.restore();
        order.forEach((k, i) => {
          const y = 56 + i * 50;
          text(c, String(i + 1), 50, y, 28, i === 0 ? '#ffb020' : '#8994a1', 'center', 900);
          avatar(c, k.p, 92, y, 17, 'happy', t);
          text(c, k.p.name, 120, y + 1, 24, k.cpu ? '#9aa5b1' : '#3a4654', 'left', 900);
          text(c, k.done != null ? '🏁' : `${clamp(k.lap, 1, LAPS)}/${LAPS}`, 330, y + 1, 22, k.cpu ? '#b3bcc6' : k.p.color, 'right', 900);
        });
        c.save(); c.shadowColor = 'rgba(0,0,0,.25)'; c.shadowBlur = 16;
        rr(c, W - 380, 20, 360, 90, 26); c.fillStyle = 'rgba(255,255,255,.92)'; c.fill(); c.restore();
        text(c, tr.def.name + (S.gp ? ` · Race ${S.raceNo}/3` : ''), W - 200, 48, 26, '#4a5866', 'center', 900);
        text(c, fmt(S.raceT), W - 200, 84, 32, '#33404d', 'center', 900);
        if (S.phase === 'count') {
          const n = Math.ceil(3 - S.t);
          c.save(); c.shadowColor = 'rgba(0,0,0,.3)'; c.shadowBlur = 20;
          rr(c, W / 2 - 200, 140, 400, 140, 40); c.fillStyle = '#1e2630'; c.fill(); c.restore();
          for (let i = 0; i < 3; i++) { c.fillStyle = i < 3 - n + 1 ? (n <= 0 ? '#2fc46b' : '#ff4d5e') : '#3a4654'; c.beginPath(); c.arc(W / 2 - 110 + i * 110, 210, 42, 0, Math.PI * 2); c.fill(); }
        }
        if (S.phase === 'race' && S.t < 0.8) outlined(c, 'GO!', W / 2, 220, 200, '#2fc46b', '#fff', 20);
        const leader = order[0];
        if (S.phase === 'race' && leader && !leader.cpu && leader.lap === LAPS && leader.done == null) text(c, 'FINAL LAP!', W / 2, 60, 46, '#ff4d5e', 'center', 900);
        if (S.phase === 'done') outlined(c, 'Race over!', W / 2, H / 2, 140, '#ffb020', '#fff', 18);
      };

      function drawSelect(c, t) {
        const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#2b6be6'); g.addColorStop(1, '#7b3fe0');
        c.fillStyle = g; c.fillRect(0, 0, W, H);
        outlined(c, 'Turbo Tracks', W / 2, 120, 110, '#fff', '#1e2a6e', 16);
        text(c, 'Pick a race: point at it and press A', W / 2, 215, 40, 'rgba(255,255,255,.85)', 'center', 800);
        const hov = new Set(players.filter(p => p.connected).map(p => cards.find(cd => p.cx >= cd.x && p.cx <= cd.x + cd.w && p.cy >= cd.y && p.cy <= cd.y + cd.h)).filter(Boolean));
        cards.forEach(cd => {
          const on = hov.has(cd), s = on ? 1.05 : 1;
          c.save(); c.translate(cd.x + cd.w / 2, cd.y + cd.h / 2); c.scale(s, s); c.translate(-cd.w / 2, -cd.h / 2);
          c.shadowColor = on ? 'rgba(255,255,255,.7)' : 'rgba(0,0,0,.3)'; c.shadowBlur = on ? 40 : 20;
          rr(c, 0, 0, cd.w, cd.h, 32); c.fillStyle = '#fff'; c.fill(); c.shadowColor = 'transparent';
          c.save(); rr(c, 12, 12, cd.w - 24, 250, 24); c.clip();
          if (cd.gp) {
            const gg = c.createLinearGradient(0, 0, 0, 260); gg.addColorStop(0, '#ffcf3d'); gg.addColorStop(1, '#ff8a2b');
            c.fillStyle = gg; c.fillRect(0, 0, cd.w, 270);
            c.fillStyle = '#fff'; c.beginPath();
            c.moveTo(cd.w / 2 - 70, 60); c.lineTo(cd.w / 2 + 70, 60); c.lineTo(cd.w / 2 + 55, 150); c.quadraticCurveTo(cd.w / 2, 190, cd.w / 2 - 55, 150); c.closePath(); c.fill();
            c.fillRect(cd.w / 2 - 12, 170, 24, 40); rr(c, cd.w / 2 - 50, 205, 100, 22, 8); c.fill();
          } else {
            const tr = build(cd.track), b = tr.bounds, sc = Math.min((cd.w - 24) / (b.x1 - b.x0), 250 / (b.y1 - b.y0));
            c.fillStyle = cd.track.bg; c.fillRect(0, 0, cd.w, 270);
            c.translate(cd.w / 2, 137); c.scale(sc, sc); c.translate(-(b.x0 + b.x1) / 2, -(b.y0 + b.y1) / 2);
            drawTrack(c, tr, t);
          }
          c.restore();
          text(c, cd.gp ? 'Grand Prix' : cd.track.name, cd.w / 2, 310, 40, '#33404d', 'center', 900);
          text(c, cd.gp ? 'All three tracks, points race' : cd.track.blurb, cd.w / 2, 360, 22, '#8994a1', 'center', 800);
          text(c, cd.gp ? '3 races · 3 laps each' : `${LAPS} laps`, cd.w / 2, 392, 22, '#2f8cff', 'center', 800);
          c.restore();
        });
        text(c, players.length < GRID ? `${GRID - players.length} CPU racer${GRID - players.length === 1 ? '' : 's'} will join to fill the grid` : '', W / 2, 800, 30, 'rgba(255,255,255,.8)', 'center', 800);
        text(c, 'Steer by turning your phone like a wheel, or hold the left or right side of its screen', W / 2, 860, 30, 'rgba(255,255,255,.8)', 'center', 800);
      }
      function drawStandings(c, t) {
        const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#2b6be6'); g.addColorStop(1, '#7b3fe0');
        c.fillStyle = g; c.fillRect(0, 0, W, H);
        outlined(c, 'Grand Prix standings', W / 2, 110, 84, '#fff', '#1e2a6e', 14);
        text(c, `Next: ${S.queue[0] ? S.queue[0].name : ''}`, W / 2, 190, 38, 'rgba(255,255,255,.85)', 'center', 800);
        S.standings.forEach((p, i) => {
          const y = 250 + i * 100;
          c.save(); c.shadowColor = 'rgba(0,0,0,.2)'; c.shadowBlur = 14;
          rr(c, 460, y, 1000, 84, 42); c.fillStyle = 'rgba(255,255,255,.95)'; c.fill(); c.restore();
          text(c, String(i + 1), 510, y + 44, 40, '#8994a1', 'center', 900);
          avatar(c, p, 590, y + 42, 30, i === 0 ? 'happy' : 'flat', t);
          text(c, p.name + (p.cpu ? ' (CPU)' : ''), 640, y + 44, 38, '#33404d', 'left', 900);
          text(c, `${S.gpPts[p.id] || 0} pts`, 1420, y + 44, 38, p.color, 'right', 900);
        });
      }
      return inst;
    },
  });
})();
