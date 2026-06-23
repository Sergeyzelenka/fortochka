// Снимает <figure> из тела одной статьи: по indeх'у или по совпадению src.
// Запуск: tsx --env-file=.env.local worker/scripts/clean-article.ts <id> --src-contains=<substr>
import { config } from 'dotenv';
config({ path: '.env.local' });

import { sb, isMock } from '../../lib/db';
import { listBodyFigures, removeFigureAt } from '../../lib/article-images';

async function main() {
  if (isMock) { console.log('mock'); return; }
  const id = Number(process.argv[2]);
  const srcContains = process.argv.find(a => a.startsWith('--src-contains='))?.split('=')[1];
  if (!id) { console.error('передай id статьи'); process.exit(1); }
  const { data, error } = await sb().from('articles').select('id, body_html').eq('id', id).single();
  if (error || !data) throw error ?? new Error('not found');
  const before = data.body_html ?? '';
  const figs = listBodyFigures(before);
  console.log(`figures in body: ${figs.length}`);
  let html = before;
  const toRemove = figs.filter(f => srcContains ? f.src.includes(srcContains) : false);
  if (!toRemove.length) {
    console.log('ничего не подошло под фильтр');
    return;
  }
  // Удаляем с конца, чтобы индексы не сместились.
  for (const f of toRemove.sort((a, b) => b.index - a.index)) {
    console.log(`удаляю figure #${f.index}: ${f.src}`);
    html = removeFigureAt(html, f.index);
  }
  await sb().from('articles').update({ body_html: html, updated_at: new Date().toISOString() }).eq('id', id);
  console.log('ok');
}

main().catch(e => { console.error(e); process.exit(1); });
