import { NextRequest, NextResponse } from 'next/server';
import { getById, setStatus, log } from '@/lib/db';
import { postToChannel, tgEnabled } from '@/lib/telegram';
import { revalidatePath } from 'next/cache';

export async function POST(req: NextRequest) {
  const { id, approve, category_id } = await req.json();
  const a = await getById(Number(id));
  if (!a) return NextResponse.json({ error: 'not found' }, { status: 404 });

  if (!approve) {
    await setStatus(a.id, 'rejected_by_editor', { category_id });
    await log(a.id, 'review', true, 'rejected by editor');
    return NextResponse.json({ ok: true, message: 'Отклонено. Повторно не появится' });
  }

  await setStatus(a.id, 'published', {
    category_id,
    published_at: new Date().toISOString()
  });
  await log(a.id, 'review', true, 'published');
  revalidatePath('/');
  if (a.slug) revalidatePath(`/article/${a.slug}`);
  revalidatePath('/sitemap.xml');

  let message = 'Опубликовано на сайте';
  if (tgEnabled()) {
    try {
      const url = `${process.env.SITE_URL ?? ''}/article/${a.slug}`;
      const msgId = await postToChannel({
        title: a.title ?? a.raw_title,
        excerpt: a.tg_excerpt ?? '',
        articleUrl: url,
        imageUrl: a.image_url
      });
      if (msgId) await setStatus(a.id, 'published', { tg_message_id: msgId } as any);
      message = 'Опубликовано на сайте и отправлено в Telegram-канал';
    } catch (e: any) {
      await log(a.id, 'telegram', false, e.message);
      message = 'Опубликовано на сайте, но Telegram вернул ошибку — смотри pipeline_log';
    }
  }
  return NextResponse.json({ ok: true, message });
}
