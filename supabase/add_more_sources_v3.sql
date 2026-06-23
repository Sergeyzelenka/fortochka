-- FORTOCHKA: batch 3 of RSS sources targeted at weak categories.
-- Category ids: science=1, animals=2, ecology=3, kindness=4, space=5, tech=6, lifehacks=7.

insert into sources (name, rss_url, default_category, enabled) values
  ('Adme.media',           'https://www.adme.media/feed/',                 7, true),
  ('Habr Pop Sci',         'https://habr.com/ru/rss/flows/popsci/all/',    6, true),
  ('Ferra',                'https://www.ferra.ru/exports/rss.xml',         6, true),
  ('Hi-Tech Mail.ru',      'https://hi-tech.mail.ru/rss/all/',             6, true),
  ('ZooBorns',             'https://www.zooborns.com/zooborns/atom.xml',   2, true),
  ('Lifehacker Tech',      'https://lifehacker.ru/category/technologies/feed/', 6, true)
on conflict (rss_url) do nothing;
