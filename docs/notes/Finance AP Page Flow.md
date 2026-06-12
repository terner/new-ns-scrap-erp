---
title: Finance AP Page Flow
aliases:
  - Accounts Payable Page
  - Flow หน้าเจ้าหนี้ AP
  - หน้า Finance AP
tags:
  - ns-scrap-erp
  - finance
  - debt
  - accounts-payable
  - page-flow
status: draft
created: 2026-06-11
updated: 2026-06-11
---

# Finance AP Page Flow / Flow หน้าเจ้าหนี้ AP

## Scope

- Route: `/finance/ap`
- API: `GET /api/finance/ap`
- Owner: Finance & Debt
- Page type: read-only AP aging and payable dashboard
- Related payment owner: `/purchase/payments`
- Aging policy: [[Document Aging Policy]]

หน้านี้ใช้ดูยอดค้างจ่าย Supplier จากบิลรับซื้อ ไม่ใช่หน้าบันทึกจ่ายเงิน และไม่ใช่หน้าปรับสถานะบิลโดยตรง

## Source Of Truth

| Data | Source | Rule |
|---|---|---|
| ยอดตั้งหนี้ | `purchase_bills.total_amount` | นับเฉพาะบิลที่ไม่ cancelled |
| ยอดจ่ายแล้ว | `payments` + `purchase_bills.paid_amount` | รวม amount + WHT + discount ของ payment ที่ไม่ cancelled |
| ยอดค้างจ่าย | derived | `total_amount - paid_amount` |
| Aging | derived | target ใช้ due date / supplier credit term; current baseline ใช้ bill date + credit term 0 |
| Supplier/Branch | `suppliers`, `branches` | ใช้ outward business code ใน filter/API |

## Page Meaning

ใช้สำหรับ:

- ดูยอดค้างจ่ายรวมของ Supplier
- ดู aging bucket: `Current`, `1-30`, `31-60`, `61-90`, `>90`
- drilldown จาก supplier summary ไป bill detail rows
- export AP aging เป็น `.xlsx`
- ตรวจบิลที่ควรเข้าสู่ payment approval/payment queue

ไม่ใช้สำหรับ:

- สร้าง `PMA` / `PMT`
- ยกเลิก payment
- แก้ไข purchase bill
- ปรับ bank statement

## Main UI Contract

### Summary / KPI

ควรแสดง:

- ยอดค้างจ่ายรวม
- จำนวนบิลค้างจ่าย
- จำนวน Supplier ที่มียอดค้าง
- ยอด overdue
- ยอดครบกำหนดภายใน 7 วัน
- breakdown ตาม aging bucket

### Filters

ควรรองรับ:

- ค้นหาเลข PB / รหัส Supplier / ชื่อ Supplier / สาขา
- Supplier
- Branch
- Status
- Aging bucket
- วันที่เอกสารจาก-ถึง
- sort: date, docNo, dueDate, payableBalance, supplierName, aging

### Table Columns

คอลัมน์เป้าหมาย:

- เลข PB
- วันที่บิล
- วันที่สร้างรายการ
- วันที่ครบกำหนด
- Aging days
- Aging bucket
- Supplier code/name
- Branch
- Transaction mode
- Status
- ยอดบิล
- จ่ายแล้ว
- ค้างจ่าย

ต้องแยก `วันที่บิล` ออกจาก `วันที่สร้างรายการ` และ `วันที่ครบกำหนด`

## Row Detail / Drilldown

กด row ควรเปิด read-only detail:

- PB document data
- supplier/branch
- total/paid/balance
- aging/due date
- payment refs ที่ใช้ตัดยอด
- link ไป `/purchase/bills` และ `/purchase/payments`

## API Contract

`GET /api/finance/ap` รับ query:

- `q`
- `supplierId`
- `branchId`
- `status`
- `bucket`
- `from`
- `to`
- `page`
- `pageSize`
- `sortKey`
- `sortDirection`
- `format=json|xlsx`

Response ควรรวม:

- `rows`
- `bySupplier`
- `byBucket`
- `summary`
- `filters`
- `pagination`

## Business Rules

- AP page ต้องไม่สร้างหรือแก้ `PMA/PMT`
- ยอดจ่ายที่ cancelled ต้องไม่ลด AP balance
- ถ้า PB ถูกยกเลิกหรือ supplier swap cancelled ต้องไม่แสดงเป็น payable active
- Due date target ต้องรองรับ bill due date / supplier credit term ไม่ใช่ hardcode credit term 0 ระยะยาว
- Aging ต้องหยุดนับเมื่อยอดค้างเป็น 0

## Current Implementation / Gap

- มี read/export baseline จาก `purchase_bills` และ `payments`
- current AP due date ยังใช้ `purchase_bills.date` + credit term 0
- ต้องเพิ่ม created-date display ใน list/detail/export
- ต้องยืนยัน payment allocation source หลัง dedicated allocation facts ครบ
- ต้องเพิ่ม source links ไป PB/PMA/PMT ให้ครบใน detail

## Related Notes

- [[Document Aging Policy]]
- [[Payment Flow]]
- [[Purchase Bills Page Flow]]
- [[Finance Bank Statement Page Flow]]
