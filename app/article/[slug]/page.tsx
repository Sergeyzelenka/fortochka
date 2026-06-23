import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Masthead from '@/components/Masthead';
import Cover from '@/components/Cover';
import ReadingProgress from '@/components/ReadingProgress';
import ShareButtons from '@/components/ShareButtons';
import Reactions from '@/components/Reactions';
import { getBySlug, getPublishedByCategory } from '@/lib/db';
import { catById } from '@/lib/types';

function isAiIllustration(url: string | null): boolean {
  return !!url && /\/covers\/ai\//.test(url);
}

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const a = await getBySlug(params.slug);
  if (!a) return { title: 'Статья не найдена' };
  const title = a.title ?? a.raw_title;
  const description = a.dek ?? '';
  // og:image автоматически подтягивается из opengraph-image.tsx — здесь не дублируем.
  return {
    title,
    description,
    openGraph: {
      type: 'article',
      title,
      description,
      publishedTime: a.published_at ?? undefined
    },
    twitter: { card: 'summary_large_image', title, description }
  };
}

export default async function ArticlePage({ params }: { params: { slug: string } }) {
  const a = await getBySlug(params.slug);
  if (!a) notFound();
  const cat = catById(a.category_id);
  const date = a.published_at
    ? new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(a.published_at))
    : '';

  const SITE_URL = process.env.SITE_URL ?? 'http://localhost:3000';
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: a.title ?? a.raw_title,
    description: a.dek ?? '',
    image: a.image_url ? [a.image_url] : undefined,
    datePublished: a.published_at,
    dateModified: a.published_at,
    author: { '@type': 'Organization', name: 'Редакция ФОРТОЧКА', url: SITE_URL },
    publisher: {
      '@type': 'Organization',
      name: 'ФОРТОЧКА',
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/brand/mark.png`, width: 512, height: 512 }
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE_URL}/article/${a.slug}` },
    articleSection: cat.name,
    inLanguage: 'ru-RU',
    isAccessibleForFree: true
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ReadingProgress color={cat.color} />
      <Masthead active={cat.slug} />
      <article className="art-page">
        <Link href="/" className="back-link">← Ко всем новостям</Link>
        <div style={{ marginTop: 22 }}>
          <span className="cat" style={{ color: cat.color }}>{cat.name}</span>
        </div>
        <h1>{a.title}</h1>
        {a.dek && <p className="dek">{a.dek}</p>}
        <div className="byline">
          <span>Редакция ФОРТОЧКА</span><span className="sep" style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--ink-3)' }} />
          <span>{date}</span>
          {a.reading_minutes && (<>
            <span className="sep" style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--ink-3)' }} />
            <span>{a.reading_minutes} мин чтения</span>
          </>)}
        </div>
        {a.image_url ? (
          <figure className="hero-fig">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={a.image_url} alt={a.title ?? ''} referrerPolicy="no-referrer" />
            <figcaption>
              {isAiIllustration(a.image_url) ? (
                <span>Иллюстрация сгенерирована ИИ специально для ФОРТОЧКА</span>
              ) : (
                <span>
                  Фото:{' '}
                  <a href={a.source_url} target="_blank" rel="noreferrer">{a.source_name}</a>
                </span>
              )}
            </figcaption>
          </figure>
        ) : a.cover_svg ? (
          <figure className="hero-fig hero-svg">
            <span dangerouslySetInnerHTML={{ __html: a.cover_svg }} />
            <figcaption>Иллюстрация ФОРТОЧКА</figcaption>
          </figure>
        ) : null}

        <div className="prose" dangerouslySetInnerHTML={{ __html: a.body_html ?? '' }} />

        <Reactions slug={a.slug ?? ''} initialViews={a.views ?? 0} />

        <ShareButtons
          url={`${SITE_URL}/article/${a.slug}`}
          title={a.title ?? a.raw_title}
          dek={a.dek ?? undefined}
        />

        <div className="srcline">
          <span>Первоисточник: <a href={a.source_url} target="_blank" rel="noreferrer">{a.source_name}</a></span>
        </div>
      </article>

      <RelatedSection currentId={a.id} categoryId={a.category_id} />
    </>
  );
}

async function RelatedSection({ currentId, categoryId }: { currentId: number; categoryId: number | null }) {
  if (!categoryId) return null;
  const list = (await getPublishedByCategory(categoryId, 7)).filter(x => x.id !== currentId).slice(0, 6);
  if (list.length === 0) return null;
  const cat = catById(categoryId);
  return (
    <section className="related wrap">
      <div className="related-head">
        <span className="related-kicker" style={{ color: cat.color }}>Ещё в рубрике «{cat.name}»</span>
        <Link href={`/cat/${cat.slug}`} className="related-more">Все →</Link>
      </div>
      <div className="related-grid">
        {list.map(r => (
          <Link key={r.id} href={`/article/${r.slug}`} className="rel-card">
            <div className="rel-cover"><Cover a={r} height={150} /></div>
            <span className="cat" style={{ color: catById(r.category_id).color }}>{catById(r.category_id).name}</span>
            <h3>{r.title}</h3>
            <p className="dek">{r.dek}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
