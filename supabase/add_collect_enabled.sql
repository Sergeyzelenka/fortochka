-- Run this once in the cloud Supabase SQL Editor.
-- Adds the collect_enabled flag to sources (collection on/off, separate from enabled).

alter table public.sources
  add column if not exists collect_enabled boolean not null default true;

update public.sources
  set collect_enabled = enabled
  where collect_enabled is distinct from enabled;
