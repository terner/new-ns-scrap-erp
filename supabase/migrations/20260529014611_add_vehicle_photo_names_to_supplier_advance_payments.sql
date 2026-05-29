alter table public.supplier_advance_payments
add column if not exists vehicle_photo_names text[] not null default '{}';
