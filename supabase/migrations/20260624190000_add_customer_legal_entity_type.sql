alter table public.customers
  add column if not exists legal_entity_type text;

alter table public.customers
  drop constraint if exists customers_legal_entity_type_chk,
  add constraint customers_legal_entity_type_chk
    check (
      legal_entity_type is null
      or legal_entity_type in (
        'บริษัทจำกัด (บจก.)',
        'ห้างหุ้นส่วนจำกัด (หจก.)',
        'บริษัทมหาชนจำกัด (บมจ.)',
        'หน่วยงาน/องค์กร',
        'อื่น ๆ'
      )
    );

comment on column public.customers.legal_entity_type is 'Optional legal entity type for juristic customers, separated from person/company type and domestic/foreign market scope.';
