---
title: เจ้าหนี้ (AP) Page Flow
tags:
  - page-flow
  - menu
  - finance-debt
  - accounts-payable
status: accepted-baseline
updated: 2026-06-11
route: /finance/ap
---

# เจ้าหนี้ (AP) Page Flow

## Scope

| Field | Value |
|---|---|
| Menu section | Finance & Debt |
| Route | `/finance/ap` |
| Page | เจ้าหนี้ (AP) |
| Current Next | accepted code baseline |

## Canonical References

[[Finance Debt Flow]], [[Finance AP Page Flow]], [[Purchase Flow]], [[Payment Flow]], [[Document Aging Policy]]

## Page Purpose

หน้า AP เป็น read-model สำหรับดูยอดเจ้าหนี้จากบิลซื้อและการจ่ายเงิน. หน้านี้ไม่อนุมัติจ่าย, ไม่ทำจ่าย, และไม่แก้ยอดเจ้าหนี้โดยตรง.

## Legacy Baseline

Legacy `view-ap`:

- อ่าน `purchaseBills` ที่ไม่ cancelled.
- หักยอดจ่ายจาก `payments`.
- คำนวณ due date จาก `bill.date + supplier.creditTerm`.
- มี summary/detail mode.
- สรุปตาม supplier และ aging bucket.
- แสดง total AP, overdue, due in 7 days, top supplier, export CSV.

## Page Responsibilities

- แสดงยอดค้างจ่ายจาก `purchase_bills`.
- คำนวณ paid จาก `payments` ที่ไม่ cancelled/reversed.
- คำนวณ `payableBalance = totalAmount - paidAmount`.
- คำนวณ aging bucket.
- สรุป supplier/branch/bucket.
- export `.xlsx` ตาม filter ปัจจุบัน.
- ใช้เป็นหน้าอ่านสถานะเพื่อเตรียมต่อไปยัง Payment Approval / Payment.

## Non-Responsibilities

- ไม่สร้าง `PMA`.
- ไม่สร้าง/ยกเลิก `PMT`.
- ไม่แก้ `PB`.
- ไม่เขียน `bank_statement`.
- ไม่ enforce payment locks โดยตรง; lock ต้องอยู่ใน source/payment write APIs.

## Lifecycle / Read Flow

| Step | User action | System result |
|---|---|---|
| 1 | เปิดหน้า | GET AP read model |
| 2 | filter | resolve branch/supplier by business code, filter bills |
| 3 | sort/page | sort in API and paginate |
| 4 | export | return `.xlsx` from same filtered row set |
| 5 | drilldown target | link ไป PB/PMA/PMT source documents |

## Current API

`GET /api/finance/ap`

Query:

- `q`
- `supplierId`
- `branchId`
- `status`
- `bucket`
- `from`
- `to`
- `page`
- `pageSize`
- `sortKey = date|docNo|dueDate|payableBalance|supplierName|aging`
- `sortDirection = asc|desc`
- `format = xlsx`

Response:

- `rows`
- `bySupplier`
- `byBucket`
- `filters.branches/suppliers/statuses`
- `pagination`
- `summary` including `total`, `overdue`, `dueIn7`

Permission ปัจจุบัน: `finance.cash.view`.

## Data Contract

- Outward bill id = `purchase_bills.doc_no`.
- Supplier/branch filter uses outward business code.
- Current row fields include `docNo`, `date`, `dueDate`, `supplierCode`, `supplierName`, `branchName`, `status`, `transactionMode`, `totalAmount`, `paidAmount`, `payableBalance`, `aging`, `bucket`.
- Current API does not include `created_at`; target table/export should add created date.

## Validation / Status Rules

- Exclude purchase bill cancelled statuses by default.
- Exclude cancelled/reversed payments from paid amount.
- Only show rows with balance > 0.01.
- AP status must eventually reflect workflow states clearly: `ยังไม่อนุมัติ`, `รอจ่าย`, `ชำระบางส่วน`, `เสร็จสิ้น`, `ยกเลิก`.
- If a source has PMA approved or payment cycle active, edit/cancel locks belong to source write API and must be visible from AP drilldown.
- Current AP due date still uses bill date + credit term 0; target should use bill due date or supplier credit term.

## Side Effects

- Read-only. No PMA/PMT/bank statement side effect.

## Current Code Baseline

- Current `apps/next` page/API code is accepted as P1 baseline as of 2026-06-11.
- Current API supports filters, sort, pagination, xlsx export, and supplier/bucket summary.
- Current AP due date is a known gap because credit term is hardcoded to 0.

## Current Gap

- Due date/source must be reconciled with supplier credit term and purchase bill due date.
- PMA/PMT state separation and locks need end-to-end runtime proof.
- Source links to PB/PMA/PMT need completion in detail.
- Need created date in list/detail/export.

## Implementation Checklist

- [x] Verify current Next page/component against this page-flow
- [x] Verify API route handlers match Current API and status rules above
- [x] Capture legacy AP baseline
- [ ] Fix/confirm AP due date source
- [ ] Add source document links and workflow state columns
- [ ] Add created-date display/export
