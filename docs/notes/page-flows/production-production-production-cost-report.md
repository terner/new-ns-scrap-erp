---
title: Production Cost Report Page Flow
tags:
  - page-flow
  - menu
status: accepted-baseline
updated: 2026-06-11
route: /production/production-cost-report
---

# Production Cost Report Page Flow

## Scope

| Field | Value |
|---|---|
| Menu section | Production |
| Route | `/production/production-cost-report` |
| Page | Production Cost Report |
| Current Next | accepted code baseline |

## Canonical References

[[Production Flow]], [[Stock Ledger and Stock Balance]]

## Flow Baseline

process/input/output cost allocation report

## Page Responsibilities

- แสดงต้นทุนการผลิต input cost, process cost, output cost, variance
- filter order/date/line/product/machine
- drilldown ไป production order/WIP/output ledger
- ใช้เป็น base สำหรับ margin/cost analysis

## Non-Responsibilities

- ไม่แก้ต้นทุน production เอง
- ไม่สร้าง stock movement
- ไม่แทน accounting GL ถ้ายังไม่มี posting policy

## Lifecycle / Operation Flow

| Step | User action | System result |
|---|---|---|
| 1 | เปิดหน้า | GET production cost report |
| 2 | filter | order/date/line/product |
| 3 | drilldown | cost components/source |
| 4 | export | ตาม filter |

## API / Data Contract

### Current API

- `GET /api/production/production-cost-report - production cost report`

### Data Contract

- UI ใช้ outward business document/code เป็นหลัก และให้ server resolve internal id
- list/detail/print/export ต้องอ่าน source contract เดียวกันเพื่อลด drift
- transaction write ต้องทำใน server transaction และ append timeline/status/audit ตาม document policy
- ถ้า field เป็น money/qty/date/business code ให้ validate ตาม `docs/design.md` และ server-side ซ้ำ

## Validation / Status Rules

- input/output value ต้อง reconcile กับ stock/cost facts
- variance/loss ต้องแยก category
- currency/unit/cutoff ต้องชัด

## Side Effects

- read-only ไม่มี side effect

## Current Code Baseline

- Current `apps/next` page/API code is accepted as the P1 proof baseline as of 2026-06-11.
- This page belongs to the finance/production/report baseline group and must keep source facts traceable before formula or write-flow changes.
- Transaction side effects are limited to the current API contract documented above; report pages remain read-model surfaces.
- Future changes should reconcile source table, cutoff, status, and downstream side-effect details here before changing runtime behavior.

## Current Gap

final costing and variance allocation ยังต้อง define

## Implementation Checklist

- [x] Verify current Next page/component against this page-flow
- [x] Verify API route handlers match Current API and status rules above
- [ ] Verify legacy behavior for any gap before implementing runtime change
- [ ] Add/adjust tests or browser QA checklist before changing runtime
- [ ] Update this file and canonical reference if contract changes
