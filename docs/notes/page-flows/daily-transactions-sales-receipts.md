---
title: รับเงิน Customer Page Flow
tags:
  - page-flow
  - menu
status: accepted-baseline
updated: 2026-06-11
route: /sales/receipts
---

# รับเงิน Customer Page Flow

## Scope

| Field | Value |
|---|---|
| Menu section | Daily Transactions |
| Route | `/sales/receipts` |
| Page | รับเงิน Customer |
| Current Next | accepted code baseline |

## Canonical References

[[Sales Flow]], [[Payment Flow]]

## Flow Baseline

RCP รับเงินจาก SB/customer advance และเขียน bank statement เงินเข้า

## Page Responsibilities

- แสดงคิวบิลขายค้างรับและประวัติรับเงิน
- สร้าง `RCP` เพื่อรับเงินจาก Customer
- รองรับรับหลาย SB ใน RCP เดียวตาม customer/payment account rule
- เขียน bank statement เงินเข้าและ recalc AR/SB paid status
- รองรับส่วนลด ค่าธรรมเนียม WHT/ภาษีหัก ณ ที่จ่าย ตาม target

## Non-Responsibilities

- ไม่สร้าง SB/POS/WTO
- ไม่ตัด stock
- ไม่แก้ยอดบิลขายเดิมนอกจาก payment status/paid amount
- ไม่ใช้ payment supplier PMT แทน receipt

## Lifecycle / Operation Flow

| Step | User action | System result |
|---|---|---|
| 1 | เปิดคิว | GET outstanding SB/customer receivable |
| 2 | เลือกบิล | validate customer และยอดค้าง |
| 3 | บันทึกรับเงิน | POST RCP + bank statement |
| 4 | ประวัติ | แสดง RCP เสร็จสิ้น/ยกเลิก |
| 5 | cancel | reverse receipt/bank facts และ recalc SB |

## API / Data Contract

### Current API

- `GET /api/sales/receipts - queue/history`
- `POST /api/sales/receipts - create receipt`

### Data Contract

- UI ใช้ outward business document/code เป็นหลัก และให้ server resolve internal id
- list/detail/print/export ต้องอ่าน source contract เดียวกันเพื่อลด drift
- transaction write ต้องทำใน server transaction และ append timeline/status/audit ตาม document policy
- ถ้า field เป็น money/qty/date/business code ให้ validate ตาม `docs/design.md` และ server-side ซ้ำ

## Validation / Status Rules

- SB ต้องไม่ cancelled และยังมียอดค้างรับ
- receipt amount/discount/WHT ต้อง reconcile กับยอดค้าง
- บัญชีรับเงินต้อง active
- cancel ต้องไม่ลบ audit และต้อง recalc AR

## Side Effects

- สร้าง receipt/RCP facts และ `bank_statement` เงินเข้า
- recalc SB paid/receivable status
- cancel reverse receipt/bank facts

## Current Code Baseline

- Current `apps/next` page/API code is accepted as the P0 implementation baseline as of 2026-06-11.
- This page belongs to the transaction/stock/payment risk group; accepted baseline means proofed against current code, not target-complete.
- Runtime changes must preserve documented status, allocation, ledger, payment, lock, and reversal boundaries, or update this page-flow and the canonical flow first.
- See [[P0 Transaction Stock Payment Current Code Baseline]] for API/permission/side-effect proof notes and open critical gaps.

## Current Gap

multi-bill receipt, allocation, reversal และ customer advance allocation ยังต้อง define เพิ่ม

## Implementation Checklist

- [x] Verify current Next page/component against this page-flow
- [x] Verify API route handlers match Current API and status rules above
- [ ] Verify legacy behavior for any gap before implementing runtime change
- [ ] Add/adjust tests or browser QA checklist before changing runtime
- [ ] Update this file and canonical reference if contract changes
