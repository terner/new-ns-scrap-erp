import { z } from 'zod'

const blankToNull = (value: unknown) => (typeof value === 'string' && value.trim() === '' ? null : value)
const docNoPattern = /^[A-Za-z0-9_-]+$/
const generalTextPattern = /^[^\u0000-\u001F\u007F]+$/u

const optionalDocNo = (label: string) => z.preprocess(
  blankToNull,
  z.string().trim().max(50, `${label}ยาวเกินไป`).regex(docNoPattern, `${label}ใช้ได้เฉพาะอังกฤษ ตัวเลข ขีดกลาง และ underscore`).nullable().default(null),
)

const optionalSafeId = (label: string) => z.preprocess(
  blankToNull,
  z.string().trim().max(80, `${label}ยาวเกินไป`).regex(/^[A-Za-z0-9_.:-]+$/, `${label}มีรูปแบบไม่ถูกต้อง`).nullable().default(null),
)

const optionalGeneralText = (label: string, maxLength = 500) => z.preprocess(
  blankToNull,
  z.string().trim().max(maxLength, `${label}ยาวเกินไป`).regex(generalTextPattern, `${label}มีรูปแบบไม่ถูกต้อง`).nullable().default(null),
)

const money = (label: string) => z.coerce.number({ invalid_type_error: `${label}ต้องเป็นตัวเลข` }).finite(`${label}ต้องเป็นตัวเลข`).min(0, `${label}ต้องไม่ติดลบ`)
const positiveMoney = (label: string) => money(label).gt(0, `${label}ต้องมากกว่า 0`)

export const purchaseBillItemSchema = z.object({
  discount: money('ส่วนลด').default(0),
  lotNo: optionalGeneralText('Lot', 80),
  note: optionalGeneralText('หมายเหตุรายการ', 200),
  price: money('ราคา').default(0),
  productId: z.string().trim().min(1, 'เลือกสินค้า'),
  qty: positiveMoney('จำนวน/น้ำหนัก'),
})

export const purchaseBillFormSchema = z.object({
  branchId: optionalSafeId('สาขา'),
  channelId: optionalSafeId('ช่องทาง'),
  date: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'วันที่ต้องเป็นรูปแบบ YYYY-MM-DD'),
  docNo: optionalDocNo('เลขที่บิล'),
  hasVat: z.boolean().default(false),
  items: z.array(purchaseBillItemSchema).min(1, 'เพิ่มรายการสินค้าอย่างน้อย 1 รายการ'),
  notes: optionalGeneralText('หมายเหตุ', 500),
  purchaseSource: z.enum(['SPOT_BUY', 'PO_RECEIPT', 'MIXED']).default('SPOT_BUY'),
  refNo: optionalDocNo('เลขที่อ้างอิง'),
  supplierId: z.string().trim().min(1, 'เลือกผู้ขาย'),
  transactionMode: z.enum(['STOCK', 'TRADING']).default('STOCK'),
  vatType: z.enum(['NONE', 'EXCLUDE', 'INCLUDE']).default('NONE'),
  warehouseId: optionalSafeId('คลัง'),
}).refine((value) => value.transactionMode !== 'STOCK' || Boolean(value.warehouseId), {
  message: 'เลือกคลังเมื่อเป็นบิล STOCK',
  path: ['warehouseId'],
})

export type PurchaseBillFormValues = z.infer<typeof purchaseBillFormSchema>
