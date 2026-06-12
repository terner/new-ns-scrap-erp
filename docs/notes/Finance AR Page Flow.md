---
title: Finance AR Page Flow
aliases:
  - Accounts Receivable Page
  - Flow หน้าลูกหนี้ AR
  - หน้า Finance AR
tags:
  - ns-scrap-erp
  - finance
  - debt
  - accounts-receivable
  - page-flow
status: draft
created: 2026-06-11
updated: 2026-06-11
---

# Finance AR Page Flow / Flow หน้าลูกหนี้ AR

## Scope

- Route: `/finance/ar`
- API: `GET /api/finance/ar`
- Owner: Finance & Debt
- Page type: read-only AR aging and receivable dashboard
- Related receipt owner: `/sales/receipts`
- Aging policy: [[Document Aging Policy]]

หน้านี้ใช้ดูยอดค้างรับจากลูกค้าตามบิลขาย ไม่ใช่หน้าบันทึกรับเงิน และไม่ใช่หน้าแก้บิลขายโดยตรง

## Source Of Truth

| Data | Source | Rule |
|---|---|---|
| ยอดตั้งลูกหนี้ | `sales_bills.total_amount` | นับเฉพาะบิลที่ไม่ cancelled |
| ยอดรับแล้ว | `receipts` + `sales_bills.received_amount` | รวม amount + WHT + discount ของ receipt ที่ไม่ cancelled |
| ยอดค้างรับ | derived | `total_amount - received_amount` |
| Aging | derived | ใช้ `sales_bills.due_date`; ถ้าไม่มีใช้ bill date + customer credit term |
| Customer/Branch/Channel | `customers`, `branches`, `sales_channels` | ใช้ outward business code ใน filter/API |

## Page Meaning

ใช้สำหรับ:

- ดูยอดค้างรับรวมของลูกค้า
- ดู aging bucket ของบิลขาย
- ดู top customers ตามยอดค้าง
- ตรวจ pending stock issue banner ที่เกี่ยวข้องกับยอดขายค้างออกบิล/ค้างรับ
- export AR aging เป็น `.xlsx`

ไม่ใช้สำหรับ:

- สร้าง `RCP`
- ยกเลิก receipt
- แก้ไข sales bill
- รับเงินล่วงหน้า customer

## Main UI Contract

### Summary / KPI

ควรแสดง:

- ยอดค้างรับรวม
- จำนวนบิลค้างรับ
- จำนวนลูกค้าที่มียอดค้าง
- ยอด overdue
- ยอดครบกำหนดภายใน 7 วัน
- pending issue summary ถ้ามี
- breakdown ตาม aging bucket

### Filters

ควรรองรับ:

- ค้นหาเลข SB / รหัสลูกค้า / ชื่อลูกค้า / ช่องทางขาย / สาขา
- Customer
- Branch
- Sales channel
- Status
- Aging bucket
- วันที่เอกสารจาก-ถึง
- sort: date, docNo, dueDate, receivableBalance, customerName, aging

### Table Columns

คอลัมน์เป้าหมาย:

- เลข SB
- วันที่บิล
- วันที่สร้างรายการ
- วันที่ครบกำหนด
- Aging days
- Aging bucket
- Customer code/name
- Branch
- Channel
- Transaction mode
- Status
- ยอดบิล
- รับแล้ว
- ค้างรับ

ต้องแยก `วันที่บิล` ออกจาก `วันที่สร้างรายการ` และ `วันที่ครบกำหนด`

## Row Detail / Drilldown

กด row ควรเปิด read-only detail:

- SB document data
- customer/branch/channel
- total/received/balance
- aging/due date
- receipt refs ที่ใช้ตัดยอด
- link ไป `/sales/bills` และ `/sales/receipts`

## API Contract

`GET /api/finance/ar` รับ query:

- `q`
- `customerId`
- `branchId`
- `channelId`
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
- `byCustomer`
- `byBucket`
- `summary`
- `filters`
- `pagination`

## Business Rules

- AR page ต้องไม่สร้างหรือแก้ `RCP`
- Receipt ที่ cancelled ต้องไม่ลด AR balance
- ถ้า SB ถูกยกเลิกต้องไม่แสดงเป็น receivable active
- Aging ต้องใช้ due date ก่อน credit term fallback
- Aging ต้องหยุดนับเมื่อยอดค้างเป็น 0
- Customer advance ที่ allocate เข้า SB ต้องลดยอดลูกหนี้ผ่าน allocation facts ไม่ใช่ string snapshot ระยะยาว

## Current Implementation / Gap

- มี read/export baseline จาก `sales_bills` และ `receipts`
- AR due date รองรับ `due_date` และ customer credit term แล้ว
- ต้องเพิ่ม created-date display ใน list/detail/export
- customer advance allocation ยังต้องย้ายจาก interim snapshot ไป dedicated allocation facts
- ต้องเพิ่ม source links ไป SB/RCP ให้ครบใน detail

## Related Notes

- [[Document Aging Policy]]
- [[Sales Flow]]
- [[Sales Bills Page Flow]]
- [[Finance Bank Statement Page Flow]]
- [[Customer Advance Page Flow]]
