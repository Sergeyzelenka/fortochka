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
      enabled: true
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ source: data });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  if (isMock) return mockResp();
  const { id, ...patch } = body;
  delete patch.key;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const allowed: any = {};
  if ('enabled' in patch) allowed.enabled = !!patch.enabled;
  if ('name' in patch) allowed.name = String(patch.name).trim();
  if ('rss_url' in patch) allowed.rss_url = String(patch.rss_url).trim();
  if ('default_category' in patch) {
    allowed.default_category = patch.default_category ? Number(patch.default_category) : null;
  }
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
