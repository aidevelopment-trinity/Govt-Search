create extension if not exists pgcrypto;

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

create table if not exists search_runs (
  id uuid primary key default gen_random_uuid(),
  query text not null,
  state_filter text not null default 'All',
  level_filter text not null default 'All',
  trigger_type text not null default 'interactive' check (trigger_type in ('interactive', 'monitor')),
  cache_status text not null default 'fresh' check (cache_status in ('fresh', 'cache_hit', 'failed')),
  results_count integer not null default 0,
  searched_sources_count integer not null default 0,
  pending_sources_count integer not null default 0,
  error_count integer not null default 0,
  elapsed_ms integer not null default 0,
  errors jsonb not null default '[]'::jsonb,
  source_statuses jsonb not null default '[]'::jsonb,
  sam_calls_count integer not null default 0,
  sam_rate_limited boolean not null default false,
  sam_rate_limit jsonb not null default '{}'::jsonb,
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists search_runs_completed_at_idx on search_runs (completed_at desc);
create index if not exists search_runs_query_idx on search_runs (lower(query));
create index if not exists source_health_status_idx on source_health (health_status, checked_at desc);
