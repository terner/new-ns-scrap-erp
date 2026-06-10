alter table public.company_profiles
  add column if not exists branch_id bigint;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'company_profiles_branch_id_fkey'
      and conrelid = 'public.company_profiles'::regclass
  ) then
    alter table public.company_profiles
      add constraint company_profiles_branch_id_fkey
      foreign key (branch_id)
      references public.branches(id)
      on update no action
      on delete restrict;
  end if;
end $$;

create unique index if not exists company_profiles_branch_id_unique
  on public.company_profiles(branch_id)
  where branch_id is not null;

create index if not exists idx_company_profiles_branch_id
  on public.company_profiles(branch_id);

comment on table public.company_profiles is 'Company print profiles. Rows with branch_id are branch-specific document headers; branch_id null is the legacy fallback profile.';
comment on column public.company_profiles.branch_id is 'Branch owning this print profile. Null row is kept as fallback for legacy/default rendering.';
