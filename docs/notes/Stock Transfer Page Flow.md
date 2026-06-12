---
title: Stock Transfer Page Flow
aliases:
  - Stock Transfer Page
  - Flow หน้าโอนสินค้าระหว่างสาขา
  - หน้า Stock Transfer
tags:
  - ns-scrap-erp
  - stock
  - inventory
  - page-flow
  - stock-transfer
status: draft
created: 2026-06-11
updated: 2026-06-11
---

# Stock Transfer Page Flow / Flow หน้าโอนสินค้าระหว่างสาขา

## Scope

- Route: `/stock/transfer`
- API: `GET /api/stock/transfer`, `POST /api/stock/transfer`
- Owner: Stock / Inventory
- Page type: stock movement write flow
- Ledger ref type: `ST`

หน้านี้ใช้ย้ายสินค้าออกจากสาขา/คลังต้นทางไปสาขา/คลังปลายทาง โดยต้องสร้าง stock ledger แบบ paired movement ในเอกสารเดียวกัน

## Source Of Truth

- รายการโอนที่บันทึกแล้วอ่านจาก `stock_ledger.ref_type = 'ST'`
- 1 เลขที่ `ST` ต้องมีอย่างน้อย 2 ledger rows ต่อสินค้า:
  - source row: `qty_out`
  - destination row: `qty_in`
- Balance หลังบันทึกต้องมาจาก `stock_ledger` ไม่ใช่ table summary แยก

## Main UI Contract

### List

ควรแสดง:

- เลขที่เอกสาร
- วันที่เอกสาร
- วันที่สร้างรายการ
- ต้นทาง
- ปลายทาง
- จำนวนรายการสินค้า
- น้ำหนัก/จำนวนรวม
- หมายเหตุ
- สถานะเอกสาร ถ้ามี cancel/reverse ในอนาคต

### Filters

ควรรองรับ:

- ค้นหาเลขที่ / ต้นทาง / ปลายทาง / หมายเหตุ
- วันที่จาก-ถึง
- สาขาต้นทาง
- สาขาปลายทาง
- period chips เช่น วันนี้ / 7 วัน / เดือนนี้

## Create Modal Contract

### Header Section

- วันที่เอกสาร
- สาขาต้นทาง
- คลังต้นทาง
- สาขาปลายทาง
- คลังปลายทาง
- ผู้ส่ง
- ผู้รับ
- หมายเหตุ

เลขที่เอกสารเป็น auto-generated และไม่ควรเป็น required visible field สำหรับ user ปกติ

### Item Section

รองรับหลายรายการ:

- สินค้า
- Lot
- จำนวน/น้ำหนัก

Target validation:

- ต้องมีอย่างน้อย 1 รายการ
- สาขา/คลังต้นทางต้อง active และสัมพันธ์กัน
- สาขา/คลังปลายทางต้อง active และสัมพันธ์กัน
- ต้นทางและปลายทางต้องไม่เป็นคลังเดียวกัน
- สินค้าต้อง active
- จำนวนต้องมากกว่า 0
- source ต้องมี `พร้อมใช้` เพียงพอ โดยคิดจาก `on_hand - active_holds`

## Ledger Side Effect

เมื่อบันทึกสำเร็จ:

- สร้าง ref type `ST`
- สร้าง `movement_type = โอนระหว่างสาขา-ออก` หรือ equivalent สำหรับต้นทาง
- สร้าง `movement_type = โอนระหว่างสาขา-เข้า` หรือ equivalent สำหรับปลายทาง
- `ref_no` ต้องเหมือนกันทั้งคู่
- `ref_id` ต้องผูกทั้งคู่เข้าชุดเดียวกัน
- lot/status/not-available/cost policy ต้องไม่หายจาก source movement

## Cancel / Reverse Policy

Target ที่ควรใช้:

- ไม่แก้ row เก่าโดยตรง
- ถ้ายกเลิกหลังบันทึก ให้สร้าง reversal movement หรือ mark source document + reversal rows ตาม stock reversal policy
- ถ้ามี downstream document ใช้ stock ที่ปลายทางแล้ว ต้อง block cancel หรือให้ flow reverse ตรวจ dependency ก่อน

Current active app ยังต้องตรวจ gap นี้ก่อนเปิด cancel จริง

## API Contract

`GET /api/stock/transfer` ควรส่ง:

- `rows`
- branch options
- warehouse options
- product options

`POST /api/stock/transfer` รับ:

- `date`
- `fromBranchId`
- `fromWarehouseId`
- `toBranchId`
- `toWarehouseId`
- `sender`
- `receiver`
- `notes`
- `items[]`

## Current Implementation / Gap

- มี write baseline ที่สร้าง paired `ST` ledger rows แล้ว
- ต้องเพิ่ม hold-aware available check ก่อนโอนออก
- ต้องยืนยันการคง lot/status/not-available/cost policy ใน transfer rows
- ต้องออกแบบ cancel/reverse และ dependency lock
- ต้องยืนยัน list/detail/export แสดง `วันที่สร้างรายการ`

## Related Notes

- [[Stock Ledger and Stock Balance]]
- [[Stock Ledger Page Flow]]
- [[Stock Balance Page Flow]]
