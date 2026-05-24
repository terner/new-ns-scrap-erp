create schema if not exists maintenance;
create table if not exists maintenance.payment_methods_code_cleanup_backup_20260520123520 as
select *
from public.payment_methods;
create table if not exists maintenance.bank_names_payment_method_cleanup_backup_20260520123520 as
select *
from public.bank_names
where trim(name) in ('เงินสด', 'เงินโอน', 'โอนเงิน');
create table if not exists maintenance.supplier_payment_method_canonical_backup_20260520123520 as
select *
from public.supplier_bank_accounts
where payment_method in ('เงินสด', 'เงินโอน', 'โอนเงิน');
delete from public.bank_names
where trim(name) in ('เงินสด', 'เงินโอน', 'โอนเงิน');
insert into public.payment_methods (id, code, name, active)
values
  ('PM-001', 'PM-001', 'เงินสด (Cash)', true),
  ('PM-002', 'PM-002', 'เงินโอน (Bank Transfer)', true),
  ('PM-003', 'PM-003', 'เช็ค (Cheque)', true),
  ('PM-004', 'PM-004', 'พร้อมเพย์ (PromptPay)', true),
  ('PM-005', 'PM-005', 'โอนเงินต่างประเทศ (International Transfer)', true),
  ('PM-006', 'PM-006', 'โอนเงิน FCD (FCD Transfer)', true)
on conflict (id) do update
set
  code = excluded.code,
  name = excluded.name,
  active = excluded.active,
  updated_at = now();
update public.supplier_bank_accounts
set payment_method = 'เงินโอน',
    updated_at = now()
where payment_method = 'โอนเงิน';
alter table public.supplier_bank_accounts
  alter column payment_method set default 'เงินโอน';
alter table public.payment_methods
  drop column if exists code;
