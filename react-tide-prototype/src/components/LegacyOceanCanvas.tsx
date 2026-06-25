import { useEffect, useRef } from "react";
import type { ParticleBurst } from "../types";

type LegacyOceanCanvasProps = {
  level: number;
  impulse: number;
  burst: ParticleBurst | null;
};

type GlowParticle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  hue: number;
  phase: number;
  pulse: number;
};

type BurstParticle = GlowParticle & {
  life: number;
  maxLife: number;
};

type Ripple = {
  x: number;
  y: number;
  radius: number;
  life: number;
  maxLife: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function randomRange(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function makeParticle(width: number, height: number, level: number): GlowParticle {
  const waterline = height * (1 - level);
  return {
    x: randomRange(width * 0.08, width * 0.92),
    y: randomRange(waterline + 18, height * 0.92),
    vx: randomRange(-0.08, 0.08),
    vy: randomRange(-0.05, 0.05),
    size: randomRange(0.7, 2.8),
    hue: [186, 195, 210, 252, 170][Math.floor(Math.random() * 5)],
    phase: Math.random() * Math.PI * 2,
    pulse: randomRange(0.45, 1.2),
  };
}

function makeWavePoint(x: number, width: number, waterline: number, time: number, impulse: number) {
  const calm = Math.sin(x * 0.025 + time * 0.8) * 3.2;
  const slow = Math.sin(x * 0.012 - time * 0.42) * 2.4;
  const lifted = Math.sin(x * 0.045 + time * 1.4) * impulse * 8;
  const centerLift = Math.sin((x / width) * Math.PI) * impulse * -4;
  return waterline + calm + slow + lifted + centerLift;
}

export default function LegacyOceanCanvas({ level, impulse, burst }: LegacyOceanCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const levelRef = useRef(level);
  const impulseRef = useRef(impulse);
  const seenBurstRef = useRef<number | null>(null);
  const particlesRef = useRef<GlowParticle[]>([]);
  const burstParticlesRef = useRef<BurstParticle[]>([]);
  const ripplesRef = useRef<Ripple[]>([]);

  useEffect(() => {
    levelRef.current = level;
  }, [level]);

  useEffect(() => {
    impulseRef.current = impulse;
  }, [impulse]);

  useEffect(() => {
    if (!burst || seenBurstRef.current === burst.id) return;
    seenBurstRef.current = burst.id;

    const canvas = canvasRef.current;
    const width = canvas?.clientWidth ?? 390;
    const height = canvas?.clientHeight ?? 844;
    const waterline = height * (1 - levelRef.current);
    const originX = width * randomRange(0.32, 0.68);
    const originY = waterline + randomRange(18, Math.max(52, height * 0.12));

    ripplesRef.current.push({
      x: originX,
      y: waterline + 8,
      radius: 8,
      life: 1.25,
      maxLife: 1.25,
    });

    for (let i = 0; i < burst.amount + 12; i += 1) {
      const angle = randomRange(-Math.PI, 0);
      const speed = randomRange(0.4, 2.2);
      burstParticlesRef.current.push({
        x: originX + randomRange(-36, 36),
        y: originY + randomRange(-18, 24),
        vx: Math.cos(angle) * speed * 0.55,
        vy: Math.sin(angle) * speed * 0.72,
        size: randomRange(1.1, 3.6),
        hue: randomRange(184, 225),
        phase: Math.random() * Math.PI * 2,
        pulse: randomRange(0.7, 1.4),
        life: randomRange(2.4, 4.4),
        maxLife: 4.4,
      });
    }
  }, [burst]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    let frameId = 0;
    let lastTime = performance.now();

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      particlesRef.current = Array.from({ length: 220 }, () =>
        makeParticle(rect.width, rect.height, levelRef.current),
      );
    };

    const traceWave = (width: number, waterline: number, time: number, impulseValue: number) => {
      context.beginPath();
      context.moveTo(0, makeWavePoint(0, width, waterline, time, impulseValue));
      for (let x = 0; x <= width + 8; x += 8) {
        context.lineTo(x, makeWavePoint(x, width, waterline, time, impulseValue));
      }
    };

    const clipWater = (width: number, height: number, waterline: number, time: number, impulseValue: number) => {
      traceWave(width, waterline, time, impulseValue);
      context.lineTo(width, height);
      context.lineTo(0, height);
      context.closePath();
      context.clip();
    };

    const draw = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.04);
      lastTime = now;

      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const time = now / 1000;
      const levelValue = clamp(levelRef.current, 0.08, 0.92);
      const impulseValue = clamp(impulseRef.current, 0, 2);
      const waterline = height * (1 - levelValue);
      const waterDepth = Math.max(height - waterline, 1);

      context.clearRect(0, 0, width, height);

      const bg = context.createLinearGradient(0, 0, 0, height);
      bg.addColorStop(0, "#02040b");
      bg.addColorStop(0.38, "#07111e");
      bg.addColorStop(1, "#01030a");
      context.fillStyle = bg;
      context.fillRect(0, 0, width, height);

      const moonShaft = context.createRadialGradient(width * 0.58, waterline - 80, 0, width * 0.58, waterline, width * 0.62);
      moonShaft.addColorStop(0, "rgba(122, 203, 255, 0.12)");
      moonShaft.addColorStop(0.44, "rgba(34, 101, 155, 0.08)");
      moonShaft.addColorStop(1, "rgba(0, 0, 0, 0)");
      context.fillStyle = moonShaft;
      context.fillRect(0, 0, width, height);

      context.save();
      clipWater(width, height, waterline, time, impulseValue);

      const water = context.createLinearGradient(0, waterline, 0, height);
      water.addColorStop(0, "rgba(28, 103, 157, 0.72)");
      water.addColorStop(0.38, "rgba(8, 42, 76, 0.84)");
      water.addColorStop(1, "rgba(1, 7, 17, 0.98)");
      context.fillStyle = water;
      context.fillRect(0, waterline - 30, width, waterDepth + 80);

      const bowlGlow = context.createRadialGradient(
        width * 0.5,
        waterline + waterDepth * 0.34,
        0,
        width * 0.5,
        waterline + waterDepth * 0.38,
        Math.max(width, waterDepth) * 0.75,
      );
      bowlGlow.addColorStop(0, `rgba(28, 205, 255, ${0.16 + impulseValue * 0.04})`);
      bowlGlow.addColorStop(0.42, "rgba(31, 82, 173, 0.12)");
      bowlGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
      context.fillStyle = bowlGlow;
      context.fillRect(0, waterline, width, waterDepth);

      context.globalCompositeOperation = "screen";
      context.lineWidth = 0.8;
      for (let i = 0; i < 16; i += 1) {
        const y = waterline + waterDepth * (0.12 + i * 0.046);
        context.beginPath();
        for (let x = -20; x <= width + 20; x += 12) {
          const wave =
            Math.sin(x * 0.026 + time * (0.32 + i * 0.012) + i) * (3 + impulseValue * 1.5) +
            Math.sin(x * 0.055 - time * 0.22 + i * 0.4) * 1.6;
          if (x === -20) context.moveTo(x, y + wave);
          else context.lineTo(x, y + wave);
        }
        context.strokeStyle = `rgba(88, 225, 255, ${0.035 + impulseValue * 0.012})`;
        context.stroke();
      }

      const ellipseRy = clamp(waterDepth * 0.2, 62, 190);
      context.save();
      context.globalCompositeOperation = "screen";
      context.beginPath();
      context.ellipse(width * 0.5, waterline + ellipseRy * 0.34, width * 0.82, ellipseRy, 0, 0, Math.PI * 2);
      context.strokeStyle = `rgba(92, 229, 255, ${0.2 + impulseValue * 0.09})`;
      context.lineWidth = 1.4 + impulseValue * 0.7;
      context.shadowColor = "rgba(75, 219, 255, 0.75)";
      context.shadowBlur = 18 + impulseValue * 20;
      context.stroke();
      context.restore();

      for (const particle of particlesRef.current) {
        particle.vx += Math.sin(time * 0.5 + particle.phase) * dt * 0.012;
        particle.vy += Math.cos(time * 0.38 + particle.phase) * dt * 0.01;
        particle.vx *= 0.992;
        particle.vy *= 0.992;
        particle.x += particle.vx * dt * 60;
        particle.y += particle.vy * dt * 60;

        if (particle.x < -10) particle.x = width + 10;
        if (particle.x > width + 10) particle.x = -10;
        if (particle.y < waterline + 8 || particle.y > height + 10) {
          const fresh = makeParticle(width, height, levelValue);
          particle.x = fresh.x;
          particle.y = fresh.y;
          particle.vx = fresh.vx;
          particle.vy = fresh.vy;
        }

        const pulse = 0.56 + Math.sin(time * particle.pulse + particle.phase) * 0.34;
        const alpha = clamp(0.12 + levelValue * 0.12 + pulse * 0.18, 0.08, 0.68);
        context.shadowColor = `hsla(${particle.hue}, 100%, 68%, ${alpha})`;
        context.shadowBlur = 8 + levelValue * 8;
        context.fillStyle = `hsla(${particle.hue}, 100%, 72%, ${alpha})`;
        context.beginPath();
        context.arc(particle.x, particle.y, particle.size * (0.85 + pulse * 0.34), 0, Math.PI * 2);
        context.fill();
      }

      for (let i = burstParticlesRef.current.length - 1; i >= 0; i -= 1) {
        const particle = burstParticlesRef.current[i];
        particle.life -= dt;
        particle.vx *= 0.986;
        particle.vy = particle.vy * 0.988 + dt * 0.02;
        particle.x += particle.vx * dt * 60;
        particle.y += particle.vy * dt * 60;

        if (particle.life <= 0) {
          burstParticlesRef.current.splice(i, 1);
          continue;
        }

        const fade = clamp(particle.life / particle.maxLife, 0, 1);
        context.shadowColor = `hsla(${particle.hue}, 100%, 70%, ${fade})`;
        context.shadowBlur = 18 * fade;
        context.fillStyle = `hsla(${particle.hue}, 100%, 74%, ${fade * 0.74})`;
        context.beginPath();
        context.arc(particle.x, particle.y, particle.size * (0.8 + fade * 0.6), 0, Math.PI * 2);
        context.fill();
      }

      for (let i = ripplesRef.current.length - 1; i >= 0; i -= 1) {
        const ripple = ripplesRef.current[i];
        ripple.life -= dt;
        ripple.radius += (52 + impulseValue * 34) * dt;
        if (ripple.life <= 0) {
          ripplesRef.current.splice(i, 1);
          continue;
        }
        const fade = ripple.life / ripple.maxLife;
        context.strokeStyle = `rgba(116, 238, 255, ${fade * 0.42})`;
        context.lineWidth = 1.2;
        context.shadowColor = `rgba(92, 230, 255, ${fade})`;
        context.shadowBlur = 14;
        context.beginPath();
        context.ellipse(ripple.x, ripple.y, ripple.radius * 1.7, ripple.radius * 0.48, 0, 0, Math.PI * 2);
        context.stroke();
      }

      context.restore();

      context.save();
      traceWave(width, waterline, time, impulseValue);
      context.strokeStyle = `rgba(159, 241, 255, ${0.36 + impulseValue * 0.14})`;
      context.lineWidth = 1.2 + impulseValue * 0.25;
      context.shadowColor = "rgba(85, 224, 255, 0.85)";
      context.shadowBlur = 10 + impulseValue * 14;
      context.stroke();

      traceWave(width, waterline + 6, time + 0.9, impulseValue * 0.7);
      context.strokeStyle = `rgba(91, 162, 255, ${0.18 + impulseValue * 0.06})`;
      context.lineWidth = 1;
      context.shadowBlur = 0;
      context.stroke();
      context.restore();

      frameId = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener("resize", resize);
    frameId = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(frameId);
    };
  }, []);

  return <canvas className="legacy-ocean-canvas" ref={canvasRef} aria-hidden="true" />;
}
