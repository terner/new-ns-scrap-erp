begin;

do $$
begin
  if exists (
    select 1
    from public.products
    where coalesce(array_length(image_names, 1), 0) > 0
  ) then
    raise exception 'Cannot drop products.image_names while legacy values remain';
  end if;
end
$$;

alter table public.products
  drop column if exists image_names;

commit;
