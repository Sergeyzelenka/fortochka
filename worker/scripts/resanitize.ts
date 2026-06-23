// Одноразовая миграция: проходит по статьям с непустым body_html и переписывает
// его через текущий sanitizeHtml. Безопасно запускать многократно — повторная
// санитизация уже чистого HTML даёт тот же результат.
// Запуск: npm run worker:resanitize

import { config } from 'dotenv';
config({ path: '.env.local' });

import { sb, isMock } from '../../lib/db';
import { sanitizeHtml } from '../../lib/sanitize';

async function main() {
  if (isMock) {
    console.log('⚠ Мок-режим: Supabase не настроен, миграции делать не на чем.');
    return;
  }
  const PAGE = 200;
  let from = 0;
  let scanned = 0;
  let updated = 0;

  while (true) {
    const { data, error } = await sb()
      .from('articles')
      .select('id, body_html')
      .not('body_html', 'is', null)
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const rows = data ?? [];
    if (rows.length === 0) break;

    for (const row of rows as { id: number; body_html: string }[]) {
      scanned++;
      const cleaned = sanitizeHtml(row.body_html);
      if (cleaned !== row.body_html) {
        const { error: upErr } = await sb()
          .from('articles')
          .update({ body_html: cleaned })
          .eq('id', row.id);
        if (upErr) {
          console.error(`#${row.id}: ${upErr.message}`);
        } else {
          updated++;
        }
      }
    }
    from += rows.length;
  }
  console.log(`Просмотрено: ${scanned}, переписано: ${updated}.`);
}

main().catch(e => { console.error(e); process.exit(1); });
