do $$
declare
  desired record;
  target_id bigint;
begin
  update public.wht_settings
  set
    name = 'WHT 3% (บริการ)',
    rate_percent = 3.00,
    active = true,
    effective_from = least(effective_from, date '2026-01-01'),
    effective_to = null,
    updated_at = now()
  where id = (
    select id
    from public.wht_settings
    where active
      and is_default
      and (
        name in ('WHT 3%', 'WHT 3% (บริการ)')
        or rate_percent in (0.00, 3.00)
      )
    order by id asc
    limit 1
  );

  for desired in
    select *
    from (
      values
        ('WHT 1% (ขนส่ง/รับเหมา)'::text, 1.00::numeric, 'WHT 1%'::text),
        ('WHT 2% (โฆษณา)'::text, 2.00::numeric, 'WHT 2%'::text),
        ('WHT 3% (บริการ)'::text, 3.00::numeric, 'WHT 3%'::text),
        ('WHT 5% (ค่าเช่า)'::text, 5.00::numeric, 'WHT 5%'::text),
        ('WHT 10% (ต่างชาติ)'::text, 10.00::numeric, 'WHT 10%'::text),
        ('WHT 15% (ดอกเบี้ย/เงินปันผล)'::text, 15.00::numeric, 'WHT 15%'::text)
    ) as rows(name, rate_percent, legacy_name)
  loop
    target_id := null;

    select id
    into target_id
    from public.wht_settings
    where name = desired.name
      and rate_percent = desired.rate_percent
    order by active desc, id asc
    limit 1;

    if target_id is null then
      select id
      into target_id
      from public.wht_settings
      where name = desired.legacy_name
        and rate_percent = desired.rate_percent
      order by active desc, id asc
      limit 1;
    end if;

    if target_id is null then
      insert into public.wht_settings (
        name,
        rate_percent,
        active,
        is_default,
        effective_from,
        effective_to
      ) values (
        desired.name,
        desired.rate_percent,
        true,
        false,
        date '2026-01-01',
        null
      );
    else
      update public.wht_settings
      set
        name = desired.name,
        rate_percent = desired.rate_percent,
        active = true,
        effective_from = least(effective_from, date '2026-01-01'),
        effective_to = null,
        updated_at = now()
      where id = target_id;
    end if;
  end loop;

  if not exists (
    select 1
    from public.wht_settings
    where active
      and is_default
  ) then
    update public.wht_settings
    set is_default = true,
        updated_at = now()
    where id = (
      select id
      from public.wht_settings
      where active
        and name = 'WHT 3% (บริการ)'
        and rate_percent = 3.00
      order by id asc
      limit 1
    );
  end if;

  with canonical as (
    select id
    from public.wht_settings
    where active
      and name = 'WHT 3% (บริการ)'
      and rate_percent = 3.00
    order by is_default desc, id asc
    limit 1
  )
  delete from public.wht_settings
  using canonical
  where wht_settings.id <> canonical.id
    and wht_settings.name = 'WHT 3% (บริการ)'
    and wht_settings.rate_percent = 3.00
    and not wht_settings.is_default;
end $$;
