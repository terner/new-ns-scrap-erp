---
title: จ่ายเงิน Supplier Page Flow
tags:
  - page-flow
  - menu
status: accepted-baseline
updated: 2026-06-11
route: /purchase/payments
---

# จ่ายเงิน Supplier Page Flow

## Scope

| Field | Value |
|---|---|
| Menu section | Daily Transactions |
| Route | `/purchase/payments` |
| Page | จ่ายเงิน Supplier |
| Current Next | accepted code baseline |

## Canonical References

[[Payment Flow]]

## Flow Baseline

PMT จ่าย PMA approved และเขียน bank statement

## Page Responsibilities

- แสดง queue รอจ่ายจาก PMA approved
- เลือกหลาย PMA ใน PMT เดียวเมื่อผู้รับเงินและช่องทางรับเงินตรงกัน
- สร้าง PMT/payment splits/bank statement/status logs
- มีแท็บประวัติ PMT เสร็จสิ้นและยกเลิกแล้ว
- เปิด detail modal จาก history โดยใช้ outward PMT/PMA doc no

## Non-Responsibilities

- ไม่อนุมัติยอดใหม่
- ไม่แก้ PB/ADV/EXP source amount
- ไม่จ่ายบางส่วนที่ชั้น PMT; partial ต้อง split ที่ PMA
- ไม่ใช้ internal voucher_id เป็น UI/URL

## Lifecycle / Operation Flow

| Step | User action | System result |
|---|---|---|
| 1 | เปิดรอจ่าย | GET PMA approved ที่ยังไม่ paid |
| 2 | เลือก PMA | validate party/payment method snapshot เดียวกัน |
| 3 | บันทึกจ่าย | POST สร้าง PMT + bank statement |
| 4 | ดูประวัติ | GET payment-history ตาม filter |
| 5 | cancel PMT | POST cancel reverse payment/bank facts และต้อง approve ใหม่ |

## API / Data Contract

### Current API

- `GET /api/purchase/payments - waiting PMA queue`
- `POST /api/purchase/payments - create PMT`
- `GET /api/purchase/payment-history - PMT/PMA history list`
- `GET /api/purchase/payment-history/[...id] - payment detail`
- `POST /api/purchase/payments/cancel - cancel PMT`
- `POST /api/purchase/payments/cancel-approved - void/cancel approved PMA before payment`

### Data Contract

- UI ใช้ outward business document/code เป็นหลัก และให้ server resolve internal id
- list/detail/print/export ต้องอ่าน source contract เดียวกันเพื่อลด drift
- transaction write ต้องทำใน server transaction และ append timeline/status/audit ตาม document policy
- ถ้า field เป็น money/qty/date/business code ให้ validate ตาม `docs/design.md` และ server-side ซ้ำ

## Validation / Status Rules

- PMA ที่เลือกต้อง approved และยังไม่ถูกจ่าย
- PMA ใน PMT เดียวกันต้องผู้รับเงินเดียวกันและ destination method/account เดียวกัน
- จ่ายเต็ม PMA ที่เลือก; discount/bank fee เป็นระดับ PMT
- cash split รวมต้อง reconcile กับ total cash out
- cancel PMT ต้องไม่ reuse PMA เดิมเป็น active cycle

## Side Effects

- สร้าง `payments`, `payment_account_splits`, `payment_status_logs`, `bank_statement`
- recalc source PB/ADV/EXP paid/payable status
- cancel PMT reverse payment/bank facts และเก็บ audit

## Current Code Baseline

- Current `apps/next` page/API code is accepted as the P0 implementation baseline as of 2026-06-11.
- This page belongs to the transaction/stock/payment risk group; accepted baseline means proofed against current code, not target-complete.
- Runtime changes must preserve documented status, allocation, ledger, payment, lock, and reversal boundaries, or update this page-flow and the canonical flow first.
- See [[P0 Transaction Stock Payment Current Code Baseline]] for API/permission/side-effect proof notes and open critical gaps.

## Current Gap

multi-bill voucher, split accounts, reversal ต้องตรวจ runtime/legacy ครบทุก use case

## Implementation Checklist

- [x] Verify current Next page/component against this page-flow
- [x] Verify API route handlers match Current API and status rules above
- [ ] Verify legacy behavior for any gap before implementing runtime change
- [ ] Add/adjust tests or browser QA checklist before changing runtime
- [ ] Update this file and canonical reference if contract changes
