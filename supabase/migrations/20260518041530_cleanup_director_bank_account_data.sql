update public.director_employees
set
  bank_name = split_part(btrim(bank_account), ' ', 1),
  account_no = regexp_replace(btrim(bank_account), '^[^[:space:]]+[[:space:]]+', '')
where bank_account is not null
  and btrim(bank_account) <> ''
  and btrim(bank_account) ~ '^[^[:space:]]+[[:space:]]+'
  and (
    bank_name is null
    or btrim(bank_name) = ''
    or account_no = bank_account
  );

update public.director_employees
set phone = case id
  when 'D001' then '0811111111'
  when 'D002' then '0892222222'
  when 'D003' then '0813333333'
  else phone
end
where phone ~* 'x';
