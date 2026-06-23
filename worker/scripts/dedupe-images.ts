// Чистит дубликаты картинок внутри body_html: убирает второй и далее <figure>
// с той же (с точностью до размеров) картинкой. Также убирает из тела фото,
// которое уже стоит обложкой (article.image_url).
//
// Запуск: npm run worker:dedupe-images
//         npm run worker:dedupe-images -- --all

import { config } from 'dotenv';
config({ path: '.env.local' });

import { sb, isMock } from '../../lib/db';
import { sanitizeHtml } from '../../lib/sanitize';
import { normalizeImageUrl } from '../../lib/article-images';

const ALL = process.argv.includes('--all');

function dedupeFigures(html: string, heroUrl: string | null): { out: string; removed: number } {
  const seen = new Set<string>();
  if (heroUrl) seen.add(normalizeImageUrl(heroUrl));

  let removed = 0;
  const out = html.replace(/<figure\b[\s\S]*?<\/figure>/gi, (block) => {
    const srcMatch = block.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (!srcMatch) return block;
    const key = normalizeImageUrl(srcMatch[1]);
    if (seen.has(key)) {
      removed++;
      return '';
    }
    seen.add(key);
    return block;
  });
  return { out, removed };
}

async function main() {
  if (isMock) { console.log('mock-mode'); return; }

  let q = sb()
    .from('articles')
    .select('id, image_url, body_html, title')
    .like('body_html', '%<figure>%');
  if (!ALL) q = q.in('status', ['published', 'pending_review']);

  const { data, error } = await q;
  if (error) throw error;
  const rows = (data ?? []) as { id: number; image_url: string | null; body_html: string; title: string | null }[];
  console.log(`Кандидатов с figure: ${rows.length}`);

  let changed = 0, totalRemoved = 0;
  for (const a of rows) {
    const { out, removed } = dedupeFigures(a.body_html, a.image_url);
    if (removed === 0) continue;
    const safe = sanitizeHtml(out);
    const { error: upErr } = await sb()
      .from('articles')
      .update({ body_html: safe })
      .eq('id', a.id);
    if (upErr) { console.error(`#${a.id}: ${upErr.message}`); continue; }
    changed++;
    totalRemoved += removed;
    process.stdout.write('✓');
  }
  console.log(`\nГотово. Статей подправлено: ${changed}, дублей убрано: ${totalRemoved}.`);
}

main().catch(e => { console.error(e); process.exit(1); });
