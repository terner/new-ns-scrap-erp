import { z } from 'zod'

const blankToNull = (value: unknown) => (typeof value === 'string' && value.trim() === '' ? null : value)
const safeIdPattern = /^[A-Za-z0-9_.:-]+$/
const generalTextPattern = /^[^\u0000-\u001F\u007F]+$/u

const requiredDate = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'วันที่ต้องเป็นรูปแบบ YYYY-MM-DD')
const requiredDeliveryDate = z.preprocess(
  blankToNull,
  z.string({ invalid_type_error: 'กรอกวันส่งมอบ', required_error: 'กรอกวันส่งมอบ' }).trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'วันที่ต้องเป็นรูปแบบ YYYY-MM-DD'),
)
const optionalGeneralText = (label: string, maxLength = 500) => z.preprocess(
  blankToNull,
  z.string().trim().max(maxLength, `${label}ยาวเกินไป`).regex(generalTextPattern, `${label}มีรูปแบบไม่ถูกต้อง`).nullable().default(null),
)
const positiveNumber = (label: string) => z.coerce.number({ invalid_type_error: `${label}ต้องเป็นตัวเลข` }).finite(`${label}ต้องเป็นตัวเลข`).gt(0, `${label}ต้องมากกว่า 0`)

export const poBuyItemSchema = z.object({
  productId: z.string().trim().min(1, 'เลือกสินค้า').max(80, 'รหัสสินค้ายาวเกินไป').regex(safeIdPattern, 'รหัสสินค้ามีรูปแบบไม่ถูกต้อง'),
  qty: positiveNumber('จำนวน'),
  unitPrice: positiveNumber('ราคา/หน่วย'),
})

export const poBuyFormSchema = z.object({
  branchId: z.string().trim().min(1, 'เลือกสาขา').max(80, 'รหัสสาขายาวเกินไป').regex(safeIdPattern, 'รหัสสาขามีรูปแบบไม่ถูกต้อง'),
  expectedDelivery: requiredDeliveryDate,
  items: z.array(poBuyItemSchema).min(1, 'เพิ่มรายการสินค้าอย่างน้อย 1 รายการ').max(50, 'รายการสินค้ามากเกินไป'),
  notes: optionalGeneralText('หมายเหตุ', 500),
  supplierId: z.string().trim().min(1, 'เลือกผู้ขาย').max(80, 'รหัสผู้ขายยาวเกินไป').regex(safeIdPattern, 'รหัสผู้ขายมีรูปแบบไม่ถูกต้อง'),
})

export const poBuyUpdateSchema = poBuyFormSchema.extend({
  id: z.string().trim().min(1, 'ระบุ PO Buy ที่ต้องการแก้ไข').max(80, 'รหัส PO Buy ยาวเกินไป').regex(safeIdPattern, 'รหัส PO Buy มีรูปแบบไม่ถูกต้อง'),
})

export const poBuyCancelSchema = z.object({
  id: z.string().trim().min(1, 'ระบุ PO Buy ที่ต้องการยกเลิก').max(80, 'รหัส PO Buy ยาวเกินไป').regex(safeIdPattern, 'รหัส PO Buy มีรูปแบบไม่ถูกต้อง'),
  note: z.string().trim().min(1, 'กรอกหมายเหตุการยกเลิก').max(500, 'หมายเหตุยาวเกินไป').regex(generalTextPattern, 'หมายเหตุมีรูปแบบไม่ถูกต้อง'),
})

export const poBuyShortCloseSchema = z.object({
  id: z.string().trim().min(1, 'ระบุ PO Buy ที่ต้องการปิดรับไม่ครบ').max(80, 'รหัส PO Buy ยาวเกินไป').regex(safeIdPattern, 'รหัส PO Buy มีรูปแบบไม่ถูกต้อง'),
  note: z.string().trim().min(1, 'กรอกเหตุผลการปิดรับไม่ครบ').max(500, 'เหตุผลยาวเกินไป').regex(generalTextPattern, 'เหตุผลมีรูปแบบไม่ถูกต้อง'),
})

export type PoBuyFormValues = z.infer<typeof poBuyFormSchema>
export type PoBuyCancelValues = z.infer<typeof poBuyCancelSchema>
export type PoBuyShortCloseValues = z.infer<typeof poBuyShortCloseSchema>
export type PoBuyUpdateValues = z.infer<typeof poBuyUpdateSchema>
