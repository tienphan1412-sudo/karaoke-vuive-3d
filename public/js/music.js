// Nhạc nền: ưu tiên file mp3 trong public/music, nếu không có thì tự chơi nhạc tổng hợp (tự sáng tác, không bản quyền)
import { MUSIC } from './data.js';

let ctx = null, master = null, enabled = true, zone = null, current = null;
const playlists = {};
const noiseBuf = () => {
  if (noiseBuf.b) return noiseBuf.b;
  const b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return (noiseBuf.b = b);
};
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

// ---------- nhạc cụ ----------
function env(g, t, a, peak, dec) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
}
function kick(out, t, v = 1) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
  env(g, t, 0.003, 0.9 * v, 0.28); o.connect(g).connect(out); o.start(t); o.stop(t + 0.35);
}
function noiseHit(out, t, freq, type, v, dec) {
  const s = ctx.createBufferSource(); s.buffer = noiseBuf();
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
  const g = ctx.createGain(); env(g, t, 0.002, v, dec);
  s.connect(f).connect(g).connect(out); s.start(t, Math.random() * 0.5); s.stop(t + dec + 0.05);
}
const snare = (out, t, v = 0.5) => noiseHit(out, t, 1800, 'bandpass', v, 0.16);
const hat = (out, t, v = 0.18) => noiseHit(out, t, 7500, 'highpass', v, 0.045);
function tone(out, t, midi, dur, { type = 'triangle', v = 0.2, cut = 2400, a = 0.005, detune = 0 } = {}) {
  const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
  o.type = type; o.frequency.value = hz(midi); o.detune.value = detune;
  f.type = 'lowpass'; f.frequency.value = cut;
  env(g, t, a, v, dur); o.connect(f).connect(g).connect(out); o.start(t); o.stop(t + a + dur + 0.05);
}
function pad(out, t, notes, dur, v = 0.05, cut = 1100) {
  for (const n of notes) for (const d of [-8, 8]) tone(out, t, n, dur, { type: 'sawtooth', v, cut, a: 0.25, detune: d });
}

// ---------- phong cách nhạc ----------
// hợp âm: mảng nốt MIDI
const C = { Am: [57, 60, 64], F: [53, 57, 60], C: [48, 52, 55], G: [55, 59, 62], Dm: [50, 53, 57], E: [52, 56, 59], Em: [52, 55, 59], Fmaj7: [53, 57, 60, 64], Cmaj7: [48, 52, 55, 59], Am7: [57, 60, 64, 67], Dm7: [50, 53, 57, 60], G7: [55, 59, 62, 65] };
const STYLES = {
  remix: { bpm: 128, prog: ['Am', 'F', 'C', 'G'], step(out, s, t, ch, bar) {
    if (s % 4 === 0) kick(out, t);
    if (s === 4 || s === 12) snare(out, t, 0.35);
    if (s % 4 === 2) hat(out, t, 0.22); else if (s % 2) hat(out, t, 0.07);
    if (s % 4 === 2) tone(out, t, ch[0] - 24, 0.12, { type: 'sawtooth', v: 0.16, cut: 700 });
    if (s === 0 || s === 6 || s === 10) for (const n of ch) tone(out, t, n + 12, 0.12, { type: 'square', v: 0.035, cut: 2600 });
    if (s === 0) pad(out, t, ch, 1.6, 0.025);
  } },
  bolero: { bpm: 66, prog: ['Am', 'Dm', 'E', 'Am'], step(out, s, t, ch) {
    // nhịp rumba-bolero: bùm . . bùm . . bùm .
    if (s === 0 || s === 6 || s === 8) kick(out, t, 0.75);
    if (s === 4 || s === 12) noiseHit(out, t, 3000, 'bandpass', 0.12, 0.08);
    if (s % 2 === 0) { const n = ch[(s / 2) % 3] + (s >= 8 ? 12 : 0); tone(out, t, n, 0.5, { type: 'triangle', v: 0.3, cut: 2200 }); }
    if (s === 0 || s === 8) tone(out, t, ch[0] - 12, 0.6, { type: 'sine', v: 0.4 });
    if (s === 0) pad(out, t, ch, 3.4, 0.03, 1100);
  } },
  kpop: { bpm: 112, prog: ['Fmaj7', 'G7', 'Em', 'Am7'], step(out, s, t, ch, bar, mel) {
    if (s === 0 || s === 7 || s === 10) kick(out, t, 0.9);
    if (s === 4 || s === 12) { snare(out, t, 0.4); noiseHit(out, t, 1200, 'bandpass', 0.2, 0.1); }
    if (s % 2 === 0) hat(out, t, 0.12);
    if (s === 0 || s === 3 || s === 7 || s === 10) tone(out, t, ch[0] - 24, 0.18, { type: 'square', v: 0.1, cut: 500 });
    const m = mel[(bar % 2) * 16 + s];
    if (m) tone(out, t, m, 0.16, { type: 'square', v: 0.05, cut: 3200 });
    if (s === 0) pad(out, t, ch, 2, 0.022, 1600);
  } },
  lofi: { bpm: 80, swing: 0.12, prog: ['Fmaj7', 'Em', 'Dm7', 'Cmaj7'], step(out, s, t, ch) {
    if (s === 0 || s === 10) kick(out, t, 0.55);
    if (s === 4 || s === 12) snare(out, t, 0.22);
    if (s % 2 === 0) hat(out, t, 0.06);
    if (s === 0 || s === 9) for (const n of ch) tone(out, t, n + 12, 1.2, { type: 'triangle', v: 0.1, cut: 1800, a: 0.01 });
    if (s === 0 || s === 8) tone(out, t, ch[0] - 12, 0.7, { type: 'sine', v: 0.22 });
    if (s === 0) noiseHit(out, t, 4000, 'lowpass', 0.015, 3);
  } },
};
const PENTA = [69, 72, 74, 76, 79, 81];
function makeMelody() {
  const m = new Array(32).fill(0);
  for (let i = 0; i < 32; i++) if (Math.random() < (i % 4 === 0 ? 0.7 : i % 2 === 0 ? 0.4 : 0.15)) m[i] = PENTA[Math.floor(Math.random() * PENTA.length)];
  return m;
}

// ---------- một "kênh" nhạc: file mp3 hoặc nhạc tự sinh ----------
function startChannel(z) {
  const conf = MUSIC[z] || MUSIC.lobby;
  const g = ctx.createGain(); g.gain.setValueAtTime(0, ctx.currentTime); g.connect(master);
  g.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.6);
  const ch = { g, stop: null };
  const list = playlists[z] || [];
  if (list.length) {
    const order = list.slice().sort(() => Math.random() - 0.5);
    let i = 0, stopped = false;
    const a = new Audio();
    const src = ctx.createMediaElementSource(a);
    const vol = ctx.createGain(); vol.gain.value = conf.volume ?? 0.6;
    src.connect(vol).connect(g);
    const play = () => { if (stopped) return; a.src = '/music/' + encodeURIComponent(order[i % order.length]); a.play().catch(() => {}); };
    a.addEventListener('ended', () => { i++; play(); });
    a.addEventListener('error', () => { i++; if (i < order.length * 2) setTimeout(play, 300); });
    play();
    ch.stop = () => { stopped = true; a.pause(); a.removeAttribute('src'); a.load(); };
    return ch;
  }
  const st = STYLES[conf.style] || STYLES.remix;
  const out = ctx.createGain(); out.gain.value = 0.55; out.connect(g);
  let step = 0, next = ctx.currentTime + 0.08, mel = makeMelody();
  const dur = 60 / st.bpm / 4;
  const timer = setInterval(() => {
    while (next < ctx.currentTime + 0.6) {
      const s = step % 16, bar = Math.floor(step / 16);
      if (s === 0 && bar % 4 === 0) mel = makeMelody();
      const chord = C[st.prog[bar % st.prog.length]];
      const t = next + (st.swing && s % 2 ? dur * st.swing * 2 : 0);
      st.step(out, s, t, chord, bar, mel);
      next += dur; step++;
    }
  }, 25);
  ch.stop = () => clearInterval(timer);
  return ch;
}

function switchTo(z) {
  if (current) {
    const old = current;
    old.g.gain.cancelScheduledValues(ctx.currentTime);
    old.g.gain.setValueAtTime(Math.max(0.0001, old.g.gain.value), ctx.currentTime);
    old.g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1);
    setTimeout(() => { old.stop(); old.g.disconnect(); }, 1100);
  }
  current = enabled ? startChannel(z) : null;
}

// ---------- API ----------
export async function initMusic() {
  if (ctx) return;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.6; master.connect(ctx.destination);
  } catch (e) { return; }
  try { enabled = localStorage.getItem('ktv_music') !== 'off'; } catch (e) {}
  // lấy danh sách file nhạc thật trên server, chia theo khu
  try {
    const files = await (await fetch('/music-list')).json();
    for (const [z, m] of Object.entries(MUSIC)) {
      const pre = m.prefix.toLowerCase();
      playlists[z] = files.filter((f) => { const n = f.toLowerCase(); return n.startsWith(pre) && !/[a-z]/.test(n.charAt(pre.length)); });
    }
  } catch (e) {}
  if (zone) switchTo(zone);
}
export function setZone(z) {
  if (z === zone) return;
  zone = z;
  if (ctx && enabled) switchTo(z);
}
export function toggleMusic() {
  enabled = !enabled;
  try { localStorage.setItem('ktv_music', enabled ? 'on' : 'off'); } catch (e) {}
  if (!ctx) return enabled;
  if (ctx.state === 'suspended') ctx.resume();
  if (enabled) switchTo(zone || 'lobby');
  else if (current) { const c = current; current = null; c.stop(); c.g.disconnect(); }
  return enabled;
}
export const musicOn = () => enabled;
export function duck(on) { if (master && ctx) master.gain.setTargetAtTime(on ? 0.2 : 0.6, ctx.currentTime, 0.2); }
