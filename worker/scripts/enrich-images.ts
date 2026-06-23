// Добавить инлайн-фото в УЖЕ написанную статью, без обращения к LLM.
// Запуск: npx tsx --env-file=.env.local worker/scripts/enrich-images.ts <id>

import { config } from 'dotenv';
config({ path: '.env.local' });

import { getById, updateArticle, log, isMock } from '../../lib/db';
import { sanitizeHtml } from '../../lib/sanitize';
import { fetchInlineImages, injectInlineImages } from '../../lib/article-images';

async function main() {
  if (isMock) { console.log('mock-mode'); return; }
  const id = Number(process.argv[2]);
  if (!id) { console.error('usage: tsx worker/scripts/enrich-images.ts <id>'); process.exit(1); }

  const a = await getById(id);
  if (!a) { console.error(`article #${id} not found`); process.exit(1); }
  if (!a.body_html) { console.error(`article #${id} has no body_html`); process.exit(1); }

  console.log(`Обогащаю #${id}: ${(a.title ?? a.raw_title).slice(0, 80)}`);
  console.log(`  Источник: ${a.source_url}`);

  const inlineImages = await fetchInlineImages(a.source_url, 3);
  console.log(`  Подтянуто фото: ${inlineImages.length}`);
  for (const im of inlineImages) console.log('    -', im.src);

  if (inlineImages.length === 0) { console.log('Нечего вставлять, выходим.'); return; }

  // Сначала вырезаем уже существующие figure (если запускается повторно)
  const baseBody = a.body_html.replace(/<figure>[\s\S]*?<\/figure>/g, '');
  const bodyWithImages = injectInlineImages(baseBody, inlineImages);
  const safeBody = sanitizeHtml(bodyWithImages);
  const figCount = (safeBody.match(/<figure>/g) ?? []).length;
  console.log(`  После санитизации figure: ${figCount}, длина: ${safeBody.length}`);

  await updateArticle(a.id, { body_html: safeBody });
  await log(a.id, 'enrich', true, `images:${inlineImages.length}`);
  console.log('Готово. Сайт обновит ленту в следующий цикл ISR (≤10 мин).');
}

main().catch(e => { console.error(e); process.exit(1); });
