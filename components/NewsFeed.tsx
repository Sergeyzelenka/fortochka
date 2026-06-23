import Link from 'next/link';
import Cover from '@/components/Cover';
import { Article, catById } from '@/lib/types';

function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const h = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 3600_000));
  if (h < 24) return `${h} ч назад`;
  const d = Math.round(h / 24);
  return `${d} дн назад`;
}

export default function NewsFeed({ articles, emptyMsg }: { articles: Article[]; emptyMsg: string }) {
  const [lead, ...rest] = articles;
  const briefs = rest.slice(0, 4);
  const feed = rest.slice(4);

  if (!lead) return <p className="empty">{emptyMsg}</p>;

  return (
    <>
      <section className="lead-sect">
        <div className="lead-main">
          <Link href={`/article/${lead.slug}`}>
            <Cover a={lead} height={380} />
          </Link>
          <span className="cat" style={{ color: catById(lead.category_id).color }}>
            {catById(lead.category_id).name}
          </span>
          <h1><Link href={`/article/${lead.slug}`}>{lead.title}</Link></h1>
          <p className="dek">{lead.dek}</p>
          <div className="meta" style={{ marginTop: 14 }}>
            <span>по материалам {lead.source_name}</span>
            <span className="sep" />
            <span>{timeAgo(lead.published_at)}</span>
            {lead.reading_minutes && (<><span className="sep" /><span>{lead.reading_minutes} мин чтения</span></>)}
          </div>
        </div>

        <aside className="lead-side">
          <div className="side-head">Сегодня в мире хорошего</div>
          {briefs.map(a => (
            <Link key={a.id} href={`/article/${a.slug}`} className="brief">
              <span className="cat" style={{ color: catById(a.category_id).color }}>
                {catById(a.category_id).name}
              </span>
              <h3>{a.title}</h3>
              <div className="meta">
                <span>{a.source_name}</span><span className="sep" /><span>{timeAgo(a.published_at)}</span>
              </div>
            </Link>
          ))}
        </aside>
      </section>

      {feed.length > 0 && (
        <>
          <div className="sect-title"><h2>Свежее</h2></div>
          <section className="grid">
            {feed.map(a => (
              <Link key={a.id} href={`/article/${a.slug}`} className="fcard">
                <Cover a={a} height={185} />
                <span className="cat" style={{ color: catById(a.category_id).color }}>
                  {catById(a.category_id).name}
                </span>
                <h3>{a.title}</h3>
                <p className="dek">{a.dek}</p>
                <div className="meta">
                  <span>{a.source_name}</span><span className="sep" /><span>{timeAgo(a.published_at)}</span>
                </div>
              </Link>
            ))}
          </section>
        </>
      )}
    </>
  );
}
