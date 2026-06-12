---
title: Dual Costing Report Page Flow
tags:
  - page-flow
  - menu
  - dual-costing
status: accepted-baseline
updated: 2026-06-11
route: /dual-costing/report
---

# Dual Costing Report Page Flow

## Scope

| Field | Value |
|---|---|
| Menu section | Dual Costing |
| Route | `/dual-costing/report` |
| Page | Dual Costing Report |
| Current Next | accepted read baseline |

## Canonical References

[[Dual Costing Flow]], [[Cost Pool]], [[page-flows/dual-costing-dual-costing-cost-allocation-ledger|Allocation Ledger Page Flow]]

## Legacy Baseline

Legacy view `view-dualCostingReport` is a management dashboard, not P&L. It aggregates:

- PO Sell rows that have allocation logs
- Spot Sales Bill items that are allocated / partially allocated / pending allocation
- category summary by `ทองแดง` and `ทองเหลือง`
- pending allocation warning
- date range and category filters

Legacy wording explicitly says Deal Cost is for management comparison only and `P&L / งบกำไรขาดทุน ใช้ WAC เสมอ`

## Target Flow

Dual Costing Report summarizes active allocation results and pending allocation exposure by product category. It answers:

- allocated revenue/cost/GP by PO Sell vs Spot Sell
- pending allocation qty/revenue still missing cost
- GP by eligible category
- whether allocation coverage is complete enough for management review

## Page Responsibilities

- Show total allocated revenue, deal cost, gross profit, and GP%
- Split PO Sell vs Spot Sell
- Show pending allocation count/qty/revenue
- Show by-category summary
- Support date/category filter
- State clearly that this is not statutory P&L

## Non-Responsibilities

- ไม่สร้าง allocation
- ไม่แก้ match log
- ไม่ตัด stock
- ไม่แทน financial statement
- ไม่ใช้เป็น COGS source สำหรับบัญชี

## Lifecycle / Read Flow

| Step | User action | System result |
|---|---|---|
| 1 | เปิดหน้า | โหลด report aggregate |
| 2 | filter date/category | aggregate ใหม่ตาม scope |
| 3 | ตรวจ pending | user ไป Waiting Allocations/Cost Allocator |
| 4 | เทียบ margin | ใช้เพื่อ management decision เท่านั้น |

## API / Data Contract

### Current API

- `GET /api/dual-costing/report`

Current source:

- shared `buildDualCostingManagement()`
- `trading_deals`
- `sales_bills`
- `products`

Required payload:

- `report.po`
- `report.spotAllocated`
- `report.waiting`
- `report.total`
- `report.byCategory`

## Validation / Status Rules

- Only active/non-reversed allocations count in allocated totals.
- Pending rows must come only from eligible product groups.
- Cancelled sales bills/deals excluded.
- GP% formula: `grossProfit / revenue * 100`.
- Pending revenue must not be counted as allocated GP.

## Side Effects

Read-only. No mutation.

## Current Code Baseline

- Current API/page is implemented and protected by `finance.cash.view`.
- Current report is based on shared dual-costing management builder.

## Current Gap

- Current report depends on `trading_deals` until durable allocation ledger exists.
- Date/category filters are thinner than legacy in current API and may need expansion when report formula is finalized.
- Production/Regrade sections from legacy are intentionally out of current target Cost Pool scope.

## Implementation Checklist

- [x] Legacy report formula inspected
- [x] Current API identified
- [ ] Reconcile report to future allocation ledger table
- [ ] Add final filter/date cutoff contract
- [ ] Add drilldown links to Waiting Allocations / Ledger
