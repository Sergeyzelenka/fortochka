'use client';
import { useState } from 'react';
import Link from 'next/link';
import { CATEGORIES } from '@/lib/types';
import type { SourceRow } from '@/app/admin/sources/page';
import WorkerStatus from '@/components/WorkerStatus';
import Brand from '@/components/Brand';
import LogoutLink from '@/components/LogoutLink';

export default function SourcesAdmin({
  initial, mock
}: { initial: SourceRow[]; mock: boolean }) {
  const [items, setItems] = useState<SourceRow[]>(initial);
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState<number | 'new' | null>(null);
  const [form, setForm] = useState({ name: '', rss_url: '', default_category: '' });

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  async function call(method: string, body: any) {
    const res = await fetch('/api/admin/sources', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return res.json();
  }

  async function toggle(s: SourceRow) {
    setBusy(s.id);
    const r = await call('PATCH', { id: s.id, enabled: !s.enabled });
    if (r.source) {
      setItems(prev => prev.map(x => x.id === s.id ? r.source : x));
      flash(r.source.enabled ? 'Включено' : 'Выключено');
    } else flash(r.error ?? 'Ошибка');
    setBusy(null);
  }

  async function remove(s: SourceRow) {
    if (!confirm(`Удалить «${s.name}»? Уже скачанные новости останутся.`)) return;
    setBusy(s.id);
    const r = await call('DELETE', { id: s.id });
    if (r.ok) {
      setItems(prev => prev.filter(x => x.id !== s.id));
      flash('Удалено');
    } else flash(r.error ?? 'Ошибка');
    setBusy(null);
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.rss_url.trim()) return;
    setBusy('new');
    const r = await call('POST', {
      name: form.name,
      rss_url: form.rss_url,
      default_category: form.default_category || null
    });
    if (r.source) {
      setItems(prev => [...prev, r.source]);
      setForm({ name: '', rss_url: '', default_category: '' });
      flash('Источник добавлен');
    } else flash(r.error ?? 'Ошибка');
    setBusy(null);
  }

  const catName = (id: number | null) =>
    id ? (CATEGORIES.find(c => c.id === id)?.name ?? '—') : '— (по фильтру)';

  return (
    <div className="admin">
      <div className="adm-head">
        <div className="wrap">
          <div className="ttl">
            <Brand size={22} tone="light" />
            <span className="sect">Редакция · источники · {items.length}</span>
          </div>
          <div style={{ fontSize: 13 }}>
            <WorkerStatus />
            <LogoutLink />
          </div>
        </div>
      </div>
      <div className="wrap" style={{ paddingTop: 28 }}>
        <p style={{ marginBottom: 20, display: 'flex', gap: 16 }}>
          <Link href="/admin" style={{ color: 'var(--ink-2)' }}>← К очереди публикаций</Link>
          <Link href="/admin/logs" style={{ color: 'var(--ink-2)' }}>Логи воркера →</Link>
        </p>

        {mock && <p className="empty">Мок-режим: Supabase не настроен, редактирование недоступно.</p>}

        <form onSubmit={add} className="src-add">
          <h3 style={{ marginBottom: 12 }}>Добавить источник</h3>
          <div className="src-form-row">
            <input
              placeholder="Название (например, Naked Science)"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              required
            />
            <input
              placeholder="https://example.com/feed/"
              value={form.rss_url}
              onChange={e => setForm(f => ({ ...f, rss_url: e.target.value }))}
              required
            />
            <select
              value={form.default_category}
              onChange={e => setForm(f => ({ ...f, default_category: e.target.value }))}
            >
              <option value="">Рубрика — по фильтру</option>
              {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button className="abtn ok" disabled={busy === 'new' || mock}>Добавить</button>
          </div>
        </form>

        <div className="src-table">
          {items.map(s => (
            <div key={s.id} className={`src-row${s.enabled ? '' : ' off'}`}>
              <div className="src-main">
                <div className="src-name">{s.name}</div>
                <a className="src-url" href={s.rss_url} target="_blank" rel="noreferrer">{s.rss_url}</a>
                <div className="src-meta">
                  <span>Рубрика по умолчанию: {catName(s.default_category)}</span>
                  {s.last_fetched_at && (
                    <>
                      <span className="sep" />
                      <span>Последний сбор: {new Date(s.last_fetched_at).toLocaleString('ru-RU')}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="src-actions">
                <button
                  className={`abtn ${s.enabled ? 'no' : 'ok'}`}
                  onClick={() => toggle(s)}
                  disabled={busy === s.id || mock}
                >
                  {s.enabled ? 'Выключить' : 'Включить'}
                </button>
                <button
                  className="abtn no"
                  onClick={() => remove(s)}
                  disabled={busy === s.id || mock}
                  style={{ opacity: 0.7 }}
                >
                  Удалить
                </button>
              </div>
            </div>
          ))}
          {items.length === 0 && !mock && <p className="empty">Источников пока нет.</p>}
        </div>
      </div>
      <div className={`toast${toast ? ' show' : ''}`}>{toast}</div>
    </div>
  );
}
