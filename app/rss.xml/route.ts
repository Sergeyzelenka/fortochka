import { getPublished } from '@/lib/db';
import { catById } from '@/lib/types';

const SITE_URL = process.env.SITE_URL ?? 'http://localhost:3000';

export const revalidate = 600;
export const dynamic = 'force-static';

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET() {
  const articles = await getPublished(50);
  const buildDate = new Date().toUTCString();
  const lastPub = articles[0]?.published_at ? new Date(articles[0].published_at).toUTCString() : buildDate;

  const items = articles.filter(a => a.slug && a.published_at).map(a => {
    const cat = catById(a.category_id);
    const url = `${SITE_URL}/article/${a.slug}`;
    const pubDate = new Date(a.published_at!).toUTCString();
    const description = a.dek ?? a.tg_excerpt ?? '';
    const imageEnclosure = a.image_url
      ? `    <enclosure url="${esc(a.image_url)}" type="image/jpeg" />`
      : '';
    return `  <item>
    <title>${esc(a.title ?? a.raw_title)}</title>
    <link>${url}</link>
    <guid isPermaLink="true">${url}</guid>
    <pubDate>${pubDate}</pubDate>
    <category>${esc(cat.name)}</category>
    <description>${esc(description)}</description>
    <source url="${esc(a.source_url)}">${esc(a.source_name)}</source>
${imageEnclosure}
  </item>`;
  }).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>ФОРТОЧКА · глоток свежих новостей</title>
    <link>${SITE_URL}</link>
    <description>Хороших новостей больше, чем плохих. Наука, экология, доброта и космос каждый день.</description>
    <language>ru-RU</language>
    <lastBuildDate>${buildDate}</lastBuildDate>
    <pubDate>${lastPub}</pubDate>
    <atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' }
  });
}
