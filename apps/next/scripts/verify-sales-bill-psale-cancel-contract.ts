import nextEnv from '@next/env'
import type { Prisma } from '../generated/prisma/client'

const projectDir = new URL('..', import.meta.url).pathname
const { loadEnvConfig } = nextEnv
loadEnvConfig(projectDir)

const qaPrefix = `QA-SB-PSALE-${Date.now().toString(36)}`
const actor = 'codex-qa'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function assertEqual(label: string, actual: unknown, expected: unknown) {
  if (actual === expected) return
  throw new Error(`${label} expected ${String(expected)}, got ${String(actual)}`)
}

function assertNear(label: string, actual: number, expected: number, tolerance = 0.000001) {
  if (Math.abs(actual - expected) <= tolerance) return
  throw new Error(`${label} expected ${expected}, got ${actual}`)
}

async function cleanup(prisma: Awaited<typeof import('../src/lib/server/prisma')>['prisma']) {
  const salesBills = await prisma.sales_bills.findMany({
    select: { id: true },
    where: { doc_no: { startsWith: qaPrefix } },
  })
  const salesBillIds = salesBills.map((bill) => bill.id)
  if (salesBillIds.length) {
    await prisma.sales_bill_customer_advance_allocations.deleteMany({ where: { sales_bill_id: { in: salesBillIds } } })
    await prisma.sales_bill_po_sell_allocations.deleteMany({ where: { sales_bill_id: { in: salesBillIds } } })
    await prisma.sales_bill_source_allocations.deleteMany({ where: { sales_bill_id: { in: salesBillIds } } })
    await prisma.sales_bill_lines.deleteMany({ where: { sales_bill_id: { in: salesBillIds } } })
    await prisma.sales_bill_status_logs.deleteMany({ where: { sales_bill_id: { in: salesBillIds } } })
    await prisma.sales_bills.deleteMany({ where: { id: { in: salesBillIds } } })
  }

  const stockIssues = await prisma.stock_issues.findMany({
    select: { id: true },
    where: { doc_no: { startsWith: qaPrefix } },
  })
  const stockIssueIds = stockIssues.map((issue) => issue.id)
  if (stockIssueIds.length) {
    await prisma.stock_issue_status_logs.deleteMany({ where: { stock_issue_id: { in: stockIssueIds } } })
    await prisma.stock_issues.deleteMany({ where: { id: { in: stockIssueIds } } })
  }

  const tickets = await prisma.weight_tickets.findMany({
    select: { id: true },
    where: { doc_no: { startsWith: qaPrefix } },
  })
  const ticketIds = tickets.map((ticket) => ticket.id)
  if (ticketIds.length) {
    await prisma.stock_holds.deleteMany({ where: { weight_ticket_id: { in: ticketIds } } })
    await prisma.weight_ticket_status_logs.deleteMany({ where: { weight_ticket_id: { in: ticketIds } } })
    await prisma.weight_ticket_usage_logs.deleteMany({ where: { weight_ticket_id: { in: ticketIds } } })
    await prisma.weight_tickets.deleteMany({ where: { id: { in: ticketIds } } })
  }

  await prisma.stock_ledger.deleteMany({
    where: {
      OR: [
        { ref_no: { startsWith: qaPrefix } },
        { ref_id: { startsWith: qaPrefix } },
      ],
    },
  })
  await prisma.sales_channels.deleteMany({ where: { code: { startsWith: qaPrefix } } })
  await prisma.warehouses.deleteMany({ where: { code: { startsWith: qaPrefix } } })
  await prisma.customers.deleteMany({ where: { code: { startsWith: qaPrefix } } })
  await prisma.products.deleteMany({ where: { code: { startsWith: qaPrefix } } })
  await prisma.branches.deleteMany({ where: { code: { startsWith: qaPrefix } } })
}

async function main() {
  const [
    { prisma },
    { appendSalesBillStatusLog, SALES_BILL_STATUS_ACTION },
    { appendStockIssueStatusLog, STOCK_ISSUE_STATUS_ACTION },
    { consumeActiveWtoStockHoldsForPendingSale, reversePendingSaleStockIssue },
    { appendWeightTicketStatusLog, WEIGHT_TICKET_STATUS_ACTION },
    { normalizeDate, toNumber },
  ] = await Promise.all([
    import('../src/lib/server/prisma'),
    import('../src/lib/server/sales-bill-history'),
    import('../src/lib/server/stock-issue-history'),
    import('../src/lib/server/stock-holds'),
    import('../src/lib/server/weight-ticket-status-history'),
    import('../src/lib/server/daily'),
  ])

  let assertions = 0
  await cleanup(prisma)
  try {
    const qaDateText = '2026-06-14'
    const qaDate = normalizeDate(qaDateText)
    const cancelledAt = new Date('2026-06-14T09:30:00.000Z')

    const created = await prisma.$transaction(async (tx) => {
      const branch = await tx.branches.create({
        data: { code: `${qaPrefix}-BR`, name: `${qaPrefix} Branch` },
      })
      const warehouse = await tx.warehouses.create({
        data: { branch_id: branch.id, code: `${qaPrefix}-RM`, name: `${qaPrefix} RM`, type: 'RM' },
      })
      const customer = await tx.customers.create({
        data: { code: `${qaPrefix}-CU`, name: `${qaPrefix} Customer` },
      })
      const product = await tx.products.create({
        data: { code: `${qaPrefix}-P1`, name: `${qaPrefix} Product 1`, unit: 'กก.' },
      })
      const channel = await tx.sales_channels.create({
        data: { code: `${qaPrefix}-CH`, name: `${qaPrefix} Channel` },
      })
      const ticket = await tx.weight_tickets.create({
        data: {
          branch_id: branch.id,
          customer_id: customer.id,
          deduct_weight: 0,
          doc_no: `${qaPrefix}-WTO`,
          doc_type: 'WTO',
          document_date: qaDate,
          gross_weight: 100,
          net_weight: 100,
          party_name: customer.name,
          status: 'delivered',
          vehicle_no: `${qaPrefix}-TRUCK`,
        },
      })
      const ticketLine = await tx.weight_ticket_lines.create({
        data: {
          deduction_mode: 'kg',
          deduct_weight: 0,
          gross_weight: 100,
          line_no: 1,
          net_weight: 100,
          product_id: product.id,
          product_name: product.name,
          warehouse_id: warehouse.id,
          weight_ticket_id: ticket.id,
        },
      })
      await tx.weight_ticket_product_summaries.create({
        data: {
          gross_weight: 100,
          line_count: 1,
          net_weight: 100,
          product_id: product.id,
          product_name: product.name,
          remaining_weight: 100,
          weight_ticket_id: ticket.id,
        },
      })
      await tx.stock_ledger.create({
        data: {
          branch_id: branch.id,
          created_by: actor,
          date: qaDate,
          movement_type: 'QA opening stock',
          not_available_for_sale: false,
          output_category: 'RM',
          product_id: product.id,
          qty_in: 150,
          qty_out: 0,
          ref_id: `${qaPrefix}-OPEN`,
          ref_no: `${qaPrefix}-OPEN`,
          ref_type: 'QA',
          unit_cost: 10,
          value_in: 1500,
          value_out: 0,
          warehouse_id: warehouse.id,
        },
      })
      await tx.stock_holds.create({
        data: {
          branch_id: branch.id,
          created_by: actor,
          lot_no: null,
          not_available_for_sale: false,
          output_category: 'RM',
          product_id: product.id,
          qty: 100,
          source_doc_no: ticket.doc_no,
          source_line_no: 1,
          source_type: 'WTO',
          status: 'active',
          warehouse_id: warehouse.id,
          weight_ticket_id: ticket.id,
          weight_ticket_line_id: ticketLine.id,
        },
      })

      const psaleDocNo = `${qaPrefix}-PSALE`
      const consumedLines = await consumeActiveWtoStockHoldsForPendingSale(tx, {
        actor,
        branchId: branch.id,
        issueDate: qaDate,
        stockIssueDocNo: psaleDocNo,
        weightTicketId: ticket.id,
      })
      assertEqual('PSALE consumes one stock hold line', consumedLines.length, 1)
      assertions += 1

      const psaleItems = consumedLines.map((line, index) => ({
        amount: line.qty * 20,
        costAmount: line.valueOut,
        deliveryTicketDocNo: ticket.doc_no,
        deliveryTicketId: ticket.doc_no,
        lineNo: index + 1,
        price: 20,
        productCode: product.code,
        productId: product.code,
        productName: product.name,
        qty: line.qty,
        sourceLineNo: line.sourceLineNo,
        unitCost: line.unitCost,
        warehouseCode: warehouse.code,
        warehouseId: warehouse.code,
        warehouseName: warehouse.name,
      }))
      const stockIssue = await tx.stock_issues.create({
        data: {
          branch_id: branch.id,
          created_by: actor,
          customer_id: customer.id,
          date: qaDate,
          doc_no: psaleDocNo,
          items: psaleItems as Prisma.InputJsonValue,
          notes: 'QA create pending sale for SB cancel contract',
          status: 'pending',
          total_cost: 1000,
          total_est_amount: 2000,
          warehouse_id: warehouse.id,
        },
      })
      await appendStockIssueStatusLog(tx, {
        action: STOCK_ISSUE_STATUS_ACTION.CREATED,
        actor,
        createdAt: qaDate,
        meta: { deliveryTicketDocNo: ticket.doc_no, reason: 'qa_psale_create' },
        note: 'QA create pending sale for SB cancel contract',
        stockIssueId: stockIssue.id,
        toStatus: 'pending',
      })
      await tx.weight_tickets.update({
        data: { status: 'partially_billed', updated_at: qaDate, updated_by: actor },
        where: { id: ticket.id },
      })

      const salesBill = await tx.sales_bills.create({
        data: {
          branch_id: branch.id,
          channel_id: channel.id,
          customer_id: customer.id,
          date: qaDate,
          doc_no: `${qaPrefix}-SB`,
          items: psaleItems as Prisma.InputJsonValue,
          receivable_balance: 2000,
          status: 'unreceived',
          subtotal: 2000,
          total_amount: 2000,
          total_cost: 1000,
          transaction_mode: 'STOCK',
          warehouse_id: warehouse.id,
        },
      })
      const salesLine = await tx.sales_bill_lines.create({
        data: {
          gross_weight: 100,
          line_amount: 2000,
          line_no: 1,
          net_weight: 100,
          product_code_snapshot: product.code,
          product_id: product.id,
          product_name_snapshot: product.name,
          qty: 100,
          sales_bill_id: salesBill.id,
          status: 'active',
          unit_price: 20,
          unit_snapshot: 'กก.',
        },
      })
      await tx.sales_bill_source_allocations.create({
        data: {
          allocated_gross_weight: 100,
          allocated_net_weight: 100,
          allocated_qty: 100,
          meta: { source: 'qa_sales_bill_create_from_psale' },
          movement_owner: 'PSALE',
          product_code_snapshot: product.code,
          product_id: product.id,
          product_name_snapshot: product.name,
          sales_bill_id: salesBill.id,
          sales_bill_line_id: salesLine.id,
          sales_line_no: 1,
          source_doc_no: stockIssue.doc_no,
          source_id: stockIssue.id,
          source_type: 'PSALE',
          status: 'active',
          stock_issue_id: stockIssue.id,
          stock_ledger_ref_type: 'PSALE',
        },
      })
      await appendSalesBillStatusLog(tx, {
        action: SALES_BILL_STATUS_ACTION.CREATED,
        actor,
        createdAt: qaDate,
        meta: { reason: 'qa_sales_bill_create_from_psale' },
        salesBillId: salesBill.id,
        toStatus: 'unreceived',
      })
      await tx.stock_issues.update({
        data: {
          converted_to_bill_id: salesBill.id,
          status: 'converted',
        },
        where: { id: stockIssue.id },
      })
      await appendStockIssueStatusLog(tx, {
        action: STOCK_ISSUE_STATUS_ACTION.CONVERTED,
        actor,
        createdAt: qaDate,
        fromStatus: 'pending',
        meta: { reason: 'qa_sales_bill_create_from_pending_sale', salesBillDocNo: salesBill.doc_no },
        stockIssueId: stockIssue.id,
        toStatus: 'converted',
      })

      return {
        salesBillDocNo: salesBill.doc_no,
        salesBillId: salesBill.id,
        stockIssueDocNo: stockIssue.doc_no,
        stockIssueId: stockIssue.id,
        ticketId: ticket.id,
      }
    }, { timeout: 30000 })

    const ledgerBeforeCancel = await prisma.stock_ledger.groupBy({
      _sum: { qty_in: true, qty_out: true },
      by: ['ref_type'],
      where: {
        OR: [
          { ref_no: created.stockIssueDocNo },
          { ref_no: created.salesBillDocNo },
        ],
        ref_type: { in: ['PSALE', 'PSALE-CANCEL', 'SB', 'SB-CANCEL'] },
      },
    })
    assertEqual('PSALE stock out rows before cancel', ledgerBeforeCancel.find((row) => row.ref_type === 'PSALE')?._sum.qty_out?.toNumber(), 100)
    assertEqual('SB stock out row count before cancel', ledgerBeforeCancel.filter((row) => row.ref_type === 'SB').length, 0)
    assertions += 2

    await prisma.$transaction(async (tx) => {
      const convertedStockIssue = await tx.stock_issues.findFirst({
        select: { doc_no: true, id: true, status: true },
        where: {
          converted_to_bill_id: created.salesBillId,
          status: 'converted',
        },
      })
      assert(convertedStockIssue, 'converted PSALE not found before Sales Bill cancel')

      const holds = await reversePendingSaleStockIssue(tx, {
        actor,
        cancelDate: normalizeDate(cancelledAt.toISOString().slice(0, 10)),
        note: 'QA cancel Sales Bill from PSALE',
        stockIssueDocNo: convertedStockIssue.doc_no,
      })
      const ticketIds = [...new Set(holds.map((hold) => hold.weight_ticket_id))]
      await Promise.all(ticketIds.map(async (ticketId) => {
        const ticket = await tx.weight_tickets.findUnique({ select: { status: true }, where: { id: ticketId } })
        if (!ticket) return
        await tx.weight_tickets.update({
          data: {
            status: 'delivered',
            updated_at: cancelledAt,
            updated_by: actor,
          },
          where: { id: ticketId },
        })
        await appendWeightTicketStatusLog(tx, {
          action: WEIGHT_TICKET_STATUS_ACTION.USAGE_STATUS_CHANGED,
          actor,
          createdAt: cancelledAt,
          fromStatus: ticket.status,
          meta: {
            reason: 'qa_sales_bill_cancel_from_pending_sale',
            salesBillDocNo: created.salesBillDocNo,
            stockIssueDocNo: convertedStockIssue.doc_no,
          },
          note: 'QA cancel Sales Bill from PSALE',
          toStatus: 'delivered',
          weightTicketId: ticketId,
        })
      }))
      await tx.stock_issues.update({
        data: {
          notes: 'QA cancel Sales Bill from PSALE',
          status: 'cancelled',
        },
        where: { id: convertedStockIssue.id },
      })
      await appendStockIssueStatusLog(tx, {
        action: STOCK_ISSUE_STATUS_ACTION.CANCELLED,
        actor,
        createdAt: cancelledAt,
        fromStatus: convertedStockIssue.status,
        meta: {
          reason: 'qa_sales_bill_cancel_from_pending_sale',
          reverseRefType: 'PSALE-CANCEL',
          salesBillDocNo: created.salesBillDocNo,
        },
        note: 'QA cancel Sales Bill from PSALE',
        stockIssueId: convertedStockIssue.id,
        toStatus: 'cancelled',
      })

      await Promise.all([
        tx.sales_bill_lines.updateMany({
          data: {
            notes: `Cancelled from Sales Bill ${created.salesBillDocNo}: QA cancel Sales Bill from PSALE`,
            status: 'cancelled',
            updated_at: cancelledAt,
            updated_by: actor,
          },
          where: { sales_bill_id: created.salesBillId, status: 'active' },
        }),
        tx.sales_bill_source_allocations.updateMany({
          data: {
            notes: `Cancelled from Sales Bill ${created.salesBillDocNo}: QA cancel Sales Bill from PSALE`,
            status: 'cancelled',
            updated_at: cancelledAt,
            updated_by: actor,
          },
          where: { sales_bill_id: created.salesBillId, status: 'active' },
        }),
      ])

      await tx.sales_bills.update({
        data: {
          cancel_note: 'QA cancel Sales Bill from PSALE',
          cancelled_at: cancelledAt,
          cancelled_by: actor,
          receivable_balance: 0,
          status: 'cancelled',
          updated_at: cancelledAt,
          updated_by: actor,
        },
        where: { id: created.salesBillId },
      })
      await appendSalesBillStatusLog(tx, {
        action: SALES_BILL_STATUS_ACTION.CANCELLED,
        actor,
        createdAt: cancelledAt,
        fromStatus: 'unreceived',
        meta: { reason: 'qa_sales_bill_cancel' },
        note: 'QA cancel Sales Bill from PSALE',
        salesBillId: created.salesBillId,
        toStatus: 'cancelled',
      })
    }, { timeout: 30000 })

    const [ledgerAfterCancel, stockIssue, bill, activeHoldCount, cancelledLineCount, cancelledSourceCount, ticket] = await Promise.all([
      prisma.stock_ledger.groupBy({
        _sum: { qty_in: true, qty_out: true },
        by: ['ref_type'],
        where: {
          OR: [
            { ref_no: created.stockIssueDocNo },
            { ref_no: created.salesBillDocNo },
          ],
          ref_type: { in: ['PSALE', 'PSALE-CANCEL', 'SB', 'SB-CANCEL'] },
        },
      }),
      prisma.stock_issues.findUnique({
        select: { converted_to_bill_id: true, status: true },
        where: { id: created.stockIssueId },
      }),
      prisma.sales_bills.findUnique({
        select: { receivable_balance: true, status: true },
        where: { id: created.salesBillId },
      }),
      prisma.stock_holds.count({
        where: {
          consumed_by_ref_no: null,
          consumed_by_ref_type: null,
          status: 'active',
          weight_ticket_id: created.ticketId,
        },
      }),
      prisma.sales_bill_lines.count({
        where: { sales_bill_id: created.salesBillId, status: 'cancelled' },
      }),
      prisma.sales_bill_source_allocations.count({
        where: { movement_owner: 'PSALE', sales_bill_id: created.salesBillId, source_type: 'PSALE', status: 'cancelled' },
      }),
      prisma.weight_tickets.findUnique({
        select: { status: true },
        where: { id: created.ticketId },
      }),
    ])

    const psaleQtyOut = toNumber(ledgerAfterCancel.find((row) => row.ref_type === 'PSALE')?._sum.qty_out)
    const psaleCancelQtyIn = toNumber(ledgerAfterCancel.find((row) => row.ref_type === 'PSALE-CANCEL')?._sum.qty_in)
    const sbLedgerRows = ledgerAfterCancel.filter((row) => row.ref_type === 'SB' || row.ref_type === 'SB-CANCEL')
    assertNear('PSALE original stock out remains', psaleQtyOut, 100)
    assertNear('PSALE-CANCEL reverses stock out', psaleCancelQtyIn, 100)
    assertNear('PSALE net qty is zero after SB cancel', psaleCancelQtyIn - psaleQtyOut, 0)
    assertEqual('SB/SB-CANCEL ledger rows stay absent for SB-from-PSALE', sbLedgerRows.length, 0)
    assertEqual('PSALE status after SB cancel', stockIssue?.status, 'cancelled')
    assertEqual('PSALE keeps converted bill link for audit trail', stockIssue?.converted_to_bill_id, created.salesBillId)
    assertEqual('Sales Bill status after cancel', bill?.status, 'cancelled')
    assertNear('Sales Bill receivable balance after cancel', toNumber(bill?.receivable_balance), 0)
    assertEqual('WTO hold is reopened after SB cancel from PSALE', activeHoldCount, 1)
    assertEqual('WTO ticket returns to delivered after SB cancel from PSALE', ticket?.status, 'delivered')
    assertEqual('Sales Bill line facts are cancelled', cancelledLineCount, 1)
    assertEqual('PSALE source allocation facts are cancelled', cancelledSourceCount, 1)
    assertions += 12
  } finally {
    await cleanup(prisma)
    const residual = await prisma.sales_bills.count({ where: { doc_no: { startsWith: qaPrefix } } })
    assertEqual('fixture cleanup', residual, 0)
    assertions += 1
    await prisma.$disconnect()
  }

  console.log(JSON.stringify({
    assertions,
    cleanupPrefix: qaPrefix,
    status: 'ok',
  }, null, 2))
}

main().catch((caught) => {
  console.error(caught)
  process.exit(1)
})
