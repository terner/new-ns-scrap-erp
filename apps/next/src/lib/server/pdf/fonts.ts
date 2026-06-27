import 'server-only'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { Font } from '@react-pdf/renderer'

/**
 * ลงทะเบียนฟอนต์ Noto Sans Thai (Regular + Bold) สำหรับ @react-pdf/renderer
 *
 * Font.register เป็น global singleton ของ module — ถ้าเรียกซ้ำในทุก request
 * จะ parse font binary ใหม่ทุกครั้งและเปลือง memory (issues #1130, #2848)
 * จึงใช้ flag `fontsRegistered` คุมให้ลงทะเบียนครั้งเดียวต่อ process เท่านั้น
 *
 * นอกจากนี้ปิด hyphenation ของ react-pdf เพราะตัดคำแบบ space ไม่ได้กับภาษาไทย
 * (Thai ไม่มี inter-word space → react-pdf จะตัดผิดทำให้ข้อความล้น)
 */
const FONT_FAMILY = 'NotoSansThai'

let fontsRegistered = false
let registrationPromise: Promise<void> | null = null

/**
 * resolve path ของไฟล์ฟอนต์ — ครอบคลุมทุก layout ที่เป็นไปได้ (เหมือน logic เดิมใน Playwright)
 * คืน path แรกที่หาเจอ หรือ throw ถ้าหาไม่เจอทั้งหมด
 */
async function resolveFontPath(fileName: string): Promise<string> {
  const candidates = [
    join(process.cwd(), 'public/fonts', fileName),
    join(process.cwd(), 'apps/next/public/fonts', fileName),
    join(process.cwd(), 'src/assets/fonts', fileName),
    join(process.cwd(), 'apps/next/src/assets/fonts', fileName),
  ]
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }
  throw new Error(
    `ไม่พบไฟล์ฟอนต์ภาษาไทย "${fileName}" สำหรับ react-pdf.\n` +
    `Paths ที่ลองค้นหา:\n${candidates.map((p) => `  • ${p}`).join('\n')}`
  )
}

/**
 * ลงทะเบียนฟอนต์ครั้งเดียว (idempotent) — ปลอดภัยเรียกกี่ครั้งก็ได้
 * คืน Promise เดียวกันถ้ามีการเรียกพร้อมกัน (dedup)
 */
export async function ensurePdfFontsRegistered(): Promise<void> {
  if (fontsRegistered) return
  if (registrationPromise) return registrationPromise

  registrationPromise = (async () => {
    const regularPath = await resolveFontPath('NotoSansThai-Regular.ttf')
    const boldPath = await resolveFontPath('NotoSansThai-Bold.ttf')

    const [regularBuffer, boldBuffer] = await Promise.all([
      readFile(regularPath),
      readFile(boldPath),
    ])

    // react-pdf 4.5.1 ไม่ยอมรับ Buffer ตรง ๆ — ใช้ data URL (base64) แทน
    // (เป็นรูปแบบที่รองรับกันทั่วไปที่สุดและไม่มี path resolution issue ใน Docker)
    const regularDataUrl = `data:font/ttf;charset=utf-8;base64,${regularBuffer.toString('base64')}`
    const boldDataUrl = `data:font/ttf;charset=utf-8;base64,${boldBuffer.toString('base64')}`

    Font.register({
      family: FONT_FAMILY,
      fonts: [
        { src: regularDataUrl, fontWeight: 400 },
        { src: boldDataUrl, fontWeight: 700 },
      ],
    })

    // ปิด hyphenation ของ react-pdf เพราะ Thai ไม่มี inter-word space
    // callback นี้จะทำให้ react-pdf ไม่ตัดคำด้วย dash (ถ้าต้องการตัดบรรทัด
    // ต้อง pre-break เองในข้อมูล หรือตั้งความกว้างคอลัมน์ให้พอ)
    Font.registerHyphenationCallback((word) => [word])

    fontsRegistered = true
  })()

  try {
    await registrationPromise
  } finally {
    // เก็บ promise ไว้ แต่ถ้าล้มให้ flag ยังเป็น false เพื่อให้ retry ได้ครั้งถัดไป
    registrationPromise = null
  }
}

/**
 * ชื่อ family ที่ใช้ใน StyleSheet — import ทุกที่ที่ต้องการอ้างถึงฟอนต์
 */
export const PDF_FONT_FAMILY = FONT_FAMILY
