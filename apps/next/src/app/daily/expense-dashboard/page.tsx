import type { Metadata } from 'next'
import { DailyExpensePageClient } from '@/components/daily/DailyExpensePageClient'

export const metadata: Metadata = {
  title: 'Dashboard ค่าใช้จ่าย | NS Scrap ERP',
}

export default function DailyExpenseDashboardPage() {
  return <DailyExpensePageClient dashboardOnly />
}
