'use client';
import { useEffect, useState } from 'react';

interface GroqInfo {
  remainingRequests: number | null;
  limitRequests: number | null;
  remainingTokens: number | null;
  limitTokens: number | null;
  resetRequestsAt: string | null;
  resetTokensAt: string | null;
  updatedAt: string;
}

interface CountInfo { calls: number; errors: number }

interface Snap {
  startedAt: string;
  groq: Record<string, GroqInfo>;
  groqUsageToday?: { filter: CountInfo; draft: CountInfo };
  gemini: CountInfo;
  apiyi: CountInfo;
  geminiAll?: CountInfo;
  apiyiAll?: CountInfo;
}

function pct(remaining: number | null, limit: number | null): number | null {
  if (remaining == null || limit == null || limit === 0) return null;
  return Math.max(0, Math.min(100, Math.round((remaining / limit) * 100)));
}

function fmtNumber(n: number | null): string {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function barColor(p: number | null): string {
  if (p == null) return 'var(--ink-3)';
  if (p > 50) return '#2E7D4F';
  if (p > 15) return '#A9742B';
  return '#B5534B';
}

export default function QuotaPanel() {
  const [s, setS] = useState<Snap | null>(null);

  useEffect(() => {
    let alive = true;
    async function tick() {
      try {
        const r = await fetch('/api/admin/quotas', { cache: 'no-store' });
        if (!r.ok) return;
        const d = await r.json();
        if (alive) setS(d);
      } catch { /* тихо */ }
    }
    tick();
    const id = setInterval(tick, 5000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  if (!s) return null;
  const groqModels = Object.entries(s.groq);

  return (
    <div className="qp">
      <div className="qp-title">Квоты ИИ</div>
      <div className="qp-grid">
        {groqModels.length === 0 ? (
          <div className="qp-card qp-empty">
            <div className="qp-prov">Groq</div>
            <div className="qp-counter">
              <b>{(s.groqUsageToday?.filter.calls ?? 0) + (s.groqUsageToday?.draft.calls ?? 0)}</b> вызовов сегодня
            </div>
            <div className="qp-note">фильтр {s.groqUsageToday?.filter.calls ?? 0} · драфт {s.groqUsageToday?.draft.calls ?? 0} · сброс в полночь UTC</div>
          </div>
        ) : groqModels.map(([model, g]) => {
          const pReq = pct(g.remainingRequests, g.limitRequests);
          const pTok = pct(g.remainingTokens, g.limitTokens);
          const usedToday = (s.groqUsageToday?.filter.calls ?? 0) + (s.groqUsageToday?.draft.calls ?? 0);
          return (
            <div className="qp-card" key={model}>
              <div className="qp-prov">Groq <small>{model}</small></div>
              <div className="qp-line">
                <div className="qp-line-h"><span>Запросы</span><b>{fmtNumber(g.remainingRequests)} / {fmtNumber(g.limitRequests)}</b></div>
                <div className="qp-bar"><span style={{ width: `${pReq ?? 0}%`, background: barColor(pReq) }} /></div>
              </div>
              <div className="qp-line">
                <div className="qp-line-h"><span>Токены</span><b>{fmtNumber(g.remainingTokens)} / {fmtNumber(g.limitTokens)}</b></div>
                <div className="qp-bar"><span style={{ width: `${pTok ?? 0}%`, background: barColor(pTok) }} /></div>
              </div>
              <div className="qp-note">сегодня: фильтр {s.groqUsageToday?.filter.calls ?? 0} · драфт {s.groqUsageToday?.draft.calls ?? 0} · всего {usedToday}</div>
              {(g.resetTokensAt || g.resetRequestsAt) && (
                <div className="qp-reset">сброс через {g.resetTokensAt ?? g.resetRequestsAt}</div>
              )}
            </div>
          );
        })}

        <div className="qp-card">
          <div className="qp-prov">Gemini <small>2.5 Flash</small></div>
          <div className="qp-counter">
            <b>{s.gemini.calls}</b> / 20 сегодня
            {s.gemini.errors > 0 && <span className="qp-err"> · {s.gemini.errors} ошиб.</span>}
          </div>
          <div className="qp-bar" style={{ marginTop: 6 }}>
            <span style={{ width: `${Math.min(100, Math.round((s.gemini.calls / 20) * 100))}%`, background: barColor(100 - (s.gemini.calls / 20) * 100) }} />
          </div>
          <div className="qp-note">осталось сегодня: {Math.max(0, 20 - s.gemini.calls)} из 20 · сброс в полночь UTC</div>
          <div className="qp-note">всего обработано: {s.geminiAll?.calls ?? 0}{(s.geminiAll?.errors ?? 0) > 0 ? ` · ${s.geminiAll?.errors} ошиб.` : ''}</div>
        </div>

        <div className="qp-card">
          <div className="qp-prov">APIYI <small>nano-banana</small></div>
          <div className="qp-counter">
            <b>{s.apiyiAll?.calls ?? 0}</b> иллюстраций всего
            {(s.apiyiAll?.errors ?? 0) > 0 && <span className="qp-err"> · {s.apiyiAll?.errors} ошиб.</span>}
          </div>
          <div className="qp-note">сегодня: {s.apiyi.calls} · остаток смотри в кабинете APIYI</div>
        </div>
      </div>
    </div>
  );
}
