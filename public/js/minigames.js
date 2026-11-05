// 8 loại yêu cầu của khách → 6 mini-game (trái cây & nước chanh là đi lấy ở quầy bar)
import * as D from './data.js';

let open = false;
export const isMinigameOpen = () => open;

const root = () => document.getElementById('mg');
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const shuffle = (a) => a.map((v) => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map((x) => x[1]);
let cleanups = [];
function onKey(fn) {
  const h = (e) => fn(e);
  window.addEventListener('keydown', h);
  cleanups.push(() => window.removeEventListener('keydown', h));
}
function onKeyUp(fn) {
  const h = (e) => fn(e);
  window.addEventListener('keyup', h);
  cleanups.push(() => window.removeEventListener('keyup', h));
}
function shell(title, sub) {
  const r = root();
  r.innerHTML = `<div class="mg-card"><div class="mg-title">${title}</div><div class="mg-sub">${sub}</div><div class="mg-timer"><i></i></div><div class="mg-body"></div><div class="mg-result"></div></div>`;
  r.classList.add('show');
  return r.querySelector('.mg-body');
}
function timer(ms, onEnd) {
  const bar = root().querySelector('.mg-timer i');
  const t0 = performance.now();
  let stop = false;
  const loop = () => {
    if (stop) return;
    const p = Math.min(1, (performance.now() - t0) / ms);
    bar.style.width = (1 - p) * 100 + '%';
    if (p >= 1) { stop = true; onEnd(); return; }
    requestAnimationFrame(loop);
  };
  loop();
  return () => { stop = true; };
}
function hideTimer() { const t = root().querySelector('.mg-timer'); if (t) t.style.visibility = 'hidden'; }
function finish(q, msg) {
  cleanups.forEach((f) => f()); cleanups = [];
  return new Promise((res) => {
    const r = root();
    const el = r.querySelector('.mg-result');
    el.textContent = msg || (q >= 0.85 ? 'Xuất sắc! 🌟' : q >= 0.5 ? 'Tạm ổn 👍' : 'Hơi tệ 😅');
    el.className = 'mg-result show ' + (q >= 0.5 ? 'good' : 'bad');
    setTimeout(() => { r.classList.remove('show'); r.innerHTML = ''; open = false; res(q); }, 1200);
  });
}

export async function runMinigame(kind, ctx) {
  open = true;
  try {
    switch (kind) {
      case 'song': return await song(ctx);
      case 'beer': return await beer(ctx);
      case 'cheers': return await cheers(ctx);
      case 'duet': return await duet(ctx);
      case 'dance': return await dance(ctx);
      case 'chat': return await chat(ctx);
      default: open = false; return 0.5;
    }
  } catch (e) { console.error(e); open = false; root().classList.remove('show'); return 0.5; }
}

// ---------- 🎵 Chọn bài ----------
function song(ctx) {
  const genre = ctx.data.genre;
  const body = shell('🎵 Chọn bài', `${ctx.cname} muốn nghe nhạc <b>${genre}</b>`);
  const right = pick(D.SONGS.filter((s) => s.genre === genre));
  const others = shuffle(D.SONGS.filter((s) => s.genre !== genre)).slice(0, 3);
  const list = shuffle([right, ...others]);
  body.innerHTML = `<div class="mg-grid">${list.map((s, i) => `<button class="mg-opt" data-i="${i}"><b>${s.title}</b><small>${s.genre}</small></button>`).join('')}</div>`;
  return new Promise((res) => {
    let done = false;
    const end = (q, m) => { if (done) return; done = true; stopT(); finish(q, m).then(res); };
    const stopT = timer(9000, () => end(0.1, 'Chậm quá, khách tự bấm bài luôn rồi 😑'));
    body.querySelectorAll('.mg-opt').forEach((b) => b.onclick = () => {
      const s = list[+b.dataset.i];
      end(s.genre === genre ? 1 : 0.25, s.genre === genre ? 'Đúng gu khách! 🎶' : 'Sai gu rồi... 😬');
    });
  });
}

// ---------- 🍺 Rót bia ----------
function beer(ctx) {
  const body = shell('🍺 Rót bia', 'Giữ nút (hoặc phím Space) để rót, buông tay khi bia vào <b>vạch xanh</b>. Tràn là hỏng!');
  hideTimer();
  body.innerHTML = `<canvas class="mg-canvas" width="200" height="260"></canvas><button class="mg-big" id="pour">GIỮ ĐỂ RÓT</button>`;
  const cv = body.querySelector('canvas'), c = cv.getContext('2d');
  let fill = 0, pouring = false, done = false, started = false;
  const LO = 0.76, HI = 0.9;
  const draw = () => {
    c.clearRect(0, 0, 200, 260);
    c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(50, 20, 100, 220);
    const h = Math.min(fill, 1.05) * 220;
    c.fillStyle = '#ffb300'; c.fillRect(50, 240 - h, 100, h);
    if (h > 8) { c.fillStyle = '#fffde7'; c.fillRect(50, 240 - h, 100, Math.min(16, h)); }
    c.fillStyle = 'rgba(76,175,80,0.35)'; c.fillRect(46, 240 - HI * 220, 108, (HI - LO) * 220);
    c.strokeStyle = '#fff'; c.lineWidth = 3; c.strokeRect(50, 20, 100, 220);
    if (pouring) { c.fillStyle = '#ffb300'; c.fillRect(96, 0, 8, 240 - h); }
  };
  return new Promise((res) => {
    const end = () => {
      if (done) return; done = true;
      let q, m;
      if (fill > 1) { q = 0.1; m = 'Tràn ra bàn rồi! 😱'; }
      else if (fill >= LO && fill <= HI) { q = 1; m = 'Bọt đẹp như quảng cáo! 🍻'; }
      else { q = Math.max(0.2, 1 - Math.abs(fill - (LO + HI) / 2) / 0.45); m = fill < LO ? 'Hơi ít bia á 🤏' : 'Hơi nhiều bọt 😅'; }
      finish(q, m).then(res);
    };
    const start = () => { if (!done) { pouring = true; started = true; } };
    const stop = () => { if (pouring) { pouring = false; end(); } };
    const btn = body.querySelector('#pour');
    btn.addEventListener('pointerdown', (e) => { e.preventDefault(); start(); });
    btn.addEventListener('pointerup', stop); btn.addEventListener('pointerleave', stop);
    onKey((e) => { if (e.code === 'Space') { e.preventDefault(); start(); } });
    onKeyUp((e) => { if (e.code === 'Space') stop(); });
    let last = performance.now();
    const loop = (now) => {
      const dt = (now - last) / 1000; last = now;
      if (pouring) { fill += dt * (0.32 + fill * 0.35); if (fill > 1.05) stop(); }
      draw();
      if (!done) requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    setTimeout(() => { if (!started && !done) { done = true; finish(0.1, 'Khách tự rót luôn rồi 😑').then(res); } }, 10000);
  });
}

// ---------- 🥂 Cụng ly ----------
function cheers(ctx) {
  const body = shell('🥂 Dzô!', 'Bấm thật nhanh nút DZÔ (hoặc Space) trong 4 giây!');
  body.innerHTML = `<div class="mg-count">0</div><button class="mg-big pink" id="dzo">DZÔ! 🍻</button>`;
  const cnt = body.querySelector('.mg-count');
  let taps = 0, done = false;
  return new Promise((res) => {
    const tap = () => { if (done) return; taps++; cnt.textContent = taps; cnt.classList.remove('pop'); void cnt.offsetWidth; cnt.classList.add('pop'); };
    body.querySelector('#dzo').addEventListener('pointerdown', (e) => { e.preventDefault(); tap(); });
    onKey((e) => { if (e.code === 'Space' && !e.repeat) { e.preventDefault(); tap(); } });
    timer(4000, () => {
      done = true;
      const q = Math.min(1, taps / 16);
      finish(q, q >= 0.85 ? `${taps} lần! Trăm phần trăm! 🔥` : `${taps} lần... khách chưa đã 😅`).then(res);
    });
  });
}

// ---------- 🎤 Song ca ----------
function duet(ctx) {
  const body = shell('🎤 Song ca', 'Bấm HÁT (hoặc Space) khi nốt nhạc chạm vòng tròn');
  hideTimer();
  body.innerHTML = `<canvas class="mg-canvas wide" width="360" height="120"></canvas><button class="mg-big" id="sing">HÁT ♪</button>`;
  const cv = body.querySelector('canvas'), c = cv.getContext('2d');
  const N = 8, TRAVEL = 1.7, HITX = 60;
  const notes = []; let t = 1.2;
  for (let i = 0; i < N; i++) { notes.push({ time: t, judged: false, score: 0 }); t += 0.5 + Math.random() * 0.45; }
  const endT = t + 0.6;
  const t0 = performance.now();
  let flash = 0, flashText = '';
  return new Promise((res) => {
    let done = false;
    const hit = () => {
      const now = (performance.now() - t0) / 1000;
      let best = null, bd = 1;
      for (const n of notes) if (!n.judged) { const d = Math.abs(n.time - now); if (d < bd) { bd = d; best = n; } }
      if (best && bd < 0.2) { best.judged = true; best.score = bd < 0.08 ? 1 : 0.6; flash = 0.3; flashText = bd < 0.08 ? 'HAY!' : 'Ổn'; }
      else { flash = 0.3; flashText = 'Lạc nhịp'; }
    };
    body.querySelector('#sing').addEventListener('pointerdown', (e) => { e.preventDefault(); hit(); });
    onKey((e) => { if (e.code === 'Space' && !e.repeat) { e.preventDefault(); hit(); } });
    const loop = () => {
      const now = (performance.now() - t0) / 1000;
      c.clearRect(0, 0, 360, 120);
      c.strokeStyle = 'rgba(255,255,255,0.25)'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(0, 60); c.lineTo(360, 60); c.stroke();
      c.strokeStyle = '#40c4ff'; c.lineWidth = 4; c.beginPath(); c.arc(HITX, 60, 24, 0, Math.PI * 2); c.stroke();
      for (const n of notes) {
        if (!n.judged && now - n.time > 0.2) n.judged = true;
        if (n.judged) continue;
        const x = HITX + ((n.time - now) / TRAVEL) * 300;
        if (x > 380) continue;
        c.fillStyle = '#ff4fa3'; c.beginPath(); c.arc(x, 60, 16, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#fff'; c.font = 'bold 18px sans-serif'; c.textAlign = 'center'; c.fillText('♪', x, 66);
      }
      if (flash > 0) { flash -= 0.016; c.fillStyle = '#fff'; c.font = 'bold 20px sans-serif'; c.textAlign = 'center'; c.fillText(flashText, HITX, 22); }
      if (now > endT && !done) {
        done = true;
        const q = notes.reduce((s, n) => s + n.score, 0) / N;
        finish(q, q >= 0.85 ? 'Song ca ngọt lịm! 🎶' : q >= 0.5 ? 'Hát cũng được nha 👏' : 'Hơi lệch tông 🙉').then(res);
        return;
      }
      requestAnimationFrame(loop);
    };
    loop();
  });
}

// ---------- 💃 Nhảy (nhớ thứ tự) ----------
function dance(ctx) {
  const body = shell('💃 Nhảy 1 bài', 'Nhớ thứ tự bước nhảy rồi bấm lại (phím mũi tên cũng được)');
  hideTimer();
  const ARR = ['←', '↑', '→', '↓'];
  const KEYS = { ArrowLeft: 0, ArrowUp: 1, ArrowRight: 2, ArrowDown: 3 };
  const len = 5;
  const seq = Array.from({ length: len }, () => Math.floor(Math.random() * 4));
  body.innerHTML = `<div class="mg-show">Chuẩn bị...</div><div class="mg-arrows">${ARR.map((a, i) => `<button class="mg-arrow" data-i="${i}" disabled>${a}</button>`).join('')}</div>`;
  const show = body.querySelector('.mg-show');
  const btns = [...body.querySelectorAll('.mg-arrow')];
  return new Promise((res) => {
    let pos = 0, inputOn = false, done = false;
    const flashBtn = (i) => { btns[i].classList.add('on'); setTimeout(() => btns[i].classList.remove('on'), 300); };
    let k = 0;
    const step = () => {
      if (k < len) { show.textContent = ARR[seq[k]]; flashBtn(seq[k]); k++; setTimeout(() => { show.textContent = ''; setTimeout(step, 150); }, 500); }
      else { show.textContent = 'Tới lượt bạn!'; inputOn = true; btns.forEach((b) => b.disabled = false); }
    };
    setTimeout(step, 700);
    const press = (i) => {
      if (!inputOn || done) return;
      flashBtn(i);
      if (i === seq[pos]) {
        pos++;
        show.textContent = '✓'.repeat(pos);
        if (pos === len) { done = true; finish(1, 'Nhảy sung quá trời! 💃🔥').then(res); }
      } else {
        done = true;
        const q = pos / len;
        finish(Math.max(0.15, q), 'Vấp chân rồi 😵').then(res);
      }
    };
    btns.forEach((b) => b.onclick = () => press(+b.dataset.i));
    onKey((e) => { if (e.code in KEYS) { e.preventDefault(); press(KEYS[e.code]); } });
  });
}

// ---------- 💬 Nói chuyện ----------
function chat(ctx) {
  const pool = D.CHATS[ctx.type] || D.CHATS.daigia;
  const c = pick(pool);
  const body = shell('💬 Nói chuyện', `<b>${ctx.cname}:</b> "${c.q}"`);
  const ans = shuffle(c.a);
  body.innerHTML = `<div class="mg-list">${ans.map((a, i) => `<button class="mg-opt" data-i="${i}">${a[0]}</button>`).join('')}</div>`;
  return new Promise((res) => {
    let done = false;
    const end = (q, m) => { if (done) return; done = true; stopT(); finish(q, m).then(res); };
    const stopT = timer(10000, () => end(0.1, 'Im lặng đáng sợ... 😶'));
    body.querySelectorAll('.mg-opt').forEach((b) => b.onclick = () => {
      const q = ans[+b.dataset.i][1];
      end(q, q >= 0.85 ? 'Khách cười ha hả! 😆' : q >= 0.5 ? 'Khách gật gù 🙂' : 'Khách quê độ... 😬');
    });
  });
}
