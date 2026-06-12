---
title: Owner Daily Control Page Flow
tags:
  - page-flow
  - menu
status: accepted-baseline
updated: 2026-06-11
route: /owner-daily
---

# Owner Daily Control Page Flow

## Scope

| Field | Value |
|---|---|
| Menu section | Main Dashboard / Reports |
| Route | `/owner-daily` |
| Page | Owner Daily Control |
| Current Next | accepted code baseline |

## Canonical References

[[Main Dashboard Reports Flow]], [[Document Aging Policy]], [[Finance Debt Flow]], [[Stock Ledger and Stock Balance]]

## Flow Baseline

Owner Daily เป็น morning control view ให้เจ้าของเห็น cash plan, actual activity, due AR/AP, loan due, expense today, pending production/sale/trading risk ในหน้าเดียว

## Page Responsibilities

- แสดงเงินสดพร้อมใช้, expected in/out และ gap จาก `ownerDaily.cashPlan`
- แสดง actual activity ของวัน เช่น cash in/out, payment out, expense out, FG qty/value
- แสดง due AR/AP, loan today, expense today และ pending counts
- ใช้ filter/query contract เดียวกับ dashboard

## Non-Responsibilities

- ไม่สร้างแผนจ่ายเงินหรืออนุมัติจ่าย
- ไม่แก้ AR/AP, bank statement, loan schedule หรือ stock
- ไม่ auto-close pending documents

## Lifecycle / Read Flow

| Step | User action | System result |
|---|---|---|
| 1 | เปิดหน้า | `GET /api/owner-daily` เรียก dashboard handler เดียวกัน |
| 2 | เลือกวันที่/ช่วง/สาขา | API คำนวณ `ownerDaily` จาก source facts |
| 3 | ตรวจ due/pending | UI แสดงรายการและ link ไปหน้าต้นทาง |
| 4 | Follow-up | user ไปทำงานใน payment/stock/sales/purchase page ที่เป็น owner ของ action |

## API / Data Contract

### Current API

- `GET /api/owner-daily`
- implementation: re-export `GET` from `/api/dashboard`
- permission: `reports.reports.view`

### Current Source Tables / Helpers

- same source as `/api/dashboard`
- key response section: `ownerDaily.actualActivity`, `ownerDaily.cashPlan`, `ownerDaily.due`, `ownerDaily.expensesToday`, `ownerDaily.loanToday`, `ownerDaily.pending`

## Validation / Status Rules

- due AR uses SB receivable balance and due date derived from bill date + credit term
- due AP currently uses PB date as due baseline unless future AP policy changes
- loan today uses unpaid `loan_schedules` due on/before selected date
- pending counts are read-only indicators and must not be treated as source status writes

## Side Effects

- read-only; no PMA/PMT/RCP/BST/stock/timeline writes

## Current Gap

- due-date policy should be reconciled with AR/AP page docs before changing formulas
- source links for every due/pending row still need final route mapping
- no server-side export/print contract yet

## Implementation Checklist

- [x] Verify current API delegates to dashboard API
- [x] Document source response sections
- [ ] Finalize AP due-date source
- [ ] Map each due/pending row to source route
- [ ] Add owner daily formula/cutoff test cases
