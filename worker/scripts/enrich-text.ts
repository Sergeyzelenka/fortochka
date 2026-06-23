// Догружает полный текст для существующих статей в БД, у которых сейчас
// в raw_text короткий RSS-тизер. Берёт статус 'found' или 'filtered' и
// статьи с raw_text короче 1000 символов.
//
// Запуск: npm run worker:enrich-text
//         npm run worker:enrich-text -- --all   # включая опубликованные

import { config } from 'dotenv';
config({ path: '.env.local' });

import { sb, isMock } from '../../lib/db';
import { extractArticleText } from '../../lib/article-extract';

const ALL = process.argv.includes('--all');
const MIN_RSS_LEN_TO_SKIP = 2000; // если уже длинно — не трогаем
const CONCURRENCY = 3;
const PAUSE_MS = 800;

async function main() {
  if (isMock) { console.log('mock-mode'); return; }

  let q = sb()
    .from('articles')
    .select('id, source_url, source_name, raw_text, status')
    .or(`raw_text.is.null,raw_text.lt.${MIN_RSS_LEN_TO_SKIP}`);
  if (!ALL) q = q.in('status', ['found', 'filtered']);

  const { data, error } = await q.order('id', { ascending: true });
  if (error) throw error;
  const rows = (data ?? []) as { id: number; source_url: string; source_name: string; raw_text: string | null }[];

  console.log(`Кандидатов на дотягивание: ${rows.length}${ALL ? ' (все статусы)' : ' (found + filtered)'}`);
  if (rows.length === 0) return;

  let improved = 0, skipped = 0, failed = 0;

  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const batch = rows.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(async (row) => {
      const oldLen = row.raw_text?.length ?? 0;
      const full = await extractArticleText(row.source_url);
      if (!full) { failed++; process.stdout.write('·'); return; }
      if (full.text.length < oldLen * 1.5) { skipped++; process.stdout.write('-'); return; }
      const { error: upErr } = await sb()
        .from('articles')
        .update({ raw_text: full.text.slice(0, 20000) })
        .eq('id', row.id);
      if (upErr) { failed++; console.error(`\n#${row.id}: ${upErr.message}`); return; }
      improved++;
      process.stdout.write(full.text.length > 5000 ? '★' : '✓');
    }));
    await new Promise(r => setTimeout(r, PAUSE_MS));
  }
  console.log(`\nГотово. Улучшено: ${improved}, пропущено: ${skipped}, ошибок: ${failed}.`);
}

main().catch(e => { console.error(e); process.exit(1); });
