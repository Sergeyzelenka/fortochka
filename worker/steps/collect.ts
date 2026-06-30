// Шаг 1. Сбор: читает RSS источников, нормализует, складывает в articles
// со статусом found. Дедупликация — уникальный source_url (upsert ignore).
import Parser from 'rss-parser';
import { sb, isMock, log } from '../../lib/db';
import { absolutize, fetchOgImage } from '../../lib/og';
import { extractArticleText } from '../../lib/article-extract';

const parser = new Parser({
  timeout: 15000,
  customFields: {
    item: [
      ['media:content', 'media', { keepArray: true }],
      ['media:thumbnail', 'mediaThumb', { keepArray: true }],
      ['itunes:image', 'itunesImage'],
      'enclosure'
    ]
  }
});

function looksLikeImage(url: string | undefined): boolean {
  return !!url && /\.(jpe?g|png|webp|gif|avif)(\?|#|$)/i.test(url);
}

// «Чистый» хост: без www., feed., feeds., rss., m.
function normalizeHost(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^(www|feed|feeds|rss|m)\./, '');
  } catch { return ''; }
}

// Поддомены того же издания: science.nasa.gov ↔ nasa.gov, blog.example.ru ↔ example.ru.
function rootDomain(host: string): string {
  const parts = host.split('.');
  return parts.length >= 2 ? parts.slice(-2).join('.') : host;
}

// Ребренды и парные домены: один и тот же журнал, но статьи мигрировали на новый домен.
const SAME_PUBLICATION_ALIASES: Record<string, string> = {
  't-j.ru': 'tinkoff.ru',
  'journal.tinkoff.ru': 'tinkoff.ru'
};
function publicationKey(host: string): string {
  return SAME_PUBLICATION_ALIASES[host] ?? rootDomain(host);
}
function isSamePublication(a: string, b: string): boolean {
  if (!a || !b) return false;
  return publicationKey(a) === publicationKey(b);
}

// Известные партнёрские хосты → красивое имя. Дополнять по мере встречи.
const HOST_NAMES: Record<string, string> = {
  'burninghut.ru': 'Горящая изба',
  'lifehacker.ru': 'Lifehacker.ru',
  'naked-science.ru': 'Naked Science',
  'hi-news.ru': 'Hi-News.ru',
  'goodnewsnetwork.org': 'Good News Network'
};
function prettyHost(host: string): string {
  return HOST_NAMES[host] ?? host;
}

function pickImage(item: any, feedLink: string): string | null {
  const base = feedLink || item.link || '';

  // 1) media:content
  const media = item.media?.find((m: any) => m?.$?.url);
  if (media?.$?.url) return absolutize(media.$.url, base);

  // 2) media:thumbnail
  const thumb = item.mediaThumb?.find((m: any) => m?.$?.url);
  if (thumb?.$?.url) return absolutize(thumb.$.url, base);

  // 3) itunes:image
  const itunes = item.itunesImage?.$?.href ?? item.itunesImage?.href;
  if (itunes) return absolutize(itunes, base);

  // 4) enclosure — с image/* MIME или просто похоже на картинку
  const enc = item.enclosure;
  if (enc?.url && (/image/.test(enc.type ?? '') || looksLikeImage(enc.url))) {
    return absolutize(enc.url, base);
  }

  // 5) <img> внутри content:encoded / content / description / summary
  const html = item['content:encoded'] ?? item.content ?? item.description ?? item.summary ?? '';
  const m = String(html).match(/<img[^>]+src=["']([^"']+)["']/i);
  if (m) return absolutize(m[1], base);

  return null;
}

interface SourceRow {
  id: number;
  name: string;
  rss_url: string;
  default_category: number | null;
  enabled: boolean;
  collect_enabled: boolean;
}

export async function collect() {
  if (isMock) {
    console.log('collect: пропущен (мок-режим)');
    return;
  }
  // Собираем только из источников, помеченных «участвует в сборе» (collect_enabled).
  // enabled — отдельный, более общий выключатель источника; здесь не используется,
  // чтобы можно было поставить источник на паузу в сборе, не выключая его целиком.
  const { data: sources, error } = await sb()
    .from('sources').select('*').eq('collect_enabled', true);
  if (error) throw error;

  let added = 0;
  for (const src of (sources as SourceRow[]) ?? []) {
    try {
      const feed = await parser.parseURL(src.rss_url);
      const items = ((feed.items ?? []) as any[]).slice(0, 50);
      const feedLink = (feed as any).link ?? '';
      const feedHost = normalizeHost(src.rss_url);
      for (const item of items) {
        if (!item.link || !item.title) continue;
        // Если RSS-фид транслирует партнёрский материал (link ведёт на другой хост),
        // имя источника берём по фактическому хосту, а не из конфига нашей подписки.
        // Иначе в админке статья «Горящая изба» подписывалась бы как «Lifehacker.ru».
        const itemHost = normalizeHost(item.link);
        const isForeign = !!itemHost && !!feedHost && !isSamePublication(itemHost, feedHost);
        const sourceName = isForeign ? prettyHost(itemHost) : src.name;
        let img = pickImage(item, feedLink);
        if (!img) img = await fetchOgImage(item.link);

        // Текст из RSS — обычно тизер 200-500 символов. Тянем полный текст со страницы,
        // если он заметно длиннее. Если не получилось — оставляем RSS-версию.
        const rssText = (item['content:encoded'] ?? item.contentSnippet ?? item.content ?? '').slice(0, 20000);
        let rawText = rssText;
        try {
          const full = await extractArticleText(item.link);
          if (full && full.text.length > rssText.length * 1.5) {
            rawText = full.text.slice(0, 20000);
          }
        } catch { /* фолбэк на RSS */ }

        const { error: insErr } = await sb().from('articles').insert({
          source_url: item.link,
          source_name: sourceName,
          source_id: src.id,
          raw_title: item.title,
          raw_text: rawText,
          raw_image_url: img,
          category_id: src.default_category,
          status: 'found'
        });
        // 23505 = duplicate key → уже видели эту новость, это норма
        if (!insErr) added++;
        else if (insErr.code !== '23505') await log(null, 'collect', false, `${item.link}: ${insErr.message}`);
      }
      await sb().from('sources')
        .update({ last_fetched_at: new Date().toISOString() })
        .eq('id', src.id);
    } catch (e: any) {
      await log(null, 'collect', false, `${src.name}: ${e.message}`);
      console.error(`  ${src.name}: ${e.message}`);
    }
  }
  await log(null, 'collect', true, `новых: ${added}`);
  console.log(`collect: новых новостей — ${added}`);
}
