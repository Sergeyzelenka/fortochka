import { NextRequest, NextResponse } from 'next/server';
import { sb, isMock } from '@/lib/db';
import { CATEGORIES } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  if (isMock) return NextResponse.json({ counts: {}, total: 0 });

  const counts: Record<number, number> = {};
  await Promise.all(CATEGORIES.map(async c => {
    const { count } = await sb()
      .from('articles')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'filtered')
      .lt('error_count', 3)
      .eq('category_id', c.id);
    counts[c.id] = count ?? 0;
  }));
  // Без рубрики
  const { count: noneCount } = await sb()
    .from('articles')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'filtered')
    .lt('error_count', 3)
    .is('category_id', null);

  const total = Object.values(counts).reduce((s, v) => s + v, 0) + (noneCount ?? 0);
  return NextResponse.json({ counts, none: noneCount ?? 0, total });
}
