create table if not exists public.line_integration_targets (
  id bigint generated always as identity primary key,
  target_type text not null check (target_type in ('group', 'room', 'user')),
  target_id text not null unique,
  display_name text,
  branch_code text,
  send_wti boolean not null default true,
  send_wto boolean not null default true,
  active boolean not null default true,
  is_default boolean not null default false,
  discovered_at timestamptz not null default now(),
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.line_integration_settings (
  id bigint generated always as identity primary key,
  setting_key text not null default 'default' unique,
  channel_id text,
  channel_access_token_encrypted text,
  channel_access_token_hint text,
  channel_secret_encrypted text,
  channel_secret_hint text,
  webhook_url text,
  default_target_id bigint references public.line_integration_targets(id) on delete set null,
  auto_send_wti boolean not null default false,
  auto_send_wto boolean not null default false,
  pdf_bucket text not null default 'weight-ticket-pdfs',
  last_token_verified_at timestamptz,
  last_webhook_checked_at timestamptz,
  last_webhook_set_at timestamptz,
  last_webhook_tested_at timestamptz,
  last_test_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text
);

create table if not exists public.line_webhook_events (
  id bigint generated always as identity primary key,
  event_type text not null,
  source_type text,
  source_id text,
  group_id text,
  room_id text,
  user_id text,
  payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now()
);

create unique index if not exists line_integration_targets_one_default_idx
  on public.line_integration_targets ((is_default))
  where is_default;

create index if not exists line_integration_targets_active_idx
  on public.line_integration_targets (active, is_default, updated_at desc);

create index if not exists line_webhook_events_received_at_idx
  on public.line_webhook_events (received_at desc);

create index if not exists line_webhook_events_source_idx
  on public.line_webhook_events (source_type, source_id);

alter table public.line_integration_targets enable row level security;
alter table public.line_integration_settings enable row level security;
alter table public.line_webhook_events enable row level security;

grant select, insert, update, delete on public.line_integration_targets to service_role;
grant select, insert, update, delete on public.line_integration_settings to service_role;
grant select, insert, update, delete on public.line_webhook_events to service_role;
grant usage, select on sequence public.line_integration_targets_id_seq to service_role;
grant usage, select on sequence public.line_integration_settings_id_seq to service_role;
grant usage, select on sequence public.line_webhook_events_id_seq to service_role;

insert into public.line_integration_settings (setting_key)
values ('default')
on conflict (setting_key) do nothing;
