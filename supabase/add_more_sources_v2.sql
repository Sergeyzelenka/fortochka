-- FORTOCHKA: batch 2 of RSS sources. Idempotent (on conflict do nothing).
-- Category ids: science=1, animals=2, ecology=3, kindness=4, space=5, tech=6, lifehacks=7.

insert into sources (name, rss_url, default_category, enabled) values
  ('Indicator.ru',          'https://indicator.ru/rss',                       1, true),
  ('Postnauka',             'https://postnauka.org/feed',                     1, true),
  ('RIA Nauka',             'https://ria.ru/export/rss2/science/index.xml',   1, true),
  ('3DNews Nauka',          'https://3dnews.ru/news/sci/rss/',                1, true),
  ('Space.com',             'https://www.space.com/feeds/all',                5, true),
  ('SpaceNews',             'https://spacenews.com/feed/',                    5, true),
  ('iXBT',                  'https://www.ixbt.com/export/news.rss',           6, true),
  ('3DNews',                'https://3dnews.ru/news/rss/',                    6, true),
  ('Lifehacker.ru',         'https://lifehacker.ru/feed/',                    7, true),
  ('Tinkoff Journal',       'https://journal.tinkoff.ru/rss/all.xml',         7, true),
  ('The Optimist Daily',    'https://www.optimistdaily.com/feed/',            4, true),
  ('Reasons to be Cheerful','https://reasonstobecheerful.world/feed/',        4, true),
  ('Mongabay',              'https://news.mongabay.com/feed/',                3, true),
  ('WWF Russia',            'https://wwf.ru/rss/',                            3, true),
  ('The Dodo',              'https://www.thedodo.com/rss/',                   2, true)
on conflict (rss_url) do nothing;
