update public.stock_holds hold
set
  status = 'released',
  released_at = coalesce(hold.released_at, now()),
  released_by = coalesce(hold.released_by, 'system:migration'),
  release_reason = 'draft_hold_retired',
  updated_at = now(),
  updated_by = 'system:migration'
from public.weight_tickets ticket
where ticket.id = hold.weight_ticket_id
  and ticket.doc_type = 'WTO'
  and ticket.status = 'draft'
  and hold.status = 'active';

comment on table public.stock_holds is
  'WTO pending-out reservations. New reservations are created only when a WTO draft is confirmed.';

create or replace function public.enforce_confirmed_wto_active_hold()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  ticket_status text;
  ticket_type text;
begin
  if new.status <> 'active' or new.weight_ticket_id is null then
    return new;
  end if;

  select wt.doc_type, wt.status
  into ticket_type, ticket_status
  from public.weight_tickets wt
  where wt.id = new.weight_ticket_id;

  if ticket_type = 'WTO' and ticket_status not in ('delivered', 'partially_billed', 'billed') then
    raise exception 'active WTO stock hold requires a confirmed document (ticket %, status %)',
      new.weight_ticket_id,
      coalesce(ticket_status, 'missing')
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists stock_holds_confirmed_wto_active_guard on public.stock_holds;

create constraint trigger stock_holds_confirmed_wto_active_guard
after insert or update of status, weight_ticket_id
on public.stock_holds
deferrable initially deferred
for each row
execute function public.enforce_confirmed_wto_active_hold();
