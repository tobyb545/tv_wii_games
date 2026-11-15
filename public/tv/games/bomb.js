// Tick Tock Bomb — pass the bomb before it blows. Last one standing wins.
(() => {
  const { clamp, rand, pick, rr, text, outlined, avatar, lerp } = Huddle.helpers;
  const TAPS = 3;

  function room(c, w, h, t, shake = 0) {
    const g = c.createRadialGradient(w / 2, h * 0.5, 50, w / 2, h * 0.5, w * 0.7);
    g.addColorStop(0, '#3d4a78'); g.addColorStop(1, '#141a2e');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(255,255,255,.04)';
    for (let i = 0; i < 12; i++) { c.beginPath(); c.arc(w / 2, h * 0.55, (i + 1) * w * 0.06, 0, Math.PI * 2); c.fill(); }
  }
  function bomb(c, x, y, r, t, fuse = 1) {
    c.save(); c.translate(x, y); c.rotate(Math.sin(t * 20) * 0.08);
    c.fillStyle = '#1b1f2a'; c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(255,255,255,.25)'; c.beginPath(); c.ellipse(-r * 0.35, -r * 0.35, r * 0.22, r * 0.32, -0.6, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#555c6b'; rr(c, -r * 0.25, -r * 1.2, r * 0.5, r * 0.3, 4); c.fill();
    c.strokeStyle = '#c9a26b'; c.lineWidth = r * 0.1; c.lineCap = 'round';
    c.beginPath(); c.moveTo(0, -r * 1.2); c.quadraticCurveTo(r * 0.4, -r * 1.6, r * 0.5, -r * 1.75); c.stroke();
    // spark
    const sx = r * 0.5, sy = -r * 1.75;
    for (let i = 0; i < 8; i++) {
      const a = t * 30 + i * 0.8, l = r * (0.2 + Math.random() * 0.3);
      c.strokeStyle = i % 2 ? '#ffd23f' : '#ff7a2b'; c.lineWidth = 3;
      c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx + Math.cos(a) * l, sy + Math.sin(a) * l); c.stroke();
    }
    c.restore();
  }

  Huddle.register({
    id: 'bomb',
    name: 'Tick Tock Bomb',
    tagline: 'Hot potato, but louder.',
    desc: 'The bomb is passed around the room and its fuse is secret. When it lands on your phone, tap 3 times to throw it to someone else. If it goes off in your hands, you’re out. The last player standing wins.',
    controls: 'tap to throw',
    minPlayers: 2,
    preview(c, w, h, t) {
      room(c, w, h, t);
      const k = h / 208;
      const cols = ['#2f8cff', '#ff4d5e', '#2fc46b', '#ffb020'];
      cols.forEach((col, i) => {
        const a = i / cols.length * Math.PI * 2 + 0.4;
        avatar(c, { color: col, slot: i }, w / 2 + Math.cos(a) * 120 * k, h * 0.52 + Math.sin(a) * 60 * k, 20 * k, 'shock', t);
      });
      const f = (t * 0.8) % 1, i = Math.floor(t * 0.8) % 4;
      const a1 = i / 4 * Math.PI * 2 + 0.4, a2 = (i + 1) / 4 * Math.PI * 2 + 0.4;
      const x = lerp(Math.cos(a1), Math.cos(a2), f) * 120 * k + w / 2, y = lerp(Math.sin(a1), Math.sin(a2), f) * 60 * k + h * 0.52 - Math.sin(f * Math.PI) * 50 * k;
      bomb(c, x, y - 20 * k, 14 * k, t);
    },
    create(api, players) {
      const W = api.W, H = api.H;
      const S = { phase: 'intro', t: 0, alive: players.slice(), out: [], holder: null, prev: null, flight: null, fuse: 0, taps: 0, tickT: 0, boom: null, shake: 0, ended: false, round: 0 };
      const pos = p => {
        const i = players.indexOf(p), n = players.length;
        const a = -Math.PI / 2 + i / n * Math.PI * 2;
        return { x: W / 2 + Math.cos(a) * Math.min(700, 260 + n * 60), y: H * 0.55 + Math.sin(a) * 330 };
      };
      function modes() {
        players.forEach(p => {
          if (!S.alive.includes(p)) api.setMode('wait', '', [p.id], { text: 'You’re out. Cheer everyone on!' });
          else if (p === S.holder) api.setMode('bomb', `You have the bomb! Tap ${TAPS}× to throw it`, [p.id], { text: `TAP ${TAPS - S.taps}× TO THROW` });
          else api.setMode('wait', '', [p.id], { text: 'Phew… stay ready!' });
        });
      }
      function newRound() {
        S.round++; S.phase = 'play'; S.t = 0;
        S.fuse = rand(9, 20) + S.alive.length;
        S.holder = pick(S.alive); S.prev = null; S.taps = 0; S.flight = null;
        api.sfx('catch'); api.buzz(S.holder.id, 120, true);
        modes();
      }
      function explode(victim) {
        S.phase = 'boom'; S.t = 0; S.boom = victim; S.shake = 1;
        api.sfx('boom'); api.buzz(victim.id, 900, true);
        S.alive = S.alive.filter(p => p !== victim); S.out.push(victim);
        S.holder = null; S.flight = null;
        modes();
        api.setMode('wait', '', [victim.id], { text: 'BOOM! You’re out.' });
      }
      function finish() {
        if (S.ended) return; S.ended = true;
        const order = [...S.alive, ...S.out.slice().reverse()];
        const ord = n => n + (['th', 'st', 'nd', 'rd'][(n % 100 - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th');
        api.end(order.map((p, i) => ({ p, score: order.length - i, label: i === 0 ? 'Survivor!' : `out ${ord(S.out.indexOf(p) + 1)}` })));
      }
      api.setMode('wait', 'Get ready…', null, { text: 'Get ready…' });

      return {
        update(dt) {
          S.t += dt; S.shake = Math.max(0, S.shake - dt * 1.5);
          if (S.phase === 'intro' && S.t > 2.5) newRound();
          else if (S.phase === 'play') {
            S.fuse -= dt;
            S.tickT -= dt;
            if (S.tickT <= 0) { api.sfx(Math.floor(S.t * 4) % 2 ? 'tick' : 'tock'); S.tickT = clamp(S.fuse / 14, 0.12, 0.6); }
            if (S.flight) {
              S.flight.t += dt / S.flight.dur;
              if (S.flight.t >= 1) {
                S.holder = S.flight.to; S.prev = S.flight.from; S.flight = null; S.taps = 0;
                api.sfx('catch'); api.buzz(S.holder.id, 150, true); modes();
              }
            }
            if (S.fuse <= 0) explode(S.flight ? S.flight.to : S.holder);
          } else if (S.phase === 'boom' && S.t > 3) {
            if (S.alive.length <= 1) { S.phase = 'end'; S.t = 0; } else newRound();
          } else if (S.phase === 'end' && S.t > 1.5) finish();
        },
        input(p, m) {
          const tap = (m.t === 'btn' && m.b === 'a' && m.d) || m.t === 'shake';
          if (!tap || S.phase !== 'play' || p !== S.holder || S.flight) return;
          S.taps++;
          if (S.taps < TAPS) { api.sfx('tick'); api.setMode('bomb', 'Keep tapping!', [p.id], { text: `TAP ${TAPS - S.taps}× TO THROW` }); return; }
          let options = S.alive.filter(q => q !== p);
          if (options.length > 1 && S.prev) options = options.filter(q => q !== S.prev);
          const to = pick(options);
          S.flight = { from: p, to, t: 0, dur: 0.55 }; S.holder = null;
          api.sfx('whoosh');
          api.setMode('wait', '', [p.id], { text: `Thrown to ${to.name}!` });
        },
        draw(c, t) {
          c.save();
          if (S.shake > 0) c.translate(rand(-30, 30) * S.shake, rand(-30, 30) * S.shake);
          room(c, W, H, t);
          players.forEach(p => {
            const q = pos(p), alive = S.alive.includes(p);
            c.globalAlpha = alive ? 1 : 0.35;
            const holding = p === S.holder || (S.flight && S.flight.to === p);
            avatar(c, p, q.x, q.y, 70, !alive ? 'ko' : holding ? 'shock' : 'happy', t);
            text(c, p.name, q.x, q.y + 100, 34, '#fff', 'center', 900);
            c.globalAlpha = 1;
          });
          if (S.holder) {
            const q = pos(S.holder);
            bomb(c, q.x + 70, q.y - 70, 46, t);
            for (let i = 0; i < TAPS; i++) {
              c.fillStyle = i < S.taps ? '#ffd23f' : 'rgba(255,255,255,.25)';
              c.beginPath(); c.arc(q.x - 30 + i * 30, q.y - 110, 10, 0, Math.PI * 2); c.fill();
            }
          }
          if (S.flight) {
            const a = pos(S.flight.from), b = pos(S.flight.to), f = S.flight.t;
            const x = lerp(a.x, b.x, f), y = lerp(a.y, b.y, f) - Math.sin(f * Math.PI) * 220;
            bomb(c, x, y - 50, 46, t);
          }
          if (S.phase === 'boom' && S.boom) {
            const q = pos(S.boom), k = Math.min(1, S.t * 3);
            const g = c.createRadialGradient(q.x, q.y, 0, q.x, q.y, 400 * k);
            g.addColorStop(0, `rgba(255,240,180,${1 - S.t / 3})`); g.addColorStop(0.4, `rgba(255,140,40,${0.8 * (1 - S.t / 3)})`); g.addColorStop(1, 'rgba(255,80,40,0)');
            c.fillStyle = g; c.fillRect(0, 0, W, H);
            outlined(c, 'BOOM!', W / 2, H * 0.18, 200, '#ff7a2b', '#fff', 22);
            text(c, `${S.boom.name} is out!`, W / 2, H * 0.3, 54, '#fff', 'center', 900);
          }
          c.restore();
          if (S.phase === 'intro') outlined(c, 'Don’t get caught holding it!', W / 2, H * 0.18, 84, '#fff', '#141a2e', 14);
          if (S.phase === 'end') outlined(c, `${S.alive[0] ? S.alive[0].name : 'Nobody'} survives!`, W / 2, H * 0.18, 110, '#ffd23f', '#141a2e', 14);
          text(c, `${S.alive.length} left`, W - 60, 60, 40, 'rgba(255,255,255,.8)', 'right', 900);
        },
      };
    },
  });
})();
