import { describe, expect, it } from 'vitest'
import {
  calculatePurchaseBillPostAdvanceTotals,
  calculateSupplierAdvanceAllocation,
  calculateSupplierAdvancePaidBaseCapacity,
} from './purchase-advance'

describe('supplier advance base-credit calculations', () => {
  it('converts a fully paid VAT-inclusive ADV to pre-VAT base credit once', () => {
    expect(calculateSupplierAdvancePaidBaseCapacity({
      settledGrossAmount: 1070,
      subtotalAmount: 1000,
      totalAmount: 1070,
    })).toBe(1000)
  })

  it('converts a partially paid VAT-inclusive ADV proportionally', () => {
    expect(calculateSupplierAdvancePaidBaseCapacity({
      settledGrossAmount: 535,
      subtotalAmount: 1000,
      totalAmount: 1070,
    })).toBe(500)
  })

  it('uses base credit directly against a no-VAT purchase bill', () => {
    expect(calculateSupplierAdvanceAllocation({
      availableBaseAmount: 1000,
      billSubtotalAmount: 1000,
      billTotalAmount: 1000,
      billVatAmount: 0,
    })).toEqual({
      allocatedAmount: 1000,
      allocatedSubtotalAmount: 1000,
      allocatedTotalAmount: 1000,
      allocatedVatAmount: 0,
      remainingBaseAmount: 0,
    })
  })

  it('deducts base credit before calculating the purchase bill VAT relief', () => {
    expect(calculateSupplierAdvanceAllocation({
      availableBaseAmount: 1000,
      billSubtotalAmount: 1000,
      billTotalAmount: 1070,
      billVatAmount: 70,
    })).toEqual({
      allocatedAmount: 1000,
      allocatedSubtotalAmount: 1000,
      allocatedTotalAmount: 1070,
      allocatedVatAmount: 70,
      remainingBaseAmount: 0,
    })
  })

  it('leaves unused ADV as base credit', () => {
    expect(calculateSupplierAdvanceAllocation({
      availableBaseAmount: 1000,
      billSubtotalAmount: 100,
      billTotalAmount: 107,
      billVatAmount: 7,
    })).toEqual({
      allocatedAmount: 100,
      allocatedSubtotalAmount: 100,
      allocatedTotalAmount: 107,
      allocatedVatAmount: 7,
      remainingBaseAmount: 900,
    })
  })

  it('recalculates remaining purchase bill VAT from the taxable base left after ADV', () => {
    expect(calculatePurchaseBillPostAdvanceTotals({
      advanceBaseAllocatedAmount: 4209.5,
      discountAmount: 0,
      hasVat: true,
      subtotalAmount: 5000,
      vatRatePercent: 7,
      vatType: 'EXCLUDE',
    })).toEqual({
      advanceBaseAppliedAmount: 4209.5,
      afterDiscountAmount: 5000,
      taxableBaseAmount: 790.5,
      totalAmount: 845.84,
      vatAmount: 55.34,
      vatBeforeAdvance: 350,
    })
  })

  it('applies discount before ADV and recalculates VAT from the remaining base', () => {
    expect(calculatePurchaseBillPostAdvanceTotals({
      advanceBaseAllocatedAmount: 1000,
      discountAmount: 100,
      hasVat: true,
      subtotalAmount: 2000,
      vatRatePercent: 7,
      vatType: 'EXCLUDE',
    })).toEqual({
      advanceBaseAppliedAmount: 1000,
      afterDiscountAmount: 1900,
      taxableBaseAmount: 900,
      totalAmount: 963,
      vatAmount: 63,
      vatBeforeAdvance: 133,
    })
  })
})
