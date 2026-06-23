# บันทึกความคืบหน้าการทำงาน (23 มิถุนายน 2026)

การทำงานในรอบนี้มุ่งเน้นการปรับปรุงโครงสร้างตารางแสดงข้อมูลคงเหลือสินค้า (Stock Balance) ในโหมด Matrix, การแก้ไขสไตล์หน้าจอในโหมดอุปกรณ์พกพาของระบบชั่งน้ำหนัก (Weight Tickets Mobile View), และการแก้ไขข้อผิดพลาดในการดึงข้อมูลแบบฟอร์มการจัดจัดสรรต้นทุน (Cost Allocator) ผ่าน URL parameters

---

## งานที่ดำเนินการสำเร็จแล้ว

### 1. ระบบชั่งน้ำหนักสินค้าบนมือถือ (NSERP-52 Weight Tickets Mobile View)
* **การปรับปรุงสไตล์และโครงสร้าง (Mobile Responsive)**:
  - ปรับขนาดตัวอักษรของใบชั่งในโหมด Mobile Card List จากเดิมที่ขนาดค่อนข้างเล็ก ให้สอดคล้องตามมาตรฐาน Peach UI ด้วย `text-sm` และ `text-base` เพื่อความคมชัดในการอ่าน
  - เปลี่ยนปุ่มสปริงดำเนินการ `+ เพิ่มล็อต` และ `+ เพิ่มรายการหักสิ่งเจือปน` ให้เป็นปุ่มสีแดงเด่นชัดตัดขอบตามคำสั่งผู้ใช้ โดยใช้ดีไซน์เป็นปุ่มพื้นหลังสีแดง ตัวหนังสือสีขาวเต็มสไตล์ (`bg-red-600 hover:bg-red-700 text-white font-medium text-sm px-4 py-2 rounded-md transition-colors w-full sm:w-auto text-center`)
  - จัดการแสดงผลช่องรับน้ำหนัก (`น้ำหนักรวม` และ `หักภาชนะ`) ให้แสดงผลเคียงข้างกันแบบ 2 คอลัมน์บนหน้าจอมือถือ (`grid grid-cols-2 gap-3 md:flex md:flex-row`) ช่วยให้ประหยัดพื้นที่แนวตั้ง

### 2. ตารางสต๊อกคงเหลือแยกคอลัมน์เฉลี่ย (NSERP-47 Stock Balance Matrix Columns & Sorting)
* **การเพิ่มคอลัมน์และปรับสไตล์ Matrix**:
  - แยกคอลัมน์ของข้อมูลเฉลี่ยประเภทวัตถุดิบและสินค้า (RM เฉลี่ย, WIP เฉลี่ย, FG เฉลี่ย) และต้นทุนเฉลี่ยรวม ออกมาเป็นคอลัมน์เดี่ยวเฉพาะตัว แทนที่การเอาคำว่า "เฉลี่ย" ไปแสดงซ้อนเป็นอักษรขนาดเล็กใต้ช่องมูลค่าเงินเดิม ช่วยให้อ่านข้อมูลเปรียบเทียบได้ง่ายและเป็นระเบียบขึ้น
  - ตั้งชื่อหัวคอลัมน์ตรงตามเงื่อนไข: `ต้นทุน RM เฉลี่ย`, `ต้นทุน WIP เฉลี่ย`, `ต้นทุน FG เฉลี่ย` และ `ต้นทุนรวมเฉลี่ย`
  - ทำการอัปเกรดเวอร์ชัน LocalStorage คีย์สำหรับเก็บสเปกความกว้างของคอลัมน์ตาราง Matrix จากเดิม `stock.balance.matrix.v6` เป็น `stock.balance.matrix.v7` เพื่อเคลียร์แคชเบราว์เซอร์เก่าของผู้ใช้โดยอัตโนมัติ
* **การยืดหดคอลัมน์และจัดเรียงข้อมูล (Resizable & Sorting Columns)**:
  - เพิ่มฟังก์ชัน Resizable Columns ให้ตาราง Matrix และ Detail ในหน้าเดสก์ท็อป โดยใช้ Component `<ResizableTableHead>` และ API ของ `useResizableColumns`
  - รองรับการจัดเรียงคอลัมน์ (Sorting) แบบ interactive โดยผู้ใช้สามารถคลิกหัวตารางเพื่อเรียงข้อมูลจากน้อยไปมาก หรือมากไปน้อยได้ พร้อมแสดงไอคอนทิศทางการจัดเรียงที่หัวคอลัมน์

### 3. ระบบจัดสรรต้นทุนและแก้ไข SSR Hydration Mismatch (NSERP-31 Cost Allocator Redirect & Pre-fill)
* **การแก้ไขปัญหา SSR Hydration Mismatch**:
  - ในอดีต หน้าฟอร์ม `/dual-costing/cost-allocator` มีปัญหา Error ในคอนโซลเรื่องการไม่ตรงกันของ HTML ในฝั่ง Server และ Client (Hydration Mismatch) เนื่องจากตัว Component พยายามอ่านค่า `window.location.search` เพื่อดึง Query params ทันทีในขั้นตอนการเรนเดอร์แรก
  - ทำการปรับปรุงโดยใช้ `useSearchParams()` ของ Next.js ในการดึงค่าแทน พร้อมจัดกลุ่ม component client-side ไว้ภายใต้ `<Suspense>` boundary ในไฟล์ `apps/next/src/app/dual-costing/cost-allocator/page.tsx`
  - ใส่ `useEffect` สำหรับดึงและเฝ้าติดตาม Query Parameters จาก Search Params เพื่อให้ฟอร์มดึงข้อมูลประเภทต้นทุน (Source Type) สินค้า (Product) และเลขบิลไปจัดสรรมาแสดงผลอัตโนมัติอย่างถูกต้องเมื่อคลิกปุ่ม "จัดสรร" มาจากหน้า Waiting Allocations

### 4. แก้ไขปัญหาโหลด Cost Allocator ล้มเหลวบนเซิร์ฟเวอร์จริง (HTTP Loopback Fetch Fix)
* **การเปลี่ยนระบบดึงข้อมูล Cost Pool**:
  - เปลี่ยนจากการยิงคำขอ HTTP `fetch` ย้อนกลับไปเรียก API `/api/dual-costing/cost-pool` ของตนเองผ่าน Domain Name (`ns-dev.devkub.com`) ซึ่งมักล้มเหลวในสภาพแวดล้อมจริงเนื่องจาก Loopback restrictions, Cloudflare/Firewall blocks หรือ Cookie forwarding issues
  - ทำการแยกตรรกะการเรียกฐานข้อมูลออกมาเป็นฟังก์ชันตรง `getCostPoolRowsData` ใน `cost-pool/route.ts` และให้ `cost-allocator/route.ts` นำเข้ามาคิวรี่ข้อมูลโดยตรงแบบฝั่งเซิร์ฟเวอร์ (Server-Side Direct Invocation) แทน ทำให้ระบบทำงานได้รวดเร็วขึ้นและปราศจากปัญหาการล้มเหลวของเครือข่าย

### 5. แก้ไขบั๊กคำนวณน้ำหนักจัดสรรของ PO ขาย (Deduct / Update Quantity on Waiting Allocations)
* **สาเหตุของปัญหา**:
  - เมื่อทำการจัดสรรต้นทุนให้กับ PO ขาย (PO Sell) ในหน้า Cost Allocator และบันทึกการจับคู่ (Match) ระบบจะทำการบันทึกข้อมูลธุรกรรมลงในตาราง `trading_deals` และ `trading_allocation_facts` โดยระบุ `sales_bill_id = null` และใช้เลขเอกสาร PO ขายในช่อง `sales_doc_no` (เนื่องจากยังไม่มีการออกบิลขายจริงในขั้นตอนนั้น)
  - ตรรกะเดิมในการคำนวณน้ำหนักที่จัดสรรไปแล้ว (`allocatedQty`) ในตัวประมวลผล Waiting Allocations (`dual-costing-management.ts`) และตัวพรีวิวจัดสรร (`cost-allocator/route.ts`) จะยอมรับและรวมยอดน้ำหนักที่จัดสรรก็ต่อเมื่อ `sales_bill_id` ไม่เป็น `null` เท่านั้น ทำให้ข้อมูลการจัดสรรดีลที่เกิดโดยตรงกับ PO ขายถูกข้ามไป ส่งผลให้น้ำหนักรอจัดสรรของคิวไม่ลดลง และรายการยังคงค้างอยู่ในระบบ
* **แนวทางการแก้ไข**:
  - ปรับปรุงตัวประมวลผลข้อมูลใน `apps/next/src/lib/server/dual-costing-management.ts` และ `apps/next/src/app/api/dual-costing/cost-allocator/route.ts` ให้รองรับระบบเชื่อมโยงด้วยเลขที่เอกสารอ้างอิงเป็นทางเลือกสำรอง (Fallback Document-Number-Based Resolution)
  - หาก `sales_bill_id` เป็น `null` ระบบจะจับคู่ยอดปริมาณการ match จากตารางธุรกรรมโดยอ้างอิงฟิลด์เลขที่เอกสาร (`sales_doc_no` หรือ `sales_bill_no`) กับเลขใบจองขาย (`po_sells.doc_no`) แทน ทำให้ค่า `allocatedQty` อัปเดตได้อย่างเที่ยงตรง และหักลบออกจากยอดคงเหลือ `remainingQty = qty - allocatedQty` ส่งผลให้รายการจองขายที่จัดสรรเสร็จสมบูรณ์แล้วหายไปจากหน้า Waiting Queue หรือแสดงยอดคงเหลือที่ถูกต้องโดยอัตโนมัติ


---

## ผลการตรวจสอบคุณภาพ (Verification Results)
* **TypeScript type-check**: `tsc --noEmit` ผ่านการคอมไพล์สำเร็จเรียบร้อย
* **ESLint check**: ผ่านการรัน `npm run lint` แบบไร้ Error สะสม (มีเพียง warning ของ third-party ทั่วไป)
* **Next.js Production Build**: รันคำสั่ง `npm run build` สำเร็จลุล่วงและสร้างหน้าเว็บแบบ static/dynamic สำเร็จครบถ้วน

---

## สรุปข้อมูลการทำ Git Branch และ Commit
* **Commit Hash ล่าสุด (งานแรก):** `ed173657` (Merged into dev at `2b0de012`)
* **Commit Hash สำหรับแก้ไข Loopback Fetch:** `c4d979a8`
* **สาขาที่ทำการ Push สำเร็จ:** `dev` และ `peach` ของ `new-origin`

