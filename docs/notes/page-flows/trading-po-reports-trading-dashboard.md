---
title: Trading Dashboard Page Flow
tags:
  - page-flow
  - menu
  - trading
status: accepted-baseline
updated: 2026-06-11
route: /trading/dashboard
---

# Trading Dashboard Page Flow

## Scope

| Field | Value |
|---|---|
| Menu section | Trading / PO Reports |
| Route | `/trading/dashboard` |
| Page | Trading Dashboard |
| Current Next | accepted code baseline |
| Canonical overview | [[Trading Flow]] |

## Canonical References

- [[Trading Flow]]
- [[Purchase Flow]]
- [[Sales Flow]]
- [[Payment Flow]]
- [[Document Aging Policy]]
- [[Menu Page Flow Catalog]]

## Legacy Baseline

Legacy `view-tradingDashboard`:

- แสดง Trading เป็น flow แยกจาก stock: “ซื้อมาขายไป” และ “ไม่กระทบ Stock On Hand / WAC”
- Filter หลักคือ `fromD` / `toD`
- Source หลักคือ `purchaseBills.transactionMode === 'TRADING'`, `salesBills.transactionMode === 'TRADING'`, และ `tradingDeals`
- ใช้ยอดก่อน VAT เป็นหลัก โดยเลือก `subtotal` ก่อน fallback `totalAmount`
- KPI หลัก: Trading Purchase, Trading Sales, matched COGS, Trading GP, GP%, Trading AR, Trading AP, sales รอจับคู่, purchase รอขาย, completed deals
- มี trend รายวัน, match status, top product GP, Trading Purchase table, Trading Sales table, Trading by Product table

## Page Responsibilities

- แสดงภาพรวม Trading PB/SB/deal ในช่วงวันที่ที่เลือก
- แสดงยอดซื้อ/ขาย Trading ก่อน VAT, matched COGS, unmatched, GP, GP%
- แสดง AR/AP exposure จาก Trading PB/SB เพื่อดูฐานะการเงินของงาน Trading
- แสดง purchase/sales/deal/product/trend read model เพื่อใช้ตรวจสอบ operational gap
- Drilldown target ควรไป source PB/SB/deal เมื่อ route/detail พร้อม

## Non-Responsibilities

- ไม่สร้างหรือแก้ Trading deal
- ไม่ reverse/cancel deal
- ไม่เขียน stock ledger, WAC, bank statement, payment, receipt, AP/AR settlement
- ไม่เปลี่ยนสถานะ PB/SB/PO
- ไม่เป็น source of truth แทน `purchase_bills`, `sales_bills`, `trading_deals`

## Current API

### `GET /api/trading/dashboard`

Permission: `finance.cash.view`

Query:

| Query | Meaning |
|---|---|
| `q` | ค้นหา deal no, PB no, SB no, supplier, customer, product, status |
| `status` | filter deal status; `all` หรือไม่ส่ง = ทุกสถานะ |
| `from` | วันที่เริ่มต้น; default วันแรกของเดือนปัจจุบัน |
| `to` | วันที่สิ้นสุด; default วันนี้ |

Source tables:

- `purchase_bills` where `transaction_mode = 'TRADING'`
- `sales_bills` where `transaction_mode = 'TRADING'`
- `trading_deals`
- `products`

Response:

| Field | Meaning |
|---|---|
| `summary` | active/cancelled/completed deals, grossProfit, GP%, matched COGS, matched qty, unmatched purchase/sales, Trading AP/AR |
| `purchases` | Trading PB rows with total, matched, remaining |
| `sales` | Trading SB rows with total, matched, remaining |
| `recentDeals` | Recent `trading_deals` rows after filter |
| `statusBreakdown` | count and amounts by deal status |
| `productList` | sales-line product analysis with proportional matched cost |
| `topProducts` | deal-based product GP summary |
| `trend` | daily purchase/sales trend |
| `filters.statuses` | distinct deal status list |

## Calculation Rules

- Purchase amount uses `purchase_bills.subtotal` first, fallback `total_amount`.
- Sales amount uses `sales_bills.subtotal` first, fallback `total_amount`.
- Active source bill excludes `cancelled`, `void`, `reversed`.
- Active deal excludes `Cancelled` / `cancelled`.
- Dashboard GP = filtered Trading sales total - matched COGS from active deals.
- Deal GP = `matched_sales_amount - matched_purchase_amount`.
- Product cost in `productList` is proportional by sales line amount over bill total.
- AR/AP exposure reads `receivable_balance` / `payable_balance` from active Trading SB/PB.

## Lifecycle / Read Flow

| Step | User action | System result |
|---|---|---|
| 1 | เปิดหน้า | โหลด dashboard ด้วย default `from/to` ของเดือนปัจจุบัน |
| 2 | เปลี่ยน date range/status/search | API คืน dashboard ที่ใช้ filter เดียวกันทุก panel |
| 3 | ดู unmatched | ผู้ใช้เห็น PB/SB ที่ยังต้องจับคู่ใน `/trading/matching` |
| 4 | ดู trend/product/deal | ใช้ตรวจความผิดปกติของ GP และ source matching |
| 5 | Drilldown | Target คือเปิด PB/SB/deal detail โดยไม่ mutate data |

## Validation / Status Rules

- ยอดทุก panel ต้องใช้ filter ชุดเดียวกัน
- Cancelled deals ต้องไม่ถูกนับเป็น matched COGS/GP active total
- Status filter ใช้กับ deal rows; purchase/sales remaining ยังต้องคำนวณจาก active deals ทั้งหมดเพื่อไม่ให้ remaining ผิด
- ถ้าสถานะ blank/legacy `Open` ต้องแสดงได้ แต่ควร normalize ใน write API อนาคต
- ต้องแยก `date`, `created_at`, และ due/expected date เมื่อทำ aging ตาม [[Document Aging Policy]]

## Side Effects

- Read-only
- Export/print ในอนาคตต้องไม่ mutate source data

## Current Gap

- Current dashboard API ยังไม่มี source-document route links ใน row payload
- Deal lifecycle/write/reverse ยังไม่อยู่ใน dashboard; ต้องไปอยู่ใน Trading Matching write API ในอนาคต
- Duplicate deal cleanup ต้องเป็น admin/audited operation ไม่ควรทำเงียบใน dashboard
- ต้องกำหนด aging ของ unmatched PB/SB/deal เพิ่มตาม created/document date

## Implementation Checklist

- [x] Verify current API response shape and source tables
- [x] Record legacy ex-VAT Trading dashboard formula
- [x] Mark dashboard as read-only and no stock side effect
- [ ] Add drilldown source links for PB/SB/deal
- [ ] Add aging buckets for unmatched Trading PB/SB/deals
- [ ] Reconcile status names when durable Trading write API is implemented
