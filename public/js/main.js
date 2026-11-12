import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildHome, HOME, HOME_SPAWN, HOME_DOOR, SLOT_NAMES } from './home.js';
import { createModelGirl, loadManifest, models as girlModels, modelInfo, preload as preloadModel, setForce3D, forced3D, effectiveModel } from './girl3d.js';
import { createGirl, createCustomer, createNPC, createSlipper, makeLabel, roundRect } from './character.js';
import { buildWorld, seatTransform, BAR, MIRROR, ROOM_DEFS, POLES, EXIT, BREAKER, SHOPSPOT } from './world.js';
import { runMinigame, isMinigameOpen, getLastScore, setMgFeatures } from './minigames.js';
import * as D from './data.js';
import { initMusic, setZone, toggleMusic, musicOn, audioOut, recordAudioTrack } from './music.js';

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
renderer.toneMappingExposure = 0.95;
$('#game').appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#120818');
scene.fog = new THREE.Fog('#120818', 28, 60);
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.03, 200);
// môi trường phản chiếu để kim loại, đá bóng, nhung trông sang hơn
{ const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose(); }
const hemi = new THREE.HemisphereLight('#ffd6f0', '#2a1040', 1.1); scene.add(hemi);
// đèn chiếu mặt: ánh trắng ấm đi theo camera, để da và mặt nhân vật không bị đèn neon nhuộm tím xanh
const faceLight = new THREE.DirectionalLight('#fff1e6', 0.8); scene.add(faceLight); scene.add(faceLight.target);
const amb = new THREE.AmbientLight('#ffffff', 0.35); scene.add(amb);
const sun = new THREE.DirectionalLight('#fff0f6', 1.0); sun.position.set(5, 10, 8); scene.add(sun);
// màn hình dọc (điện thoại): mở rộng góc nhìn + lùi camera xa hơn, nhìn chéo từ trên cao để thấy được như máy tính
let portrait = false, camMul = 1;
const playFov = () => (camMode === 'creator' ? 55 : portrait ? 68 : innerWidth / innerHeight < 1.3 ? 60 : 55);
function fitView() {
  renderer.setSize(innerWidth, innerHeight);
  if (composer) { composer.setSize(innerWidth, innerHeight); bloom.resolution.set(innerWidth / 2, innerHeight / 2); }
  const asp = innerWidth / innerHeight;
  portrait = asp < 0.9;
  camera.aspect = asp;
  camera.fov = playFov();
  camMul = portrait ? 1.55 : 1;
  camera.updateProjectionMatrix();
}
addEventListener('resize', fitView);

const world = buildWorld(scene, { lite: matchMedia('(max-width: 800px), (pointer: coarse)').matches });
const isMobile = matchMedia('(max-width: 800px), (pointer: coarse)').matches;
// hiệu ứng tỏa sáng cho đèn neon (chỉ trên máy tính cho nhẹ điện thoại)
let composer = null, bloom = null;
if (!isMobile && !/[?&]nobloom/.test(location.search)) {
  // khử răng cưa cho viền tóc/vai khi bật hiệu ứng tỏa sáng (nếu không, viền nhân vật bị lởm chởm)
  composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(innerWidth * renderer.getPixelRatio(), innerHeight * renderer.getPixelRatio(), { samples: 4, type: THREE.HalfFloatType }));
  composer.addPass(new RenderPass(scene, camera));
  bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.2, 0.35, 0.98);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
}

// ================= State =================
const DEFAULT = { ...D.DEFAULT_APP };
const VALID_OUTFIT = (a) => (D.OUTFITS.some((o) => o.id === a.outfit) ? a : { ...a, outfit: DEFAULT.outfit });
let app = VALID_OUTFIT({ ...DEFAULT, ...store.get('ktv_app_khoi', {}), uniform: false });
let myName = store.get('ktv_name', '');
let myId = null, joined = false, myMoney = 0;
let gameState = { fund: 0, upgrades: {} };
let upgradeDefs = {};
let FEAT = {};
let shopDefs = [], levelDefs = [], owned = [], myEarned = 0, myLevel = 0, quests = [], shiftEnd = 0, timeOffset = 0;
const levelsById = new Map();
const serverNow = () => Date.now() + timeOffset;
const players = new Map();   // id -> remote
const customers = new Map(); // id -> {data, obj, label, key}

// báo lỗi: hiện dòng đỏ nhỏ trên màn hình + gửi về server (xem trong Logs của Render) để dễ sửa
const errSeen = new Set();
function reportErr(e) {
  const msg = String((e && (e.stack || e.message)) || e).split('\n').slice(0, 3).join(' | ').slice(0, 300);
  if (errSeen.has(msg)) return; errSeen.add(msg);
  try { socket.emit('clientError', msg); } catch (x) {}
  let box = document.getElementById('errBox');
  if (!box) { box = document.createElement('div'); box.id = 'errBox'; box.style.cssText = 'position:fixed;left:8px;bottom:60px;z-index:99;max-width:60vw;background:rgba(160,0,0,.85);color:#fff;font:11px monospace;padding:6px 8px;border-radius:8px;pointer-events:none'; document.body.appendChild(box); }
  box.textContent = '⚠️ Lỗi: ' + msg;
}
addEventListener('error', (ev) => reportErr(ev.error || ev.message));
addEventListener('unhandledrejection', (ev) => reportErr(ev.reason));
const makeGirl = (a) => createModelGirl(a, createGirl(a));
const home = buildHome(scene, world.colliders);
// danh sách nhân vật 3D (Tripo) — tải xong thì cập nhật lại người đang dùng model
function refresh3D() {
  setForce3D(!!FEAT.only3D);
  me.char.update(app); for (const p of players.values()) p.char.update({ ...DEFAULT, ...p.app });
  refreshStyleBadges();
  if ($('#creator').classList.contains('show')) renderCreator();
}
loadManifest().then(refresh3D);
const me = { char: makeGirl(app), x: 0, z: 3, ry: Math.PI, anim: 'idle', holding: null, emoteUntil: 0, emote: null, busy: false };
scene.add(me.char.group);
const myLabel = makeLabel(512, 96, 1);
scene.add(myLabel.sprite);

// ================= Camera =================
let camYaw = 0, camPitch = 0.55, camDist = 4.4, camSnap = false;
let camMode = 'play'; // play | creator
fitView();
if (isMobile) document.getElementById('chatInput').placeholder = '💬 Chat...';
let creatorView = 'full';
const camTarget = new THREE.Vector3();
function updateCamera(dt) {
  const h = app.height || 1;
  const fv = playFov(); if (camera.fov !== fv) { camera.fov = fv; camera.updateProjectionMatrix(); }
  let pos, target;
  if (cine && camMode === 'play') {
    // quay vòng quanh nhân vật, từ toàn thân lại gần mặt
    const k = Math.min(1, (clock.elapsedTime - cine.t0) / cine.dur);
    const ease = 1 - Math.pow(1 - k, 3);
    const ang = me.ry + Math.PI * 1.15 - ease * Math.PI * 1.15;
    const dist = 6.5 - ease * 4.1, hy = (app.height || 1);
    camera.position.set(me.x + Math.sin(ang) * dist, (3.6 - ease * 2.2) * hy, me.z + Math.cos(ang) * dist);
    camera.lookAt(me.x, (0.9 + ease * 0.45) * hy, me.z);
    return;
  }
  if (window.__camOverride) { const o = window.__camOverride; camera.position.set(...o.p); camera.lookAt(...o.t); return; } // chỉ dùng khi chụp thử
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
  } else if (ghenCamOn()) {
    // nhìn ngang hông cặp vợ chồng, đứng phía không có mình để mình không che
    const w = ghenFx.npc.group.position;
    const ce = customers.get(ghenFx.ev.cid);
    const hu = ce ? ce.obj.group.position : w;
    const mx = (w.x + hu.x) / 2, mz = (w.z + hu.z) / 2;
    let ax = hu.x - w.x, az = hu.z - w.z, L = Math.hypot(ax, az);
    if (L < 0.2) { ax = 1; az = 0; L = 1; }
    let px = -az / L, pz = ax / L;
    if (px * (me.x - mx) + pz * (me.z - mz) > 0) { px = -px; pz = -pz; }
    target = new THREE.Vector3(mx, 1.0, mz);
    pos = new THREE.Vector3(mx + px * 3.4 * camMul, portrait ? 3.6 : 2.3, mz + pz * 3.4 * camMul);
  } else {
    const cd = camDist * camMul, cp = portrait ? Math.min(1.25, camPitch + 0.3) : camPitch;
    target = new THREE.Vector3(me.x, portrait ? 0.9 : 1.2, me.z);
    pos = new THREE.Vector3(
      me.x + Math.sin(camYaw) * Math.cos(cp) * cd,
      target.y + Math.sin(cp) * cd,
      me.z + Math.cos(camYaw) * Math.cos(cp) * cd
    );
  }
  if (camMode !== 'creator') {
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
  const k = camSnap ? 1 : Math.min(1, dt * 8); camSnap = false;
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
  if (e.code === 'Digit4') quickChange();
  if (e.code === 'KeyP') takeShot();
  if (e.code === 'KeyV') { if (rec) stopRec(); else openRecMenu(); }
  if (e.code === 'KeyH') toggleClean();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());

// kéo để xoay camera
let drag = null;
renderer.domElement.addEventListener('pointerdown', (e) => { drag = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), moved: 0 }; });
addEventListener('pointermove', (e) => {
  if (!drag || drag.id !== e.pointerId || camMode !== 'play') return;
  drag.moved += Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y);
  camYaw -= (e.clientX - drag.x) * 0.006;
  camPitch = Math.max(0.12, Math.min(1.25, camPitch + (e.clientY - drag.y) * 0.004));
  drag.x = e.clientX; drag.y = e.clientY;
});
addEventListener('pointerup', (e) => {
  if (!drag || drag.id !== e.pointerId) return;
  const tap = drag.moved < 12 && performance.now() - drag.t < 600;
  drag = null;
  if (tap && e.target === renderer.domElement) clickTo(e.clientX, e.clientY);
});
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
  const stunned = me.stunUntil > t;
  if (!me.busy && camMode === 'play' && !stunned) {
    if (keys.has('KeyW') || keys.has('ArrowUp')) f += 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) f -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) r += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) r -= 1;
    f -= joy.y; r += joy.x;
    if (f || r) cancelGoto();
  }
  const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw);
  const rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
  let mx = fx * f + rx * r, mz = fz * f + rz * r;
  if (!f && !r && !stunned && !me.busy && camMode === 'play') { const g = gotoStep(dt); if (g) { mx = g.x; mz = g.z; } }
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
  if (stunned) anim = 'stun';
  if (me.qchangeUntil > t) anim = 'qchange';
  if (cine && !(me.qchangeUntil > t)) anim = t - cine.t0 > 2.2 ? 'wave' : 'dance';
  me.anim = anim;
  me.char.group.position.set(me.x, 0, me.z);
  me.char.group.rotation.y = me.ry;
  try { me.char.animate(anim, t, moving, !!me.holding); me.char.setHolding(me.holding); } catch (e) { reportErr(e); }
  myLabel.sprite.position.set(me.x, ((me.char.topY || 1.6) + 0.2) * (app.height || 1), me.z);
  myLabel.sprite.visible = !cine;
}
function emote(e) { me.emote = e; me.emoteUntil = clock.elapsedTime + (e === 'wave' ? 2 : 4); }
document.querySelectorAll('.emotes button').forEach((b) => b.addEventListener('click', () => {
  if (b.dataset.emote === 'sing' && joined && FEAT.duet) {
    let best = null, bd = 3;
    for (const [id, p] of players) { const d = Math.hypot(p.x - me.x, p.z - me.z); if (d < bd) { bd = d; best = id; } }
    if (best) { socket.emit('duetInvite', { to: best }); emote('sing'); return; }
  }
  emote(b.dataset.emote);
}));

// ================= Labels =================
function drawNameLabel(lbl, name, money, isMe, level = 0) {
  const { ctx, w, h } = lbl;
  ctx.clearRect(0, 0, w, h);
  ctx.font = 'bold 44px "Be Vietnam Pro", sans-serif';
  const L = levelDefs[level];
  const text = (L ? L.icon + ' ' : '') + name;
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
  const stTxt = { flee: '🏃 QUỴT TIỀN! Đuổi theo nhấn E!', ghen: '😱 Vợ tới!!!', drag: '🩴 Bị vợ nhéo tai lôi về', caught: '🫵 Bị tóm rồi!' }[c.st];
  const reqTxt = stTxt || (c.crying ? '😭 Đang khóc... cần an ủi' : `${D.REQ_ICON[c.request.kind] || ''} ${(D.REQ_TEXT[c.request.kind] || (() => ''))(c.request.data)}`);
  if (stTxt) ctx.fillStyle = '#ff8a80';
  ctx.fillText(fresh && !stTxt ? `“${c.line}”` : reqTxt, 24, 86);
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
      const obj = createCustomer(c.type, c.variant || 0);
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
    const key = JSON.stringify([c.mood, c.servedBy, c.request, c.patience, c.line, c.done, c.drunk, c.st, c.crying]);
    if (key !== e.key) { drawCustomerLabel(e.label, c); e.key = key; }
  }
  for (const [id, e] of customers) if (!seen.has(id)) removeCustomerObj(id);
}
function routePos(pts, d) {
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (d <= seg) { const t = seg ? d / seg : 0; return { x: pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, z: pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t, dx: pts[i][0] - pts[i - 1][0], dz: pts[i][1] - pts[i - 1][1], end: false }; }
    d -= seg;
  }
  const a = pts[pts.length - 2], b = pts[pts.length - 1];
  return { x: b[0], z: b[1], dx: b[0] - a[0], dz: b[1] - a[1], end: true };
}
// cập nhật vị trí khách mỗi khung hình
function placeCustomer(e) {
  const c = e.data, g = e.obj.group;
  const mv = c.st === 'flee' ? c.flee : c.st === 'drag' ? c.drag : null;
  if (mv) {
    const p = routePos(mv.pts, Math.max(0, (serverNow() - mv.t0) / 1000) * mv.speed);
    g.position.set(p.x, 0, p.z); g.rotation.y = Math.atan2(p.dx, p.dz);
    c._walking = !p.end;
  } else if (c.st === 'caught') { c._walking = false; }
  else { const st = seatTransform(c.roomId, c.seat); g.position.set(st.x, 0.08, st.z); g.rotation.y = st.ry; c._walking = false; }
  e.label.sprite.position.set(g.position.x, 1.95 + (c.st !== 'seat' && c.st !== 'ghen' ? 0.35 : 0), g.position.z);
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
  for (const e of customers.values()) if (e.data.st === 'flee' && Math.hypot(e.obj.group.position.x - me.x, e.obj.group.position.z - me.z) < 2.2) return { type: 'flee', e };
  if (darkOn && Math.hypot(BREAKER.x - me.x, BREAKER.z - me.z) < 2.5) return { type: 'breaker' };
  if (FEAT.shop && Math.hypot(SHOPSPOT.x - me.x, SHOPSPOT.z - me.z) < 2) return { type: 'shop' };
  for (const pl of POLES) if (Math.hypot(pl.x - me.x, pl.z - me.z) < 1.3) return { type: 'pole', pole: pl };
  let best = null, bd = 3.1;
  for (const e of customers.values()) {
    if (e.data.st !== 'seat') continue;
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
  else if (near.type === 'flee') txt = `🫵 Nhấn <b>${key}</b> để NẮM ÁO khách quỵt tiền!`;
  else if (near.type === 'breaker') txt = `⚡ Nhấn <b>${key}</b> để bật lại cầu dao!`;
  else if (near.type === 'shop') txt = `Nhấn <b>${key}</b> để vào Shop thời trang 🛍`;
  else if (near.type === 'mirror') txt = `Nhấn <b>${key}</b> để thay đồ & makeup 💄`;
  else if (near.type === 'pole') {
    const c = poleCustomer();
    txt = c ? `Nhấn <b>${key}</b> để múa cột cho <b>${D.CUSTOMER_TYPES[c.type].name}</b> ✨` : `Nhấn <b>${key}</b> để múa cột ✨`;
  } else {
    const c = near.e.data, info = D.CUSTOMER_TYPES[c.type];
    if (c.servedBy && c.servedBy !== myId) txt = `${info.name} đang được <b>${c.servedName}</b> phục vụ`;
    else {
      const k = c.request.kind;
      const fetch = k === 'fruit' || k === 'water';
      const likes = info.likes === 'any' ? 'gì cũng được (miễn rẻ 😂)' : D.STYLE_NAMES[info.likes];
      if (k === 'pole') txt = `${info.name}: ${D.REQ_TEXT[k]()} → ra <b>cột inox</b> trong phòng rồi nhấn ${key} ✨`;
      else if (fetch && me.holding !== k) txt = `${info.name}: ${D.REQ_TEXT[k]()} → ra <b>Quầy bar</b> lấy ${D.REQ_ICON[k]}`;
      else txt = `Nhấn <b>${key}</b> để ${D.REQ_ICON[k]} ${fetch ? 'đưa đồ cho khách' : D.REQ_TEXT[k](c.request.data).toLowerCase()}<br><small>Gu khách: ${likes}</small>`;
    }
  }
  p.innerHTML = txt;
  p.classList.remove('hidden');
}

async function interact(force) {
  if (!joined || me.busy || isMinigameOpen() || camMode !== 'play') return;
  near = force || findNear();
  if (!near) return;
  if (near.type === 'bar') { openModal('#barMenu'); return; }
  if (near.type === 'flee') { socket.emit('catch', { cid: near.e.data.id }); return; }
  if (near.type === 'breaker') { socket.emit('breaker'); return; }
  if (near.type === 'shop') { openStore(); return; }
  if (near.type === 'mirror') { openCreator(); return; }
  if (near.type === 'pole') { poleDance(near.pole); return; }
  const c = near.e.data;
  const info = D.CUSTOMER_TYPES[c.type];
  if (c.servedBy && c.servedBy !== myId) { toast(`Khách đang được ${c.servedName} phục vụ rồi`); return; }
  if (!c.servedBy) { socket.emit('serve', { cid: c.id }); c.servedBy = myId; }
  const k = c.request.kind;
  // mặt hướng về khách
  const st = seatTransform(c.roomId, c.seat);
  me.ry = Math.atan2(st.x - me.x, st.z - me.z);
  if (k === 'pole') { toast(`Ra <b>cột inox</b> có bục đèn trong phòng rồi nhấn ${isMobile ? 'nút tròn' : 'E'} để múa cho khách xem ✨`); return; }
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
  socket.emit('resolve', { cid: c.id, kind: k, quality: q, score: getLastScore() });
  sfx(q >= 0.5 ? 'good' : 'bad');
}
// khách mình đang phục vụ (hoặc chưa ai phục vụ) đang đòi múa cột
function poleCustomer() {
  let best = null;
  for (const e of customers.values()) {
    const c = e.data;
    if (c.request.kind !== 'pole' || (c.servedBy && c.servedBy !== myId)) continue;
    if (!best || c.servedBy === myId) best = c;
  }
  return best;
}
async function poleDance(pl) {
  me.x = pl.x; me.z = pl.z;
  me.emote = 'pole'; me.emoteUntil = 1e9;
  const c = poleCustomer();
  if (!c) { toast('Đi chỗ khác là dừng múa nha ✨'); return; } // múa cho vui tới khi di chuyển
  if (!c.servedBy) { socket.emit('serve', { cid: c.id }); c.servedBy = myId; }
  me.busy = true;
  const q = await runMinigame('pole', { type: c.type, cname: D.CUSTOMER_TYPES[c.type].name, data: {} });
  me.busy = false;
  me.emoteUntil = clock.elapsedTime + 3;
  socket.emit('resolve', { cid: c.id, kind: 'pole', quality: q });
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
    const out = audioOut(); // dùng chung bộ âm thanh với nhạc để video quay có tiếng
    actx = out ? out.ctx : (actx || new (window.AudioContext || window.webkitAudioContext)());
    const dest = out ? out.node : actx.destination;
    const notes = { good: [660, 880], bad: [300, 220], tip: [784, 988, 1319], coin: [1319, 1568], ghen: [880, 660, 440, 330], bop: [180, 90], siren: [700, 950, 700, 950, 700, 950], level: [523, 659, 784, 1047, 1319], alarm: [988, 784, 988, 784] }[kind] || [440];
    notes.forEach((f, i) => {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = kind === 'bad' || kind === 'ghen' || kind === 'bop' ? 'sawtooth' : kind === 'siren' ? 'square' : 'triangle'; o.frequency.value = f;
      const t0 = actx.currentTime + i * (kind === 'siren' ? 0.35 : 0.09);
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.18, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
      o.connect(g).connect(dest); o.start(t0); o.stop(t0 + 0.25);
    });
  } catch (e) {}
}

// ================= HUD =================
function styleOf(a) { const m = modelInfo(effectiveModel(a)); if (m && m.style) return m.style; return (D.OUTFITS.find((o) => o.id === a.outfit) || D.OUTFITS[0]).style; }
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
  { tab: '✨ Nhân vật 3D', model: true, items: [
    { key: 'model', label: 'Chọn kiểu nhân vật', type: 'cards', options: [] },
  ] },
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
    { key: 'face', label: 'Kiểu mặt', type: 'opts', options: D.FACE_STYLES },
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
    { key: 'bag', label: 'Túi xách', type: 'opts', options: D.BAGS },
  ] },
];
const lockOf = (key, val) => shopDefs.find((it) => it.key === key && it.value === val && !owned.includes(it.id));
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
  const only3D = forced3D();
  const tabOk = (t) => !only3D || t.model || t.tab === 'Dáng người';
  if (!tabOk(CREATOR[crTab])) crTab = 0;
  $('.cr-tabs').innerHTML = CREATOR.map((t, i) => tabOk(t) ? `<button class="${i === crTab ? 'on' : ''}" data-tab="${i}">${t.tab}</button>` : '').join('');
  $('.cr-tabs').querySelectorAll('button').forEach((b) => b.onclick = () => {
    crTab = +b.dataset.tab; setView(CREATOR[crTab].face ? 'face' : 'full'); renderCreator();
  });
  const tab = CREATOR[crTab];
  if (tab.model) tab.items[0].options = [...(only3D ? [] : [{ id: 'none', name: '🧱 Người khối (tự makeup, thay đồ)', style: D.OUTFITS.find((o) => o.id === app.outfit)?.style || 'goicam' }]), ...girlModels().map((m) => ({ id: m.id, name: '✨ ' + m.name, style: m.style }))];
  if (tab.model && only3D && !modelInfo(app.model)) app = { ...app, model: effectiveModel(app) };
  const note = !only3D && app.model && app.model !== 'none' && !tab.model ? '<div class="howto" style="margin:0 0 8px">Đang dùng nhân vật 3D nên phần này chỉ áp dụng cho người khối. Muốn tự makeup, vào tab ✨ chọn "Người khối".</div>' : '';
  $('.cr-body').innerHTML = note + tab.items.map((it) => {
    const v = app[it.key];
    let ctl = '';
    const lk = (val) => lockOf(it.key, val);
    const price = (val) => (lk(val) ? `<span class="price-tag">${D.fmtMoney(lk(val).price)}</span>` : '');
    if (it.type === 'swatch') ctl = `<div class="sw-row">${it.options.map((c) => `<button class="sw ${c === 'none' ? 'none' : ''} ${c === 'original' ? 'orig' : ''} ${c === v ? 'on' : ''} ${lk(c) ? 'locked' : ''}" data-k="${it.key}" data-v="${c}" style="${c !== 'none' && c !== 'original' ? 'background:' + c : ''}" title="${lk(c) ? lk(c).name + ' - ' + D.fmtMoney(lk(c).price) : c === 'none' ? 'Không' : c}">${c === 'original' ? 'Gốc' : ''}</button>`).join('')}</div>`;
    if (it.type === 'opts') ctl = `<div class="opt-row">${it.options.map((o) => `<button class="opt ${o.id === v ? 'on' : ''} ${lk(o.id) ? 'locked' : ''}" data-k="${it.key}" data-v='${JSON.stringify(o.id)}'>${o.name}${price(o.id)}</button>`).join('')}</div>`;
    if (it.type === 'cards') ctl = `<div class="cards">${it.options.map((o) => `<button class="card ${o.id === v ? 'on' : ''} ${lk(o.id) ? 'locked' : ''}" data-k="${it.key}" data-v='${JSON.stringify(o.id)}'>${o.name}${price(o.id)}<br><small class="badge ${o.style}">${D.STYLE_NAMES[o.style]}</small></button>`).join('')}</div>`;
    if (it.type === 'range') ctl = `<input type="range" min="${it.min}" max="${it.max}" step="${it.step}" value="${v}" data-k="${it.key}"><div style="font-size:12px;opacity:.7" id="rv-${it.key}">${it.fmt(v)}</div>`;
    return `<div class="cr-item"><div class="cr-label">${it.label}</div>${ctl}</div>`;
  }).join('');
  $('.cr-body').querySelectorAll('button[data-k]').forEach((b) => b.onclick = () => {
    const raw = b.dataset.v;
    let val; try { val = JSON.parse(raw); } catch (e) { val = raw; }
    const locked = lockOf(b.dataset.k, val);
    if (locked) { openStore(locked.id); return; }
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
  const pa = (key, arr, f = (x) => x) => { const ok = arr.map(f).filter((v) => !lockOf(key, v)); return ok[Math.floor(Math.random() * ok.length)]; };
  setApp({
    outfit: pa('outfit', D.OUTFITS, (o) => o.id), outfitColor: p(D.OUTFIT_COLORS), shoes: p(D.SHOE_COLORS), hair: p(D.HAIR_STYLES).id, hairColor: p(D.HAIR_COLORS),
    eyeColor: p(D.EYE_COLORS), shadow: pa('shadow', D.SHADOW_COLORS), liner: p(D.LINER).id, lashes: pa('lashes', D.LASHES, (o) => o.id), brows: p(D.BROWS).id,
    face: p(D.FACE_STYLES).id, lip: pa('lip', D.LIP_COLORS), blush: p(D.BLUSH_COLORS), gloss: Math.random() < 0.5, earrings: pa('earrings', D.EARRINGS, (o) => o.id), clip: pa('clip', D.CLIPS, (o) => o.id), necklace: pa('necklace', D.NECKLACES, (o) => o.id),
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
  if (r.features) { FEAT = r.features; refresh3D(); }
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
  timeOffset = d.now - Date.now();
  FEAT = d.features || {}; applyFeatures(); refresh3D();
  decorDefs = d.decor || {}; homeStyles = d.homeStyles || { wall: {}, floor: {} }; homeSlots = d.homeSlots || {}; myHome = d.myHome || null;
  shopDefs = d.shop || []; levelDefs = d.levels || []; owned = d.owned || []; myEarned = d.earned || 0; quests = d.quests || []; shiftEnd = d.shiftEnd || 0;
  myLevel = d.players[myId] ? d.players[myId].level : 0;
  if (d.app) { app = { ...app, ...d.app, uniform: false }; me.char.update(app); store.set('ktv_app_khoi', app); }
  drawNameLabel(myLabel, myName, 0, true, myLevel); refreshLevel();
  if (d.ghen) startGhenFx(d.ghen);
  if (d.blackout) setDark(true);
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
  const char = makeGirl({ ...DEFAULT, ...p.app });
  scene.add(char.group);
  const label = makeLabel(512, 96, 1);
  levelsById.set(p.id, p.level || 0);
  drawNameLabel(label, p.name, p.money, false, p.level || 0);
  scene.add(label.sprite);
  players.set(p.id, { space: p.space || '', char, label, name: p.name, money: p.money, x: p.x, z: p.z, ry: p.ry, tx: p.x, tz: p.z, tr: p.ry, anim: 'idle', holding: null, app: p.app, moving: 0 });
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
    p.tx = v[0]; p.tz = v[1]; p.tr = v[2]; p.anim = v[3]; p.holding = v[4]; if (v[6] !== undefined && v[6] !== p.space) { p.space = v[6]; p.x = p.tx; p.z = p.tz; }
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
    if (t.caught) { floater(`+${D.fmtMoney(t.amount)} 🫵<small>Tóm được khách quỵt tiền, trả gấp đôi!</small>`); sfx('tip'); return; }
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


// =====================================================================
// TÍNH NĂNG MỚI: shop, cấp bậc, nhiệm vụ, tặng quà, sự kiện, song ca
// =====================================================================
function applyFeatures() {
  const show = (sel, on) => { const el = $(sel); if (el) el.classList.toggle('hidden', !on); };
  show('#btnStore', FEAT.shop); show('#btnQuest', FEAT.quests || FEAT.levels); show('#btnGift', FEAT.gift);
  show('#myLevel', FEAT.levels); show('#shiftTimer', FEAT.shift);
  document.querySelectorAll('[data-feat]').forEach((li) => li.classList.toggle('hidden', !li.dataset.feat.split(',').some((f) => FEAT[f])));
  setMgFeatures(FEAT);
}
function refreshLevel() {
  let lv = 0; levelDefs.forEach((L, i) => { if (myEarned >= L.min) lv = i; });
  if (levelDefs.length && lv !== myLevel) { myLevel = lv; drawNameLabel(myLabel, myName, 0, true, myLevel); }
  const L = levelDefs[myLevel];
  if (L) $('#myLevel').textContent = `${L.icon} ${L.name}`;
}
// ---------- Shop ----------
let storeHL = null;
function openStore(hl = null) {
  storeHL = hl;
  if ($('#creator').classList.contains('show')) closeCreator();
  renderStore(); openModal('#storeModal');
  if (hl) setTimeout(() => { const el = document.querySelector(`[data-item="${hl}"]`); el && el.scrollIntoView({ block: 'center' }); }, 50);
}
function renderStore() {
  $('#storeMoney').innerHTML = `Tiền bo của bạn: <b style="color:#ffd54f">${D.fmtMoney(myMoney)}</b> · Cấp: <b>${levelDefs[myLevel] ? levelDefs[myLevel].icon + ' ' + levelDefs[myLevel].name : ''}</b>`;
  const cats = [...new Set(shopDefs.map((it) => it.cat))];
  $('#storeList').innerHTML = cats.map((cat) => `<div class="store-cat">${cat}</div>` + shopDefs.filter((it) => it.cat === cat).map((it) => {
    const has = owned.includes(it.id), needLv = (it.level || 0) > myLevel;
    const btn = has ? `<button class="btn" data-wear="${it.id}">Dùng ngay</button>` : needLv ? `<button class="btn" disabled>🔒 Cần ${levelDefs[it.level].icon} ${levelDefs[it.level].name}</button>` : `<button class="btn primary" data-buy-item="${it.id}" ${myMoney < it.price ? 'disabled' : ''}>Mua ${D.fmtMoney(it.price)}</button>`;
    return `<div class="store-item ${storeHL === it.id ? 'hl' : ''}" data-item="${it.id}"><div><b>${it.name}</b>${it.bonus ? `<small class="bonus">✨ ${it.desc}</small>` : ''}${has ? '<small>✓ Đã có</small>' : ''}</div>${btn}</div>`;
  }).join('')).join('');
  document.querySelectorAll('[data-buy-item]').forEach((b) => b.onclick = async () => {
    b.disabled = true;
    const r = await emitP('buyItem', { id: b.dataset.buyItem });
    if (!r.ok) { toast(r.error); renderStore(); return; }
    owned = r.owned; myMoney = r.money; refreshHUD(); sfx('coin');
    const it = shopDefs.find((x) => x.id === b.dataset.buyItem);
    toast(`🛍 Đã mua <b>${it.name}</b>! Mặc luôn nè`);
    setApp({ [it.key]: it.value });
    renderStore();
  });
  document.querySelectorAll('[data-wear]').forEach((b) => b.onclick = () => { const it = shopDefs.find((x) => x.id === b.dataset.wear); setApp({ [it.key]: it.value }); toast(`Đang dùng <b>${it.name}</b> ✨`); });
}
$('#btnStore').addEventListener('click', () => openStore());
socket.on('earned', (e) => { myEarned = e; refreshLevel(); if ($('#storeModal').classList.contains('show')) renderStore(); });
socket.on('owned', (o) => { owned = o.owned; if ($('#storeModal').classList.contains('show')) renderStore(); toast('🎁 Bạn vừa được tặng đồ mới! Vào Shop/Tủ đồ để mặc thử'); });

// ---------- Nhiệm vụ ----------
function renderQuests() {
  $('#questList').innerHTML = (FEAT.quests ? '' : '<p style="opacity:.7">Nhiệm vụ chưa mở</p>') + (FEAT.quests ? quests : []).map((q) => `<div class="quest ${q.done ? 'done' : ''}"><b>${q.done ? '✅' : '🎯'} ${q.text}</b><small>Thưởng ${D.fmtMoney(q.reward)} · ${q.prog}/${q.target}</small><div class="qbar"><i style="width:${(q.prog / q.target) * 100}%"></i></div></div>`).join('');
  const L = levelDefs[myLevel], N = levelDefs[myLevel + 1];
  $('#levelBox').innerHTML = L ? `Cấp hiện tại: <b>${L.icon} ${L.name}</b>${L.bonus ? ` (bo +${Math.round(L.bonus * 100)}%)` : ''}<br>${N ? `Kiếm thêm <b>${D.fmtMoney(Math.max(0, N.min - myEarned))}</b> để lên <b>${N.icon} ${N.name}</b>` : 'Bạn đã là Má mì của quán! 👑'}` : '';
}
$('#btnQuest').addEventListener('click', () => { renderQuests(); openModal('#questModal'); });
socket.on('quests', (q) => { quests = q; if ($('#questModal').classList.contains('show')) renderQuests(); });
socket.on('questDone', ({ text, reward }) => { floater(`📋 +${D.fmtMoney(reward)}<small>Xong nhiệm vụ: ${escapeHtml(text)}</small>`); sfx('level'); });
socket.on('levelUp', ({ id, level }) => {
  if (id === myId) { myLevel = level; drawNameLabel(myLabel, myName, 0, true, level); playRankUp(level); }
  else {
    const p = players.get(id);
    if (p) { levelsById.set(id, level); drawNameLabel(p.label, p.name, p.money, false, level); goldPillar(p, 5); fireworksAt(p.x, p.z); }
    if (p && levelDefs[level]) toast(`🎊 ${p.name} vừa được thăng cấp ${levelDefs[level].icon} ${levelDefs[level].name}!`);
  }
});

// ---------- Tặng quà ----------
let giftTo = null;
function renderGift() {
  const list = [...players.entries()];
  if (!list.length) { $('#giftBody').innerHTML = '<p style="opacity:.8">Trong quán chưa có ai khác. Rủ bạn bè vào chơi rồi tặng quà nha!</p>'; return; }
  if (!giftTo || !players.has(giftTo)) giftTo = list[0][0];
  const target = players.get(giftTo);
  const items = shopDefs.filter((it) => it.price <= Math.max(myMoney, 0));
  $('#giftBody').innerHTML = `<div class="gift-body"><div class="cr-label">Tặng cho</div><div class="gift-players">${list.map(([id, p]) => `<button class="opt ${id === giftTo ? 'on' : ''}" data-gto="${id}">${escapeHtml(p.name)}</button>`).join('')}</div>
    <div class="cr-label">Tặng tiền bo (bạn đang có ${D.fmtMoney(myMoney)})</div><div class="gift-row">${[50, 100, 200, 500, 1000].map((a) => `<button class="btn" data-gamt="${a}" ${myMoney < a ? 'disabled' : ''}>${D.fmtMoney(a)}</button>`).join('')}</div>
    <div class="cr-label">Hoặc mua đồ tặng ${escapeHtml(target.name)}</div><select id="giftItem"><option value="">-- Chọn món --</option>${items.map((it) => `<option value="${it.id}">${it.name} - ${D.fmtMoney(it.price)}</option>`).join('')}</select>
    <button class="btn primary wide" id="giftItemBtn">Mua tặng 🎁</button></div>`;
  document.querySelectorAll('[data-gto]').forEach((b) => b.onclick = () => { giftTo = b.dataset.gto; renderGift(); });
  const send = async (payload) => { const r = await emitP('gift', { to: giftTo, ...payload }); if (!r.ok) return toast(r.error); myMoney = r.money; refreshHUD(); sfx('coin'); closeModals(); };
  document.querySelectorAll('[data-gamt]').forEach((b) => b.onclick = () => send({ amount: +b.dataset.gamt }));
  $('#giftItemBtn').onclick = () => { const v = $('#giftItem').value; if (v) send({ item: v }); };
}
$('#btnGift').addEventListener('click', () => { renderGift(); openModal('#giftModal'); });
socket.on('giftFx', ({ to, fromName, label }) => { if (to === myId) { floater(`🎁 ${escapeHtml(fromName)} tặng bạn<small>${escapeHtml(label)}</small>`); sfx('level'); } });

// ---------- Pháo hoa ----------
const fxParts = [];
function fireworksAt(x, z) {
  const cols = ['#ff4fa3', '#ffd54f', '#40c4ff', '#69f0ae', '#b388ff'];
  for (let i = 0; i < 40; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 4), new THREE.MeshBasicMaterial({ color: cols[i % 5], transparent: true }));
    m.position.set(x, 2.2, z); scene.add(m);
    const a = Math.random() * Math.PI * 2, b = Math.random() * Math.PI;
    fxParts.push({ m, v: new THREE.Vector3(Math.cos(a) * Math.sin(b), Math.cos(b) + 0.6, Math.sin(a) * Math.sin(b)).multiplyScalar(2.5), life: 1.4 });
  }
}
socket.on('fireworks', ({ ids }) => { for (const id of ids) { const src = id === myId ? me : players.get(id); if (src) fireworksAt(src.x, src.z); } });

// ---------- sao quay trên đầu khi trúng dép ----------
const stars = new Map();
function setStars(id, on, x, z) {
  let s = stars.get(id);
  if (on && !s) { s = makeLabel(256, 96, 0.9); s.ctx.font = '64px sans-serif'; s.ctx.textAlign = 'center'; s.ctx.textBaseline = 'middle'; s.ctx.fillText('💫⭐💫', 128, 48); s.tex.needsUpdate = true; scene.add(s.sprite); stars.set(id, s); }
  if (!on && s) { scene.remove(s.sprite); stars.delete(id); return; }
  if (s) s.sprite.position.set(x, 0.75 + Math.sin(performance.now() / 120) * 0.05, z);
}

// ---------- Vợ đánh ghen ----------
let ghenFx = null; // {ev, npc}
let ghenCamUntil = 0;
const ghenCamOn = () => ghenFx && serverNow() < ghenCamUntil && camMode === 'play';
const flying = [];
function startGhenFx(ev) {
  if (ghenFx) { scene.remove(ghenFx.npc.group); scene.remove(ghenFx.label.sprite); }
  const npc = createNPC('wife'); scene.add(npc.group);
  // bảng tên đỏ trên đầu bà vợ cho dễ nhận ra
  const c = customers.get(ev.cid);
  const who = c ? D.CUSTOMER_TYPES[c.data.type]?.name : '';
  const label = makeLabel(640, 110, 0.95);
  { const { ctx, w } = label; ctx.font = 'bold 50px "Be Vietnam Pro", sans-serif';
    const text = '😡 Vợ ' + (who || 'của khách');
    const tw = ctx.measureText(text).width + 50;
    ctx.fillStyle = 'rgba(213,0,0,0.92)'; roundRect(ctx, (w - tw) / 2, 12, tw, 80, 36); ctx.fill();
    ctx.strokeStyle = '#ffeb3b'; ctx.lineWidth = 5; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, w / 2, 54);
    label.tex.needsUpdate = true; }
  scene.add(label.sprite);
  ghenFx = { ev, npc, label };
}
let ghenChoiceEid = null, ghenChoiceTimer = null;
function endGhenFx(d) {
  if (d && ghenFx && d.id !== ghenFx.ev.id) return; // tín hiệu cũ đến trễ, bỏ qua
  if (ghenFx) { scene.remove(ghenFx.npc.group); scene.remove(ghenFx.label.sprite); ghenFx = null; }
  if (!d || ghenChoiceEid === d.id) { $('#ghenModal').classList.remove('show'); clearInterval(ghenChoiceTimer); if (me.busy && !isMinigameOpen()) me.busy = false; }
}
socket.on('ghen', (ev) => { startGhenFx(ev); sfx('ghen'); toast('😱 <b>VỢ KHÁCH TỚI ĐÁNH GHEN!!!</b> Coi chừng dép tổ ong!'); });
socket.on('ghenEnd', endGhenFx);
socket.on('ghenChoice', ({ eid, deadline }) => {
  if (isMinigameOpen()) return;
  ghenChoiceEid = eid;
  ghenCamUntil = deadline + 2500;
  { const f = document.createElement('div'); f.className = 'ghen-flash'; document.body.appendChild(f); setTimeout(() => f.remove(), 1600); }
  closeModals();
  $('#ghenModal').classList.add('show'); me.busy = true;
  const total = deadline - serverNow();
  clearInterval(ghenChoiceTimer);
  ghenChoiceTimer = setInterval(() => {
    const left = deadline - serverNow();
    $('#ghenBar').style.width = Math.max(0, (left / total) * 100) + '%';
    if (left <= 0) { clearInterval(ghenChoiceTimer); $('#ghenModal').classList.remove('show'); me.busy = false; }
  }, 50);
  document.querySelectorAll('[data-ghen]').forEach((b) => b.onclick = () => {
    clearInterval(ghenChoiceTimer);
    $('#ghenModal').classList.remove('show'); me.busy = false;
    const choice = b.dataset.ghen;
    socket.emit('ghenAnswer', { eid, choice });
    if (choice === 'run') {
      ghenCamUntil = 0; // trả camera về mình để thấy đường chạy
      const room = ghenFx ? 'r' + ghenFx.ev.roomId : null;
      let n = 3; $('#runBanner').classList.remove('hidden'); $('#runBanner').textContent = `🏃‍♀️ CHẠY RA KHỎI PHÒNG! ${n}`;
      const iv = setInterval(() => {
        n--;
        if (n > 0) { $('#runBanner').textContent = `🏃‍♀️ CHẠY RA KHỎI PHÒNG! ${n}`; return; }
        clearInterval(iv); $('#runBanner').classList.add('hidden');
        socket.emit('ghenRun', { eid, escaped: zoneAt(me.x, me.z) !== room });
      }, 1000);
    }
  });
});
socket.on('ghenResult', ({ ok, text }) => { toast(text); sfx(ok ? 'good' : 'bad'); });
socket.on('dep', ({ pid, from }) => {
  const target = pid === myId ? me : players.get(pid);
  if (!target) return;
  const m = createSlipper(); m.scale.setScalar(1.6); scene.add(m);
  flying.push({ m, from: new THREE.Vector3(from.x, 1.5, from.z), target, pid, t: 0 });
});
function updateGhen(t) {
  if (!ghenFx) return;
  const { ev, npc } = ghenFx, now = serverNow();
  const c = customers.get(ev.cid);
  let pos, dir, mode = 'walk', moving = false;
  if (now < ev.choiceAt) {
    const len = ev.enterPts.reduce((L, p, i) => (i ? L + Math.hypot(p[0] - ev.enterPts[i - 1][0], p[1] - ev.enterPts[i - 1][1]) : 0), 0);
    const r = routePos(ev.enterPts, Math.max(0, (now - ev.t0) / ev.enterDur) * len);
    pos = r; dir = Math.atan2(r.dx, r.dz); moving = !r.end; mode = 'angry';
  } else if (c && c.data.st === 'drag' && c.data.drag) {
    const r = routePos(c.data.drag.pts, Math.max(0, (now - c.data.drag.t0) / 1000) * c.data.drag.speed + 0.7);
    pos = r; dir = Math.atan2(r.dx, r.dz); moving = !r.end; mode = 'pull';
  } else {
    pos = ev.stand; mode = 'pull';
    const st = c ? c.obj.group.position : null;
    dir = st ? Math.atan2(st.x - pos.x, st.z - pos.z) : 0;
  }
  npc.group.position.set(pos.x, 0, pos.z); npc.group.rotation.y = dir;
  ghenFx.label.sprite.position.set(pos.x, 2.25 + Math.abs(Math.sin(t * 6)) * 0.06, pos.z);
  npc.animate(t, mode, moving);
}

// ---------- Công an ----------
let policeFx = null;
function wearUniform() {
  if (!policeFx || policeFx.done) return;
  policeFx.done = true;
  socket.emit('policeOk');
  setApp({ uniform: true });
  $('#policeOverlay').classList.add('hidden');
  setTimeout(() => setApp({ uniform: false }), 25000);
}
$('#btnUniform').addEventListener('click', wearUniform);
addEventListener('keydown', (e) => { if (e.code === 'KeyR' && policeFx && document.activeElement.tagName !== 'INPUT') wearUniform(); });
socket.on('police', ({ t0, until }) => {
  const npc = createNPC('police'); scene.add(npc.group);
  policeFx = { t0, until, npc, done: false };
  $('#policeOverlay').classList.remove('hidden');
  sfx('siren'); setTimeout(() => sfx('siren'), 2100); setTimeout(() => sfx('siren'), 4200);
});
socket.on('policeFine', ({ fine }) => { toast(`👮 Bị phạt <b>${D.fmtMoney(fine)}</b> vì ăn mặc chưa nghiêm túc!`); sfx('bad'); });
socket.on('policeEnd', () => {
  $('#policeOverlay').classList.add('hidden');
  if (policeFx) { policeFx.leaving = serverNow(); const f = policeFx; setTimeout(() => { scene.remove(f.npc.group); if (policeFx === f) policeFx = null; }, 6000); }
});
function updatePolice(t) {
  if (!policeFx) return;
  const now = serverNow(), f = policeFx;
  if (!f.done && !f.leaving) $('#policeCount').textContent = Math.max(0, Math.ceil((f.until - now) / 1000)) + 's';
  const pts = [[EXIT.x + 0.5, EXIT.z], [-6, 0], [0, 1]];
  let r, mode = 'walk';
  if (!f.leaving) { r = routePos(pts, Math.max(0, (now - f.t0) / 1000) * 3.2); mode = r.end ? 'whistle' : 'walk'; }
  else r = routePos([...pts].reverse(), Math.max(0, (now - f.leaving) / 1000) * 3.2);
  f.npc.group.position.set(r.x, 0, r.z);
  f.npc.group.rotation.y = r.end && !f.leaving ? Math.atan2(me.x - r.x, me.z - r.z) : Math.atan2(r.dx, r.dz);
  f.npc.animate(t, mode, !r.end);
}

// ---------- Cúp điện ----------
let darkOn = false;
const torch = new THREE.SpotLight('#fff3d6', 0, 14, 0.55, 0.5, 1.2);
scene.add(torch); scene.add(torch.target);
function setDark(on) {
  darkOn = on;
  world.setBlackout(on);
  hemi.intensity = on ? 0.04 : 1.1; faceLight.intensity = on ? 0 : 0.8; amb.intensity = on ? 0.02 : 0.35; sun.intensity = on ? 0 : 1.0;
  torch.intensity = on ? 30 : 0;
  $('#darkOverlay').classList.toggle('hidden', !on);
}
socket.on('blackout', ({ on, by }) => {
  setDark(on);
  if (on) { toast('⚡ <b>CÚP ĐIỆN!</b> Ra <b>cầu dao</b> ở tường bên phải sảnh (đèn đỏ nhấp nháy) nhấn E'); sfx('alarm'); }
  else toast(by ? `💡 ${escapeHtml(by)} đã bật lại điện!` : '💡 Có điện lại rồi!');
});

// ---------- Ca làm + tổng kết ----------
setInterval(() => {
  if (!shiftEnd) return;
  const left = Math.max(0, shiftEnd - serverNow());
  $('#shiftTimer').textContent = `⏱ Ca: ${String(Math.floor(left / 60000)).padStart(2, '0')}:${String(Math.floor(left / 1000) % 60).padStart(2, '0')}`;
}, 500);
socket.on('shiftEnd', ({ titles, ranking }) => {
  $('#summaryBody').innerHTML = (titles.length ? titles.map((t) => `<div class="summary-title"><span>${t.title}</span><span><b>${escapeHtml(t.name)}</b> · ${t.value}</span></div>`).join('') + '<p style="font-size:13px;opacity:.75">Mỗi danh hiệu được thưởng thêm 100k 🎁</p>' : '<p>Ca này hơi vắng...</p>')
    + '<div class="cr-label" style="margin-top:12px">Tiền bo trong ca</div>' + ranking.map((r, i) => `<div style="display:flex;justify-content:space-between;padding:3px 0"><span>${i + 1}. ${escapeHtml(r.name)}</span><b>${D.fmtMoney(r.tips)}</b></div>`).join('');
  if (!isMinigameOpen()) openModal('#summaryModal');
  sfx('level'); fireworksAt(me.x, me.z);
});

// ---------- Song ca 2 người chơi ----------
socket.on('duetInvited', ({ from, name }) => {
  const b = $('#duetBanner');
  b.innerHTML = `🎤 <b>${escapeHtml(name)}</b> mời bạn song ca! <button class="btn primary" id="duetYes">Nhận</button><button class="btn" id="duetNo">✕</button>`;
  b.classList.remove('hidden');
  const hide = () => b.classList.add('hidden');
  $('#duetYes').onclick = () => { socket.emit('duetInvite', { to: from }); hide(); };
  $('#duetNo').onclick = hide;
  setTimeout(hide, 12000);
});
socket.on('duetStart', async ({ did, seed, partner }) => {
  if (isMinigameOpen()) return socket.emit('duetDone', { did, q: 0 });
  closeModals(); me.busy = true; me.emote = 'sing'; me.emoteUntil = 1e9;
  const q = await runMinigame('duet', { seed, partner, cname: partner, type: 'oppa', data: {} });
  me.busy = false; me.emoteUntil = clock.elapsedTime + 2;
  socket.emit('duetDone', { did, q });
});
socket.on('duetResult', ({ qa, qb, reward, partner }) => {
  if (reward) { floater(`🎤 +${D.fmtMoney(reward)}<small>Song ca cực hợp với ${escapeHtml(partner)}!</small>`); sfx('tip'); }
  else toast(`🎤 Song ca với ${escapeHtml(partner)} chưa khớp lắm (${Math.round(qa * 100)}% vs ${Math.round(qb * 100)}%). Thử lại nha!`);
});

// ---------- linh tinh ----------
socket.on('sync', (t) => { const off = t - Date.now(); timeOffset = Math.abs(off - timeOffset) > 2000 ? off : timeOffset * 0.8 + off * 0.2; });
socket.on('toast', (m) => toast(escapeHtml(m)));
socket.on('alarm', ({ kind }) => { if (kind === 'flee') { sfx('alarm'); toast('🏃 <b>Có khách QUỴT TIỀN!</b> Chạy theo nắm áo lại (nhấn E)!'); } });

function updateFx(dt, t) {
  updateGhen(t); updatePolice(t);
  setStars(myId || 'me', me.anim === 'stun', me.x, me.z);
  // dép bay
  for (let i = flying.length - 1; i >= 0; i--) {
    const f = flying[i]; f.t += dt / 0.55;
    const to = new THREE.Vector3(f.target.x, 1.0, f.target.z);
    const p = f.from.clone().lerp(to, Math.min(1, f.t)); p.y += Math.sin(Math.min(1, f.t) * Math.PI) * 0.8;
    f.m.position.copy(p); f.m.rotation.set(f.t * 20, f.t * 12, 0);
    if (f.t >= 1) {
      scene.remove(f.m); flying.splice(i, 1);
      if (f.pid === myId) { me.stunUntil = clock.elapsedTime + 3; floater('🩴 BỐP!<small>Choáng 3 giây...</small>'); sfx('bop'); }
    }
  }
  // pháo hoa
  for (let i = fxParts.length - 1; i >= 0; i--) {
    const f = fxParts[i]; f.life -= dt;
    f.v.y -= 3 * dt; f.m.position.addScaledVector(f.v, dt); f.m.material.opacity = Math.max(0, f.life / 1.4);
    if (f.life <= 0) { scene.remove(f.m); fxParts.splice(i, 1); }
  }
  // đèn pin khi cúp điện
  if (darkOn) {
    const fx = Math.sin(me.ry), fz = Math.cos(me.ry);
    torch.position.set(me.x, 1.6, me.z);
    torch.target.position.set(me.x + fx * 4, 0.4, me.z + fz * 4);
  }
}


// =====================================================================
// NHẤP / CHẠM ĐỂ DI CHUYỂN (tự tìm đường vòng qua tường)
// =====================================================================
const GRID = { x0: -20, z0: -18, x1: 20, z1: 21, s: 0.4 };
GRID.nx = Math.round((GRID.x1 - GRID.x0) / GRID.s); GRID.nz = Math.round((GRID.z1 - GRID.z0) / GRID.s);
const gIdx = (i, j) => j * GRID.nx + i;
const toCell = (x, z) => [Math.max(0, Math.min(GRID.nx - 1, Math.round((x - GRID.x0) / GRID.s))), Math.max(0, Math.min(GRID.nz - 1, Math.round((z - GRID.z0) / GRID.s)))];
const cellPos = (i, j) => ({ x: GRID.x0 + i * GRID.s, z: GRID.z0 + j * GRID.s });
function findPath(sx, sz, tx, tz) {
  const free = new Uint8Array(GRID.nx * GRID.nz);
  for (let j = 0; j < GRID.nz; j++) for (let i = 0; i < GRID.nx; i++) { const p = cellPos(i, j); free[gIdx(i, j)] = blocked(p.x, p.z) ? 0 : 1; }
  let [si, sj] = toCell(sx, sz), [ti, tj] = toCell(tx, tz);
  // điểm đích nằm trong vật cản -> lấy ô trống gần nhất
  const nearestFree = (i0, j0) => {
    if (free[gIdx(i0, j0)]) return [i0, j0];
    for (let r = 1; r < 8; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
      const i = i0 + di, j = j0 + dj;
      if (i >= 0 && j >= 0 && i < GRID.nx && j < GRID.nz && free[gIdx(i, j)]) return [i, j];
    }
    return null;
  };
  const S = nearestFree(si, sj), T = nearestFree(ti, tj);
  if (!S || !T) return null;
  [si, sj] = S; [ti, tj] = T;
  const N = GRID.nx * GRID.nz, g = new Float32Array(N).fill(Infinity), came = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
  const open = [[0, si, sj]]; g[gIdx(si, sj)] = 0;
  const h = (i, j) => Math.hypot(i - ti, j - tj);
  const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
  let found = false, steps = 0;
  while (open.length && steps++ < 20000) {
    let bi = 0; for (let k = 1; k < open.length; k++) if (open[k][0] < open[bi][0]) bi = k;
    const [, i, j] = open.splice(bi, 1)[0], id = gIdx(i, j);
    if (closed[id]) continue; closed[id] = 1;
    if (i === ti && j === tj) { found = true; break; }
    for (const [di, dj, c] of DIRS) {
      const ni = i + di, nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= GRID.nx || nj >= GRID.nz) continue;
      const nid = gIdx(ni, nj);
      if (!free[nid] || closed[nid]) continue;
      if (di && dj && (!free[gIdx(i + di, j)] || !free[gIdx(i, j + dj)])) continue; // không cắt góc tường
      const ng = g[id] + c;
      if (ng < g[nid]) { g[nid] = ng; came[nid] = id; open.push([ng + h(ni, nj), ni, nj]); }
    }
  }
  if (!found) return null;
  const cells = [];
  for (let id = gIdx(ti, tj); id !== -1; id = came[id]) cells.push([id % GRID.nx, Math.floor(id / GRID.nx)]);
  cells.reverse();
  // rút gọn đường: bỏ các điểm có thể đi thẳng tới
  const pts = cells.map(([i, j]) => cellPos(i, j));
  const clear = (a, b) => { const d = Math.hypot(b.x - a.x, b.z - a.z), n = Math.ceil(d / 0.15); for (let k = 1; k < n; k++) { const t = k / n; if (blocked(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t)) return false; } return true; };
  const out = [{ x: sx, z: sz }];
  let k = 0;
  while (k < pts.length - 1) { let m = pts.length - 1; while (m > k + 1 && !clear(out[out.length - 1], pts[m])) m--; out.push(pts[m]); k = m; }
  const last = !blocked(tx, tz) && clear(out[out.length - 1], { x: tx, z: tz }) ? { x: tx, z: tz } : null;
  if (last) out.push(last);
  return out.slice(1);
}

let goto = null; // { path, target, repathAt }
const marker = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.32, 32), new THREE.MeshBasicMaterial({ color: '#ff4fa3', transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
marker.rotation.x = -Math.PI / 2; marker.visible = false; scene.add(marker);
function cancelGoto() { if (goto) { goto = null; marker.visible = false; } }

// điểm đứng để phục vụ từng loại mục tiêu
function standPoint(tg) {
  if (tg.type === 'customer') {
    const st = seatTransform(tg.e.data.roomId, tg.e.data.seat);
    return { x: st.x + Math.sin(st.ry) * 1.4, z: st.z + Math.cos(st.ry) * 1.4 };
  }
  if (tg.type === 'flee') return { x: tg.e.obj.group.position.x, z: tg.e.obj.group.position.z };
  if (tg.type === 'pole') return { x: tg.pole.x, z: tg.pole.z + 0.6 };
  if (tg.type === 'bar') return { x: BAR.x + 0.5, z: BAR.z };
  if (tg.type === 'mirror') return { x: MIRROR.x - 0.5, z: MIRROR.z };
  if (tg.type === 'shop') return { x: SHOPSPOT.x - 0.4, z: SHOPSPOT.z };
  if (tg.type === 'breaker') return { x: BREAKER.x - 0.6, z: BREAKER.z };
  return null;
}
function reached(tg) {
  const d = (x, z) => Math.hypot(x - me.x, z - me.z);
  if (tg.type === 'customer') { const st = seatTransform(tg.e.data.roomId, tg.e.data.seat); return d(st.x, st.z) < 2.6; }
  if (tg.type === 'flee') return customers.has(tg.e.data.id) && d(tg.e.obj.group.position.x, tg.e.obj.group.position.z) < 2;
  if (tg.type === 'pole') return d(tg.pole.x, tg.pole.z) < 1.2;
  if (tg.type === 'bar') return d(BAR.x, BAR.z) < 2.6;
  if (tg.type === 'mirror') return d(MIRROR.x, MIRROR.z) < 2.6;
  if (tg.type === 'shop') return d(SHOPSPOT.x, SHOPSPOT.z) < 1.8;
  if (tg.type === 'breaker') return d(BREAKER.x, BREAKER.z) < 2.2;
  return false;
}
function startGoto(x, z, target = null) {
  const path = mySpace ? [{ x, z }] : findPath(me.x, me.z, x, z);
  if (!path || !path.length) { if (target && reached(target)) { interact(target); return; } toast('Không đi tới chỗ đó được 😅'); return; }
  goto = { path, target, repathAt: performance.now() + 700 };
  const end = path[path.length - 1];
  marker.position.set(end.x, 0.03, end.z); marker.visible = true;
  me.emoteUntil = 0;
}
function gotoStep() {
  if (!goto) return null;
  const tg = goto.target;
  if (tg && (tg.type === 'customer' || tg.type === 'flee') && !customers.has(tg.e.data.id)) { cancelGoto(); return null; }
  if (tg && reached(tg)) { const t2 = tg; cancelGoto(); interact(t2); return null; }
  // khách quỵt tiền đang chạy: tính lại đường liên tục
  if (tg && tg.type === 'flee' && performance.now() > goto.repathAt) {
    const sp = standPoint(tg); const path = findPath(me.x, me.z, sp.x, sp.z);
    if (path && path.length) goto.path = path; goto.repathAt = performance.now() + 500;
  }
  let wp = goto.path[0];
  while (wp && Math.hypot(wp.x - me.x, wp.z - me.z) < 0.25) { goto.path.shift(); wp = goto.path[0]; }
  if (!wp) { const t2 = tg; cancelGoto(); if (t2 && reached(t2)) interact(t2); return null; }
  const dx = wp.x - me.x, dz = wp.z - me.z, m = Math.hypot(dx, dz);
  // đi chậm lại khi gần tới điểm cuối
  const k = goto.path.length === 1 ? Math.min(1, m / 0.4 + 0.3) : 1;
  return { x: (dx / m) * k, z: (dz / m) * k };
}

// nhấp vào màn hình -> xác định mục tiêu
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
function clickTo(cx, cy) {
  if (!joined || camMode !== 'play' || me.busy || isMinigameOpen()) return;
  initMusic();
  if (mySpace) { homeClick(cx, cy); return; }
  ndc.set((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  // 1) bấm trúng người khách
  const objs = [...customers.values()].map((e) => e.obj.group);
  const hit = ray.intersectObjects(objs, true)[0];
  if (hit) {
    let o = hit.object; while (o.parent && !objs.includes(o)) o = o.parent;
    const e = [...customers.values()].find((x) => x.obj.group === o);
    if (e) {
      const tg = e.data.st === 'flee' ? { type: 'flee', e } : e.data.st === 'seat' ? { type: 'customer', e } : null;
      if (tg) { const sp = standPoint(tg); startGoto(sp.x, sp.z, tg); return; }
    }
  }
  // 2) bấm xuống sàn -> xem có gần vật tương tác không
  const p = new THREE.Vector3();
  if (!ray.ray.intersectPlane(groundPlane, p)) return;
  const spots = [
    ...POLES.map((pole) => ({ type: 'pole', pole, x: pole.x, z: pole.z, r: 1.0 })),
    { type: 'bar', x: BAR.x - 1, z: BAR.z, r: 2 },
    { type: 'mirror', x: MIRROR.x + 1, z: MIRROR.z, r: 1.8 },
    ...(FEAT.shop ? [{ type: 'shop', x: 17.6, z: -1.2, r: 1.8 }] : []),
    ...(darkOn ? [{ type: 'breaker', x: BREAKER.x, z: BREAKER.z, r: 1.8 }] : []),
  ];
  let best = null, bd = 1e9;
  for (const sp of spots) { const d = Math.hypot(sp.x - p.x, sp.z - p.z); if (d < sp.r && d < bd) { bd = d; best = sp; } }
  // bấm vào sàn ngay trước ghế khách cũng tính là chọn khách
  if (!best) for (const e of customers.values()) {
    if (e.data.st !== 'seat') continue;
    const st = seatTransform(e.data.roomId, e.data.seat);
    if (Math.hypot(st.x - p.x, st.z - p.z) < 0.7) { const tg = { type: 'customer', e }; const sp = standPoint(tg); startGoto(sp.x, sp.z, tg); return; }
  }
  if (best) { const sp = standPoint(best); startGoto(sp.x, sp.z, best); return; }
  startGoto(p.x, p.z, null);
}


// =====================================================================
// ✨ THAY ĐỒ CHỚP NHOÁNG: xoay vòng, tung kim tuyến, hiện ra đồ mới
// =====================================================================
const glitter = [];
const GLITTER_COLS = ['#ffd54f', '#ff4fa3', '#40c4ff', '#ffffff', '#b388ff', '#69f0ae'];
const glitterGeo = new THREE.PlaneGeometry(0.06, 0.06);
function glitterAt(x, z, n = 70) {
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(glitterGeo, new THREE.MeshBasicMaterial({ color: GLITTER_COLS[i % GLITTER_COLS.length], side: THREE.DoubleSide, transparent: true, depthWrite: false }));
    const a = Math.random() * Math.PI * 2, r = Math.random() * 0.35;
    m.position.set(x + Math.cos(a) * r, 0.2 + Math.random() * 1.6, z + Math.sin(a) * r);
    scene.add(m);
    const sp = 1.2 + Math.random() * 2.2;
    glitter.push({ m, v: new THREE.Vector3(Math.cos(a) * sp, 1.5 + Math.random() * 3, Math.sin(a) * sp), spin: new THREE.Vector3(Math.random() * 10, Math.random() * 10, 0), life: 1.6 + Math.random() * 0.8, max: 2.4 });
  }
}
function updateGlitter(dt) {
  for (let i = glitter.length - 1; i >= 0; i--) {
    const g = glitter[i]; g.life -= dt;
    g.v.y -= 2.2 * dt; g.v.multiplyScalar(1 - dt * 1.2);
    g.m.position.addScaledVector(g.v, dt);
    g.m.rotation.x += g.spin.x * dt; g.m.rotation.y += g.spin.y * dt;
    g.m.material.opacity = Math.max(0, Math.min(1, g.life / 0.8)) * (0.6 + 0.4 * Math.sin(g.life * 30));
    if (g.life <= 0 || g.m.position.y < 0) { scene.remove(g.m); g.m.material.dispose(); glitter.splice(i, 1); }
  }
}
let quickBusy = false;
function quickChange() {
  if (!joined || quickBusy || camMode !== 'play' || isMinigameOpen() || me.stunUntil > clock.elapsedTime) return;
  // chọn bộ đồ khác trong số đồ đã sở hữu, đổi màu ngẫu nhiên
  const outfits = D.OUTFITS.map((o) => o.id).filter((id) => !lockOf('outfit', id));
  const others = outfits.filter((id) => id !== app.outfit);
  const col = D.OUTFIT_COLORS.filter((c) => c !== app.outfitColor);
  let next = { outfit: others.length ? others[Math.floor(Math.random() * others.length)] : app.outfit, outfitColor: col[Math.floor(Math.random() * col.length)] };
  // có nhân vật 3D: đổi qua lại giữa các nhân vật 3D / người khối
  const ms = girlModels().map((m) => m.id);
  const curM = effectiveModel(app);
  if (curM) { const o2 = ms.filter((x) => x !== curM); next = { model: o2.length ? o2[Math.floor(Math.random() * o2.length)] : forced3D() ? curM : 'none' }; }
  else if (ms.length && Math.random() < 0.35) next = { model: ms[Math.floor(Math.random() * ms.length)] };
  if (next.model && next.model !== 'none') preloadModel(next.model);
  quickBusy = true;
  const wasPole = me.emote === 'pole' && me.emoteUntil > clock.elapsedTime;
  me.qchangeUntil = clock.elapsedTime + 1.6;
  cancelGoto();
  sfx('level');
  glitterAt(me.x, me.z, 40);
  setTimeout(() => {
    setApp(next);
    glitterAt(me.x, me.z, 90);
    sfx('tip');
    const o = next.model ? modelInfo(next.model) || { name: 'Người khối' } : D.OUTFITS.find((x) => x.id === next.outfit);
    floater(`✨ TA-DA! ✨<small>${o ? o.name : ''}</small>`);
  }, 800);
  setTimeout(() => { quickBusy = false; if (wasPole) { me.emote = 'pole'; me.emoteUntil = 1e9; } }, 1700);
  if (others.length === 0 && FEAT.shop) setTimeout(() => toast('Mua thêm đồ ở 🛍 Shop để thay được nhiều kiểu hơn nha!'), 1800);
}
$('#btnQuick').addEventListener('click', quickChange);


// =====================================================================
// 📷 CHỤP MÀN HÌNH, 🎥 QUAY VIDEO, ⛶ TOÀN MÀN HÌNH, 🙈 THU GỌN
// Ảnh/video lấy thẳng từ cảnh 3D (không dính nút bấm) + logo góc dưới.
// =====================================================================
const GAME_URL = location.host;
let wantShot = false, rec = null;
const stamp = () => { const d = new Date(), z = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}-${z(d.getHours())}${z(d.getMinutes())}${z(d.getSeconds())}`; };
function drawWatermark(ctx, W, H) {
  const s = Math.max(0.6, Math.min(W, H) / 720);
  ctx.save();
  ctx.font = `800 ${Math.round(26 * s)}px "Be Vietnam Pro", sans-serif`;
  const t1 = '✨ KTV LUNG LINH 3D';
  ctx.font = `800 ${Math.round(26 * s)}px "Be Vietnam Pro", sans-serif`;
  const w1 = ctx.measureText(t1).width;
  ctx.font = `600 ${Math.round(15 * s)}px "Be Vietnam Pro", sans-serif`;
  const w2 = ctx.measureText(GAME_URL).width;
  const bw = Math.max(w1, w2) + 28 * s, bh = 66 * s, x = W - bw - 16 * s, y = H - bh - 16 * s;
  ctx.fillStyle = 'rgba(20,6,30,0.55)'; roundRect(ctx, x, y, bw, bh, 14 * s); ctx.fill();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `800 ${Math.round(26 * s)}px "Be Vietnam Pro", sans-serif`; ctx.fillStyle = '#ff4fa3'; ctx.fillText(t1, x + bw / 2, y + 24 * s);
  ctx.font = `600 ${Math.round(15 * s)}px "Be Vietnam Pro", sans-serif`; ctx.fillStyle = '#fff'; ctx.fillText(GAME_URL, x + bw / 2, y + 49 * s);
  ctx.restore();
}
// vẽ khung hình 3D (đã cắt theo tỉ lệ) lên canvas 2D
function blitScene(ctx, W, H) {
  const src = renderer.domElement, sw = src.width, sh = src.height;
  const want = W / H; let cw = sw, ch = sh;
  if (sw / sh > want) cw = sh * want; else ch = sw / want;
  ctx.drawImage(src, (sw - cw) / 2, (sh - ch) / 2, cw, ch, 0, 0, W, H);
  drawWatermark(ctx, W, H);
}
async function saveBlob(blob, name) {
  const file = new File([blob], name, { type: blob.type });
  // điện thoại: mở bảng chia sẻ để lưu vào Ảnh / đăng thẳng TikTok
  if (isMobile && navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'KTV Lung Linh 3D' }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}
function takeShot() { if (joined) wantShot = true; }
function afterRender() {
  if (wantShot) {
    wantShot = false;
    const src = renderer.domElement, c = document.createElement('canvas');
    c.width = src.width; c.height = src.height;
    blitScene(c.getContext('2d'), c.width, c.height);
    const f = $('#shotFlash'); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go');
    sfx('coin');
    c.toBlob((b) => { if (b) { saveBlob(b, `ktv-lunglinh-${stamp()}.png`); toast('📷 Đã chụp! Ảnh lưu trong thư mục Tải về (Downloads).'); } }, 'image/png');
  }
  if (rec) {
    blitScene(rec.ctx, rec.c.width, rec.c.height);
    const sec = Math.floor((performance.now() - rec.t0) / 1000);
    if (sec !== rec.sec) { rec.sec = sec; $('#recTime').textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`; }
    if (sec >= 180) stopRec();
  }
}
function pickMime() {
  const list = ['video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  return list.find((m) => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || '';
}
function openRecMenu() {
  if (!joined) return;
  if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) { toast('Trình duyệt này chưa hỗ trợ quay video. Dùng Chrome bản mới nha!'); return; }
  closeModals(); $('#recMenu').classList.add('show');
}
function startRec(kind) {
  $('#recMenu').classList.remove('show');
  const [W, H] = kind === 'v' ? [720, 1280] : [1280, 720];
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  blitScene(ctx, W, H);
  const stream = c.captureStream(30);
  const at = recordAudioTrack(); if (at) stream.addTrack(at);
  const mime = pickMime();
  let mr;
  try { mr = new MediaRecorder(stream, { mimeType: mime || undefined, videoBitsPerSecond: 6_000_000, audioBitsPerSecond: 128_000 }); }
  catch (e) { toast('Không quay được trên trình duyệt này 😢'); return; }
  const chunks = [];
  mr.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
  mr.onstop = () => {
    stream.getVideoTracks().forEach((t) => t.stop());
    const type = mr.mimeType || mime || 'video/webm';
    const blob = new Blob(chunks, { type: type.split(';')[0] });
    const ext = type.includes('mp4') ? 'mp4' : 'webm';
    if (blob.size < 1000) { toast('Video trống, thử quay lại nha'); return; }
    saveBlob(blob, `ktv-lunglinh-${stamp()}.${ext}`);
    toast(ext === 'mp4' ? '🎬 Đã lưu video! Mở thư mục Tải về (Downloads) để đăng nha.' : '🎬 Đã lưu video (.webm). Nếu TikTok không nhận, đổi sang mp4 bằng CapCut hoặc dùng Chrome bản mới.');
  };
  mr.start(1000);
  rec = { mr, c, ctx, t0: performance.now(), sec: -1 };
  $('#recBar').classList.remove('hidden'); $('#btnRec').classList.add('on');
  toast(kind === 'v' ? '🔴 Đang quay dọc 9:16. Nhân vật luôn ở giữa khung.' : '🔴 Đang quay ngang 16:9.');
}
function stopRec() {
  if (!rec) return;
  const r = rec; rec = null;
  try { r.mr.stop(); } catch (e) {}
  $('#recBar').classList.add('hidden'); $('#btnRec').classList.remove('on');
}
function toggleClean(force) {
  const on = typeof force === 'boolean' ? force : !document.body.classList.contains('clean');
  document.body.classList.toggle('clean', on);
  $('#btnUnclean').classList.toggle('hidden', !on);
}
function toggleFull() {
  const el = document.documentElement;
  if (document.fullscreenElement || document.webkitFullscreenElement) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
  else if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
  else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
}
if (!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen)) $('#btnFull').style.display = 'none'; // iPhone không hỗ trợ
document.addEventListener('fullscreenchange', () => { $('#btnFull').textContent = document.fullscreenElement ? '🗗' : '⛶'; });
$('#btnShot').addEventListener('click', takeShot);
$('#btnRec').addEventListener('click', () => (rec ? stopRec() : openRecMenu()));
$('#btnRecStop').addEventListener('click', stopRec);
document.querySelectorAll('[data-rec]').forEach((b) => b.addEventListener('click', () => startRec(b.dataset.rec)));
$('#btnFull').addEventListener('click', toggleFull);
$('#btnClean').addEventListener('click', () => toggleClean());
$('#btnUnclean').addEventListener('click', () => toggleClean(false));


// =====================================================================
// 👑 MÀN THĂNG CẤP: thanh đen điện ảnh, cột sáng vàng, cánh hoa rơi,
// camera xoay quanh nhân vật, "chiếu chỉ" của quản lý quán
// =====================================================================
let cine = null;
const pillars = [];
function goldPillar(target, secs = 6) {
  const g = new THREE.Group();
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 1.1, 7, 32, 1, true), new THREE.MeshBasicMaterial({ color: '#ffd76a', transparent: true, opacity: 0.0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
  cone.position.y = 3.5; g.add(cone);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.6, 1.25, 48), new THREE.MeshBasicMaterial({ color: '#ffe08a', transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; g.add(ring);
  const rays = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 4.2), new THREE.MeshBasicMaterial({ map: raysTex(), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  rays.position.y = 1.2; g.add(rays);
  scene.add(g);
  pillars.push({ g, cone, ring, rays, target, t: 0, life: secs });
}
let _rays = null;
function raysTex() {
  if (_rays) return _rays;
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  x.translate(128, 128);
  for (let i = 0; i < 16; i++) {
    x.rotate(Math.PI / 8);
    const gr = x.createLinearGradient(0, 0, 0, -128); gr.addColorStop(0, 'rgba(255,220,120,0.9)'); gr.addColorStop(1, 'rgba(255,220,120,0)');
    x.fillStyle = gr; x.beginPath(); x.moveTo(-6, 0); x.lineTo(-16, -128); x.lineTo(16, -128); x.lineTo(6, 0); x.fill();
  }
  _rays = new THREE.CanvasTexture(c); return _rays;
}
const petals = [];
const petalGeo = new THREE.PlaneGeometry(0.09, 0.06);
function petalRain(x, z, n = 140) {
  const cols = ['#ffd54f', '#ffe9a8', '#ff8fb8', '#ffffff', '#f6b73c'];
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(petalGeo, new THREE.MeshBasicMaterial({ color: cols[i % cols.length], side: THREE.DoubleSide, transparent: true, depthWrite: false }));
    const a = Math.random() * Math.PI * 2, r = Math.random() * 2.6;
    m.position.set(x + Math.cos(a) * r, 3 + Math.random() * 3.5, z + Math.sin(a) * r);
    scene.add(m);
    petals.push({ m, vy: 0.5 + Math.random() * 0.6, sway: Math.random() * 6, spin: 2 + Math.random() * 5, life: 6 + Math.random() * 2 });
  }
}
function fanfare() {
  // kèn hiệu "tò te" kiểu sắc phong
  try {
    const out = audioOut(); const ctx = out ? out.ctx : (actx || (actx = new (window.AudioContext || window.webkitAudioContext)()));
    const dest = out ? out.node : ctx.destination;
    const seq = [[523, 0, 0.18], [523, 0.2, 0.12], [523, 0.34, 0.12], [698, 0.5, 0.5], [880, 1.05, 0.25], [784, 1.32, 0.18], [880, 1.52, 0.18], [1047, 1.75, 1.0]];
    for (const [f, d, len] of seq) for (const [type, mul, vol] of [['sawtooth', 1, 0.06], ['triangle', 2, 0.05]]) {
      const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.value = f * mul;
      const t0 = ctx.currentTime + d;
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.03); g.gain.setValueAtTime(vol, t0 + len * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
      o.connect(g).connect(dest); o.start(t0); o.stop(t0 + len + 0.05);
    }
  } catch (e) {}
}
const DECREES = [
  null,
  (n) => `"Xét thấy <b>${n}</b> rót bia không đổ, cười không tắt, nay cho lên làm chính thức."`,
  (n) => `"Xét thấy <b>${n}</b> nhan sắc làm khách quên đường về, nay phong làm gương mặt của quán."`,
  (n) => `"Xét thấy <b>${n}</b> một tay gánh doanh thu, nay giao luôn chìa khóa quán!"`,
];
function playRankUp(level) {
  const L = levelDefs[level]; if (!L) return;
  closeModals();
  cancelGoto();
  cine = { t0: clock.elapsedTime, dur: 5.2, level };
  me.qchangeUntil = clock.elapsedTime + 1.6;
  document.body.classList.add('cutscene');
  $('#cineDecree').innerHTML = (DECREES[level] || DECREES[1])(myName);
  $('#cineRank').textContent = `${L.icon} ${L.name.toUpperCase()}`;
  const perks = [];
  if (L.bonus) perks.push(`💰 Tiền bo +${Math.round(L.bonus * 100)}%`);
  shopDefs.filter((it) => (it.level || 0) === level).forEach((it) => perks.push(`🔓 ${it.name}`));
  perks.push('🏷️ Huy hiệu mới trên tên');
  $('#cinePerks').innerHTML = perks.map((x) => `<span>${x}</span>`).join('');
  const el = $('#cine'); el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  goldPillar(null, 7.5);
  setTimeout(() => { glitterAt(me.x, me.z, 90); petalRain(me.x, me.z); fanfare(); }, 700);
  setTimeout(() => fireworksAt(me.x, me.z), 2300);
  setTimeout(() => fireworksAt(me.x + 1, me.z - 1), 3100);
  cine.timer = setTimeout(endRankUp, 6800);
}
function endRankUp() {
  if (!cine) return;
  clearTimeout(cine.timer);
  cine = null;
  $('#cine').classList.remove('show');
  document.body.classList.remove('cutscene');
}
$('#cine').addEventListener('click', () => { if (cine && clock.elapsedTime - cine.t0 > 1.5) endRankUp(); });
function updateCine(dt, t) {
  for (let i = pillars.length - 1; i >= 0; i--) {
    const P = pillars[i]; P.t += dt;
    const pos = P.target ? P.target : me;
    P.g.position.set(pos.x, 0, pos.z);
    const fade = Math.min(1, P.t / 0.6) * Math.min(1, (P.life - P.t) / 1);
    P.cone.material.opacity = 0.22 * fade; P.ring.material.opacity = 0.7 * fade; P.rays.material.opacity = 0.55 * fade;
    P.rays.lookAt(camera.position); P.rays.rotateZ(t * 0.6);
    P.ring.scale.setScalar(1 + Math.sin(t * 4) * 0.06);
    if (P.t > P.life) { scene.remove(P.g); pillars.splice(i, 1); }
  }
  for (let i = petals.length - 1; i >= 0; i--) {
    const p = petals[i]; p.life -= dt;
    p.m.position.y -= p.vy * dt; p.m.position.x += Math.sin(t * 2 + p.sway) * dt * 0.4;
    p.m.rotation.x += p.spin * dt; p.m.rotation.y += p.spin * 0.7 * dt;
    p.m.material.opacity = Math.min(1, p.life);
    if (p.life <= 0 || p.m.position.y < 0.02) { scene.remove(p.m); p.m.material.dispose(); petals.splice(i, 1); }
  }
}


// =====================================================================
// 🏠 PHÒNG RIÊNG
// =====================================================================
let decorDefs = {}, homeStyles = { wall: {}, floor: {} }, homeSlots = {}, myHome = null;
let mySpace = '', viewing = null, decorSlot = null, decorTab = 'items';
const isOwner = () => viewing && myHome && viewing.key === (myName || '').trim().toLowerCase().normalize('NFC');
function homeInfoHTML(h) { return `🏠 Phòng của ${escapeHtml(h.owner)}<small>❤️ ${h.likes || 0} · ✨ ${h.score || 0} điểm sang chảnh</small>`; }
function refreshHomeBar() {
  if (!viewing) return;
  $('#homeInfo').innerHTML = homeInfoHTML(viewing);
  $('#btnDecor').style.display = isOwner() ? '' : 'none';
  $('#btnLike').style.display = isOwner() ? 'none' : '';
  $('#btnDecor').classList.toggle('on', home.editing);
  $('#btnDecor').textContent = home.editing ? '✅ Xong trang trí' : '🎨 Trang trí';
}
function openHomeModal() {
  const h = myHome || {};
  const placed = Object.values(h.slots || {}).filter(Boolean).length;
  $('#homeMine').innerHTML = `<span>❤️ ${h.likes || 0} lượt thả tim</span><span>✨ ${h.score || 0} điểm sang chảnh</span><span>🛋️ ${placed}/${Object.keys(homeSlots).length} chỗ đã bày</span>`;
  const list = [...players.values()];
  $('#homeVisitList').innerHTML = list.length ? list.map((p) => `<div class="row"><span>${escapeHtml(p.name)}</span><button class="btn" data-visit="${escapeHtml(p.name)}">Ghé thăm 🚪</button></div>`).join('') : '<div class="howto">Trong quán chưa có ai khác. Bạn vẫn gõ tên bạn bè để ghé phòng họ được.</div>';
  $('#homeVisitList').querySelectorAll('[data-visit]').forEach((b) => b.onclick = () => enterHome(b.dataset.visit));
  openModal('#homeModal');
}
function enterHome(name) {
  socket.emit('homeGet', { name }, (res) => {
    if (!res || !res.ok) { toast((res && res.msg) || 'Không vào được phòng này 😅'); return; }
    closeModals(); cancelGoto();
    viewing = res.home;
    home.setHome(viewing); home.setEditing(false);
    mySpace = viewing.key;
    socket.emit('homeEnter', { key: viewing.key });
    me.x = HOME_SPAWN.x; me.z = HOME_SPAWN.z; me.ry = Math.PI; camYaw = 0; camSnap = true;
    me.holding = null;
    document.body.classList.add('in-home');
    $('#homeBar').classList.remove('hidden');
    refreshHomeBar();
    sfx('coin');
    if (isOwner() && !Object.keys(viewing.slots || {}).length) setTimeout(() => toast('Phòng còn trống trơn! Bấm 🎨 Trang trí rồi chạm vào vòng tròn vàng để bày đồ nha ✨'), 600);
  });
}
function leaveHome() {
  if (!mySpace) return;
  home.setEditing(false); closeModals();
  mySpace = ''; viewing = null;
  socket.emit('homeEnter', { key: '' });
  me.x = 0; me.z = 6.2; me.ry = Math.PI; camSnap = true;
  document.body.classList.remove('in-home');
  $('#homeBar').classList.add('hidden');
}
function homeClick(cx, cy) {
  if (home.editing) { const k = home.slotAtScreen(cx, cy, camera); if (k) { openDecor(k); return; } }
  ndc.set((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const p = new THREE.Vector3();
  if (!ray.ray.intersectPlane(groundPlane, p)) return;
  if (Math.hypot(p.x - HOME_DOOR.x, p.z - HOME_DOOR.z) < 1.1) { leaveHome(); return; }
  const x = Math.max(HOME.x - HOME.hw + 0.4, Math.min(HOME.x + HOME.hw - 0.4, p.x));
  const z = Math.max(HOME.z - HOME.hd + 0.4, Math.min(HOME.z + HOME.hd - 0.4, p.z));
  startGoto(x, z, null);
}
function openDecor(slot) {
  decorSlot = slot; decorTab = slot ? 'items' : 'style';
  renderDecor(); openModal('#decorModal');
}
function renderDecor() {
  const h = myHome || {}; const decor = h.decor || {}, slots = h.slots || {};
  $('#decorTitle').innerHTML = decorSlot ? `🎨 ${SLOT_NAMES[decorSlot]} <small>Tiền bo: <b style="color:#ffd54f">${D.fmtMoney(myMoney)}</b></small>` : `🎨 Tường & sàn <small>Tiền bo: <b style="color:#ffd54f">${D.fmtMoney(myMoney)}</b></small>`;
  $('#decorTabs').innerHTML = (decorSlot ? '<button data-dt="items" class="' + (decorTab === 'items' ? 'on' : '') + '">🛋️ Đồ đạc</button>' : '') + '<button data-dt="style" class="' + (decorTab === 'style' ? 'on' : '') + '">🧱 Tường & sàn</button>';
  $('#decorTabs').querySelectorAll('[data-dt]').forEach((b) => b.onclick = () => { decorTab = b.dataset.dt; renderDecor(); });
  let html = '';
  if (decorTab === 'items' && decorSlot) {
    const type = homeSlots[decorSlot];
    const cur = slots[decorSlot];
    if (cur) html += `<div class="store-item hl"><div><b>${decorDefs[cur].icon} ${decorDefs[cur].name}</b><small>Đang bày ở đây</small></div><button class="btn" data-rm="1">Cất đi</button></div>`;
    for (const [id, d] of Object.entries(decorDefs)) {
      if (d.slot !== type || id === cur) continue;
      const have = decor[id] || 0, used = Object.entries(slots).filter(([k, v]) => v === id && k !== decorSlot).length;
      const free = have - used;
      html += `<div class="store-item decor-card"><div><span class="ic">${d.icon}</span> <b>${d.name}</b><small class="meta">${have ? `Đã có ${have} (rảnh ${Math.max(0, free)})` : 'Chưa có'} · giá ${D.fmtMoney(d.price)}</small></div>`
        + (free > 0 ? `<button class="btn primary" data-put="${id}">Bày ra</button>` : `<button class="btn" data-buy="${id}" ${myMoney < d.price ? 'disabled' : ''}>Mua ${D.fmtMoney(d.price)}</button>`) + '</div>';
    }
  } else {
    for (const kind of ['wall', 'floor']) {
      html += `<div class="cr-label">${kind === 'wall' ? '🧱 Giấy dán tường' : '🟫 Sàn nhà'}</div>`;
      for (const [id, st] of Object.entries(homeStyles[kind] || {})) {
        const ownedSt = !st.price || (h.styles || []).includes(kind + ':' + id);
        const on = h[kind] === id;
        html += `<div class="store-item ${on ? 'hl' : ''}"><div><b>${st.name}</b><small>${on ? 'Đang dùng' : ownedSt ? 'Đã có' : 'Giá ' + D.fmtMoney(st.price)}</small></div>${on ? '' : `<button class="btn ${ownedSt ? 'primary' : ''}" data-style="${kind}:${id}" ${!ownedSt && myMoney < st.price ? 'disabled' : ''}>${ownedSt ? 'Dùng' : 'Mua'}</button>`}</div>`;
      }
    }
  }
  $('#decorList').innerHTML = html;
  const after = (res) => {
    if (!res || !res.ok) { toast((res && res.msg) || 'Chưa làm được 😅'); return; }
    myHome = { ...myHome, ...res.home, score: res.score ?? (myHome && myHome.score) };
    if (res.money != null) myMoney = res.money;
    if (viewing && isOwner()) { viewing = { ...viewing, wall: myHome.wall, floor: myHome.floor, slots: { ...myHome.slots }, score: myHome.score }; home.setHome(viewing); refreshHomeBar(); }
    refreshHUD(); renderDecor();
  };
  $('#decorList').querySelectorAll('[data-buy]').forEach((b) => b.onclick = () => socket.emit('homeBuy', { id: b.dataset.buy }, (res) => {
    if (res && res.ok) { sfx('coin'); myHome = { ...myHome, ...res.home }; myMoney = res.money; socket.emit('homeSet', { slot: decorSlot, id: b.dataset.buy }, (r2) => { after(r2); if (r2 && r2.ok) { glitterAt(me.x, me.z, 30); toast('✨ Đã mua và bày ra rồi!'); } }); }
    else after(res);
  }));
  $('#decorList').querySelectorAll('[data-put]').forEach((b) => b.onclick = () => socket.emit('homeSet', { slot: decorSlot, id: b.dataset.put }, after));
  $('#decorList').querySelectorAll('[data-rm]').forEach((b) => b.onclick = () => socket.emit('homeSet', { slot: decorSlot, id: null }, after));
  $('#decorList').querySelectorAll('[data-style]').forEach((b) => b.onclick = () => { const [kind, id] = b.dataset.style.split(':'); socket.emit('homeStyle', { kind, id }, after); });
}
$('#btnHome').addEventListener('click', () => { if (mySpace) leaveHome(); else openHomeModal(); });
$('#btnGoHome').addEventListener('click', () => enterHome(myName));
$('#btnVisitName').addEventListener('click', () => { const n = $('#homeName').value.trim(); if (n) enterHome(n); });
$('#btnLeaveHome').addEventListener('click', leaveHome);
$('#btnDecor').addEventListener('click', () => {
  home.setEditing(!home.editing); refreshHomeBar();
  if (home.editing) toast('Chạm vào vòng tròn vàng để bày đồ. Muốn đổi tường & sàn thì chạm vòng ở giữa phòng nha!');
});
$('#btnLike').addEventListener('click', () => {
  if (!viewing) return;
  socket.emit('homeLike', { key: viewing.key }, (res) => {
    if (!res || !res.ok) { toast((res && res.msg) || 'Chưa thả tim được'); return; }
    viewing.likes = res.likes; refreshHomeBar(); sfx('tip');
    for (let i = 0; i < 3; i++) setTimeout(() => floater('❤️'), i * 150);
  });
});
socket.on('homeUpdate', (d) => { if (viewing && d.key === viewing.key) { viewing = d; home.setHome(d); refreshHomeBar(); } if (myHome && isOwner()) { myHome.likes = d.likes; } });
socket.on('space', ({ id, space }) => { const p = players.get(id); if (p) p.space = space || ''; });

// ================= Main loop =================
const clock = new THREE.Clock();
function loop() {
  requestAnimationFrame(loop);
  try { loopBody(); } catch (e) { reportErr(e); }
}
function loopBody() {
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
    const here = (p.space || '') === mySpace; p.char.group.visible = here; p.label.sprite.visible = here;
    try { p.char.animate(p.anim === 'walk' && !moving ? 'idle' : p.anim, t, moving || (p.anim === 'walk' ? 1 : 0), !!p.holding); p.char.setHolding(p.holding); } catch (e) { reportErr(e); }
    setStars(p.id, p.anim === 'stun', p.x, p.z);
    if (p.anim === 'qchange' && p.lastAnim !== 'qchange') glitterAt(p.x, p.z);
    p.lastAnim = p.anim;
    p.label.sprite.position.set(p.x, ((p.char.topY || 1.6) + 0.2) * ((p.app && p.app.height) || 1), p.z);
  }
  for (const e of customers.values()) {
    placeCustomer(e);
    e.label.sprite.visible = !mySpace; // nhãn chữ xuyên tường: ẩn khi đang ở phòng riêng
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
  updateFx(dt, t);
  updateGlitter(dt);
  updateCine(dt, t);
  if (mySpace) home.update(t);
  if (ghenFx) ghenFx.label.sprite.visible = !mySpace;
  for (const b of bubbles.values()) b.sprite.visible = !mySpace;
  if (marker.visible) { const s = 1 + Math.sin(t * 8) * 0.12; marker.scale.set(s, s, s); }
  myLabel.sprite.visible = camMode === 'play' && !cine;
  world.update(t, gameState.upgrades);
  updateCamera(dt);
  updatePrompt();
  setZone(mySpace ? 'lobby' : zoneAt(me.x, me.z));
  sendMove(t);
  // đèn chiếu mặt: chiếu từ trên cao xuống chéo (không chiếu thẳng xuống sàn bóng gây lóa); tủ đồ dịu hơn
  faceLight.position.copy(camera.position).add(new THREE.Vector3(0, 2.5, 0)); faceLight.target.position.set(me.x, 1.3, me.z);
  if (!darkOn) faceLight.intensity = camMode === 'creator' ? 0.45 : 0.7;
  if (composer) composer.render(); else renderer.render(scene, camera);
  afterRender();
}
camera.position.set(0, 3, 8);
camYaw = 0;
loop();
refreshStyleBadges();

// cho phép chạy thử tự động
window.__ktv = { enterHome, leaveHome, openDecor, home, get mySpace() { return mySpace; }, get myHome() { return myHome; }, get cine() { return cine; }, playRankUp, takeShot, startRec, stopRec, toggleClean, quickChange, clickTo, get goto() { return goto; }, runMinigame, me, customers, players, socket, interact, setApp, openCreator, closeCreator, openStore, get app() { return app; }, get owned() { return owned; }, get myMoney() { return myMoney; }, scene, camera, renderer };
