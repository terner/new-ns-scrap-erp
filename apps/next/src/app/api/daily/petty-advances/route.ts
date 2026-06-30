import { NextResponse } from 'next/server'
import { z } from 'zod'
import { pettyAdvanceFormSchema } from '@/lib/daily'
import { apiErrorResponse } from '@/lib/server/api-error'
import { AuthContextError, authContextErrorResponse, getCurrentAuthContext, requirePermission } from '@/lib/server/auth-context'
import { currentActor, listDailyAccounts, nextBankStatementDocNos, nextDailyDocNo, normalizeDate, toDateOnly, toNumber } from '@/lib/server/daily'
import { prisma } from '@/lib/server/prisma'
import type { Prisma } from '../../../../../generated/prisma/client'

export const runtime = 'nodejs'

const cancelRequestSchema = z.object({
  id: z.string().trim().min(1, 'ไม่พบรายการที่ต้องการยกเลิก'),
})

type PettyAdvanceWithRelations = Prisma.petty_advancesGetPayload<{
  include: {
    accounts: true
  }
}>

type PettyAdvanceRecipientRow = {
  account_no?: string | null
  bank_account?: string | null
  bank_account_name?: string | null
  bank_branch?: string | null
  bank_name?: string | null
  code: string
  director_employee_bank_accounts?: Array<{
    account_no: string | null
    account_name: string | null
    active: boolean | null
    bank_branch: string | null
    bank_name: string | null
    linked_account_id: bigint | null
    source_type: string
    accounts: {
      account_no: string | null
      code: string
      name: string
    } | null
  }>
  first_name: string | null
  last_name: string | null
  name: string
  name_title: string | null
  type: string | null
}

type PettyAdvanceRecipientBankAccountOption = {
  accountName: string
  accountNo: string
  bankBranch: string
  bankName: string
  linkedAccountId: string | null
  sourceType: string
}

type PettyAdvanceRecipientOption = {
  description?: string
  displayLabel?: string
  id: string
  label: string
  searchText: string
  type: string
}

type PettyAdvanceRecipientDetail = PettyAdvanceRecipientOption & {
  accountNo: string
  bankAccountLabel: string
  bankAccountName: string
  bankBranch: string
  bankName: string
  bankAccounts: PettyAdvanceRecipientBankAccountOption[]
  hasReceivingAccount: boolean
}

type PettyAdvanceBankNameOption = {
  code: string
  name: string
}

async function findPettyAdvanceByDocNo(
  client: Prisma.TransactionClient | typeof prisma,
  value: string,
  select?: Prisma.petty_advancesSelect,
) {
  const advancesClient = client.petty_advances as typeof prisma.petty_advances
  return advancesClient.findFirst({
    select,
    where: { doc_no: value },
  })
}

function cleanText(value: string | null | undefined) {
  return value?.trim() ?? ''
}

function displayPersonName(row: PettyAdvanceRecipientRow) {
  const splitName = [row.name_title, row.first_name, row.last_name].map(cleanText).filter(Boolean).join(' ')
  return splitName || row.name
}

function formatAccountNoDisplay(value: string) {
  if (/^\d{10}$/.test(value)) return `${value.slice(0, 3)}-${value.slice(3, 6)}-${value.slice(6)}`
  return value
}

function normalizeAccountNo(value: string | null | undefined) {
  return String(value ?? '').replace(/\D/g, '')
}

function toBangkokDateTimeInput(value: Date | null | undefined) {
  if (!value) return ''
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
  }).formatToParts(value)
  const valueByType = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${valueByType.year}-${valueByType.month}-${valueByType.day}T${valueByType.hour}:${valueByType.minute}`
}

function formatBankLabel(input: { accountName?: string | null; accountNo?: string | null; bankBranch?: string | null; bankName?: string | null }) {
  const bankName = cleanText(input.bankName)
  const accountName = cleanText(input.accountName)
  const accountNo = cleanText(input.accountNo)
  const bankBranch = cleanText(input.bankBranch)
  return [
    bankName,
    accountName,
    accountNo ? formatAccountNoDisplay(accountNo) : '',
    bankBranch ? `สาขา ${bankBranch}` : '',
  ].filter(Boolean).join(' / ')
}

function mapPettyAdvanceRecipientList(row: PettyAdvanceRecipientRow): PettyAdvanceRecipientOption {
  const label = displayPersonName(row)
  const type = cleanText(row.type)
  return {
    displayLabel: `${row.code} · ${label}`,
    id: row.code,
    label,
    searchText: [row.code, label, type].filter(Boolean).join(' '),
    type,
  }
}

function mapPettyAdvanceRecipientDetail(row: PettyAdvanceRecipientRow): PettyAdvanceRecipientDetail {
  const label = displayPersonName(row)
  const childAccounts = (row.director_employee_bank_accounts ?? [])
    .filter((account) => account.active !== false)
    .map((account) => ({
      accountName: cleanText(account.account_name ?? account.accounts?.name) || label,
      accountNo: cleanText(account.account_no ?? account.accounts?.account_no),
      bankBranch: cleanText(account.bank_branch),
      bankName: cleanText(account.bank_name),
      linkedAccountId: account.accounts?.code ?? null,
      sourceType: account.source_type,
    }))
  const fallbackAccount = {
    accountName: cleanText(row.bank_account_name) || label,
    accountNo: cleanText(row.account_no || row.bank_account),
    bankBranch: cleanText(row.bank_branch),
    bankName: cleanText(row.bank_name),
    linkedAccountId: null,
    sourceType: 'OUTSIDE_COMPANY',
  }
  const bankAccounts = childAccounts.length > 0 ? childAccounts : fallbackAccount.accountNo ? [fallbackAccount] : []
  const primaryAccount = bankAccounts[0] ?? fallbackAccount
  const bankName = primaryAccount.bankName
  const bankAccountName = primaryAccount.accountName
  const accountNo = primaryAccount.accountNo
  const bankBranch = primaryAccount.bankBranch
  const bankAccountLabel = formatBankLabel({
    accountName: bankAccountName,
    accountNo,
    bankBranch,
    bankName,
  })
  const type = cleanText(row.type)
  const hasReceivingAccount = Boolean(bankName && bankAccountName && accountNo && /^\d+$/.test(accountNo))

  return {
    accountNo,
    bankAccountLabel,
    bankAccountName,
    bankBranch,
    bankName,
    description: row.code,
    hasReceivingAccount,
    id: row.code,
    label,
    bankAccounts,
    searchText: [row.code, label, type, bankName, bankAccountName, accountNo, bankBranch, ...bankAccounts.map((account) => account.accountNo)].filter(Boolean).join(' '),
    type,
  }
}

async function listPettyAdvanceRecipients() {
  const rows = await prisma.director_employees.findMany({
    orderBy: [{ code: 'asc' }],
    select: {
      code: true,
      first_name: true,
      last_name: true,
      name: true,
      name_title: true,
      type: true,
    },
    where: {
      active: true,
    },
  })

  return rows.map(mapPettyAdvanceRecipientList)
}

async function listActiveBankNames(): Promise<PettyAdvanceBankNameOption[]> {
  const rows = await prisma.bank_names.findMany({
    orderBy: [{ name: 'asc' }],
    select: {
      code: true,
      name: true,
    },
    where: {
      active: true,
    },
  })

  return rows.map((row) => ({
    code: row.code,
    name: row.name,
  }))
}

async function findActiveBankNameByName(client: Prisma.TransactionClient | typeof prisma, name: string | null | undefined) {
  const normalizedName = cleanText(name)
  if (!normalizedName) return null
  return client.bank_names.findFirst({
    select: {
      name: true,
    },
    where: {
      active: true,
      name: normalizedName,
    },
  })
}

async function findPettyAdvanceRecipient(code: string) {
  const row = await prisma.director_employees.findFirst({
    select: {
      account_no: true,
      bank_account: true,
      bank_account_name: true,
      bank_branch: true,
      bank_name: true,
      code: true,
      director_employee_bank_accounts: {
        include: {
          accounts: {
            select: {
              account_no: true,
              code: true,
              name: true,
            },
          },
        },
        orderBy: [{ is_primary: 'desc' }, { id: 'asc' }],
      },
      first_name: true,
      last_name: true,
      name: true,
      name_title: true,
      type: true,
    },
    where: {
      active: true,
      code,
    },
  })
  if (!row) return null
  return mapPettyAdvanceRecipientDetail(row)
}

function pettyAdvanceFieldError(path: string, message: string) {
  return new z.ZodError([{ code: z.ZodIssueCode.custom, message, path: [path] }])
}

function advanceJson(row: PettyAdvanceWithRelations, activeApprovalByAdvanceId = new Set<string>()) {
  const returned = toNumber(row.returned_amount)
  const amount = toNumber(row.amount)
  const hasPaymentActivity = returned > 0 || activeApprovalByAdvanceId.has(row.id.toString())
  const canCancel = row.status === 'active' && !hasPaymentActivity

  return {
    accountId: row.accounts?.code ?? '',
    accountName: row.accounts?.name ?? '-',
    amount,
    canCancel,
    cancelBlockedReason: canCancel ? '' : hasPaymentActivity ? 'ยกเลิกไม่ได้ เพราะมีการอนุมัติ/จ่ายเงินแล้ว' : row.status === 'cancelled' ? 'ยกเลิกแล้ว' : 'สถานะนี้ยกเลิกไม่ได้',
    createdAt: toBangkokDateTimeInput(row.created_at),
    createdBy: row.created_by ?? '-',
    date: toDateOnly(row.date),
    docNo: row.doc_no,
    id: row.doc_no,
    loanFromAccountId: row.loan_from_account_code_snapshot ?? null,
    loanSourceType: row.loan_source_type as 'IN_SYSTEM' | 'OUTSIDE_SYSTEM' | null,
    notes: row.notes ?? '',
    outsideLoanFromAccountName: row.outside_loan_from_account_name ?? null,
    outsideLoanFromAccountNo: row.outside_loan_from_account_no ?? null,
    outsideLoanFromBankBranch: row.outside_loan_from_bank_branch ?? null,
    outsideLoanFromBankName: row.outside_loan_from_bank_name ?? null,
    outsideLoanTransferMethod: row.outside_loan_transfer_method as 'COUNTER_DEPOSIT' | 'BANK_TRANSFER' | null,
    recipientAccountLabel: formatBankLabel({
      accountName: row.recipient_bank_account_name,
      accountNo: row.recipient_account_no,
      bankBranch: row.recipient_bank_branch,
      bankName: row.recipient_bank_name,
    }),
    recipientAccountNo: row.recipient_account_no ?? '',
    recipientBankAccountName: row.recipient_bank_account_name ?? '',
    recipientBankBranch: row.recipient_bank_branch ?? '',
    recipientBankName: row.recipient_bank_name ?? '',
    recipientId: row.recipient_person_code ?? '',
    recipientName: row.recipient_name,
    receiveAccountId: row.receive_account_code_snapshot ?? null,
    remaining: amount - returned,
    returned,
    status: row.status,
    type: row.type,
  }
}

async function findActiveAccountByCode(client: Prisma.TransactionClient | typeof prisma, code: string | null | undefined) {
  const normalizedCode = cleanText(code)
  if (!normalizedCode) return null
  return client.accounts.findFirst({
    select: {
      account_no: true,
      code: true,
      id: true,
      name: true,
    },
    where: {
      active: true,
      code: normalizedCode,
    },
  })
}

export async function GET(request: Request) {
  try {
    const context = await getCurrentAuthContext()
    requirePermission(context, 'finance.cash.view')

    const recipientAccountsFor = new URL(request.url).searchParams.get('recipientAccountsFor')?.trim()
    if (recipientAccountsFor) {
      const recipient = await findPettyAdvanceRecipient(recipientAccountsFor)
      if (!recipient) return NextResponse.json({ bankAccounts: [] })
      return NextResponse.json({ bankAccounts: recipient.bankAccounts })
    }

    const [accounts, bankNames, rows, recipientOptions, activeApprovals] = await Promise.all([
      listDailyAccounts(),
      listActiveBankNames(),
      prisma.petty_advances.findMany({
        include: {
          accounts: true,
        },
        orderBy: [{ date: 'desc' }, { created_at: 'desc' }],
        take: 5000,
      }),
      listPettyAdvanceRecipients(),
      prisma.payment_approvals.findMany({
        select: { source_id: true },
        where: {
          source_type: 'petty_advance',
          status: { in: ['approved', 'paid'] },
        },
      }),
    ])
    const activeApprovalByAdvanceId = new Set(activeApprovals.map((approval) => approval.source_id))

    return NextResponse.json({ accounts, bankNames, recipientOptions, rows: rows.map((row) => advanceJson(row, activeApprovalByAdvanceId)) })
  } catch (caught) {
    if (caught instanceof AuthContextError) return authContextErrorResponse(caught)
    return apiErrorResponse(caught, 'โหลดเงินสำรองจ่ายไม่ได้', 500)
  }
}

export async function PATCH(request: Request) {
  try {
    const context = await getCurrentAuthContext()
    requirePermission(context, 'finance.cash.view')

    const values = cancelRequestSchema.parse(await request.json())
    const actor = currentActor(context)

    const result = await prisma.$transaction(async (tx) => {
      const advance = await findPettyAdvanceByDocNo(tx, values.id, {
        doc_no: true,
        id: true,
        returned_amount: true,
        status: true,
      })
      if (!advance) throw new Error('ไม่พบรายการเงินสำรองจ่าย')
      if (advance.status !== 'active') throw new Error('ยกเลิกได้เฉพาะรายการที่ยังค้างอยู่')
      if (toNumber(advance.returned_amount) > 0) throw new Error('ยกเลิกไม่ได้ เพราะมีการคืนแล้วบางส่วนหรือทั้งหมด')
      const activeApprovalCount = await tx.payment_approvals.count({
        where: {
          source_id: advance.id.toString(),
          source_type: 'petty_advance',
          status: { in: ['approved', 'paid'] },
        },
      })
      if (activeApprovalCount > 0) throw new Error('ยกเลิกไม่ได้ เพราะมี PMA/PMT แล้ว')
      await tx.bank_statement.deleteMany({
        where: {
          ref_no: advance.doc_no,
          ref_type: 'PADV',
        },
      })
      return tx.petty_advances.update({
        data: {
          status: 'cancelled',
          updated_at: new Date(),
          updated_by: actor,
        },
        where: { id: advance.id },
      })
    })

    return NextResponse.json({ id: result.doc_no })
  } catch (caught) {
    if (caught instanceof AuthContextError) return authContextErrorResponse(caught)
    return apiErrorResponse(caught, 'ยกเลิกรายการเงินสำรองจ่ายไม่ได้', 400)
  }
}

export async function POST(request: Request) {
  try {
    const context = await getCurrentAuthContext()
    requirePermission(context, 'finance.cash.view')

    const values = pettyAdvanceFormSchema.parse(await request.json())
    const actor = currentActor(context)
    const recipient = await findPettyAdvanceRecipient(values.recipientId)
    if (!recipient) {
      throw pettyAdvanceFieldError('recipientId', 'เลือกผู้จ่ายจากรายชื่อในข้อมูลหลักพนักงาน/กรรมการที่ใช้งานอยู่')
    }
    if (!recipient.hasReceivingAccount) {
      throw pettyAdvanceFieldError('recipientId', 'ผู้รับเงินนี้ยังไม่มีบัญชีรับเงินในข้อมูลหลัก')
    }

    const result = await prisma.$transaction(async (tx) => {
      const existingAdvance = values.id
        ? await findPettyAdvanceByDocNo(tx, values.id, {
            doc_no: true,
            id: true,
          })
        : null
      if (values.id && !existingAdvance) {
        throw new Error('ไม่พบรายการเงินสำรองจ่าย')
      }
      const docNo = existingAdvance?.doc_no ?? (await nextDailyDocNo('petty_advances', 'PADV', values.date, tx))
      const loanFromAccount = values.type === 'DIRECTOR_LOAN' && values.loanSourceType === 'IN_SYSTEM'
        ? await findActiveAccountByCode(tx, values.loanFromAccountId)
        : null
      const receiveAccount = values.type === 'DIRECTOR_LOAN'
        ? await findActiveAccountByCode(tx, values.receiveAccountId)
        : null
      if (values.type === 'DIRECTOR_LOAN') {
        if (!values.loanSourceType) throw pettyAdvanceFieldError('loanSourceType', 'เลือกประเภทเงินกู้')
        if (!receiveAccount) throw pettyAdvanceFieldError('receiveAccountId', 'เลือกบัญชีที่รับเงินเข้าบริษัทจากข้อมูลบัญชีที่ใช้งานอยู่')
        if (values.loanSourceType === 'IN_SYSTEM') {
          if (!loanFromAccount) throw pettyAdvanceFieldError('loanFromAccountId', 'เลือกบัญชีที่กู้จากบัญชีกรรมการในระบบ')
          const recipientAccountNos = recipient.bankAccounts.map((account) => normalizeAccountNo(account.accountNo)).filter(Boolean)
          if (!recipientAccountNos.includes(normalizeAccountNo(loanFromAccount.account_no))) {
            throw pettyAdvanceFieldError('loanFromAccountId', 'บัญชีที่กู้ต้องเป็นเลขบัญชีเดียวกับกรรมการที่เลือก')
          }
          if (loanFromAccount.code === receiveAccount.code) {
            throw pettyAdvanceFieldError('receiveAccountId', 'บัญชีที่กู้และบัญชีที่รับต้องไม่ซ้ำกัน')
          }
        }
        if (values.loanSourceType === 'OUTSIDE_SYSTEM') {
          if (!values.outsideLoanTransferMethod) throw pettyAdvanceFieldError('outsideLoanTransferMethod', 'เลือกวิธีรับเงินนอกระบบ')
          if (values.outsideLoanTransferMethod === 'BANK_TRANSFER') {
            if (!values.outsideLoanFromBankName) throw pettyAdvanceFieldError('outsideLoanFromBankName', 'เลือกธนาคารที่โอนเข้า')
            const outsideBankName = await findActiveBankNameByName(tx, values.outsideLoanFromBankName)
            if (!outsideBankName) throw pettyAdvanceFieldError('outsideLoanFromBankName', 'เลือกธนาคารที่โอนเข้าจากข้อมูลหลักธนาคาร')
            if (!values.outsideLoanFromAccountName) throw pettyAdvanceFieldError('outsideLoanFromAccountName', 'กรอกชื่อบัญชีที่โอนเข้า')
          }
        }
      }
      const shouldSnapshotOutsideTransferAccount = values.type === 'DIRECTOR_LOAN' && values.loanSourceType === 'OUTSIDE_SYSTEM' && values.outsideLoanTransferMethod === 'BANK_TRANSFER'
      const advance = existingAdvance
        ? await tx.petty_advances.update({
            where: { id: existingAdvance.id },
            data: {
              account_id: values.type === 'DIRECTOR_LOAN' ? receiveAccount?.id ?? null : null,
              amount: values.amount,
              date: normalizeDate(values.date),
              doc_no: docNo,
              loan_from_account_code_snapshot: loanFromAccount?.code ?? null,
              loan_from_account_id: loanFromAccount?.id ?? null,
              loan_from_account_name_snapshot: loanFromAccount?.name ?? null,
              loan_from_account_no_snapshot: loanFromAccount?.account_no ?? null,
              loan_source_type: values.type === 'DIRECTOR_LOAN' ? values.loanSourceType : null,
              notes: values.notes,
              outside_loan_from_account_name: shouldSnapshotOutsideTransferAccount ? values.outsideLoanFromAccountName : null,
              outside_loan_from_account_no: null,
              outside_loan_from_bank_branch: shouldSnapshotOutsideTransferAccount ? values.outsideLoanFromBankBranch : null,
              outside_loan_from_bank_name: shouldSnapshotOutsideTransferAccount ? values.outsideLoanFromBankName : null,
              outside_loan_transfer_method: values.type === 'DIRECTOR_LOAN' && values.loanSourceType === 'OUTSIDE_SYSTEM' ? values.outsideLoanTransferMethod : null,
              recipient_account_no: recipient.accountNo,
              recipient_bank_account_name: recipient.bankAccountName,
              recipient_bank_branch: recipient.bankBranch || null,
              recipient_bank_name: recipient.bankName,
              recipient_name: recipient.label,
              recipient_person_code: recipient.id,
              receive_account_code_snapshot: receiveAccount?.code ?? null,
              receive_account_id: receiveAccount?.id ?? null,
              receive_account_name_snapshot: receiveAccount?.name ?? null,
              receive_account_no_snapshot: receiveAccount?.account_no ?? null,
              status: values.status,
              type: values.type,
              updated_at: new Date(),
              updated_by: actor,
            },
          })
        : await tx.petty_advances.create({
            data: {
              account_id: values.type === 'DIRECTOR_LOAN' ? receiveAccount?.id ?? null : null,
              amount: values.amount,
              created_by: actor,
              date: normalizeDate(values.date),
              doc_no: docNo,
              loan_from_account_code_snapshot: loanFromAccount?.code ?? null,
              loan_from_account_id: loanFromAccount?.id ?? null,
              loan_from_account_name_snapshot: loanFromAccount?.name ?? null,
              loan_from_account_no_snapshot: loanFromAccount?.account_no ?? null,
              loan_source_type: values.type === 'DIRECTOR_LOAN' ? values.loanSourceType : null,
              notes: values.notes,
              outside_loan_from_account_name: shouldSnapshotOutsideTransferAccount ? values.outsideLoanFromAccountName : null,
              outside_loan_from_account_no: null,
              outside_loan_from_bank_branch: shouldSnapshotOutsideTransferAccount ? values.outsideLoanFromBankBranch : null,
              outside_loan_from_bank_name: shouldSnapshotOutsideTransferAccount ? values.outsideLoanFromBankName : null,
              outside_loan_transfer_method: values.type === 'DIRECTOR_LOAN' && values.loanSourceType === 'OUTSIDE_SYSTEM' ? values.outsideLoanTransferMethod : null,
              recipient_account_no: recipient.accountNo,
              recipient_bank_account_name: recipient.bankAccountName,
              recipient_bank_branch: recipient.bankBranch || null,
              recipient_bank_name: recipient.bankName,
              recipient_name: recipient.label,
              recipient_person_code: recipient.id,
              receive_account_code_snapshot: receiveAccount?.code ?? null,
              receive_account_id: receiveAccount?.id ?? null,
              receive_account_name_snapshot: receiveAccount?.name ?? null,
              receive_account_no_snapshot: receiveAccount?.account_no ?? null,
              status: values.status,
              type: values.type,
              updated_at: new Date(),
              updated_by: actor,
            },
          })

      await tx.bank_statement.deleteMany({
        where: {
          ref_no: docNo,
          ref_type: 'PADV',
        },
      })
      if (values.type === 'DIRECTOR_LOAN' && receiveAccount) {
        const statementCount = loanFromAccount ? 2 : 1
        const statementDocNos = await nextBankStatementDocNos(values.date, statementCount, tx)
        const statementRows: Prisma.bank_statementCreateManyInput[] = []
        if (loanFromAccount) {
          statementRows.push({
            account_id: loanFromAccount.id,
            amount_in: 0,
            amount_out: values.amount,
            created_by: actor,
            date: normalizeDate(values.date),
            description: `${docNo} - กู้กรรมการในระบบออกจาก ${recipient.label}`,
            doc_no: statementDocNos[0]!,
            ref_id: advance.id.toString(),
            ref_no: docNo,
            ref_type: 'PADV',
            type: 'กู้กรรมการ',
          })
        }
        statementRows.push({
          account_id: receiveAccount.id,
          amount_in: values.amount,
          amount_out: 0,
          created_by: actor,
          date: normalizeDate(values.date),
          description: `${docNo} - รับเงินกู้กรรมการ${loanFromAccount ? 'ในระบบ' : 'นอกระบบ'}จาก ${recipient.label}`,
          doc_no: statementDocNos[loanFromAccount ? 1 : 0]!,
          ref_id: advance.id.toString(),
          ref_no: docNo,
          ref_type: 'PADV',
          type: 'กู้กรรมการ',
        })
        await tx.bank_statement.createMany({
          data: statementRows,
        })
      }

      return advance
    })

    return NextResponse.json({ id: result.doc_no })
  } catch (caught) {
    if (caught instanceof AuthContextError) return authContextErrorResponse(caught)
    return apiErrorResponse(caught, 'บันทึกเงินสำรองจ่ายไม่ได้', 400)
  }
}
