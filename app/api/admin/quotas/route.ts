import { NextRequest, NextResponse } from 'next/server';
import { getGroqStateFromDb } from '@/lib/quota';
import { sb, isMock } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Считаем записи pipeline_log за последние 24 часа (скользящее окно).
async function countLast24h(filter: (q: any) => any): Promise<{ calls: number; errors: number }> {
  if (isMock) return { calls: 0, errors: 0 };
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const base = sb().from('pipeline_log').select('ok').gt('created_at', since);
  const { data } = await filter(base);
  const rows = (data ?? []) as { ok: boolean }[];
  return { calls: rows.length, errors: rows.filter(r => !r.ok).length };
}

export async function GET(_req: NextRequest) {
  // Остаток токенов/запросов Groq — из БД (переживает холодные старты Vercel).
  const groq = await getGroqStateFromDb();

  // APIYI: число генераций за последние 24 часа (step='illustrate').
  const apiyi = await countLast24h(q => q.eq('step', 'illustrate'));

  // Gemini: бесплатный лимит 20 запросов/сутки. Считаем сделанные за 24ч.
  const gemini = await countLast24h(q => q.eq('step', 'draft').like('detail', '%gemini%'));

  // Groq: расход за 24ч (фильтр + драфт) рядом с остатком.
  const groqFilter = await countLast24h(q => q.eq('step', 'filter'));
  const groqDraft = await countLast24h(q => q.eq('step', 'draft').or('detail.like.%groq%,detail.is.null'));

  return NextResponse.json({
    groq,
    groqUsage24h: { filter: groqFilter, draft: groqDraft },
    gemini,
    apiyi
  });
}
