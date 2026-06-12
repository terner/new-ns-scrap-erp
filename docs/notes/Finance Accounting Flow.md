---
title: Finance Accounting Flow
tags:
  - finance-accounting
  - reports
  - read-model
  - flow
status: accepted-baseline
updated: 2026-06-11
---

# Finance Accounting Flow

เอกสารนี้เป็น source หลักของหมวด `Finance / Accounting` ใน active Next app. สถานะปัจจุบันของหมวดนี้เป็น management/read baseline เป็นหลัก: อ่านข้อมูลจาก operational tables, asset/loan/equity/opening/historical tables และ helper report แล้วแสดงผลให้ผู้บริหาร/การเงินตรวจสอบ แต่ยังไม่ใช่ GL/statutory accounting close system

## Shared Boundary

- permission กลางของ API ชุดนี้คือ `finance.financials.view`
- ทุกหน้าปัจจุบันเป็น `GET` read surface
- write action จำนวนมากถูกปิดผ่าน `designState` เช่น asset disposal, depreciation run/reverse, loan import/payment, opening balance apply, historical data save
- ห้ามให้ report page เขียน `bank_statement`, `stock_ledger`, PB/SB status, AP/AR allocation, GL posting หรือ asset/loan/equity state จนกว่าจะมี write-flow + audit + reversal design แยก

## Current API Map

| Route | Current API | Query | Current source/builder | Current write state |
|---|---|---|---|---|
| `/finance-accounting/financial-dashboard` | `GET /api/finance-accounting/financial-dashboard` | `asOf`, `branchId` | `buildFinancialDashboard()` | read-only |
| `/finance-accounting/cash-flow-analysis` | `GET /api/finance-accounting/cash-flow-analysis` | `from`, `to`, `branchId` | `buildCashFlowAnalysis()` | read-only |
| `/finance-accounting/cf-forecast-calendar` | `GET /api/finance-accounting/cf-forecast-calendar` | `startDate`, `horizon`, `branchId` | `buildCashFlowForecastCalendar()` | read-only forecast |
| `/finance-accounting/working-capital` | `GET /api/finance-accounting/working-capital` | `asOf`, `periodDays`, `branchId` | `buildWorkingCapital()` | read-only |
| `/finance-accounting/stock-finance` | `GET /api/finance-accounting/stock-finance` | `asOf`, `branchId` | `buildStockFinance()` | read-only |
| `/finance-accounting/profit-leak` | `GET /api/finance-accounting/profit-leak` | `from`, `to`, `branchId`, `targetMargin` | `buildProfitLeak()` | read-only |
| `/finance-accounting/tax-vat-wht` | `GET /api/finance-accounting/tax-vat-wht` | `year`, `month`, `branchId` | `buildTaxVatWht()` | read-only tax baseline |
| `/finance-accounting/pl-statement` | `GET /api/finance-accounting/pl-statement` | `from`, `to`, `branchId`, `transactionMode` | `buildPlStatement()` | read-only management P&L |
| `/finance-accounting/balance-sheet` | `GET /api/finance-accounting/balance-sheet` | `asOf`, `branchId` | `buildBalanceSheet()` | read-only management balance sheet |
| `/finance-accounting/cash-flow-statement` | `GET /api/finance-accounting/cash-flow-statement` | `from`, `to`, `branchId` | `buildCashFlowStatement()` | read-only management cash flow |
| `/finance-accounting/asset-register` | `GET /api/finance-accounting/asset-register` | none | `assets`, `depreciations`, `branches`, `suppliers` | read-only register |
| `/finance-accounting/depreciation` | `GET /api/finance-accounting/depreciation` | none | `assets`, `depreciations` | run/reverse disabled |
| `/finance-accounting/asset-disposal` | `GET /api/finance-accounting/asset-disposal` | none | active `assets` + depreciation-derived NBV | disposal write disabled |
| `/finance-accounting/loan-contracts` | `GET /api/finance-accounting/loan-contracts` | none | `loans`, `loan_schedules`, `loan_payments` | save/import/payment disabled |
| `/finance-accounting/loan-dashboard` | `GET /api/finance-accounting/loan-dashboard` | none | `loans`, `loan_schedules`, `loan_payments` | read-only |
| `/finance-accounting/asset-overview` | `GET /api/finance-accounting/asset-overview` | `asOf`, `branchId` | `buildCashOthersSummary()` + `buildFinancialDashboard()` | read-only |
| `/finance-accounting/equity-maint` | `GET /api/finance-accounting/equity-maint` | none | latest `equity` row | write disabled |
| `/finance-accounting/opening-balance` | `GET /api/finance-accounting/opening-balance` | none | `opening_balance`, `accounts` | save/apply disabled |
| `/finance-accounting/historical-data` | `GET /api/finance-accounting/historical-data` | none | `historical_monthly` | save/clear disabled |

## Page Semantics

| Page group | Meaning |
|---|---|
| Management financial statements | P&L, Balance Sheet, Cash Flow Statement, Financial Dashboard. These are report-derived statements from operational tables, not locked statutory statements yet. |
| Cash/working capital planning | Cash Flow Analysis, CF Forecast Calendar, Working Capital, Stock Finance, Profit Leak. These explain cash pressure, inventory/AR/AP days, stock finance risk and margin leakage. |
| Tax baseline | Tax / VAT / WHT reads transaction tax fields and tax calendar assumptions. It is not a filing ledger and has no filing lock/status today. |
| Asset baseline | Asset Register, Depreciation, Asset Disposal, Asset Overview read asset/depreciation facts and NBV. Write/reverse/disposal behavior is intentionally disabled. |
| Loan/equity/opening/historical | Loan Contracts/Dashboard, Equity, Opening Balance, Historical Data read setup/support tables. Write paths need approval/audit/cutover design before enabling. |

## Validation Rules

- Every report must state whether it uses actual, forecast, accrual or historical data.
- `asOf` reports use facts up to end-of-day of the selected date.
- period reports use document/business dates in the selected range unless a page explicitly states another basis.
- Currency, FCD, OD and FX treatment must not be silently mixed into THB totals without a documented conversion rule.
- Opening/historical/cutover data must be locked by a cutover approval policy before any write action is enabled.
- Asset and loan write flows need idempotency, audit trail, reversal and bank/GL side-effect policy before moving beyond read baseline.

## Open Gaps

- no normalized GL journal/posting layer yet
- no statutory close/period lock
- tax filing status and PP30/PND workflow are not implemented
- asset acquisition/disposal/depreciation posting and reversal remain design-only
- loan payment posting to bank statement/interest/principal split remains design-only
- opening balance and historical-data writes are disabled until cutover approval policy is defined
