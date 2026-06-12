---
title: ปรับสถานะสินค้า Page Flow
tags:
  - page-flow
  - menu
status: accepted-baseline
updated: 2026-06-11
route: /stock/status-convert
---

# ปรับสถานะสินค้า Page Flow

## Scope

| Field | Value |
|---|---|
| Menu section | Stock |
| Route | `/stock/status-convert` |
| Page | ปรับสถานะสินค้า |
| Current Next | accepted code baseline |

## Canonical References

[[Stock Status Convert Page Flow]], [[Stock Ledger and Stock Balance]]

## Flow Baseline

SC ย้าย qty ระหว่าง stock status/output category โดย product เดิม

## Page Responsibilities

- ปรับสถานะสินค้าเช่น RM/WIP/FG/not available ตาม policy
- เลือก product/warehouse/source status/target status/qty/reason
- เขียน paired ledger ออกจาก status เดิมและเข้า status ใหม่
- ใช้สำหรับ stock status correction ไม่ใช่ grade/product conversion

## Non-Responsibilities

- ไม่เปลี่ยน product code/grade
- ไม่ตั้งต้นทุนใหม่เกิน policy
- ไม่รับ/ขาย/โอนข้าม warehouse ถ้าไม่ระบุใน rule

## Lifecycle / Operation Flow

| Step | User action | System result |
|---|---|---|
| 1 | เปิดหน้า | GET list/options |
| 2 | เลือก source stock | product+warehouse+status |
| 3 | บันทึก | POST SC paired ledger |
| 4 | reverse | target reversal pair พร้อม reason |

## API / Data Contract

### Current API

- `GET /api/stock/status-convert - list/options`
- `POST /api/stock/status-convert - create status conversion`

### Data Contract

- UI ใช้ outward business document/code เป็นหลัก และให้ server resolve internal id
- list/detail/print/export ต้องอ่าน source contract เดียวกันเพื่อลด drift
- transaction write ต้องทำใน server transaction และ append timeline/status/audit ตาม document policy
- ถ้า field เป็น money/qty/date/business code ให้ validate ตาม `docs/design.md` และ server-side ซ้ำ

## Validation / Status Rules

- qty > 0 และไม่เกิน available ของ source status
- source/target status ต้องต่างกันและอยู่ใน allowed transition
- reason required

## Side Effects

- เขียน stock ledger out/in ด้วย ref_type SC
- balance เปลี่ยน status bucket แต่ total product warehouse อาจเท่าเดิม

## Current Code Baseline

- Current `apps/next` page/API code is accepted as the P0 implementation baseline as of 2026-06-11.
- This page belongs to the transaction/stock/payment risk group; accepted baseline means proofed against current code, not target-complete.
- Runtime changes must preserve documented status, allocation, ledger, payment, lock, and reversal boundaries, or update this page-flow and the canonical flow first.
- See [[P0 Transaction Stock Payment Current Code Baseline]] for API/permission/side-effect proof notes and open critical gaps.

## Current Gap

allowed transition matrix และ reversal/reconciliation ยังต้อง finalize

## Implementation Checklist

- [x] Verify current Next page/component against this page-flow
- [x] Verify API route handlers match Current API and status rules above
- [ ] Verify legacy behavior for any gap before implementing runtime change
- [ ] Add/adjust tests or browser QA checklist before changing runtime
- [ ] Update this file and canonical reference if contract changes
