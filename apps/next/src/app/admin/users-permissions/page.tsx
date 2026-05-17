import type { Metadata } from 'next'
import { AdminUsersPageClient } from '@/app/admin/users-permissions/AdminUsersPageClient'

export const metadata: Metadata = {
  title: 'Users & Permissions | NS Scrap ERP',
}

export default function AdminUsersPermissionsPage() {
  return <AdminUsersPageClient />
}
