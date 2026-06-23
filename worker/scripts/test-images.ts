import { config } from 'dotenv';
config({ path: '.env.local' });

import { fetchInlineImages } from '../../lib/article-images';
import { isImageAlive } from '../../lib/image-check';

async function main() {
  const url = process.argv[2] ?? 'https://www.positive.news/society/the-circus-artists-rewriting-the-rules-of-ageing/';
  console.log('Fetching:', url);

  // Подебажим — что нашли в HTML и что отсеяло.
  const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 FortochkaImages/1.0' } });
  const html = (await r.text()).slice(0, 600_000);
  const allImgs = (html.match(/<img[^>]+>/gi) ?? []);
  console.log('All <img> tags in HTML:', allImgs.length);

  const liveTest = await isImageAlive('https://www.positive.news/wp-content/uploads/2026/06/Pamlela-6-1-scaled-1500x0-c-default.jpg');
  console.log('isImageAlive on Pamlela:', liveTest);

  const imgs = await fetchInlineImages(url, 5);
  console.log('fetchInlineImages found:', imgs.length);
  for (const im of imgs) {
    console.log(' -', im.src);
    if (im.caption) console.log('   credit:', im.caption);
  }
}
main();
