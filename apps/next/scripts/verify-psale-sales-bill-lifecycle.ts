import nextEnv from '@next/env'
import type { Prisma } from '../generated/prisma/client'

const projectDir = new URL('..', import.meta.url).pathname
const { loadEnvConfig } = nextEnv
loadEnvConfig(projectDir)

const rollbackSentinel = new Error('ROLLBACK_PSALE_SALES_BILL_LIFECYCLE_QA')
const qaPrefix = `QA-PSALE-SB-${Date.now().toString(36)}`
const actor = 'qa-psale-sales-bill-lifecycle'

function assertEqual(label: string, actual: unknown, expected: unknown) {
  if (actual === expected) return
  throw new Error(`${label} expected ${String(expected)}, got ${String(actual)}`)
}

function assertNear(label: string, actual: number, expected: number, tolerance = 0.000001) {
  if (Math.abs(actual - expected) <= tolerance) return
  throw new Error(`${label} expected ${expected}, got ${actual}`)
}

async function main() {
  const [
    { prisma },
    { normalizeDate, toNumber },
    { consumeActiveWtoStockHoldsForPendingSale, reversePendingSaleStockIssue },
    { appendStockIssueStatusLog, STOCK_ISSUE_STATUS_ACTION },
    { appendSalesBillStatusLog, SALES_BILL_STATUS_ACTION },
  ] = await Promise.all([
    import('../src/lib/server/prisma'),
    import('../src/lib/server/daily'),
    import('../src/lib/server/stock-holds'),
    import('../src/lib/server/stock-issue-history'),
    import('../src/lib/server/sales-bill-history'),
  ])

  let assertions = 0
  let rolledBack = false
  const qaDate = normalizeDate('2026-06-14')

  try {
    await prisma.$transaction(async (tx) => {
      const branch = await tx.branches.create({
        data: { code: `${qaPrefix}-BR`, name: `${qaPrefix} Branch` },
      })
      const warehouse = await tx.warehouses.create({
        data: { branch_id: branch.id, code: `${qaPrefix}-WH`, name: `${qaPrefix} Warehouse` },
      })
      const customer = await tx.customers.create({
        data: { code: `${qaPrefix}-CU`, name: `${qaPrefix} Customer` },
      })
      const product = await tx.products.create({
        data: { code: `${qaPrefix}-P1`, name: `${qaPrefix} Product`, unit: 'kg' },
      })
      const channel = await tx.sales_channels.create({
        data: { code: `${qaPrefix}-SC`, name: `${qaPrefix} Channel` },
      })

      await tx.stock_ledger.create({
        data: {
          branch_id: branch.id,
          created_by: actor,
          date: qaDate,
          movement_type: 'QA opening stock',
          note: 'QA opening stock for PSALE lifecycle',
          product_id: product.id,
          qty_in: 100,
          qty_out: 0,
          ref_no: `${qaPrefix}-OPEN`,
          ref_type: 'QA-OPEN',
          unit_cost: 12,
          value_in: 1200,
          value_out: 0,
          warehouse_id: warehouse.id,
        },
      })

      const ticket = await tx.weight_tickets.create({
        data: {
          branch_id: branch.id,
          customer_id: customer.id,
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
          deduction_mode: 'none',
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
      await tx.stock_holds.create({
        data: {
          branch_id: branch.id,
          created_by: actor,
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

      const stockIssueDocNo = `${qaPrefix}-PSALE`
      const consumedLines = await consumeActiveWtoStockHoldsForPendingSale(tx, {
        actor,
        branchId: branch.id,
        issueDate: qaDate,
        stockIssueDocNo,
        weightTicketId: ticket.id,
      })
      assertEqual('PSALE consumed line count', consumedLines.length, 1)
      assertNear('PSALE consumed qty', consumedLines[0]?.qty ?? 0, 100)
      assertNear('PSALE consumed unit cost from stock ledger', consumedLines[0]?.unitCost ?? 0, 12)
      assertions += 3

      const stockIssueItems = consumedLines.map((line, index) => ({
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
          doc_no: stockIssueDocNo,
          items: stockIssueItems as Prisma.InputJsonValue,
          notes: 'QA PSALE create',
          status: 'pending',
          total_cost: 1200,
          total_est_amount: 2000,
          warehouse_id: warehouse.id,
        },
      })
      await appendStockIssueStatusLog(tx, {
        action: STOCK_ISSUE_STATUS_ACTION.CREATED,
        actor,
        meta: { deliveryTicketDocNo: ticket.doc_no, scenario: 'qa_psale_create' },
        note: 'QA PSALE create',
        stockIssueId: stockIssue.id,
        toStatus: 'pending',
      })
      await tx.weight_tickets.update({
        data: { status: 'partially_billed', updated_at: new Date(), updated_by: actor },
        where: { id: ticket.id },
      })

      const consumedHolds = await tx.stock_holds.findMany({
        take: 1,
        where: { weight_ticket_line_id: ticketLine.id },
      })
      const consumedHold = consumedHolds[0]
      if (!consumedHold) throw new Error('consumed hold not found after PSALE create')
      assertEqual('hold consumed by PSALE', consumedHold.status, 'consumed')
      assertEqual('hold consumed ref type', consumedHold.consumed_by_ref_type, 'PSALE')
      assertEqual('hold consumed ref no', consumedHold.consumed_by_ref_no, stockIssueDocNo)
      const psaleLedger = await tx.stock_ledger.findMany({
        where: { ref_no: stockIssueDocNo, ref_type: { in: ['PSALE', 'PSALE-CANCEL', 'SB', 'SB-CANCEL'] } },
      })
      assertEqual('PSALE create ledger rows', psaleLedger.length, 1)
      assertEqual('PSALE create ledger type', psaleLedger[0]?.ref_type, 'PSALE')
      assertNear('PSALE create qty out', toNumber(psaleLedger[0]?.qty_out), 100)
      assertNear('PSALE create value out', toNumber(psaleLedger[0]?.value_out), 1200)
      assertions += 7

      const salesBillDocNo = `${qaPrefix}-SB`
      const salesBill = await tx.sales_bills.create({
        data: {
          branch_id: branch.id,
          channel_id: channel.id,
          cogs_amount: 1200,
          customer_id: customer.id,
          date: qaDate,
          doc_no: salesBillDocNo,
          from_p_sale_id: stockIssue.id,
          from_p_sale_no: stockIssue.doc_no,
          gross_profit: 800,
          items: stockIssueItems as Prisma.InputJsonValue,
          receivable_balance: 2000,
          status: 'unreceived',
          subtotal: 2000,
          total_amount: 2000,
          total_cost: 1200,
          transaction_mode: 'STOCK',
          warehouse_id: warehouse.id,
        },
      })
      const salesBillLine = await tx.sales_bill_lines.create({
        data: {
          created_by: actor,
          gross_weight: 100,
          line_amount: 2000,
          line_no: 1,
          net_weight: 100,
          product_code_snapshot: product.code,
          product_id: product.id,
          product_name_snapshot: product.name,
          qty: 100,
          sales_bill_id: salesBill.id,
          unit_price: 20,
          unit_snapshot: product.unit,
        },
      })
      await tx.sales_bill_source_allocations.create({
        data: {
          allocated_net_weight: 100,
          allocated_qty: 100,
          created_by: actor,
          movement_owner: 'PSALE',
          product_code_snapshot: product.code,
          product_id: product.id,
          product_name_snapshot: product.name,
          sales_bill_id: salesBill.id,
          sales_bill_line_id: salesBillLine.id,
          sales_line_no: 1,
          source_doc_no: stockIssue.doc_no,
          source_line_no: 1,
          source_type: 'PSALE',
          stock_issue_id: stockIssue.id,
          stock_ledger_ref_type: 'PSALE',
        },
      })
      await tx.sales_bill_po_sell_allocations.create({
        data: {
          allocated_amount: 2000,
          allocated_qty: 100,
          allocation_type: 'SPOT_SALE',
          created_by: actor,
          product_code_snapshot: product.code,
          product_id: product.id,
          product_name_snapshot: product.name,
          sales_bill_id: salesBill.id,
          sales_bill_line_id: salesBillLine.id,
          sales_line_no: 1,
          unit_price: 20,
        },
      })
      await tx.stock_issues.update({
        data: { converted_to_bill_id: salesBill.id, status: 'converted' },
        where: { id: stockIssue.id },
      })
      await appendStockIssueStatusLog(tx, {
        action: STOCK_ISSUE_STATUS_ACTION.CONVERTED,
        actor,
        fromStatus: 'pending',
        meta: { salesBillDocNo, scenario: 'qa_psale_convert_to_sb' },
        note: 'QA convert PSALE to SB',
        stockIssueId: stockIssue.id,
        toStatus: 'converted',
      })
      await appendSalesBillStatusLog(tx, {
        action: SALES_BILL_STATUS_ACTION.CREATED,
        actor,
        meta: { pendingStockIssueDocNo: stockIssue.doc_no, scenario: 'qa_sb_from_psale_create' },
        note: 'QA SB from PSALE create',
        salesBillId: salesBill.id,
        toStatus: 'unreceived',
      })

      const convertedIssue = await tx.stock_issues.findUniqueOrThrow({
        select: { converted_to_bill_id: true, status: true },
        where: { id: stockIssue.id },
      })
      assertEqual('PSALE converted status', convertedIssue.status, 'converted')
      assertEqual('PSALE converted linked SB', convertedIssue.converted_to_bill_id, salesBill.id)
      const sbLedgerAfterConvert = await tx.stock_ledger.count({
        where: { ref_no: salesBillDocNo, ref_type: { in: ['SB', 'SB-CANCEL'] } },
      })
      assertEqual('SB from PSALE does not create SB ledger on convert', sbLedgerAfterConvert, 0)
      const activeSourceAllocations = await tx.sales_bill_source_allocations.count({
        where: { sales_bill_id: salesBill.id, source_type: 'PSALE', status: 'active' },
      })
      assertEqual('SB from PSALE active source allocation', activeSourceAllocations, 1)
      assertions += 4

      await reversePendingSaleStockIssue(tx, {
        actor,
        cancelDate: qaDate,
        note: 'QA cancel SB from PSALE',
        stockIssueDocNo: stockIssue.doc_no,
      })
      await tx.weight_tickets.update({
        data: { status: 'delivered', updated_at: new Date(), updated_by: actor },
        where: { id: ticket.id },
      })
      await tx.stock_issues.update({
        data: { status: 'cancelled' },
        where: { id: stockIssue.id },
      })
      await appendStockIssueStatusLog(tx, {
        action: STOCK_ISSUE_STATUS_ACTION.CANCELLED,
        actor,
        fromStatus: 'converted',
        meta: { salesBillDocNo, reverseRefType: 'PSALE-CANCEL', scenario: 'qa_sb_from_psale_cancel' },
        note: 'QA cancel SB from PSALE',
        stockIssueId: stockIssue.id,
        toStatus: 'cancelled',
      })
      await tx.sales_bill_lines.updateMany({
        data: { status: 'cancelled', updated_at: new Date(), updated_by: actor },
        where: { sales_bill_id: salesBill.id, status: 'active' },
      })
      await tx.sales_bill_source_allocations.updateMany({
        data: { status: 'cancelled', updated_at: new Date(), updated_by: actor },
        where: { sales_bill_id: salesBill.id, status: 'active' },
      })
      await tx.sales_bill_po_sell_allocations.updateMany({
        data: { status: 'cancelled', updated_at: new Date(), updated_by: actor },
        where: { sales_bill_id: salesBill.id, status: 'active' },
      })
      await tx.sales_bills.update({
        data: {
          cancel_note: 'QA cancel SB from PSALE',
          cancelled_at: new Date(),
          cancelled_by: actor,
          receivable_balance: 0,
          status: 'cancelled',
        },
        where: { id: salesBill.id },
      })
      await appendSalesBillStatusLog(tx, {
        action: SALES_BILL_STATUS_ACTION.CANCELLED,
        actor,
        fromStatus: 'unreceived',
        meta: { pendingStockIssueDocNo: stockIssue.doc_no, reverseRefType: 'PSALE-CANCEL', scenario: 'qa_sb_from_psale_cancel' },
        note: 'QA cancel SB from PSALE',
        salesBillId: salesBill.id,
        toStatus: 'cancelled',
      })

      const ledgerAfterCancel = await tx.stock_ledger.groupBy({
        _sum: { qty_in: true, qty_out: true, value_in: true, value_out: true },
        by: ['ref_type'],
        where: { ref_no: stockIssue.doc_no, ref_type: { in: ['PSALE', 'PSALE-CANCEL'] } },
      })
      const psaleQtyNet = ledgerAfterCancel.reduce((sum, row) => sum + toNumber(row._sum.qty_in) - toNumber(row._sum.qty_out), 0)
      const psaleValueNet = ledgerAfterCancel.reduce((sum, row) => sum + toNumber(row._sum.value_in) - toNumber(row._sum.value_out), 0)
      assertEqual('PSALE cancel ledger ref type count', ledgerAfterCancel.length, 2)
      assertNear('PSALE cancel ledger qty net zero', psaleQtyNet, 0)
      assertNear('PSALE cancel ledger value net zero', psaleValueNet, 0)
      const finalHolds = await tx.stock_holds.findMany({
        take: 1,
        where: { weight_ticket_line_id: ticketLine.id },
      })
      const finalHold = finalHolds[0]
      if (!finalHold) throw new Error('stock hold not found after SB-from-PSALE cancel')
      assertEqual('hold reopened after SB-from-PSALE cancel', finalHold.status, 'active')
      assertEqual('hold consumed ref cleared after SB-from-PSALE cancel', finalHold.consumed_by_ref_no, null)
      const finalIssue = await tx.stock_issues.findUniqueOrThrow({
        select: { status: true },
        where: { id: stockIssue.id },
      })
      const finalBill = await tx.sales_bills.findUniqueOrThrow({
        select: { status: true },
        where: { id: salesBill.id },
      })
      assertEqual('PSALE cancelled after SB-from-PSALE cancel', finalIssue.status, 'cancelled')
      assertEqual('SB cancelled after SB-from-PSALE cancel', finalBill.status, 'cancelled')
      const finalSbLedger = await tx.stock_ledger.count({
        where: { ref_no: salesBillDocNo, ref_type: { in: ['SB', 'SB-CANCEL'] } },
      })
      assertEqual('SB-from-PSALE cancel does not create SB ledger', finalSbLedger, 0)
      const cancelledSourceFacts = await tx.sales_bill_source_allocations.count({
        where: { sales_bill_id: salesBill.id, source_type: 'PSALE', status: 'cancelled' },
      })
      assertEqual('SB-from-PSALE source facts cancelled', cancelledSourceFacts, 1)
      assertions += 9

      throw rollbackSentinel
    }, { timeout: 30000 })
  } catch (caught) {
    if (caught === rollbackSentinel) {
      rolledBack = true
    } else {
      throw caught
    }
  } finally {
    await prisma.$disconnect()
  }

  assertEqual('transaction rollback', rolledBack, true)
  assertions += 1

  console.log(JSON.stringify({
    assertions,
    prefix: qaPrefix,
    rolledBack,
    status: 'ok',
  }, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
