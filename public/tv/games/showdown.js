// Sundown Showdown — reaction duel. Wait for DRAW, then tap first.
(() => {
  const { clamp, rand, rr, text, outlined, avatar } = Huddle.helpers;
  const ROUNDS = 5;

  function desert(c, w, h, t, glow = 0) {
    const g = c.createLinearGradient(0, 0, 0, h * 0.7);
    g.addColorStop(0, '#3b2a6b'); g.addColorStop(0.5, '#e8607a'); g.addColorStop(1, '#ffc36b');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    const sunR = h * 0.2;
    const sg = c.createRadialGradient(w / 2, h * 0.62, 0, w / 2, h * 0.62, sunR * 2);
    sg.addColorStop(0, `rgba(255,240,200,${0.9 + glow * 0.1})`); sg.addColorStop(0.45, 'rgba(255,200,120,.6)'); sg.addColorStop(1, 'rgba(255,200,120,0)');
    c.fillStyle = sg; c.fillRect(0, 0, w, h);
    c.fillStyle = '#fff1c9'; c.beginPath(); c.arc(w / 2, h * 0.62, sunR, 0, Math.PI * 2); c.fill();
    // mesas
    c.fillStyle = '#7b3a52';
    c.beginPath(); c.moveTo(0, h * 0.68);
    c.lineTo(w * 0.06, h * 0.5); c.lineTo(w * 0.2, h * 0.5); c.lineTo(w * 0.25, h * 0.6); c.lineTo(w * 0.34, h * 0.6); c.lineTo(w * 0.37, h * 0.68);
    c.lineTo(w * 0.7, h * 0.68); c.lineTo(w * 0.74, h * 0.55); c.lineTo(w * 0.9, h * 0.55); c.lineTo(w * 0.95, h * 0.68); c.lineTo(w, h * 0.68);
    c.lineTo(w, h); c.lineTo(0, h); c.fill();
    const gg = c.createLinearGradient(0, h * 0.68, 0, h);
    gg.addColorStop(0, '#c46a45'); gg.addColorStop(1, '#8a3f2c');
    c.fillStyle = gg; c.fillRect(0, h * 0.68, w, h * 0.32);
    // cacti
    const cactus = (x, y, s) => {
      c.fillStyle = '#3d5a3a';
      rr(c, x - 10 * s, y - 90 * s, 20 * s, 90 * s, 10 * s); c.fill();
      rr(c, x - 34 * s, y - 60 * s, 14 * s, 34 * s, 7 * s); c.fill();
      rr(c, x - 34 * s, y - 34 * s, 30 * s, 12 * s, 6 * s); c.fill();
      rr(c, x + 20 * s, y - 75 * s, 14 * s, 40 * s, 7 * s); c.fill();
      rr(c, x + 6 * s, y - 45 * s, 28 * s, 12 * s, 6 * s); c.fill();
    };
    const k = h / 1080;
    cactus(w * 0.1, h * 0.8, 1.6 * k); cactus(w * 0.88, h * 0.76, 1.2 * k);
  }
  function cowboy(c, p, x, y, s, t, state) {
    c.save(); c.translate(x, y);
    const mood = state === 'foul' ? 'sad' : state === 'win' ? 'happy' : state === 'wait' ? 'flat' : 'shock';
    avatar(c, p, 0, 0, 60 * s, mood, t);
    // hat
    c.fillStyle = '#6b4024';
    c.beginPath(); c.ellipse(0, -48 * s, 86 * s, 16 * s, 0, 0, Math.PI * 2); c.fill();
    rr(c, -44 * s, -100 * s, 88 * s, 56 * s, 22 * s); c.fill();
    c.fillStyle = '#3e2414'; c.fillRect(-44 * s, -62 * s, 88 * s, 12 * s);
    c.restore();
  }

  Huddle.register({
    id: 'showdown',
    name: 'Sundown Showdown',
    tagline: 'Fastest thumb in the west.',
    desc: 'Everyone stares each other down at sunset. When the screen shouts DRAW, tap your phone as fast as you can. Tap too early and you’re out for that round. The quickest tap wins each round, and there are 5 rounds.',
    controls: 'tap on DRAW',
    minPlayers: 1,
    preview(c, w, h, t) {
      desert(c, w, h, t);
      const k = h / 208;
      cowboy(c, { color: '#2f8cff', slot: 0 }, w * 0.3, h * 0.78, 0.38 * k, t, 'wait');
      cowboy(c, { color: '#ff4d5e', slot: 1 }, w * 0.7, h * 0.78, 0.38 * k, t, 'wait');
      if (Math.sin(t * 1.5) > 0.7) outlined(c, 'DRAW!', w / 2, h * 0.32, 50 * k, '#fff', '#3b2a6b', 7 * k);
    },
    create(api, players) {
      const W = api.W, H = api.H;
      const S = { round: 0, phase: 'intro', t: 2.5, drawAt: 0, wait: 0, points: {}, best: {}, times: {}, status: {}, roundWinner: null, ended: false, flash: 0, heartT: 0, fake: false };
      players.forEach(p => { S.points[p.id] = 0; S.best[p.id] = null; S.times[p.id] = []; });
      const solo = players.length === 1;

      function newRound() {
        S.round++; S.phase = 'wait'; S.t = 0; S.wait = rand(2.2, 5.5); S.roundWinner = null; S.flash = 0;
        players.forEach(p => (S.status[p.id] = { s: 'wait', time: null }));
        api.setMode('buzzer', 'Wait for DRAW… then tap!', null, { text: 'WAIT…' });
      }
      function settle() {
        S.phase = 'result'; S.t = 0;
        api.setMode('wait', '', null, { text: S.roundWinner ? `${S.roundWinner.name} wins the round` : 'No winner this round' });
      }
      function finish() {
        if (S.ended) return; S.ended = true;
        const res = players.map(p => {
          const ts = S.times[p.id]; const avg = ts.length ? ts.reduce((a, b) => a + b, 0) / ts.length : null;
          return {
            p,
            score: solo ? (avg ? -avg : -99) : S.points[p.id] * 10 - (S.best[p.id] || 9) / 10,
            label: solo ? (avg ? `avg ${(avg * 1000) | 0} ms` : 'no taps') : `${S.points[p.id]} win${S.points[p.id] === 1 ? '' : 's'}${S.best[p.id] ? ` · best ${(S.best[p.id] * 1000) | 0} ms` : ''}`,
          };
        }).sort((a, b) => b.score - a.score);
        api.end(res);
      }
      api.setMode('wait', 'Get ready…', null, { text: 'Get ready…' });

      return {
        update(dt) {
          S.t += dt; S.flash = Math.max(0, S.flash - dt * 2);
          if (S.phase === 'intro' && S.t > 2.5) newRound();
          else if (S.phase === 'wait') {
            S.heartT -= dt;
            if (S.heartT <= 0) { api.sfx('heart'); S.heartT = 0.9; }
            if (S.t >= S.wait) {
              S.phase = 'draw'; S.drawAt = performance.now(); S.t = 0; S.flash = 1;
              api.sfx('bang');
              api.setMode('buzzer', 'TAP NOW!', null, { text: 'DRAW!' });
              players.forEach(p => { if (S.status[p.id].s !== 'foul') api.buzz(p.id, 80); });
            }
          } else if (S.phase === 'draw') {
            const live = players.filter(p => S.status[p.id].s === 'wait');
            if (!live.length || S.t > 3) settle();
          } else if (S.phase === 'result' && S.t > 2.8) {
            if (S.round >= ROUNDS) { S.phase = 'end'; S.t = 0; }
            else newRound();
          } else if (S.phase === 'end' && S.t > 0.3) finish();
        },
        input(p, m) {
          if (!(m.t === 'btn' && m.b === 'a' && m.d)) return;
          const st = S.status[p.id]; if (!st || st.s !== 'wait') return;
          if (S.phase === 'wait') {
            st.s = 'foul'; api.sfx('bad'); api.buzz(p.id, 400);
            api.setMode('wait', '', [p.id], { text: 'Too early! Sit this one out.' });
            if (players.every(q => S.status[q.id].s === 'foul')) settle();
          } else if (S.phase === 'draw') {
            const time = (performance.now() - S.drawAt) / 1000;
            st.time = time; st.s = 'shot';
            S.times[p.id].push(time);
            if (S.best[p.id] == null || time < S.best[p.id]) S.best[p.id] = time;
            if (!S.roundWinner) { S.roundWinner = p; st.s = 'win'; S.points[p.id]++; api.sfx('win'); api.buzz(p.id, 200); }
            else api.sfx('catch');
            api.setMode('wait', '', [p.id], { text: `${(time * 1000) | 0} ms${st.s === 'win' ? ' — fastest!' : ''}` });
          }
        },
        draw(c, t) {
          desert(c, W, H, t, S.flash);
          const n = players.length;
          const gap = Math.min(300, (W - 200) / n);
          players.forEach((p, i) => {
            const x = W / 2 + (i - (n - 1) / 2) * gap, y = H * 0.78;
            const st = S.status[p.id] || { s: 'wait' };
            const sc = Math.min(1, gap / 260);
            const jump = st.s === 'win' ? -Math.abs(Math.sin(t * 8)) * 30 : 0;
            cowboy(c, p, x, y + jump, sc, t, st.s === 'shot' ? 'shock' : st.s);
            text(c, p.name, x, y + 95 * sc, 32 * Math.max(0.8, sc), '#fff', 'center', 900);
            let label = '', col = '#fff';
            if (st.s === 'foul') { label = 'TOO SOON'; col = '#ff4d5e'; }
            else if (st.time != null) { label = `${(st.time * 1000) | 0} ms`; col = st.s === 'win' ? '#ffe066' : '#fff'; }
            if (label) outlined(c, label, x, y - 175 * sc, 40 * Math.max(0.8, sc), col, '#3b2a6b', 8);
            // points pips
            for (let j = 0; j < S.points[p.id]; j++) {
              c.fillStyle = '#ffe066'; c.beginPath(); c.arc(x - 40 + j * 20, y + 135 * sc, 8, 0, Math.PI * 2); c.fill();
            }
          });
          // top bar
          c.save(); c.shadowColor = 'rgba(0,0,0,.2)'; c.shadowBlur = 16;
          rr(c, W / 2 - 200, 24, 400, 80, 40); c.fillStyle = 'rgba(255,255,255,.92)'; c.fill(); c.restore();
          text(c, `Round ${Math.max(1, S.round)} / ${ROUNDS}`, W / 2, 66, 40, '#3b2a6b', 'center', 900);
          if (S.phase === 'intro') outlined(c, 'Wait for it…', W / 2, H * 0.3, 110, '#fff', '#3b2a6b', 14);
          if (S.phase === 'wait') {
            const a = 0.5 + 0.5 * Math.sin(t * 4);
            c.globalAlpha = a; outlined(c, 'Steady…', W / 2, H * 0.3, 100, '#fff', '#3b2a6b', 14); c.globalAlpha = 1;
          }
          if (S.phase === 'draw') {
            const s = 1 + Math.max(0, 0.3 - S.t);
            c.save(); c.translate(W / 2, H * 0.3); c.scale(s, s);
            outlined(c, 'DRAW!', 0, 0, 230, '#fff', '#c2185b', 24); c.restore();
          }
          if (S.phase === 'result' || S.phase === 'end') {
            outlined(c, S.roundWinner ? `${S.roundWinner.name} wins!` : 'Nobody wins!', W / 2, H * 0.3, 110, S.roundWinner ? S.roundWinner.color : '#fff', '#fff', 16);
          }
          if (S.flash > 0) { c.fillStyle = `rgba(255,255,255,${S.flash * 0.8})`; c.fillRect(0, 0, W, H); }
        },
      };
    },
  });
})();
