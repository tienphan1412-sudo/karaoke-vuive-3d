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
function drawFace(ctx, a) {
  ctx.clearRect(0, 0, FW, FH);
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
  // môi
  const ly = 326;
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
  const holdItems = { fruit: new THREE.Group(), water: new THREE.Group() };
  {
    const plate = cyl(0.11, 0.08, 0.015, M('#fafafa'), 20); holdItems.fruit.add(plate);
    const cols = ['#e53935', '#43a047', '#fdd835', '#fb8c00', '#8e24aa'];
    cols.forEach((c, i) => { const f = sph(0.028, M(c), 10, 8); const a = (i / cols.length) * Math.PI * 2; f.position.set(Math.cos(a) * 0.05, 0.025, Math.sin(a) * 0.05); holdItems.fruit.add(f); });
    const glass = cyl(0.035, 0.028, 0.12, M('#fff59d', { transparent: true, opacity: 0.75, roughness: 0.1 }), 16); glass.position.y = 0.06; holdItems.water.add(glass);
    const lemon = cyl(0.025, 0.025, 0.006, M('#c6ff00'), 14); lemon.rotation.z = Math.PI / 2; lemon.position.set(0.035, 0.11, 0); holdItems.water.add(lemon);
    for (const k in holdItems) { holdItems[k].position.set(0, -0.3, 0.06); holdItems[k].visible = false; arms[1].elbow.add(holdItems[k]); }
  }

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
    const bangs = add(new THREE.Mesh(new THREE.SphereGeometry(0.136, 28, 10, Math.PI / 2 - 0.86, 1.72, 0, 1.2), hm));
    bangs.rotation.y = 0;
    if (style === 'long' || style === 'wave') {
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
  let current = null;
  function update(a) {
    current = { ...a };
    mats.skin.color.set(a.skin);
    mats.hair.color.set(a.hairColor);
    mats.shoe.color.set(a.shoes || '#222');
    const o = OUTFITS.find((x) => x.id === a.outfit) || OUTFITS[0];
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
    drawFace(faceCtx, a);
    faceTex.needsUpdate = true;
    body.scale.setScalar(a.height || 1);
  }

  function setHolding(kind) {
    for (const k in holdItems) holdItems[k].visible = k === kind;
  }

  // ---------------- hoạt ảnh ----------------
  function animate(anim, t, moveAmt, holding) {
    const swingAmp = longSkirt ? 0.22 : 0.5;
    const phase = t * 9;
    for (const s of [-1, 1]) {
      arms[s].sh.rotation.set(0, 0, s * 0.12);
      arms[s].elbow.rotation.set(-0.12, 0, 0);
      legs[s].hip.rotation.set(0, 0, 0);
      legs[s].knee.rotation.set(0, 0, 0);
    }
    body.position.set(0, 0, 0);
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
      const d = t * 7;
      body.rotation.y = Math.sin(d * 0.5) * 0.5;
      body.position.x = Math.sin(d) * 0.04;
      body.position.y = Math.abs(Math.sin(d)) * 0.04;
      for (const s of [-1, 1]) {
        arms[s].sh.rotation.z = s * (2.3 + Math.sin(d + s) * 0.35);
        arms[s].elbow.rotation.x = -0.6 - Math.sin(d * 2) * 0.3;
        legs[s].hip.rotation.x = Math.sin(d + (s > 0 ? Math.PI : 0)) * 0.2;
        legs[s].knee.rotation.x = Math.max(0, Math.sin(d + (s > 0 ? Math.PI : 0))) * 0.4;
      }
      headPivot.rotation.z = Math.sin(d) * 0.15;
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
function drawCustomerFace(ctx, type) {
  const W = 256, H = 200;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#1b1414';
  for (const s of [-1, 1]) {
    ctx.beginPath(); ctx.ellipse(128 + s * 44, 90, 9, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 6; ctx.strokeStyle = '#2b1b14';
    ctx.beginPath(); ctx.moveTo(128 + s * 26, 62); ctx.lineTo(128 + s * 62, 58); ctx.stroke();
  }
  ctx.strokeStyle = '#6d2f2a'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(128, 140, 24, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
  if (type === 'bolero') {
    ctx.fillStyle = '#3a3a3a';
    ctx.beginPath(); ctx.ellipse(110, 128, 22, 7, 0.2, 0, Math.PI * 2); ctx.ellipse(146, 128, 22, 7, -0.2, 0, Math.PI * 2); ctx.fill();
  }
  if (type === 'sep') {
    ctx.fillStyle = 'rgba(229,57,53,0.45)';
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(128 + s * 62, 120, 22, 14, 0, 0, Math.PI * 2); ctx.fill(); }
  }
}

export function createCustomer(type) {
  const info = CUSTOMER_TYPES[type] || CUSTOMER_TYPES.daigia;
  const g = new THREE.Group();
  const skin = M(info.skin), shirt = M(info.shirt), pants = M(info.pants), hairM = M(info.hair, { roughness: 0.5 });
  const pelvis = sph(0.17, pants); pelvis.scale.set(1.1, 0.6, 1); pelvis.position.y = 0.5; g.add(pelvis);
  const torso = cyl(0.15, 0.17, 0.42, shirt); torso.position.y = 0.74; g.add(torso);
  if (type === 'daigia' || type === 'sep') { const belly = sph(0.16, shirt); belly.scale.set(1, 0.9, 0.8); belly.position.set(0, 0.68, 0.06); g.add(belly); }
  const neck = cyl(0.05, 0.055, 0.08, skin); neck.position.y = 0.98; g.add(neck);
  const headG = new THREE.Group(); headG.position.y = 1.1; g.add(headG);
  const head = sph(0.12, skin, 24, 18); headG.add(head);
  const fc = document.createElement('canvas'); fc.width = 256; fc.height = 200;
  drawCustomerFace(fc.getContext('2d'), type);
  const ft = new THREE.CanvasTexture(fc); ft.colorSpace = THREE.SRGBColorSpace;
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.1215, 24, 16, Math.PI / 2 - 0.8, 1.6, 1.05, 1.0), new THREE.MeshStandardMaterial({ map: ft, transparent: true, roughness: 0.7 }));
  headG.add(face);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.127, 24, 12, 0, Math.PI * 2, 0, type === 'bolero' ? 0.7 : 1.15), hairM); headG.add(cap);
  for (const s of [-1, 1]) {
    const thigh = cyl(0.07, 0.065, 0.42, pants); thigh.rotation.x = Math.PI / 2; thigh.position.set(s * 0.09, 0.46, 0.2); g.add(thigh);
    const calf = cyl(0.06, 0.05, 0.44, pants); calf.position.set(s * 0.09, 0.24, 0.4); g.add(calf);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 0.18), M('#1b1b1b')); shoe.position.set(s * 0.09, 0.03, 0.44); g.add(shoe);
    const up = cyl(0.05, 0.045, 0.3, shirt); up.position.set(s * 0.21, 0.77, 0.02); up.rotation.z = s * 0.12; g.add(up);
    const fo = cyl(0.045, 0.04, 0.26, skin); fo.rotation.x = Math.PI / 2; fo.position.set(s * 0.22, 0.6, 0.14); g.add(fo);
    const hand = sph(0.04, skin, 10, 8); hand.position.set(s * 0.22, 0.6, 0.28); g.add(hand);
  }
  const gold = M('#e8c25a', { metalness: 0.9, roughness: 0.25 });
  if (type === 'daigia') {
    const chain = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.012, 8, 24), gold); chain.rotation.x = Math.PI / 2 - 0.3; chain.position.set(0, 0.92, 0.04); g.add(chain);
    for (const s of [-1, 1]) { const gl = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.035, 0.01), M('#111', { metalness: 0.6, roughness: 0.1 })); gl.position.set(s * 0.042, 0.01, 0.12); headG.add(gl); }
  }
  if (type === 'bolero') {
    const brim = cyl(0.19, 0.19, 0.012, M('#5d4037'), 20); brim.position.y = 0.09; headG.add(brim);
    const top = cyl(0.11, 0.12, 0.09, M('#5d4037'), 20); top.position.y = 0.14; headG.add(top);
  }
  if (type === 'sep') {
    const tie = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.28, 4), M('#c62828')); tie.rotation.x = Math.PI; tie.position.set(0, 0.78, 0.165); g.add(tie);
  }
  if (type === 'keo') {
    const c = sph(0.13, M('#1e88e5'), 20, 10); c.scale.y = 0.6; c.position.y = 0.06; headG.add(c);
    const bill = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.012, 0.12), M('#1565c0')); bill.position.set(0, 0.04, -0.17); headG.add(bill);
  }
  if (type === 'oppa') {
    const fringe = new THREE.Mesh(new THREE.SphereGeometry(0.13, 20, 8, Math.PI / 2 - 0.9, 1.8, 0.4, 0.9), hairM); headG.add(fringe);
  }
  if (type === 'genz') {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.012, 8, 20, Math.PI), M('#212121')); band.rotation.z = 0; band.position.y = 0.02; headG.add(band);
    for (const s of [-1, 1]) { const cup = cyl(0.04, 0.04, 0.03, M('#ff4081'), 14); cup.rotation.z = Math.PI / 2; cup.position.set(s * 0.13, 0.0, 0); headG.add(cup); }
  }
  // ly bia trên tay
  const beer = cyl(0.03, 0.03, 0.1, M('#ffb300', { transparent: true, opacity: 0.85, roughness: 0.15 }), 12); beer.position.set(0.22, 0.66, 0.3); g.add(beer);

  function animate(t, mood, offset = 0) {
    const happy = mood > 70;
    headG.rotation.z = Math.sin(t * (happy ? 4 : 1.2) + offset) * (happy ? 0.12 : 0.04);
    headG.position.y = 1.1 + (happy ? Math.abs(Math.sin(t * 4 + offset)) * 0.02 : 0);
    beer.position.y = 0.66 + (happy ? Math.max(0, Math.sin(t * 2 + offset)) * 0.25 : 0);
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
