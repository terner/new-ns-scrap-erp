---
title: Cash Flow Calendar Page Flow
tags:
  - page-flow
  - menu
status: accepted-baseline
updated: 2026-06-11
route: /cash-flow-calendar
---

# Cash Flow Calendar Page Flow

## Scope

| Field | Value |
|---|---|
| Menu section | Main Dashboard / Reports |
| Route | `/cash-flow-calendar` |
| Page | Cash Flow Calendar |
| Current Next | accepted code baseline |

## Canonical References

[[Main Dashboard Reports Flow]], [[Finance Debt Flow]], [[Daily Cash Flow]]

## Flow Baseline

Cash Flow Calendar เป็น read-only calendar จาก accounts + bank statement เพื่อดู opening cash, daily cash in/out, ending cash และรายการเงินต่อวัน

## Page Responsibilities

- แสดงปฏิทินรายเดือนของ cash movement จริงจาก `bank_statement`
- คำนวณ opening cash จาก account opening balance + rows ก่อนเดือน
- แสดง running balance, negative-day flag, day entries และ account list
- รองรับ query `month=YYYY-MM`

## Non-Responsibilities

- ไม่สร้าง bank statement หรือ transfer
- ไม่ forecast AP/AR expected cash ที่ยังไม่เกิดจริงใน current baseline
- ไม่แก้ account balance

## Lifecycle / Read Flow

| Step | User action | System result |
|---|---|---|
| 1 | เปิดหน้า | `GET /api/cash-flow-calendar` โหลดเดือนปัจจุบัน |
| 2 | เปลี่ยนเดือน | API คำนวณ `days`, `weeks`, `summary` ใหม่ |
| 3 | ตรวจวัน | UI แสดง entries ของวันและ running ending balance |

## API / Data Contract

### Current API

- `GET /api/cash-flow-calendar?month=YYYY-MM`
- permission: `reports.reports.view`

### Current Source Tables

- `accounts`
- `bank_statement`

### Current Response

- `accounts`
- `days`
- `weeks`
- `summary`
- `sourceState`

## Validation / Status Rules

- month must match `YYYY-MM`; invalid/missing falls back to current month
- cash accounts are selected by account text/type containing cash/bank/OD terms; if none match, all active accounts are used
- calendar uses bank statement date, not created date

## Side Effects

- read-only; no `BST`, account, AP/AR, transfer, payment or receipt writes

## Current Gap

- expected cash from AP/AR due dates is not yet integrated in this current baseline
- export/print and row drilldown need final contract
- account classification should be hardened through master-data account type instead of text matching

## Implementation Checklist

- [x] Verify source tables and month query
- [x] Document actual-cash-only current baseline
- [ ] Decide forecast/expected cash inclusion policy
- [ ] Replace text account classification with typed account contract
- [ ] Define drilldown/export behavior
