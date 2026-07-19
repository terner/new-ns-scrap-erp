export type ProfitCostSourceIssueCode =
  | 'DUPLICATE_LINE_COGS'
  | 'HEADER_LINE_COGS_MISMATCH'
  | 'INVALID_MONEY_DECIMAL'
  | 'INVALID_QUANTITY_DECIMAL'
  | 'MISSING_LINE_COGS'
  | 'UNEXPECTED_LINE_COGS'

export class ProfitCostSourceContractError extends Error {
  readonly issueCode: ProfitCostSourceIssueCode
  readonly lineNo?: number

  constructor(issueCode: ProfitCostSourceIssueCode, lineNo?: number) {
    super(lineNo == null ? issueCode : `${issueCode}: line ${lineNo}`)
    this.name = 'ProfitCostSourceContractError'
    this.issueCode = issueCode
    this.lineNo = lineNo
  }
}

function moneyToCents(value: string) {
  const matched = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(value)
  if (!matched) throw new ProfitCostSourceContractError('INVALID_MONEY_DECIMAL')
  const [, sign, whole, fraction = ''] = matched
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))
  return sign === '-' ? -cents : cents
}

function centsToMoney(value: bigint) {
  const sign = value < 0n ? '-' : ''
  const absolute = value < 0n ? -value : value
  return `${sign}${absolute / 100n}.${String(absolute % 100n).padStart(2, '0')}`
}

function quantityToMillis(value: string) {
  const matched = /^(\d+)(?:\.(\d{1,3}))?$/.exec(value)
  if (!matched) throw new ProfitCostSourceContractError('INVALID_QUANTITY_DECIMAL')
  const [, whole, fraction = ''] = matched
  return BigInt(whole) * 1_000n + BigInt(fraction.padEnd(3, '0'))
}

export function allocateStockCogsToSalesLines(input: {
  consumed: Array<{ productId: bigint; qty: string; valueOut: string }>
  lines: Array<{ lineNo: number; productId: bigint; qty: string }>
}) {
  const consumedByProduct = new Map<bigint, { qtyMillis: bigint; valueCents: bigint }>()
  for (const consumed of input.consumed) {
    const current = consumedByProduct.get(consumed.productId) ?? { qtyMillis: 0n, valueCents: 0n }
    current.qtyMillis += quantityToMillis(consumed.qty)
    current.valueCents += moneyToCents(consumed.valueOut)
    consumedByProduct.set(consumed.productId, current)
  }

  const linesByProduct = new Map<bigint, Array<{ lineNo: number; qtyMillis: bigint }>>()
  for (const line of input.lines) {
    const lines = linesByProduct.get(line.productId) ?? []
    lines.push({ lineNo: line.lineNo, qtyMillis: quantityToMillis(line.qty) })
    linesByProduct.set(line.productId, lines)
  }

  const costsByLineNo = new Map<number, string>()
  for (const [productId, lines] of linesByProduct) {
    const consumed = consumedByProduct.get(productId)
    const requestedQtyMillis = lines.reduce((sum, line) => sum + line.qtyMillis, 0n)
    if (!consumed || consumed.qtyMillis !== requestedQtyMillis || consumed.qtyMillis <= 0n) {
      throw new ProfitCostSourceContractError('MISSING_LINE_COGS', lines[0]?.lineNo)
    }

    let allocatedCents = 0n
    lines.forEach((line, index) => {
      const isLast = index === lines.length - 1
      const lineCents = isLast
        ? consumed.valueCents - allocatedCents
        : consumed.valueCents * line.qtyMillis / consumed.qtyMillis
      allocatedCents += lineCents
      costsByLineNo.set(line.lineNo, centsToMoney(lineCents))
    })
  }

  for (const productId of consumedByProduct.keys()) {
    if (!linesByProduct.has(productId)) {
      throw new ProfitCostSourceContractError('UNEXPECTED_LINE_COGS')
    }
  }

  return costsByLineNo
}

export function calculateSalesLineProfit(input: {
  cogsAmount: string
  lineAmount: string
}) {
  return centsToMoney(moneyToCents(input.lineAmount) - moneyToCents(input.cogsAmount))
}

export function requireSalesLineCosts(input: {
  headerCogsAmount: string
  lines: Array<{ cogsAmount: string; lineNo: number }>
  salesLineNumbers: number[]
}) {
  const expectedLineNumbers = new Set(input.salesLineNumbers)
  const costsByLineNo = new Map<number, string>()
  let lineTotalCents = 0n

  for (const line of input.lines) {
    if (!expectedLineNumbers.has(line.lineNo)) {
      throw new ProfitCostSourceContractError('UNEXPECTED_LINE_COGS', line.lineNo)
    }
    if (costsByLineNo.has(line.lineNo)) {
      throw new ProfitCostSourceContractError('DUPLICATE_LINE_COGS', line.lineNo)
    }
    const cents = moneyToCents(line.cogsAmount)
    costsByLineNo.set(line.lineNo, centsToMoney(cents))
    lineTotalCents += cents
  }

  for (const lineNo of expectedLineNumbers) {
    if (!costsByLineNo.has(lineNo)) {
      throw new ProfitCostSourceContractError('MISSING_LINE_COGS', lineNo)
    }
  }

  if (lineTotalCents !== moneyToCents(input.headerCogsAmount)) {
    throw new ProfitCostSourceContractError('HEADER_LINE_COGS_MISMATCH')
  }

  return costsByLineNo
}
