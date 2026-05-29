alter table public.accounts
add column if not exists subtype text;

update public.accounts
set subtype = case
  when type = 'cash' then 'cash'
  when coalesce(od_limit, 0) > 0 then 'od'
  when upper(coalesce(currency, 'THB')) <> 'THB' then 'fcd'
  when type = 'bank' then 'bank'
  when type = 'other' then 'other'
  else subtype
end
where subtype is null;
