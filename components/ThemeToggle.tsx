'use client';
import { useState } from 'react';

type Theme = 'light' | 'dark';
const KEY = 'fortochka-theme';

function readInitialTheme(): Theme {
  if (typeof document === 'undefined') return 'light';
  // <html data-theme="..."> уже выставлен init-скриптом в layout.tsx до hydration.
  // Читаем его синхронно, чтобы при переходах не было мигания светлого состояния.
  const t = document.documentElement.dataset.theme;
  return t === 'dark' ? 'dark' : 'light';
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(readInitialTheme);

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem(KEY, next); } catch { /* private mode */ }
    setTheme(next);
  }

  const isDark = theme === 'dark';
  return (
    <button
      className="theme-switch"
      type="button"
      onClick={toggle}
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? 'Включить светлую тему' : 'Включить тёмную тему'}
      title={isDark ? 'Светлая тема' : 'Тёмная тема'}
      data-state={isDark ? 'dark' : 'light'}
      suppressHydrationWarning
    >
      <span className="ts-icon ts-sun" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 2v2.4M12 19.6V22M3.5 12H1M23 12h-2.5M5.4 5.4l1.7 1.7M16.9 16.9l1.7 1.7M5.4 18.6l1.7-1.7M16.9 7.1l1.7-1.7" />
        </svg>
      </span>
      <span className="ts-icon ts-moon" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5 7 7 0 0 0 20.5 14.5z" />
        </svg>
      </span>
      <span className="ts-thumb" aria-hidden="true" />
    </button>
  );
}
