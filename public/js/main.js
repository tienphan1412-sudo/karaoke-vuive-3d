import * as THREE from 'three';
import { createGirl, createCustomer, makeLabel, roundRect } from './character.js';
import { buildWorld, seatTransform, BAR, MIRROR, ROOM_DEFS } from './world.js';
import { runMinigame, isMinigameOpen } from './minigames.js';
import * as D from './data.js';
import { initMusic, setZone, toggleMusic, musicOn } from './music.js';

const $ = (s) => document.querySelector(s);
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
};

await document.fonts.ready.catch(() => {});

// ================= Renderer / scene =================
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
$('#game').appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#120818');
scene.fog = new THREE.Fog('#120818', 28, 60);
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.03, 200);
scene.add(new THREE.HemisphereLight('#ffd6f0', '#2a1040', 1.6));
scene.add(new THREE.AmbientLight('#ffffff', 0.35));
const sun = new THREE.DirectionalLight('#fff0f6', 1.0); sun.position.set(5, 10, 8); scene.add(sun);
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });

const world = buildWorld(scene);
const isMobile = matchMedia('(max-width: 800px), (pointer: coarse)').matches;

// ================= State =================
const DEFAULT = { ...D.DEFAULT_APP };
const VALID_OUTFIT = (a) => (D.OUTFITS.some((o) => o.id === a.outfit) ? a : { ...a, outfit: DEFAULT.outfit });
let app = VALID_OUTFIT({ ...DEFAULT, ...store.get('ktv_app_khoi', {}) });
let myName = store.get('ktv_name', '');
let myId = null, joined = false, myMoney = 0;
let gameState = { fund: 0, upgrades: {} };
let upgradeDefs = {};
const players = new Map();   // id -> remote
const customers = new Map(); // id -> {data, obj, label, key}

const me = { char: createGirl(app), x: 0, z: 3, ry: Math.PI, anim: 'idle', holding: null, emoteUntil: 0, emote: null, busy: false };
scene.add(me.char.group);
const myLabel = makeLabel(512, 96, 1);
scene.add(myLabel.sprite);

// ================= Camera =================
let camYaw = 0, camPitch = 0.55, camDist = 4.4;
let camMode = 'play'; // play | creator
let creatorView = 'full';
const camTarget = new THREE.Vector3();
function updateCamera(dt) {
  const h = app.height || 1;
  let pos, target;
  if (camMode === 'creator') {
    const fx = Math.sin(me.ry), fz = Math.cos(me.ry);
    const rx = Math.cos(me.ry), rz = -Math.sin(me.ry);
    const hy = (me.char.headY || 1.4) * h;
    if (creatorView === 'face') {
      target = new THREE.Vector3(me.x, hy - 0.01, me.z);
      pos = new THREE.Vector3(me.x + fx * 0.62, hy + 0.01, me.z + fz * 0.62);
      if (!isMobile) { target.addScaledVector(new THREE.Vector3(rx, 0, rz), 0.1); pos.addScaledVector(new THREE.Vector3(rx, 0, rz), 0.1); }
      else { target.y -= 0.12; pos.y -= 0.08; }
    } else {
      const d = isMobile ? 3.6 : 2.8;
      target = new THREE.Vector3(me.x, 0.88 * h, me.z);
      pos = new THREE.Vector3(me.x + fx * d, 1.15 * h, me.z + fz * d);
      if (!isMobile) { target.addScaledVector(new THREE.Vector3(rx, 0, rz), 0.55); pos.addScaledVector(new THREE.Vector3(rx, 0, rz), 0.55); }
      else { target.y -= 0.7; pos.y -= 0.1; }
    }
  } else {
    target = new THREE.Vector3(me.x, 1.2, me.z);
    pos = new THREE.Vector3(
      me.x + Math.sin(camYaw) * Math.cos(camPitch) * camDist,
      1.2 + Math.sin(camPitch) * camDist,
      me.z + Math.cos(camYaw) * Math.cos(camPitch) * camDist
    );
    // không cho camera chui vào tường
    const N = 30;
    for (let i = 1; i <= N; i++) {
      const f = i / N;
      const px = target.x + (pos.x - target.x) * f, py = target.y + (pos.y - target.y) * f, pz = target.z + (pos.z - target.z) * f;
      let hit = false;
      for (const c of world.colliders) {
        if (c.glass || py > c.top + 0.1) continue;
        if (px > c.minX - 0.15 && px < c.maxX + 0.15 && pz > c.minZ - 0.15 && pz < c.maxZ + 0.15) { hit = true; break; }
      }
      if (hit) { const g = Math.max(0.15, (i - 1) / N); pos.set(target.x + (pos.x - target.x) * g, target.y + (pos.y - target.y) * g, target.z + (pos.z - target.z) * g); break; }
    }
  }
  const k = Math.min(1, dt * 8);
  camera.position.lerp(pos, k);
  camTarget.lerp(target, k);
  camera.lookAt(camTarget);
}

// ================= Input =================
const keys = new Set();
const joy = { x: 0, y: 0 };
addEventListener('keydown', (e) => {
  if (document.activeElement && document.activeElement.tagName === 'INPUT') {
    if (e.key === 'Enter' && document.activeElement.id === 'chatInput') sendChat();
    if (e.key === 'Escape') document.activeElement.blur();
    return;
  }
  if (isMinigameOpen()) return;
  keys.add(e.code);
  if (!joined) return;
  if (e.code === 'KeyE') interact();
  if (e.code === 'KeyQ') releaseCustomer();
  if (e.code === 'Enter') { e.preventDefault(); $('#chatInput').focus(); }
  if (e.code === 'Digit1') emote('wave');
  if (e.code === 'Digit2') emote('dance');
  if (e.code === 'Digit3') emote('sing');
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());

// kéo để xoay camera
let drag = null;
renderer.domElement.addEventListener('pointerdown', (e) => { drag = { id: e.pointerId, x: e.clientX, y: e.clientY }; });
addEventListener('pointermove', (e) => {
  if (!drag || drag.id !== e.pointerId || camMode !== 'play') return;
  camYaw -= (e.clientX - drag.x) * 0.006;
  camPitch = Math.max(0.12, Math.min(1.25, camPitch + (e.clientY - drag.y) * 0.004));
  drag.x = e.clientX; drag.y = e.clientY;
});
addEventListener('pointerup', (e) => { if (drag && drag.id === e.pointerId) drag = null; });
renderer.domElement.addEventListener('wheel', (e) => { camDist = Math.max(2.5, Math.min(10, camDist + e.deltaY * 0.004)); }, { passive: true });

// joystick
{
  const el = $('#joy'), knob = el.querySelector('.knob');
  let jid = null;
  const set = (e) => {
    const r = el.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    const m = Math.hypot(dx, dy), max = r.width / 2 - 10;
    if (m > max) { dx *= max / m; dy *= max / m; }
    joy.x = dx / max; joy.y = dy / max;
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
  };
  el.addEventListener('pointerdown', (e) => { jid = e.pointerId; el.setPointerCapture(jid); set(e); e.stopPropagation(); });
  el.addEventListener('pointermove', (e) => { if (e.pointerId === jid) set(e); });
  const end = (e) => { if (e.pointerId !== jid) return; jid = null; joy.x = joy.y = 0; knob.style.transform = ''; };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  $('#actBtn').addEventListener('click', () => interact());
}

// ================= Movement / collisions =================
const R = 0.28;
function blocked(x, z) {
  for (const c of world.colliders) if (x > c.minX - R && x < c.maxX + R && z > c.minZ - R && z < c.maxZ + R) return true;
  return false;
}
function updateMe(dt, t) {
  let f = 0, r = 0;
  if (!me.busy && camMode === 'play') {
    if (keys.has('KeyW') || keys.has('ArrowUp')) f += 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) f -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) r += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) r -= 1;
    f -= joy.y; r += joy.x;
  }
  const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw);
  const rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
  let mx = fx * f + rx * r, mz = fz * f + rz * r;
  const m = Math.hypot(mx, mz);
  let moving = 0;
  if (m > 0.05) {
    const sp = 3.4 * Math.min(1, m) * dt;
    mx /= m; mz /= m;
    const nx = me.x + mx * sp, nz = me.z + mz * sp;
    if (!blocked(nx, me.z)) me.x = nx;
    if (!blocked(me.x, nz)) me.z = nz;
    const want = Math.atan2(mx, mz);
    let d = want - me.ry; d = Math.atan2(Math.sin(d), Math.cos(d));
    me.ry += d * Math.min(1, dt * 12);
    moving = 1;
    me.emoteUntil = 0;
  }
  let anim = moving ? 'walk' : 'idle';
  if (me.emoteUntil > t) anim = me.emote;
  me.anim = anim;
  me.char.group.position.set(me.x, 0, me.z);
  me.char.group.rotation.y = me.ry;
  me.char.animate(anim, t, moving, !!me.holding);
  me.char.setHolding(me.holding);
  myLabel.sprite.position.set(me.x, ((me.char.topY || 1.6) + 0.2) * (app.height || 1), me.z);
}
function emote(e) { me.emote = e; me.emoteUntil = clock.elapsedTime + (e === 'wave' ? 2 : 4); }
document.querySelectorAll('.emotes button').forEach((b) => b.addEventListener('click', () => emote(b.dataset.emote)));

// ================= Labels =================
function drawNameLabel(lbl, name, money, isMe) {
  const { ctx, w, h } = lbl;
  ctx.clearRect(0, 0, w, h);
  ctx.font = 'bold 44px "Be Vietnam Pro", sans-serif';
  const text = name;
  const tw = ctx.measureText(text).width + 40;
  ctx.fillStyle = isMe ? 'rgba(255,79,163,0.85)' : 'rgba(20,8,28,0.75)';
  roundRect(ctx, (w - tw) / 2, 14, tw, 64, 30); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, 47);
  lbl.tex.needsUpdate = true;
}
function drawCustomerLabel(lbl, c) {
  const { ctx, w, h } = lbl;
  ctx.clearRect(0, 0, w, h);
  const info = D.CUSTOMER_TYPES[c.type];
  const mine = c.servedBy === myId;
  ctx.fillStyle = mine ? 'rgba(60,10,45,0.9)' : 'rgba(20,8,28,0.82)';
  roundRect(ctx, 4, 4, w - 8, h - 8, 26); ctx.fill();
  ctx.strokeStyle = mine ? '#ff4fa3' : 'rgba(255,255,255,0.25)'; ctx.lineWidth = mine ? 5 : 2; ctx.stroke();
  ctx.textBaseline = 'middle';
  const moodEmoji = c.mood >= 80 ? '😍' : c.mood >= 55 ? '🙂' : c.mood >= 30 ? '😐' : '😠';
  ctx.font = 'bold 34px "Be Vietnam Pro", sans-serif'; ctx.fillStyle = '#ffd54f'; ctx.textAlign = 'left';
  ctx.fillText(`${moodEmoji} ${info.name}${c.drunk >= 2 ? ' 🥴' : c.drunk === 1 ? ' 🍺' : ''}`, 24, 38);
  ctx.textAlign = 'right'; ctx.font = '26px "Be Vietnam Pro", sans-serif'; ctx.fillStyle = '#ccc';
  ctx.fillText(`${c.done}/${c.need}`, w - 24, 38);
  ctx.textAlign = 'left';
  const fresh = c.line && Date.now() - c.lineAt < 4000;
  ctx.font = 'bold 32px "Be Vietnam Pro", sans-serif'; ctx.fillStyle = '#fff';
  const reqTxt = `${D.REQ_ICON[c.request.kind]} ${D.REQ_TEXT[c.request.kind](c.request.data)}`;
  ctx.fillText(fresh ? `“${c.line}”` : reqTxt, 24, 86);
  ctx.font = '24px "Be Vietnam Pro", sans-serif'; ctx.fillStyle = mine ? '#ff9ad0' : '#9fd8ff';
  ctx.fillText(c.servedBy ? (mine ? 'Bạn đang phục vụ' : `${c.servedName} đang phục vụ`) : 'Chưa ai tiếp! (nhấn E)', 24, 128);
  const p = c.patience / c.maxPatience;
  ctx.fillStyle = 'rgba(255,255,255,0.15)'; roundRect(ctx, 24, 152, w - 48, 14, 7); ctx.fill();
  ctx.fillStyle = p > 0.5 ? '#66bb6a' : p > 0.25 ? '#ffca28' : '#ef5350';
  roundRect(ctx, 24, 152, Math.max(14, (w - 48) * p), 14, 7); ctx.fill();
  lbl.tex.needsUpdate = true;
}

// ================= Customers =================
function syncCustomers(list) {
  const seen = new Set();
  for (const c of list) {
    seen.add(c.id);
    let e = customers.get(c.id);
    if (!e) {
      const obj = createCustomer(c.type);
      const st = seatTransform(c.roomId, c.seat);
      obj.group.position.set(st.x, 0.08, st.z);
      obj.group.rotation.y = st.ry;
      scene.add(obj.group);
      const label = makeLabel(640, 180, 1.8);
      label.sprite.position.set(st.x, 1.95, st.z);
      scene.add(label.sprite);
      e = { obj, label, data: c, key: '', off: Math.random() * 10 };
      customers.set(c.id, e);
    }
    e.data = c;
    const key = JSON.stringify([c.mood, c.servedBy, c.request, c.patience, c.line, c.done, c.drunk]);
    if (key !== e.key) { drawCustomerLabel(e.label, c); e.key = key; }
  }
  for (const [id, e] of customers) if (!seen.has(id)) removeCustomerObj(id);
}
function removeCustomerObj(id) {
  const e = customers.get(id);
  if (!e) return;
  scene.remove(e.obj.group); scene.remove(e.label.sprite);
  customers.delete(id);
}

// ================= Interaction =================
let near = null;
function findNear() {
  let best = null, bd = 3.1;
  for (const e of customers.values()) {
    const st = seatTransform(e.data.roomId, e.data.seat);
    const d = Math.hypot(st.x - me.x, st.z - me.z);
    if (d < bd) { bd = d; best = { type: 'customer', e }; }
  }
  if (!best && Math.hypot(BAR.x - me.x, BAR.z - me.z) < 3) best = { type: 'bar' };
  if (!best && Math.hypot(MIRROR.x - me.x, MIRROR.z - me.z) < 3) best = { type: 'mirror' };
  return best;
}
function updatePrompt() {
  const p = $('#prompt');
  if (!joined || camMode !== 'play' || me.busy) { p.classList.add('hidden'); return; }
  near = findNear();
  if (!near) { p.classList.add('hidden'); return; }
  const key = isMobile ? 'nút tròn' : 'E';
  let txt = '';
  if (near.type === 'bar') txt = `Nhấn <b>${key}</b> để lấy đồ ở quầy bar 🍹`;
  else if (near.type === 'mirror') txt = `Nhấn <b>${key}</b> để thay đồ & makeup 💄`;
  else {
    const c = near.e.data, info = D.CUSTOMER_TYPES[c.type];
    if (c.servedBy && c.servedBy !== myId) txt = `${info.name} đang được <b>${c.servedName}</b> phục vụ`;
    else {
      const k = c.request.kind;
      const fetch = k === 'fruit' || k === 'water';
      const likes = info.likes === 'any' ? 'gì cũng được (miễn rẻ 😂)' : D.STYLE_NAMES[info.likes];
      if (fetch && me.holding !== k) txt = `${info.name}: ${D.REQ_TEXT[k]()} → ra <b>Quầy bar</b> lấy ${D.REQ_ICON[k]}`;
      else txt = `Nhấn <b>${key}</b> để ${D.REQ_ICON[k]} ${fetch ? 'đưa đồ cho khách' : D.REQ_TEXT[k](c.request.data).toLowerCase()}<br><small>Gu khách: ${likes}</small>`;
    }
  }
  p.innerHTML = txt;
  p.classList.remove('hidden');
}

async function interact() {
  if (!joined || me.busy || isMinigameOpen() || camMode !== 'play') return;
  near = findNear();
  if (!near) return;
  if (near.type === 'bar') { openModal('#barMenu'); return; }
  if (near.type === 'mirror') { openCreator(); return; }
  const c = near.e.data;
  const info = D.CUSTOMER_TYPES[c.type];
  if (c.servedBy && c.servedBy !== myId) { toast(`Khách đang được ${c.servedName} phục vụ rồi`); return; }
  if (!c.servedBy) { socket.emit('serve', { cid: c.id }); c.servedBy = myId; }
  const k = c.request.kind;
  // mặt hướng về khách
  const st = seatTransform(c.roomId, c.seat);
  me.ry = Math.atan2(st.x - me.x, st.z - me.z);
  if (k === 'fruit' || k === 'water') {
    if (me.holding === k) {
      const q = 0.55 + 0.45 * (c.patience / c.maxPatience);
      me.holding = null; updateHolding();
      socket.emit('resolve', { cid: c.id, kind: k, quality: q });
      sfx('good');
    } else if (me.holding) toast('Khách không gọi món này! Ra quầy bar đổi món nha.');
    else toast(`Ra <b>Quầy bar</b> (đầu sảnh bên trái) lấy ${k === 'fruit' ? 'đĩa trái cây 🍉' : 'ly nước chanh 🍋'} rồi quay lại!`);
    return;
  }
  me.busy = true;
  const animFor = { duet: 'sing', song: 'sing', dance: 'dance', cheers: 'wave' }[k];
  if (animFor) { me.emote = animFor; me.emoteUntil = 1e9; }
  const q = await runMinigame(k, { type: c.type, cname: info.name, data: c.request.data });
  me.busy = false;
  me.emoteUntil = animFor ? clock.elapsedTime + 2 : 0;
  socket.emit('resolve', { cid: c.id, kind: k, quality: q });
  sfx(q >= 0.5 ? 'good' : 'bad');
}
function releaseCustomer() {
  for (const e of customers.values()) if (e.data.servedBy === myId) { socket.emit('release', { cid: e.data.id }); toast('Đã nhường khách cho bạn khác'); }
}
function updateHolding() {
  const el = $('#holding');
  if (me.holding) { el.textContent = me.holding === 'fruit' ? '🍉 Đang cầm đĩa trái cây' : '🍋 Đang cầm ly nước chanh'; el.classList.remove('hidden'); }
  else el.classList.add('hidden');
}
document.querySelectorAll('#barMenu [data-item]').forEach((b) => b.addEventListener('click', () => {
  me.holding = b.dataset.item === 'none' ? null : b.dataset.item;
  updateHolding(); closeModals();
  if (me.holding) toast('Mang tới cho khách rồi nhấn E nha!');
}));

// ================= Modals / toasts / sound =================
function openModal(sel) { $(sel).classList.add('show'); me.busy = true; }
function closeModals() { document.querySelectorAll('.modal').forEach((m) => m.classList.remove('show')); me.busy = false; }
document.querySelectorAll('.modal .close').forEach((b) => b.addEventListener('click', closeModals));
document.querySelectorAll('.modal').forEach((m) => m.addEventListener('click', (e) => { if (e.target === m) closeModals(); }));
function toast(html) {
  const d = document.createElement('div'); d.innerHTML = html; $('#toast').appendChild(d);
  setTimeout(() => d.remove(), 3600);
}
function feed(text) {
  const d = document.createElement('div'); d.textContent = text; $('#feed').appendChild(d);
  while ($('#feed').children.length > 5) $('#feed').firstChild.remove();
  setTimeout(() => d.remove(), 7000);
}
function floater(html) {
  const d = document.createElement('div'); d.className = 'floater'; d.innerHTML = html; $('#floaters').appendChild(d);
  setTimeout(() => d.remove(), 2100);
}
let actx = null;
function sfx(kind) {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const notes = { good: [660, 880], bad: [300, 220], tip: [784, 988, 1319], coin: [1319, 1568] }[kind] || [440];
    notes.forEach((f, i) => {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = kind === 'bad' ? 'sawtooth' : 'triangle'; o.frequency.value = f;
      const t0 = actx.currentTime + i * 0.09;
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.18, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
      o.connect(g).connect(actx.destination); o.start(t0); o.stop(t0 + 0.25);
    });
  } catch (e) {}
}

// ================= HUD =================
function styleOf(a) { return (D.OUTFITS.find((o) => o.id === a.outfit) || D.OUTFITS[0]).style; }
function refreshStyleBadges() {
  const s = styleOf(app);
  for (const el of [$('#styleBadge'), $('#myStyle')]) { el.className = 'badge ' + s; el.textContent = 'Phong cách: ' + D.STYLE_NAMES[s]; }
}
let topAll = [];
function loadTop() { if (joined) socket.emit('top', (list) => { topAll = Array.isArray(list) ? list : []; refreshHUD(); }); }
setInterval(loadTop, 30000);
function refreshHUD() {
  $('#myMoney').textContent = D.fmtMoney(myMoney);
  $('#fund').textContent = D.fmtMoney(gameState.fund);
  const rows = [{ name: myName, money: myMoney, me: true }, ...[...players.values()].map((p) => ({ name: p.name, money: p.money }))]
    .sort((a, b) => b.money - a.money).slice(0, 6);
  $('#board').innerHTML = '<h4>🏆 Đang trong ca</h4>' + rows.map((r, i) => `<div class="${r.me ? 'me' : ''}"><span>${i + 1}. ${escapeHtml(r.name)}</span><span>${D.fmtMoney(r.money)}</span></div>`).join('')
    + (topAll.length ? '<h4 class="top">👑 Top mọi thời đại</h4>' + topAll.slice(0, 5).map((r, i) => `<div class="${r.name === myName ? 'me' : ''}"><span>${i + 1}. ${escapeHtml(r.name)}</span><span>${D.fmtMoney(r.money)}</span></div>`).join('') : '');
}
function refreshShop() {
  $('#shopList').innerHTML = Object.entries(upgradeDefs).map(([k, u]) => {
    const owned = gameState.upgrades[k];
    return `<div class="up"><div><b>${u.name}</b><small>${u.desc}</small></div><button class="btn ${owned ? '' : 'primary'}" data-buy="${k}" ${owned || gameState.fund < u.cost ? 'disabled' : ''}>${owned ? 'Đã có ✓' : D.fmtMoney(u.cost)}</button></div>`;
  }).join('') + `<p style="opacity:.7;font-size:13px">Quỹ hiện có: <b>${D.fmtMoney(gameState.fund)}</b></p>`;
  $('#shopList').querySelectorAll('[data-buy]').forEach((b) => b.addEventListener('click', () => socket.emit('buy', { key: b.dataset.buy })));
}
$('#btnShop').addEventListener('click', () => { refreshShop(); openModal('#shop'); });
$('#btnHelp').addEventListener('click', () => openModal('#help'));
const musicIcon = () => { $('#btnMusic').textContent = musicOn() ? '🔊' : '🔇'; };
$('#btnMusic').addEventListener('click', () => { initMusic(); toggleMusic(); musicIcon(); toast(musicOn() ? 'Đã bật nhạc 🎶' : 'Đã tắt nhạc'); });
musicIcon();
function zoneAt(x, z) {
  for (const r of ROOM_DEFS) {
    const f = r.cz + r.dir * r.hd, b = r.cz - r.dir * r.hd;
    if (Math.abs(x - r.cx) < r.hw && z > Math.min(f, b) && z < Math.max(f, b)) return 'r' + r.id;
  }
  return 'lobby';
}
$('#btnWardrobe').addEventListener('click', () => openCreator());
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// chat
function sendChat() {
  const inp = $('#chatInput'); const t = inp.value.trim();
  if (t && joined) socket.emit('chat', t);
  inp.value = ''; inp.blur();
}
const bubbles = new Map();
function showBubble(id, text) {
  const lbl = makeLabel(640, 120, 1.1);
  const { ctx, w, h } = lbl;
  ctx.font = 'bold 40px "Be Vietnam Pro", sans-serif';
  const t = text.length > 28 ? text.slice(0, 27) + '…' : text;
  const tw = Math.min(w - 10, ctx.measureText(t).width + 50);
  ctx.fillStyle = 'rgba(255,255,255,0.95)'; roundRect(ctx, (w - tw) / 2, 10, tw, 80, 36); ctx.fill();
  ctx.beginPath(); ctx.moveTo(w / 2 - 14, 88); ctx.lineTo(w / 2, 112); ctx.lineTo(w / 2 + 14, 88); ctx.fill();
  ctx.fillStyle = '#2a1036'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, w / 2, 50);
  lbl.tex.needsUpdate = true;
  const old = bubbles.get(id); if (old) scene.remove(old.sprite);
  scene.add(lbl.sprite);
  bubbles.set(id, { sprite: lbl.sprite, until: performance.now() + 5000 });
}

// ================= Creator (tủ đồ + makeup) =================
const CREATOR = [
  { tab: 'Trang phục', items: [
    { key: 'outfit', label: 'Kiểu đồ', type: 'cards', options: D.OUTFITS.map((o) => ({ id: o.id, name: o.name, style: o.style })) },
    { key: 'outfitColor', label: 'Màu đồ', type: 'swatch', options: D.OUTFIT_COLORS },
    { key: 'shoes', label: 'Giày cao gót', type: 'swatch', options: D.SHOE_COLORS },
  ] },
  { tab: 'Dáng người', items: [
    { key: 'skin', label: 'Màu da', type: 'swatch', options: D.SKIN },
    { key: 'height', label: 'Chiều cao', type: 'range', min: 0.94, max: 1.06, step: 0.01, fmt: (v) => Math.round(158 * v) + ' cm' },
  ] },
  { tab: 'Tóc', items: [
    { key: 'hair', label: 'Kiểu tóc', type: 'opts', options: D.HAIR_STYLES },
    { key: 'hairColor', label: 'Màu tóc', type: 'swatch', options: D.HAIR_COLORS },
  ] },
  { tab: 'Mắt', face: true, items: [
    { key: 'eyeColor', label: 'Màu lens', type: 'swatch', options: D.EYE_COLORS },
    { key: 'shadow', label: 'Phấn mắt', type: 'swatch', options: D.SHADOW_COLORS },
    { key: 'shadowAmt', label: 'Độ đậm phấn mắt', type: 'range', min: 0.2, max: 1, step: 0.05, fmt: (v) => Math.round(v * 100) + '%' },
    { key: 'liner', label: 'Kẻ mắt', type: 'opts', options: D.LINER },
    { key: 'lashes', label: 'Lông mi', type: 'opts', options: D.LASHES },
    { key: 'brows', label: 'Chân mày', type: 'opts', options: D.BROWS },
  ] },
  { tab: 'Môi & má', face: true, items: [
    { key: 'lip', label: 'Màu son', type: 'swatch', options: D.LIP_COLORS },
    { key: 'gloss', label: 'Chất son', type: 'opts', options: [{ id: true, name: 'Bóng ✨' }, { id: false, name: 'Lì' }] },
    { key: 'blush', label: 'Má hồng', type: 'swatch', options: D.BLUSH_COLORS },
  ] },
  { tab: 'Phụ kiện', items: [
    { key: 'earrings', label: 'Bông tai', type: 'opts', options: D.EARRINGS },
    { key: 'clip', label: 'Kẹp tóc', type: 'opts', options: D.CLIPS },
    { key: 'glasses', label: 'Kính', type: 'opts', options: D.GLASSES },
    { key: 'necklace', label: 'Dây chuyền', type: 'opts', options: D.NECKLACES },
  ] },
];
let crTab = 0;
function setApp(patch) {
  app = { ...app, ...patch };
  me.char.update(app);
  store.set('ktv_app_khoi', app);
  refreshStyleBadges();
  if (joined) socket.emit('appearance', app);
}
function setView(v) {
  creatorView = v;
  document.querySelectorAll('.cr-view [data-view]').forEach((b) => b.classList.toggle('on', b.dataset.view === v));
}
function renderCreator() {
  $('.cr-tabs').innerHTML = CREATOR.map((t, i) => `<button class="${i === crTab ? 'on' : ''}" data-tab="${i}">${t.tab}</button>`).join('');
  $('.cr-tabs').querySelectorAll('button').forEach((b) => b.onclick = () => {
    crTab = +b.dataset.tab; setView(CREATOR[crTab].face ? 'face' : 'full'); renderCreator();
  });
  const tab = CREATOR[crTab];
  $('.cr-body').innerHTML = tab.items.map((it) => {
    const v = app[it.key];
    let ctl = '';
    if (it.type === 'swatch') ctl = `<div class="sw-row">${it.options.map((c) => `<button class="sw ${c === 'none' ? 'none' : ''} ${c === 'original' ? 'orig' : ''} ${c === v ? 'on' : ''}" data-k="${it.key}" data-v="${c}" style="${c !== 'none' && c !== 'original' ? 'background:' + c : ''}" title="${c === 'none' ? 'Không' : c === 'original' ? 'Gốc' : c}">${c === 'original' ? 'Gốc' : ''}</button>`).join('')}</div>`;
    if (it.type === 'opts') ctl = `<div class="opt-row">${it.options.map((o) => `<button class="opt ${o.id === v ? 'on' : ''}" data-k="${it.key}" data-v='${JSON.stringify(o.id)}'>${o.name}</button>`).join('')}</div>`;
    if (it.type === 'cards') ctl = `<div class="cards">${it.options.map((o) => `<button class="card ${o.id === v ? 'on' : ''}" data-k="${it.key}" data-v='${JSON.stringify(o.id)}'>${o.name}<br><small class="badge ${o.style}">${D.STYLE_NAMES[o.style]}</small></button>`).join('')}</div>`;
    if (it.type === 'range') ctl = `<input type="range" min="${it.min}" max="${it.max}" step="${it.step}" value="${v}" data-k="${it.key}"><div style="font-size:12px;opacity:.7" id="rv-${it.key}">${it.fmt(v)}</div>`;
    return `<div class="cr-item"><div class="cr-label">${it.label}</div>${ctl}</div>`;
  }).join('');
  $('.cr-body').querySelectorAll('button[data-k]').forEach((b) => b.onclick = () => {
    const raw = b.dataset.v;
    let val; try { val = JSON.parse(raw); } catch (e) { val = raw; }
    const patch = { [b.dataset.k]: val };
    if (b.dataset.k === 'outfit') { const o = D.OUTFITS.find((x) => x.id === val); if (o && o.finish) patch.finish = o.finish; }
    setApp(patch); renderCreator();
  });
  $('.cr-body').querySelectorAll('input[type=range]').forEach((r) => r.oninput = () => {
    const it = tab.items.find((x) => x.key === r.dataset.k);
    setApp({ [r.dataset.k]: parseFloat(r.value) });
    $('#rv-' + it.key).textContent = it.fmt(parseFloat(r.value));
  });
}
document.querySelectorAll('.cr-view [data-view]').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
$('#btnRandom').addEventListener('click', () => {
  const p = (a) => a[Math.floor(Math.random() * a.length)];
  setApp({
    outfit: p(D.OUTFITS).id, outfitColor: p(D.OUTFIT_COLORS), shoes: p(D.SHOE_COLORS), hair: p(D.HAIR_STYLES).id, hairColor: p(D.HAIR_COLORS),
    eyeColor: p(D.EYE_COLORS), shadow: p(D.SHADOW_COLORS), liner: p(D.LINER).id, lashes: p(D.LASHES).id, brows: p(D.BROWS).id,
    lip: p(D.LIP_COLORS), blush: p(D.BLUSH_COLORS), gloss: Math.random() < 0.5, earrings: p(D.EARRINGS).id, clip: p(D.CLIPS).id, necklace: p(D.NECKLACES).id,
  });
  renderCreator();
});
function openCreator() {
  camMode = 'creator';
  me.busy = true;
  $('#creator').classList.add('show');
  $('#btnDone').textContent = joined ? 'Xong, quay lại làm 💃' : 'Vào ca làm 💃';
  if (!joined) { me.x = 0; me.z = 3; me.ry = Math.PI; }
  me.ry = Math.PI; // quay mặt về phía camera trong phòng thay đồ
  if (near && near.type === 'mirror') me.ry = -Math.PI / 2;
  renderCreator(); refreshStyleBadges();
  $('#hud').classList.add('hidden');
}
function closeCreator() {
  camMode = 'play';
  me.busy = false;
  $('#creator').classList.remove('show');
  $('#hud').classList.remove('hidden');
  camYaw = me.ry + Math.PI;
}
$('#btnDone').addEventListener('click', () => {
  closeCreator();
  if (!joined) join();
});

// ================= Đăng nhập =================
const socket = io();
let auth = store.get('ktv_auth', null); // { name, token }
let authMode = 'login';
function setAuthMode(m) {
  authMode = m;
  document.querySelectorAll('.auth-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.mode === m));
  $('#btnAuth').textContent = m === 'login' ? 'Đăng nhập' : 'Tạo nhân vật ✨';
  $('#pinHint').classList.toggle('hidden', m !== 'register');
  $('#authMsg').textContent = '';
}
document.querySelectorAll('.auth-tabs button').forEach((b) => b.addEventListener('click', () => setAuthMode(b.dataset.mode)));
function showAuth(msg = '') {
  $('#resumeBox').classList.add('hidden'); $('#authBox').classList.remove('hidden');
  if (auth && auth.name) $('#nameInput').value = auth.name;
  $('#authMsg').textContent = msg;
}
function showStart(msg = '') {
  $('#start').classList.add('show'); $('#hud').classList.add('hidden'); $('#creator').classList.remove('show');
  if (auth && auth.token && !msg) { $('#resumeBox').classList.remove('hidden'); $('#authBox').classList.add('hidden'); $('#resumeName').textContent = auth.name; }
  else showAuth(msg);
}
const emitP = (ev, data) => new Promise((res) => socket.timeout(15000).emit(ev, data, (err, r) => res(err ? { ok: false, error: 'Mất kết nối máy chủ, thử lại nha' } : r)));
function busy(on) { for (const id of ['#btnAuth', '#btnResume']) $(id).disabled = on; $('#loadMsg').textContent = on ? 'Đang kết nối quán... (lần đầu có thể mất 30-60 giây)' : ''; }

function afterLogin(r) {
  myName = r.name;
  if (r.token) { auth = { name: r.name, token: r.token }; store.set('ktv_auth', auth); }
  initMusic();
  $('#start').classList.remove('show');
  if (r.saveMode !== 'mongo') setTimeout(() => toast('⚠️ Máy chủ chưa nối database: tiền bo sẽ mất khi server khởi động lại'), 1500);
  if (r.app) {
    app = VALID_OUTFIT({ ...DEFAULT, ...r.app });
    me.char.update(app); store.set('ktv_app_khoi', app);
    join();
    setTimeout(() => toast(`Mừng <b>${escapeHtml(r.name)}</b> quay lại! Tiền bo đang có: <b>${D.fmtMoney(r.money || 0)}</b>`), 600);
  } else openCreator(); // nhân vật mới: vào tủ đồ trước
}
$('#btnAuth').addEventListener('click', async () => {
  const name = $('#nameInput').value.trim(), pin = $('#pinInput').value.trim();
  if (!name) return ($('#authMsg').textContent = 'Nhập tên nhân vật nha');
  if (!/^\d{4,6}$/.test(pin)) return ($('#authMsg').textContent = 'Mã PIN gồm 4-6 chữ số');
  busy(true);
  const r = await emitP(authMode === 'login' ? 'login' : 'register', { name, pin });
  busy(false);
  if (!r.ok) return ($('#authMsg').textContent = r.error || 'Có lỗi, thử lại nha');
  $('#pinInput').value = '';
  afterLogin(r);
});
for (const id of ['#nameInput', '#pinInput']) $(id).addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#btnAuth').click(); });
$('#btnResume').addEventListener('click', async () => {
  busy(true);
  const r = await emitP('resume', auth);
  busy(false);
  if (!r.ok) { setAuthMode('login'); return showAuth('Phiên đăng nhập đã hết, nhập lại mã PIN nha'); }
  afterLogin(r);
});
$('#btnSwitch').addEventListener('click', () => { setAuthMode('login'); showAuth(); $('#nameInput').value = ''; });
$('#btnLogout').addEventListener('click', () => {
  if (auth) socket.emit('logout', { token: auth.token });
  auth = null; store.set('ktv_auth', null);
  location.reload();
});
setAuthMode(auth ? 'login' : 'register');
showStart();

// ================= Networking =================
function join() {
  socket.emit('join', { app });
  drawNameLabel(myLabel, myName, 0, true);
}
socket.on('connect', async () => {
  if (!joined) return;
  const r = auth ? await emitP('resume', auth) : { ok: false };
  if (r.ok) join(); else { joined = false; showStart('Mất kết nối, đăng nhập lại nha'); }
});
socket.on('needLogin', () => { joined = false; showStart('Đăng nhập lại nha'); });
socket.on('kicked', (msg) => { joined = false; auth && store.set('ktv_auth', auth); showStart(msg); });
socket.on('init', (d) => {
  myId = d.you; joined = true;
  gameState = { fund: d.fund, upgrades: d.upgrades }; upgradeDefs = d.upgradeDefs;
  world.setVipOpen(!!gameState.upgrades.vip);
  for (const [id, p] of players) removePlayer(id);
  for (const p of Object.values(d.players)) if (p.id !== myId) addPlayer(p);
  myMoney = d.players[myId] ? d.players[myId].money : 0;
  syncCustomers(d.customers);
  refreshHUD(); refreshStyleBadges();
  $('#hud').classList.remove('hidden');
  loadTop();
  if (!d.players[myId] || !d.players[myId].money) toast(`Chào <b>${escapeHtml(myName)}</b>! Khách sắp tới, chuẩn bị nha 💃`);
});
function addPlayer(p) {
  if (players.has(p.id)) removePlayer(p.id);
  const char = createGirl({ ...DEFAULT, ...p.app });
  scene.add(char.group);
  const label = makeLabel(512, 96, 1);
  drawNameLabel(label, p.name, p.money, false);
  scene.add(label.sprite);
  players.set(p.id, { char, label, name: p.name, money: p.money, x: p.x, z: p.z, ry: p.ry, tx: p.x, tz: p.z, tr: p.ry, anim: 'idle', holding: null, app: p.app, moving: 0 });
}
function removePlayer(id) {
  const p = players.get(id); if (!p) return;
  scene.remove(p.char.group); scene.remove(p.label.sprite);
  players.delete(id);
}
socket.on('playerJoined', (p) => { addPlayer(p); refreshHUD(); });
socket.on('playerLeft', ({ id }) => { removePlayer(id); refreshHUD(); });
socket.on('appearance', ({ id, app: a }) => { const p = players.get(id); if (p) { p.app = a; p.char.update({ ...DEFAULT, ...a }); } });
socket.on('players', (all) => {
  let changed = false;
  for (const [id, v] of Object.entries(all)) {
    if (id === myId) { if (v[5] !== myMoney) { myMoney = v[5]; changed = true; } continue; }
    const p = players.get(id); if (!p) continue;
    p.tx = v[0]; p.tz = v[1]; p.tr = v[2]; p.anim = v[3]; p.holding = v[4];
    if (p.money !== v[5]) { p.money = v[5]; changed = true; }
  }
  if (changed) refreshHUD();
});
socket.on('customers', (list) => syncCustomers(list));
socket.on('customerLeft', ({ id, happy }) => {
  const e = customers.get(id);
  if (e && e.data.servedBy === myId && !happy) { toast('Khách bỏ về rồi 😢'); sfx('bad'); }
  removeCustomerObj(id);
});
socket.on('state', (s) => {
  const vipBefore = gameState.upgrades.vip;
  gameState = s;
  world.setVipOpen(!!s.upgrades.vip);
  if (!vipBefore && s.upgrades.vip) toast('🎉 Phòng VIP đã mở! Khách sộp đang tới!');
  refreshHUD();
  if ($('#shop').classList.contains('show')) refreshShop();
});
socket.on('tip', (t) => {
  if (t.pid === myId) {
    myMoney += 0; // tiền thật cập nhật qua 'players'
    const extra = t.final ? (t.liked === true ? '<small>Đúng gu khách, bo gấp rưỡi! 😍</small>' : t.liked === false ? '<small>Lần sau mặc đúng gu sẽ được bo nhiều hơn</small>' : '<small>Khách keo nhưng vẫn bo 😂</small>') : '<small>Bo nóng! 🔥</small>';
    floater(`+${D.fmtMoney(t.amount)} 💸${extra}`);
    sfx('tip');
  }
  if (t.final) feed(`${t.name} được ${t.cname} bo ${D.fmtMoney(t.amount)} 💸`);
});
socket.on('feed', (text) => feed(text));
socket.on('chat', ({ id, name, text }) => {
  const d = document.createElement('div'); d.innerHTML = `<b>${escapeHtml(name)}:</b> ${escapeHtml(text)}`;
  $('#chatlog').appendChild(d);
  while ($('#chatlog').children.length > 6) $('#chatlog').firstChild.remove();
  showBubble(id, text);
});

let lastSend = 0;
function sendMove(t) {
  if (!joined || t - lastSend < 0.066) return;
  lastSend = t;
  socket.emit('move', { x: +me.x.toFixed(2), z: +me.z.toFixed(2), ry: +me.ry.toFixed(2), anim: me.anim, holding: me.holding });
}

// ================= Main loop =================
const clock = new THREE.Clock();
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, clock.getDelta());
  const t = clock.elapsedTime;
  updateMe(dt, t);
  for (const p of players.values()) {
    const ox = p.x, oz = p.z;
    p.x += (p.tx - p.x) * Math.min(1, dt * 10);
    p.z += (p.tz - p.z) * Math.min(1, dt * 10);
    let d = p.tr - p.ry; d = Math.atan2(Math.sin(d), Math.cos(d)); p.ry += d * Math.min(1, dt * 10);
    const moving = Math.hypot(p.x - ox, p.z - oz) > 0.002 ? 1 : 0;
    p.char.group.position.set(p.x, 0, p.z); p.char.group.rotation.y = p.ry;
    p.char.animate(p.anim === 'walk' && !moving ? 'idle' : p.anim, t, moving || (p.anim === 'walk' ? 1 : 0), !!p.holding);
    p.char.setHolding(p.holding);
    p.label.sprite.position.set(p.x, ((p.char.topY || 1.6) + 0.2) * ((p.app && p.app.height) || 1), p.z);
  }
  for (const e of customers.values()) {
    e.obj.animate(t, e.data, e.off);
    // làm mới câu thoại khi hết 4 giây
    if (e.data.line && Date.now() - e.data.lineAt > 4000 && e.key.indexOf('"stale"') < 0) { drawCustomerLabel(e.label, e.data); e.key += '"stale"'; }
  }
  const nowMs = performance.now();
  for (const [id, b] of bubbles) {
    const src = id === myId ? me : players.get(id);
    if (!src || nowMs > b.until) { scene.remove(b.sprite); bubbles.delete(id); continue; }
    b.sprite.position.set(src.x, 2.3, src.z);
  }
  myLabel.sprite.visible = camMode === 'play';
  world.update(t, gameState.upgrades);
  updateCamera(dt);
  updatePrompt();
  setZone(zoneAt(me.x, me.z));
  sendMove(t);
  renderer.render(scene, camera);
}
camera.position.set(0, 3, 8);
camYaw = 0;
loop();
refreshStyleBadges();

// cho phép chạy thử tự động
window.__ktv = { runMinigame, me, customers, players, socket, interact, setApp, openCreator, closeCreator, get app() { return app; }, scene, camera, renderer };
