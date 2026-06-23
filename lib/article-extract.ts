// Полнотекстовый парсинг статьи с её страницы.
// RSS-фиды часто отдают только тизер (300-500 символов), а нам нужен полный
// текст, чтобы LLM-редактор написал содержательную статью.
// Без headless-браузера: простой HTML-парс, ищем основной блок и собираем абзацы.

const TIMEOUT_MS = 12_000;
const MIN_LEN = 400;

const BROWSER_HEADERS = {
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'accept-language': 'en-US,en;q=0.9,ru;q=0.8'
};

function stripBlocks(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<aside[\s\S]*?<\/aside>/gi, ' ')
    .replace(/<header[\s\S]*?<\/header>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<form[\s\S]*?<\/form>/gi, ' ');
}

function htmlDecode(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&ldquo;/g, '«').replace(/&rdquo;/g, '»')
    .replace(/&mdash;/g, '—').replace(/&ndash;/g, '–')
    .replace(/&hellip;/g, '…')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function blockToText(block: string): string {
  // Разбиваем на параграфы по <p>, <li>, <h2>, <h3>, чтобы сохранить структуру.
  // Внутри каждого блока убираем теги, нормализуем пробелы.
  const chunks: string[] = [];
  const re = /<(p|li|h[2-4])\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block))) {
    const text = htmlDecode(m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')).trim();
    if (text.length >= 30) chunks.push(text);
  }
  return chunks.join('\n\n');
}

function pickBest(blocks: string[]): string {
  let best = '';
  for (const b of blocks) {
    const t = blockToText(b);
    if (t.length > best.length) best = t;
  }
  return best;
}

export interface ExtractResult {
  text: string;
  length: number;
  source: 'article' | 'main' | 'div-article' | 'fallback';
}

export async function extractArticleText(pageUrl: string): Promise<ExtractResult | null> {
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), TIMEOUT_MS);
    const r = await fetch(pageUrl, { signal: ac.signal, headers: BROWSER_HEADERS });
    clearTimeout(t);
    if (!r.ok) return null;
    const rawHtml = await r.text();
    const html = stripBlocks(rawHtml.slice(0, 2_000_000));

    // Признаки Cloudflare-челленджа — там точно нет статьи
    if (/Just a moment\.\.\./.test(rawHtml) && rawHtml.length < 12_000) return null;

    // 1) <article>
    const articles = html.match(/<article[\s\S]*?<\/article>/gi) ?? [];
    let text = pickBest(articles);
    if (text.length >= MIN_LEN) return { text, length: text.length, source: 'article' };

    // 2) <main>
    const mains = html.match(/<main[\s\S]*?<\/main>/gi) ?? [];
    text = pickBest(mains);
    if (text.length >= MIN_LEN) return { text, length: text.length, source: 'main' };

    // 3) <div class="...article|content|entry|post|story...">
    const divs = html.match(/<div[^>]*class=["'][^"']*(article|entry-content|post-content|story|content-body)[^"']*["'][\s\S]*?<\/div>/gi) ?? [];
    text = pickBest(divs);
    if (text.length >= MIN_LEN) return { text, length: text.length, source: 'div-article' };

    // 4) Фолбэк — все <p> на странице, отсортированные по длине, склейка длинных
    const allP = (html.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) ?? [])
      .map(p => htmlDecode(p.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')).trim())
      .filter(t => t.length >= 60);
    if (allP.length) {
      text = allP.join('\n\n');
      if (text.length >= MIN_LEN) return { text, length: text.length, source: 'fallback' };
    }

    return null;
  } catch {
    return null;
  }
}
