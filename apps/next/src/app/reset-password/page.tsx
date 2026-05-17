import type { Metadata } from 'next'
import { ResetPasswordPageClient } from '@/app/reset-password/ResetPasswordPageClient'

export const metadata: Metadata = {
  title: 'Reset Password | NS Scrap ERP',
}

export default function ResetPasswordPage() {
  return <ResetPasswordPageClient />
}
