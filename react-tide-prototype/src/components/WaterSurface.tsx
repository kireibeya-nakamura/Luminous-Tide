import { useEffect, useMemo, useState } from "react";

type WaterSurfaceProps = {
  level: number;
  impulse: number;
};

const WIDTH = 390;
const HEIGHT = 844;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function buildWavePath(level: number, time: number, impulse: number) {
  const waterline = HEIGHT * (1 - clamp(level, 0, 1));
  const amplitude = 3.8 + impulse * 13;
  const drift = time * 0.0014;
  const segments = 8;
  const step = WIDTH / segments;

  let path = `M 0 ${waterline.toFixed(2)}`;

  for (let i = 0; i < segments; i += 1) {
    const x1 = i * step;
    const x2 = (i + 1) * step;
    const cx = x1 + step / 2;
    const wave =
      Math.sin(i * 1.4 + drift) * amplitude +
      Math.sin(i * 2.25 - drift * 0.8) * amplitude * 0.32;
    path += ` Q ${cx.toFixed(2)} ${(waterline + wave).toFixed(2)} ${x2.toFixed(2)} ${(
      waterline + Math.sin(i * 1.1 + drift * 0.6) * amplitude * 0.18
    ).toFixed(2)}`;
  }

  return {
    waterline,
    path,
    fillPath: `${path} L ${WIDTH} ${HEIGHT} L 0 ${HEIGHT} Z`,
  };
}

export default function WaterSurface({ level, impulse }: WaterSurfaceProps) {
  const [time, setTime] = useState(() => performance.now());

  useEffect(() => {
    let frameId = 0;

    const tick = (now: number) => {
      setTime(now);
      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, []);

  const wave = useMemo(() => buildWavePath(level, time, impulse), [level, time, impulse]);
  const shimmerOpacity = 0.18 + impulse * 0.12;

  return (
    <svg
      className="water-surface"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="waterDepth" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#153c63" stopOpacity="0.74" />
          <stop offset="45%" stopColor="#082540" stopOpacity="0.88" />
          <stop offset="100%" stopColor="#010711" stopOpacity="0.98" />
        </linearGradient>
        <linearGradient id="waterRim" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="#3bdcff" stopOpacity="0" />
          <stop offset="35%" stopColor="#7feaff" stopOpacity="0.62" />
          <stop offset="55%" stopColor="#8eaaff" stopOpacity="0.48" />
          <stop offset="100%" stopColor="#3bdcff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="underGlow" cx="50%" cy="14%" r="70%">
          <stop offset="0%" stopColor="#72e9ff" stopOpacity="0.2" />
          <stop offset="45%" stopColor="#276da6" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#020711" stopOpacity="0" />
        </radialGradient>
        <filter id="softGlow">
          <feGaussianBlur stdDeviation="3.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <path className="water-fill" d={wave.fillPath} fill="url(#waterDepth)" />
      <path className="water-under-glow" d={wave.fillPath} fill="url(#underGlow)" />

      <g opacity={0.34 + impulse * 0.08}>
        {Array.from({ length: 7 }).map((_, index) => {
          const y = wave.waterline + 28 + index * 37;
          const offset = Math.sin(time * 0.0009 + index) * 18;
          return (
            <path
              className="subtle-current"
              d={`M -20 ${y.toFixed(1)} C ${80 + offset} ${(y + 12).toFixed(1)}, ${
                230 - offset
              } ${(y - 14).toFixed(1)}, 410 ${(y + 4).toFixed(1)}`}
              key={index}
            />
          );
        })}
      </g>

      <path
        className="waterline-glow"
        d={wave.path}
        filter="url(#softGlow)"
        stroke="url(#waterRim)"
        strokeOpacity={shimmerOpacity}
      />
      <path className="waterline-core" d={wave.path} stroke="rgba(178, 239, 255, 0.52)" />
    </svg>
  );
}
