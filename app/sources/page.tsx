import type { Metadata } from 'next';
import Masthead from '@/components/Masthead';
import Link from 'next/link';
import { sbAnon, isMock } from '@/lib/db';
import { CATEGORIES } from '@/lib/types';

export const metadata: Metadata = {
  title: 'Источники и принципы',
  description: 'Редакционные принципы ФОРТОЧКА и полный список RSS-источников, с которыми мы работаем.'
};

export const revalidate = 3600;

interface SrcRow { id: number; name: string; default_category: number | null; enabled: boolean }

export default async function SourcesInfoPage() {
  let sources: SrcRow[] = [];
  if (!isMock) {
    const { data } = await sbAnon()
      .from('sources').select('id, name, default_category, enabled')
      .eq('enabled', true).order('name', { ascending: true });
    sources = (data as SrcRow[]) ?? [];
  }

  const catName = (id: number | null) =>
    id ? (CATEGORIES.find(c => c.id === id)?.name ?? 'разные') : 'разные рубрики';

  return (
    <>
      <Masthead />
      <article className="static-page">
        <Link href="/" className="back-link">← Ко всем новостям</Link>
        <h1 style={{ marginTop: 22 }}>Источники и принципы</h1>
        <p className="lead">
          Прозрачно о том, откуда мы берём материалы и по каким правилам отбираем их в публикацию. Если хотите предложить новый источник или сообщить о проблеме — пишите на <Link href="/contacts">страницу контактов</Link>.
        </p>

        <h2>Редакционные принципы</h2>
        <ol>
          <li><b>Только конструктив.</b> Научные открытия, истории доброты, экологические победы, успехи технологий, помогающих людям.</li>
          <li><b>Никакой политики, войн, катастроф, криминала.</b> Эти темы важны, но ими занимаются другие медиа. Наша роль другая.</li>
          <li><b>Каждый материал — со ссылкой на первоисточник.</b> Без этого статья не публикуется.</li>
          <li><b>Фотографии — с указанием источника.</b> Если автор фото известен, мы его называем.</li>
          <li><b>Никакого кликбейта.</b> Заголовок описывает содержание статьи, а не пытается выбить эмоциональную реакцию.</li>
          <li><b>Прозрачность по иллюстрациям.</b> Если обложка статьи нарисована ИИ — мы это пишем под иллюстрацией. У читателя должно быть право знать, что перед ним.</li>
        </ol>

        <h2>Откуда мы берём материалы</h2>
        <p>
          Сейчас ФОРТОЧКА работает со следующими источниками. Если издание поменяло формат RSS или временно недоступно, мы временно отключаем его и ищем альтернативу.
        </p>

        {sources.length === 0 ? (
          <p>Список источников будет доступен после первого запуска воркера.</p>
        ) : (
          <ul className="src-list">
            {sources.map(s => (
              <li key={s.id}>
                {s.name}
                <small>{catName(s.default_category)}</small>
              </li>
            ))}
          </ul>
        )}

        <h2>Как мы работаем с материалами</h2>
        <p>
          Каждая публикация проходит несколько этапов: мы отслеживаем источники, отбираем подходящие по редполитике материалы, переписываем их на русский с учётом наших правил и публикуем после редакторской проверки. Только материалы, прошедшие все этапы, попадают на сайт и в наш <a href="https://t.me/Fortochka_goodnews" target="_blank" rel="noreferrer">Telegram-канал</a>.
        </p>
      </article>
    </>
  );
}
