// Точечное переписывание одной статьи: то же, что endpoint /api/admin/redraft,
// но запускается локально tsx-ом, минуя кеш Next dev.
// Запуск: npm run worker:redraft-one -- <id> [groq|gemini]

import { config } from 'dotenv';
config({ path: '.env.local' });

import { getById, updateArticle, log, isMock } from '../../lib/db';
import { draftArticle, draftArticleGemini } from '../../lib/llm';
import { sanitizeHtml } from '../../lib/sanitize';
import { fetchInlineImages, injectInlineImages } from '../../lib/article-images';

async function main() {
  if (isMock) { console.log('mock-mode'); return; }
  const id = Number(process.argv[2]);
  const model = (process.argv[3] === 'gemini' ? 'gemini' : 'groq') as 'groq' | 'gemini';
  if (!id) { console.error('usage: tsx worker/scripts/redraft-one.ts <id> [groq|gemini]'); process.exit(1); }

  const a = await getById(id);
  if (!a) { console.error(`article #${id} not found`); process.exit(1); }
  console.log(`Перезапись #${id} через ${model}: ${a.raw_title.slice(0, 80)}`);

  const writer = model === 'gemini' ? draftArticleGemini : draftArticle;
  const d = await writer(a.raw_title, a.raw_text ?? '', a.source_name);
  console.log(`  Получен черновик: ${d.title}`);

  const inlineImages = await fetchInlineImages(a.source_url, 2);
  console.log(`  Подтянуто фото: ${inlineImages.length}`);
  for (const im of inlineImages) console.log('    -', im.src);

  const bodyWithImages = injectInlineImages(d.body_html, inlineImages);
  const safeBody = sanitizeHtml(bodyWithImages);
  const figCount = (safeBody.match(/<figure>/g) ?? []).length;
  console.log(`  После санитизации figure: ${figCount}, длина: ${safeBody.length}`);

  await updateArticle(a.id, {
    title: d.title,
    dek: d.dek,
    body_html: safeBody,
    tg_excerpt: d.tg_excerpt,
    reading_minutes: d.reading_minutes,
    draft_model: model
  });
  await log(a.id, 'draft', true, `redraft-script:${model}`);
  console.log('Готово.');
}

main().catch(e => { console.error(e); process.exit(1); });
