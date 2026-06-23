import { NextRequest, NextResponse } from 'next/server';
import { getById, updateArticle, log, isMock } from '@/lib/db';
import { generateIllustrationPng, uploadCover } from '@/lib/illustrate';
import { CATEGORIES } from '@/lib/types';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (isMock) return NextResponse.json({ error: 'mock-mode' }, { status: 400 });

  const id = Number(body.id);
  const a = await getById(id);
  if (!a) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const catSlug = CATEGORIES.find(c => c.id === a.category_id)?.slug;

  try {
    const png = await generateIllustrationPng({
      title: a.title ?? a.raw_title,
      dek: a.dek,
      categorySlug: catSlug
    });
    const url = await uploadCover(a.id, png);
    await updateArticle(a.id, { image_url: url });
    await log(a.id, 'illustrate', true, `generated ${url}`);
    return NextResponse.json({ ok: true, url });
  } catch (e: any) {
    await log(a.id, 'illustrate', false, e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
