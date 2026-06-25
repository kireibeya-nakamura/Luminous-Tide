import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { EffortLog, ParticleBurst } from "../types";
import LogButton from "./LogButton";
import Particles from "./Particles";
import WaterSurface from "./WaterSurface";

const INITIAL_LEVEL = 0.2;
const LEVEL_STEP = 0.05;
const MAX_LEVEL = 0.9;

const logLabels = [
  "制作",
  "3DCG",
  "水の表現",
  "読書",
  "観察メモ",
  "ポートフォリオ",
];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function OceanScene() {
  const [targetLevel, setTargetLevel] = useState(INITIAL_LEVEL);
  const [displayLevel, setDisplayLevel] = useState(INITIAL_LEVEL);
  const [waveImpulse, setWaveImpulse] = useState(0);
  const [burst, setBurst] = useState<ParticleBurst | null>(null);
  const [logs, setLogs] = useState<EffortLog[]>([]);

  const levelRef = useRef(INITIAL_LEVEL);
  const velocityRef = useRef(0);
  const targetRef = useRef(INITIAL_LEVEL);
  const waveImpulseRef = useRef(0);
  const nextIdRef = useRef(1);

  useEffect(() => {
    targetRef.current = targetLevel;
  }, [targetLevel]);

  useEffect(() => {
    waveImpulseRef.current = waveImpulse;
  }, [waveImpulse]);

  useEffect(() => {
    let frameId = 0;
    let lastTime = performance.now();

    const tick = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.035);
      lastTime = now;

      const displacement = targetRef.current - levelRef.current;
      const stiffness = 82;
      const damping = 13.5;
      const acceleration = displacement * stiffness - velocityRef.current * damping;

      velocityRef.current += acceleration * dt;
      levelRef.current = clamp(levelRef.current + velocityRef.current * dt, 0.08, MAX_LEVEL);

      waveImpulseRef.current = Math.max(0, waveImpulseRef.current - dt * 1.55);

      setDisplayLevel(levelRef.current);
      setWaveImpulse(waveImpulseRef.current);

      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, []);

  const handleRecord = useCallback(() => {
    const id = nextIdRef.current;
    nextIdRef.current += 1;

    const label = logLabels[(id - 1) % logLabels.length];
    const minutes = [15, 20, 30, 40, 60][(id - 1) % 5];
    const nextTarget = clamp(targetRef.current + LEVEL_STEP, INITIAL_LEVEL, MAX_LEVEL);

    setTargetLevel(nextTarget);
    setWaveImpulse((current) => Math.min(current + 1.05, 1.9));
    setBurst({
      id,
      level: levelRef.current,
      amount: 18,
    });
    setLogs((current) =>
      [
        {
          id,
          label,
          minutes,
          createdAt: new Date(),
        },
        ...current,
      ].slice(0, 3),
    );
  }, []);

  const levelPercent = Math.round(targetLevel * 100);

  return (
    <main className="ocean-app" aria-label="Luminous Tide mobile interaction prototype">
      <section className="phone-stage">
        <div className="night-glow" />
        <Particles level={displayLevel} burst={burst} />
        <WaterSurface level={displayLevel} impulse={waveImpulse} />

        <header className="top-bar" aria-label="画面操作">
          <button className="icon-button" type="button" aria-label="メニュー">
            <span />
            <span />
            <span />
          </button>
          <div className="level-chip" aria-label={`現在の水位 ${levelPercent}%`}>
            水位 {levelPercent}%
          </div>
        </header>

        <section className="hero-copy" aria-label="プロトタイプ概要">
          <p className="eyebrow">Luminous Tide</p>
          <h1>今日の努力が、静かに満ちていく。</h1>
        </section>

        <section className="log-stack" aria-label="最近の記録">
          {logs.length === 0 ? (
            <p className="empty-log">記録すると、水面が少しだけ持ち上がります。</p>
          ) : (
            logs.map((log, index) => (
              <article className="log-card" style={{ "--i": index } as CSSProperties} key={log.id}>
                <strong>{log.label}</strong>
                <span>{log.minutes}m</span>
                <time>{formatTime(log.createdAt)}</time>
              </article>
            ))
          )}
        </section>

        <LogButton onRecord={handleRecord} disabled={targetLevel >= MAX_LEVEL} />
      </section>
    </main>
  );
}
