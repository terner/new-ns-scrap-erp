import type { Metadata } from 'next'
import { Suspense } from 'react'
import { LoginPageClient } from '@/app/login/LoginPageClient'

export const metadata: Metadata = {
  title: 'Login | NS Scrap ERP',
}

export default function LoginPage() {
  const devLogin = process.env.NEXT_PUBLIC_ENABLE_TEST_LOGIN_PREFILL === '1' || process.env.NODE_ENV !== 'production'
    ? {
        identifier: process.env.NEXT_PUBLIC_TEST_LOGIN_IDENTIFIER ?? process.env.DEV_LOGIN_IDENTIFIER ?? '',
        password: process.env.NEXT_PUBLIC_TEST_LOGIN_PASSWORD ?? process.env.DEV_LOGIN_PASSWORD ?? '',
      }
    : undefined

  return (
    <Suspense>
      <LoginPageClient devLogin={devLogin} />
    </Suspense>
  )
}
