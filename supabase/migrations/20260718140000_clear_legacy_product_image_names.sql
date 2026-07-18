begin;

do $$
begin
  if exists (
    select 1
    from public.products
    where coalesce(array_length(image_names, 1), 0) > 0
      and (image_storage_key is null or image_thumbnail_storage_key is null)
  ) then
    raise exception 'Cannot clear legacy product images while a product is missing Storage keys';
  end if;
end
$$;

update public.products
set image_names = '{}'::text[],
    updated_at = now()
where coalesce(array_length(image_names, 1), 0) > 0;

commit;
