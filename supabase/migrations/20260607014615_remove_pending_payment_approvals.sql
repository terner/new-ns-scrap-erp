begin;

with voided_legacy_pending as (
  update public.payment_approvals
  set
    status = 'voided',
    voided_at = coalesce(voided_at, now()),
    voided_by = coalesce(voided_by, 'system-migration'),
    void_reason = coalesce(nullif(void_reason, ''), 'Removed legacy pending PMA placeholder; pending approval queue is source-derived.'),
    note = concat_ws(' | ', nullif(note, ''), 'legacy pending PMA placeholder voided by 20260607014615'),
    updated_at = now()
  where status = 'pending'
  returning *
)
insert into public.payment_approval_status_logs (
  action,
  payment_approval_doc_no,
  source_type,
  source_id,
  source_doc_no_snapshot,
  approved_amount_snapshot,
  from_status,
  to_status,
  note,
  meta,
  created_at,
  created_by,
  payment_approval_id
)
select
  'legacy_pending_placeholder_voided',
  coalesce(doc_no, 'PMA-' || id::text),
  source_type,
  source_id,
  source_doc_no_snapshot,
  approved_amount,
  'pending',
  'voided',
  'Legacy pending PMA placeholder was voided because pending queue is now source-derived.',
  jsonb_build_object('migration', '20260607014615_remove_pending_payment_approvals'),
  now(),
  'system-migration',
  id
from voided_legacy_pending;

alter table public.payment_approvals
  alter column status set default 'approved';

alter table public.payment_approvals
  drop constraint if exists payment_approvals_status_chk;

alter table public.payment_approvals
  add constraint payment_approvals_status_chk
  check (status in ('approved', 'paid', 'voided'));

commit;
