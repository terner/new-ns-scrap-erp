---
title: Petty Advance Page Flow
aliases:
  - Daily Petty Advance Page
  - Flow หน้าเงินสำรองจ่าย
  - Flow หน้ากู้กรรมการ
  - หน้า Petty Advance
tags:
  - ns-scrap-erp
  - finance
  - debt
  - petty-advance
  - page-flow
status: draft
created: 2026-06-11
updated: 2026-06-11
---

# Petty Advance Page Flow / Flow หน้าเงินสำรองจ่ายและกู้กรรมการ

## Scope

- Route: `/daily/petty-advance`
- APIs: `GET/POST /api/daily/petty-advances`, `POST /api/daily/petty-advances/returns`
- Navigation section: `การเงิน & หนี้`
- Owner: Finance & Debt
- Page type: advance outstanding write flow + return-money flow
- Related central flow: [[Daily Cash Flow]]

หน้านี้ใช้ติดตามยอดเงินที่บริษัทให้กรรมการ/พนักงานยืม หรือเงินสำรองจ่ายที่ยังต้องเคลียร์คืน ไม่ใช่ expense posting และไม่ใช่ payment approval

## Document Model

| Document | Meaning | Bank Statement Impact |
|---|---|---|
| `PADV` | เอกสารยอดยืม/เงินสำรองจ่ายคงค้าง | ไม่สร้าง `BST` ตอน create/edit |
| `PRET` | เอกสารคืนเงินสำรองจ่าย | สร้าง `BST` เงินเข้า |
| `BST` | bank statement row | เกิดตอนคืนเงิน `PRET` เท่านั้นใน flow นี้ |

## Source Of Truth

- `petty_advances` = header/outstanding document
- `petty_advance_returns` = return-money rows
- `bank_statement` = cash/bank impact เฉพาะตอน return
- `director_employees` = source option ของผู้รับเงิน เฉพาะประเภท `กรรมการ` และ `พนักงาน`

## Page Meaning

ใช้สำหรับ:

- สร้าง/แก้ `PADV`
- ดูยอดที่ให้ยืม/สำรองจ่าย
- ดูยอดคืนแล้วและยอดคงเหลือ
- บันทึกคืนเงิน `PRET`
- ดูประวัติการคืนเงินของแต่ละ `PADV`

ไม่ใช้สำหรับ:

- สร้างค่าใช้จ่าย `EXP`
- สร้าง `PMA/PMT`
- ตัดเงินบริษัทตอน create `PADV`
- แก้ bank statement โดยตรง

## Main UI Contract

### List

ควรแสดง:

- เลข `PADV`
- วันที่จ่าย
- วันที่สร้างรายการ
- ประเภท
- ผู้รับเงิน
- บัญชีรับเงิน snapshot
- จำนวนเงิน
- ใช้ไป
- คืนแล้ว
- คงเหลือ
- สถานะ
- หมายเหตุ

### Filters

ควรรองรับ:

- ค้นหาเลขเอกสาร / ผู้รับเงิน / หมายเหตุ
- ประเภท: `DIRECTOR_LOAN`, `PETTY_CASH`
- สถานะ: `active`, `closed`, `cancelled`
- วันที่จ่ายจาก-ถึง
- filter ประเภทและสถานะควรแยกบรรทัดตาม design ที่ยืนยันไว้

## Create/Edit Modal Contract

### Header Section

- วันที่จ่าย
- ประเภท
- ผู้รับเงิน
- บัญชีรับเงิน read-only

### Amount Section

- จำนวนเงิน
- หมายเหตุ textarea

### System Fields

- ไม่แสดงเลข `PADV`; server ออกเลขเอง
- ไม่แสดงบัญชีจ่ายของบริษัท
- ไม่สร้าง `BST` ตอน create/edit
- ผู้รับเงินต้องเลือกจาก combobox ของกรรมการ/พนักงานที่ active และมีบัญชีรับเงินครบ
- ต้อง snapshot ชื่อผู้รับเงิน ธนาคาร ชื่อบัญชี เลขบัญชี และสาขา ลง `petty_advances`

## Return Modal Contract

กด `คืนเงิน` ได้เฉพาะรายการที่ยัง active และมียอดคงเหลือ

Field:

- วันที่คืนเงิน
- จำนวนเงินคืน
- บัญชีรับคืน
- หมายเหตุ

เมื่อบันทึก:

- สร้าง `PRET`
- เพิ่ม `petty_advance_returns`
- update `petty_advances.returned_amount`
- ถ้าคืนครบให้ปิด status เป็น `closed`
- สร้าง `bank_statement` เงินเข้า `ref_type = PRET`

## API Contract

`GET /api/daily/petty-advances` ส่ง:

- `rows`
- `accounts`
- `recipientOptions`

`POST /api/daily/petty-advances` รับ:

- `id`
- `docNo`
- `date`
- `type`
- `recipientId`
- `recipientName`
- `amount`
- `status`
- `notes`

`POST /api/daily/petty-advances/returns` รับ:

- `advanceId`
- `date`
- `amount`
- `accountId`
- `notes`

## Business Rules

- `PADV` เป็นยอดค้าง ไม่ใช่ cash movement
- `PRET` เท่านั้นที่สร้าง bank statement ใน flow นี้
- ผู้รับเงินต้องมาจาก `director_employees.code`, ไม่ใช้ free-text
- ถ้าข้อมูลบัญชีผู้รับเงินใน master เปลี่ยน ประวัติ `PADV` ต้องไม่เปลี่ยน เพราะมี snapshot
- ยอดคืนรวมต้องไม่เกินยอด `PADV`
- Cancel/reverse ต้องออกแบบ append-only ก่อนเปิดใช้จริง

## Current Implementation / Gap

- มี create/edit/return baseline แล้ว
- `spent` ยังเป็น 0 จนกว่า expense allocation กับเงินสำรองจะถูกออกแบบ
- ยังไม่มี dedicated `petty_advance_status_logs`
- ต้องเพิ่ม created-date display ใน list/detail/export ถ้ามี export
- ต้องออกแบบ cancel/reverse และ expense allocation
- ต้องยืนยัน server-side block ยอดคืนเกินยอดคงเหลือ

## Related Notes

- [[Daily Cash Flow]]
- [[Finance Bank Statement Page Flow]]
- [[Document Timeline Policy]]
