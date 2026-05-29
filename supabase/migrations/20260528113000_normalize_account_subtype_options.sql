update public.accounts
set type = 'bank'
where type = 'other' or type is null;

update public.accounts
set subtype = case
  when subtype = 'other' then 'savings'
  when subtype = 'bank' then 'savings'
  when subtype = 'cash' then 'cash'
  when subtype = 'od' then 'od'
  when subtype = 'fcd' then 'fcd'
  when subtype = 'current' then 'current'
  when subtype = 'savings' then 'savings'
  when coalesce(od_limit, 0) > 0 then 'od'
  when upper(coalesce(currency, 'THB')) <> 'THB' then 'fcd'
  when type = 'cash' then 'cash'
  else 'savings'
end;
