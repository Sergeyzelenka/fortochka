import type { Metadata } from 'next';
import Link from 'next/link';
import Masthead from '@/components/Masthead';
import Cover from '@/components/Cover';
import { searchArticles } from '@/lib/db';
import { catById } from '@/lib/types';

export const dynamic = 'force-dynamic';

export function generateMetadata({ searchParams }: { searchParams: { q?: string } }): Metadata {
  const q = (searchParams.q ?? '').slice(0, 80);
  return {
    title: q ? `Поиск: ${q}` : 'Поиск',
    description: 'Поиск по статьям ФОРТОЧКА.',
    robots: { index: false }
  };
}

function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const h = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 3600_000));
  if (h < 24) return `${h} ч назад`;
  const d = Math.round(h / 24);
  return `${d} дн назад`;
}

export default async function SearchPage({ searchParams }: { searchParams: { q?: string } }) {
  const q = (searchParams.q ?? '').trim();
  const results = q ? await searchArticles(q, 50) : [];

  return (
    <>
      <Masthead />
      <main className="wrap search-page">
        <form className="search-form" action="/search" method="GET">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Что искать?"
            autoFocus={!q}
            aria-label="Поисковый запрос"
          />
          <button type="submit" className="abtn ok">Найти</button>
        </form>

        {q && (
          <div className="search-stats">
            {results.length > 0 ? (
              <>По запросу <b>«{q}»</b> найдено: <b>{results.length}</b></>
            ) : (
              <>По запросу <b>«{q}»</b> ничего не найдено</>
            )}
          </div>
        )}

        {results.length > 0 && (
          <section className="grid">
            {results.map(a => {
              const cat = catById(a.category_id);
              return (
                <Link key={a.id} href={`/article/${a.slug}`} className="fcard">
                  <Cover a={a} height={185} />
                  <span className="cat" style={{ color: cat.color }}>{cat.name}</span>
                  <h3>{a.title}</h3>
                  {a.dek && <p className="dek">{a.dek}</p>}
                  <div className="meta">
                    <span>{a.source_name}</span>
                    <span className="sep" />
                    <span>{timeAgo(a.published_at)}</span>
                  </div>
                </Link>
              );
            })}
          </section>
        )}
      </main>
    </>
  );
}
