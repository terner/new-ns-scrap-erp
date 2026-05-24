import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { AuthContextError, getCurrentAuthContext, requirePermission } from '@/lib/server/auth-context'
import { PageTitleOverride } from '@/components/layout/PageTitleOverride'
import { toDateOnly, toNumber } from '@/lib/server/daily'
import { prisma } from '@/lib/server/prisma'
import { purchaseBillItemRows } from '@/lib/server/purchase-bill-items'

export const metadata: Metadata = {
  title: 'รายละเอียดบิลรับซื้อ | NS Scrap ERP',
}

type PageProps = {
  params: Promise<{ id: string }>
}

type PurchaseItem = {
  amount?: number
  deductWeight?: number
  discount?: number
  displayName?: string | null
  grossWeight?: number
  poBuyId?: string | null
  price?: number
  productCode?: string
  productId?: string
  productName?: string
  qty?: number
  salesPrice?: number
  unit?: string
}

type TimelineEvent = {
  amount?: number
  date: string
  details: string[]
  title: string
  tone?: 'amber' | 'blue' | 'emerald' | 'rose' | 'slate'
}

function money(value: number | null | undefined) {
  return (value ?? 0).toLocaleString('th-TH', { maximumFractionDigits: 2, minimumFractionDigits: 2 })
}

export default async function PurchaseBillDetailPage({ params }: PageProps) {
  try {
    const context = await getCurrentAuthContext()
    requirePermission(context, 'finance.cash.view')
  } catch (caught) {
    if (caught instanceof AuthContextError && caught.status === 404) notFound()
    throw caught
  }

  const { id } = await params
  const bill = await prisma.purchase_bills.findUnique({
    include: {
      branches: true,
      purchase_bill_items: { orderBy: { line_no: 'asc' } },
      suppliers: true,
    },
    where: { id },
  })

  if (!bill) notFound()

  const paymentRows = await prisma.payments.findMany({
    include: { accounts: true },
    orderBy: [{ created_at: 'asc' }, { date: 'asc' }],
    where: {
      bill_id: id,
      NOT: { status: 'cancelled' },
    },
  })
  const voucherIds = [...new Set(paymentRows.map((payment) => payment.voucher_id).filter((voucherId): voucherId is string => Boolean(voucherId)))]
  const bankStatementRows = voucherIds.length > 0 ? await prisma.bank_statement.findMany({
    include: { accounts: true },
    orderBy: [{ created_at: 'asc' }, { date: 'asc' }],
    where: {
      ref_id: { in: voucherIds },
      ref_type: 'PMT',
    },
  }) : []

  const items = purchaseBillItemRows(bill) as PurchaseItem[]
  const supplierName = bill.suppliers?.name ?? bill.supplier_id ?? '-'
  const subtotal = toNumber(bill.subtotal)
  const discount = toNumber(bill.discount_total ?? bill.discount)
  const vatAmount = toNumber(bill.vat_amount)
  const totalAmount = toNumber(bill.total_amount)
  const payableBalance = toNumber(bill.payable_balance)
  const paidAmount = toNumber(bill.paid_amount)
  const paymentEvents = Array.from(paymentRows.reduce((map, payment) => {
    const key = payment.voucher_id ?? payment.doc_no ?? payment.id
    const current = map.get(key) ?? {
      accountNames: new Set<string>(),
      amount: 0,
      bankFee: 0,
      date: toDateOnly(payment.date),
      docNo: payment.doc_no,
      notes: payment.notes ?? '',
      voucherId: payment.voucher_id ?? payment.id,
      withholdingTax: 0,
    }
    current.amount += toNumber(payment.amount)
    current.bankFee += toNumber(payment.bank_fee ?? payment.fee)
    current.withholdingTax += toNumber(payment.withholding_tax)
    map.set(key, current)
    return map
  }, new Map<string, {
    accountNames: Set<string>
    amount: number
    bankFee: number
    date: string
    docNo: string
    notes: string
    voucherId: string
    withholdingTax: number
  }>()).values()).map((event) => {
    bankStatementRows
      .filter((row) => row.ref_id === event.voucherId)
      .forEach((row) => event.accountNames.add(row.accounts?.name ?? row.account_id ?? '-'))
    return event
  })

  const timeline: TimelineEvent[] = [
    {
      date: bill.date ? toDateOnly(bill.date) : '-',
      details: [
        `เลขที่บิล ${bill.doc_no}`,
        `ผู้ขาย ${supplierName}`,
        `ยอดสุทธิ ${money(totalAmount)}`,
        `ผู้ทำ ${bill.created_by ?? '-'}`,
      ],
      title: 'สร้างบิลรับซื้อ',
      tone: 'blue',
    },
    ...paymentEvents.map((event) => ({
      amount: event.amount,
      date: event.date,
      details: [
        `เลขที่การชำระเงิน ${event.docNo}`,
        `ยอดจ่าย ${money(event.amount)}`,
        `WHT ${money(event.withholdingTax)}`,
        `Fee ${money(event.bankFee)}`,
        `บัญชี ${event.accountNames.size > 0 ? Array.from(event.accountNames).join(', ') : '-'}`,
        `หมายเหตุ ${event.notes || '-'}`,
      ],
      title: 'ชำระเงิน',
      tone: 'emerald' as const,
    })),
  ]

  if (bill.updated_at && bill.updated_by && bill.updated_by !== bill.created_by) {
    timeline.push({
      date: toDateOnly(bill.updated_at),
      details: [
        `ผู้แก้ไข ${bill.updated_by}`,
        `ยอดชำระแล้ว ${money(paidAmount)}`,
        `คงเหลือ ${money(payableBalance)}`,
      ],
      title: 'แก้ไขบิลล่าสุด',
      tone: 'amber',
    })
  }

  if (String(bill.status ?? '').toLowerCase().includes('cancel')) {
    timeline.push({
      date: bill.cancelled_at ? toDateOnly(bill.cancelled_at) : (bill.updated_at ? toDateOnly(bill.updated_at) : '-'),
      details: [
        `ผู้ยกเลิก ${bill.cancelled_by ?? bill.updated_by ?? '-'}`,
        `หมายเหตุ ${bill.cancel_note ?? '-'}`,
      ],
      title: 'ยกเลิกบิล',
      tone: 'rose',
    })
  } else if (payableBalance <= 0.01 && paidAmount > 0) {
    timeline.push({
      date: bill.updated_at ? toDateOnly(bill.updated_at) : '-',
      details: [
        `ยอดชำระแล้ว ${money(paidAmount)}`,
        `สถานะ ${bill.status ?? 'paid'}`,
      ],
      title: 'ชำระครบ',
      tone: 'slate',
    })
  }

  return (
    <div className="space-y-4">
      <PageTitleOverride breadcrumbLabel={bill.doc_no} title={`รายละเอียดบิลรับซื้อ - ${bill.doc_no}`} />
      <div className="flex flex-wrap justify-start gap-2">
        <Link className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50" href="/purchase/bills">กลับรายการ</Link>
      </div>

      <section className="grid gap-3 md:grid-cols-4">
        <Summary label="ยอดรวม" value={money(totalAmount)} />
        <Summary label="ค้างชำระ" tone="red" value={money(payableBalance)} />
        <Summary label="ชำระแล้ว" tone="emerald" value={money(paidAmount)} />
        <Summary label="สถานะ" value={bill.status ?? '-'} />
      </section>

      <section className="rounded-md bg-white p-4 shadow">
        <h2 className="mb-3 text-base font-bold text-slate-800">ข้อมูลบิล</h2>
        <div className="grid gap-3 text-sm md:grid-cols-3">
          <Info label="เลขที่บิล" mono value={bill.doc_no} />
          <Info label="วันที่สร้างรายการ" value={bill.date ? toDateOnly(bill.date) : '-'} />
          <Info label="ผู้ขาย" value={supplierName} />
          <Info label="รหัสผู้ขาย" mono value={bill.supplier_id ?? '-'} />
          <Info label="สาขา/คลัง" value={bill.branches?.name ?? '-'} />
          <Info label="ประเภทบิล" value={bill.transaction_mode ?? 'STOCK'} />
          <Info label="ผู้ทำ" value={bill.created_by ?? '-'} />
        </div>
      </section>

      <section className="rounded-md bg-white p-4 shadow">
        <h2 className="mb-3 text-base font-bold text-slate-800">รายการสินค้า</h2>
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="p-2 text-left">สินค้า</th>
                <th className="p-2 text-left">PO</th>
                <th className="p-2 text-right">Gross</th>
                <th className="p-2 text-right">หัก</th>
                <th className="p-2 text-right">สุทธิ</th>
                <th className="p-2 text-right">ราคา</th>
                <th className="p-2 text-right">ส่วนลด</th>
                <th className="p-2 text-right">ยอดรวม</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={`${item.productId ?? 'item'}-${index}`} className="border-t">
                  <td className="p-2">
                    <div className="font-medium text-slate-900">{item.displayName || item.productName || '-'}</div>
                    <div className="font-mono text-xs text-slate-500">{item.productCode || item.productId || '-'}</div>
                  </td>
                  <td className="p-2 font-mono text-xs">{item.poBuyId || 'Spot Buy'}</td>
                  <td className="p-2 text-right font-mono">{money(item.grossWeight)}</td>
                  <td className="p-2 text-right font-mono">{money(item.deductWeight)}</td>
                  <td className="p-2 text-right font-mono font-semibold">{money(item.qty)} {item.unit ?? ''}</td>
                  <td className="p-2 text-right font-mono">{money(item.price)}</td>
                  <td className="p-2 text-right font-mono">{money(item.discount)}</td>
                  <td className="p-2 text-right font-mono font-bold text-blue-700">{money(item.amount)}</td>
                </tr>
              ))}
              {items.length === 0 ? <tr><td className="p-6 text-center text-slate-500" colSpan={8}>ไม่มีรายการสินค้าในบิล</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-md bg-white p-4 shadow">
          <h2 className="mb-3 text-base font-bold text-slate-800">VAT / ยอดรวม</h2>
          <div className="space-y-2 text-sm">
            <Line label="ยอดก่อนส่วนลด" value={money(subtotal)} />
            <Line label="ส่วนลดท้ายบิล" value={money(discount)} />
            <Line label="VAT" value={money(vatAmount)} />
            <Line strong label="ยอดสุทธิ" value={money(totalAmount)} />
          </div>
        </div>
        <div className="rounded-md bg-white p-4 shadow">
          <h2 className="mb-3 text-base font-bold text-slate-800">ใบกำกับภาษี / หมายเหตุ</h2>
          <div className="grid gap-3 text-sm md:grid-cols-2">
            <Info label="ได้รับใบกำกับภาษี" value={bill.vat_invoice_received ? 'ได้รับแล้ว' : 'ยังไม่ได้รับ'} />
            <Info label="เลขที่ใบกำกับภาษี" mono value={bill.vat_invoice_no ?? '-'} />
            <Info label="วันที่ใบกำกับภาษี" value={bill.vat_invoice_date ? toDateOnly(bill.vat_invoice_date) : '-'} />
            <Info label="หมายเหตุ" value={bill.note ?? bill.notes ?? '-'} />
          </div>
        </div>
      </section>

      <section className="rounded-md bg-white p-4 shadow">
        <h2 className="mb-3 text-base font-bold text-slate-800">Timeline บิลรับซื้อ</h2>
        <div className="space-y-4">
          {timeline.map((event, index) => (
            <div key={`${event.title}-${event.date}-${index}`} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span className={`mt-1 h-3 w-3 rounded-md-full ${
                  event.tone === 'blue'
                    ? 'bg-blue-500'
                    : event.tone === 'emerald'
                      ? 'bg-emerald-500'
                      : event.tone === 'amber'
                        ? 'bg-amber-500'
                        : event.tone === 'rose'
                          ? 'bg-rose-500'
                          : 'bg-slate-500'
                }`} />
                {index < timeline.length - 1 ? <span className="mt-1 h-full w-px bg-slate-200" /> : null}
              </div>
              <div className="flex-1 rounded-md border border-slate-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold text-slate-900">{event.title}</div>
                  <div className="font-mono text-xs text-slate-500">{event.date}</div>
                </div>
                <div className="mt-2 space-y-1 text-sm text-slate-700">
                  {event.details.map((detail) => <div key={detail}>{detail}</div>)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function Summary({ label, tone = 'slate', value }: { label: string; tone?: 'emerald' | 'red' | 'slate'; value: string }) {
  const color = tone === 'red' ? 'text-red-700' : tone === 'emerald' ? 'text-emerald-700' : 'text-slate-900'
  return <div className="rounded-md bg-white p-4 shadow"><div className="text-xs text-slate-500">{label}</div><div className={`mt-1 text-xl font-bold ${color}`}>{value}</div></div>
}

function Info({ label, mono = false, value }: { label: string; mono?: boolean; value: string }) {
  return <div><div className="text-xs text-slate-500">{label}</div><div className={`mt-1 font-medium text-slate-900 ${mono ? 'font-mono' : ''}`}>{value}</div></div>
}

function Line({ label, strong = false, value }: { label: string; strong?: boolean; value: string }) {
  return <div className={`flex justify-between gap-3 ${strong ? 'border-t pt-2 font-bold text-slate-900' : 'text-slate-700'}`}><span>{label}</span><span className="font-mono">{value}</span></div>
}
