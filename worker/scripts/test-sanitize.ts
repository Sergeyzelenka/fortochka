import { config } from 'dotenv';
config({ path: '.env.local' });
import { sanitizeHtml } from '../../lib/sanitize';
import { injectInlineImages } from '../../lib/article-images';

const body = '<p>Один</p><p>Два</p><p>Три</p>';
const imgs = [
  { src: 'https://www.positive.news/wp-content/uploads/2026/06/Pamlela-6-1-scaled-1500x0-c-default.jpg', alt: '', caption: 'фото · Andy Holloway' },
  { src: 'https://www.positive.news/wp-content/uploads/2026/06/Rumman-2-1-scaled-1500x0-c-default.jpg', alt: '', caption: null }
];
const injected = injectInlineImages(body, imgs as any);
console.log('After inject:\n', injected, '\n');
console.log('After sanitize:\n', sanitizeHtml(injected));
