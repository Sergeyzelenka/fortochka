// Чистка существующих статей:
// 1) удаляет figure с мусорными изображениями (CTA, баннеры, подписки)
// 2) если у статьи нет image_url, но в теле есть figure — повышает первое
//    в обложку и убирает из тела (чтобы не дублировалось).
//
// Запуск: npm run worker:fix-figures
//         npm run worker:fix-figures -- --all

import { config } from 'dotenv';
config({ path: '.env.local' });

import { sb, isMock } from '../../lib/db';
import { sanitizeHtml } from '../../lib/sanitize';

const ALL = process.argv.includes('--all');

const JUNK_RX = /(newsletter|subscribe|signup|sign-up|cta[-_]|banner|popup|pop-up|promo[-_]|sponsor|paywall|donate|advertisement|sidebar|slider|widget-|placeholder|spacer|divider)/i;

function processBody(html: string, hasCover: boolean): { html: string; removedJunk: number; promotedSrc: string | null } {
  let removedJunk = 0;
  let promotedSrc: string | null = null;

  // 1) Чистим мусор по src и alt
  let out = html.replace(/<figure\b[\s\S]*?<\/figure>/gi, (block) => {
    const src = block.match(/src=["']([^"']+)["']/i)?.[1] ?? '';
    const alt = block.match(/alt=["']([^"']*)["']/i)?.[1] ?? '';
    const cap = block.match(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/i)?.[1]?.replace(/<[^>]+>/g, '') ?? '';
    if (JUNK_RX.test(src) || JUNK_RX.test(alt) || JUNK_RX.test(cap)) {
      removedJunk++;
      return '';
    }
    return block;
  });

  // 2) Если обложки нет — повышаем первое figure
  if (!hasCover) {
    const firstFig = out.match(/<figure\b[\s\S]*?<\/figure>/i);
    if (firstFig) {
      const src = firstFig[0].match(/src=["']([^"']+)["']/i)?.[1];
      if (src) {
        promotedSrc = src;
        out = out.replace(firstFig[0], '');
      }
    }
  }

  return { html: out, removedJunk, promotedSrc };
}

async function main() {
  if (isMock) { console.log('mock-mode'); return; }

  let q = sb()
    .from('articles')
    .select('id, title, image_url, body_html')
    .like('body_html', '%<figure%');
  if (!ALL) q = q.in('status', ['published', 'pending_review']);

  const { data, error } = await q;
  if (error) throw error;
  const rows = (data ?? []) as { id: number; image_url: string | null; body_html: string; title: string | null }[];
  console.log(`Кандидатов с figure: ${rows.length}`);

  let updated = 0, totalRemoved = 0, totalPromoted = 0;
  for (const a of rows) {
    const r = processBody(a.body_html, !!a.image_url);
    if (r.removedJunk === 0 && !r.promotedSrc) continue;
    const safe = sanitizeHtml(r.html);
    const patch: any = { body_html: safe };
    if (r.promotedSrc) patch.image_url = r.promotedSrc;
    const { error: upErr } = await sb().from('articles').update(patch).eq('id', a.id);
    if (upErr) { console.error(`#${a.id}: ${upErr.message}`); continue; }
    updated++;
    totalRemoved += r.removedJunk;
    if (r.promotedSrc) totalPromoted++;
    const note = [
      r.removedJunk > 0 ? `мусор -${r.removedJunk}` : '',
      r.promotedSrc ? 'обложка ↑' : ''
    ].filter(Boolean).join(', ');
    console.log(`  #${a.id} ${a.title?.slice(0, 60)} → ${note}`);
  }
  console.log(`\nГотово. Подправлено: ${updated}, мусора убрано: ${totalRemoved}, обложек повышено: ${totalPromoted}.`);
}

main().catch(e => { console.error(e); process.exit(1); });
