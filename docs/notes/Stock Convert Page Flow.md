---
title: Stock Convert Page Flow
aliases:
  - Grade Adjustment Page
  - Stock Grade Convert Page
  - Flow หน้าปรับเกรดสินค้า
  - หน้า Stock Convert
tags:
  - ns-scrap-erp
  - stock
  - inventory
  - page-flow
  - stock-convert
status: draft
created: 2026-06-11
updated: 2026-06-11
---

# Stock Convert Page Flow / Flow หน้าปรับเกรดสินค้า

## Scope

- Route: `/stock/convert`
- API: `GET /api/stock/convert`, `POST /api/stock/convert`
- Owner: Stock / Inventory
- Page type: stock movement write flow
- Ledger ref type: `GA`

หน้านี้ใช้แปลงสินค้า/ปรับเกรดจากสินค้าต้นทางเป็นสินค้าปลายทางในคลังเดียวกัน เช่น แปลงเกรดหรือแยกสภาพสินค้า โดยจำนวนปลายทางอาจต่างจากต้นทางจาก loss/yield

## Source Of Truth

- audit/header: `grade_adjustments`
- movement: `stock_ledger.ref_type = 'GA'`
- 1 เอกสาร `GA` ต้องมี paired rows:
  - out จากสินค้าต้นทาง
  - in เข้าสินค้าปลายทาง

## Main UI Contract

### List

ควรแสดง:

- เลขที่เอกสาร
- วันที่เอกสาร
- วันที่สร้างรายการ
- source type
- สาขา/คลัง
- สินค้าต้นทาง
- จำนวนต้นทาง
- สินค้าปลายทาง
- จำนวนปลายทาง
- loss/yield
- cost status
- unit cost
- มูลค่า
- สถานะ

### Filters

ควรรองรับ:

- ค้นหาเลขที่ / source / target / ref
- source type
- cost status
- สาขา/คลัง
- วันที่
- สินค้าต้นทาง/ปลายทาง

## Create Modal Contract

### Source Section

- วันที่เอกสาร
- สาขา
- คลัง
- สินค้าต้นทาง
- Lot ต้นทาง
- จำนวนต้นทาง

### Target Section

- สินค้าปลายทาง
- Lot ปลายทาง
- จำนวนปลายทาง

### Reason / Cost Section

- เหตุผล
- หมายเหตุ
- loss/yield summary
- cost flow preview

Target validation:

- source product และ target product ต้อง active
- source/target ต้องไม่เป็น key เดียวกันทั้งหมด
- source qty และ target qty ต้องมากกว่า 0
- source key ต้องมี `พร้อมใช้` เพียงพอ
- สาขา/คลังต้อง active และสัมพันธ์กัน

## Ledger Side Effect

เมื่อบันทึกสำเร็จ:

- สร้าง `grade_adjustments` audit row
- source row: `ref_type = 'GA'`, `movement_type = GRADE_ADJUST_OUT`, `qty_out`
- target row: `ref_type = 'GA'`, `movement_type = GRADE_ADJUST_IN`, `qty_in`
- source value ใช้ WAC/average cost ของ source key
- target value ใช้ cost policy เดียวกันจนกว่าจะมี cost allocation policy ที่ละเอียดกว่า
- `ref_no` ต้องตรงกับ `grade_adjustments.doc_no`

## Cost Policy

Target เบื้องต้น:

- ใช้ source WAC เป็น cost basis
- loss/yield เป็น quantity difference ที่ต้อง audit ได้
- P&L หรือ variance accounting ยังไม่ลงบัญชีจนกว่าจะมี accounting policy
- cost status เช่น `allocated`, `pending_cost`, `partial` เป็น display/read-model ได้ แต่ write policy ต้องชัดก่อนเปิด confirm/reverse จริง

## Cancel / Reverse Policy

Target ที่ควรใช้:

- ไม่แก้ ledger row เก่าโดยตรง
- ถ้าผิดให้ reverse ด้วย `GA` reversal หรือสร้าง adjustment กลับตาม policy
- ต้อง block reverse ถ้า target stock ถูกใช้ต่อแล้วและ reverse ทำให้ติดลบ

## API Contract

`GET /api/stock/convert` ควรส่ง:

- `rows`
- `reference.branches`
- `reference.warehouses`
- `reference.products`

`POST /api/stock/convert` รับ:

- `date`
- `branchId`
- `warehouseId`
- `sourceProductId`
- `sourceQty`
- `lotNo`
- `targetProductId`
- `targetQty`
- `targetLotNo`
- `reason`
- `notes`

## Current Implementation / Gap

- มี write baseline ที่สร้าง `grade_adjustments` และ paired `GA` ledger rows แล้ว
- ต้องเพิ่ม hold-aware available check ก่อนตัด source
- manual lot allocation, pending/partial cost, confirm cost, reverse ยัง deferred
- ต้องเพิ่ม reconciliation query ต่อ ref no
- ต้องยืนยัน list/detail/export แสดง `วันที่สร้างรายการ`

## Related Notes

- [[Stock Ledger and Stock Balance]]
- [[Stock Balance Page Flow]]
- [[Stock Ledger Page Flow]]
