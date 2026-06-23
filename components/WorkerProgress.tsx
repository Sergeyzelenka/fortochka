'use client';
import { useEffect, useState } from 'react';

interface Status {
  isActive: boolean;
  dominantStep: string | null;
  dominantStepLabel: string | null;
  counts?: Record<string, number>;
  recent?: { stats: Record<string, { ok: number; fail: number }>; total: number };
}

export default function WorkerProgress() {
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

  if (!s || !s.counts) return null;
  const c = s.counts;
  const recent = s.recent?.stats ?? {};

  const Stage = ({
    label, queue, queueLabel, processed, step, hint
  }: {
    label: string; queue: number; queueLabel: string; processed: number; step: string; hint?: string;
  }) => {
    const isCurrent = s.isActive && s.dominantStep === step;
    const r = recent[step];
    return (
      <div className={`wp-stage${isCurrent ? ' wp-stage-active' : ''}`}>
        <div className="wp-stage-head">
          <span className="wp-stage-label">{label}</span>
          {isCurrent && <span className="wp-stage-pulse" />}
        </div>
        <div className="wp-stage-q">
          <b>{queue}</b> <span>{queueLabel}</span>
        </div>
        {r ? (
          <div className="wp-stage-recent">
            За последнюю минуту: <b className="ok">+{r.ok}</b>{r.fail > 0 && <> <b className="fail">−{r.fail}</b></>}
          </div>
        ) : (
          <div className="wp-stage-recent wp-idle">{hint ?? 'ожидание'}</div>
        )}
      </div>
    );
  };

  return (
    <div className="wp">
      <div className="wp-title">
        <span>Конвейер</span>
        {s.isActive
          ? <span className="wp-active">● работает: {s.dominantStepLabel ?? '...'}</span>
          : <span className="wp-idle">простой</span>}
      </div>
      <div className="wp-grid">
        <Stage
          label="1. Сбор"
          queue={c.found ?? 0}
          queueLabel="ждут фильтр"
          processed={recent.collect?.ok ?? 0}
          step="collect"
        />
        <span className="wp-arrow">→</span>
        <Stage
          label="2. Фильтр"
          queue={c.filtered ?? 0}
          queueLabel="ждут переписать"
          processed={recent.filter?.ok ?? 0}
          step="filter"
        />
        <span className="wp-arrow">→</span>
        <Stage
          label="3. Переписать"
          queue={c.pending_review ?? 0}
          queueLabel="на апруве в очереди"
          processed={recent.draft?.ok ?? 0}
          step="draft"
        />
        <span className="wp-arrow">→</span>
        <Stage
          label="4. Публикация"
          queue={c.published ?? 0}
          queueLabel="опубликовано всего"
          processed={recent.review?.ok ?? 0}
          step="review"
        />
      </div>
      <div className="wp-footer">
        Отсев фильтром: {c.rejected_by_ai ?? 0} · Отклонено редактором: {c.rejected_by_editor ?? 0} · Ошибки: {c.error ?? 0}
      </div>
    </div>
  );
}
