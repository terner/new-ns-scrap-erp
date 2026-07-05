# Task Checklist 2026-06-27 — Migrate Playwright → @react-pdf/renderer

## การตัดสินใจ (จากผู้ใช้)
- ✅ **ตัด Playwright ออกเลย** (ไม่เก็บ fallback)
- ✅ **สร้าง album ใหม่ด้วย @napi-rs/canvas** (รักษาหน้าตาเดิม)
- ✅ **ใช้ Noto Sans Thai เท่านั้น** (ห้ามเปลี่ยนเป็นฟอนต์อื่น)
- ✅ รับทราบความเสี่ยงฟอนต์ไทย (Sara Am shim + QA)

## แผนทั้งหมด (6 ไฟล์ใหม่ + ไฟล์แก้)

### ไฟล์ใหม่ที่จะสร้าง
```
apps/next/src/lib/server/pdf/
├── fonts.ts                    ✅ Batch 1 — Font.register Noto Sans Thai singleton
├── thai-text.ts                ✅ Batch 1 — Sara Am shim (ำ→ํ+า)
├── weight-ticket-document.tsx  ⬜ Batch 2 — <Document> react-pdf (sections A-I)
├── album-canvas.ts             ⬜ Batch 4 — renderAlbumImage() @napi-rs/canvas
└── weight-ticket-pdf.ts        ⬜ Batch 3 — generateWeightTicketPdf() renderToBuffer

apps/next/scripts/
└── qa-thai-font.tsx            ✅ Batch 1 — QA script ฟอนต์ไทย
```

### ไฟล์ที่จะแก้/ลบ
- `apps/next/next.config.mjs` — ✅ serverExternalPackages (Batch 1)
- `apps/next/package.json` — ✅ เพิ่ม react-pdf/canvas (Batch 1); ⬜ ลบ playwright/pdf-lib/fontkit (Batch 5)
- `weight-ticket-line-notification.ts` — ⬜ Batch 3 เปลี่ยน import; ⬜ Batch 5 ลบ Playwright code
- `apps/next/src/app/api/health/route.ts` — ⬜ Batch 5 ลบ Playwright inspect
- `scripts/install-playwright.js` — ⬜ Batch 5 ลบทิ้ง
- build script — ⬜ Batch 5 ลบ playwright prefix

## Batch Progress

### ✅ Batch 1 — Foundation (fonts + shim + QA script)
- [x] install @react-pdf/renderer@4.5.1 + @napi-rs/canvas + server-only
- [x] next.config.mjs serverExternalPackages
- [x] pdf/fonts.ts (Font.register singleton, data URL, Noto Sans Thai เท่านั้น)
- [x] pdf/thai-text.ts (Sara Am shim)
- [x] scripts/qa-thai-font.tsx (QA script)
- [x] type-check + lint + build ผ่าน

### ⬜ Batch 2 — react-pdf template (เขียนใบเสร็จใหม่)
- [ ] pdf/weight-ticket-document.tsx — reimplement sections A-I:
  - .page → <Page size="A4">
  - header → flex row (logo + company info + doc title)
  - section-grid → flex row 2 panels (party info + doc info)
  - table → fixed-width flex rows (7mm/62mm/21mm/21mm/32mm/26mm/21mm)
  - signatures → flex row 4 columns
  - footer → flex row space-between
- [ ] reuse buildPrintWeightRows + pagination จาก weight-ticket-print.ts
- [ ] ทุก string ผ่าน normalizeThai ก่อนเข้า <Text>
- [ ] Gate: type-check + lint + build

### ⬜ Batch 3 — render pipeline (แทนที่ Playwright)
- [ ] pdf/weight-ticket-pdf.ts — generateWeightTicketPdf() ใหม่:
  - renderToBuffer(<WeightTicketDocument .../>) แทน chromium.launch() + page.pdf()
  - return { pdfBuffer, albumImages } รูปร่างเดิม
- [ ] แก้ weight-ticket-line-notification.ts import จาก module ใหม่
- [ ] Gate: ทดสอบสร้าง PDF จริง

### ⬜ Batch 4 — album canvas (แทนที่ screenshot)
- [ ] pdf/album-canvas.ts — renderAlbumImage() ด้วย @napi-rs/canvas:
  - createCanvas(600, H), fill #0f172a
  - draw header rect สี + fillText Thai header
  - drawImage แต่ละรูป resize 4:3, 2 คอลัมน์
  - draw badge rect สี + fillText
  - draw footer overlay + fillText timestamp/index
  - GlobalFonts.registerFromPath(NotoSansThai) เท่านั้น
- [ ] เชื่อมเข้า weight-ticket-pdf.ts แทน section screenshot

### ⬜ Batch 5 — ลบ Playwright ออกจากระบบ
- [ ] ลบ launchManagedChromium, resolvePlaywrightBrowsersPath จาก notification file
- [ ] ลบ Playwright check จาก /api/health
- [ ] ลบ scripts/install-playwright.js
- [ ] แก้ build script ลบ "node ../../scripts/install-playwright.js &&"
- [ ] ลบ deps playwright, pdf-lib, @pdf-lib/fontkit
- [ ] Gate: grep ไม่เจอ "playwright" ใน src

### ⬜ Batch 6 — Flow summary + cleanup
- [ ] อัปเดต docs/notes/ flow summary
- [ ] เตรียมข้อความ DevOps: ลบ PLAYWRIGHT_BROWSERS_PATH env

## Validation ระหว่างทำ
- แต่ละไฟล์แก้เสร็จ → type-check + lint ทันที
- ครบทุก batch → build เต็ม
- Batch 3 → สร้าง PDF เทียบของเดิม
- Batch 5 → grep ยืนยันไม่เหลือ Playwright

## ขอบเขต
- แก้เฉพาะ flow ส่ง LINE (server PDF)
- ไม่แตะ client print button (ยังใช้ HTML + browser print)
- ไม่แตะ module อื่น
- ใช้ Noto Sans Thai เท่านั้น
