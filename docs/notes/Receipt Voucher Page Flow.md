---
title: Receipt Voucher Page Flow
aliases:
  - ใบสำคัญรับเงิน
  - Supplier Receipt Voucher
  - RV
tags:
  - ns-scrap-erp
  - purchase
  - payment
  - print
  - page-flow
status: draft
created: 2026-06-12
updated: 2026-06-12
---

# Receipt Voucher Page Flow / Flow ใบสำคัญรับเงิน Supplier

## Scope

- Route: `/purchase/receipt-vouchers`
- Current API: `GET /api/purchase/receipt-vouchers`
- Owner: Purchase + Finance
- Document prefix: `RV`
- Legacy source: `old-apps/legacy/index.html` component `view-receiptVoucher`
- Related but separate flow: `/sales/receipts` uses `RCP` for receiving money from Customer

หน้านี้คือเอกสาร `ใบสำคัญรับเงิน` ฝั่ง Supplier สำหรับกรณี `Supplier รับเงินสดเท่านั้น` ใช้ให้ Supplier บุคคลธรรมดา/ผู้รับเงินเซ็นรับเงินในกรณีไม่มีใบเสร็จจาก Supplier โดยดึงข้อมูลจาก `PB` มา pre-fill แล้วให้ผู้ใช้แก้ field ที่ขาดได้

## Naming Boundary

คำว่า `Receipt Voucher` ใน legacy ถูกใช้ 2 ความหมาย ต้องแยกให้ชัดในระบบใหม่:

| Code | Route | Meaning | Money direction |
|---|---|---|---|
| `RV` | `/purchase/receipt-vouchers` | ใบสำคัญรับเงินที่ Supplier เซ็นให้บริษัทหลังรับเงินสดจากบริษัท | cash-out evidence / supplier signed cash receipt |
| `RCP` | `/sales/receipts` | เอกสารรับเงินจาก Customer เพื่อตัดลูกหนี้ SB | money in / customer receipt |

ดังนั้นเอกสารนี้พูดถึง `RV` เท่านั้น ไม่ใช่การรับเงิน Customer

## Legacy Finding

Legacy มี component `view-receiptVoucher` สำหรับ Supplier receipt voucher โดยตรง:

- สร้างเลข `RV` ด้วย `erp.nextDocNo('RV')`
- มีปุ่ม `+ สร้างใบสำคัญรับเงิน`
- เลือก `บิลซื้อ` เพื่อ pre-fill ข้อมูล แต่ไม่บังคับ
- เมื่อเลือก PB ระบบดึง `purchaseBillId`, `purchaseBillDocNo`, date, Supplier name/tax id/address/phone, license plate, salesperson, receiver signer name, items, และ note
- รายการใน voucher เป็น free-edit lines: `description`, `qty`, `price`, `amount`
- ระบบคำนวณ `totalQty`, `totalAmount`, และ `amountInWords`
- ผู้ใช้แก้ `amountInWords` ได้เอง
- save เขียนลง `db.receiptVouchers`
- edit เขียนทับเอกสารเดิม
- delete ลบ row ออกจาก `db.receiptVouchers`
- print preview ใช้หัวบริษัทจาก `db.companyProfile`

Legacy ไม่ได้เป็น payment posting owner และควรตีความเป็นเอกสารเงินสดเท่านั้นใน target:

- ไม่สร้าง `PMA`
- ไม่สร้าง `PMT`
- ไม่เขียน `bankStatement`
- ไม่แก้ยอดจ่าย PB โดยตรง
- ไม่เขียน stock ledger
- ไม่ใช้แทนหลักฐานโอนเงิน/เช็ค/รายการธนาคาร

## Current Next Implementation Snapshot

ตรวจ ณ 2026-06-12:

- `/purchase/receipt-vouchers` ใช้ `ReceiptVouchersPageClient`
- `GET /api/purchase/receipt-vouchers` อ่านจาก `receipt_vouchers`
- `GET /api/purchase/receipt-vouchers` ส่ง Company Profile snapshot สำหรับ print preview มาพร้อม list เพื่อไม่ต้องใช้สิทธิ์ admin แยกตอนพิมพ์
- permission: `finance.cash.view`
- list รองรับ search/date filter/pagination/print preview
- ปุ่ม `+ สร้างใบสำคัญรับเงิน` disabled
- ปุ่ม `แก้ไข` และ `ยกเลิก` disabled
- print preview รวม template legacy แล้ว: company header, ข้อมูลผู้รับเงิน, block `ได้รับเงินจาก` บริษัท, ตารางรายการ, จำนวนเงินตัวอักษร, ลายเซ็นผู้จ่าย/ผู้รับ, และหมายเหตุแนบสำเนาบัตรประชาชน
- API ยังไม่มี `POST`, `PUT/PATCH`, `DELETE/CANCEL`, หรือ detail route

## Target Decision

`RV` เป็นเอกสารหลักฐาน/printable document สำหรับ `จ่ายเงินสดให้ Supplier` ที่ผูกกับ purchase/payment facts แต่ไม่ควรเป็น owner ของการจ่ายเงิน

Target ที่เหมาะสม:

- เมื่อสร้าง `PMT` ที่วิธีจ่ายมี `payment_methods.type = cash` ระบบต้องสร้าง/อัปเดต `RV` ให้อัตโนมัติใน transaction เดียวกัน
- เลข `RV` ที่เกิดจาก PMT ใช้เลข deterministic จาก `PMT...` เป็น `RV...` เพื่อกันสร้างซ้ำเมื่อ save/retry
- ถ้าแก้ PMT เดิมจากเงินสดเป็นช่องทาง non-cash ระบบต้องลบ RV อัตโนมัติที่ผูกด้วยเลข deterministic นั้น
- สร้าง `RV` จาก `PB` หรือ cash payment fact ได้เฉพาะกรณีวิธีจ่ายเป็นเงินสด
- ถ้า source คือ PB ที่ยังไม่จ่ายเงินสดจริง ต้องแสดงสถานะว่าเป็น draft/เตรียมเอกสาร ไม่ใช่หลักฐานจ่ายจริง
- ถ้า source คือ `PMT paid` ต้องพิมพ์เป็น RV ได้เฉพาะ PMT ที่จ่ายด้วยเงินสดเท่านั้น
- ถ้าเป็นโอนเงิน/เช็ค/ช่องทางธนาคาร ให้ใช้ `PMT` payment voucher หรือหลักฐานธนาคาร ไม่ออก `RV`
- print ต้องใช้ snapshot ของ RV และ Company Profile ณ ตอนพิมพ์/บันทึก ไม่ resolve master data แบบทำให้เอกสารเก่าเปลี่ยน
- ยกเลิก/แก้ไข RV ต้องไม่ reverse payment; ถ้าต้อง reverse เงิน ให้ไปทำใน PMT/payment flow

## Target Flow

| Step | User action | System result | Side effect |
|---|---|---|---|
| 1 | เปิดหน้า RV | โหลดรายการ `receipt_vouchers` | none |
| 2 | กดสร้าง RV | เปิด modal สร้างเอกสาร เลข `RV` auto | none |
| 3 | เลือก PB หรือ cash PMT source | pre-fill supplier, bill, vehicle, sales, items, amount | none |
| 4 | แก้ field ที่ขาด | user edits seller/contact/items/signers/payment method/note | none |
| 5 | บันทึก RV | insert/update `receipt_vouchers` + timeline/audit | no bank/stock/AP mutation |
| 6 | พิมพ์ | render A4 from RV snapshot + Company Profile | no mutation |
| 7 | ยกเลิก RV | mark cancelled with reason/timeline | no payment reversal |

### Runtime PMT Cash Auto-RV Flow

| Step | Trigger | System result | Side effect |
|---|---|---|---|
| 1 | POST `/api/purchase/payments` ผ่าน PMA approved | สร้าง PMT/payment allocation/BST ตาม payment flow | payment facts |
| 2 | ตรวจ `values.method` กับ `payment_methods` | ถ้า `type = cash` ถือว่าเป็นเงินสดเท่านั้น | no fallback/string guess |
| 3 | สร้างเลข `RV` จากเลข PMT | `PMT012606-0001` -> `RV012606-0001` | deterministic, idempotent |
| 4 | upsert `receipt_vouchers` | snapshot ผู้รับเงิน, source docs, payment lines, total, amount-in-words, signer, payment method | printable evidence only |
| 5 | ถ้า PMT เดิมเปลี่ยนเป็น non-cash | delete RV auto-generated ของ PMT นั้น | no payment reversal |

## Print Template Contract

Template อิง legacy `view-receiptVoucher`:

- Company header: ชื่อบริษัท, ชื่ออังกฤษ, ที่อยู่, โทรศัพท์, เลขประจำตัวผู้เสียภาษี จาก Company Profile
- Document title: `ใบสำคัญรับเงิน`
- Header: วันที่เอกสาร
- Supplier block: `ข้าพเจ้า`, เลขประจำตัวผู้เสียภาษี/บัตรประชาชน, ที่อยู่, โทร, ทะเบียน, Sale
- Company receipt block: `ได้รับเงินจาก`, ที่อยู่บริษัท, เลขประจำตัวผู้เสียภาษีบริษัท
- Items table: ลำดับ, รายการ, จำนวน/หน่วย, ราคา/บาท, จำนวนเงิน, รวม
- Amount text: จำนวนเงินตัวอักษร
- Signature: ผู้จ่ายเงิน, ผู้รับเงิน
- Footer: วิธีรับเงินต้องเป็นเงินสด และข้อความแนบสำเนาบัตรประชาชนผู้รับเงิน

## Data Contract

### Header

| Field | Source / rule |
|---|---|
| `doc_no` | generated `RV...`, read-only in UI |
| `date` | default today or source PB date; editable |
| `purchase_bill_doc_no` | optional source PB reference |
| `payment_doc_no` | target optional PMT reference if RV is generated after payment |
| `seller_name` | supplier snapshot or manual |
| `seller_tax_id` | supplier snapshot or manual |
| `seller_address` | supplier snapshot or manual |
| `seller_phone` | supplier snapshot or manual |
| `license_plate` | PB snapshot if available |
| `sales_person` | PB/salesperson snapshot if available |
| `payment_method` | must be cash wording/snapshot only, not transfer/check/payment posting instruction |
| `payer_signer_name` | signer shown on print |
| `receiver_signer_name` | supplier/signature name shown on print |

### Items

`items` is a snapshot array:

| Field | Meaning |
|---|---|
| `description` | product/line description printed on RV |
| `qty` | quantity/weight shown on RV |
| `unit` | target required when source product unit exists; legacy assumed kg |
| `price` | price per unit/weight |
| `amount` | line amount |

Target must preserve unit display from PB/product snapshot. Legacy showed `จำนวน/กก.` only, but active target supports both `กก.` and `ลัง`, so new runtime must not hardcode kg for all products.

## Validation / Status Rules

- `seller_name` required
- at least 1 valid item required
- `amountInWords` auto-calc but editable
- `doc_no` must be unique
- source PB/PMT must exist if selected
- payment method must be cash only
- print as payment evidence should require paid cash source or explicit draft state
- cancelled RV cannot be edited; can still be printed as cancelled copy if target enables it
- RV cancellation does not cancel PB/PMA/PMT

## Status Model

| Status | Meaning | Edit | Print |
|---|---|---:|---:|
| `draft` | prepared but not confirmed/paid-source evidence | yes | draft watermark |
| `issued` | confirmed printable evidence | limited by permission | yes |
| `cancelled` | cancelled RV document | no | yes, cancelled watermark |

Current Next rows do not expose status yet. Target needs status if create/edit/cancel is enabled.

## Side Effects

Allowed:

- write `receipt_vouchers`
- append RV timeline/status/audit
- read PB/PMT/supplier/company profile snapshots

Not allowed:

- create or approve PMA
- create PMT
- write `bank_statement`
- update PB paid/payable balance
- write stock ledger
- mutate supplier master data from RV edits
- issue RV for transfer/check/non-cash payment methods

## Print Contract

Print document must include:

- Company Profile header, tax id, address, phone
- document title `ใบสำคัญรับเงิน`
- RV date and document number
- seller name, tax id, address, phone
- license plate and salesperson if available
- source PB/PMT reference
- line items with quantity, unit, price, amount
- total amount and amount in Thai words
- note
- payer signer and receiver signer
- cash payment method text snapshot
- attachment note for ID card where applicable
- cancelled/draft watermark when status requires it

## Implementation Gaps

- [ ] Add source-aware create modal for `RV`
- [ ] Add `POST /api/purchase/receipt-vouchers`
- [ ] Add edit/cancel route with status log/audit
- [ ] Decide whether cash RV can be created from unpaid PB as draft, or only from paid cash PMT
- [ ] Add `payment_doc_no` / source-payment reference if RV is payment-backed
- [ ] Enforce cash-only payment method/source validation
- [ ] Replace print placeholder header with Company Profile payload
- [ ] Preserve item unit snapshot; do not assume every line is kg
- [ ] Add RV timeline/status log per document timeline policy
- [ ] Keep `/sales/receipts` / `RCP` docs and UI separate from `/purchase/receipt-vouchers` / `RV`

## Related Notes

- [[Printable Documents]]
- [[Payment Flow]]
- [[Purchase Flow]]
- [[P0 Transaction Stock Payment Current Code Baseline]]
