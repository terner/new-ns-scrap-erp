---
title: Profit & Cost Analysis Page Flow
tags:
  - page-flow
  - menu
status: implemented-read-model
updated: 2026-07-19
route: /profit-cost-analysis
---

# Profit & Cost Analysis Page Flow

## Scope

| Field | Value |
|---|---|
| Menu section | Main Dashboard / Reports |
| Route | `/profit-cost-analysis` |
| Page | Profit & Cost Analysis |
| Current Next | incremental fact ledger + daily rollup |

## Canonical References

[[Main Dashboard Reports Flow]], [[Stock Ledger and Stock Balance]], [[Sales Flow]], [[Purchase Flow]]

## Flow Baseline

Profit & Cost Analysis เป็น management margin/cost view จาก PB, SB และ stock ledger เพื่อดู GP, COGS, stock value, product margin, customer/supplier/channel summary

## Page Responsibilities

- วิเคราะห์ purchase amount/qty, sales revenue/qty, COGS, GP, GP%, profit/kg
- แสดง rows by product, supplier, customer, channel และ trend
- รองรับ filter date range, branch, supplier, customer, sales channel, metal group
- แสดง alert เช่น GP ติดลบ, GP ต่ำกว่าเป้า, ซื้อแล้วยังไม่ขาย โดยประเมินจาก read model ทั้ง scope ก่อนจัดลำดับและจำกัดผลลัพธ์ ไม่ตัดสินจาก page แรกของตารางสินค้า

## Non-Responsibilities

- ไม่คำนวณ WAC/posting ใหม่
- ไม่เขียน cost allocation หรือ trading match
- ไม่แก้ PB/SB/stock ledger

## Lifecycle / Read Flow

| Step | User action | System result |
|---|---|---|
| 1 | เปิดหน้า | UI กำหนดช่วงเดือนปัจจุบันและโหลด options, summary, rankings และ active tab พร้อมกัน |
| 2 | ปรับ filter | ค่าใน form ยังเป็น draft; ยังไม่ยิง report query |
| 3 | กดแสดงผล | ระบบ validate internal IDs, วันที่ และ branch permission แล้ว abort request ชุดก่อน |
| 4 | ตรวจ margin | summary อ่าน daily rollup; active tab อ่านเฉพาะหน้าที่ขอพร้อม server pagination/sort |
| 5 | เปลี่ยน tab | โหลดเฉพาะ endpoint ของ tab ใหม่ ไม่โหลดข้อมูลทุก tab ล่วงหน้า |
| 6 | Follow-up | user ไปแก้ source ที่ PB/SB/stock/costing owner page; report เป็น read-only |

## API / Data Contract

### Current APIs

- `GET /api/profit-cost-analysis/options`
- `GET /api/profit-cost-analysis/summary`
- `GET /api/profit-cost-analysis/rankings`
- `GET /api/profit-cost-analysis/products`
- `GET /api/profit-cost-analysis/suppliers`
- `GET /api/profit-cost-analysis/customers`
- `GET /api/profit-cost-analysis/channels`
- `GET /api/profit-cost-analysis/trend`
- `GET /api/profit-cost-analysis/alerts`
- endpoint รวมเดิม `GET /api/profit-cost-analysis` ถูก retire และตอบ `410 Gone`
- permission: `reports.reports.view`
- query: `from`, `to`, internal IDs ของ branch/product/supplier/customer/purchase channel/sales channel และ `metalGroup`
- table query เพิ่ม `page`, `pageSize`, `sortBy`, `sortDirection` โดยใช้ allowlist
- ทุก response เป็น `private, no-store`; decimal money/weight ส่งเป็น string ที่ API boundary

### Source Of Truth And Read Model

- PB + active items เป็น source ของ purchase quantity/amount และ purchase channel ID
- SB + active lines เป็น source ของ net revenue, line COGS และ GP
- stock ledger เป็น source ของ stock quantity/value movement
- `report_profit_cost_facts` เป็น line/event read model ที่ trace กลับ source document ได้
- `report_profit_cost_daily` เป็น daily rollup สำหรับ summary และ product numeric aggregates
- fact ledger ใช้เฉพาะข้อมูลที่ต้อง distinct source document เช่น bill count
- AP/AR อ่าน balance ปัจจุบันจาก PB/SB ภายใต้ date/filter/branch scope เดียวกับรายงาน
- master data เป็น source ของ branch/product/party/channel options; ไม่มีการ resolve business code เป็น ID ด้วยการเดา

### Current Formula Notes

- draft และ cancelled/void/reversed ไม่สร้าง business fact
- SB revenue เป็นยอด line หลังจัดสรรส่วนลดหัวเอกสาร; COGS ต้องมีครบระดับ line และรวมตรงกับ header
- operational stock COGS จาก WTO source allocation มี precedence; trading allocation ใช้เฉพาะ line ที่ไม่มี WTO source
- GP = net revenue - line COGS; ค่าเงินใช้ `numeric(18,2)` และน้ำหนักใช้ `numeric(18,3)`
- target margin อ่านจาก `system_settings.profit_cost_target_margin_pct`; ถ้าไม่มีหรือผิดรูปแบบ API ต้อง fail โดยไม่ fallback
- projector idempotent และ rebuild rollup เฉพาะช่วงวันที่ที่ source เปลี่ยน

## Validation / Status Rules

- source-to-fact, header-to-lines และ fact-to-daily ต้องไม่มี blocking reconciliation issue ก่อน deploy/cutover
- unit display must preserve product unit and avoid mixing `กก.` and `ลัง` as one quantity
- filter/export must apply the same server conditions
- page remains management report, not accounting posting
- branch options, summary, AP/AR และทุก tab ต้องใช้ permission scope ชุดเดียวกัน

## Side Effects

- read-only; no stock ledger, cost allocation, PB/SB, bank or payment writes

## Cache And Delivery Contract

- report facts, balances, stock, GP และ COGS เป็น L5 business facts; Database/read model เป็น source of truth
- ห้าม cache payload ใน Redis, shared server cache, localStorage หรือ sessionStorage
- summary, rankings และ active table ใช้ independent request/error state และ AbortController เพื่อยกเลิก request เก่า ไม่ใช่ data cache; ส่วนหนึ่งล้มต้องไม่ล้างข้อมูลที่สำเร็จจากอีกส่วน
- reference options ยังอ่าน DB โดยตรงใน batch นี้; การเพิ่ม cache ภายหลังต้องมี repeated-read evidence, scope และ invalidation contract

## Remaining Gap

- server-side export และ source drilldown ยังไม่อยู่ใน batch นี้
- nightly reconciliation scheduler ต้องผูกกับ deployment operation; manual backfill/verify commands มีแล้ว
- dedicated permission สำหรับ cost/profit visibility ยังควรแยกจาก generic report permission ก่อน production exposure

## Implementation Checklist

- [x] Verify current API and source tables
- [x] Remove COGS/runtime fallback and enforce line/header reconciliation
- [x] Add fact/daily reconciliation and manual verify command
- [x] Split APIs and implement server pagination/sort
- [x] Enforce branch scope across options, summary and tabs
- [ ] Define product/customer/supplier row drilldown
- [ ] Decide permission split from generic report permission

## 2026-07-12 Table consistency checkpoint

`/profit-cost-analysis` keeps its report surfaces and calculations unchanged while the product-detail table now aligns numeric headers with numeric cells and uses the canonical `p-2` header / `p-3` body density. What is what: the modal table is a read-only purchase/sales/stock breakdown for the selected product. Why it stays this way: detail values must scan vertically without introducing a page-local spacing or alignment variant; APIs, COGS/GP formulas, permissions, database schema, and DB state are unchanged.
