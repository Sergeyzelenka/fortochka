import { NextRequest, NextResponse } from 'next/server';
import { getById, updateArticle, log, isMock } from '@/lib/db';
import { uploadManualCover } from '@/lib/illustrate';

export const maxDuration = 30;

const MAX_BYTES = 8 * 1024 * 1024; // 8 МБ
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

  const id = Number(form.get('id'));
  const file = form.get('file');
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: 'invalid id' }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file missing' }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: 'empty file' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: `файл больше ${Math.round(MAX_BYTES / 1024 / 1024)} МБ` }, { status: 400 });
  }
  const ext = ALLOWED[file.type];
  if (!ext) {
    return NextResponse.json({ error: `тип ${file.type} не поддерживается` }, { status: 400 });
  }

  const a = await getById(id);
  if (!a) return NextResponse.json({ error: 'not found' }, { status: 404 });

  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const url = await uploadManualCover(a.id, buf, file.type, ext);
    await updateArticle(a.id, { image_url: url, cover_svg: null });
    await log(a.id, 'edit', true, 'manual cover uploaded');
    return NextResponse.json({ ok: true, image_url: url });
  } catch (e: any) {
    await log(a.id, 'edit', false, `upload cover: ${e.message}`);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
