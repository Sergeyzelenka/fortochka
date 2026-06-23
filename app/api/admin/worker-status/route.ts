import { NextRequest, NextResponse } from 'next/server';
import { sb, isMock } from '@/lib/db';

export const dynamic = 'force-dynamic';

const STEP_LABEL: Record<string, string> = {
  collect: 'Сбор RSS',
  filter: 'Фильтр (Groq)',
  draft: 'Редактор (Groq)',
  review: 'Решение редактора',
  telegram: 'Telegram',
  illustrate: 'Иллюстрация (ИИ)'
};

const ACTIVE_WINDOW_MS = 30_000;

async function statusCounts() {
  const statuses = ['found', 'filtered', 'pending_review', 'published', 'rejected_by_ai', 'rejected_by_editor', 'error'];
  const out: Record<string, number> = {};
  // Один запрос на все — count(*) filter (where status = ...)
  const sel = statuses.map(s => `${s}:articles!inner(count)`).join(',');
  // Проще: 7 запросов параллельно head=true
  await Promise.all(statuses.map(async (s) => {
    const { count } = await sb().from('articles').select('*', { count: 'exact', head: true }).eq('status', s);
    out[s] = count ?? 0;
  }));
  return out;
}

async function recentActivity() {
  // Активность за последнюю минуту по каждому шагу
  const sinceIso = new Date(Date.now() - 60_000).toISOString();
  const { data } = await sb()
    .from('pipeline_log')
    .select('step, ok')
    .gt('created_at', sinceIso);
  const rows = (data ?? []) as { step: string; ok: boolean }[];
  const stats: Record<string, { ok: number; fail: number }> = {};
  for (const r of rows) {
    if (!stats[r.step]) stats[r.step] = { ok: 0, fail: 0 };
    if (r.ok) stats[r.step].ok++; else stats[r.step].fail++;
  }
  return { stats, total: rows.length };
}

export async function GET(_req: NextRequest) {
  if (isMock) return NextResponse.json({ isActive: false, mock: true });

  const [lastRowsRes, counts, recent] = await Promise.all([
    sb().from('pipeline_log').select('id, step, ok, detail, created_at').order('id', { ascending: false }).limit(5),
    statusCounts(),
    recentActivity()
  ]);
  if (lastRowsRes.error) return NextResponse.json({ error: lastRowsRes.error.message }, { status: 500 });

  const rows = lastRowsRes.data ?? [];
  const last = rows[0];
  const lastAt = last ? new Date(last.created_at).getTime() : 0;
  const isActive = lastAt > 0 && (Date.now() - lastAt) < ACTIVE_WINDOW_MS;

  const stepCounts: Record<string, number> = {};
  for (const r of rows) stepCounts[r.step] = (stepCounts[r.step] ?? 0) + 1;
  const dominantStep = Object.entries(stepCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

  return NextResponse.json({
    isActive,
    secondsAgo: last ? Math.round((Date.now() - lastAt) / 1000) : null,
    lastStep: last?.step ?? null,
    lastStepLabel: last ? (STEP_LABEL[last.step] ?? last.step) : null,
    lastOk: last?.ok ?? null,
    dominantStep,
    dominantStepLabel: dominantStep ? (STEP_LABEL[dominantStep] ?? dominantStep) : null,
    counts,
    recent
  });
}
