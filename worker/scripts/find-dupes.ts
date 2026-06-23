// Аудит существующих статей на дубликаты по тексту.
// Только сообщает, ничего не меняет. Запуск: npm run worker:find-dupes

import { config } from 'dotenv';
config({ path: '.env.local' });

import { sb, isMock } from '../../lib/db';
import { findDuplicate, type DupeCandidate } from '../../lib/dedupe';

async function main() {
  if (isMock) { console.log('mock-mode'); return; }
  const { data } = await sb()
    .from('articles')
    .select('id, title, dek, status, source_name')
    .in('status', ['published', 'pending_review'])
    .not('title', 'is', null)
    .order('id', { ascending: true });
  const rows = (data ?? []) as { id: number; title: string; dek: string | null; status: string; source_name: string }[];
  console.log(`Проверяю ${rows.length} статей на близость текста...`);

  let pairs = 0;
  for (let i = 0; i < rows.length; i++) {
    const target = rows[i];
    const earlier: DupeCandidate[] = rows.slice(0, i).map(r => ({ id: r.id, title: r.title, dek: r.dek }));
    const dup = findDuplicate(target.title, target.dek ?? '', earlier);
    if (dup) {
      pairs++;
      console.log(
        `\n#${target.id} (${target.status}, ${target.source_name})`
        + `\n  «${target.title.slice(0, 80)}»`
        + `\n  ↪ дубликат #${dup.id} «${dup.candidateTitle.slice(0, 80)}» — близость ${Math.round(dup.similarity * 100)}%`
      );
    }
  }
  console.log(`\nГотово. Найдено пар-дубликатов: ${pairs}.`);
}

main().catch(e => { console.error(e); process.exit(1); });
