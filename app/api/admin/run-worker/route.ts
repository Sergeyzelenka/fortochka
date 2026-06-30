import { NextRequest, NextResponse } from 'next/server';
import { sb, isMock } from '@/lib/db';
import { collect } from '@/worker/steps/collect';
import { filterStep } from '@/worker/steps/filter';
import { draftStep } from '@/worker/steps/draft';

// На локалке next dev держит API-route сколько надо; на Vercel это лимит.
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

function stepFn(name: string, categoryId?: number): (() => Promise<void>) | null {
  switch (name) {
    case 'collect': return collect;
    case 'filter': return () => filterStep(categoryId);
    case 'draft': return () => draftStep('groq', categoryId);
    case 'draft-gemini': return () => draftStep('gemini', categoryId);
    default: return null;
  }
}

async function countByStatus(status: string): Promise<number> {
  if (isMock) return 0;
  const { count } = await sb()
    .from('articles').select('*', { count: 'exact', head: true }).eq('status', status);
  return count ?? 0;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (isMock) return NextResponse.json({ error: 'mock-mode' }, { status: 400 });

  // Какие шаги запускать. По умолчанию — все по очереди.
  const requested: string[] = Array.isArray(body.steps) && body.steps.length
    ? body.steps
    : ['collect', 'filter', 'draft'];
  const categoryId: number | undefined = Number.isFinite(body.categoryId) ? Number(body.categoryId) : undefined;

  const before = {
    found: await countByStatus('found'),
    filtered: await countByStatus('filtered'),
    pending: await countByStatus('pending_review')
  };
  const startedAt = Date.now();
  const ran: string[] = [];
  const errors: { step: string; message: string }[] = [];

  for (const name of requested) {
    const fn = stepFn(name, categoryId);
    if (!fn) { errors.push({ step: name, message: 'unknown step' }); continue; }
    try {
      await fn();
      ran.push(name);
    } catch (e: any) {
      errors.push({ step: name, message: String(e?.message ?? e).slice(0, 300) });
      // дальше всё равно пробуем следующие шаги — они работают по статусам в БД
    }
  }

  const after = {
    found: await countByStatus('found'),
    filtered: await countByStatus('filtered'),
    pending: await countByStatus('pending_review')
  };
  const elapsedSec = Math.round((Date.now() - startedAt) / 1000);

  return NextResponse.json({
    ok: errors.length === 0,
    ran,
    errors,
    elapsedSec,
    delta: {
      collected: after.found - before.found + after.filtered - before.filtered + (after.pending - before.pending),
      newPending: Math.max(0, after.pending - before.pending)
    },
    after
  });
}
