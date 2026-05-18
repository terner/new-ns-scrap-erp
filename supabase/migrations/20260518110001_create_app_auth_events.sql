-- Auth/permission audit events for admin user-management actions.
-- Additive/non-destructive: does not change or delete existing auth/app user data.

create table if not exists public.app_auth_events (
  id uuid primary key default gen_random_uuid(),
  actor_app_user_id uuid references public.app_users(id) on delete set null,
  actor_auth_user_id uuid references auth.users(id) on delete set null,
  target_app_user_id uuid references public.app_users(id) on delete set null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now(),
  constraint app_auth_events_event_type_chk check (event_type ~ '^[a-z0-9_.-]+$')
);

comment on table public.app_auth_events is 'Append-only audit events for app auth, user management, roles, and permission-sensitive actions.';
comment on column public.app_auth_events.metadata is 'Non-secret contextual metadata. Do not store passwords, tokens, or service keys.';

create index if not exists idx_app_auth_events_actor_app_user_id on public.app_auth_events(actor_app_user_id);
create index if not exists idx_app_auth_events_actor_auth_user_id on public.app_auth_events(actor_auth_user_id);
create index if not exists idx_app_auth_events_target_app_user_id on public.app_auth_events(target_app_user_id);
create index if not exists idx_app_auth_events_event_type on public.app_auth_events(event_type);
create index if not exists idx_app_auth_events_created_at on public.app_auth_events(created_at desc);

alter table public.app_auth_events enable row level security;

drop policy if exists app_auth_events_select_audit on public.app_auth_events;
create policy app_auth_events_select_audit
on public.app_auth_events
for select
to authenticated
using (public.has_app_permission('system.audit.view'));

revoke all on table public.app_auth_events from anon;
grant select on table public.app_auth_events to authenticated;
