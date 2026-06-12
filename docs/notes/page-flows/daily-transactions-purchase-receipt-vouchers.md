---
title: ใบสำคัญรับเงิน Page Flow
tags:
  - page-flow
  - menu
status: accepted-baseline
updated: 2026-06-11
route: /purchase/receipt-vouchers
---

# ใบสำคัญรับเงิน Page Flow

## Scope

| Field | Value |
|---|---|
| Menu section | Daily Transactions |
| Route | `/purchase/receipt-vouchers` |
| Page | ใบสำคัญรับเงิน |
| Current Next | accepted code baseline |

## Canonical References

[[Receipt Voucher Page Flow]], [[Printable Documents]], [[Payment Flow]], [[Purchase Flow]]

## Flow Baseline

เอกสารพิมพ์/ประวัติใบสำคัญรับเงิน Supplier จาก PB/payment facts

Legacy baseline confirmed from `old-apps/legacy/index.html` component `view-receiptVoucher`: `RV` คือเอกสารที่ Supplier/ผู้รับเงินเซ็นรับเงินสดให้บริษัท ใช้ดึงข้อมูลจาก PB มา pre-fill ได้ แต่ตัว RV ไม่ใช่ payment posting owner ไม่ใช้กับโอนเงิน/เช็ค และไม่ใช่หน้ารับเงิน Customer (`RCP` อยู่ `/sales/receipts`)

## Page Responsibilities

- แสดงรายการใบสำคัญรับเงินที่เกี่ยวกับการซื้อ/จ่าย Supplier
- ใช้เป็น printable document/read model ไม่ใช่ transaction owner
- drilldown ไป PB/PMT/source payment ที่เกี่ยวข้อง
- รองรับ filter วันที่ Supplier เลขเอกสาร และสถานะพิมพ์/ยกเลิกตาม target
- target create/edit ต้อง pre-fill จาก PB/cash PMT source และบันทึก snapshot ของผู้รับเงิน รายการสินค้า ยอดเงิน ตัวอักษร วิธีรับเงินสด และผู้ลงนาม

## Non-Responsibilities

- ไม่สร้าง PB/PMA/PMT
- ไม่เขียน bank statement หรือ stock ledger
- ไม่เป็นแหล่ง truth ของยอดจ่าย; ต้องอ่านจาก payment/PB facts

## Lifecycle / Operation Flow

| Step | User action | System result |
|---|---|---|
| 1 | เปิดหน้า | GET voucher list จาก payment/PB facts |
| 2 | เลือก row | ดู detail/print source |
| 3 | สร้าง/แก้ไข target | เลือก PB/cash PMT เพื่อ pre-fill แล้วแก้ field ที่ขาดได้ |
| 4 | พิมพ์ | สร้างเอกสารพิมพ์จาก RV snapshot/company profile |
| 5 | ยกเลิก source | voucher แสดงสถานะจาก source ไม่ลบประวัติ |

## API / Data Contract

### Current API

- `GET /api/purchase/receipt-vouchers - list/read model`
- Response includes Company Profile print header data for RV preview.
- Current Next has no create/edit/cancel write API for RV yet.
- Runtime PMT write path creates/updates an RV automatically when `POST /api/purchase/payments` saves a cash PMT.

### Data Contract

- UI ใช้ outward business document/code เป็นหลัก และให้ server resolve internal id
- list/detail/print/export ต้องอ่าน source contract เดียวกันเพื่อลด drift
- transaction write ต้องทำใน server transaction และ append timeline/status/audit ตาม document policy
- ถ้า field เป็น money/qty/date/business code ให้ validate ตาม `docs/design.md` และ server-side ซ้ำ

## Validation / Status Rules

- ต้องอ้าง source doc ที่มีอยู่จริง
- ห้ามพิมพ์เป็นเอกสารจ่ายจริงถ้า source cash payment ยังไม่เสร็จสิ้น
- ใช้กับเงินสดเท่านั้น; โอนเงิน/เช็ค/ธนาคารต้องใช้ PMT หรือหลักฐานธนาคาร ไม่ใช่ RV
- Cash/non-cash decision must read `payment_methods.type`; do not infer cash by display text.
- cancelled source ต้องแสดง watermark/status ไม่หายจาก audit
- `seller_name` และอย่างน้อย 1 item เป็น required ตาม legacy
- item unit target ต้องเก็บจาก PB/product snapshot; legacy แสดง `กก.` แต่ target รองรับ `กก.` และ `ลัง`

## Side Effects

- read-only/print-only ไม่มี transaction side effect
- print ต้องไม่ mutate PB/PMT/PMA
- create/edit/cancel RV ต้องไม่เขียน bank statement, ไม่เปลี่ยน payable balance, และไม่ reverse payment
- Auto-RV from cash PMT writes only `receipt_vouchers`; PMT remains owner of payment/BST/AP settlement.

## Current Code Baseline

- Current `apps/next` page/API code is accepted as the P0 implementation baseline as of 2026-06-11.
- This page belongs to the transaction/stock/payment risk group; accepted baseline means proofed against current code, not target-complete.
- Runtime changes must preserve documented status, allocation, ledger, payment, lock, and reversal boundaries, or update this page-flow and the canonical flow first.
- See [[P0 Transaction Stock Payment Current Code Baseline]] for API/permission/side-effect proof notes and open critical gaps.

## Legacy Proof / Current Gap

- Legacy `view-receiptVoucher` มี create/edit/delete/print local flow และ PB pre-fill ครบ แต่ delete เป็น hard delete ซึ่ง target ควรเปลี่ยนเป็น cancel/status log
- Current Next ยังเป็น list + print preview จาก `receipt_vouchers`; ปุ่ม create/edit/cancel disabled
- Print preview now includes the legacy template structure and Company Profile header.
- Cash PMT now auto-generates RV; draft RV from unpaid PB remains a future UX decision.
- signer/payment method/source fields ต้อง harden ตาม [[Receipt Voucher Page Flow]]

## Implementation Checklist

- [x] Verify current Next page/component against this page-flow
- [x] Verify API route handlers match Current API and status rules above
- [ ] Verify legacy behavior for any gap before implementing runtime change
- [ ] Add/adjust tests or browser QA checklist before changing runtime
- [ ] Update this file and canonical reference if contract changes
