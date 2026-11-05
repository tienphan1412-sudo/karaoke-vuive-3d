// Nhân vật VRM (VRoid) + trang phục may đo theo cơ thể + makeup vẽ lên da mặt
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { OUTFITS, BASES } from './data.js';

const loader = new GLTFLoader();
loader.register((p) => new VRMLoaderPlugin(p));
const bufCache = new Map();
function getBuf(url) {
  if (!bufCache.has(url)) bufCache.set(url, fetch(url).then((r) => { if (!r.ok) throw new Error('404 ' + url); return r.arrayBuffer(); }));
  return bufCache.get(url);
}
export const preloadModel = (url) => getBuf(url).catch(() => {});

let envTex = null;
export function setRenderer(renderer) {
  const pm = new THREE.PMREMGenerator(renderer);
  envTex = pm.fromScene(new RoomEnvironment(), 0.04).texture;
}

const matsOf = (m) => (Array.isArray(m.material) ? m.material : [m.material]);
const mname = (m) => (matsOf(m)[0] && matsOf(m)[0].name) || '';

// ---------------- xương người ----------------
const FINGERS = ['Thumb', 'Index', 'Middle', 'Ring', 'Little'].flatMap((f) => ['Metacarpal', 'Proximal', 'Intermediate', 'Distal'].map((s) => f + s));
const HUMAN = ['hips', 'spine', 'chest', 'upperChest', 'neck', 'head', 'jaw', 'leftEye', 'rightEye',
  ...['left', 'right'].flatMap((s) => ['Shoulder', 'UpperArm', 'LowerArm', 'Hand', 'UpperLeg', 'LowerLeg', 'Foot', 'Toes', ...FINGERS].map((b) => s + b))];
// nhóm: 0 thân, 1 cánh tay trên, 2 đùi/chân, 3 đầu cổ, 4 bàn chân, 5 cẳng tay + bàn tay
function catOf(n) {
  if (/UpperArm/.test(n)) return 1;
  if (/LowerArm|Hand|Thumb|Index|Middle|Ring|Little/.test(n)) return 5;
  if (/Foot|Toes/.test(n)) return 4;
  if (/UpperLeg|LowerLeg/.test(n)) return 2;
  if (/head|neck|Eye|jaw/.test(n)) return 3;
  return 0;
}

// ---------------- vật liệu vải ----------------
let sparkleTex = null;
function getSparkle() {
  if (sparkleTex) return sparkleTex;
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) {
    const x = Math.random() * 256, y = Math.random() * 256, r = Math.random() < 0.08 ? 1.6 : 0.8;
    g.fillStyle = `rgba(255,255,255,${0.35 + Math.random() * 0.65})`; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  sparkleTex = new THREE.CanvasTexture(c); sparkleTex.wrapS = sparkleTex.wrapT = THREE.RepeatWrapping; sparkleTex.repeat.set(5, 5);
  return sparkleTex;
}
let fishnetTex = null;
function getFishnet() {
  if (fishnetTex) return fishnetTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, 64, 64);
  g.strokeStyle = '#fff'; g.lineWidth = 5;
  g.beginPath(); g.moveTo(0, 0); g.lineTo(64, 64); g.moveTo(64, 0); g.lineTo(0, 64); g.stroke();
  fishnetTex = new THREE.CanvasTexture(c); fishnetTex.wrapS = fishnetTex.wrapT = THREE.RepeatWrapping; fishnetTex.repeat.set(30, 30);
  return fishnetTex;
}
function clothMaterial(color, finish) {
  const c = new THREE.Color(color);
  const base = { color: c, side: THREE.DoubleSide, envMap: envTex, envMapIntensity: 1 };
  if (finish === 'sequin') return new THREE.MeshPhysicalMaterial({ ...base, roughness: 0.28, metalness: 0.7, emissive: c.clone().lerp(new THREE.Color('#fff'), 0.4), emissiveMap: getSparkle(), emissiveIntensity: 0.9, clearcoat: 0.6 });
  if (finish === 'metal') return new THREE.MeshPhysicalMaterial({ ...base, roughness: 0.16, metalness: 0.95, envMapIntensity: 1.6, clearcoat: 1, clearcoatRoughness: 0.1 });
  if (finish === 'velvet') return new THREE.MeshPhysicalMaterial({ ...base, roughness: 0.85, metalness: 0, sheen: 1, sheenColor: c.clone().lerp(new THREE.Color('#fff'), 0.45), sheenRoughness: 0.45, envMapIntensity: 0.4 });
  if (finish === 'latex') return new THREE.MeshPhysicalMaterial({ ...base, roughness: 0.08, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.4 });
  // satin (lụa)
  return new THREE.MeshPhysicalMaterial({ ...base, roughness: 0.32, metalness: 0.12, sheen: 1, sheenColor: c.clone().lerp(new THREE.Color('#fff'), 0.6), sheenRoughness: 0.25, clearcoat: 0.35, clearcoatRoughness: 0.25 });
}

// ---------------- tô màu texture (tóc, lens, chân mày) ----------------
function recolorMap(mat, color, store) {
  const map = mat.map;
  if (!map || !map.image) return;
  if (!store.has(mat)) store.set(mat, { map, color: mat.color ? mat.color.clone() : null, shade: mat.shadeColorFactor ? mat.shadeColorFactor.clone() : null, shadeTex: mat.shadeMultiplyTexture || null });
  const orig = store.get(mat);
  if (!color || color === 'original') {
    mat.map = orig.map;
    if (orig.shadeTex) mat.shadeMultiplyTexture = orig.shadeTex;
    if (orig.shade) mat.shadeColorFactor.copy(orig.shade);
    return;
  }
  const img = orig.map.image;
  const w = img.width, h = img.height;
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d'); g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, w, h); const px = d.data;
  let maxL = 1;
  for (let i = 0; i < px.length; i += 4) { const l = 0.3 * px[i] + 0.59 * px[i + 1] + 0.11 * px[i + 2]; if (l > maxL) maxL = l; }
  const tc = new THREE.Color(color); const tr = tc.r * 255, tg = tc.g * 255, tb = tc.b * 255;
  for (let i = 0; i < px.length; i += 4) {
    const l = (0.3 * px[i] + 0.59 * px[i + 1] + 0.11 * px[i + 2]) / maxL;
    const k = Math.pow(l, 0.85) * 1.12;
    px[i] = Math.min(255, tr * k + 10 * l); px[i + 1] = Math.min(255, tg * k + 10 * l); px[i + 2] = Math.min(255, tb * k + 10 * l);
  }
  g.putImageData(d, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.flipY = orig.map.flipY; t.colorSpace = orig.map.colorSpace; t.wrapS = orig.map.wrapS; t.wrapT = orig.map.wrapT;
  mat.map = t;
  if (orig.shadeTex) mat.shadeMultiplyTexture = t;
  if (mat.shadeColorFactor) mat.shadeColorFactor.copy(tc).multiplyScalar(0.55);
  if (mat.color) mat.color.set('#ffffff');
}

// =====================================================================
export function createGirl(app) {
  const group = new THREE.Group();
  const inner = new THREE.Group();
  group.add(inner);
  const self = { group, ready: null, topY: 1.6, headY: 1.42, failed: false };
  let vrm = null, A = null, L = null, cls = null, face = null;
  let baseUrl = null, current = { ...app };
  const outfitMeshes = [];
  const accessories = [];
  const recolorStore = new Map();
  let hipsBase = null, lastT = 0, blinkAt = 2, longSkirt = false;
  let clothMats = [];
  let holdItems = {}, mic = null;

  // ---------- tải model ----------
  async function load(url) {
    baseUrl = url;
    const buf = await getBuf(url);
    const gltf = await loader.parseAsync(buf, '');
    if (baseUrl !== url) return;
    const v = gltf.userData.vrm;
    VRMUtils.removeUnnecessaryVertices(gltf.scene);
    VRMUtils.rotateVRM0(v);
    if (vrm) { inner.remove(vrm.scene); VRMUtils.deepDispose(vrm.scene); }
    vrm = v;
    inner.add(vrm.scene);
    analyze();
    hipsBase = vrm.humanoid.getNormalizedBoneNode('hips').position.clone();
    buildHandItems();
    applyAll(current, true);
  }

  function analyze() {
    vrm.scene.updateMatrixWorld(true);
    const meshes = [];
    vrm.scene.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; meshes.push(o); } });
    const by = (re) => meshes.filter((m) => re.test(mname(m)));
    A = {
      body: by(/SKIN/).find((m) => !/face/i.test(mname(m))),
      face: by(/SKIN/).find((m) => /face/i.test(mname(m))),
      cloth: by(/CLOTH/), hair: by(/HAIR/),
      iris: by(/EyeIris/)[0], white: by(/EyeWhite/)[0], mouth: by(/FaceMouth/)[0],
      brow: by(/FaceBrow/), eyeline: by(/FaceEyeline/),
    };
    // mốc cơ thể trong hệ toạ độ của mesh thân
    const head = vrm.humanoid.getRawBoneNode('head');
    self.headY = head.getWorldPosition(new THREE.Vector3()).y + 0.05;
    let top = self.headY + 0.12;
    for (const h of A.hair) { const b = new THREE.Box3().setFromObject(h); top = Math.max(top, b.max.y); }
    self.topY = top;
    if (!A.body) return;
    const inv = A.body.matrixWorld.clone().invert();
    const P = (n) => { const b = vrm.humanoid.getRawBoneNode(n); return b ? b.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv) : null; };
    const hips = P('hips'), chest = P('chest'), up = P('upperChest') || chest, neck = P('neck');
    L = {
      hipY: hips.y, spineY: P('spine').y, chestY: chest.y, upY: up.y, neckY: neck.y,
      legY: P('leftUpperLeg').y, kneeY: P('leftLowerLeg').y, ankleY: P('leftFoot').y,
      shoulderX: Math.abs(P('leftUpperArm').x), elbowX: Math.abs(P('leftLowerArm').x),
    };
    // phân loại từng đỉnh theo xương ảnh hưởng nhiều nhất
    const rev = new Map();
    for (const n of HUMAN) { const b = vrm.humanoid.getRawBoneNode(n); if (b) rev.set(b, n); }
    const bones = A.body.skeleton.bones;
    const bh = bones.map((b) => { let n = b; while (n && !rev.has(n)) n = n.parent; return n ? rev.get(n) : 'hips'; });
    L.hipsIndex = Math.max(0, bh.indexOf('hips'));
    const g = A.body.geometry, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, N = g.attributes.position.count;
    cls = new Uint8Array(N);
    for (let i = 0; i < N; i++) {
      let best = 0, bw = -1;
      for (let j = 0; j < 4; j++) { const w = sw.getComponent(i, j); if (w > bw) { bw = w; best = si.getComponent(i, j); } }
      cls[i] = catOf(bh[best]);
    }
    const pos = g.attributes.position;
    let neckR = 0.04;
    for (let i = 0; i < N; i++) if (cls[i] === 3 && Math.abs(pos.getY(i) - (L.neckY + 0.02)) < 0.015) neckR = Math.max(neckR, Math.abs(pos.getX(i)));
    L.neckR = neckR;
    // bảng số đo thân theo chiều cao (bỏ tay, đầu, bàn chân) -> lấp chỗ model bị khuyết
    const STEP = 0.01, rowsN = Math.ceil((L.neckY + 0.05) / STEP);
    const ext = [];
    for (let r = 0; r <= rowsN; r++) ext.push({ minX: 1e9, maxX: -1e9, minZ: 1e9, maxZ: -1e9, f: 0, b: 0 });
    for (let i = 0; i < N; i++) {
      const c = cls[i]; if (c === 1 || c === 5 || c === 3 || c === 4) continue;
      const y = pos.getY(i), r = Math.round(y / STEP); if (r < 0 || r > rowsN) continue;
      const e = ext[r], x = pos.getX(i), z = pos.getZ(i);
      if (x < e.minX) e.minX = x; if (x > e.maxX) e.maxX = x; if (z < e.minZ) e.minZ = z; if (z > e.maxZ) e.maxZ = z;
      if (z > 0.015) e.f++; if (z < -0.02) e.b++;
    }
    const valid = ext.map((e) => e.f > 3 && e.b > 3);
    const partial = ext.map((e) => ({ ...e }));
    // lỗ khuyết ở ngực và ở hông
    const holeIn = (lo, hi) => { let a = null, b = null; for (let r = Math.round(lo / STEP); r <= Math.round(hi / STEP); r++) if (!valid[r]) { if (a === null) a = r; b = r; } return a === null ? null : [a * STEP, b * STEP]; };
    L.chestHole = holeIn(L.spineY, L.neckY);
    L.hipHole = holeIn(L.legY - 0.05, L.spineY + 0.04);
    for (let r = 0; r <= rowsN; r++) {
      if (valid[r]) continue;
      let lo = r - 1; while (lo >= 0 && !valid[lo]) lo--;
      let hi = r + 1; while (hi <= rowsN && !valid[hi]) hi++;
      const A1 = ext[lo] || ext[hi], B1 = ext[hi] || ext[lo];
      if (!A1 || !B1) continue;
      const t = hi > lo && ext[lo] && ext[hi] ? (r - lo) / (hi - lo) : 0;
      for (const k of ['minX', 'maxX', 'minZ', 'maxZ']) ext[r][k] = A1[k] + (B1[k] - A1[k]) * t;
      const pr = partial[r];
      if (pr.maxX > pr.minX) { ext[r].minX = Math.min(ext[r].minX, pr.minX); ext[r].maxX = Math.max(ext[r].maxX, pr.maxX); ext[r].minZ = Math.min(ext[r].minZ, pr.minZ); ext[r].maxZ = Math.max(ext[r].maxZ, pr.maxZ); }
    }
    L.ext = (y) => {
      const f = Math.max(0, Math.min(rowsN - 1, y / STEP)), r0 = Math.floor(f), t = f - r0, e0 = ext[r0], e1 = ext[r0 + 1];
      const m = (k) => e0[k] + (e1[k] - e0[k]) * t;
      return { cx: (m('minX') + m('maxX')) / 2, cz: (m('minZ') + m('maxZ')) / 2, rx: (m('maxX') - m('minX')) / 2, rz: (m('maxZ') - m('minZ')) / 2 };
    };
    // ngực (xương J_Sec_*Bust*)
    const bustBones = bones.filter((b) => /bust/i.test(b.name));
    if (bustBones.length) {
      const tip = bustBones.map((b) => b.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv)).sort((a, b) => b.z - a.z)[0];
      L.bust = { x: Math.abs(tip.x) || 0.05, y: tip.y, z: tip.z };
    } else L.bust = { x: 0.05, y: (L.chestY + L.upY) / 2, z: L.ext((L.chestY + L.upY) / 2).cz + L.ext((L.chestY + L.upY) / 2).rz + 0.02 };
    // dáng ngực tự dựng: hẹp dần lên cổ thay vì phình ra vai
    {
      const rawExt = L.ext;
      const y0 = L.chestHole ? L.chestHole[0] - 0.01 : L.chestY - 0.06;
      const y2 = (L.chestHole ? L.chestHole[1] : L.upY) + 0.02;
      const y1 = Math.min(Math.max(L.bust.y, y0 + 0.02), y2 - 0.03);
      const eB = rawExt(y0), eN = rawExt(L.neckY + 0.01);
      const rxBust = Math.max(eB.rx * 1.03, L.bust.x + 0.055);
      const rxTop = L.neckR + 0.055, rzTop = L.neckR + 0.028;
      const sm = (t) => t * t * (3 - 2 * t);
      L.ext = (y) => {
        if (y < y0 || y > y2) return rawExt(y);
        if (y <= y1) { const t = sm((y - y0) / (y1 - y0)); return { cx: eB.cx, cz: eB.cz, rx: eB.rx + (rxBust - eB.rx) * t, rz: eB.rz * (1 + 0.06 * t) }; }
        const t = sm((y - y1) / (y2 - y1));
        return { cx: eB.cx, cz: eB.cz + (eN.cz - eB.cz) * t, rx: rxBust + (rxTop - rxBust) * Math.pow(t, 1.3), rz: eB.rz * 1.06 + (rzTop - eB.rz * 1.06) * t };
      };
    }
    // vòng hông rộng nhất (cho váy dài)
    {
      let best = null;
      for (let y = L.legY - 0.08; y <= L.hipY + 0.05; y += 0.01) { const e = L.ext(y); if (!best || e.rx > best.rx) best = { ...e, y }; }
      L.hipE = best;
    }
    L.bustTop = L.bust.y + 0.045;
    L.underBust = L.bust.y - 0.06;
    L.collar = L.chestHole ? L.chestHole[1] + 0.012 : L.neckY - 0.05;
    // trọng số xương cho phần thân tự dựng
    const idxOf = (n) => { const b = vrm.humanoid.getRawBoneNode(n); return Math.max(0, bones.indexOf(b)); };
    L.spineBones = ['hips', 'spine', 'chest', 'upperChest', 'neck'].filter((n) => vrm.humanoid.getRawBoneNode(n)).map((n) => ({ i: idxOf(n), y: P(n).y }));
    // chất liệu da cho phần lấp
    const bm = matsOf(A.body)[0];
    try { A.skinFill = bm.clone(); } catch (e) { A.skinFill = new THREE.MeshStandardMaterial({ color: '#f6dcd0' }); }
    let best = 0, bd = 1e9;
    for (let i = 0; i < N; i++) { if (cls[i] === 1 || cls[i] === 5) continue; const d = Math.abs(pos.getY(i) - (L.collar + 0.025)) * 2 + Math.abs(Math.abs(pos.getX(i)) - 0.04) - pos.getZ(i) * 0.5; if (d < bd) { bd = d; best = i; } }
    A.skinUV = g.attributes.uv ? [g.attributes.uv.getX(best), g.attributes.uv.getY(best)] : [0.5, 0.5];
    setupFace();
  }

  // ---------- trang phục ----------
  function clearOutfit() {
    for (const m of outfitMeshes) { m.parent && m.parent.remove(m); m.geometry.dispose(); }
    outfitMeshes.length = 0;
    clothMats.forEach((m) => m.dispose()); clothMats = [];
  }
  function addSkinned(geo, mat) {
    const m = new THREE.SkinnedMesh(geo, mat);
    m.bind(A.body.skeleton, A.body.bindMatrix);
    m.position.copy(A.body.position); m.quaternion.copy(A.body.quaternion); m.scale.copy(A.body.scale);
    m.frustumCulled = false;
    A.body.parent.add(m);
    outfitMeshes.push(m);
    return m;
  }
  // vỏ bọc sát cơ thể từ tam giác của da
  function shell(pred, mat, off = 0.006) {
    const src = A.body.geometry, pos = src.attributes.position, nor = src.attributes.normal, idx = src.index;
    const N = pos.count, p2 = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      p2[i * 3] = pos.getX(i) + nor.getX(i) * off; p2[i * 3 + 1] = pos.getY(i) + nor.getY(i) * off; p2[i * 3 + 2] = pos.getZ(i) + nor.getZ(i) * off;
    }
    const ok = new Uint8Array(N);
    for (let i = 0; i < N; i++) ok[i] = pred(pos.getX(i), pos.getY(i), pos.getZ(i), cls[i]) ? 1 : 0;
    const keep = [];
    for (let t = 0; t < idx.count; t += 3) {
      const a = idx.getX(t), b = idx.getX(t + 1), c = idx.getX(t + 2);
      if (ok[a] && ok[b] && ok[c]) keep.push(a, b, c);
    }
    if (!keep.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p2, 3));
    g.setAttribute('normal', nor);
    if (src.attributes.uv) g.setAttribute('uv', src.attributes.uv);
    g.setAttribute('skinIndex', src.attributes.skinIndex);
    g.setAttribute('skinWeight', src.attributes.skinWeight);
    g.setIndex(keep);
    return addSkinned(g, mat);
  }
  // ống vải/da dựng theo số đo: mỗi cột góc th có đáy bottom(th) và đỉnh top(th)
  function tube(spec, mat) {
    const rows = spec.rows || 30, segs = 64;
    const verts = [], sIdx = [], sW = [], index = [], uvs = [];
    const SB = L.spineBones;
    const weightsAt = (y) => {
      if (spec.rigid || y <= SB[0].y) return [[SB[0].i, 1]];
      for (let k = 0; k < SB.length - 1; k++) if (y <= SB[k + 1].y) { const t = (y - SB[k].y) / (SB[k + 1].y - SB[k].y); return [[SB[k].i, 1 - t], [SB[k + 1].i, t]]; }
      return [[SB[SB.length - 1].i, 1]];
    };
    let prevE = null;
    for (let r = 0; r <= rows; r++) {
      const v = r / rows;
      for (let s2 = 0; s2 <= segs; s2++) {
        const th = (s2 / segs) * Math.PI * 2 - Math.PI; // 0 = trước mặt
        const yb = typeof spec.bottom === 'function' ? spec.bottom(th) : spec.bottom;
        const yt = typeof spec.top === 'function' ? spec.top(th) : spec.top;
        const y = yt + (yb - yt) * v; // v=0 đỉnh, v=1 đáy
        let e = L.ext(Math.max(0.02, y));
        if (spec.skirt && y < L.hipE.y) {
          const k = spec.skirt === 'taper' ? 1 - 0.12 * Math.max(0, Math.min(1, (L.hipE.y - 0.1 - y) / (L.hipE.y - 0.1 - L.kneeY))) : 1;
          e = { cx: L.hipE.cx, cz: L.hipE.cz, rx: L.hipE.rx * k, rz: L.hipE.rz * k };
        }
        let rx = e.rx + (spec.margin ?? 0.008), rz = e.rz + (spec.margin ?? 0.008);
        const fl = spec.flare ? spec.flare(v) : 0;
        rx += fl; rz += fl * 0.85;
        const sn = Math.sin(th), cs = Math.cos(th), pe = 2 / (spec.square ?? 2.6);
        let x = e.cx + Math.sign(sn) * Math.pow(Math.abs(sn), pe) * rx, z = e.cz + Math.sign(cs) * Math.pow(Math.abs(cs), pe) * rz;
        if (spec.pleat) { const w = 1 + 0.035 * Math.sin(th * 26) * v; x = e.cx + (x - e.cx) * w; z = e.cz + (z - e.cz) * w; }
        // nhô ngực phía trước
        if (spec.bust && Math.cos(th) > 0) {
          for (const sx of [-1, 1]) {
            const g2 = Math.exp(-Math.pow((x - sx * L.bust.x) / 0.06, 2) - Math.pow((y - L.bust.y) / 0.065, 2));
            const target = L.bust.z + (spec.margin ?? 0.008) + 0.004;
            if (target > z) z += (target - z) * g2 * Math.cos(th);
          }
        }
        verts.push(x, y, z);
        const w = weightsAt(y);
        sIdx.push(w[0][0], w[1] ? w[1][0] : 0, 0, 0); sW.push(w[0][1], w[1] ? w[1][1] : 0, 0, 0);
        uvs.push(spec.uv ? spec.uv[0] : s2 / segs * 5, spec.uv ? spec.uv[1] : y * 8);
      }
    }
    // giữ váy không bó vào giữa hai chân
    if (spec.keepWide) {
      for (let s2 = 0; s2 <= segs; s2++) {
        let pr = null;
        for (let r = 0; r <= rows; r++) {
          const i = (r * (segs + 1) + s2) * 3;
          const e = L.ext(verts[i + 1]);
          const dx = verts[i] - e.cx, dz = verts[i + 2] - e.cz, d = Math.hypot(dx, dz);
          if (pr !== null && d < pr * 0.99) { const k = (pr * 0.99) / d; verts[i] = e.cx + dx * k; verts[i + 2] = e.cz + dz * k; }
          pr = Math.max(pr || 0, Math.hypot(verts[i] - e.cx, verts[i + 2] - e.cz));
        }
      }
    }
    for (let r = 0; r < rows; r++) for (let s2 = 0; s2 < segs; s2++) {
      if (spec.keep) { const th = ((s2 + 0.5) / segs) * Math.PI * 2 - Math.PI; if (!spec.keep(th, (r + 0.5) / rows)) continue; }
      const a = r * (segs + 1) + s2, b = a + 1, c = a + segs + 1, d2 = c + 1;
      index.push(a, b, c, b, d2, c);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(sIdx, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sW, 4));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(index); g.computeVertexNormals();
    return addSkinned(g, mat);
  }

  function buildOutfit(a) {
    clearOutfit();
    if (!A || !A.body) return;
    const o = OUTFITS.find((x) => x.id === a.outfit) || OUTFITS[0];
    const showOrig = o.id === 'casual';
    for (const m of A.cloth) m.visible = showOrig || (/Shoes/.test(mname(m)) && a.shoes === 'original');
    longSkirt = false;
    if (showOrig) return;
    const mat = clothMaterial(a.outfitColor, a.finish || o.finish);
    clothMats.push(mat);
    const Lm = L;
    const T = 0, UA = 1, LEG = 2, FOOT = 4, LA = 5;
    const thighMid = Lm.legY - (Lm.legY - Lm.kneeY) * 0.45;
    const hipTop = (Lm.hipHole ? Lm.hipHole[1] : Lm.hipY) + 0.02;
    const chestBot = (Lm.chestHole ? Lm.chestHole[0] : Lm.underBust) - 0.02;
    const skinM = A.skinFill;
    const skinUV = A.skinUV;
    // cổ áo cúp ngực kiểu trái tim
    const sweetheart = (th) => Lm.bustTop + 0.012 - 0.03 * Math.exp(-Math.pow(th / 0.13, 2)) - 0.012 * (1 - Math.cos(th)) * 0.5;
    const flatTop = (y) => () => y;
    const skinAbove = (topFn) => tube({ top: Lm.collar, bottom: (th) => topFn(th) + 0.004, margin: 0.002, bust: true, uv: skinUV, rows: 10 }, skinM);
    const bodice = (topFn, bottomY, m = mat) => tube({ top: topFn, bottom: bottomY, bust: true, margin: 0.012 }, m);
    const upperBand = (x, lo, hi) => { const d = Math.abs(x) - Lm.shoulderX; return d > lo && d < hi; };
    switch (o.id) {
      case 'xetaa': // dạ hội cúp ngực xẻ tà
        bodice(sweetheart, Lm.spineY - 0.02); skinAbove(sweetheart);
        tube({ top: Lm.spineY - 0.015, bottom: 0.015, rigid: true, skirt: 'hip', margin: 0.016, flare: (v) => 0.01 + 0.2 * v * v, keep: (th, v) => !(v > 0.45 && Math.abs(th - 0.45) < 0.17) }, mat);
        longSkirt = true; break;
      case 'xoe': // xòe trễ vai
        bodice(flatTop(Lm.bustTop + 0.02), Lm.spineY - 0.02); skinAbove(flatTop(Lm.bustTop + 0.02));
        shell((x, y, z, c) => c === UA && upperBand(x, 0.035, 0.115), mat);
        tube({ top: Lm.spineY + 0.01, bottom: 0.015, rigid: true, skirt: 'hip', margin: 0.016, flare: (v) => 0.04 + 0.44 * Math.pow(v, 0.85) }, mat);
        longSkirt = true; break;
      case 'mermaid': // đuôi cá cúp ngực
        bodice(flatTop(Lm.bustTop), Lm.spineY - 0.02); skinAbove(flatTop(Lm.bustTop));
        tube({ top: Lm.spineY - 0.015, bottom: 0.015, rigid: true, skirt: 'taper', margin: 0.016, flare: (v) => (v > 0.68 ? Math.pow((v - 0.68) / 0.32, 1.5) * 0.24 : 0) }, mat);
        longSkirt = true; break;
      case 'body': // body ngắn cúp ngực
        bodice(sweetheart, Lm.spineY - 0.02); skinAbove(sweetheart);
        tube({ top: Lm.spineY - 0.015, bottom: thighMid, rigid: true, skirt: 'hip', margin: 0.014 }, mat);
        break;
      case 'crop': // áo ống crop + váy xếp ly ngắn
        bodice(flatTop(Lm.bustTop), chestBot); skinAbove(flatTop(Lm.bustTop));
        tube({ top: hipTop, bottom: thighMid + 0.04, rigid: true, skirt: 'hip', margin: 0.016, flare: (v) => 0.07 * v, pleat: true }, mat);
        break;
      case 'babydoll': { // cổ vuông tay phồng
        const sq = (th) => (Math.cos(th) > 0.55 ? Lm.collar - 0.035 : Lm.collar - 0.004);
        bodice(sq, Lm.underBust); skinAbove(sq);
        shell((x, y, z, c) => c === UA && upperBand(x, -0.06, 0.1), mat, 0.012);
        tube({ top: Lm.underBust + 0.01, bottom: Lm.kneeY + 0.08, skirt: 'hip', margin: 0.016, flare: (v) => 0.03 + 0.15 * v }, mat);
        break;
      }
      case 'blazer': { // blazer cổ V + chân váy bút chì
        const vneck = (th) => { const a2 = Math.abs(th); return a2 < 0.5 ? Lm.underBust - 0.01 + (Lm.collar - 0.004 - (Lm.underBust - 0.01)) * (a2 / 0.5) : Lm.collar - 0.004; };
        tube({ top: vneck, bottom: Lm.spineY - 0.06, bust: true, margin: 0.012 }, mat); skinAbove(vneck);
        shell((x, y, z, c) => c === UA || (c === LA && Math.abs(x) < Lm.elbowX + 0.17), mat, 0.01);
        const sk = clothMaterial(a.skirtColor || '#1a1a1a', 'satin'); clothMats.push(sk);
        tube({ top: Lm.spineY - 0.03, bottom: Lm.kneeY + 0.02, rigid: true, skirt: 'taper', margin: 0.014 }, sk);
        break;
      }
    }
    // tất
    if (a.stockings && a.stockings !== 'none') {
      const top = a.stockings === 'thigh' ? Lm.kneeY + (Lm.legY - Lm.kneeY) * 0.45 : Lm.legY + 0.05;
      let sm;
      if (a.stockings === 'fishnet') sm = new THREE.MeshStandardMaterial({ color: '#111', alphaMap: getFishnet(), transparent: true, side: THREE.DoubleSide, roughness: 0.6 });
      else if (a.stockings === 'thigh') sm = new THREE.MeshStandardMaterial({ color: '#fafafa', roughness: 0.7 });
      else sm = new THREE.MeshPhysicalMaterial({ color: '#141414', roughness: 0.4, transparent: true, opacity: 0.55, sheen: 1, sheenColor: new THREE.Color('#888') });
      clothMats.push(sm);
      shell((x, y, z, c) => (c === LEG || c === FOOT) && y < top, sm, 0.0025);
    }
    // giày bóng
    if (a.shoes !== 'original') {
      const shm = new THREE.MeshPhysicalMaterial({ color: a.shoes || '#111', roughness: 0.12, metalness: 0.3, clearcoat: 1, envMap: envTex });
      clothMats.push(shm);
      shell((x, y, z, c) => c === FOOT && y < Lm.ankleY + 0.035, shm, 0.007);
    }
  }

  // ---------- phụ kiện ----------
  function clearAcc() { accessories.forEach((m) => m.parent && m.parent.remove(m)); accessories.length = 0; }
  function attach(boneName, obj, worldPos) {
    const b = vrm.humanoid.getRawBoneNode(boneName);
    if (!b) return;
    b.add(obj);
    if (worldPos) { obj.position.copy(b.worldToLocal(worldPos.clone())); }
    accessories.push(obj);
  }
  function buildAccessories(a) {
    if (!vrm || !face) return;
    clearAcc();
    const gold = new THREE.MeshStandardMaterial({ color: '#f1cf6a', metalness: 1, roughness: 0.2, envMap: envTex });
    const pearl = new THREE.MeshPhysicalMaterial({ color: '#fffaf0', roughness: 0.15, clearcoat: 1, envMap: envTex });
    const gem = new THREE.MeshPhysicalMaterial({ color: '#e1f5fe', metalness: 0.2, roughness: 0, transmission: 0.3, emissive: '#bfe9ff', emissiveIntensity: 0.35, envMap: envTex, envMapIntensity: 2 });
    const W = face.world; // mốc mặt (toạ độ thế giới lúc tư thế nghỉ)
    vrm.scene.updateMatrixWorld(true);
    for (const s of [-1, 1]) {
      const p = new THREE.Vector3(W.cx + s * W.halfW * 0.97, W.earY, W.earZ);
      let o = null;
      if (a.earrings === 'pearl') { o = new THREE.Mesh(new THREE.SphereGeometry(0.006, 12, 8), pearl); }
      if (a.earrings === 'hoop') { o = new THREE.Mesh(new THREE.TorusGeometry(0.013, 0.0018, 8, 24), gold); o.rotation.y = Math.PI / 2; p.y -= 0.013; }
      if (a.earrings === 'drop') {
        o = new THREE.Group();
        const ch = new THREE.Mesh(new THREE.CylinderGeometry(0.0007, 0.0007, 0.035, 4), gold); ch.position.y = -0.018; o.add(ch);
        const d = new THREE.Mesh(new THREE.OctahedronGeometry(0.007), gem); d.scale.y = 1.5; d.position.y = -0.04; o.add(d);
      }
      if (o) attach('head', o, p);
    }
    if (a.necklace && a.necklace !== 'none') {
      const neck = vrm.humanoid.getRawBoneNode('neck');
      const np = neck.getWorldPosition(new THREE.Vector3());
      const r = (L ? L.neckR : 0.045) + 0.006;
      const n = new THREE.Group();
      if (a.necklace === 'choker') {
        n.add(new THREE.Mesh(new THREE.TorusGeometry(r, 0.004, 8, 32), new THREE.MeshStandardMaterial({ color: '#111', roughness: 0.4 })));
        const d = new THREE.Mesh(new THREE.OctahedronGeometry(0.006), gem); d.position.set(0, -0.004, r); n.add(d);
        n.rotation.x = Math.PI / 2;
        attach('neck', n, np.clone().add(new THREE.Vector3(0, 0.02, 0.004)));
      } else {
        const big = a.necklace === 'diamond';
        for (let i = 0; i < 28; i++) {
          const an = (i / 28) * Math.PI * 2;
          const b = new THREE.Mesh(new THREE.SphereGeometry(big ? 0.004 : 0.0045, 8, 6), big ? gem : pearl);
          b.position.set(Math.cos(an) * (r + 0.008), Math.sin(an) * (r + 0.02) * 0.9 - 0.004, 0);
          n.add(b);
        }
        if (big) { const p = new THREE.Mesh(new THREE.OctahedronGeometry(0.011), gem); p.scale.y = 1.4; p.position.set(0, -(r + 0.03), 0.004); n.add(p); }
        n.rotation.x = -Math.PI / 2 + 0.55;
        attach('neck', n, np.clone().add(new THREE.Vector3(0, -0.025, 0.03)));
      }
    }
    if (a.clip && a.clip !== 'none') {
      const topP = new THREE.Vector3(W.cx, self.topY - 0.015, W.cz - 0.02);
      if (a.clip === 'crown') {
        const cr = new THREE.Group();
        const band = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.003, 6, 32), gold); band.rotation.x = Math.PI / 2; cr.add(band);
        for (let i = 0; i < 9; i++) {
          const an = (i / 9) * Math.PI * 2;
          const sp = new THREE.Mesh(new THREE.ConeGeometry(0.005, i % 2 ? 0.02 : 0.032, 5), gold); sp.position.set(Math.cos(an) * 0.045, 0.012, Math.sin(an) * 0.045); cr.add(sp);
          const g2 = new THREE.Mesh(new THREE.SphereGeometry(0.0035, 6, 4), gem); g2.position.set(Math.cos(an) * 0.047, 0.004, Math.sin(an) * 0.047); cr.add(g2);
        }
        cr.rotation.x = -0.25;
        attach('head', cr, topP.clone().add(new THREE.Vector3(0, -0.005, 0.01)));
      } else if (a.clip === 'fox' || a.clip === 'cat') {
        const fur = new THREE.MeshStandardMaterial({ color: a.hairColor && a.hairColor !== 'original' ? a.hairColor : '#f5ece6', roughness: 0.9 });
        const pink = new THREE.MeshStandardMaterial({ color: '#f7a8c4', roughness: 0.8 });
        for (const s of [-1, 1]) {
          const ear = new THREE.Group();
          const h = a.clip === 'fox' ? 0.075 : 0.05;
          const outer = new THREE.Mesh(new THREE.ConeGeometry(0.03, h, 4), fur); outer.scale.z = 0.45; ear.add(outer);
          const inn = new THREE.Mesh(new THREE.ConeGeometry(0.019, h * 0.75, 4), pink); inn.scale.z = 0.3; inn.position.set(0, -0.004, 0.006); ear.add(inn);
          ear.rotation.z = -s * 0.35; ear.rotation.y = s * 0.2;
          attach('head', ear, new THREE.Vector3(W.cx + s * W.halfW * 0.62, self.topY - 0.03 + h * 0.35, W.cz - 0.03));
        }
      } else if (a.clip === 'bow') {
        const red = new THREE.MeshPhysicalMaterial({ color: '#d81b60', roughness: 0.35, sheen: 1, sheenColor: new THREE.Color('#ff9ac8') });
        const bow = new THREE.Group();
        for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.04, 4), red); w.rotation.z = s * Math.PI / 2; w.position.x = s * 0.02; w.scale.z = 0.5; bow.add(w); }
        bow.add(new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 6), red));
        bow.rotation.set(-0.2, 0.5, -0.3);
        attach('head', bow, new THREE.Vector3(W.cx + W.halfW * 0.75, self.topY - 0.06, W.cz - 0.01));
      }
    }
  }

  function buildHandItems() {
    const hand = vrm.humanoid.getRawBoneNode('rightHand');
    if (!hand) return;
    const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.4, ...o });
    mic = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.009, 0.14, 12), M('#111', { metalness: 0.4 }));
    const headM = new THREE.Mesh(new THREE.SphereGeometry(0.022, 14, 10), M('#c0c0c0', { metalness: 0.9, roughness: 0.3 }));
    headM.position.y = 0.08; mic.add(body); mic.add(headM);
    mic.position.set(-0.06, -0.01, 0.02); mic.rotation.set(0, 0, -1.2); mic.visible = false; hand.add(mic);
    const fruit = new THREE.Group();
    fruit.add(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.075, 0.012, 24), M('#fafafa')));
    ['#e53935', '#43a047', '#fdd835', '#fb8c00', '#8e24aa'].forEach((c, i) => { const f = new THREE.Mesh(new THREE.SphereGeometry(0.024, 10, 8), M(c)); const an = (i / 5) * Math.PI * 2; f.position.set(Math.cos(an) * 0.045, 0.02, Math.sin(an) * 0.045); fruit.add(f); });
    const water = new THREE.Group();
    const gl = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.026, 0.11, 16), new THREE.MeshPhysicalMaterial({ color: '#fff59d', transparent: true, opacity: 0.75, roughness: 0.05 }));
    gl.position.y = 0.055; water.add(gl);
    holdItems = { fruit, water };
    for (const k in holdItems) { holdItems[k].position.set(-0.08, 0.03, 0); holdItems[k].visible = false; hand.add(holdItems[k]); }
  }

  // ---------- makeup ----------
  function setupFace() {
    face = null;
    if (!A.face || !A.white) return;
    const fm = matsOf(A.face)[0];
    if (!fm.map || !fm.map.image) return;
    const img = fm.map.image;
    const W = img.width, H = img.height;
    const base = document.createElement('canvas'); base.width = W; base.height = H; base.getContext('2d').drawImage(img, 0, 0);
    const out = document.createElement('canvas'); out.width = W; out.height = H;
    const over = document.createElement('canvas'); over.width = W; over.height = H;
    const tex = new THREE.CanvasTexture(out);
    tex.flipY = fm.map.flipY; tex.colorSpace = fm.map.colorSpace; tex.wrapS = fm.map.wrapS; tex.wrapT = fm.map.wrapT;
    for (const m of matsOf(A.face)) if ('map' in m && m.map) m.map = tex;
    const box = (mesh, side) => {
      const p = mesh.geometry.attributes.position, b = new THREE.Box3();
      for (let i = 0; i < p.count; i++) { const x = p.getX(i); if (side && Math.sign(x) !== side) continue; b.expandByPoint(new THREE.Vector3(x, p.getY(i), p.getZ(i))); }
      return b;
    };
    const eyeL = box(A.white, 1), eyeR = box(A.white, -1);
    const mouthB = A.mouth ? box(A.mouth) : null;
    const faceB = box(A.face);
    const eyeY = (eyeL.min.y + eyeL.max.y) / 2;
    const eyeH = eyeL.max.y - eyeL.min.y, eyeW = eyeL.max.x - eyeL.min.x;
    const eyeCX = (eyeL.min.x + eyeL.max.x) / 2;
    const mouthY = mouthB ? mouthB.max.y - (mouthB.max.y - mouthB.min.y) * 0.25 : eyeY - eyeW * 1.6;
    const mouthW = mouthB ? (mouthB.max.x - mouthB.min.x) : eyeW * 0.9;
    // vị trí thế giới (để gắn bông tai, vương miện)
    A.face.updateMatrixWorld(true);
    const toW = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(A.face.matrixWorld);
    const c = toW((faceB.min.x + faceB.max.x) / 2, eyeY, (faceB.min.z + faceB.max.z) / 2);
    const right = toW(faceB.max.x, eyeY, 0);
    const ear = toW(0, (eyeY + mouthY) / 2 - eyeH * 0.2, faceB.min.z + (faceB.max.z - faceB.min.z) * 0.32);
    face = {
      W, H, base, out, over, tex,
      eye: { y: eyeY, h: eyeH, w: eyeW, cx: eyeCX, top: eyeL.max.y },
      mouth: { y: mouthY, w: mouthW },
      world: { cx: c.x, cz: c.z, halfW: Math.abs(right.x - c.x), earY: ear.y, earZ: ear.z },
    };
  }

  function paintFace(a) {
    if (!face) return;
    const { W, H, base, out, over } = face;
    const g = A.face.geometry, pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv, idx = g.index;
    const N = pos.count;
    const og = over.getContext('2d');
    const o = out.getContext('2d');
    o.globalCompositeOperation = 'source-over'; o.filter = 'none'; o.globalAlpha = 1;
    o.drawImage(base, 0, 0);
    const blurPx = Math.max(2, W / 220);
    const layer = (weightFn, color, amount, blur = blurPx, mode = 'source-over') => {
      if (!color || color === 'none' || amount <= 0) return;
      const w = new Float32Array(N);
      for (let i = 0; i < N; i++) { if (nor.getZ(i) < 0.15) continue; w[i] = weightFn(pos.getX(i), pos.getY(i)); }
      og.clearRect(0, 0, W, H);
      og.fillStyle = color;
      for (let t = 0; t < idx.count; t += 3) {
        const a1 = idx.getX(t), b1 = idx.getX(t + 1), c1 = idx.getX(t + 2);
        const ww = (w[a1] + w[b1] + w[c1]) / 3;
        if (ww <= 0.01) continue;
        og.globalAlpha = Math.min(1, ww);
        og.beginPath();
        og.moveTo(uv.getX(a1) * W, uv.getY(a1) * H); og.lineTo(uv.getX(b1) * W, uv.getY(b1) * H); og.lineTo(uv.getX(c1) * W, uv.getY(c1) * H);
        og.closePath(); og.fill();
      }
      og.globalAlpha = 1;
      o.globalAlpha = amount; o.globalCompositeOperation = mode; o.filter = `blur(${blur}px)`;
      o.drawImage(over, 0, 0);
      o.globalAlpha = 1; o.globalCompositeOperation = 'source-over'; o.filter = 'none';
    };
    const E = face.eye, Mo = face.mouth;
    const ell = (x, y, cx, cy, rx, ry) => { const d = Math.hypot((x - cx) / rx, (y - cy) / ry); return d < 1 ? Math.min(1, (1 - d) * 2.2) : 0; };
    // phấn mắt: vùng mí trên
    layer((x, y) => Math.max(ell(x, y, E.cx, E.y + E.h * 0.35, E.w * 0.78, E.h * 0.95), ell(x, y, -E.cx, E.y + E.h * 0.35, E.w * 0.78, E.h * 0.95)) * (y > E.y - E.h * 0.15 ? 1 : 0),
      a.shadow, (a.shadowAmt ?? 0.6) * 0.9, blurPx * 1.6, 'multiply');
    if (a.shadow && a.shadow !== 'none') layer((x, y) => Math.max(ell(x, y, E.cx, E.y + E.h * 0.35, E.w * 0.7, E.h * 0.85), ell(x, y, -E.cx, E.y + E.h * 0.35, E.w * 0.7, E.h * 0.85)) * (y > E.y - E.h * 0.1 ? 0.6 : 0), a.shadow, (a.shadowAmt ?? 0.6) * 0.5, blurPx * 2);
    // kẻ mắt đuôi mèo / khói
    if (a.liner === 'cat') {
      const wing = (x, y) => {
        const s = Math.sign(x) || 1, ox = s * (Math.abs(E.cx) + E.w * 0.5), oy = E.y + E.h * 0.15;
        const ex = ox + s * E.w * 0.3, ey = oy + E.h * 0.38;
        const vx = ex - ox, vy = ey - oy, len2 = vx * vx + vy * vy;
        let tt = ((x - ox) * vx + (y - oy) * vy) / len2; if (tt < -0.15 || tt > 1) return 0;
        tt = Math.max(0, tt);
        const dx = x - (ox + vx * tt), dy = y - (oy + vy * tt);
        const thick = E.h * 0.13 * (1 - tt * 0.8);
        return Math.hypot(dx, dy) < thick ? 1 : 0;
      };
      layer(wing, a.linerColor || '#1a1012', 1, blurPx * 0.5);
    }
    if (a.liner === 'smoky') layer((x, y) => Math.max(ell(x, y, E.cx, E.y, E.w * 0.75, E.h * 0.8), ell(x, y, -E.cx, E.y, E.w * 0.75, E.h * 0.8)), a.linerColor || '#2a1a1e', 0.55, blurPx * 2.4, 'multiply');
    // má hồng
    const cy = E.y - (E.y - Mo.y) * 0.5, cr = Math.abs(E.cx) * 0.55;
    layer((x, y) => Math.max(ell(x, y, E.cx * 1.08, cy, cr, cr * 0.7), ell(x, y, -E.cx * 1.08, cy, cr, cr * 0.7)) * 0.8, a.blush, (a.blushAmt ?? 0.6) * 0.75, blurPx * 3);
    // son môi
    const lipW = Mo.w * 0.36, lipH = lipW * 0.5;
    const ly = Mo.y - lipH * 0.85;
    layer((x, y) => {
      const up = y > ly, ry = up ? lipH * 0.7 : lipH;
      const xr = Math.abs(x) / lipW; if (xr > 1) return 0;
      const shape = up ? (1 - 0.25 * Math.exp(-Math.pow(x / (lipW * 0.18), 2))) : 1; // lõm giữa môi trên
      const d = Math.hypot(xr, (y - ly) / (ry * shape * (1 - 0.35 * xr * xr)));
      return d < 1 ? (d < 0.8 ? 1 : (1 - d) * 5) : 0;
    }, a.lip, a.lipAmt ?? 0.85, blurPx * 0.35);
    if (a.gloss) layer((x, y) => ell(x, y, lipW * 0.18, ly - lipH * 0.45, lipW * 0.26, lipH * 0.2), '#ffffff', 0.6, blurPx * 0.5, 'screen');
    face.tex.needsUpdate = true;
  }

  // ---------- áp dụng ----------
  function applyAll(a, force) {
    if (!vrm) return;
    const prev = force ? {} : current;
    current = { ...a };
    const outfitKeys = ['outfit', 'finish', 'stockings', 'shoes', 'skirtColor', 'skin'];
    if (force || outfitKeys.some((k) => prev[k] !== a[k])) buildOutfit(a);
    else if (prev.outfitColor !== a.outfitColor && clothMats[0]) {
      clothMats[0].color.set(a.outfitColor);
      if (clothMats[0].sheenColor) clothMats[0].sheenColor.copy(new THREE.Color(a.outfitColor).lerp(new THREE.Color('#fff'), 0.5));
      if (clothMats[0].emissiveMap) clothMats[0].emissive.copy(new THREE.Color(a.outfitColor).lerp(new THREE.Color('#fff'), 0.4));
    }
    if (force || prev.hairColor !== a.hairColor) {
      for (const m of A.hair) for (const mt of matsOf(m)) if (mt.map) recolorMap(mt, a.hairColor, recolorStore);
      const browC = a.hairColor && a.hairColor !== 'original' ? '#' + new THREE.Color(a.hairColor).multiplyScalar(0.55).getHexString() : 'original';
      for (const m of A.brow) for (const mt of matsOf(m)) if (mt.map) recolorMap(mt, browC, recolorStore);
    }
    if ((force || prev.eyeColor !== a.eyeColor) && A.iris) for (const mt of matsOf(A.iris)) if (mt.map) recolorMap(mt, a.eyeColor, recolorStore);
    if (force || prev.skin !== a.skin) {
      for (const m of [A.body, A.face]) if (m) for (const mt of matsOf(m)) if (mt.color && !mt.isOutline) mt.color.set(a.skin || '#ffffff');
      if (A.skinFill && A.skinFill.color) A.skinFill.color.set(a.skin || '#ffffff');
    }
    const faceKeys = ['shadow', 'shadowAmt', 'liner', 'linerColor', 'blush', 'blushAmt', 'lip', 'lipAmt', 'gloss'];
    if (force || faceKeys.some((k) => prev[k] !== a[k])) schedulePaint();
    const accKeys = ['earrings', 'necklace', 'clip', 'hairColor'];
    if (force || accKeys.some((k) => prev[k] !== a[k])) buildAccessories(a);
    inner.scale.setScalar(a.height || 1);
  }
  let paintPending = false;
  function schedulePaint() {
    if (paintPending) return;
    paintPending = true;
    requestAnimationFrame(() => { paintPending = false; paintFace(current); });
  }

  function update(a) {
    const base = (BASES.find((b) => b.id === a.base) || BASES[0]).file;
    if (base !== baseUrl) { current = { ...a }; self.ready = load(base).catch((e) => { console.error(e); self.failed = true; }); return; }
    applyAll(a, false);
  }

  function setHolding(kind) { for (const k in holdItems) holdItems[k].visible = k === kind; }

  // ---------- hoạt ảnh ----------
  const R = (n) => vrm.humanoid.getNormalizedBoneNode(n);
  const SET = ['hips', 'spine', 'chest', 'upperChest', 'neck', 'head', 'leftUpperArm', 'rightUpperArm', 'leftLowerArm', 'rightLowerArm', 'leftHand', 'rightHand', 'leftUpperLeg', 'rightUpperLeg', 'leftLowerLeg', 'rightLowerLeg', 'leftFoot', 'rightFoot', 'leftShoulder', 'rightShoulder'];
  function animate(anim, t, moving, holding) {
    if (!vrm) return;
    const dt = Math.min(0.05, Math.max(0.001, t - lastT)); lastT = t;
    for (const n of SET) { const b = R(n); if (b) b.rotation.set(0, 0, 0); }
    const hips = R('hips'); hips.position.copy(hipsBase);
    const lu = R('leftUpperArm'), ru = R('rightUpperArm'), ll = R('leftLowerArm'), rl = R('rightLowerArm');
    const lUL = R('leftUpperLeg'), rUL = R('rightUpperLeg'), lLL = R('leftLowerLeg'), rLL = R('rightLowerLeg');
    lu.rotation.z = -1.32; ru.rotation.z = 1.32;
    ll.rotation.y = -0.18; rl.rotation.y = 0.18;
    const em = vrm.expressionManager;
    let happy = 0, aa = 0;
    if (anim === 'walk' && moving) {
      const ph = t * 8.5, amp = longSkirt ? 0.26 : 0.42;
      const sw = Math.sin(ph) * amp;
      lUL.rotation.x = -sw; rUL.rotation.x = sw;
      lLL.rotation.x = Math.max(0, Math.sin(ph + 1.5)) * 0.65 * (longSkirt ? 0.6 : 1);
      rLL.rotation.x = Math.max(0, Math.sin(ph + 1.5 + Math.PI)) * 0.65 * (longSkirt ? 0.6 : 1);
      lu.rotation.x = sw * 0.55; ru.rotation.x = -sw * 0.55;
      hips.position.y = hipsBase.y + Math.abs(Math.cos(ph)) * 0.012;
      hips.rotation.y = Math.sin(ph) * 0.12; hips.rotation.z = Math.sin(ph) * 0.05;
      R('spine').rotation.y = -Math.sin(ph) * 0.1;
    } else if (anim === 'dance') {
      const d = t * 7;
      hips.position.x = hipsBase.x + Math.sin(d * 0.5) * 0.05;
      hips.position.y = hipsBase.y - Math.abs(Math.sin(d * 0.5)) * 0.03;
      hips.rotation.z = Math.sin(d * 0.5) * 0.12; hips.rotation.y = Math.sin(d * 0.25) * 0.35;
      R('spine').rotation.z = -Math.sin(d * 0.5) * 0.12;
      lu.rotation.z = 0.5 + Math.sin(d) * 0.35; ru.rotation.z = -0.5 - Math.sin(d + 1) * 0.35;
      ll.rotation.y = -0.6 - Math.sin(d) * 0.4; rl.rotation.y = 0.6 + Math.sin(d + 1) * 0.4;
      lLL.rotation.x = rLL.rotation.x = Math.abs(Math.sin(d * 0.5)) * 0.25;
      lUL.rotation.x = rUL.rotation.x = -Math.abs(Math.sin(d * 0.5)) * 0.12;
      R('head').rotation.z = Math.sin(d * 0.5) * 0.15;
      happy = 1;
    } else if (anim === 'wave') {
      ru.rotation.z = -1.0; ru.rotation.x = -0.2;
      rl.rotation.z = -0.4 + Math.sin(t * 10) * 0.35;
      R('head').rotation.z = -0.1; happy = 0.8;
    } else if (anim === 'sing') {
      ru.rotation.set(-0.6, 0, 1.05); rl.rotation.y = 2.1;
      lu.rotation.z = -0.9 - Math.sin(t * 2) * 0.2; ll.rotation.y = -0.6;
      hips.rotation.y = Math.sin(t * 1.6) * 0.1;
      R('head').rotation.x = -0.08 + Math.sin(t * 3) * 0.04;
      aa = 0.25 + Math.abs(Math.sin(t * 9)) * 0.55; happy = 0.4;
    } else {
      // đứng dáng: dồn trọng tâm, tay chống hông nhẹ
      const b = Math.sin(t * 1.6);
      hips.position.x = hipsBase.x + 0.025; hips.rotation.z = 0.06;
      R('spine').rotation.z = -0.05; R('chest').rotation.z = -0.03;
      R('spine').rotation.x = 0.02 * b;
      lUL.rotation.set(-0.06, 0.05, 0.05); lLL.rotation.x = 0.16;
      rUL.rotation.z = -0.02;
      lu.rotation.z = -1.2; lu.rotation.x = 0.15; ll.rotation.y = -1.1;
      R('head').rotation.z = 0.06 + Math.sin(t * 0.7) * 0.03; R('head').rotation.y = Math.sin(t * 0.4) * 0.1;
      happy = 0.15;
    }
    if (holding) { ru.rotation.set(-0.45, 0, 1.15); rl.rotation.y = 1.35; }
    mic && (mic.visible = anim === 'sing');
    if (em) {
      blinkAt -= dt;
      let blink = 0;
      if (blinkAt < 0) { blink = Math.max(0, 1 - Math.abs(blinkAt + 0.07) / 0.07); if (blinkAt < -0.14) blinkAt = 2 + Math.random() * 3; }
      em.setValue('blink', happy > 0.5 ? 0 : blink);
      em.setValue('happy', happy);
      em.setValue('aa', aa);
    }
    let left = dt; while (left > 1e-4) { const st = Math.min(1 / 60, left); vrm.update(st); left -= st; }
    const sp = getSparkle();
    if (sp) sp.offset.set(Math.sin(t * 0.7) * 0.02, t * 0.004);
    for (const m of clothMats) if (m.emissiveMap) m.emissiveIntensity = 0.75 + Math.sin(t * 5) * 0.25;
  }

  self.update = update;
  self.animate = animate;
  self.setHolding = setHolding;
  Object.defineProperty(self, 'app', { get: () => current });
  update(app);
  return self;
}
