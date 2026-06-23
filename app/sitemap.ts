import type { MetadataRoute } from 'next';
import { getPublished } from '@/lib/db';
import { CATEGORIES } from '@/lib/types';

const SITE_URL = process.env.SITE_URL ?? 'http://localhost:3000';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const articles = await getPublished(500);
  const articleUrls: MetadataRoute.Sitemap = articles
    .filter(a => a.slug)
    .map(a => ({
      url: `${SITE_URL}/article/${a.slug}`,
      lastModified: a.published_at ? new Date(a.published_at) : new Date(),
      changeFrequency: 'weekly',
      priority: 0.7
    }));

  const catUrls: MetadataRoute.Sitemap = CATEGORIES.map(c => ({
    url: `${SITE_URL}/cat/${c.slug}`,
    lastModified: new Date(),
    changeFrequency: 'daily',
    priority: 0.8
  }));

  const staticUrls: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/about`,    lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/sources`,  lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.5 },
    { url: `${SITE_URL}/contacts`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 }
  ];

  return [
    { url: SITE_URL, lastModified: new Date(), changeFrequency: 'hourly', priority: 1 },
    ...staticUrls,
    ...catUrls,
    ...articleUrls
  ];
}
