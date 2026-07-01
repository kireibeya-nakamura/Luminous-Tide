"use strict";

/* Luminous Tide v2 — ゼロから。
 *
 * 設計のいちばんの芯は「カメラ深度 cam.y」ひとつで水面と水中を繋ぐこと。
 *   cam.y = 0            … 水面画面（水平線は horizonY に見える）
 *   cam.y = crossDepth   … 潜り切った直後（水平線＝水面断面が画面上部 LINE_TOP に残る）
 *   cam.y それ以上        … 水中でのスクロール。断面は画面の上へ抜けて消え、暗くなる
 * 「沈む」も「水面へ」もスクロールも、全部この1つの数字を動かしているだけなので、
 * 水平線と水面断面は最初から最後まで同じ1本の線として繋がって見える。
 */

const $ = (s) => document.querySelector(s);

const app = $("#app");
const canvas = $("#sea");
const ctx = canvas.getContext("2d");
const menuBtn = $("#menuBtn");
const eyeBtn = $("#eyeBtn");
const statSheet = $("#statSheet");
const statTotal = $("#statTotal");
const statDays = $("#statDays");
const clearBtn = $("#clearBtn");
const addBtn = $("#addBtn");
const diveBtn = $("#diveBtn");
const chips = $("#chips");
const stream = $("#stream");
const logList = $("#logList");
const streamEmpty = $("#streamEmpty");
const riseBtn = $("#riseBtn");
const deepHint = $("#deepHint");
const veil = $("#veil");
const recordModal = $("#recordModal");
const titleInput = $("#titleInput");
const minInput = $("#minInput");
const cancelBtn = $("#cancelBtn");

/* ---------- 記録データ ---------- */

const KEY = "luminous-tide-v2";

function loadStore() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.records)) return parsed;
    }
  } catch {
    /* 壊れていたら作り直す */
  }
  // 初回はデモの記録を沈めておく（参照画像と同じ並びで確認できるように）
  const now = Date.now();
  const M = 60000;
  return {
    records: [
      { title: "勉強", min: 60, at: now - 19 * M },
      { title: "3DCG", min: 40, at: now - 105 * M },
      { title: "読書", min: 20, at: now - 178 * M },
      { title: "水の表現を調べた", min: 30, at: now - 253 * M },
      { title: "アイデアを書き出した", min: 15, at: now - 327 * M },
      { title: "写真を整理した", min: 25, at: now - 1489 * M },
      { title: "日記", min: 10, at: now - 1558 * M },
    ],
  };
}

const store = loadStore();

function saveStore() {
  localStorage.setItem(KEY, JSON.stringify(store));
}

function sortedRecords() {
  return store.records.slice().sort((a, b) => b.at - a.at);
}

function minLabel(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h}h${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

function dayKey(d) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dateLabel(at) {
  const d = new Date(at);
  const now = new Date();
  const yest = new Date(now.getTime() - 86400000);
  let day;
  if (dayKey(d) === dayKey(now)) day = "今日";
  else if (dayKey(d) === dayKey(yest)) day = "昨日";
  else day = `${d.getMonth() + 1}/${d.getDate()}`;
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${day} ${hh}:${mm}`;
}

/* ---------- 画面・カメラ ---------- */

const LINE_TOP = 46; // 潜り切ったとき水面断面が残る高さ

let W = 0;
let H = 0;
let horizonY = 0;
let crossDepth = 0;
let scrollRange = 0;

const cam = { y: 0, target: 0, vel: 0 };
let mode = "surface"; // surface | dive | under | rise
let anim = null; // { from, to, t, dur, after }

function clamp(v, a, b) {
  return Math.min(b, Math.max(a, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function smoothstep(a, b, v) {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

function easeInOutSine(t) {
  return 0.5 - 0.5 * Math.cos(Math.PI * t);
}

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = Math.floor(W * dpr);
  canvas.height = Math.floor(H * dpr);
  canvas.style.width = `${W}px`;
  canvas.style.height = `${H}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  horizonY = H * 0.4;
  crossDepth = horizonY - LINE_TOP;
  measureStream();
  if (mode === "under") {
    cam.target = clamp(cam.target, crossDepth, crossDepth + scrollRange);
    cam.y = clamp(cam.y, 0, crossDepth + scrollRange);
  }
  seedSky();
}

/* 水面の波。世界座標。潜降のフレア中は1本の線へ集約するよう平らに。 */
function waveY(x, t) {
  const dp = clamp(cam.y / crossDepth, 0, 1);
  const flare = Math.sin(dp * Math.PI);
  const amp = lerp(5.2, 2.6, dp) * (1 - flare * 0.86);
  return (
    horizonY +
    Math.sin(x * 0.013 + t * 0.52) * amp +
    Math.sin(x * 0.033 - t * 0.31) * amp * 0.42
  );
}

/* ---------- 海の住人たち ---------- */

const stars = [];
const shoreLights = [];
const plankton = [];
const snow = [];
const ripples = [];
const sparks = [];
const motes = [];
let energy = 0; // 記録が溶けた直後の余韻
let nextCoreRing = 4;

function seedSky() {
  stars.length = 0;
  const n = Math.floor(W / 5);
  for (let i = 0; i < n; i += 1) {
    stars.push({
      x: Math.random() * W,
      y: Math.random() * horizonY * 0.86,
      r: 0.4 + Math.random() * 0.9,
      tw: Math.random() * Math.PI * 2,
      sp: 0.3 + Math.random() * 1.4,
    });
  }
  shoreLights.length = 0;
  for (let i = 0; i < 14; i += 1) {
    shoreLights.push({
      x: W * 0.02 + Math.random() * W * 0.34,
      tw: Math.random() * Math.PI * 2,
      warm: Math.random() < 0.7,
    });
  }
}

function seedWater() {
  plankton.length = 0;
  const n = W < 760 ? 150 : 320;
  for (let i = 0; i < n; i += 1) {
    // コア（渦の中心）のまわりに濃く、外へ薄く
    const nearCore = Math.random() < 0.45;
    const cx = W * 0.44;
    const cy = horizonY + (H - horizonY) * 0.52;
    let x;
    let wy;
    if (nearCore) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() ** 1.6 * W * 0.3;
      x = cx + Math.cos(a) * r;
      wy = cy + Math.sin(a) * r * 0.5;
    } else {
      x = Math.random() * W;
      wy = horizonY + 14 + Math.random() ** 0.8 * (H - horizonY) * 1.05;
    }
    plankton.push({
      x,
      wy: Math.max(horizonY + 12, wy),
      r: 0.5 + Math.random() * 1.9,
      tw: Math.random() * Math.PI * 2,
      sp: 0.4 + Math.random() * 1.3,
      hue: [188, 195, 210, 250][Math.floor(Math.random() * 4)],
      dx: (Math.random() - 0.5) * 3,
      dy: (Math.random() - 0.5) * 2,
    });
  }
  snow.length = 0;
  for (let i = 0; i < 64; i += 1) {
    snow.push({
      x: Math.random() * W,
      y: Math.random() * H,
      r: 0.6 + Math.random() * 1.8,
      sp: 6 + Math.random() * 16,
      tw: Math.random() * Math.PI * 2,
    });
  }
}

/* ---------- 描画 ---------- */

function drawSky(t, dim) {
  const sky = ctx.createLinearGradient(0, 0, 0, horizonY);
  sky.addColorStop(0, "#010208");
  sky.addColorStop(0.72, "#040d1a");
  sky.addColorStop(1, "#0a1a2e");
  ctx.fillStyle = sky;
  ctx.fillRect(0, -80, W, horizonY + 80);

  ctx.save();
  ctx.globalAlpha = dim;
  for (const s of stars) {
    const a = 0.22 + 0.5 * Math.abs(Math.sin(t * s.sp + s.tw));
    ctx.fillStyle = `rgba(214, 232, 250, ${a})`;
    ctx.fillRect(s.x, s.y, s.r, s.r);
  }

  // 月
  const mx = W * 0.7;
  const my = H * 0.155;
  const mr = Math.min(W, H) * 0.032;
  const halo = ctx.createRadialGradient(mx, my, 0, mx, my, mr * 6);
  halo.addColorStop(0, "rgba(206, 233, 255, 0.16)");
  halo.addColorStop(0.3, "rgba(120, 185, 245, 0.06)");
  halo.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(mx, my, mr * 6, 0, Math.PI * 2);
  ctx.fill();
  const disc = ctx.createRadialGradient(mx - mr * 0.3, my - mr * 0.3, 0, mx, my, mr);
  disc.addColorStop(0, "rgba(240, 248, 255, 0.95)");
  disc.addColorStop(0.6, "rgba(178, 216, 250, 0.72)");
  disc.addColorStop(1, "rgba(90, 140, 195, 0.4)");
  ctx.fillStyle = disc;
  ctx.beginPath();
  ctx.arc(mx, my, mr, 0, Math.PI * 2);
  ctx.fill();

  // 対岸のシルエットと灯り
  ctx.fillStyle = "rgba(1, 4, 10, 0.85)";
  ctx.beginPath();
  ctx.moveTo(0, horizonY + 2);
  for (let x = 0; x <= W * 0.4; x += 24) {
    ctx.lineTo(x, horizonY - 5 + Math.sin(x * 0.02 + 1.6) * 4);
  }
  ctx.lineTo(W * 0.42, horizonY + 2);
  ctx.closePath();
  ctx.fill();
  for (const l of shoreLights) {
    const a = (0.24 + 0.3 * Math.abs(Math.sin(t * 0.8 + l.tw))) * dim;
    ctx.fillStyle = l.warm
      ? `rgba(255, 214, 150, ${a})`
      : `rgba(160, 220, 255, ${a})`;
    ctx.fillRect(l.x, horizonY - 4 - Math.sin(l.tw) * 3, 1.4, 1.4);
  }
  ctx.restore();
}

function drawSea(t, dp, flare) {
  // 海面から画面の底（＋今の深さぶん）までを満たす
  const bottom = cam.y + H + 100;
  ctx.beginPath();
  ctx.moveTo(0, bottom);
  ctx.lineTo(0, waveY(0, t));
  for (let x = 0; x <= W; x += 14) ctx.lineTo(x, waveY(x, t));
  ctx.lineTo(W, waveY(W, t));
  ctx.lineTo(W, bottom);
  ctx.closePath();
  const sea = ctx.createLinearGradient(0, horizonY, 0, horizonY + H * 1.25);
  sea.addColorStop(0, "rgba(12, 42, 68, 0.94)");
  sea.addColorStop(0.3, "rgba(7, 28, 50, 0.97)");
  sea.addColorStop(1, "#010409");
  ctx.fillStyle = sea;
  ctx.fill();

  // 月光の柱（きらめき）。フレア中は線に吸われて静かになる
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const mx = W * 0.7;
  const rows = W < 760 ? 16 : 24;
  const calm = 1 - flare * 0.85;
  for (let i = 0; i < rows; i += 1) {
    const q = i / (rows - 1);
    const y = horizonY + 8 + (H - horizonY) * (q ** 1.4) * 0.6;
    const spread = 8 + q * 90;
    const drift = Math.sin(t * 0.6 + i * 0.9) * (2 + q * 14);
    const a = (0.12 - q * 0.07) * calm * (0.55 + 0.45 * Math.sin(t * 1.3 + i * 2.2));
    if (a <= 0.004) continue;
    ctx.strokeStyle = `rgba(168, 224, 255, ${Math.max(0, a)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    const seg = spread * (0.4 + Math.abs(Math.sin(i * 3.7)) * 0.5);
    ctx.moveTo(mx + drift - seg * 0.5, y);
    ctx.lineTo(mx + drift + seg * 0.5, y + Math.sin(t + i) * 1.4);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCore(t, dp) {
  // 蓄積のコア：合計時間で少しずつ育つ光だまりと、ゆっくり回る渦
  const total = store.records.reduce((s, r) => s + r.min, 0);
  const grow = clamp(total / 1500, 0, 1);
  const cx = W * 0.44;
  const cy = horizonY + (H - horizonY) * 0.52;
  const R = (46 + grow * 100) * (1 + energy * 0.35);
  const calm = 1 - Math.sin(dp * Math.PI) * 0.7;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 2.4);
  glow.addColorStop(0, `rgba(120, 226, 255, ${(0.16 + energy * 0.18) * calm})`);
  glow.addColorStop(0.4, `rgba(70, 150, 235, ${0.06 * calm})`);
  glow.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, R * 2.4, 0, Math.PI * 2);
  ctx.fill();

  // 渦：スパイラル上の点
  const dots = 26;
  for (let i = 0; i < dots; i += 1) {
    const s = i / dots;
    const a = s * Math.PI * 3.6 + t * 0.16;
    const r = s * R * 1.5;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r * 0.46;
    const al = (1 - s) * (0.3 + 0.3 * Math.sin(t * 1.4 + i)) * calm;
    if (al <= 0.01) continue;
    ctx.fillStyle = `rgba(150, 236, 255, ${al})`;
    ctx.beginPath();
    ctx.arc(x, y, 0.8 + (1 - s) * 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawPlankton(t, dp, flare) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const p of plankton) {
    // ゆらぎ
    p.x += Math.sin(t * 0.22 + p.tw) * p.dx * 0.016;
    p.wy += Math.cos(t * 0.18 + p.tw) * p.dy * 0.016;
    // フレア中は水面の線へ吸い寄せられ、1本の光になる
    if (flare > 0.01) {
      const ly = waveY(p.x, t);
      p.wy += (ly - p.wy) * flare * flare * 0.09;
    } else if (p.wy < horizonY + 10) {
      p.wy = horizonY + 10 + Math.random() * 30;
    }
    if (p.x < -8) p.x = W + 8;
    if (p.x > W + 8) p.x = -8;

    const depth = clamp((p.wy - horizonY) / (H - horizonY), 0, 1.4);
    const tw = 0.5 + 0.5 * Math.sin(t * p.sp + p.tw);
    const a = clamp((0.05 + depth * 0.2 + tw * 0.16 + energy * 0.1) * (1 - flare * 0.25), 0, 0.62);
    const r = p.r * (0.5 + depth * 0.9) * (0.7 + tw * 0.4);
    ctx.fillStyle = `hsla(${p.hue}, 100%, 71%, ${a})`;
    ctx.shadowColor = `hsla(${p.hue}, 100%, 66%, ${a})`;
    ctx.shadowBlur = 3 + depth * 6;
    ctx.beginPath();
    ctx.arc(p.x, p.wy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawSurfaceLine(t, flare) {
  const boost = 1 + flare * 2.8;
  ctx.save();
  ctx.shadowColor = "rgba(120, 235, 255, 0.9)";
  ctx.shadowBlur = 10 * boost;
  const grad = ctx.createLinearGradient(0, 0, W, 0);
  grad.addColorStop(0, "rgba(90, 140, 200, 0.05)");
  grad.addColorStop(0.42, `rgba(110, 240, 255, ${clamp(0.34 * boost, 0, 1)})`);
  grad.addColorStop(0.58, `rgba(154, 134, 255, ${clamp(0.22 * boost, 0, 1)})`);
  grad.addColorStop(1, "rgba(90, 140, 200, 0.05)");
  ctx.strokeStyle = grad;
  ctx.lineWidth = 1.2 + flare * 2.2;
  ctx.beginPath();
  for (let x = 0; x <= W; x += 14) {
    const y = waveY(x, t);
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.lineTo(W, waveY(W, t));
  ctx.stroke();
  ctx.restore();
}

function drawRipplesAndSparks(t, dt) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = ripples.length - 1; i >= 0; i -= 1) {
    const rp = ripples[i];
    rp.life -= dt;
    rp.r += (60 + rp.r * 0.6) * dt;
    if (rp.life <= 0) {
      ripples.splice(i, 1);
      continue;
    }
    const a = (rp.life / rp.max) * 0.4;
    ctx.strokeStyle = `rgba(110, 232, 255, ${a})`;
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.ellipse(rp.x, rp.wy, rp.r, rp.r * 0.32, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = `rgba(160, 140, 255, ${a * 0.5})`;
    ctx.beginPath();
    ctx.ellipse(rp.x, rp.wy, rp.r * 0.55, rp.r * 0.17, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (let i = sparks.length - 1; i >= 0; i -= 1) {
    const sp = sparks[i];
    sp.life -= dt;
    if (sp.life <= 0) {
      sparks.splice(i, 1);
      continue;
    }
    sp.x += sp.vx * dt;
    sp.wy += sp.vy * dt;
    sp.vy *= 0.98;
    const a = clamp(sp.life / sp.max, 0, 1) * 0.7;
    ctx.fillStyle = `hsla(${sp.hue}, 100%, 72%, ${a})`;
    ctx.beginPath();
    ctx.arc(sp.x, sp.wy, sp.r * (0.4 + a), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawMotes(t, dt) {
  // 記録がボタンから海へ溶けていく粒
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = motes.length - 1; i >= 0; i -= 1) {
    const m = motes[i];
    m.t += dt;
    const raw = (m.t - m.delay) / m.dur;
    if (raw < 0) continue;
    if (raw >= 1) {
      motes.splice(i, 1);
      if (!motes.length) {
        // 全部溶けたら波紋と余韻
        ripples.push({ x: m.tx, wy: m.twy, r: 8, life: 1.3, max: 1.3 });
        energy = Math.min(1.6, energy + 0.9);
      }
      continue;
    }
    const e = 1 - (1 - raw) ** 3;
    const arc = Math.sin(raw * Math.PI);
    const x = lerp(m.sx, m.tx, e) + arc * m.curve;
    const y = lerp(m.sy, m.twy, e) - arc * m.lift;
    const a = Math.sin(raw * Math.PI) * 0.8;
    ctx.fillStyle = `rgba(140, 236, 255, ${a})`;
    ctx.shadowColor = `rgba(120, 226, 255, ${a})`;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(x, y, m.r * (0.6 + raw * 0.7), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/* 下から見上げた水面（画面座標）。lineY に追従するので、
   スクロールで断面が上へ抜けるときも一緒に消えていく。 */
function drawUnderside(t, uw, lineY) {
  if (uw <= 0.01 || lineY < -150) return;
  const away = clamp(1 + lineY / 240, 0, 1); // 線が上へ抜けるほど弱く

  ctx.save();

  // 線から上＝水の裏側
  ctx.beginPath();
  ctx.moveTo(0, -6);
  ctx.lineTo(W, -6);
  for (let x = W; x >= 0; x -= 14) {
    ctx.lineTo(x, lineY + (waveY(x, t) - horizonY));
  }
  ctx.closePath();
  const back = ctx.createLinearGradient(0, Math.min(0, lineY - 130), 0, Math.max(1, lineY));
  back.addColorStop(0, `rgba(1, 4, 10, ${0.94 * uw})`);
  back.addColorStop(0.62, `rgba(4, 16, 30, ${0.9 * uw})`);
  back.addColorStop(1, `rgba(16, 50, 82, ${0.85 * uw})`);
  ctx.fillStyle = back;
  ctx.fill();

  ctx.globalCompositeOperation = "screen";

  // 月光が断面越しに溜まる
  const mx = W * 0.62;
  const pool = ctx.createRadialGradient(mx, lineY - 4, 0, mx, lineY - 4, W * 0.4);
  pool.addColorStop(0, `rgba(172, 218, 252, ${0.2 * uw * away})`);
  pool.addColorStop(0.5, `rgba(90, 160, 220, ${0.07 * uw * away})`);
  pool.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = pool;
  ctx.fillRect(0, Math.max(-40, lineY - 160), W, 200);

  // 波の背
  for (let i = 1; i <= 4; i += 1) {
    const y0 = lineY - i * 13;
    if (y0 < -16) continue;
    const a = (0.1 - i * 0.018) * uw * away;
    if (a <= 0.005) continue;
    ctx.strokeStyle = `rgba(130, 198, 240, ${a})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 16) {
      const y = y0 + Math.sin(x * 0.017 + t * 0.5 + i * 1.6) * (2 + i);
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // 断面から沈むゴッドレイ
  const len = H * 0.55;
  for (let i = 0; i < 3; i += 1) {
    const ax = mx + (i - 1) * W * 0.22 + Math.sin(t * 0.07 + i * 2.2) * 22;
    const lean = Math.sin(t * 0.05 + i * 1.4) * 28;
    const w0 = 14 + i * 6;
    const a = (i === 1 ? 0.09 : 0.05) * uw * away;
    const ray = ctx.createLinearGradient(0, lineY, 0, lineY + len);
    ray.addColorStop(0, `rgba(150, 205, 248, ${a})`);
    ray.addColorStop(0.6, `rgba(105, 170, 230, ${a * 0.4})`);
    ray.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = ray;
    ctx.beginPath();
    ctx.moveTo(ax - w0, lineY);
    ctx.lineTo(ax + w0, lineY);
    ctx.lineTo(ax + lean + w0 * 2.6, lineY + len);
    ctx.lineTo(ax + lean - w0 * 2.6, lineY + len);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

function drawSnow(t, dt, flare, uw, lineY, camVel) {
  const vis = clamp(flare * 1.5 + uw * 0.55, 0, 1);
  if (vis <= 0.02) return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const f of snow) {
    // 沈むほど速く上へ流れる＝視差で「自分が沈んでいる」感じが出る
    const v = f.sp * (0.3 + uw * 0.5) + flare * (120 + f.sp * 5) + Math.max(0, camVel) * 0.3;
    f.y -= v * dt;
    f.x += Math.sin(t * 0.5 + f.tw) * 5 * dt;
    if (f.y < Math.max(lineY + 8, -20)) {
      f.y = H + 16 + Math.random() * 30;
      f.x = Math.random() * W;
    }
    const nearLine = clamp((f.y - lineY) / 70, 0, 1);
    const a = vis * nearLine * (0.24 + 0.3 * Math.abs(Math.sin(t * 1.3 + f.tw)));
    if (a <= 0.01) continue;
    if (flare > 0.25) {
      ctx.strokeStyle = `rgba(150, 214, 245, ${a * 0.5})`;
      ctx.lineWidth = f.r * 0.6;
      ctx.beginPath();
      ctx.moveTo(f.x, f.y);
      ctx.lineTo(f.x, f.y + 4 + flare * 9);
      ctx.stroke();
    }
    ctx.fillStyle = `rgba(168, 216, 244, ${a})`;
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/* ---------- メインループ ---------- */

let lastNow = performance.now();
let prevCamY = 0;
let underClassOn = false;

function frame(now) {
  const dt = Math.min((now - lastNow) / 1000, 0.05);
  const t = now / 1000;
  lastNow = now;

  // カメラを進める
  if (anim) {
    anim.t += dt;
    const p = easeInOutSine(clamp(anim.t / anim.dur, 0, 1));
    cam.y = lerp(anim.from, anim.to, p);
    cam.target = cam.y;
    if (anim.t >= anim.dur) {
      const after = anim.after;
      anim = null;
      if (after) after();
    }
  } else {
    cam.y += (cam.target - cam.y) * Math.min(1, dt * 8);
  }
  const camVel = (cam.y - prevCamY) / Math.max(dt, 0.001);
  prevCamY = cam.y;

  const dp = clamp(cam.y / crossDepth, 0, 1);
  const flare = Math.sin(dp * Math.PI);
  const uw = smoothstep(0.55, 0.95, dp);
  const lineY = horizonY - cam.y;

  energy = Math.max(0, energy - dt * 0.5);

  // 潜り切る少し前に水中のログを起こす
  if ((mode === "dive" || mode === "under") && dp > 0.8 && !underClassOn) {
    underClassOn = true;
    app.classList.add("is-under");
    stream.setAttribute("aria-hidden", "false");
  }

  // 自動の波紋：コアがときどき静かに脈打つ
  nextCoreRing -= dt;
  if (nextCoreRing <= 0 && mode === "surface") {
    ripples.push({
      x: W * 0.44,
      wy: horizonY + (H - horizonY) * 0.52,
      r: 6,
      life: 2.2,
      max: 2.2,
    });
    nextCoreRing = 4.5 + Math.random() * 3;
  }

  // ---- 描画 ----
  ctx.fillStyle = "#010308";
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.translate(0, -cam.y); // カメラ。これだけで水面も線も一緒に動く
  drawSky(t, 1 - uw * 0.6);
  drawSea(t, dp, flare);
  drawCore(t, dp);
  drawPlankton(t, dp, flare);
  drawRipplesAndSparks(t, dt);
  drawMotes(t, dt);
  drawSurfaceLine(t, flare);
  ctx.restore();

  // 線より下の深み（画面座標）
  if (dp > 0.02) {
    const extra = clamp((cam.y - crossDepth) / (H * 0.9), 0, 1);
    const dark = clamp(0.5 * dp + 0.45 * extra, 0, 0.94);
    const g = ctx.createLinearGradient(0, Math.max(0, lineY), 0, H);
    g.addColorStop(0, "rgba(2, 10, 20, 0)");
    g.addColorStop(0.3, `rgba(1, 7, 15, ${dark * 0.55})`);
    g.addColorStop(1, `rgba(0, 2, 7, ${dark})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, Math.max(0, lineY), W, H);
  }

  drawUnderside(t, uw, lineY);
  drawSnow(t, dt, flare, uw, lineY, camVel);

  // 水中ログの追従（DOMはtransformだけ）
  const scroll = Math.max(0, cam.y - crossDepth);
  logList.style.transform = `translate3d(0, ${-scroll}px, 0)`;

  // ⌄⌄：まだ下に記録が沈んでいる間だけ
  const more =
    mode === "under" && scrollRange > 40 && scroll < scrollRange - 50;
  deepHint.classList.toggle("is-on", more);

  requestAnimationFrame(frame);
}

/* ---------- モード遷移 ---------- */

function dive() {
  if (mode !== "surface") return;
  closeModal();
  closeSheet();
  mode = "dive";
  app.classList.add("is-sinking");
  anim = {
    from: cam.y,
    to: crossDepth,
    t: 0,
    dur: 3.0,
    after: () => {
      mode = "under";
    },
  };
}

function rise() {
  if (mode !== "under" && mode !== "dive") return;
  mode = "rise";
  underClassOn = false;
  app.classList.remove("is-under");
  stream.setAttribute("aria-hidden", "true");
  const dist = cam.y / Math.max(1, H);
  anim = {
    from: cam.y,
    to: 0,
    t: 0,
    dur: 1.6 + Math.min(1.3, dist * 1.1),
    after: () => {
      mode = "surface";
      cam.target = 0;
      app.classList.remove("is-sinking");
    },
  };
}

/* ---------- 水中のスクロール（＝さらに深く潜る） ---------- */

const drag = { on: false, lastY: 0, lastT: 0, vel: 0, moved: 0, startX: 0, startY: 0 };

canvas.addEventListener("pointerdown", (e) => {
  drag.startX = e.clientX;
  drag.startY = e.clientY;
  drag.moved = 0;
  if (mode === "under") {
    drag.on = true;
    drag.lastY = e.clientY;
    drag.lastT = performance.now();
    drag.vel = 0;
    canvas.setPointerCapture?.(e.pointerId);
  }
});

canvas.addEventListener("pointermove", (e) => {
  if (!drag.on || mode !== "under") return;
  const nowT = performance.now();
  const dy = e.clientY - drag.lastY;
  drag.moved += Math.abs(dy);
  cam.target = clamp(cam.target - dy, crossDepth, crossDepth + scrollRange);
  const dtm = Math.max(8, nowT - drag.lastT);
  drag.vel = (-dy / dtm) * 1000;
  drag.lastY = e.clientY;
  drag.lastT = nowT;
});

function endDrag(e) {
  if (drag.on) {
    drag.on = false;
    canvas.releasePointerCapture?.(e.pointerId);
    // 惰性
    cam.target = clamp(
      cam.target + drag.vel * 0.16,
      crossDepth,
      crossDepth + scrollRange,
    );
    return;
  }
  // 水面でのタップ＝波紋
  const movedFar =
    Math.abs(e.clientX - drag.startX) + Math.abs(e.clientY - drag.startY) > 10;
  if (mode === "surface" && !movedFar && e.clientY > waveY(e.clientX, lastNow / 1000)) {
    ripples.push({ x: e.clientX, wy: e.clientY, r: 6, life: 1.2, max: 1.2 });
    for (let i = 0; i < 14; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const v = 14 + Math.random() * 42;
      sparks.push({
        x: e.clientX,
        wy: e.clientY,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v * 0.6,
        r: 1 + Math.random() * 2.2,
        life: 0.5 + Math.random() * 0.5,
        max: 1,
        hue: [188, 200, 250][Math.floor(Math.random() * 3)],
      });
    }
  }
}

canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", (e) => {
  drag.on = false;
  canvas.releasePointerCapture?.(e.pointerId);
});

window.addEventListener(
  "wheel",
  (e) => {
    if (mode !== "under") return;
    cam.target = clamp(cam.target + e.deltaY * 0.9, crossDepth, crossDepth + scrollRange);
  },
  { passive: true },
);

/* ---------- ログ・チップ・統計 ---------- */

function measureStream() {
  logList.style.paddingTop = `${LINE_TOP + 120}px`;
  logList.style.paddingBottom = "150px";
  scrollRange = Math.max(0, logList.offsetHeight - H + 30);
}

function renderLogs() {
  const records = sortedRecords();
  logList.innerHTML = "";
  streamEmpty.classList.toggle("is-hidden", records.length > 0);

  records.forEach((r, i) => {
    const li = document.createElement("li");
    const pill = document.createElement("div");
    pill.className = "memory";
    const off = (i % 2 === 0 ? 1 : -1) * (16 + (i % 3) * 9);
    const fade = clamp(0.95 - i * 0.09, 0.26, 0.95);
    const scale = clamp(1 - i * 0.018, 0.87, 1);
    pill.style.transform = `translateX(${off}px) scale(${scale})`;
    pill.style.opacity = String(fade);

    const title = document.createElement("p");
    title.className = "m-title";
    title.style.margin = "0";
    const b = document.createElement("b");
    b.textContent = r.title;
    const em = document.createElement("em");
    em.textContent = minLabel(r.min);
    title.append(b, em);

    const date = document.createElement("p");
    date.className = "m-date";
    date.style.margin = "3px 0 0";
    date.textContent = dateLabel(r.at);

    pill.append(title, date);
    li.append(pill);
    logList.append(li);
  });

  measureStream();
}

function renderChips() {
  const latest = sortedRecords().slice(0, 3);
  chips.innerHTML = "";
  for (const r of latest) {
    const chip = document.createElement("span");
    chip.textContent = r.title;
    const em = document.createElement("em");
    em.textContent = minLabel(r.min);
    chip.append(em);
    chips.append(chip);
  }
}

function renderStats() {
  const total = store.records.reduce((s, r) => s + r.min, 0);
  const days = new Set(store.records.map((r) => dayKey(new Date(r.at)))).size;
  statTotal.textContent = minLabel(total);
  statDays.textContent = String(days);
}

function renderAll() {
  renderLogs();
  renderChips();
  renderStats();
}

/* ---------- 記録モーダル ---------- */

function openModal() {
  if (mode !== "surface") return;
  veil.classList.add("is-open");
  recordModal.classList.add("is-open");
  recordModal.setAttribute("aria-hidden", "false");
  window.setTimeout(() => titleInput.focus(), 120);
}

function closeModal() {
  veil.classList.remove("is-open");
  recordModal.classList.remove("is-open");
  recordModal.setAttribute("aria-hidden", "true");
}

function closeSheet() {
  statSheet.classList.remove("is-open");
  statSheet.setAttribute("aria-hidden", "true");
  menuBtn.setAttribute("aria-expanded", "false");
}

recordModal.addEventListener("submit", (e) => {
  e.preventDefault();
  const min = clamp(Math.round(Number(minInput.value) || 30), 5, 720);
  const title = titleInput.value.trim() || "努力";
  store.records.push({ title, min, at: Date.now() });
  saveStore();
  renderAll();

  // ボタンのあたりから海のコアへ、粒が溶けていく
  const rect = recordModal.getBoundingClientRect();
  const sx = rect.left + rect.width * 0.5;
  const sy = rect.top + rect.height * 0.72;
  const tx = W * 0.44;
  const twy = horizonY + (H - horizonY) * 0.52;
  const n = Math.min(60, 16 + Math.floor(min / 3));
  for (let i = 0; i < n; i += 1) {
    motes.push({
      sx: sx + (Math.random() - 0.5) * 40,
      sy: sy + (Math.random() - 0.5) * 14,
      tx: tx + (Math.random() - 0.5) * 90,
      twy: twy + (Math.random() - 0.5) * 40,
      t: 0,
      delay: Math.random() * 0.3,
      dur: 0.9 + Math.random() * 0.5,
      curve: (Math.random() - 0.5) * 120,
      lift: 20 + Math.random() * 50,
      r: 1.2 + Math.random() * 2,
    });
  }

  titleInput.value = "";
  closeModal();
});

document.querySelectorAll(".minutes-row button").forEach((b) => {
  b.addEventListener("click", () => {
    minInput.value = b.dataset.min;
    document
      .querySelectorAll(".minutes-row button")
      .forEach((x) => x.classList.toggle("is-active", x === b));
  });
});

/* ---------- UIの結線 ---------- */

addBtn.addEventListener("click", openModal);
cancelBtn.addEventListener("click", closeModal);
veil.addEventListener("click", closeModal);
diveBtn.addEventListener("click", dive);
riseBtn.addEventListener("click", rise);

menuBtn.addEventListener("click", () => {
  const open = statSheet.classList.toggle("is-open");
  statSheet.setAttribute("aria-hidden", String(!open));
  menuBtn.setAttribute("aria-expanded", String(open));
});

eyeBtn.addEventListener("click", () => {
  const bare = app.classList.toggle("is-bare");
  eyeBtn.setAttribute("aria-pressed", String(bare));
  eyeBtn.setAttribute("aria-label", bare ? "UIを表示" : "UIを隠す");
  if (bare) closeSheet();
});

clearBtn.addEventListener("click", () => {
  if (!window.confirm("すべての記録を消しますか？")) return;
  store.records = [];
  saveStore();
  renderAll();
});

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (recordModal.classList.contains("is-open")) closeModal();
    else if (mode === "under") rise();
  }
});

window.addEventListener("resize", resize);

/* ---------- 起動 ---------- */

resize();
seedWater();
renderAll();
requestAnimationFrame(frame);
