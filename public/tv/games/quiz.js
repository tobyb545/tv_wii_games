// Brain Buzz — quick-fire quiz. Answer on your phone; faster correct answers score more.
(() => {
  const { clamp, rand, rr, text, outlined, avatar, wrap } = Huddle.helpers;
  const QUESTIONS = 10, TIME = 15;
  const COLS = ['#ff4d5e', '#2f8cff', '#f2a516', '#2fc46b'];
  const SHAPES = ['▲', '◆', '●', '■'];

  // [question, correct, wrong, wrong, wrong]
  const BANK = [
    ['Which planet is known as the Red Planet?', 'Mars', 'Venus', 'Jupiter', 'Mercury'],
    ['How many legs does a spider have?', '8', '6', '10', '12'],
    ['What is the largest ocean on Earth?', 'Pacific', 'Atlantic', 'Indian', 'Arctic'],
    ['Which gas do plants take in from the air?', 'Carbon dioxide', 'Oxygen', 'Nitrogen', 'Helium'],
    ['What is the capital of Australia?', 'Canberra', 'Sydney', 'Melbourne', 'Perth'],
    ['How many minutes are there in a day?', '1,440', '1,240', '2,400', '960'],
    ['What is the smallest prime number?', '2', '0', '1', '3'],
    ['What is the hardest natural substance?', 'Diamond', 'Gold', 'Iron', 'Quartz'],
    ['In which country are the Pyramids of Giza?', 'Egypt', 'Mexico', 'Peru', 'Sudan'],
    ['How many continents are there?', '7', '5', '6', '8'],
    ['Which instrument usually has 88 keys?', 'Piano', 'Guitar', 'Violin', 'Harp'],
    ['What colour do you get by mixing blue and yellow paint?', 'Green', 'Purple', 'Orange', 'Brown'],
    ['Who painted the Mona Lisa?', 'Leonardo da Vinci', 'Vincent van Gogh', 'Pablo Picasso', 'Michelangelo'],
    ['What is the fastest land animal?', 'Cheetah', 'Lion', 'Horse', 'Greyhound'],
    ['Which planet has the most famous rings?', 'Saturn', 'Mars', 'Earth', 'Venus'],
    ['How many sides does a hexagon have?', '6', '5', '7', '8'],
    ['At what temperature does water freeze, in °C?', '0', '32', '-10', '100'],
    ['What is the largest planet in our solar system?', 'Jupiter', 'Saturn', 'Neptune', 'Earth'],
    ['What is the main language spoken in Brazil?', 'Portuguese', 'Spanish', 'French', 'English'],
    ['How many players does a football (soccer) team have on the pitch?', '11', '9', '10', '12'],
    ['Which organ pumps blood around the body?', 'Heart', 'Lungs', 'Liver', 'Kidneys'],
    ['What is the capital of Japan?', 'Tokyo', 'Kyoto', 'Osaka', 'Hiroshima'],
    ['Which metal is liquid at room temperature?', 'Mercury', 'Lead', 'Tin', 'Aluminium'],
    ['How many days are there in a leap year?', '366', '364', '365', '367'],
    ['What is the tallest mountain above sea level?', 'Mount Everest', 'K2', 'Kilimanjaro', 'Mont Blanc'],
    ['What do bees make?', 'Honey', 'Silk', 'Butter', 'Jam'],
    ['What is the square root of 144?', '12', '10', '11', '14'],
    ['Which country gave the Statue of Liberty to the USA?', 'France', 'United Kingdom', 'Spain', 'Italy'],
    ['How many hearts does an octopus have?', '3', '1', '2', '4'],
    ['Which planet is closest to the Sun?', 'Mercury', 'Venus', 'Mars', 'Earth'],
    ['What is the currency of Japan?', 'Yen', 'Yuan', 'Won', 'Ringgit'],
    ['What is 7 × 8?', '56', '54', '63', '64'],
    ['What is the largest mammal?', 'Blue whale', 'African elephant', 'Giraffe', 'Hippopotamus'],
    ['Which language has the most native speakers?', 'Mandarin Chinese', 'English', 'Spanish', 'Hindi'],
    ['What is the capital of Canada?', 'Ottawa', 'Toronto', 'Vancouver', 'Montreal'],
    ['How many strings does a standard guitar have?', '6', '4', '5', '7'],
    ['What is the chemical symbol for gold?', 'Au', 'Ag', 'Go', 'Gd'],
    ['In which year did people first walk on the Moon?', '1969', '1959', '1965', '1972'],
    ['What is the largest hot desert in the world?', 'Sahara', 'Gobi', 'Kalahari', 'Mojave'],
    ['How many bones are in the adult human body?', '206', '186', '226', '246'],
    ['Which fruit is the main ingredient in guacamole?', 'Avocado', 'Lime', 'Mango', 'Kiwi'],
    ['What does a thermometer measure?', 'Temperature', 'Air pressure', 'Wind speed', 'Humidity'],
    ['How many hours are there in a week?', '168', '148', '178', '186'],
    ['Which planet rotates on its side?', 'Uranus', 'Neptune', 'Saturn', 'Mars'],
    ['At what temperature does water boil at sea level, in °C?', '100', '90', '110', '120'],
    ['Which famous ship sank on its first voyage in 1912?', 'Titanic', 'Lusitania', 'Mayflower', 'Endeavour'],
    ['Which country has the largest population?', 'India', 'China', 'United States', 'Indonesia'],
    ['How many teeth does an adult usually have?', '32', '28', '30', '36'],
    ['Who wrote "Romeo and Juliet"?', 'William Shakespeare', 'Charles Dickens', 'Jane Austen', 'Geoffrey Chaucer'],
    ['What is the largest organ of the human body?', 'Skin', 'Liver', 'Brain', 'Lungs'],
    ['How many zeros are there in one million?', '6', '5', '7', '9'],
    ['Which animal is called the "ship of the desert"?', 'Camel', 'Horse', 'Lizard', 'Ostrich'],
    ['On which continent is Kenya?', 'Africa', 'Asia', 'South America', 'Oceania'],
    ['What is a baby kangaroo called?', 'Joey', 'Cub', 'Kit', 'Calf'],
    ['What is the name of our galaxy?', 'Milky Way', 'Andromeda', 'Whirlpool', 'Sombrero'],
    ['How many sides does a stop sign have?', '8', '6', '10', '12'],
    ['Which country is famous for maple syrup?', 'Canada', 'Norway', 'Japan', 'Argentina'],
    ['Which ocean lies between Africa and Australia?', 'Indian', 'Atlantic', 'Pacific', 'Southern'],
    ['What is 15 + 27?', '42', '32', '43', '52'],
    ['Which sport uses a shuttlecock?', 'Badminton', 'Tennis', 'Squash', 'Table tennis'],
    ['How many weeks are there in a year?', '52', '50', '54', '56'],
    ['What is the largest country by area?', 'Russia', 'Canada', 'China', 'United States'],
    ['Which vitamin does your skin make from sunlight?', 'Vitamin D', 'Vitamin A', 'Vitamin C', 'Vitamin B12'],
    ['The Great Barrier Reef is off the coast of which country?', 'Australia', 'Brazil', 'Indonesia', 'South Africa'],
    ['What is the capital of Italy?', 'Rome', 'Milan', 'Venice', 'Naples'],
    ['What is the chemical symbol for water?', 'H₂O', 'CO₂', 'O₂', 'NaCl'],
    ['How many colours are in a rainbow?', '7', '5', '6', '8'],
    ['Which is the only mammal that can truly fly?', 'Bat', 'Flying squirrel', 'Sugar glider', 'Colugo'],
    ['Which country is home to the city of Marrakesh?', 'Morocco', 'Egypt', 'Tunisia', 'Turkey'],
    ['How many degrees are in a right angle?', '90', '45', '180', '360'],
    ['What is the capital of Spain?', 'Madrid', 'Barcelona', 'Seville', 'Valencia'],
    ['Which planet is famous for its Great Red Spot?', 'Jupiter', 'Mars', 'Saturn', 'Neptune'],
    ['How many players are on a basketball team on court?', '5', '6', '7', '4'],
    ['Which bird is the largest in the world?', 'Ostrich', 'Emu', 'Albatross', 'Condor'],
    ['What is 100 divided by 4?', '25', '20', '24', '40'],
    ['Which language is spoken in Mexico?', 'Spanish', 'Portuguese', 'English', 'French'],
    ['What is the closest star to Earth?', 'The Sun', 'Proxima Centauri', 'Sirius', 'Polaris'],
    ['How many seconds are in an hour?', '3,600', '360', '6,000', '1,200'],
    ['Which is the longest river in Africa?', 'Nile', 'Congo', 'Niger', 'Zambezi'],
    ['What shape is a honeycomb cell?', 'Hexagon', 'Square', 'Circle', 'Triangle'],
  ];

  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };

  function box(c, x, y, w, h, i, label, k = 1, dim = false, good = false) {
    c.save();
    c.globalAlpha = dim ? 0.3 : 1;
    c.shadowColor = 'rgba(0,0,0,.18)'; c.shadowBlur = 14 * k; c.shadowOffsetY = 5 * k;
    rr(c, x, y, w, h, 26 * k); c.fillStyle = COLS[i]; c.fill();
    c.shadowColor = 'transparent';
    if (good) { c.lineWidth = 10 * k; c.strokeStyle = '#fff'; c.stroke(); }
    text(c, SHAPES[i], x + 50 * k, y + h / 2, 46 * k, 'rgba(255,255,255,.9)', 'center', 900);
    c.font = `900 ${40 * k}px ${Huddle.FONT}`;
    let size = 40 * k; while (c.measureText(label).width > w - 130 * k && size > 22 * k) { size -= 2; c.font = `900 ${size}px ${Huddle.FONT}`; }
    text(c, label, x + 96 * k, y + h / 2 + 2, size, '#fff', 'left', 900);
    c.restore();
  }

  Huddle.register({
    id: 'quiz',
    name: 'Brain Buzz',
    tagline: 'Fast fingers, big brains.',
    desc: 'Ten quick general-knowledge questions. The answers appear on your phone. Tap the right one: the quicker you are, the more points you get. Wrong answers score nothing, so think fast but don’t panic.',
    controls: 'tap the answer',
    minPlayers: 1,
    preview(c, w, h, t) {
      const k = h / 208;
      const g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#5b3fd6'); g.addColorStop(1, '#2f8cff');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      rr(c, w * 0.1, h * 0.1, w * 0.8, h * 0.3, 14 * k); c.fillStyle = '#fff'; c.fill();
      text(c, '?', w / 2, h * 0.25, 44 * k, '#5b3fd6', 'center', 900);
      const pulse = Math.floor(t * 1.2) % 4;
      for (let i = 0; i < 4; i++) {
        const x = w * 0.1 + (i % 2) * w * 0.41, y = h * 0.47 + Math.floor(i / 2) * h * 0.2;
        c.save(); if (i === pulse) { c.translate(x + w * 0.195, y + h * 0.08); c.scale(1.06, 1.06); c.translate(-(x + w * 0.195), -(y + h * 0.08)); }
        rr(c, x, y, w * 0.39, h * 0.16, 8 * k); c.fillStyle = COLS[i]; c.fill();
        text(c, SHAPES[i], x + 14 * k, y + h * 0.08, 13 * k, '#fff', 'center', 900);
        c.restore();
      }
    },
    create(api, players) {
      const W = api.W, H = api.H;
      const qs = shuffle(BANK.slice()).slice(0, QUESTIONS).map(([q, ...opts]) => {
        const order = shuffle([0, 1, 2, 3]);
        return { q, opts: order.map(i => opts[i]), answer: order.indexOf(0) };
      });
      const S = { qi: -1, phase: 'intro', t: 0, scores: {}, picks: {}, gained: {}, streak: {}, ended: false, tickN: 0 };
      players.forEach(p => { S.scores[p.id] = 0; S.streak[p.id] = 0; });
      const cur = () => qs[S.qi];

      function next() {
        S.qi++;
        if (S.qi >= qs.length) { S.phase = 'final'; S.t = 0; api.setMode('wait', '', null, { text: 'And the winner is…' }); return; }
        S.phase = 'read'; S.t = 0; S.picks = {}; S.gained = {}; S.tickN = 0;
        api.setMode('wait', '', null, { text: 'Read the question on the TV…' });
        api.sfx('open');
      }
      function openAnswers() {
        S.phase = 'answer'; S.t = 0;
        api.setMode('choice', 'Pick your answer!', null, { options: cur().opts });
      }
      function reveal() {
        S.phase = 'reveal'; S.t = 0;
        const q = cur();
        players.forEach(p => {
          const pk = S.picks[p.id];
          let g = 0;
          if (pk && pk.i === q.answer) {
            S.streak[p.id]++;
            g = Math.round(500 + 500 * clamp(1 - pk.time / TIME, 0, 1)) + (S.streak[p.id] >= 3 ? 100 : 0);
            api.buzz(p.id, 150, true);
          } else { S.streak[p.id] = 0; if (pk) api.buzz(p.id, 400); }
          S.gained[p.id] = g; S.scores[p.id] += g;
          api.setMode('wait', '', [p.id], { text: g ? `Correct! +${g}` : pk ? 'Not this time…' : 'Too slow!' });
        });
        api.sfx(players.some(p => S.gained[p.id]) ? 'spare' : 'bad');
      }
      function finish() {
        if (S.ended) return; S.ended = true;
        api.end(players.map(p => ({ p, score: S.scores[p.id], label: S.scores[p.id] + ' pts' })).sort((a, b) => b.score - a.score));
      }
      api.setMode('wait', '', null, { text: 'Get your thinking cap on…' });

      return {
        update(dt) {
          S.t += dt;
          if (S.phase === 'intro' && S.t > 2.5) next();
          else if (S.phase === 'read' && S.t > 2.8) openAnswers();
          else if (S.phase === 'answer') {
            const left = TIME - S.t, n = Math.ceil(left);
            if (left <= 5 && n !== S.tickN) { S.tickN = n; api.sfx('tick'); }
            if (left <= 0 || players.every(p => S.picks[p.id])) reveal();
          } else if (S.phase === 'reveal' && S.t > 4.2) next();
          else if (S.phase === 'final' && S.t > 0.5) finish();
        },
        input(p, m) {
          if (m.t !== 'choice' || S.phase !== 'answer' || S.picks[p.id]) return;
          S.picks[p.id] = { i: clamp(m.i | 0, 0, 3), time: S.t };
          api.sfx('catch');
          api.setMode('wait', '', [p.id], { text: `Locked in: ${SHAPES[S.picks[p.id].i]} ${cur().opts[S.picks[p.id].i]}` });
        },
        draw(c, t) {
          const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#4b33c2'); g.addColorStop(1, '#2477e6');
          c.fillStyle = g; c.fillRect(0, 0, W, H);
          c.fillStyle = 'rgba(255,255,255,.04)';
          for (let i = 0; i < 14; i++) { c.beginPath(); c.arc((i * 337 + t * 20) % (W + 200) - 100, (i * 211) % H, 60 + (i % 4) * 40, 0, Math.PI * 2); c.fill(); }
          if (S.phase === 'intro') { outlined(c, 'Brain Buzz!', W / 2, H * 0.42, 150, '#fff', '#2b1a8a', 18); text(c, `${QUESTIONS} questions · answer on your phone`, W / 2, H * 0.58, 44, 'rgba(255,255,255,.85)', 'center', 800); }
          const q = cur();
          if (q && (S.phase === 'read' || S.phase === 'answer' || S.phase === 'reveal')) {
            text(c, `Question ${S.qi + 1} of ${qs.length}`, 80, 70, 34, 'rgba(255,255,255,.8)', 'left', 900);
            c.save(); c.shadowColor = 'rgba(0,0,0,.2)'; c.shadowBlur = 24;
            rr(c, 80, 110, W - 160, 260, 36); c.fillStyle = '#fff'; c.fill(); c.restore();
            c.font = `900 60px ${Huddle.FONT}`;
            const big = c.measureText(q.q).width > W - 260;
            wrapC(c, q.q, W / 2, 240, W - 260, big ? 54 : 60, big ? 70 : 76);
            if (S.phase !== 'read') {
              const bw = (W - 200) / 2, bh = 150;
              q.opts.forEach((o, i) => {
                const x = 80 + (i % 2) * (bw + 40), y = 420 + Math.floor(i / 2) * (bh + 30);
                const rv = S.phase === 'reveal';
                box(c, x, y, bw, bh, i, o, 1, rv && i !== q.answer, rv && i === q.answer);
                if (rv) {
                  const who = players.filter(p => S.picks[p.id] && S.picks[p.id].i === i);
                  who.forEach((p, j) => avatar(c, p, x + bw - 50 - j * 56, y + bh / 2, 24, i === q.answer ? 'happy' : 'sad', t));
                }
              });
            } else {
              const k = S.t / 2.8;
              c.fillStyle = 'rgba(255,255,255,.3)'; rr(c, 80, 420, W - 160, 16, 8); c.fill();
              c.fillStyle = '#fff'; rr(c, 80, 420, (W - 160) * k, 16, 8); c.fill();
              text(c, 'Get ready…', W / 2, 520, 50, '#fff', 'center', 900);
            }
            if (S.phase === 'answer') {
              const left = Math.max(0, TIME - S.t);
              c.save(); c.translate(W - 140, 70);
              c.fillStyle = '#fff'; c.beginPath(); c.arc(0, 0, 52, 0, Math.PI * 2); c.fill();
              c.strokeStyle = left < 5 ? '#ff4d5e' : '#5b3fd6'; c.lineWidth = 10;
              c.beginPath(); c.arc(0, 0, 40, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left / TIME); c.stroke();
              text(c, String(Math.ceil(left)), 0, 2, 40, '#33404d', 'center', 900);
              c.restore();
              const n = Object.keys(S.picks).length;
              text(c, `${n} / ${players.length} answered`, W - 220, 70, 30, '#fff', 'right', 900);
            }
          }
          // scores strip
          if (S.phase !== 'intro') {
            const sorted = players.slice().sort((a, b) => S.scores[b.id] - S.scores[a.id]);
            const n = sorted.length, cw = Math.min(230, (W - 120) / n);
            sorted.forEach((p, i) => {
              const x = W / 2 + (i - (n - 1) / 2) * (cw + 10) - cw / 2, y = H - 110;
              c.save(); c.shadowColor = 'rgba(0,0,0,.2)'; c.shadowBlur = 12;
              rr(c, x, y, cw, 84, 42); c.fillStyle = 'rgba(255,255,255,.95)'; c.fill(); c.restore();
              avatar(c, p, x + 42, y + 42, 26, S.phase === 'reveal' ? (S.gained[p.id] ? 'happy' : 'sad') : 'happy', t);
              text(c, String(S.scores[p.id]), x + cw - 22, y + 44, 36, p.color, 'right', 900);
              if (S.phase === 'reveal' && S.gained[p.id]) outlined(c, '+' + S.gained[p.id], x + cw / 2 + 20, y - 24 - S.t * 10, 34, '#2fc46b', '#fff', 7);
              if (S.phase === 'answer' && S.picks[p.id]) { c.fillStyle = '#2fc46b'; c.beginPath(); c.arc(x + 62, y + 20, 12, 0, Math.PI * 2); c.fill(); text(c, '✓', x + 62, y + 21, 16, '#fff', 'center', 900); }
            });
          }
        },
      };
      function wrapC(c, str, x, y, maxW, size, lh) {
        c.font = `900 ${size}px ${Huddle.FONT}`;
        const lines = []; let line = '';
        for (const w of str.split(' ')) { const tt = line ? line + ' ' + w : w; if (c.measureText(tt).width > maxW && line) { lines.push(line); line = w; } else line = tt; }
        if (line) lines.push(line);
        lines.forEach((l, i) => text(c, l, x, y + (i - (lines.length - 1) / 2) * lh, size, '#33404d', 'center', 900));
      }
    },
  });
})();
