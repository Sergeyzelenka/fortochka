import { NextRequest, NextResponse } from 'next/server';
import { sb, isMock } from '@/lib/db';

function mockResp() {
  return NextResponse.json({ error: 'mock-mode' }, { status: 400 });
}

export async function GET(req: NextRequest) {
  if (isMock) return mockResp();
  const { data, error } = await sb()
    .from('sources').select('*').order('id', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sources: data });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (isMock) return mockResp();
  const { name, rss_url, default_category } = body;
  if (!name || !rss_url) {
    return NextResponse.json({ error: 'name и rss_url обязательны' }, { status: 400 });
  }
  const { data, error } = await sb()
    .from('sources')
    .insert({
      name: String(name).trim(),
      rss_url: String(rss_url).trim(),
      default_category: default_category ? Number(default_category) : null,
      enabled: true,
      collect_enabled: true
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ source: data });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  if (isMock) return mockResp();
  const { id, ids, ...patch } = body;
  delete patch.key;

  function buildAllowed(p: any) {
    const allowed: any = {};
    if ('enabled' in p) allowed.enabled = !!p.enabled;
    if ('collect_enabled' in p) allowed.collect_enabled = !!p.collect_enabled;
    if ('name' in p) allowed.name = String(p.name).trim();
    if ('rss_url' in p) allowed.rss_url = String(p.rss_url).trim();
    if ('default_category' in p) {
      allowed.default_category = p.default_category ? Number(p.default_category) : null;
    }
    return allowed;
  }

  // Массовый апдейт: { ids: [1,2,3], collect_enabled: true } — для чекбоксов в админке.
  if (Array.isArray(ids)) {
    const idList = ids.map((n: any) => Number(n)).filter((n: number) => Number.isFinite(n));
    if (idList.length === 0) {
      return NextResponse.json({ error: 'ids пуст' }, { status: 400 });
    }
    const allowed = buildAllowed(patch);
    if (Object.keys(allowed).length === 0) {
      return NextResponse.json({ error: 'нечего обновлять' }, { status: 400 });
    }
    const { data, error } = await sb()
      .from('sources').update(allowed).in('id', idList).select();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ sources: data });
  }

  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const allowed = buildAllowed(patch);
  const { data, error } = await sb()
    .from('sources').update(allowed).eq('id', Number(id)).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ source: data });
}

export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (isMock) return mockResp();
  const id = body.id ?? new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const { error } = await sb().from('sources').delete().eq('id', Number(id));
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
