// Универсальная загрузка картинки админом (например, для вставки в тело статьи).
// Возвращает только публичный URL, БД не трогает.
import { NextRequest, NextResponse } from 'next/server';
import { isMock } from '@/lib/db';
import { uploadManualCover } from '@/lib/illustrate';

export const maxDuration = 30;

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif'
};

export async function POST(req: NextRequest) {
  if (isMock) return NextResponse.json({ error: 'mock-mode' }, { status: 400 });

  let form: FormData;
  try { form = await req.formData(); }
  catch { return NextResponse.json({ error: 'expected multipart/form-data' }, { status: 400 }); }

  const articleId = Number(form.get('articleId') ?? 0);
  const file = form.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'file missing' }, { status: 400 });
  if (file.size === 0) return NextResponse.json({ error: 'empty file' }, { status: 400 });
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: `файл больше ${Math.round(MAX_BYTES / 1024 / 1024)} МБ` }, { status: 400 });
  }
  const ext = ALLOWED[file.type];
  if (!ext) return NextResponse.json({ error: `тип ${file.type} не поддерживается` }, { status: 400 });

  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const url = await uploadManualCover(articleId || 0, buf, file.type, ext);
    return NextResponse.json({ ok: true, url });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
