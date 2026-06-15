import { toDateOnly } from '@/lib/server/daily'

export type FinancialAgingBucket = 'Current' | '1-30' | '31-60' | '61-90' | '>90'
export type FinancialAgingBucketTotals = Record<FinancialAgingBucket, { amount: number; count: number }>
export type ReferenceDateType = 'dueDate' | 'creditTerm' | 'documentDate'

export type FinancialDueAging = {
  ageBucket: FinancialAgingBucket
  ageDays: number
  asOfDate: string
  referenceDate: string
  referenceDateType: ReferenceDateType
}

export const financialAgingBuckets: FinancialAgingBucket[] = ['Current', '1-30', '31-60', '61-90', '>90']

export function financialAgeBucket(days: number): FinancialAgingBucket {
  if (days <= 0) return 'Current'
  if (days <= 30) return '1-30'
  if (days <= 60) return '31-60'
  if (days <= 90) return '61-90'
  return '>90'
}

export function emptyFinancialAgingBucketTotals(): FinancialAgingBucketTotals {
  return {
    '1-30': { amount: 0, count: 0 },
    '31-60': { amount: 0, count: 0 },
    '61-90': { amount: 0, count: 0 },
    '>90': { amount: 0, count: 0 },
    Current: { amount: 0, count: 0 },
  }
}

export function addToFinancialAgingBucketTotals(
  totals: FinancialAgingBucketTotals,
  bucket: FinancialAgingBucket,
  amount: number,
) {
  totals[bucket].amount += amount
  totals[bucket].count += 1
}

export function computeFinancialDueAging(input: {
  asOfDate?: Date
  creditTermDays?: number | null
  documentDate: Date
  dueDate?: Date | null
}): FinancialDueAging {
  const asOfDate = input.asOfDate ?? new Date()
  const referenceDate = input.dueDate ? new Date(input.dueDate) : new Date(input.documentDate)
  let referenceDateType: ReferenceDateType = input.dueDate ? 'dueDate' : 'documentDate'
  if (!input.dueDate && input.creditTermDays != null && input.creditTermDays > 0) {
    referenceDate.setDate(referenceDate.getDate() + input.creditTermDays)
    referenceDateType = 'creditTerm'
  }
  const ageDays = Math.floor((Date.UTC(asOfDate.getFullYear(), asOfDate.getMonth(), asOfDate.getDate()) - Date.UTC(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate())) / 86400000)
  return {
    ageBucket: financialAgeBucket(ageDays),
    ageDays,
    asOfDate: toDateOnly(asOfDate),
    referenceDate: toDateOnly(referenceDate),
    referenceDateType,
  }
}
