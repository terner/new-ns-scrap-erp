import { z } from 'zod'

export const productionOutputCategoryCodeSchema = z.enum(['FG', 'RM', 'CUSTOMER_RETURN', 'LOSS'])
export type ProductionOutputCategoryCode = z.infer<typeof productionOutputCategoryCodeSchema>

export const productionOutputStockEffectSchema = z.enum(['stock_in', 'return_stock_in', 'loss'])
export type ProductionOutputStockEffect = z.infer<typeof productionOutputStockEffectSchema>

export type ProductionOutputCategoryDefinition = {
  availableForSale: boolean
  code: ProductionOutputCategoryCode
  destinationMovementType: 'PRODUCTION_OUTPUT_IN' | 'PRODUCTION_OUTPUT_RM_IN' | 'CUSTOMER_RETURN_IN' | null
  nameTh: string
  outputStatus: 'FG' | 'RM' | 'RETURN' | 'LOSS'
  outputType: 'Main Product' | 'Recovered Material' | 'Customer Return' | 'Loss'
  stockEffect: ProductionOutputStockEffect
  wipOutMovementType: 'PRODUCTION_OUTPUT_WIP_OUT' | 'PRODUCTION_LOSS'
}

export const productionOutputCategoryDefinitions: Record<ProductionOutputCategoryCode, ProductionOutputCategoryDefinition> = {
  FG: {
    availableForSale: true,
    code: 'FG',
    destinationMovementType: 'PRODUCTION_OUTPUT_IN',
    nameTh: 'สินค้าสำเร็จรูป',
    outputStatus: 'FG',
    outputType: 'Main Product',
    stockEffect: 'stock_in',
    wipOutMovementType: 'PRODUCTION_OUTPUT_WIP_OUT',
  },
  RM: {
    availableForSale: true,
    code: 'RM',
    destinationMovementType: 'PRODUCTION_OUTPUT_RM_IN',
    nameTh: 'วัตถุดิบที่ได้กลับมา',
    outputStatus: 'RM',
    outputType: 'Recovered Material',
    stockEffect: 'stock_in',
    wipOutMovementType: 'PRODUCTION_OUTPUT_WIP_OUT',
  },
  CUSTOMER_RETURN: {
    availableForSale: false,
    code: 'CUSTOMER_RETURN',
    destinationMovementType: 'CUSTOMER_RETURN_IN',
    nameTh: 'ของคืนลูกค้า',
    outputStatus: 'RETURN',
    outputType: 'Customer Return',
    stockEffect: 'return_stock_in',
    wipOutMovementType: 'PRODUCTION_OUTPUT_WIP_OUT',
  },
  LOSS: {
    availableForSale: false,
    code: 'LOSS',
    destinationMovementType: null,
    nameTh: 'สูญเสีย / ของเสีย',
    outputStatus: 'LOSS',
    outputType: 'Loss',
    stockEffect: 'loss',
    wipOutMovementType: 'PRODUCTION_LOSS',
  },
}

export function getProductionOutputCategoryDefinition(code: string) {
  const parsed = productionOutputCategoryCodeSchema.safeParse(code)
  return parsed.success ? productionOutputCategoryDefinitions[parsed.data] : null
}
