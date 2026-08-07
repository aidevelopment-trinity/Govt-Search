create extension if not exists pgcrypto;

create table if not exists email_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  display_name text,
  unsubscribe_token text not null default encode(gen_random_bytes(24), 'hex') unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table email_subscribers add column if not exists display_name text;
alter table email_subscribers add column if not exists unsubscribe_token text;
update email_subscribers
set unsubscribe_token = encode(gen_random_bytes(24), 'hex')
where unsubscribe_token is null;
alter table email_subscribers alter column unsubscribe_token set default encode(gen_random_bytes(24), 'hex');
alter table email_subscribers alter column unsubscribe_token set not null;
alter table email_subscribers add column if not exists is_active boolean not null default true;

do $$
begin
  alter table email_subscribers
    add constraint email_subscribers_unsubscribe_token_key
    unique (unsubscribe_token);
exception
  when duplicate_object then null;
end $$;

create table if not exists keyword_subscriptions (
  id uuid primary key default gen_random_uuid(),
  subscriber_id uuid not null references email_subscribers(id) on delete cascade,
  saved_search_id uuid not null references saved_searches(id) on delete cascade,
  frequency text not null default 'daily' check (frequency in ('instant', 'daily', 'weekly')),
  is_active boolean not null default true,
  last_notified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (subscriber_id, saved_search_id)
);

create table if not exists notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  subscriber_id uuid references email_subscribers(id) on delete set null,
  saved_search_id uuid references saved_searches(id) on delete set null,
  monitor_run_id uuid references monitor_runs(id) on delete set null,
  delivery_type text not null default 'daily' check (delivery_type in ('instant', 'daily', 'weekly', 'test')),
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'skipped')),
  subject text not null,
  finding_ids uuid[] not null default '{}',
  resend_email_id text,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists email_subscribers_active_idx
on email_subscribers (is_active, email);

create index if not exists keyword_subscriptions_saved_search_idx
on keyword_subscriptions (saved_search_id, is_active);

create index if not exists keyword_subscriptions_subscriber_idx
on keyword_subscriptions (subscriber_id, is_active);

create index if not exists notification_deliveries_status_idx
on notification_deliveries (status, created_at desc);

create index if not exists notification_deliveries_subscriber_search_idx
on notification_deliveries (subscriber_id, saved_search_id, created_at desc);

create or replace function touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists email_subscribers_touch_updated_at on email_subscribers;
create trigger email_subscribers_touch_updated_at
before update on email_subscribers
for each row execute function touch_updated_at();

drop trigger if exists keyword_subscriptions_touch_updated_at on keyword_subscriptions;
create trigger keyword_subscriptions_touch_updated_at
before update on keyword_subscriptions
for each row execute function touch_updated_at();

drop trigger if exists notification_deliveries_touch_updated_at on notification_deliveries;
create trigger notification_deliveries_touch_updated_at
before update on notification_deliveries
for each row execute function touch_updated_at();

alter table email_subscribers enable row level security;
alter table keyword_subscriptions enable row level security;
alter table notification_deliveries enable row level security;

drop policy if exists "Service role can manage email subscribers" on email_subscribers;
create policy "Service role can manage email subscribers"
on email_subscribers
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists "Service role can manage keyword subscriptions" on keyword_subscriptions;
create policy "Service role can manage keyword subscriptions"
on keyword_subscriptions
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists "Service role can manage notification deliveries" on notification_deliveries;
create policy "Service role can manage notification deliveries"
on notification_deliveries
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');
