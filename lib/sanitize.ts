import DOMPurify from 'isomorphic-dompurify';

const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'em', 'b', 'i', 'u', 'a',
  'ul', 'ol', 'li', 'blockquote',
  'h2', 'h3', 'h4', 'figure', 'figcaption', 'img'
];

const ALLOWED_ATTR = ['href', 'title', 'rel', 'target', 'src', 'alt'];

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP: /^(https?:|mailto:|#|\/)/i
  });
}
