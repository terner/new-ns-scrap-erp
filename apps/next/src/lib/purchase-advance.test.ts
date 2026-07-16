import { describe, expect, it } from 'vitest'
import {
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
})
