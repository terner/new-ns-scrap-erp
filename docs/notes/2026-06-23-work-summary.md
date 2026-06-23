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

---

## ผลการตรวจสอบคุณภาพ (Verification Results)
* **TypeScript type-check**: `tsc --noEmit` ผ่านการคอมไพล์สำเร็จเรียบร้อย
* **ESLint check**: ผ่านการรัน `npm run lint` แบบไร้ Error สะสม (มีเพียง warning ของ third-party ทั่วไป)
* **Next.js Production Build**: รันคำสั่ง `npm run build` สำเร็จลุล่วงและสร้างหน้าเว็บแบบ static/dynamic สำเร็จครบถ้วน

---

## สรุปข้อมูลการทำ Git Branch และ Commit
* รันการตรวจสอบ Workspace และเตรียมความพร้อมในการ Push ไปยังสาขา `dev` และ `peach` ของ `new-origin`
