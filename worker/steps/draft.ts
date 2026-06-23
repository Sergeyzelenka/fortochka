// Шаг 3. Редактор: filtered → drafted → pending_review.
// Gemini пишет русскую статью + TG-анонс, генерируем slug и обложку.
import { sb, isMock, setStatus, log } from '../../lib/db';
import { draftArticle, draftArticleGemini } from '../../lib/llm';
import { notifyAdmin } from '../../lib/telegram';
import { coverSvg } from '../../lib/cover';
import { sanitizeHtml } from '../../lib/sanitize';
import { isImageAlive } from '../../lib/image-check';
import { fetchInlineImages, injectInlineImages, describeImagesForLlm, replaceImageMarkers } from '../../lib/article-images';
import { fetchOgImage } from '../../lib/og';
import { findDuplicate, type DupeCandidate } from '../../lib/dedupe';
import { Article } from '../../lib/types';

const MAX_ERRORS = 3;
const BATCH = 5;
const PAUSE_MS = 2000;

const translit: Record<string, string> = {
  а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',
  н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'ts',ч:'ch',ш:'sh',щ:'sch',
  ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya'
};

export function slugify(title: string, id: number): string {
  const s = title.toLowerCase()
    .split('').map(ch => translit[ch] ?? ch).join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${s || 'news'}-${id}`;
}

export type DraftModel = 'groq' | 'gemini';

export async function draftStep(model: DraftModel = 'groq', categoryId?: number) {
  if (isMock) {
    console.log('draft: пропущен (мок-режим)');
    return;
  }
  const writer = model === 'gemini' ? draftArticleGemini : draftArticle;
  let q = sb()
    .from('articles').select('*')
    .eq('status', 'filtered')
    .lt('error_count', MAX_ERRORS);
  if (categoryId) q = q.eq('category_id', categoryId);
  const { data, error } = await q
    .order('score', { ascending: false })
    .limit(BATCH);
  if (error) throw error;

  // Кандидаты для дедупа — опубликованные и ждущие апрува за последние 7 дней.
  // Запрашиваем один раз перед циклом, чтобы не дёргать БД на каждой статье.
  const sevenAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const { data: dupeData } = await sb()
    .from('articles').select('id, title, dek')
    .in('status', ['published', 'pending_review'])
    .gt('created_at', sevenAgo)
    .not('title', 'is', null);
  const dupeCandidates = (dupeData ?? []) as DupeCandidate[];

  let done = 0;
  for (const a of (data as Article[]) ?? []) {
    try {
      // Сначала тянем фото из исходной страницы, чтобы дать LLM контекст: alt/caption.
      // Тогда модель может расставить маркеры [IMG:N] в осмысленных местах.
      const photoOk = a.raw_image_url ? await isImageAlive(a.raw_image_url) : false;
      const exclude = a.raw_image_url ? [a.raw_image_url] : [];
      const inlineImages = await fetchInlineImages(a.source_url, 3, exclude);
      // Если обложки источника нет — первое инлайн-фото пойдёт в обложку, в тело не подаём.
      // Если обложка ЕСТЬ (raw_image_url) — всё равно отбрасываем первое со страницы:
      // hero-фото на странице обычно идентично обложке из RSS, просто другой URL/размер.
      let coverUrl: string | null = photoOk ? a.raw_image_url : null;
      let inlineForBody = inlineImages;
      if (!coverUrl && inlineImages.length > 0) {
        coverUrl = inlineImages[0].src;
        inlineForBody = inlineImages.slice(1);
      } else if (coverUrl && inlineImages.length > 0) {
        inlineForBody = inlineImages.slice(1);
      }
      // Фоллбек: если ни raw_image_url, ни инлайн-фото не дали обложку —
      // тянем og:image со страницы (twitter:image как запасной).
      if (!coverUrl) {
        const og = await fetchOgImage(a.source_url);
        if (og && await isImageAlive(og)) coverUrl = og;
      }
      const imagesContext = describeImagesForLlm(inlineForBody);

      const d = await writer(a.raw_title, a.raw_text ?? '', a.source_name, a.category_id, imagesContext);

      // Проверяем близость к уже существующим статьям. Если очень похоже —
      // отбрасываем как дубликат сюжета.
      const dup = findDuplicate(d.title, d.dek ?? '', dupeCandidates);
      if (dup) {
        await setStatus(a.id, 'rejected_by_ai', {
          ai_reason: `дубликат сюжета: близок к #${dup.id} «${dup.candidateTitle.slice(0, 60)}» (${Math.round(dup.similarity * 100)}%)`,
          score: a.score
        });
        await log(a.id, 'draft', false, `duplicate of #${dup.id} (${Math.round(dup.similarity * 100)}%)`);
        await new Promise(r => setTimeout(r, PAUSE_MS));
        continue;
      }
      // Подставляем фото по маркерам [IMG:N], которые LLM расставил по смыслу.
      // Если модель ни одного маркера не использовала — фоллбек на старую слепую вставку.
      const { html: htmlWithMarkers, usedCount } = replaceImageMarkers(d.body_html, inlineForBody);
      const bodyWithImages = usedCount > 0
        ? htmlWithMarkers
        : injectInlineImages(d.body_html, inlineForBody.slice(0, 2));
      await setStatus(a.id, 'pending_review', {
        title: d.title,
        dek: d.dek,
        body_html: sanitizeHtml(bodyWithImages),
        tg_excerpt: d.tg_excerpt,
        reading_minutes: d.reading_minutes,
        slug: slugify(d.title, a.id),
        image_url: coverUrl,
        cover_svg: coverUrl ? null : coverSvg(d.title, a.category_id),
        draft_model: model,
        tags: Array.isArray(d.tags) ? d.tags.slice(0, 8).map(t => String(t).toLowerCase().trim()).filter(Boolean) : null
      });
      await log(a.id, 'draft', true, model);
      // Только что переписанная статья тоже становится кандидатом для последующих в этой пачке
      dupeCandidates.push({ id: a.id, title: d.title, dek: d.dek ?? null });
      done++;
    } catch (e: any) {
      const count = a.error_count + 1;
      const fatal = count >= MAX_ERRORS;
      await setStatus(a.id, fatal ? 'error' : 'filtered', {
        error_count: count,
        last_error: String(e.message).slice(0, 500)
      });
      await log(a.id, 'draft', false, e.message);
    }
    await new Promise(r => setTimeout(r, PAUSE_MS));
  }
  if (done > 0) await notifyAdmin(`ФОРТОЧКА: ${done} новых материалов ждут апрува в админке`);
  console.log(`draft: подготовлено ${done}`);
}
