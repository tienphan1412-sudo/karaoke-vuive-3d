// Quán KTV Lung Linh: sảnh, quầy bar, phòng thay đồ, 3 phòng thường + 1 phòng VIP
// Bản "sang chảnh": sàn đá cẩm thạch bóng, giấy dán tường hoa văn, sofa nhung bo tròn,
// bàn đá viền vàng, đèn chùm pha lê, cây cảnh, ghế lounge. Vị trí tường/ghế giữ nguyên như cũ.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const ROOM_DEFS = [
  { id: 0, name: 'Phòng 101', cx: -13, cz: -11, dir: 1, hw: 6, hd: 5, color: '#ff4fa3', seats: 2 },
  { id: 1, name: 'Phòng 102', cx: 0, cz: -11, dir: 1, hw: 6, hd: 5, color: '#40c4ff', seats: 2 },
  { id: 2, name: 'Phòng 103', cx: 13, cz: -11, dir: 1, hw: 6, hd: 5, color: '#b388ff', seats: 2 },
  { id: 3, name: 'Phòng VIP', cx: 0, cz: 14, dir: -1, hw: 8, hd: 6, color: '#ffd54f', seats: 3, vip: true },
];
export const BAR = { x: -16.5, z: 4.2 };
export const MIRROR = { x: 16.5, z: 4.2 };
export const EXIT = { x: -18.3, z: -3.5 };
export const BREAKER = { x: 18.3, z: -4.5 };
export const SHOPSPOT = { x: 16.8, z: 0.4 };
// cột múa: 1 cột trong mỗi phòng + 1 sân khấu ở sảnh
export const POLES = [
  { x: -13 + 3.4, z: -11 + 1.0, roomId: 0 },
  { x: 0 + 3.4, z: -11 + 1.0, roomId: 1 },
  { x: 13 + 3.4, z: -11 + 1.0, roomId: 2 },
  { x: 0 + 4.6, z: 14 - 1.2, roomId: 3 },
  { x: -7.5, z: 1.5, roomId: null },
];

// vị trí ghế khách
export function seatTransform(roomId, seat) {
  const r = ROOM_DEFS[roomId];
  const back = r.cz - r.dir * r.hd;
  const offs = r.seats === 3 ? [-2.6, 0, 2.6] : [-1.5, 1.5];
  return { x: r.cx + offs[seat], z: back + r.dir * 1.25, ry: r.dir === 1 ? 0 : Math.PI };
}

function textTexture(text, { w = 1024, h = 256, color = '#ff4fa3', font = 'bold 150px "Be Vietnam Pro", sans-serif', glow = 30, bg = null } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h); }
  ctx.font = font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = color; ctx.shadowBlur = glow;
  ctx.fillStyle = color; ctx.fillText(text, w / 2, h / 2);
  ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.7; ctx.fillText(text, w / 2, h / 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ===================== HỌA TIẾT VẼ BẰNG CODE =====================
function canvasTex(size, draw, repeat = [1, 1], srgb = true) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
function rng(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
// đá cẩm thạch tối có vân + ron vàng
function marbleTex(base, vein, gold, seed = 3) {
  return canvasTex(512, (ctx, S) => {
    const R = rng(seed);
    ctx.fillStyle = base; ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < 2600; i++) { ctx.fillStyle = `rgba(255,255,255,${R() * 0.025})`; ctx.fillRect(R() * S, R() * S, 2 + R() * 6, 2 + R() * 6); }
    ctx.lineCap = 'round';
    for (let k = 0; k < 9; k++) {
      ctx.strokeStyle = vein; ctx.globalAlpha = 0.15 + R() * 0.35; ctx.lineWidth = 0.6 + R() * 2.2;
      let x = R() * S, y = R() * S; ctx.beginPath(); ctx.moveTo(x, y);
      for (let j = 0; j < 14; j++) { x += (R() - 0.3) * 70; y += (R() - 0.5) * 70; ctx.lineTo(x, y); }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    if (gold) { ctx.strokeStyle = gold; ctx.globalAlpha = 0.7; ctx.lineWidth = 2; ctx.strokeRect(1, 1, S - 2, S - 2); ctx.globalAlpha = 1; }
  });
}
// giấy dán tường hoa văn damask
function damaskTex(bg, fg) {
  return canvasTex(256, (ctx, S) => {
    ctx.fillStyle = bg; ctx.fillRect(0, 0, S, S);
    ctx.fillStyle = fg;
    const motif = (cx, cy, k) => {
      ctx.save(); ctx.translate(cx, cy); ctx.scale(k, k);
      ctx.beginPath();
      ctx.moveTo(0, -46); ctx.bezierCurveTo(26, -30, 30, -6, 12, 6); ctx.bezierCurveTo(30, 18, 20, 40, 0, 48);
      ctx.bezierCurveTo(-20, 40, -30, 18, -12, 6); ctx.bezierCurveTo(-30, -6, -26, -30, 0, -46); ctx.fill();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath(); ctx.ellipse(0, -14, 6, 14, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(0, 22, 5, 11, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(s * 34, -40, 5, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(s * 34, 42, 5, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    };
    motif(S / 2, S / 2, 1); motif(0, 0, 0.8); motif(S, 0, 0.8); motif(0, S, 0.8); motif(S, S, 0.8);
  }, [1, 1]);
}
// nhung bọc nút (chesterfield) cho mảng tường sau sofa
function tuftTex(color) {
  return canvasTex(256, (ctx, S) => {
    ctx.fillStyle = color; ctx.fillRect(0, 0, S, S);
    const n = 4, d = S / n;
    for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) {
      const x = i * d + ((j % 2) ? d / 2 : 0), y = j * d;
      const g = ctx.createRadialGradient(x, y, 2, x, y, d * 0.75);
      g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(0.25, 'rgba(0,0,0,0.12)'); g.addColorStop(0.6, 'rgba(255,255,255,0.10)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, d * 0.75, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#d4af37'; ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
    }
  }, [1, 1]);
}
// thảm hoa văn art-deco
function carpetTex(bg, line, accent) {
  return canvasTex(256, (ctx, S) => {
    ctx.fillStyle = bg; ctx.fillRect(0, 0, S, S);
    ctx.strokeStyle = line; ctx.lineWidth = 3; ctx.globalAlpha = 0.28;
    for (let r = 20; r < 180; r += 22) { ctx.beginPath(); ctx.arc(S / 2, S, r, Math.PI, 2 * Math.PI); ctx.stroke(); }
    ctx.beginPath(); ctx.arc(0, 0, 60, 0, Math.PI / 2); ctx.stroke(); ctx.beginPath(); ctx.arc(S, 0, 60, Math.PI / 2, Math.PI); ctx.stroke();
    ctx.globalAlpha = 0.55; ctx.fillStyle = accent;
    ctx.beginPath(); ctx.moveTo(S / 2, S / 2 - 18); ctx.lineTo(S / 2 + 12, S / 2); ctx.lineTo(S / 2, S / 2 + 18); ctx.lineTo(S / 2 - 12, S / 2); ctx.fill();
    for (let i = 0; i < 1800; i++) { ctx.globalAlpha = 0.05; ctx.fillStyle = i % 2 ? '#000' : '#fff'; ctx.fillRect(Math.random() * S, Math.random() * S, 2, 2); }
  }, [1, 1]);
}

// điện thoại: dùng vật liệu đơn giản cho nhẹ (bỏ hiệu ứng nhung, phủ bóng, trong suốt khúc xạ)
const PHYS_ONLY = ['sheen', 'sheenColor', 'sheenRoughness', 'clearcoat', 'clearcoatRoughness', 'transmission'];
let LITE = false;
function phys(o) {
  if (!LITE) return new THREE.MeshPhysicalMaterial(o);
  const q = { ...o }; PHYS_ONLY.forEach((k) => delete q[k]);
  return new THREE.MeshStandardMaterial(q);
}

export function buildWorld(scene, opts = {}) {
  LITE = !!opts.lite;
  const colliders = [];
  const roomLights = [];
  const discoBalls = [];
  const sparkles = []; // pha lê đèn chùm lấp lánh

  // ---------- vật liệu dùng chung ----------
  const gold = new THREE.MeshStandardMaterial({ color: '#e0b84f', metalness: 1, roughness: 0.22 });
  const chrome = new THREE.MeshStandardMaterial({ color: '#eceef5', metalness: 1, roughness: 0.1 });
  const wallTex = damaskTex('#2a1233', '#3c1c48'); wallTex.repeat.set(1, 1);
  const wallMat = new THREE.MeshStandardMaterial({ color: '#ffffff', map: wallTex, roughness: 0.8 });
  const wainMat = new THREE.MeshStandardMaterial({ color: '#170a1d', roughness: 0.45, metalness: 0.2 });
  const glassMat = phys({ color: '#c9e8ff', transparent: true, opacity: 0.1, roughness: 0.05, metalness: 0.1, depthWrite: false, envMapIntensity: 0.25 });
  const velvet = (c) => phys({ color: c, roughness: 0.75, sheen: 1, sheenColor: new THREE.Color(c).offsetHSL(0, 0, 0.25), sheenRoughness: 0.4 });
  const sofaCols = ['#8a1c4f', '#123f66', '#43207a', '#6b4a06'];
  const sofaMats = sofaCols.map(velvet);
  const marbleTop = phys({ map: marbleTex('#cfc4b8', '#7d7366', null, 7), roughness: 0.2, envMapIntensity: 0.6, clearcoat: 1, clearcoatRoughness: 0.08 });
  const blackMarble = phys({ map: marbleTex('#131016', '#7a6a8a', null, 11), roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.1 });

  function addMesh(geo, mat, x, y, z) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); scene.add(m); return m; }
  function box(w, h, d, mat, x, y, z, collide = false) {
    const m = addMesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z);
    let col = null;
    if (collide) { col = { minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, top: y + h / 2, glass: mat === glassMat }; colliders.push(col); }
    return { mesh: m, col };
  }
  function rbox(w, h, d, r, mat, x, y, z) { return addMesh(new RoundedBoxGeometry(w, h, d, 3, r), mat, x, y, z); }
  function collideRect(x, z, w, d, top = 1) { colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, top }); }
  // tường có giấy dán tường + chân tường gỗ tối + nẹp vàng
  function wall(x1, z1, x2, z2, h = 3, mat = wallMat) {
    const T = 0.2;
    const w = Math.max(Math.abs(x2 - x1), T), d = Math.max(Math.abs(z2 - z1), T);
    const cx = (x1 + x2) / 2, cz = (z1 + z2) / 2;
    if (mat !== wallMat) return box(w, h, d, mat, cx, h / 2, cz, true);
    const len = Math.max(w, d);
    const m = new THREE.MeshStandardMaterial({ color: '#fff', map: wallTex.clone(), roughness: 0.8 });
    m.map.needsUpdate = true; m.map.repeat.set(len / 1.4, h / 1.4);
    const res = box(w, h, d, m, cx, h / 2, cz, true);
    // chân tường + nẹp
    box(w + 0.02, 0.9, d + 0.02, wainMat, cx, 0.45, cz);
    box(w + 0.04, 0.05, d + 0.04, gold, cx, 0.92, cz);
    box(w + 0.04, 0.06, d + 0.04, gold, cx, h - 0.03, cz);
    return res;
  }
  function neonLine(x1, z1, x2, z2, y, color) {
    const w = Math.max(Math.abs(x2 - x1), 0.05), d = Math.max(Math.abs(z2 - z1), 0.05);
    box(w, 0.05, d, new THREE.MeshBasicMaterial({ color }), (x1 + x2) / 2, y, (z1 + z2) / 2);
  }
  function plane(w, h, tex, x, y, z, ry = 0, basic = true) {
    const mat = basic ? new THREE.MeshBasicMaterial({ map: tex, transparent: true }) : new THREE.MeshStandardMaterial({ map: tex });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.set(x, y, z); m.rotation.y = ry; scene.add(m);
    return m;
  }
  function floorRect(w, d, mat, x, z, y = 0.004) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
    m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); scene.add(m); return m;
  }
  // ---- đồ trang trí nhỏ ----
  const bottleProfile = [[0, 0], [0.05, 0], [0.055, 0.02], [0.055, 0.17], [0.03, 0.22], [0.018, 0.25], [0.018, 0.31], [0, 0.31]].map(([x, y]) => new THREE.Vector2(x, y));
  const bottleGeo = new THREE.LatheGeometry(bottleProfile, 14);
  const bottleMats = ['#1b5e20', '#2e7d32', '#6d4c41', '#004d40'].map((c) => phys({ color: c, roughness: 0.05, transmission: 0.3, transparent: true, opacity: 0.92, clearcoat: 1 }));
  const glassGeo = new THREE.CylinderGeometry(0.035, 0.028, 0.1, 12, 1, true);
  const drinkMat = phys({ color: '#ffcc66', roughness: 0.1, transparent: true, opacity: 0.75 });
  function bottle(x, z, y, k = 0) { addMesh(bottleGeo, bottleMats[k % bottleMats.length], x, y, z); }
  function plant(x, z, s = 1) {
    const pot = addMesh(new THREE.CylinderGeometry(0.28 * s, 0.2 * s, 0.55 * s, 18), new THREE.MeshStandardMaterial({ color: '#111', metalness: 0.5, roughness: 0.3 }), x, 0.275 * s, z);
    addMesh(new THREE.TorusGeometry(0.28 * s, 0.02, 6, 24), gold, x, 0.55 * s, z).rotation.x = Math.PI / 2;
    const leaf = new THREE.MeshStandardMaterial({ color: '#2f7d4a', roughness: 0.6, side: THREE.DoubleSide });
    for (let i = 0; i < 9; i++) {
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.22 * s, 8, 6), leaf);
      l.scale.set(0.35, 1.6, 0.12);
      const a = (i / 9) * Math.PI * 2;
      l.position.set(x + Math.cos(a) * 0.12 * s, 0.95 * s + (i % 3) * 0.12 * s, z + Math.sin(a) * 0.12 * s);
      l.rotation.set(Math.sin(a) * 0.6, a, Math.cos(a) * 0.6);
      scene.add(l);
    }
    collideRect(x, z, 0.6 * s, 0.6 * s, 1.2 * s);
    return pot;
  }
  function chandelier(x, y, z, r = 1, color = '#fff2d6', withLight = false) {
    const ring = addMesh(new THREE.TorusGeometry(r, 0.03, 8, 40), gold, x, y, z); ring.rotation.x = Math.PI / 2;
    const ring2 = addMesh(new THREE.TorusGeometry(r * 0.55, 0.025, 8, 30), gold, x, y - 0.35, z); ring2.rotation.x = Math.PI / 2;
    addMesh(new THREE.CylinderGeometry(0.015, 0.015, 1.2, 6), gold, x, y + 0.6, z);
    const crystal = phys({ color: '#ffffff', roughness: 0, metalness: 0, transmission: 0.6, transparent: true, opacity: 0.85, clearcoat: 1, emissive: '#fff4e0', emissiveIntensity: 0.25 });
    const drop = new THREE.OctahedronGeometry(0.045, 0);
    const n = Math.round(22 * r), n2 = Math.round(12 * r);
    const inst = new THREE.InstancedMesh(drop, crystal, n + n2);
    const mtx = new THREE.Matrix4();
    for (let i = 0; i < n + n2; i++) {
      const inner = i >= n, k = inner ? (i - n) / n2 : i / n;
      const a = k * Math.PI * 2, rr = inner ? r * 0.55 : r;
      const yy = (inner ? y - 0.35 : y) - 0.12 - (i % 3) * 0.09;
      mtx.compose(new THREE.Vector3(x + Math.cos(a) * rr, yy, z + Math.sin(a) * rr), new THREE.Quaternion(), new THREE.Vector3(1, 1.8, 1));
      inst.setMatrixAt(i, mtx);
    }
    scene.add(inst); sparkles.push(inst);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      addMesh(new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshBasicMaterial({ color }), x + Math.cos(a) * r, y + 0.07, z + Math.sin(a) * r);
    }
    if (!withLight) return null; // đèn thật tốn hiệu năng: chỉ đèn chùm chính mới phát sáng thật
    const L = new THREE.PointLight(color, 10 * r, 12, 1.7); L.position.set(x, y - 0.4, z); scene.add(L);
    return L;
  }
  function lounge(x, z, ry, mat) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
    const seat = new THREE.Mesh(new RoundedBoxGeometry(0.9, 0.38, 0.85, 3, 0.12), mat); seat.position.y = 0.32; g.add(seat);
    const back = new THREE.Mesh(new RoundedBoxGeometry(0.9, 0.62, 0.22, 3, 0.1), mat); back.position.set(0, 0.68, -0.34); back.rotation.x = -0.15; g.add(back);
    for (const s of [-1, 1]) { const arm = new THREE.Mesh(new RoundedBoxGeometry(0.18, 0.5, 0.85, 3, 0.08), mat); arm.position.set(s * 0.48, 0.45, 0); g.add(arm); }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.02, 0.14, 8), gold); l.position.set(sx * 0.4, 0.07, sz * 0.35); g.add(l); }
    collideRect(x, z, 1.1, 1.1, 0.9);
  }
  function sideTable(x, z) {
    addMesh(new THREE.CylinderGeometry(0.38, 0.38, 0.04, 28), blackMarble, x, 0.56, z);
    addMesh(new THREE.CylinderGeometry(0.03, 0.03, 0.54, 10), gold, x, 0.28, z);
    addMesh(new THREE.CylinderGeometry(0.22, 0.25, 0.03, 20), gold, x, 0.015, z);
    addMesh(glassGeo, drinkMat, x + 0.1, 0.63, z);
    collideRect(x, z, 0.76, 0.76, 0.6);
  }

  // ---------- sàn ----------
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: '#0c0610', roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.01; scene.add(ground);
  {
    const t = marbleTex('#1a0e20', '#a07cc0', '#c9a24a', 5); t.repeat.set(19, 7);
    const lobby = new THREE.Mesh(new THREE.PlaneGeometry(38, 14), phys({ map: t, roughness: 0.32, metalness: 0.05, clearcoat: 0.8, clearcoatRoughness: 0.3 }));
    lobby.rotation.x = -Math.PI / 2; lobby.position.set(0, 0, 1); scene.add(lobby);
    // thảm đỏ từ phòng VIP ra giữa sảnh
    const red = new THREE.MeshStandardMaterial({ map: carpetTex('#6d0f1f', '#e0b84f', '#ffd54f'), roughness: 0.95 });
    red.map.repeat.set(1, 5);
    floorRect(2.6, 9, red, 0, 3.5, 0.006);
    box(0.05, 0.012, 9, gold, -1.32, 0.008, 3.5); box(0.05, 0.012, 9, gold, 1.32, 0.008, 3.5);
  }

  // ---------- tường sảnh ----------
  wall(-19, -6, -19, 8);
  wall(19, -6, 19, 8);
  wall(-19, 8, -8, 8);
  wall(8, 8, 19, 8);
  neonLine(-18.88, -6, -18.88, 8, 2.95, '#ff4fa3');
  neonLine(18.88, -6, 18.88, 8, 2.95, '#40c4ff');
  // trụ vàng hai bên cửa VIP
  for (const s of [-1, 1]) {
    addMesh(new THREE.CylinderGeometry(0.22, 0.26, 3, 20), blackMarble, s * 1.75, 1.5, 7.9);
    addMesh(new THREE.TorusGeometry(0.24, 0.035, 8, 24), gold, s * 1.75, 0.3, 7.9).rotation.x = Math.PI / 2;
    addMesh(new THREE.TorusGeometry(0.24, 0.035, 8, 24), gold, s * 1.75, 2.85, 7.9).rotation.x = Math.PI / 2;
  }

  // ---------- màn hình karaoke dùng chung ----------
  const tvCanvas = document.createElement('canvas'); tvCanvas.width = 512; tvCanvas.height = 288;
  const tvCtx = tvCanvas.getContext('2d');
  const tvTex = new THREE.CanvasTexture(tvCanvas); tvTex.colorSpace = THREE.SRGBColorSpace;
  const LYRICS = ['♪ La la la... đêm nay vui quá ♪', '♪ Dzô dzô dzô, trăm phần trăm ♪', '♪ Hát cho hết mình, bo cho hết ví ♪', '♪ Ú òa ú òa... ♪'];
  function drawTV(t) {
    const g = tvCtx.createLinearGradient(0, 0, 512, 288);
    const hue = (t * 20) % 360;
    g.addColorStop(0, `hsl(${hue},70%,25%)`); g.addColorStop(1, `hsl(${(hue + 80) % 360},70%,15%)`);
    tvCtx.fillStyle = g; tvCtx.fillRect(0, 0, 512, 288);
    tvCtx.fillStyle = 'rgba(255,255,255,0.08)';
    for (let i = 0; i < 6; i++) { tvCtx.beginPath(); tvCtx.arc((i * 97 + t * 40) % 560, 80 + Math.sin(t + i) * 40, 30 + i * 6, 0, Math.PI * 2); tvCtx.fill(); }
    tvCtx.font = 'bold 34px "Be Vietnam Pro", sans-serif'; tvCtx.textAlign = 'center';
    tvCtx.fillStyle = '#ffd54f'; tvCtx.fillText('KTV LUNG LINH', 256, 50);
    const idx = Math.floor(t / 4) % LYRICS.length;
    const line = LYRICS[idx];
    const prog = (t % 4) / 4;
    tvCtx.font = 'bold 26px "Be Vietnam Pro", sans-serif';
    const w = tvCtx.measureText(line).width;
    const x0 = 256 - w / 2;
    tvCtx.textAlign = 'left';
    tvCtx.fillStyle = '#fff'; tvCtx.fillText(line, x0, 220);
    tvCtx.save(); tvCtx.beginPath(); tvCtx.rect(x0, 190, w * prog, 40); tvCtx.clip();
    tvCtx.fillStyle = '#40c4ff'; tvCtx.fillText(line, x0, 220); tvCtx.restore();
    tvTex.needsUpdate = true;
  }

  // ---------- các phòng ----------
  const carpetStyles = [['#2a0a1f', '#ff79b8', '#e0b84f'], ['#081a30', '#66d4ff', '#e0b84f'], ['#1b0c30', '#c49bff', '#e0b84f'], ['#140e05', '#e0b84f', '#fff1c1']];
  for (const r of ROOM_DEFS) {
    const back = r.cz - r.dir * r.hd, front = r.cz + r.dir * r.hd;
    const x1 = r.cx - r.hw, x2 = r.cx + r.hw;
    const face = r.dir === 1 ? 0 : Math.PI;
    // thảm hoa văn
    const ct = carpetTex(...carpetStyles[r.id]); ct.repeat.set(r.hw / 1.5, r.hd / 1.5);
    floorRect(r.hw * 2, r.hd * 2, new THREE.MeshStandardMaterial({ map: ct, roughness: 0.95 }), r.cx, r.cz, 0.005);
    // tường
    wall(x1, back, x2, back);
    wall(x1, back, x1, front);
    wall(x2, back, x2, front);
    wall(x1, front, r.cx - 1.5, front, 2.4, glassMat);
    wall(r.cx + 1.5, front, x2, front, 2.4, glassMat);
    // khung vàng cho vách kính + khung cửa
    for (const [a, b] of [[x1, r.cx - 1.5], [r.cx + 1.5, x2]]) {
      box(b - a, 0.06, 0.08, gold, (a + b) / 2, 2.4, front);
      box(b - a, 0.06, 0.08, gold, (a + b) / 2, 0.03, front);
      for (let x = a; x <= b + 0.01; x += (b - a) / 3) box(0.06, 2.4, 0.08, gold, x, 1.2, front);
    }
    neonLine(x1, back + r.dir * 0.12, x2, back + r.dir * 0.12, 2.92, r.color);
    neonLine(x1, front, r.cx - 1.5, front, 2.46, r.color);
    neonLine(r.cx + 1.5, front, x2, front, 2.46, r.color);
    // bảng tên phòng trên cửa
    const sign = plane(3, 0.75, textTexture(r.name, { color: r.color, font: 'bold 120px "Be Vietnam Pro", sans-serif', w: 1024, h: 256 }), r.cx, 2.75, front + r.dir * 0.12, face);
    sign.renderOrder = 2;
    // mảng tường nhung bọc nút sau sofa + khung vàng
    const sw = r.hw * 2 - 2.5;
    const tm = phys({ map: tuftTex(sofaCols[r.id]), roughness: 0.7, sheen: 1, sheenColor: new THREE.Color(sofaCols[r.id]).offsetHSL(0, 0, 0.3) });
    tm.map.repeat.set(sw / 0.9, 2.0 / 0.9);
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(sw + 0.6, 2.0), tm);
    panel.position.set(r.cx, 1.55, back + r.dir * 0.115); panel.rotation.y = face; scene.add(panel);
    box(sw + 0.7, 0.06, 0.05, gold, r.cx, 2.56, back + r.dir * 0.12);
    box(sw + 0.7, 0.06, 0.05, gold, r.cx, 0.54, back + r.dir * 0.12);
    // sofa nhung bo tròn (va chạm giữ như cũ)
    const sm = sofaMats[r.id];
    rbox(sw, 0.36, 0.9, 0.12, sm, r.cx, 0.27, back + r.dir * 1.2);
    colliders.push({ minX: r.cx - sw / 2, maxX: r.cx + sw / 2, minZ: back + r.dir * 1.2 - 0.45, maxZ: back + r.dir * 1.2 + 0.45, top: 0.45 });
    if (r.dir === -1) { const c = colliders[colliders.length - 1]; const a = c.minZ, b = c.maxZ; c.minZ = Math.min(a, b); c.maxZ = Math.max(a, b); }
    const backrest = rbox(sw, 0.85, 0.3, 0.12, sm, r.cx, 0.6, back + r.dir * 0.62); backrest.rotation.x = -r.dir * 0.08;
    for (const s of [-1, 1]) rbox(0.3, 0.62, 1.1, 0.1, sm, r.cx + s * (sw / 2 + 0.1), 0.38, back + r.dir * 1.05);
    addMesh(new THREE.BoxGeometry(sw, 0.03, 0.95), new THREE.MeshBasicMaterial({ color: r.color }), r.cx, 0.07, back + r.dir * 1.2).scale.set(0.98, 1, 0.9); // dải LED dưới sofa
    // gối ôm
    const pillowMat = phys({ color: '#f3e5d0', roughness: 0.6, sheen: 1, sheenColor: new THREE.Color('#ffffff') });
    for (const s of r.seats === 3 ? [-3.7, -1.3, 1.3, 3.7] : [-3, 0, 3]) {
      const p = rbox(0.42, 0.38, 0.14, 0.07, s === 0 ? gold : pillowMat, r.cx + s, 0.62, back + r.dir * 0.9);
      p.rotation.set(-r.dir * 0.25, 0, s * 0.05);
    }
    // bàn đá cẩm thạch chân vàng
    const tz = back + r.dir * 3.0;
    rbox(3.6, 0.08, 1.1, 0.03, marbleTop, r.cx, 0.44, tz);
    box(3.64, 0.03, 1.14, gold, r.cx, 0.4, tz);
    for (const s of [-1, 1]) { box(0.08, 0.38, 0.8, gold, r.cx + s * 1.5, 0.2, tz); }
    colliders.push({ minX: r.cx - 1.8, maxX: r.cx + 1.8, minZ: tz - 0.55, maxZ: tz + 0.55, top: 0.45 });
    // bia, ly, xô đá, đĩa trái cây, micro trên bàn
    for (let i = 0; i < 4; i++) bottle(r.cx - 1.25 + i * 0.32, back + r.dir * (2.85 + (i % 2) * 0.18), 0.48, i);
    for (let i = 0; i < 3; i++) addMesh(glassGeo, drinkMat, r.cx - 0.2 + i * 0.22, 0.53, back + r.dir * 3.25);
    addMesh(new THREE.CylinderGeometry(0.13, 0.1, 0.2, 16, 1, true), chrome, r.cx + 0.3, 0.58, tz - r.dir * 0.2);
    const plate = addMesh(new THREE.CylinderGeometry(0.22, 0.17, 0.03, 20), new THREE.MeshStandardMaterial({ color: '#fafafa', roughness: 0.2 }), r.cx + 0.95, 0.495, tz);
    ['#e53935', '#43a047', '#ffb300', '#8e24aa'].forEach((c, i) => addMesh(new THREE.SphereGeometry(0.05, 10, 8), new THREE.MeshStandardMaterial({ color: c, roughness: 0.4 }), r.cx + 0.88 + (i % 2) * 0.12, 0.54, tz - 0.06 + Math.floor(i / 2) * 0.12));
    const mic = addMesh(new THREE.CylinderGeometry(0.02, 0.015, 0.22, 10), new THREE.MeshStandardMaterial({ color: '#111', metalness: 0.6, roughness: 0.3 }), r.cx + 1.4, 0.5, tz); mic.rotation.z = Math.PI / 2;
    addMesh(new THREE.SphereGeometry(0.035, 10, 8), chrome, r.cx + 1.52, 0.5, tz);
    // TV khung vàng + 2 loa cột
    const tvX = x2 - 0.12;
    box(0.08, 2.1, 3.5, gold, tvX + 0.02, 1.7, r.cz);
    box(0.08, 2.0, 3.4, new THREE.MeshStandardMaterial({ color: '#050505' }), tvX, 1.7, r.cz);
    plane(3.2, 1.8, tvTex, tvX - 0.05, 1.7, r.cz, -Math.PI / 2);
    for (const s of [-1, 1]) {
      const sz = r.cz + s * 2.3;
      rbox(0.4, 1.1, 0.4, 0.05, new THREE.MeshStandardMaterial({ color: '#0d0d0d', roughness: 0.4, metalness: 0.3 }), x2 - 0.35, 0.55, sz);
      for (const yy of [0.3, 0.75]) { const sp = addMesh(new THREE.CircleGeometry(0.13, 20), new THREE.MeshStandardMaterial({ color: '#222', metalness: 0.8, roughness: 0.3 }), x2 - 0.56, yy, sz); sp.rotation.y = -Math.PI / 2; }
      addMesh(new THREE.TorusGeometry(0.13, 0.012, 6, 24), new THREE.MeshBasicMaterial({ color: r.color }), x2 - 0.57, 0.75, sz).rotation.y = -Math.PI / 2;
      collideRect(x2 - 0.35, sz, 0.45, 0.45, 1.1);
    }
    // cây cảnh góc phòng
    plant(x1 + 0.55, back + r.dir * 0.6, 0.85);
    // đèn chùm nhỏ giữa phòng
    chandelier(r.cx - 1.2, 2.55, r.cz + r.dir * 0.2, r.vip ? 0.9 : 0.6, '#fff0d0');
    if (r.vip) chandelier(r.cx + 3, 2.55, r.cz + r.dir * 0.2, 0.6, '#fff0d0');
    // đèn phòng
    const light = new THREE.PointLight(r.color, 18, 16, 1.6);
    light.position.set(r.cx, 2.6, r.cz); scene.add(light);
    roomLights.push({ light, base: new THREE.Color(r.color), r });
    // quả cầu disco (ẩn đến khi nâng cấp)
    const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 1), new THREE.MeshStandardMaterial({ color: '#ddd', metalness: 1, roughness: 0.15, flatShading: true }));
    ball.position.set(r.cx + 1.2, 2.5, r.cz); ball.visible = false; scene.add(ball);
    discoBalls.push(ball);
  }

  // cửa VIP bị khóa
  const vipDoor = box(3, 2.4, 0.15, new THREE.MeshStandardMaterial({ color: '#ffd54f', transparent: true, opacity: 0.35, emissive: '#ffb300', emissiveIntensity: 0.4 }), 0, 1.2, 8, true);
  const vipLock = plane(2.6, 0.65, textTexture('🔒 Cần mở khóa', { color: '#ffd54f', font: 'bold 110px "Be Vietnam Pro", sans-serif' }), 0, 1.4, 7.88, Math.PI);
  function setVipOpen(open) {
    vipDoor.mesh.visible = !open; vipLock.visible = !open;
    const i = colliders.indexOf(vipDoor.col);
    if (open && i >= 0) colliders.splice(i, 1);
    if (!open && i < 0) colliders.push(vipDoor.col);
  }

  // ---------- quầy bar ----------
  rbox(1.2, 1.1, 4, 0.06, blackMarble, -18, 0.55, BAR.z);
  colliders.push({ minX: -18.6, maxX: -17.4, minZ: BAR.z - 2, maxZ: BAR.z + 2, top: 1.1 });
  box(1.32, 0.06, 4.12, gold, -18, 1.12, BAR.z);
  addMesh(new THREE.BoxGeometry(0.02, 0.04, 3.9), new THREE.MeshBasicMaterial({ color: '#40c4ff' }), -17.38, 0.1, BAR.z);
  for (let i = 0; i < 6; i++) {
    const g = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.035, 0.14, 10), phys({ color: i % 2 ? '#fff59d' : '#ef5350', transparent: true, opacity: 0.8, roughness: 0.05 }));
    g.position.set(-18, 1.22, BAR.z - 1.5 + i * 0.6); scene.add(g);
  }
  // kệ rượu sau quầy có đèn
  for (const yy of [1.5, 2.0, 2.5]) {
    box(0.3, 0.04, 4, phys({ color: '#cfe8ff', transparent: true, opacity: 0.35, roughness: 0.05 }), -18.75, yy, BAR.z);
    for (let i = 0; i < 11; i++) bottle(-18.75, BAR.z - 1.8 + i * 0.36, yy + 0.02, i + yy * 3);
    addMesh(new THREE.BoxGeometry(0.02, 0.02, 4), new THREE.MeshBasicMaterial({ color: '#ffb74d' }), -18.62, yy - 0.03, BAR.z);
  }
  // ghế đẩu bar
  for (let i = 0; i < 3; i++) {
    const z = BAR.z - 1.2 + i * 1.2;
    addMesh(new THREE.CylinderGeometry(0.2, 0.18, 0.08, 18), velvet('#8a1c4f'), -16.95, 0.72, z);
    addMesh(new THREE.CylinderGeometry(0.03, 0.03, 0.7, 8), chrome, -16.95, 0.36, z);
    addMesh(new THREE.TorusGeometry(0.14, 0.012, 6, 20), chrome, -16.95, 0.3, z).rotation.x = Math.PI / 2;
  }
  // đèn thả trên quầy
  for (let i = 0; i < 3; i++) {
    const z = BAR.z - 1.3 + i * 1.3;
    addMesh(new THREE.CylinderGeometry(0.005, 0.005, 0.8, 4), gold, -17.9, 2.6, z);
    addMesh(new THREE.SphereGeometry(0.11, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), gold, -17.9, 2.2, z).rotation.x = Math.PI;
    addMesh(new THREE.SphereGeometry(0.05, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffe0a3' }), -17.9, 2.16, z);
  }
  plane(3.6, 0.9, textTexture('🍹 QUẦY BAR', { color: '#40c4ff', font: 'bold 130px "Be Vietnam Pro", sans-serif' }), -18.85, 2.95, BAR.z, Math.PI / 2).scale.set(0.85, 0.85, 1);

  // ---------- phòng thay đồ / gương ----------
  box(0.15, 2.4, 2.2, gold, 18.85, 1.2, MIRROR.z);
  const mirror = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 2.1), new THREE.MeshStandardMaterial({ color: '#cfe8ff', metalness: 1, roughness: 0.05 }));
  mirror.position.set(18.76, 1.2, MIRROR.z); mirror.rotation.y = -Math.PI / 2; scene.add(mirror);
  for (let i = 0; i < 12; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), new THREE.MeshBasicMaterial({ color: '#fff8e1' }));
    const a = (i / 12) * Math.PI * 2; b.position.set(18.7, 1.2 + Math.sin(a) * 1.15, MIRROR.z + Math.cos(a) * 1.05); scene.add(b);
  }
  plane(3.6, 0.9, textTexture('💄 THAY ĐỒ', { color: '#ff4fa3', font: 'bold 130px "Be Vietnam Pro", sans-serif' }), 18.85 - 0.1, 2.75, MIRROR.z, -Math.PI / 2);
  // ghế đôn nhung trước gương
  rbox(0.6, 0.42, 0.6, 0.15, velvet('#c2185b'), 17.6, 0.21, MIRROR.z + 1.6);
  collideRect(17.6, MIRROR.z + 1.6, 0.6, 0.6, 0.45);
  // giá treo đồ
  const rackCols = ['#c2185b', '#d4af37', '#f5f5f5', '#212121', '#8e24aa', '#1e88e5'];
  box(0.05, 0.05, 2.6, gold, 18.2, 1.8, 0.4);
  for (const s of [-1, 1]) addMesh(new THREE.CylinderGeometry(0.02, 0.02, 1.8, 8), gold, 18.2, 0.9, 0.4 + s * 1.3);
  rackCols.forEach((c, i) => {
    const d = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.9, 14, 1, true), phys({ color: c, side: THREE.DoubleSide, metalness: 0.2, roughness: 0.4, sheen: 1 }));
    d.position.set(18.2, 1.3, -0.7 + i * 0.42); scene.add(d);
  });

  // ---------- biển hiệu lớn ----------
  plane(9, 2.2, textTexture('KTV LUNG LINH', { color: '#ff4fa3', font: 'bold 170px "Be Vietnam Pro", sans-serif', glow: 45 }), -13.5, 2.2, 7.85, Math.PI);
  plane(9, 2.2, textTexture('★ HÁT LÀ VUI ★', { color: '#40c4ff', font: 'bold 150px "Be Vietnam Pro", sans-serif', glow: 45 }), 13.5, 2.2, 7.85, Math.PI);

  // ---------- trang trí sảnh: cây, ghế lounge, đèn chùm lớn ----------
  plant(-18.3, 7.3, 1.1); plant(18.3, 7.3, 1.1); plant(-8.6, 7.3, 1); plant(8.6, 7.3, 1); plant(-18.3, -5.3, 1); plant(16.6, -5.4, 0.9);
  const loungeMat = velvet('#5c1a6b');
  lounge(-14.6, 6.4, Math.PI, loungeMat); lounge(-12.4, 6.4, Math.PI, loungeMat); sideTable(-13.5, 6.6);
  lounge(12.4, 6.4, Math.PI, loungeMat); lounge(14.6, 6.4, Math.PI, loungeMat); sideTable(13.5, 6.6);
  const bigLights = [chandelier(0, 2.75, 1.2, 1.4, '#fff1d6', true)]; bigLights[0].intensity = 8; chandelier(-11, 2.75, 1.5, 0.9, '#ffd6ec'); chandelier(11, 2.75, 1.5, 0.9, '#d6f0ff');

  // ánh sáng sảnh
  const lobbyLights = [
    new THREE.PointLight('#ff4fa3', 14, 18, 1.6), new THREE.PointLight('#40c4ff', 14, 18, 1.6),
  ];
  lobbyLights[0].position.set(-10, 3, 1); lobbyLights[1].position.set(10, 3, 1);
  lobbyLights.forEach((l) => scene.add(l));

  // ---------- cột múa inox + bục đèn ----------
  const poleRings = [], poleSpots = [];
  for (const pl of POLES) {
    const big = pl.roomId === null;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(big ? 1.1 : 0.7, big ? 1.18 : 0.76, big ? 0.14 : 0.06, 48), blackMarble);
    base.position.set(pl.x, big ? 0.07 : 0.03, pl.z); scene.add(base);
    if (big) addMesh(new THREE.TorusGeometry(1.14, 0.03, 8, 64), gold, pl.x, 0.14, pl.z).rotation.x = Math.PI / 2;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(big ? 1.16 : 0.74, 0.022, 8, 64), new THREE.MeshBasicMaterial({ color: '#ff4fa3' }));
    ring.rotation.x = Math.PI / 2; ring.position.set(pl.x, big ? 0.03 : 0.065, pl.z); scene.add(ring); poleRings.push(ring);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 2.95, 16), chrome);
    pole.position.set(pl.x, 1.5, pl.z); scene.add(pole);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.05, 16), gold); cap.position.set(pl.x, 2.97, pl.z); scene.add(cap);
    const capB = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.06, 16), gold); capB.position.set(pl.x, big ? 0.17 : 0.09, pl.z); scene.add(capB);
    const spot = new THREE.PointLight('#ff7ac1', 5, 4, 2); spot.position.set(pl.x, 2.6, pl.z + 0.3); scene.add(spot); poleSpots.push(spot);
  }
  // ---------- cửa ra (tường trái) ----------
  box(0.12, 2.3, 1.6, new THREE.MeshStandardMaterial({ color: '#3e2418', roughness: 0.5 }), -18.88, 1.15, EXIT.z);
  box(0.13, 2.4, 0.08, gold, -18.86, 1.2, EXIT.z - 0.84); box(0.13, 2.4, 0.08, gold, -18.86, 1.2, EXIT.z + 0.84); box(0.13, 0.08, 1.76, gold, -18.86, 2.38, EXIT.z);
  box(0.14, 0.08, 0.3, gold, -18.8, 1.1, EXIT.z + 0.55);
  plane(1.8, 0.45, textTexture('🚪 LỐI RA', { color: '#69f0ae', font: 'bold 120px "Be Vietnam Pro", sans-serif' }), -18.85, 2.65, EXIT.z, Math.PI / 2);
  // ---------- cầu dao (tường phải) ----------
  box(0.12, 0.6, 0.45, new THREE.MeshStandardMaterial({ color: '#9e9e9e', metalness: 0.7, roughness: 0.4 }), 18.88, 1.4, BREAKER.z);
  const lever = box(0.12, 0.22, 0.06, new THREE.MeshStandardMaterial({ color: '#e53935' }), 18.78, 1.42, BREAKER.z).mesh;
  const warn = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), new THREE.MeshBasicMaterial({ color: '#ff1744' }));
  warn.position.set(18.78, 1.8, BREAKER.z); scene.add(warn);
  plane(1.6, 0.4, textTexture('⚡ CẦU DAO', { color: '#ffd54f', font: 'bold 120px "Be Vietnam Pro", sans-serif' }), 18.85, 2.2, BREAKER.z, -Math.PI / 2);
  // ---------- quầy shop (cạnh phòng thay đồ) ----------
  rbox(0.9, 1.0, 1.6, 0.06, velvet('#ad1457'), 18.0, 0.5, -1.9);
  colliders.push({ minX: 17.55, maxX: 18.45, minZ: -2.7, maxZ: -1.1, top: 1 });
  box(1.0, 0.05, 1.7, gold, 18.0, 1.02, -1.9);
  ['#ffd54f', '#f48fb1', '#40c4ff'].forEach((c, i) => { const b = new THREE.Mesh(new RoundedBoxGeometry(0.22, 0.16, 0.1, 2, 0.03), new THREE.MeshStandardMaterial({ color: c, roughness: 0.3 })); b.position.set(18.0, 1.13, -2.4 + i * 0.45); scene.add(b); });
  plane(2.6, 0.65, textTexture('🛍 SHOP', { color: '#ffd54f', font: 'bold 150px "Be Vietnam Pro", sans-serif' }), 18.85, 2.75, -1.9, -Math.PI / 2);

  // ---------- cúp điện ----------
  let dark = false;
  const allLights = () => [...roomLights.map((r) => r.light), ...lobbyLights, ...poleSpots, ...bigLights.filter(Boolean)];
  function setBlackout(on) {
    dark = on;
    for (const l of allLights()) { if (l.userData.base === undefined) l.userData.base = l.intensity; l.intensity = on ? 0 : l.userData.base; }
    for (const s of sparkles) s.material.emissiveIntensity = on ? 0 : 0.25;
    lever.rotation.z = on ? 0.9 : 0;
  }

  let lastTV = 0;
  function update(t, upgrades) {
    warn.visible = dark && Math.sin(t * 10) > 0;
    if (dark) return;
    if (t - lastTV > 0.1) { drawTV(t); lastTV = t; }
    for (let i = 0; i < roomLights.length; i++) {
      const { light, base } = roomLights[i];
      if (upgrades.disco) {
        light.color.setHSL(((t * 0.25 + i * 0.25) % 1), 0.9, 0.6);
        light.intensity = 20 + Math.sin(t * 6 + i) * 6;
      } else { light.color.copy(base); light.intensity = 18; }
      discoBalls[i].visible = !!upgrades.disco;
      discoBalls[i].rotation.y = t * 1.5;
    }
    for (const s of sparkles) s.material.emissiveIntensity = 0.2 + Math.sin(t * 3) * 0.08;
    poleRings.forEach((r, i) => r.material.color.setHSL(((t * 0.15 + i * 0.2) % 1), 0.9, 0.6));
  }

  return { colliders, update, setVipOpen, setBlackout };
}
