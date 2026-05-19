import { NextResponse } from 'next/server'
import { apiErrorResponse } from '@/lib/server/api-error'
import { AuthContextError, authContextErrorResponse, getCurrentAuthContext, requirePermission } from '@/lib/server/auth-context'
import { toDateOnly, toNumber } from '@/lib/server/daily'
import { prisma } from '@/lib/server/prisma'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const context = await getCurrentAuthContext()
    requirePermission(context, 'finance.financials.view')

    const loans = await prisma.loans.findMany({
      include: {
        loan_payments: true,
        loan_schedules: { orderBy: [{ due_date: 'asc' }, { installment_no: 'asc' }] },
      },
      orderBy: [{ contract_no: 'asc' }],
      take: 5000,
    })

    const today = new Date()
    const rows = loans.map((loan) => {
      const principal = toNumber(loan.principal_amount)
      const paidPrincipal = loan.loan_payments.reduce((sum, payment) => sum + toNumber(payment.principal_amount), 0)
      const outstanding = Math.max(0, principal - paidPrincipal)
      const nextSchedule = loan.loan_schedules.find((schedule) => (schedule.payment_status || 'Pending') !== 'Paid')
      const overdue = loan.loan_schedules
        .filter((schedule) => (schedule.payment_status || 'Pending') !== 'Paid' && schedule.due_date < today)
        .reduce((sum, schedule) => sum + Math.max(0, toNumber(schedule.total_due_amount) - toNumber(schedule.paid_amount)), 0)
      return {
        contractNo: loan.contract_no,
        duePaid: loan.loan_schedules.filter((schedule) => (schedule.payment_status || 'Pending') === 'Paid').length,
        dueTotal: loan.loan_schedules.length,
        endDate: toDateOnly(loan.end_date),
        installmentAmount: toNumber(loan.installment_amount),
        interestRate: toNumber(loan.interest_rate),
        lenderName: loan.lender_name || '-',
        loanType: loan.loan_type,
        nextDue: toDateOnly(nextSchedule?.due_date),
        notes: loan.notes || '',
        outstanding,
        overdue,
        principalAmount: principal,
        startDate: toDateOnly(loan.start_date),
        status: loan.status || 'Active',
        termMonths: loan.term_months || 0,
      }
    })

    return NextResponse.json({
      designState: {
        generateScheduleWrite: 'disabled_until_schedule_idempotency_design',
        importWrite: 'disabled_until_import_audit_design',
        paymentWrite: 'disabled_until_gl_and_bank_posting_design',
        saveWrite: 'disabled_until_loan_approval_design',
      },
      filters: {
        statuses: Array.from(new Set(rows.map((row) => row.status))).sort(),
        types: Array.from(new Set(rows.map((row) => row.loanType))).sort(),
      },
      rows,
      summary: {
        count: rows.length,
        financed: rows.reduce((sum, row) => sum + row.principalAmount, 0),
        outstanding: rows.reduce((sum, row) => sum + row.outstanding, 0),
        overdue: rows.reduce((sum, row) => sum + row.overdue, 0),
      },
    })
  } catch (caught) {
    if (caught instanceof AuthContextError) return authContextErrorResponse(caught)
    return apiErrorResponse(caught, 'โหลดสัญญาเงินกู้ไม่ได้', 500)
  }
}
