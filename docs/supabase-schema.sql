create extension if not exists pgcrypto;

create table if not exists saved_searches (
  id uuid primary key default gen_random_uuid(),
  query text not null,
  state_filter text not null default 'All',
  level_filter text not null default 'All',
  last_results_count integer not null default 0,
  last_searched_sources_count integer not null default 0,
  last_pending_sources_count integer not null default 0,
  last_error_count integer not null default 0,
  last_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists tracked_opportunities (
  id uuid primary key default gen_random_uuid(),
  source_result_id text not null unique,
  title text not null,
  buyer text,
  source_name text not null,
  source_level text,
  source_state text,
  source_type text,
  opportunity_url text not null,
  portal_url text,
  fit_score integer,
  opportunity_status text,
  pursuit_status text not null default 'tracked',
  solicitation_id text,
  deadline text,
  posted_date text,
  budget text,
  contact text,
  summary text,
  next_action text,
  raw_result jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists source_health (
  id uuid primary key default gen_random_uuid(),
  source_name text not null unique,
  source_state text,
  source_level text,
  health_status text not null check (health_status in ('ok', 'error', 'pending')),
  message text,
  checked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tracked_opportunities_pursuit_status_idx
on tracked_opportunities (pursuit_status);

create index if not exists tracked_opportunities_deadline_idx
on tracked_opportunities (deadline);

create index if not exists tracked_opportunities_created_at_idx
on tracked_opportunities (created_at desc);

create or replace function touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists saved_searches_touch_updated_at on saved_searches;
create trigger saved_searches_touch_updated_at
before update on saved_searches
for each row execute function touch_updated_at();

drop trigger if exists tracked_opportunities_touch_updated_at on tracked_opportunities;
create trigger tracked_opportunities_touch_updated_at
before update on tracked_opportunities
for each row execute function touch_updated_at();

drop trigger if exists source_health_touch_updated_at on source_health;
create trigger source_health_touch_updated_at
before update on source_health
for each row execute function touch_updated_at();

alter table saved_searches enable row level security;
alter table tracked_opportunities enable row level security;
alter table source_health enable row level security;

create policy "Service role can manage saved searches"
on saved_searches
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create policy "Service role can manage tracked opportunities"
on tracked_opportunities
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create policy "Service role can manage source health"
on source_health
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');
