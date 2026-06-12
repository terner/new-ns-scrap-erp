---
title: Stock Status Convert Page Flow
aliases:
  - Status Convert Page
  - Flow หน้าปรับสถานะสินค้า
  - หน้า Stock Status Convert
tags:
  - ns-scrap-erp
  - stock
  - inventory
  - page-flow
  - stock-status-convert
status: draft
created: 2026-06-11
updated: 2026-06-11
---

# Stock Status Convert Page Flow / Flow หน้าปรับสถานะสินค้า

## Scope

- Route: `/stock/status-convert`
- API: `GET /api/stock/status-convert`, `POST /api/stock/status-convert`
- Owner: Stock / Inventory
- Page type: stock movement write flow
- Ledger ref type: `SC`

หน้านี้ใช้เปลี่ยนสถานะ stock ภายใน product/location เดิม เช่น `RM -> WIP`, `WIP -> FG`, หรือ `FG -> RM` โดยไม่เปลี่ยนสินค้า

## Source Of Truth

- อ่านรายการจาก `stock_ledger.ref_type = 'SC'`
- 1 เอกสาร `SC` ต้องมี paired rows:
  - out จากสถานะต้นทาง
  - in เข้าสถานะปลายทาง
- Balance ต้องเปลี่ยนเฉพาะ status/output category ไม่ใช่ product หรือ warehouse

## Main UI Contract

### List

ควรแสดง:

- เลขที่เอกสาร
- วันที่เอกสาร
- วันที่สร้างรายการ
- สินค้า
- สาขา/คลัง
- Lot
- สถานะจาก
- สถานะเป็น
- จำนวน
- มูลค่า
- เหตุผล/หมายเหตุ
- สร้างโดย

### Filters

ควรรองรับ:

- ค้นหาเลขที่ / สินค้า / หมายเหตุ
- สถานะจาก/เป็น
- สาขา
- คลัง
- วันที่
- สินค้า

## Create Modal Contract

ต้องมี field:

- วันที่เอกสาร
- สาขา
- คลัง
- สินค้า
- Lot
- สถานะต้นทาง
- สถานะปลายทาง
- จำนวน
- เหตุผล
- หมายเหตุ

Target validation:

- สถานะต้นทางและปลายทางต้องไม่ซ้ำกัน
- จำนวนต้องมากกว่า 0
- source key ต้องมี `พร้อมใช้` เพียงพอ ไม่ใช่แค่ `คงเหลือจริง`
- สาขา/คลัง/สินค้า active และสัมพันธ์ถูกต้อง
- ถ้ามี Lot ต้อง validate กับ source balance key

## Ledger Side Effect

เมื่อบันทึกสำเร็จ:

- source row: `ref_type = 'SC'`, `qty_out`, `output_category = fromStatus`
- target row: `ref_type = 'SC'`, `qty_in`, `output_category = toStatus`
- cost/value ใช้ average cost ของ source key ณ วันที่บันทึก
- `ref_no` และ `ref_id` ต้องผูก rows ทั้งคู่เข้าชุดเดียวกัน
- เหตุผลต้องอยู่ใน ledger notes หรือ audit table

## Cancel / Reverse Policy

Target ที่ควรใช้:

- ไม่แก้ ledger row เก่าโดยตรง
- ถ้าต้อง reverse ให้สร้าง reversal document หรือ paired reversal rows
- ต้อง block reverse ถ้า stock ที่ status ปลายทางถูกใช้ต่อแล้วและทำให้ยอดติดลบ

## API Contract

`GET /api/stock/status-convert` ควรส่ง:

- `rows`
- `reference.branches`
- `reference.warehouses`
- `reference.products`

`POST /api/stock/status-convert` รับ:

- `date`
- `branchId`
- `warehouseId`
- `productId`
- `lotNo`
- `fromStatus`
- `toStatus`
- `qty`
- `reason`
- `notes`

## Current Implementation / Gap

- มี write baseline ที่สร้าง paired `SC` ledger rows แล้ว
- ปัจจุบันควรตรวจเพิ่มให้ใช้ hold-aware available qty
- ต้องเพิ่ม field-level validation/error display ให้ครบ
- ต้องออกแบบ reverse/cancel และ reconciliation query
- ต้องยืนยัน list/detail/export แสดง `วันที่สร้างรายการ`

## Related Notes

- [[Stock Ledger and Stock Balance]]
- [[Stock Balance Page Flow]]
- [[Stock Ledger Page Flow]]
