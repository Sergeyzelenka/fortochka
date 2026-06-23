# ФОРТОЧКА — глоток свежих новостей

Сайт + админка + воркер-пайплайн (RSS → ИИ-фильтр → ИИ-редактор → апрув → сайт + Telegram).

## Быстрый старт (мок-режим, без ключей)

```bash
npm install
npm run dev
```

Открой http://localhost:3000 — лента с демо-статьями.
Админка: http://localhost:3000/admin?key=change-me

## Подключение реальных сервисов

1. **Supabase** (supabase.com, бесплатно): создай проект → SQL Editor → выполни `supabase/schema.sql` → скопируй URL и ключи из Project Settings → API.
2. **Groq** (console.groq.com): API key — фильтр новостей.
3. **Google AI Studio** (aistudio.google.com): API key — редактор Gemini.
4. **Telegram**: @BotFather → `/newbot` → токен. Добавь бота админом в свой канал. Свой chat_id узнай у @userinfobot.
5. Скопируй `.env.example` → `.env.local` и заполни.

## Запуск пайплайна

```bash
npm run worker            # все шаги: сбор → фильтр → редактор
npm run worker:collect    # только сбор RSS
```

Новости со статусом `pending_review` появляются в `/admin?key=...` —
кнопка «Опубликовать» выкладывает на сайт и в TG-канал.

## Деплой

Сайт: пуш в GitHub → импорт в Vercel → переменные окружения из `.env.local`.
Воркер: GitHub Actions уже настроен (`.github/workflows/worker.yml`) —
добавь те же ключи в Settings → Secrets and variables → Actions.

## Структура

```
app/            сайт: лента, статья, /admin, API
components/     Masthead, Cover, AdminQueue
lib/            db (Supabase/мок), llm (Groq+Gemini), telegram, cover (SVG-обложки)
worker/         пайплайн: collect → filter → draft
supabase/       schema.sql
```

Статусы статьи: `found → filtered → drafted → pending_review → published`,
ветки отказа: `rejected_by_ai`, `rejected_by_editor`, `error` (после 3 ретраев).
