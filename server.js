// KTV Lung Linh 3D — server online (Express + Socket.io)
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const store = require('./store');

const app = express();
app.use(express.static(path.join(__dirname, 'public')));
app.use('/vendor/three', express.static(path.join(__dirname, 'node_modules', 'three')));
app.use('/vendor/three-vrm', express.static(path.join(__dirname, 'node_modules', '@pixiv', 'three-vrm', 'lib')));
app.get('/health', (req, res) => res.send('ok'));
// danh sách file nhạc trong public/music (tự nhận mọi file mp3/m4a/ogg/wav)
const fs = require('fs');
app.get('/music-list', (req, res) => {
  fs.readdir(path.join(__dirname, 'public', 'music'), (err, files) => {
    if (err) return res.json([]);
    res.json(files.filter((f) => /\.(mp3|m4a|ogg|wav|aac)$/i.test(f)));
  });
});

const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

// ---------------- Dữ liệu game ----------------
const ROOMS = [
  { id: 0, seats: 2 },
  { id: 1, seats: 2 },
  { id: 2, seats: 2 },
  { id: 3, seats: 3, vip: true },
];
const GENRES = ['Bolero', 'Nhạc trẻ', 'K-pop', 'Rap', 'Remix'];
const OUTFIT_STYLE = {
  duoica: 'longlay', congchua: 'longlay',
  bodycon: 'goicam', haiday: 'goicam',
  aodai: 'ngoanhien', cardigan: 'ngoanhien',
};

const TYPES = {
  daigia: { name: 'Anh Đại Gia', likes: 'longlay', tip: 500, reqs: ['beer', 'cheers', 'fruit', 'dance', 'chat'], genre: 'Remix' },
  bolero: { name: 'Chú Bolero', likes: 'ngoanhien', tip: 250, reqs: ['song', 'duet', 'chat', 'water'], genre: 'Bolero' },
  sep:    { name: 'Sếp Nhậu', likes: 'goicam', tip: 350, reqs: ['cheers', 'beer', 'water', 'chat', 'song'], genre: 'Nhạc trẻ' },
  keo:    { name: 'Thanh Niên Keo Kiệt', likes: 'any', tip: 60, reqs: ['chat', 'song', 'water', 'duet'], genre: 'Rap' },
  oppa:   { name: 'Oppa Hàn Quốc', likes: 'ngoanhien', tip: 400, reqs: ['song', 'duet', 'dance', 'chat'], genre: 'K-pop' },
  genz:   { name: 'Cậu Ấm Gen Z', likes: 'goicam', tip: 180, reqs: ['dance', 'song', 'chat', 'fruit'], genre: 'Nhạc trẻ' },
};

const LINES = {
  arrive: {
    daigia: 'Em ơi, hôm nay anh bao hết!',
    bolero: 'Mở bolero cho chú nghe coi con...',
    sep: 'Nay chốt được hợp đồng, quẩy!',
    keo: 'Phòng này tính giờ hả em? Hát lẹ nha',
    oppa: 'Annyeong! Karaoke Việt Nam vui quá!',
    genz: 'Ủa phòng có wifi hông chị?',
  },
  good: ['Quá đã!', 'Em này được nè!', 'Hảo hảo!', '10 điểm không có nhưng!', 'Dzô 100%!', 'Đúng gu anh luôn!'],
  bad: ['Gì kỳ vậy em...', 'Thôi bỏ đi...', 'Hơi buồn nha', 'Ủa alo?', 'Nhạt quá trời'],
  timeout: ['Gọi nãy giờ mà em đâu rồi?!', 'Quán phục vụ chậm ghê', 'Ngồi mọc rễ luôn rồi'],
  idle: ['Sao không ai tiếp anh vậy?', 'Có ai không ta?', 'Quán vắng nhân viên hả?'],
};

const UPGRADES = {
  disco: { name: 'Đèn disco', desc: '+15% tiền bo, phòng sáng lung linh', cost: 800 },
  loa: { name: 'Loa xịn', desc: 'Khách kiên nhẫn thêm 10 giây', cost: 1500 },
  sofa: { name: 'Sofa da', desc: 'Khách tới đông hơn', cost: 2000 },
  vip: { name: 'Mở phòng VIP', desc: 'Khách sộp, bo x1.5', cost: 3000 },
};

const state = { fund: 0, upgrades: {}, customers: {}, players: {} };
let metaDirty = false;
const loginFails = new Map();
const liveCache = new Map(); // số liệu mới nhất của tài khoản (phòng khi DB chưa ghi xong)
let nextId = 1;
let spawnTimer = 2;

const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function pubCustomer(c) {
  return {
    id: c.id, type: c.type, roomId: c.roomId, seat: c.seat, mood: Math.round(c.mood),
    servedBy: c.servedBy, servedName: c.servedName, request: c.request,
    patience: Math.max(0, Math.round(c.patience)), maxPatience: c.maxPatience,
    line: c.line, lineAt: c.lineAt, done: c.done, need: c.need,
    drunk: c.drunk || 0, react: c.react || null, reactAt: c.reactAt || 0,
  };
}
const broadcastCustomers = () => io.emit('customers', Object.values(state.customers).map(pubCustomer));
const emitState = () => io.emit('state', { fund: state.fund, upgrades: state.upgrades });
function say(c, line) { c.line = line; c.lineAt = Date.now(); }

function newRequest(c) {
  const T = TYPES[c.type];
  const options = T.reqs.filter((k) => !c.request || k !== c.request.kind);
  let kind = pick(options.length ? options : T.reqs);
  if ((c.drunk || 0) >= 2 && Math.random() < 0.5 && (!c.request || c.request.kind !== 'water')) kind = 'water';
  const data = {};
  if (kind === 'song') data.genre = Math.random() < 0.75 ? T.genre : pick(GENRES);
  c.request = { kind, data };
  c.maxPatience = (kind === 'fruit' || kind === 'water' ? 45 : 35) + (state.upgrades.loa ? 10 : 0);
  c.patience = c.maxPatience;
}

function spawnCustomer() {
  const free = [];
  for (const r of ROOMS) {
    if (r.vip && !state.upgrades.vip) continue;
    const taken = Object.values(state.customers).filter((c) => c.roomId === r.id).map((c) => c.seat);
    for (let s = 0; s < r.seats; s++) if (!taken.includes(s)) free.push([r.id, s]);
  }
  if (!free.length) return;
  const [roomId, seat] = pick(free);
  const keys = ROOMS[roomId].vip ? ['daigia', 'oppa', 'sep'] : Object.keys(TYPES);
  const type = pick(keys);
  const c = { id: nextId++, type, roomId, seat, mood: 60, servedBy: null, servedName: null, done: 0, need: rand(3, 5), request: null, drunk: type === 'sep' || type === 'daigia' ? 1 : 0, react: null, reactAt: 0 };
  say(c, LINES.arrive[type]);
  newRequest(c);
  state.customers[c.id] = c;
}

function removeCustomer(c, happy) {
  delete state.customers[c.id];
  io.emit('customerLeft', { id: c.id, happy, type: c.type });
}

function finishCustomer(c) {
  const p = state.players[c.servedBy];
  const T = TYPES[c.type];
  if (p) {
    let mult = 1;
    const st = OUTFIT_STYLE[p.app && p.app.outfit];
    const liked = T.likes === 'any' ? null : st === T.likes;
    if (liked === true) mult *= 1.5;
    if (liked === false) mult *= 0.85;
    if (ROOMS[c.roomId].vip) mult *= 1.5;
    if (state.upgrades.disco) mult *= 1.15;
    const tip = Math.max(10, Math.round((T.tip * (0.4 + c.mood / 100) * mult) / 10) * 10);
    p.money += tip; p.served = (p.served || 0) + 1; p.dirty = true;
    state.fund += Math.round(tip * 0.3); metaDirty = true;
    io.emit('tip', { pid: p.id, name: p.name, amount: tip, cname: T.name, final: true, liked, ctype: c.type });
    emitState();
  }
  removeCustomer(c, true);
}

// ---------------- Vòng lặp game ----------------
setInterval(() => {
  const nPlayers = Object.keys(state.players).length;
  if (!nPlayers) {
    state.customers = {};
    return;
  }
  const totalSeats = ROOMS.filter((r) => !r.vip || state.upgrades.vip).reduce((s, r) => s + r.seats, 0);
  const maxC = Math.min(1 + nPlayers * 2, totalSeats);
  spawnTimer -= 1;
  if (spawnTimer <= 0 && Object.keys(state.customers).length < maxC) {
    spawnCustomer();
    spawnTimer = state.upgrades.sofa ? 5 : 9;
  }
  for (const c of Object.values(state.customers)) {
    c.patience -= c.servedBy ? 1 : 0.5;
    if (c.patience <= 0) {
      c.mood -= 15;
      c.react = 'bad'; c.reactAt = Date.now();
      say(c, c.servedBy ? pick(LINES.timeout) : pick(LINES.idle));
      if (c.mood <= 0) {
        say(c, 'Lần sau anh qua quán khác!');
        removeCustomer(c, false);
        io.emit('feed', `${TYPES[c.type].name} bỏ về vì chờ lâu 😤`);
      } else newRequest(c);
    }
  }
  broadcastCustomers();
}, 1000);

setInterval(() => {
  const out = {};
  for (const p of Object.values(state.players)) out[p.id] = [p.x, p.z, p.ry, p.anim, p.holding, p.money];
  io.volatile.emit('players', out);
}, 100);

function sanitizeApp(a) {
  if (!a || typeof a !== 'object') return {};
  try {
    const s = JSON.stringify(a);
    if (s.length > 3000) return {};
    return JSON.parse(s);
  } catch (e) { return {}; }
}

// ---------------- Kết nối người chơi ----------------
io.on('connection', (socket) => {
  // ---------- tài khoản ----------
  const fails = (key) => loginFails.get(key) || { n: 0, until: 0 };
  async function signIn(acc, withToken) {
    // đá phiên cũ nếu tài khoản đang mở ở máy khác
    for (const [sid, p] of Object.entries(state.players)) {
      if (p.key === acc.key && sid !== socket.id) {
        liveCache.set(p.key, { money: p.money, served: p.served || 0, app: p.app });
        const old = io.sockets.sockets.get(sid);
        if (old) { old.emit('kicked', 'Tài khoản này vừa đăng nhập ở nơi khác'); old.disconnect(true); }
      }
    }
    const live = liveCache.get(acc.key);
    if (live) Object.assign(acc, live);
    socket.data.acc = acc;
    const token = withToken ? await store.addToken(acc) : null;
    return { ok: true, name: acc.name, money: acc.money, served: acc.served || 0, app: acc.app, token, saveMode: store.mode };
  }
  const NAME_RE = /^[\p{L}\p{N} _.-]{2,16}$/u;
  socket.on('register', async ({ name, pin } = {}, cb = () => {}) => {
    try {
      name = String(name || '').trim().replace(/\s+/g, ' ');
      if (!NAME_RE.test(name)) return cb({ ok: false, error: 'Tên dài 2-16 ký tự, chỉ gồm chữ, số, khoảng trắng' });
      if (!/^\d{4,6}$/.test(String(pin || ''))) return cb({ ok: false, error: 'Mã PIN gồm 4-6 chữ số' });
      const acc = await store.createAccount(name, pin);
      if (!acc) return cb({ ok: false, error: 'Tên này đã có người dùng, chọn tên khác nha' });
      cb(await signIn(acc, true));
    } catch (e) { console.error(e); cb({ ok: false, error: 'Lỗi máy chủ, thử lại sau' }); }
  });
  socket.on('login', async ({ name, pin } = {}, cb = () => {}) => {
    try {
      const acc = await store.getAccount(String(name || ''));
      const key = acc ? acc.key : String(name || '').toLowerCase();
      const f = fails(key);
      if (f.until > Date.now()) return cb({ ok: false, error: 'Sai PIN nhiều lần, đợi 5 phút rồi thử lại' });
      if (!acc) return cb({ ok: false, error: 'Chưa có nhân vật tên này. Bấm "Tạo nhân vật mới" nha' });
      if (!store.checkPin(acc, String(pin || ''))) {
        f.n++; if (f.n >= 5) { f.until = Date.now() + 5 * 60000; f.n = 0; }
        loginFails.set(key, f);
        return cb({ ok: false, error: 'Sai mã PIN' });
      }
      loginFails.delete(key);
      cb(await signIn(acc, true));
    } catch (e) { console.error(e); cb({ ok: false, error: 'Lỗi máy chủ, thử lại sau' }); }
  });
  socket.on('resume', async ({ name, token } = {}, cb = () => {}) => {
    try {
      const acc = await store.getAccount(String(name || ''));
      if (!acc || !token || !(acc.tokens || []).includes(token)) return cb({ ok: false });
      cb(await signIn(acc, false));
    } catch (e) { cb({ ok: false }); }
  });
  socket.on('logout', async ({ token } = {}) => {
    const acc = socket.data.acc;
    if (acc && token) { acc.tokens = (acc.tokens || []).filter((t) => t !== token); await store.saveAccount(acc.key, { tokens: acc.tokens }); }
  });

  socket.on('join', (msg = {}) => {
    const acc = socket.data.acc;
    if (!acc) return socket.emit('needLogin');
    if (state.players[socket.id]) return;
    const app = sanitizeApp(msg.app);
    const p = { id: socket.id, key: acc.key, name: acc.name, app, x: 0, z: 3, ry: Math.PI, anim: 'idle', holding: null, money: acc.money || 0, served: acc.served || 0, dirty: true };
    state.players[socket.id] = p;
    socket.emit('init', {
      you: socket.id,
      players: state.players,
      customers: Object.values(state.customers).map(pubCustomer),
      fund: state.fund,
      upgrades: state.upgrades,
      upgradeDefs: UPGRADES,
    });
    socket.broadcast.emit('playerJoined', p);
    io.emit('feed', `${p.name} vừa vào ca 💃`);
  });

  socket.on('top', async (cb = () => {}) => { try { cb(await store.topAccounts(10)); } catch (e) { cb([]); } });

  socket.on('move', (m = {}) => {
    const p = state.players[socket.id];
    if (!p) return;
    p.x = clamp(Number(m.x) || 0, -25, 25);
    p.z = clamp(Number(m.z) || 0, -25, 25);
    p.ry = Number(m.ry) || 0;
    p.anim = String(m.anim || 'idle').slice(0, 10);
    p.holding = m.holding === 'fruit' || m.holding === 'water' ? m.holding : null;
  });

  socket.on('appearance', (a) => {
    const p = state.players[socket.id];
    if (!p) return;
    p.app = sanitizeApp(a);
    p.dirty = true;
    socket.broadcast.emit('appearance', { id: socket.id, app: p.app });
  });

  socket.on('serve', ({ cid } = {}) => {
    const p = state.players[socket.id];
    const c = state.customers[cid];
    if (!p || !c) return;
    if (c.servedBy && c.servedBy !== socket.id) return;
    c.servedBy = socket.id;
    c.servedName = p.name;
    broadcastCustomers();
  });

  socket.on('release', ({ cid } = {}) => {
    const c = state.customers[cid];
    if (c && c.servedBy === socket.id) { c.servedBy = null; c.servedName = null; broadcastCustomers(); }
  });

  socket.on('resolve', ({ cid, kind, quality } = {}) => {
    const p = state.players[socket.id];
    const c = state.customers[cid];
    if (!p || !c || c.servedBy !== socket.id || !c.request || c.request.kind !== kind) return;
    const q = clamp(Number(quality) || 0, 0, 1);
    c.mood = clamp(c.mood + Math.round(q * 30 - (1 - q) * 15), 0, 100);
    say(c, q >= 0.5 ? pick(LINES.good) : pick(LINES.bad));
    c.react = q >= 0.5 ? 'good' : 'bad'; c.reactAt = Date.now();
    if ((kind === 'beer' || kind === 'cheers') && q >= 0.5) {
      c.drunk = Math.min(3, (c.drunk || 0) + 1);
      if (c.drunk === 3) say(c, 'Hức... anh hông có say... hức!');
    }
    if (kind === 'water') { c.drunk = Math.max(0, (c.drunk || 0) - 2); if (q >= 0.5) say(c, 'Tỉnh rồi! Cảm ơn em nha'); }
    const T = TYPES[c.type];
    if (q >= 0.85) {
      const hot = Math.max(10, Math.round((T.tip * 0.1) / 10) * 10);
      p.money += hot; p.dirty = true;
      state.fund += Math.round(hot * 0.3); metaDirty = true;
      io.emit('tip', { pid: p.id, name: p.name, amount: hot, cname: T.name, final: false, ctype: c.type });
      emitState();
    }
    c.done += 1;
    if (c.mood <= 0) {
      say(c, 'Thôi anh về!');
      removeCustomer(c, false);
      io.emit('feed', `${T.name} giận dỗi bỏ về 😤`);
    } else if (c.done >= c.need) {
      finishCustomer(c);
    } else {
      newRequest(c);
    }
    broadcastCustomers();
  });

  socket.on('buy', ({ key } = {}) => {
    const p = state.players[socket.id];
    const u = UPGRADES[key];
    if (!p || !u || state.upgrades[key] || state.fund < u.cost) return;
    state.fund -= u.cost;
    state.upgrades[key] = true;
    metaDirty = true;
    emitState();
    io.emit('feed', `${p.name} đã mua "${u.name}" cho quán 🎉`);
  });

  socket.on('chat', (text) => {
    const p = state.players[socket.id];
    const t = String(text || '').trim().slice(0, 80);
    if (!p || !t) return;
    io.emit('chat', { id: socket.id, name: p.name, text: t });
  });

  socket.on('disconnect', () => {
    const p = state.players[socket.id];
    if (!p) return;
    for (const c of Object.values(state.customers)) {
      if (c.servedBy === socket.id) { c.servedBy = null; c.servedName = null; }
    }
    savePlayer(p);
    delete state.players[socket.id];
    io.emit('playerLeft', { id: socket.id });
    io.emit('feed', `${p.name} đã tan ca 👋`);
  });
});

// ---------------- Lưu dữ liệu ----------------
function savePlayer(p) {
  if (!p.key) return Promise.resolve();
  p.dirty = false;
  liveCache.set(p.key, { money: p.money, served: p.served || 0, app: p.app });
  return store.saveAccount(p.key, { money: p.money, served: p.served || 0, app: p.app }).catch((e) => console.error('Lưu lỗi:', e.message));
}
async function saveAll() {
  const jobs = Object.values(state.players).filter((p) => p.dirty).map(savePlayer);
  if (metaDirty) { metaDirty = false; jobs.push(store.saveMeta(state.fund, state.upgrades).catch((e) => console.error(e.message))); }
  await Promise.all(jobs);
}
setInterval(saveAll, 5000);
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, async () => { console.log('Đang lưu trước khi tắt...'); await saveAll(); process.exit(0); });

(async () => {
  await store.init();
  const m = await store.loadMeta();
  state.fund = m.fund || 0; state.upgrades = m.upgrades || {};
  server.listen(PORT, () => console.log(`KTV Lung Linh 3D đang chạy ở cổng ${PORT}`));
})();
