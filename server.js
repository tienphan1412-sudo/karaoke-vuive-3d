// KTV Lung Linh 3D — server online (Express + Socket.io)
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');
const store = require('./store');
const F = require('./features');

const app = express();
app.use(express.static(path.join(__dirname, 'public')));
app.use('/vendor/three', express.static(path.join(__dirname, 'node_modules', 'three')));
app.get('/health', (req, res) => res.send('ok'));
// danh sách file nhạc trong public/music
app.get('/music-list', (req, res) => {
  fs.readdir(path.join(__dirname, 'public', 'music'), (err, files) => {
    if (err) return res.json([]);
    res.json(files.filter((f) => /\.(mp3|m4a|ogg|wav|aac)$/i.test(f)));
  });
});

const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

// =====================================================================
// DỮ LIỆU GAME
// =====================================================================
// toạ độ phòng (giống public/js/world.js)
const ROOMS = [
  { id: 0, cx: -13, cz: -11, dir: 1, hw: 6, hd: 5, seats: 2 },
  { id: 1, cx: 0, cz: -11, dir: 1, hw: 6, hd: 5, seats: 2 },
  { id: 2, cx: 13, cz: -11, dir: 1, hw: 6, hd: 5, seats: 2 },
  { id: 3, cx: 0, cz: 14, dir: -1, hw: 8, hd: 6, seats: 3, vip: true },
];
const EXIT = { x: -18.3, z: -3.5 };      // cửa ra của quán (tường trái)
const BREAKER = { x: 18.3, z: -4.5 };    // cầu dao điện (tường phải)
const GENRES = ['Bolero', 'Nhạc trẻ', 'K-pop', 'Rap', 'Remix'];
const OUTFIT_STYLE = {
  duoica: 'longlay', congchua: 'longlay', damvip: 'longlay',
  bodycon: 'goicam', haiday: 'goicam',
  aodai: 'ngoanhien', cardigan: 'ngoanhien',
};

const TYPES = {
  daigia: { name: 'Anh Đại Gia', likes: 'longlay', tip: 500, reqs: ['beer', 'cheers', 'fruit', 'dance', 'chat', 'pole'], genre: 'Remix' },
  bolero: { name: 'Chú Bolero', likes: 'ngoanhien', tip: 250, reqs: ['song', 'duet', 'chat', 'water'], genre: 'Bolero' },
  sep: { name: 'Sếp Nhậu', likes: 'goicam', tip: 350, reqs: ['cheers', 'beer', 'water', 'chat', 'song', 'pole'], genre: 'Nhạc trẻ' },
  keo: { name: 'Thanh Niên Keo Kiệt', likes: 'any', tip: 60, reqs: ['chat', 'song', 'water', 'duet'], genre: 'Rap' },
  oppa: { name: 'Oppa Hàn Quốc', likes: 'ngoanhien', tip: 400, reqs: ['song', 'duet', 'dance', 'chat'], genre: 'K-pop' },
  genz: { name: 'Cậu Ấm Gen Z', likes: 'goicam', tip: 180, reqs: ['dance', 'song', 'chat', 'fruit', 'pole'], genre: 'Nhạc trẻ' },
  baove: { name: 'Bác Bảo Vệ', likes: 'any', tip: 120, reqs: ['song', 'duet'], genre: 'Bolero', need: [6, 7] },
  thattinh: { name: 'Chàng Thất Tình', likes: 'ngoanhien', tip: 320, reqs: ['song', 'water', 'chat'], genre: 'Bolero' },
  congty: { name: 'Nhân Viên Liên Hoan', likes: 'any', tip: 220, reqs: ['cheers', 'beer', 'song', 'chat', 'dance'], genre: 'Nhạc trẻ', group: true },
};

const LINES = {
  arrive: {
    daigia: 'Em ơi, hôm nay anh bao hết!',
    bolero: 'Mở bolero cho chú nghe coi con...',
    sep: 'Nay chốt được hợp đồng, quẩy!',
    keo: 'Phòng này tính giờ hả em? Hát lẹ nha',
    oppa: 'Annyeong! Karaoke Việt Nam vui quá!',
    genz: 'Ủa phòng có wifi hông chị?',
    baove: 'Bác hát thử 1 bài thôi rồi bác đi liền...',
    thattinh: 'Cho anh bài nào buồn nhất quán đi em...',
    congty: 'Team building nè! Sếp bao, quẩy lên!',
  },
  good: ['Quá đã!', 'Em này được nè!', 'Hảo hảo!', '10 điểm không có nhưng!', 'Dzô 100%!', 'Đúng gu anh luôn!'],
  bad: ['Gì kỳ vậy em...', 'Thôi bỏ đi...', 'Hơi buồn nha', 'Ủa alo?', 'Nhạt quá trời'],
  timeout: ['Gọi nãy giờ mà em đâu rồi?!', 'Quán phục vụ chậm ghê', 'Ngồi mọc rễ luôn rồi'],
  idle: ['Sao không ai tiếp anh vậy?', 'Có ai không ta?', 'Quán vắng nhân viên hả?'],
  baove: ['Bài cuối thôi con!', 'Bài này nữa thôi nha...', 'Thêm 1 bài nữa bác về liền!', 'Bác hứa bài cuối!'],
  blackout: ['Ủa cúp điện hả?!', 'Tối thui vậy hát sao em?', 'Ai bật đèn lên dùm cái!', 'Đóng tiền điện chưa vậy quán?'],
};

const UPGRADES = {
  disco: { name: 'Đèn disco', desc: '+15% tiền bo, phòng sáng lung linh', cost: 800 },
  loa: { name: 'Loa xịn', desc: 'Khách kiên nhẫn thêm 10 giây', cost: 1500 },
  sofa: { name: 'Sofa da', desc: 'Khách tới đông hơn', cost: 2000 },
  vip: { name: 'Mở phòng VIP', desc: 'Khách sộp, bo x1.5', cost: 3000 },
};

// ---------- Shop: đồ phải mua mới dùng được ----------
const SHOP = [
  { id: 'o_aodai', cat: 'Trang phục', name: 'Áo dài', key: 'outfit', value: 'aodai', price: 300 },
  { id: 'o_congchua', cat: 'Trang phục', name: 'Đầm công chúa', key: 'outfit', value: 'congchua', price: 800 },
  { id: 'o_duoica', cat: 'Trang phục', name: 'Đầm dạ hội đuôi cá', key: 'outfit', value: 'duoica', price: 1500 },
  { id: 'o_damvip', cat: 'Trang phục', name: 'Đầm kim sa VIP 💎', key: 'outfit', value: 'damvip', price: 3000, bonus: 0.2, level: 2, desc: '+20% tiền bo' },
  { id: 'a_tui', cat: 'Phụ kiện', name: 'Túi hiệu Quảng Châu 👜', key: 'bag', value: 'tui', price: 1000, bonus: 0.1, desc: '+10% tiền bo' },
  { id: 'a_crown', cat: 'Phụ kiện', name: 'Vương miện kim cương 👑', key: 'clip', value: 'crown', price: 2000, bonus: 0.1, level: 1, desc: '+10% tiền bo' },
  { id: 'a_drop', cat: 'Phụ kiện', name: 'Bông tai dài lấp lánh', key: 'earrings', value: 'drop', price: 300 },
  { id: 'a_hoop', cat: 'Phụ kiện', name: 'Bông tai khoen tròn', key: 'earrings', value: 'hoop', price: 100 },
  { id: 'a_bow', cat: 'Phụ kiện', name: 'Kẹp nơ', key: 'clip', value: 'bow', price: 50 },
  { id: 'a_flower', cat: 'Phụ kiện', name: 'Kẹp hoa', key: 'clip', value: 'flower', price: 50 },
  { id: 'a_pearl', cat: 'Phụ kiện', name: 'Chuỗi ngọc trai', key: 'necklace', value: 'pearl', price: 150 },
  { id: 'a_choker', cat: 'Phụ kiện', name: 'Vòng cổ choker', key: 'necklace', value: 'choker', price: 100 },
  { id: 'a_round', cat: 'Phụ kiện', name: 'Kính tròn', key: 'glasses', value: 'round', price: 80 },
  { id: 'a_catg', cat: 'Phụ kiện', name: 'Kính mắt mèo', key: 'glasses', value: 'cat', price: 120 },
  { id: 'm_son', cat: 'Trang điểm', name: 'Son đỏ quyền lực 💋', key: 'lip', value: '#9b0000', price: 500, bonus: 0.05, desc: '+5% tiền bo' },
  { id: 'm_gold', cat: 'Trang điểm', name: 'Phấn mắt nhũ vàng', key: 'shadow', value: '#d4af37', price: 200 },
  { id: 'm_drama', cat: 'Trang điểm', name: 'Mi giả dày cong', key: 'lashes', value: 'drama', price: 150 },
];
const SHOP_DEFAULT = { outfit: 'bodycon', bag: 'none', clip: 'none', earrings: 'pearl', necklace: 'none', glasses: 'none', lip: '#d81b60', shadow: '#f48fb1', lashes: 'doll' };
const LEVELS = [
  { name: 'Tập sự', icon: '🐣', min: 0, bonus: 0 },
  { name: 'Nhân viên', icon: '💼', min: 2000, bonus: 0 },
  { name: 'Hoa khôi', icon: '🌸', min: 8000, bonus: 0.05 },
  { name: 'Má mì', icon: '👑', min: 25000, bonus: 0.1 },
];
const levelOf = (earned) => { if (!F.levels) return 0; let l = 0; LEVELS.forEach((L, i) => { if ((earned || 0) >= L.min) l = i; }); return l; };

// ---------- Nhiệm vụ mỗi ngày ----------
const QUESTS = {
  beer: { text: 'Rót 5 ly bia chuẩn', target: 5, reward: 200 },
  drunk: { text: 'Làm 1 khách say lảo đảo', target: 1, reward: 150 },
  pole: { text: 'Múa cột được 4 sao', target: 1, reward: 250 },
  serve: { text: 'Phục vụ xong 5 khách', target: 5, reward: 300 },
  catch: { text: 'Bắt 1 khách quỵt tiền', target: 1, reward: 300 },
  police: { text: 'Đổi áo dài kịp khi công an tới', target: 1, reward: 150 },
  sing100: { text: 'Hát được 100 điểm 2 lần', target: 2, reward: 150 },
  ghen: { text: 'Thoát nạn khi vợ khách đánh ghen', target: 1, reward: 200 },
  gift: { text: 'Tặng quà cho 1 bạn', target: 1, reward: 100 },
  power: { text: 'Bật lại cầu dao khi cúp điện', target: 1, reward: 150 },
  comfort: { text: 'An ủi chàng thất tình', target: 1, reward: 200 },
  duet: { text: 'Song ca với 1 người chơi khác', target: 1, reward: 200 },
};
const QUEST_NEEDS = { catch: 'flee', police: 'police', sing100: 'karaoke', gift: 'gift', power: 'blackout', comfort: 'newCustomers', duet: 'duet', ghen: 'ghen' };
const questPool = () => Object.keys(QUESTS).filter((k) => !QUEST_NEEDS[k] || F[QUEST_NEEDS[k]]);
const vnDay = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
function hashStr(s) { let h = 2166136261; for (const ch of s) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

// =====================================================================
// TRẠNG THÁI
// =====================================================================
const state = { fund: 0, upgrades: {}, customers: {}, players: {} };
let metaDirty = false;
const loginFails = new Map();
const liveCache = new Map();
let nextId = 1;
let spawnTimer = 2;
const SHIFT_MS = 10 * 60 * 1000;
let shift = { start: Date.now(), stats: {} };
let ghen = null, police = null, blackout = null;
const schedule = { ghen: 0, police: 0, blackout: 0 };
const invites = new Map(); // duet: from -> {to, at}
const duets = {};

const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const now = () => Date.now();

// ---------- hình học: ghế, lộ trình đi ra cửa ----------
function seatPos(roomId, seat) {
  const r = ROOMS[roomId];
  const back = r.cz - r.dir * r.hd;
  const offs = r.seats === 3 ? [-2.6, 0, 2.6] : [-1.5, 1.5];
  return { x: r.cx + offs[seat], z: back + r.dir * 1.25 };
}
function routeOut(roomId, seat) {
  const r = ROOMS[roomId], s = seatPos(roomId, seat);
  const front = r.cz + r.dir * r.hd, side = s.x > r.cx ? 1 : -1;
  const z1 = s.z + r.dir * 0.85;
  return [[s.x, s.z], [s.x, z1], [r.cx + side * 2.4, z1], [r.cx + side * 2.4, front - r.dir * 0.9], [r.cx, front - r.dir * 0.5], [r.cx, front + r.dir * 1.3], [EXIT.x, EXIT.z]];
}
function routeLen(pts) { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L; }
function posAt(pts, d) {
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (d <= seg) { const t = seg ? d / seg : 0; return { x: pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, z: pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t }; }
    d -= seg;
  }
  const l = pts[pts.length - 1]; return { x: l[0], z: l[1] };
}
function inRoom(p, roomId) {
  const r = ROOMS[roomId];
  const z1 = r.cz - r.hd, z2 = r.cz + r.hd;
  return Math.abs(p.x - r.cx) < r.hw && p.z > z1 && p.z < z2;
}

// ---------- khách ----------
function pubCustomer(c) {
  return {
    id: c.id, type: c.type, roomId: c.roomId, seat: c.seat, mood: Math.round(c.mood),
    servedBy: c.servedBy, servedName: c.servedName, request: c.request,
    patience: Math.max(0, Math.round(c.patience)), maxPatience: c.maxPatience,
    line: c.line, lineAt: c.lineAt, done: c.done, need: c.need,
    drunk: c.drunk || 0, react: c.react || null, reactAt: c.reactAt || 0,
    st: c.st || 'seat', flee: c.flee || null, drag: c.drag || null, crying: !!c.crying, variant: c.variant || 0, ear: !!c.ear,
  };
}
const broadcastCustomers = () => io.emit('customers', Object.values(state.customers).map(pubCustomer));
const emitState = () => io.emit('state', { fund: state.fund, upgrades: state.upgrades, shiftEnd: F.shift ? shift.start + SHIFT_MS : 0 });
function say(c, line) { c.line = line; c.lineAt = now(); }

function newRequest(c) {
  const T = TYPES[c.type];
  if (c.crying) { c.request = { kind: 'chat', data: { comfort: true } }; c.maxPatience = 40; c.patience = 40; return; }
  const options = T.reqs.filter((k) => !c.request || k !== c.request.kind || T.reqs.length <= 2);
  let kind = pick(options.length ? options : T.reqs);
  if ((c.drunk || 0) >= 2 && Math.random() < 0.5 && (!c.request || c.request.kind !== 'water')) kind = 'water';
  const data = {};
  if (kind === 'song') data.genre = Math.random() < 0.75 ? T.genre : pick(GENRES);
  c.request = { kind, data };
  c.maxPatience = (kind === 'fruit' || kind === 'water' || kind === 'pole' ? 45 : 35) + (state.upgrades.loa ? 10 : 0);
  c.patience = c.maxPatience;
}

function makeCustomer(type, roomId, seat, extra = {}) {
  const T = TYPES[type];
  const c = { id: nextId++, type, roomId, seat, mood: 60, servedBy: null, servedName: null, done: 0, need: T.need ? rand(...T.need) : rand(3, 5), request: null, drunk: type === 'sep' || type === 'daigia' ? 1 : 0, react: null, reactAt: 0, st: 'seat', ...extra };
  say(c, LINES.arrive[type]);
  newRequest(c);
  state.customers[c.id] = c;
  return c;
}
function roomsOpen() { return ROOMS.filter((r) => !r.vip || state.upgrades.vip); }
function takenSeats(roomId) { return Object.values(state.customers).filter((c) => c.roomId === roomId).map((c) => c.seat); }
function spawnCustomer() {
  // đôi khi cả nhóm liên hoan công ty kéo vào
  if (F.newCustomers && Math.random() < 0.14) {
    const empty = roomsOpen().filter((r) => takenSeats(r.id).length === 0);
    if (empty.length) {
      const r = pick(empty);
      for (let s = 0; s < r.seats; s++) makeCustomer('congty', r.id, s, { variant: s });
      io.emit('feed', '🎉 Cả nhóm liên hoan công ty vừa kéo vào ' + (r.vip ? 'phòng VIP' : 'phòng ' + (101 + r.id)) + '!');
      return;
    }
  }
  const free = [];
  for (const r of roomsOpen()) { const t = takenSeats(r.id); for (let s = 0; s < r.seats; s++) if (!t.includes(s)) free.push([r.id, s]); }
  if (!free.length) return;
  const [roomId, seat] = pick(free);
  const keys = ROOMS[roomId].vip ? ['daigia', 'oppa', 'sep'] : Object.keys(TYPES).filter((k) => !TYPES[k].group && (F.newCustomers || !['baove', 'thattinh'].includes(k)));
  makeCustomer(pick(keys), roomId, seat);
}

function removeCustomer(c, happy) {
  if (process.env.KTV_TEST) console.log('remove', c.id, c.type, c.st, new Error().stack.split('\n')[2].trim());
  delete state.customers[c.id];
  io.emit('customerLeft', { id: c.id, happy, type: c.type });
}

// ---------- tiền, cấp, nhiệm vụ, thống kê ca ----------
function stat(p) {
  if (!shift.stats[p.key]) shift.stats[p.key] = { name: p.name, tips: 0, beer: 0, dep: 0, catch: 0, pole: 0, songs: 0 };
  return shift.stats[p.key];
}
function bonusOf(p) {
  let b = LEVELS[levelOf(p.earned)].bonus;
  const a = p.app || {};
  for (const it of SHOP) if (it.bonus && a[it.key] === it.value && (p.owned || []).includes(it.id)) b += it.bonus;
  return b;
}
function earn(p, amount, { fund = true, tip = true } = {}) {
  amount = Math.round(amount);
  const before = levelOf(p.earned);
  p.money += amount; p.earned = (p.earned || 0) + amount; p.dirty = true;
  if (fund) { state.fund += Math.round(amount * 0.3); metaDirty = true; }
  if (tip) stat(p).tips += amount;
  const after = levelOf(p.earned);
  io.to(p.id).emit('earned', p.earned);
  if (after > before) {
    io.emit('levelUp', { id: p.id, level: after });
    io.emit('feed', `🎊 ${p.name} vừa lên cấp ${LEVELS[after].icon} ${LEVELS[after].name}!`);
  }
}
function ensureQuests(p) {
  const day = vnDay();
  if (p.quests && p.quests.day === day && p.quests.ids.every((k) => questPool().includes(k))) return p.quests;
  const keys = questPool(), h = hashStr(p.key + day), ids = [];
  for (let i = 0; ids.length < 3; i++) { const k = keys[(h + i * 7 + (h >> (i + 3))) % keys.length]; if (!ids.includes(k)) ids.push(k); }
  p.quests = { day, ids, prog: {}, done: [] };
  p.dirty = true;
  return p.quests;
}
function questsPub(p) { const q = ensureQuests(p); return q.ids.map((id) => ({ id, ...QUESTS[id], prog: Math.min(QUESTS[id].target, q.prog[id] || 0), done: q.done.includes(id) })); }
function progress(p, id, n = 1) {
  if (!p || !F.quests) return;
  const q = ensureQuests(p);
  if (!q.ids.includes(id) || q.done.includes(id)) return;
  q.prog[id] = (q.prog[id] || 0) + n;
  if (q.prog[id] >= QUESTS[id].target) {
    q.done.push(id);
    earn(p, QUESTS[id].reward, { fund: false, tip: false });
    io.to(p.id).emit('questDone', { text: QUESTS[id].text, reward: QUESTS[id].reward });
  }
  p.dirty = true;
  io.to(p.id).emit('quests', questsPub(p));
}
function tipFor(p, c, mult0 = 1) {
  const T = TYPES[c.type];
  let mult = mult0;
  const st = OUTFIT_STYLE[p.app && (p.app.uniform ? 'aodai' : p.app.outfit)];
  const liked = T.likes === 'any' ? null : st === T.likes;
  if (liked === true) mult *= 1.5;
  if (liked === false) mult *= 0.85;
  if (ROOMS[c.roomId].vip) mult *= 1.5;
  if (state.upgrades.disco) mult *= 1.15;
  mult *= 1 + bonusOf(p);
  return { tip: Math.max(10, Math.round((T.tip * (0.4 + c.mood / 100) * mult) / 10) * 10), liked };
}

function finishCustomer(c) {
  const p = state.players[c.servedBy];
  const T = TYPES[c.type];
  // khách quỵt tiền: đứng dậy lẻn ra cửa
  if (F.flee && p && Math.random() < (c.type === 'keo' ? 0.45 : 0.15)) {
    const { tip } = tipFor(p, c);
    c.st = 'flee'; c.flee = { t0: now(), pts: routeOut(c.roomId, c.seat), speed: 1.7 };
    c.fleeTip = tip * 2; c.request = { kind: 'none', data: {} };
    say(c, 'Ờ... anh đi vệ sinh xíu nha 😅');
    io.emit('feed', `🏃 ${T.name} đang định QUỴT TIỀN! Chạy theo nắm áo lại (nhấn E)!`);
    io.emit('alarm', { kind: 'flee', cid: c.id });
    return;
  }
  if (p) {
    const { tip, liked } = tipFor(p, c);
    p.served = (p.served || 0) + 1;
    earn(p, tip);
    progress(p, 'serve');
    io.emit('tip', { pid: p.id, name: p.name, amount: tip, cname: T.name, final: true, liked, ctype: c.type });
    emitState();
  }
  removeCustomer(c, true);
}

// =====================================================================
// SỰ KIỆN
// =====================================================================
function playersIn(roomId) { return Object.values(state.players).filter((p) => inRoom(p, roomId)); }

// ---------- vợ đánh ghen ----------
function startGhen() {
  if (ghen) return false;
  const cands = Object.values(state.customers).filter((c) => c.st === 'seat' && !TYPES[c.type].group && c.type !== 'baove' && (c.servedBy || playersIn(c.roomId).length));
  if (!cands.length) return false;
  const withPlayer = cands.filter((c) => playersIn(c.roomId).length);
  const base = withPlayer.length ? withPlayer : cands;
  const pref = base.filter((c) => c.type === 'sep' || c.type === 'daigia' || c.drunk >= 2);
  const c = pick(pref.length ? pref : base);
  const s = seatPos(c.roomId, c.seat), r = ROOMS[c.roomId];
  const stand = [s.x + 0.55, s.z + r.dir * 0.75];
  const out = routeOut(c.roomId, c.seat);
  const enterPts = [...out.slice(1).reverse(), stand];
  const t0 = now(), enterDur = routeLen(enterPts) / 2.6 * 1000;
  if (process.env.KTV_TEST) console.log('GHEN start cid', c.id, c.type, 'room', c.roomId);
  ghen = { id: nextId++, cid: c.id, roomId: c.roomId, t0, enterPts, enterDur, choiceAt: t0 + enterDur, dragAt: t0 + enterDur + 7000, stand: { x: stand[0], z: stand[1] }, targets: new Set(), answers: {}, asked: false };
  c.st = 'ghen'; c.request = { kind: 'none', data: {} };
  say(c, 'Ơ... ơ... vợ anh?!');
  io.emit('ghen', pubGhen());
  io.emit('feed', `😱 VỢ của ${TYPES[c.type].name} tới quán đánh ghen!!!`);
  return true;
}
function pubGhen() { return ghen && { id: ghen.id, cid: ghen.cid, roomId: ghen.roomId, t0: ghen.t0, enterPts: ghen.enterPts, enterDur: ghen.enterDur, choiceAt: ghen.choiceAt, dragAt: ghen.dragAt, stand: ghen.stand }; }
function depHit(p, from) {
  stat(p).dep++;
  io.emit('dep', { pid: p.id, from });
  io.emit('feed', `🩴 ${p.name} lãnh trọn chiếc dép tổ ong!`);
}
function tickGhen() {
  if (!ghen) return;
  const t = now(), c = state.customers[ghen.cid];
  if (!c) { if (process.env.KTV_TEST) console.log('GHEN end: customer gone', ghen.cid); const eid = ghen.id; ghen = null; io.emit('ghenEnd', { id: eid }); return; }
  if (!ghen.asked && t >= ghen.choiceAt) {
    ghen.asked = true;
    c.ear = true;
    say(c, 'Á á á đau anh! Em ơi anh tiếp khách hợp đồng mà!');
    const targets = new Set(playersIn(ghen.roomId).map((p) => p.id));
    if (c.servedBy && state.players[c.servedBy]) targets.add(c.servedBy);
    ghen.targets = targets;
    for (const pid of targets) io.to(pid).emit('ghenChoice', { eid: ghen.id, cname: TYPES[c.type].name, deadline: ghen.dragAt });
  }
  if (t >= ghen.dragAt && c.st === 'ghen') {
    // ai không chọn thì ăn dép
    for (const pid of ghen.targets) { const p = state.players[pid]; if (p && !ghen.answers[pid]) depHit(p, ghen.stand); }
    c.st = 'drag';
    const pts = routeOut(c.roomId, c.seat);
    c.drag = { t0: t, pts, speed: 2.6 };
    ghen.dragEnd = t + routeLen(pts) / 2.6 * 1000 + 600;
    say(c, ghen.happy ? 'Thôi về nha mấy em, vợ anh hát hay ghê!' : 'Em ơi tha cho anh...');
  }
  if (ghen.dragEnd && t >= ghen.dragEnd) {
    removeCustomer(c, !!ghen.happy);
    io.emit('ghenEnd', { id: ghen.id }); ghen = null;
  }
}

// ---------- công an phường ----------
function startPolice() {
  police = { t0: now(), until: now() + 7000, ok: new Set() };
  io.emit('police', { t0: police.t0, until: police.until });
  io.emit('feed', '🚔 CÔNG AN PHƯỜNG KIỂM TRA! Đổi áo dài gấp!');
}
function tickPolice() {
  if (!police || now() < police.until) return;
  const fined = [];
  for (const p of Object.values(state.players)) {
    if (police.ok.has(p.id)) continue;
    const fine = Math.min(100, p.money);
    p.money -= fine; p.dirty = true;
    io.to(p.id).emit('policeFine', { fine });
    fined.push(p.name);
  }
  io.emit('policeEnd', { fined });
  io.emit('feed', fined.length ? `👮 Công an phạt: ${fined.join(', ')} (-100k)` : '👮 Công an đi rồi, cả quán ngoan hiền! 😇');
  police = null;
}

// ---------- cúp điện ----------
function startBlackout() {
  blackout = { t0: now() };
  io.emit('blackout', { on: true });
  for (const c of Object.values(state.customers)) if (c.st === 'seat') { say(c, pick(LINES.blackout)); c.react = 'bad'; c.reactAt = now(); }
  io.emit('feed', '⚡ CÚP ĐIỆN! Ai ra cầu dao (tường bên phải sảnh) bật lại dùm!');
}
function endBlackout(p) {
  if (!blackout) return;
  blackout = null;
  io.emit('blackout', { on: false, by: p ? p.name : null });
  if (p) { earn(p, 100, { fund: false }); progress(p, 'power'); io.emit('feed', `💡 ${p.name} đã bật lại điện! (+100k)`); }
  else io.emit('feed', '💡 Điện có lại rồi!');
}

// ---------- ca làm ----------
function endShift() {
  const rows = Object.values(shift.stats);
  if (rows.some((r) => r.tips > 0 || r.dep > 0 || r.beer > 0)) {
    const defs = [
      ['tips', 'Nữ hoàng tiền bo 👑', (v) => v + 'k'],
      ['beer', 'Chuyên gia rót bia 🍺', (v) => v + ' ly'],
      ['dep', 'Thánh hứng dép 🩴', (v) => v + ' chiếc'],
      ['catch', 'Thợ săn quỵt tiền 🏃', (v) => v + ' vụ'],
      ['pole', 'Ngôi sao múa cột ✨', (v) => v + ' lần'],
      ['songs', 'Họa mi của quán 🎤', (v) => v + ' bài 100đ'],
    ];
    const titles = [];
    for (const [k, title, fmt] of defs) {
      const best = rows.reduce((a, b) => (b[k] > (a ? a[k] : 0) ? b : a), null);
      if (best && best[k] > 0) {
        titles.push({ title, name: best.name, value: fmt(best[k]) });
        const p = Object.values(state.players).find((x) => x.name === best.name);
        if (p) earn(p, 100, { fund: false, tip: false });
      }
    }
    const ranking = rows.sort((a, b) => b.tips - a.tips).slice(0, 5).map((r) => ({ name: r.name, tips: r.tips }));
    io.emit('shiftEnd', { titles, ranking });
  }
  shift = { start: now(), stats: {} };
  emitState();
}

// =====================================================================
// VÒNG LẶP
// =====================================================================
setInterval(() => {
  const nPlayers = Object.keys(state.players).length;
  if (!nPlayers) { state.customers = {}; ghen = null; police = null; if (blackout) blackout = null; return; }
  const t = now();
  // sinh khách
  const totalSeats = roomsOpen().reduce((s, r) => s + r.seats, 0);
  const maxC = Math.min(1 + nPlayers * 2, totalSeats);
  spawnTimer -= 1;
  if (spawnTimer <= 0 && Object.keys(state.customers).length < maxC) { spawnCustomer(); spawnTimer = state.upgrades.sofa ? 5 : 9; }
  // khách đang ngồi
  for (const c of Object.values(state.customers)) {
    if (c.st === 'flee') {
      const d = (t - c.flee.t0) / 1000 * c.flee.speed;
      if (d >= routeLen(c.flee.pts)) { removeCustomer(c, false); io.emit('feed', `😤 ${TYPES[c.type].name} quỵt tiền chạy mất rồi!`); }
      continue;
    }
    if (c.st !== 'seat') continue;
    c.patience -= (c.servedBy ? 1 : 0.5) * (blackout ? 1.5 : 1);
    if (c.patience <= 0) {
      c.mood -= 15; c.react = 'bad'; c.reactAt = t;
      say(c, c.servedBy ? pick(LINES.timeout) : pick(LINES.idle));
      if (c.mood <= 0) { say(c, 'Lần sau anh qua quán khác!'); removeCustomer(c, false); io.emit('feed', `${TYPES[c.type].name} bỏ về vì chờ lâu 😤`); }
      else newRequest(c);
    }
  }
  // sự kiện ngẫu nhiên
  if (!schedule.ghen) { schedule.ghen = t + rand(80, 140) * 1000; schedule.police = t + rand(200, 320) * 1000; schedule.blackout = t + rand(260, 400) * 1000; }
  if (F.ghen && !ghen && t > schedule.ghen) { schedule.ghen = t + (startGhen() ? rand(100, 170) : 15) * 1000; }
  if (F.police && !police && !blackout && t > schedule.police) { startPolice(); schedule.police = t + rand(240, 380) * 1000; }
  if (F.blackout && !blackout && !police && t > schedule.blackout) { startBlackout(); schedule.blackout = t + rand(300, 450) * 1000; }
  if (blackout && t - blackout.t0 > 60000) endBlackout(null);
  tickGhen(); tickPolice();
  // song ca hết giờ
  for (const [did, d] of Object.entries(duets)) if (t - d.t > 45000) finishDuet(did);
  if (F.shift && t - shift.start >= SHIFT_MS) endShift();
  broadcastCustomers();
  io.emit('sync', t);
}, 1000);

setInterval(() => {
  const out = {};
  for (const p of Object.values(state.players)) out[p.id] = [p.x, p.z, p.ry, p.anim, p.holding, p.money];
  io.volatile.emit('players', out);
}, 100);

function sanitizeApp(a) {
  if (!a || typeof a !== 'object') return {};
  try { const s = JSON.stringify(a); if (s.length > 3000) return {}; return JSON.parse(s); } catch (e) { return {}; }
}
function enforceOwned(app, owned) {
  if (!F.shop) return app;
  for (const it of SHOP) if (app[it.key] === it.value && !owned.includes(it.id)) app[it.key] = SHOP_DEFAULT[it.key];
  return app;
}
function pubPlayer(p) { return { id: p.id, name: p.name, app: p.app, x: p.x, z: p.z, ry: p.ry, money: p.money, level: levelOf(p.earned) }; }

// ---------- song ca giữa 2 người chơi ----------
function finishDuet(did) {
  const d = duets[did]; if (!d) return;
  delete duets[did];
  const [a, b] = d.ids, qa = d.q[a] ?? 0, qb = d.q[b] ?? 0;
  const pa = state.players[a], pb = state.players[b];
  const ok = qa >= 0.5 && qb >= 0.5;
  const reward = ok ? Math.round((100 + 300 * Math.min(qa, qb)) / 10) * 10 : 0;
  for (const p of [pa, pb]) {
    if (!p) continue;
    if (ok) { earn(p, reward, { fund: false }); progress(p, 'duet'); }
    io.to(p.id).emit('duetResult', { qa: p.id === a ? qa : qb, qb: p.id === a ? qb : qa, reward, partner: (p.id === a ? pb : pa)?.name || '' });
  }
  if (ok && pa && pb) { io.emit('fireworks', { ids: [a, b] }); io.emit('feed', `🎤 ${pa.name} & ${pb.name} song ca cực hợp! (+${reward}k mỗi người)`); }
}

// =====================================================================
// KẾT NỐI NGƯỜI CHƠI
// =====================================================================
io.on('connection', (socket) => {
  const me = () => state.players[socket.id];
  // ---------- tài khoản ----------
  const fails = (key) => loginFails.get(key) || { n: 0, until: 0 };
  async function signIn(acc, withToken) {
    for (const [sid, p] of Object.entries(state.players)) {
      if (p.key === acc.key && sid !== socket.id) {
        liveCache.set(p.key, snap(p));
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
      acc.owned = []; acc.earned = 0;
      cb(await signIn(acc, true));
    } catch (e) { console.error(e); cb({ ok: false, error: 'Lỗi máy chủ, thử lại sau' }); }
  });
  socket.on('login', async ({ name, pin } = {}, cb = () => {}) => {
    try {
      const acc = await store.getAccount(String(name || ''));
      const key = acc ? acc.key : String(name || '').toLowerCase();
      const f = fails(key);
      if (f.until > now()) return cb({ ok: false, error: 'Sai PIN nhiều lần, đợi 5 phút rồi thử lại' });
      if (!acc) return cb({ ok: false, error: 'Chưa có nhân vật tên này. Bấm "Tạo nhân vật mới" nha' });
      if (!store.checkPin(acc, String(pin || ''))) {
        f.n++; if (f.n >= 5) { f.until = now() + 5 * 60000; f.n = 0; }
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
    // tài khoản cũ (trước khi có shop): giữ lại món đang mặc
    if (!Array.isArray(acc.owned)) acc.owned = SHOP.filter((it) => acc.app && acc.app[it.key] === it.value).map((it) => it.id);
    if (acc.earned == null) acc.earned = acc.money || 0;
    const app = enforceOwned(sanitizeApp(msg.app), acc.owned);
    const p = { id: socket.id, key: acc.key, name: acc.name, app, x: 0, z: 3, ry: Math.PI, anim: 'idle', holding: null, money: acc.money || 0, served: acc.served || 0, earned: acc.earned, owned: acc.owned, quests: acc.quests || null, dirty: true };
    state.players[socket.id] = p;
    ensureQuests(p);
    const players = {}; for (const q of Object.values(state.players)) players[q.id] = pubPlayer(q);
    socket.emit('init', {
      you: socket.id, players, customers: Object.values(state.customers).map(pubCustomer),
      fund: state.fund, upgrades: state.upgrades, upgradeDefs: UPGRADES,
      features: F, shop: F.shop ? SHOP : [], levels: F.levels ? LEVELS : [], owned: p.owned, earned: p.earned, quests: questsPub(p), app,
      shiftEnd: F.shift ? shift.start + SHIFT_MS : 0, now: now(),
      ghen: pubGhen(), police: police && { t0: police.t0, until: police.until }, blackout: !!blackout,
    });
    socket.broadcast.emit('playerJoined', pubPlayer(p));
    io.emit('feed', `${p.name} vừa vào ca 💃`);
  });

  socket.on('top', async (cb = () => {}) => { try { cb(await store.topAccounts(10)); } catch (e) { cb([]); } });

  socket.on('move', (m = {}) => {
    const p = me(); if (!p) return;
    p.x = clamp(Number(m.x) || 0, -25, 25);
    p.z = clamp(Number(m.z) || 0, -25, 25);
    p.ry = Number(m.ry) || 0;
    p.anim = String(m.anim || 'idle').slice(0, 10);
    p.holding = m.holding === 'fruit' || m.holding === 'water' ? m.holding : null;
  });

  socket.on('appearance', (a) => {
    const p = me(); if (!p) return;
    p.app = enforceOwned(sanitizeApp(a), p.owned);
    p.dirty = true;
    socket.broadcast.emit('appearance', { id: socket.id, app: p.app });
  });

  // ---------- shop ----------
  socket.on('buyItem', ({ id } = {}, cb = () => {}) => {
    if (!F.shop) return cb({ ok: false, error: 'Shop chưa mở' });
    const p = me(); const it = SHOP.find((x) => x.id === id);
    if (!p || !it) return cb({ ok: false, error: 'Không có món này' });
    if (p.owned.includes(id)) return cb({ ok: false, error: 'Bạn có món này rồi' });
    if (F.levels && (it.level || 0) > levelOf(p.earned)) return cb({ ok: false, error: `Cần đạt cấp ${LEVELS[it.level].name} mới mua được` });
    if (p.money < it.price) return cb({ ok: false, error: 'Không đủ tiền bo 😢' });
    p.money -= it.price; p.owned.push(id); p.dirty = true;
    cb({ ok: true, owned: p.owned, money: p.money });
    io.emit('feed', `🛍 ${p.name} vừa sắm ${it.name}!`);
  });

  // ---------- tặng quà ----------
  socket.on('gift', ({ to, amount, item } = {}, cb = () => {}) => {
    if (!F.gift) return cb({ ok: false, error: 'Chưa mở tính năng tặng quà' });
    const p = me(), q = state.players[to];
    if (!p || !q || p.id === q.id) return cb({ ok: false, error: 'Người nhận không còn trong quán' });
    let label = '';
    if (item) {
      const it = SHOP.find((x) => x.id === item);
      if (!it) return cb({ ok: false, error: 'Không có món này' });
      if (q.owned.includes(item)) return cb({ ok: false, error: `${q.name} có món này rồi` });
      if (p.money < it.price) return cb({ ok: false, error: 'Không đủ tiền bo 😢' });
      p.money -= it.price; q.owned.push(item); label = it.name;
      io.to(q.id).emit('owned', { owned: q.owned });
    } else {
      amount = Math.floor(Number(amount) || 0);
      if (amount < 10 || amount > 100000) return cb({ ok: false, error: 'Số tiền không hợp lệ' });
      if (p.money < amount) return cb({ ok: false, error: 'Không đủ tiền bo 😢' });
      p.money -= amount; q.money += amount; label = amount + 'k';
    }
    p.dirty = q.dirty = true;
    progress(p, 'gift');
    cb({ ok: true, money: p.money });
    io.emit('fireworks', { ids: [q.id] });
    io.emit('giftFx', { from: p.id, fromName: p.name, to: q.id, toName: q.name, label });
    io.emit('feed', `🎁 ${p.name} tặng ${q.name}: ${label}`);
  });

  // ---------- phục vụ khách ----------
  socket.on('serve', ({ cid } = {}) => {
    const p = me(), c = state.customers[cid];
    if (!p || !c || c.st !== 'seat') return;
    if (c.servedBy && c.servedBy !== socket.id) return;
    c.servedBy = socket.id; c.servedName = p.name;
    broadcastCustomers();
  });
  socket.on('release', ({ cid } = {}) => {
    const c = state.customers[cid];
    if (c && c.servedBy === socket.id) { c.servedBy = null; c.servedName = null; broadcastCustomers(); }
  });

  socket.on('resolve', ({ cid, kind, quality, score } = {}) => {
    const p = me(), c = state.customers[cid];
    if (!p || !c || c.st !== 'seat' || c.servedBy !== socket.id || !c.request || c.request.kind !== kind) return;
    const q = clamp(Number(quality) || 0, 0, 1);
    const T = TYPES[c.type];
    c.mood = clamp(c.mood + Math.round(q * 30 - (1 - q) * 15), 0, 100);
    say(c, q >= 0.5 ? pick(LINES.good) : pick(LINES.bad));
    c.react = q >= 0.5 ? 'good' : 'bad'; c.reactAt = now();
    if ((kind === 'beer' || kind === 'cheers') && q >= 0.5) {
      c.drunk = Math.min(3, (c.drunk || 0) + 1);
      if (c.drunk === 3) { say(c, 'Hức... anh hông có say... hức!'); progress(p, 'drunk'); }
    }
    if (kind === 'beer' && q >= 0.85) { stat(p).beer++; progress(p, 'beer'); }
    if (kind === 'pole' && q >= 0.99) { stat(p).pole++; progress(p, 'pole'); }
    if (F.karaoke && (kind === 'song' || kind === 'duet') && score === 100) { stat(p).songs++; progress(p, 'sing100'); }
    if (kind === 'water') { c.drunk = Math.max(0, (c.drunk || 0) - 2); if (q >= 0.5) say(c, 'Tỉnh rồi! Cảm ơn em nha'); }
    // khách đặc biệt
    if (c.type === 'baove') say(c, pick(LINES.baove));
    if (c.type === 'thattinh') {
      if (kind === 'song' && q >= 0.5) { c.crying = true; say(c, 'Huhu... bài này giống chuyện của anh quá... 😭'); }
      else if (kind === 'chat' && c.crying && q >= 0.5) { c.crying = false; say(c, 'Cảm ơn em... anh ổn rồi 🥲'); progress(p, 'comfort'); }
    }
    if (q >= 0.85) {
      const hot = Math.max(10, Math.round((T.tip * 0.1 * (1 + bonusOf(p))) / 10) * 10);
      earn(p, hot);
      io.emit('tip', { pid: p.id, name: p.name, amount: hot, cname: T.name, final: false, ctype: c.type });
      emitState();
    }
    c.done += 1;
    if (c.mood <= 0) { say(c, 'Thôi anh về!'); removeCustomer(c, false); io.emit('feed', `${T.name} giận dỗi bỏ về 😤`); }
    else if (c.done >= c.need && !c.crying) finishCustomer(c);
    else newRequest(c);
    broadcastCustomers();
  });

  // ---------- bắt khách quỵt tiền ----------
  socket.on('catch', ({ cid } = {}) => {
    const p = me(), c = state.customers[cid];
    if (!p || !c || c.st !== 'flee') return;
    const pos = posAt(c.flee.pts, (now() - c.flee.t0) / 1000 * c.flee.speed);
    if (Math.hypot(pos.x - p.x, pos.z - p.z) > 2.6) return socket.emit('toast', 'Chưa tới gần, chạy nhanh lên!');
    earn(p, c.fleeTip);
    stat(p).catch++; progress(p, 'catch'); progress(p, 'serve');
    say(c, 'Thôi thôi anh trả, anh trả mà! 😰');
    io.emit('tip', { pid: p.id, name: p.name, amount: c.fleeTip, cname: TYPES[c.type].name, final: true, caught: true, ctype: c.type });
    io.emit('feed', `🫵 ${p.name} tóm được ${TYPES[c.type].name} quỵt tiền! (+${c.fleeTip}k)`);
    c.st = 'caught';
    setTimeout(() => removeCustomer(c, true), 1500);
    emitState();
  });

  // ---------- đánh ghen: người chơi chọn ----------
  socket.on('ghenAnswer', ({ eid, choice } = {}) => {
    const p = me();
    if (!p || !ghen || ghen.id !== eid || !ghen.targets.has(p.id) || ghen.answers[p.id] || now() > ghen.dragAt) return;
    const c = state.customers[ghen.cid];
    ghen.answers[p.id] = choice;
    if (choice === 'staff') {
      socket.emit('ghenResult', { ok: true, text: 'Bà vợ: "Phục vụ thì đứng xa xa ra!" 😤 Thoát nạn nhưng mất tiền bo.' });
      progress(p, 'ghen');
    } else if (choice === 'sing') {
      if (Math.random() < 0.35) {
        ghen.happy = true;
        const { tip } = c ? tipFor(p, c, 2) : { tip: 300 };
        earn(p, tip);
        progress(p, 'ghen');
        socket.emit('ghenResult', { ok: true, text: `Bà vợ: "Thôi được, hát 1 bài rồi chị dẫn ổng về!" 🎤 Cả hai bo gấp đôi: +${tip}k` });
        io.emit('feed', `🎤 ${p.name} hóa giải được cơn ghen bằng 1 bài hát!`);
        if (c) say(c, 'Vợ anh cũng mê hát lắm đó em!');
      } else {
        socket.emit('ghenResult', { ok: false, text: 'Bà vợ: "Hát hò gì giờ này!!!" 🩴' });
        depHit(p, ghen.stand);
      }
    }
    // 'run': chờ client báo đã chạy thoát hay chưa
  });
  socket.on('ghenRun', ({ eid, escaped } = {}) => {
    const p = me();
    if (!p || !ghen || ghen.id !== eid || ghen.answers[p.id] !== 'run' || ghen.ran?.[p.id]) return;
    ghen.ran = ghen.ran || {}; ghen.ran[p.id] = true;
    const really = escaped && !inRoom(p, ghen.roomId);
    if (really) { progress(p, 'ghen'); socket.emit('ghenResult', { ok: true, text: 'Chạy thoát! Bà vợ chỉ kịp liếc theo 👀' }); }
    else { socket.emit('ghenResult', { ok: false, text: 'Chạy không kịp rồi! 🩴' }); depHit(p, ghen.stand); }
  });

  // ---------- công an ----------
  socket.on('policeOk', () => {
    const p = me();
    if (!p || !police || now() > police.until || police.ok.has(p.id)) return;
    police.ok.add(p.id); progress(p, 'police');
    socket.emit('toast', '👘 Đổi áo dài kịp rồi! Ngoan hiền quá 😇');
  });

  // ---------- cầu dao ----------
  socket.on('breaker', () => {
    const p = me();
    if (!p || !blackout) return;
    if (Math.hypot(p.x - BREAKER.x, p.z - BREAKER.z) > 3) return;
    endBlackout(p);
  });

  // ---------- song ca 2 người chơi ----------
  socket.on('duetInvite', ({ to } = {}) => {
    if (!F.duet) return;
    const p = me(), q = state.players[to];
    if (!p || !q || p.id === q.id) return;
    if (Math.hypot(p.x - q.x, p.z - q.z) > 4) return socket.emit('toast', 'Đứng gần nhau hơn mới song ca được');
    if (Object.values(duets).some((d) => d.ids.includes(p.id) || d.ids.includes(q.id))) return socket.emit('toast', 'Đang có người song ca rồi');
    const inv = invites.get(q.id);
    if (inv && inv.to === p.id && now() - inv.at < 15000) {
      invites.delete(q.id);
      const did = String(nextId++), seed = rand(1, 1e9);
      duets[did] = { ids: [q.id, p.id], q: {}, t: now() };
      io.to(q.id).emit('duetStart', { did, seed, partner: p.name });
      io.to(p.id).emit('duetStart', { did, seed, partner: q.name });
      return;
    }
    invites.set(p.id, { to: q.id, at: now() });
    io.to(q.id).emit('duetInvited', { from: p.id, name: p.name });
    socket.emit('toast', `Đã mời ${q.name} song ca 🎤 Đợi bạn ấy nhận nha`);
  });
  socket.on('duetDone', ({ did, q } = {}) => {
    const d = duets[did]; if (!d || !d.ids.includes(socket.id)) return;
    d.q[socket.id] = clamp(Number(q) || 0, 0, 1);
    if (Object.keys(d.q).length === 2) finishDuet(did);
  });

  socket.on('buy', ({ key } = {}) => {
    const p = me(), u = UPGRADES[key];
    if (!p || !u || state.upgrades[key] || state.fund < u.cost) return;
    state.fund -= u.cost; state.upgrades[key] = true; metaDirty = true;
    emitState();
    io.emit('feed', `${p.name} đã mua "${u.name}" cho quán 🎉`);
  });

  socket.on('chat', (text) => {
    const p = me(); const t = String(text || '').trim().slice(0, 80);
    if (!p || !t) return;
    io.emit('chat', { id: socket.id, name: p.name, text: t });
  });

  socket.on('disconnect', () => {
    const p = me(); if (!p) return;
    for (const c of Object.values(state.customers)) if (c.servedBy === socket.id) { c.servedBy = null; c.servedName = null; }
    invites.delete(p.id);
    savePlayer(p);
    delete state.players[socket.id];
    io.emit('playerLeft', { id: socket.id });
    io.emit('feed', `${p.name} đã tan ca 👋`);
  });
});

// =====================================================================
// LƯU DỮ LIỆU
// =====================================================================
function snap(p) { return { money: p.money, served: p.served || 0, app: p.app, earned: p.earned || 0, owned: p.owned || [], quests: p.quests || null }; }
function savePlayer(p) {
  if (!p.key) return Promise.resolve();
  p.dirty = false;
  const s = snap(p);
  liveCache.set(p.key, s);
  return store.saveAccount(p.key, s).catch((e) => console.error('Lưu lỗi:', e.message));
}
async function saveAll() {
  const jobs = Object.values(state.players).filter((p) => p.dirty).map(savePlayer);
  if (metaDirty) { metaDirty = false; jobs.push(store.saveMeta(state.fund, state.upgrades).catch((e) => console.error(e.message))); }
  await Promise.all(jobs);
}
setInterval(saveAll, 5000);
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, async () => { console.log('Đang lưu trước khi tắt...'); await saveAll(); process.exit(0); });

// dùng cho test tự động: ép sự kiện xảy ra ngay (chỉ khi bật biến môi trường KTV_TEST)
if (process.env.KTV_TEST) {
  app.get('/test/:ev', (req, res) => {
    const e = req.params.ev;
    if (e === 'ghen') res.send(String(startGhen()));
    else if (e === 'police') { startPolice(); res.send('ok'); }
    else if (e === 'blackout') { startBlackout(); res.send('ok'); }
    else if (e === 'shift') { endShift(); res.send('ok'); }
    else if (e === 'flee') { const c = Object.values(state.customers).find((x) => x.st === 'seat'); if (c) { c.servedBy = c.servedBy || Object.keys(state.players)[0]; const r = Math.random; Math.random = () => 0; finishCustomer(c); Math.random = r; } res.send(String(!!c)); }
    else if (e === 'spawn') { const t = req.query.type; const r = roomsOpen().find((x) => takenSeats(x.id).length < x.seats); if (r && TYPES[t]) { const s = [...Array(r.seats).keys()].find((i) => !takenSeats(r.id).includes(i)); makeCustomer(t, r.id, s); } res.send('ok'); }
    else if (e === 'money') { for (const p of Object.values(state.players)) { earn(p, Number(req.query.n) || 5000, { fund: false }); } res.send('ok'); }
    else res.send('?');
  });
}

(async () => {
  await store.init();
  const m = await store.loadMeta();
  state.fund = m.fund || 0; state.upgrades = m.upgrades || {};
  server.listen(PORT, () => console.log(`KTV Lung Linh 3D đang chạy ở cổng ${PORT}`));
})();
