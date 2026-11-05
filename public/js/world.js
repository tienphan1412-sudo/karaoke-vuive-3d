// Quán KTV Lung Linh: sảnh, quầy bar, phòng thay đồ, 3 phòng thường + 1 phòng VIP
import * as THREE from 'three';

export const ROOM_DEFS = [
  { id: 0, name: 'Phòng 101', cx: -13, cz: -11, dir: 1, hw: 6, hd: 5, color: '#ff4fa3', seats: 2 },
  { id: 1, name: 'Phòng 102', cx: 0, cz: -11, dir: 1, hw: 6, hd: 5, color: '#40c4ff', seats: 2 },
  { id: 2, name: 'Phòng 103', cx: 13, cz: -11, dir: 1, hw: 6, hd: 5, color: '#b388ff', seats: 2 },
  { id: 3, name: 'Phòng VIP', cx: 0, cz: 14, dir: -1, hw: 8, hd: 6, color: '#ffd54f', seats: 3, vip: true },
];
export const BAR = { x: -16.5, z: 4.2 };
export const MIRROR = { x: 16.5, z: 4.2 };

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

export function buildWorld(scene) {
  const colliders = [];
  const roomLights = [];
  const discoBalls = [];

  const wallMat = new THREE.MeshStandardMaterial({ color: '#2a1636', roughness: 0.85 });
  const glassMat = new THREE.MeshStandardMaterial({ color: '#9fd8ff', transparent: true, opacity: 0.12, roughness: 0.1, metalness: 0.2, depthWrite: false });
  const sofaMats = ['#7b1f4a', '#123a5c', '#3b1d6e', '#5a3d00'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.45 }));
  const tableMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.2, metalness: 0.3 });

  function box(w, h, d, mat, x, y, z, collide = false) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    scene.add(m);
    let col = null;
    if (collide) { col = { minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, top: y + h / 2, glass: mat === glassMat }; colliders.push(col); }
    return { mesh: m, col };
  }
  function wall(x1, z1, x2, z2, h = 3, mat = wallMat) {
    const T = 0.2;
    const w = Math.max(Math.abs(x2 - x1), T), d = Math.max(Math.abs(z2 - z1), T);
    return box(w, h, d, mat, (x1 + x2) / 2, h / 2, (z1 + z2) / 2, true);
  }
  function neonLine(x1, z1, x2, z2, y, color) {
    const w = Math.max(Math.abs(x2 - x1), 0.06), d = Math.max(Math.abs(z2 - z1), 0.06);
    box(w, 0.06, d, new THREE.MeshBasicMaterial({ color }), (x1 + x2) / 2, y, (z1 + z2) / 2);
  }
  function plane(w, h, tex, x, y, z, ry = 0, basic = true) {
    const mat = basic ? new THREE.MeshBasicMaterial({ map: tex, transparent: true }) : new THREE.MeshStandardMaterial({ map: tex });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.set(x, y, z); m.rotation.y = ry; scene.add(m);
    return m;
  }

  // ---------- sàn ----------
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: '#0d0610', roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.01; scene.add(ground);
  {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const ctx = c.getContext('2d');
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { ctx.fillStyle = (i + j) % 2 ? '#2b1338' : '#1a0b24'; ctx.fillRect(i * 64, j * 64, 64, 64); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(10, 4); t.colorSpace = THREE.SRGBColorSpace;
    const lobby = new THREE.Mesh(new THREE.PlaneGeometry(38, 14), new THREE.MeshStandardMaterial({ map: t, roughness: 0.25, metalness: 0.3 }));
    lobby.rotation.x = -Math.PI / 2; lobby.position.set(0, 0, 1); scene.add(lobby);
  }

  // ---------- tường sảnh ----------
  wall(-19, -6, -19, 8);
  wall(19, -6, 19, 8);
  wall(-19, 8, -8, 8);
  wall(8, 8, 19, 8);
  neonLine(-19, -6, -19, 8, 2.9, '#ff4fa3');
  neonLine(19, -6, 19, 8, 2.9, '#40c4ff');

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
  for (const r of ROOM_DEFS) {
    const back = r.cz - r.dir * r.hd, front = r.cz + r.dir * r.hd;
    const x1 = r.cx - r.hw, x2 = r.cx + r.hw;
    // sàn thảm
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(r.hw * 2, r.hd * 2), new THREE.MeshStandardMaterial({ color: r.vip ? '#3a2a10' : '#1d1030', roughness: 0.9 }));
    fl.rotation.x = -Math.PI / 2; fl.position.set(r.cx, 0.005, r.cz); scene.add(fl);
    // tường
    wall(x1, back, x2, back);
    wall(x1, back, x1, front);
    wall(x2, back, x2, front);
    wall(x1, front, r.cx - 1.5, front, 2.4, glassMat);
    wall(r.cx + 1.5, front, x2, front, 2.4, glassMat);
    neonLine(x1, back + r.dir * 0.12, x2, back + r.dir * 0.12, 2.85, r.color);
    neonLine(x1, front, r.cx - 1.5, front, 2.42, r.color);
    neonLine(r.cx + 1.5, front, x2, front, 2.42, r.color);
    // bảng tên phòng trên cửa
    const sign = plane(3, 0.75, textTexture(r.name, { color: r.color, font: 'bold 120px "Be Vietnam Pro", sans-serif', w: 1024, h: 256 }), r.cx, 2.75, front + r.dir * 0.12, r.dir === 1 ? 0 : Math.PI);
    sign.renderOrder = 2;
    // sofa + bàn
    const sm = sofaMats[r.id];
    const sw = r.hw * 2 - 2.5;
    box(sw, 0.42, 0.9, sm, r.cx, 0.21, back + r.dir * 1.2, true);
    box(sw, 0.9, 0.28, sm, r.cx, 0.45, back + r.dir * 0.62, false);
    box(1.6, 0.6, 0.28, sm, r.cx, 0.3, back + r.dir * 0.62, false);
    box(3.6, 0.45, 1.1, tableMat, r.cx, 0.225, back + r.dir * 3.0, true);
    // bia, đĩa trên bàn
    for (let i = 0; i < 4; i++) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.28, 10), new THREE.MeshStandardMaterial({ color: '#2e7d32', roughness: 0.2, metalness: 0.2 }));
      b.position.set(r.cx - 1.2 + i * 0.35, 0.59, back + r.dir * (2.85 + (i % 2) * 0.2)); scene.add(b);
    }
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.18, 0.03, 18), new THREE.MeshStandardMaterial({ color: '#fafafa' }));
    plate.position.set(r.cx + 0.9, 0.47, back + r.dir * 3.0); scene.add(plate);
    // TV
    const tvX = x2 - 0.12;
    const tvFrame = box(0.08, 2.0, 3.4, new THREE.MeshStandardMaterial({ color: '#0a0a0a' }), tvX, 1.7, r.cz);
    const tv = plane(3.2, 1.8, tvTex, tvX - 0.05, 1.7, r.cz, -Math.PI / 2);
    // đèn phòng
    const light = new THREE.PointLight(r.color, 18, 16, 1.6);
    light.position.set(r.cx, 2.6, r.cz); scene.add(light);
    roomLights.push({ light, base: new THREE.Color(r.color), r });
    // quả cầu disco (ẩn đến khi nâng cấp)
    const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 1), new THREE.MeshStandardMaterial({ color: '#ddd', metalness: 1, roughness: 0.15, flatShading: true }));
    ball.position.set(r.cx, 2.55, r.cz); ball.visible = false; scene.add(ball);
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
  box(1.2, 1.1, 4, new THREE.MeshStandardMaterial({ color: '#3e1e4f', roughness: 0.3, metalness: 0.4 }), -18, 0.55, BAR.z, true);
  box(1.3, 0.06, 4.1, new THREE.MeshStandardMaterial({ color: '#d4af37', metalness: 0.9, roughness: 0.2 }), -18, 1.12, BAR.z);
  for (let i = 0; i < 6; i++) {
    const g = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.035, 0.14, 10), new THREE.MeshStandardMaterial({ color: i % 2 ? '#fff59d' : '#ef5350', transparent: true, opacity: 0.8 }));
    g.position.set(-18, 1.22, BAR.z - 1.5 + i * 0.6); scene.add(g);
  }
  plane(3.6, 0.9, textTexture('🍹 QUẦY BAR', { color: '#40c4ff', font: 'bold 130px "Be Vietnam Pro", sans-serif' }), -18.85, 2.3, BAR.z, Math.PI / 2);

  // ---------- phòng thay đồ / gương ----------
  box(0.15, 2.4, 2.2, new THREE.MeshStandardMaterial({ color: '#d4af37', metalness: 0.9, roughness: 0.2 }), 18.85, 1.2, MIRROR.z);
  const mirror = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 2.1), new THREE.MeshStandardMaterial({ color: '#cfe8ff', metalness: 1, roughness: 0.05 }));
  mirror.position.set(18.76, 1.2, MIRROR.z); mirror.rotation.y = -Math.PI / 2; scene.add(mirror);
  for (let i = 0; i < 8; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: '#fff8e1' }));
    const a = (i / 8) * Math.PI * 2; b.position.set(18.7, 1.2 + Math.sin(a) * 1.15, MIRROR.z + Math.cos(a) * 1.05); scene.add(b);
  }
  plane(3.6, 0.9, textTexture('💄 THAY ĐỒ', { color: '#ff4fa3', font: 'bold 130px "Be Vietnam Pro", sans-serif' }), 18.85 - 0.1, 2.75, MIRROR.z, -Math.PI / 2);
  // giá treo đồ
  const rackCols = ['#c2185b', '#d4af37', '#f5f5f5', '#212121', '#8e24aa', '#1e88e5'];
  box(0.05, 0.05, 2.6, new THREE.MeshStandardMaterial({ color: '#bbb', metalness: 0.8 }), 18.2, 1.8, 0.4);
  rackCols.forEach((c, i) => {
    const d = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.9, 12, 1, true), new THREE.MeshStandardMaterial({ color: c, side: THREE.DoubleSide, metalness: 0.3, roughness: 0.4 }));
    d.position.set(18.2, 1.3, -0.7 + i * 0.42); scene.add(d);
  });

  // ---------- biển hiệu lớn ----------
  plane(9, 2.2, textTexture('KTV LUNG LINH', { color: '#ff4fa3', font: 'bold 170px "Be Vietnam Pro", sans-serif', glow: 45 }), -13.5, 2.0, 7.85, Math.PI);
  plane(9, 2.2, textTexture('★ HÁT LÀ VUI ★', { color: '#40c4ff', font: 'bold 150px "Be Vietnam Pro", sans-serif', glow: 45 }), 13.5, 2.0, 7.85, Math.PI);

  // ánh sáng sảnh
  const lobbyLights = [
    new THREE.PointLight('#ff4fa3', 14, 18, 1.6), new THREE.PointLight('#40c4ff', 14, 18, 1.6), new THREE.PointLight('#fff1d6', 12, 16, 1.6),
  ];
  lobbyLights[0].position.set(-10, 3, 1); lobbyLights[1].position.set(10, 3, 1); lobbyLights[2].position.set(0, 3, 2);
  lobbyLights.forEach((l) => scene.add(l));

  let lastTV = 0;
  function update(t, upgrades) {
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
  }

  return { colliders, update, setVipOpen };
}
