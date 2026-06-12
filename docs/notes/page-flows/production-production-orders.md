---
title: ใบสั่งผลิต Page Flow
tags:
  - page-flow
  - menu
status: accepted-baseline
updated: 2026-06-11
route: /production/orders
---

# ใบสั่งผลิต Page Flow

## Scope

| Field | Value |
|---|---|
| Menu section | Production |
| Route | `/production/orders` |
| Page | ใบสั่งผลิต |
| Current Next | accepted code baseline |

## Canonical References

[[Production Flow]], [[Stock Ledger and Stock Balance]]

## Flow Baseline

production order เป็น owner ของ input/WIP/output lifecycle target

## Page Responsibilities

- แสดง/target สร้าง production order
- กำหนด branch/line/machine/input products/output plan/process cost
- target issue input เป็น PI และ receive output เป็น PO2
- แสดง status, WIP, yield/loss, cost และ timeline

## Non-Responsibilities

- ไม่ใช้ stock convert แทน production order
- ไม่รับซื้อ/ขาย/จ่ายเงิน
- ไม่เขียน stock โดยไม่มี production transaction

## Lifecycle / Operation Flow

| Step | User action | System result |
|---|---|---|
| 1 | เปิดหน้า | GET order list/read model |
| 2 | สร้าง order target | branch/line/machine/input/output plan |
| 3 | issue input | PI stock-out/input to WIP |
| 4 | receive output | PO2 output/loss/return stock-in |
| 5 | complete/close | reconcile WIP/yield/cost |

## API / Data Contract

### Current API

- `GET /api/production/orders - production order read/list`

### Data Contract

- UI ใช้ outward business document/code เป็นหลัก และให้ server resolve internal id
- list/detail/print/export ต้องอ่าน source contract เดียวกันเพื่อลด drift
- transaction write ต้องทำใน server transaction และ append timeline/status/audit ตาม document policy
- ถ้า field เป็น money/qty/date/business code ให้ validate ตาม `docs/design.md` และ server-side ซ้ำ

## Validation / Status Rules

- input/output product active
- issue qty ไม่เกิน available
- output/yield/loss ต้อง reconcile กับ input/cost
- close ต้อง WIP/cost balance ชัด

## Side Effects

- target writes stock ledger refs `PI`/`PO2` และ WIP/cost facts
- current read baseline ไม่มี write side effect

## Current Code Baseline

- Current `apps/next` page/API code is accepted as the P1 proof baseline as of 2026-06-11.
- This page belongs to the finance/production/report baseline group and must keep source facts traceable before formula or write-flow changes.
- Transaction side effects are limited to the current API contract documented above; report pages remain read-model surfaces.
- Future changes should reconcile source table, cutoff, status, and downstream side-effect details here before changing runtime behavior.

## Current Gap

PI/PO2 write services and reversal ยังไม่ implement

## Implementation Checklist

- [x] Verify current Next page/component against this page-flow
- [x] Verify API route handlers match Current API and status rules above
- [ ] Verify legacy behavior for any gap before implementing runtime change
- [ ] Add/adjust tests or browser QA checklist before changing runtime
- [ ] Update this file and canonical reference if contract changes
