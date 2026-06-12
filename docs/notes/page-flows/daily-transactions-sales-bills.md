---
title: บิลขาย Page Flow
tags:
  - page-flow
  - menu
status: accepted-baseline
updated: 2026-06-12
route: /sales/bills
---

# บิลขาย Page Flow

## Scope

| Field | Value |
|---|---|
| Menu section | Daily Transactions |
| Route | `/sales/bills` |
| Page | บิลขาย |
| Current Next | accepted code baseline |

## Canonical References

[[Sales Bills Page Flow]], [[Sales Flow]], [[Payment Flow]], [[Stock Ledger and Stock Balance]]

## Flow Baseline

SB ตั้งลูกหนี้, consume WTO hold, ตัด stock สำหรับ stock sale และตัด POS allocation

## Page Responsibilities

- สร้าง `SB` จาก WTO, PSALE, Trading PB หรือขายตรงตาม target mode
- สำหรับ WTO: 1 WTO ต่อ 1 SB และต้องตัด WTO ครบใน SB เดียว
- allocate เข้า PO Sell ได้หลาย PO ต่อ SB และส่วนเกินเป็น Spot Sale
- ตั้ง AR/payable receivable balance และเป็น source ให้ receipt
- สำหรับ stock line: consume hold แล้วเขียน stock-out ledger ตอน save SB
- แสดง detail/source/timeline/print และ receipt status

## Non-Responsibilities

- ไม่รับเงินเอง; receipt อยู่ `/sales/receipts`
- ไม่ตัด stock ซ้ำเมื่อ source เป็น PSALE ที่ตัด stock ไปแล้ว
- ไม่ให้ WTO เดียวถูกใช้หลาย SB
- ไม่แก้ master data ระหว่างสร้างบิล

## Lifecycle / Operation Flow

| Step | User action | System result |
|---|---|---|
| 1 | เปิดหน้า | GET list/filter/source |
| 2 | เลือก source | WTO/PSALE/Trading PB/direct stock ตาม mode |
| 3 | allocate | เลือก POS ต่อ line หรือ Spot Sale |
| 4 | บันทึก SB | POST ตั้ง AR, source usage, stock ledger/hold consume ตาม mode |
| 5 | รับเงิน | RCP ลด AR |
| 6 | cancel/edit | reverse AR/source usage/ledger หรือ reopen hold ตาม policy |

## API / Data Contract

### Current API

- `GET /api/sales/bills - list/source data`
- `POST /api/sales/bills - create SB`
- `GET /api/sales/bills/[id] - detail/read model`
- no current `PUT/PATCH/DELETE /api/sales/bills/[id]`; edit/cancel buttons are disabled in the UI

### Data Contract

- UI ใช้ outward business document/code เป็นหลัก และให้ server resolve internal id
- list/detail/print/export ต้องอ่าน source contract เดียวกันเพื่อลด drift
- transaction write ต้องทำใน server transaction และ append timeline/status/audit ตาม document policy
- ถ้า field เป็น money/qty/date/business code ให้ validate ตาม `docs/design.md` และ server-side ซ้ำ

## Validation / Status Rules

- WTO ต้อง active, same branch/customer context, not billed, allocate ครบใน SB เดียว
- POS allocation ต้อง product/unit match และไม่เกิน remaining
- stock sale ต้อง validate available/hold ใน transaction
- PSALE source ห้ามตัด stock ซ้ำ
- receipt active แล้วต้อง lock cancel/edit field การเงิน

## Side Effects

- ตั้ง AR/source receivable
- เขียน `stock_ledger.ref_type = SB` สำหรับ stock-out ที่ SB เป็น movement owner
- consume WTO hold หรือใช้ PSALE stock-out fact ตาม source
- update WTO/PSALE/POS usage/status
- ส่งต่อไป `/sales/receipts` สำหรับรับเงิน

## Current Code Baseline

- Current `apps/next` page/API code is accepted as the P0 implementation baseline as of 2026-06-11.
- This page belongs to the transaction/stock/payment risk group; accepted baseline means proofed against current code, not target-complete.
- Runtime changes must preserve documented status, allocation, ledger, payment, lock, and reversal boundaries, or update this page-flow and the canonical flow first.
- See [[P0 Transaction Stock Payment Current Code Baseline]] for API/permission/side-effect proof notes and open critical gaps.

## Current Gap

- create path for `STOCK` SB already consumes active `WTO` hold, writes `stock_ledger.ref_type = SB`, logs `WTO -> SB` usage, updates `WTO` to `billed`, and updates PO Sell remaining/status
- durable allocation fact tables are still missing for `WTO -> SB`, `SB -> PO Sell`, `SB -> Spot Sale`, and `Customer advance -> SB`; current implementation still stores most line/source facts in sales-bill item JSON plus usage logs
- no edit/cancel write path exists for SB; future implementation must reverse/reopen AR, PO Sell allocation, customer advance allocation, WTO usage, stock holds, and stock ledger in one transaction
- receipt relation/lock still needs end-to-end proof before enabling SB edit/cancel

## Implementation Checklist

- [x] Verify current Next page/component against this page-flow
- [x] Verify API route handlers match Current API and status rules above
- [x] Sync current create-path side effects with [[Sales Bills Page Flow]]
- [ ] Design durable allocation tables before enabling SB edit/cancel runtime change
- [ ] Verify legacy behavior for remaining cancel/reversal gaps before implementing runtime change
- [ ] Add/adjust tests or browser QA checklist before changing runtime
- [ ] Update this file and canonical reference if contract changes
