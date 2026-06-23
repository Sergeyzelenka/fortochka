// Фирменный генератор SVG-обложек: детерминированная абстрактная
// композиция в палитре рубрики. seed — обычно заголовок статьи.
import { catById } from './types';

function rng(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822519);
    h = Math.imul(h ^ (h >>> 13), 3266489917);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

const BG: Record<string, string> = {
  science: '#E8EEF6', animals: '#E9F0EA', ecology: '#E5EFEE',
  kindness: '#F4ECE4', space: '#1A2238', tech: '#EBEDF0', lifehacks: '#F2EDE2'
};

export function coverSvg(seed: string, categoryId: number | null, w = 720, h = 400): string {
  const cat = catById(categoryId);
  const r = rng(seed + cat.slug);
  const bg = BG[cat.slug] ?? '#EDEBE4';
  const dark = cat.slug === 'space';
  const shapes: string[] = [];

  // 3–5 полупрозрачных кругов в цвете рубрики
  const n = 3 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const cx = Math.round(w * (0.15 + r() * 0.7));
    const cy = Math.round(h * (0.2 + r() * 0.6));
    const rad = Math.round(h * (0.15 + r() * 0.25));
    const op = (0.12 + r() * 0.25).toFixed(2);
    shapes.push(`<circle cx="${cx}" cy="${cy}" r="${rad}" fill="${cat.color}" opacity="${op}"/>`);
  }
  // солнечный акцент — фирменная точка ФОРТОЧКА
  const sx = Math.round(w * (0.6 + r() * 0.3));
  const sy = Math.round(h * (0.15 + r() * 0.3));
  shapes.push(`<circle cx="${sx}" cy="${sy}" r="${Math.round(h * 0.09)}" fill="#F2B22D" opacity=".85"/>`);
  // волна-основание
  const y1 = Math.round(h * (0.72 + r() * 0.12));
  const mid = Math.round(h * (0.6 + r() * 0.15));
  shapes.push(
    `<path d="M0 ${y1} Q ${w / 2} ${mid} ${w} ${y1} L${w} ${h} L0 ${h} Z" fill="${cat.color}" opacity="${dark ? 0.55 : 0.8}"/>`
  );
  if (dark) {
    for (let i = 0; i < 14; i++) {
      shapes.push(`<circle cx="${Math.round(r() * w)}" cy="${Math.round(r() * h * 0.7)}" r="${(0.8 + r()).toFixed(1)}" fill="#fff" opacity="${(0.4 + r() * 0.5).toFixed(2)}"/>`);
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice"><rect width="${w}" height="${h}" fill="${bg}"/>${shapes.join('')}</svg>`;
}
