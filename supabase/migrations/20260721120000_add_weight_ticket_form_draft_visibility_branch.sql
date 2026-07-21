-- The team activity feed may only disclose a draft through this server-assigned
-- branch. Existing rows remain private until their owner saves them again.
alter table public.weight_ticket_form_drafts
  add column visibility_branch_id bigint
  references public.branches(id) on delete set null;

create index idx_weight_ticket_form_drafts_visibility_updated
  on public.weight_ticket_form_drafts (visibility_branch_id, updated_at desc);

comment on column public.weight_ticket_form_drafts.visibility_branch_id is
  'Trusted server-assigned branch for team draft visibility; never derived from client payload at read time.';
