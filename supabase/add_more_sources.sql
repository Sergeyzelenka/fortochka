insert into sources (name, rss_url, default_category) values
  ('Hi-News',        'https://hi-news.ru/feed', 6),
  ('ТАСС Наука',     'https://nauka.tass.ru/rss/v2.xml', 1),
  ('ScienceDaily Health',  'https://www.sciencedaily.com/rss/top/health.xml', 1),
  ('ScienceDaily Animals', 'https://www.sciencedaily.com/rss/plants_animals/animals.xml', 2),
  ('ScienceDaily Space',   'https://www.sciencedaily.com/rss/space_time.xml', 5)
on conflict (rss_url) do nothing;
