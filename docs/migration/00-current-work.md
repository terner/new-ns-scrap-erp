# 00 Current Work

## Current Status

Date: 2026-05-18  
Active app: `apps/next`  
Primary remote: `new-origin`  
Last pushed checkpoint: `14df0a5 docs: define sub agent operating rules`

## Current Batch

`Batch DOC1: Session Handoff and Operating Rules`

Goal:

- Make documentation updates resumable if the session closes at any time.
- Require checkpoint notes with next task, blockers, validation, and partial work.
- Clarify that after documenting a checkpoint, the agent should identify the next task and continue unless paused.

## File Naming Changes

| Old Name | New Name | Meaning |
|---|---|---|
| `SRS.md` | `REQUIREMENTS_TARGET_SYSTEM.md` | SRS/requirements ของระบบใหม่หรือระบบเป้าหมาย |
| `NS_Scrap_ERP_System_Requirements.md` | `REQUIREMENTS_LEGACY_PROTOTYPE.md` | เอกสาร requirement/description ของระบบเก่า/prototype |

## Latest Completed Implementation Checkpoints

- `14df0a5 docs: define sub agent operating rules`
  - Added sub agent use/close rules to `AGENTS.md`
  - Added operating model to this current work document
- `fa08cb1 docs: standardize requirements and doc index`
  - Renamed ambiguous requirements files
  - Added `00-doc-index.md` and this current work document
- `12fda4b feat: complete production report baseline`
  - Production pages/APIsครบแบบ read/report baseline
- `2d08f0d feat: add production category baseline`
  - Production output categories + production orders baseline
- `3ad5501 docs: add sitemap openapi preflight tasks`
  - Added Batch PRE for sitemap/OpenAPI before next major module

## Next Required Batch

`Batch TW4: Tailwind v4 Migration`

Status:

- Started but interrupted before completion.
- `npm install -D tailwindcss@latest @tailwindcss/postcss@latest --workspace @ns-scrap-erp/next` completed enough to modify:
  - `apps/next/package.json`
  - root `package-lock.json`
- Not yet completed:
  - migrate `apps/next/postcss.config.cjs` from `tailwindcss` plugin to `@tailwindcss/postcss`
  - migrate `apps/next/src/app/globals.css` from `@tailwind` directives to Tailwind v4 CSS import/theme style
  - decide whether to keep or remove `apps/next/tailwind.config.ts`
  - reconcile root `package.json` still listing Tailwind v3 for old Vue tooling
  - run validation

Required validation before commit:

- `npm ls tailwindcss @tailwindcss/postcss --workspace @ns-scrap-erp/next`
- `npm run lint --workspace @ns-scrap-erp/next`
- `npm run build --workspace @ns-scrap-erp/next`

After TW4:

`Batch PRE: System Map and API Contract Baseline`

Tasks:

1. Create `docs/migration/18-next-system-sitemap.md`
2. Inventory navigation routes vs real pages/APIs
3. Create `docs/api/openapi.yaml` skeleton
4. Add current API catalog baseline
5. Commit/push before `Batch S: Stock`

## Current Priority Queue

1. Batch DOC1: Session Handoff and Operating Rules
2. Batch TW4: Tailwind v4 Migration
3. Batch PRE: System Map and API Contract Baseline
4. Batch S: Stock
5. Batch F: Finance and Debt
6. Batch T: Tracking 360
7. Batch D: Dual Costing / Trading / PO
8. Batch FF: Foreign Finance
9. Batch A: Finance / Accounting
10. Batch M: Main Dashboards and Operational Control
11. Batch SYS: System and Cleanup

## Operating Model

Before each module batch:

1. Read the module overview and legacy source touchpoints.
2. Break the module into page-level tasks.
3. For each page, document the expected fields, buttons, modals, APIs, DB tables, validation, pagination/sort/export, and Playwright checks.
4. Implement in reviewable slices.
5. Update the relevant tracker before moving to the next slice.
6. Commit/push after each meaningful checkpoint.

Use sub agents only for bounded parallel work:

- legacy flow search
- route/API inventory
- independent page audit
- Playwright smoke verification
- isolated docs or page/API implementation with clear file ownership

Close sub agents when their task is integrated, no longer needed, blocked, overlapping, or after a batch checkpoint leaves them with no remaining work. Do not leave reminder agents open unless the user explicitly requested one for the active task list.

## Handoff Checklist

At every checkpoint, update docs as if a new session will start from only the repository:

1. Current batch/task/page
2. Exact partial work and files touched
3. Commands already run and result
4. Validation still required
5. Next concrete task
6. Whether to continue immediately or pause for discussion

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
