---
title: Trading Matching Page Flow
tags:
  - page-flow
  - menu
  - trading
status: accepted-baseline
updated: 2026-06-11
route: /trading/matching
---

# Trading Matching Page Flow

## Scope

| Field | Value |
|---|---|
| Menu section | Trading / PO Reports |
| Route | `/trading/matching` |
| Page | Trading Matching |
| Current Next | accepted code baseline |
| Canonical overview | [[Trading Flow]] |

## Canonical References

- [[Trading Flow]]
- [[Purchase Flow]]
- [[Sales Flow]]
- [[Document Timeline Policy]]
- [[Document History Table Design]]
- [[Menu Page Flow Catalog]]

## Legacy Baseline

Legacy `view-tradingMatching`:

- หน้าเดียวมีทั้ง list, dashboard, match modal, reverse match, pull cloud, recalc cost, cleanup duplicate
- Trading purchases/sales มาจาก PB/SB ที่ `transactionMode === 'TRADING'` และไม่ cancelled
- ใช้ยอดก่อน VAT (`subtotal` fallback `totalAmount`) ในการจับคู่และคำนวณ remaining
- Deal statuses หลัก: `Completed`, `Partially Matched`, `Cancelled`
- Duplicate protection ใน legacy ตรวจคู่ `(purchaseBillId, salesBillId)` ที่ยังไม่ cancelled
- Reverse match ใช้วิธี mark `status = Cancelled` และ verify cloud ไม่ใช่ hard-delete
- Recalc cost ใน legacy มี fallback จาก source link หรือ PB total x qty ratio แต่ใน target ควรย้ายเป็น audited service/admin action

## Page Responsibilities

- แสดง Trading PB ที่ยังมี remaining cost ให้จับคู่
- แสดง Trading SB ที่ยังมี remaining sales ให้จับคู่
- แสดง Trading deal rows พร้อม GP, GP%, status, supplier/customer/product
- แสดง summary: active deals, gross profit, purchase/sales total, purchase/sales remaining
- Export deal rows เป็น `.xlsx`
- Target future: เป็น entry point สำหรับสร้าง/reverse Trading match แบบ audited

## Non-Responsibilities

- ไม่เขียน stock ledger หรือ WAC
- ไม่สร้าง bank statement, receipt, payment, PMA/PMT
- ไม่เปลี่ยน AP/AR/payment status ของ PB/SB
- ไม่ cleanup duplicate แบบ silent ใน read API
- ไม่รับผิดชอบ cost pool / dual costing allocation ของทองแดง/ทองเหลือง

## Current API

### `GET /api/trading/matching`

Permission: `finance.cash.view`

Query:

| Query | Meaning |
|---|---|
| `q` | ค้นหา deal no, PB no, SB no, supplier, customer, product, status |
| `status` | filter deal status; `all` หรือไม่ส่ง = ทุกสถานะ |
| `from` | วันที่เริ่มต้น |
| `to` | วันที่สิ้นสุด |
| `format=xlsx` | export deal rows เป็น workbook |

Source tables:

- `purchase_bills` where `transaction_mode = 'TRADING'` and not `cancelled`
- `sales_bills` where `transaction_mode = 'TRADING'` and not `cancelled`
- `trading_deals`

Response:

| Field | Meaning |
|---|---|
| `purchases` | PB Trading rows with `totalAmount`, `matchedAmount`, `remainingAmount`, `supplierName` |
| `sales` | SB Trading rows with `totalAmount`, `matchedAmount`, `remainingAmount`, `customerName` |
| `deals` | deal rows with visible `dealNo`, composite `id`, PB/SB refs, matched amounts, GP, GP%, status |
| `summary` | activeDeals, grossProfit, purchase/sales total and remaining |
| `filters.statuses` | distinct deal status list |

Export:

- `format=xlsx` returns `trading_matching.xlsx`
- Export rows use the same filtered deal rows as JSON response

## Calculation Rules

- Purchase remaining = PB ex-VAT total - active matched purchase amount.
- Sales remaining = SB ex-VAT total - active matched sales amount.
- Active matched amount excludes deals with `Cancelled` / `cancelled`.
- Deal GP = `matchedSalesAmount - matchedPurchaseAmount`.
- Deal row `id` is a deterministic composite to avoid duplicate React keys while keeping visible `dealNo`.
- Summary GP excludes cancelled deals in `grossProfit`.

## Target Write / Reverse Flow

Current Next route handler is read/export only. Target implementation should add separate audited write endpoints instead of mixing writes into the report GET:

| Target API | Purpose | Required rule |
|---|---|---|
| `POST /api/trading/matches` | Create/update match | PB/SB must be active Trading documents; matched amount > 0; amount must not exceed remaining; write timeline/audit |
| `POST /api/trading/matches/{id}/reverse` | Reverse match | Mark cancelled/reversed with user/time/reason; do not hard-delete; recompute remaining from active deals |
| Admin cleanup API | Duplicate cleanup | Admin-only, dry-run preview, keep latest approved rule, mark extras cancelled with audit |

## Target Match Status Rules

| Status | Rule |
|---|---|
| `Completed` | After save, both PB side and SB side are fully matched within tolerance |
| `Partially Matched` | At least one side still has remaining amount |
| `Cancelled` | Reversed match; excluded from active totals |

## Lifecycle / Read Flow

| Step | User action | System result |
|---|---|---|
| 1 | เปิดหน้า | โหลด PB/SB Trading และ deal rows |
| 2 | กรองวันที่/search/status | API filters purchases, sales, deals, and export consistently |
| 3 | ตรวจ remaining | User sees source PB/SB that still need matching |
| 4 | Export | Export current filtered deal rows only |
| 5 | Future save/reverse | Must use write endpoint with audit/timeline, not GET side effect |

## Validation Rules

- PB/SB ต้องเป็น `transaction_mode = TRADING`
- PB/SB ที่ cancelled ห้ามจับคู่ใหม่
- Match amount ต้องไม่เกิน remaining active amount ของแต่ละฝั่ง
- Duplicate active `(purchase_bill_id, sales_bill_id)` ต้องถูกป้องกันหรือ update ตาม rule ที่กำหนด
- Reverse ต้องไม่แก้ source bill totals และไม่ hard-delete match fact
- Write API ต้องบันทึก created/updated/cancelled metadata และ reason

## Side Effects

- Current API: read-only/export only
- Target write API: เขียนเฉพาะ `trading_deals` และ timeline/audit ของ Trading match
- ห้ามเขียน stock ledger, bank statement, payment/receipt, AP/AR settlement

## Current Gap

- Next ยังไม่มี durable create/update/reverse match endpoint ใน API ที่ตรวจรอบนี้
- Current UI/API ยังเป็น report baseline; legacy write actions เป็น reference เท่านั้น
- ยังต้องกำหนด uniqueness ของ match ว่าหนึ่ง PB+SB update deal เดิมหรือรองรับหลาย allocation rows ได้อย่างไร
- ยังไม่มี row drilldown ไป PB/SB detail
- Recalc cost/cleanup duplicate ควรถูกย้ายเป็น admin/audited flow ก่อนเปิดใช้จริง

## Implementation Checklist

- [x] Verify current GET/export API response shape
- [x] Record legacy matching/write/reverse behavior as baseline, not current implementation
- [x] Mark stock/bank/AP/AR side-effect boundaries
- [ ] Design durable `POST` match API and reverse API
- [ ] Add source row links to PB/SB/deal detail
- [ ] Define duplicate/partial allocation model
- [ ] Add timeline/history rows for match create/update/reverse
