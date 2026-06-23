// Публикация в Telegram-канал и сервисные уведомления главреду.
const api = (method: string) =>
  `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`;

export const tgEnabled = () =>
  Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHANNEL_ID);

// Telegram отвергает кнопки и <a href> со ссылками на localhost / приватные IP.
// На локальной разработке публикуем без ссылки, в проде — с inline-кнопкой.
function isPublicUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
    const host = u.hostname.toLowerCase();
    if (host === 'localhost' || host === '0.0.0.0' || host.endsWith('.localhost')) return false;
    if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host)) return false;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false;
    // Telegram требует именно HTTPS для inline-кнопок.
    return u.protocol === 'https:';
  } catch { return false; }
}

export async function postToChannel(opts: {
  excerpt: string;
  title: string;
  articleUrl: string;
  imageUrl?: string | null;
}): Promise<number | null> {
  if (!tgEnabled()) return null;
  const linkOk = isPublicUrl(opts.articleUrl);
  const caption = `<b>${esc(opts.title)}</b>\n\n${esc(opts.excerpt)}`;
  const replyMarkup = linkOk
    ? { inline_keyboard: [[{ text: 'Читать на сайте', url: opts.articleUrl }]] }
    : undefined;
  const textTail = linkOk ? `\n\n<a href="${opts.articleUrl}">Читать на сайте</a>` : '';
  const body: any = opts.imageUrl
    ? {
        chat_id: process.env.TELEGRAM_CHANNEL_ID,
        photo: opts.imageUrl,
        caption,
        parse_mode: 'HTML'
      }
    : {
        chat_id: process.env.TELEGRAM_CHANNEL_ID,
        text: `${caption}${textTail}`,
        parse_mode: 'HTML'
      };
  if (replyMarkup) body.reply_markup = replyMarkup;
  const res = await fetch(api(opts.imageUrl ? 'sendPhoto' : 'sendMessage'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!data.ok) throw new Error('Telegram: ' + JSON.stringify(data));
  return data.result?.message_id ?? null;
}

export async function notifyAdmin(text: string) {
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_ADMIN_CHAT_ID) {
    console.log('[notify]', text);
    return;
  }
  await fetch(api('sendMessage'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: process.env.TELEGRAM_ADMIN_CHAT_ID, text })
  }).catch(() => {});
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
