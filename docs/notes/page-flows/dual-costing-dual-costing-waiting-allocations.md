---
title: Waiting Allocations Page Flow
tags:
  - page-flow
  - menu
  - dual-costing
status: accepted-baseline
updated: 2026-06-23
route: /dual-costing/waiting-allocations
---

# Waiting Allocations Page Flow

## Scope

| Field | Value |
|---|---|
| Menu section | Dual Costing |
| Route | `/dual-costing/waiting-allocations` |
| Page | Waiting Allocations |
| Current Next | accepted read baseline |

## Canonical References

[[Dual Costing Flow]], [[page-flows/dual-costing-dual-costing-cost-allocator|Cost Allocator Page Flow]], [[Sales Bills Page Flow]], [[PO Sell Flow]]

## Legacy Baseline

Legacy view `view-waitingAllocations` เป็น management queue ของรายการขายทองแดง/ทองเหลืองที่ยังไม่ได้ allocate cost จาก Cost Pool

Legacy sections:

- PO Sell weight-diff alert: เทียบน้ำหนัก PO Sell กับ Sales Bill จริง เพื่อชี้ว่าต้องปรับการตัด Cost Pool
- PO Sell pending allocation: PO Sell eligible ที่ matched cost ยังไม่ครบ
- Grade Adjustment pending cost: GA ที่ posted แล้วแต่ยังค้าง match cost
- Spot Sales Bill pending allocation: SB item eligible ที่ยังไม่ได้ allocate
- summary cards และ category summary
- action `Allocate` เปิด Cost Allocator พร้อม preselect

## Target Flow

หน้านี้เป็น queue เพื่อบอกว่าอะไรยังต้องจัดสรรต้นทุน ไม่ใช่หน้าทำ allocation เอง

Target scope ล่าสุด:

- แสดงรายการ target ที่ยังไม่ถูก allocate จาก PO Sell, Sales Bill และ Production
- แสดงเฉพาะทองแดง/ทองเหลือง
- action หลักคือเปิด Cost Allocator พร้อม context
- ตัด flow match บางส่วนออก: ถ้ารายการ target ถูก allocate แล้ว ต้องไม่แสดงใน Waiting Allocations

## Page Responsibilities

- แสดงจำนวนรายการค้าง allocate เฉพาะ `pending_allocation`
- แสดงลูกค้า/แหล่งอ้างอิง, เอกสาร, วันที่, สินค้า, metal group, qty ที่ต้อง allocate, unit price, pending revenue
- filter ด้วย search/status/category
- เปิด Cost Allocator พร้อม target ที่เลือก
- ชี้ risk เรื่องน้ำหนัก PO Sell vs SB ไม่ตรงเมื่อมีข้อมูล

## Non-Responsibilities

- ไม่เขียน match log
- ไม่ reverse allocation
- ไม่แก้ Sales Bill/PO Sell
- ไม่แก้ Cost Pool
- ไม่ตัด stock

## Lifecycle / Read Flow

| Step | User action | System result |
|---|---|---|
| 1 | เปิดหน้า | โหลด waiting rows จาก current API |
| 2 | กรอง status/category/search | แสดงเฉพาะรายการที่ตรง |
| 3 | ดู summary | เห็น count/qty/revenue pending |
| 4 | กด Allocate | เปิด Cost Allocator พร้อม preselect target |
| 5 | Cost Allocator confirm สำเร็จ | รายการ target ต้องหายจาก Waiting Allocations |

## API / Data Contract

### Current API

- `GET /api/dual-costing/waiting-allocations`

Current query params:

- `q`
- `status`
- `category`

Current source:

- shared `buildDualCostingManagement()`
- reads `sales_bills`, `sales_bill_lines`, active `sales_bill_po_sell_allocations`, `trading_deals`, `products`
- excludes Sales Bill header/line ที่มี PO Sell allocation และ excludes `transaction_mode = TRADING`
- filters product group with `isDualCostingGroup()`

Required row fields:

- `docNo`
- `date`
- `customerName`
- `productId`
- `productName`
- `metalGroup`
- `qty`
- `unitPrice`
- `revenuePending`
- `allocationStatus`

## Validation / Status Rules

- Waiting Allocations แสดงเฉพาะ target row ที่ยังไม่ถูก allocate แบบ full match.
- `allocationStatus = pending_allocation` เท่านั้นสำหรับ row ที่แสดงในหน้านี้.
- ถ้า target มี approved allocation แล้วครบจำนวน ต้อง exclude ออกจาก API response.
- ไม่รองรับ `partially_allocated` ใน target flow ล่าสุด.
- Only eligible product groups appear.
- Cancelled sales bills or reversed/cancelled trading deals must not count as active allocation.

## Side Effects

Read-only. `Allocate` navigation/preselect is a UI action only.

`Allocate` opens `/dual-costing/cost-allocator?sourceType=spot-sell&productId=...&poSellId=SB_DOC_NO:lineNo`.

## Current Code Baseline

- Current API/page is implemented and protected by `finance.cash.view`.
- Current code filters copper/brass in shared management builder and uses Sales Bill line facts where available.

## Current Gap

- No allocation write from this page.
- No aging/staleness threshold for waiting allocation yet.
- Weight-diff adjustment is documented from legacy but not target-complete in Next.
- API/read model must use the same allocation key as Allocation Ledger: source type, source doc no/id, source line id, and product id.
- Fully allocated targets must be hidden from Waiting Allocations after refresh.

## Implementation Checklist

- [x] Legacy queue sections inspected
- [x] Current API identified
- [x] Add direct navigation contract to Cost Allocator in Next
- [x] Confirm target policy: full match only, no partial target allocation
- [ ] Define stale allocation aging buckets
- [ ] Align Waiting Allocations allocated detection with durable Allocation Ledger key
