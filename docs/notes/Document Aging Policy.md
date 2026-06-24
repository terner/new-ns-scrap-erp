---
title: Document Aging Policy
aliases:
  - Document Aging
  - Aging เอกสาร
  - เอกสารค้างตามอายุ
tags:
  - ns-scrap-erp
  - business-flow
  - reporting
  - aging
status: draft
created: 2026-06-11
updated: 2026-06-11
---

# Document Aging Policy / Aging เอกสาร

เอกสารนี้เป็นกติกากลางสำหรับการนับอายุเอกสารธุรกิจที่ยังค้างดำเนินการ โดยครอบคลุมอย่างน้อย:

- `PB` บิลรับซื้อ
- `SB` บิลขาย
- `WTI` ใบรับของ
- `WTO` ใบส่งของ
- `POB` PO Buy
- `POS` PO Sell

หลักสำคัญ: aging เป็น read model / report value ที่คำนวณจากเอกสาร, due date, delivery date, status, usage/allocation facts, และยอดคงเหลือ ณ `asOfDate` ไม่ใช่สถานะที่ต้องเขียนทับทุกวัน

`Document Aging Policy` เป็นกติกาการคำนวณ ไม่ใช่เอกสาร transaction กลางและไม่จำเป็นต้องมี table กลางเสมอไป implementation อาจเป็น helper/read model/report query ที่อ่านจากเอกสารจริงและ usage/allocation facts ได้

## Date Roles

เอกสารหลายประเภทมีวันที่มากกว่า 1 แบบ โดยเฉพาะกรณีบันทึกย้อนหลัง ระบบต้องแยกความหมายของวันที่เหล่านี้ให้ชัด:

| Date | ความหมาย | ใช้กับ aging อย่างไร |
|---|---|---|
| `created_at` / `systemCreatedAt` | เวลาที่ record ถูกสร้างในระบบจริง | ใช้ audit/timeline/process latency ไม่ใช้เป็น default business aging |
| `documentDate` / `businessDate` | วันที่เอกสารที่ผู้ใช้เลือกหรือวันที่เอกสารทางธุรกิจมีผล | ใช้เป็น reference หลักของ operational aging ถ้าไม่มี delivery/expected date |
| `postingDate` / `effectiveDate` | วันที่มีผลใน ledger/accounting/stock movement | ใช้กับ report ตามงวดและ audit การลงบัญชี/สต็อก |
| `dueDate` | วันครบกำหนดชำระ/รับเงิน | ใช้เป็น reference หลักของ financial aging |
| `paymentDate` / `receiptDate` | วันที่จ่ายเงินจริงหรือรับเงินจริง | ใช้หยุด financial aging และลง cash/bank ตามวันที่จ่าย/รับ |
| `usedBusinessDate` | วันที่ downstream document ที่นำเอกสารไปใช้ เช่น `PB.date`, `SB.date` | ใช้ปิด business aging ของเอกสารต้นทางในมุมมอง business date |
| `usedSystemAt` / `linkedAt` | เวลาที่ระบบสร้าง link/allocation จริง | ใช้ audit/process latency เพื่อดูว่าทีมใช้เวลาทำงานจริงกี่วัน |

Default aging ที่ user เห็นในหน้ารายการควรใช้ business/effective date ไม่ใช่ `created_at` เพื่อรองรับการลงรายการย้อนหลัง แต่ report เชิงควบคุมงานภายในสามารถมี `process aging` แยกต่างหาก โดยนับจาก `created_at` ถึง `usedSystemAt`

กรณีปิดเอกสารย้อนหลังต้องเก็บหรือ derive ให้ได้ทั้ง 2 ค่า:

- `closedBusinessDate`: วันที่ธุรกิจที่ถือว่าปิด เช่น วันที่จ่าย, วันที่รับเงิน, วันที่ PB/SB ที่นำ WTI/WTO ไปใช้
- `closedSystemAt`: เวลาที่ผู้ใช้กดบันทึก/ระบบสร้าง allocation จริง

ห้ามปนสองค่านี้ใน column เดียว เพราะจะทำให้ aging ทางธุรกิจและเวลาทำงานจริงของทีมคลาดเคลื่อน

## Aging Types

ระบบควรแยก aging เป็น 2 ประเภท ไม่ใช้ความหมายเดียวกันทุกเอกสาร:

| Type | ใช้กับ | นับจาก | ใช้ตอบคำถาม |
|---|---|---|---|
| `financial_due_aging` | `PB`, `SB` | `due_date` หรือวันที่ derive จาก credit term | หนี้เจ้าหนี้/ลูกหนี้เกินกำหนดกี่วัน |
| `operational_pending_aging` | `WTI`, `WTO`, `POB`, `POS` | วันที่เอกสาร หรือวันที่กำหนดรับ/ส่ง | เอกสารค้างดำเนินการนานกี่วัน |

ห้ามเอา `financial_due_aging` ไปแทน `operational_pending_aging` เพราะเอกสารอย่าง `WTI/WTO` ไม่มี due date ทางการเงินโดยตรง

## Common Fields

ทุก read model ที่เป็น aging ควรคืน field เหล่านี้เป็นอย่างน้อย:

| Field | ความหมาย |
|---|---|
| `asOfDate` | วันที่ใช้คำนวณ aging ตาม business date |
| `documentType` | `PB`, `SB`, `WTI`, `WTO`, `POB`, `POS` |
| `documentNo` | เลขเอกสาร business-facing |
| `documentDate` | วันที่เอกสาร |
| `systemCreatedAt` | วันที่/เวลาที่ record ถูกสร้างจริงในระบบ ต้องแสดงเพื่อ audit แต่ไม่ใช้แทน business aging |
| `referenceDate` | วันที่ที่ใช้เริ่มนับจริง เช่น due date, delivery date, หรือ document date |
| `referenceDateType` | ชนิดวันที่ที่ใช้เริ่มนับ เช่น `dueDate`, `deliveryDate`, `documentDate`, `createdAt` |
| `ageDays` | จำนวนวันจาก `referenceDate` ถึง `asOfDate`; อาจติดลบถ้ายังไม่ถึง due/delivery |
| `ageBucket` | bucket สำหรับ filter/report |
| `closedBusinessDate` | วันที่ธุรกิจที่ปิด aging ถ้าเอกสารถูกนำไปใช้/จ่าย/รับเงินแล้ว |
| `closedSystemAt` | เวลาที่ระบบบันทึกการปิดจริง ใช้ audit/process aging |
| `partyCode` / `partyName` | Supplier หรือ Customer ตามเอกสาร |
| `branchId` / `branchName` | สาขาเอกสาร |
| `openQty` | จำนวน/น้ำหนักคงเหลือ ถ้ามี |
| `openAmount` | ยอดเงินคงเหลือ ถ้ามี |
| `openReason` | เหตุผลที่ยังค้าง เช่น `รอออกบิล`, `รอรับเงิน`, `รอจ่ายเงิน`, `ค้างรับสินค้า`, `ค้างส่งสินค้า` |
| `lastEventAt` | วันที่ event ล่าสุดจาก timeline/status/allocation log ถ้ามี |

## Bucket Rules

### Financial Due Aging

ใช้กับ AP/AR:

| Bucket | เงื่อนไข |
|---|---|
| `Current` | `ageDays <= 0` |
| `1-30` | `1 <= ageDays <= 30` |
| `31-60` | `31 <= ageDays <= 60` |
| `61-90` | `61 <= ageDays <= 90` |
| `>90` | `ageDays > 90` |

นี่ตรงกับ bucket ปัจจุบันของ `/api/finance/ap` และ `/api/finance/ar`

### Operational Pending Aging

ใช้กับเอกสารที่ค้าง flow ไม่ใช่ค้างจ่าย/ค้างรับ:

| Bucket | เงื่อนไข |
|---|---|
| `0-7` | `0 <= ageDays <= 7` |
| `8-15` | `8 <= ageDays <= 15` |
| `16-30` | `16 <= ageDays <= 30` |
| `31-60` | `31 <= ageDays <= 60` |
| `>60` | `ageDays > 60` |

ถ้าเอกสารมี delivery date / expected date ในอนาคต ให้ `ageDays` ติดลบได้ และ UI ควรแสดงกลุ่ม `ยังไม่ถึงกำหนด` แยกจากกลุ่มค้าง

## Document Rules

| Document | Aging type | reference date | included when | stop counting when |
|---|---|---|---|---|
| `PB` | `financial_due_aging` | current policy: ใช้ `purchase_bills.date` เป็น aging base เพราะยังไม่มี confirmed supplier credit term / PB due-date source; ถ้าอนาคตเพิ่ม source จริงค่อยเปลี่ยน policy/schema | `payable_balance > 0` และไม่ถูกยกเลิก | payable balance เป็น 0, วันที่จ่ายจริง, หรือยกเลิก |
| `SB` | `financial_due_aging` | `sales_bills.due_date` ถ้ามี; ถ้าไม่มีใช้ `sales_bills.date + customer credit term` | `receivable_balance > 0` และไม่ถูกยกเลิก | receivable balance เป็น 0, วันที่รับเงินจริง, หรือยกเลิก |
| `WTI` | `operational_pending_aging` | `weight_tickets.document_date` | status `รับของแล้ว` และยังไม่ถูกใช้ใน `PB` | status `เสร็จสิ้น` หรือ `ยกเลิก`; business close ใช้วันที่ `PB` ที่นำไปใช้, audit close ใช้เวลา link จริง |
| `WTO` | `operational_pending_aging` | `weight_tickets.document_date` | status `ส่งของแล้ว` และยังไม่ถูกใช้ใน `SB` | status `ออกบิลแล้ว` หรือ `ยกเลิก`; business close ใช้วันที่ `SB` ที่นำไปใช้, audit close ใช้เวลา link จริง |
| `POB` | `operational_pending_aging` | `delivery_date` / expected receive date ถ้ามี; ถ้าไม่มีใช้ `po_buys.date` | PO ยังมี qty/amount remaining และไม่ short-close/cancel | ออกบิลครบ, short-close, หรือ cancel |
| `POS` | `operational_pending_aging` | `delivery_date` / expected ship date ถ้ามี; ถ้าไม่มีใช้ `po_sells.date` | PO ยังมี qty/amount remaining และยังไม่ออกบิลครบ | ออกบิลครบ, close, หรือ cancel |

## PB / SB Notes

`PB` และ `SB` มี aging ที่มีผลทางการเงินโดยตรง:

- `PB` คือ AP aging / เจ้าหนี้ค้างจ่าย
- `SB` คือ AR aging / ลูกหนี้ค้างรับ

กติกา target:

- ใช้ยอดคงเหลือจริงหลัง payment/receipt/allocation
- ใช้ due date ที่ snapshot ตอนออกบิล ถ้ามี
- `SB`: ถ้าไม่มี due date ให้ derive จาก credit term ของเอกสารหรือคู่ค้า
- `PB`: policy ปัจจุบันยังไม่ใช้ supplier credit term; ใช้วันที่บิลเป็นฐาน aging/alert เท่านั้น
- หากไม่มีทั้ง due date และ credit term ให้ใช้วันที่เอกสารเป็น fallback แบบชัดเจนใน report ไม่ใช่ silent fallback ใน write path
- payment/receipt ที่บันทึกย้อนหลังต้องหยุด financial aging ด้วย `paymentDate` / `receiptDate` ในมุม business aging และเก็บ `created_at` ของ PMT/RCT ไว้สำหรับ audit/process latency แยกต่างหาก

Current runtime note:

- `/api/finance/ar` derive due date จาก `sales_bills.due_date` หรือ `sales_bills.date + credit_term`
- `/api/finance/ap` ตอนนี้ใช้ `purchase_bills.date` เป็น aging base ตาม policy ปัจจุบัน; supplier credit term / PB due date ยังไม่อยู่ใน implementation batch นี้

## WTI / WTO Notes

`WTI/WTO` aging เป็นงานค้าง operational:

- `WTI` ค้างออกบิลรับซื้อ
- `WTO` ค้างออกบิลขาย

กติกา target:

- `WTI` หนึ่งใบต้องไป `PB` ครบในบิลเดียว
- `WTO` หนึ่งใบต้องไป `SB` ครบในบิลเดียว
- aging ของ `WTI/WTO` หยุดเมื่อถูกใช้ downstream สำเร็จ
- ถ้าเอกสารถูก cancel ให้ไม่อยู่ใน default aging report แต่ยังดูได้ใน audit/history ถ้าเลือก include cancelled
- ถ้า `PB/SB` ที่นำ `WTI/WTO` ไปใช้ถูกบันทึกย้อนหลัง business aging ของ `WTI/WTO` ปิดที่วันที่เอกสาร downstream แต่ process latency ต้องยังเห็นเวลาที่ผู้ใช้สร้าง link จริง

`WTI/WTO` aging ต้องอ่านจาก status + usage/allocation facts ไม่ควรเชื่อ status string อย่างเดียว

## PO Buy / PO Sell Notes

`POB/POS` aging ไม่ใช่หนี้การเงินโดยตรง แต่เป็น commitment ที่ค้าง fulfillment:

- `POB` ค้างรับ/ค้างออกบิลจาก Supplier
- `POS` ค้างส่ง/ค้างออกบิลให้ Customer

กติกา target:

- ใช้ delivery/expected date เป็น reference date ถ้ามี
- ถ้าไม่มี delivery/expected date ให้ใช้ document date เพื่อไม่ให้เอกสารหายจากรายงาน
- ต้องคำนวณ remaining จาก allocation facts/current reconciliation ไม่เชื่อ cached header remaining อย่างเดียว
- short-close ต้องหยุด aging ของยอดที่ปิดรับ/ปิดส่งไม่ครบ

## API Direction

Current API ที่มีแล้ว:

| API | ครอบคลุม | สถานะ |
|---|---|---|
| `GET /api/finance/ap` | `PB` AP aging | มีแล้ว และใช้ `purchase_bills.date` เป็น aging base ตาม current policy |
| `GET /api/finance/ar` | `SB` AR aging | มีแล้ว และ derive จาก due date / customer credit term |

Target follow-up:

| API / surface | หน้าที่ |
|---|---|
| `GET /api/reports/document-aging` หรือ report helper กลาง | รวม aging ของ `PB/SB/WTI/WTO/POB/POS` สำหรับ dashboard/report |
| `/daily/weight-ticket-list` payload | เพิ่ม `ageDays`, `ageBucket`, `openReason` สำหรับ WTI/WTO ที่ยังค้างออกบิล |
| `/purchase/po-buy` payload | เพิ่ม aging ของ PO ที่ยังค้างรับ/ค้างออกบิล |
| `/sales/po-sell` payload | เพิ่ม aging ของ PO ที่ยังค้างส่ง/ค้างออกบิล |
| `/finance/ap` | คง current no-credit-term policy: ใช้ `purchase_bills.date` เป็น aging base; หากอนาคตต้องรองรับ supplier credit term / bill due date ต้องออกแบบ source/schema ใหม่ก่อน |

ยังไม่ควรเพิ่ม path ใหม่ใน OpenAPI จนกว่า implementation route จะถูกสร้างจริง

## UI Direction

ทุก list page ที่เกี่ยวข้องควรมีอย่างน้อย:

- column หรือ metadata `วันที่สร้างรายการ` จาก `created_at` / `systemCreatedAt` แสดงทุกหน้าเพื่อ audit
- column `อายุเอกสาร` หรือ `อายุค้าง`
- filter bucket ตามประเภท aging
- sort `อายุค้างมากสุด`
- badge/สีเตือนเฉพาะเอกสารที่เกิน bucket สูง
- tooltip/label บอกว่านับจากวันอะไร เช่น `นับจากวันครบกำหนด`, `นับจากวันที่ใบรับของ`, `นับจากวันส่งมอบ`

ห้ามใช้สีเตือน aging แทนสถานะเอกสาร เพราะ aging เป็นมุมมองเวลา ส่วน status เป็นสถานะ workflow

## Implementation TODO

- [ ] เพิ่ม helper กลางสำหรับคำนวณ `financial_due_aging` และ `operational_pending_aging`
- [ ] เพิ่ม contract วันที่ให้ aging response แยก `referenceDateType`, `closedBusinessDate`, และ `closedSystemAt`
- [ ] ตรวจทุกหน้า list/detail ของเอกสารให้แสดง `วันที่สร้างรายการ` แยกจากวันที่เอกสาร/วันที่จ่าย/วันที่ครบกำหนด
- [ ] คง `/api/finance/ap` บน no-credit-term policy: ใช้ `purchase_bills.date` เป็น aging base และออกแบบ source/schema ใหม่ก่อนถ้าจะเพิ่ม supplier credit term / PB due date ในอนาคต
- [ ] เพิ่ม aging fields ใน `WTI/WTO` list/detail read model
- [ ] เพิ่ม aging fields ใน `POB/POS` list/read model
- [ ] ออกแบบ report รวม `Document Aging` ก่อนเพิ่ม OpenAPI path ใหม่
- [ ] เพิ่ม UAT cases สำหรับ `PB`, `SB`, `WTI`, `WTO`, `POB`, `POS` ที่ค้างข้าม bucket
