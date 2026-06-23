'use client';
import { useEffect, useState } from 'react';

interface Status {
  isActive: boolean;
  secondsAgo: number | null;
  lastStep: string | null;
  lastStepLabel: string | null;
  lastOk: boolean | null;
  dominantStep: string | null;
  dominantStepLabel: string | null;
}

export default function WorkerStatus() {
  const [s, setS] = useState<Status | null>(null);

  useEffect(() => {
    let alive = true;
    async function tick() {
      try {
        const r = await fetch('/api/admin/worker-status', { cache: 'no-store' });
        if (!r.ok) return;
        const d = await r.json();
        if (alive) setS(d);
      } catch { /* тихо */ }
    }
    tick();
    const id = setInterval(tick, 3000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  if (!s) return null;

  if (s.isActive) {
    return (
      <span className="ws ws-active" title={`Последняя запись: ${s.secondsAgo}с назад`}>
        <span className="ws-dot" />
        Идёт прогон: {s.dominantStepLabel ?? s.lastStepLabel ?? '...'}
      </span>
    );
  }

  if (s.lastStepLabel && s.secondsAgo !== null) {
    const ago = s.secondsAgo < 60
      ? `${s.secondsAgo} сек назад`
      : s.secondsAgo < 3600
        ? `${Math.round(s.secondsAgo / 60)} мин назад`
        : `${Math.round(s.secondsAgo / 3600)} ч назад`;
    return (
      <span className="ws ws-idle" title={`Последняя активность: ${ago}`}>
        <span className="ws-dot ws-dot-idle" />
        Простой. Последний шаг: {s.lastStepLabel}, {ago}
      </span>
    );
  }

  return null;
}
