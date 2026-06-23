'use client';
import { useEffect, useState } from 'react';

interface Props {
  color: string;
  // CSS-селектор контейнера, по которому считаем прогресс.
  target?: string;
}

export default function ReadingProgress({ color, target = '.art-page' }: Props) {
  const [pct, setPct] = useState(0);

  useEffect(() => {
    const el = document.querySelector<HTMLElement>(target);
    if (!el) return;

    const onScroll = () => {
      const rect = el.getBoundingClientRect();
      const total = el.scrollHeight - window.innerHeight;
      const scrolled = Math.max(0, Math.min(total, -rect.top));
      setPct(total > 0 ? (scrolled / total) * 100 : 0);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [target]);

  return (
    <div className="reading-progress" aria-hidden="true">
      <div style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}
