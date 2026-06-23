alter table public.app_users
  add column if not exists name_prefix text,
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists profile_image_url text,
  add column if not exists contact_phone text,
  add column if not exists contact_line_id text,
  add column if not exists contact_note text;

comment on column public.app_users.name_prefix is 'คำนำหน้าชื่อผู้ใช้งาน เช่น นาย นางสาว Ms.';
comment on column public.app_users.first_name is 'ชื่อจริงของผู้ใช้งานสำหรับข้อมูล profile';
comment on column public.app_users.last_name is 'นามสกุลของผู้ใช้งานสำหรับข้อมูล profile';
comment on column public.app_users.profile_image_url is 'URL รูป profile ของผู้ใช้งาน';
comment on column public.app_users.contact_phone is 'เบอร์โทรศัพท์หรือช่องทางติดต่อหลักของผู้ใช้งาน';
comment on column public.app_users.contact_line_id is 'LINE ID หรือ contact handle ของผู้ใช้งาน';
comment on column public.app_users.contact_note is 'หมายเหตุข้อมูลติดต่อเพิ่มเติมของผู้ใช้งาน';
