-- Split supplier advances and daily expenses from the legacy finance read/write permission.
insert into public.app_permissions (code, module, resource, action, description)
values
  ('purchase.advance_payments.view', 'purchase', 'advance_payments', 'view', 'ดูรายการจ่ายเงินล่วงหน้าผู้ขาย'),
  ('purchase.advance_payments.create', 'purchase', 'advance_payments', 'create', 'สร้างรายการจ่ายเงินล่วงหน้าผู้ขาย'),
  ('purchase.advance_payments.update', 'purchase', 'advance_payments', 'update', 'แก้ไขรายการจ่ายเงินล่วงหน้าผู้ขาย'),
  ('purchase.advance_payments.cancel', 'purchase', 'advance_payments', 'cancel', 'ยกเลิกรายการจ่ายเงินล่วงหน้าผู้ขาย'),
  ('daily.expenses.view', 'daily', 'expenses', 'view', 'ดูรายการค่าใช้จ่าย'),
  ('daily.expenses.create', 'daily', 'expenses', 'create', 'สร้างรายการค่าใช้จ่าย'),
  ('daily.expenses.update', 'daily', 'expenses', 'update', 'แก้ไขรายการค่าใช้จ่าย'),
  ('daily.expenses.cancel', 'daily', 'expenses', 'cancel', 'ยกเลิกรายการค่าใช้จ่าย')
on conflict (code) do update set
  module = excluded.module,
  resource = excluded.resource,
  action = excluded.action,
  description = excluded.description,
  active = true,
  updated_at = now();

insert into public.app_role_permissions (role_id, permission_id, created_by)
select distinct legacy_assignment.role_id, target_permission.id, 'migration'
from public.app_role_permissions legacy_assignment
join public.app_permissions legacy_permission
  on legacy_permission.id = legacy_assignment.permission_id
join public.app_permissions target_permission
  on target_permission.code in (
    'purchase.advance_payments.view',
    'purchase.advance_payments.create',
    'purchase.advance_payments.update',
    'purchase.advance_payments.cancel',
    'daily.expenses.view',
    'daily.expenses.create',
    'daily.expenses.update',
    'daily.expenses.cancel'
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
    'purchase.advance_payments.view',
    'purchase.advance_payments.create',
    'purchase.advance_payments.update',
    'purchase.advance_payments.cancel',
    'daily.expenses.view',
    'daily.expenses.create',
    'daily.expenses.update',
    'daily.expenses.cancel'
  )
where legacy_permission.code = 'finance.cash.view'
on conflict (user_id, permission_id) do nothing;
