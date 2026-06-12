---
title: Production Dashboard Page Flow
tags:
  - page-flow
  - menu
status: accepted-baseline
updated: 2026-06-11
route: /production/dashboard
---

# Production Dashboard Page Flow

## Scope

| Field | Value |
|---|---|
| Menu section | Production |
| Route | `/production/dashboard` |
| Page | Production Dashboard |
| Current Next | accepted code baseline |

## Canonical References

[[Production Flow]]

## Flow Baseline

dashboard KPI จาก production orders/input/output/WIP/yield/cost

## Page Responsibilities

- สรุป production KPI ตามช่วงเวลา/line/machine/product
- แสดง WIP, output, yield/loss, cost variance
- drilldown ไป production order/report

## Non-Responsibilities

- ไม่สร้าง production transaction
- ไม่แก้ stock/cost
- ไม่เป็น source truth แทน production ledger/facts

## Lifecycle / Operation Flow

| Step | User action | System result |
|---|---|---|
| 1 | เปิดหน้า | GET dashboard aggregate |
| 2 | filter | date/line/machine/product |
| 3 | drilldown | orders/report/WIP |
| 4 | export | ตาม filter |

## API / Data Contract

### Current API

- `GET /api/production/dashboard - production KPI aggregate`

### Data Contract

- UI ใช้ outward business document/code เป็นหลัก และให้ server resolve internal id
- list/detail/print/export ต้องอ่าน source contract เดียวกันเพื่อลด drift
- transaction write ต้องทำใน server transaction และ append timeline/status/audit ตาม document policy
- ถ้า field เป็น money/qty/date/business code ให้ validate ตาม `docs/design.md` และ server-side ซ้ำ

## Validation / Status Rules

- KPI ต้อง reconcile กับ production facts
- yield/loss formula ต้องชัด
- read model ต้องแยก current WIP จาก completed output

## Side Effects

- read-only ไม่มี side effect

## Current Code Baseline

- Current `apps/next` page/API code is accepted as the P1 proof baseline as of 2026-06-11.
- This page belongs to the finance/production/report baseline group and must keep source facts traceable before formula or write-flow changes.
- Transaction side effects are limited to the current API contract documented above; report pages remain read-model surfaces.
- Future changes should reconcile source table, cutoff, status, and downstream side-effect details here before changing runtime behavior.

## Current Gap

reconcile กับ ledger facts หลัง PI/PO2 writes

## Implementation Checklist

- [x] Verify current Next page/component against this page-flow
- [x] Verify API route handlers match Current API and status rules above
- [ ] Verify legacy behavior for any gap before implementing runtime change
- [ ] Add/adjust tests or browser QA checklist before changing runtime
- [ ] Update this file and canonical reference if contract changes
