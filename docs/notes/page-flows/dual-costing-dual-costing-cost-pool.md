---
title: Cost Pool Page Flow
tags:
  - page-flow
  - menu
  - dual-costing
status: accepted-baseline
updated: 2026-06-11
route: /dual-costing/cost-pool
---

# Cost Pool Page Flow

## Scope

| Field | Value |
|---|---|
| Menu section | Dual Costing |
| Route | `/dual-costing/cost-pool` |
| Page | Cost Pool |
| Current Next | accepted code baseline with target-rule gaps |

## Canonical References

[[Dual Costing Flow]], [[Cost Pool]], [[PO Buy Page Flow]], [[Purchase Bills Page Flow]]

## Legacy Baseline

Legacy view `view-costPool` อ่านจาก `erp.buildCostPool()` แล้ว filter เฉพาะ `erp.isDualCostingProduct(product_id)` ซึ่งผูกกับ `DUAL_COSTING_GROUPS = ['ทองแดง', 'ทองเหลือง']`

Legacy helper `buildCostPool()` สร้าง pool จาก:

| Source | Legacy behavior |
|---|---|
| `PO_Buy` | PO Buy ที่ไม่ cancelled เข้า pool เป็น cost candidate แม้ยังไม่ใช่ stock จริง |
| `Spot_Buy` | purchase bill items เข้า pool เป็น spot cost source |
| `matchLogs` | ใช้คำนวณ `used_qty`, `available_qty`, `available_value`, `status` |

Legacy UI มี filter `สินค้า`, `Cost Type`, `Source`, `สถานะ`, `sortMode`, และ checkbox `แสดงเฉพาะ Available`

## Target Flow

Cost Pool คือ read model ของต้นทุนที่พร้อมให้ Cost Allocator ใช้จับคู่ดีล ไม่ใช่ stock จริงและไม่ใช่ WAC

Target rule ล่าสุด:

- สินค้าเข้า Cost Pool ได้เฉพาะ `ทองแดง`, `ทองเหลือง`, `copper`, `brass`
- source ที่เข้า Cost Pool มีเฉพาะ `PO_Buy` และ `Stock PB Spot / No PO`
- PB line ที่อ้าง PO ไม่สร้าง source ใหม่ เพราะ `PO_Buy` เป็น candidate เดิมแล้ว
- `Production` และ `Regrade` ไม่เข้า target Cost Pool รอบนี้ แม้ legacy UI เคยมี cost type เหล่านี้
- ส่วนลดท้ายบิลไม่ลด unit cost ใน Cost Pool
- WTI ไม่มีผลกับ Cost Pool โดยตรง; PB เป็นจุดที่ต้นทุนซื้อเกิดจริงสำหรับ Spot/No PO

## Page Responsibilities

- แสดงต้นทุน candidate เฉพาะทองแดง/ทองเหลือง
- แสดง source type, source no, counterparty, product, original qty, matched qty, available qty, unit cost, available value และ status
- แสดง summary ตาม cost/source/status ที่ filter อยู่
- export XLSX ด้วย row set เดียวกับตาราง
- ช่วย user ตรวจว่ามีต้นทุนเหลือพอสำหรับ allocation หรือไม่

## Non-Responsibilities

- ไม่สร้าง stock movement
- ไม่อนุมัติหรือจ่ายเงิน
- ไม่แก้ PO/PB/WTI โดยตรง
- ไม่คำนวณ WAC หรือปิดงบ
- ไม่เป็น source of truth ของ match history; match usage ต้องมาจาก allocation log หรือ `trading_deals`/future ledger

## Lifecycle / Read Flow

| Step | User action | System result |
|---|---|---|
| 1 | เปิดหน้า | โหลด Cost Pool rows จาก API |
| 2 | เลือก product/source/status/cost type | API/client filter เฉพาะ candidate ที่ตรง |
| 3 | toggle available only | ซ่อน `Fully Used` หรือ available qty <= 0 |
| 4 | เลือก sort | FIFO/LIFO/Cheap/Expensive |
| 5 | Export | ส่งออก XLSX ด้วย filter ปัจจุบัน |

## API / Data Contract

### Current API

- `GET /api/dual-costing/cost-pool`

Current query params:

- `q`
- `productId`
- `costType`
- `sourceType`
- `status`
- `availableOnly`
- `sort`
- `from`
- `to`
- `format=xlsx`

Current source tables/routes:

- `po_buys`
- `purchase_bills` + `purchase_bill_items`
- currently also `production_outputs` and `grade_adjustments`
- `trading_deals` for usage reduction
- `products`
- `branches`

### Required Row Fields

| Field | Meaning |
|---|---|
| `costPoolId` | stable row id for UI/export |
| `costType` | target should be `Purchase` for current scope |
| `sourceType` | `PO_Buy` or `Spot_Buy` |
| `sourceNo` | outward document no such as `POB...` or `PB...` |
| `date` | source document date |
| `counterparty` | supplier/counterparty name snapshot/display |
| `branchName` | branch display |
| `productId` / `productName` | outward product code/name |
| `qty` | original source qty |
| `usedQty` | qty already allocated |
| `availableQty` | `qty - usedQty - releasedQty` |
| `unitCost` | cost per unit from source line |
| `availableValue` | `availableQty * unitCost` |
| `status` | `Available`, `Partially Used`, `Fully Used` |

## Validation / Status Rules

- Backend must filter eligible products by `products.metal_group`.
- Backend must not send non-copper/brass rows to UI/export.
- `availableQty` must never be negative.
- Cancelled/reversed PO/PB must be excluded from available view.
- Short-close PO must release remaining undelivered qty.
- PB Spot source must mean PB line with no PO allocation only.
- Export must use exactly the same filters as the screen.

## Side Effects

Read-only. No stock, payment, AP/AR, PO/PB status, or bank statement side effects.

## Current Code Baseline

- Current API is implemented and protected by `finance.cash.view`.
- Current route returns a useful read model and XLSX export.
- Current `apps/next` implementation is accepted as P2 baseline, but not target-complete.

## Current Gap

- Current Cost Pool API still needs target-rule hardening:
  - select/filter `products.metal_group`
  - exclude products outside copper/brass
  - restrict `Spot_Buy` to PB line with no PO
  - exclude `Production` and `Regrade` from target Cost Pool until a new decision exists
- Current usage reduction relies on `trading_deals`; durable allocation ledger is still future work.

## Implementation Checklist

- [x] Legacy flow inspected
- [x] Current API identified
- [ ] Enforce copper/brass eligibility in API
- [ ] Remove Production/Regrade from target Cost Pool response
- [ ] Restrict PB Spot source to No PO only
- [ ] Add/reconcile durable allocation usage source
