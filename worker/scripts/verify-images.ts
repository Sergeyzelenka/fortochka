// Одноразовая чистка: проходит по статьям с непустым image_url,
// проверяет HEAD/GET, мёртвые ссылки обнуляет и подставляет SVG-обложку,
// если её ещё нет.
//
// По умолчанию — только опубликованные. Для всех:
//   npm run worker:verify-images -- --all

import { config } from 'dotenv';
config({ path: '.env.local' });

import { sb, isMock } from '../../lib/db';
import { isImageAlive } from '../../lib/image-check';
import { coverSvg } from '../../lib/cover';

const ALL = process.argv.includes('--all');
const CONCURRENCY = 6;
const PAUSE_MS = 200;

async function main() {
  if (isMock) {
    console.log('⚠ Мок-режим: Supabase не настроен.');
    return;
  }

  let q = sb()
    .from('articles')
    .select('id, image_url, cover_svg, title, raw_title, category_id')
    .not('image_url', 'is', null);
  if (!ALL) q = q.eq('status', 'published');

  const { data, error } = await q.order('id', { ascending: true });
  if (error) throw error;
  const rows = (data ?? []) as any[];

  console.log(`Проверяю ${rows.length} статей с картинкой${ALL ? ' (все статусы)' : ' (только published)'}...`);

  let alive = 0, dead = 0;

  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const batch = rows.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(async (row) => {
      const ok = await isImageAlive(row.image_url);
      if (ok) {
        alive++;
        process.stdout.write('✓');
        return;
      }
      dead++;
      const patch: any = { image_url: null };
      if (!row.cover_svg) {
        patch.cover_svg = coverSvg(row.title ?? row.raw_title, row.category_id);
      }
      const { error: upErr } = await sb()
        .from('articles')
        .update(patch)
        .eq('id', row.id);
      if (upErr) {
        console.error(`\n#${row.id}: ${upErr.message}`);
      } else {
        process.stdout.write('✕');
      }
    }));
    await new Promise(r => setTimeout(r, PAUSE_MS));
  }

  console.log(`\nГотово. Живых: ${alive}, починено: ${dead}.`);
  if (dead > 0) {
    console.log('Лента обновится в следующий цикл ISR (≤5 мин), либо перезапусти npm run dev для мгновенного эффекта.');
  }
}

main().catch(e => { console.error(e); process.exit(1); });
