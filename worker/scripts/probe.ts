async function main() {
  const url = 'https://www.positive.news/society/the-circus-artists-rewriting-the-rules-of-ageing/';
  const r = await fetch(url, { headers: {
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'accept-language': 'en-US,en;q=0.9'
  }});
  const html = await r.text();
  console.log('status:', r.status, 'len:', html.length, 'imgs:', (html.match(/<img/g) ?? []).length);
  console.log('first 400 chars:', html.slice(0, 400).replace(/\s+/g, ' '));
}
main();
