---
title: ตรวจจับความผิดปกติ Page Flow
tags:
  - page-flow
  - menu
status: accepted-baseline
updated: 2026-06-11
route: /anomaly-detector
---

# ตรวจจับความผิดปกติ Page Flow

## Scope

| Field | Value |
|---|---|
| Menu section | Main Dashboard / Reports |
| Route | `/anomaly-detector` |
| Page | ตรวจจับความผิดปกติ |
| Current Next | accepted code baseline |

## Canonical References

[[Main Dashboard Reports Flow]], [[Stock Ledger and Stock Balance]], [[Finance Debt Flow]], [[Trading Flow]]

## Flow Baseline

Anomaly Detector เป็น read-only scan ที่สร้างรายการเตือนจากกฎ deterministic เช่น stock ติดลบ, cash ติดลบ, AR/AP overdue, margin ติดลบ, master duplicate, bank entry ไม่มี ref และ trading ค้าง match

## Page Responsibilities

- แสดง anomaly พร้อม category, severity, detail, action และ `fixHref`
- สรุปจำนวน anomaly ตาม severity/category/rule group
- รองรับ query `asOf=YYYY-MM-DD`
- พาผู้ใช้ไปหน้าที่ควรตรวจ ไม่แก้ให้อัตโนมัติ

## Non-Responsibilities

- ไม่ auto-fix source document/master/ledger
- ไม่ merge duplicate master
- ไม่สร้าง adjustment/reversal
- ไม่เปลี่ยน payment, stock หรือ trading status

## Lifecycle / Read Flow

| Step | User action | System result |
|---|---|---|
| 1 | เปิดหน้า | `GET /api/anomaly-detector` โหลด as-of วันนี้ |
| 2 | เปลี่ยน as-of | API คำนวณ anomaly จาก source facts <= as-of |
| 3 | กดรายการ | UI ไป `fixHref` ของ owner page |
| 4 | แก้ข้อมูล | user แก้ใน owner page ที่มี validation/audit ของ flow นั้น |

## API / Data Contract

### Current API

- `GET /api/anomaly-detector?asOf=YYYY-MM-DD`
- permission: `reports.reports.view`

### Current Rule Sources

- `accounts`, `bank_statement`
- `stock_ledger`, `products`
- `sales_bills`, `customers`
- `purchase_bills`, `purchase_bill_items`, `suppliers`
- `trading_deals`

### Current Rule Examples

- stock negative / stock qty zero but value remains
- account balance negative / low total cash
- AR overdue > 90 days
- AP overdue > 60/90 days
- SB negative margin, future date, empty item list
- PB overpaid, future date, empty/zero item amount
- customer/supplier duplicate name
- bank statement row without ref
- trading deal stuck > 30 days
- no PB/SB today on non-Sunday

## Validation / Status Rules

- anomaly id must be stable enough for grouping/display
- severity is `critical`, `warn`, or `info`
- false positive must never mutate source data
- rule wording should name owner page and expected manual action

## Side Effects

- read-only; no write action, no auto-fix, no source mutation

## Current Gap

- row-level highlight after navigation is not complete
- rule thresholds need business sign-off before becoming operational SLA
- no acknowledge/snooze workflow yet

## Implementation Checklist

- [x] Verify current rules and source tables
- [x] Document no-auto-fix boundary
- [ ] Define row-level navigation/highlight contract
- [ ] Confirm thresholds with business owner
- [ ] Decide whether acknowledge/snooze needs separate audit table
