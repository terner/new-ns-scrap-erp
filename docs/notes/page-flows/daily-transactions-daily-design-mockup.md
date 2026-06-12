---
title: Design Mockup Page Flow
tags:
  - page-flow
  - menu
status: draft
updated: 2026-06-11
route: /daily/design-mockup
---

# Design Mockup Page Flow

## Scope

| Field | Value |
|---|---|
| Menu section | Daily Transactions |
| Route | `/daily/design-mockup` |
| Page | Design Mockup |
| Current Next | design/reference page |

## Canonical References

[[Architecture Map]], [[Menu Page Flow Catalog]]

## Flow Baseline

หน้า reference/mockup สำหรับดู pattern UI/design ของ daily transaction pages ไม่ใช่ business transaction page

## Page Responsibilities

- แสดงตัวอย่าง layout/control/table/modal pattern สำหรับทีมพัฒนา
- ใช้อ้างอิง design baseline ก่อนแก้หน้า transaction จริง
- แยกตัวอย่าง UI ออกจาก production business flow เพื่อไม่ให้เกิด side effect
- ช่วยตรวจ wording/control density/section grouping ตาม `docs/design.md`

## Non-Responsibilities

- ไม่สร้าง/แก้เอกสารธุรกิจ
- ไม่เรียก API transaction เพื่อเขียนข้อมูลจริง
- ไม่เป็น source of truth ของ master data หรือ report formula
- ไม่ใช้เป็นทางลัดเพื่อ bypass validation ของหน้าจริง

## Lifecycle / Read Flow

| Step | User action | System result |
|---|---|---|
| 1 | เปิดหน้า | render static/client mockup components |
| 2 | ดูตัวอย่าง | เปรียบเทียบ layout/control กับหน้าจริง |
| 3 | นำไปใช้ | update business page ที่เกี่ยวข้อง ไม่ใช่ mockup page |

## API / Data Contract

### Current API

- `Current specific API not found; page should remain static/reference unless a future design-preview data source is explicitly approved`

### Data Contract

- ถ้าต้องใช้ mock data ให้เก็บใน component/local fixture ไม่เขียน DB
- ห้ามใช้ production transaction API เพื่อสร้างข้อมูลตัวอย่าง
- ถ้า pattern ถูกย้ายไปใช้จริง ต้องอัปเดต `docs/design.md` หรือ page-flow ของหน้าจริง

## Validation / Status Rules

- ไม่มี document status เพราะไม่ใช่เอกสารธุรกิจ
- ไม่มี required business fields ที่ต้องบันทึกลง DB
- UI pattern ที่นำไปใช้จริงต้องผ่าน validation ของหน้าปลายทาง ไม่ใช่ validation ของ mockup

## Side Effects

- read/static only ไม่มี DB side effect
- ไม่มี stock/payment/accounting side effect

## Current Gap

ต้องตัดสินใจระยะยาวว่าจะเก็บหน้านี้ไว้ในเมนู production หรือย้ายเป็น internal design reference

## Implementation Checklist

- [ ] Verify page remains side-effect free
- [ ] Sync reusable pattern back to `docs/design.md` when finalized
- [ ] Do not wire production write APIs into this page
