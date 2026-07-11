import { z } from 'zod'
import { currentActor } from '@/lib/server/daily'
import { prisma } from '@/lib/server/prisma'

const SALES_PLAN_LME_CONFIG_KEY = 'SALES_PLAN_LME_CONFIG'

const salesPlanLmeConfigSchema = z.object({
  fxRate: z.coerce.number().finite().min(0),
  kgPerContainer: z.coerce.number().finite().min(0),
  lmeAluminumUSD: z.coerce.number().finite().min(0),
  lmeBrassUSD: z.coerce.number().finite().min(0),
  lmeCopperUSD: z.coerce.number().finite().min(0),
  liveFetchNote: z.string().trim().max(500).default(''),
  source: z.enum(['default', 'live', 'manual', 'mixed']).default('default'),
})

export type SalesPlanLmeConfigInput = z.infer<typeof salesPlanLmeConfigSchema>

export type SalesPlanLmeConfig = SalesPlanLmeConfigInput & {
  updatedAt: string
  updatedBy: string
}

const defaultSalesPlanLmeConfig: SalesPlanLmeConfigInput = {
  fxRate: 36,
  kgPerContainer: 25000,
  lmeAluminumUSD: 2400,
  lmeBrassUSD: 7000,
  lmeCopperUSD: 9000,
  liveFetchNote: 'USD/THB และ LME แก้ไขได้จากหน้านี้ ส่วน กก./ตู้ ต้องกรอกเอง',
  source: 'default',
}

function toConfig(row: { updated_at: Date; updated_by: string | null; value: string | null } | null) {
  let parsed: ReturnType<typeof salesPlanLmeConfigSchema.safeParse> | null = null
  if (row?.value) {
    try {
      parsed = salesPlanLmeConfigSchema.safeParse(JSON.parse(row.value))
    } catch {
      parsed = null
    }
  }
  const values = parsed?.success ? parsed.data : defaultSalesPlanLmeConfig
  return {
    ...defaultSalesPlanLmeConfig,
    ...values,
    updatedAt: row?.updated_at.toISOString() ?? '2026-05-19T00:00:00.000Z',
    updatedBy: row?.updated_by?.trim() || 'source',
  } satisfies SalesPlanLmeConfig
}

export async function getSalesPlanLmeConfig() {
  const row = await prisma.system_settings.findUnique({
    where: { key: SALES_PLAN_LME_CONFIG_KEY },
  })
  return toConfig(row)
}

export async function saveSalesPlanLmeConfig(
  values: SalesPlanLmeConfigInput,
  context: Parameters<typeof currentActor>[0],
) {
  const parsed = salesPlanLmeConfigSchema.parse(values)
  const row = await prisma.system_settings.upsert({
    where: { key: SALES_PLAN_LME_CONFIG_KEY },
    create: {
      description: 'Sales Plan LME reference pricing config',
      key: SALES_PLAN_LME_CONFIG_KEY,
      updated_by: currentActor(context),
      value: JSON.stringify(parsed),
    },
    update: {
      description: 'Sales Plan LME reference pricing config',
      updated_at: new Date(),
      updated_by: currentActor(context),
      value: JSON.stringify(parsed),
    },
  })
  return toConfig(row)
}

function parseFxRatePayload(payload: unknown) {
  if (!payload || typeof payload !== 'object') return null
  const rates = (payload as { conversion_rates?: Record<string, unknown> }).conversion_rates
  const thbRate = typeof rates?.THB === 'number' ? rates.THB : Number(rates?.THB ?? 0)
  return Number.isFinite(thbRate) && thbRate > 0 ? thbRate : null
}

function parseMetalsPayload(payload: unknown) {
  if (!payload || typeof payload !== 'object') return {}
  const metals = (payload as { metals?: Record<string, unknown> }).metals ?? {}
  const read = (keys: string[]) => {
    const key = keys.find((candidate) => metals[candidate] !== undefined)
    const value = key ? Number(metals[key]) : Number.NaN
    return Number.isFinite(value) && value > 0 ? value : null
  }
  return {
    aluminum: read(['aluminum', 'lme_aluminum']),
    copper: read(['copper', 'lme_copper']),
  }
}

async function fetchUsdThbRate() {
  const apiKey = process.env.EXCHANGERATE_API_KEY
  if (!apiKey) return { error: 'ไม่ได้ตั้งค่า EXCHANGERATE_API_KEY' as const }

  const response = await fetch(`https://v6.exchangerate-api.com/v6/${encodeURIComponent(apiKey)}/latest/USD`, {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) return { error: `ExchangeRate API ตอบกลับ ${response.status}` as const }
  const rate = parseFxRatePayload(await response.json())
  if (!rate) return { error: 'อ่านค่า USD/THB จาก ExchangeRate API ไม่ได้' as const }
  return { rate }
}

async function fetchMetalsValues() {
  const apiKey = process.env.METALS_DEV_API_KEY
  if (!apiKey) return { error: 'ไม่ได้ตั้งค่า METALS_DEV_API_KEY' as const }

  const response = await fetch(`https://api.metals.dev/v1/latest?api_key=${encodeURIComponent(apiKey)}&currency=USD&unit=mt`, {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) return { error: `Metals.dev ตอบกลับ ${response.status}` as const }
  const metals = parseMetalsPayload(await response.json())
  if (!metals.copper && !metals.aluminum) return { error: 'อ่านค่าทองแดง/อลูมิเนียมจาก Metals.dev ไม่ได้' as const }
  return metals
}

export async function fetchLiveSalesPlanLmeConfig(currentConfig: SalesPlanLmeConfig) {
  const [fxResult, metalsResult] = await Promise.all([
    fetchUsdThbRate(),
    fetchMetalsValues(),
  ])

  const notes: string[] = ['Live fetch: USD/THB จาก exchangerate-api และ Metals จาก metals.dev']
  if ('error' in fxResult) notes.push(`USD/THB ใช้ค่าเดิม (${fxResult.error})`)
  if ('error' in metalsResult) notes.push(`Metals ใช้ค่าเดิม (${metalsResult.error})`)
  if (!('error' in metalsResult)) notes.push('ทองเหลืองยังให้ผู้ใช้กรอกเอง/คงค่า manual')
  notes.push('กก./ตู้ ไม่ดึงจาก API และต้องกรอกเอง')

  return salesPlanLmeConfigSchema.parse({
    fxRate: 'error' in fxResult ? currentConfig.fxRate : fxResult.rate,
    kgPerContainer: currentConfig.kgPerContainer,
    lmeAluminumUSD: 'error' in metalsResult ? currentConfig.lmeAluminumUSD : (metalsResult.aluminum ?? currentConfig.lmeAluminumUSD),
    lmeBrassUSD: currentConfig.lmeBrassUSD,
    lmeCopperUSD: 'error' in metalsResult ? currentConfig.lmeCopperUSD : (metalsResult.copper ?? currentConfig.lmeCopperUSD),
    liveFetchNote: `${notes.join(' · ')} · fetched ${new Date().toISOString()}`,
    source: 'mixed',
  })
}
