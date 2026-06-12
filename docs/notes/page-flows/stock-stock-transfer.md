---
title: โอนสินค้าระหว่างสาขา Page Flow
tags:
  - page-flow
  - menu
status: accepted-baseline
updated: 2026-06-11
route: /stock/transfer
---

# โอนสินค้าระหว่างสาขา Page Flow

## Scope

| Field | Value |
|---|---|
| Menu section | Stock |
| Route | `/stock/transfer` |
| Page | โอนสินค้าระหว่างสาขา |
| Current Next | accepted code baseline |

## Canonical References

[[Stock Transfer Page Flow]], [[Stock Ledger and Stock Balance]]

## Flow Baseline

ST สร้าง paired stock-out/stock-in ระหว่าง warehouse/branch

## Page Responsibilities

- สร้าง `ST` เพื่อโอนสินค้าออกจากคลังต้นทางเข้า destination warehouse
- validate available stock ก่อนโอน
- เขียน ledger 2 ฝั่งใน transaction เดียว
- แสดง history/detail/source movement และ outstanding transfer ถ้ามี transit model

## Non-Responsibilities

- ไม่ขายสินค้าและไม่ตั้ง AR/AP
- ไม่เปลี่ยนสินค้า/grade/status; งานนั้นอยู่ convert/status-convert
- ไม่ใช้ถ้าของถูก hold เกิน available

## Lifecycle / Operation Flow

| Step | User action | System result |
|---|---|---|
| 1 | เปิดหน้า | GET transfer list/options |
| 2 | เลือก source/destination | เลือก product, source warehouse, destination warehouse, qty |
| 3 | บันทึก | POST ST + paired ledger out/in |
| 4 | cancel/reverse | target ต้องสร้าง reversal pair ไม่ลบ ledger |

## API / Data Contract

### Current API

- `GET /api/stock/transfer - list/options`
- `POST /api/stock/transfer - create stock transfer`

### Data Contract

- UI ใช้ outward business document/code เป็นหลัก และให้ server resolve internal id
- list/detail/print/export ต้องอ่าน source contract เดียวกันเพื่อลด drift
- transaction write ต้องทำใน server transaction และ append timeline/status/audit ตาม document policy
- ถ้า field เป็น money/qty/date/business code ให้ validate ตาม `docs/design.md` และ server-side ซ้ำ

## Validation / Status Rules

- source/destination warehouse ต้อง active และไม่ซ้ำกัน
- qty > 0 และไม่เกิน available_qty
- ห้ามโอน stock ที่ถูก hold active
- destination product/status rule ต้องชัดถ้ามี lot/status

## Side Effects

- เขียน `stock_ledger` out จาก source และ in เข้า destination
- recalc balance จาก ledger อัตโนมัติ

## Current Code Baseline

- Current `apps/next` page/API code is accepted as the P0 implementation baseline as of 2026-06-11.
- This page belongs to the transaction/stock/payment risk group; accepted baseline means proofed against current code, not target-complete.
- Runtime changes must preserve documented status, allocation, ledger, payment, lock, and reversal boundaries, or update this page-flow and the canonical flow first.
- See [[P0 Transaction Stock Payment Current Code Baseline]] for API/permission/side-effect proof notes and open critical gaps.

## Current Gap

hold-aware validation และ reversal ยังต้องพิสูจน์

## Implementation Checklist

- [x] Verify current Next page/component against this page-flow
- [x] Verify API route handlers match Current API and status rules above
- [ ] Verify legacy behavior for any gap before implementing runtime change
- [ ] Add/adjust tests or browser QA checklist before changing runtime
- [ ] Update this file and canonical reference if contract changes
