// ✨ Nhân vật 3D thật (dựng trên Tripo, khung xương kiểu Mixamo).
// File chỉ cần rig, KHÔNG cần animation: mọi cử động (thở, đi, nhảy, vẫy, hát, múa cột...) viết bằng code ở đây.
// Danh sách nhân vật: public/models/girls/manifest.json
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

let manifest = [];
const cache = new Map(); // file -> Promise<gltf>
const loader = new GLTFLoader();

export async function loadManifest() {
  try { const r = await fetch('/models/girls/manifest.json', { cache: 'no-cache' }); manifest = r.ok ? await r.json() : []; } catch (e) { manifest = []; }
  return manifest;
}
export const models = () => manifest;
export const modelInfo = (id) => manifest.find((m) => m.id === id);
function loadFile(file) {
  if (!cache.has(file)) cache.set(file, loader.loadAsync('/models/girls/' + file));
  return cache.get(file);
}
export function preload(id) { const m = modelInfo(id); if (m) loadFile(m.file).catch(() => {}); }

// tên xương: "mixamorig:LeftArm" -> GLTFLoader đổi thành "mixamorigLeftArm"; ta bỏ tiền tố cho gọn
const short = (n) => n.replace(/^mixamorig[:_]?/i, '');

const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _e = new THREE.Euler();
const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
const qe = (x, y, z, order = 'XYZ') => new THREE.Quaternion().setFromEuler(_e.set(x, y, z, order));

class Rig {
  constructor(root) {
    this.root = root;
    root.updateMatrixWorld(true);
    const rootInv = new THREE.Quaternion(); root.getWorldQuaternion(rootInv).invert();
    this.bones = []; this.by = {};
    root.traverse((o) => { if (o.isBone) { this.bones.push(o); this.by[short(o.name)] = o; } });
    // sắp theo độ sâu: cha trước con
    const depth = (b) => { let d = 0; for (let p = b.parent; p; p = p.parent) d++; return d; };
    this.bones.sort((a, b) => depth(a) - depth(b));
    for (const b of this.bones) {
      const w = new THREE.Quaternion(); b.getWorldQuaternion(w); w.premultiply(rootInv);
      b.userData.restLocal = b.quaternion.clone();
      b.userData.restW = w; // hướng lúc nghỉ, trong hệ tọa độ nhân vật
      b.userData.parentRestW = w.clone().multiply(b.quaternion.clone().invert());
      b.userData.D = new THREE.Quaternion();
    }
    // tự tính góc hạ tay xuống (mẫu có thể là tư thế chữ T hoặc chữ A)
    this.armDown = {};
    for (const s of ['Left', 'Right']) {
      const a = this.by[s + 'Arm'], f = this.by[s + 'ForeArm'];
      if (!a || !f) continue;
      const pa = new THREE.Vector3(), pf = new THREE.Vector3();
      a.getWorldPosition(pa); f.getWorldPosition(pf); root.worldToLocal(pa); root.worldToLocal(pf);
      const dir = pf.sub(pa).normalize();
      const side = Math.sign(dir.x) || (s === 'Left' ? 1 : -1);
      const target = new THREE.Vector3(side * 0.2, -1, 0.06).normalize();
      this.armDown[s] = new THREE.Quaternion().setFromUnitVectors(dir, target);
      this.armSide = this.armSide || {}; this.armSide[s] = side;
    }
  }
  // pose: { TênXương: Quaternion (xoay thêm trong hệ trục nhân vật) }
  apply(pose) {
    for (const b of this.bones) {
      const ud = b.userData;
      const Dp = b.parent && b.parent.isBone ? b.parent.userData.D : null;
      const Qc = pose[short(b.name)];
      if (Dp) ud.D.copy(Dp); else ud.D.identity();
      if (Qc) ud.D.premultiply(Qc);
      if (!Qc && !Dp) { b.quaternion.copy(ud.restLocal); continue; }
      // local = parentRestW^-1 * Dp^-1 * D * restW
      _q.copy(ud.parentRestW).invert();
      if (Dp) _q.multiply(_q2.copy(Dp).invert());
      _q.multiply(ud.D).multiply(ud.restW);
      b.quaternion.copy(_q);
    }
  }
}

// góc tay: a = dang ngang (+ ra ngoài), f = đưa ra trước (+), tw = xoắn
function armQ(rig, s, out, fwd, tw = 0) {
  const side = rig.armSide ? rig.armSide[s] : (s === 'Left' ? 1 : -1);
  const q = qe(-fwd, tw * side, out * side, 'ZXY');
  return q.multiply(rig.armDown[s] || new THREE.Quaternion());
}
const elbow = (bend) => qe(-bend, 0, 0); // gập khuỷu tay về phía trước

export const _lab = { qe: (...a) => qe(...a), armQ: (...a) => armQ(...a), elbow: (...a) => elbow(...a) };
// ======= các điệu bộ (trả về pose + độ nảy người) =======
function poseFor(rig, anim, t, moveAmt, holding) {
  const P = {}; let bob = 0, spin = 0, lean = 0;
  const sin = Math.sin, cos = Math.cos;
  const breath = sin(t * 2.2);
  const relax = (s, k = 0) => { P[s + 'Arm'] = armQ(rig, s, 0.05 + k, 0.05); P[s + 'ForeArm'] = elbow(0.18); };
  if (anim === 'walk') {
    const w = t * 8.5, a = 0.42 * Math.max(0.6, moveAmt || 1);
    for (const [s, ph] of [['Left', 0], ['Right', Math.PI]]) {
      const sw = sin(w + ph);
      P[s + 'UpLeg'] = qe(-sw * a, 0, 0);
      P[s + 'Leg'] = qe(Math.max(0, -cos(w + ph)) * 0.9, 0, 0);
      P[s + 'Foot'] = qe(sw * 0.15, 0, 0);
      P[s + 'Arm'] = armQ(rig, s, 0.08, -sw * 0.32);
      P[s + 'ForeArm'] = elbow(0.25 + Math.max(0, -sw) * 0.25);
    }
    P.Hips = qe(0, sin(w) * 0.12, sin(w) * 0.06);
    P.Spine = qe(0.04, -sin(w) * 0.1, 0);
    bob = Math.abs(cos(w)) * 0.035;
  } else if (anim === 'dance') {
    const b = t * 6;
    P.Hips = qe(0, sin(b * 0.5) * 0.35, sin(b) * 0.18);
    P.Spine = qe(0.05, -sin(b * 0.5) * 0.2, -sin(b) * 0.12);
    P.Spine2 = qe(0, 0, -sin(b) * 0.1);
    P.LeftArm = armQ(rig, 'Left', 0.9 + sin(b) * 0.5, 0.6, -0.3); P.LeftForeArm = elbow(1.5 + sin(b + 1) * 0.4);
    P.RightArm = armQ(rig, 'Right', 0.9 - sin(b) * 0.5, 0.6, -0.3); P.RightForeArm = elbow(1.5 - sin(b + 1) * 0.4);
    P.LeftUpLeg = qe(-Math.max(0, sin(b)) * 0.35, 0, 0.05); P.LeftLeg = qe(Math.max(0, sin(b)) * 0.7, 0, 0);
    P.RightUpLeg = qe(-Math.max(0, -sin(b)) * 0.35, 0, -0.05); P.RightLeg = qe(Math.max(0, -sin(b)) * 0.7, 0, 0);
    P.Head = qe(0.1, sin(b * 0.5) * 0.3, sin(b) * 0.15);
    bob = Math.abs(sin(b)) * 0.05;
  } else if (anim === 'wave') {
    relax('Left');
    P.RightArm = armQ(rig, 'Right', 0.25 + sin(t * 9) * 0.12, 0.6); P.RightForeArm = elbow(2.2 + sin(t * 9) * 0.25);
    P.RightHand = qe(0, 0, sin(t * 9) * 0.3);
    P.Hips = qe(0, 0, 0.06); P.Head = qe(0.05, -0.2, -0.12);
  } else if (anim === 'sing') {
    P.RightArm = armQ(rig, 'Right', -0.3, 0.5, -0.6); P.RightForeArm = elbow(2.5);
    P.LeftArm = armQ(rig, 'Left', 0.6 + sin(t * 1.5) * 0.25, 0.5); P.LeftForeArm = elbow(0.6);
    P.Spine = qe(-0.05 + sin(t * 1.5) * 0.04, 0, sin(t * 0.75) * 0.06);
    P.Head = qe(-0.15 + sin(t * 3) * 0.05, sin(t * 0.75) * 0.15, 0);
  } else if (anim === 'pole') {
    const b = t * 1.6;
    P.RightArm = armQ(rig, 'Right', 2.6, 0.4); P.RightForeArm = elbow(0.3);
    P.LeftArm = armQ(rig, 'Left', 1.2, 0.8 + sin(b) * 0.3); P.LeftForeArm = elbow(0.9);
    P.Hips = qe(0.1, sin(b) * 0.4, cos(b) * 0.2);
    P.Spine = qe(-0.2 + sin(b) * 0.1, -sin(b) * 0.25, -cos(b) * 0.1);
    P.LeftUpLeg = qe(-0.9 - sin(b) * 0.3, 0, 0.15); P.LeftLeg = qe(1.5, 0, 0);
    P.Head = qe(-0.3, sin(b) * 0.3, 0);
    spin = t * 0.8;
  } else if (anim === 'qchange') {
    for (const s of ['Left', 'Right']) { P[s + 'Arm'] = armQ(rig, s, 2.75, 0.1); P[s + 'ForeArm'] = elbow(0.2); }
    P.LeftUpLeg = qe(-0.3, 0, 0); P.LeftLeg = qe(0.8, 0, 0); P.Head = qe(-0.25, 0, 0);
    spin = t * 22; bob = 0.25;
  } else if (anim === 'stun') {
    for (const s of ['Left', 'Right']) { P[s + 'Arm'] = armQ(rig, s, 0.8 + sin(t * 8) * 0.2, 0.2); P[s + 'ForeArm'] = elbow(0.5); }
    P.Spine = qe(0.15, sin(t * 4) * 0.2, sin(t * 5) * 0.15);
    P.Head = qe(0.2, sin(t * 6) * 0.3, cos(t * 6) * 0.2);
  } else {
    // đứng thở, đổi trụ chân, tay thả lỏng
    const sway = sin(t * 0.9);
    relax('Left', 0.03 + breath * 0.01); relax('Right', 0.03 - breath * 0.01);
    P.Hips = qe(0, sway * 0.08, sway * 0.05);
    P.Spine = qe(breath * 0.015, -sway * 0.05, -sway * 0.04);
    P.Spine2 = qe(-breath * 0.02, 0, 0);
    P.LeftUpLeg = qe(0, 0, 0.02); P.RightUpLeg = qe(-0.05 - Math.max(0, sway) * 0.1, 0, -0.02); P.RightLeg = qe(0.1 + Math.max(0, sway) * 0.2, 0, 0);
    P.Head = qe(0.04, sin(t * 0.5) * 0.12, sin(t * 0.7) * 0.05);
  }
  if (holding && anim !== 'qchange' && anim !== 'pole') { P.RightArm = armQ(rig, 'Right', 0.2, 0.7); P.RightForeArm = elbow(1.4); }
  return { P, bob, spin, lean };
}

// ======= nhân vật 3D bọc ngoài (cùng giao diện với createGirl) =======
// fallback: nhân vật người khối, hiện trong lúc chờ tải model (hoặc khi không có model)
export function createModelGirl(app, fallback) {
  const group = new THREE.Group();
  group.add(fallback.group);
  fallback.group.position.set(0, 0, 0);
  const inner = new THREE.Group(); group.add(inner);
  let rig = null, modelId = null, loading = null, holdObj = null, rightHand = null;
  let current = app;

  async function setModel(id) {
    if (id === modelId) return;
    modelId = id;
    inner.clear(); rig = null; rightHand = null;
    fallback.group.visible = true;
    const info = modelInfo(id);
    if (!info) return;
    const my = loading = loadFile(info.file);
    let gltf; try { gltf = await my; } catch (e) { return; }
    if (loading !== my || modelId !== id) return;
    const obj = SkeletonUtils.clone(gltf.scene);
    obj.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; o.castShadow = false; if (o.material) { o.material.envMapIntensity = 0.7; } } });
    // chuẩn chiều cao + đặt chân chạm sàn
    obj.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(obj, true);
    const h = box.max.y - box.min.y || 1;
    const k = (info.height || 1.66) / h;
    obj.scale.setScalar(k);
    obj.position.y = -box.min.y * k;
    if (info.rotY) obj.rotation.y = info.rotY;
    const holder = new THREE.Group(); holder.add(obj); inner.add(holder);
    rig = new Rig(obj);
    rightHand = rig.by.RightHand || null;
    fallback.group.visible = false;
  }
  function update(a) {
    current = a;
    fallback.update(a);
    setModel(a.model && a.model !== 'none' && !a.uniform ? a.model : null); // mặc áo dài (công an) thì tạm về người khối
    inner.scale.setScalar(a.height || 1);
  }
  function setHolding(kind) {
    fallback.setHolding(kind);
    if (!rig) return;
    if (holdObj && holdObj.userData.kind !== kind) { holdObj.parent && holdObj.parent.remove(holdObj); holdObj = null; }
    if (kind && !holdObj && rightHand) {
      // khay nhỏ trên tay phải
      holdObj = new THREE.Group(); holdObj.userData.kind = kind;
      const tray = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.015, 20), new THREE.MeshStandardMaterial({ color: '#d4af37', metalness: 0.9, roughness: 0.2 }));
      holdObj.add(tray);
      const top = kind === 'fruit'
        ? new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 8), new THREE.MeshStandardMaterial({ color: '#e53935' }))
        : new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.13, 12), new THREE.MeshStandardMaterial({ color: '#fff59d', transparent: true, opacity: 0.85 }));
      top.position.y = 0.07; holdObj.add(top);
      inner.add(holdObj);
    }
  }
  function animate(anim, t, moveAmt, holding) {
    if (!rig) { fallback.animate(anim, t, moveAmt, holding); return; }
    const { P, bob, spin } = poseFor(rig, anim, t, moveAmt, holding);
    rig.apply(P);
    inner.children[0].position.y = bob;
    inner.children[0].rotation.y = spin;
    if (holdObj && rightHand) {
      const p = new THREE.Vector3(); rightHand.getWorldPosition(p); inner.worldToLocal(p);
      holdObj.position.set(p.x, p.y + 0.05, p.z + 0.06);
    }
  }
  update(app);
  return {
    group, update, animate, setHolding, is3D: () => !!rig, get rig() { return rig; },
    get headY() { return rig ? 1.5 : fallback.headY; }, get topY() { return rig ? 1.72 : fallback.topY; }, get app() { return current; },
  };
}
