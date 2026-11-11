// 🏠 Phòng riêng của từng cô: một căn phòng nằm tách biệt (z ≈ 60), trang trí bằng đồ mua từ tiền bo
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const HOME = { x: 0, z: 60, hw: 5, hd: 4 }; // tâm phòng, nửa rộng, nửa sâu
export const HOME_SPAWN = { x: 0, z: 62.6 };
export const HOME_DOOR = { x: 0, z: 63.6 };
const B = HOME.z - HOME.hd, Fz = HOME.z + HOME.hd; // tường sau, tường trước
// vị trí các ô đặt đồ
export const SLOT_POS = {
  W1: { x: -3, y: 1.75, z: B + 0.12, ry: 0 }, W2: { x: 0, y: 1.9, z: B + 0.12, ry: 0 }, W3: { x: 3, y: 1.75, z: B + 0.12, ry: 0 },
  W4: { x: -HOME.hw + 0.12, y: 1.75, z: HOME.z - 0.6, ry: Math.PI / 2 },
  F1: { x: -3.6, z: B + 0.8, ry: 0 }, F2: { x: 0, z: B + 0.85, ry: 0 }, F3: { x: 3.6, z: B + 0.8, ry: 0 },
  F4: { x: -HOME.hw + 0.8, z: HOME.z + 1.2, ry: Math.PI / 2 }, F5: { x: HOME.hw - 0.8, z: HOME.z - 0.6, ry: -Math.PI / 2 },
  F6: { x: -3.6, z: Fz - 0.9, ry: Math.PI * 0.85 }, F7: { x: HOME.hw - 0.8, z: HOME.z + 2.4, ry: -Math.PI / 2 },
  R: { x: 0, z: HOME.z + 0.4, ry: 0 }, C: { x: 0, y: 2.85, z: HOME.z, ry: 0 },
};
export const SLOT_NAMES = {
  W1: 'Tường sau (trái)', W2: 'Tường sau (giữa)', W3: 'Tường sau (phải)', W4: 'Tường bên trái',
  F1: 'Góc sau trái', F2: 'Giữa tường sau', F3: 'Góc sau phải', F4: 'Sát tường trái', F5: 'Sát tường phải', F6: 'Góc trước trái', F7: 'Góc trước phải',
  R: 'Thảm giữa phòng', C: 'Trần nhà',
};

const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, ...o });
const GOLD = M('#e0b84f', { metalness: 1, roughness: 0.25 });
const CHROME = M('#eceef5', { metalness: 1, roughness: 0.1 });
const glow = (c) => new THREE.MeshBasicMaterial({ color: c });
function mesh(geo, mat, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return m; }
const rb = (w, h, d, r, mat, x, y, z) => mesh(new RoundedBoxGeometry(w, h, d, 3, r), mat, x, y, z);
const box = (w, h, d, mat, x, y, z) => mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z);
const cyl = (rt, rb_, h, mat, x, y, z, seg = 16) => mesh(new THREE.CylinderGeometry(rt, rb_, h, seg), mat, x, y, z);
const sph = (r, mat, x, y, z) => mesh(new THREE.SphereGeometry(r, 16, 12), mat, x, y, z);
function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }

// ---------- từng món đồ (dựng bằng code) ----------
// mỗi hàm trả về Group, gốc tọa độ ở sàn (hoặc mặt tường), mặt trước hướng +z
const BUILD = {
  plant() {
    const g = new THREE.Group();
    g.add(cyl(0.26, 0.2, 0.5, M('#f5f5f5', { roughness: 0.3 }), 0, 0.25, 0, 20));
    const leaf = M('#2f7d4a', { side: THREE.DoubleSide, roughness: 0.6 });
    for (let i = 0; i < 9; i++) { const l = sph(0.22, leaf, 0, 0, 0); l.scale.set(0.5, 0.12, 1.4); const a = (i / 9) * Math.PI * 2; l.position.set(Math.cos(a) * 0.25, 0.9 + (i % 3) * 0.2, Math.sin(a) * 0.25); l.rotation.set(0.5 * Math.sin(a), -a, 0.5); g.add(l); }
    return g;
  },
  bear() {
    const g = new THREE.Group(), f = M('#c98d5a', { roughness: 0.95 }), lt = M('#f1d3b0', { roughness: 0.95 });
    g.add(sph(0.38, f, 0, 0.4, 0)); g.children[0].scale.set(1, 1.05, 0.9);
    g.add(sph(0.27, f, 0, 0.95, 0.03)); g.add(sph(0.12, lt, 0, 0.9, 0.24));
    for (const s of [-1, 1]) { g.add(sph(0.1, f, s * 0.2, 1.17, 0)); g.add(sph(0.14, f, s * 0.36, 0.55, 0.12)); g.add(sph(0.15, f, s * 0.2, 0.12, 0.25)); g.add(sph(0.03, M('#111'), s * 0.09, 1.0, 0.24)); }
    const bow = M('#ff4fa3'); g.add(sph(0.07, bow, -0.07, 0.72, 0.25)); g.add(sph(0.07, bow, 0.07, 0.72, 0.25));
    return g;
  },
  shoes() {
    const g = new THREE.Group();
    for (let i = 0; i < 4; i++) g.add(box(1.0, 0.03, 0.35, M('#fafafa'), 0, 0.3 + i * 0.35, 0));
    for (const s of [-1, 1]) g.add(box(0.03, 1.4, 0.35, GOLD, s * 0.5, 0.7, 0));
    const cols = ['#e53935', '#111', '#ffd54f', '#ff4fa3', '#b388ff', '#40c4ff'];
    for (let r = 0; r < 4; r++) for (let k = 0; k < 3; k++) { const sh = rb(0.1, 0.12, 0.22, 0.04, M(cols[(r * 3 + k) % 6], { metalness: 0.3, roughness: 0.25 }), -0.32 + k * 0.32, 0.38 + r * 0.35, 0); sh.rotation.x = -0.25; g.add(sh); }
    return g;
  },
  sofa() {
    const g = new THREE.Group(), v = new THREE.MeshPhysicalMaterial({ color: '#c2185b', roughness: 0.7, sheen: 1, sheenColor: new THREE.Color('#ff8ac0') });
    g.add(rb(1.8, 0.35, 0.8, 0.12, v, 0, 0.3, 0.05)); g.add(rb(1.8, 0.7, 0.25, 0.12, v, 0, 0.7, -0.3));
    for (const s of [-1, 1]) g.add(rb(0.22, 0.55, 0.85, 0.1, v, s * 0.95, 0.42, 0.02));
    for (const s of [-1, 1]) for (const z of [-1, 1]) g.add(cyl(0.03, 0.02, 0.14, GOLD, s * 0.8, 0.07, z * 0.3));
    g.add(rb(0.4, 0.36, 0.12, 0.06, M('#ffd54f', { metalness: 0.4, roughness: 0.3 }), -0.5, 0.65, -0.12));
    return g;
  },
  mannequin() {
    const g = new THREE.Group();
    g.add(cyl(0.18, 0.2, 0.04, GOLD, 0, 0.02, 0)); g.add(cyl(0.02, 0.02, 0.6, GOLD, 0, 0.3, 0));
    const dress = new THREE.MeshPhysicalMaterial({ color: '#7b1fa2', roughness: 0.35, sheen: 1, sheenColor: new THREE.Color('#e1bee7') });
    const skirt = mesh(new THREE.ConeGeometry(0.42, 1.0, 24, 1, true), dress, 0, 0.95, 0); g.add(skirt);
    const torso = sph(0.17, dress, 0, 1.55, 0); torso.scale.set(1, 1.6, 0.75); g.add(torso);
    g.add(cyl(0.04, 0.05, 0.12, M('#f5f5f5'), 0, 1.86, 0)); g.add(sph(0.06, M('#f5f5f5'), 0, 1.95, 0));
    for (let i = 0; i < 20; i++) { const a = i * 0.9; g.add(sph(0.012, glow('#fff8e1'), Math.cos(a) * (0.2 + (i % 5) * 0.04), 0.6 + (i % 7) * 0.12, Math.sin(a) * 0.2 + 0.18)); }
    return g;
  },
  speaker() {
    const g = new THREE.Group(), blk = M('#111', { roughness: 0.35, metalness: 0.3 });
    for (const s of [-1, 1]) {
      g.add(rb(0.45, 1.2, 0.4, 0.05, blk, s * 0.45, 0.6, 0));
      for (const y of [0.35, 0.85]) { const c = mesh(new THREE.CircleGeometry(0.15, 24), M('#2a2a2a', { metalness: 0.7 }), s * 0.45, y, 0.205); g.add(c); const ring = mesh(new THREE.TorusGeometry(0.15, 0.012, 6, 24), glow('#ff4fa3'), s * 0.45, y, 0.21); g.add(ring); }
    }
    const mic = cyl(0.025, 0.02, 0.22, M('#ffd54f', { metalness: 0.9, roughness: 0.2 }), 0, 0.9, 0.05); mic.rotation.z = 0.4; g.add(mic);
    g.add(cyl(0.01, 0.01, 0.9, CHROME, 0, 0.45, 0.05));
    return g;
  },
  vanity() {
    const g = new THREE.Group(), w = M('#fafafa', { roughness: 0.3 });
    g.add(box(1.2, 0.06, 0.5, w, 0, 0.75, 0)); for (const s of [-1, 1]) g.add(box(0.35, 0.72, 0.45, w, s * 0.42, 0.37, 0));
    g.add(box(0.95, 1.05, 0.04, GOLD, 0, 1.35, -0.2)); g.add(box(0.85, 0.95, 0.02, M('#dcefff', { metalness: 1, roughness: 0.05 }), 0, 1.35, -0.17));
    for (let i = 0; i < 12; i++) { const t = i / 11; const onSide = i < 6; g.add(sph(0.035, glow('#fff3d6'), onSide ? -0.46 : 0.46, 0.9 + (onSide ? t : t - 0.5) * 0.9, -0.15)); }
    const cols = ['#e53935', '#ff4fa3', '#ffd54f', '#111']; cols.forEach((c, i) => g.add(cyl(0.025, 0.025, 0.12, M(c, { metalness: 0.5 }), -0.35 + i * 0.12, 0.84, 0.08, 10)));
    g.add(rb(0.45, 0.3, 0.4, 0.12, M('#f8bbd0', { roughness: 0.8 }), 0, 0.2, 0.55));
    return g;
  },
  wardrobe() {
    const g = new THREE.Group();
    g.add(box(1.4, 2.2, 0.55, M('#1a1a1a', { roughness: 0.25, metalness: 0.4 }), 0, 1.1, 0));
    g.add(box(1.3, 2.05, 0.02, new THREE.MeshPhysicalMaterial({ color: '#cfe8ff', transparent: true, opacity: 0.25, roughness: 0.05 }), 0, 1.1, 0.28));
    g.add(box(1.25, 0.02, 0.02, GOLD, 0, 1.95, 0.1));
    ['#e53935', '#ffd54f', '#fafafa', '#7b1fa2', '#111', '#40c4ff'].forEach((c, i) => { const d = mesh(new THREE.ConeGeometry(0.11, 0.75, 12, 1, true), M(c, { side: THREE.DoubleSide }), -0.5 + i * 0.2, 1.55, 0.05); g.add(d); });
    g.add(box(1.25, 0.02, 0.5, M('#fff'), 0, 0.55, 0)); for (let i = 0; i < 4; i++) g.add(rb(0.22, 0.18, 0.12, 0.03, M(['#ff4fa3', '#ffd54f', '#111', '#bcaaa4'][i]), -0.45 + i * 0.3, 0.66, 0.05));
    for (let i = 0; i < 10; i++) g.add(sph(0.02, glow('#fff3d6'), -0.62 + i * 0.137, 2.12, 0.25));
    return g;
  },
  minibar() {
    const g = new THREE.Group();
    g.add(rb(1.4, 1.0, 0.55, 0.05, M('#111', { roughness: 0.2, metalness: 0.5 }), 0, 0.5, 0)); g.add(box(1.45, 0.05, 0.6, GOLD, 0, 1.02, 0));
    g.add(box(1.38, 0.03, 0.02, glow('#40c4ff'), 0, 0.1, 0.28));
    const bc = ['#1b5e20', '#6d4c41', '#004d40', '#b71c1c', '#ffd54f'];
    for (let i = 0; i < 5; i++) { g.add(cyl(0.045, 0.05, 0.24, M(bc[i], { roughness: 0.05, transparent: true, opacity: 0.9 }), -0.5 + i * 0.25, 1.17, -0.1, 12)); g.add(cyl(0.018, 0.018, 0.08, M(bc[i]), -0.5 + i * 0.25, 1.32, -0.1, 8)); }
    for (let i = 0; i < 3; i++) g.add(cyl(0.035, 0.025, 0.1, M('#fff59d', { transparent: true, opacity: 0.7 }), -0.2 + i * 0.2, 1.1, 0.16, 10));
    return g;
  },
  aquarium() {
    const g = new THREE.Group();
    g.add(box(1.5, 0.6, 0.55, M('#111', { metalness: 0.4 }), 0, 0.3, 0));
    g.add(box(1.45, 0.8, 0.5, new THREE.MeshPhysicalMaterial({ color: '#4fc3f7', transparent: true, opacity: 0.35, roughness: 0.05, emissive: '#0277bd', emissiveIntensity: 0.4 }), 0, 1.0, 0));
    g.add(box(1.5, 0.04, 0.55, GOLD, 0, 1.42, 0));
    const fishes = new THREE.Group(); fishes.name = 'fish';
    ['#ff7043', '#ffd54f', '#e91e63', '#ffffff', '#ff7043'].forEach((c, i) => { const f = sph(0.05, M(c, { emissive: c, emissiveIntensity: 0.3 }), -0.5 + i * 0.25, 0.8 + (i % 3) * 0.15, (i % 2) * 0.1); f.scale.set(1.6, 1, 0.6); fishes.add(f); });
    g.add(fishes);
    for (let i = 0; i < 6; i++) { const w = mesh(new THREE.ConeGeometry(0.04, 0.4 + (i % 3) * 0.15, 6), M('#43a047'), -0.6 + i * 0.24, 0.85, -0.12); g.add(w); }
    g.userData.animate = (t) => fishes.children.forEach((f, i) => { f.position.x = Math.sin(t * 0.6 + i * 1.3) * 0.55; f.rotation.y = Math.cos(t * 0.6 + i * 1.3) > 0 ? 0 : Math.PI; });
    return g;
  },
  piano() {
    const g = new THREE.Group(), w = new THREE.MeshPhysicalMaterial({ color: '#fafafa', roughness: 0.15, clearcoat: 1 });
    const body = rb(1.5, 0.35, 1.3, 0.08, w, 0, 0.85, -0.1); g.add(body);
    const lid = box(1.45, 0.03, 1.2, w, 0, 1.25, -0.25); lid.rotation.x = 0.55; g.add(lid);
    for (const [x, z] of [[-0.6, 0.35], [0.6, 0.35], [0, -0.6]]) g.add(cyl(0.05, 0.04, 0.7, w, x, 0.35, z));
    g.add(box(1.3, 0.04, 0.18, M('#fff'), 0, 0.92, 0.6)); for (let i = 0; i < 14; i++) if (i % 7 !== 2 && i % 7 !== 6) g.add(box(0.04, 0.03, 0.1, M('#111'), -0.6 + i * 0.09 + 0.045, 0.95, 0.57));
    g.add(rb(0.7, 0.08, 0.35, 0.03, M('#111'), 0, 0.5, 1.0)); for (const s of [-1, 1]) g.add(cyl(0.025, 0.025, 0.46, CHROME, s * 0.3, 0.23, 1.0));
    return g;
  },
  // ----- treo tường (gốc ở mặt tường, hướng ra +z) -----
  poster() {
    const g = new THREE.Group();
    const tex = canvasTex(256, 340, (x, W, H) => {
      const gr = x.createLinearGradient(0, 0, W, H); gr.addColorStop(0, '#ff8ac0'); gr.addColorStop(1, '#7c4dff'); x.fillStyle = gr; x.fillRect(0, 0, W, H);
      x.fillStyle = '#ffe0cc'; x.beginPath(); x.arc(128, 150, 60, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#1a1a1a'; x.beginPath(); x.arc(128, 135, 68, Math.PI, 0); x.fill(); x.fillRect(60, 135, 20, 120); x.fillRect(176, 135, 20, 120);
      x.fillStyle = '#d81b60'; x.beginPath(); x.ellipse(128, 180, 14, 7, 0, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#111'; x.beginPath(); x.arc(106, 150, 6, 0, Math.PI * 2); x.arc(150, 150, 6, 0, Math.PI * 2); x.fill();
      x.font = 'bold 36px sans-serif'; x.textAlign = 'center'; x.fillStyle = '#fff'; x.fillText('✌️ CHỊ ĐẸP', 128, 300);
    });
    g.add(box(0.85, 1.1, 0.03, M('#fafafa'), 0, 0, 0.015)); g.add(mesh(new THREE.PlaneGeometry(0.78, 1.03), new THREE.MeshBasicMaterial({ map: tex }), 0, 0, 0.032));
    return g;
  },
  frame() {
    const g = new THREE.Group();
    const tex = canvasTex(320, 240, (x, W, H) => {
      x.fillStyle = '#f3e9dc'; x.fillRect(0, 0, W, H);
      const cs = ['#e57373', '#ffb74d', '#4db6ac', '#7986cb', '#f06292'];
      for (let i = 0; i < 14; i++) { x.globalAlpha = 0.75; x.fillStyle = cs[i % 5]; x.beginPath(); x.arc(20 + Math.random() * 280, 20 + Math.random() * 200, 18 + Math.random() * 50, 0, Math.PI * 2); x.fill(); }
      x.globalAlpha = 1; x.strokeStyle = '#222'; x.lineWidth = 4; x.beginPath(); x.moveTo(30, 180); x.bezierCurveTo(100, 60, 200, 260, 290, 70); x.stroke();
    });
    g.add(box(1.4, 1.05, 0.05, GOLD, 0, 0, 0.025)); g.add(mesh(new THREE.PlaneGeometry(1.25, 0.9), new THREE.MeshBasicMaterial({ map: tex }), 0, 0, 0.052));
    return g;
  },
  neon() {
    const g = new THREE.Group();
    const tex = canvasTex(1024, 300, (x, W, H) => { x.font = 'italic bold 170px "Be Vietnam Pro", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.shadowColor = '#ff4fa3'; x.shadowBlur = 40; x.fillStyle = '#ff4fa3'; x.fillText('Lung Linh', W / 2, H / 2); x.shadowBlur = 0; x.fillStyle = '#ffe0f0'; x.fillText('Lung Linh', W / 2, H / 2); });
    g.add(mesh(new THREE.PlaneGeometry(2.0, 0.6), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }), 0, 0, 0.03));
    return g;
  },
  mirror() {
    const g = new THREE.Group();
    g.add(rb(0.95, 1.45, 0.05, 0.03, GOLD, 0, 0, 0.025)); g.add(box(0.82, 1.32, 0.02, M('#dcefff', { metalness: 1, roughness: 0.04 }), 0, 0, 0.05));
    for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; g.add(sph(0.03, glow('#fff3d6'), Math.cos(a) * 0.45, Math.sin(a) * 0.7, 0.07)); }
    return g;
  },
  tv() {
    const g = new THREE.Group();
    g.add(box(2.4, 1.38, 0.06, M('#050505', { roughness: 0.2 }), 0, 0, 0.03));
    const tex = canvasTex(512, 288, (x, W, H) => { const gr = x.createLinearGradient(0, 0, W, H); gr.addColorStop(0, '#7c4dff'); gr.addColorStop(1, '#ff4081'); x.fillStyle = gr; x.fillRect(0, 0, W, H); x.font = 'bold 40px "Be Vietnam Pro", sans-serif'; x.textAlign = 'center'; x.fillStyle = '#fff'; x.fillText('♪ Đêm nay em lung linh ♪', W / 2, H / 2 + 14); });
    g.add(mesh(new THREE.PlaneGeometry(2.3, 1.3), new THREE.MeshBasicMaterial({ map: tex }), 0, 0, 0.065));
    return g;
  },
  bags() {
    const g = new THREE.Group();
    for (let r = 0; r < 2; r++) { g.add(box(1.6, 0.04, 0.32, M('#fafafa'), 0, -0.35 + r * 0.6, 0.16)); g.add(box(1.6, 0.02, 0.02, glow('#fff3d6'), 0, -0.37 + r * 0.6, 0.31)); }
    const cs = ['#111', '#e53935', '#f5e6c8', '#ff4fa3', '#795548', '#ffd54f'];
    for (let r = 0; r < 2; r++) for (let i = 0; i < 3; i++) {
      const c = cs[r * 3 + i], b = rb(0.34, 0.26, 0.14, 0.04, M(c, { roughness: 0.35 }), -0.5 + i * 0.5, -0.19 + r * 0.6, 0.16); g.add(b);
      const h = mesh(new THREE.TorusGeometry(0.09, 0.012, 6, 16, Math.PI), GOLD, -0.5 + i * 0.5, -0.06 + r * 0.6, 0.16); g.add(h);
    }
    return g;
  },
  // ----- thảm -----
  rugfur() { const g = new THREE.Group(); const m = mesh(new THREE.CircleGeometry(1.5, 48), M('#f7f3ee', { roughness: 1 })); m.rotation.x = -Math.PI / 2; m.position.y = 0.012; g.add(m); for (let i = 0; i < 60; i++) { const a = (i / 60) * Math.PI * 2; const tuft = sph(0.08, M('#ffffff', { roughness: 1 }), Math.cos(a) * 1.48, 0.02, Math.sin(a) * 1.48); tuft.scale.y = 0.3; g.add(tuft); } return g; },
  rugleo() {
    const g = new THREE.Group();
    const tex = canvasTex(256, 256, (x, W) => { x.fillStyle = '#d9a456'; x.fillRect(0, 0, W, W); for (let i = 0; i < 90; i++) { const px = Math.random() * W, py = Math.random() * W, r = 5 + Math.random() * 8; x.strokeStyle = '#2b1a0c'; x.lineWidth = 3; x.beginPath(); x.arc(px, py, r, 0.3, Math.PI * 1.7); x.stroke(); x.fillStyle = '#8a5a26'; x.beginPath(); x.arc(px, py, r * 0.5, 0, Math.PI * 2); x.fill(); } });
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(2, 1.4);
    const m = mesh(new THREE.PlaneGeometry(3.4, 2.4), M('#fff', { map: tex, roughness: 1 })); m.rotation.x = -Math.PI / 2; m.position.y = 0.012; g.add(m); return g;
  },
  rugred() {
    const g = new THREE.Group();
    const tex = canvasTex(256, 192, (x, W, H) => { x.fillStyle = '#7f0f1f'; x.fillRect(0, 0, W, H); x.strokeStyle = '#e0b84f'; x.lineWidth = 6; x.strokeRect(10, 10, W - 20, H - 20); x.lineWidth = 2; x.strokeRect(22, 22, W - 44, H - 44); x.fillStyle = '#e0b84f'; x.beginPath(); x.ellipse(W / 2, H / 2, 40, 26, 0, 0, Math.PI * 2); x.fill(); x.fillStyle = '#7f0f1f'; x.beginPath(); x.ellipse(W / 2, H / 2, 30, 18, 0, 0, Math.PI * 2); x.fill(); });
    const m = mesh(new THREE.PlaneGeometry(3.6, 2.6), M('#fff', { map: tex, roughness: 0.95 })); m.rotation.x = -Math.PI / 2; m.position.y = 0.012; g.add(m); return g;
  },
  // ----- trần -----
  balloons() {
    const g = new THREE.Group(), cs = ['#ff4fa3', '#ffd54f', '#40c4ff', '#b388ff', '#fafafa', '#ff8a80'];
    for (let i = 0; i < 12; i++) { const a = i * 2.4, r = 0.25 + (i % 4) * 0.12; const b = sph(0.17, M(cs[i % 6], { roughness: 0.2, metalness: 0.3 }), Math.cos(a) * r, -0.2 - (i % 3) * 0.12, Math.sin(a) * r); b.scale.y = 1.2; g.add(b); }
    return g;
  },
  disco() {
    const g = new THREE.Group(); g.add(cyl(0.01, 0.01, 0.5, CHROME, 0, -0.25, 0));
    const ball = mesh(new THREE.IcosahedronGeometry(0.32, 2), M('#ddd', { metalness: 1, roughness: 0.1, flatShading: true }), 0, -0.62, 0); g.add(ball);
    g.userData.animate = (t) => { ball.rotation.y = t * 1.2; };
    return g;
  },
  chand() {
    const g = new THREE.Group();
    const ring = mesh(new THREE.TorusGeometry(0.75, 0.03, 8, 40), GOLD, 0, -0.45, 0); ring.rotation.x = Math.PI / 2; g.add(ring);
    const ring2 = mesh(new THREE.TorusGeometry(0.45, 0.025, 8, 30), GOLD, 0, -0.75, 0); ring2.rotation.x = Math.PI / 2; g.add(ring2);
    g.add(cyl(0.012, 0.012, 0.45, GOLD, 0, -0.22, 0));
    const cr = new THREE.MeshStandardMaterial({ color: '#fff', emissive: '#fff4e0', emissiveIntensity: 0.6, roughness: 0, metalness: 0.2, transparent: true, opacity: 0.9 });
    for (let i = 0; i < 26; i++) { const inner = i >= 16, k = inner ? (i - 16) / 10 : i / 16, a = k * Math.PI * 2, r = inner ? 0.45 : 0.75; const d = mesh(new THREE.OctahedronGeometry(0.045), cr, Math.cos(a) * r, (inner ? -0.85 : -0.55) - (i % 3) * 0.07, Math.sin(a) * r); d.scale.y = 1.8; g.add(d); }
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; g.add(sph(0.05, glow('#fff1d6'), Math.cos(a) * 0.75, -0.39, Math.sin(a) * 0.75)); }
    return g;
  },
};

// ---------- tường, sàn ----------
function wallTex(style) {
  return canvasTex(256, 256, (x, W) => {
    if (style === 'pink') { x.fillStyle = '#e9a9c4'; x.fillRect(0, 0, W, W); x.strokeStyle = 'rgba(255,255,255,0.6)'; x.lineWidth = 6; for (let i = 0; i < W; i += 32) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, W); x.stroke(); } }
    else if (style === 'marble') { x.fillStyle = '#efe9e2'; x.fillRect(0, 0, W, W); x.strokeStyle = 'rgba(120,110,100,0.35)'; for (let k = 0; k < 8; k++) { x.lineWidth = 1 + Math.random() * 2; x.beginPath(); let px = Math.random() * W, py = Math.random() * W; x.moveTo(px, py); for (let j = 0; j < 10; j++) { px += (Math.random() - 0.3) * 50; py += (Math.random() - 0.5) * 50; x.lineTo(px, py); } x.stroke(); } }
    else if (style === 'gold') { x.fillStyle = '#2b1d08'; x.fillRect(0, 0, W, W); x.strokeStyle = '#e0b84f'; x.lineWidth = 3; for (let r = 20; r < 200; r += 26) { x.beginPath(); x.arc(W / 2, W, r, Math.PI, 2 * Math.PI); x.stroke(); } }
    else { x.fillStyle = '#2a1233'; x.fillRect(0, 0, W, W); x.fillStyle = '#3c1c48'; for (const [cx, cy, k] of [[128, 128, 1], [0, 0, 0.8], [256, 0, 0.8], [0, 256, 0.8], [256, 256, 0.8]]) { x.save(); x.translate(cx, cy); x.scale(k, k); x.beginPath(); x.moveTo(0, -46); x.bezierCurveTo(26, -30, 30, -6, 12, 6); x.bezierCurveTo(30, 18, 20, 40, 0, 48); x.bezierCurveTo(-20, 40, -30, 18, -12, 6); x.bezierCurveTo(-30, -6, -26, -30, 0, -46); x.fill(); x.restore(); } }
  });
}
function floorTex(style) {
  return canvasTex(256, 256, (x, W) => {
    if (style === 'carpet') { x.fillStyle = '#e48aae'; x.fillRect(0, 0, W, W); for (let i = 0; i < 4000; i++) { x.fillStyle = `rgba(255,255,255,${Math.random() * 0.08})`; x.fillRect(Math.random() * W, Math.random() * W, 2, 2); } }
    else if (style === 'checker') { for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { x.fillStyle = (i + j) % 2 ? '#111' : '#f5f5f5'; x.fillRect(i * 64, j * 64, 64, 64); } }
    else if (style === 'marble') { x.fillStyle = '#f2eee9'; x.fillRect(0, 0, W, W); x.strokeStyle = 'rgba(140,130,120,0.3)'; for (let k = 0; k < 7; k++) { x.lineWidth = 1 + Math.random() * 2; x.beginPath(); let px = Math.random() * W, py = Math.random() * W; x.moveTo(px, py); for (let j = 0; j < 10; j++) { px += (Math.random() - 0.3) * 50; py += (Math.random() - 0.5) * 50; x.lineTo(px, py); } x.stroke(); } x.strokeStyle = '#d8cfc4'; x.lineWidth = 2; x.strokeRect(0, 0, W, W); }
    else { for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#8d5b3a' : '#9c6844'; x.fillRect(0, i * 32, W, 32); x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(0, i * 32, W, 2); x.fillRect(((i * 97) % W), i * 32, 2, 32); } }
  });
}

export function buildHome(scene, colliders) {
  const root = new THREE.Group(); scene.add(root);
  const { x: X, z: Z, hw, hd } = HOME;
  // vỏ đen bao quanh để không nhìn thấy quán ở xa
  const shell = mesh(new THREE.BoxGeometry(34, 16, 34), new THREE.MeshBasicMaterial({ color: '#0a0510', side: THREE.BackSide, fog: false }), X, 6, Z); root.add(shell);
  // sàn
  const floorMat = new THREE.MeshStandardMaterial({ roughness: 0.45 });
  const floor = mesh(new THREE.PlaneGeometry(hw * 2, hd * 2), floorMat, X, 0.002, Z); floor.rotation.x = -Math.PI / 2; root.add(floor);
  // tường
  const wallMat = new THREE.MeshStandardMaterial({ roughness: 0.8 });
  const H = 3;
  const walls = [[X, Z - hd, hw * 2, 0.2], [X - hw, Z, 0.2, hd * 2], [X + hw, Z, 0.2, hd * 2]];
  for (const [cx, cz, w, d] of walls) {
    root.add(box(w, H, d, wallMat, cx, H / 2, cz));
    root.add(box(w + 0.02, 0.12, d + 0.02, GOLD, cx, 0.06, cz));
    root.add(box(w + 0.02, 0.06, d + 0.02, GOLD, cx, H, cz));
    colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2, top: H });
  }
  // tường trước thấp (để camera nhìn vào) + cửa về quán
  for (const s of [-1, 1]) { const w = hw - 1; const cx = X + s * (1 + w / 2); root.add(box(w, 0.9, 0.2, wallMat, cx, 0.45, Z + hd)); root.add(box(w, 0.05, 0.24, GOLD, cx, 0.92, Z + hd)); colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: Z + hd - 0.1, maxZ: Z + hd + 0.1, top: 0.9 }); }
  const doorTex = canvasTex(512, 128, (x, W, Hh) => { x.font = 'bold 64px "Be Vietnam Pro", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.shadowColor = '#69f0ae'; x.shadowBlur = 20; x.fillStyle = '#69f0ae'; x.fillText('🚪 VỀ QUÁN', W / 2, Hh / 2); });
  const doorGlow = mesh(new THREE.PlaneGeometry(2, 0.06), glow('#69f0ae'), X, 0.02, Z + hd); doorGlow.rotation.x = -Math.PI / 2; root.add(doorGlow);
  const doorSign = mesh(new THREE.PlaneGeometry(1.6, 0.4), new THREE.MeshBasicMaterial({ map: doorTex, transparent: true }), X, 0.35, Z + hd + 0.05); doorSign.rotation.x = -0.6; root.add(doorSign);
  // biển tên chủ phòng trên tường sau
  const nameCanvas = document.createElement('canvas'); nameCanvas.width = 1024; nameCanvas.height = 160;
  const nameTex = new THREE.CanvasTexture(nameCanvas); nameTex.colorSpace = THREE.SRGBColorSpace;
  const nameSign = mesh(new THREE.PlaneGeometry(4.2, 0.65), new THREE.MeshBasicMaterial({ map: nameTex, transparent: true }), X, 2.72, Z - hd + 0.13); root.add(nameSign);
  // đèn
  const L1 = new THREE.PointLight('#ffe7d1', 7, 14, 1.5); L1.position.set(X, 2.7, Z); root.add(L1);
  // ô đặt đồ: vòng tròn phát sáng khi đang trang trí
  const markers = {};
  const ringMat = new THREE.MeshBasicMaterial({ color: '#ffd54f', transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false });
  const plusTex = canvasTex(128, 128, (x) => { x.fillStyle = 'rgba(255,213,79,0.9)'; x.beginPath(); x.arc(64, 64, 56, 0, Math.PI * 2); x.fill(); x.fillStyle = '#3a2400'; x.font = 'bold 90px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('+', 64, 70); });
  for (const [k, p] of Object.entries(SLOT_POS)) {
    const g = new THREE.Group();
    const isFloor = !k.startsWith('W') && k !== 'C';
    const ring = mesh(new THREE.RingGeometry(0.45, 0.55, 40), ringMat);
    if (isFloor) { ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; } else { ring.rotation.y = p.ry; }
    g.add(ring);
    const plus = new THREE.Sprite(new THREE.SpriteMaterial({ map: plusTex, depthTest: false, transparent: true })); plus.scale.set(0.45, 0.45, 1); plus.position.y = isFloor ? 0.6 : 0; plus.renderOrder = 5; g.add(plus);
    g.position.set(X + p.x, p.y ?? 0, p.z);
    g.visible = false; root.add(g); markers[k] = g;
  }
  const items = {}; const itemCols = {};
  let editing = false;
  function setItem(slot, id) {
    if (items[slot]) { root.remove(items[slot]); items[slot] = null; }
    const ci = colliders.indexOf(itemCols[slot]); if (ci >= 0) colliders.splice(ci, 1); itemCols[slot] = null;
    if (!id || !BUILD[id]) return;
    const p = SLOT_POS[slot]; const g = BUILD[id]();
    g.position.set(X + p.x, p.y ?? 0, p.z); g.rotation.y = p.ry;
    if (slot === 'C') g.position.y = 3.0;
    root.add(g); items[slot] = g;
    if (slot.startsWith('F')) { const c = { minX: X + p.x - 0.55, maxX: X + p.x + 0.55, minZ: p.z - 0.45, maxZ: p.z + 0.45, top: 1 }; colliders.push(c); itemCols[slot] = c; }
  }
  let cur = null;
  function setHome(h) {
    const prev = cur; cur = h;
    if (!prev || prev.wall !== h.wall) { const t = wallTex(h.wall); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(5, 2); wallMat.map = t; wallMat.color.set('#fff'); wallMat.needsUpdate = true; }
    if (!prev || prev.floor !== h.floor) { const t = floorTex(h.floor); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(h.floor === 'checker' ? 5 : 4, h.floor === 'checker' ? 4 : 3); floorMat.map = t; floorMat.roughness = h.floor === 'marble' || h.floor === 'checker' ? 0.3 : 0.6; floorMat.color.set(h.floor === 'marble' ? '#d9d2ca' : '#ffffff'); floorMat.needsUpdate = true; }
    for (const k of Object.keys(SLOT_POS)) { const id = (h.slots || {})[k] || null; if (!prev || (prev.slots || {})[k] !== id) setItem(k, id); }
    // biển tên
    const c = nameCanvas.getContext('2d'); c.clearRect(0, 0, 1024, 160);
    c.font = 'bold 84px "Be Vietnam Pro", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.shadowColor = '#ff4fa3'; c.shadowBlur = 24; c.fillStyle = '#ffd1e8'; c.fillText(`✨ Phòng của ${h.owner} ✨`, 512, 80);
    nameTex.needsUpdate = true;
  }
  function setEditing(on) { editing = on; for (const [k, m] of Object.entries(markers)) m.visible = on; }
  // tìm ô gần điểm bấm trên màn hình
  function slotAtScreen(cx, cy, camera) {
    if (!editing) return null;
    let best = null, bd = 60;
    const v = new THREE.Vector3();
    for (const [k, m] of Object.entries(markers)) {
      v.copy(m.position); if (!k.startsWith('W') && k !== 'C') v.y = 0.3;
      v.project(camera); if (v.z > 1) continue;
      const sx = (v.x + 1) / 2 * innerWidth, sy = (1 - v.y) / 2 * innerHeight;
      const d = Math.hypot(sx - cx, sy - cy); if (d < bd) { bd = d; best = k; }
    }
    return best;
  }
  function update(t) {
    for (const g of Object.values(items)) if (g && g.userData.animate) g.userData.animate(t);
    if (editing) for (const m of Object.values(markers)) m.children[0].material.opacity = 0.55 + Math.sin(t * 5) * 0.3;
  }
  return { root, setHome, setEditing, slotAtScreen, update, get editing() { return editing; } };
}
