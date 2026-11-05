// Lưu tài khoản + quỹ quán.
// Có biến môi trường MONGODB_URI -> lưu vào MongoDB (vĩnh viễn).
// Không có -> lưu vào file data/save.json (mất khi Render khởi động lại, chỉ dùng để chạy thử).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const URI = process.env.MONGODB_URI;
let mode = 'file';
let col = null, meta = null;
const FILE = path.join(__dirname, 'data', 'save.json');
let mem = { accounts: {}, meta: { _id: 'quan', fund: 0, upgrades: {} } };

async function init() {
  if (URI) {
    try {
      const { MongoClient } = require('mongodb');
      const client = new MongoClient(URI, { serverSelectionTimeoutMS: 10000 });
      await client.connect();
      const db = client.db(process.env.MONGODB_DB || 'ktv');
      col = db.collection('accounts');
      meta = db.collection('meta');
      await col.createIndex({ key: 1 }, { unique: true });
      mode = 'mongo';
      console.log('Đã kết nối MongoDB: tài khoản sẽ được lưu vĩnh viễn');
      return;
    } catch (e) {
      console.error('KHÔNG kết nối được MongoDB, chuyển sang lưu file tạm:', e.message);
    }
  } else {
    console.log('Chưa có MONGODB_URI: lưu tạm vào file (sẽ mất khi server khởi động lại)');
  }
  try { mem = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (e) {}
}

let fileTimer = null;
function flushFile() {
  clearTimeout(fileTimer);
  fileTimer = setTimeout(() => {
    try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(mem)); } catch (e) { console.error(e.message); }
  }, 200);
}

const keyOf = (name) => String(name).trim().toLowerCase().normalize('NFC');
function hashPin(pin, salt) { return crypto.scryptSync(String(pin), salt, 32).toString('hex'); }

async function getAccount(name) {
  const key = keyOf(name);
  if (mode === 'mongo') return col.findOne({ key });
  return mem.accounts[key] || null;
}

async function createAccount(name, pin) {
  const key = keyOf(name);
  const salt = crypto.randomBytes(16).toString('hex');
  const acc = { key, name: String(name).trim(), salt, pin: hashPin(pin, salt), money: 0, served: 0, app: null, tokens: [], createdAt: Date.now(), lastSeen: Date.now() };
  if (mode === 'mongo') {
    try { await col.insertOne(acc); } catch (e) { if (e.code === 11000) return null; throw e; }
  } else {
    if (mem.accounts[key]) return null;
    mem.accounts[key] = acc; flushFile();
  }
  return acc;
}

function checkPin(acc, pin) {
  const h = hashPin(pin, acc.salt);
  return crypto.timingSafeEqual(Buffer.from(h, 'hex'), Buffer.from(acc.pin, 'hex'));
}

async function addToken(acc) {
  const token = crypto.randomBytes(24).toString('hex');
  const tokens = [...(acc.tokens || []), token].slice(-5);
  acc.tokens = tokens;
  await saveAccount(acc.key, { tokens });
  return token;
}

async function saveAccount(key, fields) {
  fields = { ...fields, lastSeen: Date.now() };
  if (mode === 'mongo') await col.updateOne({ key }, { $set: fields });
  else if (mem.accounts[key]) { Object.assign(mem.accounts[key], fields); flushFile(); }
}

async function topAccounts(n = 10) {
  if (mode === 'mongo') return col.find({}, { projection: { name: 1, money: 1, _id: 0 } }).sort({ money: -1 }).limit(n).toArray();
  return Object.values(mem.accounts).sort((a, b) => b.money - a.money).slice(0, n).map((a) => ({ name: a.name, money: a.money }));
}

async function loadMeta() {
  if (mode === 'mongo') return (await meta.findOne({ _id: 'quan' })) || { fund: 0, upgrades: {} };
  return mem.meta;
}
async function saveMeta(fund, upgrades) {
  if (mode === 'mongo') await meta.updateOne({ _id: 'quan' }, { $set: { fund, upgrades } }, { upsert: true });
  else { mem.meta = { _id: 'quan', fund, upgrades }; flushFile(); }
}

module.exports = { init, getAccount, createAccount, checkPin, addToken, saveAccount, topAccounts, loadMeta, saveMeta, get mode() { return mode; } };
