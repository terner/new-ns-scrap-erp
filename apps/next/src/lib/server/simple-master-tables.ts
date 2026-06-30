import { z } from 'zod'
import { parseInternalBigIntId } from '@/lib/business-code'
import { prisma } from '@/lib/server/prisma'
import { getCurrentAuthContext, requirePermission } from '@/lib/server/auth-context'
import { findActiveBranchReferenceByCodeOrId } from '@/lib/server/branch-reference'
import {
  masterDataJson,
  masterDataListJson,
  nextSequentialCode,
  parseMasterDataForm,
  toIso,
  toNumber,
  updateMasterDataStatusSchema,
} from '@/lib/server/master-data'

type SimpleMasterKind = 'accountSubtypes' | 'bankNames' | 'directors' | 'expenseTypes' | 'machineTypes' | 'machines' | 'paymentMethods' | 'productionLines' | 'productTypes' | 'productUnits' | 'remittancePurposes' | 'vatSettings' | 'whtSettings'

type Delegate = {
  findMany: (args?: unknown) => Promise<unknown[]>
  findFirst: (args?: unknown) => Promise<unknown | null>
  upsert: (args: unknown) => Promise<unknown>
  create: (args: unknown) => Promise<unknown>
  update: (args: unknown) => Promise<unknown>
}

type SimpleMasterConfig = {
  delegate: () => Delegate
  prefix: string
  orderBy: unknown
  include?: unknown
  lookupKey?: 'id' | 'code'
  coerceLookupValue?: (value: string) => unknown
  map: (row: unknown) => Record<string, unknown>
  data: (values: ReturnType<typeof parseMasterDataForm>, id: string, code: string) => Record<string, unknown>
  normalizeValues?: (values: ReturnType<typeof parseMasterDataForm>) => Promise<ReturnType<typeof parseMasterDataForm>>
  nextId?: () => Promise<string>
}

const asRecord = (row: unknown) => row as Record<string, unknown>
const directorTitleSchema = z.enum(['นาย', 'นาง', 'นางสาว'], {
  invalid_type_error: 'เลือกคำนำหน้าชื่อ',
  required_error: 'เลือกคำนำหน้าชื่อ',
})
const directorTypeSchema = z.enum(['กรรมการ', 'ผู้ถือหุ้น', 'พนักงาน', 'บุคคลที่เกี่ยวข้อง'], {
  invalid_type_error: 'เลือกประเภท',
  required_error: 'เลือกประเภท',
})
const directorPersonSchema = z.object({
  accountName: z.string().nullable(),
  accountNo: z.string().nullable(),
  bankAccounts: z.array(z.object({
    active: z.boolean().default(true),
    accountName: z.string().nullable(),
    accountNo: z.string().nullable(),
    bankBranch: z.string().nullable(),
    bankName: z.string().nullable(),
    code: z.string().nullable(),
    id: z.string().nullable(),
    isPrimary: z.boolean().default(false),
    linkedAccountId: z.string().nullable(),
    sourceType: z.enum(['IN_COMPANY', 'OUTSIDE_COMPANY']).default('OUTSIDE_COMPANY'),
  })).default([]),
  bankBranch: z.string().nullable(),
  bankName: z.string().nullable(),
  firstName: z.string({ invalid_type_error: 'กรอกชื่อ', required_error: 'กรอกชื่อ' }).trim().min(1, 'กรอกชื่อ'),
  lastName: z.string({ invalid_type_error: 'กรอกนามสกุล', required_error: 'กรอกนามสกุล' }).trim().min(1, 'กรอกนามสกุล'),
  nameTitle: directorTitleSchema,
  type: directorTypeSchema,
}).superRefine((values, context) => {
  values.bankAccounts.forEach((account, index) => {
    const hasBankInfo = Boolean(account.bankName || account.accountNo || account.accountName || account.bankBranch || account.linkedAccountId)
    if (!hasBankInfo) return
    if (account.sourceType === 'IN_COMPANY') {
      if (!account.linkedAccountId) context.addIssue({ code: z.ZodIssueCode.custom, message: 'เลือกบัญชีในบริษัท', path: ['bankAccounts', index, 'linkedAccountId'] })
      return
    }
    if (!account.bankName) context.addIssue({ code: z.ZodIssueCode.custom, message: 'เลือกธนาคาร', path: ['bankAccounts', index, 'bankName'] })
    if (!account.accountName) context.addIssue({ code: z.ZodIssueCode.custom, message: 'กรอกชื่อบัญชี', path: ['bankAccounts', index, 'accountName'] })
    if (!account.accountNo) context.addIssue({ code: z.ZodIssueCode.custom, message: 'กรอกเลขบัญชี', path: ['bankAccounts', index, 'accountNo'] })
  })
})

type SimpleMasterValues = ReturnType<typeof parseMasterDataForm>

function trimText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function directorDisplayName(values: Pick<SimpleMasterValues, 'firstName' | 'lastName' | 'nameTitle'>) {
  return [values.nameTitle, values.firstName, values.lastName].map((part) => part?.trim()).filter(Boolean).join(' ')
}

function directorBankAccountCode(personCode: string, index: number) {
  return `${personCode}-BA${String(index + 1).padStart(3, '0')}`
}

function prepareSimpleMasterBody(kind: SimpleMasterKind, body: unknown) {
  if (kind !== 'directors' || body === null || typeof body !== 'object' || Array.isArray(body)) return body

  const record = body as Record<string, unknown>
  const name = [record.nameTitle, record.firstName, record.lastName].map(trimText).filter(Boolean).join(' ')
  return { ...record, name: name || '-' }
}

async function nextBankNameId() {
  const rows = await prisma.bank_names.findMany({ select: { code: true } })
  const maxNumber = rows.reduce((max, row) => {
    const matched = row.code.match(/^BANK-(\d+)$/i)
    const value = matched ? Number(matched[1]) : 0
    return Number.isFinite(value) ? Math.max(max, value) : max
  }, 0)
  return `BANK-${String(maxNumber + 1).padStart(3, '0')}`
}

async function nextDirectorPersonCode() {
  const rows = await prisma.director_employees.findMany({ select: { code: true } })
  const maxNumber = rows.reduce((max, row) => {
    const matched = row.code.match(/^P(\d+)$/i)
    const value = matched ? Number(matched[1]) : 0
    return Number.isFinite(value) ? Math.max(max, value) : max
  }, 0)
  return `P${String(maxNumber + 1).padStart(3, '0')}`
}

function permissionForSimpleMaster(kind: SimpleMasterKind, action: 'manage' | 'view') {
  if (kind === 'vatSettings' || kind === 'whtSettings') return 'system.settings.manage'
  return action === 'manage' ? 'master.reference.manage' : 'master.reference.view'
}

function requireSimpleMasterPermission(kind: SimpleMasterKind, action: 'manage' | 'view') {
  return getCurrentAuthContext().then((context) => requirePermission(context, permissionForSimpleMaster(kind, action)))
}

function validateSimpleMasterValues(kind: SimpleMasterKind, values: SimpleMasterValues) {
  if (kind === 'directors') {
    directorPersonSchema.parse({
      accountName: values.accountName,
      accountNo: values.accountNo,
      bankAccounts: values.bankAccounts,
      bankBranch: values.bankBranch,
      bankName: values.bankName,
      firstName: values.firstName,
      lastName: values.lastName,
      nameTitle: values.nameTitle,
      type: values.type,
    })
  }

  if ((kind === 'vatSettings' || kind === 'whtSettings') && values.ratePercent === null) {
    throw new Error('กรอกอัตราภาษีเป็นเปอร์เซ็นต์')
  }

  return values
}

const configs: Record<SimpleMasterKind, SimpleMasterConfig> = {
  accountSubtypes: {
    delegate: () => prisma.account_subtypes as Delegate,
    prefix: 'AST-',
    orderBy: [{ sort_order: 'asc' }, { code: 'asc' }],
    lookupKey: 'code',
    map: (row) => {
      const record = asRecord(row)
      return {
        id: record.code,
        code: record.code,
        name: record.name,
        sortOrder: toNumber(record.sort_order as number | null),
        active: record.active,
        createdAt: toIso(record.created_at as Date | null),
        updatedAt: toIso(record.updated_at as Date | null),
      }
    },
    data: (values, _id, code) => ({
      code,
      name: values.name,
      sort_order: values.sortOrder ?? 0,
      active: values.active,
    }),
  },
  bankNames: {
    delegate: () => prisma.bank_names as Delegate,
    prefix: 'BANK-',
    orderBy: [{ name: 'asc' }],
    lookupKey: 'code',
    nextId: nextBankNameId,
    map: (row) => {
      const record = asRecord(row)
      return {
        id: record.code,
        code: record.code,
        name: record.name,
        symbol: record.symbol,
        active: record.active,
        createdAt: toIso(record.created_at as Date | null),
        updatedAt: toIso(record.updated_at as Date | null),
      }
    },
    data: (values, _id, code) => ({
      code,
      name: values.name,
      symbol: values.symbol || null,
      active: values.active,
    }),
  },
  directors: {
    delegate: () => prisma.director_employees as Delegate,
    prefix: 'P',
    orderBy: [{ code: 'asc' }, { name: 'asc' }],
    include: {
      director_employee_bank_accounts: {
        include: { accounts: true },
        orderBy: [{ is_primary: 'desc' }, { id: 'asc' }],
      },
    },
    lookupKey: 'code',
    nextId: nextDirectorPersonCode,
    map: (row) => {
      const record = asRecord(row)
      const childAccounts = (record.director_employee_bank_accounts as Array<Record<string, unknown>> | undefined) ?? []
      const bankAccounts = childAccounts.length > 0
        ? childAccounts.map((account) => {
            const linkedAccount = account.accounts as Record<string, unknown> | null | undefined
            return {
              id: String(account.id ?? ''),
              code: account.code ?? null,
              sourceType: account.source_type ?? 'OUTSIDE_COMPANY',
              linkedAccountId: linkedAccount?.code ?? null,
              bankName: account.bank_name ?? linkedAccount?.bank_name ?? null,
              accountName: account.account_name ?? linkedAccount?.name ?? null,
              accountNo: account.account_no ?? linkedAccount?.account_no ?? null,
              bankBranch: account.bank_branch ?? linkedAccount?.bank_branch ?? null,
              isPrimary: Boolean(account.is_primary),
              active: account.active ?? true,
            }
          })
        : (record.account_no || record.bank_account ? [{
            id: null,
            code: null,
            sourceType: 'OUTSIDE_COMPANY',
            linkedAccountId: null,
            bankName: record.bank_name ?? null,
            accountName: record.bank_account_name ?? null,
            accountNo: record.account_no ?? record.bank_account ?? null,
            bankBranch: record.bank_branch ?? null,
            isPrimary: true,
            active: true,
          }] : [])
      const primaryAccount = bankAccounts.find((account) => account.active && account.isPrimary) ?? bankAccounts.find((account) => account.active) ?? bankAccounts[0] ?? null
      return {
        id: record.code,
        code: record.code,
        name: record.name,
        nameTitle: record.name_title,
        firstName: record.first_name,
        lastName: record.last_name,
        type: record.type,
        bankName: primaryAccount?.bankName ?? record.bank_name,
        accountName: primaryAccount?.accountName ?? record.bank_account_name,
        accountNo: primaryAccount?.accountNo ?? record.account_no,
        bankBranch: primaryAccount?.bankBranch ?? record.bank_branch,
        bankAccounts,
        active: record.active,
        createdAt: toIso(record.created_at as Date | null),
        updatedAt: toIso(record.updated_at as Date | null),
      }
    },
    data: (values, _id, code) => ({
      code,
      name: directorDisplayName(values),
      name_title: values.nameTitle,
      first_name: values.firstName,
      last_name: values.lastName,
      type: values.type,
      phone: null,
      bank_name: values.bankName || null,
      bank_account_name: values.accountName || null,
      account_no: values.accountNo || null,
      bank_branch: values.bankBranch || null,
      bank_account: values.accountNo || null,
      active: values.active,
    }),
    normalizeValues: async (values) => (values.id ? { ...values, code: values.id } : { ...values, code: null }),
  },
  expenseTypes: {
    delegate: () => prisma.expense_types as Delegate,
    prefix: 'EXT-',
    orderBy: [{ code: 'asc' }],
    lookupKey: 'code',
    map: (row) => {
      const record = asRecord(row)
      return {
        id: record.code,
        code: record.code,
        name: record.name,
        active: record.active,
        createdAt: toIso(record.created_at as Date | null),
        updatedAt: toIso(record.updated_at as Date | null),
      }
    },
    data: (values, _id, code) => ({
      code,
      name: values.name,
      active: values.active,
    }),
  },
  machineTypes: {
    delegate: () => prisma.production_machine_types as Delegate,
    prefix: 'MT-',
    orderBy: [{ name: 'asc' }],
    coerceLookupValue: (value) => {
      const parsed = parseInternalBigIntId(value)
      if (parsed === null) throw new Error('รหัสประเภทเครื่องจักรไม่ถูกต้อง')
      return parsed
    },
    map: (row) => {
      const record = asRecord(row)
      return {
        id: String(record.id),
        code: null,
        name: record.name,
        active: record.active,
        createdAt: toIso(record.created_at as Date | null),
        updatedAt: toIso(record.updated_at as Date | null),
      }
    },
    data: (values, _id, _code) => ({
      name: values.name,
      active: values.active,
    }),
  },
  machines: {
    delegate: () => prisma.production_machines as Delegate,
    prefix: 'MC',
    orderBy: [{ name: 'asc' }],
    include: { branches: true },
    coerceLookupValue: (value) => {
      const parsed = parseInternalBigIntId(value)
      if (parsed === null) throw new Error('รหัสเครื่องจักรไม่ถูกต้อง')
      return parsed
    },
    map: (row) => {
      const record = asRecord(row)
      const branch = record.branches as Record<string, unknown> | null | undefined
      return {
        id: String(record.id),
        code: null,
        name: record.name,
        type: record.type,
        branchId: (branch?.code as string | null | undefined) ?? null,
        branchName: branch?.name ?? null,
        capacityKgPerHr: toNumber(record.capacity_kg_per_hr as { toNumber: () => number } | number | null),
        normalYieldPct: toNumber(record.normal_yield_pct as { toNumber: () => number } | number | null),
        stdProcessCostPerHr: toNumber(record.std_process_cost_per_hr as { toNumber: () => number } | number | null),
        active: record.active,
        createdAt: toIso(record.created_at as Date | null),
        updatedAt: toIso(record.updated_at as Date | null),
      }
    },
    data: (values, _id, _code) => ({
      name: values.name,
      branch_id: values.branchId ? BigInt(values.branchId) : null,
      type: values.type || null,
      capacity_kg_per_hr: values.capacityKgPerHr,
      normal_yield_pct: values.normalYieldPct,
      std_process_cost_per_hr: values.stdProcessCostPerHr,
      active: values.active,
    }),
    normalizeValues: async (values) => {
      if (!values.branchId) return values
      const branch = await findActiveBranchReferenceByCodeOrId(values.branchId)
      if (!branch) throw new Error('สาขาที่เลือกไม่ถูกต้องหรือถูกปิดใช้งาน')
      return { ...values, branchId: String(branch.id) }
    },
  },
  productionLines: {
    delegate: () => prisma.production_lines as Delegate,
    prefix: 'PL',
    orderBy: [{ name: 'asc' }],
    include: { branches: true },
    coerceLookupValue: (value) => {
      const parsed = parseInternalBigIntId(value)
      if (parsed === null) throw new Error('รหัสสายการผลิตไม่ถูกต้อง')
      return parsed
    },
    map: (row) => {
      const record = asRecord(row)
      const branch = record.branches as Record<string, unknown> | null | undefined
      return {
        id: String(record.id),
        code: null,
        name: record.name,
        branchId: (branch?.code as string | null | undefined) ?? null,
        branchName: branch?.name ?? null,
        responsiblePerson: record.responsible_person,
        active: record.active,
        createdAt: toIso(record.created_at as Date | null),
        updatedAt: toIso(record.updated_at as Date | null),
      }
    },
    data: (values, _id, _code) => ({
      name: values.name,
      branch_id: values.branchId ? BigInt(values.branchId) : null,
      responsible_person: values.responsiblePerson || null,
      active: values.active,
    }),
    normalizeValues: async (values) => {
      if (!values.branchId) return values
      const branch = await findActiveBranchReferenceByCodeOrId(values.branchId)
      if (!branch) throw new Error('สาขาที่เลือกไม่ถูกต้องหรือถูกปิดใช้งาน')
      return { ...values, branchId: String(branch.id) }
    },
  },
  productUnits: {
    delegate: () => prisma.product_units as Delegate,
    prefix: 'U',
    orderBy: [{ code: 'asc' }],
    lookupKey: 'code',
    map: (row) => {
      const record = asRecord(row)
      return {
        id: record.code,
        code: record.code,
        name: record.name,
        symbol: record.symbol,
        active: record.active,
        createdAt: toIso(record.created_at as Date | null),
        updatedAt: toIso(record.updated_at as Date | null),
      }
    },
    data: (values, _id, code) => ({
      code,
      name: values.name,
      symbol: values.symbol || null,
      active: values.active,
    }),
  },
  productTypes: {
    delegate: () => prisma.product_types as Delegate,
    prefix: 'PT-',
    orderBy: [{ code: 'asc' }],
    lookupKey: 'code',
    map: (row) => {
      const record = asRecord(row)
      return {
        id: record.code,
        code: record.code,
        name: record.name,
        active: record.active,
        createdAt: toIso(record.created_at as Date | null),
        updatedAt: toIso(record.updated_at as Date | null),
      }
    },
    data: (values, _id, code) => ({
      code,
      name: values.name,
      active: values.active,
    }),
  },
  paymentMethods: {
    delegate: () => prisma.payment_methods as Delegate,
    prefix: 'PM-',
    orderBy: [{ code: 'asc' }],
    lookupKey: 'code',
    map: (row) => {
      const record = asRecord(row)
      return {
        id: record.code,
        code: record.code,
        name: record.name,
        type: record.type,
        typeLabel: record.type === 'cash' ? 'เงินสด' : 'ธนาคาร',
        active: record.active,
        createdAt: toIso(record.created_at as Date | null),
        updatedAt: toIso(record.updated_at as Date | null),
      }
    },
    data: (values, _id, code) => ({
      code,
      name: values.name,
      type: values.type || 'bank',
      active: values.active,
    }),
  },
  vatSettings: {
    delegate: () => prisma.vat_settings as Delegate,
    prefix: 'VAT-',
    orderBy: [{ active: 'desc' }, { is_default: 'desc' }, { updated_at: 'desc' }, { id: 'asc' }],
    coerceLookupValue: (value) => {
      const parsed = parseInternalBigIntId(value)
      if (parsed === null) throw new Error('รหัส VAT ไม่ถูกต้อง')
      return parsed
    },
    map: (row) => {
      const record = asRecord(row)
      return {
        id: String(record.id),
        code: null,
        name: record.name,
        ratePercent: toNumber(record.rate_percent as { toNumber: () => number } | number | null),
        active: record.active,
        isDefault: Boolean(record.is_default),
        createdAt: toIso(record.created_at as Date | null),
        updatedAt: toIso(record.updated_at as Date | null),
      }
    },
    data: (values, _id, _code) => ({
      name: values.name,
      rate_percent: values.ratePercent ?? 7,
      active: values.active,
      effective_from: new Date('2026-01-01T00:00:00.000Z'),
    }),
  },
  whtSettings: {
    delegate: () => prisma.wht_settings as Delegate,
    prefix: 'WHT-',
    orderBy: [{ active: 'desc' }, { is_default: 'desc' }, { updated_at: 'desc' }, { id: 'asc' }],
    coerceLookupValue: (value) => {
      const parsed = parseInternalBigIntId(value)
      if (parsed === null) throw new Error('รหัส WHT ไม่ถูกต้อง')
      return parsed
    },
    map: (row) => {
      const record = asRecord(row)
      return {
        id: String(record.id),
        code: null,
        name: record.name,
        ratePercent: toNumber(record.rate_percent as { toNumber: () => number } | number | null),
        active: record.active,
        isDefault: Boolean(record.is_default),
        createdAt: toIso(record.created_at as Date | null),
        updatedAt: toIso(record.updated_at as Date | null),
      }
    },
    data: (values, _id, _code) => ({
      name: values.name,
      rate_percent: values.ratePercent ?? 3,
      active: values.active,
      effective_from: new Date('2026-01-01T00:00:00.000Z'),
    }),
  },
  remittancePurposes: {
    delegate: () => prisma.overseas_remittance_purposes as Delegate,
    prefix: 'RP-',
    orderBy: [{ code: 'asc' }, { name: 'asc' }],
    lookupKey: 'code',
    map: (row) => {
      const record = asRecord(row)
      return {
        id: record.code,
        code: record.code,
        name: record.name,
        active: record.active,
        createdAt: toIso(record.created_at as Date | null),
        updatedAt: toIso(record.updated_at as Date | null),
      }
    },
    data: (values, _id, code) => ({
      code,
      name: values.name,
      active: values.active,
    }),
  },
}

async function nextId(config: SimpleMasterConfig) {
  if (config.nextId) return config.nextId()

  if (config.lookupKey === 'code') {
    const last = await config.delegate().findFirst({ orderBy: { code: 'desc' }, select: { code: true } })
    return nextSequentialCode(String(asRecord(last)?.code ?? ''), config.prefix, 3)
  }

  const last = await config.delegate().findFirst({ orderBy: { id: 'desc' }, select: { id: true } })
  return nextSequentialCode(String(asRecord(last)?.id ?? ''), config.prefix, 3)
}

export async function listSimpleMasterData(kind: SimpleMasterKind) {
  await requireSimpleMasterPermission(kind, 'view')

  const config = configs[kind]
  const rows = await config.delegate().findMany({ orderBy: config.orderBy, include: config.include })
  return masterDataListJson(rows.map(config.map))
}

export async function saveSimpleMasterData(request: Request, kind: SimpleMasterKind) {
  await requireSimpleMasterPermission(kind, 'manage')

  const config = configs[kind]
  const rawValues = validateSimpleMasterValues(kind, parseMasterDataForm(prepareSimpleMasterBody(kind, await request.json())))
  const values = config.normalizeValues ? await config.normalizeValues(rawValues) : rawValues
  if (kind === 'directors') {
    const personCode = values.code || values.id || await nextId(config)
    const requestedAccounts = (values.bankAccounts ?? []).filter((account) => (
      account.sourceType === 'IN_COMPANY'
        ? Boolean(account.linkedAccountId)
        : Boolean(account.bankName || account.accountName || account.accountNo || account.bankBranch)
    ))
    const linkedAccountCodes = requestedAccounts
      .filter((account) => account.sourceType === 'IN_COMPANY')
      .map((account) => String(account.linkedAccountId))
    const linkedRows = linkedAccountCodes.length
      ? await prisma.accounts.findMany({
          select: { account_no: true, bank_branch: true, bank_name: true, code: true, id: true, name: true },
          where: { active: true, code: { in: linkedAccountCodes } },
        })
      : []
    const linkedByCode = new Map(linkedRows.map((account) => [account.code, account]))
    const normalizedAccounts = requestedAccounts.map((account, index) => {
      if (account.sourceType === 'IN_COMPANY') {
        const linked = linkedByCode.get(String(account.linkedAccountId))
        if (!linked) throw new Error('บัญชีในบริษัทที่เลือกไม่ถูกต้องหรือถูกปิดใช้งาน')
        return {
          active: account.active,
          accountName: linked.name,
          accountNo: linked.account_no,
          bankBranch: linked.bank_branch,
          bankName: linked.bank_name,
          code: account.code || directorBankAccountCode(personCode, index),
          isPrimary: account.isPrimary,
          linkedAccountId: linked.id,
          sourceType: 'IN_COMPANY' as const,
        }
      }
      return {
        active: account.active,
        accountName: account.accountName,
        accountNo: account.accountNo,
        bankBranch: account.bankBranch,
        bankName: account.bankName,
        code: account.code || directorBankAccountCode(personCode, index),
        isPrimary: account.isPrimary,
        linkedAccountId: null,
        sourceType: 'OUTSIDE_COMPANY' as const,
      }
    })
    const activeAccounts = normalizedAccounts.filter((account) => account.active !== false)
    if (activeAccounts.length > 0 && !activeAccounts.some((account) => account.isPrimary)) {
      normalizedAccounts[normalizedAccounts.findIndex((account) => account.active !== false)]!.isPrimary = true
    }
    const primaryAccount = normalizedAccounts.find((account) => account.active !== false && account.isPrimary) ?? activeAccounts[0] ?? normalizedAccounts[0] ?? null
    const row = await prisma.$transaction(async (tx) => {
      const saved = await tx.director_employees.upsert({
        where: { code: personCode },
        create: {
          code: personCode,
          name: directorDisplayName(values),
          name_title: values.nameTitle,
          first_name: values.firstName,
          last_name: values.lastName,
          type: values.type,
          phone: null,
          bank_name: primaryAccount?.bankName || null,
          bank_account_name: primaryAccount?.accountName || null,
          account_no: primaryAccount?.accountNo || null,
          bank_branch: primaryAccount?.bankBranch || null,
          bank_account: primaryAccount?.accountNo || null,
          active: values.active,
        },
        update: {
          name: directorDisplayName(values),
          name_title: values.nameTitle,
          first_name: values.firstName,
          last_name: values.lastName,
          type: values.type,
          phone: null,
          bank_name: primaryAccount?.bankName || null,
          bank_account_name: primaryAccount?.accountName || null,
          account_no: primaryAccount?.accountNo || null,
          bank_branch: primaryAccount?.bankBranch || null,
          bank_account: primaryAccount?.accountNo || null,
          active: values.active,
          updated_at: new Date(),
        },
      })
      await tx.director_employee_bank_accounts.deleteMany({ where: { director_id: saved.id } })
      if (normalizedAccounts.length) {
        await tx.director_employee_bank_accounts.createMany({
          data: normalizedAccounts.map((account) => ({
            code: account.code,
            director_id: saved.id,
            source_type: account.sourceType,
            linked_account_id: account.linkedAccountId,
            bank_name: account.bankName || null,
            account_name: account.accountName || null,
            account_no: account.accountNo || null,
            bank_branch: account.bankBranch || null,
            is_primary: Boolean(account.isPrimary),
            active: account.active,
          })),
        })
      }
      return tx.director_employees.findFirstOrThrow({
        where: { id: saved.id },
        include: config.include as any,
      })
    })
    return masterDataJson(config.map(row))
  }
  if (kind === 'machines' && values.type) {
    const machineType = await prisma.production_machine_types.findFirst({ where: { active: true, name: values.type } })
    if (!machineType) throw new Error('ประเภทเครื่องจักรที่เลือกไม่ถูกต้องหรือถูกปิดใช้งาน')
  }
  const lookupKey = config.lookupKey ?? 'id'
  const nextValue = lookupKey === 'code'
    ? (values.code || values.id || await nextId(config))
    : null
  const id = lookupKey === 'code'
    ? (values.id || values.code || nextValue || '')
    : (values.id || '')
  const code = lookupKey === 'code'
    ? (values.code || nextValue || id)
    : (values.code || '')
  const data = config.data(values, id, code)
  const coerceLookupValue = config.coerceLookupValue ?? ((value: string) => value)

  const row = lookupKey === 'code'
    ? await config.delegate().upsert({
      where: { code },
      create: data,
      update: data,
      include: config.include,
    })
    : values.id
      ? await config.delegate().update({
        where: { id: coerceLookupValue(values.id) },
        data,
        include: config.include,
      })
      : await config.delegate().create({
        data,
        include: config.include,
      })
  return masterDataJson(config.map(row))
}

export async function patchSimpleMasterData(request: Request, kind: SimpleMasterKind, id: string) {
  await requireSimpleMasterPermission(kind, 'manage')

  const config = configs[kind]
  const values = updateMasterDataStatusSchema.parse(await request.json())
  const lookupKey = config.lookupKey ?? 'id'
  const lookupValue = lookupKey === 'code'
    ? id
    : (config.coerceLookupValue ? config.coerceLookupValue(id) : id)
  const row = await config.delegate().update({
    where: { [lookupKey]: lookupValue },
    data: { active: values.active },
    include: config.include,
  })
  return masterDataJson(config.map(row))
}
