// Достаём встроенные фото из тела исходной статьи: <figure><img>...<figcaption>credit</figcaption></figure>
// и обычные большие <img> в <article>/<main>. Возвращаем до N штук, отфильтровав мусор.

import { absolutize } from './og';
import { isImageAlive } from './image-check';

export interface InlineImage {
  src: string;
  alt: string;
  caption: string | null;
  // Короткий «снимок» предшествующего абзаца из оригинала.
  // LLM использует его как смысловой якорь: маркер [IMG:N] нужно поставить
  // в русском пересказе ровно там, где раскрывается та же мысль.
  contextBefore?: string;
}

const TIMEOUT_MS = 10_000;

// Нормализуем URL, чтобы разные размеры одной и той же картинки считались за одну.
// Примеры WordPress: foo-300x200.jpg, foo-300x200-c-center.jpg, foo-scaled-1500x0-c-default.jpg
export function normalizeImageUrl(url: string): string {
  let u = url.trim();
  try { u = new URL(u).origin + new URL(u).pathname; } catch { /* keep as is */ }
  u = u.toLowerCase();
  u = u.replace(/-\d{2,4}x\d{1,4}(-c-[a-z]+)?(?=\.[a-z]+$)/, '');
  u = u.replace(/-scaled(?=\.[a-z]+$)/, '');
  u = u.replace(/-e\d{8,}(?=[-.])/, '');
  return u;
}

const JUNK_PATTERNS = /(avatar|favicon|logo|sprite|share|social|emoji|gravatar|tracking|pixel|ad-|advert|newsletter|subscribe|signup|sign-up|cta[-_]|banner|popup|pop-up|promo[-_]|sponsor|partner-|donate|paywall|footer-|header-|sidebar|slider|widget-|placeholder|spacer|divider|telegram|tg[-_]?\d|whatsapp|viber|vk[-_])/i;
// Пути ассетов темы / шаблона CMS — это всегда UI-элементы (баннеры, плашки), не фото статьи.
const THEME_ASSET_PATH = /\/(themes|template[s]?|skin|assets\/img|static\/img|wp-content\/themes)\//i;
// Классы на <img>, указывающие на UI-плашки, а не на содержимое статьи.
const JUNK_CLASS = /(banner|promo|widget|share|social|telegram|tg[-_]|whatsapp|viber|vk[-_]|subscribe|newsletter|cta[-_]|sponsor|paywall|avatar|logo|icon-)/i;

function isJunkSrc(src: string): boolean {
  if (!src) return true;
  if (/^data:/.test(src)) return true;
  if (/\.svg(\?|$)/i.test(src)) return true;
  if (THEME_ASSET_PATH.test(src)) return true;
  if (JUNK_PATTERNS.test(src)) return true;
  // Совсем мелкие размеры в имени
  if (/[-_]\d{1,2}x\d{1,2}\./.test(src)) return true;
  // WP-миниатюра до ~400px по ширине: типичный размер для виджетов «Похожие/Популярные».
  // Реальные иллюстрации в статьях обычно шире 400px.
  const wp = src.match(/[-_](\d{2,4})x\d{2,4}\.(jpe?g|png|webp|gif)/i);
  if (wp && Number(wp[1]) <= 400) return true;
  return false;
}

function isJunkAlt(alt: string): boolean {
  if (!alt) return false;
  return /(subscribe|newsletter|sign\s*up|donate|advertisement|sponsored|telegram|whats?app|viber|подписк|подпиш|канал|чат|комментар|оставить мнен|поделит)/i.test(alt);
}

function isJunkClass(classAttr: string | null): boolean {
  if (!classAttr) return false;
  return JUNK_CLASS.test(classAttr);
}

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Возвращает { html, scoped: true } если удалось найти семантический контейнер статьи
// (<article>/<main>) — тогда можно брать даже одиночные <img>, они скорее всего из тела.
// Если нет — { html: cleaned, scoped: false }, и одиночные <img> брать НЕЛЬЗЯ:
// почти гарантированно они окажутся из виджета «Похожее»/«Популярное».
function extractMainBlock(html: string): { html: string; scoped: boolean } {
  // Сразу выкидываем <noscript>, иначе ловим дубли картинок для no-js версии.
  let cleaned = html.replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ');
  const article = cleaned.match(/<article[\s\S]*?<\/article>/i)?.[0];
  if (article) return { html: article, scoped: true };
  const main = cleaned.match(/<main[\s\S]*?<\/main>/i)?.[0];
  if (main) return { html: main, scoped: true };
  // Без семантического контейнера — режем известные не-контентные блоки и отдаём как есть,
  // но помечаем как scoped:false, чтобы выше не доверять одиночным <img>.
  cleaned = cleaned
    .replace(/<aside[\s\S]*?<\/aside>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<header[\s\S]*?<\/header>/gi, ' ');
  return { html: cleaned, scoped: false };
}

function pickAttr(tag: string, name: string): string | null {
  const re = new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, 'i');
  return tag.match(re)?.[1] ?? null;
}

// Выбирает URL самой широкой картинки из srcset вида "url 1280w, url 750w, url 320w".
// Возвращает null, если ничего годного не найдено.
function pickLargestFromSrcset(srcset: string | null): string | null {
  if (!srcset) return null;
  let best: { url: string; w: number } | null = null;
  // Разбиваем по запятым, но запятые внутри URL (data-uri) встречаются редко — для нашего случая хватит.
  for (const part of srcset.split(',')) {
    const t = part.trim();
    if (!t) continue;
    const m = t.match(/^(\S+)(?:\s+(\d+)w)?/);
    if (!m) continue;
    const url = m[1];
    const w = m[2] ? Number(m[2]) : 0;
    if (!best || w > best.w) best = { url, w };
  }
  return best?.url ?? null;
}

// Лучший URL для <img>: проходит по src, data-src, data-lazy-src, data-original
// и берёт самый широкий из *srcset*. data:image-плейсхолдеры игнорируются.
function pickBestImgSrc(imgTag: string): string | null {
  const candidates: (string | null)[] = [
    pickAttr(imgTag, 'src'),
    pickAttr(imgTag, 'data-lazy-src'),
    pickAttr(imgTag, 'data-src'),
    pickAttr(imgTag, 'data-original'),
    pickAttr(imgTag, 'data-image'),
    pickLargestFromSrcset(pickAttr(imgTag, 'srcset')),
    pickLargestFromSrcset(pickAttr(imgTag, 'data-lazy-srcset')),
    pickLargestFromSrcset(pickAttr(imgTag, 'data-srcset'))
  ];
  for (const c of candidates) {
    if (!c) continue;
    if (/^data:/i.test(c)) continue;
    return c;
  }
  return null;
}

export async function fetchInlineImages(
  pageUrl: string,
  max = 3,
  excludeUrls: string[] = []
): Promise<InlineImage[]> {
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), TIMEOUT_MS);
    const r = await fetch(pageUrl, {
      signal: ac.signal,
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'accept-language': 'en-US,en;q=0.9,ru;q=0.8'
      }
    });
    clearTimeout(t);
    if (!r.ok) return [];
    const html = (await r.text()).slice(0, 600_000);
    const { html: main, scoped } = extractMainBlock(html);

    const out: InlineImage[] = [];
    // Уникальность считаем по нормализованному URL — чтобы разные размеры одного фото не дублировались.
    const seenKeys = new Set<string>(excludeUrls.map(u => normalizeImageUrl(absolutize(u, pageUrl))));

    function tryAdd(src: string, alt: string, caption: string | null, contextBefore: string) {
      if (!src || isJunkSrc(src)) return;
      if (isJunkAlt(alt) || (caption && isJunkAlt(caption))) return;
      const absUrl = absolutize(src, pageUrl);
      const key = normalizeImageUrl(absUrl);
      if (seenKeys.has(key)) return;
      seenKeys.add(key);
      out.push({
        src: absUrl,
        alt: alt.slice(0, 200),
        caption,
        contextBefore: contextBefore || undefined
      });
    }

    // Берём ~180 хвостовых символов чистого текста ИЗ АБЗАЦЕВ оригинала перед картинкой —
    // смысловой якорь для LLM. Удаляем предыдущие <figure>, чтобы их подпись
    // не попала в контекст следующего фото.
    function snippetBefore(pos: number): string {
      const slice = main.slice(Math.max(0, pos - 3500), pos)
        .replace(/<figure[\s\S]*?<\/figure>/gi, ' ');
      const text = stripTags(slice).trim();
      if (text.length <= 200) return text;
      // 200 хвостовых символов с запасом, потом откусываем огрызок начального слова
      // (но только если он короткий, иначе теряем существенный кусок).
      let tail = text.slice(-200);
      const firstSpace = tail.search(/\s/);
      if (firstSpace > 0 && firstSpace < 40) tail = tail.slice(firstSpace + 1);
      return tail.trim();
    }

    // Сперва <figure>...<img>...<figcaption>. Используем matchAll, чтобы знать позицию.
    for (const m of main.matchAll(/<figure[\s\S]*?<\/figure>/gi)) {
      const fig = m[0];
      const pos = m.index ?? 0;
      const imgTag = fig.match(/<img[^>]*>/i)?.[0];
      if (!imgTag) continue;
      // Отбрасываем UI-баннеры по классу самой <figure> или <img>.
      const figClass = pickAttr(fig.match(/<figure[^>]*>/i)?.[0] ?? '', 'class');
      const imgClass = pickAttr(imgTag, 'class');
      if (isJunkClass(figClass) || isJunkClass(imgClass)) continue;
      const src = pickBestImgSrc(imgTag);
      if (!src) continue;
      const alt = pickAttr(imgTag, 'alt') ?? '';
      const captionHtml = fig.match(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/i)?.[1] ?? null;
      const caption = captionHtml ? stripTags(captionHtml).slice(0, 280) : null;
      tryAdd(src, alt, caption, snippetBefore(pos));
      if (out.length >= max) break;
    }

    // Добавим простые <img> ТОЛЬКО если контент был в семантическом контейнере.
    // Иначе почти гарантированно ловим виджеты «Похожие/Популярные» — лучше остаться без фото.
    if (out.length < max && scoped) {
      for (const m of main.matchAll(/<img[^>]+>/gi)) {
        const imgTag = m[0];
        const pos = m.index ?? 0;
        const imgClass = pickAttr(imgTag, 'class');
        if (isJunkClass(imgClass)) continue;
        const src = pickBestImgSrc(imgTag);
        if (!src) continue;
        const alt = pickAttr(imgTag, 'alt') ?? '';
        const width = Number(pickAttr(imgTag, 'width') ?? '0');
        if (width && width < 300) continue;
        tryAdd(src, alt, null, snippetBefore(pos));
        if (out.length >= max) break;
      }
    }

    // Финальный фильтр: только живые URL
    const alive: InlineImage[] = [];
    for (const im of out) {
      if (await isImageAlive(im.src)) alive.push(im);
    }
    return alive;
  } catch {
    return [];
  }
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Текстовый контекст для LLM: какие фото у нас на руках и что они показывают.
// LLM должен расставить маркеры [IMG:1], [IMG:2] в подходящих местах body_html.
export function describeImagesForLlm(images: InlineImage[]): string {
  if (!images.length) return '';
  const sanitize = (s: string) => s.replace(/"/g, "'").replace(/\s+/g, ' ').trim();
  const lines = images.map((im, i) => {
    const parts: string[] = [];
    if (im.alt) parts.push(`alt="${sanitize(im.alt).slice(0, 200)}"`);
    if (im.caption) parts.push(`caption="${sanitize(im.caption).slice(0, 280)}"`);
    if (im.contextBefore) parts.push(`after_text="${sanitize(im.contextBefore).slice(0, 180)}"`);
    return `[IMG:${i + 1}] ${parts.join(' ') || '(без описания)'}`;
  });
  return lines.join('\n');
}

// Заменяем маркеры [IMG:N] в готовом body_html на <figure>.
// Возвращает { html, usedCount } — сколько маркеров реально нашли.
// Маркер может стоять как отдельный текст внутри <p> или между параграфами.
export function replaceImageMarkers(
  bodyHtml: string,
  images: InlineImage[]
): { html: string; usedCount: number } {
  if (!images.length) return { html: bodyHtml, usedCount: 0 };
  const used = new Set<number>();
  // LLM иногда вслед за маркером копирует описательный хвост вида: alt="..." caption="..."
  // Удаляем такой хвост до конца параграфа, чтобы он не утёк в публикацию.
  const tail = `(?:\\s*(?:alt|caption)\\s*=\\s*["'][^"']*["'])*`;
  // Случай 1: <p>[IMG:N] ... </p> — заменяем весь параграф на figure.
  let html = bodyHtml.replace(
    new RegExp(`<p>\\s*\\[IMG:(\\d+)\\]${tail}\\s*</p>`, 'gi'),
    (_m, n) => {
      const idx = Number(n) - 1;
      if (idx < 0 || idx >= images.length) return '';
      used.add(idx);
      return figureHtml(images[idx]);
    }
  );
  // Случай 2: маркер с возможным хвостом внутри текста абзаца — вырезаем его,
  // figure вставляем после </p>.
  html = html.replace(
    new RegExp(`(<p>[^<]*?)\\[IMG:(\\d+)\\]${tail}([^<]*?</p>)`, 'gi'),
    (_m, before, n, after) => {
      const idx = Number(n) - 1;
      if (idx < 0 || idx >= images.length) return before + after;
      used.add(idx);
      return before + after + figureHtml(images[idx]);
    }
  );
  // Финальная страховка: сносим любые оставшиеся маркеры и описательные хвосты.
  html = html.replace(new RegExp(`\\[IMG:\\d+\\]${tail}`, 'gi'), '');
  return { html, usedCount: used.size };
}

function figureHtml(im: InlineImage): string {
  const cap = im.caption ? `<figcaption>${esc(im.caption)}</figcaption>` : '';
  return `<figure><img src="${esc(im.src)}" alt="${esc(im.alt)}" />${cap}</figure>`;
}

// Вставляем картинки равномерно между абзацами body_html.
// Если изображений мало (<= 2), ставим после абзацев 1 и 3.
// Если больше — раскладываем по очереди в каждом промежутке между параграфами,
// при необходимости добавляя «лишние» в конце.
export function injectInlineImages(bodyHtml: string, images: InlineImage[]): string {
  if (!images.length) return bodyHtml;
  const parts = bodyHtml.split(/(<\/p>)/i);
  const pCount = parts.filter(p => p.toLowerCase() === '</p>').length;

  // Какие индексы </p> получают картинку.
  // Малое число: разреженно (1, 3, 5...). Большое: один-к-одному (1..N).
  let positions: number[];
  if (images.length <= 2 && pCount >= 4) {
    positions = [1, 3, 5];
  } else {
    positions = [];
    for (let i = 1; i <= Math.max(images.length, pCount); i++) positions.push(i);
  }

  const result: string[] = [];
  let injected = 0;
  let pIdx = 0;
  const figureFor = (im: InlineImage) => figureHtml(im);

  for (let i = 0; i < parts.length; i++) {
    result.push(parts[i]);
    if (parts[i].toLowerCase() === '</p>') {
      pIdx++;
      if (injected < images.length && positions.includes(pIdx)) {
        result.push(figureFor(images[injected]));
        injected++;
      }
    }
  }
  // Если картинок больше, чем параграфов — хвост добавим после всего текста.
  while (injected < images.length) {
    result.push(figureFor(images[injected]));
    injected++;
  }
  return result.join('');
}

// --- Редактирование тела: операции над <figure> в body_html ---------------

export interface BodyFigure {
  index: number;     // порядковый номер фигуры в теле, начиная с 0
  src: string;
  alt: string;
  caption: string;
  raw: string;       // исходный HTML фигуры — нужен для адресной замены
}

const FIGURE_RE = /<figure[^>]*>[\s\S]*?<\/figure>/gi;

export function listBodyFigures(bodyHtml: string): BodyFigure[] {
  const out: BodyFigure[] = [];
  const matches = bodyHtml.match(FIGURE_RE) ?? [];
  matches.forEach((raw, i) => {
    const imgTag = raw.match(/<img[^>]*>/i)?.[0] ?? '';
    const src = imgTag.match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1] ?? '';
    const alt = imgTag.match(/\balt\s*=\s*["']([^"']*)["']/i)?.[1] ?? '';
    const captionHtml = raw.match(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/i)?.[1] ?? '';
    const caption = captionHtml.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim();
    out.push({ index: i, src, alt, caption, raw });
  });
  return out;
}

export function removeFigureAt(bodyHtml: string, index: number): string {
  let i = 0;
  return bodyHtml.replace(FIGURE_RE, m => (i++ === index ? '' : m));
}

export function updateFigureAt(
  bodyHtml: string,
  index: number,
  patch: { src?: string; alt?: string; caption?: string }
): string {
  let i = 0;
  return bodyHtml.replace(FIGURE_RE, m => {
    if (i++ !== index) return m;
    const current = listBodyFigures(m)[0] ?? { src: '', alt: '', caption: '' };
    return figureHtml({
      src: patch.src ?? current.src,
      alt: patch.alt ?? current.alt,
      caption: patch.caption ?? current.caption ?? null
    } as InlineImage);
  });
}

export function appendFigure(
  bodyHtml: string,
  fig: { src: string; alt?: string; caption?: string }
): string {
  return bodyHtml + figureHtml({
    src: fig.src,
    alt: fig.alt ?? '',
    caption: fig.caption ?? null
  } as InlineImage);
}
