'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Article, CATEGORIES, catById } from '@/lib/types';
import WorkerStatus from '@/components/WorkerStatus';
import WorkerProgress from '@/components/WorkerProgress';
import QuotaPanel from '@/components/QuotaPanel';
import Brand from '@/components/Brand';
import LogoutLink from '@/components/LogoutLink';
import BodyImagesEditor from '@/components/BodyImagesEditor';

export default function AdminQueue({ initial }: { initial: Article[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [leaving, setLeaving] = useState<number | null>(null);
  const [toast, setToast] = useState('');
  const [cats, setCats] = useState<Record<number, number>>({});
  const [illustrating, setIllustrating] = useState<number | null>(null);
  const [redrafting, setRedrafting] = useState<{ id: number; model: string } | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<{ title: string; dek: string; body_html: string; tg_excerpt: string; image_url: string }>({ title: '', dek: '', body_html: '', tg_excerpt: '', image_url: '' });
  const [savingEdit, setSavingEdit] = useState(false);
  const [uploadingCover, setUploadingCover] = useState<number | null>(null);
  // id статей, которые мы уже опубликовали/отклонили в этой сессии — чтобы
  // фоновое автообновление не возвращало их в очередь из-за задержки базы.
  const decidedIds = useRef<Set<number>>(new Set());

  async function uploadCoverFile(a: Article, file: File) {
    setUploadingCover(a.id);
    try {
      const fd = new FormData();
      fd.append('id', String(a.id));
      fd.append('file', file);
      const res = await fetch('/api/admin/upload-cover', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.ok && data.image_url) {
        setItems(prev => prev.map(x => x.id === a.id ? { ...x, image_url: data.image_url, cover_svg: null } : x));
        if (editingId === a.id) setEditForm(f => ({ ...f, image_url: data.image_url }));
        flash('Обложка загружена');
      } else {
        flash(data.error ?? 'Не удалось загрузить');
      }
    } catch (e: any) {
      flash(e.message ?? 'Ошибка сети');
    }
    setUploadingCover(null);
  }

  function startEdit(a: Article) {
    setEditingId(a.id);
    setEditForm({
      title: a.title ?? '',
      dek: a.dek ?? '',
      body_html: a.body_html ?? '',
      tg_excerpt: a.tg_excerpt ?? '',
      image_url: a.image_url ?? ''
    });
  }
  function cancelEdit() { setEditingId(null); }
  async function saveEdit(a: Article) {
    setSavingEdit(true);
    try {
      const res = await fetch('/api/admin/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: a.id, patch: editForm })
      });
      const data = await res.json();
      if (data.ok) {
        setItems(prev => prev.map(x => x.id === a.id ? { ...x, ...data.patch } : x));
        setEditingId(null);
        flash('Изменения сохранены');
      } else {
        flash(data.error ?? 'Не удалось сохранить');
      }
    } catch (e: any) {
      flash(e.message ?? 'Ошибка сети');
    }
    setSavingEdit(false);
  }
  const [running, setRunning] = useState<string | null>(null);
  const [draftCatId, setDraftCatId] = useState<number | ''>('');
  const [filteredCounts, setFilteredCounts] = useState<Record<number, number>>({});
  const [filteredTotal, setFilteredTotal] = useState<number>(0);

  useEffect(() => {
    let alive = true;
    async function tickCounts() {
      try {
        const r = await fetch('/api/admin/filtered-counts', { cache: 'no-store' });
        if (!r.ok) return;
        const d = await r.json();
        if (alive) {
          setFilteredCounts(d.counts ?? {});
          setFilteredTotal(d.total ?? 0);
        }
      } catch { /* тихо */ }
    }
    async function tickPending() {
      // Не дёргаем во время активного действия — может перетереть локальные изменения.
      if (leaving || illustrating || redrafting) return;
      try {
        const r = await fetch('/api/admin/pending', { cache: 'no-store' });
        if (!r.ok) return;
        const d = await r.json();
        if (!alive || !Array.isArray(d.items)) return;
        // Отбрасываем статьи, которые мы только что опубликовали/отклонили:
        // база могла ещё не успеть отдать новый статус.
        const fresh = d.items.filter((x: Article) => !decidedIds.current.has(x.id));
        setItems(fresh.map((x: Article) => ({ ...x })));
      } catch { /* тихо */ }
    }
    tickCounts(); tickPending();
    const idCounts = setInterval(tickCounts, 8000);
    const idPending = setInterval(tickPending, 10000);
    return () => { alive = false; clearInterval(idCounts); clearInterval(idPending); };
  }, [leaving, illustrating, redrafting, cats]);

  async function redraft(a: Article, model: 'groq' | 'gemini') {
    setRedrafting({ id: a.id, model });
    try {
      const res = await fetch('/api/admin/redraft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: a.id, model })
      });
      const data = await res.json();
      if (data.ok && data.article) {
        setItems(prev => prev.map(x => x.id === a.id ? { ...x, ...data.article } : x));
        flash(`Переписано через ${model === 'gemini' ? 'Gemini' : 'Groq'}`);
      } else {
        flash(data.error ?? 'Не получилось переписать');
      }
    } catch (e: any) {
      flash(e.message ?? 'Ошибка сети');
    }
    setRedrafting(null);
  }

  async function runWorker(steps: string[], label: string, opts: { useCategory?: boolean } = {}) {
    setRunning(label);
    try {
      const body: any = { steps };
      if (opts.useCategory && draftCatId) body.categoryId = Number(draftCatId);
      const res = await fetch('/api/admin/run-worker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const d = await res.json();
      if (d.ok) {
        const newP = d.delta?.newPending ?? 0;
        flash(newP > 0 ? `Готово за ${d.elapsedSec}с. Новых на апруве: +${newP}` : `Готово за ${d.elapsedSec}с. Новых пока нет.`);
      } else {
        flash(`Сделано: ${d.ran?.join(', ') ?? '—'}. Ошибки: ${d.errors?.map((e: any) => e.step).join(', ')}`);
      }
      router.refresh();
    } catch (e: any) {
      flash(e.message ?? 'Ошибка сети');
    }
    setRunning(null);
  }

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  }

  async function illustrate(a: Article) {
    setIllustrating(a.id);
    try {
      const res = await fetch('/api/admin/illustrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: a.id })
      });
      const data = await res.json();
      if (data.url) {
        setItems(prev => prev.map(x => x.id === a.id ? { ...x, image_url: data.url } : x));
        flash('Иллюстрация сгенерирована');
      } else {
        flash(data.error ?? 'Не получилось сгенерировать');
      }
    } catch (e: any) {
      flash(e.message ?? 'Ошибка сети');
    }
    setIllustrating(null);
  }

  async function decide(a: Article, approve: boolean) {
    setLeaving(a.id);
    // Запоминаем id обработанных статей, чтобы автообновление очереди не
    // затянуло их обратно из-за задержки репликации базы.
    decidedIds.current.add(a.id);
    try {
      const res = await fetch('/api/admin/decide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: a.id,
          approve,
          category_id: cats[a.id] ?? a.category_id
        })
      });
      const data = await res.json();
      if (data.ok) {
        // Убираем карточку сразу (с короткой анимацией ухода).
        setTimeout(() => setItems(prev => prev.filter(x => x.id !== a.id)), 300);
        setToast(data.message ?? (approve ? 'Опубликовано' : 'Отклонено'));
      } else {
        // Ошибка — карточку оставляем, чтобы можно было повторить.
        decidedIds.current.delete(a.id);
        setToast(data.error ?? 'Не удалось. Попробуй ещё раз.');
      }
    } catch (e: any) {
      decidedIds.current.delete(a.id);
      setToast(e.message ?? 'Ошибка сети');
    }
    setLeaving(null);
    setTimeout(() => setToast(''), 3500);
  }

  return (
    <div className="admin">
      <div className="adm-head">
        <div className="wrap">
          <div className="ttl">
            <Brand size={22} tone="light" />
            <span className="sect">Редакция · очередь публикаций · {items.length} на апруве</span>
          </div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', fontSize: 13 }}>
            <WorkerStatus />
            <Link href="/admin/sources" style={{ color: '#9AA3B5' }}>Источники</Link>
            <Link href="/admin/logs" style={{ color: '#9AA3B5' }}>Логи</Link>
            <LogoutLink />
          </div>
        </div>
      </div>
      <div className="wrap" style={{ paddingTop: 28 }}>
        <WorkerProgress />
        <QuotaPanel />
        <div className="worker-bar">
          <div className="wb-text">
            <b>Подкинуть свежих новостей</b>
            <span>Прогон по 13 источникам, фильтрация и подготовка черновиков. Обычно 1-3 минуты.</span>
          </div>
          <div className="wb-actions">
            <button
              className="abtn ok"
              disabled={!!running}
              onClick={() => runWorker(['collect', 'filter', 'draft'], 'Полный прогон')}
            >
              {running === 'Полный прогон' ? 'Идёт прогон…' : '🔄 Запустить полный прогон'}
            </button>
            <details className="wb-more">
              <summary>Отдельные шаги</summary>
              <div className="wb-sub">
                <button className="abtn no" disabled={!!running} onClick={() => runWorker(['collect'], 'Только сбор')}>
                  {running === 'Только сбор' ? 'Собираю…' : 'Только сбор RSS'}
                </button>
                <button className="abtn no" disabled={!!running} onClick={() => runWorker(['filter'], 'Только фильтр')}>
                  {running === 'Только фильтр' ? 'Фильтрую…' : 'Только фильтр (Groq)'}
                </button>
                {(() => {
                  const availableInCat = draftCatId ? (filteredCounts[Number(draftCatId)] ?? 0) : filteredTotal;
                  const noContent = availableInCat === 0;
                  return (
                    <div className="wb-draft-row">
                      <select
                        className="wb-cat-select"
                        value={draftCatId}
                        onChange={e => setDraftCatId(e.target.value ? Number(e.target.value) : '')}
                        disabled={!!running}
                      >
                        <option value="">Все рубрики ({filteredTotal})</option>
                        {CATEGORIES.map(c => {
                          const n = filteredCounts[c.id] ?? 0;
                          return <option key={c.id} value={c.id} disabled={n === 0}>{c.name} ({n})</option>;
                        })}
                      </select>
                      <button
                        className="abtn no"
                        disabled={!!running || noContent}
                        title={noContent ? 'В этой рубрике пока нет статей для переписывания' : ''}
                        onClick={() => runWorker(['draft'], 'Драфт Groq', { useCategory: true })}
                      >
                        {running === 'Драфт Groq' ? 'Пишу через Groq…' : `Драфт через Groq${availableInCat > 0 ? ` · ${Math.min(availableInCat, 5)}` : ''}`}
                      </button>
                      <button
                        className="abtn no"
                        disabled={!!running || noContent}
                        title={noContent ? 'В этой рубрике пока нет статей для переписывания' : ''}
                        onClick={() => runWorker(['draft-gemini'], 'Драфт Gemini', { useCategory: true })}
                      >
                        {running === 'Драфт Gemini' ? 'Пишу через Gemini…' : `Драфт через Gemini${availableInCat > 0 ? ` · ${Math.min(availableInCat, 5)}` : ''}`}
                      </button>
                      {noContent && (
                        <div className="wb-warn">
                          В выбранной рубрике сейчас 0 статей в очереди. Выбери другую рубрику или «Все рубрики».
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </details>
          </div>
        </div>
        {items.length === 0 && <p className="empty">Очередь пуста. Жми «Запустить полный прогон», чтобы подкинуть свежих новостей.</p>}
        {items.map(a => {
          const cat = catById(a.category_id);
          const scoreClass = (a.score ?? 0) >= 8.5 ? 'hi' : 'mid';
          return (
            <div key={a.id} className={`q-card${leaving === a.id ? ' gone' : ''}`}>
              <div className="q-grid">
                <div className={`q-score ${scoreClass}`}><b>{a.score?.toFixed(1) ?? '—'}</b><span>скор</span></div>
                <div className="q-main">
                  <span className="cat" style={{ color: cat.color }}>{cat.name}</span>
                  {editingId === a.id ? (
                    <input
                      className="edit-input edit-input-title"
                      value={editForm.title}
                      onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                      placeholder="Заголовок"
                    />
                  ) : (
                    <h3>{a.title}</h3>
                  )}
                  <div className="meta">
                    <span>{a.source_name}</span>
                    {a.source_url && (
                      <>
                        <span className="sep" />
                        <a href={a.source_url} target="_blank" rel="noopener noreferrer" className="source-link">
                          🔗 источник
                        </a>
                      </>
                    )}
                    {a.draft_model && (
                      <>
                        <span className="sep" />
                        <span className={`model-badge model-${a.draft_model}`}>
                          ✎ {a.draft_model === 'gemini' ? 'Gemini' : a.draft_model === 'groq' ? 'Groq' : a.draft_model}
                        </span>
                      </>
                    )}
                    {a.ai_reason && (<><span className="sep" /><span>фильтр: {a.ai_reason}</span></>)}
                  </div>
                  {editingId === a.id && (
                    <textarea
                      className="edit-input edit-input-dek"
                      value={editForm.dek}
                      onChange={e => setEditForm(f => ({ ...f, dek: e.target.value }))}
                      placeholder="Подзаголовок (dek)"
                      rows={2}
                    />
                  )}
                  <div className="q-cover">
                    {(editingId === a.id ? editForm.image_url : a.image_url) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={editingId === a.id ? editForm.image_url : a.image_url!} alt="" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="q-no-cover">
                        <span>Обложки нет — будет SVG-плашка по рубрике</span>
                        <button
                          className="abtn ok"
                          onClick={() => illustrate(a)}
                          disabled={illustrating === a.id}
                          style={{ padding: '8px 14px', fontSize: 13 }}
                        >
                          {illustrating === a.id ? 'Генерирую…' : '🎨 Сгенерировать иллюстрацию'}
                        </button>
                      </div>
                    )}
                    {editingId === a.id && (
                      <>
                        <input
                          className="edit-input"
                          type="url"
                          value={editForm.image_url}
                          onChange={e => setEditForm(f => ({ ...f, image_url: e.target.value }))}
                          placeholder="URL обложки (https://...) — пусто, чтобы убрать"
                          style={{ marginTop: 8, width: '100%' }}
                        />
                        <label
                          className="abtn ok"
                          style={{ marginTop: 6, padding: '6px 10px', fontSize: 12, display: 'inline-block', cursor: uploadingCover === a.id ? 'wait' : 'pointer' }}
                        >
                          {uploadingCover === a.id ? 'Загружаю…' : '📤 Загрузить с устройства'}
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/gif"
                            style={{ display: 'none' }}
                            disabled={uploadingCover === a.id}
                            onChange={e => {
                              const f = e.target.files?.[0];
                              if (f) uploadCoverFile(a, f);
                              e.target.value = '';
                            }}
                          />
                        </label>
                      </>
                    )}
                  </div>
                  <div className="q-texts">
                    <div>
                      <h4>Статья для сайта</h4>
                      {editingId === a.id ? (
                        <>
                          <BodyImagesEditor
                            articleId={a.id}
                            bodyHtml={editForm.body_html}
                            onChange={next => setEditForm(f => ({ ...f, body_html: next }))}
                          />
                          <textarea
                            className="edit-input edit-input-body"
                            value={editForm.body_html}
                            onChange={e => setEditForm(f => ({ ...f, body_html: e.target.value }))}
                            rows={10}
                          />
                        </>
                      ) : (
                        <div className="txt" dangerouslySetInnerHTML={{ __html: a.body_html ?? '' }} />
                      )}
                    </div>
                    <div>
                      <h4>Анонс для Telegram</h4>
                      {editingId === a.id ? (
                        <textarea
                          className="edit-input edit-input-tg"
                          value={editForm.tg_excerpt}
                          onChange={e => setEditForm(f => ({ ...f, tg_excerpt: e.target.value }))}
                          rows={5}
                        />
                      ) : (
                        <div className="txt">{a.tg_excerpt}</div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="q-side">
                  <label>Рубрика</label>
                  <select
                    value={cats[a.id] ?? a.category_id ?? 6}
                    onChange={e => setCats(p => ({ ...p, [a.id]: Number(e.target.value) }))}
                  >
                    {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <div className="spacer" />
                  {editingId === a.id ? (
                    <>
                      <button className="abtn ok" onClick={() => saveEdit(a)} disabled={savingEdit}>
                        {savingEdit ? 'Сохраняю…' : '✓ Сохранить правки'}
                      </button>
                      <button className="abtn no" onClick={cancelEdit} disabled={savingEdit}>
                        Отмена
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="redraft-row">
                        <button
                          className="redraft-btn"
                          onClick={() => redraft(a, 'groq')}
                          disabled={!!redrafting || !!leaving}
                          title="Переписать через Groq"
                        >
                          {redrafting?.id === a.id && redrafting.model === 'groq' ? '…' : '↻ Groq'}
                        </button>
                        <button
                          className="redraft-btn"
                          onClick={() => redraft(a, 'gemini')}
                          disabled={!!redrafting || !!leaving}
                          title="Переписать через Gemini"
                                       >
                          {redrafting?.id === a.id && redrafting.model === 'gemini' ? '…' : '↻ Gemini'}
                        </button>
                      </div>
                      <button
                        className="redraft-btn"
                        onClick={() => startEdit(a)}
                        disabled={!!redrafting || !!leaving}
                        title="Править вручную"
                        style={{ marginBottom: 6 }}
                      >
                        ✎ Редактировать
                      </button>
                      <button className="abtn ok" onClick={() => decide(a, true)} disabled={leaving === a.id}>
                        Опубликовать: сайт + Telegram
                      </button>
                      <button className="abtn no" onClick={() => decide(a, false)} disabled={leaving === a.id}>
                        Отклонить
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className={`toast${toast ? ' show' : ''}`}>{toast}</div>
    </div>
  );
}
