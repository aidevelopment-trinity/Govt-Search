create extension if not exists pgcrypto;

alter table saved_searches add column if not exists monitor_managed boolean not null default false;
alter table saved_searches add column if not exists monitor_enabled boolean not null default false;
alter table saved_searches alter column monitor_enabled set default false;
update saved_searches set monitor_enabled = false where monitor_managed = false;
alter table saved_searches add column if not exists monitor_frequency text not null default 'daily';
alter table saved_searches add column if not exists last_new_results_count integer not null default 0;
alter table saved_searches add column if not exists last_changed_results_count integer not null default 0;
alter table saved_searches add column if not exists last_checked_at timestamptz;

do $$
begin
  alter table saved_searches
    add constraint saved_searches_monitor_frequency_check
    check (monitor_frequency in ('daily', 'weekdays', 'manual'));
exception
  when duplicate_object then null;
end $$;

create table if not exists monitor_runs (
  id uuid primary key default gen_random_uuid(),
  saved_search_id uuid references saved_searches(id) on delete set null,
  query text not null,
  state_filter text not null default 'All',
  level_filter text not null default 'All',
  run_status text not null default 'running' check (run_status in ('running', 'completed', 'failed')),
  trigger_type text not null default 'manual' check (trigger_type in ('manual', 'cron')),
  results_count integer not null default 0,
  searched_sources_count integer not null default 0,
  pending_sources_count integer not null default 0,
  error_count integer not null default 0,
  new_results_count integer not null default 0,
  changed_results_count integer not null default 0,
  elapsed_ms integer not null default 0,
  message text,
  errors jsonb not null default '[]'::jsonb,
  source_statuses jsonb not null default '[]'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists monitor_seen_opportunities (
  id uuid primary key default gen_random_uuid(),
  saved_search_id uuid not null references saved_searches(id) on delete cascade,
  source_result_id text not null,
  title text not null,
  source_name text not null,
  source_level text,
  source_state text,
  buyer text,
  solicitation_id text,
  deadline text,
  opportunity_url text not null,
  document_links jsonb not null default '[]'::jsonb,
  content_hash text not null,
  raw_result jsonb not null default '{}'::jsonb,
  first_seen_run_id uuid references monitor_runs(id) on delete set null,
  last_seen_run_id uuid references monitor_runs(id) on delete set null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_changed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (saved_search_id, source_result_id)
);

create table if not exists monitor_findings (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references monitor_runs(id) on delete cascade,
  saved_search_id uuid not null references saved_searches(id) on delete cascade,
  seen_opportunity_id uuid references monitor_seen_opportunities(id) on delete set null,
  source_result_id text not null,
  finding_type text not null check (finding_type in ('new', 'changed')),
  title text not null,
  source_name text not null,
  source_level text,
  source_state text,
  buyer text,
  solicitation_id text,
  old_deadline text,
  new_deadline text,
  opportunity_url text not null,
  document_links jsonb not null default '[]'::jsonb,
  raw_result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists saved_searches_monitor_enabled_idx
on saved_searches (monitor_managed, monitor_enabled, monitor_frequency, last_checked_at);

create index if not exists monitor_runs_started_at_idx
on monitor_runs (started_at desc);

create index if not exists monitor_runs_saved_search_idx
on monitor_runs (saved_search_id, started_at desc);

create index if not exists monitor_seen_saved_search_idx
on monitor_seen_opportunities (saved_search_id, last_seen_at desc);

create index if not exists monitor_findings_created_at_idx
on monitor_findings (created_at desc);

create index if not exists monitor_findings_saved_search_idx
on monitor_findings (saved_search_id, created_at desc);

create or replace function touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists monitor_runs_touch_updated_at on monitor_runs;
create trigger monitor_runs_touch_updated_at
before update on monitor_runs
for each row execute function touch_updated_at();

drop trigger if exists monitor_seen_opportunities_touch_updated_at on monitor_seen_opportunities;
create trigger monitor_seen_opportunities_touch_updated_at
before update on monitor_seen_opportunities
for each row execute function touch_updated_at();

alter table saved_searches enable row level security;
alter table monitor_runs enable row level security;
alter table monitor_seen_opportunities enable row level security;
alter table monitor_findings enable row level security;

drop policy if exists "Service role can manage saved searches" on saved_searches;
create policy "Service role can manage saved searches"
on saved_searches
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists "Service role can manage monitor runs" on monitor_runs;
create policy "Service role can manage monitor runs"
on monitor_runs
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists "Service role can manage monitor seen opportunities" on monitor_seen_opportunities;
create policy "Service role can manage monitor seen opportunities"
on monitor_seen_opportunities
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists "Service role can manage monitor findings" on monitor_findings;
create policy "Service role can manage monitor findings"
on monitor_findings
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');
