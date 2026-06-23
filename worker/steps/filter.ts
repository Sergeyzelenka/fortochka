// Шаг 2. Фильтр: found → filtered (score ≥ 7) или rejected_by_ai.
import { sb, isMock, setStatus, log } from '../../lib/db';
import { filterNews } from '../../lib/llm';
import { CATEGORIES, Article } from '../../lib/types';

const PASS_SCORE = 7;
const MAX_ERRORS = 3;
const BATCH = 30;
const PAUSE_MS = 1500; // бережём бесплатный лимит Groq

export async function filterStep() {
  if (isMock) {
    console.log('filter: пропущен (мок-режим)');
    return;
  }
  const { data, error } = await sb()
    .from('articles').select('*')
    .eq('status', 'found')
    .lt('error_count', MAX_ERRORS)
    .order('created_at')
    .limit(BATCH);
  if (error) throw error;

  let passed = 0, rejected = 0;
  for (const a of (data as Article[]) ?? []) {
    try {
      const v = await filterNews(a.raw_title, a.raw_text ?? '');
      const cat = CATEGORIES.find(c => c.slug === v.category);
      if (v.is_good && v.score >= PASS_SCORE) {
        await setStatus(a.id, 'filtered', {
          score: v.score,
          ai_reason: v.reason,
          category_id: cat?.id ?? a.category_id
        });
        passed++;
      } else {
        await setStatus(a.id, 'rejected_by_ai', { score: v.score, ai_reason: v.reason });
        rejected++;
      }
      await log(a.id, 'filter', true, `score=${v.score}`);
    } catch (e: any) {
      const count = a.error_count + 1;
      const fatal = count >= MAX_ERRORS;
      await setStatus(a.id, fatal ? 'error' : 'found', {
        error_count: count,
        last_error: String(e.message).slice(0, 500)
      });
      await log(a.id, 'filter', false, e.message);
    }
    await new Promise(r => setTimeout(r, PAUSE_MS));
  }
  console.log(`filter: прошло ${passed}, отклонено ${rejected}`);
}
