---
title: Tracking 360 Flow
tags:
  - tracking
  - page-flow
status: draft
updated: 2026-06-11
---

# Tracking 360 Flow

เอกสารนี้เป็นภาพรวมหมวด `Tracking 360` สำหรับ active Next menu เท่านั้น ครอบคลุม:

- `/tracking/customer`
- `/tracking/supplier`
- `/tracking/product`

## Business Boundary

Tracking 360 เป็น read-model/report surface สำหรับดูประวัติและภาพรวมของ entity หลัก ไม่ใช่จุดสร้าง/แก้ transaction:

- Customer Tracking อ่านยอดขาย, รับเงิน, ลูกหนี้, GP จาก `sales_bills` และ `receipts`
- Supplier Tracking อ่านยอดซื้อ, จ่ายเงิน, เจ้าหนี้ จาก `purchase_bills` และ `payments`
- Product Tracking อ่านยอดซื้อ, ยอดขาย, GP, stock/WAC จาก `purchase_bills`, `sales_bills`, และ `stock_ledger`
- ทุกหน้าใช้ `year/month` เป็น cutoff หลัก และ export ด้วย filter เดียวกับหน้าจอ
- ทุกหน้าใช้ business code เป็น outward id ใน UI/filter/export เมื่อ resolve ได้

## Active Pages

| Page | Route | Purpose | Detailed doc |
|---|---|---|---|
| Customer Tracking | `/tracking/customer` | วิเคราะห์ลูกค้าจากยอดขาย รับเงิน ลูกหนี้ GP และ monthly trend | [[page-flows/tracking-360-tracking-customer|Customer Tracking Page Flow]] |
| Supplier Tracking | `/tracking/supplier` | วิเคราะห์ผู้ขายจากบิลรับซื้อ จ่ายเงิน เจ้าหนี้ ราคาเฉลี่ยซื้อ และ product mix | [[page-flows/tracking-360-tracking-supplier|Supplier Tracking Page Flow]] |
| Product Tracking | `/tracking/product` | วิเคราะห์สินค้าจากซื้อ/ขาย/GP/stock/WAC/top/slow mover | [[page-flows/tracking-360-tracking-product|Product Tracking Page Flow]] |

## Current API Snapshot

| Route | API | Permission | Current behavior |
|---|---|---|---|
| `/tracking/customer` | `GET /api/tracking/customer` | `reports.reports.view` | อ่าน active customers, non-cancelled sales bills, non-cancelled receipts; filter `year/month/customerId/q`; export `format=xlsx` |
| `/tracking/supplier` | `GET /api/tracking/supplier` | `reports.reports.view` | อ่าน active suppliers, non-cancelled purchase bills, non-cancelled payments; filter `year/month`; export `format=xlsx` |
| `/tracking/product` | `GET /api/tracking/product` | `reports.reports.view` | อ่าน active products, purchase bills, sales bills, stock ledger; filter `year/month/productId/metalGroup/branchId/q`; export `format=xlsx` |

## Shared Rules

- Read-only: no transaction, stock ledger, bank statement, AP/AR settlement, or source status mutation.
- Cancelled source documents are excluded from active tracking totals.
- Export must use the same rows/filter as the JSON response.
- Date filter uses source document date/payment date/receipt date according to each source table.
- Tracking pages may expose drilldown links, but source documents remain owned by their own flows.
- Created date, document date, due date, and as-of date must remain separate when aging views are added.

## Source Ownership

| Source | Owner flow | Tracking use |
|---|---|---|
| `sales_bills` | [[Sales Flow]] | Customer revenue, receivable, COGS/GP; Product sales/COGS/GP |
| `receipts` | [[Sales Flow]], [[Payment Flow]] | Customer received amount |
| `purchase_bills` | [[Purchase Flow]] | Supplier purchase/payable; Product buy amount/qty |
| `payments` | [[Payment Flow]] | Supplier paid amount |
| `stock_ledger` | [[Stock Ledger and Stock Balance]] | Product stock qty/value/WAC |
| master data | [[Master Data Current Code Baseline]] | Customer/Supplier/Product name/code/filter options |

## Current Gaps

- Customer/Supplier/Product row drilldown is still a target behavior; current APIs mainly return aggregate rows, not full source-document timelines.
- Customer Tracking does not currently return product/channel breakdown from API even though legacy detail view had breakdowns.
- Supplier Tracking does not currently return per-supplier bill/payment detail or selected supplier filter in API.
- Product Tracking reads stock from `stock_ledger`; availability/hold-aware `พร้อมใช้` remains owned by stock balance docs and is not fully represented here.
- Aging buckets for receivable/payable/slow stock should be added only after [[Document Aging Policy]] and stock hold policy are finalized.
- Formula/source reconciliation is still required when COGS/WAC behavior changes in Sales/Stock flows.

## Implementation Direction

- Keep Tracking 360 APIs read-only and deterministic.
- Add drilldown payloads or detail APIs as separate read endpoints if row detail becomes too heavy.
- Keep source document links business-facing: customer/supplier/product code, PB/SB/receipt/payment doc numbers.
- Do not add runtime fallback for malformed legacy item JSON; fix source data or migration if product/customer/supplier references cannot resolve.
