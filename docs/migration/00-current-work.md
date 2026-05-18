# 00 Current Work

## Current Status

Date: 2026-05-18  
Active app: `apps/next`  
Primary remote: `new-origin`  
Last pushed checkpoint before this doc refactor: `3ad5501 docs: add sitemap openapi preflight tasks`

## Current Batch

`Batch DOC0: Documentation Standardization`

Goal:

- Rename ambiguous requirements files.
- Add a standard documentation entrypoint.
- Make future sessions easier to resume without searching many trackers manually.

## File Naming Changes

| Old Name | New Name | Meaning |
|---|---|---|
| `SRS.md` | `REQUIREMENTS_TARGET_SYSTEM.md` | SRS/requirements ของระบบใหม่หรือระบบเป้าหมาย |
| `NS_Scrap_ERP_System_Requirements.md` | `REQUIREMENTS_LEGACY_PROTOTYPE.md` | เอกสาร requirement/description ของระบบเก่า/prototype |

## Latest Completed Implementation Checkpoints

- `12fda4b feat: complete production report baseline`
  - Production pages/APIsครบแบบ read/report baseline
- `2d08f0d feat: add production category baseline`
  - Production output categories + production orders baseline
- `3ad5501 docs: add sitemap openapi preflight tasks`
  - Added Batch PRE for sitemap/OpenAPI before next major module

## Next Required Batch

`Batch PRE: System Map and API Contract Baseline`

Tasks:

1. Create `docs/migration/18-next-system-sitemap.md`
2. Inventory navigation routes vs real pages/APIs
3. Create `docs/api/openapi.yaml` skeleton
4. Add current API catalog baseline
5. Commit/push before `Batch S: Stock`

## Current Priority Queue

1. Batch DOC0: Documentation Standardization
2. Batch PRE: System Map and API Contract Baseline
3. Batch S: Stock
4. Batch F: Finance and Debt
5. Batch T: Tracking 360
6. Batch D: Dual Costing / Trading / PO
7. Batch FF: Foreign Finance
8. Batch A: Finance / Accounting
9. Batch M: Main Dashboards and Operational Control
10. Batch SYS: System and Cleanup

## Known Carry-over Work

- `reports/` is untracked/local and must not be committed unless explicitly approved.
- Production write flow is not complete:
  - create/edit production order
  - production input/output write
  - process cost write
  - reverse/cancel/close/lock cost
  - stock ledger/cost allocation reconciliation
- Purchase follow-ups:
  - void/reversal
  - PO remaining qty reconciliation
  - header/line table refactor
- Sales follow-ups:
  - create/edit/post
  - FIFO/COGS
- Stock follow-ups:
  - Stock module pages still need Batch S
  - Stock transfer cancel/void and cost source still pending
- Finance follow-ups:
  - Payment approval persistence/printing
  - AP/AR allocation/reconciliation
- Auth/permission:
  - branch-scope enforcement
  - full legacy role matrix migration

## Validation Baseline

Latest full app validation passed before DOC0:

- `npm run type-check --workspace @ns-scrap-erp/next`
- `npm run lint --workspace @ns-scrap-erp/next`
- `npm run build --workspace @ns-scrap-erp/next`

DOC0 is documentation-only. Run markdown/link checks manually with `rg` before commit.

