---
title: Business Calendar Page Flow
tags:
  - page-flow
  - menu
status: accepted-baseline
updated: 2026-06-11
route: /business-calendar
---

# Business Calendar Page Flow

## Scope

| Field | Value |
|---|---|
| Menu section | Main Dashboard / Reports |
| Route | `/business-calendar` |
| Page | Business Calendar |
| Current Next | accepted code baseline |

## Canonical References

[[Main Dashboard Reports Flow]], [[Purchase Flow]], [[Sales Flow]], [[Payment Flow]], [[Daily Cash Flow]]

## Flow Baseline

Business Calendar เป็น calendar รายเดือนของ activity จริง: purchase bills, sales bills, expenses, receipts, payments, GP และ net cash by day

## Page Responsibilities

- แสดงยอดซื้อ, ขาย, COGS, GP, expense, receipt, payment, net cash รายวัน
- แสดง source doc lists ต่อวันสำหรับ PB/SB/EXP/RCP/PMT
- รองรับ query `month=YYYY-MM`

## Non-Responsibilities

- ไม่สร้างหรือแก้เอกสารธุรกิจ
- ไม่เปลี่ยน payment/receipt status
- ไม่ post cash movement เพิ่ม

## Lifecycle / Read Flow

| Step | User action | System result |
|---|---|---|
| 1 | เปิดหน้า | `GET /api/business-calendar` โหลดเดือนปัจจุบัน |
| 2 | เปลี่ยนเดือน | API aggregate เอกสารตาม document date |
| 3 | ตรวจวัน | UI แสดง totals และ source docs ของวันนั้น |

## API / Data Contract

### Current API

- `GET /api/business-calendar?month=YYYY-MM`
- permission: `reports.reports.view`

### Current Source Tables

- `purchase_bills` + `purchase_bill_items`
- `sales_bills`
- `expenses` + `expense_categories`
- `receipts`
- `payments`

### Current Response

- `days`
- `summary`
- `month`
- `sourceState`

## Validation / Status Rules

- month must match `YYYY-MM`; invalid/missing falls back to current month
- active-status exclusion applies to PB/SB/EXP/RCP/PMT
- activity uses document/business date, not created date
- GP uses sales bill `gross_profit` or `total_amount - COGS` fallback

## Side Effects

- read-only; no PB/SB/EXP/RCP/PMT/BST writes

## Current Gap

- drilldown source route per doc type needs final mapping
- export/print not final
- due-date calendar is separate from actual activity calendar and should not be mixed without explicit design

## Implementation Checklist

- [x] Verify current API and source tables
- [x] Document activity-date semantics
- [ ] Add source link mapping for each doc list
- [ ] Define export/print behavior
- [ ] Add tests for cancelled rows and GP fallback
