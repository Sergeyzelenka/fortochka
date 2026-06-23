import { Article } from '@/lib/types';

// height приходит из колл-сайта только как дефолт для десктопа.
// Реальная высота задаётся CSS-классом контейнера (.lead-main .art,
// .fcard .art и т.д.), а на мобиле перебивается на aspect-ratio.
// Инлайн-style не используем, иначе он перебивал бы все @media-правила.
export default function Cover({ a }: { a: Article; height?: number }) {
  return (
    <div className="art">
      {a.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={a.image_url} alt={a.title ?? ''} referrerPolicy="no-referrer" loading="lazy" />
      ) : a.cover_svg ? (
        <span dangerouslySetInnerHTML={{ __html: a.cover_svg }} />
      ) : null}
    </div>
  );
}
