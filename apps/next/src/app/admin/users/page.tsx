import type { Metadata } from 'next'
import { AdminUsersPageClient } from '@/app/admin/users-permissions/AdminUsersPageClient'

export const metadata: Metadata = {
  title: 'รายชื่อพนักงาน / Users | NS Scrap ERP',
}

export default function AdminUsersPage() {
  return <AdminUsersPageClient mode="users" />
}
