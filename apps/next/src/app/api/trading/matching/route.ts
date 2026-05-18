import { NextResponse } from 'next/server'
import { apiErrorResponse } from '@/lib/server/api-error'
import { AuthContextError, authContextErrorResponse, getCurrentAuthContext, requirePermission } from '@/lib/server/auth-context'
import { toDateOnly, toNumber } from '@/lib/server/daily'
import { prisma } from '@/lib/server/prisma'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const context = await getCurrentAuthContext()
    requirePermission(context, 'finance.cash.view')

    const [purchaseBills, salesBills, deals] = await Promise.all([
      prisma.purchase_bills.findMany({
        include: { suppliers: true },
        orderBy: [{ date: 'desc' }, { doc_no: 'desc' }],
        take: 5000,
        where: { NOT: { status: 'cancelled' }, transaction_mode: 'TRADING' },
      }),
      prisma.sales_bills.findMany({
        include: { customers: true },
        orderBy: [{ date: 'desc' }, { doc_no: 'desc' }],
        take: 5000,
        where: { NOT: { status: 'cancelled' }, transaction_mode: 'TRADING' },
      }),
      prisma.trading_deals.findMany({
        include: {
          customers: true,
          products: true,
          suppliers: true,
        },
        orderBy: [{ date: 'desc' }, { deal_no: 'desc' }],
        take: 5000,
      }),
    ])

    const activeDeals = deals.filter((deal) => deal.status !== 'Cancelled' && deal.status !== 'cancelled')
    const matchedPurchaseMap = new Map<string, number>()
    const matchedSalesMap = new Map<string, number>()
    activeDeals.forEach((deal) => {
      if (deal.purchase_bill_id) matchedPurchaseMap.set(deal.purchase_bill_id, (matchedPurchaseMap.get(deal.purchase_bill_id) ?? 0) + toNumber(deal.matched_purchase_amount))
      if (deal.sales_bill_id) matchedSalesMap.set(deal.sales_bill_id, (matchedSalesMap.get(deal.sales_bill_id) ?? 0) + toNumber(deal.matched_sales_amount))
    })

    const purchaseRows = purchaseBills.map((bill) => {
      const total = toNumber(bill.subtotal) || toNumber(bill.total_amount)
      const matchedAmount = matchedPurchaseMap.get(bill.id) ?? 0
      return {
        date: toDateOnly(bill.date),
        docNo: bill.doc_no,
        id: bill.id,
        matchedAmount,
        remainingAmount: Math.max(0, total - matchedAmount),
        supplierName: bill.suppliers?.name ?? bill.supplier_id ?? '-',
        totalAmount: total,
      }
    })

    const salesRows = salesBills.map((bill) => {
      const total = toNumber(bill.subtotal) || toNumber(bill.total_amount)
      const matchedAmount = matchedSalesMap.get(bill.id) ?? 0
      return {
        customerName: bill.customers?.name ?? bill.customer_id ?? '-',
        date: toDateOnly(bill.date),
        docNo: bill.doc_no,
        id: bill.id,
        matchedAmount,
        remainingAmount: Math.max(0, total - matchedAmount),
        totalAmount: total,
      }
    })

    const dealRows = deals.map((deal) => {
      const salesAmount = toNumber(deal.matched_sales_amount)
      const purchaseAmount = toNumber(deal.matched_purchase_amount)
      const grossProfit = salesAmount - purchaseAmount
      return {
        customerName: deal.customers?.name ?? deal.customer_id ?? '-',
        date: toDateOnly(deal.date),
        dealNo: deal.deal_no,
        grossProfit,
        grossProfitPct: salesAmount > 0 ? (grossProfit / salesAmount) * 100 : 0,
        id: deal.id,
        matchedPurchaseAmount: purchaseAmount,
        matchedQty: toNumber(deal.matched_qty),
        matchedSalesAmount: salesAmount,
        productName: deal.products?.name ?? deal.product_id ?? '-',
        purchaseBillNo: deal.purchase_bill_no ?? '',
        salesBillNo: deal.sales_bill_no ?? '',
        status: deal.status ?? '',
        supplierName: deal.suppliers?.name ?? deal.supplier_id ?? '-',
      }
    })

    return NextResponse.json({
      deals: dealRows,
      purchases: purchaseRows,
      sales: salesRows,
      summary: {
        activeDeals: activeDeals.length,
        grossProfit: dealRows.filter((deal) => deal.status !== 'Cancelled').reduce((sum, deal) => sum + deal.grossProfit, 0),
        purchaseRemaining: purchaseRows.reduce((sum, row) => sum + row.remainingAmount, 0),
        purchaseTotal: purchaseRows.reduce((sum, row) => sum + row.totalAmount, 0),
        salesRemaining: salesRows.reduce((sum, row) => sum + row.remainingAmount, 0),
        salesTotal: salesRows.reduce((sum, row) => sum + row.totalAmount, 0),
      },
    })
  } catch (caught) {
    if (caught instanceof AuthContextError) return authContextErrorResponse(caught)
    return apiErrorResponse(caught, 'โหลด Trading Matching ไม่ได้', 500)
  }
}
