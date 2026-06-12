---
title: ข้อมูลบริษัท Page Flow
tags:
  - page-flow
  - menu
  - admin-system
status: accepted-baseline
updated: 2026-06-11
route: /admin/company-profile
---

# ข้อมูลบริษัท Page Flow

## Scope

| Field | Value |
|---|---|
| Menu section | Admin / System |
| Route | `/admin/company-profile` |
| Page | ข้อมูลบริษัท |
| Current Next | accepted code baseline |

## Canonical References

[[System Supporting Flows]], [[Menu Page Flow Catalog]]

## Flow Baseline

company profile per branch for printable document headers

## Page Responsibilities

- จัดการข้อมูลบริษัทสำหรับใบพิมพ์แยกตามสาขา
- โหลด active branches และ profile ที่ bind กับ branch
- บันทึกผ่าน PUT พร้อม branchId
- เป็น source ของ print header ใน PB/SB/POB/PMT/RCP และเอกสารพิมพ์อื่น

## Non-Responsibilities

- ไม่สร้าง business document
- ไม่แก้ข้อมูลบริษัทในเอกสารที่พิมพ์/ออกไปแล้วแบบย้อนหลัง
- ไม่ใช้ hardcoded company fallback ในเอกสารพิมพ์ target

## Lifecycle / Support Flow

| Step | User action | System result |
|---|---|---|
| 1 | เปิดหน้า | GET company profile + active branches |
| 2 | เลือกสาขา | GET profile ของ branch ที่เลือก |
| 3 | แก้ profile | validate companyProfileSchema |
| 4 | บันทึก | PUT profile สำหรับ branch |
| 5 | print docs | เอกสารพิมพ์อ่าน profile ตาม branch |

## API / Data Contract

### Current API

- `GET /api/admin/company-profile?branchId=... - load branches/profile`
- `PUT /api/admin/company-profile - save branch company profile`

### Data Contract

- user identity ต้องมาจาก authenticated context ไม่รับ actor จาก form
- admin/support action ต้อง enforce permission ที่ API ระบุ
- admin/support pages ต้องไม่เขียน business transaction facts
- current code ใน `apps/next` เป็น proof baseline ของ P3 admin/system ณ 2026-06-11

## Validation / Status Rules

- requires permission system.settings.manage
- branchId required และต้องเป็น active branch
- company profile fields validate ตาม schema current code
- current code เป็น proof baseline

## Side Effects

- เขียน company profile/support data เท่านั้น
- ไม่มี transaction side effect

## Current Gap

P3 proof completed from current code. Remaining work: keep printable docs synced with this source.

## Implementation Checklist

- [x] Verify current page/component API calls
- [x] Verify current API route methods and permission boundary
- [x] Keep business transaction side effects out of this page
- [ ] Update this file if admin/system code changes
