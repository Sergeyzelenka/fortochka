import Masthead from '@/components/Masthead';
import NewsFeed from '@/components/NewsFeed';
import Brand from '@/components/Brand';
import { getPublished } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const articles = await getPublished(40);

  return (
    <>
      <Masthead />
      <main className="wrap">
        <NewsFeed articles={articles} emptyMsg="Пока нет опубликованных новостей." />
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
