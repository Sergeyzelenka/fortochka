// Одноразовая чистка: удаляет утёкшие в body_html описательные хвосты вида
//   alt="..." caption="..."
// которые LLM скопировала из блока «Доступные изображения». Маркеры [IMG:N]
// тоже сносим — если они почему-то остались.
// Запуск: npx tsx --env-file=.env.local worker/scripts/strip-img-meta.ts
//   или с фильтром по slug: ... strip-img-meta.ts horoshaya-istoriya-17-iyunya-99

import { config } from 'dotenv';
config({ path: '.env.local' });

import { sb, isMock } from '../../lib/db';

const TAIL = /\s*(?:alt|caption)\s*=\s*["'][^"']*["']/gi;
const MARKER_WITH_TAIL = /\[IMG:\d+\](?:\s*(?:alt|caption)\s*=\s*["'][^"']*["'])*/gi;

function clean(html: string): string {
  let out = html.replace(MARKER_WITH_TAIL, '');
  // На случай если хвост остался без маркера (маркер уже превратился в <figure>).
  out = out.replace(TAIL, '');
  // Пустые параграфы после чистки.
  out = out.replace(/<p>\s*<\/p>/gi, '');
  return out;
}

async function main() {
  if (isMock) { console.log('mock mode'); return; }
  const slug = process.argv[2];
  let q = sb().from('articles').select('id, slug, body_html').not('body_html', 'is', null);
  if (slug) q = q.eq('slug', slug);
  const { data, error } = await q;
  if (error) throw error;
  const rows = data ?? [];
  let updated = 0;
  for (const r of rows as any[]) {
    const fixed = clean(r.body_html);
    if (fixed !== r.body_html) {
      const { error: upErr } = await sb().from('articles')
        .update({ body_html: fixed, updated_at: new Date().toISOString() })
        .eq('id', r.id);
      if (upErr) { console.error(r.id, upErr.message); continue; }
      updated++;
      console.log(`✓ #${r.id} ${r.slug}`);
    }
  }
  console.log(`scanned: ${rows.length}, updated: ${updated}`);
}

main().catch(e => { console.error(e); process.exit(1); });
