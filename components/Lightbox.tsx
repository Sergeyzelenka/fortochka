'use client';
import { useEffect, useState, useCallback } from 'react';

interface Selection {
  src: string;
  alt: string;
  caption: string;
}

// Глобальный lightbox: ловит клики по <img> внутри figure на страницах статьи
// (hero-fig и .prose figure) и открывает фото на полный экран с подписью.
export default function Lightbox() {
  const [sel, setSel] = useState<Selection | null>(null);

  const close = useCallback(() => setSel(null), []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t || t.tagName !== 'IMG') return;
      const fig = t.closest('figure');
      if (!fig) return;
      // Только figure внутри hero-fig или .prose
      const inProse = fig.closest('.prose');
      const isHero = fig.classList.contains('hero-fig') && !fig.classList.contains('hero-svg');
      if (!inProse && !isHero) return;
      e.preventDefault();
      const img = t as HTMLImageElement;
      const captionEl = fig.querySelector('figcaption');
      setSel({
        src: img.src,
        alt: img.alt ?? '',
        caption: captionEl?.textContent?.trim() ?? ''
      });
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  useEffect(() => {
    if (!sel) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [sel, close]);

  if (!sel) return null;
  return (
    <div className="lightbox" role="dialog" aria-modal="true" onClick={close}>
      <button className="lightbox-close" type="button" onClick={close} aria-label="Закрыть">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
      </button>
      <figure className="lightbox-fig" onClick={(e) => e.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={sel.src} alt={sel.alt} referrerPolicy="no-referrer" />
        {sel.caption && <figcaption>{sel.caption}</figcaption>}
      </figure>
    </div>
  );
}
