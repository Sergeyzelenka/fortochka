// Достаём картинку со страницы статьи (og:image / twitter:image).
// Используется как фолбэк в шаге collect и в скрипте refetch-images.

export function absolutize(url: string, base: string): string {
  // Срезаем висящие кавычки/пробелы — иногда они прилипают к URL'у из-за кривого исходного HTML
  const clean = url.replace(/[\s"'<>]+$/, '').replace(/^[\s"']+/, '');
  try { return new URL(clean, base).toString(); } catch { return clean; }
}

export async function fetchOgImage(pageUrl: string): Promise<string | null> {
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 8000);
    const r = await fetch(pageUrl, {
      signal: ac.signal,
      headers: { 'user-agent': 'Mozilla/5.0 FortochkaBot/1.0' }
    });
    clearTimeout(t);
    if (!r.ok) return null;
    const html = (await r.text()).slice(0, 200_000);
    const m =
      html.match(/<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    return m ? absolutize(m[1], pageUrl) : null;
  } catch {
    return null;
  }
}
