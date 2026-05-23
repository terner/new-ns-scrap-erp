alter table public.warehouses
  add column if not exists type text;

update public.warehouses
set type = case
  when upper(coalesce(code, '')) like 'RM%' or upper(coalesce(name, '')) like 'RM %' then 'RM'
  when upper(coalesce(code, '')) like 'FG%' or upper(coalesce(name, '')) like 'FG %' then 'FG'
  when upper(coalesce(code, '')) like 'WIP%' or upper(coalesce(code, '')) like 'WFG%' or upper(coalesce(name, '')) like 'WIP %' then 'WIP'
  when upper(coalesce(code, '')) like 'SCRAP%' or name like '%เศษ%' or name like '%ของเสีย%' or name like '%สูญเสีย%' then 'SCRAP'
  else type
end
where type is null;

alter table public.warehouses
  drop constraint if exists warehouses_type_check;

alter table public.warehouses
  add constraint warehouses_type_check
  check (type is null or type in ('RM', 'WIP', 'FG', 'SCRAP'));

comment on column public.warehouses.type is 'Stock location type used for branch warehouse routing: RM=Raw Material, FG=Finish Good, WIP=Work in Process, SCRAP=เศษ/ของเสีย/สูญเสีย.';
