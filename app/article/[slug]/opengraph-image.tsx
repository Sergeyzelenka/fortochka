// Авто-генерация OG-картинки для статьи (1200×630) — превью при шере
// в Telegram, WhatsApp, Twitter, LinkedIn и т.д.
// Next.js подхватывает этот файл по конвенции и подставляет его в og:image.

import { ImageResponse } from 'next/og';
import { getBySlug } from '@/lib/db';
import { catById } from '@/lib/types';

export const runtime = 'nodejs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'ФОРТОЧКА';

export default async function Image({ params }: { params: { slug: string } }) {
  const a = await getBySlug(params.slug);
  const title = a?.title ?? a?.raw_title ?? 'ФОРТОЧКА';
  const dek = a?.dek ?? '';
  const cat = a ? catById(a.category_id) : null;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          padding: '64px 72px',
          background: '#FAFAF7',
          backgroundImage: 'linear-gradient(135deg, #FAFAF7 0%, #EDE7DA 100%)',
          color: '#15171C'
        }}
      >
        {/* Верхняя строка: логотип слева, рубрика-плашка справа */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{ fontSize: 56, fontWeight: 700, letterSpacing: 4, color: '#15171C' }}>
              ФОРТОЧКА
            </span>
            <span style={{
              width: 14, height: 14, marginLeft: 6,
              background: '#F2B22D', borderRadius: '50%'
            }} />
          </div>
          {cat && (
            <div style={{
              display: 'flex', alignItems: 'center',
              padding: '12px 28px',
              background: cat.color, color: '#FAFAF7',
              fontSize: 22, fontWeight: 700, letterSpacing: 2,
              textTransform: 'uppercase',
              borderRadius: 999
            }}>
              {cat.name}
            </div>
          )}
        </div>

        {/* Главный заголовок */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center',
          marginTop: 28
        }}>
          <div style={{
            fontSize: title.length > 90 ? 54 : 64,
            fontWeight: 700,
            lineHeight: 1.1,
            letterSpacing: '-1px',
            color: '#15171C'
          }}>
            {title}
          </div>
          {dek && (
            <div style={{
              fontSize: 26, lineHeight: 1.35, marginTop: 18,
              color: '#4A4E58', maxWidth: '90%'
            }}>
              {dek.length > 180 ? dek.slice(0, 178) + '…' : dek}
            </div>
          )}
        </div>

        {/* Нижняя подпись */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          fontSize: 22, color: '#5B5D63',
          borderTop: '2px solid rgba(21,23,28,.12)',
          paddingTop: 22
        }}>
          <span>глоток свежих новостей</span>
          <span>fortochka · {a?.source_name ?? ''}</span>
        </div>
      </div>
    ),
    size
  );
}
