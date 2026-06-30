---
title: เงินสำรองจ่าย / กู้กรรมการ Page Flow
tags:
  - page-flow
  - menu
  - finance-debt
  - petty-advance
status: implemented-target
updated: 2026-06-26
route: /daily/petty-advance
---

# เงินสำรองจ่าย / กู้กรรมการ Page Flow

## Scope

| Field | Value |
|---|---|
| Menu section | Finance & Debt |
| Route | `/daily/petty-advance` |
| Page | เงินสำรองจ่าย / กู้กรรมการ |
| Current Next | accepted code baseline |

## Canonical References

[[Finance Debt Flow]], [[Petty Advance Page Flow]], [[Daily Cash Flow]], [[Finance Bank Statement Page Flow]]

## Page Purpose

หน้านี้ใช้สร้างและติดตามเงินที่บริษัทให้กรรมการ/พนักงานยืม, เงินสำรองจ่ายที่ต้องเคลียร์คืนภายหลัง, และเงินกู้กรรมการที่บริษัทรับเงินเข้า. เอกสารหลักคือ `PADV` เป็นยอดคงค้างและเป็น source เข้า Payment Approval โดยตรง.

Target ที่ยืนยันล่าสุดสำหรับ `DIRECTOR_LOAN`: `PADV` ต้องบันทึกเงินเข้าบัญชีบริษัทและทำให้ cash position ของบริษัทเพิ่มเสมอ. ถ้าเป็นเงินกู้ `ในระบบ` ต้องเห็น movement ฝั่งบัญชีกรรมการใน `accounts` ด้วย; ถ้าเป็น `นอกระบบ` ให้เห็นเฉพาะบัญชีบริษัท เพราะบัญชีกรรมการอยู่นอก master `accounts`.

## Legacy Baseline

Legacy `view-pettyAdvance` มี:

- เลขเอกสาร `PADV`
- วันที่
- ประเภท `DIRECTOR_LOAN` / `PETTY_CASH`
- ผู้รับเงิน
- จำนวนเงิน
- ประเภทเงินกู้กรรมการ: `บัญชีในระบบ` / `บัญชีนอกระบบ`
- บัญชีที่กู้ กรณีในระบบ
- บัญชีบริษัทที่รับเงินกู้
- Modal ต้องบังคับลำดับการเลือกสำหรับแหล่งเงินกู้: ผู้จ่าย/กรรมการ -> ประเภทเงินกู้ -> บัญชีที่กู้/บัญชีต้นทางนอกระบบ; บัญชีบริษัทที่รับเงินเลือกได้ทันทีและต้อง filter บัญชีที่กู้ออกเมื่อเป็น `ในระบบ`
- status `active`, `closed`, `cancelled`
- ค้นหา, filter type/status
- detail แสดงค่าใช้จ่าย/approval/payment facts ที่ link กับ advance

ความต่างของ target จาก legacy ต้องแยกตามประเภท: `PETTY_CASH` ยังเป็นรายการยอดค้าง/สำรองจ่ายที่ไม่ควรถูกสรุปปนกับเงินกู้กรรมการ; `DIRECTOR_LOAN` ต้องสร้าง bank/cash movement เพราะบริษัทรับเงินกู้เข้าเงินจริง.

## Page Responsibilities

- แสดงรายการ `PADV` พร้อมยอดยืม, คืนแล้ว, คงเหลือ, สถานะ และ audit fields
- สร้าง/แก้ `PADV` ด้วยผู้จ่าย/ผู้รับเงินจาก master `director_employees` ชุดเดียวกับ `/master-data/directors`
- แยกเงินกู้กรรมการเป็น `ในระบบ` และ `นอกระบบ`
- สำหรับ `DIRECTOR_LOAN` ต้องเลือกบัญชีบริษัทที่รับเงินกู้ทุกครั้ง
- สำหรับ `DIRECTOR_LOAN + ในระบบ` ต้องเลือกบัญชีกรรมการจาก `accounts` ที่ match กับบัญชี active ใน master กรรมการ (`director_employee_bank_accounts`)
- snapshot ชื่อผู้รับเงินและบัญชีรับเงินลงเอกสาร
- ส่ง `PADV` เข้า `/daily/payment-approval` ทันทีหลังสร้าง
- ปิดสถานะเป็น `closed` เมื่อยอดจ่าย/คืนสะสมเท่ากับยอด `PADV`
- แสดง detail ของ approval/payment history ต่อเอกสาร

## Non-Responsibilities

- ไม่ใช่หน้า `EXP` และไม่สร้างค่าใช้จ่ายทันที
- ไม่สร้าง `PMA` / `PMT`
- ไม่ให้กรอกบัญชีเงินเองแบบ free-text เมื่อบัญชีนั้นควรมาจาก master `accounts`
- ไม่รับผู้รับเงินแบบ free-text
- ไม่แก้ `bank_statement` ตรงจากหน้านี้

## Lifecycle / Operation Flow

| Step | User action | System result |
|---|---|---|
| 1 | เปิดหน้า | โหลด `PADV` rows, accounts, recipient options; account details ของผู้จ่ายโหลดแยกเมื่อเลือกผู้จ่าย |
| 2 | สร้าง `PADV` เงินสำรองจ่าย | server ออกเลข `PADV`, validate recipient, snapshot bank fields, save outstanding |
| 3 | สร้าง `PADV` กู้กรรมการในระบบ | validate กรรมการ, บัญชีที่กู้, บัญชีที่รับ; สร้างเงินออกจากบัญชีกรรมการและเงินเข้าบัญชีบริษัท |
| 4 | สร้าง `PADV` กู้กรรมการนอกระบบ | validate กรรมการและบัญชีบริษัทที่รับเงิน; สร้างเงินเข้าเฉพาะบัญชีบริษัท |
| 5 | แก้ `PADV` | update header/snapshot/cash movement ถ้ายังไม่ถูก lock ตาม status |
| 6 | เปิด Payment Approval | เห็น `PADV` ในแท็บเงินสำรองจ่าย / กู้กรรมการทันที |
| 7 | อนุมัติ | สร้าง `payment_approvals.source_type = petty_advance`; ผู้ใช้เลือกบัญชีและยอดที่หน้าอนุมัติ |
| 8 | จ่ายจริง | `PMT`/payment flow สะสมยอดชำระต่อ `PADV`, ลดหนี้คงค้าง, และสร้าง cash movement ตามบัญชี split |
| 9 | จ่ายครบ | status `closed`, future edit/cancel ต้องถูก lock ตาม policy |

## Current API

| Method | API | Current behavior |
|---|---|---|
| `GET` | `/api/daily/petty-advances` | โหลด `accounts`, `recipientOptions`, `rows` จาก `petty_advances`; sort by date/created_at |
| `POST` | `/api/daily/petty-advances` | create/update `PADV`; resolve recipient by `director_employees.code`; write/rewrite `bank_statement.ref_type = PADV` for `DIRECTOR_LOAN` money received |
| `GET` | `/api/daily/payment-approval` | target reads `petty_advances` directly as `pettyAdvanceRows`; no PRET fallback |
| `POST` | `/api/daily/payment-approval` | target creates `payment_approvals.source_type = petty_advance` |
| `POST` | `/api/daily/petty-advances/returns` | disabled in runtime; returns `410` so no new `PRET` can be created |

Permission ปัจจุบัน: `finance.cash.view`.

## Data Contract

- Outward id ของ advance คือ `petty_advances.doc_no`.
- Recipient option id คือ `director_employees.code`.
- Recipient option ต้องมาจาก active rows ทั้งหมดของ `/master-data/directors`; ไม่กรองตาม type.
- Recipient save validation must resolve the selected active person and snapshot receiving-account fields; option list itself should not expose bank details.
- Runtime schema มี field สำหรับ `loan_source_type`, `loan_from_account_id`, `receive_account_id`, และ account snapshots ของบัญชีที่เกี่ยวข้อง.
- `loan_source_type = IN_SYSTEM` หมายถึงบัญชีกรรมการอยู่ใน `accounts` และต้อง link ด้วย account id/code จากบัญชี active ของกรรมการ.
- `loan_source_type = OUTSIDE_SYSTEM` หมายถึงบัญชีกรรมการอยู่นอก `accounts`; ต้องเก็บ snapshot บัญชีต้นทางที่โอนเข้าเพื่อ track หนี้และดูประวัติ แต่ไม่สร้าง cash position ฝั่งกรรมการ.
- `receive_account_id` คือบัญชีบริษัทที่รับเงินกู้ และต้องถูกใช้สร้าง cash position เงินเข้าทุกครั้งสำหรับ `DIRECTOR_LOAN`.
- Account selectors for `บัญชีที่กู้` and `บัญชีบริษัทที่รับเงิน` must show current account balance from `accounts.opening_balance + bank_statement amount_in/out`.
- `petty_advances.account_id` ปัจจุบันไม่พอสำหรับ target ใหม่ ต้องไม่ reuse แบบคลุมเครือโดยไม่มี migration/contract ชัดเจน.
- `PADV` director-loan save writes `bank_statement.ref_type = PADV`; edit recreates those PADV statement rows from the latest selected accounts.
- Payment Approval source type for this flow is `petty_advance` only.
- Do not use `petty_advance_return` / `PRET` as a compatibility path, including admin/ledger read-model fallback.

## Validation / Status Rules

- `date`, `type`, `recipientId`, `amount` required.
- `amount > 0`.
- ผู้รับเงินต้องอยู่ในรายชื่อ active จากข้อมูลหลักพนักงาน/กรรมการ และมีบัญชีรับเงินครบ.
- ถ้า `type = DIRECTOR_LOAN` ต้องเลือก `loanSourceType` และ `receiveAccountId`.
- ถ้า `loanSourceType = IN_SYSTEM` ต้องเลือก `loanFromAccountId`, บัญชีกรรมการต้อง match กับ master กรรมการ, และต้องไม่ซ้ำกับ `receiveAccountId`; UI ต้อง filter บัญชีที่กู้ออกจากตัวเลือกบัญชีบริษัทที่รับเงิน.
- ถ้า `loanSourceType = OUTSIDE_SYSTEM` ห้ามบังคับบัญชีกรรมการให้มีใน `accounts`; ต้องกรอกธนาคารและเลขบัญชีที่โอนเข้า ส่วนชื่อบัญชีและสาขาเป็น optional.
- ยอดอนุมัติ/จ่ายสะสมจาก Payment Approval/Payment ต้องไม่เกินยอดคงเหลือของ `PADV`.
- DB status หลักคือ `active` = ยังมียอดคงเหลือ, `closed` = คืนครบ, `cancelled` = ยกเลิก.
- หน้า list/filter ต้องแสดง status เป็น `รอคืนเงิน`, `คืนแล้วบางส่วน`, `คืนแล้ว`, `ยกเลิก`; `คืนแล้วบางส่วน` เป็น UI-derived status เมื่อ `status = active`, `returned_amount > 0`, และยังมียอดคงค้าง ไม่ต้องเก็บเป็น DB status แยก.
- Future cancel/reverse ต้องเป็น append-only และไม่ลบ source facts เงียบ ๆ.

## Side Effects

- `DIRECTOR_LOAN PADV create/edit`: ต้องสร้าง/ปรับ `bank_statement` เพื่อให้บัญชีบริษัทเพิ่มตามเงินกู้เข้า.
- `DIRECTOR_LOAN + IN_SYSTEM`: ต้องมี movement ฝั่งบัญชีกรรมการในระบบด้วย.
- `DIRECTOR_LOAN + OUTSIDE_SYSTEM`: ไม่สร้าง movement ฝั่งบัญชีกรรมการ เพราะบัญชีอยู่นอก `accounts`.
- `DIRECTOR_LOAN + OUTSIDE_SYSTEM`: เก็บ snapshot บัญชีต้นทางที่โอนเข้าใน `petty_advances` เพื่อดูประวัติย้อนหลัง.
- Payment flow after approval creates movement and reduces `petty_advances.returned_amount/status`.
- ไม่มี stock/AP/AR/GL side effect จากหน้านี้.

## UI / Table Contract

ควรแสดงอย่างน้อย:

- เลขที่เอกสาร
- วันที่กู้ยืม/สำรองจ่าย
- ประเภท
- ผู้รับเงิน
- ยอดยืม
- คืนแล้ว
- คงเหลือ
- สถานะ
- ผู้สร้างรายการ
- วันที่สร้างรายการ
- Action: ไม่มีปุ่มดู; click row เพื่อเปิด detail modal
- Action: แก้ตาม lock และยกเลิกได้เฉพาะรายการที่ยังไม่มี PMA/PMT และยังไม่มียอดคืนแล้ว

Filter:

- search จากเลขเอกสาร/ผู้รับเงิน/หมายเหตุ
- date range จากวันที่กู้ยืม/สำรองจ่าย
- segmented ประเภท
- segmented สถานะ: `ทั้งหมด`, `รอคืนเงิน`, `คืนแล้วบางส่วน`, `คืนแล้ว`, `ยกเลิก`
- segmented สถานะ แยกบรรทัดตาม design

Create/edit modal:

- หัว modal create ใช้ `สร้างรายการกู้ยืม/สำรองจ่าย`
- Section หลักคือ `ข้อมูลการกู้ยืม/สำรองจ่าย`, `ผู้จ่ายและข้อมูลเงินกู้กรรมการ`, `บัญชีบริษัทที่รับเงิน`
- `หมายเหตุ` เป็น field ธรรมดาท้าย form ไม่ต้องมีกรอบ section
- `บัญชีบริษัทที่รับเงิน` เลือกได้ทันที ไม่ต้องรอเลือกผู้จ่าย/ประเภทเงินกู้
- กรณี `บัญชีในระบบ` ตัวเลือก `บัญชีบริษัทที่รับเงิน` ต้องตัด `บัญชีที่กู้` ออก และ clear ค่าเดิมถ้าเคยเลือกซ้ำกัน

Detail modal:

- เปิดด้วย click row ไม่มีปุ่ม `ดู`
- แบ่ง section: `สรุปยอดเงิน`, `ข้อมูลเอกสาร`, `ผู้จ่ายและข้อมูลเงินกู้`, `บัญชีบริษัทและหมายเหตุ`

## Current Code Baseline

- Current `apps/next` page/API code is accepted as the implementation baseline as of 2026-06-26.
- Target update 2026-06-26 implemented in code: `ในระบบ/นอกระบบ`, บัญชีที่กู้, บัญชีที่รับ, `PADV` cash movement สำหรับกู้กรรมการ, status filter ชุดใหม่, sectioned create/detail modals, and no-return-button approval handoff.
- Current code ตัด column `ใช้ไปแล้ว` ออกจาก list/detail แล้ว เพราะยังไม่มี expense allocation flow ที่เป็น source of truth.
- Current API expose `created_at`/`created_by` ใน row payload สำหรับ list/detail แล้ว.

## Current Gap

- Expense allocation/clearing กับ `EXP` ยังไม่สมบูรณ์.
- ต้องเพิ่ม `petty_advance_status_logs` หรือ equivalent timeline.
- ต้องกำหนด cancel/reverse policy ให้ชัดก่อนเปิดใช้งานจริง.

## Implementation Checklist

- [x] Verify current Next page/component against this page-flow
- [x] Verify API route handlers match Current API and status rules above
- [x] Capture legacy baseline and target difference
- [x] Add created-at to list/detail contract
- [x] Align list columns, status filter, and sectioned detail modal with latest confirmed UI
- [ ] Design expense allocation/clearing
- [ ] Design append-only cancel/reverse/status logs
