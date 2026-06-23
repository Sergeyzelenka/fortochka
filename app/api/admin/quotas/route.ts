import { NextRequest, NextResponse } from 'next/server';
import { getSnapshot } from '@/lib/quota';
import { sb, isMock } from '@/lib/db';

export const dynamic = 'force-dynamic';

async function countToday(filter: (q: any) => any): Promise<{ calls: number; errors: number }> {
  if (isMock) return { calls: 0, errors: 0 };
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  const sinceIso = since.toISOString();
  const base = sb().from('pipeline_log').select('ok').gt('created_at', sinceIso);
  const { data } = await filter(base);
  const rows = (data ?? []) as { ok: boolean }[];
  return { calls: rows.length, errors: rows.filter(r => !r.ok).length };
}

async function countAll(filter: (q: any) => any): Promise<{ calls: number; errors: number }> {
  if (isMock) return { calls: 0, errors: 0 };
  const base = sb().from('pipeline_log').select('ok');
  const { data } = await filter(base);
  const rows = (data ?? []) as { ok: boolean }[];
  return { calls: rows.length, errors: rows.filter(r => !r.ok).length };
}

export async function GET(_req: NextRequest) {
  const mem = getSnapshot();

  // Gemini сегодня: записи draft + redraft, где detail содержит 'gemini'
  const gemini = await countToday(q => q.eq('step', 'draft').like('detail', '%gemini%'));
  // APIYI сегодня: все записи step='illustrate'
  const apiyi = await countToday(q => q.eq('step', 'illustrate'));
  // Всего за всё время (не зависит от границы суток UTC)
  const apiyiAll = await countAll(q => q.eq('step', 'illustrate'));
  const geminiAll = await countAll(q => q.eq('step', 'draft').like('detail', '%gemini%'));
  // Groq draft сегодня (для информативности — в карточке Groq покажем «успехов сегодня»)
  const groqDraftToday = await countToday(q => q.eq('step', 'draft').or('detail.like.%groq%,detail.is.null'));
  // Groq filter сегодня
  const groqFilterToday = await countToday(q => q.eq('step', 'filter'));

  return NextResponse.json({
    startedAt: mem.startedAt,
    groq: mem.groq,
    groqUsageToday: {
      filter: groqFilterToday,
      draft: groqDraftToday
    },
    gemini,
    apiyi,
    geminiAll,
    apiyiAll
  });
}
