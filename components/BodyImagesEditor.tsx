'use client';
import { useMemo, useState } from 'react';
import { listBodyFigures, removeFigureAt, appendFigure, updateFigureAt } from '@/lib/article-images';

export default function BodyImagesEditor({
  articleId,
  bodyHtml,
  onChange
}: {
  articleId: number;
  bodyHtml: string;
  onChange: (next: string) => void;
}) {
  const figures = useMemo(() => listBodyFigures(bodyHtml), [bodyHtml]);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function remove(i: number) {
    onChange(removeFigureAt(bodyHtml, i));
  }
  function setCaption(i: number, caption: string) {
    onChange(updateFigureAt(bodyHtml, i, { caption }));
  }
  function setAlt(i: number, alt: string) {
    onChange(updateFigureAt(bodyHtml, i, { alt }));
  }
  function setSrc(i: number, src: string) {
    onChange(updateFigureAt(bodyHtml, i, { src }));
  }

  async function uploadAndAppend(file: File) {
    setUploading(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.append('articleId', String(articleId));
      fd.append('file', file);
      const r = await fetch('/api/admin/upload-image', { method: 'POST', body: fd });
      const d = await r.json();
      if (d.ok && d.url) {
        onChange(appendFigure(bodyHtml, { src: d.url, alt: '', caption: '' }));
      } else {
        setErr(d.error ?? 'не удалось загрузить');
      }
    } catch (e: any) {
      setErr(e.message ?? 'сеть');
    }
    setUploading(false);
  }

  return (
    <div style={{ border: '1px dashed #d6d6e0', borderRadius: 8, padding: 10, marginBottom: 10, background: '#fafafe' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <strong style={{ fontSize: 13 }}>Изображения в теле статьи ({figures.length})</strong>
        <label
          style={{
            padding: '6px 10px',
            fontSize: 12,
            border: '1px solid #c2c2d0',
            borderRadius: 6,
            background: '#fff',
            cursor: uploading ? 'wait' : 'pointer'
          }}
        >
          {uploading ? 'Загружаю…' : '＋ Добавить фото'}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            style={{ display: 'none' }}
            disabled={uploading}
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) uploadAndAppend(f);
              e.target.value = '';
            }}
          />
        </label>
      </div>
      {err && <div style={{ color: '#b00020', fontSize: 12, marginBottom: 6 }}>Ошибка: {err}</div>}
      {figures.length === 0 ? (
        <div style={{ fontSize: 12, color: '#666' }}>В теле нет изображений. Кнопка выше добавит новое в конец.</div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {figures.map(f => (
            <div
              key={f.index}
              style={{
                display: 'grid',
                gridTemplateColumns: '90px 1fr auto',
                gap: 10,
                alignItems: 'flex-start',
                background: '#fff',
                border: '1px solid #e6e6ee',
                borderRadius: 6,
                padding: 8
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={f.src}
                alt={f.alt}
                referrerPolicy="no-referrer"
                style={{ width: 90, height: 60, objectFit: 'cover', borderRadius: 4, background: '#eee' }}
              />
              <div style={{ display: 'grid', gap: 4, minWidth: 0 }}>
                <input
                  type="url"
                  value={f.src}
                  onChange={e => setSrc(f.index, e.target.value)}
                  placeholder="URL"
                  style={{ fontSize: 16, padding: '6px 8px', border: '1px solid #d6d6e0', borderRadius: 4 }}
                />
                <input
                  type="text"
                  value={f.alt}
                  onChange={e => setAlt(f.index, e.target.value)}
                  placeholder="alt — описание для поиска и доступности"
                  style={{ fontSize: 16, padding: '6px 8px', border: '1px solid #d6d6e0', borderRadius: 4 }}
                />
                <input
                  type="text"
                  value={f.caption}
                  onChange={e => setCaption(f.index, e.target.value)}
                  placeholder="подпись под фото"
                  style={{ fontSize: 16, padding: '6px 8px', border: '1px solid #d6d6e0', borderRadius: 4 }}
                />
              </div>
              <button
                type="button"
                onClick={() => remove(f.index)}
                title="Удалить изображение"
                style={{
                  padding: '6px 10px',
                  fontSize: 12,
                  background: '#fff5f5',
                  border: '1px solid #f0bcbc',
                  color: '#b00020',
                  borderRadius: 6,
                  cursor: 'pointer'
                }}
              >
                ✕ удалить
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
