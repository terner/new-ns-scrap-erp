---
title: Customer Advance Page Flow
aliases:
  - Finance Customer Advance Page
  - Flow หน้ารับล่วงหน้าจาก Customer
  - หน้า Customer Advance
tags:
  - ns-scrap-erp
  - finance
  - debt
  - customer-advance
  - page-flow
status: retired
created: 2026-06-11
updated: 2026-07-16
---

# Customer Advance Page Flow / Flow หน้ารับล่วงหน้าจาก Customer

> Retired as an active page. หน้า `/finance/customer-advance` ถูกลบออกจาก active app เพราะซ้ำกับ flow รับเงินลูกค้า. ตั้งแต่ 2026-07-15 canonical target คือ [[Customer Advance Receipt Flow]]: สร้าง `CADV` จาก Packing List ก่อน, ใช้ `/sales/receipts` ออก `RCP` เมื่อรับเงินจริง, แล้วจึงใช้ CADV ที่รับเงินครบไปหัก Sales Bill. เอกสารนี้เก็บ baseline เก่าที่อ่าน `bank_statement.ref_type = CADV` เท่านั้น ไม่ใช่ target implementation ใหม่. Dedicated `customer_advances` และ SB allocation facts มีแล้ว; data dictionary ปัจจุบันอยู่ใน [[Customer Advance Receipt Flow]].

## Scope

- Route: retired; use `/sales/receipts`
- API: `GET /api/finance/customer-advance`
- Owner: Finance & Debt
- Page type: current read baseline for customer advance/deposit
- Current source: `bank_statement.ref_type = 'CADV'`

หน้านี้ใช้ดูเงินรับล่วงหน้าจากลูกค้าที่รอเอาไปหักกับบิลขาย ไม่ใช่หน้า allocation จริงระยะยาวจนกว่าจะมี dedicated customer advance tables

## Current Source Of Truth

| Data | Current Source | Target Source |
|---|---|---|
| Advance row | `bank_statement` with `ref_type = CADV` | `customer_advances` |
| Customer | `bank_statement.ref_id` maps to `customers.code` | FK/business code in `customer_advances` |
| Used amount | baseline page ยังไม่ production-complete | `sales_bill_customer_advance_allocations.allocated_subtotal_amount` plus future RCP allocation facts |
| Remaining amount | baseline page ยังไม่ production-complete | `customer_advances.available_amount` เป็น base credit คงเหลือ |
| Account | `bank_statement.account_id` | cash/bank receipt fact |

## Page Meaning

ใช้สำหรับ:

- ดูยอดรับล่วงหน้าจากลูกค้า
- ดูยอดคงเหลือที่ยังเอาไปหักบิลขายได้
- filter ตามลูกค้า/สถานะ/วันที่
- export เป็น `.xlsx`

ไม่ใช้สำหรับ:

- สร้าง `CADV` ใหม่ ถ้ายังไม่มี write flow ที่ออกแบบครบ
- allocate เข้า SB โดยตรงจากหน้านี้
- ยกเลิกเงินรับล่วงหน้าโดยแก้ bank statement row

## Main UI Contract

### Summary / KPI

ควรแสดง:

- ยอดรับล่วงหน้ารวม
- ยอดใช้แล้ว
- ยอดคงเหลือ
- จำนวนรายการ active
- จำนวน source rows

### Filters

ควรรองรับ:

- ค้นหา doc no / customer code / customer name / account / description
- Customer
- Status: `Open`, `Partially Used`, `Fully Used`, `Cancelled`
- วันที่จาก-ถึง
- sort direction

### Table Columns

คอลัมน์เป้าหมาย:

- เลขเอกสาร
- วันที่รับเงิน
- วันที่สร้างรายการ
- Customer code/name
- Account
- Bank/account no
- Currency
- FX rate
- Amount
- Used
- Remaining
- Status
- Source
- Description

ต้องแยก `วันที่รับเงิน` ออกจาก `วันที่สร้างรายการ`

## Allocation Rule

Target allocation:

- Customer advance ต้องถูกใช้ผ่าน Sales Bill/Receipt flow ที่มี allocation fact
- 1 advance ใช้ได้หลาย SB ถ้ามี remaining
- 1 SB ใช้ได้หลาย advance ถ้าต้องรองรับในอนาคต
- Cancel SB หรือ cancel allocation ต้อง release remaining กลับมา
- ห้ามคำนวณ used amount จาก free-text description หรือ snapshot ในระยะยาว

## API Contract

`GET /api/finance/customer-advance` รับ query:

- `q`
- `customerId`
- `status`
- `from`
- `to`
- `page`
- `pageSize`
- `sortDirection`
- `format=json|xlsx`

Response ควรรวม:

- `rows`
- `summary`
- `filters.customers`
- `filters.statuses`
- `schemaState`
- `pagination`

## Business Rules

- Current page ต้องเปิดเผยว่า source ยังเป็น `bank_statement` ไม่ใช่ dedicated advance table
- Customer matching ต้องใช้ `customers.code` เท่านั้น ไม่ fallback fuzzy name matching
- Used/remaining target ต้องมาจาก allocation facts
- Cancel/reverse ต้องทำผ่าน source money flow ไม่ใช่แก้ row ใน report page

## Current Implementation / Gap

- มี read/export baseline จาก `bank_statement.ref_type = CADV`
- Retired API baseline may still report legacy schema state from the old bank-statement read model
- `usedAmount` ในหน้า retired baseline ยังไม่ใช่ target production source; target SB usage ต้องอ่านจาก `sales_bill_customer_advance_allocations`
- `customer_advances` และ `sales_bill_customer_advance_allocations` มีแล้วใน target runtime; หน้า retired นี้ยังไม่ใช่ surface หลักสำหรับข้อมูลใหม่
- ต้องเชื่อม `/sales/receipts` -> CADV receipt allocation เพื่อ populate `received_amount`/`available_amount` จากเงินจริง
- ต้องเพิ่ม created-date display ใน list/detail/export

## Related Notes

- [[Finance AR Page Flow]]
- [[Sales Bills Page Flow]]
- [[Finance Bank Statement Page Flow]]
- [[Daily Cash Flow]]
