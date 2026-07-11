alter table public.weight_tickets
  alter column entered_by set not null,
  alter column status drop default;

alter table public.weight_tickets
  add constraint weight_tickets_entered_by_not_blank_ck
  check (btrim(entered_by) <> '' and entered_by <> '-');
