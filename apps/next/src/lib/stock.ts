import { z } from 'zod'

const blankToNull = (value: unknown) => (typeof value === 'string' && value.trim() === '' ? null : value)
const docNoPattern = /^[A-Za-z0-9_-]+$/
const generalTextPattern = /^[^\u0000-\u001F\u007F]+$/u

const requiredDate = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'วันที่ต้องเป็นรูปแบบ YYYY-MM-DD')
const optionalDocNo = z.preprocess(
  blankToNull,
  z.string().trim().max(40, 'เลขที่เอกสารยาวเกินไป').regex(docNoPattern, 'เลขที่เอกสารใช้ได้เฉพาะอังกฤษ ตัวเลข ขีดกลาง และ underscore').nullable().default(null),
)
const optionalGeneralText = (label: string, maxLength = 500) => z.preprocess(
  blankToNull,
  z.string().trim().max(maxLength, `${label}ยาวเกินไป`).regex(generalTextPattern, `${label}มีรูปแบบไม่ถูกต้อง`).nullable().default(null),
)
const positiveQty = (label = 'จำนวน') => z.coerce.number({ invalid_type_error: `${label}ต้องเป็นตัวเลข` }).finite(`${label}ต้องเป็นตัวเลข`).gt(0, `${label}ต้องมากกว่า 0`)
const nonNegativeQty = (label = 'จำนวน') => z.coerce.number({ invalid_type_error: `${label}ต้องเป็นตัวเลข` }).finite(`${label}ต้องเป็นตัวเลข`).min(0, `${label}ต้องไม่ติดลบ`)

export const stockStatusSchema = z.enum(['RM', 'WIP', 'FG'])

export const stockQuerySchema = z.object({
  asOf: z.preprocess(blankToNull, requiredDate.nullable().default(null)),
  branchId: z.preprocess(blankToNull, z.string().trim().nullable().default(null)),
  format: z.enum(['json', 'xlsx']).default('json'),
  lotNo: z.preprocess(blankToNull, z.string().trim().max(80).nullable().default(null)),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(10).max(500).default(50),
  productId: z.preprocess(blankToNull, z.string().trim().nullable().default(null)),
  q: z.preprocess(blankToNull, z.string().trim().max(120).nullable().default(null)),
  refType: z.preprocess(blankToNull, z.string().trim().max(20).nullable().default(null)),
  sort: z.string().trim().max(40).default('date'),
  status: z.preprocess(blankToNull, stockStatusSchema.nullable().default(null)),
  warehouseId: z.preprocess(blankToNull, z.string().trim().nullable().default(null)),
  from: z.preprocess(blankToNull, requiredDate.nullable().default(null)),
  to: z.preprocess(blankToNull, requiredDate.nullable().default(null)),
})

export const statusConvertFormSchema = z.object({
  branchId: z.string().trim().min(1, 'เลือกสาขา'),
  date: requiredDate,
  docNo: optionalDocNo,
  fromStatus: stockStatusSchema,
  lotNo: optionalGeneralText('Lot', 80),
  notes: optionalGeneralText('หมายเหตุ', 500),
  productId: z.string().trim().min(1, 'เลือกสินค้า'),
  qty: positiveQty('น้ำหนัก'),
  reason: optionalGeneralText('เหตุผล', 240),
  toStatus: stockStatusSchema,
  warehouseId: z.string().trim().min(1, 'เลือกคลัง'),
}).refine((value) => value.fromStatus !== value.toStatus, {
  message: 'สถานะต้นทางและปลายทางต้องไม่ซ้ำกัน',
  path: ['toStatus'],
})

export type StatusConvertFormValues = z.infer<typeof statusConvertFormSchema>

export const stockConvertFormSchema = z.object({
  branchId: z.string().trim().min(1, 'เลือกสาขา'),
  date: requiredDate,
  docNo: optionalDocNo,
  lotNo: optionalGeneralText('Lot', 80),
  notes: optionalGeneralText('หมายเหตุ', 500),
  reason: optionalGeneralText('เหตุผล', 240),
  sourceProductId: z.string().trim().min(1, 'เลือกสินค้าต้นทาง'),
  sourceQty: positiveQty('น้ำหนักต้นทาง'),
  targetLotNo: optionalGeneralText('Lot ปลายทาง', 80),
  targetProductId: z.string().trim().min(1, 'เลือกสินค้าปลายทาง'),
  targetQty: positiveQty('น้ำหนักปลายทาง'),
  warehouseId: z.string().trim().min(1, 'เลือกคลัง'),
}).refine((value) => value.sourceProductId !== value.targetProductId || value.lotNo !== value.targetLotNo, {
  message: 'สินค้าหรือ Lot ปลายทางต้องต่างจากต้นทาง',
  path: ['targetProductId'],
})

export type StockConvertFormValues = z.infer<typeof stockConvertFormSchema>

export const stockAdjustFormSchema = z.object({
  branchId: z.string().trim().min(1, 'เลือกสาขา'),
  countedQty: nonNegativeQty('นับจริง'),
  date: requiredDate,
  docNo: optionalDocNo,
  lotNo: optionalGeneralText('Lot', 80),
  productId: z.string().trim().min(1, 'เลือกสินค้า'),
  reason: z.string().trim().min(3, 'กรอกเหตุผลอย่างน้อย 3 ตัวอักษร').max(240, 'เหตุผลยาวเกินไป').regex(generalTextPattern, 'เหตุผลมีรูปแบบไม่ถูกต้อง'),
  remark: optionalGeneralText('หมายเหตุ', 500),
  systemQty: nonNegativeQty('ยอดในระบบ'),
  warehouseId: z.string().trim().min(1, 'เลือกคลัง'),
})

export type StockAdjustFormValues = z.infer<typeof stockAdjustFormSchema>

export type StockOption = {
  active: boolean | null
  branchId?: string | null
  code?: string | null
  id: string
  metalGroup?: string | null
  name: string
  status?: string | null
}
