---
title: หมวดหมู่ผลผลิต Page Flow
tags:
  - page-flow
  - menu
status: accepted-baseline
updated: 2026-06-11
route: /production/output-categories
---

# หมวดหมู่ผลผลิต Page Flow

## Scope

| Field | Value |
|---|---|
| Menu section | Production |
| Route | `/production/output-categories` |
| Page | หมวดหมู่ผลผลิต |
| Current Next | accepted code baseline |

## Canonical References

[[Production Flow]]

## Flow Baseline

master category สำหรับ output/loss/return effect ใน production

## Page Responsibilities

- CRUD หมวดหมู่ผลผลิต เช่น FG/RM/CUSTOMER_RETURN/LOSS ตาม target
- กำหนด behavior ของ output category ต่อ stock/cost/yield
- ใช้ใน production output entry/report

## Non-Responsibilities

- ไม่สร้าง production order
- ไม่เขียน stock ledger เอง
- ไม่เปลี่ยน output category ของ historical production โดยไม่มี audit

## Lifecycle / Operation Flow

| Step | User action | System result |
|---|---|---|
| 1 | เปิดหน้า | GET category list |
| 2 | สร้าง category | POST category |
| 3 | แก้ status/name | PATCH category |
| 4 | ใช้ใน production | production output validate active category |

## API / Data Contract

### Current API

- `GET /api/production/output-categories - list`
- `POST /api/production/output-categories - create`
- `PATCH /api/production/output-categories/[id] - update/status`

### Data Contract

- UI ใช้ outward business document/code เป็นหลัก และให้ server resolve internal id
- list/detail/print/export ต้องอ่าน source contract เดียวกันเพื่อลด drift
- transaction write ต้องทำใน server transaction และ append timeline/status/audit ตาม document policy
- ถ้า field เป็น money/qty/date/business code ให้ validate ตาม `docs/design.md` และ server-side ซ้ำ

## Validation / Status Rules

- code/name/effect required
- ห้ามลบ/ปิด category ที่ถูกใช้งานโดยไม่มีกติกา migration
- effect ต้องอยู่ใน allowed set

## Side Effects

- เขียน production output category master
- ไม่มี stock side effect โดยตรง

## Current Code Baseline

- Current `apps/next` page/API code is accepted as the P1 proof baseline as of 2026-06-11.
- This page belongs to the finance/production/report baseline group and must keep source facts traceable before formula or write-flow changes.
- Transaction side effects are limited to the current API contract documented above; report pages remain read-model surfaces.
- Future changes should reconcile source table, cutoff, status, and downstream side-effect details here before changing runtime behavior.

## Current Gap

category effect enforcement ใน production write flow ยังต้อง implement

## Implementation Checklist

- [x] Verify current Next page/component against this page-flow
- [x] Verify API route handlers match Current API and status rules above
- [ ] Verify legacy behavior for any gap before implementing runtime change
- [ ] Add/adjust tests or browser QA checklist before changing runtime
- [ ] Update this file and canonical reference if contract changes
