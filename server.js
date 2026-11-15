// Huddle — party console server.
// Serves the TV screen and the phone controller, and relays messages between them.
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { WebSocketServer } = require('ws');
const QRCode = require('qrcode');

const PORT = +process.env.PORT || 3000;
const SPORT = +process.env.SPORT || 3443;
const PUBLIC = path.join(__dirname, 'public');
const MAX_PLAYERS = 8;
const COLORS = ['#2f8cff', '#ff4d5e', '#2fc46b', '#ffb020', '#a35cff', '#ff5fb4', '#16c2b0', '#ff8a2b'];

function lanIP() {
  const nets = os.networkInterfaces();
  const order = ['en0', 'en1', 'wlan0', 'eth0'];
  const all = [];
  for (const [name, list] of Object.entries(nets)) {
    for (const n of list || []) {
      if (n.family === 'IPv4' && !n.internal) all.push({ name, address: n.address });
    }
  }
  all.sort((a, b) => (order.indexOf(a.name) + 1 || 99) - (order.indexOf(b.name) + 1 || 99));
  return all[0] ? all[0].address : '127.0.0.1';
}
const IP = process.env.HOST_IP || lanIP();

// ---- Self-signed certificate so phones can use motion sensors (they require HTTPS) ----
function ensureCert() {
  const dir = path.join(__dirname, 'certs');
  const key = path.join(dir, 'key.pem');
  const cert = path.join(dir, 'cert.pem');
  const stamp = path.join(dir, 'ip.txt');
  try {
    if (fs.existsSync(key) && fs.existsSync(cert) && fs.readFileSync(stamp, 'utf8') === IP) {
      return { key: fs.readFileSync(key), cert: fs.readFileSync(cert) };
    }
  } catch {}
  try {
    fs.mkdirSync(dir, { recursive: true });
    execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert,
      '-days', '825', '-subj', '/CN=Huddle Console',
      '-addext', `subjectAltName=IP:${IP},IP:127.0.0.1,DNS:localhost`], { stdio: 'ignore' });
    fs.writeFileSync(stamp, IP);
    return { key: fs.readFileSync(key), cert: fs.readFileSync(cert) };
  } catch (e) {
    console.warn('! Could not create an HTTPS certificate (is openssl installed?). Phones will fall back to touch controls.');
    return null;
  }
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

const tls = ensureCert();
const joinUrl = tls ? `https://${IP}:${SPORT}/play` : `http://${IP}:${PORT}/play`;
let qrSvg = '';
QRCode.toString(joinUrl, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' }).then(s => (qrSvg = s));

function handler(req, res) {
  const url = new URL(req.url, 'http://x');
  let p = decodeURIComponent(url.pathname);
  if (p === '/api/info') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify({ ip: IP, joinUrl, tvUrl: `http://${IP}:${PORT}/`, qrSvg, secure: !!tls }));
  }
  if (p === '/') p = '/tv/index.html';
  else if (p === '/play' || p === '/play/') p = '/pad/index.html';
  const file = path.normalize(path.join(PUBLIC, p));
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}

// ---- Relay hub ----
let host = null;
const pads = new Map(); // id -> { id, ws, slot, name, color, goneTimer }
const send = (ws, m) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); };
const padInfo = p => ({ id: p.id, slot: p.slot, name: p.name, color: p.color, connected: !!p.ws });
const toHost = m => send(host, m);

function onConnection(ws, req) {
  const u = new URL(req.url, 'http://x');
  const role = u.searchParams.get('role');
  ws.isAlive = true;
  ws.on('pong', () => (ws.isAlive = true));

  if (role === 'host') {
    if (host && host !== ws) host.close();
    host = ws;
    send(ws, { t: 'list', pads: [...pads.values()].filter(p => p.ws).map(padInfo) });
    ws.on('message', raw => {
      let m; try { m = JSON.parse(raw); } catch { return; }
      if (m.t !== 'to') return;
      if (m.id === '*') pads.forEach(p => send(p.ws, m.m));
      else { const p = pads.get(m.id); if (p) send(p.ws, m.m); }
    });
    ws.on('close', () => { if (host === ws) host = null; });
    return;
  }

  // controller
  const id = (u.searchParams.get('id') || crypto.randomUUID()).slice(0, 64);
  const name = (u.searchParams.get('name') || '').trim().slice(0, 14);
  let p = pads.get(id);
  if (p) {
    clearTimeout(p.goneTimer);
    if (p.ws && p.ws !== ws) { const old = p.ws; p.ws = null; old.close(); }
    if (name) p.name = name;
  } else {
    const used = new Set([...pads.values()].map(x => x.slot));
    let slot = -1;
    for (let i = 0; i < MAX_PLAYERS; i++) if (!used.has(i)) { slot = i; break; }
    if (slot < 0) { send(ws, { t: 'full' }); return ws.close(); }
    p = { id, slot, name: name || `Player ${slot + 1}`, color: COLORS[slot] };
    pads.set(id, p);
  }
  p.ws = ws;
  send(ws, { t: 'info', id, slot: p.slot, name: p.name, color: p.color, hostOnline: !!host });
  toHost({ t: 'join', ...padInfo(p) });

  ws.on('message', raw => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (m.t === 'name') {
      p.name = String(m.name || '').trim().slice(0, 14) || p.name;
      send(ws, { t: 'info', id, slot: p.slot, name: p.name, color: p.color, hostOnline: !!host });
      return toHost({ t: 'join', ...padInfo(p) });
    }
    toHost({ t: 'in', id, m });
  });
  ws.on('close', () => {
    if (p.ws !== ws) return;
    p.ws = null;
    toHost({ t: 'leave', id });
    // Keep the slot for a while so a phone that locks its screen gets the same player back.
    p.goneTimer = setTimeout(() => { if (!p.ws) { pads.delete(id); toHost({ t: 'gone', id }); } }, 90_000);
  });
}

const wss = new WebSocketServer({ noServer: true });
wss.on('connection', onConnection);
const upgrade = (req, sock, head) => {
  if (!req.url.startsWith('/ws')) return sock.destroy();
  wss.handleUpgrade(req, sock, head, ws => wss.emit('connection', ws, req));
};
setInterval(() => wss.clients.forEach(ws => {
  if (!ws.isAlive) return ws.terminate();
  ws.isAlive = false; ws.ping();
}), 10_000);

const httpServer = http.createServer(handler);
httpServer.on('upgrade', upgrade);
httpServer.listen(PORT, '0.0.0.0');
if (tls) {
  const httpsServer = https.createServer(tls, handler);
  httpsServer.on('upgrade', upgrade);
  httpsServer.listen(SPORT, '0.0.0.0');
}

console.log(`
  ╭──────────────────────────────────────────────╮
  │  HUDDLE party console is running             │
  ╰──────────────────────────────────────────────╯
  TV screen (this laptop):  http://localhost:${PORT}
  TV screen (smart TV):     http://${IP}:${PORT}
  Phones join at:           ${joinUrl}
  ${tls ? 'Phones will see a certificate warning the first time — tap\n  "Show details / Advanced" → "visit / proceed". That unlocks motion controls.' : ''}
`);
