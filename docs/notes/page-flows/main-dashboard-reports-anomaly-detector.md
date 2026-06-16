---
title: ตรวจจับความผิดปกติ Page Flow
tags:
  - page-flow
  - menu
status: retired
updated: 2026-06-16
route: /anomaly-detector
---

# ตรวจจับความผิดปกติ Page Flow

## Scope

> Retired: หน้านี้ไม่ใช้งานใน active app แล้ว และ route/API `/anomaly-detector` ถูกถอดออกจาก runtime. เก็บเอกสารนี้ไว้เป็นประวัติ logic read-only anomaly scan เท่านั้น.

| Field | Value |
|---|---|
| Menu section | Main Dashboard / Reports |
| Route | `/anomaly-detector` |
| Page | ตรวจจับความผิดปกติ |
| Current Next | retired / not active |

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

## Retired Lifecycle / Read Flow

| Step | User action | System result |
|---|---|---|
| 1 | เปิดหน้า | ไม่รองรับใน active app แล้ว |
| 2 | เปลี่ยน as-of | ไม่รองรับใน active app แล้ว |
| 3 | กดรายการ | ไม่รองรับใน active app แล้ว |
| 4 | แก้ข้อมูล | ตรวจ/แก้ใน owner page โดยตรงแทน |

## API / Data Contract

### Retired API

- Runtime route/API removed from active Next app.
- Historical rule notes below are retained for audit/migration context only.

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
