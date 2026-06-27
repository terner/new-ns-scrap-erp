# 2026-06-27 — Playwright Runtime Path Fix (LINE Notification)

## บริบท / What is what

ระบบ LINE Notification ของใบรับ-ส่งของ (Weight Ticket) ใช้ **Playwright Chromium** เพื่อเรนเดอร์
HTML → PDF และ screenshot อัลบั้มรูปภาพ ก่อนส่งเข้า LINE OA.

Flow การทำงาน (high-level):
1. ผู้ใช้กด "ส่ง LINE" ที่หน้าใบรับ-ส่งของ → `POST /api/daily/weight-tickets/[id]/notify-line`
2. API นี้ enqueue job ลง `line_notification_jobs` table แล้ว execute ทันที
3. `notifyWeightTicketLine()` → `generateWeightTicketPdf()` เรียก **Playwright** `chromium.launch()`
4. ใช้ Chromium เรนเดอร์ HTML (ใบรับ-ส่งของ + อัลบั้มรูป) → สร้าง PDF + album screenshots
5. อัปโหลดขึ้น Supabase Storage → สร้าง LINE Flex Message → ส่งผ่าน LINE Push API

**จุดพัง (เดิม):** Playwright ต้องการ Chromium binary ที่ติดตั้งไว้ แต่
`scripts/install-playwright.js` ติดตั้งตอน `npm run build` เท่านั้น ส่วน runtime path logic
(commit `70270279`, `b98a6c44`) เป็นแค่ best-effort guess — เจอก็ใช้ ไม่เจอก็ปล่อยให้
Playwright fallback ไป default path `/root/.cache/ms-playwright/` ที่ว่างเปล่าใน container
แล้วพังเงียบ ๆ ด้วย error:

```
browserType.launch: Executable doesn't exist at
/root/.cache/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-linux64/chrome-headless-shell
```

ทำให้ `/api/daily/weight-tickets/[id]/notify-line` คืน **502** บน `ns-dev.devkub.com`
(แต่ localhost ใช้ได้เพราะ `.playwright-browsers/` ถูกสร้างไว้ในเครื่องจาก build ครั้งล่าสุด).

---

## สิ่งที่แก้ไข / What changed (Flow batch 2026-06-27)

### 1. `apps/next/src/lib/server/weight-ticket-line-notification.ts`
- **เพิ่ม** `resolvePlaywrightBrowsersPath()` (exported) — resolve path แบบมีลำดับชัดเจน:
  1. env var `PLAYWRIGHT_BROWSERS_PATH` (ทางที่ถูกที่สุด — DevOps ตั้งทีเดียวจบ)
  2. candidate paths ครอบคลุมทุก layout ที่เป็นไปได้
  3. **throw error พร้อมคำแนะนำ** ถ้าหาไม่เจอ (แทนที่จะปล่อยให้ Playwright พังเงียบ)
- เปลี่ยน block เดิม (L435-453) ใน `generateWeightTicketPdf()` ให้เรียก helper นี้

### 2. `scripts/install-playwright.js`
- **เพิ่ม marker file** `.playwright-browsers/.installed` หลังติดตั้งสำเร็จ
  บันทึก `{ path, installedAt, nodeVersion, platform }` — runtime path resolver
  และ health endpoint ใช้ตรวจสอบได้
- **ข้ามการติดตั้งซ้ำ** ถ้ามี marker อยู่แล้ว → ลดเวลา build ใน CI/Docker ที่รันหลายครั้ง

### 3. `apps/next/src/app/api/health/route.ts`
- **ขยาย** endpoint เดิม (เดิมคืนแค่ `{ ok, timestamp }`) ให้มีฟิลด์ `playwright`:
  - `resolvedPath` — path ที่ runtime จะใช้จริง
  - `detectedPath` — path แรกที่หาเจอใน candidate list
  - `envVar` — ค่า env var ถ้ามี
  - `marker` — ข้อมูลจาก marker file (path/installedAt/platform)
  - `ready` — boolean ว่าพร้อม launch ไหม
  - `error` — error message ถ้า resolve ไม่สำเร็จ

---

## Why it has to be like this / รายละเอียดเชิงออกแบบ

- **ทำไมต้อง throw แทนการ fallback เงียบ ๆ:** error ที่ชัดเจนช่วยให้ debug ได้ทันทีจาก log,
  แทนที่จะเห็นแค่ "Executable doesn't exist" ที่ไม่บอกว่าลอง path ไหนบ้าง
- **ทำไมต้องมี health endpoint:** ในอนาคตถ้าปัญหานี้เกิดอีก ทีมสามารถเปิด
  `/api/health` แล้วเห็นสถานะ Chromium ทันที โดยไม่ต้องเข้า container
- **ทำไม marker file:** ตัดเวลา build ซ้ำ (Playwright install ใช้เวลา 30-60 วินาที)
  และเป็นหลักฐานว่า binary ถูกติดตั้งใน image นี้จริง
- **ทำไมต้อง env var เป็น priority แรก:** ถ้า Docker multi-stage ไม่ copy `.playwright-browsers/`
  ทีม DevOps สามารถตั้ง env var ตัวเดียว `PLAYWRIGHT_BROWSERS_PATH=/some/path` ก็แก้ได้
  โดยไม่ต้องแก้โค้ดอีก

---

## ⚠️ ข้อจำกัด / ยังต้องทำต่อฝั่ง infra

การแก้ฝั่งโค้ดนี้ทำให้ **debug ง่ายขึ้น + resolve path แข็งแรงขึ้น** แต่ถ้า Docker image
จริง ๆ ไม่มี Chromium binary เลย มันก็ยังคง throw (แค่ตอนนี้ error message สื่อความหมายกว่าเดิม)

ทางแก้ฝั่ง infra (เลือกอย่างใดอย่างหนึ่ง — ประสานทีมดูแล `watchpc.devkub.com`):
1. ตั้ง env `PLAYWRIGHT_BROWSERS_PATH` ใน runtime container ให้ชี้ไปยังโฟลเดอร์ที่มี binary
2. `COPY --from=builder /app/.playwright-browsers ./playwright-browsers` ใน final Docker stage
3. รัน `npx playwright install --with-deps chromium` ใน runner stage ตอน build image

**วิธีเช็คผลหลัง deploy:** เปิด `https://ns-dev.devkub.com/api/health` แล้วดูฟิลด์ `playwright.ready`
