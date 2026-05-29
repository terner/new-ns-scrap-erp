---
title: Payment Flow
aliases:
  - Flow จ่ายเงิน
  - Approval and Payment Flow
  - Supplier Payment Flow
  - อนุมัติจ่ายเงิน
tags:
  - ns-scrap-erp
  - payment
  - approval
  - finance
  - business-flow
status: draft
created: 2026-05-28
updated: 2026-05-28
---

# Payment Flow / Flow จ่ายเงิน

เอกสารนี้เป็น canonical flow สำหรับ `อนุมัติจ่ายเงิน`, `รอจ่าย`, `ทำจ่าย`, `จ่ายเงินล่วงหน้า / มัดจำ`, `ประวัติการจ่ายเงิน`, และ `คืนเงินมัดจำ/คืนเงินล่วงหน้า` ฝั่ง Supplier

เอกสารที่เกี่ยวข้อง:

- [[Purchase Flow]] สำหรับต้นน้ำฝั่งซื้อ เช่น `PO Buy`, `WTI`, `Purchase Bill`, และ allocation มัดจำเข้าบิล
- [[Sales Flow]] สำหรับฝั่งรับเงิน/ลูกค้า

## ขอบเขตของเอกสารนี้

flow นี้ต้องรองรับ source document อย่างน้อย:

- `บิลรับซื้อ`
- `จ่ายเงินล่วงหน้า / มัดจำ`
- `ค่าใช้จ่าย`

queue กลางของงานนี้ใน target system ต้องใช้ชื่อ `อนุมัติจ่ายเงิน`

## เอกสารหลัก

| เอกสาร | ใช้ทำอะไร | เลขเอกสาร |
|---|---|---|
| `PMA` | approval snapshot ของรายการจ่าย | `PMA{branchCode}{YYMM}-NNNN` |
| `PMT` | payment snapshot / ใบจ่ายเงินจริง | `PMT{branchCode}{YYMM}-NNNN` |
| `ADV` | จ่ายเงินล่วงหน้า / มัดจำ | `ADV{branchCode}{YYMM}-NNNN` หรือเลขที่จะกำหนดต่อ |

กติกา:

- `payment_approvals` เป็น snapshot table
- `1 approval cycle = 1 PMA ใหม่`
- ถ้า approval ถูกยกเลิก ต้องเก็บ row เดิมไว้เป็นประวัติ
- ถ้าอนุมัติใหม่ ต้องสร้าง `PMA` ใหม่ ไม่ reuse เลขเดิม

## Lifecycle ของรายการจ่าย

รายการจ่ายต้องถูกมองเป็น lifecycle เดียว:

1. `ยังไม่อนุมัติ`
2. `รอจ่าย`
3. `เสร็จสิ้น`
4. `ยกเลิกแล้ว`

ความหมาย:

- `ยังไม่อนุมัติ`
  - อยู่ใน queue `/daily/payment-approval`
  - ยังเป็น live data จาก source document
- `รอจ่าย`
  - มี `payment_approvals.status='approved'`
  - อยู่ใน `/purchase/payments`
- `เสร็จสิ้น`
  - มี `PMT`
  - อยู่ใน `/purchase/payment-history`
- `ยกเลิกแล้ว`
  - approval snapshot หรือ payment snapshot รอบนั้นถูกยกเลิก
  - อยู่ใน `/purchase/payment-history`

## Queue และหน้าจอ

| หน้า | หน้าที่ | ลักษณะข้อมูล |
|---|---|---|
| `/daily/payment-approval` | queue `อนุมัติจ่ายเงิน` | live pending rows + approved snapshot rows |
| `/purchase/payments` | queue `รอจ่าย` | approval-item queue |
| `/purchase/payment-history` | ประวัติการจ่ายเงิน | read-only snapshot |

กติกา:

- `/daily/payment-approval`
  - pending rows ต้องอ่านจาก source document ปัจจุบัน
  - approved rows ต้องอ่านจาก snapshot
- `/purchase/payments`
  - ต้องอ่านจาก `payment_approvals.status='approved'` เท่านั้น
  - ต้องทำงานระดับ `approval item`
- `/purchase/payment-history`
  - read-only
  - แสดงอย่างน้อย `เสร็จสิ้น` และ `ยกเลิกแล้ว`
  - downstream accounting/report/bank posting ใช้เฉพาะ `เสร็จสิ้น`

## Approval Item Model

approval ต้องไม่ยึด `1 เอกสาร = 1 แถว` อย่างเดียวอีกต่อไป

ต้องรองรับ `split approval`

ตัวอย่าง:

- บิล 1,000,000
- มีมัดจำแล้ว 800,000
- เหลือยอดค้าง 200,000
- ผู้อนุมัติ split เป็น:
  - เงินสด 50,000
  - เงินโอนบัญชี A 100,000
  - เงินโอนบัญชี B 50,000

ผลลัพธ์:

- เกิด `payment_approvals` 3 rows
- `/purchase/payments` เห็น 3 queued rows
- bill/source document ถูก lock ตราบใดที่ยังมี split item ใด `approved`

ขั้นต่ำของ snapshot ต่อ split:

- `source_type`
- `source_id`
- `source_doc_no_snapshot`
- `party_id`
- `party_name_snapshot`
- `approved_amount`
- `destination_payment_method_snapshot`
- `destination_bank_account_id_snapshot`
- `destination_bank_name_snapshot`
- `destination_account_no_snapshot`
- `approved_at`
- `approved_by`

## กติกา lock / unlock

### Purchase Bill

- ถ้ายัง `ยังไม่อนุมัติ`
  - แก้ไขบิลได้
  - ยกเลิกบิลได้
- ถ้ามี active `approved` item อย่างน้อย 1 row
  - lock บิล
  - ห้ามแก้ไข
  - ห้ามยกเลิกบิล
- เมื่อ `ยกเลิกรายการรอจ่าย`
  - approval row รอบนั้นกลายเป็น `ยกเลิกแล้ว`
  - ถ้าไม่เหลือ active approved item แล้ว บิลกลับไป `ยังไม่อนุมัติ`
  - แล้วจึงแก้ไข/ยกเลิกบิลได้อีก

### Source อื่น

- advance payment และ expense ต้องใช้หลักเดียวกัน
- source document ต้องถูก lock เมื่อมี active approved item
- unlock ได้เมื่อ approval queue รอบนั้นถูกยกเลิกหมด

## ยกเลิกรายการรอจ่าย

`ยกเลิก` ใน `/purchase/payments` หมายถึงยกเลิก queued payment item ก่อนเกิด payment

ผลที่ต้องเกิด:

1. `payment_approvals` row รอบนั้นออกจาก `approved`
2. row เดิมยังอยู่เป็น history `ยกเลิกแล้ว`
3. source document กลับไป queue `ยังไม่อนุมัติ` ถ้าไม่เหลือ active approved item แล้ว
4. `/purchase/payment-history` ต้องเห็น snapshot `ยกเลิกแล้ว`

## ทำจ่าย

`ทำจ่าย` ใน `/purchase/payments` ทำงานระดับ approval item

ผลที่ต้องเกิด:

1. สร้าง `PMT`
2. `payments.payment_approval_id` ต้องชี้กลับ approval row นั้น
3. approval row เปลี่ยนเป็น `paid` เมื่อ settle ครบ
4. history ต้องเห็น `เสร็จสิ้น`

กติกายอด:

- `cash amount + withholding tax + discount` ต้องไม่เกิน `approved_amount`

## ประวัติการจ่ายเงิน

หน้า `/purchase/payment-history` เป็น snapshot/read-only

ต้องแสดง:

- `เลขเอกสาร`
- `ประเภทเอกสาร`
- `คู่ค้า`
- `ยอด`
- `สถานะ`
- `วันที่/เวลา`

สถานะที่ต้องมีอย่างน้อย:

- `เสร็จสิ้น`
- `ยกเลิกแล้ว`

## จ่ายเงินล่วงหน้า / มัดจำ

advance payment เป็น source document ของ flow นี้เช่นกัน

ขั้นต่ำของข้อมูล:

- `Supplier`
- `สาขา`
- `วันที่จ่าย`
- `วิธีจ่าย`
- `บัญชีที่จ่าย`
- `ยอดจ่ายล่วงหน้า`
- large-scale source fields ตามที่กำหนดใน [[Purchase Flow]]

หลังบันทึก:

1. advance payment เข้า queue `อนุมัติจ่ายเงิน`
2. ผู้อนุมัติ split ได้เช่นเดียวกับ source อื่น
3. จ่ายจริงแล้วจึงเกิด payment snapshot

## คืนเงินมัดจำ / คืนเงินล่วงหน้า

ถ้า `advance > final bill amount`

- ห้าม carry forward เป็นเครดิต supplier อัตโนมัติในระบบตอนนี้
- ต้องเข้าฝั่ง `คืนเงินมัดจำ / คืนเงินล่วงหน้า`
- เป็น flow ฝั่ง `Supplier`
- ไม่ reuse เมนูคืนเงินฝั่ง `Customer`

## State Matrix ย่อ

| สถานะ | queue/page | source edit | history |
|---|---|---|---|
| `ยังไม่อนุมัติ` | `/daily/payment-approval` | ได้ | ไม่อยู่ใน history |
| `รอจ่าย` | `/purchase/payments` | lock | ไม่อยู่ใน history |
| `เสร็จสิ้น` | `/purchase/payment-history` | lock | อยู่ |
| `ยกเลิกแล้ว` | `/purchase/payment-history` | ปลด lock เมื่อไม่มี active approval ค้าง | อยู่ |

## Open Implementation Batch

1. เปลี่ยน wording/menu เป็น `อนุมัติจ่ายเงิน`
2. ออกแบบ schema additive สำหรับ `advance payment` และ allocation
3. redesign `/daily/payment-approval` ให้รองรับ split items
4. persist `payment_approvals` แบบ `1 split = 1 row`
5. ปรับ `/purchase/payments` ให้ทำงานระดับ approval item
6. รักษา lock/unlock semantics ของ source document
7. เพิ่ม browser smoke:
   - cash + transfer + transfer
   - cancel queued item
   - re-approve with new PMA
