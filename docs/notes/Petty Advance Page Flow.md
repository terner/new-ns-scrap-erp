---
title: Petty Advance Page Flow
aliases:
  - Daily Petty Advance Page
  - Flow หน้าเงินสำรองจ่าย
  - Flow หน้ากู้กรรมการ
  - หน้า Petty Advance
tags:
  - ns-scrap-erp
  - finance
  - debt
  - petty-advance
  - page-flow
status: implemented-target
created: 2026-06-11
updated: 2026-06-26
---

# Petty Advance Page Flow / Flow หน้าเงินสำรองจ่ายและกู้กรรมการ

## Scope

- Route: `/daily/petty-advance`
- APIs: `GET/POST /api/daily/petty-advances`, `GET/POST /api/daily/payment-approval`, `/api/purchase/payments`
- Navigation section: `การเงิน & หนี้`
- Owner: Finance & Debt
- Page type: advance outstanding write flow + approval/payment flow
- Related central flow: [[Daily Cash Flow]]

หน้านี้ใช้ติดตามยอดเงินที่บริษัทให้กรรมการ/พนักงานยืม, เงินสำรองจ่ายที่ยังต้องเคลียร์คืน, และเงินกู้กรรมการที่บริษัทรับเงินเข้า. ไม่ใช่ expense posting และไม่ใช่ payment approval.

Target ที่ยืนยันล่าสุดสำหรับ `DIRECTOR_LOAN`: ต้องแยกเงินกู้กรรมการเป็น `ในระบบ` และ `นอกระบบ`. ทั้งสองกรณีต้องทำให้บัญชีเงินของบริษัทเพิ่มใน cash position เพราะบริษัทรับเงินกู้เข้าเงินจริง. ความต่างอยู่ที่บัญชีฝั่งกรรมการ: ถ้าเป็น `ในระบบ` บัญชีกรรมการต้องอยู่ใน `accounts` และ cash position เห็นเงินออกจากบัญชีกรรมการด้วย; ถ้าเป็น `นอกระบบ` บัญชีกรรมการไม่ได้อยู่ใน `accounts` จึงไม่เห็น cash position ฝั่งกรรมการ แต่ต้องกรอกบัญชีต้นทางที่โอนเข้ามาเป็น snapshot ประวัติ และยังต้องเห็นเงินเข้าบัญชีบริษัท.

## Document Model

| Document | Meaning | Bank Statement Impact |
|---|---|---|
| `PADV` | เอกสารยอดยืม/เงินสำรองจ่าย/เงินกู้กรรมการคงค้าง และเป็น source เข้า Payment Approval โดยตรง | `DIRECTOR_LOAN` สร้าง `BST` เงินกู้เข้า/ออกตามบัญชีที่เลือก; `PETTY_CASH` ยังไม่สร้าง movement ตอน create |
| `PMA` | เอกสารอนุมัติจาก `PADV` | ยังไม่ใช่การจ่ายเงินจริง |
| `PMT` | เอกสารจ่ายจริงหลังอนุมัติ `PADV` | สร้าง `BST` เงินออกจากบัญชีบริษัท |
| `BST` | bank statement row | เกิดจากเงินเข้า/ออกที่กระทบบัญชีใน `accounts` |

## Source Of Truth

- `petty_advances` = header/outstanding document
- `payment_approvals` = approval facts for `PADV`; `source_type = petty_advance`
- `payments` / `payment_allocations` / `bank_statement` = payment facts after approval
- `director_employees` + `director_employee_bank_accounts` = source option ของผู้จ่าย/ผู้รับเงินจากหน้า `/master-data/directors`; ดึง active ทุกประเภท ไม่จำกัดเฉพาะ `กรรมการ` หรือ `พนักงาน`
- `accounts` = source ของบัญชีเงินบริษัท และบัญชีกรรมการกรณีเงินกู้ `ในระบบ`

## Page Meaning

ใช้สำหรับ:

- สร้าง/แก้ `PADV`
- บันทึกเงินกู้กรรมการ `DIRECTOR_LOAN` แบบ `ในระบบ` หรือ `นอกระบบ`
- ดูยอดที่ให้ยืม/สำรองจ่าย
- ดูยอดคืนแล้วและยอดคงเหลือ
- ส่ง `PADV` เข้า `/daily/payment-approval` ทันทีหลังสร้าง
- ดูประวัติอนุมัติ/จ่ายจริงของแต่ละ `PADV`

ไม่ใช้สำหรับ:

- สร้างค่าใช้จ่าย `EXP`
- สร้าง `PMA/PMT`
- ซ่อนผลกระทบเงินเข้าบัญชีบริษัทของเงินกู้กรรมการ
- แก้ bank statement โดยตรง

## Main UI Contract

### List

แสดงตามลำดับ:

- เลขที่เอกสาร
- วันที่กู้ยืม/สำรองจ่าย
- ประเภท
- ผู้รับเงิน
- ยอดยืม
- คืนแล้ว
- คงเหลือ
- สถานะ
- ผู้สร้างรายการ
- วันที่สร้างรายการ แสดงวันและเวลาบรรทัดที่ 2
- จัดการ

### Filters

ควรรองรับ:

- ค้นหาเลขเอกสาร / ผู้รับเงิน / หมายเหตุ
- ประเภท: `DIRECTOR_LOAN`, `PETTY_CASH`
- สถานะที่ผู้ใช้เห็น: `ทั้งหมด`, `รอคืนเงิน`, `คืนแล้วบางส่วน`, `คืนแล้ว`, `ยกเลิก`
- `คืนแล้วบางส่วน` เป็น UI-derived status จาก `status = active` และ `returned_amount > 0`; ไม่เก็บเป็น DB status แยก
- วันที่กู้ยืม/สำรองจ่ายจาก-ถึง
- filter ประเภทและสถานะควรแยกบรรทัดตาม design ที่ยืนยันไว้
- ตารางต้องรองรับ sort และ pagination
- click row เพื่อเปิด detail modal โดยไม่ต้องมีปุ่ม `ดู`

## Create/Edit Modal Contract

### ข้อมูลการกู้ยืม/สำรองจ่าย

- วันที่กู้ยืม/สำรองจ่าย
- ประเภท
- จำนวนเงิน

### ผู้จ่ายและข้อมูลเงินกู้กรรมการ

แสดงเฉพาะเมื่อ `type = DIRECTOR_LOAN`.

- ต้องเลือกตามลำดับสำหรับข้อมูลผู้จ่าย/แหล่งเงินกู้: ผู้จ่าย/กรรมการ -> ประเภทเงินกู้ -> บัญชีที่กู้/บัญชีต้นทางนอกระบบ
- `ประเภทเงินกู้` และ `บัญชีที่กู้` ต้อง disabled จนกว่าจะเลือกผู้จ่าย/กรรมการ
- ประเภทเงินกู้: `บัญชีในระบบ` / `บัญชีนอกระบบ`
- ผู้จ่าย: เลือกจาก active rows ของ `/master-data/directors`; dropdown แสดงรหัสและชื่อในบรรทัดเดียว และไม่แสดงข้อมูลบัญชีใน option หลัก
- บัญชีที่กู้:
  - บังคับเลือกเมื่อเป็น `ในระบบ`
  - ต้องเป็นบัญชีที่ match เลขบัญชีของกรรมการกับ `accounts.account_no`
  - ใช้เป็นบัญชีต้นทางเพื่อให้ cash position เห็นเงินออกจากบัญชีกรรมการ
  - option ต้องแสดงยอดเงินคงเหลือปัจจุบันของบัญชีจาก `accounts` + `bank_statement`
  - ไม่แสดงเป็น required field เมื่อเป็น `นอกระบบ`
- เคส `นอกระบบ` ต้องเลือก `วิธีรับเงินนอกระบบ` ก่อน: `ฝากหน้า counter` หรือ `โอนเงินผ่านบัญชี`. ถ้าเลือก `โอนเงินผ่านบัญชี` จึงแสดงและบังคับเลือกธนาคารที่โอนเข้าจาก active rows ของ `/master-data/bank-names` พร้อมบังคับกรอกชื่อบัญชีที่โอนเข้า; สาขาเป็น optional. ถ้าเลือก `ฝากหน้า counter` ไม่ต้องแสดง/กรอกข้อมูลธนาคาร. ไม่กรอกเลขบัญชีที่โอนเข้าใน section ผู้จ่าย เพราะเลขบัญชีรับเงินเข้าบริษัทต้องมาจาก `บัญชีบริษัทที่รับเงิน`

### บัญชีบริษัทที่รับเงิน

- Section `บัญชีบริษัทที่รับเงิน`: บังคับเลือกทุกครั้งสำหรับ `DIRECTOR_LOAN`; ดึงจากบัญชีบริษัทใน `accounts`; เลือกได้โดยไม่ต้องรอผู้จ่าย/ประเภทเงินกู้
- option ของ `บัญชีบริษัทที่รับเงิน` ต้องแสดงยอดเงินคงเหลือปัจจุบันของบัญชีจาก `accounts` + `bank_statement`
- เมื่อเป็น `ในระบบ` รายการ `บัญชีบริษัทที่รับเงิน` ต้อง filter บัญชีที่เลือกเป็น `บัญชีที่กู้` ออก เพื่อกันเงินเข้า/ออกในบัญชีเดียวกันจน cash position เพี้ยน

### หมายเหตุ

- `หมายเหตุ` เป็น textarea ธรรมดาท้าย form ไม่ต้องมีกรอบ section แยก เพราะเป็นข้อมูลประกอบ

### System Fields

- ไม่แสดงเลข `PADV`; server ออกเลขเอง
- ไม่ให้พิมพ์บัญชีเองสำหรับบัญชีที่อยู่ในระบบ ต้องเลือกจาก master เท่านั้น
- `DIRECTOR_LOAN` create/edit ต้องสร้าง/ปรับผลกระทบ `bank_statement` ตามบัญชีที่เลือก
- `PETTY_CASH` ยังต้องยึด flow เงินสำรองจ่ายเดิมจนกว่าจะมี decision แยก
- ผู้รับเงินต้องเลือกจาก combobox ของรายชื่อ active ในข้อมูลหลักพนักงาน/กรรมการ และต้องมีบัญชีรับเงินครบตอนบันทึก
- ต้อง snapshot ชื่อผู้รับเงิน ธนาคาร ชื่อบัญชี เลขบัญชี และสาขา ลง `petty_advances`

## Detail Modal Contract

Detail modal เปิดด้วยการ click row และต้องแบ่ง section ชัดเจน:

- `สรุปยอดเงิน`: ยอดยืม, คืนแล้ว, คงค้าง, badge สถานะ
- `ข้อมูลเอกสาร`: เลขที่เอกสาร, ประเภท, วันที่กู้ยืม/สำรองจ่าย, วันที่สร้างรายการพร้อมเวลา, ผู้สร้างรายการ
- `ผู้จ่ายและข้อมูลเงินกู้`: ผู้รับเงิน, บัญชีรับเงิน snapshot, ประเภทเงินกู้, บัญชีต้นทางนอกระบบถ้ามี
- `บัญชีบริษัทและหมายเหตุ`: บัญชีบริษัทที่รับเงิน, หมายเหตุ

## Payment Approval Contract

หลังสร้าง `PADV` สำเร็จ รายการต้องไปแสดงที่ `/daily/payment-approval` ทันทีในแท็บ `เงินสำรองจ่าย / กู้กรรมการ`.

กฎสำคัญ:

- หน้า Petty Advance ไม่มีปุ่ม/โมดอล `คืนเงิน` เป็นขั้นตอนส่งคิวอีกต่อไป
- Runtime endpoint เก่า `POST /api/daily/petty-advances/returns` ต้องไม่สร้าง `PRET` ใหม่ และต้อง reject เพื่อบังคับใช้ flow `PADV -> Payment Approval -> PMA/PMT`
- `GET /api/daily/payment-approval` ต้องอ่าน `petty_advances` โดยตรงเป็น pending source
- `POST /api/daily/payment-approval` ต้องสร้าง `payment_approvals.source_type = petty_advance`
- ผู้ใช้เลือกบัญชีรับเงินของกรรมการ/ผู้ให้กู้ และยอดอนุมัติที่หน้า Payment Approval; option ต้องมาจาก `director_employee_bank_accounts` ของ `petty_advances.recipient_person_code` ไม่ใช่บัญชีบริษัทใน `accounts`
- หน้า Payment Approval ต้องเปิดคิว `PADV` ได้ตรงด้วย `?tab=pettyAdvance&search=<PADV doc no>` เพื่อให้ผู้ใช้ตรวจรายการหลังสร้างได้ทันที
- หน้า Payment Approval ในแท็บ `เงินสำรองจ่าย / กู้กรรมการ` ต้องแสดงทั้ง `วันที่กู้ยืม/สำรองจ่าย` จาก `petty_advances.date` และ `วันที่สร้างรายการ` จาก `petty_advances.created_at` แยกกัน; ห้ามใช้ label `ครบกำหนด` กับ `PADV` เพราะยังไม่มี due-date คืนเงินใน flow นี้
- การจ่ายเงินจริงเกิดใน payment flow ถัดไป ไม่สร้าง `petty_advance_returns` เป็น fallback
- Admin/ledger read models ต้องไม่ resolve `PRET` / `petty_advance_returns` เป็น source fallback ของ flow ใหม่; historical rows ต้องแยกตัดสินใจ data repair
- ถ้า PMA ของ `PADV` ถูกจ่ายจริงแบบ split หลายรายการ ระบบต้องสะสมยอดต่อ `PADV` แล้วอัปเดต `petty_advances.returned_amount/status` ให้หน้า `/daily/petty-advance` เห็นยอดคืนแล้วและคงค้างทันที
- บัญชีบริษัทที่กระทบจริงตอนเงินออกต้องมาจาก split ของ `PMT` ใน payment flow ถัดไป; `bank_statement` ต้องถูกสร้างตามบัญชีบริษัทที่จ่ายเงินจริง เพื่อให้ cash position เปลี่ยนตาม source of truth เดียวกัน

## Director Loan Create Behavior

- `loanSourceType = IN_SYSTEM`: ต้องเลือก `loanFromAccountId` จาก `accounts.code` ที่เลขบัญชีตรงกับกรรมการที่เลือก และต้องเลือก `receiveAccountId` เป็นบัญชีบริษัทที่รับเงินเข้า
- `loanSourceType = OUTSIDE_SYSTEM`: ไม่เลือกบัญชีกรรมการใน `accounts`; ต้องเลือกวิธีรับเงินนอกระบบ และเลือก `receiveAccountId` ของบัญชีบริษัท. ถ้าวิธีรับเงินเป็น `โอนเงินผ่านบัญชี` ต้องเลือกธนาคารต้นทางจาก `bank_names` และกรอกชื่อบัญชีต้นทางที่โอนเข้า
- เมื่อบันทึก `DIRECTOR_LOAN` ระบบเขียน `bank_statement.ref_type = PADV`
- `IN_SYSTEM` สร้าง 1 row เงินออกจากบัญชีกรรมการในระบบ และ 1 row เงินเข้าบัญชีบริษัท
- `OUTSIDE_SYSTEM` สร้าง 1 row เงินเข้าบัญชีบริษัทเท่านั้น
- เมื่อแก้ `PADV` ระบบลบและสร้าง `PADV` bank statement rows ใหม่ตามบัญชีล่าสุด เพื่อไม่ให้ cash position ซ้ำ

## API Contract

`GET /api/daily/petty-advances` ส่ง:

- `rows`
- `accounts`
- `bankNames` จาก active rows ของ `/master-data/bank-names` สำหรับ dropdown ธนาคารที่โอนเข้าในเคส `OUTSIDE_SYSTEM`
- `recipientOptions`
- `directorLoanSourceAccounts` หรือ equivalent options สำหรับบัญชีกรรมการที่ match บัญชี active ทุกบัญชีของกรรมการใน `director_employee_bank_accounts` กับ `accounts.account_no`
- `companyReceiveAccounts` หรือ equivalent options สำหรับบัญชีบริษัทที่รับเงินกู้

`POST /api/daily/petty-advances` รับ:

- `id`
- `docNo`
- `date`
- `type`
- `recipientId`
- `recipientName`
- `loanSourceType` สำหรับ `DIRECTOR_LOAN`: `IN_SYSTEM` / `OUTSIDE_SYSTEM`
- `loanFromAccountId` สำหรับ `DIRECTOR_LOAN + IN_SYSTEM`
- `receiveAccountId` สำหรับ `DIRECTOR_LOAN`
- `amount`
- `status`
- `notes`
- `outsideLoanTransferMethod` สำหรับ `DIRECTOR_LOAN + OUTSIDE_SYSTEM`: `COUNTER_DEPOSIT` / `BANK_TRANSFER`
- `outsideLoanFromBankName`, `outsideLoanFromAccountName`, `outsideLoanFromBankBranch` สำหรับ `DIRECTOR_LOAN + OUTSIDE_SYSTEM + BANK_TRANSFER`; บังคับธนาคารและชื่อบัญชี โดยธนาคารต้องเลือกจาก `bank_names.active = true`

`GET /api/daily/payment-approval` ต้องส่ง:

- `pettyAdvanceRows` จาก `petty_advances`

`POST /api/daily/payment-approval` รับ `sourceType = petty_advance`.

## Business Rules

- `PADV` เป็นเอกสารยอดค้างของ advance/loan.
- `DIRECTOR_LOAN` ต้องมีข้อมูลบัญชีรับเงินกู้ของบริษัทครบ เพื่อให้ payment/cash flow ต่อได้ถูกต้อง
- `PADV` ต้องเข้า Payment Approval โดยตรง ไม่สร้าง `PRET` และไม่อ่าน `petty_advance_returns` เป็น fallback
- `petty_advance_returns` / `PRET` ที่มีอยู่เดิมถือเป็น historical/data-repair material เท่านั้น ไม่ใช่ active runtime path หรือ admin ledger fallback
- ผู้รับเงินต้องมาจาก `director_employees.code`, ไม่ใช้ free-text
- รายชื่อ option ต้องมาจาก active rows ทั้งหมดของ `/master-data/directors` ไม่กรองตาม type
- บัญชีที่รับเงินกู้ของบริษัทต้องเลือกจาก `accounts` ทุกครั้งสำหรับ `DIRECTOR_LOAN`
- กรณี `IN_SYSTEM` บัญชีที่กู้ต้องเลือกจาก `accounts` ที่เลขบัญชีตรงกับบัญชีกรรมการ และต้องไม่ซ้ำกับบัญชีบริษัทที่รับเงิน
- กรณี `OUTSIDE_SYSTEM` ห้ามบังคับให้มีบัญชีกรรมการใน `accounts`; ต้องเก็บวิธีรับเงินนอกระบบเป็น snapshot. ถ้าเป็น `BANK_TRANSFER` ให้เก็บธนาคารและชื่อบัญชีเป็น snapshot/metadata เพื่อ track แหล่งเงินนอกระบบ โดยธนาคารต้องเลือกจาก master `bank_names` และชื่อบัญชีต้องกรอก ส่วนสาขาเป็น optional. ถ้าเป็น `COUNTER_DEPOSIT` ห้ามบังคับหรือ snapshot ธนาคาร/ชื่อบัญชี. เลขบัญชีบริษัทที่รับเงินต้องมาจาก section `บัญชีบริษัทที่รับเงิน`
- ถ้าข้อมูลบัญชีผู้รับเงินใน master เปลี่ยน ประวัติ `PADV` ต้องไม่เปลี่ยน เพราะมี snapshot
- ยอดที่อนุมัติ/จ่ายรวมต้องไม่เกินยอด `PADV`
- Filter สถานะต้องมี `ทั้งหมด`, `รอคืนเงิน`, `คืนแล้วบางส่วน`, `คืนแล้ว`, `ยกเลิก`; `คืนแล้วบางส่วน` derive จาก `status = active` และ `returned_amount > 0`
- Detail modal ต้องแบ่ง section ชัดเจน: สรุปยอดเงิน, ข้อมูลเอกสาร, ผู้จ่ายและข้อมูลเงินกู้, บัญชีบริษัทและหมายเหตุ
- ยกเลิกได้เฉพาะรายการ `active` ที่ยังไม่มี PMA/PMT และยังไม่มีการคืนแล้วบางส่วนหรือทั้งหมด

## Cancel Rules

- ปุ่ม `ยกเลิก` ใช้ได้เฉพาะ `PADV.status = active`
- ถ้ามี `returned_amount > 0` หรือเกิด `PMA/PMT` แล้ว ห้ามยกเลิก
- เมื่อยกเลิกได้ ระบบตั้ง `status = cancelled` และลบ `bank_statement.ref_type = PADV` ของรายการนั้น
- หน้า list ต้อง disabled ปุ่มยกเลิกพร้อมเหตุผลเมื่อรายการถูก lock

## Current Implementation / Gap

- มี create/edit baseline และ target ใหม่ส่งเข้า Payment Approval โดยตรง
- Current code รองรับ `loanSourceType`, `loanFromAccountId`, `receiveAccountId` สำหรับ `DIRECTOR_LOAN` แล้ว.
- Current code สร้าง `BST` จาก `PADV` สำหรับ `DIRECTOR_LOAN` ตามบัญชีที่เลือกแล้ว.
- Current code รองรับ pagination, sort, filter ช่วงวันที่กู้ยืม/สำรองจ่าย, column ผู้สร้างรายการ, click row เพื่อเปิด detail, และ cancel lock ตามเงื่อนไข PMA/PMT/ยอดคืนแล้ว. `วันที่กู้ยืม/สำรองจ่าย` เป็น date ธรรมดา ส่วน `วันที่สร้างรายการ` ใช้ `created_at` timestamp สำหรับ audit.
- Current code ตัด column `ใช้ไปแล้ว` ออกจาก list/detail แล้ว เพราะยังไม่มี expense allocation flow ที่เป็น source of truth.
- ยังไม่มี dedicated `petty_advance_status_logs`
- ต้องออกแบบ cancel/reverse และ expense allocation
- ต้องยืนยัน server-side block ยอดอนุมัติ/จ่ายเกินยอดคงเหลือ

## Related Notes

- [[Daily Cash Flow]]
- [[Finance Bank Statement Page Flow]]
- [[Document Timeline Policy]]
