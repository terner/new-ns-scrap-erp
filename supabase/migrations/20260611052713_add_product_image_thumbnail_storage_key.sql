alter table public.products
  add column if not exists image_thumbnail_storage_key text;
