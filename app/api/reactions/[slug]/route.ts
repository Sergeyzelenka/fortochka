import { NextRequest, NextResponse } from 'next/server';
import { sbService, isMock } from '@/lib/db';

export const dynamic = 'force-dynamic';

const KINDS = ['sun', 'heart', 'clap'] as const;
type Kind = typeof KINDS[number];

async function articleIdForSlug(slug: string): Promise<number | null> {
  const { data } = await sbService()
    .from('articles').select('id').eq('slug', slug).eq('status', 'published').single();
  return (data as any)?.id ?? null;
}

async function counts(articleId: number, visitorId: string) {
  const sb = sbService();
  const [{ data: agg }, { data: mine }] = await Promise.all([
    sb.from('article_reactions').select('kind').eq('article_id', articleId),
    visitorId
      ? sb.from('article_reactions').select('kind').eq('article_id', articleId).eq('visitor_id', visitorId)
      : Promise.resolve({ data: [] as { kind: string }[] })
  ]);
  const totals: Record<Kind, number> = { sun: 0, heart: 0, clap: 0 };
  for (const r of (agg ?? []) as { kind: Kind }[]) {
    if (KINDS.includes(r.kind)) totals[r.kind]++;
  }
  const mineSet: Record<Kind, boolean> = { sun: false, heart: false, clap: false };
  for (const r of (mine ?? []) as { kind: Kind }[]) {
    if (KINDS.includes(r.kind)) mineSet[r.kind] = true;
  }
  return { totals, mine: mineSet };
}

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  if (isMock) return NextResponse.json({ totals: { sun: 0, heart: 0, clap: 0 }, mine: { sun: false, heart: false, clap: false } });
  const visitorId = new URL(req.url).searchParams.get('v') ?? '';
  const id = await articleIdForSlug(params.slug);
  if (!id) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json(await counts(id, visitorId));
}

export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  if (isMock) return NextResponse.json({ ok: true });
  const body = await req.json();
  const visitorId: string = String(body.visitor_id ?? '').slice(0, 64);
  const kind: Kind = body.kind;
  const action: 'add' | 'remove' = body.action;
  if (!visitorId || !KINDS.includes(kind) || (action !== 'add' && action !== 'remove')) {
    return NextResponse.json({ error: 'invalid input' }, { status: 400 });
  }
  const id = await articleIdForSlug(params.slug);
  if (!id) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const sb = sbService();
  if (action === 'add') {
    const { error } = await sb.from('article_reactions')
      .upsert({ article_id: id, visitor_id: visitorId, kind }, { onConflict: 'article_id,visitor_id,kind' });
    if (error) {
      console.error('reactions upsert', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else {
    const { error } = await sb.from('article_reactions')
      .delete().eq('article_id', id).eq('visitor_id', visitorId).eq('kind', kind);
    if (error) {
      console.error('reactions delete', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }
  return NextResponse.json(await counts(id, visitorId));
}
