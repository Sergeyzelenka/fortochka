// Подгружает фото из локальной папки в Supabase Storage и вставляет их
// в body_html указанной статьи. Имя файла используется для подписи: если
// в нём есть фрагмент «by-Имя-Фамилия», подпишем «Фото: Имя Фамилия».
//
// Запуск: npx tsx --env-file=.env.local worker/scripts/enrich-from-folder.ts <id> <folder> [sourceName]
//   sourceName — текст для подписи фото без явного автора (по умолчанию из article.source_name)

import { config } from 'dotenv';
config({ path: '.env.local' });

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { getById, updateArticle, sbService, log, isMock } from '../../lib/db';
import { sanitizeHtml } from '../../lib/sanitize';
import { injectInlineImages } from '../../lib/article-images';

const BUCKET = 'covers';

function captionFromFilename(name: string, fallback: string, forceFallback: boolean): string {
  if (forceFallback) return `Фото: ${fallback}`;
  const base = name.replace(/\.[a-z0-9]+$/i, '');
  const byMatch = base.match(/by[-_]([A-Za-z]+[-_][A-Za-z]+)/i);
  if (byMatch) {
    const author = byMatch[1].replace(/[-_]/g, ' ');
    return `Фото: ${author}`;
  }
  return `Фото: ${fallback}`;
}

async function ensureBucket() {
  const sb = sbService();
  const { data } = await sb.storage.listBuckets();
  if (!data?.find(b => b.name === BUCKET)) {
    const { error } = await sb.storage.createBucket(BUCKET, { public: true });
    if (error && !/exists/i.test(error.message)) throw error;
  }
}

async function uploadFile(filePath: string, articleId: number): Promise<string> {
  const name = path.basename(filePath);
  const buf = readFileSync(filePath);
  const sb = sbService();
  const key = `manual/${articleId}/${Date.now()}-${name}`;
  const { error } = await sb.storage.from(BUCKET).upload(key, buf, {
    contentType: name.endsWith('.png') ? 'image/png' : 'image/jpeg',
    upsert: true
  });
  if (error) throw new Error(`upload ${name}: ${error.message}`);
  const { data } = sb.storage.from(BUCKET).getPublicUrl(key);
  return data.publicUrl;
}

async function main() {
  if (isMock) { console.log('mock-mode'); return; }
  const id = Number(process.argv[2]);
  const folder = process.argv[3];
  const sourceOverride = process.argv[4];
  if (!id || !folder) {
    console.error('usage: tsx worker/scripts/enrich-from-folder.ts <id> <folder> [sourceName]');
    process.exit(1);
  }

  const a = await getById(id);
  if (!a) { console.error(`article #${id} not found`); process.exit(1); }
  if (!a.body_html) { console.error('article has no body_html'); process.exit(1); }

  const files = readdirSync(folder).filter(f => /\.(jpe?g|png|webp)$/i.test(f)).sort();
  if (files.length === 0) { console.log('no images in folder'); return; }

  console.log(`Обогащаю #${id}: ${a.title?.slice(0, 80) ?? a.raw_title}`);
  console.log(`  Файлов в папке: ${files.length}`);

  await ensureBucket();

  const sourceName = sourceOverride ?? a.source_name;
  const forceOverride = !!sourceOverride;
  const images: { src: string; alt: string; caption: string | null }[] = [];
  for (const f of files) {
    const full = path.join(folder, f);
    const url = await uploadFile(full, id);
    const caption = captionFromFilename(f, sourceName, forceOverride);
    console.log(`  ↑ ${f}\n     ${caption}`);
    images.push({ src: url, alt: caption, caption });
  }

  // Уберём прошлые figure (на случай повторного запуска)
  const baseBody = a.body_html.replace(/<figure>[\s\S]*?<\/figure>/g, '');
  const withImages = injectInlineImages(baseBody, images);
  const safeBody = sanitizeHtml(withImages);
  const figCount = (safeBody.match(/<figure>/g) ?? []).length;

  await updateArticle(a.id, { body_html: safeBody });
  await log(a.id, 'enrich', true, `manual-folder:${images.length}`);

  console.log(`\nГотово. В тело статьи вставлено ${figCount} figure.`);
  console.log('Для мгновенного эффекта на сайте — перезапусти npm run dev либо подожди ISR (≤10 мин).');
}

main().catch(e => { console.error(e); process.exit(1); });
