---
title: Finance Cash Position Page Flow
aliases:
  - Cash Position Page
  - Flow หน้า Cash Position
  - หน้า Finance Cash Position
tags:
  - ns-scrap-erp
  - finance
  - debt
  - cash-position
  - page-flow
status: draft
created: 2026-06-11
updated: 2026-06-11
---

# Finance Cash Position Page Flow / Flow หน้า Cash Position

## Scope

- Route: `/finance/cash-position`
- API: `GET /api/finance/cash-position`
- Owner: Finance & Debt
- Page type: read-only liquidity dashboard

หน้านี้ใช้ตอบคำถามว่า "เงินสด/ธนาคารตอนนี้เหลือเท่าไร และหลังหักเจ้าหนี้/รวมลูกหนี้แล้วสถานะเป็นอย่างไร" ไม่ใช่หน้าบันทึกเงินเข้า/ออก

## Source Of Truth

| Data | Source | Rule |
|---|---|---|
| Account balances | `accounts` + `bank_statement` | opening balance + statement movements/running balance |
| AR exposure | `sales_bills` - `receipts` | เฉพาะยอดค้างรับ active |
| AP exposure | `purchase_bills` - `payments` | เฉพาะยอดค้างจ่าย active |
| Near due | derived | จาก due date/aging ของ AR/AP |

## Page Meaning

ใช้สำหรับ:

- ดู net cash/bank ทั้งบริษัท
- แยกยอดตาม account type เช่น Cash, Bank, OD, FCD
- ดู AR/AP exposure ที่กระทบ liquidity
- ดู near due AR/AP
- ดู Top accounts ตาม balance

ไม่ใช้สำหรับ:

- สร้าง bank statement
- โอนเงิน
- รับเงิน/จ่ายเงิน
- ปรับ AR/AP balance

## Main UI Contract

### Summary / KPI

ควรแสดง:

- Account balance รวม
- จำนวนบัญชี active
- Net exposure = AR - AP
- Net after AP = cash/bank - AP
- AR total/overdue/upcoming
- AP total/overdue/upcoming

### Panels

ควรมี:

- liquid composition
- AR/AP bars
- Top accounts
- Net cash position strip
- account table

### Table Columns

คอลัมน์เป้าหมาย:

- Account code
- Account name
- Account no
- Bank
- Branch
- Type
- Currency
- OD limit
- Balance

หน้านี้เป็น aggregate/dashboard จึงไม่มี `created_at` ของ row aggregate แต่ drilldown/link ไป Bank/AP/AR ต้องแสดง `วันที่สร้างรายการ` ที่ source page

## API Contract

`GET /api/finance/cash-position` ตอนนี้ไม่มี query หลัก และควรส่ง:

- `accounts`
- `byType`
- `exposure.ar`
- `exposure.ap`
- `nearDue.ar`
- `nearDue.ap`
- `summary`

Target follow-up อาจเพิ่ม:

- `asOf`
- branch/account type filter
- currency filter

## Business Rules

- Cash Position ต้องอ่านจาก source facts เท่านั้น ไม่บันทึกค่า snapshot เป็น source of truth
- Cancelled PB/SB/payment/receipt ต้องไม่ถูกนับใน exposure active
- Account ids ที่ส่งออกต้องเป็น `accounts.code`
- ถ้าต้องทำ snapshot รายวันในอนาคต ต้อง rebuild/reconcile จาก source facts ได้

## Current Implementation / Gap

- มี read baseline จาก accounts, bank_statement, sales_bills, receipts, purchase_bills, payments
- ยังไม่มี as-of date support
- ยังไม่ได้รวม dedicated customer advance/supplier advance table เพราะ target allocation tables ยังไม่ครบ
- ต้องเพิ่ม drilldown links ไป `/finance/bank`, `/finance/ar`, `/finance/ap`
- ต้องกำหนด currency/FCD conversion policy ถ้าต้องรวมหลายสกุลเงินจริง

## Related Notes

- [[Finance Bank Statement Page Flow]]
- [[Finance AR Page Flow]]
- [[Finance AP Page Flow]]
- [[Document Aging Policy]]
