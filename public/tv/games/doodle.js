// Doodle Dash — one player draws a secret word on their phone, everyone else types guesses.
(() => {
  const { clamp, rand, pick, rr, text, outlined, avatar, wrap } = Huddle.helpers;
  const TURN = 80, READY = 3.5, REVEAL = 4.5;
  const BW = 660, BH = 880, BX = 70, BY = 130; // board on the TV (3:4, same as the phone)

  const WORDS = [
    // animals
    'cat', 'dog', 'fish', 'snake', 'spider', 'elephant', 'giraffe', 'penguin', 'octopus', 'snail', 'rabbit', 'shark', 'owl', 'crab',
    'butterfly', 'kangaroo', 'turtle', 'pig', 'cow', 'duck', 'frog', 'bee', 'mouse', 'lion', 'monkey', 'whale', 'bat', 'jellyfish',
    // food
    'pizza', 'banana', 'apple', 'ice cream', 'burger', 'hot dog', 'cake', 'donut', 'carrot', 'cheese', 'egg', 'sandwich', 'popcorn',
    'pineapple', 'cherry', 'cookie', 'sausage', 'spaghetti', 'watermelon', 'lollipop', 'mushroom', 'pancake', 'taco', 'grapes',
    // things
    'house', 'car', 'bicycle', 'rocket', 'umbrella', 'guitar', 'clock', 'glasses', 'key', 'ladder', 'phone', 'camera', 'sock',
    'crown', 'kite', 'balloon', 'candle', 'scissors', 'toothbrush', 'hammer', 'lamp', 'chair', 'boat', 'train', 'helicopter',
    'robot', 'computer', 'book', 'pencil', 'cup', 'hat', 'shoe', 'tent', 'bucket', 'anchor', 'trophy', 'drum', 'bell', 'magnet',
    'teapot', 'snowman', 'skateboard', 'castle', 'bridge', 'lighthouse', 'windmill', 'toilet', 'bed', 'door', 'envelope', 'sword',
    // nature & places
    'sun', 'moon', 'rainbow', 'cloud', 'tree', 'flower', 'volcano', 'island', 'mountain', 'cactus', 'star', 'lightning', 'snowflake',
    'waterfall', 'beach', 'planet', 'leaf', 'fire', 'tornado',
    // people & actions
    'pirate', 'ghost', 'alien', 'wizard', 'king', 'mermaid', 'dinosaur', 'dragon', 'unicorn', 'zombie', 'astronaut', 'clown',
    'sleeping', 'swimming', 'dancing', 'fishing', 'juggling', 'sneezing', 'skiing', 'birthday', 'football', 'tennis',
  ];

  const norm = s => String(s).toLowerCase().replace(/[^a-z]/g, '');
  function lev(a, b) {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length];
  }
  function judge(guess, word) {
    const g = norm(guess), w = norm(word);
    if (!g) return 'no';
    if (g === w || g === w + 's' || g + 's' === w || g === w + 'es') return 'yes';
    const dist = lev(g, w);
    if (dist <= (w.length >= 7 ? 2 : 1) || (g.length >= 3 && (w.includes(g) || g.includes(w)))) return 'close';
    return 'no';
  }

  // little preview doodle: a house with a sun, drawn over time
  const PREV = [
    { c: '#1e2630', p: [[.2, .55], [.2, .85], [.6, .85], [.6, .55], [.2, .55]] },
    { c: '#ff4d5e', p: [[.15, .57], [.4, .35], [.65, .57]] },
    { c: '#8d5b3a', p: [[.35, .85], [.35, .7], [.45, .7], [.45, .85]] },
    { c: '#ffd43b', p: Array.from({ length: 13 }, (_, i) => [.8 + Math.cos(i / 12 * Math.PI * 2) * .08, .22 + Math.sin(i / 12 * Math.PI * 2) * .08]) },
    { c: '#2fc46b', p: [[.05, .88], [.95, .88]] },
  ];

  Huddle.register({
    id: 'doodle',
    name: 'Doodle Dash',
    tagline: 'Draw it. Guess it. Fast.',
    desc: 'Players take turns being the artist. The artist gets a secret word and draws it on their phone, and the drawing appears live on the TV. Everyone else types guesses on their phone. Guess sooner for more points, and the artist scores for every player who gets it. Wrong guesses pop up on the TV, so don’t be shy.',
    controls: 'draw with your finger · type your guess',
    minPlayers: 2,
    preview(c, w, h, t) {
      const k = h / 208;
      c.fillStyle = '#ffe9a8'; c.fillRect(0, 0, w, h);
      const bh = h * 0.86, bw = bh * 0.75, bx = w * 0.12, by = h * 0.07;
      c.fillStyle = '#fff'; rr(c, bx, by, bw, bh, 10 * k); c.fill();
      const prog = (t * 0.35) % 1.3;
      const total = PREV.reduce((a, s) => a + s.p.length - 1, 0);
      let budget = prog * total;
      c.lineCap = 'round'; c.lineJoin = 'round'; c.lineWidth = 4 * k;
      for (const s of PREV) {
        if (budget <= 0) break;
        c.strokeStyle = s.c; c.beginPath(); c.moveTo(bx + s.p[0][0] * bw, by + s.p[0][1] * bh);
        for (let i = 1; i < s.p.length && budget > 0; i++, budget--) {
          const f = Math.min(1, budget), a = s.p[i - 1], b = s.p[i];
          c.lineTo(bx + (a[0] + (b[0] - a[0]) * f) * bw, by + (a[1] + (b[1] - a[1]) * f) * bh);
        }
        c.stroke();
      }
      const bub = [['box?', '#2f8cff'], ['tent?', '#ff4d5e'], ['HOUSE!', '#2fc46b']];
      bub.forEach(([s, col], i) => {
        if (prog < 0.3 + i * 0.3) return;
        const x = bx + bw + 24 * k, y = by + 30 * k + i * 52 * k;
        c.fillStyle = col; rr(c, x, y, 120 * k, 38 * k, 19 * k); c.fill();
        text(c, s, x + 60 * k, y + 20 * k, 20 * k, '#fff', 'center', 900);
      });
    },
    create(api, players) {
      const W = api.W, H = api.H;
      const turnsEach = players.length >= 4 ? 1 : 2;
      const order = [];
      for (let r = 0; r < turnsEach; r++) players.forEach(p => order.push(p));
      const S = {
        phase: 'intro', t: 0, turn: -1, word: '', used: new Set(), strokes: [], dirty: true, canPass: true,
        scores: {}, got: {}, feed: [], reveal: [], ended: false, artistPts: 0,
      };
      players.forEach(p => (S.scores[p.id] = 0));
      const board = document.createElement('canvas'); board.width = BW; board.height = BH;
      const bctx = board.getContext('2d');
      const artist = () => order[S.turn];

      function newWord() {
        let w, tries = 0;
        do { w = pick(WORDS); } while (S.used.has(w) && tries++ < 200);
        S.used.add(w); S.word = w;
        const letters = [...w].map((ch, i) => (ch === ' ' ? -1 : i)).filter(i => i >= 0);
        // two letters are revealed as the clock runs down
        S.reveal = []; S.hintOrder = letters.sort(() => Math.random() - 0.5).slice(0, Math.min(2, letters.length - 2));
        S.strokes = []; S.dirty = true;
      }
      function nextTurn() {
        S.turn++;
        if (S.turn >= order.length) return finish();
        S.phase = 'ready'; S.t = 0; S.got = {}; S.feed = []; S.canPass = true; S.artistPts = 0;
        newWord();
        const a = artist();
        api.setMode('wait', '', null, { text: `${a.name} is drawing next. Get ready to guess!` });
        api.setMode('wait', '', [a.id], { text: 'You’re the artist! Your word is coming…' });
        api.sfx('open');
      }
      function startDrawing() {
        S.phase = 'draw'; S.t = 0;
        const a = artist();
        players.forEach(p => {
          if (p === a) api.setMode('draw', 'Draw it! No letters or numbers', [p.id], { word: S.word, canPass: S.canPass });
          else api.setMode('guess', `Guess what ${a.name} is drawing`, [p.id], { round: S.turn + ':' + S.word, text: 'Type your guess and press Guess' });
        });
        api.sfx('go');
      }
      function endTurn() {
        S.phase = 'reveal'; S.t = 0;
        const n = Object.keys(S.got).length;
        api.setMode('wait', '', null, { text: `It was “${S.word.toUpperCase()}”` });
        api.sfx(n ? 'win' : 'miss');
      }
      function finish() {
        if (S.ended) return; S.ended = true;
        api.end(players.map(p => ({ p, score: S.scores[p.id], label: S.scores[p.id] + ' pts' })).sort((a, b) => b.score - a.score));
      }
      const guessers = () => players.filter(p => p !== artist());

      function renderBoard() {
        bctx.fillStyle = '#fff'; bctx.fillRect(0, 0, BW, BH);
        bctx.lineCap = 'round'; bctx.lineJoin = 'round';
        for (const st of S.strokes) {
          bctx.strokeStyle = st.c; bctx.fillStyle = st.c; bctx.lineWidth = st.w * BW;
          const p = st.pts;
          if (p.length === 1) { bctx.beginPath(); bctx.arc(p[0][0] * BW, p[0][1] * BH, st.w * BW / 2, 0, Math.PI * 2); bctx.fill(); continue; }
          bctx.beginPath(); bctx.moveTo(p[0][0] * BW, p[0][1] * BH);
          for (let i = 1; i < p.length; i++) bctx.lineTo(p[i][0] * BW, p[i][1] * BH);
          bctx.stroke();
        }
        S.dirty = false;
      }
      const okPt = q => Array.isArray(q) && q.length === 2 && isFinite(q[0]) && isFinite(q[1]);

      api.setMode('wait', '', null, { text: 'Doodle Dash is starting…' });

      return {
        update(dt) {
          S.t += dt;
          for (const f of S.feed) f.age += dt;
          if (S.phase === 'intro' && S.t > 2.5) nextTurn();
          else if (S.phase === 'ready' && S.t > READY) startDrawing();
          else if (S.phase === 'draw') {
            const frac = S.t / TURN;
            S.hintOrder.forEach((idx, i) => { if (frac > 0.5 + i * 0.2 && !S.reveal.includes(idx)) { S.reveal.push(idx); api.sfx('hover'); } });
            const g = guessers();
            if (S.t >= TURN || (g.length && g.every(p => S.got[p.id]))) endTurn();
          } else if (S.phase === 'reveal' && S.t > REVEAL) nextTurn();
        },
        input(p, m) {
          if (S.phase !== 'draw') return;
          if (p === artist()) {
            if (m.t === 'stroke' && Array.isArray(m.pts)) {
              const pts = m.pts.filter(okPt).slice(0, 400).map(q => [clamp(+q[0], 0, 1), clamp(+q[1], 0, 1)]);
              if (!pts.length) return;
              let st = S.strokes.length && S.strokes[S.strokes.length - 1].id === m.id ? S.strokes[S.strokes.length - 1] : null;
              if (!st && m.c) {
                st = { id: m.id, c: /^#[0-9a-f]{6}$/i.test(m.c) ? m.c : '#1e2630', w: clamp(+m.w || 0.02, 0.005, 0.12), pts: [] };
                S.strokes.push(st);
                if (S.strokes.length > 600) S.strokes.shift();
              }
              if (st) { st.pts.push(...pts); if (st.pts.length > 3000) st.pts.length = 3000; S.dirty = true; }
            } else if (m.t === 'undo') { S.strokes.pop(); S.dirty = true; }
            else if (m.t === 'clear') { S.strokes = []; S.dirty = true; }
            else if (m.t === 'pass' && S.canPass && S.t < TURN * 0.5) {
              S.canPass = false; newWord();
              api.setMode('draw', 'New word! Draw it', [p.id], { word: S.word, canPass: false });
              api.toast(`${p.name} picked a new word`, p.color);
            }
            return;
          }
          if (m.t !== 'guess' || S.got[p.id]) return;
          const g = String(m.text || '').trim().slice(0, 24);
          if (!g) return;
          const v = judge(g, S.word);
          if (v === 'yes') {
            const rank = Object.keys(S.got).length;
            const pts = 30 + Math.round(70 * clamp(1 - S.t / TURN, 0, 1)) + (rank === 0 ? 20 : 0);
            S.got[p.id] = { pts, rank };
            S.scores[p.id] += pts;
            S.scores[artist().id] += 25; S.artistPts += 25;
            S.feed.push({ p, s: 'got it!', kind: 'yes', age: 0 });
            api.sfx('gold'); api.buzz(p.id, 120, true); api.buzz(artist().id, 60);
            api.setMode('wait', '', [p.id], { text: `You got it! +${pts}` });
          } else {
            S.feed.push({ p, s: g, kind: v, age: 0 });
            api.send(p.id, { t: 'fb', text: v === 'close' ? `“${g}” is close!` : `Not “${g}”…`, kind: v, guess: g });
            api.sfx(v === 'close' ? 'catch' : 'hover');
          }
          if (S.feed.length > 14) S.feed.shift();
        },
        draw(c, t) {
          const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#fff3c4'); g.addColorStop(1, '#ffe08a');
          c.fillStyle = g; c.fillRect(0, 0, W, H);
          c.fillStyle = 'rgba(255,255,255,.35)';
          for (let i = 0; i < 14; i++) { c.save(); c.translate((i * 263) % W, (i * 181 + t * 10) % H); c.rotate(i + t * 0.2); rr(c, -14, -14, 28, 28, 6); c.fill(); c.restore(); }
          // easel board
          c.save(); c.shadowColor = 'rgba(120,80,0,.25)'; c.shadowBlur = 30; c.shadowOffsetY = 10;
          c.fillStyle = '#c98b4a'; rr(c, BX - 22, BY - 22, BW + 44, BH + 44, 26); c.fill(); c.restore();
          if (S.dirty) renderBoard();
          c.save(); rr(c, BX, BY, BW, BH, 12); c.clip(); c.drawImage(board, BX, BY); c.restore();
          const a = S.turn >= 0 && S.turn < order.length ? artist() : null;
          if (a) {
            avatar(c, a, BX + 40, 66, 34, 'happy', t);
            text(c, `${a.name} is drawing`, BX + 92, 66, 40, '#7a5200', 'left', 900);
          } else outlined(c, 'Doodle Dash', BX, 66, 56, '#ff7a2b', '#fff', 10, 'left');
          if (S.phase === 'ready' && a && S.strokes.length === 0) {
            outlined(c, `${a.name}, check your phone!`, BX + BW / 2, BY + BH / 2 - 40, 46, '#ff7a2b', '#fff', 10);
            text(c, 'Everyone else: guess on yours', BX + BW / 2, BY + BH / 2 + 26, 32, '#8a6a2a', 'center', 800);
          }

          // right panel
          const px = BX + BW + 90, pw = W - px - 70;
          // word blanks
          c.save(); c.shadowColor = 'rgba(0,0,0,.1)'; c.shadowBlur = 16;
          c.fillStyle = '#fff'; rr(c, px, BY - 22, pw, 190, 28); c.fill(); c.restore();
          const show = S.phase === 'reveal' || S.phase === 'over';
          if (S.word && S.phase !== 'intro' && S.phase !== 'ready') {
            const chars = [...S.word];
            const cw = Math.min(64, (pw - 60) / chars.length);
            const x0 = px + pw / 2 - (chars.length * cw) / 2 + cw / 2;
            chars.forEach((ch, i) => {
              const x = x0 + i * cw;
              if (ch === ' ') return;
              const vis = show || S.reveal.includes(i);
              if (vis) text(c, ch.toUpperCase(), x, BY + 50, Math.min(58, cw * 0.95), show ? '#1f9b54' : '#33404d', 'center', 900);
              c.fillStyle = '#c3ced9'; c.fillRect(x - cw * 0.36, BY + 92, cw * 0.72, 7);
            });
            text(c, `${S.word.replace(/ /g, '').length} letters${S.word.includes(' ') ? ', 2 words' : ''}`, px + pw / 2, BY + 136, 26, '#8994a1', 'center', 800);
          } else text(c, S.phase === 'ready' ? 'Get ready…' : 'Doodle Dash', px + pw / 2, BY + 70, 52, '#8994a1', 'center', 900);
          // timer
          if (S.phase === 'draw') {
            const left = Math.max(0, TURN - S.t), fr = left / TURN;
            c.fillStyle = 'rgba(0,0,0,.08)'; rr(c, px, BY + 196, pw, 22, 11); c.fill();
            c.fillStyle = left < 10 ? '#ff4d5e' : '#2fc46b'; rr(c, px, BY + 196, Math.max(22, pw * fr), 22, 11); c.fill();
            text(c, `${Math.ceil(left)}s`, px + pw, BY + 246, 34, left < 10 ? '#ff4d5e' : '#7a5200', 'right', 900);
          }
          text(c, `Turn ${Math.max(1, Math.min(order.length, S.turn + 1))} of ${order.length}`, px, BY + 246, 30, '#8a6a2a', 'left', 900);
          // scoreboard
          const rowH = Math.min(62, 300 / players.length);
          players.forEach((p, i) => {
            const y = BY + 300 + i * rowH;
            const isA = p === a, got = S.got[p.id];
            c.fillStyle = got ? 'rgba(47,196,107,.22)' : isA ? 'rgba(255,122,43,.18)' : 'rgba(255,255,255,.55)';
            rr(c, px, y, pw, rowH - 8, (rowH - 8) / 2); c.fill();
            avatar(c, p, px + rowH / 2 + 4, y + (rowH - 8) / 2, (rowH - 8) * 0.38, got ? 'happy' : isA ? 'shock' : 'flat', t);
            text(c, p.name, px + rowH + 14, y + (rowH - 8) / 2, Math.min(30, rowH * 0.5), '#4a3a10', 'left', 900);
            const tag = isA ? '✎ drawing' : got ? `✓ +${got.pts}` : '';
            text(c, tag, px + pw * 0.62, y + (rowH - 8) / 2, Math.min(26, rowH * 0.42), isA ? '#e0661a' : '#1f9b54', 'center', 900);
            text(c, String(S.scores[p.id]), px + pw - 24, y + (rowH - 8) / 2, Math.min(32, rowH * 0.52), p.color, 'right', 900);
          });
          // guess feed
          const fy = BY + 320 + players.length * rowH;
          let fx = px, row = 0;
          c.font = `900 26px ${api.FONT}`;
          for (let i = S.feed.length - 1; i >= 0 && row < 4; i--) {
            const f = S.feed[i];
            const label = f.kind === 'yes' ? `${f.p.name} got it!` : f.s;
            const bw = c.measureText(label).width + 36;
            if (fx + bw > px + pw) { fx = px; row++; if (row >= 4) break; }
            const y = fy + row * 56, pop = clamp(f.age * 6, 0, 1);
            c.save(); c.translate(fx + bw / 2, y + 22); c.scale(pop, pop);
            c.fillStyle = f.kind === 'yes' ? '#2fc46b' : f.p.color; c.globalAlpha = f.kind === 'no' ? 0.85 : 1;
            rr(c, -bw / 2, -22, bw, 44, 22); c.fill();
            if (f.kind === 'close') { c.lineWidth = 4; c.strokeStyle = '#ffd43b'; c.stroke(); }
            c.globalAlpha = 1;
            text(c, label, 0, 1, 26, '#fff', 'center', 900);
            c.restore();
            fx += bw + 10;
          }

          if (S.phase === 'intro') outlined(c, 'Doodle Dash!', W / 2, H / 2, 140, '#ff7a2b', '#fff', 18);
          if (S.phase === 'reveal') {
            c.fillStyle = 'rgba(255,243,196,.75)'; c.fillRect(BX, BY + BH / 2 - 110, BW, 220);
            text(c, 'It was…', BX + BW / 2, BY + BH / 2 - 60, 40, '#8a6a2a', 'center', 900);
            outlined(c, S.word.toUpperCase(), BX + BW / 2, BY + BH / 2 + 20, Math.min(96, 1100 / S.word.length), '#ff7a2b', '#fff', 14);
            const n = Object.keys(S.got).length;
            text(c, n ? `${n} got it · ${a.name} +${S.artistPts}` : 'Nobody got it!', BX + BW / 2, BY + BH / 2 + 84, 30, '#7a5200', 'center', 800);
          }
          if (S.phase === 'draw' && S.t < 1.2) outlined(c, 'GO!', BX + BW / 2, BY + BH / 2, 160, '#2fc46b', '#fff', 18);
        },
        debug() { return { phase: S.phase, turn: S.turn, of: order.length, word: S.word, strokes: S.strokes.length, scores: S.scores, got: Object.keys(S.got).length }; },
      };
    },
  });
})();
