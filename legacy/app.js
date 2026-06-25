const canvas = document.querySelector("#tideCanvas");
const ctx = canvas.getContext("2d");
const gestureLayer = document.querySelector("#gestureLayer");

const form = document.querySelector("#effortForm");
const minutesInput = document.querySelector("#minutesInput");
const logList = document.querySelector("#logList");
const todayTimeEl = document.querySelector("#todayTime");
const totalTimeEl = document.querySelector("#totalTime");
const streakDaysEl = document.querySelector("#streakDays");
const resetButton = document.querySelector("#resetButton");
const tiltButton = document.querySelector("#tiltButton");

const STORAGE_KEY = "luminous-tide-prototype-v1";
const MAX_PARTICLES_DESKTOP = 1450;
const MAX_PARTICLES_MOBILE = 780;

const categories = {
  portfolio: { label: "制作", color: "#48e5ff", hue: 188 },
  study: { label: "勉強", color: "#8e6dff", hue: 252 },
  drawing: { label: "デッサン", color: "#70f4d0", hue: 166 },
  career: { label: "転職準備", color: "#69a7ff", hue: 215 },
};

const data = loadData();
const particles = [];
const burstParticles = [];
const ripples = [];
const trails = [];

let width = 0;
let height = 0;
let dpr = 1;
let lastTime = performance.now();
let visualEnergy = 0;
let flowX = 0;
let flowY = 0;

const pointer = {
  x: 0,
  y: 0,
  prevX: 0,
  prevY: 0,
  vx: 0,
  vy: 0,
  active: false,
  down: false,
};

const tilt = {
  x: 0,
  y: 0,
  enabled: false,
};

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { records: [] };
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.records)) return { records: [] };
    return parsed;
  } catch {
    return { records: [] };
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function minutesToLabel(minutes) {
  const safeMinutes = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safeMinutes / 60);
  const mins = safeMinutes % 60;
  if (hours && mins) return `${hours}h ${mins}m`;
  if (hours) return `${hours}h`;
  return `${mins}m`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function metrics() {
  const today = localDateKey();
  const totals = data.records.reduce(
    (acc, record) => {
      acc.total += record.minutes;
      if (record.date === today) acc.today += record.minutes;
      acc.days.add(record.date);
      return acc;
    },
    { total: 0, today: 0, days: new Set() },
  );

  const sortedDays = [...totals.days].sort();
  let streak = 0;
  if (sortedDays.length) {
    const daySet = new Set(sortedDays);
    const anchor = daySet.has(today)
      ? new Date()
      : new Date(`${sortedDays[sortedDays.length - 1]}T00:00:00`);

    for (let i = 0; i < 3650; i += 1) {
      const key = localDateKey(anchor);
      if (!daySet.has(key)) break;
      streak += 1;
      anchor.setDate(anchor.getDate() - 1);
    }
  }

  const totalFactor = clamp(totals.total / 6000, 0, 1);
  const todayFactor = clamp(totals.today / 300, 0, 1);
  const streakFactor = clamp(streak / 30, 0, 1);

  return {
    todayMinutes: totals.today,
    totalMinutes: totals.total,
    activeDays: totals.days.size,
    streakDays: streak,
    waterLevel: 0.24 + totalFactor * 0.5 + todayFactor * 0.14,
    glow: 0.58 + todayFactor * 1.7 + totalFactor * 1.35 + streakFactor * 1.2,
    density: 0.22 + totalFactor * 0.54 + todayFactor * 0.18 + streakFactor * 0.2,
  };
}

function resizeCanvas() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = Math.floor(window.innerWidth);
  height = Math.floor(window.innerHeight);
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function waterBounds() {
  const m = metrics();
  const mobile = width < 760;
  const rx = Math.min(width * (mobile ? 0.72 : 0.52), mobile ? 520 : 880);
  const ry = Math.min(height * (mobile ? 0.24 : 0.28), mobile ? 210 : 310);
  return {
    cx: width * (mobile ? 0.5 : 0.48),
    cy: height * (mobile ? 0.61 : 0.64),
    rx: rx * (0.86 + m.waterLevel * 0.16),
    ry: ry * (0.82 + m.waterLevel * 0.14),
  };
}

function isInsideWater(x, y, bounds = waterBounds()) {
  const nx = (x - bounds.cx) / bounds.rx;
  const ny = (y - bounds.cy) / bounds.ry;
  return nx * nx + ny * ny <= 1;
}

function randomPointInWater(bounds = waterBounds()) {
  const angle = Math.random() * Math.PI * 2;
  const radius = Math.sqrt(Math.random()) * 0.98;
  return {
    x: bounds.cx + Math.cos(angle) * bounds.rx * radius,
    y: bounds.cy + Math.sin(angle) * bounds.ry * radius,
  };
}

function spawnParticle(bounds = waterBounds(), boost = 1) {
  const point = randomPointInWater(bounds);
  const hue = [188, 196, 214, 252, 166][Math.floor(Math.random() * 5)];
  particles.push({
    x: point.x,
    y: point.y,
    vx: (Math.random() - 0.5) * 0.18 * boost,
    vy: (Math.random() - 0.5) * 0.18 * boost,
    size: 0.7 + Math.random() * 2.6,
    hue,
    phase: Math.random() * Math.PI * 2,
    pulse: 0.4 + Math.random() * 1.2,
  });
}

function spawnBurst(x, y, amount = 72, category = "portfolio") {
  const hue = categories[category]?.hue ?? 188;
  for (let i = 0; i < amount; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.8 + Math.random() * 3.2;
    burstParticles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed * 0.72,
      life: 0.9 + Math.random() * 0.7,
      maxLife: 1.35,
      size: 1.2 + Math.random() * 3.6,
      hue: hue + (Math.random() - 0.5) * 36,
    });
  }
}

function addRipple(x, y, strength = 1) {
  ripples.push({
    x,
    y,
    radius: 8,
    life: 1.1,
    maxLife: 1.1,
    strength,
  });
}

function categoryFromForm() {
  const checked = form.querySelector("input[name='category']:checked");
  return checked?.value ?? "portfolio";
}

function addEffort(minutes, category) {
  const safeMinutes = clamp(Math.round(Number(minutes) || 0), 5, 720);
  const now = new Date();
  data.records.push({
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    date: localDateKey(now),
    category,
    minutes: safeMinutes,
    createdAt: now.toISOString(),
  });
  saveData();
  updateUi();

  const bounds = waterBounds();
  const point = {
    x: bounds.cx + (Math.random() - 0.5) * bounds.rx * 0.35,
    y: bounds.cy + (Math.random() - 0.5) * bounds.ry * 0.3,
  };
  visualEnergy = Math.min(3.4, visualEnergy + safeMinutes / 70);
  addRipple(point.x, point.y, clamp(safeMinutes / 60, 0.7, 4.2));
  spawnBurst(point.x, point.y, Math.min(170, 42 + safeMinutes), category);
}

function updateUi() {
  const m = metrics();
  todayTimeEl.textContent = minutesToLabel(m.todayMinutes);
  totalTimeEl.textContent = minutesToLabel(m.totalMinutes);
  streakDaysEl.textContent = String(m.streakDays);

  const today = localDateKey();
  const todayRecords = data.records
    .filter((record) => record.date === today)
    .slice()
    .reverse();

  logList.innerHTML = "";
  if (!todayRecords.length) {
    const empty = document.createElement("li");
    empty.className = "empty-log";
    empty.textContent = "まだ記録がありません。最初の光を足してみてください。";
    logList.append(empty);
    return;
  }

  for (const record of todayRecords) {
    const category = categories[record.category] ?? categories.portfolio;
    const item = document.createElement("li");

    const dot = document.createElement("span");
    dot.className = "log-dot";
    dot.style.color = category.color;

    const title = document.createElement("span");
    title.className = "log-title";
    title.textContent = category.label;

    const time = document.createElement("span");
    time.className = "log-time";
    time.textContent = minutesToLabel(record.minutes);

    item.append(dot, title, time);
    logList.append(item);
  }
}

function adjustParticleCount() {
  const m = metrics();
  const max = width < 760 ? MAX_PARTICLES_MOBILE : MAX_PARTICLES_DESKTOP;
  const target = Math.floor(190 + max * m.density);
  const bounds = waterBounds();
  while (particles.length < target) spawnParticle(bounds);
  if (particles.length > target + 80) particles.length = target;
}

function drawBackground(time, m) {
  const grd = ctx.createLinearGradient(0, 0, 0, height);
  grd.addColorStop(0, "#010209");
  grd.addColorStop(0.46, "#06111f");
  grd.addColorStop(1, "#020409");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(
    width * 0.52,
    height * 0.68,
    0,
    width * 0.52,
    height * 0.68,
    Math.max(width, height) * 0.62,
  );
  glow.addColorStop(0, `rgba(22, 192, 255, ${0.12 + m.glow * 0.03})`);
  glow.addColorStop(0.38, "rgba(38, 72, 176, 0.11)");
  glow.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.strokeStyle = "#4fe6ff";
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i += 1) {
    const y = height * (0.18 + i * 0.1);
    ctx.beginPath();
    for (let x = -30; x <= width + 30; x += 22) {
      const wave = Math.sin(x * 0.01 + time * 0.12 + i) * (4 + i * 1.2);
      if (x === -30) ctx.moveTo(x, y + wave);
      else ctx.lineTo(x, y + wave);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function clipWater(bounds) {
  ctx.beginPath();
  ctx.ellipse(bounds.cx, bounds.cy, bounds.rx, bounds.ry, 0, 0, Math.PI * 2);
  ctx.clip();
}

function drawWaterBase(bounds, time, m) {
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(bounds.cx, bounds.cy, bounds.rx, bounds.ry, 0, 0, Math.PI * 2);

  const base = ctx.createRadialGradient(
    bounds.cx,
    bounds.cy,
    bounds.ry * 0.1,
    bounds.cx,
    bounds.cy,
    bounds.rx,
  );
  base.addColorStop(0, `rgba(21, 115, 166, ${0.34 + m.waterLevel * 0.25})`);
  base.addColorStop(0.48, "rgba(7, 45, 80, 0.78)");
  base.addColorStop(1, "rgba(1, 8, 18, 0.96)");
  ctx.fillStyle = base;
  ctx.fill();

  ctx.save();
  clipWater(bounds);
  ctx.globalCompositeOperation = "screen";
  for (let i = 0; i < 18; i += 1) {
    const y = bounds.cy - bounds.ry * 0.6 + (i / 17) * bounds.ry * 1.2;
    const amp = 7 + m.glow * 2 + i * 0.22;
    const alpha = 0.045 + m.glow * 0.012;
    ctx.beginPath();
    for (let x = bounds.cx - bounds.rx; x <= bounds.cx + bounds.rx; x += 10) {
      const wave =
        Math.sin(x * 0.015 + time * (0.22 + i * 0.01) + i * 0.8) * amp +
        Math.sin(x * 0.041 - time * 0.18 + i) * amp * 0.28;
      if (x === bounds.cx - bounds.rx) ctx.moveTo(x, y + wave);
      else ctx.lineTo(x, y + wave);
    }
    ctx.strokeStyle = `rgba(83, 226, 255, ${alpha})`;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.restore();

  const rimAlpha = 0.18 + m.glow * 0.08;
  ctx.shadowColor = "rgba(69, 219, 255, 0.8)";
  ctx.shadowBlur = 24 + m.glow * 8;
  ctx.lineWidth = 1.3;
  ctx.strokeStyle = `rgba(107, 232, 255, ${rimAlpha})`;
  ctx.stroke();

  const rim = ctx.createLinearGradient(
    bounds.cx - bounds.rx,
    bounds.cy,
    bounds.cx + bounds.rx,
    bounds.cy,
  );
  rim.addColorStop(0, "rgba(80, 113, 180, 0)");
  rim.addColorStop(0.44, `rgba(88, 240, 255, ${0.22 + m.glow * 0.05})`);
  rim.addColorStop(0.55, `rgba(147, 113, 255, ${0.14 + m.glow * 0.04})`);
  rim.addColorStop(1, "rgba(80, 113, 180, 0)");
  ctx.strokeStyle = rim;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.restore();
}

function updateParticles(dt, time, bounds, m) {
  const hoverStrength = pointer.active && isInsideWater(pointer.x, pointer.y, bounds) ? 1 : 0;
  const dragStrength = pointer.down ? 1 : 0;
  const effortForce = 0.16 + m.glow * 0.035 + visualEnergy * 0.03;
  const tx = clamp(tilt.x, -1, 1) * 0.22;
  const ty = clamp(tilt.y, -1, 1) * 0.16;

  for (const p of particles) {
    const noise =
      Math.sin(time * 0.55 + p.phase + p.y * 0.007) * 0.018 +
      Math.cos(time * 0.36 + p.x * 0.008) * 0.012;
    p.vx += (noise + flowX * 0.09 + tx) * dt * effortForce;
    p.vy += (Math.cos(time * 0.42 + p.phase) * 0.012 + flowY * 0.07 + ty) * dt * effortForce;

    if (hoverStrength) {
      const dx = pointer.x - p.x;
      const dy = pointer.y - p.y;
      const distance = Math.hypot(dx, dy) || 1;
      if (distance < 230) {
        const pull = (1 - distance / 230) * (0.8 + m.glow * 0.13) * dt;
        p.vx += (dx / distance) * pull;
        p.vy += (dy / distance) * pull;
      }
    }

    if (dragStrength) {
      const dx = p.x - pointer.x;
      const dy = p.y - pointer.y;
      const distance = Math.hypot(dx, dy) || 1;
      if (distance < 190) {
        const spin = (1 - distance / 190) * 1.2 * dt;
        p.vx += (-dy / distance) * spin + pointer.vx * 0.004;
        p.vy += (dx / distance) * spin + pointer.vy * 0.004;
      }
    }

    p.vx *= 0.985;
    p.vy *= 0.985;
    p.x += p.vx * dt * 60;
    p.y += p.vy * dt * 60;

    const nx = (p.x - bounds.cx) / bounds.rx;
    const ny = (p.y - bounds.cy) / bounds.ry;
    const distanceFromCenter = nx * nx + ny * ny;
    if (distanceFromCenter > 1) {
      const angle = Math.atan2(ny, nx);
      p.x = bounds.cx + Math.cos(angle) * bounds.rx * 0.96;
      p.y = bounds.cy + Math.sin(angle) * bounds.ry * 0.96;
      p.vx *= -0.45;
      p.vy *= -0.45;
    }
  }
}

function updateTransient(dt) {
  visualEnergy = Math.max(0, visualEnergy - dt * 0.42);
  flowX *= Math.pow(0.88, dt * 60);
  flowY *= Math.pow(0.88, dt * 60);

  for (let i = ripples.length - 1; i >= 0; i -= 1) {
    const ripple = ripples[i];
    ripple.radius += (90 + ripple.strength * 42) * dt;
    ripple.life -= dt;
    if (ripple.life <= 0) ripples.splice(i, 1);
  }

  for (let i = trails.length - 1; i >= 0; i -= 1) {
    trails[i].life -= dt;
    if (trails[i].life <= 0) trails.splice(i, 1);
  }

  for (let i = burstParticles.length - 1; i >= 0; i -= 1) {
    const p = burstParticles[i];
    p.life -= dt;
    p.vx *= 0.982;
    p.vy *= 0.982;
    p.y += p.vy * dt * 60;
    p.x += p.vx * dt * 60;
    if (p.life <= 0) burstParticles.splice(i, 1);
  }
}

function drawParticles(bounds, time, m) {
  ctx.save();
  clipWater(bounds);
  ctx.globalCompositeOperation = "lighter";

  for (const p of particles) {
    const pulse = 0.62 + Math.sin(time * p.pulse + p.phase) * 0.34;
    const alpha = clamp(0.13 + m.glow * 0.08 + pulse * 0.22, 0.12, 0.86);
    const radius = p.size * (0.8 + pulse * 0.45);
    ctx.shadowColor = `hsla(${p.hue}, 100%, 66%, ${alpha})`;
    ctx.shadowBlur = 10 + m.glow * 5;
    ctx.fillStyle = `hsla(${p.hue}, 100%, 70%, ${alpha})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const p of burstParticles) {
    const alpha = clamp(p.life / p.maxLife, 0, 1);
    ctx.shadowColor = `hsla(${p.hue}, 100%, 68%, ${alpha})`;
    ctx.shadowBlur = 16;
    ctx.fillStyle = `hsla(${p.hue}, 100%, 72%, ${alpha})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawRipples(bounds) {
  ctx.save();
  clipWater(bounds);
  ctx.globalCompositeOperation = "lighter";

  for (const trail of trails) {
    const alpha = trail.life / trail.maxLife;
    ctx.shadowBlur = 24;
    ctx.shadowColor = `rgba(84, 235, 255, ${alpha})`;
    ctx.strokeStyle = `rgba(84, 235, 255, ${alpha * 0.45})`;
    ctx.lineWidth = 5 * alpha;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(trail.px, trail.py);
    ctx.quadraticCurveTo(
      (trail.px + trail.x) / 2,
      (trail.py + trail.y) / 2 - 10 * alpha,
      trail.x,
      trail.y,
    );
    ctx.stroke();
  }

  for (const ripple of ripples) {
    const alpha = ripple.life / ripple.maxLife;
    ctx.shadowBlur = 22;
    ctx.shadowColor = `rgba(83, 232, 255, ${alpha})`;
    ctx.strokeStyle = `rgba(83, 232, 255, ${alpha * 0.62})`;
    ctx.lineWidth = 1.3 + ripple.strength * alpha;
    ctx.beginPath();
    ctx.ellipse(
      ripple.x,
      ripple.y,
      ripple.radius * 1.35,
      ripple.radius * 0.56,
      0,
      0,
      Math.PI * 2,
    );
    ctx.stroke();

    ctx.strokeStyle = `rgba(148, 120, 255, ${alpha * 0.35})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(
      ripple.x,
      ripple.y,
      ripple.radius * 0.65,
      ripple.radius * 0.28,
      0,
      0,
      Math.PI * 2,
    );
    ctx.stroke();
  }

  if (pointer.active && isInsideWater(pointer.x, pointer.y, bounds)) {
    const grd = ctx.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, 180);
    grd.addColorStop(0, "rgba(93, 241, 255, 0.2)");
    grd.addColorStop(0.22, "rgba(74, 192, 255, 0.12)");
    grd.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(pointer.x, pointer.y, 180, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawDepthShade(bounds) {
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  const shade = ctx.createRadialGradient(
    bounds.cx,
    bounds.cy + bounds.ry * 0.18,
    bounds.ry * 0.2,
    bounds.cx,
    bounds.cy + bounds.ry * 0.22,
    bounds.rx * 1.05,
  );
  shade.addColorStop(0, "rgba(0, 0, 0, 0)");
  shade.addColorStop(0.72, "rgba(0, 0, 0, 0.18)");
  shade.addColorStop(1, "rgba(0, 0, 0, 0.72)");
  ctx.fillStyle = shade;
  ctx.beginPath();
  ctx.ellipse(bounds.cx, bounds.cy, bounds.rx * 1.02, bounds.ry * 1.02, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function frame(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.04);
  const time = now / 1000;
  lastTime = now;

  const m = metrics();
  const bounds = waterBounds();
  adjustParticleCount();
  updateParticles(dt, time, bounds, m);
  updateTransient(dt);

  drawBackground(time, m);
  drawWaterBase(bounds, time, m);
  drawRipples(bounds);
  drawParticles(bounds, time, m);
  drawDepthShade(bounds);

  requestAnimationFrame(frame);
}

function setPointer(event) {
  pointer.prevX = pointer.x;
  pointer.prevY = pointer.y;
  pointer.x = event.clientX;
  pointer.y = event.clientY;
  pointer.vx = pointer.x - pointer.prevX;
  pointer.vy = pointer.y - pointer.prevY;
  pointer.active = true;

  if (pointer.down && isInsideWater(pointer.x, pointer.y)) {
    flowX += clamp(pointer.vx / 120, -0.6, 0.6);
    flowY += clamp(pointer.vy / 120, -0.6, 0.6);
    trails.push({
      x: pointer.x,
      y: pointer.y,
      px: pointer.prevX,
      py: pointer.prevY,
      life: 0.55,
      maxLife: 0.55,
    });
    if (Math.random() < 0.18) spawnBurst(pointer.x, pointer.y, 8, categoryFromForm());
  }
}

function isUiTarget(event) {
  return Boolean(event.target?.closest?.(".panel, button, input, label, select, textarea, a"));
}

const pointerTarget = gestureLayer || window;

function captureGesturePointer(pointerId) {
  try {
    gestureLayer?.setPointerCapture?.(pointerId);
  } catch {
    // Some mobile browsers cancel pointer capture when a scroll gesture wins.
  }
}

function releaseGesturePointer(pointerId) {
  try {
    gestureLayer?.releasePointerCapture?.(pointerId);
  } catch {
    // The pointer may already be released after a browser scroll or cancel.
  }
}

pointerTarget.addEventListener("pointermove", (event) => {
  if (isUiTarget(event)) return;
  setPointer(event);
});
pointerTarget.addEventListener("pointerleave", () => {
  pointer.active = false;
  pointer.down = false;
});
pointerTarget.addEventListener("pointerdown", (event) => {
  if (isUiTarget(event)) return;
  captureGesturePointer(event.pointerId);
  setPointer(event);
  pointer.down = true;
  if (isInsideWater(pointer.x, pointer.y)) {
    addRipple(pointer.x, pointer.y, 1.35);
    spawnBurst(pointer.x, pointer.y, 52, categoryFromForm());
    visualEnergy = Math.min(2.6, visualEnergy + 0.65);
  }
});
pointerTarget.addEventListener("pointerup", (event) => {
  pointer.down = false;
  releaseGesturePointer(event.pointerId);
});
pointerTarget.addEventListener("pointercancel", (event) => {
  pointer.down = false;
  pointer.active = false;
  releaseGesturePointer(event.pointerId);
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  addEffort(minutesInput.value, categoryFromForm());
});

document.querySelectorAll("[data-minutes]").forEach((button) => {
  button.addEventListener("click", () => {
    minutesInput.value = button.dataset.minutes;
  });
});

resetButton.addEventListener("click", () => {
  const confirmed = window.confirm("記録をリセットしますか？");
  if (!confirmed) return;
  data.records = [];
  saveData();
  particles.length = 0;
  burstParticles.length = 0;
  ripples.length = 0;
  trails.length = 0;
  visualEnergy = 0;
  updateUi();
});

tiltButton.addEventListener("click", async () => {
  try {
    const eventType = window.DeviceOrientationEvent;
    if (eventType && typeof eventType.requestPermission === "function") {
      const permission = await eventType.requestPermission();
      if (permission !== "granted") return;
    }

    if (!tilt.enabled) {
      window.addEventListener("deviceorientation", handleOrientation);
      tilt.enabled = true;
      tiltButton.textContent = "傾き中";
    } else {
      window.removeEventListener("deviceorientation", handleOrientation);
      tilt.enabled = false;
      tilt.x = 0;
      tilt.y = 0;
      tiltButton.textContent = "傾きON";
    }
  } catch {
    tiltButton.textContent = "非対応";
  }
});

function handleOrientation(event) {
  tilt.x = clamp((event.gamma || 0) / 38, -1, 1);
  tilt.y = clamp((event.beta || 0) / 52, -1, 1);
}

window.addEventListener("resize", resizeCanvas);

resizeCanvas();
updateUi();
for (let i = 0; i < 260; i += 1) spawnParticle();
requestAnimationFrame(frame);
