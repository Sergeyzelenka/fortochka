'use client';
import { useLayoutEffect, useRef } from 'react';
import Link from 'next/link';
import { CATEGORIES } from '@/lib/types';

// useLayoutEffect не работает при SSR. Подменяем на useEffect для серверного рендера,
// иначе React в dev будет ругаться варнингом.
const useIsoLayoutEffect = typeof window === 'undefined' ? () => {} : useLayoutEffect;

export default function CategoryNav({ active }: { active?: string }) {
  const navRef = useRef<HTMLElement>(null);

  useIsoLayoutEffect(() => {
    // При переходе на /cat/<slug> компонент перемонтируется и scrollLeft = 0.
    // Ставим позицию ДО первой отрисовки (useLayoutEffect + behavior:'instant'),
    // чтобы пользователь не видел анимации «от начала к активной».
    const root = navRef.current;
    if (!root) return;
    const link = root.querySelector<HTMLAnchorElement>('a.on');
    if (!link) return;
    const linkCenter = link.offsetLeft + link.offsetWidth / 2;
    const target = Math.max(0, linkCenter - root.clientWidth / 2);
    root.scrollLeft = target;
  }, [active]);

  return (
    <nav className="cat-nav" ref={navRef}>
      <Link href="/" className={!active ? 'on' : ''}>Главное</Link>
      {CATEGORIES.map((c) => (
        <Link
          key={c.slug}
          href={`/cat/${c.slug}`}
          className={active === c.slug ? 'on' : ''}
          style={active === c.slug ? ({ ['--cat-color' as any]: c.color }) : undefined}
        >
          {c.name}
        </Link>
      ))}
    </nav>
  );
}
