---
title: Daily Cash Flow
aliases:
  - Daily Cash Flow
  - Daily Transfer Flow
  - โอนเงินระหว่างบัญชี
tags:
  - ns-scrap-erp
  - daily
  - cash-bank
  - business-flow
status: draft
created: 2026-06-08
updated: 2026-06-08
---

# Daily Cash Flow / เงินสดธนาคารรายวัน

เอกสารนี้เป็น target flow สำหรับรายการเงินสด/ธนาคารที่อยู่ในกลุ่ม `รายการประจำวัน` และมีผลต่อ `bank_statement` โดยตรง เช่น โอนเงินระหว่างบัญชี, ค่าใช้จ่าย, เงินสำรองจ่าย, และรายการคืนเงินสำรองจ่าย

## ขอบเขตปัจจุบัน

| Flow | Route | สถานะ |
|---|---|---|
| โอนเงินระหว่างบัญชี | `/daily/transfer` | implemented partial write |
| ค่าใช้จ่าย | `/daily/expense` | implemented with approval/payment flow integration |
| เงินสำรองจ่าย | `/daily/petty-advance` | implemented baseline |

## Flow โอนเงินระหว่างบัญชี

ใช้เมื่อย้ายเงินภายในบริษัทจากบัญชีหนึ่งไปอีกบัญชีหนึ่ง เช่น เงินสดเข้าธนาคาร, ธนาคารหนึ่งไปอีกธนาคารหนึ่ง, หรือย้ายเงินระหว่างบัญชีบริษัท

| ขั้นตอน | ผู้ใช้ทำอะไร | ผู้ใช้กรอกอะไร | ระบบออก/บันทึกอะไร | ผลกระทบ |
|---|---|---|---|---|
| 1 | เปิดหน้าโอนเงิน | ค้นหา/กรองรายการเดิมถ้าต้องการ | ไม่มี | แสดงรายการโอนพร้อมบัญชีต้นทาง/ปลายทาง, ยอด, ค่าธรรมเนียม, ผู้ทำรายการ |
| 2 | กด `+ โอนใหม่` | ไม่มี | เปิด modal สร้างรายการ | modal ไม่แสดง field ที่ระบบจัดการเอง |
| 3 | กรอกข้อมูลการโอน | `บัญชีต้นทาง`, `บัญชีปลายทาง`, `จำนวนเงิน`, `ค่าธรรมเนียม`, `หมายเหตุ` | ยังไม่บันทึก | client validate field required/money/account pair; ตัวเลือกบัญชีต้นทาง/ปลายทางใน modal แสดงยอดคงเหลือปัจจุบันใน label; ช่องเงินใช้ money input pattern และ `หมายเหตุ` ใช้ textarea |
| 4 | บันทึก | ไม่มีเพิ่มเติม | สร้าง `TRF{YYMM}-NNNN` หรือ running doc no ตาม write path ปัจจุบัน | สร้างแถว `transfers` |
| 5 | ระบบลง bank statement | ไม่มี | สร้าง `BST...` 2 แถว: เงินออกจากบัญชีต้นทาง และเงินเข้าบัญชีปลายทาง | cash/bank ledger เห็น movement ทั้งสองฝั่ง |
| 6 | ผู้ใช้ดูรายการ | filter/search/pagination ในหน้า list | ไม่มี | table แสดง `เลขที่`, `วันที่`, `จาก`, `เข้า`, `จำนวน`, `ค่าธรรมเนียม`, `ผู้ทำรายการ` |

## System-Managed Fields

กติกาหน้า `/daily/transfer`:

- `เลขที่` เป็น system-generated document number ไม่แสดงเป็นช่องกรอกใน modal
- `วันที่` เป็น auto date ใน payload/write path ปัจจุบัน ไม่ให้ผู้ใช้แก้ใน modal
- `ผู้ทำรายการ` มาจาก authenticated actor และบันทึกใน `transfers.created_by`
- `ผู้ทำรายการ` ที่แสดงในตารางต้องอ่านจากข้อมูลที่ระบบบันทึกไว้ ไม่รับค่าจาก form
- การแก้ไขรายการเดิมยังคงอ้างเอกสารด้วย outward `doc_no` ตาม DB-first identifier contract

## Validation Rules

| Field | Rule |
|---|---|
| `บัญชีต้นทาง` | required, ต้องเป็น active account option |
| `บัญชีปลายทาง` | required, ต้องเป็น active account option และต้องไม่ซ้ำกับบัญชีต้นทาง |
| `จำนวนเงิน` | required, มากกว่า 0; ใช้ money input pattern (`type="text"` + `inputMode="decimal"`, draft ตอน focus, format ตอน blur) |
| `ค่าธรรมเนียม` | optional, ต้องไม่ติดลบ; ใช้ money input pattern เดียวกับ `จำนวนเงิน` |
| `หมายเหตุ` | optional, ใช้ textarea ตาม Remark / Note Field Pattern และข้อความทั่วไปที่ไม่มี control characters |

หลัง submit ไม่ผ่าน ต้องแสดง field error ที่ช่องจริงและ focus ไปยัง field แรกที่ผิดตาม `docs/design.md`

## Bank Statement Contract

การบันทึก transfer ต้องเกิดใน transaction เดียวกับการสร้าง paired bank statement rows:

- row เงินออก: อ้าง `ref_type = TRF`, `ref_id = transfers.id`, `doc_no = BST...`, account = บัญชีต้นทาง
- row เงินเข้า: อ้าง `ref_type = TRF`, `ref_id = transfers.id`, `doc_no = BST...`, account = บัญชีปลายทาง
- ค่าธรรมเนียมต้องสะท้อนเป็น cash-out side effect ของบัญชีต้นทางตาม `bankStatementTransferRows`

## Open Follow-ups

- ยังไม่มี reviewed `DELETE` / cancel / reversal flow สำหรับ transfer; ปุ่มลบจึงยัง disabled
- ยังขาด dedicated `transfer_status_logs` ตาม `Document Timeline Policy`
- ก่อนเปิด cancel/reversal ต้องออกแบบผลกระทบกลับ `bank_statement` แบบ append-only ไม่ลบ row เงินเดิมเงียบ ๆ
