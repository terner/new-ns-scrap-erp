import type { Metadata } from 'next'
import { AdminUsersPageClient } from '@/app/admin/users-permissions/AdminUsersPageClient'

export const metadata: Metadata = {
  title: 'Roles & Permissions | NS Scrap ERP',
}

export default function AdminRolesPermissionsPage() {
  return <AdminUsersPageClient mode="roles" />
}
