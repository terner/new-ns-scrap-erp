---
title: Customer Tracking Page Flow
tags:
  - page-flow
  - menu
  - tracking
status: accepted-baseline
updated: 2026-06-11
route: /tracking/customer
---

# Customer Tracking Page Flow

## Scope

| Field | Value |
|---|---|
| Menu section | Tracking 360 |
| Route | `/tracking/customer` |
| Page | Customer Tracking |
| Current Next | accepted code baseline |
| Canonical overview | [[Tracking 360 Flow]] |

## Canonical References

- [[Tracking 360 Flow]]
- [[Sales Flow]]
- [[Payment Flow]]
- [[Finance AR Page Flow]]
- [[Document Aging Policy]]
- [[Menu Page Flow Catalog]]

## Legacy Baseline

Legacy `view-customerTracking`:

- วิเคราะห์ลูกค้าตามปี/เดือน พร้อม selector ลูกค้า, tabs `รายการ + สถิติ`, `Top 10 + วิเคราะห์`, `รายปี`
- Source หลักคือ `salesBills`, `receipts`, `customers`, `products`
- Aggregate ต่อ customer: จำนวนบิล, น้ำหนักขาย, revenue, COGS, GP, GP%, profit/kg, received, receivable
- มี top revenue, top GP, top GP%, margin ต่ำ/ติดลบ, top receivable
- มี drilldown detail ต่อ customer: sales list, receipts list, product breakdown, monthly breakdown
- Export CSV ใช้ filter/view ปัจจุบัน

## Page Responsibilities

- แสดงภาพรวมลูกค้าจากยอดขาย รับเงิน ลูกหนี้ และ GP
- ใช้สำหรับตรวจ customer performance, receivable exposure, margin risk
- แสดง monthly trend ของยอดขาย/GP ต่อปี
- Export row set ปัจจุบันเป็น `.xlsx`
- Target drilldown: customer -> SB/RCP/product breakdown/source document links

## Non-Responsibilities

- ไม่สร้าง/แก้ Sales Bill หรือ Receipt
- ไม่ allocate customer advance
- ไม่เขียน bank statement หรือ AR settlement
- ไม่เปลี่ยน credit term/credit limit ของ customer master
- ไม่เปลี่ยนสถานะ SB/RCP

## Current API

### `GET /api/tracking/customer`

Permission: `reports.reports.view`

Query:

| Query | Meaning |
|---|---|
| `year` | ปี ค.ศ.; default ปีปัจจุบัน |
| `month` | เดือน `1-12` หรือ `01-12`; optional |
| `customerId` | customer code หรือ internal id ที่ resolve ผ่าน active customer reference |
| `q` | ค้นหา customer code/name |
| `format=xlsx` | export workbook |

Source tables:

- `customers` active only
- `sales_bills` excluding `status = cancelled`
- `receipts` excluding `status = cancelled`

Response:

| Field | Meaning |
|---|---|
| `filters.customers` | active customer options using business code as id |
| `rows` | aggregate customer rows |
| `monthly` | 12-month revenue/qty/GP series for selected year |
| `summary` | total cogs/customers/gp/qty/receivable/received/revenue |
| `year` | selected year |

Row fields:

- `code`, `customerName`
- `billCount`, `receiptCount`
- `qty`, `revenue`, `cogs`, `gp`, `gpPct`, `profitPerKg`, `avgSell`
- `receivedAmount`, `receivable`, `creditLimit`

## Calculation Rules

- Sales bill amount uses item JSON total first: `netAmount`, `amount`, `total`; fallback `subtotal`, then `total_amount`.
- Sales qty uses item JSON: `netWeight`, `weight`, `qty`.
- COGS uses `sales_bills.cogs_amount` fallback `total_cost`.
- GP uses `sales_bills.gross_profit`; if missing, `revenue - cogs`.
- Receipt amount counted toward received = `amount + withholding_tax + discount`.
- Receivable per bill = `max(0, total_amount - receivedByBill)`.
- Rows with no bill/revenue/receivable are excluded.
- Sort default is revenue descending.

## Lifecycle / Read Flow

| Step | User action | System result |
|---|---|---|
| 1 | เปิดหน้า | โหลด customer tracking ของปีปัจจุบัน |
| 2 | เลือก year/month/customer/search | API recalculates rows, monthly, summary with same filters |
| 3 | ดู top/summary | User identifies revenue, margin, receivable risk |
| 4 | Export | Download `tracking_customer_<year>[_month].xlsx` |
| 5 | Future drilldown | Open customer detail with SB/RCP/product breakdown |

## Validation / Status Rules

- Customer filter must resolve active customer only.
- Cancelled SB/RCP must be excluded.
- Receipt amount must not double count bill received amount and aggregate receipt list separately without stating purpose.
- Customer code is required for outward id; missing business code should fail loudly through `requireBusinessCode`.
- Aging/credit exposure must not be inferred from this page until due-date policy is added.

## Side Effects

- Current API is read-only/export only.
- No stock, bank, receipt, AR, credit, or source document mutation.

## Current Gap

- API does not yet return drilldown source rows per customer.
- API does not yet return product/channel breakdown that legacy detail view had.
- AR aging buckets and due-date logic remain owned by [[Finance AR Page Flow]].
- Customer advance allocation is out of scope here and should come from Sales/Payment flow facts.

## Implementation Checklist

- [x] Verify current API response shape and source tables
- [x] Record legacy customer tracking/detail baseline
- [x] Mark read-only/export side-effect boundary
- [ ] Add customer detail/read endpoint or drilldown payload
- [ ] Add source links to SB/RCP/customer documents
- [ ] Add product/channel breakdown after source contract is finalized
- [ ] Add AR aging only when due-date rules are reconciled
