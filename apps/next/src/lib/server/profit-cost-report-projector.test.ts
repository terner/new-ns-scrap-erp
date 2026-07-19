import { describe, expect, it } from 'vitest'
import {
  allocateStockCogsToSalesLines,
  calculateSalesLineProfit,
  ProfitCostSourceContractError,
  requireSalesLineCosts,
} from './profit-cost-source-lines'

describe('profit-cost source line normalization', () => {
  it('returns COGS by exact sales line number and validates the header total', () => {
    const result = requireSalesLineCosts({
      headerCogsAmount: '150.00',
      lines: [
        { cogsAmount: '100.00', lineNo: 1 },
        { cogsAmount: '50.00', lineNo: 2 },
      ],
      salesLineNumbers: [1, 2],
    })

    expect(result).toEqual(new Map([
      [1, '100.00'],
      [2, '50.00'],
    ]))
  })

  it('rejects missing, duplicate, unexpected, or mismatched line costs', () => {
    expect(() => requireSalesLineCosts({
      headerCogsAmount: '150.00',
      lines: [{ cogsAmount: '150.00', lineNo: 1 }],
      salesLineNumbers: [1, 2],
    })).toThrowError(new ProfitCostSourceContractError('MISSING_LINE_COGS', 2))

    expect(() => requireSalesLineCosts({
      headerCogsAmount: '150.00',
      lines: [
        { cogsAmount: '100.00', lineNo: 1 },
        { cogsAmount: '50.00', lineNo: 1 },
      ],
      salesLineNumbers: [1],
    })).toThrowError(new ProfitCostSourceContractError('DUPLICATE_LINE_COGS', 1))

    expect(() => requireSalesLineCosts({
      headerCogsAmount: '100.00',
      lines: [{ cogsAmount: '100.00', lineNo: 2 }],
      salesLineNumbers: [1],
    })).toThrowError(new ProfitCostSourceContractError('UNEXPECTED_LINE_COGS', 2))

    expect(() => requireSalesLineCosts({
      headerCogsAmount: '151.00',
      lines: [
        { cogsAmount: '100.00', lineNo: 1 },
        { cogsAmount: '50.00', lineNo: 2 },
      ],
      salesLineNumbers: [1, 2],
    })).toThrowError(new ProfitCostSourceContractError('HEADER_LINE_COGS_MISMATCH'))
  })

  it('allocates exact stock COGS across duplicate-product lines without losing cents', () => {
    const result = allocateStockCogsToSalesLines({
      consumed: [
        { productId: 10n, qty: '3.000', valueOut: '100.00' },
      ],
      lines: [
        { lineNo: 1, productId: 10n, qty: '1.000' },
        { lineNo: 2, productId: 10n, qty: '2.000' },
      ],
    })

    expect(result).toEqual(new Map([
      [1, '33.33'],
      [2, '66.67'],
    ]))
  })

  it('calculates line GP from the already-discounted line amount', () => {
    expect(calculateSalesLineProfit({ cogsAmount: '80.00', lineAmount: '95.00' })).toBe('15.00')
  })
})
