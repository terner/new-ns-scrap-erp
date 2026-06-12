---
title: Supplier Tracking Page Flow
tags:
  - page-flow
  - menu
  - tracking
status: accepted-baseline
updated: 2026-06-11
route: /tracking/supplier
---

# Supplier Tracking Page Flow

## Scope

| Field | Value |
|---|---|
| Menu section | Tracking 360 |
| Route | `/tracking/supplier` |
| Page | Supplier Tracking |
| Current Next | accepted code baseline |
| Canonical overview | [[Tracking 360 Flow]] |

## Canonical References

- [[Tracking 360 Flow]]
- [[Purchase Flow]]
- [[Payment Flow]]
- [[Finance AP Page Flow]]
- [[Document Aging Policy]]
- [[Menu Page Flow Catalog]]

## Legacy Baseline

Legacy `view-supplierTracking`:

- วิเคราะห์ Supplier ตามปี/เดือน พร้อม selector supplier, tabs `รายการ`, `Top 10`, `รายปี`
- Source หลักคือ `purchaseBills`, `payments`, `suppliers`, `products`
- Aggregate ต่อ supplier: จำนวนบิล, น้ำหนักซื้อ, purchase amount, avg buy, paid, payable, paid%
- มี top purchase amount, top qty, ราคาซื้อถูกสุด/แพงสุด, top payable, payment status distribution
- มี drilldown detail ต่อ supplier: bills, payments, product breakdown, monthly breakdown
- Export CSV ใช้ filter/view ปัจจุบัน

## Page Responsibilities

- แสดงภาพรวมผู้ขายจากยอดรับซื้อ จ่ายเงิน เจ้าหนี้ และราคาเฉลี่ยซื้อ
- ใช้ตรวจ supplier performance, purchase concentration, payable exposure, avg buy risk
- แสดง product mix จาก purchase bill items
- Export supplier row set เป็น `.xlsx`
- Target drilldown: supplier -> PB/PMT/product breakdown/source document links

## Non-Responsibilities

- ไม่สร้าง/แก้ Purchase Bill, PMA, PMT, ADV
- ไม่อนุมัติจ่ายเงินหรือจ่ายเงิน
- ไม่เขียน bank statement หรือ AP settlement
- ไม่แก้ supplier master
- ไม่เปลี่ยนสถานะ PB/PMT/PMA

## Current API

### `GET /api/tracking/supplier`

Permission: `reports.reports.view`

Query:

| Query | Meaning |
|---|---|
| `year` | ปี ค.ศ.; default ปีปัจจุบัน |
| `month` | เดือน `1-12` หรือ `01-12`; optional |
| `format=xlsx` | export workbook |

Current API does not have `supplierId` or `q` server-side filter.

Source tables:

- `suppliers` active only
- `purchase_bills` excluding `PURCHASE_BILL_CANCELLED_STATUSES`
- `payments` excluding `status = cancelled`

Response:

| Field | Meaning |
|---|---|
| `rows` | aggregate supplier rows |
| `byProduct` | product-level purchase summary across selected period |
| `monthly` | 12-month purchase amount/qty series for selected year |
| `summary` | paidAmount, payable, purchaseAmount, qty, suppliers |
| `year` | selected year |

Row fields:

- `code`, `supplierName`
- `billCount`, `paymentCount`
- `qty`, `purchaseAmount`, `avgBuy`
- `paidAmount`, `payable`, `paidPct`

## Calculation Rules

- Purchase amount uses structured `purchase_bill_items` via `purchaseBillItemRows`.
- Item amount uses `netAmount`, `amount`, `totalAmount`, `total`; fallback `subtotal`, then `total_amount`.
- Item qty uses `netWeight` or `qty`.
- Payable uses `purchase_bills.payable_balance`.
- Paid amount sums `payments.amount` by supplier/date period.
- Paid% = `paidAmount / (paidAmount + payable) * 100` when denominator > 0.
- Product mix groups purchase items by product name/code and counts distinct PB doc numbers and suppliers.
- Sort default is purchase amount descending.

## Lifecycle / Read Flow

| Step | User action | System result |
|---|---|---|
| 1 | เปิดหน้า | โหลด supplier tracking ของปีปัจจุบัน |
| 2 | เลือก year/month | API recalculates rows, byProduct, monthly, summary |
| 3 | ดู top/payable | User identifies purchase concentration and payable exposure |
| 4 | Export | Download `tracking_supplier_<year>[_month].xlsx` |
| 5 | Future drilldown | Open supplier detail with PB/PMT/product breakdown |

## Validation / Status Rules

- Cancelled PB/PMT must be excluded.
- Supplier business code is required for outward id through `requireBusinessCode`.
- Payment amount must be counted from payment facts, not inferred only from PB paid snapshots.
- AP aging remains owned by [[Finance AP Page Flow]]; this page currently shows payable exposure only.
- If supplier filtering/search is added, JSON response and export must share the same filter.

## Side Effects

- Current API is read-only/export only.
- No purchase, payment, bank, AP, stock, supplier-master, or source status mutation.

## Current Gap

- Current API has no supplier/search server-side filter.
- API does not yet return supplier detail rows for PB/payment drilldown.
- Product mix is global for the selected period, not per selected supplier because no supplier detail filter exists.
- AP aging/payment-cycle locks remain outside this page.

## Implementation Checklist

- [x] Verify current API response shape and source tables
- [x] Record legacy supplier tracking/detail baseline
- [x] Mark read-only/export side-effect boundary
- [ ] Add supplier/search filter if UI needs server-side filter
- [ ] Add supplier detail/read endpoint or drilldown payload
- [ ] Add source links to PB/PMT/PMA/ADV documents
- [ ] Reconcile paid/payable formulas with final payment allocation facts
