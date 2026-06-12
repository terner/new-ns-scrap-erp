---
title: Cash Position Page Flow
tags:
  - page-flow
  - menu
  - finance-debt
  - cash-position
status: accepted-baseline
updated: 2026-06-11
route: /finance/cash-position
---

# Cash Position Page Flow

## Scope

| Field | Value |
|---|---|
| Menu section | Finance & Debt |
| Route | `/finance/cash-position` |
| Page | Cash Position |
| Current Next | accepted code baseline |

## Canonical References

[[Finance Debt Flow]], [[Finance Cash Position Page Flow]], [[Finance Bank Statement Page Flow]], [[Finance AR Page Flow]], [[Finance AP Page Flow]]

## Page Purpose

หน้านี้เป็น dashboard สภาพคล่องรวม. ใช้ตอบว่าเงินสด/ธนาคารเหลือเท่าไร, มี AR ที่คาดว่าจะเข้าเท่าไร, มี AP ที่ต้องจ่ายเท่าไร, และ net position เป็นอย่างไร.

## Legacy Baseline

Legacy `view-cashPosition`:

- รวม active accounts แยก `เงินสด`, `ธนาคาร`, `FCD`, `OD`.
- คำนวณ OD used/available.
- รวม AR จาก sales bills และ AP จาก purchase bills.
- แสดงสูตร `เงินสด + ธนาคาร + FCD + ลูกหนี้ - เจ้าหนี้ - OD ใช้ไป`.
- มี top account และ account table.

## Page Responsibilities

- อ่าน account balances จาก `accounts` + `bank_statement`.
- รวมยอดตาม account type.
- อ่าน AR exposure จาก `sales_bills` - `receipts`.
- อ่าน AP exposure จาก `purchase_bills` - `payments`.
- แสดง near due AR/AP.
- แสดง account table พร้อม balance.
- เป็น aggregate/read model เท่านั้น.

## Non-Responsibilities

- ไม่สร้าง bank statement.
- ไม่ทำ transfer/payment/receipt.
- ไม่แก้ account balance manual.
- ไม่เป็น source of truth ของยอดเงินคงเหลือ.
- ไม่แทนงบกระแสเงินสด/GL ในหมวดการเงิน-บัญชี.

## Lifecycle / Read Flow

| Step | User action | System result |
|---|---|---|
| 1 | เปิดหน้า | GET cash position aggregate |
| 2 | ดู summary | render account balance, exposure, net after AP |
| 3 | ดู near due | show top AR/AP within due window |
| 4 | drilldown target | link ไป bank/AR/AP source pages |

## Current API

`GET /api/finance/cash-position`

Current query: none.

Response:

- `accounts`
- `byType`
- `exposure.ar`
- `exposure.ap`
- `nearDue.ar`
- `nearDue.ap`
- `summary.accountBalance`
- `summary.netAfterAp`
- `summary.netExposure`

Permission ปัจจุบัน: `finance.cash.view`.

## Data Contract

- Account outward id/code = `accounts.code`.
- Account balance derives from `opening_balance` + `bank_statement` running movement unless row balance exists.
- AR/AP exposure rows use source document `doc_no`.
- Aggregate page itself has no row-level `created_at`; source drilldowns must expose created date.

## Validation / Status Rules

- Exclude cancelled SB/PB/payment/receipt from active exposure.
- AP uses purchase bill cancelled status list.
- AR due date uses `due_date` or credit term fallback.
- AP current due date uses bill date in API; target should align with AP page due date policy.
- Currency/FCD conversion is not finalized; current `balance` display uses stored account/bank statement values.

## Side Effects

- Read-only. No cash, AP, AR, stock, or accounting side effect.

## Current Code Baseline

- Current `apps/next` page/API code is accepted as P1 baseline as of 2026-06-11.
- Current API loads accounts, bank rows, SB/RCP, PB/PMT in parallel and builds aggregate in memory.

## Current Gap

- No `asOf` support.
- No branch/account type/currency filter yet.
- Customer advance / supplier advance inclusion policy remains pending dedicated tables.
- Need drilldown links to bank/AR/AP.
- Need currency/FCD conversion policy for multi-currency reporting.

## Implementation Checklist

- [x] Verify current Next page/component against this page-flow
- [x] Verify API route handlers match Current API and status rules above
- [x] Capture legacy cash position baseline
- [ ] Define as-of/currency policy
- [ ] Add drilldown links
- [ ] Reconcile customer advance/supplier advance inclusion
