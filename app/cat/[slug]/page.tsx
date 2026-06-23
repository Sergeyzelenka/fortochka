import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Masthead from '@/components/Masthead';
import NewsFeed from '@/components/NewsFeed';
import Brand from '@/components/Brand';
import { getPublishedByCategory } from '@/lib/db';
import { CATEGORIES } from '@/lib/types';

export const revalidate = 300;

export function generateStaticParams() {
  return CATEGORIES.map(c => ({ slug: c.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const cat = CATEGORIES.find(c => c.slug === params.slug);
  if (!cat) return { title: 'Рубрика не найдена' };
  const title = `${cat.name} — только хорошие новости`;
  const description = `Подборка позитивных новостей в рубрике «${cat.name}». ФОРТОЧКА · глоток свежих новостей.`;
  return {
    title,
    description,
    openGraph: { type: 'website', title, description },
    twitter: { card: 'summary', title, description }
  };
}

export default async function CategoryPage({ params }: { params: { slug: string } }) {
  const cat = CATEGORIES.find(c => c.slug === params.slug);
  if (!cat) notFound();
  const articles = await getPublishedByCategory(cat.id, 40);

  return (
    <>
      <Masthead active={cat.slug} />
      <main className="wrap">
        <div className="sect-title" style={{ marginTop: 28 }}>
          <h2 style={{ color: cat.color }}>{cat.name}</h2>
        </div>
        <NewsFeed
          articles={articles}
          emptyMsg={`Пока нет опубликованных новостей в рубрике «${cat.name}».`}
        />
      </main>

      <footer className="site">
        <div className="wrap">
          <div>
            <Brand size={26} />
            <p style={{ marginTop: 10, maxWidth: 320 }}>
              Медиа, которое доказывает: хороших новостей больше, чем плохих. Каждый материал публикуется со ссылкой на первоисточник.
            </p>
          </div>
          <nav>
            <a href="/about">О проекте</a><a href="/sources">Источники и принципы</a>
            <a href="https://t.me/Fortochka_goodnews" target="_blank" rel="noreferrer">Telegram</a><a href="/contacts">Контакты</a>
          </nav>
        </div>
      </footer>
    </>
  );
}
