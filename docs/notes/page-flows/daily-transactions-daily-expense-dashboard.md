---
title: Dashboard ค่าใช้จ่าย Page Flow
tags:
  - page-flow
  - menu
status: accepted-baseline
updated: 2026-06-11
route: /daily/expense-dashboard
---

# Dashboard ค่าใช้จ่าย Page Flow

## Scope

| Field | Value |
|---|---|
| Menu section | Daily Transactions |
| Route | `/daily/expense-dashboard` |
| Page | Dashboard ค่าใช้จ่าย |
| Current Next | accepted code baseline |

## Canonical References

[[Expense Dashboard Flow]], [[Daily Cash Flow]]

## Flow Baseline

read dashboard วิเคราะห์ค่าใช้จ่ายจาก EXP/expense categories/types/payment status

## Page Responsibilities

- สรุปค่าใช้จ่ายตามช่วงเวลา type/category/status/payee
- แสดง trend, top categories, anomaly/threshold ตาม target dashboard
- drilldown ไป EXP detail/list ที่ filter ตรงกัน
- ใช้ข้อมูล expense/payment facts เป็น read model

## Non-Responsibilities

- ไม่สร้างหรือแก้ EXP
- ไม่อนุมัติ/จ่ายเงิน
- ไม่เขียน bank statement
- ไม่เป็น source of truth ของภาษีแทน EXP/PMT facts

## Lifecycle / Operation Flow

| Step | User action | System result |
|---|---|---|
| 1 | เปิดหน้า | โหลด dashboard read model |
| 2 | filter | date/type/category/status/payee |
| 3 | drilldown | เปิดรายการ EXP ที่ประกอบยอด |
| 4 | export/report | ตาม filter ปัจจุบัน |

## API / Data Contract

### Current API

- `Current specific API not found: `/api/daily/expense-dashboard` missing`
- `Expected source APIs: `/api/daily/expenses` and future dashboard aggregate API if needed`

### Data Contract

- UI ใช้ outward business document/code เป็นหลัก และให้ server resolve internal id
- list/detail/print/export ต้องอ่าน source contract เดียวกันเพื่อลด drift
- transaction write ต้องทำใน server transaction และ append timeline/status/audit ตาม document policy
- ถ้า field เป็น money/qty/date/business code ให้ validate ตาม `docs/design.md` และ server-side ซ้ำ

## Validation / Status Rules

- ตัวเลข dashboard ต้อง reconcile กับ EXP source
- cancelled/direct-paid/pending approval ต้องแยก status ชัด
- VAT/WHT summary ต้องใช้ source fact ไม่คำนวณจาก UI

## Side Effects

- read-only ไม่มี side effect

## Current Code Baseline

- Current `apps/next` page/API code is accepted as the P1 proof baseline as of 2026-06-11.
- This page belongs to the finance/production/report baseline group and must keep source facts traceable before formula or write-flow changes.
- Transaction side effects are limited to the current API contract documented above; report pages remain read-model surfaces.
- Future changes should reconcile source table, cutoff, status, and downstream side-effect details here before changing runtime behavior.

## Current Gap

ยังไม่มี page-specific aggregate API; ต้องตัดสินใจว่าจะใช้ `/api/daily/expenses` หรือสร้าง `/api/daily/expense-dashboard`

## Implementation Checklist

- [x] Verify current Next page/component against this page-flow
- [x] Verify API route handlers match Current API and status rules above
- [ ] Verify legacy behavior for any gap before implementing runtime change
- [ ] Add/adjust tests or browser QA checklist before changing runtime
- [ ] Update this file and canonical reference if contract changes
