alter table public.products
  add column if not exists image_names text[] not null default '{}';
