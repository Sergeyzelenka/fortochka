import { NextRequest, NextResponse } from 'next/server';
import { sbService, isMock } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(_req: NextRequest, { params }: { params: { slug: string } }) {
  if (isMock) return NextResponse.json({ views: 0 });
  const sb = sbService();
  // Атомарный инкремент через RPC, чтобы не было гонки, если хотим. Пока — простой put.
  const { data, error } = await sb
    .from('articles')
    .select('id, views')
    .eq('slug', params.slug)
    .eq('status', 'published')
    .single();
  if (error || !data) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const next = (data.views ?? 0) + 1;
  const { error: upErr } = await sb.from('articles').update({ views: next }).eq('id', data.id);
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
  return NextResponse.json({ views: next });
}
