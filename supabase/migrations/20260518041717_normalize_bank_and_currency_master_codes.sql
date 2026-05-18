alter table public.bank_names
  add column if not exists symbol text;

insert into public.bank_names (id, code, name, symbol, active)
values
  ('BANK-KBANK', '001', 'กสิกรไทย', 'KBANK', true),
  ('BANK-SCB', '002', 'ไทยพาณิชย์', 'SCB', true),
  ('BANK-KTB', '003', 'กรุงไทย', 'KTB', true)
on conflict (name) do update
set
  code = excluded.code,
  symbol = excluded.symbol,
  active = excluded.active;

update public.bank_names
set code = case name
    when 'กสิกรไทย' then '001'
    when 'ไทยพาณิชย์' then '002'
    when 'กรุงไทย' then '003'
    else code
  end,
  symbol = case name
    when 'กสิกรไทย' then 'KBANK'
    when 'ไทยพาณิชย์' then 'SCB'
    when 'กรุงไทย' then 'KTB'
    else symbol
  end
where name in ('กสิกรไทย', 'ไทยพาณิชย์', 'กรุงไทย');

update public.currencies
set code = 'TMP-' || code
where code in ('THB', 'USD', 'CNY', 'EUR', 'JPY', 'SGD');

update public.currencies
set
  code = case code
    when 'TMP-THB' then '001'
    when 'TMP-USD' then '002'
    when 'TMP-CNY' then '003'
    when 'TMP-EUR' then '004'
    when 'TMP-JPY' then '005'
    when 'TMP-SGD' then '006'
    else code
  end,
  symbol = case code
    when 'TMP-THB' then 'THB'
    when 'TMP-USD' then 'USD'
    when 'TMP-CNY' then 'CNY'
    when 'TMP-EUR' then 'EUR'
    when 'TMP-JPY' then 'JPY'
    when 'TMP-SGD' then 'SGD'
    else symbol
  end
where code like 'TMP-%';

update public.payment_methods
set
  bank_name = null,
  account_no = null
where bank_name is not null
  or account_no is not null;
