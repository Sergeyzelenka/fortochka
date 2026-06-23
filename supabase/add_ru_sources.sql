-- ФОРТОЧКА · добавление русскоязычных источников в УЖЕ СОЗДАННУЮ базу.
-- Выполнить в Supabase: SQL Editor → New query → вставить → Run.
-- Безопасно запускать повторно: on conflict (rss_url) do nothing.
--
-- RSS-ленты проверены на доступность. ИИ-фильтр сам отсеет неподходящее
-- по тону (политику, негатив), оставив позитивные материалы.

insert into sources (name, rss_url, default_category, enabled) values
  ('Позитивные новости', 'https://positivnews.ru/feed/', null, true),  -- общий позитив, рубрику определит ИИ
  ('Naked Science',      'https://naked-science.ru/feed', 1,    true),  -- наука и медицина
  ('N+1',                'https://nplus1.ru/rss',         1,    true)   -- наука и медицина
on conflict (rss_url) do nothing;

-- Проверить, что источники добавились и включены:
-- select name, rss_url, enabled from sources order by id;
