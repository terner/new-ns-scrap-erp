-- Preserve the current finance.cash.view write surface while introducing
-- explicit action permissions. Later role edits can remove individual actions.
insert into public.app_role_permissions (role_id, permission_id, created_by)
select distinct legacy_assignment.role_id, target_permission.id, 'migration'
from public.app_role_permissions legacy_assignment
join public.app_permissions legacy_permission
  on legacy_permission.id = legacy_assignment.permission_id
join public.app_permissions target_permission
  on target_permission.code in (
    'daily.petty_advances.view',
    'daily.petty_advances.create',
    'daily.petty_advances.update',
    'daily.petty_advances.cancel',
    'daily.petty_advances.return',
    'daily.payment_approval.view',
    'daily.payment_approval.approve',
    'daily.payment_approval.pay',
    'purchase.bills.view',
    'purchase.bills.create',
    'purchase.bills.update',
    'purchase.bills.cancel',
    'purchase.bills.approve',
    'purchase.bills.pay',
    'sales.bills.view',
    'sales.bills.create',
    'sales.bills.update',
    'sales.bills.cancel',
    'sales.bills.approve',
    'sales.bills.receive'
  )
where legacy_permission.code = 'finance.cash.view'
on conflict do nothing;

insert into public.app_user_permission_overrides (
  user_id,
  permission_id,
  effect,
  created_by,
  updated_by
)
select distinct legacy_override.user_id, target_permission.id, legacy_override.effect, 'migration', 'migration'
from public.app_user_permission_overrides legacy_override
join public.app_permissions legacy_permission
  on legacy_permission.id = legacy_override.permission_id
join public.app_permissions target_permission
  on target_permission.code in (
    'daily.petty_advances.view',
    'daily.petty_advances.create',
    'daily.petty_advances.update',
    'daily.petty_advances.cancel',
    'daily.petty_advances.return',
    'daily.payment_approval.view',
    'daily.payment_approval.approve',
    'daily.payment_approval.pay',
    'purchase.bills.view',
    'purchase.bills.create',
    'purchase.bills.update',
    'purchase.bills.cancel',
    'purchase.bills.approve',
    'purchase.bills.pay',
    'sales.bills.view',
    'sales.bills.create',
    'sales.bills.update',
    'sales.bills.cancel',
    'sales.bills.approve',
    'sales.bills.receive'
  )
where legacy_permission.code = 'finance.cash.view'
on conflict (user_id, permission_id) do nothing;
