---
title: Compare Deal vs Stock Page Flow
tags:
  - page-flow
  - menu
  - dual-costing
status: accepted-baseline
updated: 2026-06-11
route: /dual-costing/compare-margin
---

# Compare Deal vs Stock Page Flow

## Scope

| Field | Value |
|---|---|
| Menu section | Dual Costing |
| Route | `/dual-costing/compare-margin` |
| Page | Compare Deal vs Stock |
| Current Next | accepted read baseline |

## Canonical References

[[Dual Costing Flow]], [[page-flows/dual-costing-dual-costing-deal-margin|Deal Margin Report Page Flow]], [[Stock Ledger and Stock Balance]]

## Legacy Baseline

Legacy view `view-compareMargin` compares:

- `Deal Cost`: revenue/cost/margin from PO Sell + Match Log
- `Stock Cost`: revenue/COGS/GP from Sales Bills + WAC
- diff cards: revenue diff, cost diff, margin diff

Legacy explains that difference may come from actual cost differing from match, partial receipt/delivery, Grade Adjust, Production Loss, WAC changes, FX/Hedge PnL

## Target Flow

This page is an executive comparison between expected deal economics and real stock/WAC economics. It must keep both calculation bases visible and separate

## Page Responsibilities

- Show Deal totals from allocated deal/match data
- Show Stock totals from actual Sales Bill/WAC data
- Show revenue/cost/margin differences
- Support date filters
- Explain formula/source boundaries

## Non-Responsibilities

- ไม่แก้ Deal Cost
- ไม่แก้ WAC/COGS
- ไม่แทน financial statement
- ไม่บันทึก stock movement
- ไม่สร้าง allocation

## Lifecycle / Read Flow

| Step | User action | System result |
|---|---|---|
| 1 | เปิดหน้า | โหลด deal totals และ stock totals |
| 2 | filter date range | คำนวณ totals/diff ใหม่ |
| 3 | อ่าน diff | user ใช้วิเคราะห์ความต่างระหว่าง deal expectation กับ actual stock result |

## API / Data Contract

### Current API

- `GET /api/dual-costing/compare-margin`

Current query params:

- `from`
- `to`

Current source:

- deal side: `trading_deals.matched_sales_amount`, `matched_purchase_amount`
- stock side: trading/PO-linked `sales_bills.total_amount`, `cogs_amount` or `total_cost`

Required payload:

- `dealTotals.revenue`
- `dealTotals.cost`
- `dealTotals.margin`
- `dealTotals.marginPct`
- `stockTotals.revenue`
- `stockTotals.cost`
- `stockTotals.margin`
- `stockTotals.marginPct`
- `diff.revenue`
- `diff.cost`
- `diff.margin`
- `notes`

## Validation / Status Rules

- Deal side excludes cancelled deals.
- Stock side excludes cancelled sales bills.
- Stock side must be limited to trading/PO-linked bills per current API note.
- Margin formula must be clear on both sides.
- Date cutoff must apply to both sides consistently.

## Side Effects

Read-only. No mutation.

## Current Code Baseline

- Current API/page is implemented and protected by `finance.cash.view`.
- Current API includes notes describing the source formulas.

## Current Gap

- Future formula must decide whether stock side should include all sales, only trading/PO-linked, or only dual-costing eligible products.
- Current API does not yet filter product metal group explicitly.
- Future report should link diffs to concrete causes where possible: WAC movement, unmatched allocation, partial delivery, FX, loss, regrade.

## Implementation Checklist

- [x] Legacy compare formula inspected
- [x] Current API identified
- [ ] Finalize stock-side inclusion rule
- [ ] Add product/category filter if required
- [ ] Add drilldown to Deal Margin, Stock Ledger, and Sales Bill facts
