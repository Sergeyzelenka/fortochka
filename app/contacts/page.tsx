import type { Metadata } from 'next';
import Masthead from '@/components/Masthead';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Контакты',
  description: 'Связаться с редакцией ФОРТОЧКА.'
};

export default function ContactsPage() {
  return (
    <>
      <Masthead />
      <article className="static-page">
        <Link href="/" className="back-link">← Ко всем новостям</Link>
        <h1 style={{ marginTop: 22 }}>Контакты</h1>
        <p className="lead">
          Мы открыты к диалогу. Пишите про ошибки в статьях, предлагайте новые источники, делитесь идеями — каждое письмо читаем.
        </p>

        <h2>Редакция</h2>
        <div className="contact-card">
          <b>Электронная почта</b>
          <a href="mailto:brainstormingalways@gmail.com">brainstormingalways@gmail.com</a>
        </div>

        <h2>Соцсети</h2>
        <div className="contact-card">
          <b>Telegram-канал</b>
          <a href="https://t.me/Fortochka_goodnews" target="_blank" rel="noreferrer">t.me/Fortochka_goodnews</a>
        </div>

        <h2>О чём писать</h2>
        <ul>
          <li><b>Заметили ошибку в статье?</b> Сообщите, и мы её исправим в течение дня.</li>
          <li><b>Знаете хороший источник позитивных новостей?</b> Поделитесь — добавим в список.</li>
          <li><b>Хотите предложить материал?</b> Пришлите ссылку и пару строк, чем эта история важна.</li>
          <li><b>Реклама и партнёрство.</b> Расскажите о себе, и мы обсудим формат.</li>
        </ul>

        <p style={{ marginTop: 30, color: 'var(--ink-3)', fontSize: 14 }}>
          О том, как мы работаем — на странице <Link href="/about">«О проекте»</Link>. Полный список источников и редакционные принципы — на странице <Link href="/sources">«Источники и принципы»</Link>.
        </p>
      </article>
    </>
  );
}
