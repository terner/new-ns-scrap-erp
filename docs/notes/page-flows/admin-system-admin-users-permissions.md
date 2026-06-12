---
title: Users & Permissions Page Flow
tags:
  - page-flow
  - menu
  - admin-system
status: accepted-baseline
updated: 2026-06-11
route: /admin/users-permissions
---

# Users & Permissions Page Flow

## Scope

| Field | Value |
|---|---|
| Menu section | Admin / System |
| Route | `/admin/users-permissions` |
| Page | Users & Permissions |
| Current Next | accepted code baseline |

## Canonical References

[[System Supporting Flows]], [[Menu Page Flow Catalog]]

## Flow Baseline

admin user management with roles, branch access, invite/reset, and active status

## Page Responsibilities

- list users, roles, active branches จาก /api/admin/users
- create/update app user with roleIds and branchIds
- toggle active status ผ่าน status API
- send invite/reset password ผ่าน invite API
- record auth audit events for admin user actions

## Non-Responsibilities

- ไม่เก็บ password ใน application table
- ไม่ bypass Supabase Auth invite/reset flow
- ไม่สร้าง business transaction
- ไม่แก้ role matrix โดยไม่มี API/schema support

## Lifecycle / Support Flow

| Step | User action | System result |
|---|---|---|
| 1 | เปิดหน้า | GET users/roles/branches |
| 2 | สร้าง user | POST username/displayName/email/roleIds/branchIds |
| 3 | แก้ user | PATCH /api/admin/users/[id] |
| 4 | เปิด/ปิด user | PATCH status; ห้ามปิดบัญชีตัวเอง |
| 5 | invite/reset | POST invite; ใช้ Supabase invite/reset ตาม auth state |

## API / Data Contract

### Current API

- `GET /api/admin/users - users/roles/branches`
- `POST /api/admin/users - create app user`
- `PATCH /api/admin/users/[id] - update app user roles/branches`
- `PATCH /api/admin/users/[id]/status - active/inactive user`
- `POST /api/admin/users/[id]/invite - invite or reset password`

### Data Contract

- user identity ต้องมาจาก authenticated context ไม่รับ actor จาก form
- admin/support action ต้อง enforce permission ที่ API ระบุ
- admin/support pages ต้องไม่เขียน business transaction facts
- current code ใน `apps/next` เป็น proof baseline ของ P3 admin/system ณ 2026-06-11

## Validation / Status Rules

- requires permission system.users.manage
- username/displayName/email required; email format basic validated in client and server schema
- roleIds required อย่างน้อย 1
- branchIds resolve จาก active branch code
- ห้ามปิดบัญชีตัวเอง
- invite requires email and active user; service role required for new invite path

## Side Effects

- writes app_users/app_user_roles/app_user_branch_access
- may call Supabase Auth invite/reset
- records auth audit events
- ไม่มี business transaction side effect

## Current Gap

P3 proof completed from current code. Role/permission matrix future changes should update System Supporting Flows.

## Implementation Checklist

- [x] Verify current page/component API calls
- [x] Verify current API route methods and permission boundary
- [x] Keep business transaction side effects out of this page
- [ ] Update this file if admin/system code changes
