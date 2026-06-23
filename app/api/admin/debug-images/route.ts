import { NextRequest, NextResponse } from 'next/server';
import { fetchInlineImages } from '@/lib/article-images';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const target = url.searchParams.get('url') ?? '';
  if (!target) return NextResponse.json({ error: 'url required' }, { status: 400 });
  try {
    const r = await fetch(target, { headers: { 'user-agent': 'Mozilla/5.0 FortochkaImages/1.0' } });
    const html = (await r.text());
    const allImgs = (html.match(/<img[^>]+>/gi) ?? []).length;
    const result = await fetchInlineImages(target, 5);
    return NextResponse.json({ status: r.status, htmlLen: html.length, allImgs, found: result.length, images: result });
  } catch (e: any) {
    return NextResponse.json({ error: e.message });
  }
}
