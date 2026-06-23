import { config } from 'dotenv';
config({ path: '.env.local' });
import { extractArticleText } from '../../lib/article-extract';

async function main() {
  const url = process.argv[2] ?? 'https://www.sciencedaily.com/releases/2026/06/260601121234.htm';
  console.log('Testing:', url);
  const r = await extractArticleText(url);
  if (!r) { console.log('No result'); return; }
  console.log(`Source: ${r.source}, length: ${r.length}`);
  console.log('--- first 800 chars ---');
  console.log(r.text.slice(0, 800));
}
main();
