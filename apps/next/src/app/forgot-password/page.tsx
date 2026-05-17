import type { Metadata } from 'next'
import { ForgotPasswordPageClient } from '@/app/forgot-password/ForgotPasswordPageClient'

export const metadata: Metadata = {
  title: 'Forgot Password | NS Scrap ERP',
}

export default function ForgotPasswordPage() {
  return <ForgotPasswordPageClient />
}
