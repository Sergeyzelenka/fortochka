-- Add collect_enabled flag to sources.
-- Separate switch from enabled: lets the editor pause a source in collection
-- without disabling it entirely (used to balance category skew).
-- Default true so existing sources keep collecting after migration.

alter table public.sources
  add column if not exists collect_enabled boolean not null default true;

-- Backfill: any source currently enabled keeps collecting; disabled ones
-- start paused in collection too, matching the old behavior.
update public.sources
  set collect_enabled = enabled
  where collect_enabled is distinct from enabled;
