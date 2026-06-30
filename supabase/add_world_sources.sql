-- Мировые источники под слабые категории: доброта (4), технологии для людей (6), лайфхаки (7).
-- Все фиды проверены на доступность (отдают application/rss+xml).
-- Применять в облаке: SQL Editor -> вставить -> Run.

insert into sources (name, rss_url, default_category) values
  -- === Доброта (4) ===
  ('Good Good Good',        'https://www.goodgoodgood.co/articles/rss.xml',                 4),
  ('Upworthy',              'https://www.upworthy.com/feed',                                4),
  ('Nice News',             'https://nicenews.com/feed',                                    4),
  ('GNN Inspiring',         'https://www.goodnewsnetwork.org/category/news/inspiring/feed', 4),

  -- === Технологии для людей (6) ===
  ('Singularity Hub',       'https://singularityhub.com/feed',                              6),
  ('Freethink',             'https://www.freethink.com/feed/all',                           6),
  ('Smithsonian Innovation','https://www.smithsonianmag.com/rss/innovation',                6),
  ('Big Think',             'https://bigthink.com/feed',                                    6),

  -- === Лайфхаки (7) ===
  ('Lifehack.org',          'https://www.lifehack.org/feed',                                7),
  ('MakeUseOf',             'https://www.makeuseof.com/feed',                               7),
  ('The Marginalian',       'https://www.themarginalian.org/feed',                          7)
on conflict (rss_url) do nothing;
