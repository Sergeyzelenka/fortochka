import { NextRequest, NextResponse } from 'next/server';
import { getById, updateArticle, log, isMock } from '@/lib/db';
import { sanitizeHtml } from '@/lib/sanitize';

export const maxDuration = 20;

const TITLE_MAX = 200;
const DEK_MAX = 400;
const TG_MAX = 700;
const BODY_MAX = 50000;

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (isMock) return NextResponse.json({ error: 'mock-mode' }, { status: 400 });

  const id = Number(body.id);
  const patch = body.patch ?? {};
  const a = await getById(id);
  if (!a) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const safePatch: any = {};
  if (typeof patch.title === 'string') {
    safePatch.title = patch.title.trim().slice(0, TITLE_MAX);
  }
  if (typeof patch.dek === 'string') {
    safePatch.dek = patch.dek.trim().slice(0, DEK_MAX);
  }
  if (typeof patch.tg_excerpt === 'string') {
    safePatch.tg_excerpt = patch.tg_excerpt.trim().slice(0, TG_MAX);
  }
  if (typeof patch.body_html === 'string') {
    safePatch.body_html = sanitizeHtml(patch.body_html.slice(0, BODY_MAX));
  }
  if (typeof patch.reading_minutes === 'number') {
    safePatch.reading_minutes = Math.max(1, Math.min(60, Math.round(patch.reading_minutes)));
  }
  if (typeof patch.image_url === 'string') {
    const url = patch.image_url.trim();
    if (url === '') {
      safePatch.image_url = null;
    } else if (/^https?:\/\//i.test(url)) {
      safePatch.image_url = url.slice(0, 1000);
      // Если ставим обложку вручную — снимаем SVG-плашку, чтобы не показывалась.
      safePatch.cover_svg = null;
    } else {
      return NextResponse.json({ error: 'image_url должен начинаться с http(s)://' }, { status: 400 });
    }
  }
  if (Object.keys(safePatch).length === 0) {
    return NextResponse.json({ error: 'empty patch' }, { status: 400 });
  }

  await updateArticle(a.id, safePatch);
  await log(a.id, 'edit', true, Object.keys(safePatch).join(','));
  return NextResponse.json({ ok: true, patch: safePatch });
}
