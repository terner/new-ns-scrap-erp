---
title: เบิกออกรอบิล Page Flow
tags:
  - page-flow
  - menu
status: accepted-baseline
updated: 2026-06-11
route: /sales/stock-issue
---

# เบิกออกรอบิล Page Flow

## Scope

| Field | Value |
|---|---|
| Menu section | Daily Transactions |
| Route | `/sales/stock-issue` |
| Page | เบิกออกรอบิล |
| Current Next | accepted code baseline |

## Canonical References

[[Pending Sale Page Flow]], [[Sales Flow]], [[Stock Ledger and Stock Balance]]

## Flow Baseline

PSALE คือ stock-out ก่อนออก SB; SB จาก PSALE ไม่ตัด stock ซ้ำ

Legacy baseline confirmed from `old-apps/legacy/index.html` component `view-stockIssue`: legacy create/edit writes `stockLedger.refType = PSALE`, cancel/delete removes PSALE ledger, and convert-to-SB removes PSALE ledger then creates SB ledger. Target keeps the useful physical-stock-out timing, but must not delete/rewrite the original PSALE movement when converting to SB.

## Page Responsibilities

- แสดง/จัดการ Pending Sale หรือ PSALE ที่ของออกก่อนเปิดบิล
- target create PSALE ต้องเลือก customer/branch/warehouse/product/qty/price estimate/note
- PSALE บันทึก stock-out ทันทีเพราะของออกจริง
- แปลง PSALE เป็น SB โดยไม่ตัด stock ซ้ำ
- แสดง status pending/billed/cancelled และ source usage
- target must support pre-fill from WTO/ใบชั่ง OUT and still require warehouse + stock validation before save
- show line-level stock before issue, issue qty, and stock after issue

## Non-Responsibilities

- ไม่ใช่ WTO hold; PSALE คือ stock movement จริง
- ไม่รับเงินและไม่ตั้ง AR จนกว่าจะเปิด SB
- ไม่ให้ PSALE เดียวออก SB ซ้ำ

## Lifecycle / Operation Flow

| Step | User action | System result |
|---|---|---|
| 1 | เปิดหน้า | GET PSALE list/read model |
| 2 | สร้าง PSALE target | validate available stock และเขียน stock-out |
| 3 | แปลงเป็น SB | SB ใช้ PSALE source ตั้ง AR โดยไม่เขียน ledger ซ้ำ |
| 4 | cancel ก่อน SB | reverse PSALE stock-out |
| 5 | cancel หลัง SB | ต้อง follow SB cancel/reversal policy |

## API / Data Contract

### Current API

- `GET /api/sales/stock-issue - current read/list baseline`

### Data Contract

- UI ใช้ outward business document/code เป็นหลัก และให้ server resolve internal id
- list/detail/print/export ต้องอ่าน source contract เดียวกันเพื่อลด drift
- transaction write ต้องทำใน server transaction และ append timeline/status/audit ตาม document policy
- ถ้า field เป็น money/qty/date/business code ให้ validate ตาม `docs/design.md` และ server-side ซ้ำ

## Validation / Status Rules

- warehouse/product/qty ต้อง active และ available พอ
- ถ้า PSALE billed แล้ว lock edit/cancel
- SB from PSALE ต้องใช้ quantity/source เดิมหรือมี audit difference
- legacy allowed confirm override when qty exceeded stock; target should reject by default or require explicit permission + reason + audit event

## Side Effects

- target write จะเขียน `stock_ledger.ref_type = PSALE` stock-out
- SB consumes PSALE source แต่ไม่ตัด stock ซ้ำ
- cancel reverse ledger ตาม policy

## Current Code Baseline

- Current `apps/next` page/API code is accepted as the P0 implementation baseline as of 2026-06-11.
- This page belongs to the transaction/stock/payment risk group; accepted baseline means proofed against current code, not target-complete.
- Runtime changes must preserve documented status, allocation, ledger, payment, lock, and reversal boundaries, or update this page-flow and the canonical flow first.
- See [[P0 Transaction Stock Payment Current Code Baseline]] for API/permission/side-effect proof notes and open critical gaps.

## Current Gap

create/edit/cancel/convert และ ledger reversal ยังไม่ได้ implement ครบ

Legacy proof details now live in [[Pending Sale Page Flow]]. Current Next remains `GET /api/sales/stock-issue` only; no POST/PATCH/cancel/convert route exists yet.

## Implementation Checklist

- [x] Verify current Next page/component against this page-flow
- [x] Verify API route handlers match Current API and status rules above
- [ ] Verify legacy behavior for any gap before implementing runtime change
- [ ] Add/adjust tests or browser QA checklist before changing runtime
- [ ] Update this file and canonical reference if contract changes
