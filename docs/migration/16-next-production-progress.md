# 16 Next Production Progress

## Objective

ติดตามงานดึงกลุ่ม `ผลิต` จาก legacy source เข้าสู่ Next.js พร้อม API, DB wiring, validation, stock/cost side effects, report baseline และ reconciliation

## Reporting Rule

- อัปเดตเอกสารนี้หลังจบแต่ละ production batch หรือเมื่อเปลี่ยน schema/API contract
- ใช้ `old-apps/legacy/index.html` เป็น source material เท่านั้น ห้าม route/import runtime กลับไปหา legacy
- DB migration ต้องเป็น additive เป็นค่าเริ่มต้น และห้ามลบข้อมูลเดิม
- ทุก API write ต้อง validate syntax และ required fields ด้วย schema layer
- ทุก side effect ที่กระทบ stock/cost ต้องระบุ ledger/ref type และ reconciliation query

## Legacy Flow Summary

Legacy production flow หลักอยู่ที่ `old-apps/legacy/index.html`:

| Legacy Area | Approx Component / Usage | Current Understanding |
|---|---|---|
| Production Orders | `view-production` | เปิดใบสั่งผลิต โดยเลือก branch, machine, production line, shift, target product และ production type |
| Production Inputs | production input section in `view-production` | ตัดวัตถุดิบเข้าใบผลิต และสร้าง stock/WIP movement |
| Production Outputs | production output section in `view-production` | บันทึกผลผลิตพร้อม `outputCategory` และ allocation cost |
| Production Reports | `view-productionReport`, `view-productionDashboard` | สรุป order/input/output, yield, cost, machine utilization |
| Machine Utilization | `view-machineUtil` | ใช้ `machines`/`production_machines` ในการคำนวณ utilization |
| Production Cost Report | `view-productionCostReport` | ใช้ input/output/process cost เพื่อดูต้นทุนผลิต |

## Production Output Category Finding

`หมวดหมู่การผลิต` ใน legacy ไม่ใช่ target DB table แยก แต่เป็น enum-like local value บน production output form และ stock ledger output category

Legacy values:

| Code | Meaning | Target Handling |
|---|---|---|
| `FG` | สินค้าสำเร็จรูป | เก็บเป็น active production output category; stock available/saleable |
| `RM` | วัตถุดิบที่ได้กลับมา | เก็บเป็น active production output category; stock available as raw material |
| `CUSTOMER_RETURN` | ของคืนลูกค้า | เก็บเป็น active production output category; stock received but should be tracked separately |
| `LOSS` | สูญเสีย / ของเสีย | เก็บเป็น active production output category; used in yield/loss report, not saleable |

Current Next/DB status:

- `production_machines` exists and is used by master data page/API.
- `production_lines` exists and is used by master data page/API.
- `production_orders`, `production_inputs`, and `production_outputs` exist in Prisma schema.
- `stock_ledger.output_category` exists and can preserve legacy category code.
- `production_output_categories` target table now exists in dev-target with legacy seed values.
- `production_outputs.output_category` and `production_outputs.output_status` were added additively for future output write flow.

## Target Design

Recommended additive table:

```text
production_output_categories
  id
  code
  name_th
  name_en
  stock_effect
  available_for_sale
  sort_order
  active
  created_at
  updated_at
```

Rules:

- Keep legacy `code` values stable: `FG`, `RM`, `CUSTOMER_RETURN`, `LOSS`.
- Existing `production_outputs.output_category` and `stock_ledger.output_category` should continue storing the code during transition.
- UI/API should read category choices from DB instead of hardcoded frontend constants.
- Do not drop or rewrite existing production output/category values in this batch.

## Batch Plan

### Batch P1: Production Output Category Master

Scope:

- DB table `production_output_categories`
- Seed legacy category values
- API `/api/production/output-categories`
- Validation helper for checking active category code

Status: Done baseline on 2026-05-18.

Tasks:

- [x] Add additive Supabase migration for `production_output_categories`.
- [x] Add Prisma model and generate client.
- [x] Seed `FG`, `RM`, `CUSTOMER_RETURN`, `LOSS`.
- [x] Add category mapping helper for legacy output type/status/stock movement behavior.
- [x] Add read/write/status API for category master:
  - `/api/production/output-categories`
  - `/api/production/output-categories/[id]`
- [x] Add UI page with shared master modal and active toggle:
  - `/production/output-categories`
- [x] Add `production_outputs.output_category` and `production_outputs.output_status` as nullable additive columns.
- [x] Add route/API permission mapping under `/production/*` and `/api/production/*`.
- [x] Run DB smoke test confirming 4 seeded categories and new production output columns.
- [x] Update docs and run validation.

Validation target:

- `npm run type-check --workspace @ns-scrap-erp/next`
- `npm run lint --workspace @ns-scrap-erp/next`
- `npm run build --workspace @ns-scrap-erp/next`

Validation result:

- Passed: `npm run type-check --workspace @ns-scrap-erp/next`
- Passed: `npm run lint --workspace @ns-scrap-erp/next`
- Passed: `npm run build --workspace @ns-scrap-erp/next`
- Build confirmed routes generated:
  - `/production/output-categories`
  - `/api/production/output-categories`
  - `/api/production/output-categories/[id]`

### Batch P2: Production Orders Read Baseline

Scope:

- `/production/orders`
- `/api/production/orders`

Status: Done baseline on 2026-05-18.

Tasks:

- [x] Port read surface from legacy `view-production`.
- [x] Add API `/api/production/orders`.
- [x] Add page `/production/orders`.
- [x] Join/display branch, warehouse, target product, input/output counts, quantities, cost/value/variance, and output categories.
- [x] Add server-side pagination/filter/sort because production orders are transaction data.
- [x] Add `+ ใบสั่งผลิตใหม่` modal baseline with legacy sections:
  - Header
  - Input / เบิกวัตถุดิบ
  - Output / รับผลผลิต
  - Process Cost
  - Cost Allocation
- [x] Add row detail modal and legacy action buttons as disabled placeholders until write/stock/cost batch is implemented.
- [x] Add permission mapping for production routes/API.

Important boundary:

- This batch is DB-connected read baseline only. Create/save, submit/approve/close, input/output write, process cost write, reversals, and cost allocation recompute are intentionally disabled until Batch P3/P4 define stock/cost side effects.

Validation result:

- Passed: `npm run type-check --workspace @ns-scrap-erp/next`
- Passed: `npm run lint --workspace @ns-scrap-erp/next`
- Passed: `npm run build --workspace @ns-scrap-erp/next`
- Build confirmed routes generated:
  - `/production/orders`
  - `/api/production/orders`

### Batch P3: Production Output Write Flow

Scope:

- Production output create/edit behavior
- `production_outputs`
- `stock_ledger`

Tasks:

- [ ] Replace hardcoded category choices with DB-driven dropdown.
- [ ] Validate category code against active `production_output_categories`.
- [ ] Preserve write to `production_outputs.output_category`.
- [ ] Preserve write to `stock_ledger.output_category`.
- [ ] Define ref type/movement type mapping before writing stock ledger rows.
- [ ] Add reconciliation for output quantity, category totals, and stock ledger rows.

Important boundary:

- Cost allocation and WIP close rules must be reviewed against legacy before final mutation behavior is considered complete.

### Batch P4: Production Reports Baseline

Scope:

- `/production/dashboard`
- `/production/report`
- `/production/production-cost-report`
- `/production/yield-loss-report`
- `/production/machine-utilization`
- `/production/wip-report`

Status: Done read baseline on 2026-05-18.

Tasks:

- [x] Port DB-connected read dashboards/reports from legacy.
- [x] Add additive legacy report fields on `production_orders`:
  - `machine_id`, `production_line_id`, `production_type`, `shift`, supervisor/operator names, planned qty, normal loss percent, cost allocation method, and production warehouse fields.
- [x] Add additive `process_costs` target table for production cost report and future process-cost write flow.
- [x] Add shared production report helper for input/output/loss/WIP/yield/cost calculations.
- [x] Add pages and APIs:
  - `/production/dashboard` + `/api/production/dashboard`
  - `/production/wip-report` + `/api/production/wip-report`
  - `/production/report` + `/api/production/report`
  - `/production/production-cost-report` + `/api/production/production-cost-report`
  - `/production/yield-loss-report` + `/api/production/yield-loss-report`
  - `/production/machine-utilization` + `/api/production/machine-utilization`
- [x] Add date filters on report pages.
- [x] Add CSV export buttons on report pages where legacy had export: production report, cost report, yield/loss report.
- [x] Keep report/dashboard pages read-only; no stock/cost mutation is performed in this batch.

## Open Decisions

- Current UI places `production_output_categories` under production setup route `/production/output-categories`; decide later if it should also appear under master data.
- Exact stock movement type/ref type names for production input/output in Next.
- Legacy mapping found: `FG/RM/CUSTOMER_RETURN` create WIP out plus destination in, while `LOSS` creates WIP out/loss only and no destination stock-in.
- Whether production output should eventually reference category by FK id while keeping legacy code as a denormalized audit field.
- How process costs should be allocated when editing a paid/closed/posted production order.

## Current Status as of 2026-05-18

- Legacy flow inventory and output category finding documented.
- Batch P1 and P2 implemented locally.
- Batch P4 report/dashboard read baseline implemented locally.
- Dev-target DB has `production_output_categories` with 4 legacy values.
- Next has `/production/output-categories`, `/api/production/output-categories`, `/production/orders`, and `/api/production/orders`.
- Next now has every production menu page from legacy as a DB-connected read baseline:
  - `/production/dashboard`
  - `/production/wip-report`
  - `/production/report`
  - `/production/production-cost-report`
  - `/production/yield-loss-report`
  - `/production/machine-utilization`
- Next already has production-related master data pages for machines and production lines.
