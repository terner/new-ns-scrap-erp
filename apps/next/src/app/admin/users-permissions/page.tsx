import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  title: 'Users & Permissions | NS Scrap ERP',
}

export default function AdminUsersPermissionsPage() {
  redirect('/admin/users')
}
