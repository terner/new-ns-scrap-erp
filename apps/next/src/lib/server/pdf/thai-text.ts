/**
 * Normalization ข้อความไทยก่อนส่งเข้า <Text> ของ @react-pdf/renderer
 *
 * ทำไมต้องมี shim นี้:
 * react-pdf ใช้ PDFKit เป็น text engine ซึ่งไม่มี OpenType complex-text shaping
 * เต็มรูปแบบ (HarfBuzz) → ตัวอักษรบางตัว render ผิด/ถูกตัด
 *
 * ปัญหาที่แก้ใน shim นี้ (อ้างอิง GitHub react-pdf issues):
 *
 * 1. Sara Am (ำ, U+0E33) — Issue #3295 (CRITICAL)
 *    ำ (precomposed) ทำให้ข้อความถูกตัด/truncated ทั้ง run
 *    แก้: decompose เป็น ํ (Nikhahit, U+0E4D) + า (Sara Aa, U+0E32)
 *    ซึ่ง render ได้ถูกต้องใน PDFKit
 *
 * ปัญหาที่ยังเป็น known limitation (shim ช่วยไม่ได้, ต้อง QA):
 * - วรรณยุกต์ (่ ้ ๊ ๋) — ตำแหน่งอาจไม่ตรงเป๊ะเพราะ GPOS ถูก approximate
 * - สระซ้อน (เ_ีย, ัว, ือ) — มักอ่านได้แต่ไม่สวยเท่า browser
 * - ไม่มี inter-word space → react-pdf ตัดบรรทัดไม่ได้ (แก้ที่ layout, ไม่ใช่ที่นี่)
 */

// ำ (Sara Am, U+0E33) → ํ (Nikhahit, U+0E4D) + า (Sara Aa, U+0E32)
const SARA_AM = '\u0E33'
const NIKHAHIT = '\u0E4D'
const SARA_AA = '\u0E32'

/**
 * Normalize ข้อความไทยก่อนเข้า <Text> — ต้องเรียกทุก string ที่จะ render
 * ปลอดภัยกับ string ที่ไม่ใช่ภาษาไทย (no-op ถ้าไม่มี ำ)
 *
 * @example
 * normalizeThai('น้ำหนัก') === 'น้ําหนัก'  // decompose Sara Am
 * normalizeThai('น้ำหนักรวม') === 'น้ําหนักรวม'
 * normalizeThai('100.50 kg') === '100.50 kg'  // no-op
 */
export function normalizeThai(input: string | null | undefined): string {
  if (input == null) return ''
  const str = String(input)
  if (!str.includes(SARA_AM)) return str
  return str.split(SARA_AM).join(NIKHAHIT + SARA_AA)
}

/**
 * Normalize ทุก string ในอ็อบเจกต์/อาร์เรย์แบบ recursive
 * สำหรับ normalize ข้อมูลทั้ง WeightTicketRecord ก่อนเข้า template
 *
 * @example
 * const safe = normalizeThaiDeep(ticket)  // ทุก string field ถูก normalize
 */
export function normalizeThaiDeep<T>(value: T): T {
  if (typeof value === 'string') {
    return normalizeThai(value) as unknown as T
  }
  if (Array.isArray(value)) {
    return value.map(normalizeThaiDeep) as unknown as T
  }
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      result[key] = normalizeThaiDeep(val)
    }
    return result as unknown as T
  }
  return value
}
