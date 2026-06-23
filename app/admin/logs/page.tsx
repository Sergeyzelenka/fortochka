import Link from 'next/link';
import { getRecentLogs, isMock } from '@/lib/db';
import WorkerStatus from '@/components/WorkerStatus';
import Brand from '@/components/Brand';
import LogoutLink from '@/components/LogoutLink';

export const dynamic = 'force-dynamic';

const STEP_LABEL: Record<string, string> = {
  collect: 'Сбор RSS',
  filter: 'Фильтр (Groq)',
  draft: 'Редактор (Gemini)',
  review: 'Решение редактора',
  telegram: 'Telegram'
};

export default async function LogsPage({ searchParams }: { searchParams: { step?: string; only?: string } }) {
  const all = isMock ? [] : await getRecentLogs(300);
  const filtered = all.filter(r => {
    if (searchParams.step && r.step !== searchParams.step) return false;
    if (searchParams.only === 'fail' && r.ok) return false;
    if (searchParams.only === 'ok' && !r.ok) return false;
    return true;
  });

  const okCount = all.filter(r => r.ok).length;
  const failCount = all.length - okCount;

  const q = (extra: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    const merged = { step: searchParams.step, only: searchParams.only, ...extra };
    for (const [k, v] of Object.entries(merged)) {
      if (v) sp.set(k, v);
    }
    const qs = sp.toString();
    return qs ? `/admin/logs?${qs}` : '/admin/logs';
  };

  return (
    <div className="admin">
      <div className="adm-head">
        <div className="wrap">
          <div className="ttl">
            <Brand size={22} tone="light" />
            <span className="sect">Редакция · логи воркера · {filtered.length} из {all.length}</span>
          </div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', fontSize: 13 }}>
            <WorkerStatus />
            <Link href="/admin" style={{ color: '#9AA3B5' }}>Очередь</Link>
            <Link href="/admin/sources" style={{ color: '#9AA3B5' }}>Источники</Link>
            <LogoutLink />
          </div>
        </div>
      </div>

      <div className="wrap" style={{ paddingTop: 28 }}>
        {isMock && <p className="empty">Мок-режим: логов нет, Supabase не настроен.</p>}

        <div className="logs-filters">
          <Link href={q({ step: undefined })} className={!searchParams.step ? 'on' : ''}>Все шаги</Link>
          {['collect', 'filter', 'draft', 'review', 'telegram'].map(s => (
            <Link key={s} href={q({ step: s })} className={searchParams.step === s ? 'on' : ''}>
              {STEP_LABEL[s] ?? s}
            </Link>
          ))}
          <span className="logs-sep" />
          <Link href={q({ only: undefined })} className={!searchParams.only ? 'on' : ''}>Все · {all.length}</Link>
          <Link href={q({ only: 'ok' })} className={searchParams.only === 'ok' ? 'on' : ''}>OK · {okCount}</Link>
          <Link href={q({ only: 'fail' })} className={searchParams.only === 'fail' ? 'on' : ''}>Ошибки · {failCount}</Link>
        </div>

        {filtered.length === 0 && !isMock && <p className="empty">По этому фильтру записей нет.</p>}

        <div className="logs-table">
          {filtered.map(r => (
            <div key={r.id} className={`log-row ${r.ok ? 'ok' : 'fail'}`}>
              <div className="log-time">{new Date(r.created_at).toLocaleString('ru-RU')}</div>
              <div className="log-step">{STEP_LABEL[r.step] ?? r.step}</div>
              <div className="log-mark">{r.ok ? '✓' : '✕'}</div>
              <div className="log-main">
                {r.article_title && (
                  <div className="log-title">
                    {r.article_id ? `#${r.article_id} ` : ''}{r.article_title}
                  </div>
                )}
                {r.detail && <div className="log-detail">{r.detail}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
