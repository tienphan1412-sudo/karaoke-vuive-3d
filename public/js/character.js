// Nhân vật 3D dựng hoàn toàn bằng code (không cần file model)
import * as THREE from 'three';
import { OUTFITS, CUSTOMER_TYPES } from './data.js';

const M = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05, ...extra });
const cyl = (rt, rb, h, mat, seg = 18) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
const sph = (r, mat, ws = 24, hs = 16) => new THREE.Mesh(new THREE.SphereGeometry(r, ws, hs), mat);
const caps = (r, len, mat) => new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 12), mat);

// ---------- tiện ích màu ----------
function hexToRgb(h) {
  const n = parseInt(h.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function hexA(h, a) {
  const [r, g, b] = hexToRgb(h);
  return `rgba(${r},${g},${b},${a})`;
}
export function shade(h, amt) {
  let [r, g, b] = hexToRgb(h);
  const f = (c) => Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt);
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

// ---------- vẽ khuôn mặt + makeup lên canvas ----------
const FW = 512, FH = 400;
function drawFace(ctx, a, expr = 'none') {
  ctx.clearRect(0, 0, FW, FH);
  const han = a.face === 'han';
  if (han) drawHanUpper(ctx, a);
  else drawClassicUpper(ctx, a);
  drawMouth(ctx, a, expr, han);
}
function drawClassicUpper(ctx, a) {
  // má hồng
  if (a.blush && a.blush !== 'none') {
    for (const s of [-1, 1]) {
      const x = 256 + s * 128, y = 280;
      const gr = ctx.createRadialGradient(x, y, 0, x, y, 54);
      gr.addColorStop(0, hexA(a.blush, 0.6));
      gr.addColorStop(1, hexA(a.blush, 0));
      ctx.fillStyle = gr;
      ctx.beginPath(); ctx.ellipse(x, y, 54, 36, 0, 0, Math.PI * 2); ctx.fill();
    }
  }
  const browC = shade(a.hairColor || '#222', a.hairColor && parseInt(a.hairColor.slice(1), 16) > 0x999999 ? -0.45 : -0.1);
  for (const s of [-1, 1]) {
    const cx = 256 + s * 100, cy = 196;
    // phấn mắt
    if (a.shadow && a.shadow !== 'none') {
      const gr = ctx.createRadialGradient(cx, cy - 20, 6, cx, cy - 20, 66);
      gr.addColorStop(0, hexA(a.shadow, 0.85 * (a.shadowAmt ?? 0.6)));
      gr.addColorStop(1, hexA(a.shadow, 0));
      ctx.fillStyle = gr;
      ctx.beginPath(); ctx.ellipse(cx + s * 6, cy - 18, 66, 44, 0, 0, Math.PI * 2); ctx.fill();
    }
    // tròng trắng
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(cx, cy, 52, 47, 0, 0, Math.PI * 2); ctx.fill();
    // mống mắt
    ctx.save();
    ctx.beginPath(); ctx.ellipse(cx, cy, 52, 47, 0, 0, Math.PI * 2); ctx.clip();
    const ig = ctx.createLinearGradient(cx, cy - 46, cx, cy + 46);
    ig.addColorStop(0, shade(a.eyeColor, -0.55));
    ig.addColorStop(1, shade(a.eyeColor, 0.45));
    ctx.fillStyle = ig;
    ctx.beginPath(); ctx.ellipse(cx - s * 2, cy + 5, 34, 44, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = shade(a.eyeColor, -0.75);
    ctx.beginPath(); ctx.ellipse(cx - s * 2, cy + 8, 15, 21, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(cx - 12, cy - 15, 10, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 12, cy + 18, 5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // viền mi trên + kẻ mắt
    const lw = { none: 6, thin: 8, cat: 9, bold: 13 }[a.liner] || 7;
    ctx.strokeStyle = '#1b1414'; ctx.lineCap = 'round'; ctx.lineWidth = lw;
    const P0 = [cx - s * 52, cy + 6], C = [cx, cy - 64], P2 = [cx + s * 56, cy - 6];
    ctx.beginPath(); ctx.moveTo(...P0); ctx.quadraticCurveTo(...C, ...P2); ctx.stroke();
    if (a.liner === 'cat' || a.liner === 'bold') {
      ctx.lineWidth = lw - 1;
      ctx.beginPath(); ctx.moveTo(P2[0] - s * 4, P2[1]); ctx.lineTo(cx + s * 82, cy - 28); ctx.stroke();
    }
    // lông mi
    const n = { natural: 4, doll: 6, drama: 8 }[a.lashes] || 5;
    const L = { natural: 11, doll: 16, drama: 22 }[a.lashes] || 14;
    ctx.lineWidth = a.lashes === 'drama' ? 4 : 3;
    for (let i = 0; i < n; i++) {
      const t = 0.4 + 0.6 * (i / Math.max(1, n - 1));
      const x = (1 - t) ** 2 * P0[0] + 2 * (1 - t) * t * C[0] + t * t * P2[0];
      const y = (1 - t) ** 2 * P0[1] + 2 * (1 - t) * t * C[1] + t * t * P2[1];
      const dx = s * (0.25 + 0.75 * t), dy = -1;
      const len = Math.hypot(dx, dy);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (dx / len) * L, y + (dy / len) * L); ctx.stroke();
    }
    // mi dưới
    ctx.strokeStyle = 'rgba(90,50,50,0.55)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(cx - s * 36, cy + 42); ctx.quadraticCurveTo(cx, cy + 52, cx + s * 46, cy + 32); ctx.stroke();
    if (a.lashes !== 'natural') {
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const x = cx + s * (8 + i * 14), y = cy + 46 - i * 3;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + s * 3, y + 8); ctx.stroke();
      }
    }
    // chân mày
    ctx.strokeStyle = browC;
    ctx.lineWidth = { thin: 5, natural: 9, straight: 10, arched: 8 }[a.brows] || 8;
    const by = cy - 80;
    ctx.beginPath();
    if (a.brows === 'straight') { ctx.moveTo(cx - s * 42, by + 2); ctx.quadraticCurveTo(cx, by - 4, cx + s * 46, by + 4); }
    else if (a.brows === 'arched') { ctx.moveTo(cx - s * 42, by + 8); ctx.quadraticCurveTo(cx + s * 14, by - 24, cx + s * 50, by + 8); }
    else { ctx.moveTo(cx - s * 42, by + 6); ctx.quadraticCurveTo(cx, by - 14, cx + s * 48, by + 4); }
    ctx.stroke();
  }
  // mũi
  ctx.strokeStyle = 'rgba(160,95,85,0.6)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(254, 262); ctx.quadraticCurveTo(262, 274, 252, 278); ctx.stroke();
}
function drawMouth(ctx, a, expr, han) {
  // môi
  const ly = 326;
  if (expr === 'smile' || expr === 'sing') {
    ctx.save();
    if (expr === 'smile') {
      ctx.fillStyle = '#5a1420';
      ctx.beginPath(); ctx.moveTo(222, ly - 6); ctx.quadraticCurveTo(256, ly - 2, 290, ly - 6); ctx.quadraticCurveTo(256, ly + 44, 222, ly - 6); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(228, ly - 4); ctx.quadraticCurveTo(256, ly, 284, ly - 4); ctx.lineTo(282, ly + 4); ctx.quadraticCurveTo(256, ly + 8, 230, ly + 4); ctx.fill();
      ctx.fillStyle = '#e57373'; ctx.beginPath(); ctx.ellipse(256, ly + 24, 14, 7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = a.lip; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(222, ly - 6); ctx.quadraticCurveTo(256, ly + 44, 290, ly - 6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(222, ly - 6); ctx.quadraticCurveTo(256, ly - 2, 290, ly - 6); ctx.stroke();
    } else {
      ctx.fillStyle = '#5a1420'; ctx.beginPath(); ctx.ellipse(256, ly + 6, 17, 22, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = a.lip; ctx.lineWidth = 8; ctx.stroke();
      ctx.fillStyle = '#e57373'; ctx.beginPath(); ctx.ellipse(256, ly + 18, 9, 6, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    return;
  }
  if (han) { drawHanLips(ctx, a, ly); return; }
  ctx.fillStyle = a.lip;
  ctx.beginPath();
  ctx.moveTo(226, ly);
  ctx.quadraticCurveTo(240, ly - 14, 250, ly - 9);
  ctx.quadraticCurveTo(256, ly - 6, 262, ly - 9);
  ctx.quadraticCurveTo(272, ly - 14, 286, ly);
  ctx.quadraticCurveTo(256, ly + 4, 226, ly);
  ctx.fill();
  ctx.fillStyle = shade(a.lip, 0.08);
  ctx.beginPath(); ctx.moveTo(226, ly); ctx.quadraticCurveTo(256, ly + 28, 286, ly); ctx.quadraticCurveTo(256, ly + 4, 226, ly); ctx.fill();
  ctx.strokeStyle = shade(a.lip, -0.45); ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(228, ly); ctx.quadraticCurveTo(256, ly + 5, 284, ly); ctx.stroke();
  if (a.gloss) {
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath(); ctx.ellipse(262, ly + 11, 9, 3.5, -0.1, 0, Math.PI * 2); ctx.fill();
  }
}


// ---------- mặt phong cách Hàn: mắt to long lanh, má hồng loang dưới mắt, môi tint ----------
function drawHanUpper(ctx, a) {
  const blush = a.blush && a.blush !== 'none' ? a.blush : '#ff9e9e';
  // má hồng loang rộng, cao sát dưới mắt + vệt hồng nhẹ qua sống mũi
  for (const s of [-1, 1]) {
    const x = 256 + s * 110, y = 256;
    const gr = ctx.createRadialGradient(x, y, 0, x, y, 96);
    gr.addColorStop(0, hexA(blush, 0.75)); gr.addColorStop(0.55, hexA(blush, 0.38)); gr.addColorStop(1, hexA(blush, 0));
    ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(x, y, 96, 58, 0, 0, Math.PI * 2); ctx.fill();
  }
  { const gr = ctx.createRadialGradient(256, 250, 0, 256, 250, 50);
    gr.addColorStop(0, hexA(blush, 0.22)); gr.addColorStop(1, hexA(blush, 0));
    ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(256, 250, 50, 20, 0, 0, Math.PI * 2); ctx.fill(); }
  const browC = shade(a.hairColor || '#222', a.hairColor && parseInt(a.hairColor.slice(1), 16) > 0x999999 ? -0.4 : 0.12);
  for (const s of [-1, 1]) {
    const cx = 256 + s * 100, cy = 200;
    const IN = [cx - s * 54, cy + 8], OUT = [cx + s * 58, cy + 2];
    const UP = [cx - s * 4, cy - 94], LO = [cx + s * 4, cy + 74];
    const eyePath = () => { ctx.beginPath(); ctx.moveTo(...IN); ctx.quadraticCurveTo(...UP, ...OUT); ctx.quadraticCurveTo(...LO, ...IN); ctx.closePath(); };
    // phấn mắt: mặc định hồng đào ở cả mí trên và mí dưới (kiểu mắt "khóc")
    const sh = a.shadow && a.shadow !== 'none' ? a.shadow : '#e8908f';
    const amt = a.shadow && a.shadow !== 'none' ? (a.shadowAmt ?? 0.6) : 0.45;
    { const gr = ctx.createRadialGradient(cx + s * 10, cy - 14, 8, cx + s * 10, cy - 14, 70);
      gr.addColorStop(0, hexA(sh, 0.75 * amt)); gr.addColorStop(1, hexA(sh, 0));
      ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(cx + s * 8, cy - 16, 72, 46, 0, 0, Math.PI * 2); ctx.fill();
      const g2 = ctx.createRadialGradient(cx + s * 12, cy + 44, 4, cx + s * 12, cy + 44, 52);
      g2.addColorStop(0, hexA(sh, 0.6 * amt)); g2.addColorStop(1, hexA(sh, 0));
      ctx.fillStyle = g2; ctx.beginPath(); ctx.ellipse(cx + s * 12, cy + 46, 56, 20, 0, 0, Math.PI * 2); ctx.fill(); }
    // bọng mắt (aegyo-sal): vệt sáng + bóng mờ bên dưới
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(cx - s * 36, cy + 50); ctx.quadraticCurveTo(cx + s * 6, cy + 72, cx + s * 48, cy + 42); ctx.stroke();
    ctx.strokeStyle = 'rgba(190,110,110,0.28)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(cx - s * 32, cy + 62); ctx.quadraticCurveTo(cx + s * 6, cy + 82, cx + s * 46, cy + 54); ctx.stroke();
    // tròng trắng
    eyePath(); ctx.fillStyle = '#fbf7f6'; ctx.fill();
    // mống mắt to, tối, long lanh
    ctx.save(); eyePath(); ctx.clip();
    const ix = cx - s * 3, iy = cy + 2;
    const ig = ctx.createLinearGradient(ix, iy - 40, ix, iy + 40);
    ig.addColorStop(0, shade(a.eyeColor, -0.8)); ig.addColorStop(0.6, shade(a.eyeColor, -0.4)); ig.addColorStop(1, shade(a.eyeColor, 0.1));
    ctx.fillStyle = ig; ctx.beginPath(); ctx.arc(ix, iy, 43, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = shade(a.eyeColor, -0.85); ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#120b0b'; ctx.beginPath(); ctx.arc(ix, iy + 2, 19, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(cx, cy - 30, 60, 22, 0, 0, Math.PI * 2); ctx.fill(); // bóng mí trên đổ xuống
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(ix - 14, iy - 14, 12, 9, -0.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(ix + 14, iy + 15, 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(ix, iy, 30, 0.35 * Math.PI, 0.65 * Math.PI); ctx.stroke();
    ctx.restore();
    // nếp mí đôi
    ctx.strokeStyle = 'rgba(150,85,85,0.45)'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(cx - s * 38, cy - 36); ctx.quadraticCurveTo(cx + s * 2, cy - 90, cx + s * 56, cy - 18); ctx.stroke();
    // viền mí trên dày dần ra đuôi; đuôi cụp xuống (mắt cún) hoặc vểnh lên nếu chọn mắt mèo
    const lw = { none: 6, thin: 8, cat: 9, bold: 12 }[a.liner] || 8;
    ctx.strokeStyle = '#1a1111';
    for (let i = 0; i < 3; i++) {
      ctx.lineWidth = lw - i * 2.2;
      const t0 = 0.15 + i * 0.25;
      ctx.beginPath();
      for (let k = 0; k <= 20; k++) {
        const t = t0 + (1 - t0) * (k / 20);
        const x = (1 - t) ** 2 * IN[0] + 2 * (1 - t) * t * UP[0] + t * t * OUT[0];
        const y = (1 - t) ** 2 * IN[1] + 2 * (1 - t) * t * UP[1] + t * t * OUT[1];
        k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
    ctx.lineWidth = lw - 2;
    ctx.beginPath(); ctx.moveTo(...OUT);
    if (a.liner === 'cat' || a.liner === 'bold') ctx.lineTo(cx + s * 80, cy - 20); else ctx.lineTo(cx + s * 68, cy + 12);
    ctx.stroke();
    // mi trên: nhiều sợi mảnh
    const n = { natural: 7, doll: 10, drama: 13 }[a.lashes] || 9;
    const L = { natural: 10, doll: 14, drama: 19 }[a.lashes] || 13;
    ctx.lineWidth = 2.2;
    for (let i = 0; i < n; i++) {
      const t = 0.35 + 0.65 * (i / Math.max(1, n - 1));
      const x = (1 - t) ** 2 * IN[0] + 2 * (1 - t) * t * UP[0] + t * t * OUT[0];
      const y = (1 - t) ** 2 * IN[1] + 2 * (1 - t) * t * UP[1] + t * t * OUT[1];
      const dx = s * (0.3 + 0.9 * t), dy = -1, len = Math.hypot(dx, dy);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + (dx / len) * L * 0.5, y + (dy / len) * L * 0.8, x + (dx / len) * L, y + (dy / len) * L * 0.6); ctx.stroke();
    }
    // mi dưới: viền nhạt + vài cụm mi rõ ở đuôi
    ctx.strokeStyle = 'rgba(80,45,45,0.55)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx - s * 40, cy + 26); ctx.quadraticCurveTo(...LO, OUT[0] - s * 4, OUT[1] + 6); ctx.stroke();
    ctx.strokeStyle = 'rgba(40,20,20,0.75)'; ctx.lineWidth = 1.8;
    for (let i = 0; i < 5; i++) {
      const x = cx + s * (-4 + i * 12), y = cy + 42 - i * 4;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + s * (2 + i), y + 9 + (i % 2) * 3); ctx.stroke();
    }
    // chân mày ngang, mềm, nhạt
    ctx.save(); ctx.globalAlpha = 0.75; ctx.strokeStyle = browC; ctx.lineCap = 'round';
    const by = cy - 92;
    const bw = { thin: 5, natural: 9, straight: 10, arched: 8 }[a.brows] || 9;
    ctx.lineWidth = bw;
    ctx.beginPath();
    if (a.brows === 'arched') { ctx.moveTo(cx - s * 40, by + 8); ctx.quadraticCurveTo(cx + s * 14, by - 18, cx + s * 52, by + 8); }
    else { ctx.moveTo(cx - s * 40, by + 4); ctx.quadraticCurveTo(cx + s * 4, by - 8, cx + s * 50, by + 6); }
    ctx.stroke();
    ctx.globalAlpha = 0.35; ctx.lineWidth = bw + 4;
    ctx.beginPath(); ctx.moveTo(cx - s * 40, by + 5); ctx.lineTo(cx - s * 22, by + 2); ctx.stroke();
    ctx.restore();
  }
  // mũi nhỏ: bóng mờ dưới chóp + điểm sáng sống mũi
  ctx.fillStyle = 'rgba(200,120,110,0.35)'; ctx.beginPath(); ctx.ellipse(256, 280, 13, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(170,95,90,0.55)'; ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.moveTo(246, 276); ctx.quadraticCurveTo(250, 282, 256, 280); ctx.quadraticCurveTo(262, 282, 266, 276); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.ellipse(257, 262, 3.5, 6, 0, 0, Math.PI * 2); ctx.fill();
}
function drawHanLips(ctx, a, ly) {
  // môi nhỏ, đầy, son tint: đậm ở giữa, nhạt dần ra viền
  const shape = () => {
    ctx.beginPath();
    ctx.moveTo(228, ly);
    ctx.quadraticCurveTo(240, ly - 13, 250, ly - 10);
    ctx.quadraticCurveTo(256, ly - 6, 262, ly - 10);
    ctx.quadraticCurveTo(272, ly - 13, 284, ly);
    ctx.quadraticCurveTo(272, ly + 26, 256, ly + 26);
    ctx.quadraticCurveTo(240, ly + 26, 228, ly);
    ctx.closePath();
  };
  shape(); ctx.fillStyle = hexA(a.lip, 0.35); ctx.fill();
  ctx.save(); shape(); ctx.clip();
  const gr = ctx.createRadialGradient(256, ly + 3, 2, 256, ly + 3, 34);
  gr.addColorStop(0, shade(a.lip, -0.25)); gr.addColorStop(0.5, hexA(a.lip, 0.9)); gr.addColorStop(1, hexA(a.lip, 0.15));
  ctx.fillStyle = gr; ctx.fillRect(210, ly - 20, 92, 52);
  ctx.restore();
  ctx.strokeStyle = shade(a.lip, -0.55); ctx.lineWidth = 2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(232, ly + 1); ctx.quadraticCurveTo(244, ly + 4, 256, ly + 2); ctx.quadraticCurveTo(268, ly + 4, 280, ly + 1); ctx.stroke();
  if (a.gloss) {
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.beginPath(); ctx.ellipse(262, ly + 14, 8, 3, -0.1, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(246, ly - 6, 4, 1.8, 0.3, 0, Math.PI * 2); ctx.fill();
  }
}

// profile váy (bán kính, độ cao)
const SKIRTS = {
  mermaid: [[0.0, 1.03], [0.096, 1.03], [0.135, 0.94], [0.13, 0.75], [0.105, 0.45], [0.095, 0.3], [0.17, 0.12], [0.28, 0.015]],
  ball: [[0.0, 1.03], [0.096, 1.03], [0.15, 0.95], [0.3, 0.62], [0.44, 0.28], [0.54, 0.015]],
  tight: [[0.0, 1.03], [0.096, 1.03], [0.14, 0.93], [0.145, 0.8], [0.14, 0.68]],
  aline: [[0.0, 1.03], [0.096, 1.03], [0.14, 0.92], [0.21, 0.72], [0.24, 0.62]],
  pleat: [[0.0, 1.03], [0.096, 1.03], [0.14, 0.92], [0.22, 0.56], [0.25, 0.34]],
};

// ======================= CÔ GÁI =======================
export function createGirl(app) {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);

  const mats = {
    skin: M('#ffe3d3', { roughness: 0.6 }),
    cloth: M('#c2185b', { side: THREE.DoubleSide }),
    pants: M('#fafafa'),
    shoe: M('#222', { roughness: 0.3, metalness: 0.3 }),
    hair: M('#111', { roughness: 0.45 }),
    gold: M('#e8c25a', { metalness: 0.9, roughness: 0.25 }),
    pearl: M('#fffaf0', { metalness: 0.2, roughness: 0.15 }),
    black: M('#151515', { roughness: 0.3 }),
  };

  const parts = { torso: [], chest: [], shoulder: [], upper: [], fore: [], thigh: [], calf: [] };

  const pelvis = sph(0.1, mats.cloth); pelvis.scale.set(1.32, 0.8, 0.92); pelvis.position.y = 0.93; body.add(pelvis); parts.torso.push(pelvis);
  const waist = cyl(0.08, 0.1, 0.2, mats.cloth); waist.position.y = 1.05; body.add(waist); parts.torso.push(waist);
  const chest = sph(0.105, mats.cloth); chest.scale.set(1.2, 1, 0.82); chest.position.y = 1.2; body.add(chest); parts.chest.push(chest);
  for (const s of [-1, 1]) {
    const b = sph(0.04, mats.cloth, 16, 12); b.scale.set(1, 0.9, 0.7); b.position.set(s * 0.045, 1.185, 0.05); body.add(b); parts.chest.push(b);
    const sh = sph(0.045, mats.cloth); sh.position.set(s * 0.14, 1.265, 0); body.add(sh); parts.shoulder.push(sh);
  }
  const neck = cyl(0.033, 0.038, 0.13, mats.skin); neck.position.y = 1.35; body.add(neck);
  const collar = cyl(0.04, 0.042, 0.07, mats.cloth); collar.position.y = 1.345; body.add(collar);

  // đầu
  const headPivot = new THREE.Group(); headPivot.position.y = 1.47; body.add(headPivot);
  const head = sph(0.125, mats.skin, 32, 24); head.scale.set(0.92, 1.06, 0.96); headPivot.add(head);
  const faceCanvas = document.createElement('canvas'); faceCanvas.width = FW; faceCanvas.height = FH;
  const faceCtx = faceCanvas.getContext('2d');
  const faceTex = new THREE.CanvasTexture(faceCanvas); faceTex.colorSpace = THREE.SRGBColorSpace; faceTex.anisotropy = 4;
  const face = new THREE.Mesh(
    new THREE.SphereGeometry(0.1262, 40, 30, Math.PI / 2 - 0.8, 1.6, 1.0, 1.15),
    new THREE.MeshStandardMaterial({ map: faceTex, transparent: true, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -1 })
  );
  head.add(face);
  for (const s of [-1, 1]) { const ear = sph(0.022, mats.skin, 12, 8); ear.scale.set(0.5, 1, 0.8); ear.position.set(s * 0.122, -0.005, 0); head.add(ear); }
  const hairGroup = new THREE.Group(); head.add(hairGroup);
  const accHead = new THREE.Group(); head.add(accHead);
  const accBody = new THREE.Group(); body.add(accBody);

  // tay
  const arms = {};
  for (const s of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(s * 0.15, 1.265, 0); body.add(sh);
    const upper = cyl(0.034, 0.028, 0.26, mats.skin); upper.position.y = -0.13; sh.add(upper); parts.upper.push(upper);
    const elbow = new THREE.Group(); elbow.position.y = -0.26; sh.add(elbow);
    const fore = cyl(0.027, 0.021, 0.24, mats.skin); fore.position.y = -0.12; elbow.add(fore); parts.fore.push(fore);
    const hand = sph(0.028, mats.skin, 12, 10); hand.scale.set(0.8, 1.25, 0.6); hand.position.y = -0.26; elbow.add(hand);
    arms[s] = { sh, elbow, hand };
  }
  // micro + đồ cầm tay (tay phải)
  const mic = new THREE.Group();
  const micBody = cyl(0.012, 0.008, 0.12, mats.black, 10); mic.add(micBody);
  const micHead = sph(0.022, M('#9e9e9e', { metalness: 0.8, roughness: 0.3 }), 12, 10); micHead.position.y = 0.07; mic.add(micHead);
  mic.position.set(0, -0.27, 0.02); mic.rotation.x = -0.3; mic.visible = false;
  arms[1].elbow.add(mic);
  const bag = new THREE.Group();
  {
    const leather = M('#d81b60', { roughness: 0.35, metalness: 0.1 });
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.11, 0.06), leather); b.position.y = -0.09; bag.add(b);
    const flap = new THREE.Mesh(new THREE.BoxGeometry(0.152, 0.05, 0.062), M('#ad1457', { roughness: 0.35 })); flap.position.y = -0.055; bag.add(flap);
    const clasp = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, 0.01), M('#f1cf6a', { metalness: 1, roughness: 0.2 })); clasp.position.set(0, -0.07, 0.033); bag.add(clasp);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.006, 6, 18, Math.PI), M('#f1cf6a', { metalness: 1, roughness: 0.2 })); handle.position.y = -0.035; bag.add(handle);
    bag.position.set(0, -0.12, 0.02); bag.visible = false;
  }
  const holdItems = { fruit: new THREE.Group(), water: new THREE.Group() };
  {
    const plate = cyl(0.11, 0.08, 0.015, M('#fafafa'), 20); holdItems.fruit.add(plate);
    const cols = ['#e53935', '#43a047', '#fdd835', '#fb8c00', '#8e24aa'];
    cols.forEach((c, i) => { const f = sph(0.028, M(c), 10, 8); const a = (i / cols.length) * Math.PI * 2; f.position.set(Math.cos(a) * 0.05, 0.025, Math.sin(a) * 0.05); holdItems.fruit.add(f); });
    const glass = cyl(0.035, 0.028, 0.12, M('#fff59d', { transparent: true, opacity: 0.75, roughness: 0.1 }), 16); glass.position.y = 0.06; holdItems.water.add(glass);
    const lemon = cyl(0.025, 0.025, 0.006, M('#c6ff00'), 14); lemon.rotation.z = Math.PI / 2; lemon.position.set(0.035, 0.11, 0); holdItems.water.add(lemon);
    for (const k in holdItems) { holdItems[k].position.set(0, -0.3, 0.06); holdItems[k].visible = false; arms[1].elbow.add(holdItems[k]); }
  }

  arms[-1].elbow.add(bag);
  // chân
  const legs = {};
  for (const s of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(s * 0.062, 0.9, 0); body.add(hip);
    const thigh = cyl(0.068, 0.046, 0.44, mats.skin); thigh.position.y = -0.22; hip.add(thigh); parts.thigh.push(thigh);
    const knee = new THREE.Group(); knee.position.y = -0.44; hip.add(knee);
    const calf = cyl(0.046, 0.027, 0.4, mats.skin); calf.position.y = -0.2; knee.add(calf); parts.calf.push(calf);
    const shoe = new THREE.Group(); shoe.position.y = -0.41; knee.add(shoe);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.12), mats.shoe); foot.position.set(0, -0.015, 0.035); foot.rotation.x = -0.3; shoe.add(foot);
    const heel = cyl(0.008, 0.005, 0.06, mats.shoe, 8); heel.position.set(0, -0.03, -0.02); shoe.add(heel);
    legs[s] = { hip, knee };
  }

  let skirtMesh = null;
  const flaps = new THREE.Group(); body.add(flaps);
  let longSkirt = false;

  // ---------------- tóc ----------------
  function buildHair(style) {
    hairGroup.clear();
    const hm = mats.hair;
    const add = (m) => { hairGroup.add(m); return m; };
    add(new THREE.Mesh(new THREE.SphereGeometry(0.133, 32, 16, 0, Math.PI * 2, 0, 1.05), hm));
    const tied = style === 'pony' || style === 'twin' || style === 'bun';
    const backTheta = tied ? 1.75 : style === 'bob' ? 2.05 : 2.2;
    const backR = style === 'bob' ? 0.142 : 0.136;
    add(new THREE.Mesh(new THREE.SphereGeometry(backR, 32, 20, Math.PI / 2 + 0.72, Math.PI * 2 - 1.44, 0, backTheta), hm));
    // mái
    if (style === 'midpart') {
      // rẽ ngôi giữa: hai mảng mái hất sang hai bên, chừa đường ngôi
      for (const s of [-1, 1]) {
        const half = add(new THREE.Mesh(new THREE.SphereGeometry(0.137, 16, 10, s > 0 ? Math.PI / 2 - 0.93 : Math.PI / 2 + 0.03, 0.9, 0, 1.12), hm));
        half.rotation.z = -s * 0.04;
      }
      // tóc ôm hai bên má (mảng dẹt áp sát mặt)
      for (const s of [-1, 1]) {
        const f = add(sph(0.05, hm, 16, 12)); f.scale.set(0.42, 2.0, 0.8); f.position.set(s * 0.104, -0.045, 0.045); f.rotation.z = s * 0.1;
      }
    } else {
      add(new THREE.Mesh(new THREE.SphereGeometry(0.136, 28, 10, Math.PI / 2 - 0.86, 1.72, 0, 1.2), hm));
    }
    if (style === 'midpart') {
      const mass = add(sph(0.13, hm)); mass.scale.set(1.05, 2.8, 0.55); mass.position.set(0, -0.27, -0.07);
      for (const s of [-1, 1]) { const st = add(caps(0.028, 0.34, hm)); st.position.set(s * 0.108, -0.24, 0.035); st.rotation.z = s * 0.06; }
    } else if (style === 'long' || style === 'wave') {
      const mass = add(sph(0.13, hm)); mass.scale.set(1.05, 2.5, 0.55); mass.position.set(0, -0.23, -0.07);
      for (const s of [-1, 1]) {
        const st = add(caps(0.028, 0.28, hm)); st.position.set(s * 0.108, -0.2, 0.035); st.rotation.z = s * 0.06;
      }
      if (style === 'wave') {
        for (let i = 0; i < 8; i++) {
          const s = i % 2 ? 1 : -1; const y = -0.22 - Math.floor(i / 2) * 0.09;
          const b = add(sph(0.05, hm, 12, 10)); b.position.set(s * (0.11 + (i % 4) * 0.01), y, -0.05);
        }
        for (const s of [-1, 1]) { const b = add(sph(0.038, hm, 12, 10)); b.position.set(s * 0.11, -0.36, 0.035); }
      }
    } else if (style === 'pony') {
      const tie = add(sph(0.035, hm)); tie.position.set(0, 0.03, -0.135);
      const tail = add(caps(0.048, 0.34, hm)); tail.position.set(0, -0.17, -0.18); tail.rotation.x = 0.28;
      const tip = add(sph(0.04, hm)); tip.position.set(0, -0.37, -0.22);
      const band = add(new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.009, 8, 16), mats.cloth)); band.position.set(0, 0.03, -0.15);
    } else if (style === 'twin') {
      for (const s of [-1, 1]) {
        const tie = add(sph(0.034, hm)); tie.position.set(s * 0.12, 0.0, -0.06);
        const tail = add(caps(0.042, 0.32, hm)); tail.position.set(s * 0.15, -0.2, -0.06); tail.rotation.z = s * 0.15;
        const band = add(new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.008, 8, 16), mats.cloth)); band.position.set(s * 0.13, -0.02, -0.06); band.rotation.y = Math.PI / 2;
      }
    } else if (style === 'bob') {
      for (const s of [-1, 1]) { const st = add(caps(0.035, 0.12, hm)); st.position.set(s * 0.115, -0.1, 0.02); }
    } else if (style === 'bun') {
      const bun = add(sph(0.068, hm)); bun.position.set(0, 0.13, -0.07);
      const ring = add(new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 8, 18), mats.cloth)); ring.position.set(0, 0.1, -0.06); ring.rotation.x = Math.PI / 2 + 0.4;
    }
  }

  // ---------------- phụ kiện ----------------
  function buildAccessories(a) {
    accHead.clear(); accBody.clear();
    for (const s of [-1, 1]) {
      const ex = s * 0.124, ey = -0.04;
      if (a.earrings === 'pearl') { const e = sph(0.014, mats.pearl, 10, 8); e.position.set(ex, ey, 0.005); accHead.add(e); }
      if (a.earrings === 'hoop') { const e = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.0035, 6, 18), mats.gold); e.position.set(ex, ey - 0.02, 0); e.rotation.y = Math.PI / 2; accHead.add(e); }
      if (a.earrings === 'drop') {
        const ch = cyl(0.002, 0.002, 0.05, mats.gold, 4); ch.position.set(ex, ey - 0.025, 0); accHead.add(ch);
        const g = new THREE.Mesh(new THREE.OctahedronGeometry(0.014), M('#e1f5fe', { metalness: 0.6, roughness: 0.05, emissive: '#4fc3f7', emissiveIntensity: 0.4 }));
        g.position.set(ex, ey - 0.06, 0); g.scale.y = 1.4; accHead.add(g);
      }
    }
    if (a.clip === 'bow') {
      const c = M('#ec407a');
      const bow = new THREE.Group();
      for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.06, 4), c); w.rotation.z = s * Math.PI / 2; w.position.x = s * 0.03; bow.add(w); }
      bow.add(sph(0.014, c, 8, 6));
      bow.position.set(0.075, 0.105, 0.05); bow.rotation.set(-0.3, 0.4, -0.4); accHead.add(bow);
    }
    if (a.clip === 'flower') {
      const f = new THREE.Group();
      for (let i = 0; i < 5; i++) { const p = sph(0.018, M('#fff176'), 8, 6); const an = (i / 5) * Math.PI * 2; p.position.set(Math.cos(an) * 0.02, Math.sin(an) * 0.02, 0); f.add(p); }
      const ctr = sph(0.013, M('#ff7043'), 8, 6); ctr.position.z = 0.008; f.add(ctr);
      f.position.set(0.085, 0.09, 0.07); f.rotation.y = 0.6; accHead.add(f);
    }
    if (a.clip === 'crown') {
      const cr = new THREE.Group();
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.006, 6, 24), mats.gold); band.rotation.x = Math.PI / 2; cr.add(band);
      for (let i = 0; i < 7; i++) {
        const an = (i / 7) * Math.PI * 2; const sp = new THREE.Mesh(new THREE.ConeGeometry(0.009, 0.035, 5), mats.gold);
        sp.position.set(Math.cos(an) * 0.06, 0.017, Math.sin(an) * 0.06); cr.add(sp);
        const gem = sph(0.006, M('#e91e63', { emissive: '#e91e63', emissiveIntensity: 0.3 }), 6, 4); gem.position.set(Math.cos(an) * 0.06, 0.038, Math.sin(an) * 0.06); cr.add(gem);
      }
      cr.position.set(0, 0.135, -0.01); cr.rotation.x = -0.15; accHead.add(cr);
    }
    if (a.glasses && a.glasses !== 'none') {
      const gm = a.glasses === 'cat' ? M('#ad1457', { roughness: 0.3 }) : mats.black;
      for (const s of [-1, 1]) {
        const r = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.0035, 6, 24), gm);
        r.position.set(s * 0.043, 0.0, 0.132);
        if (a.glasses === 'cat') { r.scale.set(1.15, 0.8, 1); r.rotation.z = s * 0.25; }
        accHead.add(r);
        const arm = cyl(0.002, 0.002, 0.12, gm, 4); arm.rotation.x = Math.PI / 2; arm.position.set(s * 0.115, 0.01, 0.07); accHead.add(arm);
      }
      const br = cyl(0.002, 0.002, 0.03, gm, 4); br.rotation.z = Math.PI / 2; br.position.set(0, 0.008, 0.135); accHead.add(br);
    }
    if (a.necklace === 'pearl') {
      const n = new THREE.Group();
      for (let i = 0; i < 20; i++) { const an = (i / 20) * Math.PI * 2; const p = sph(0.008, mats.pearl, 8, 6); p.position.set(Math.cos(an) * 0.052, 0, Math.sin(an) * 0.05); n.add(p); }
      n.position.set(0, 1.305, 0.012); n.rotation.x = 0.35; accBody.add(n);
    }
    if (a.necklace === 'choker') {
      const ch = new THREE.Mesh(new THREE.TorusGeometry(0.037, 0.008, 6, 24), mats.black); ch.rotation.x = Math.PI / 2; ch.position.y = 1.365; accBody.add(ch);
      const gem = sph(0.009, M('#e91e63', { metalness: 0.5, roughness: 0.1 }), 8, 6); gem.position.set(0, 1.36, 0.042); accBody.add(gem);
    }
  }

  // ---------------- áp dụng ngoại hình ----------------
  let current = null, curExpr = 'none';
  function update(a) {
    current = { ...a };
    mats.skin.color.set(a.skin);
    mats.hair.color.set(a.hairColor);
    mats.shoe.color.set(a.shoes || '#222');
    const o = OUTFITS.find((x) => x.id === (a.uniform ? 'aodai' : a.outfit)) || OUTFITS[0];
    mats.cloth.color.set(a.outfitColor);
    mats.cloth.metalness = o.sparkle ? 0.45 : 0.05;
    mats.cloth.roughness = o.sparkle ? 0.28 : 0.6;
    mats.cloth.emissive.set(o.sparkle ? a.outfitColor : '#000');
    mats.cloth.emissiveIntensity = o.sparkle ? 0.12 : 0;
    for (const k of ['torso', 'chest', 'shoulder', 'upper', 'fore']) for (const m of parts[k]) m.material = o.cover[k] ? mats.cloth : mats.skin;
    mats.pants.color.set(o.pants || '#fafafa');
    for (const m of [...parts.thigh, ...parts.calf]) m.material = o.pants ? mats.pants : mats.skin;
    collar.visible = !!o.collar;
    // váy
    if (skirtMesh) { body.remove(skirtMesh); skirtMesh.geometry.dispose(); skirtMesh = null; }
    longSkirt = o.skirt === 'mermaid' || o.skirt === 'ball';
    if (o.skirt) {
      const pts = SKIRTS[o.skirt].map(([r, y]) => new THREE.Vector2(r, y));
      const geo = new THREE.LatheGeometry(pts, o.skirt === 'pleat' ? 22 : 40);
      if (o.skirt === 'pleat') geo.computeVertexNormals();
      skirtMesh = new THREE.Mesh(geo, mats.cloth);
      body.add(skirtMesh);
    }
    // tà áo dài
    flaps.clear();
    if (o.flaps) {
      for (const z of [1, -1]) {
        const shape = new THREE.Shape();
        shape.moveTo(-0.1, 0); shape.lineTo(0.1, 0); shape.lineTo(0.13, -0.68); shape.lineTo(-0.13, -0.68); shape.lineTo(-0.1, 0);
        const fl = new THREE.Mesh(new THREE.ShapeGeometry(shape), mats.cloth);
        fl.position.set(0, 1.0, z * 0.1); fl.rotation.x = z * 0.12;
        flaps.add(fl);
      }
    }
    buildHair(a.hair);
    buildAccessories(a);
    bag.visible = a.bag === 'tui';
    drawFace(faceCtx, a, curExpr);
    faceTex.needsUpdate = true;
    body.scale.setScalar(a.height || 1);
  }

  function setHolding(kind) {
    for (const k in holdItems) holdItems[k].visible = k === kind;
  }

  // ---------------- hoạt ảnh ----------------
  function setExpr(e) { if (e === curExpr) return; curExpr = e; if (current) { drawFace(faceCtx, current, e); faceTex.needsUpdate = true; } }
  function animate(anim, t, moveAmt, holding) {
    setExpr(anim === 'dance' || anim === 'wave' || anim === 'pole' || anim === 'qchange' ? 'smile' : anim === 'sing' ? (Math.sin(t * 9) > -0.3 ? 'sing' : 'smile') : 'none');
    const swingAmp = longSkirt ? 0.22 : 0.5;
    const phase = t * 9;
    for (const s of [-1, 1]) {
      arms[s].sh.rotation.set(0, 0, s * 0.12);
      arms[s].elbow.rotation.set(-0.12, 0, 0);
      legs[s].hip.rotation.set(0, 0, 0);
      legs[s].knee.rotation.set(0, 0, 0);
    }
    body.position.set(0, 0, 0);
    body.rotation.order = 'XYZ';
    body.rotation.set(0, 0, 0);
    headPivot.rotation.set(0, 0, 0);
    mic.visible = false;

    if (anim === 'walk' && moveAmt > 0.01) {
      for (const s of [-1, 1]) {
        const sw = Math.sin(phase + (s > 0 ? Math.PI : 0)) * swingAmp;
        legs[s].hip.rotation.x = -sw;
        legs[s].knee.rotation.x = Math.max(0, Math.sin(phase + (s > 0 ? Math.PI : 0) + 1.4)) * 0.6 * (longSkirt ? 0.5 : 1);
        arms[s].sh.rotation.x = sw * 0.7;
      }
      body.position.y = Math.abs(Math.sin(phase)) * 0.02;
      body.rotation.y = Math.sin(phase) * 0.06;
    } else if (anim === 'dance') {
      const move = Math.floor(t / 3.2) % 4, d = t * 7;
      if (move === 0) {
        // disco chỉ trời
        const up = Math.sin(d * 0.5) > 0;
        arms[1].sh.rotation.set(0, 0, up ? 2.7 : 0.5); arms[1].elbow.rotation.set(0, 0, 0);
        arms[-1].sh.rotation.set(0, 0, -0.5); arms[-1].elbow.rotation.set(-1.6, 0, 0);
        body.rotation.z = up ? -0.15 : 0.1; body.position.x = up ? 0.05 : -0.04;
        legs[1].hip.rotation.z = up ? -0.25 : 0; legs[-1].knee.rotation.x = up ? 0.3 : 0.1;
        headPivot.rotation.z = up ? -0.25 : 0.1; headPivot.rotation.x = up ? -0.2 : 0;
      } else if (move === 1) {
        // cưỡi ngựa
        const hop = Math.abs(Math.sin(d));
        body.position.y = hop * 0.08 - 0.03;
        for (const s of [-1, 1]) {
          arms[s].sh.rotation.set(-1.1, 0, s * 0.2); arms[s].elbow.rotation.set(-1.2 + Math.sin(d * 2) * 0.15, 0, 0);
          const ph = Math.sin(d + (s > 0 ? Math.PI : 0));
          legs[s].hip.rotation.set(-Math.max(0, ph) * 0.9, 0, s * 0.15); legs[s].knee.rotation.x = Math.max(0, ph) * 1.4;
        }
        body.rotation.y = Math.sin(d * 0.5) * 0.3; headPivot.rotation.x = Math.sin(d * 2) * 0.12;
      } else if (move === 2) {
        // quạt tay cối xay gió + xoay vòng
        body.rotation.y = d * 0.9;
        arms[1].sh.rotation.set(d * 1.8, 0, 1.35); arms[-1].sh.rotation.set(d * 1.8 + Math.PI, 0, -1.35);
        body.position.y = Math.abs(Math.sin(d * 1.2)) * 0.05;
        headPivot.rotation.z = Math.sin(d) * 0.3;
        for (const s of [-1, 1]) legs[s].knee.rotation.x = Math.abs(Math.sin(d + s)) * 0.3;
      } else {
        // lắc hông + vẫy tay
        const sw = Math.sin(d);
        body.position.x = sw * 0.08; body.rotation.z = -sw * 0.18;
        body.position.y = Math.max(0, Math.sin(d * 2)) * 0.06;
        for (const s of [-1, 1]) {
          arms[s].sh.rotation.set(0, 0, s * (2.6 + Math.sin(d * 2 + s) * 0.3)); arms[s].elbow.rotation.set(0, 0, s * Math.sin(d * 3) * 0.6);
          legs[s].hip.rotation.z = s * Math.max(0, sw * s) * 0.25; legs[s].knee.rotation.x = Math.max(0, -sw * s) * 0.5;
        }
        headPivot.rotation.z = sw * 0.35;
      }
    } else if (anim === 'pole') {
      // nhóm (group) đặt ở tâm cột; thân xoay quanh cột, tay phải nắm cột
      const ph = Math.floor(t / 5) % 3, lt = t % 5;
      const spin = ph === 0 ? t * 1.6 : ph === 1 ? t * 3.2 : t * 1.1;
      const R = 0.2;
      body.rotation.order = 'YXZ';
      body.position.set(Math.sin(spin) * R, 0, Math.cos(spin) * R);
      body.rotation.y = spin + Math.PI / 2;
      arms[1].sh.rotation.set(0, 0, 2.85); arms[1].elbow.rotation.set(0, 0, 0.1);
      if (ph === 0) {
        // đi vòng quanh cột, ưỡn người
        body.rotation.z = 0.22; body.rotation.x = -0.08;
        arms[-1].sh.rotation.set(0, 0, -1.2 - Math.sin(t * 3) * 0.3);
        for (const s of [-1, 1]) {
          const sw = Math.sin(t * 6 + (s > 0 ? Math.PI : 0)) * 0.35;
          legs[s].hip.rotation.x = -sw; legs[s].knee.rotation.x = Math.max(0, sw) * 0.6;
        }
        headPivot.rotation.z = 0.25; headPivot.rotation.x = -0.15;
      } else if (ph === 1) {
        // leo lên rồi xoay tròn tụt xuống (fireman spin)
        const h = lt < 1.2 ? (lt / 1.2) * 0.55 : 0.55 * (1 - (lt - 1.2) / 3.8);
        body.position.y = h;
        body.rotation.z = 0.35;
        arms[-1].sh.rotation.set(0, 0, 2.3); arms[-1].elbow.rotation.set(0, 0, -0.6);
        legs[1].hip.rotation.set(-1.3, 0, 0.2); legs[1].knee.rotation.x = 1.5;
        legs[-1].hip.rotation.set(-0.5, 0, -0.35); legs[-1].knee.rotation.x = 0.2;
        headPivot.rotation.z = 0.4; headPivot.rotation.x = -0.25;
      } else {
        // ngồi vắt chân trên cao, ngả người ra sau, xoay chậm
        body.position.y = 0.75 + Math.sin(t * 2) * 0.03;
        body.rotation.z = 0.15; body.rotation.x = -0.35;
        arms[-1].sh.rotation.set(-0.3, 0, -1.7 - Math.sin(t * 2) * 0.25);
        legs[1].hip.rotation.set(-1.5, 0, 0.35); legs[1].knee.rotation.x = 1.7;
        legs[-1].hip.rotation.set(-1.0, 0, -0.25); legs[-1].knee.rotation.x = 0.9 + Math.sin(t * 2) * 0.2;
        headPivot.rotation.x = -0.4; headPivot.rotation.z = Math.sin(t * 1.5) * 0.15;
      }
    } else if (anim === 'qchange') {
      // xoay tít, bay lên, tay giơ cao
      const k = (t * 1000 % 1600) / 1600;
      body.rotation.y = t * 22;
      body.position.y = Math.sin(Math.min(1, k * 1.25) * Math.PI) * 0.35;
      for (const s of [-1, 1]) { arms[s].sh.rotation.set(0, 0, s * 2.9); legs[s].hip.rotation.z = s * 0.08; }
      legs[-1].knee.rotation.x = 0.5;
      headPivot.rotation.x = -0.25;
    } else if (anim === 'stun') {
      body.rotation.x = -1.48; body.position.y = 0.12;
      arms[1].sh.rotation.set(0, 0, 1.4 + Math.sin(t * 12) * 0.15); arms[-1].sh.rotation.set(0, 0, -1.4 - Math.sin(t * 12) * 0.15);
      legs[1].hip.rotation.z = 0.25; legs[-1].hip.rotation.z = -0.25 + Math.sin(t * 14) * 0.1;
      headPivot.rotation.y = Math.sin(t * 6) * 0.4;
    } else if (anim === 'wave') {
      arms[1].sh.rotation.z = 2.6;
      arms[1].elbow.rotation.z = Math.sin(t * 10) * 0.4;
      headPivot.rotation.z = -0.1;
    } else if (anim === 'sing') {
      arms[1].sh.rotation.set(-1.0, 0, 0.35);
      arms[1].elbow.rotation.set(-1.9, 0, 0);
      mic.visible = true;
      arms[-1].sh.rotation.z = -0.4 - Math.sin(t * 3) * 0.3;
      body.rotation.y = Math.sin(t * 2) * 0.12;
      headPivot.rotation.x = -0.12 + Math.sin(t * 4) * 0.05;
    } else {
      // đứng yên: thở nhẹ, đứng dáng
      body.position.y = Math.sin(t * 2) * 0.004;
      legs[1].hip.rotation.z = 0.04;
      legs[-1].knee.rotation.x = 0.12;
      legs[-1].hip.rotation.x = -0.05;
      arms[-1].sh.rotation.z = -0.15 - Math.sin(t * 2) * 0.02;
      headPivot.rotation.z = Math.sin(t * 0.7) * 0.04;
    }
    if (holding) {
      arms[1].sh.rotation.set(-0.9, 0, 0.1);
      arms[1].elbow.rotation.set(-0.7, 0, 0);
    }
  }

  update(app);
  return { group, body, update, animate, setHolding, headY: 1.47, topY: 1.75, get app() { return current; } };
}

// ======================= KHÁCH HÀNG =======================
// expr: joy | happy | normal | annoyed | angry | sad | pain | sneaky ; drunk: 0..3
function drawCustomerFace(ctx, type, expr = 'normal', drunk = 0) {
  const cx = 128;
  ctx.clearRect(0, 0, 256, 200);
  ctx.save(); ctx.translate(128, 108); ctx.scale(1.32, 1.32); ctx.translate(-128, -108);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (drunk > 0 || expr === 'angry' || type === 'sep' || expr === 'pain') {
    const a = expr === 'angry' || expr === 'pain' ? 0.5 : 0.2 + drunk * 0.15;
    ctx.fillStyle = `rgba(229,57,53,${a})`;
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(cx + s * 62, 122, 24, 15, 0, 0, Math.PI * 2); ctx.fill(); }
  }
  if (drunk >= 2) { ctx.fillStyle = 'rgba(229,57,53,0.75)'; ctx.beginPath(); ctx.ellipse(cx, 112, 13, 10, 0, 0, Math.PI * 2); ctx.fill(); }
  for (const s of [-1, 1]) {
    const ex = cx + s * 44, ey = 90;
    ctx.strokeStyle = '#1b1414'; ctx.fillStyle = '#1b1414';
    if (expr === 'sad') {
      ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(ex, ey - 6, 13, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
      ctx.fillStyle = 'rgba(79,195,247,0.85)'; ctx.fillRect(ex - 5, ey + 6, 10, 60); // dòng nước mắt
    } else if (expr === 'pain') {
      ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(ex - s * 14, ey - 10); ctx.lineTo(ex + s * 6, ey); ctx.lineTo(ex - s * 14, ey + 10); ctx.stroke(); // > <
    } else if (expr === 'sneaky') {
      ctx.beginPath(); ctx.ellipse(ex, ey, 14, 9, 0, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = '#1b1414'; ctx.beginPath(); ctx.arc(ex + 8, ey, 6, 0, Math.PI * 2); ctx.fill(); // liếc ngang
    } else if (drunk >= 2 && expr !== 'angry' && expr !== 'joy') {
      ctx.lineWidth = 3.5; ctx.beginPath();
      for (let k = 0; k < 40; k++) { const an = k * 0.45 * s, r = 1 + k * 0.33; const x = ex + Math.cos(an) * r, y = ey + Math.sin(an) * r; k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke();
    } else if (expr === 'joy' || expr === 'happy') {
      ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(ex, ey + 8, 14, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
    } else if (expr === 'annoyed') {
      ctx.beginPath(); ctx.ellipse(ex, ey + 4, 9, 8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(ex - 16, ey - 3); ctx.lineTo(ex + 16, ey - 3); ctx.stroke();
    } else if (expr === 'angry') {
      ctx.beginPath(); ctx.ellipse(ex, ey + 4, 8, 10, 0, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.beginPath(); ctx.ellipse(ex, ey, 9, 12, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex - 3, ey - 4, 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = '#2b1b14'; ctx.lineWidth = 7; ctx.beginPath();
    if (expr === 'angry') { ctx.moveTo(cx + s * 20, 72); ctx.lineTo(cx + s * 64, 54); }
    else if (expr === 'sad' || expr === 'pain') { ctx.moveTo(cx + s * 20, 58); ctx.lineTo(cx + s * 62, 70); }
    else if (expr === 'annoyed') { ctx.moveTo(cx + s * 24, 66); ctx.lineTo(cx + s * 62, 62); }
    else if (expr === 'joy' || expr === 'happy') { ctx.moveTo(cx + s * 26, 56); ctx.quadraticCurveTo(cx + s * 44, 44, cx + s * 64, 54); }
    else { ctx.moveTo(cx + s * 26, 62); ctx.lineTo(cx + s * 62, 58); }
    ctx.stroke();
  }
  if (type === 'bolero' || type === 'baove') {
    ctx.fillStyle = type === 'baove' ? '#cfd8dc' : '#3a3a3a';
    ctx.beginPath(); ctx.ellipse(110, 126, 22, 7, 0.2, 0, Math.PI * 2); ctx.ellipse(146, 126, 22, 7, -0.2, 0, Math.PI * 2); ctx.fill();
  }
  if (type === 'wife') { // son môi đỏ chót
    ctx.fillStyle = '#c62828';
  }
  const my = 145;
  ctx.strokeStyle = '#6d2f2a'; ctx.lineWidth = 5;
  if (expr === 'joy') {
    ctx.fillStyle = '#5a1420'; ctx.beginPath(); ctx.moveTo(cx - 36, my - 8); ctx.quadraticCurveTo(cx, my - 2, cx + 36, my - 8); ctx.quadraticCurveTo(cx, my + 50, cx - 36, my - 8); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillRect(cx - 26, my - 6, 52, 8);
    ctx.fillStyle = '#e57373'; ctx.beginPath(); ctx.ellipse(cx, my + 22, 14, 8, 0, 0, Math.PI * 2); ctx.fill();
  } else if (expr === 'happy') {
    ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(cx, my - 14, 30, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
  } else if (expr === 'annoyed') {
    ctx.beginPath(); ctx.moveTo(cx - 22, my); for (let k = 1; k <= 4; k++) ctx.lineTo(cx - 22 + k * 11, my + (k % 2 ? -5 : 5)); ctx.stroke();
  } else if (expr === 'angry') {
    ctx.fillStyle = type === 'wife' ? '#c62828' : '#5a1420'; ctx.beginPath(); ctx.moveTo(cx - 28, my + 12); ctx.quadraticCurveTo(cx, my - 14, cx + 28, my + 12); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillRect(cx - 18, my + 2, 36, 8);
  } else if (expr === 'sad' || expr === 'pain') {
    ctx.fillStyle = '#5a1420'; ctx.beginPath(); ctx.ellipse(cx, my + 4, 22, 16, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#6d2f2a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(cx - 20, my - 2);
    for (let k = 1; k <= 4; k++) ctx.lineTo(cx - 20 + k * 10, my - 2 + (k % 2 ? 4 : -4)); ctx.stroke();
  } else if (expr === 'sneaky') {
    ctx.beginPath(); ctx.moveTo(cx - 20, my); ctx.quadraticCurveTo(cx + 4, my + 10, cx + 24, my - 8); ctx.stroke();
    ctx.fillStyle = 'rgba(129,212,250,0.9)'; ctx.beginPath(); ctx.moveTo(cx + 70, 40); ctx.quadraticCurveTo(cx + 80, 62, cx + 70, 66); ctx.quadraticCurveTo(cx + 60, 62, cx + 70, 40); ctx.fill(); // giọt mồ hôi
  } else if (drunk >= 2) {
    ctx.beginPath(); ctx.moveTo(cx - 24, my); ctx.quadraticCurveTo(cx, my + 16, cx + 20, my - 6); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.arc(cx, my - 6, 22, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();
  }
  if (expr === 'angry') {
    ctx.strokeStyle = '#e53935'; ctx.lineWidth = 5;
    const vx = cx + 60, vy = 44;
    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { ctx.beginPath(); ctx.moveTo(vx + dx * 4, vy + dy * 14); ctx.quadraticCurveTo(vx + dx * 4, vy + dy * 4, vx + dx * 14, vy + dy * 4); ctx.stroke(); }
  }
  ctx.restore();
}

// chân có khớp: ngồi hoặc đứng/đi được
function buildLegs(parent, pants, shoeColor = '#1b1b1b') {
  const legs = {};
  for (const s of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(s * 0.09, 0.5, 0); parent.add(hip);
    const thigh = cyl(0.07, 0.065, 0.42, pants); thigh.position.y = -0.21; hip.add(thigh);
    const knee = new THREE.Group(); knee.position.y = -0.42; hip.add(knee);
    const calf = cyl(0.06, 0.05, 0.44, pants); calf.position.y = -0.22; knee.add(calf);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 0.18), M(shoeColor)); shoe.position.set(0, -0.47, 0.04); knee.add(shoe);
    legs[s] = { hip, knee };
  }
  return legs;
}
function buildArms(parent, sleeve, skin, y = 0.42, x = 0.21) {
  const arms = {};
  for (const s of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(s * x, y, 0.02); parent.add(sh);
    const up = cyl(0.05, 0.045, 0.3, sleeve); up.position.y = -0.15; sh.add(up);
    const el = new THREE.Group(); el.position.y = -0.3; sh.add(el);
    const fo = cyl(0.045, 0.04, 0.26, skin); fo.rotation.x = Math.PI / 2; fo.position.z = 0.13; el.add(fo);
    const hand = sph(0.04, skin, 10, 8); hand.position.z = 0.27; el.add(hand);
    arms[s] = { sh, el };
  }
  return arms;
}
function makeFace(headG, type) {
  const fc = document.createElement('canvas'); fc.width = 256; fc.height = 200;
  const fctx = fc.getContext('2d');
  drawCustomerFace(fctx, type);
  const ft = new THREE.CanvasTexture(fc); ft.colorSpace = THREE.SRGBColorSpace;
  headG.add(new THREE.Mesh(new THREE.SphereGeometry(0.1215, 24, 16, Math.PI / 2 - 0.8, 1.6, 1.05, 1.0), new THREE.MeshStandardMaterial({ map: ft, transparent: true, roughness: 0.7 })));
  return { fctx, ft };
}
// pose đi bộ dùng chung
function walkPose(legs, arms, t, amp = 0.55) {
  for (const s of [-1, 1]) {
    const sw = Math.sin(t * 9 + (s > 0 ? Math.PI : 0)) * amp;
    legs[s].hip.rotation.set(-sw, 0, 0);
    legs[s].knee.rotation.x = Math.max(0, Math.sin(t * 9 + (s > 0 ? Math.PI : 0) + 1.4)) * 0.7;
    if (arms) arms[s].sh.rotation.set(sw * 0.8, 0, s * 0.12);
  }
}

export function createCustomer(type, variant = 0) {
  const info = CUSTOMER_TYPES[type] || CUSTOMER_TYPES.daigia;
  const g = new THREE.Group();
  const root = new THREE.Group(); g.add(root);
  const shirtC = info.variants ? info.variants[variant % info.variants.length] : info.shirt;
  const skin = M(info.skin), shirt = M(shirtC), pants = M(info.pants), hairM = M(info.hair, { roughness: 0.5 });
  const baseSkin = new THREE.Color(info.skin), redSkin = new THREE.Color('#e5533d');
  const pelvis = sph(0.17, pants); pelvis.scale.set(1.1, 0.6, 1); pelvis.position.y = 0.5; root.add(pelvis);
  const legs = buildLegs(root, pants);
  const upper = new THREE.Group(); upper.position.y = 0.5; root.add(upper);
  const torso = cyl(0.15, 0.17, 0.42, shirt); torso.position.y = 0.24; upper.add(torso);
  if (type === 'daigia' || type === 'sep') { const belly = sph(0.16, shirt); belly.scale.set(1, 0.9, 0.8); belly.position.set(0, 0.18, 0.06); upper.add(belly); }
  const neck = cyl(0.05, 0.055, 0.08, skin); neck.position.y = 0.48; upper.add(neck);
  const headG = new THREE.Group(); headG.position.y = 0.6; upper.add(headG);
  headG.add(sph(0.12, skin, 24, 18));
  const { fctx, ft } = makeFace(headG, type);
  headG.add(new THREE.Mesh(new THREE.SphereGeometry(0.127, 24, 12, 0, Math.PI * 2, 0, type === 'bolero' ? 0.7 : 1.15), hairM));
  const arms = buildArms(upper, shirt, skin);
  const gold = M('#e8c25a', { metalness: 0.9, roughness: 0.25 });
  if (type === 'daigia') {
    const chain = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.012, 8, 24), gold); chain.rotation.x = Math.PI / 2 - 0.3; chain.position.set(0, 0.42, 0.04); upper.add(chain);
    for (const s of [-1, 1]) { const gl = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.035, 0.01), M('#111', { metalness: 0.6, roughness: 0.1 })); gl.position.set(s * 0.042, 0.01, 0.12); headG.add(gl); }
  }
  if (type === 'bolero') {
    const brim = cyl(0.19, 0.19, 0.012, M('#5d4037'), 20); brim.position.y = 0.09; headG.add(brim);
    const top = cyl(0.11, 0.12, 0.09, M('#5d4037'), 20); top.position.y = 0.14; headG.add(top);
  }
  if (type === 'sep') { const tie = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.28, 4), M('#c62828')); tie.rotation.x = Math.PI; tie.position.set(0, 0.28, 0.165); upper.add(tie); }
  if (type === 'keo') {
    const c = sph(0.13, M('#1e88e5'), 20, 10); c.scale.y = 0.6; c.position.y = 0.06; headG.add(c);
    const bill = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.012, 0.12), M('#1565c0')); bill.position.set(0, 0.04, -0.17); headG.add(bill);
  }
  if (type === 'oppa') headG.add(new THREE.Mesh(new THREE.SphereGeometry(0.13, 20, 8, Math.PI / 2 - 0.9, 1.8, 0.4, 0.9), hairM));
  if (type === 'genz') {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.012, 8, 20, Math.PI), M('#212121')); band.position.y = 0.02; headG.add(band);
    for (const s of [-1, 1]) { const cup = cyl(0.04, 0.04, 0.03, M('#ff4081'), 14); cup.rotation.z = Math.PI / 2; cup.position.set(s * 0.13, 0.0, 0); headG.add(cup); }
  }
  if (type === 'baove') {
    const cap = cyl(0.125, 0.13, 0.07, M('#1f2a4d'), 20); cap.position.y = 0.1; headG.add(cap);
    const bill = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.015, 0.1), M('#111')); bill.position.set(0, 0.07, 0.15); headG.add(bill);
    const badge = cyl(0.025, 0.025, 0.01, gold, 6); badge.rotation.x = Math.PI / 2; badge.position.set(0, 0.11, 0.128); headG.add(badge);
    const pocket = cyl(0.03, 0.03, 0.01, gold, 6); pocket.rotation.x = Math.PI / 2; pocket.position.set(0.08, 0.34, 0.16); upper.add(pocket);
  }
  if (type === 'thattinh') {
    const hood = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.05, 8, 20), shirt); hood.rotation.x = Math.PI / 2 - 0.2; hood.position.set(0, 0.47, -0.05); upper.add(hood);
    for (let i = 0; i < 6; i++) { const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.08, 5), hairM); tuft.position.set(Math.cos(i) * 0.08, 0.12, Math.sin(i * 2) * 0.06); tuft.rotation.set(Math.sin(i) * 0.6, 0, Math.cos(i * 3) * 0.6); headG.add(tuft); }
  }
  if (type === 'congty') {
    const strap = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.008, 6, 20, Math.PI), M('#1e88e5')); strap.rotation.set(Math.PI, 0, 0); strap.position.set(0, 0.44, 0.08); upper.add(strap);
    const card = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.01), M('#fafafa')); card.position.set(0, 0.32, 0.17); upper.add(card);
  }
  // ly bia
  const beer = new THREE.Group();
  beer.add(cyl(0.032, 0.03, 0.11, M('#ffb300', { transparent: true, opacity: 0.85, roughness: 0.15 }), 12));
  const foam = cyl(0.033, 0.033, 0.02, M('#fffde7'), 12); foam.position.y = 0.06; beer.add(foam);
  beer.position.set(0, 0.04, 0.3); arms[1].el.add(beer);
  // hạt bay: khói / bong bóng / nước mắt
  const puffs = [];
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), new THREE.MeshBasicMaterial({ color: '#fff', transparent: true, opacity: 0, depthWrite: false }));
    m.visible = false; headG.add(m); puffs.push(m);
  }

  let faceKey = '';
  function animate(t, c, offset = 0) {
    const data = typeof c === 'number' ? { mood: c } : c || {};
    const mood = data.mood ?? 60, drunk = data.drunk || 0, st = data.st || 'seat';
    const reacting = data.react && Date.now() - (data.reactAt || 0) < 3000;
    let expr = reacting ? (data.react === 'good' ? 'joy' : 'angry') : mood >= 75 ? 'happy' : mood >= 45 ? 'normal' : mood >= 25 ? 'annoyed' : 'angry';
    if (data.crying) expr = 'sad';
    if (data.ear || st === 'drag') expr = 'pain';
    if (st === 'flee') expr = 'sneaky';
    if (st === 'caught') expr = 'pain';
    const key = expr + drunk;
    if (key !== faceKey) { faceKey = key; drawCustomerFace(fctx, type, expr, drunk); ft.needsUpdate = true; }
    const tint = expr === 'angry' ? 0.45 + 0.15 * Math.sin(t * 8) : expr === 'pain' ? 0.35 : drunk * 0.08;
    skin.color.copy(baseSkin).lerp(redSkin, tint);
    // tư thế gốc
    upper.rotation.set(0, 0, 0); upper.position.y = 0.5; headG.rotation.set(0, 0, 0); headG.position.set(0, 0.6, 0);
    for (const s of [-1, 1]) { arms[s].sh.rotation.set(0, 0, s * 0.12); arms[s].el.rotation.set(0, 0, 0); }
    const T = t + offset;
    const standing = st !== 'seat' && st !== 'ghen';
    beer.visible = !standing;
    if (standing) {
      root.position.y = 0.39;
      if (data._walking) walkPose(legs, arms, T, st === 'flee' ? 0.7 : 0.4);
      else for (const s of [-1, 1]) { legs[s].hip.rotation.set(0, 0, 0); legs[s].knee.rotation.set(0, 0, 0); }
      if (st === 'flee') { upper.rotation.x = 0.35; headG.rotation.y = Math.sin(T * 3) * 0.6; } // lom khom, ngó trước ngó sau
      if (st === 'drag') {
        upper.rotation.set(0.2, 0, -0.35); headG.rotation.z = -0.5; // bị kéo tai nghiêng đầu
        arms[-1].sh.rotation.set(-2.6, 0, -0.5); arms[-1].el.rotation.set(-0.8, 0, 0);
        arms[1].sh.rotation.set(-0.6 + Math.sin(T * 10) * 0.4, 0, 0.6); // tay quơ quào
      }
      if (st === 'caught') { arms[1].sh.rotation.set(0, 0, 2.6); arms[-1].sh.rotation.set(0, 0, -2.6); } // giơ tay đầu hàng
    } else {
      root.position.y = 0;
      for (const s of [-1, 1]) { legs[s].hip.rotation.set(-Math.PI / 2, 0, 0); legs[s].knee.rotation.set(Math.PI / 2, 0, 0); }
      if (data.ear) {
        upper.rotation.z = -0.25; headG.rotation.z = -0.5;
        arms[-1].sh.rotation.set(-2.6, 0, -0.4); arms[-1].el.rotation.set(-0.8, 0, 0);
        arms[1].sh.rotation.set(-0.8 + Math.sin(T * 12) * 0.3, 0, 0.4);
      } else if (data.crying) {
        // gục đầu khóc rung vai
        upper.rotation.x = 0.55 + Math.sin(T * 9) * 0.04;
        headG.rotation.x = 0.3;
        for (const s of [-1, 1]) { arms[s].sh.rotation.set(-1.3, 0, s * 0.35); arms[s].el.rotation.set(-0.9, 0, 0); }
      } else if (expr === 'joy') {
        upper.rotation.x = -0.15 + Math.sin(T * 14) * 0.04;
        headG.rotation.x = -0.35; headG.position.y = 0.6 + Math.abs(Math.sin(T * 14)) * 0.02;
        arms[1].sh.rotation.set(-2.3, 0, 0.1); arms[1].el.rotation.set(-0.3 + Math.sin(T * 6) * 0.2, 0, 0);
        arms[-1].sh.rotation.set(-0.3, 0, -0.4); arms[-1].el.rotation.set(-0.2 + Math.sin(T * 12) * 0.5, 0, 0);
      } else if (expr === 'happy') {
        headG.rotation.z = Math.sin(T * 4) * 0.15; headG.position.y = 0.6 + Math.abs(Math.sin(T * 4)) * 0.02;
        upper.rotation.z = Math.sin(T * 2) * 0.05;
        arms[1].sh.rotation.x = -Math.max(0, Math.sin(T * 1.5)) * 1.2;
      } else if (expr === 'annoyed') {
        headG.rotation.y = Math.sin(T * 1.5) * 0.25;
        arms[-1].el.rotation.x = Math.max(0, Math.sin(T * 9)) * 0.15;
      } else if (expr === 'angry') {
        upper.rotation.x = 0.18; headG.rotation.y = Math.sin(T * 12) * 0.25;
        arms[-1].sh.rotation.set(-1.0 + Math.abs(Math.sin(T * 5)) * 0.7, 0, -0.1);
        arms[1].sh.rotation.set(-1.0 + Math.abs(Math.sin(T * 5 + 1.5)) * 0.7, 0, 0.1);
      } else headG.rotation.z = Math.sin(T * 1.2) * 0.04;
      if (drunk > 0 && !data.ear && !data.crying) {
        const k = drunk / 3;
        upper.rotation.z += Math.sin(T * 1.3) * 0.25 * k;
        upper.rotation.x += 0.08 * k + Math.sin(T * 0.9) * 0.06 * k;
        headG.rotation.z += Math.sin(T * 1.3 + 0.8) * 0.3 * k;
        headG.rotation.x += Math.sin(T * 0.7) * 0.15 * k;
        if ((T % 3.3) < 0.15) upper.position.y += 0.04 * k;
        if (expr === 'normal' || expr === 'happy') arms[1].sh.rotation.x += -0.5 - Math.sin(T * 1.3) * 0.3;
      }
    }
    const kind = data.crying ? 'tear' : expr === 'angry' && !standing ? 'steam' : drunk >= 2 && !standing ? 'bubble' : null;
    puffs.forEach((p, i) => {
      if (!kind) { p.visible = false; return; }
      p.visible = true;
      const ph = (T * 0.8 + i / puffs.length) % 1, side = i % 2 ? 1 : -1;
      if (kind === 'steam') {
        p.material.color.set('#ffffff'); p.position.set(side * (0.09 + ph * 0.06), 0.12 + ph * 0.28, -0.02);
        p.scale.setScalar(0.6 + ph * 1.3); p.material.opacity = (1 - ph) * 0.8;
      } else if (kind === 'tear') {
        p.material.color.set('#4fc3f7'); p.position.set(side * 0.05, -0.02 - ph * 0.3, 0.12 + ph * 0.05);
        p.scale.set(0.3, 0.5, 0.3); p.material.opacity = (1 - ph) * 0.9;
      } else {
        p.material.color.set(i % 2 ? '#b3e5fc' : '#f8bbd0'); p.position.set(Math.sin(ph * 6 + i) * 0.08, 0.15 + ph * 0.35, 0.05);
        p.scale.setScalar(0.4 + ph * 0.6); p.material.opacity = (1 - ph) * 0.7;
      }
    });
  }
  return { group: g, animate };
}

// ======================= DÉP TỔ ONG =======================
export function createSlipper() {
  const g = new THREE.Group();
  const sole = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.025, 0.26), M('#e53935', { roughness: 0.6 })); g.add(sole);
  for (let i = 0; i < 6; i++) { const hole = cyl(0.01, 0.01, 0.027, M('#7f0000'), 6); hole.position.set(((i % 3) - 1) * 0.03, 0, -0.06 + Math.floor(i / 3) * 0.05); g.add(hole); }
  const strap = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 6, 16, Math.PI), M('#1e88e5')); strap.position.set(0, 0.01, 0.05); strap.rotation.y = Math.PI / 2; g.add(strap);
  return g;
}

// ======================= NHÂN VẬT PHỤ: VỢ ĐÁNH GHEN, CÔNG AN =======================
export function createNPC(kind) {
  const g = new THREE.Group(); const root = new THREE.Group(); g.add(root);
  const wife = kind === 'wife';
  const skinC = wife ? '#f2c9a8' : '#d9a07a';
  const skin = M(skinC), cloth = M(wife ? '#f48fb1' : '#5d7a3a'), pants = M(wife ? '#f48fb1' : '#4a6430');
  root.position.y = 0.39;
  const pelvis = sph(0.16, pants); pelvis.scale.set(1.1, 0.6, 1); pelvis.position.y = 0.5; root.add(pelvis);
  const legs = buildLegs(root, pants, wife ? '#e53935' : '#111');
  const upper = new THREE.Group(); upper.position.y = 0.5; root.add(upper);
  const torso = cyl(wife ? 0.14 : 0.15, wife ? 0.18 : 0.16, 0.42, cloth); torso.position.y = 0.24; upper.add(torso);
  if (wife) { // hoa văn đồ bộ
    for (let i = 0; i < 10; i++) { const f = sph(0.018, M(i % 2 ? '#fff176' : '#ffffff'), 6, 4); const a = i * 1.3; f.position.set(Math.cos(a) * 0.155, 0.08 + (i % 5) * 0.07, Math.sin(a) * 0.155); upper.add(f); }
  }
  const neck = cyl(0.045, 0.05, 0.08, skin); neck.position.y = 0.48; upper.add(neck);
  const headG = new THREE.Group(); headG.position.y = 0.6; upper.add(headG);
  headG.add(sph(0.12, skin, 24, 18));
  const { fctx, ft } = makeFace(headG, wife ? 'wife' : 'police');
  drawCustomerFace(fctx, wife ? 'wife' : 'police', 'angry'); ft.needsUpdate = true;
  const arms = buildArms(upper, cloth, skin);
  if (wife) {
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.13, 20, 12, 0, Math.PI * 2, 0, 1.3), M('#3e2723')); headG.add(hair);
    const curlers = ['#ff4081', '#40c4ff', '#ffd54f', '#69f0ae', '#ff4081'];
    curlers.forEach((c, i) => { const cu = cyl(0.025, 0.025, 0.09, M(c), 10); cu.rotation.z = Math.PI / 2; cu.position.set(0, 0.09 + Math.cos(i) * 0.02, -0.1 + i * 0.05); cu.position.y = 0.1 + Math.sin(i * 0.8) * 0.02; headG.add(cu); });
    // tay phải: dép tổ ong ; tay trái: chổi lông gà
    const dep = createSlipper(); dep.rotation.x = Math.PI / 2; dep.position.set(0, 0.0, 0.32); arms[1].el.add(dep);
    const broom = new THREE.Group();
    const stick = cyl(0.012, 0.012, 0.6, M('#8d6e63'), 8); stick.position.y = 0.3; broom.add(stick);
    ['#ff7043', '#ffd54f', '#4fc3f7', '#ab47bc', '#66bb6a'].forEach((c, i) => { const f = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.25, 6), M(c)); f.position.set(Math.cos(i * 1.25) * 0.03, 0.68, Math.sin(i * 1.25) * 0.03); f.rotation.set(Math.cos(i) * 0.4, 0, Math.sin(i) * 0.4); broom.add(f); });
    broom.position.set(0, 0, 0.28); broom.rotation.x = Math.PI / 2 - 0.3; arms[-1].el.add(broom);
    g.userData.dep = dep;
  } else {
    const cap = cyl(0.13, 0.12, 0.08, M('#4a6430'), 20); cap.position.y = 0.11; headG.add(cap);
    const top = cyl(0.16, 0.13, 0.03, M('#4a6430'), 20); top.position.y = 0.16; headG.add(top);
    const band = cyl(0.132, 0.132, 0.025, M('#c62828'), 20); band.position.y = 0.09; headG.add(band);
    const bill = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.015, 0.1), M('#111')); bill.position.set(0, 0.07, 0.15); headG.add(bill);
    const star = cyl(0.025, 0.025, 0.01, M('#ffd54f', { metalness: 0.8 }), 5); star.rotation.x = Math.PI / 2; star.position.set(0, 0.13, 0.135); headG.add(star);
    const belt = cyl(0.165, 0.165, 0.04, M('#3e2723'), 20); belt.position.y = 0.04; upper.add(belt);
    const whistle = cyl(0.012, 0.012, 0.05, M('#cfd8dc', { metalness: 0.9 }), 8); whistle.rotation.z = Math.PI / 2; arms[1].el.add(whistle); whistle.position.set(0, 0, 0.3);
  }
  function animate(t, mode, moving) {
    upper.rotation.set(0, 0, 0); headG.rotation.set(0, 0, 0);
    for (const s of [-1, 1]) { arms[s].sh.rotation.set(0, 0, s * 0.12); arms[s].el.rotation.set(0, 0, 0); legs[s].hip.rotation.set(0, 0, 0); legs[s].knee.rotation.set(0, 0, 0); }
    if (moving) walkPose(legs, null, t, 0.6);
    if (mode === 'angry' || mode === 'walk') {
      // vung dép lên trời, lắc đầu
      arms[1].sh.rotation.set(-2.6 + Math.sin(t * 10) * 0.35, 0, 0.2); arms[1].el.rotation.x = -0.5;
      headG.rotation.y = Math.sin(t * 8) * 0.2; upper.rotation.x = 0.1;
    } else if (mode === 'pull') {
      // tay trái nhéo tai chồng, tay phải chống nạnh vung dép
      arms[-1].sh.rotation.set(-1.4, 0, 0.6); arms[-1].el.rotation.set(-0.4, 0, 0);
      arms[1].sh.rotation.set(-2.4 + Math.sin(t * 9) * 0.4, 0, 0.3);
      upper.rotation.z = Math.sin(t * 5) * 0.08;
    } else if (mode === 'throw') {
      arms[1].sh.rotation.set(-0.6, 0, 0.2);
    } else if (mode === 'whistle') {
      arms[1].sh.rotation.set(-2.4, 0, 0.3); arms[1].el.rotation.set(-1.4, 0, 0);
      arms[-1].sh.rotation.set(-1.4, 0, -0.3); // tay chỉ
      headG.rotation.y = Math.sin(t * 2) * 0.5;
    }
  }
  return { group: g, animate };
}

// ======================= NHÃN CHỮ (sprite) =======================
export function makeLabel(w = 512, h = 128, scale = 1) {
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  sprite.scale.set((w / h) * 0.35 * scale, 0.35 * scale, 1);
  sprite.renderOrder = 10;
  return { sprite, ctx: canvas.getContext('2d'), tex, w, h };
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
