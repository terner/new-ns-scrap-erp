---
title: พนักงาน / กรรมการ Page Flow
tags:
  - page-flow
  - menu
  - master-data
status: accepted-baseline
updated: 2026-06-26
route: /master-data/directors
---

# พนักงาน / กรรมการ Page Flow

## Scope

| Field | Value |
|---|---|
| Menu section | Master Data |
| Route | `/master-data/directors` |
| Page | พนักงาน / กรรมการ |
| Current Next | accepted code baseline |

## Canonical References

[[Menu Page Flow Catalog]]

## Flow Baseline

company person master for directors/shareholders/employees/related persons and petty advance recipient accounts

## Page Responsibilities

- ดูแล master data ของ พนักงาน / กรรมการ
- ดูแลบัญชีรับเงินได้หลายบัญชีต่อบุคคล โดยแต่ละบัญชีต้องระบุว่าเป็นบัญชีในบริษัทหรือนอกบริษัท
- รองรับ list/search/filter/sort/resize/export/import เฉพาะที่ API ของหน้านี้เปิดไว้
- ใช้ code/name/status เป็น outward UI identity และให้ server resolve internal id
- แสดง created date/status และใช้งาน active-only ใน transaction pages
- เก็บ snapshot ลง business documents เมื่อ master ถูกนำไปใช้ในเอกสารที่ต้องรักษาประวัติ

## Non-Responsibilities

- ไม่สร้าง business transaction เช่น PB/SB/PMT/RCP/ST
- ไม่แก้เอกสารย้อนหลังเมื่อ master ถูกเปลี่ยน เว้นแต่มี migration/audit rule
- ไม่ทำ runtime fallback เพื่อรับ legacy bad data; ถ้าข้อมูลผิดต้องแก้ที่ data/migration/source process

## Lifecycle / Master Data Flow

| Step | User action | System result |
|---|---|---|
| 1 | เปิดหน้า | โหลด list จาก Current API |
| 2 | สร้าง/แก้ไข | validate code/name/type/status, required fields, และบัญชีรับเงินหลายรายการ |
| 3 | บันทึก | เขียน master row, เขียนบัญชีรับเงินลูก, sync บัญชีหลักกลับ field legacy และ audit/updated timestamp |
| 4 | ปิดใช้งาน | active=false/status inactive เพื่อกันเลือกในเอกสารใหม่ |
| 5 | นำไปใช้ | transaction pages เลือกเฉพาะ active และ snapshot ค่าที่ต้อง trace |

## API / Data Contract

### Current API

- `GET/POST /api/master-data/directors`
- `PATCH /api/master-data/directors/[id]`
- `GET/POST /api/master-data/directors; item API by id exists`

### Data Contract

- UI ใช้ business code/name เป็นหลัก ไม่ expose internal id เป็นเลขธุรกิจ
- บัญชีรับเงินหลายรายการเก็บใน `director_employee_bank_accounts`
- `source_type = IN_COMPANY` ต้อง link ไป `accounts` ที่ active และดึงธนาคาร/ชื่อบัญชี/เลขบัญชีจากบัญชีในบริษัท
- `source_type = OUTSIDE_COMPANY` ต้องกรอกธนาคาร, ชื่อบัญชี, เลขบัญชีเอง และไม่ link `accounts`
- บัญชีหลัก active บัญชีแรกถูก sync กลับ `director_employees.bank_name`, `bank_account_name`, `account_no`, `bank_branch`, `bank_account` เพื่อ compatibility กับ flow เดิม
- create/update ต้อง validate server-side ตาม field type matrix ใน `docs/design.md`
- active/inactive ต้องใช้เป็น selection eligibility ใน transaction pages
- import/export ถ้ามี ต้องใช้ validation ชุดเดียวกับ form/API

## Validation / Status Rules

- required fields ต้องชัดตามหน้าและไม่พึ่ง placeholder เป็น validation
- ถ้าเพิ่มบัญชีรับเงิน ต้องเลือกประเภทบัญชี `บัญชีในบริษัท` หรือ `บัญชีนอกบริษัท`
- ถ้าเป็นบัญชีในบริษัท ต้องเลือกจาก `/master-data/accounts`
- ถ้าเป็นบัญชีนอกบริษัท ต้องกรอกธนาคาร, ชื่อบัญชี, และเลขบัญชี
- ควรมีบัญชีหลักหนึ่งบัญชีในกลุ่มบัญชีที่ active; ถ้าไม่ได้เลือก ระบบตั้งบัญชี active แรกเป็นบัญชีหลัก
- code/business id ต้อง unique ตาม scope ที่กำหนด
- inactive row ต้องยังแสดงในประวัติเอกสารเก่า แต่ห้ามเลือกในเอกสารใหม่
- ห้าม normalize/merge ข้อมูล legacy แบบ silent ใน runtime path

## Side Effects

- เขียนเฉพาะ master data table ของหน้านี้และ audit/updated timestamp
- ไม่มี stock/payment/accounting side effect โดยตรง
- downstream business documents ต้อง snapshot ค่า master ที่จำเป็นเอง

## Current Code Baseline

- Current `apps/next` code supports multi receiving accounts for this master-data page.
- Legacy behavior does not override this page unless user requests a page-specific change.
- Future work is doc sync when current code changes, not legacy proof.
- Downstream transaction pages must consume this master data through active rows and snapshot values as required by their own flow.

## Current Gap

Remaining work is browser/UAT verification and import/export follow-up for the new child account table.

## Implementation Checklist

- [x] Current code supports multiple receiving accounts with in-company/outside-company source type
- [ ] Verify future form changes against docs/design.md Field Input Decision Matrix
- [ ] Verify required fields and server validation
- [ ] Verify active/inactive behavior in downstream transaction pages
- [ ] Verify import/export if present
- [ ] Update this page-flow when master schema changes
