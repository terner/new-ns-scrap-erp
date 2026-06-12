---
title: PO Sell Page Flow
tags:
  - page-flow
  - menu
status: accepted-baseline
updated: 2026-06-11
route: /sales/po-sell
---

# PO Sell Page Flow

## Scope

| Field | Value |
|---|---|
| Menu section | Daily Transactions |
| Route | `/sales/po-sell` |
| Page | PO Sell |
| Current Next | accepted code baseline |

## Canonical References

[[PO Sell Flow]], [[Sales Flow]]

## Flow Baseline

POS เป็น customer commitment/reservation ฝั่งขาย ก่อน WTO/SB allocate

## Page Responsibilities

- สร้าง `POS` เพื่อจองขายให้ Customer
- เก็บ branch/customer/channel/delivery date/product/unit/qty/price snapshot
- เป็น source ให้ WTO/SB allocate ตัดยอดขายราย line
- แสดง ordered/billed/remaining/close-short/aging
- เชื่อม Cost Allocator/Dual Costing เมื่อมี deal costing

## Non-Responsibilities

- ไม่ตัด stock เอง
- ไม่ตั้ง AR หรือรับเงิน
- ไม่เขียน stock ledger/bank statement
- ไม่รวมหน่วยต่างกันใน summary โดยไม่มี conversion rule

## Lifecycle / Operation Flow

| Step | User action | System result |
|---|---|---|
| 1 | สร้าง POS | POST commitment |
| 2 | WTO ส่งของ | WTO อาจอ้าง customer/สินค้าที่จะไป SB |
| 3 | SB allocate | SB ตัด POS remaining ต่อ line; ส่วนเกินเป็น Spot Sale |
| 4 | close-short/cancel | release remaining พร้อม audit |
| 5 | report | outstanding PO แสดง aging/remaining |

## API / Data Contract

### Current API

- `GET /api/sales/po-sell - list/filter`
- `POST /api/sales/po-sell - create POS`

### Data Contract

- UI ใช้ outward business document/code เป็นหลัก และให้ server resolve internal id
- list/detail/print/export ต้องอ่าน source contract เดียวกันเพื่อลด drift
- transaction write ต้องทำใน server transaction และ append timeline/status/audit ตาม document policy
- ถ้า field เป็น money/qty/date/business code ให้ validate ตาม `docs/design.md` และ server-side ซ้ำ

## Validation / Status Rules

- customer/branch/product/qty/price required
- qty > 0 แยกตามหน่วย
- SB allocation ต้องไม่เกิน POS remaining
- lock เมื่อมี downstream active SB allocation

## Side Effects

- เขียน POS current-state + line snapshot
- SB เป็นผู้ตัดยอด POS และตั้ง AR/stock effect
- ไม่เขียน stock/bank

## Current Code Baseline

- Current `apps/next` page/API code is accepted as the P0 implementation baseline as of 2026-06-11.
- This page belongs to the transaction/stock/payment risk group; accepted baseline means proofed against current code, not target-complete.
- Runtime changes must preserve documented status, allocation, ledger, payment, lock, and reversal boundaries, or update this page-flow and the canonical flow first.
- See [[P0 Transaction Stock Payment Current Code Baseline]] for API/permission/side-effect proof notes and open critical gaps.

## Current Gap

line-level allocation, close-short และ branch-aware numbering ยังต้องพิสูจน์

## Implementation Checklist

- [x] Verify current Next page/component against this page-flow
- [x] Verify API route handlers match Current API and status rules above
- [ ] Verify legacy behavior for any gap before implementing runtime change
- [ ] Add/adjust tests or browser QA checklist before changing runtime
- [ ] Update this file and canonical reference if contract changes
