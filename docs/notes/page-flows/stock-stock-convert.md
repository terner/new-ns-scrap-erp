---
title: Grade Adjustment / ปรับเกรด Page Flow
tags:
  - page-flow
  - menu
status: accepted-baseline
updated: 2026-06-11
route: /stock/convert
---

# Grade Adjustment / ปรับเกรด Page Flow

## Scope

| Field | Value |
|---|---|
| Menu section | Stock |
| Route | `/stock/convert` |
| Page | Grade Adjustment / ปรับเกรด |
| Current Next | accepted code baseline |

## Canonical References

[[Stock Convert Page Flow]], [[Stock Ledger and Stock Balance]]

## Flow Baseline

GA แปลงสินค้า/เกรดจาก source product เป็น target product พร้อม cost/yield policy

## Page Responsibilities

- แปลง product/grade จาก source stock เป็น target stock
- เลือก source product/warehouse/qty และ target product/qty/reason
- คำนวณ cost carry-forward/yield/loss ตาม policy
- เขียน ledger out source และ in target

## Non-Responsibilities

- ไม่ใช่ stock transfer ระหว่าง warehouse
- ไม่ใช่ production order เต็มรูปแบบ
- ไม่ควรใช้แก้ข้อมูลย้อนหลังโดยไม่มี reason/audit

## Lifecycle / Operation Flow

| Step | User action | System result |
|---|---|---|
| 1 | เปิดหน้า | GET conversion list/options |
| 2 | เลือก source/target | validate availability และ product relation |
| 3 | บันทึก | POST GA ledger pair และ cost allocation |
| 4 | reverse | target reversal ต้องคืน source/target balance |

## API / Data Contract

### Current API

- `GET /api/stock/convert - list/options`
- `POST /api/stock/convert - create grade/product conversion`

### Data Contract

- UI ใช้ outward business document/code เป็นหลัก และให้ server resolve internal id
- list/detail/print/export ต้องอ่าน source contract เดียวกันเพื่อลด drift
- transaction write ต้องทำใน server transaction และ append timeline/status/audit ตาม document policy
- ถ้า field เป็น money/qty/date/business code ให้ validate ตาม `docs/design.md` และ server-side ซ้ำ

## Validation / Status Rules

- source qty > 0 และ available พอ
- target qty > 0 และ target product active
- cost/yield policy ต้องไม่ทำมูลค่าหายโดยไม่มี loss reason
- ห้าม convert stock ที่ active hold

## Side Effects

- เขียน stock ledger source out / target in ด้วย ref_type GA
- กระทบ WAC/cost bucket ตาม costing policy

## Current Code Baseline

- Current `apps/next` page/API code is accepted as the P0 implementation baseline as of 2026-06-11.
- This page belongs to the transaction/stock/payment risk group; accepted baseline means proofed against current code, not target-complete.
- Runtime changes must preserve documented status, allocation, ledger, payment, lock, and reversal boundaries, or update this page-flow and the canonical flow first.
- See [[P0 Transaction Stock Payment Current Code Baseline]] for API/permission/side-effect proof notes and open critical gaps.

## Current Gap

cost allocation, yield/loss และ reversal ยังต้องกำหนดละเอียด

## Implementation Checklist

- [x] Verify current Next page/component against this page-flow
- [x] Verify API route handlers match Current API and status rules above
- [ ] Verify legacy behavior for any gap before implementing runtime change
- [ ] Add/adjust tests or browser QA checklist before changing runtime
- [ ] Update this file and canonical reference if contract changes
