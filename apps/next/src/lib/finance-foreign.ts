import { z } from 'zod'

const blankToNull = (value: unknown) => (typeof value === 'string' && value.trim() === '' ? null : value)
const currencyPattern = /^[A-Z0-9]{3,6}$/
const rateTypePattern = /^[\p{L}\p{M}\p{N}\s./_-]+$/u
const generalTextPattern = /^[^\u0000-\u001F\u007F]+$/u

const requiredCurrency = (label: string) => z.string()
  .trim()
  .min(1, `${label}จำเป็น`)
  .max(6, `${label}ยาวเกินไป`)
  .transform((value) => value.toUpperCase())
  .refine((value) => currencyPattern.test(value), `${label}ใช้ได้เฉพาะรหัสสกุลเงิน`)

const optionalText = (label: string, maxLength = 160) => z.preprocess(
  blankToNull,
  z.string()
    .trim()
    .max(maxLength, `${label}ยาวเกินไป`)
    .regex(generalTextPattern, `${label}มีรูปแบบไม่ถูกต้อง`)
    .nullable()
    .default(null),
)

export const fxRateFormSchema = z.object({
  active: z.boolean().default(true),
  fromCurrency: requiredCurrency('สกุลต้นทาง'),
  id: z.preprocess(blankToNull, z.string().trim().max(80, 'รหัสยาวเกินไป').nullable().default(null)),
  note: optionalText('หมายเหตุ', 500),
  rate: z.coerce.number({ invalid_type_error: 'Rate ต้องเป็นตัวเลข' }).finite('Rate ต้องเป็นตัวเลข').gt(0, 'Rate ต้องมากกว่า 0'),
  rateDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'วันที่ต้องเป็นรูปแบบ YYYY-MM-DD'),
  rateType: z.string().trim().min(1, 'ประเภท Rate จำเป็น').max(60, 'ประเภท Rate ยาวเกินไป').regex(rateTypePattern, 'ประเภท Rate มีรูปแบบไม่ถูกต้อง').default('BOT Rate'),
  source: optionalText('แหล่งที่มา', 120),
  toCurrency: requiredCurrency('สกุลปลายทาง').default('THB'),
}).refine((value) => value.fromCurrency !== value.toCurrency, {
  message: 'สกุลต้นทางและปลายทางต้องไม่ซ้ำกัน',
  path: ['toCurrency'],
})

export type FxRateFormValues = z.infer<typeof fxRateFormSchema>
