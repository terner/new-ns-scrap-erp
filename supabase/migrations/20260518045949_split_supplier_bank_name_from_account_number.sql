create schema if not exists maintenance;

insert into public.bank_names (id, code, name, symbol, active)
values
  ('BANK-002', '001', 'ธนาคารกสิกรไทย', 'KBANK', true),
  ('BANK-003', '002', 'ธนาคารไทยพาณิชย์', 'SCB', true),
  ('BANK-KTB', '003', 'ธนาคารกรุงไทย', 'KTB', true),
  ('BANK-BBL', '004', 'ธนาคารกรุงเทพ', 'BBL', true),
  ('BANK-BAY', '005', 'ธนาคารกรุงศรีอยุธยา', 'BAY', true),
  ('BANK-TTB', '006', 'ธนาคารทหารไทยธนชาต', 'TTB', true),
  ('BANK-KKP', '007', 'ธนาคารเกียรตินาคินภัทร', 'KKP', true),
  ('BANK-TISCO', '008', 'ธนาคารทิสโก้', 'TISCO', true),
  ('BANK-CIMBT', '009', 'ธนาคารซีไอเอ็มบี ไทย', 'CIMBT', true),
  ('BANK-UOB', '010', 'ธนาคารยูโอบี', 'UOB', true),
  ('BANK-LH', '011', 'ธนาคารแลนด์ แอนด์ เฮ้าส์', 'LH', true),
  ('BANK-ICBC', '012', 'ธนาคารไอซีบีซี (ไทย)', 'ICBC', true),
  ('BANK-SCBT', '013', 'ธนาคารสแตนดาร์ดชาร์เตอร์ด (ไทย)', 'SCBT', true),
  ('BANK-CREDIT', '014', 'ธนาคารไทยเครดิต', 'CREDIT', true)
on conflict (id) do update
set
  code = excluded.code,
  name = excluded.name,
  symbol = excluded.symbol,
  active = excluded.active;

update public.bank_names existing
set
  code = seed.code,
  name = seed.name,
  symbol = seed.symbol,
  active = seed.active
from (
  values
    ('BANK-002', '001', 'ธนาคารกสิกรไทย', 'KBANK', true),
    ('BANK-003', '002', 'ธนาคารไทยพาณิชย์', 'SCB', true),
    ('BANK-KTB', '003', 'ธนาคารกรุงไทย', 'KTB', true),
    ('BANK-BBL', '004', 'ธนาคารกรุงเทพ', 'BBL', true),
    ('BANK-BAY', '005', 'ธนาคารกรุงศรีอยุธยา', 'BAY', true),
    ('BANK-TTB', '006', 'ธนาคารทหารไทยธนชาต', 'TTB', true),
    ('BANK-KKP', '007', 'ธนาคารเกียรตินาคินภัทร', 'KKP', true),
    ('BANK-TISCO', '008', 'ธนาคารทิสโก้', 'TISCO', true),
    ('BANK-CIMBT', '009', 'ธนาคารซีไอเอ็มบี ไทย', 'CIMBT', true),
    ('BANK-UOB', '010', 'ธนาคารยูโอบี', 'UOB', true),
    ('BANK-LH', '011', 'ธนาคารแลนด์ แอนด์ เฮ้าส์', 'LH', true),
    ('BANK-ICBC', '012', 'ธนาคารไอซีบีซี (ไทย)', 'ICBC', true),
    ('BANK-SCBT', '013', 'ธนาคารสแตนดาร์ดชาร์เตอร์ด (ไทย)', 'SCBT', true),
    ('BANK-CREDIT', '014', 'ธนาคารไทยเครดิต', 'CREDIT', true)
) as seed(id, code, name, symbol, active)
where existing.id = seed.id;

create table if not exists maintenance.supplier_bank_account_split_backup_20260518 as
select
  id,
  code,
  name,
  bank_name,
  bank_account,
  bank_account_name,
  now() as backed_up_at
from public.suppliers
where bank_account is not null
  and btrim(bank_account) <> ''
  and bank_account ~* '(กสิกรไทย|กสิกร|กรุงไทย|กรุงศรี|กรุงเทพ|ไทยพาณิชย์|SCB|KBANK|BBL|TTB|UOB|ICBC|KTB)[[:space:]]*//';

with parsed as (
  select
    id,
    case
      when upper(split_part(bank_account, '//', 1)) like '%KBANK%' then 'กสิกรไทย'
      when split_part(bank_account, '//', 1) like '%กสิกรไทย%' then 'กสิกรไทย'
      when split_part(bank_account, '//', 1) like '%กสิกร%' then 'กสิกรไทย'
      when upper(split_part(bank_account, '//', 1)) like '%SCB%' then 'ไทยพาณิชย์'
      when split_part(bank_account, '//', 1) like '%ไทยพาณิชย์%' then 'ไทยพาณิชย์'
      when upper(split_part(bank_account, '//', 1)) like '%KTB%' then 'กรุงไทย'
      when split_part(bank_account, '//', 1) like '%กรุงไทย%' then 'กรุงไทย'
      when split_part(bank_account, '//', 1) like '%กรุงศรี%' then 'กรุงศรี'
      when upper(split_part(bank_account, '//', 1)) like '%BBL%' then 'กรุงเทพ'
      when split_part(bank_account, '//', 1) like '%กรุงเทพ%' then 'กรุงเทพ'
      when upper(split_part(bank_account, '//', 1)) like '%TTB%' then 'TTB'
      when upper(split_part(bank_account, '//', 1)) like '%UOB%' then 'UOB'
      when upper(split_part(bank_account, '//', 1)) like '%ICBC%' then 'ICBC'
      else null
    end as parsed_bank_name,
    btrim(
      regexp_replace(
        regexp_replace(
          bank_account,
          '(เงินสด[[:space:]]*-[[:space:]]*)?(กสิกรไทย|กสิกร|กรุงไทย|กรุงศรี|กรุงเทพ|ไทยพาณิชย์|SCB|KBANK|BBL|TTB|UOB|ICBC|KTB)[[:space:]]*//[[:space:]]*',
          '',
          'gi'
        ),
        '[[:space:]]+',
        ' ',
        'g'
      )
    ) as parsed_account_no
  from public.suppliers
  where bank_account is not null
    and btrim(bank_account) <> ''
    and bank_account ~* '(กสิกรไทย|กสิกร|กรุงไทย|กรุงศรี|กรุงเทพ|ไทยพาณิชย์|SCB|KBANK|BBL|TTB|UOB|ICBC|KTB)[[:space:]]*//'
)
update public.suppliers supplier
set
  bank_name = coalesce(nullif(btrim(supplier.bank_name), ''), parsed.parsed_bank_name),
  bank_account = nullif(parsed.parsed_account_no, '')
from parsed
where supplier.id = parsed.id;
