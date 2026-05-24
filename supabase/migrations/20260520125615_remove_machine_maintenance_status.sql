create schema if not exists maintenance;
create table if not exists maintenance.production_machines_maintenance_status_backup_20260520125615 as
select id, code, name, maintenance_status, updated_at
from public.production_machines
where maintenance_status is not null;
alter table public.production_machines
  drop column if exists maintenance_status;
