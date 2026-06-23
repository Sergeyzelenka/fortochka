// Клиенты LLM через обычный fetch — без SDK.
// Фильтр: Groq (Llama 3.3 70B). Редактор: Groq по умолчанию или Gemini 2.5 Flash.

import { recordGroqResponse, recordCall } from './quota';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GEMINI_URL = (model: string, key: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

async function withRetry<T>(fn: () => Promise<T>, tries = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e: any) {
      lastErr = e;
      const wait = e?.status === 429 ? 15000 * (i + 1) : 2000 * (i + 1);
      await new Promise(r => setTimeout(r, wait));
    }
  }
  throw lastErr;
}

function extractJson(text: string): any {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('LLM вернул не-JSON: ' + text.slice(0, 200));
  return JSON.parse(m[0]);
}

export interface FilterVerdict {
  is_good: boolean;
  score: number;
  category: string; // slug рубрики
  reason: string;
}

const FILTER_SYSTEM = `Ты — фильтр позитивного новостного медиа ФОРТОЧКА.
Оцени новость. Подходящие темы: успехи науки и медицины, научные открытия,
спасение и защита животных, улучшение экологии, человеческая доброта,
космос, полезные советы (лайфхаки), технологии, помогающие людям.
Отклоняй: политику, выборы, войны, катастрофы, криминал, смерти,
жёлтые сенсации, рекламу, слухи, спорт-результаты без человеческой истории.
Категории (slug): science, animals, ecology, kindness, space, tech, lifehacks.
Ответь СТРОГО JSON без пояснений:
{"is_good": true/false, "score": 1-10, "category": "slug", "reason": "кратко почему"}`;

export async function filterNews(title: string, text: string): Promise<FilterVerdict> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error('GROQ_API_KEY не задан');
  return withRetry(async () => {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: FILTER_SYSTEM },
          { role: 'user', content: `Заголовок: ${title}\n\nТекст: ${text.slice(0, 4000)}` }
        ]
      })
    });
    recordGroqResponse('llama-3.3-70b-versatile', res);
    if (!res.ok) {
      const err: any = new Error(`Groq ${res.status}: ${await res.text()}`);
      err.status = res.status;
      throw err;
    }
    const data = await res.json();
    return extractJson(data.choices[0].message.content) as FilterVerdict;
  });
}

export interface Draft {
  title: string;
  dek: string;
  body_html: string;
  tg_excerpt: string;
  reading_minutes: number;
  tags?: string[];
}

const EDITOR_SYSTEM = `Ты — редактор русскоязычного позитивного медиа ФОРТОЧКА.

Задача: на основе исходного материала (он может быть на любом языке) написать новость по-русски.

Жёсткие требования:
1. Пиши ТОЛЬКО по-русски, грамотно, без англицизмов без нужды.
2. Не выдумывай фактов, которых нет в источнике. Если деталь не указана — не упоминай её.
3. Никакого кликбейта, жёлтых заголовков, восклицательных знаков в title.
4. Никаких эмодзи нигде в тексте.
5. Тон: тёплый, но сдержанный и профессиональный. Без панибратства.
6. body_html: только теги <p> и <h2>. Никаких <div>, <span>, <strong>, классов, стилей.
7a. Если в конце задачи дан блок «Доступные изображения» — там перечислены номера фото
    с описаниями alt, caption и after_text. ВАЖНО: вставляй в body_html ТОЛЬКО короткий
    маркер вида <p>[IMG:1]</p> — без alt, без caption, без after_text, без кавычек,
    без английского текста. Эти описания даны только чтобы ты ПОНЯЛ, про что фото
    и где оно стояло в оригинале — их КАТЕГОРИЧЕСКИ нельзя копировать в body_html,
    подпись подставится автоматически.
    Поле after_text — это фрагмент текста ИЗ ОРИГИНАЛА, который шёл непосредственно перед
    этим фото. Это смысловой якорь: в своём русском пересказе найди абзац, в котором
    раскрываешь ту же мысль (или то же конкретное событие), и поставь маркер
    <p>[IMG:N]</p> на отдельной строке СРАЗУ ПОСЛЕ него. Не клади маркер раньше, чем
    тема упомянута. Если в твоём пересказе на эту тему нет отдельного абзаца —
    лучше пропусти фото, чем поставить искусственно.
    Каждый номер используй максимум один раз.
7. body_html: 6-9 абзацев, каждый абзац — отдельный <p>.
   Каждый абзац — 3-5 полноценных предложений, не одно. Не делай абзац короче 4 строк.
   Раскрывай детали постепенно: первый абзац-лид (что произошло), затем абзацы с подробностями,
   контекстом (что это значит, на что повлияет, какая предыстория), цитатами или цифрами,
   если они есть в источнике. Финальный абзац — про значение события или дальнейшие шаги.
   Используй <h2> для одного логического разделителя, если статья длинная.
   ВАЖНО: не повторяй одну и ту же мысль разными словами. Каждый абзац вносит новую информацию.
   Если в источнике мало деталей — НЕ выдумывай конкретики (имена, цифры, места),
   но можешь расширять контекст общеизвестными фактами по теме осторожно и без утверждений.
8. tg_excerpt: краткий анонс для Telegram, до 400 знаков, в одну-две фразы.
9. reading_minutes: оценка времени чтения статьи в минутах, число от 2 до 7.
10. tags: массив из 3-6 ключевых тегов — короткие слова или словосочетания
    нижним регистром (например ["нейросети","медицина","япония"]). Без хэштегов.

Ответ только в формате JSON-объекта со СТРОГО такими полями:
{
  "title": "Заголовок до 110 знаков, без точки в конце",
  "dek": "Подзаголовок одна-две фразы, до 220 знаков",
  "body_html": "<p>...</p><p>...</p>",
  "tg_excerpt": "Текст анонса",
  "reading_minutes": 2,
  "tags": ["тег один","тег два","тег три"]
}

Никакого текста до или после JSON. Никаких markdown-блоков типа \`\`\`json. Только сам JSON.`;

// Few-shot примеры: показываем модели «как надо», вместо того чтобы только перечислять правила.
// Llama 3.3 70B и Gemini Flash хорошо имитируют тон и структуру эталонных пар.
// Каждый пример — реалистичный вход (англоязычная заметка из RSS-фида) + эталонный JSON-выход.

const EDITOR_EXAMPLES: { user: string; assistant: string }[] = [
  {
    user: `Источник: ScienceDaily
Заголовок: Webb telescope reveals spiral structure in early galaxy

Текст: NASA's James Webb Space Telescope has captured a detailed image of a galaxy that existed when the universe was only 700 million years old. The observation reveals previously hidden structural features, including spiral arms and a luminous central bar. Astronomers say this discovery challenges existing theories about how quickly galaxies could form and organize in the early universe. Lead researcher Dr. Maria Chen from the Space Telescope Science Institute noted that the team is seeing structure they didn't think was possible at this cosmic epoch. The findings were published in Nature Astronomy.`,
    assistant: JSON.stringify({
      title: 'Телескоп Уэбба разглядел спиральную структуру у галактики возрастом 13 миллиардов лет',
      dek: 'На снимке отчётливо видны рукава и центральная перемычка — структуры, которых не ожидали в столь ранней Вселенной',
      body_html: '<p>Космический телескоп Джеймса Уэбба передал подробное изображение галактики, существовавшей через 700 миллионов лет после Большого взрыва. На снимке отчётливо различимы спиральные рукава и яркая центральная перемычка — структуры, которые раньше не удавалось рассмотреть в столь далёких объектах.</p><p>Открытие меняет представление о темпе эволюции ранних галактик. До сих пор считалось, что для формирования упорядоченной спирали и перемычки нужны миллиарды лет: самоорганизация диска, охлаждение газа, постепенная концентрация массы. В ту эпоху галактики должны были выглядеть как бесформенные комки.</p><p>«Мы видим структуру, которой не ожидали увидеть в этой космической эпохе», — отметила руководитель исследования Мария Чен из Института науки о космических телескопах. По её словам, команда сначала проверяла, не ошибка ли это обработки изображения, и только после серии независимых тестов решилась публиковать находку.</p><p>Деталь стала возможной благодаря инфракрасным камерам Уэбба. Свет от такой далёкой галактики смещён в красную сторону спектра из-за расширения Вселенной, и обычные оптические телескопы видят её лишь как тусклое размытое пятно. Уэбб же ловит инфракрасный свет с высоким разрешением и впервые позволяет разобрать внутреннюю структуру.</p><p>Следующий шаг — поиск других ранних галактик со схожей морфологией. Если они окажутся правилом, а не исключением, теорию формирования галактических дисков придётся существенно переписать. Если же это редкий случай — нужно будет объяснить, какие условия позволили именно этой галактике созреть так рано.</p><p>Работа опубликована в журнале Nature Astronomy.</p>',
      tg_excerpt: 'Телескоп Джеймса Уэбба разглядел спиральную галактику возрастом 13 миллиардов лет — с рукавами и яркой перемычкой. Астрономы не ожидали такой развитой структуры в ранней Вселенной.',
      reading_minutes: 2,
      tags: ['телескоп уэбба', 'галактики', 'ранняя вселенная', 'астрономия']
    })
  },
  {
    user: `Источник: Good News Network
Заголовок: 8-year-old uses birthday money to buy school supplies for classmates

Текст: When 8-year-old Marcus Williams of Atlanta received $200 in birthday money this month, his parents expected him to buy toys or video games. Instead, the second-grader asked his mother to take him to a supply store. With the help of his teacher, Marcus identified 15 classmates whose families struggled to afford supplies. He purchased backpacks, notebooks, pencils, and crayons—then helped pack them into individual bags. "I just thought, if I had everything I needed, I should help my friends too," Marcus told local reporters. His teacher Ms. Patel said the gesture moved the entire class. Marcus's mother said her son had been planning this since the start of the school year.`,
    assistant: JSON.stringify({
      title: 'Восьмилетний Маркус потратил все деньги с дня рождения на школьную канцелярию для одноклассников',
      dek: 'Мальчик из Атланты собрал пятнадцать наборов с рюкзаками и тетрадями для друзей, чьим семьям было сложно купить всё нужное',
      body_html: '<p>Когда восьмилетний Маркус Уильямс из Атланты получил на день рождения двести долларов, родители ожидали, что он купит игрушки или видеоигры. Вместо этого мальчик попросил маму отвезти его в магазин канцелярских принадлежностей и объяснил, что хочет сделать подарок не себе, а одноклассникам.</p><p>С помощью учительницы, госпожи Патель, Маркус заранее составил список из пятнадцати ребят, чьим семьям сложно покупать школьные принадлежности. На все деньги он выбрал рюкзаки, тетради, карандаши, фломастеры и пеналы, а потом сам сел разложить всё по индивидуальным пакетам, чтобы каждый одноклассник получил свой набор.</p><p>«Я подумал: если у меня есть всё, что нужно, я должен помочь и друзьям», — рассказал Маркус местным журналистам, когда его попросили объяснить идею.</p><p>По словам учительницы, поступок мальчика тронул весь класс — несколько детей пришли на следующий день со своими маленькими подарками для одноклассников и родителей. Госпожа Патель отметила, что Маркус никогда не делал из этого большой истории и попросил не называть имён тех, кому достались наборы, чтобы никого не смущать.</p><p>Мама Маркуса призналась, что сын планировал этот поступок с начала учебного года. Он копил часть карманных денег и постоянно расспрашивал родителей, какие именно вещи нужны для школы и сколько они стоят, не объясняя зачем.</p><p>В американских семьях с низким доходом расходы на школьные принадлежности нередко становятся серьёзной нагрузкой, особенно в начале учебного года. Учителя и родительские комитеты ведут собственные сборы, но детская инициатива такого рода в школьном округе Атланты — редкость.</p>',
      tg_excerpt: 'В Атланте восьмилетний Маркус получил 200 долларов на день рождения и потратил их на школьные принадлежности для пятнадцати одноклассников, чьим семьям было тяжело купить всё нужное.',
      reading_minutes: 2,
      tags: ['дети', 'школа', 'доброта', 'сша', 'атланта']
    })
  }
];

function fewShotForGroq() {
  // Для Groq/OpenAI-совместимого API чередуем user/assistant перед основным вопросом.
  const out: { role: 'user' | 'assistant'; content: string }[] = [];
  for (const ex of EDITOR_EXAMPLES) {
    out.push({ role: 'user', content: ex.user });
    out.push({ role: 'assistant', content: ex.assistant });
  }
  return out;
}

// Подсказки под каждую рубрику — короткие, дополняют базовые правила EDITOR_SYSTEM.
// Помогают модели держать правильный тон без переписывания всего промпта.
const CATEGORY_HINTS: Record<number, string> = {
  1: 'Наука и медицина. Сохраняй точную терминологию (но если термин редкий — кратко поясни его в скобках). Указывай авторов исследования, организацию и журнал, если они есть. Не упрощай важные оговорки и условия эксперимента.',
  2: 'Животные. Тёплый, но сдержанный тон. Если речь о конкретной особи или семье — называй её именем и видом. Без антропоморфизации («котик», «лошадка»). Указывай, где история произошла.',
  3: 'Экология. Фактологически, без морализаторства и призывов. Цифры, места, временные рамки — конкретны. Если речь о восстановлении популяций или экосистем — масштабы измеримы.',
  4: 'Доброта. История человека в человеческом масштабе. Прямая речь героев в кавычках-ёлочках, если есть в источнике. Без сюсюканья и без приукрашивания. Не превращай событие в нравоучение.',
  5: 'Космос. Расстояния, размеры и сроки давай в человеческих сравнениях (например, «свет идёт восемь минут от Солнца»). Объясняй редкие термины (барион, аккреция) одной фразой.',
  6: 'Технологии для людей. Акцент на том, как технология реально помогает людям, а не на инженерных подробностях. Без англоязычного жаргона без перевода. Если есть цифры — кому, сколько, где доступно.',
  7: 'Лайфхаки. Практично и конкретно: что делать, в какой ситуации, почему работает. Можно нумерованный список <ol><li>...</li></ol>, если в источнике несколько советов. Без воды и общих фраз.'
};

function categoryHint(categoryId: number | null | undefined): string | null {
  if (!categoryId) return null;
  return CATEGORY_HINTS[categoryId] ?? null;
}

function fewShotForGemini() {
  // Для Gemini формат: contents с ролями user / model.
  const out: { role: 'user' | 'model'; parts: { text: string }[] }[] = [];
  for (const ex of EDITOR_EXAMPLES) {
    out.push({ role: 'user', parts: [{ text: ex.user }] });
    out.push({ role: 'model', parts: [{ text: ex.assistant }] });
  }
  return out;
}

function userPayload(sourceName: string, title: string, text: string, imagesContext?: string): string {
  const base = `Источник: ${sourceName}\nЗаголовок: ${title}\n\nТекст:\n${text.slice(0, 12000)}`;
  if (imagesContext && imagesContext.trim()) {
    return `${base}\n\nДоступные изображения (вставь маркеры [IMG:N] в body_html по смыслу):\n${imagesContext}`;
  }
  return base;
}

async function draftArticleGeminiRaw(title: string, text: string, sourceName: string, categoryId?: number | null, imagesContext?: string): Promise<Draft> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY не задан');
  const hint = categoryHint(categoryId);
  const systemText = hint ? `${EDITOR_SYSTEM}\n\nДополнительная подсказка для этой рубрики:\n${hint}` : EDITOR_SYSTEM;
  return withRetry(async () => {
    const res = await fetch(GEMINI_URL('gemini-2.5-flash', key), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemText }] },
        contents: [
          ...fewShotForGemini(),
          {
            role: 'user',
            parts: [{ text: userPayload(sourceName, title, text, imagesContext) }]
          }
        ],
        generationConfig: { temperature: 0.4, responseMimeType: 'application/json' }
      })
    });
    recordCall('gemini', res.ok);
    if (!res.ok) {
      const err: any = new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 500)}`);
      err.status = res.status;
      throw err;
    }
    const data = await res.json();
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    return extractJson(raw) as Draft;
  });
}

// Публичная обёртка: пробуем Gemini, при перегрузке/ошибке откатываемся на Groq.
export async function draftArticleGemini(title: string, text: string, sourceName: string, categoryId?: number | null, imagesContext?: string): Promise<Draft> {
  try {
    return await draftArticleGeminiRaw(title, text, sourceName, categoryId, imagesContext);
  } catch (e: any) {
    // 503/UNAVAILABLE/429 = перегрузка Gemini. Не падаем — пишем через Groq.
    console.warn(`Gemini недоступен (${e?.status ?? '?'}), откат на Groq:`, e?.message?.slice?.(0, 200));
    return draftArticle(title, text, sourceName, categoryId, imagesContext);
  }
}

export async function draftArticle(title: string, text: string, sourceName: string, categoryId?: number | null, imagesContext?: string): Promise<Draft> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error('GROQ_API_KEY не задан');
  const hint = categoryHint(categoryId);
  const systemText = hint ? `${EDITOR_SYSTEM}\n\nДополнительная подсказка для этой рубрики:\n${hint}` : EDITOR_SYSTEM;
  return withRetry(async () => {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        temperature: 0.4,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemText },
          ...fewShotForGroq(),
          {
            role: 'user',
            content: userPayload(sourceName, title, text, imagesContext)
          }
        ]
      })
    });
    recordGroqResponse('llama-3.3-70b-versatile', res);
    if (!res.ok) {
      const err: any = new Error(`Groq draft ${res.status}: ${await res.text()}`);
      err.status = res.status;
      throw err;
    }
    const data = await res.json();
    return extractJson(data.choices[0].message.content) as Draft;
  });
}
