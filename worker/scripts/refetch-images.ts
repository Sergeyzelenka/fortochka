// Одноразовая миграция: для статей без image_url пробуем достать og:image
// со страницы источника. По умолчанию — только опубликованные.
// Запуск: npm run worker:refetch-images
//         npm run worker:refetch-images -- --all   # для всех статусов

import { config } from 'dotenv';
config({ path: '.env.local' });

import { sb, isMock } from '../../lib/db';
import { fetchOgImage } from '../../lib/og';

const ALL = process.argv.includes('--all');
const CONCURRENCY = 4;
const PAUSE_MS = 300;

async function main() {
  if (isMock) {
    console.log('⚠ Мок-режим: Supabase не настроен.');
    return;
  }

  let q = sb()
    .from('articles')
    .select('id, source_url, source_name')
    .is('image_url', null);
  if (!ALL) q = q.eq('status', 'published');

  const { data, error } = await q.order('id', { ascending: true });
  if (error) throw error;
  const rows = (data ?? []) as { id: number; source_url: string; source_name: string }[];

  console.log(`Кандидатов без картинки: ${rows.length}${ALL ? ' (все статусы)' : ' (только published)'}`);
  if (rows.length === 0) return;

  let found = 0;
  let scanned = 0;

  // Простая «пачка по 4 параллельно»
  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const batch = rows.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(async (row) => {
      scanned++;
      const img = await fetchOgImage(row.source_url);
      if (!img) {
        process.stdout.write('·');
        return;
      }
      const { error: upErr } = await sb()
        .from('articles')
        .update({ image_url: img })
        .eq('id', row.id);
      if (upErr) {
        console.error(`\n#${row.id} (${row.source_name}): ${upErr.message}`);
      } else {
        found++;
        process.stdout.write('✓');
      }
    }));
    await new Promise(r => setTimeout(r, PAUSE_MS));
  }

  console.log(`\nГотово. Просмотрено: ${scanned}, найдено картинок: ${found}.`);
  if (found > 0) {
    console.log('Сайт обновит ленту в следующий цикл ISR (≤5 мин). Можно перезапустить npm run dev для мгновенного эффекта.');
  }
}

main().catch(e => { console.error(e); process.exit(1); });
