export type ArticleStatus =
  | 'found' | 'filtered' | 'drafted' | 'pending_review'
  | 'published' | 'rejected_by_ai' | 'rejected_by_editor' | 'error';

export interface Category {
  id: number;
  slug: string;
  name: string;
  color: string;
}

export interface Article {
  id: number;
  source_url: string;
  source_name: string;
  raw_title: string;
  raw_text: string | null;
  raw_image_url: string | null;
  status: ArticleStatus;
  score: number | null;
  ai_reason: string | null;
  category_id: number | null;
  slug: string | null;
  title: string | null;
  dek: string | null;
  body_html: string | null;
  tg_excerpt: string | null;
  reading_minutes: number | null;
  image_url: string | null;
  cover_svg: string | null;
  draft_model: string | null;
  tags: string[] | null;
  views: number;
  error_count: number;
  last_error: string | null;
  published_at: string | null;
  created_at: string;
}

export const CATEGORIES: Category[] = [
  { id: 1, slug: 'science',   name: 'Наука и медицина',     color: '#2F6FBF' },
  { id: 2, slug: 'animals',   name: 'Животные',             color: '#41805C' },
  { id: 3, slug: 'ecology',   name: 'Экология',             color: '#2C7A74' },
  { id: 4, slug: 'kindness',  name: 'Доброта',              color: '#B5534B' },
  { id: 5, slug: 'space',     name: 'Космос',               color: '#5A5380' },
  { id: 6, slug: 'tech',      name: 'Технологии для людей', color: '#56616E' },
  { id: 7, slug: 'lifehacks', name: 'Лайфхаки',             color: '#A9742B' }
];

export const catById = (id: number | null) =>
  CATEGORIES.find(c => c.id === id) ?? CATEGORIES[5];
