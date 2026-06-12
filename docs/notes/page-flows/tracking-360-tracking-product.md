---
title: Product Tracking Page Flow
tags:
  - page-flow
  - menu
  - tracking
status: accepted-baseline
updated: 2026-06-11
route: /tracking/product
---

# Product Tracking Page Flow

## Scope

| Field | Value |
|---|---|
| Menu section | Tracking 360 |
| Route | `/tracking/product` |
| Page | Product Tracking |
| Current Next | accepted code baseline |
| Canonical overview | [[Tracking 360 Flow]] |

## Canonical References

- [[Tracking 360 Flow]]
- [[Stock Ledger and Stock Balance]]
- [[Purchase Flow]]
- [[Sales Flow]]
- [[Cost Pool]]
- [[Document Aging Policy]]
- [[Menu Page Flow Catalog]]

## Legacy Baseline

Legacy `view-productTracking`:

- วิเคราะห์สินค้าแยกหมวด/ปี/เดือน พร้อม selector product/metal group, tabs `รายการ`, `Top 10 ในหมวด`, `รายปี`
- Source หลักคือ `products`, `purchaseBills`, `salesBills`, `stockLedger`
- Aggregate ต่อ product: buy qty/amount/avg, sell qty/revenue/avg, COGS, GP, GP%, stock qty/value/WAC
- มี top sales, top GP, top GP%, top buy, slow movers
- มี drilldown detail ต่อสินค้า: purchase lines, sales lines, stock ledger movements, monthly breakdown
- Product Tracking legacy เรียง revenue-first เป็น baseline

## Page Responsibilities

- แสดงภาพรวมสินค้าจากยอดซื้อ ยอดขาย GP stock และ WAC
- ใช้ตรวจ product performance, margin, stock exposure, slow mover
- แสดง top lists และ monthly trend ต่อปี
- Export product row set เป็น `.xlsx`
- Target drilldown: product -> PB/SB/stock ledger/source documents

## Non-Responsibilities

- ไม่สร้าง/แก้ stock movement
- ไม่คำนวณหรือ post WAC ใหม่
- ไม่แก้ product master/image/unit/type
- ไม่ allocate cost pool หรือ dual costing
- ไม่เปลี่ยนสถานะ PB/SB/stock documents

## Current API

### `GET /api/tracking/product`

Permission: `reports.reports.view`

Query:

| Query | Meaning |
|---|---|
| `year` | ปี ค.ศ.; default ปีปัจจุบัน |
| `month` | เดือน `1-12` หรือ `01-12`; optional |
| `productId` | product code หรือ internal id |
| `metalGroup` | filter product metal group |
| `branchId` | branch code หรือ internal id |
| `q` | ค้นหา product code/name/metalGroup/itemStatus |
| `format=xlsx` | export workbook |

Source tables:

- `products` active only
- `purchase_bills` excluding `PURCHASE_BILL_CANCELLED_STATUSES`
- `sales_bills` excluding `status = cancelled`
- `stock_ledger`

Response:

| Field | Meaning |
|---|---|
| `filters.products` | active product options using business code as id |
| `filters.metalGroups` | available metal groups from active products |
| `rows` | aggregate product rows |
| `monthly` | 12-month buy/sell/GP series |
| `summary` | buy/sales/stock/GP totals |
| `top` | byBuy, byGp, byRevenue, slowMovers |
| `slowMovers` | compatibility slow mover list |
| `topMovers` | compatibility revenue top list |
| `year` | selected year |

Row fields:

- `code`, `name`, `productName`, `metalGroup`, `type`, `unit`
- `buyQty`, `buyAmount`, `avgBuy`, `buyBillCount`
- `sellQty`, `revenue`, `avgSell`, `sellBillCount`
- `cogs`, `gp`, `gpPct`
- `stockQty`, `stockValue`, `stockWac`, `turnoverPct`

## Calculation Rules

- Product rows are keyed by resolved product id when item JSON maps to active product; unresolved item names become fallback rows only when not filtering by product/metal group.
- Purchase source uses `purchaseBillItemRows`.
- Sales source reads JSON `sales_bills.items`.
- Purchase amount uses `netAmount`, `amount`, `totalAmount`, `total`; fallback qty x price.
- Sales revenue uses `netAmount`, `amount`, `totalAmount`, `total`; fallback qty x price.
- Sales COGS uses `totalCost`, `total_cost`, `cogs`; fallback qty x unitCost.
- Sales GP uses `profit`, `grossProfit`; fallback revenue - COGS.
- Stock qty = sum `qty_in - qty_out` from stock ledger.
- Stock value = sum `value_in - value_out` from stock ledger.
- Stock WAC = `stockValue / stockQty` when stockQty > 0.
- Turnover% = `sellQty / stockQty * 100` when stockQty > 0.
- Slow movers = stockQty > 0 and turnover% < 50, sorted by stockValue desc.
- Sort default is revenue descending, then buy amount descending.

## Lifecycle / Read Flow

| Step | User action | System result |
|---|---|---|
| 1 | เปิดหน้า | โหลด product tracking ของปีปัจจุบัน |
| 2 | เลือก year/month/product/metalGroup/branch/search | API recalculates rows, monthly, summary, top lists |
| 3 | ดู top/slow mover | User identifies product margin and stock risk |
| 4 | Export | Download `tracking_product_<year>[_month].xlsx` |
| 5 | Future drilldown | Open product detail with PB/SB/stock ledger movements |

## Validation / Status Rules

- Product and branch filters must resolve active references by code or internal id.
- Cancelled PB/SB must be excluded.
- Product business code is required for outward option ids through `requireBusinessCode`.
- Product Tracking stock must stay derived from `stock_ledger`; it must not create or correct movement rows.
- Hold/available stock is owned by [[Stock Ledger and Stock Balance]] and `/stock/balance`, not this page.
- COGS/WAC formula must be reconciled if Sales Bill or Stock Ledger implementation changes.

## Side Effects

- Current API is read-only/export only.
- No stock ledger, WAC, product master, PB/SB, bank, AP/AR, or allocation mutation.

## Current Gap

- API does not yet return source movement detail rows for product drilldown.
- Stock availability/hold-aware `พร้อมใช้` is not represented here.
- Item JSON normalization/source links still need reconciliation before relying on per-line product matching for all legacy rows.
- Product Tracking remains revenue-first sorted by design; other sort modes should be explicit UI/API options if added.

## Implementation Checklist

- [x] Verify current API response shape and source tables
- [x] Record legacy product tracking/detail baseline
- [x] Mark read-only/export side-effect boundary
- [ ] Add product detail/read endpoint or drilldown payload
- [ ] Add source links to PB/SB/stock ledger rows
- [ ] Reconcile COGS/WAC with final stock and sales-bill policy
- [ ] Decide whether hold/available should be shown here or only linked to stock balance
