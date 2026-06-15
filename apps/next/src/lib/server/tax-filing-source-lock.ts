import type { Prisma } from '../../../generated/prisma/client'
import { toDateOnly } from '@/lib/server/daily'

export type TaxFilingSourceLockTaxType = 'VAT' | 'WHT'

type TaxFilingSourceLockClient = {
  tax_filings: {
    findMany: (args: {
      orderBy?: Prisma.tax_filingsOrderByWithRelationInput[]
      select: {
        filing_no: true
        lock_reason: true
        locked_at: true
        period_month: true
        period_year: true
        tax_type: true
      }
      where: Prisma.tax_filingsWhereInput
    }) => Promise<Array<{
      filing_no: string
      lock_reason: string | null
      locked_at: Date | null
      period_month: number
      period_year: number
      tax_type: string
    }>>
  }
}

const TAX_FILING_SOURCE_LOCK_SELECT = {
  filing_no: true,
  lock_reason: true,
  locked_at: true,
  period_month: true,
  period_year: true,
  tax_type: true,
} as const

function periodFromDate(date: Date) {
  const dateOnly = toDateOnly(date)
  const [year, month] = dateOnly.split('-').map((part) => Number.parseInt(part, 10))
  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    throw new Error('วันที่เอกสารไม่ถูกต้อง')
  }
  return { month, year }
}

function uniqueTaxTypes(taxTypes: TaxFilingSourceLockTaxType[]) {
  return Array.from(new Set(taxTypes)).sort()
}

export async function assertTaxFilingPeriodUnlocked(
  client: TaxFilingSourceLockClient,
  input: {
    date: Date
    sourceLabel: string
    taxTypes: TaxFilingSourceLockTaxType[]
  },
) {
  const taxTypes = uniqueTaxTypes(input.taxTypes)
  if (taxTypes.length === 0) return

  const period = periodFromDate(input.date)
  const lockedFilings = await client.tax_filings.findMany({
    orderBy: [{ tax_type: 'asc' }],
    select: TAX_FILING_SOURCE_LOCK_SELECT,
    where: {
      locked_at: { not: null },
      period_month: period.month,
      period_year: period.year,
      tax_type: { in: taxTypes },
    },
  })
  if (lockedFilings.length === 0) return

  const periodLabel = `${period.year}-${String(period.month).padStart(2, '0')}`
  const filingLabels = lockedFilings.map((filing) => {
    const reason = filing.lock_reason ? `: ${filing.lock_reason}` : ''
    return `${filing.tax_type} ${filing.filing_no}${reason}`
  }).join(', ')
  throw new Error(`${input.sourceLabel} กระทบงวดภาษี ${periodLabel} ที่ล็อกแล้ว (${filingLabels}) ต้องใช้ correction/reversal workflow แทนการแก้ไขเอกสารต้นทาง`)
}

export async function assertTaxFilingDatesUnlocked(
  client: TaxFilingSourceLockClient,
  input: {
    dates: Date[]
    sourceLabel: string
    taxTypes: TaxFilingSourceLockTaxType[]
  },
) {
  const periods = new Map<string, Date>()
  for (const date of input.dates) {
    const period = periodFromDate(date)
    periods.set(`${period.year}-${period.month}`, date)
  }
  for (const date of periods.values()) {
    await assertTaxFilingPeriodUnlocked(client, { date, sourceLabel: input.sourceLabel, taxTypes: input.taxTypes })
  }
}
