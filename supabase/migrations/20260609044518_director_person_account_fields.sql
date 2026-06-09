alter table public.director_employees
  add column if not exists name_title text,
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists bank_account_name text,
  add column if not exists bank_branch text;

alter table public.director_employees
  drop constraint if exists director_employees_type_chk;

alter table public.director_employees
  add constraint director_employees_type_chk
  check (
    type is null
    or type in ('กรรมการ', 'ผู้ถือหุ้น', 'พนักงาน', 'บุคคลที่เกี่ยวข้อง')
  ) not valid;

comment on column public.director_employees.name_title is 'Person title/prefix for director/shareholder/employee/related person master records.';
comment on column public.director_employees.first_name is 'Person first name for director/shareholder/employee/related person master records.';
comment on column public.director_employees.last_name is 'Person last name for director/shareholder/employee/related person master records.';
comment on column public.director_employees.bank_account_name is 'Bank account holder name for the person payment account.';
comment on column public.director_employees.bank_branch is 'Bank branch name for the person payment account.';
