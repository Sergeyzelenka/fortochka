'use client';
import { useEffect, useState } from 'react';

type Kind = 'sun' | 'heart' | 'clap';
const KINDS: { key: Kind; label: string; icon: string }[] = [
  { key: 'sun',   label: 'Светло', icon: '☀' },
  { key: 'heart', label: 'Тепло',  icon: '❤' },
  { key: 'clap',  label: 'Браво',  icon: '👏' }
];

interface Props { slug: string; initialViews?: number }

const VID_KEY = 'fortochka_visitor';

function getOrCreateVisitorId(): string {
  if (typeof window === 'undefined') return '';
  try {
    let id = localStorage.getItem(VID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(VID_KEY, id);
    }
    return id;
  } catch {
    return '';
  }
}

export default function Reactions({ slug, initialViews = 0 }: Props) {
  const [vid, setVid] = useState<string>('');
  const [totals, setTotals] = useState<Record<Kind, number>>({ sun: 0, heart: 0, clap: 0 });
  const [mine, setMine] = useState<Record<Kind, boolean>>({ sun: false, heart: false, clap: false });
  const [busy, setBusy] = useState<Kind | null>(null);
  const [views, setViews] = useState<number>(initialViews);

  useEffect(() => {
    const id = getOrCreateVisitorId();
    setVid(id);
  }, []);

  // Инкремент просмотра один раз за сессию для конкретной статьи.
  useEffect(() => {
    const KEY = `fortochka_v_${slug}`;
    try {
      if (sessionStorage.getItem(KEY)) return;
    } catch { /* private mode */ }
    fetch(`/api/views/${encodeURIComponent(slug)}`, { method: 'POST' })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.views != null) setViews(d.views);
        try { sessionStorage.setItem(KEY, '1'); } catch { /* ignore */ }
      })
      .catch(() => { /* тихо */ });
  }, [slug]);

  useEffect(() => {
    if (!vid) return;
    let alive = true;
    fetch(`/api/reactions/${encodeURIComponent(slug)}?v=${encodeURIComponent(vid)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!alive || !d?.totals) return;
        setTotals(d.totals);
        setMine(d.mine ?? { sun: false, heart: false, clap: false });
      })
      .catch(() => { /* тихо */ });
    return () => { alive = false; };
  }, [vid, slug]);

  async function toggle(k: Kind) {
    if (!vid || busy) return;
    const isOn = mine[k];
    setBusy(k);
    // Оптимистично подкручиваем UI, чтобы не было задержки.
    setTotals(t => ({ ...t, [k]: Math.max(0, t[k] + (isOn ? -1 : 1)) }));
    setMine(m => ({ ...m, [k]: !isOn }));
    try {
      const r = await fetch(`/api/reactions/${encodeURIComponent(slug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitor_id: vid, kind: k, action: isOn ? 'remove' : 'add' })
      });
      const d = await r.json();
      if (d?.totals) {
        setTotals(d.totals);
        setMine(d.mine);
      }
    } catch {
      // откатимся
      setTotals(t => ({ ...t, [k]: Math.max(0, t[k] + (isOn ? 1 : -1)) }));
      setMine(m => ({ ...m, [k]: isOn }));
    }
    setBusy(null);
  }

  return (
    <div className="reactions" aria-label="Реакции на материал">
      {KINDS.map(({ key, label, icon }) => (
        <button
          key={key}
          type="button"
          className={`reaction${mine[key] ? ' on' : ''}`}
          onClick={() => toggle(key)}
          disabled={!vid}
          aria-pressed={mine[key]}
          title={label}
        >
          <span className="reaction-ico" aria-hidden="true">{icon}</span>
          <span className="reaction-label">{label}</span>
          <span className="reaction-count">{totals[key]}</span>
        </button>
      ))}
      <span className="reaction-views" title={`Прочитано ${views} раз`} aria-label={`Прочитано ${views} раз`}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        <span>{views}</span>
      </span>
    </div>
  );
}
