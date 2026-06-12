---
title: WIP คงเหลือ Page Flow
tags:
  - page-flow
  - menu
status: accepted-baseline
updated: 2026-06-11
route: /production/wip-report
---

# WIP คงเหลือ Page Flow

## Scope

| Field | Value |
|---|---|
| Menu section | Production |
| Route | `/production/wip-report` |
| Page | WIP คงเหลือ |
| Current Next | accepted code baseline |

## Canonical References

[[Production Flow]]

## Flow Baseline

WIP balance by production/order/product จาก input-output facts

## Page Responsibilities

- แสดง WIP คงเหลือตาม order/line/product/cost bucket
- drilldown ไป input/output transactions
- ใช้ reconcile production close

## Non-Responsibilities

- ไม่สร้าง/แก้ WIP
- ไม่ใช้ stale snapshot เป็น source truth
- ไม่แทน stock balance page

## Lifecycle / Operation Flow

| Step | User action | System result |
|---|---|---|
| 1 | เปิดหน้า | GET WIP report |
| 2 | filter | order/date/line/product |
| 3 | drilldown | production order/input/output |
| 4 | export | ตาม filter |

## API / Data Contract

### Current API

- `GET /api/production/wip-report - WIP read model`

### Data Contract

- UI ใช้ outward business document/code เป็นหลัก และให้ server resolve internal id
- list/detail/print/export ต้องอ่าน source contract เดียวกันเพื่อลด drift
- transaction write ต้องทำใน server transaction และ append timeline/status/audit ตาม document policy
- ถ้า field เป็น money/qty/date/business code ให้ validate ตาม `docs/design.md` และ server-side ซ้ำ

## Validation / Status Rules

- WIP = issued input - received output/loss/return ตาม policy
- completed order ไม่ควรเหลือ WIP โดยไม่มี variance reason
- cost bucket ต้อง reconcile

## Side Effects

- read-only ไม่มี side effect

## Current Code Baseline

- Current `apps/next` page/API code is accepted as the P1 proof baseline as of 2026-06-11.
- This page belongs to the finance/production/report baseline group and must keep source facts traceable before formula or write-flow changes.
- Transaction side effects are limited to the current API contract documented above; report pages remain read-model surfaces.
- Future changes should reconcile source table, cutoff, status, and downstream side-effect details here before changing runtime behavior.

## Current Gap

ต้องอ่านจาก WIP ledger facts หลัง write flow

## Implementation Checklist

- [x] Verify current Next page/component against this page-flow
- [x] Verify API route handlers match Current API and status rules above
- [ ] Verify legacy behavior for any gap before implementing runtime change
- [ ] Add/adjust tests or browser QA checklist before changing runtime
- [ ] Update this file and canonical reference if contract changes
