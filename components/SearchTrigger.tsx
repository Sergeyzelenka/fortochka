'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

export default function SearchTrigger() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
      document.addEventListener('keydown', onKey);
      return () => document.removeEventListener('keydown', onKey);
    }
  }, [open]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = q.trim();
    if (!v) return;
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(v)}`);
  }

  return (
    <>
      <button
        className="tool-btn"
        type="button"
        onClick={() => setOpen(true)}
        title="Поиск"
        aria-label="Открыть поиск"
      >
        <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" />
        </svg>
      </button>
      {open && (
        <div className="search-overlay" onClick={() => setOpen(false)}>
          <form className="search-bar" onSubmit={submit} onClick={(e) => e.stopPropagation()}>
            <svg viewBox="0 0 24 24" className="search-bar-ico" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
            <input
              ref={inputRef}
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Поиск по статьям…"
              aria-label="Поиск"
            />
            <button type="button" className="search-bar-close" onClick={() => setOpen(false)} aria-label="Закрыть">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </form>
        </div>
      )}
    </>
  );
}
