import Link from 'next/link';
import RelaxWindow from '@/components/RelaxWindow';
import Weather from '@/components/Weather';
import Brand from '@/components/Brand';
import ThemeToggle from '@/components/ThemeToggle';
import CategoryNav from '@/components/CategoryNav';
import SearchTrigger from '@/components/SearchTrigger';

export default function Masthead({ active }: { active?: string }) {
  const today = new Intl.DateTimeFormat('ru-RU', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  }).format(new Date());

  return (
    <>
      <header>
        <div className="util-line">
          <div className="wrap">
            <span className="util-meta">
              <span style={{ textTransform: 'capitalize' }}>{today}</span>
              <Weather />
            </span>
            <span className="util-actions">
              <a
                className="util-link util-tg"
                href="https://t.me/Fortochka_goodnews"
                target="_blank"
                rel="noreferrer"
                aria-label="Telegram-канал ФОРТОЧКА"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M21.5 4.5L2.8 11.7c-.8.3-.8 1.4 0 1.7l4.7 1.6 1.8 5.6c.2.7 1.1.9 1.6.3l2.6-2.9 4.8 3.5c.6.4 1.5.1 1.6-.7l2.6-15.2c.1-.9-.7-1.5-1.5-1.1zM8 14.9l9.5-7.8-7.4 8.6-.3 3.2-1.8-4z" />
                </svg>
                <span>Telegram</span>
              </a>
              <button className="util-link util-login" type="button">Войти</button>
            </span>
          </div>
        </div>
        <div className="wrap masthead">
          <Link href="/" aria-label="ФОРТОЧКА — на главную">
            <Brand size={40} />
          </Link>
          <div className="motto">глоток свежих новостей · каждый день</div>
        </div>
      </header>
      <div className="navrow">
        <div className="wrap">
          <CategoryNav active={active} />
          <div className="nav-tools">
            <SearchTrigger />
            <ThemeToggle />
            <RelaxWindow />
          </div>
        </div>
      </div>
    </>
  );
}
