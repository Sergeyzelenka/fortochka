// Генерация тематической обложки через Gemini 2.5 Flash Image (Nano Banana)
// и загрузка в Supabase Storage, bucket `covers`.

import { sbService } from './db';
import { CATEGORIES } from './types';
import { recordCall } from './quota';

const MODEL = 'gemini-2.5-flash-image';
const ENDPOINT = 'https://api.apiyi.com/v1/chat/completions';

const PALETTE: Record<string, string> = {
  science:   'cool blues and soft whites',
  animals:   'warm greens and gentle earth tones',
  ecology:   'fresh teals, sage greens, sunlight',
  kindness:  'warm corals, soft pinks, golden light',
  space:     'deep violets, indigo, gentle starlight',
  tech:      'muted greys, navy, hints of soft cyan',
  lifehacks: 'warm ambers, cream, honey tones'
};

function buildPrompt({ title, dek, categorySlug }: { title: string; dek?: string | null; categorySlug?: string }) {
  const cat = CATEGORIES.find(c => c.slug === categorySlug);
  const palette = (categorySlug && PALETTE[categorySlug]) ?? 'soft, warm, hopeful tones';
  const themeHint = cat ? `Theme: ${cat.name} (${cat.slug}).` : '';

  return [
    'Editorial illustration for a positive-news story.',
    'Style: modern editorial illustration, flat geometric shapes with soft gradients,',
    'gentle texture, calm composition, professional newsroom feel.',
    `Color palette: ${palette}.`,
    'Mood: warm, hopeful, optimistic, dignified — not childish, not cartoonish.',
    'Composition: clean focal point, balanced negative space, 16:9 horizontal.',
    'STRICT RULES: no text, no letters, no words, no logos, no watermarks,',
    'no recognizable faces of real people, no photorealism, no violence, no political symbols.',
    themeHint,
    `Subject of the story: ${title}`,
    dek ? `Context: ${dek}` : ''
  ].filter(Boolean).join(' ');
}

export interface IllustrateInput {
  title: string;
  dek?: string | null;
  categorySlug?: string;
}

// Парсим разные форматы, которыми OpenAI-совместимые прокси отдают картинку:
// 1) choices[0].message.images[].image_url.url   (data URL)
// 2) choices[0].message.content[].image_url.url  (multimodal content)
// 3) choices[0].message.content как строка с markdown ![](data:image/png;base64,...)
function extractImageData(data: any): string | null {
  const msg = data?.choices?.[0]?.message;
  if (!msg) return null;

  if (Array.isArray(msg.images)) {
    for (const im of msg.images) {
      const url = im?.image_url?.url ?? im?.url;
      if (typeof url === 'string') {
        const m = url.match(/^data:image\/\w+;base64,(.+)$/);
        if (m) return m[1];
      }
    }
  }
  if (Array.isArray(msg.content)) {
    for (const c of msg.content) {
      const url = c?.image_url?.url;
      if (typeof url === 'string') {
        const m = url.match(/^data:image\/\w+;base64,(.+)$/);
        if (m) return m[1];
      }
      if (typeof c?.inline_data?.data === 'string') return c.inline_data.data;
    }
  }
  if (typeof msg.content === 'string') {
    const m = msg.content.match(/data:image\/\w+;base64,([A-Za-z0-9+/=]+)/);
    if (m) return m[1];
  }
  return null;
}

export async function generateIllustrationPng(input: IllustrateInput): Promise<Buffer> {
  const key = process.env.APIYI_API_KEY;
  if (!key) throw new Error('APIYI_API_KEY не задан');
  // Усиливаем инструкцию: модель gemini-2.5-flash-image через прокси иногда
  // отвечает текстом («вот ваша иллюстрация:») вместо самой картинки.
  const prompt = buildPrompt(input) +
    ' Return ONLY the generated image. Do not reply with any text, description, or explanation — output the image itself.';

  // Делаем до 3 попыток: если в ответе нет картинки (модель «заболтала»), пробуем снова.
  let lastErr = '';
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
        modalities: ['image', 'text']
      })
    });
    recordCall('apiyi', res.ok);
    if (!res.ok) {
      lastErr = `APIYI ${res.status}: ${(await res.text()).slice(0, 300)}`;
      // 429/5xx — ждём и пробуем снова; прочие коды смысла повторять нет.
      if (res.status === 429 || res.status >= 500) {
        await new Promise(r => setTimeout(r, 1500 * attempt));
        continue;
      }
      throw new Error(lastErr);
    }
    const data = await res.json();
    const b64 = extractImageData(data);
    if (b64) return Buffer.from(b64, 'base64');
    // Картинки нет (модель ответила текстом) — короткая пауза и повтор.
    lastErr = `APIYI не вернул картинку (попытка ${attempt}): ${JSON.stringify(data).slice(0, 250)}`;
    await new Promise(r => setTimeout(r, 1200 * attempt));
  }
  throw new Error(lastErr || 'APIYI: не удалось получить картинку за 3 попытки');
}

const BUCKET = 'covers';
let _bucketReady = false;

async function ensureBucket() {
  if (_bucketReady) return;
  const sb = sbService();
  const { data: buckets } = await sb.storage.listBuckets();
  if (!buckets?.find(b => b.name === BUCKET)) {
    const { error } = await sb.storage.createBucket(BUCKET, { public: true });
    if (error && !/exists/i.test(error.message)) throw error;
  }
  _bucketReady = true;
}

export async function uploadCover(articleId: number, png: Buffer): Promise<string> {
  await ensureBucket();
  const path = `ai/${articleId}-${Date.now()}.png`;
  const sb = sbService();
  const { error } = await sb.storage.from(BUCKET).upload(path, png, {
    contentType: 'image/png',
    upsert: true
  });
  if (error) throw new Error(`Storage upload: ${error.message}`);
  const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

// Загрузка обложки, выбранной редактором с устройства.
export async function uploadManualCover(
  articleId: number,
  buf: Buffer,
  contentType: string,
  ext: string
): Promise<string> {
  await ensureBucket();
  const safeExt = /^[a-z0-9]{2,5}$/i.test(ext) ? ext.toLowerCase() : 'bin';
  const path = `manual/${articleId}-${Date.now()}.${safeExt}`;
  const sb = sbService();
  const { error } = await sb.storage.from(BUCKET).upload(path, buf, {
    contentType,
    upsert: true
  });
  if (error) throw new Error(`Storage upload: ${error.message}`);
  const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
