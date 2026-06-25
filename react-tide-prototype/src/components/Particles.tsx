import { useEffect, useRef } from "react";
import type { ParticleBurst } from "../types";

type ParticlesProps = {
  level: number;
  burst: ParticleBurst | null;
};

type AmbientParticle = {
  x: number;
  depth: number;
  radius: number;
  alpha: number;
  phase: number;
  speed: number;
};

type BurstParticle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  life: number;
  maxLife: number;
  hue: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function makeAmbientParticle(): AmbientParticle {
  return {
    x: Math.random(),
    depth: Math.random(),
    radius: 0.7 + Math.random() * 1.8,
    alpha: 0.12 + Math.random() * 0.34,
    phase: Math.random() * Math.PI * 2,
    speed: 0.25 + Math.random() * 0.7,
  };
}

export default function Particles({ level, burst }: ParticlesProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ambientRef = useRef<AmbientParticle[]>([]);
  const burstRef = useRef<BurstParticle[]>([]);
  const levelRef = useRef(level);
  const seenBurstRef = useRef<number | null>(null);

  useEffect(() => {
    levelRef.current = level;
  }, [level]);

  useEffect(() => {
    ambientRef.current = Array.from({ length: 58 }, makeAmbientParticle);
  }, []);

  useEffect(() => {
    if (!burst || seenBurstRef.current === burst.id) return;
    seenBurstRef.current = burst.id;

    const canvas = canvasRef.current;
    const width = canvas?.clientWidth ?? 390;
    const height = canvas?.clientHeight ?? 844;
    const waterline = height * (1 - burst.level);

    for (let i = 0; i < burst.amount; i += 1) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.7;
      const speed = 0.35 + Math.random() * 1.4;
      burstRef.current.push({
        x: width * (0.18 + Math.random() * 0.64),
        y: waterline + Math.random() * Math.max(40, height * 0.22),
        vx: Math.cos(angle) * speed * 0.45,
        vy: Math.sin(angle) * speed,
        radius: 1 + Math.random() * 2.6,
        life: 2.8 + Math.random() * 1.8,
        maxLife: 4.1,
        hue: 190 + Math.random() * 34,
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
    };

    const draw = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.04);
      lastTime = now;

      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const waterline = height * (1 - clamp(levelRef.current, 0, 1));

      context.clearRect(0, 0, width, height);
      context.save();
      context.globalCompositeOperation = "lighter";

      for (const particle of ambientRef.current) {
        const sway = Math.sin(now * 0.00025 * particle.speed + particle.phase) * 18;
        const x =
          ((particle.x * width + sway + now * 0.003 * particle.speed) % (width + 24)) - 12;
        const y =
          waterline +
          particle.depth * Math.max(height - waterline, 1) +
          Math.sin(now * 0.00045 + particle.phase) * 6;
        const pulse = 0.55 + Math.sin(now * 0.0012 + particle.phase) * 0.35;
        const alpha = particle.alpha * (0.55 + pulse);

        context.shadowColor = `rgba(95, 218, 255, ${alpha})`;
        context.shadowBlur = 9;
        context.fillStyle = `rgba(130, 231, 255, ${alpha})`;
        context.beginPath();
        context.arc(x, y, particle.radius * (0.8 + pulse * 0.35), 0, Math.PI * 2);
        context.fill();
      }

      for (let i = burstRef.current.length - 1; i >= 0; i -= 1) {
        const particle = burstRef.current[i];
        particle.life -= dt;
        particle.x += particle.vx * dt * 60;
        particle.y += particle.vy * dt * 60;
        particle.vy += 0.018 * dt * 60;

        const fade = clamp(particle.life / particle.maxLife, 0, 1);
        if (particle.life <= 0) {
          burstRef.current.splice(i, 1);
          continue;
        }

        context.shadowColor = `hsla(${particle.hue}, 100%, 68%, ${fade})`;
        context.shadowBlur = 16 * fade;
        context.fillStyle = `hsla(${particle.hue}, 100%, 74%, ${fade * 0.65})`;
        context.beginPath();
        context.arc(particle.x, particle.y, particle.radius * (0.8 + fade), 0, Math.PI * 2);
        context.fill();
      }

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

  return <canvas className="particle-layer" ref={canvasRef} aria-hidden="true" />;
}
