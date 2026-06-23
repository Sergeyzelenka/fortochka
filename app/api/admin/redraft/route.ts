import { NextRequest, NextResponse } from 'next/server';
import { getById, updateArticle, log, isMock } from '@/lib/db';
import { draftArticle, draftArticleGemini } from '@/lib/llm';
import { sanitizeHtml } from '@/lib/sanitize';
import { fetchInlineImages, injectInlineImages, describeImagesForLlm, replaceImageMarkers } from '@/lib/article-images';
import { fetchOgImage } from '@/lib/og';
import { isImageAlive } from '@/lib/image-check';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (isMock) return NextResponse.json({ error: 'mock-mode' }, { status: 400 });

  const id = Number(body.id);
  const model: 'groq' | 'gemini' = body.model === 'gemini' ? 'gemini' : 'groq';
  const a = await getById(id);
  if (!a) return NextResponse.json({ error: 'not found' }, { status: 404 });

  try {
    const writer = model === 'gemini' ? draftArticleGemini : draftArticle;
    // Дотягиваем встроенные фото из исходника ДО LLM, чтобы передать ей alt/caption.
    const exclude = [a.image_url, a.raw_image_url].filter((u): u is string => !!u);
    const inlineImages = await fetchInlineImages(a.source_url, 3, exclude);
    let coverUrl: string | null = a.image_url ?? null;
    let inlineForBody = inlineImages;
    if (!coverUrl && inlineImages.length > 0) {
      coverUrl = inlineImages[0].src;
      inlineForBody = inlineImages.slice(1);
    } else if (coverUrl && inlineImages.length > 0) {
      // Обложка уже есть (вручную или из RSS) — первое фото со страницы
      // почти всегда тот же hero, не даём ему попасть в тело.
      inlineForBody = inlineImages.slice(1);
    }
    // Фоллбек: если обложки всё ещё нет — пробуем og:image со страницы.
    if (!coverUrl) {
      const og = await fetchOgImage(a.source_url);
      if (og && await isImageAlive(og)) coverUrl = og;
    }
    const imagesContext = describeImagesForLlm(inlineForBody);
    const d = await writer(a.raw_title, a.raw_text ?? '', a.source_name, a.category_id, imagesContext);
    const { html: htmlWithMarkers, usedCount } = replaceImageMarkers(d.body_html, inlineForBody);
    const bodyWithImages = usedCount > 0
      ? htmlWithMarkers
      : injectInlineImages(d.body_html, inlineForBody.slice(0, 2));
    const safeBody = sanitizeHtml(bodyWithImages);
    const patch: any = {
      title: d.title,
      dek: d.dek,
      body_html: safeBody,
      tg_excerpt: d.tg_excerpt,
      reading_minutes: d.reading_minutes,
      draft_model: model
    };
    if (coverUrl && coverUrl !== a.image_url) patch.image_url = coverUrl;
    await updateArticle(a.id, patch);
    await log(a.id, 'draft', true, `redraft:${model}`);
    return NextResponse.json({
      ok: true,
      model,
      article: {
        title: d.title,
        dek: d.dek,
        body_html: safeBody,
        tg_excerpt: d.tg_excerpt,
        reading_minutes: d.reading_minutes,
        draft_model: model
      }
    });
  } catch (e: any) {
    await log(a.id, 'draft', false, `redraft:${model} ${e.message}`);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
