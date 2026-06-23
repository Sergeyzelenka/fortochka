// HEAD-проверяет, что по URL реально отдаётся картинка.
// true — картинка жива; false — 4xx/5xx, не картинка, таймаут, любая сетевая ошибка.

const TIMEOUT_MS = 8000;

export async function isImageAlive(url: string): Promise<boolean> {
  if (!url) return false;
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), TIMEOUT_MS);
    let res = await fetch(url, {
      method: 'HEAD',
      signal: ac.signal,
      headers: { 'user-agent': 'Mozilla/5.0 FortochkaImageCheck/1.0' }
    }).catch(() => null);

    // Некоторые сервера запрещают HEAD — пробуем GET с Range, чтоб не качать всё.
    if (!res || res.status === 405 || res.status === 403) {
      res = await fetch(url, {
        method: 'GET',
        signal: ac.signal,
        headers: {
          'user-agent': 'Mozilla/5.0 FortochkaImageCheck/1.0',
          'range': 'bytes=0-1023'
        }
      }).catch(() => null);
    }
    clearTimeout(t);
    if (!res) return false;
    if (!res.ok && res.status !== 206) return false;

    const ct = (res.headers.get('content-type') ?? '').toLowerCase();
    if (ct && !ct.startsWith('image/')) return false;
    return true;
  } catch {
    return false;
  }
}
