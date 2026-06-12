---
title: Trading Flow
tags:
  - trading
  - po-reports
  - page-flow
status: draft
updated: 2026-06-11
---

# Trading Flow

เอกสารนี้เป็นภาพรวมหมวด `Trading / PO Reports` สำหรับ active Next menu เท่านั้น ครอบคลุม:

- `/trading/dashboard`
- `/trading/matching`
- `/po-reports/outstanding`

## Business Boundary

Trading คือการซื้อมา-ขายไปที่แยกจาก stock/WAC ปกติ:

- `Purchase Bill` ที่ `transaction_mode = TRADING` เป็น source ต้นทุน Trading
- `Sales Bill` ที่ `transaction_mode = TRADING` เป็น source รายได้ Trading
- `trading_deals` เป็น fact ปัจจุบันสำหรับจับคู่ PB Trading กับ SB Trading และคำนวณ GP
- ยอด Trading GP ใช้ยอดก่อน VAT เป็นหลัก: `matched_sales_amount - matched_purchase_amount`
- Trading ไม่สร้าง stock-in, stock-out, WAC movement หรือ stock ledger เอง
- ถ้า Sales Bill มี line ที่เป็น stock source จริง ผลกระทบ stock ต้องอยู่ใน `Sales Flow` / `Sales Bills Page Flow` ไม่ใช่ Trading Matching

PO Reports เป็นรายงาน commitment ของ PO:

- `PO Buy Outstanding` = POB ที่ยังต้องรับของจริงและยังเหลือจำนวน
- `PO Sell Outstanding` = POS ที่ยังต้องส่งของจริงและยังเหลือจำนวน
- PO report ไม่สร้าง/แก้ PO, ไม่ close-short, ไม่ตัด stock และไม่สร้าง AP/AR

## Active Pages

| Page | Route | Purpose | Detailed doc |
|---|---|---|---|
| Trading Dashboard | `/trading/dashboard` | ภาพรวม Trading PB/SB/deal, GP, unmatched, AR/AP exposure | [[page-flows/trading-po-reports-trading-dashboard|Trading Dashboard Page Flow]] |
| Trading Matching | `/trading/matching` | รายการ PB/SB Trading ที่เหลือจับคู่, deal list, GP, export | [[page-flows/trading-po-reports-trading-matching|Trading Matching Page Flow]] |
| PO ซื้อ/ขาย คงเหลือ | `/po-reports/outstanding` | รายงาน POB/POS ค้างรับ/ค้างส่งตาม remaining qty/value | [[page-flows/trading-po-reports-po-reports-outstanding|PO Outstanding Page Flow]] |

## Current API Snapshot

| Route | API | Permission | Current behavior |
|---|---|---|---|
| `/trading/dashboard` | `GET /api/trading/dashboard` | `finance.cash.view` | อ่าน `purchase_bills`, `sales_bills`, `trading_deals`, `products`; filter `q/status/from/to`; คืน summary, purchases, sales, recentDeals, statusBreakdown, topProducts, productList, trend |
| `/trading/matching` | `GET /api/trading/matching` | `finance.cash.view` | อ่าน PB/SB Trading และ `trading_deals`; filter `q/status/from/to`; export `format=xlsx`; คืน unmatched purchase/sales rows, deal rows, summary |
| `/po-reports/outstanding` | `GET /api/po-reports/outstanding` | `reports.reports.view` | อ่าน `po_buys`, `po_sells`; exclude cancelled/received/closed/completed; `require_delivery != false`; คืน buyRows, sellRows, summary |

## Source Rules

### Trading Purchase

- Source table: `purchase_bills`
- Include only `transaction_mode = TRADING`
- Exclude cancelled/void/reversed rows from active totals
- Amount basis: `subtotal` first, fallback `total_amount`
- Remaining for matching = purchase ex-VAT amount - active matched purchase amount in `trading_deals`

### Trading Sale

- Source table: `sales_bills`
- Include only `transaction_mode = TRADING`
- Exclude cancelled/void/reversed rows from active totals
- Amount basis: `subtotal` first, fallback `total_amount`
- Remaining for matching = sales ex-VAT amount - active matched sales amount in `trading_deals`

### Trading Deal

- Source table: `trading_deals`
- Active deal excludes `Cancelled` / `cancelled`
- GP = `matched_sales_amount - matched_purchase_amount`
- GP% = `GP / matched_sales_amount`
- A deal must keep user-facing `deal_no`, purchase bill reference, sales bill reference, supplier/customer/product snapshot, matched qty, matched amounts, status, and audit dates.

## Target Match Lifecycle

Current Next API is read/report/export only. Target write flow should be explicit and audited:

| Step | Target action | System rule |
|---|---|---|
| 1 | User selects PB Trading | Must be active Trading PB with remaining amount > 0 |
| 2 | User selects SB Trading | Must be active Trading SB with remaining amount > 0 |
| 3 | User enters matched qty/cost/sales | Amounts must be > 0 and not exceed remaining ex-VAT amount |
| 4 | Save match | Write `trading_deals` append/upsert according to target uniqueness rule; do not touch stock ledger, bank statement, AR/AP settlement, or source bill payment status |
| 5 | Determine status | `Completed` when both source sides are fully matched; otherwise `Partially Matched` |
| 6 | Reverse match | Mark deal cancelled/reversed with audit metadata; do not hard-delete; recompute read model from active deals |

## Statuses

| Status | Meaning | Active in totals |
|---|---|---|
| `Completed` | PB/SB pair is fully matched for the saved amounts | Yes |
| `Partially Matched` | One or both sides still have remaining amount | Yes |
| `Cancelled` / `cancelled` | Match was reversed/cancelled | No, unless the UI explicitly enables cancelled visibility |
| `Open` / blank | Incomplete legacy/current data state; should be normalized in future writes | Treat as active unless cancelled |

## Relationship With Other Flows

- `Purchase Flow`: owns Trading PB creation and payable behavior.
- `Sales Flow`: owns Trading SB creation, customer receivable, and any stock-sourced sales line behavior.
- `PO Buy Page Flow`: owns POB lifecycle, close-short, and allocation into PB.
- `PO Sell Flow`: owns POS lifecycle, downstream allocation, and close-short policy.
- `Dual Costing Flow`: separate management costing for copper/brass allocation; not the same as Trading Matching.
- `Stock Ledger and Stock Balance`: Trading Matching must not write stock movement.

## Open Gaps

- Durable Trading match write/reverse API is not yet part of current Next route handlers.
- Source document drilldown should be added to dashboard/matching rows.
- Duplicate deal cleanup must be an admin/audited operation, not silent runtime cleanup.
- PO Outstanding current API has no server-side filters/export even though legacy UI had tab/filter/export behavior.
- Aging for Trading deals and PO commitments should use created/document/expected delivery dates according to [[Document Aging Policy]].
