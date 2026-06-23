// Чистка body_html. Раньше использовался isomorphic-dompurify, но он тянет
// jsdom@29 -> html-encoding-sniffer/@exodus/bytes (ESM), что ломает рантайм
// на Vercel (ERR_REQUIRE_ESM). sanitize-html — чистый Node, без jsdom.
import sanitize from 'sanitize-html';

const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'em', 'b', 'i', 'u', 'a',
  'ul', 'ol', 'li', 'blockquote',
  'h2', 'h3', 'h4', 'figure', 'figcaption', 'img'
];

export function sanitizeHtml(html: string): string {
  return sanitize(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ['href', 'title', 'rel', 'target'],
      img: ['src', 'alt', 'title']
    },
    // Разрешённые схемы ссылок и картинок (http/https/mailto/якоря/относительные).
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: { img: ['http', 'https'] },
    allowProtocolRelative: false,
    // Внешние ссылки делаем безопасными.
    transformTags: {
      a: sanitize.simpleTransform('a', { rel: 'noopener noreferrer' }, true)
    }
  });
}
