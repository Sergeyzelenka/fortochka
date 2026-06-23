// Дедупликация статей по близости текста заголовка + dek.
// Подход: character n-grams + Jaccard similarity.
// Без зависимостей и без лемматизации — устойчиво к падежам и склонениям,
// потому что сравниваем 4-символьные «кусочки» текста, а не целые слова.

const N = 4;
const TITLE_WEIGHT = 0.7;
const DEK_WEIGHT = 0.3;

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function charNgrams(s: string, n = N): Set<string> {
  const norm = normalize(s);
  const out = new Set<string>();
  if (norm.length === 0) return out;
  if (norm.length < n) { out.add(norm); return out; }
  for (let i = 0; i <= norm.length - n; i++) out.add(norm.slice(i, i + n));
  return out;
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

export interface DupeCandidate {
  id: number;
  title: string;
  dek: string | null;
}

export interface DupeMatch {
  id: number;
  similarity: number;
  candidateTitle: string;
}

// Возвращает самого близкого «соседа» по тексту, если близость >= threshold.
export function findDuplicate(
  newTitle: string,
  newDek: string,
  candidates: DupeCandidate[],
  threshold = 0.42
): DupeMatch | null {
  const titleNg = charNgrams(newTitle);
  const dekNg = charNgrams(newDek);
  let best: DupeMatch | null = null;
  for (const c of candidates) {
    if (!c.title) continue;
    const tSim = jaccard(titleNg, charNgrams(c.title));
    const dSim = c.dek ? jaccard(dekNg, charNgrams(c.dek)) : 0;
    const score = tSim * TITLE_WEIGHT + dSim * DEK_WEIGHT;
    if (score >= threshold && (!best || score > best.similarity)) {
      best = { id: c.id, similarity: score, candidateTitle: c.title };
    }
  }
  return best;
}
