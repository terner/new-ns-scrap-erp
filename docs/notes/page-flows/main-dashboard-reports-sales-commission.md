---
title: Sales Tracking Dashboard Page Flow
tags:
  - page-flow
  - menu
status: accepted-baseline
updated: 2026-06-11
route: /sales-commission
---

# Sales Tracking Dashboard Page Flow

## Scope

| Field | Value |
|---|---|
| Menu section | Main Dashboard / Reports |
| Route | `/sales-commission` |
| Page | Sales Tracking Dashboard |
| Current Next | accepted code baseline |

## Canonical References

[[Main Dashboard Reports Flow]], [[Sales Flow]], [[Purchase Flow]]

## Flow Baseline

Sales Tracking Dashboard เป็น report สำหรับดู performance ของ salesperson/supplier/customer assignment และ commission-readiness ตาม current read model

## Page Responsibilities

- โหลด sales tracking/commission read model จาก server
- แสดงยอดตาม salesperson หรือ assignment ที่ helper `buildSalesCommission()` ส่งกลับ
- ใช้เป็น dashboard ตรวจงาน ไม่ใช่ payroll posting

## Non-Responsibilities

- ไม่สร้าง commission payable
- ไม่แก้ salesperson master หรือ supplier/customer owner
- ไม่เขียน PB/SB/payment/receipt

## Lifecycle / Read Flow

| Step | User action | System result |
|---|---|---|
| 1 | เปิดหน้า | `GET /api/sales-commission` |
| 2 | ดูสรุป | UI แสดง payload จาก `buildSalesCommission()` |
| 3 | Drilldown | ไปหน้า PB/SB/salesperson/supplier ที่เกี่ยวข้องเมื่อมี link |

## API / Data Contract

### Current API

- `GET /api/sales-commission`
- permission: `reports.reports.view`
- server helper: `buildSalesCommission()` from `main-sales-control`

## Validation / Status Rules

- commission formula must be documented before write/payroll behavior is added
- salesperson ownership source must be explicit: master assignment, PB/SB field, or snapshot
- cancelled/reversed source rows must follow report definition

## Side Effects

- read-only; no commission payout, payment, payroll, PB/SB or master-data writes

## Current Gap

- final commission formula and ownership source are not yet a target-complete contract
- needs source row drilldown and export definition

## Implementation Checklist

- [x] Verify current API endpoint
- [x] Document no-payroll/no-write boundary
- [ ] Inspect and document exact `buildSalesCommission()` response shape when runtime changes
- [ ] Define commission formula and payable handoff, if commission will become transactional
