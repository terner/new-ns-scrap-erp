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

    const now = new Date()
    const in30 = new Date(now)
    in30.setDate(in30.getDate() + 30)
    const in7 = new Date(now)
    in7.setDate(in7.getDate() + 7)
    const thisMonth = now.toISOString().slice(0, 7)

    const loanRows = loans.map((loan) => {
      const paidPrincipal = loan.loan_payments.reduce((sum, payment) => sum + toNumber(payment.principal_amount), 0)
      return {
        contractNo: loan.contract_no,
        loanType: loan.loan_type,
        outstanding: Math.max(0, toNumber(loan.principal_amount) - paidPrincipal),
      }
    })
    const schedules = loans.flatMap((loan) => loan.loan_schedules.map((schedule) => ({
      contractNo: loan.contract_no,
      dueDate: schedule.due_date,
      id: schedule.id,
      lenderName: loan.lender_name || '-',
      loanType: loan.loan_type,
      paidAmount: toNumber(schedule.paid_amount),
      principalAmount: toNumber(schedule.principal_amount),
      interestAmount: toNumber(schedule.interest_amount),
      totalDueAmount: toNumber(schedule.total_due_amount),
      status: schedule.payment_status || 'Pending',
    })))
    const openSchedules = schedules.filter((schedule) => schedule.status !== 'Paid')
    const dueThisMonth = openSchedules.filter((schedule) => toDateOnly(schedule.dueDate).slice(0, 7) === thisMonth)
    const due7 = openSchedules.filter((schedule) => schedule.dueDate >= now && schedule.dueDate <= in7)
    const upcomingDue = openSchedules.filter((schedule) => schedule.dueDate >= now && schedule.dueDate <= in30)
    const overdue = openSchedules.filter((schedule) => schedule.dueDate < now)
    const byType = Array.from(new Set(loanRows.map((row) => row.loanType))).sort().map((loanType) => ({
      label: loanType,
      value: loanRows.filter((row) => row.loanType === loanType).reduce((sum, row) => sum + row.outstanding, 0),
    }))

    return NextResponse.json({
      byType,
      overdueList: overdue.slice(0, 100).map((schedule) => ({
        ...schedule,
        dueDate: toDateOnly(schedule.dueDate),
        daysOverdue: Math.max(0, Math.floor((now.getTime() - schedule.dueDate.getTime()) / 86_400_000)),
      })),
      summary: {
        due7: due7.length,
        due30: upcomingDue.length,
        dueThisMonth: dueThisMonth.reduce((sum, schedule) => sum + Math.max(0, schedule.totalDueAmount - schedule.paidAmount), 0),
        interestThisMonth: dueThisMonth.reduce((sum, schedule) => sum + schedule.interestAmount, 0),
        overdueAmount: overdue.reduce((sum, schedule) => sum + Math.max(0, schedule.totalDueAmount - schedule.paidAmount), 0),
        principalThisMonth: dueThisMonth.reduce((sum, schedule) => sum + schedule.principalAmount, 0),
        totalOutstanding: loanRows.reduce((sum, row) => sum + row.outstanding, 0),
      },
      upcomingDue: upcomingDue.slice(0, 100).map((schedule) => ({ ...schedule, dueDate: toDateOnly(schedule.dueDate) })),
    })
  } catch (caught) {
    if (caught instanceof AuthContextError) return authContextErrorResponse(caught)
    return apiErrorResponse(caught, 'โหลด Loan Dashboard ไม่ได้', 500)
  }
}
