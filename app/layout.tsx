import type { Metadata, Viewport } from 'next';
import './globals.css';
import ScrollToTop from '@/components/ScrollToTop';
import Lightbox from '@/components/Lightbox';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FAFAF7' },
    { media: '(prefers-color-scheme: dark)',  color: '#14171C' }
  ]
};

const THEME_INIT = `(function(){try{var s=localStorage.getItem('fortochka-theme');var t=s||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.dataset.theme=t;}catch(e){}})();`;

const SITE_URL = process.env.SITE_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'ФОРТОЧКА · глоток свежих новостей',
    template: '%s · ФОРТОЧКА'
  },
  description: 'Хороших новостей больше, чем плохих. Наука, экология, доброта и космос каждый день, со ссылкой на первоисточник.',
  openGraph: {
    type: 'website',
    locale: 'ru_RU',
    siteName: 'ФОРТОЧКА',
    title: 'ФОРТОЧКА · глоток свежих новостей',
    description: 'Хороших новостей больше, чем плохих. Наука, экология, доброта и космос каждый день.',
    url: SITE_URL
  },
  twitter: { card: 'summary_large_image' },
  alternates: {
    types: { 'application/rss+xml': '/rss.xml' }
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        {/* Применяем сохранённую тему до рендера, чтобы не было мигания */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
        {/* Чтобы встроенные <img> из чужих CMS не блокировались по Referer */}
        <meta name="referrer" content="no-referrer" />
      </head>
      <body>
        {children}
        <Lightbox />
        <ScrollToTop />
      </body>
    </html>
  );
}
