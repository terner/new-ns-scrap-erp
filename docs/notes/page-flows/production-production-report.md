---
title: รายงานการผลิต / Yield Page Flow
tags:
  - page-flow
  - menu
status: accepted-baseline
updated: 2026-06-11
route: /production/report
---

# รายงานการผลิต / Yield Page Flow

## Scope

| Field | Value |
|---|---|
| Menu section | Production |
| Route | `/production/report` |
| Page | รายงานการผลิต / Yield |
| Current Next | accepted code baseline |

## Canonical References

[[Production Flow]]

## Flow Baseline

production report/yield/output/loss by period/order/line

## Page Responsibilities

- รายงาน output, yield, loss, return และ production performance
- filter date/order/line/product/machine
- drilldown ไป production order and WIP/cost

## Non-Responsibilities

- ไม่สร้าง production transaction
- ไม่ปรับ yield/loss เอง
- ไม่คำนวณ stock balance แทน stock ledger

## Lifecycle / Operation Flow

| Step | User action | System result |
|---|---|---|
| 1 | เปิดหน้า | GET production report |
| 2 | filter | date/order/line/product |
| 3 | drilldown | order/output/cost |
| 4 | export | ตาม filter |

## API / Data Contract

### Current API

- `GET /api/production/report - production/yield report`
- `GET /api/production/yield-loss-report - yield/loss detail API exists but not active menu page`

### Data Contract

- UI ใช้ outward business document/code เป็นหลัก และให้ server resolve internal id
- list/detail/print/export ต้องอ่าน source contract เดียวกันเพื่อลด drift
- transaction write ต้องทำใน server transaction และ append timeline/status/audit ตาม document policy
- ถ้า field เป็น money/qty/date/business code ให้ validate ตาม `docs/design.md` และ server-side ซ้ำ

## Validation / Status Rules

- yield formula ต้องชัดและใช้หน่วยเดียวกัน
- loss category ต้องมาจาก output category policy
- report ต้อง reconcile กับ WIP/output facts

## Side Effects

- read-only ไม่มี side effect

## Current Code Baseline

- Current `apps/next` page/API code is accepted as the P1 proof baseline as of 2026-06-11.
- This page belongs to the finance/production/report baseline group and must keep source facts traceable before formula or write-flow changes.
- Transaction side effects are limited to the current API contract documented above; report pages remain read-model surfaces.
- Future changes should reconcile source table, cutoff, status, and downstream side-effect details here before changing runtime behavior.

## Current Gap

abnormal loss policy and output categories ต้องต่อกับ write flow

## Implementation Checklist

- [x] Verify current Next page/component against this page-flow
- [x] Verify API route handlers match Current API and status rules above
- [ ] Verify legacy behavior for any gap before implementing runtime change
- [ ] Add/adjust tests or browser QA checklist before changing runtime
- [ ] Update this file and canonical reference if contract changes
