'use client';
import { useState } from 'react';

interface Props {
  url: string;
  title: string;
  dek?: string;
}

const TEXT_LIMIT = 200;

export default function ShareButtons({ url, title, dek }: Props) {
  const [copied, setCopied] = useState(false);
  const shareText = (dek ? `${title} — ${dek}` : title).slice(0, TEXT_LIMIT);
  const encUrl = encodeURIComponent(url);
  const encText = encodeURIComponent(shareText);
  const encTitle = encodeURIComponent(title);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // тихо игнорируем
    }
  }

  async function nativeShare() {
    if (typeof navigator !== 'undefined' && (navigator as any).share) {
      try {
        await (navigator as any).share({ title, text: shareText, url });
      } catch { /* пользователь отменил */ }
    } else {
      copyLink();
    }
  }

  return (
    <div className="share-block" aria-label="Поделиться материалом">
      <span className="share-title">Поделиться</span>
      <div className="share-buttons">
        <a
          className="share-btn share-tg"
          href={`https://t.me/share/url?url=${encUrl}&text=${encText}`}
          target="_blank"
          rel="noreferrer"
          title="Поделиться в Telegram"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M21.5 4.5L2.8 11.7c-.8.3-.8 1.4 0 1.7l4.7 1.6 1.8 5.6c.2.7 1.1.9 1.6.3l2.6-2.9 4.8 3.5c.6.4 1.5.1 1.6-.7l2.6-15.2c.1-.9-.7-1.5-1.5-1.1zM8 14.9l9.5-7.8-7.4 8.6-.3 3.2-1.8-4z" />
          </svg>
          <span>Telegram</span>
        </a>
        <a
          className="share-btn share-wa"
          href={`https://wa.me/?text=${encText}%20${encUrl}`}
          target="_blank"
          rel="noreferrer"
          title="Поделиться в WhatsApp"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M17.5 14.4c-.3-.1-1.7-.8-1.9-.9-.3-.1-.5-.1-.7.1-.2.3-.8.9-.9 1.1-.2.2-.3.2-.6.1-1.5-.7-2.4-1.3-3.4-3-.3-.4.3-.4.7-1.3.1-.2 0-.4 0-.5 0-.1-.6-1.5-.8-2.1-.2-.5-.4-.4-.6-.4-.2 0-.4 0-.5 0-.2 0-.5.1-.7.4-.3.3-1 1-1 2.4 0 1.4 1 2.8 1.2 3 .1.2 2.1 3.2 5 4.4 1.8.8 2.5.8 3.4.7.5-.1 1.7-.7 2-1.4.2-.6.2-1.2.2-1.3-.1 0-.2-.1-.4-.2zM12 2C6.5 2 2 6.5 2 12c0 1.8.5 3.5 1.3 5L2 22l5.1-1.3c1.5.8 3.2 1.3 4.9 1.3 5.5 0 10-4.5 10-10S17.5 2 12 2zm0 18.3c-1.6 0-3.1-.4-4.4-1.2l-.3-.2-3.3.9.9-3.2-.2-.3c-.9-1.4-1.3-3-1.3-4.6 0-4.6 3.7-8.3 8.3-8.3s8.3 3.7 8.3 8.3-3.7 8.6-8 8.6z" />
          </svg>
          <span>WhatsApp</span>
        </a>
        <button
          type="button"
          className="share-btn share-copy"
          onClick={copyLink}
          title={copied ? 'Скопировано' : 'Скопировать ссылку'}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            {copied ? (
              <path d="M5 12l5 5L20 7" />
            ) : (
              <>
                <rect x="9" y="9" width="11" height="11" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </>
            )}
          </svg>
          <span>{copied ? 'Скопировано' : 'Ссылка'}</span>
        </button>
        <button
          type="button"
          className="share-btn share-native"
          onClick={nativeShare}
          title="Поделиться…"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
            <path d="M16 6l-4-4-4 4" />
            <path d="M12 2v14" />
          </svg>
          <span>Ещё…</span>
        </button>
      </div>
    </div>
  );
}
