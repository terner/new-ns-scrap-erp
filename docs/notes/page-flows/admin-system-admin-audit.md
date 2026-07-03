---
title: Audit & Activity Log Page Flow
tags:
  - page-flow
  - menu
  - admin-system
status: accepted-baseline
updated: 2026-07-02
route: /admin/audit
---

# Audit & Activity Log Page Flow

## Scope

| Field | Value |
|---|---|
| Menu section | Admin / System |
| Route | `/admin/audit` |
| Page | Audit & Activity Log |
| Current Next | accepted code baseline |

## Canonical References

[[System Supporting Flows]], [[Menu Page Flow Catalog]]

## Flow Baseline

audit/activity log read model from app_audit_logs/auth-events API

## Page Responsibilities

- แสดง audit/activity events สำหรับ admin investigation
- filter group, actor, eventType, target, query, pagination ตาม current component
- เปิด detail ของ event row
- ใช้ API auth-events เป็น source หลักของหน้านี้

- table presentation uses the shared resizable/sortable fixed-layout table mechanics; sorting is UI-only on the current loaded page

## Non-Responsibilities

- ไม่สร้างหรือแก้ audit event จากหน้านี้
- ไม่ใช้ /api/activity เป็น list source ของหน้านี้ใน current code
- ไม่แก้ business document

## Lifecycle / Support Flow

| Step | User action | System result |
|---|---|---|
| 1 | เปิดหน้า | GET /api/admin/auth-events with filters |
| 2 | filter/paginate | ส่ง query params group/actor/eventType/target/q/page/pageSize |
| 3 | เลือก row | แสดง detail ใน UI |
| 4 | audit source | อ่านจาก app_audit_logs/auth event stream ตาม API |

## API / Data Contract

### Current API

- `GET /api/admin/auth-events - audit/activity list for this page`
- `POST /api/activity exists as support event ingest, not the current list API for /admin/audit`

### Data Contract

- user identity ต้องมาจาก authenticated context ไม่รับ actor จาก form
- admin/support action ต้อง enforce permission ที่ API ระบุ
- admin/support pages ต้องไม่เขียน business transaction facts
- current code ใน `apps/next` เป็น proof baseline ของ P3 admin/system ณ 2026-06-11

## Validation / Status Rules

- requires permission system.audit.view
- filters must not expose unauthorized audit data
- current code เป็น proof baseline

- UI table sort/resize must not change audit source, permission boundary, or query contract

## Side Effects

- read-only audit page ไม่มี business side effect
- /api/activity support ingest is separate from page read flow

## Current Gap

P3 proof completed from current code.

## Implementation Checklist

- [x] Verify current page/component API calls
- [x] Verify current API route methods and permission boundary
- [x] Keep business transaction side effects out of this page
- [x] Update this file for the 2026-07-02 table mechanics presentation change
