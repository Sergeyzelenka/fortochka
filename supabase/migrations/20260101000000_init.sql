-- FORTOCHKA schema (Supabase / Postgres)

create table if not exists categories (
  id          serial primary key,
  slug        text unique not null,
  name        text not null,
  color       text not null default '#56616E'
);

insert into categories (slug, name, color) values
  ('science',  'Наука и медицина',       '#2F6FBF'),
  ('animals',  'Животные',               '#41805C'),
  ('ecology',  'Экология',               '#2C7A74'),
  ('kindness', 'Доброта',                '#B5534B'),
  ('space',    'Космос',                 '#5A5380'),
  ('tech',     'Технологии для людей',   '#56616E'),
  ('lifehacks','Лайфхаки',               '#A9742B')
on conflict (slug) do nothing;

create table if not exists sources (
  id            serial primary key,
  name          text not null,
  rss_url       text unique not null,
  default_category int references categories(id),
  enabled       boolean not null default true,
  last_fetched_at timestamptz
);

do $$ begin
  create type article_status as enum (
    'found', 'filtered', 'drafted', 'pending_review',
    'published', 'rejected_by_ai', 'rejected_by_editor', 'error'
  );
exception when duplicate_object then null;
end $$;

create table if not exists articles (
  id            bigserial primary key,
  source_url    text unique not null,
  source_name   text not null,
  source_id     int references sources(id),
  raw_title     text not null,
  raw_text      text,
  raw_image_url text,
  status        article_status not null default 'found',
  score         numeric(3,1),
  ai_reason     text,
  category_id   int references categories(id),
  slug          text unique,
  title         text,
  dek           text,
  body_html     text,
  tg_excerpt    text,
  reading_minutes int,
  image_url     text,
  cover_svg     text,
  error_count   int not null default 0,
  last_error    text,
  scheduled_at  timestamptz,
  published_at  timestamptz,
  tg_message_id bigint,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_articles_status on articles(status);
create index if not exists idx_articles_published on articles(status, published_at desc);

create table if not exists pipeline_log (
  id         bigserial primary key,
  article_id bigint references articles(id),
  step       text not null,
  ok         boolean not null,
  detail     text,
  created_at timestamptz not null default now()
);

create table if not exists comments (
  id         bigserial primary key,
  article_id bigint references articles(id) on delete cascade,
  user_id    uuid references auth.users(id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create table if not exists reactions (
  article_id bigint references articles(id) on delete cascade,
  user_id    uuid references auth.users(id) on delete cascade,
  kind       text not null check (kind in ('sun','heart','clap')),
  created_at timestamptz not null default now(),
  primary key (article_id, user_id, kind)
);

alter table articles enable row level security;
create policy "public read published" on articles
  for select using (status = 'published');

alter table comments enable row level security;
create policy "read comments" on comments for select using (true);
create policy "write own comments" on comments
  for insert with check (auth.uid() = user_id);

alter table reactions enable row level security;
create policy "read reactions" on reactions for select using (true);
create policy "write own reactions" on reactions
  for insert with check (auth.uid() = user_id);
create policy "delete own reactions" on reactions
  for delete using (auth.uid() = user_id);

insert into sources (name, rss_url, default_category) values
  ('Позитивные новости', 'https://positivnews.ru/feed/', null),
  ('Naked Science',      'https://naked-science.ru/feed', 1),
  ('N plus 1',           'https://nplus1.ru/rss', 1),
  ('Good News Network',  'https://www.goodnewsnetwork.org/feed/', null),
  ('Positive News',      'https://www.positive.news/feed/', null),
  ('ScienceDaily',       'https://www.sciencedaily.com/rss/top/science.xml', 1),
  ('NASA News',          'https://www.nasa.gov/feed/', 5),
  ('Phys.org',           'https://phys.org/rss-feed/', 1)
on conflict (rss_url) do nothing;

grant usage on schema public to service_role, anon, authenticated;
grant all on all tables in schema public to service_role, anon, authenticated;
grant all on all sequences in schema public to service_role, anon, authenticated;
