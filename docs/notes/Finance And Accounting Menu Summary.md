---
title: Finance And Accounting Menu Summary
aliases:
  - Finance Menu Summary
  - Account Finance Menu Summary
  - สรุปเมนูการเงินและบัญชี
tags:
  - ns-scrap-erp
  - finance
  - accounting
  - menu-summary
  - period-close
status: draft
created: 2026-06-24
updated: 2026-06-24
---

# Finance And Accounting Menu Summary

## Scope

เอกสารนี้สรุปว่าเมนูในหัวข้อ `การเงิน & หนี้` และ `Finance / Accounting` แต่ละหน้าคืออะไร ใช้อ่าน/เขียนข้อมูลอะไร และควรถูก freeze ด้วย period close อย่างไร

เอกสารละเอียดเดิมมีอยู่แล้ว:

- [[Finance Debt Flow]]: source หลักของหมวด `การเงิน & หนี้`
- [[Finance Accounting Flow]]: source หลักของหมวด `Finance / Accounting`
- [[Reporting History Snapshot Policy]]: กฎสำหรับ history/snapshot/rollup ย้อนหลัง

ไฟล์นี้เป็น summary รายเมนูสำหรับใช้คุย product/accounting scope ไม่ใช่ replacement ของ flow docs ด้านบน

เอกสารแยกตามหน้าอยู่ใน `docs/notes/page-flows/` โดย route ของหมวดนี้ใช้ prefix `finance-debt-*` และ `finance-accounting-*`. ไฟล์รายหน้าคือที่เก็บ contract ละเอียดต่อ route; ไฟล์ summary นี้ใช้เห็นภาพรวมและเส้นเชื่อมระหว่างหน้า.

## Menu Group: การเงิน & หนี้

หมวดนี้คือ operational finance/debt: ลูกหนี้ เจ้าหนี้ เงินสด ธนาคาร เงินสำรอง และเงินรับล่วงหน้า ไม่ใช่ GL/statutory accounting close

| Route | หน้า | คืออะไร | Source หลัก | Write? | ผลกับเงิน/หนี้ | Close/freeze direction |
|---|---|---|---|---|---|---|
| `/daily/petty-advance` | เงินสำรองจ่าย / กู้กรรมการ | เอกสารเงินสำรองหรือเงินกู้กรรมการ และการคืนเงิน | `petty_advances`, `petty_advance_returns` | write | `PRET` เขียน `bank_statement`; `PADV` เป็นยอดค้าง | period lock ต้อง block create/edit/cancel/return ย้อนหลังในงวดที่ปิด |
| `/finance/ar` | ลูกหนี้ (AR) | aging และยอดค้างรับจากบิลขาย | `sales_bills.receivable_balance`, `sales_bills.received_amount` | read-only | `SB` สร้าง AR, `RCP`/Customer Advance allocation ลด AR | snapshot รายวัน/สิ้นเดือนต้อง freeze AR outstanding/aging ตาม as-of |
| `/finance/ap` | เจ้าหนี้ (AP) | aging และยอดค้างจ่ายจากบิลซื้อ | `purchase_bills.payable_balance`, `purchase_bills.paid_amount` | read-only | `PB` สร้าง AP, `PMT`/Supplier Advance allocation ลด AP | snapshot รายวัน/สิ้นเดือนต้อง freeze AP outstanding/aging ตาม as-of |
| `/finance/bank` | Cash / Bank Statement | ledger เงินสด/ธนาคารและ running balance | `bank_statement`, `accounts` | read-only ปกติ | แสดง movement เงินจริงจาก `RCP`, `PMT`, `TRF`, `PRET`, `CADV` ฯลฯ | period lock ต้อง block correction/delete/backdated movement ในงวดที่ปิด ยกเว้นผ่าน reversal audit |
| `/finance/cash-position` | Cash Position | ภาพรวมสภาพคล่องจาก cash/bank + AR/AP | `accounts`, `bank_statement`, AR/AP source snapshots | read-only | ไม่สร้าง transaction เอง ใช้ดู liquidity | monthly snapshot ต้องเก็บ cash/bank ending, near-due AR/AP และ advance remaining |
| `/finance/customer-advance` | รับล่วงหน้าจาก Customer | เงินรับล่วงหน้าลูกค้าและยอดคงเหลือ/ใช้แล้ว | current: `bank_statement.ref_type = CADV`; target: dedicated advance tables | read-only ในหน้าปัจจุบัน | เป็น liability; เมื่อนำไป allocate กับ `SB` จะลด AR | ต้องมี advance remaining snapshot และ allocation facts ก่อนใช้ย้อนหลังจริง |

## Menu Group: Finance / Accounting

หมวดนี้คือ management reporting + accounting support surface. ปัจจุบันยังไม่ใช่ GL/statutory close เต็มระบบ ยกเว้น asset lifecycle บางหน้าเปิด write แล้วตามเอกสาร [[Finance Accounting Flow]]

| Route | หน้า | คืออะไร | Source/metric หลัก | Write? | Close/freeze direction |
|---|---|---|---|---|---|
| `/finance-accounting/financial-dashboard` | Financial Dashboard | dashboard การเงินรายเดือน/KPI สำหรับผู้บริหาร | operational finance, stock, sales, purchase, asset helpers | read-only | อ่าน monthly snapshots หลังปิดงวด ไม่ควรคำนวณอดีตจาก current-state |
| `/finance-accounting/cash-flow-analysis` | Cash Flow Analysis | วิเคราะห์กำไรเทียบเงินสด, cash pressure, collection/payment movement | bank/cash movements, AR/AP, stock/payment facts | read-only | freeze actual movement ตาม bank/AR/AP snapshots; forecast แยกจาก actual |
| `/finance-accounting/cf-forecast-calendar` | CF Forecast Calendar | calendar พยากรณ์เงินสดรับ/จ่ายล่วงหน้า | AR/AP due, loan/tax/payroll assumptions | read-only forecast | forecast ปรับได้ในอนาคต แต่ actual base ของงวดปิดต้อง lock |
| `/finance-accounting/working-capital` | Working Capital Analysis | Cash Conversion Cycle, AR/AP/Inventory days | AR/AP outstanding, inventory value, sales/purchase movement | read-only | monthly close ต้อง freeze AR/AP/Inventory ending และ movement denominator |
| `/finance-accounting/stock-finance` | Stock Finance Analysis | มูลค่า stock, paid/unpaid, aging, slow moving, margin potential | `stock_ledger`, stock balance/WAC, AP/payment facts | read-only | freeze qty/value/WAC/pending_out/available ตาม as-of เดียวกัน |
| `/finance-accounting/profit-leak` | Profit Leak Dashboard | วิเคราะห์จุดรั่วของกำไรและ margin | sales revenue, WAC/COGS, purchase/payment/stock facts | read-only | ต้องอ่าน COGS/WAC snapshot ของเวลาขายหรือ period close ไม่ใช้ WAC ปัจจุบันย้อนหลัง |
| `/finance-accounting/tax-vat-wht` | Tax / VAT / WHT | VAT ซื้อ/ขาย, VAT payable, WHT, tax calendar | PB/SB/expense/payment tax fields | read-only baseline | target ต้องมี filing status/freeze ภาษีรายเดือนก่อนใช้ยื่นจริง |
| `/finance-accounting/pl-statement` | งบกำไรขาดทุน (P&L) | management P&L จาก revenue, COGS, expense, depreciation, interest, FX | operational facts and accounting helpers | read-only | month/year close ต้อง freeze P&L snapshot; year close ใช้ยอดสุทธิไป retained earnings |
| `/finance-accounting/balance-sheet` | งบดุล (Balance Sheet) | management balance sheet: cash, AR, AP, inventory, assets, loan, equity | ending balance snapshots and setup tables | read-only | month/year close ต้อง freeze BS snapshot และ balanced check |
| `/finance-accounting/cash-flow-statement` | งบกระแสเงินสด | direct method cash flow statement | `bank_statement` classified movement | read-only | close ต้อง freeze classification และตัด internal transfer ออกจาก operating cash flow |
| `/finance-accounting/asset-register` | Fixed Assets / ทรัพย์สิน | ขึ้นทะเบียนและดูสินทรัพย์ถาวร | `assets`, `depreciations`, branches, suppliers | write enabled | period lock ต้อง block acquisition/edit/deactivate ย้อนหลังที่กระทบงวดปิด |
| `/finance-accounting/depreciation` | ค่าเสื่อมราคา | preview/commit/reverse ค่าเสื่อมรายเดือน | `assets`, `depreciations` | write enabled | ต้อง commit depreciation ก่อน close; reverse หลังปิดงวดต้องผ่าน reopen/audit |
| `/finance-accounting/asset-disposal` | จำหน่ายทรัพย์สิน | ขาย/scrap/write off/lost asset และคำนวณ gain/loss จาก NBV | `assets`, `depreciations`, `asset_disposals` | write enabled | disposal/reverse ในงวดปิดต้องถูก block หรือทำผ่าน reopen/audit |
| `/finance-accounting/loan-contracts` | Loan / Leasing / BSL | สัญญาเงินกู้, leasing, hire purchase, OD, director loan | `loans`, `loan_schedules`, `loan_payments` | write disabled ตอนนี้ | target ต้อง freeze outstanding/interest/payment schedule per period |
| `/finance-accounting/loan-dashboard` | Loan Dashboard | dashboard หนี้เงินกู้ ยอดคงเหลือ due/overdue/interest | loan schedules/payments | read-only | monthly snapshot ต้องเก็บ outstanding, due, overdue และ interest accrued |
| `/finance-accounting/asset-overview` | Net Worth / Track Asset | ภาพรวม asset/cash/debt/net worth | Financial Dashboard + cash/asset/debt summaries | read-only | อ่านจาก frozen BS/asset/loan snapshots เมื่อดูย้อนหลัง |
| `/finance-accounting/equity-maint` | Equity / ทุนจดทะเบียน | ข้อมูลทุนและ equity setup | latest `equity` row, P&L current year | write disabled ตอนนี้ | year close ต้องโยก current year profit/loss เข้า retained earnings ตาม policy |
| `/finance-accounting/opening-balance` | Opening Balance / ตั้งต้นยอด | ยอดตั้งต้นก่อน go-live: cash, AR/AP, stock, asset, loan, tax, equity | `opening_balance`, `accounts` | save/apply disabled | เป็น cutover-only; หลัง approve/go-live ต้อง lock ไม่ใช่ monthly close ปกติ |
| `/finance-accounting/accounting-periods` | Accounting Periods | เจ้าของ policy งวดบัญชี: create, soft close, lock, reopen | period policy/readiness state | policy UI | ควรเป็นศูนย์กลาง month close/year close และ freeze enforcement ในอนาคต |
| `/finance-accounting/posting-rules` | Posting Rules | readiness และ mapping source-to-account สำหรับ FA5/GL | source-to-account mapping policy | policy UI | ต้อง complete ก่อนเปิด GL/statutory close; ตอนนี้ยังไม่ post GL อัตโนมัติ |
| `/finance-accounting/historical-data` | ข้อมูลย้อนหลัง ม.ค.-เม.ย. 2026 | baseline ก่อน go-live สำหรับ monthly comparison | `historical_monthly` | save/clear disabled | หลัง import/approve ต้อง lock และใช้เป็น historical baseline เท่านั้น |

## Month Close / Year Close Recommendation

Legacy ไม่มี month-end close ที่ lock เอกสารจริง มีเพียง `Opening Balance` และ `Historical Data` สำหรับตั้งต้น/ย้อนหลัง ดังนั้น target ควรใช้ `Accounting Periods` เป็นเจ้าของ flow ปิดงวดใหม่

Recommended month close:

1. Readiness check: ตรวจ transaction ที่ยังไม่ complete, AR/AP mismatch, stock negative, bank unreconciled, tax gap, asset depreciation missing
2. Build daily/monthly snapshots: Bill/PO, AR, AP, Cash/Bank, Stock qty/value/WAC, advance remaining, tax, asset, loan, P&L, Balance Sheet, Cash Flow
3. Soft close: เตือนและจำกัด backdated transaction แต่ยังให้ admin แก้ได้พร้อม audit
4. Lock period: block create/edit/cancel/reverse/backdate ในงวดที่ปิด ยกเว้นผ่าน reopen/audit
5. Reopen: ต้องบันทึกเหตุผล ผู้เปิด ผู้อนุมัติ และ rebuild snapshot หลังแก้

Recommended year close:

1. ทุกเดือนในปีต้อง locked หรือมี exception log
2. freeze annual P&L, Balance Sheet, Cash Flow
3. carry current year profit/loss ไป retained earnings ตาม policy
4. create next-year opening balances จาก ending balances ที่ lock แล้ว

## Lock Impact Matrix

| Area | เมื่อปิดงวดแล้วควร lock อะไร | หมายเหตุ |
|---|---|---|
| Sales | `SB`, `RCP`, customer advance allocation, stock return/cancel movement dated in closed period | `WTO` ที่ยังเป็น pending_out ไม่สร้าง AR; `SB` เท่านั้นสร้าง AR และตัด ledger |
| Purchase | `PB`, `PMT`, supplier advance allocation, purchase stock movement dated in closed period | `WTI` ไม่สร้าง AP; `PB` เท่านั้นสร้าง AP และ stock-in |
| Stock | `stock_ledger`, stock hold/pending_out facts, WAC snapshots | historical stock ต้องใช้ cutoff เดียวกันทั้ง qty/value/WAC |
| Bank/Cash | `bank_statement`, transfer, receipt/payment bank facts | correction หลังปิดงวดต้องเป็น reversal/audit ไม่ใช่แก้ทับ |
| Assets | acquisition, depreciation commit/reverse, disposal/reverse | depreciation ควรถูก commit ก่อน lock |
| Loans | loan payment, interest/accrual schedule state | current page ยัง read-only แต่ snapshot ต้องรองรับ |
| Reports | report pages ไม่ lock เอง | report ต้องอ่าน snapshot/facts ที่ถูก lock โดย source owner |

## Implementation Gaps

- ยังไม่มี normalized GL journal/posting layer
- `Accounting Periods` และ `Posting Rules` เป็น policy/readiness UI; ยังไม่ enforce runtime lock ทุก write API
- ยังต้อง define daily/monthly/yearly snapshot schema สำหรับ Bill, PO, Finance, Stock, Asset, Loan และ Tax
- ต้องเพิ่ม reconciliation checks ก่อน lock งวด เช่น AR/AP balance mismatch, stock negative, missing WAC, bank unclassified, depreciation missing
- ต้องมี reopen/rebuild snapshot flow พร้อม audit ก่อนเปิดใช้ period lock จริง
