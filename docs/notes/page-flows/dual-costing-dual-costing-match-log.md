---
title: Match Log Page Flow
tags:
  - page-flow
  - menu
  - dual-costing
status: accepted-baseline
updated: 2026-06-11
route: /dual-costing/match-log
---

# Match Log Page Flow

## Scope

| Field | Value |
|---|---|
| Menu section | Dual Costing |
| Route | `/dual-costing/match-log` |
| Page | Match Log |
| Current Next | accepted read baseline |

## Canonical References

[[Dual Costing Flow]], [[page-flows/dual-costing-dual-costing-cost-allocator|Cost Allocator Page Flow]], [[Document History Table Design]]

## Legacy Baseline

Legacy view `view-matchLog` shows match history from `db.matchLogs`. It supports:

- search by match id / source / GA
- filter by PO Sell, match type, status, cost type
- stats for total matches, sales match, regrade match, active, reversed, qty, cost
- reverse action instead of delete

Legacy reverse behavior:

- sets `status = reversed`
- writes `reversedAt` and `reversedBy`
- for Spot Sell, recalculates allocation status and deal cost fields on the sales item
- does not touch WAC/P&L

## Target Flow

Match Log is the append-only history of allocation decisions. It should be the operational audit trail behind Cost Allocator and Allocation Ledger

Target behavior:

- confirm allocation creates match log rows
- reverse changes active status without deleting history
- source and target references use outward document numbers/codes
- WAC/P&L remains separate

## Page Responsibilities

- Show every match row with match type, cost type, match id, date, target, source, product, qty, unit cost, total cost, mode, status
- Search/filter active and reversed history
- Support export
- Provide reverse action once target write model is implemented

## Non-Responsibilities

- ไม่สร้าง initial allocation
- ไม่ลบ row จริง
- ไม่แก้ stock ledger
- ไม่แก้ GL/P&L
- ไม่เป็น source ของ WAC

## Lifecycle / Read Flow

| Step | User action | System result |
|---|---|---|
| 1 | เปิดหน้า | โหลด match rows |
| 2 | filter/search | แสดง rows ตาม condition |
| 3 | export | ส่งออก history |
| 4 | future reverse | mark/reverse allocation, not delete |

## API / Data Contract

### Current API

- `GET /api/dual-costing/match-log`

Current query params:

- `q`
- `matchType`
- `costType`
- `status`
- `format=xlsx`

Current source:

- `trading_deals` as read baseline

Required row fields:

- `matchId`
- `date`
- `target`
- `sourceNo`
- `sourceType`
- `product`
- `qtyUsed`
- `unitCost`
- `totalCost`
- `allocationMode`
- `status`

## Validation / Status Rules

- `approved` rows count as active usage.
- `reversed` rows must not reduce available Cost Pool.
- Reverse must be auditable and should be idempotent.
- Match ids are group/business ids; row ids must remain unique.
- Future write must block over-allocation.

## Side Effects

Current Next: read-only.

Target future reverse action:

- marks allocation rows reversed or appends reversal facts
- updates derived availability
- does not touch stock ledger or WAC/P&L

## Current Code Baseline

- Current API/page is implemented and protected by `finance.cash.view`.
- Current route maps `trading_deals` to match log rows and supports XLSX export.

## Current Gap

- No normalized match log table yet.
- Current `matchType` and `costType` are simplified to sales/purchase from `trading_deals`.
- Legacy regrade reverse behavior is not active target behavior until Regrade enters target scope.

## Implementation Checklist

- [x] Legacy match log inspected
- [x] Current API identified
- [ ] Design durable match log schema
- [ ] Implement reverse policy
- [ ] Ensure Cost Pool availability derives from active match rows only
