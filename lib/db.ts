// Слой данных: Supabase, а без ключей — мок-режим (демо-статьи в памяти).
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Article, ArticleStatus } from './types';
import { MOCK_ARTICLES, MOCK_PENDING } from './mock-data';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isMock = !url || !(serviceKey || anonKey);

// Сервисный клиент — обходит RLS, для воркера и админских API.
// Никогда не передавать в браузер.
let _service: SupabaseClient | null = null;
export function sbService(): SupabaseClient {
  if (!_service) _service = createClient(url!, (serviceKey ?? anonKey)!);
  return _service;
}

// Анонимный клиент — для публичных чтений на сайте (уважает RLS).
// Fallback на сервисный, если анонимного ключа нет.
let _anon: SupabaseClient | null = null;
export function sbAnon(): SupabaseClient {
  if (!_anon) _anon = createClient(url!, (anonKey ?? serviceKey)!);
  return _anon;
}

// Совместимость со старым кодом: по умолчанию — сервисный.
export const sb = sbService;

// ---- мок-хранилище (живёт в памяти dev-сервера) ----
const mockStore: Article[] = [...MOCK_ARTICLES, ...MOCK_PENDING];

export async function getPublished(limit = 30): Promise<Article[]> {
  if (isMock) {
    return mockStore
      .filter(a => a.status === 'published')
      .sort((a, b) => (b.published_at ?? '').localeCompare(a.published_at ?? ''))
      .slice(0, limit);
  }
  const { data, error } = await sbAnon()
    .from('articles').select('*')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data as Article[];
}

export async function searchArticles(query: string, limit = 30): Promise<Article[]> {
  if (isMock) return [];
  const q = query.trim();
  if (!q) return [];
  // Postgres RPC использует websearch_to_tsquery — кавычки, минусы, OR работают штатно.
  const { data, error } = await sbAnon().rpc('search_articles_rpc', { q, lim: limit });
  if (error) {
    console.error('search_articles_rpc error', error);
    return [];
  }
  return (data as Article[]) ?? [];
}

export async function getPublishedByCategory(categoryId: number, limit = 40): Promise<Article[]> {
  if (isMock) {
    return mockStore
      .filter(a => a.status === 'published' && a.category_id === categoryId)
      .sort((a, b) => (b.published_at ?? '').localeCompare(a.published_at ?? ''))
      .slice(0, limit);
  }
  const { data, error } = await sbAnon()
    .from('articles').select('*')
    .eq('status', 'published')
    .eq('category_id', categoryId)
    .order('published_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data as Article[];
}

export async function getBySlug(slug: string): Promise<Article | null> {
  if (isMock) return mockStore.find(a => a.slug === slug) ?? null;
  const { data } = await sbAnon()
    .from('articles').select('*').eq('slug', slug).eq('status', 'published').single();
  return (data as Article) ?? null;
}

export async function getPending(): Promise<Article[]> {
  if (isMock) return mockStore.filter(a => a.status === 'pending_review');
  const { data, error } = await sb()
    .from('articles').select('*')
    .eq('status', 'pending_review')
    .order('score', { ascending: false });
  if (error) throw error;
  return data as Article[];
}

export async function getById(id: number): Promise<Article | null> {
  if (isMock) return mockStore.find(a => a.id === id) ?? null;
  const { data } = await sb().from('articles').select('*').eq('id', id).single();
  return (data as Article) ?? null;
}

export async function updateArticle(id: number, patch: Partial<Article>): Promise<void> {
  if (isMock) {
    const a = mockStore.find(x => x.id === id);
    if (a) Object.assign(a, patch, { updated_at: new Date().toISOString() });
    return;
  }
  const { error } = await sb().from('articles')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function setStatus(id: number, status: ArticleStatus, patch: Partial<Article> = {}) {
  return updateArticle(id, { ...patch, status });
}

export interface PipelineLogRow {
  id: number;
  article_id: number | null;
  step: string;
  ok: boolean;
  detail: string | null;
  created_at: string;
  article_title?: string | null;
}

export async function getRecentLogs(limit = 200): Promise<PipelineLogRow[]> {
  if (isMock) return [];
  const { data, error } = await sb()
    .from('pipeline_log')
    .select('id, article_id, step, ok, detail, created_at, articles(raw_title, title)')
    .order('id', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as any[]).map(r => ({
    id: r.id,
    article_id: r.article_id,
    step: r.step,
    ok: r.ok,
    detail: r.detail,
    created_at: r.created_at,
    article_title: r.articles?.title ?? r.articles?.raw_title ?? null
  }));
}

export async function log(articleId: number | null, step: string, ok: boolean, detail = '') {
  if (isMock) {
    console.log(`[log] ${step} ${ok ? 'OK' : 'FAIL'} #${articleId ?? '-'} ${detail}`);
    return;
  }
  await sb().from('pipeline_log').insert({ article_id: articleId, step, ok, detail });
}
