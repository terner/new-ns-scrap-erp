# Proposal: ขอบเขตหน้าระบบ NS Scrap ERP

วันที่จัดทำ: 20 พฤษภาคม 2026

## 1. ภาพรวม

เอกสารนี้สรุปขอบเขตหน้าจอของระบบ NS Scrap ERP จากระบบต้นแบบเดิม เพื่อใช้เป็นเอกสารตั้งต้นสำหรับคุย scope งานกับลูกค้า ก่อนเข้าสู่ขั้นตอนประเมินรายละเอียดเชิงเทคนิค การออกแบบฐานข้อมูล และแผนพัฒนาเป็นลำดับถัดไป

ระบบเดิมมีหน้าจอในเมนูทั้งหมด 110 รายการ โดยมีหน้าที่ซ้ำกัน 1 รายการ จึงนับเป็นหน้าจอไม่ซ้ำ 109 หน้า แบ่งเป็น 14 หมวดงานหลัก ครอบคลุมงานซื้อขายเศษโลหะ งานคลังสินค้า งานผลิต งานการเงิน บัญชี รายงาน ผู้ใช้งาน และข้อมูลหลักของระบบ

## 2. สรุปจำนวนหน้าตามหมวด

| หมวดงาน | จำนวนหน้า |
|---|---:|
| หน้าหลัก / Dashboard / Monitoring | 11 |
| Tracking 360° | 3 |
| รายการประจำวัน | 13 |
| การผลิต | 7 |
| Dual Costing / จองดีล | 10 |
| การเงินและหนี้ | 6 |
| การเงินต่างประเทศ | 6 |
| สินค้าและคลัง | 6 |
| Trading / ซื้อมาขายไป | 2 |
| PO Reports | 1 |
| รายงานรวม | 1 |
| Finance / Accounting | 20 |
| ข้อมูลหลัก | 17 |
| ระบบ / ผู้ใช้ / Audit | 7 |
| **รวมรายการเมนู** | **110** |

หมายเหตุ: `Owner Daily Control` ปรากฏในเมนู 2 หมวด จึงมีรายการเมนู 110 รายการ แต่เป็นหน้าจอไม่ซ้ำ 109 หน้า

## 3. ขอบเขตระบบที่เสนอ

### 3.1 หน้าหลัก / Dashboard / Monitoring

หมวดนี้เป็นศูนย์กลางสำหรับผู้บริหารและทีมปฏิบัติการ ใช้ติดตามภาพรวมรายวัน ความผิดปกติ กำไร ต้นทุน กระแสเงินสด และงานที่ต้องติดตาม

รายการหน้า:

| ลำดับ | หน้า |
|---:|---|
| 1 | Owner Daily Control (เปิดทุกเช้า) |
| 2 | ตรวจจับความผิดปกติ |
| 3 | Daily Report / รายงานประจำวัน |
| 4 | Dashboard |
| 5 | Profit & Cost Analysis |
| 6 | รายการรอขาย |
| 7 | วางแผนการขาย (LME) |
| 8 | Sales Tracking Dashboard |
| 9 | Cash Flow Calendar |
| 10 | Business Calendar |
| 11 | Cash & Others Summary |

### 3.2 Tracking 360°

หมวดนี้ใช้ติดตามข้อมูลเชิงลึกของลูกค้า ผู้ขาย และสินค้า เพื่อดูประวัติ รายการเคลื่อนไหว และข้อมูลประกอบการตัดสินใจ

รายการหน้า:

| ลำดับ | หน้า |
|---:|---|
| 12 | Customer Tracking |
| 13 | Supplier Tracking |
| 14 | Product Tracking |

### 3.3 รายการประจำวัน

หมวดนี้เป็นงานปฏิบัติการหลักของระบบ ใช้บันทึกธุรกรรมซื้อ ขาย รับเงิน จ่ายเงิน โอนเงิน ค่าใช้จ่าย และรายการที่เกี่ยวข้องกับงานประจำวันของบริษัท

รายการหน้า:

| ลำดับ | หน้า |
|---:|---|
| 15 | บิลรับซื้อ |
| 16 | บิลขาย |
| 17 | เบิกออกรอบิล / Pending Sale |
| 18 | อนุมัติโอนเงิน / Payment Approval |
| 19 | จ่ายเงิน Supplier |
| 20 | ใบสำคัญรับเงิน / Receipt Voucher |
| 21 | รับเงิน Customer |
| 22 | โอนเงินระหว่างบัญชี |
| 23 | ค่าใช้จ่าย |
| 24 | เงินสำรองจ่าย / กู้กรรมการ |
| 25 | Dashboard ค่าใช้จ่าย |
| 26 | โอนสินค้าระหว่างสาขา |
| 27 | ประวัติเปลี่ยน Supplier ในบิล |

### 3.4 การผลิต

หมวดนี้รองรับงานผลิต การติดตาม WIP การวิเคราะห์ yield/loss ต้นทุนการผลิต และประสิทธิภาพเครื่องจักร

รายการหน้า:

| ลำดับ | หน้า |
|---:|---|
| 28 | ใบสั่งผลิต |
| 29 | Production Dashboard |
| 30 | WIP คงเหลือ |
| 31 | รายงานการผลิต / Yield |
| 32 | Production Cost Report |
| 33 | Yield/Loss + Abnormal |
| 34 | Machine Utilization |

### 3.5 Dual Costing / จองดีล

หมวดนี้รองรับงานจองซื้อ จองขาย และการติดตามต้นทุนสำหรับดีลเฉพาะ เพื่อใช้วิเคราะห์กำไรและต้นทุนเชิงบริหาร

รายการหน้า:

| ลำดับ | หน้า |
|---:|---|
| 35 | PO Buy / จองซื้อ |
| 36 | PO Sell / จองขาย |
| 37 | Cost Pool |
| 38 | Cost Allocator |
| 39 | Waiting Allocations |
| 40 | Allocation Ledger |
| 41 | Dual Costing Report |
| 42 | Match Log |
| 43 | Deal Margin Report |
| 44 | Compare Deal vs Stock |

### 3.6 การเงินและหนี้

หมวดนี้ใช้ติดตามลูกหนี้ เจ้าหนี้ เงินสด บัญชีธนาคาร และเงินรับ/จ่ายล่วงหน้า

รายการหน้า:

| ลำดับ | หน้า |
|---:|---|
| 45 | ลูกหนี้ / AR |
| 46 | เจ้าหนี้ / AP |
| 47 | Cash / Bank Statement |
| 48 | Cash Position |
| 49 | จ่ายล่วงหน้า Supplier |
| 50 | รับล่วงหน้าจาก Customer |

### 3.7 การเงินต่างประเทศ

หมวดนี้รองรับธุรกรรมต่างประเทศ เช่น โอนเงิน รับเงิน อัตราแลกเปลี่ยน บัญชี FCD และการกระทบยอดธนาคาร

รายการหน้า:

| ลำดับ | หน้า |
|---:|---|
| 51 | โอนเงินต่างประเทศ |
| 52 | รับเงินจากต่างประเทศ |
| 53 | FX Rate Management |
| 54 | FCD Ledger |
| 55 | FX Gain/Loss Report |
| 56 | Bank Reconciliation |

### 3.8 สินค้าและคลัง

หมวดนี้ใช้ดูยอดคงเหลือ การเคลื่อนไหวสินค้า การปรับสถานะ การปรับเกรด การตรวจนับ และการคืนสินค้า

รายการหน้า:

| ลำดับ | หน้า |
|---:|---|
| 57 | สต๊อกคงเหลือ |
| 58 | Stock Ledger |
| 59 | ปรับสถานะสินค้า RM -> FG |
| 60 | Grade Adjustment / ปรับเกรด |
| 61 | นับสต๊อก / Stock Count Adjust |
| 62 | Customer Return / ของคืน |

### 3.9 Trading / ซื้อมาขายไป

หมวดนี้ใช้ติดตามและจับคู่ดีลซื้อมาขายไป โดยแยกจาก flow สต๊อกปกติ

รายการหน้า:

| ลำดับ | หน้า |
|---:|---|
| 63 | Trading Dashboard |
| 64 | Trading Matching / จับคู่ดีล |

### 3.10 PO Reports

หมวดนี้ใช้ติดตามสถานะ PO ซื้อและ PO ขายที่ยังคงเหลือ

รายการหน้า:

| ลำดับ | หน้า |
|---:|---|
| 65 | PO ซื้อ/ขาย คงเหลือ |

### 3.11 รายงานรวม

หมวดนี้เป็นหน้ารวมรายการรายงานทั้งหมด เพื่อให้ผู้ใช้งานเข้าถึงรายงานสำคัญได้จากจุดเดียว

รายการหน้า:

| ลำดับ | หน้า |
|---:|---|
| 66 | รายงานทั้งหมด |

### 3.12 Finance / Accounting

หมวดนี้รองรับงานบัญชีและการเงินเชิงลึก เช่น งบการเงิน ภาษี สินทรัพย์ เงินกู้ ทุน ต้นยอด และข้อมูลย้อนหลัง

รายการหน้า:

| ลำดับ | หน้า |
|---:|---|
| 67 | Financial Dashboard |
| 68 | Owner Daily Control |
| 69 | Cash Flow Analysis |
| 70 | CF Forecast Calendar |
| 71 | Working Capital Analysis |
| 72 | Stock Finance Analysis |
| 73 | Profit Leak Dashboard |
| 74 | Tax / VAT / WHT |
| 75 | งบกำไรขาดทุน / P&L |
| 76 | งบดุล / Balance Sheet |
| 77 | งบกระแสเงินสด |
| 78 | Fixed Assets / ทรัพย์สิน |
| 79 | ค่าเสื่อมราคา |
| 80 | จำหน่ายทรัพย์สิน |
| 81 | Loan / Leasing / BSL |
| 82 | Loan Dashboard |
| 83 | Net Worth / Track Asset |
| 84 | Equity / ทุนจดทะเบียน |
| 85 | Opening Balance / ตั้งต้นยอด |
| 86 | ข้อมูลย้อนหลัง ม.ค.-เม.ย. 2026 ก่อน Go-Live |

### 3.13 ข้อมูลหลัก

หมวดนี้เป็นข้อมูลตั้งต้นของระบบ ใช้ร่วมกันทุก module เช่น ลูกค้า ผู้ขาย สินค้า สาขา บัญชีเงิน ช่องทางซื้อขาย และข้อมูล master อื่น ๆ

รายการหน้า:

| ลำดับ | หน้า |
|---:|---|
| 87 | ลูกค้า |
| 88 | พนักงานขาย / Sales |
| 89 | ผู้ขาย |
| 90 | สินค้า |
| 91 | สาขา / คลัง |
| 92 | บัญชีเงิน |
| 93 | ช่องทางซื้อ/ขาย |
| 94 | หมวดค่าใช้จ่าย |
| 95 | กรรมการ/พนักงาน |
| 96 | เครื่องจักร |
| 97 | Production Line |
| 98 | สกุลเงิน |
| 99 | ผู้รับเงินต่างประเทศ |
| 100 | วิธีจ่าย/รับเงิน |
| 101 | วัตถุประสงค์โอน |
| 102 | Import Master จาก Excel |
| 103 | Import บิลซื้อ/บิลขาย |

### 3.14 ระบบ / ผู้ใช้ / Audit

หมวดนี้เป็นส่วนจัดการระบบ เช่น ข้อมูลบริษัท รหัสผ่าน ผู้ใช้งาน สิทธิ์การใช้งาน Audit Log และ Backup/Restore

รายการหน้า:

| ลำดับ | หน้า |
|---:|---|
| 104 | ข้อมูลบริษัท สำหรับใบพิมพ์ |
| 105 | เปลี่ยน Password ของฉัน |
| 106 | Transaction Ledger / เช็คเงินเข้า-ออก |
| 107 | Backup / Restore |
| 108 | Audit Log |
| 109 | Users & Permissions |
| 110 | User Activity Log |

## 4. แนวทางการดำเนินงานที่เสนอ

เพื่อให้การพัฒนาควบคุมคุณภาพได้ ควรแบ่งงานเป็นชุดตาม module แทนการทำทุกหน้าพร้อมกัน โดยแนะนำลำดับดังนี้

1. ข้อมูลหลักและสิทธิ์ผู้ใช้งาน
2. รายการประจำวัน ซื้อ ขาย รับเงิน จ่ายเงิน และคลังสินค้า
3. รายงานและ Dashboard หลัก
4. การผลิตและสินค้า
5. การเงิน บัญชี ภาษี และงบการเงิน
6. Dual Costing, Trading และรายงานเชิงบริหาร
7. Audit, Backup, Activity Log และ hardening สำหรับใช้งานจริง

## 5. สิ่งที่ต้องยืนยันกับลูกค้า

## 5. Timeline ที่เสนอ: Go-Live 1 กรกฎาคม 2026

เป้าหมาย timeline นี้คือ Go-Live วันที่ 1 กรกฎาคม 2026 โดยเริ่มนับจากวันที่ 20 พฤษภาคม 2026 รวมเวลาประมาณ 6 สัปดาห์ หรือประมาณ 1.5 เดือน

สัปดาห์แรกใช้เป็นช่วง Get Requirements / Requirement Gathering เพื่อสรุป scope ที่จะเสนอให้ลูกค้า และส่งเอกสาร proposal/scope ชุดแรกในวันจันทร์ที่ 25 พฤษภาคม 2026

ด้วยระยะเวลานี้ ขอบเขตเป็นการส่งมอบแบบเต็มตาม scope ที่ตกลงร่วมกันใน proposal โดยอิงจากการ reuse pattern เดิมและ master data structure ที่ค่อนข้างนิ่งแล้ว หากมี requirement เพิ่มนอก scope หลังจาก freeze scope ให้แยกเป็น change request เพื่อไม่กระทบวัน Go-Live

### 5.1 Milestone Plan

| ช่วงเวลา | Milestone | เป้าหมายหลัก | Deliverable |
|---|---|---|---|
| 20-22 พ.ค. 2026 | Get Requirements | เก็บ requirement, ยืนยัน full scope, role, flow หลัก, master data, เอกสารพิมพ์ที่ต้องใช้วันแรก | requirement notes, page scope, gap list, data checklist |
| 25 พ.ค. 2026 | Submit Proposal / Scope | ส่ง proposal/scope ให้ลูกค้าตรวจและอนุมัติ | proposal version 1, full scope, timeline, assumptions |
| 25-29 พ.ค. 2026 | Scope Freeze + Foundation + Master Data | ปิด scope Go-Live, วาง auth/permission, layout, master data หลัก, import/export จำเป็น | scope sign-off, ผู้ใช้เข้าใช้งานได้, master data หลักพร้อมทดสอบ |
| 1-5 มิ.ย. 2026 | Purchase/Sales Core | PO Buy, PO Sell, บิลรับซื้อ, บิลขาย, basic validation, document numbering | flow ซื้อขายหลักเริ่ม UAT ได้ |
| 8-12 มิ.ย. 2026 | Payment + Stock Core | จ่ายเงิน, รับเงิน, โอนเงิน, stock balance, stock ledger, transfer/adjust สำคัญ | flow เงินและ stock เชื่อมกับซื้อขาย |
| 15-19 มิ.ย. 2026 | Daily Finance + Reports + SIT | ค่าใช้จ่าย, payment approval, receipt voucher, dashboard/report, System Integration Test | รายงาน daily, หน้าติดตามหลัก, SIT issue list ก่อนส่ง UAT |
| 22-26 มิ.ย. 2026 | Client UAT 1 Week + Customer Data Import + Security Test | UAT กับผู้ใช้จริง 1 สัปดาห์, นำเข้าข้อมูลลูกค้า, migration dry run, security test ตาม checklist ที่ตกลง, แก้ bug/blocker | UAT sign-off, import result, security result, go/no-go decision |
| 29-30 มิ.ย. 2026 | Cutover Prep | freeze ข้อมูล, backup, final migration, training, go-live checklist | production-ready checklist, rollback plan |
| 1 ก.ค. 2026 | Go-Live | เริ่มใช้งานระบบจริง | Production Go-Live |

### 5.1.1 Resource Plan: PM/BA 1 + Dev 3

แผนนี้อิงทีมหลัก 4 คน ได้แก่ PM/BA 1 คน และ Developer 3 คน โดยแบ่งงานตาม workstream เพื่อให้พัฒนาแบบขนานได้มากที่สุด และลดการชนกันของ module ระหว่างทีม

หมายเหตุ: Dev phase 25 working days เป็นระยะเวลาตาม calendar ของทีม โดยมี Dev 3 คนทำงานขนานกัน จึงเทียบเท่าประมาณ 75 dev-person-days ก่อนรวม PM/BA, UAT support, cutover support และ support หลัง Go-Live

| Role | เจ้าของงานหลัก | Module / Scope ที่รับผิดชอบ | หมวดหน้าที่ครอบคลุม |
|---|---|---|---|
| PM/BA 1 | Requirement, scope, acceptance, UAT, data mapping | เก็บ requirement, freeze scope, ทำ test scenario, ตรวจเอกสารพิมพ์, data mapping, UAT coordination, issue triage, sign-off checklist, go/no-go | ทุกหมวด 1-14 ในฐานะผู้ยืนยัน scope และ acceptance |
| Dev A | Foundation + Purchase + Payment + Dual Costing + Trading + System readiness | app shell, auth/permission, branch context, PO Buy, purchase bill, supplier payment, payment approval, transfer hook, cost pool, cost allocator, waiting allocations, allocation ledger, dual costing report, match log, deal margin, compare deal vs stock, trading matching, company profile, backup/export readiness | ระบบ / ผู้ใช้ / Audit, รายการประจำวันบางส่วน, Dual Costing / จองดีล, Trading / ซื้อมาขายไป |
| Dev B | Master Data + Stock + Production + AR/AP + Opening Balance + Cash/Bank | customer, supplier, product, branch/warehouse, account, payment method, import/export, stock balance, stock ledger, transfer/adjust/status convert/customer return, production order/input/output/report baseline, AR/AP baseline, opening balance, cash/bank baseline | ข้อมูลหลัก, สินค้าและคลัง, การผลิต, การเงินและหนี้บางส่วน, Finance / Accounting บางส่วน |
| Dev C | Sales + Dashboards + Tracking + Reports + Finance/Accounting + Assets + FX | PO Sell, sales bill, customer receipt, owner daily, daily report, dashboard, anomaly detector, tracking 360, reports index, PO outstanding report, tax/VAT/WHT, P&L, balance sheet, cash flow, working capital, stock finance, profit leak, fixed assets, depreciation, asset disposal, loan/leasing, equity, FX/FCD, bank reconciliation, audit/activity log smoke | หน้าหลัก / Dashboard / Monitoring, Tracking 360, รายงานรวม, PO Reports, การเงินต่างประเทศ, Finance / Accounting, รายการประจำวันบางส่วน |

### 5.1.2 Parallel Development Plan By Developer

ตารางนี้ใช้เป็นแผนทำงานระดับทีม เพื่อให้เห็นว่าแต่ละ developer ถือ module ไหน และ module ที่รอ foundation/master data ต้องเริ่มหลัง dependency พร้อม

| ช่วงงาน | วันที่ | Dev A | Dev B | Dev C |
|---|---|---|---|---|
| Sprint 0 | 20-25 พ.ค. 2026 | ประเมิน foundation, auth/permission, purchase/payment/dual costing risk | ประเมิน master data, stock, production, AR/AP, opening balance risk | ประเมิน sales, dashboard, tracking, report, accounting, FX, system risk |
| Sprint 1 | 25-29 พ.ค. 2026 | 1. Foundation / App Shell / Permission / Branch Context (3d) | 2. Master Data Stabilization + import/export template (4d) | เตรียม sales/report/finance acceptance, shared report contract, print/document samples |
| Sprint 2 | 1-5 มิ.ย. 2026 | 3. Purchase Core: PO Buy, purchase bill, supplier payment hooks (4d) | Master data regression, stock hook design, branch/account/payment method support | 4. Sales Core: PO Sell, sales bill, customer receipt hook (4d) |
| Sprint 3 | 8-12 มิ.ย. 2026 | 5. Payment / Receipt / Approval / Transfer core (3d) | 6. Stock Core + Inventory Ledger + stock transfer/adjust/status/customer return (3d) | 7. Dashboard / Daily Control / Tracking / PO Reports baseline (3d) |
| Sprint 4 | 15-19 มิ.ย. 2026 | 8. Dual Costing / Trading Core + system readiness regression (4d) | 9. Production + AR/AP + Opening Balance + Cash/Bank baseline (4d) | 10. Finance / Accounting / Asset / Loan / FX + reports/SIT support (4d) |
| Sprint 5 | 22-26 มิ.ย. 2026 | UAT support: purchase, payment, dual costing, trading, permission issues | UAT support: master data, stock, production, AR/AP, import/opening issues | UAT support: sales, dashboards, reports, finance/accounting, FX, security issues |
| Sprint 6 | 29 มิ.ย.-1 ก.ค. 2026 | Cutover support: production config, user/permission setup, backup/export | Cutover support: final data import, opening balance, stock opening, reconciliation | Cutover support: final reports, finance reconciliation, monitoring checklist |

Module ที่เพิ่มจาก core transaction และต้องไม่หลุด scope:

| Module กลุ่มเพิ่ม | Owner หลัก | Timeline | Scope ที่ต้องรวมใน proposal |
|---|---|---|---|
| หน้าหลัก / Dashboard / Monitoring | Dev C | 8-19 มิ.ย. 2026 | Owner Daily, Anomaly Detector, Daily Report, Dashboard, Profit & Cost Analysis, Pending Sales, Sales Plan, Sales Tracking, Cash Flow Calendar, Business Calendar, Cash & Others |
| Tracking 360 | Dev C | 8-12 มิ.ย. 2026 | Customer Tracking, Supplier Tracking, Product Tracking |
| การผลิต | Dev B | 15-19 มิ.ย. 2026 | Production Orders, Production Dashboard, WIP, Production Report/Yield, Production Cost Report, Yield/Loss, Machine Utilization |
| Dual Costing / จองดีล | Dev A | 15-19 มิ.ย. 2026 | PO Buy/PO Sell linkage, Cost Pool, Cost Allocator, Waiting Allocations, Allocation Ledger, Dual Costing Report, Match Log, Deal Margin Report, Compare Deal vs Stock |
| Trading | Dev A + Dev B | 15-19 มิ.ย. 2026 | Trading Dashboard, Trading Matching, stock/deal movement ที่เกี่ยวข้อง |
| การเงินและหนี้ | Dev B + Dev C | 8-19 มิ.ย. 2026 | AR, AP, Cash / Bank Statement, Cash Position, Supplier Advance, Customer Advance |
| PO Reports | Dev C | 8-12 มิ.ย. 2026 | PO ซื้อ/ขายคงเหลือ, received/sold/outstanding baseline, export |
| รายงานรวม | Dev C | 8-19 มิ.ย. 2026 | Reports index, purchase/sales/customer/supplier/product summaries, dashboard report links |
| Cash / Bank / Opening Balance | Dev B + Dev C | 15-19 มิ.ย. 2026 | cash/bank statement baseline, cash position, opening cash/bank, beginning stock, beginning AR/AP |
| Finance / Accounting | Dev C | 15-19 มิ.ย. 2026 | Tax/VAT/WHT, P&L, Balance Sheet, Cash Flow, Working Capital, Stock Finance Analysis, Profit Leak Dashboard |
| Fixed Assets / Loan / Equity | Dev C | 15-19 มิ.ย. 2026 | Fixed Assets, depreciation, asset disposal, loan/leasing/BSL, loan dashboard, net worth/track asset, equity |
| FX / FCD / Foreign Finance | Dev C | 15-19 มิ.ย. 2026 | FX rate, foreign remittance, foreign receipt, FCD ledger, FX gain/loss, bank reconciliation |

### 5.1.3 Milestone Ownership By Person

| Milestone | ช่วงเวลา | PM/BA 1 | Dev A | Dev B | Dev C |
|---|---|---|---|---|---|
| M0: Requirement + Proposal | 20-25 พ.ค. 2026 | เก็บ requirement, สรุป scope, page list, assumptions, acceptance เบื้องต้น | ประเมิน foundation/master data risk | ประเมิน transaction flow risk | ประเมิน finance/report/system risk |
| M1: Scope Freeze + Foundation | 25-29 พ.ค. 2026 | ปิด scope Go-Live, ทำ data checklist, ยืนยัน role/menu | app shell, auth, permission, branch context | master data shell, import/export template | finance/report/shared acceptance |
| M2: Master Data Ready | 25-29 พ.ค. 2026 | ยืนยัน field required, import template, cleansing rule | ใช้ master data กับ PO/payment form | customer, supplier, product, branch, account, payment method, import/export | ใช้ master data กับ sales/report/finance |
| M3: Purchase/Sales Core | 1-5 มิ.ย. 2026 | ตรวจ flow ซื้อขาย, document sample, validation rule | PO Buy, purchase bill, supplier search, document number | master data regression, stock hook design | PO Sell, sales bill, customer search, document number |
| M4: Payment + Stock Core | 8-12 มิ.ย. 2026 | ตรวจ scenario รับเงิน/จ่ายเงิน/stock movement | supplier payment, customer receipt hook, transfer, payment approval, receipt voucher hook | stock balance, stock ledger, transfer, adjust, status convert, customer return, opening stock design | dashboard/report baseline, tracking 360, PO outstanding, daily control read baseline |
| M5: Production + Dual Costing + Finance Baseline | 15-19 มิ.ย. 2026 | ยืนยันสูตร costing, production, AR/AP, accounting report acceptance | dual costing, allocation, match log, deal margin, trading matching | production baseline, AR/AP, opening balance, cash/bank baseline, reconciliation support | tax/VAT/WHT, P&L, balance sheet, cash flow, asset/loan/FX baseline |
| M6: Reports + Daily Control + SIT | 15-19 มิ.ย. 2026 | จัด SIT scenario, issue triage, readiness decision | purchase/payment/dual costing/trading regression | master data/stock/production/AR/AP regression | daily report, owner daily, tracking, reports, finance report, audit smoke |
| M7: Client UAT + Data Import + Security | 22-26 มิ.ย. 2026 | นำ UAT, import dry run, collect sign-off, go/no-go | support UAT purchase/payment/dual costing issues | support UAT master data/stock/AR/AP/import issues | support UAT sales/finance/report/security issues |
| M8: Cutover + Go-Live | 29 มิ.ย.-1 ก.ค. 2026 | final checklist, training, sign-off, cutover coordination | production config support, user/permission setup | final data import, opening balance, stock opening support | final reconciliation, backup/export, monitoring checklist |

### 5.2 Development Module Plan: 25 Working Days

Development phase ประเมิน 25 working days โดยอิงจากทีม PM/BA 1 คน + Dev 3 คน, การ reuse pattern เดิม และ master data structure ที่ค่อนข้างนิ่งแล้ว งานจะส่งเข้า SIT แบบ rolling delivery ตาม module ไม่รอให้ dev เสร็จทั้งระบบก่อนค่อยทดสอบ

| Module | Timeline | Scope หลัก | Owner หลัก | วันทำการ |
|---|---|---|---|---:|
| 1. Foundation / App Shell / Permission | 25-29 พ.ค. 2026 | layout, sidebar, auth, role/permission, branch context, common validation, API guard pattern | Dev A | 3 |
| 2. Master Data Stabilization | 25-29 พ.ค. 2026 | customer, supplier, product, branch/warehouse, account, payment method, import/export, required field rules | Dev B | 4 |
| 3. Purchase Core | 1-5 มิ.ย. 2026 | PO Buy, purchase bill, supplier search, line items, document number, VAT/WHT config hook, purchase export/print baseline | Dev A | 4 |
| 4. Sales Core | 1-5 มิ.ย. 2026 | PO Sell, sales bill, customer search, line items, document number, receipt hook, sales export/print baseline | Dev C | 4 |
| 5. Payment / Receipt / Approval / Transfer | 8-12 มิ.ย. 2026 | supplier payment, customer receipt, transfer, payment approval, receipt voucher, cash/bank update hooks | Dev A + Dev C | 3 |
| 6. Stock Core | 8-12 มิ.ย. 2026 | stock balance, stock ledger, stock transfer, stock adjust, status convert, customer return | Dev B | 3 |
| 7. Dashboard / Daily Control / Tracking / PO Reports | 8-12 มิ.ย. 2026 | owner daily, anomaly detector, daily report, dashboard, cash & others summary, tracking 360, PO outstanding, purchase/sales/stock summaries | Dev C | 3 |
| 8. Production Core + Reports | 15-19 มิ.ย. 2026 | production orders, production dashboard, WIP, production report/yield, production cost report, yield/loss, machine utilization | Dev B | 4 |
| 9. Dual Costing / Trading | 15-19 มิ.ย. 2026 | cost pool, cost allocator, waiting allocations, allocation ledger, dual costing report, match log, deal margin, compare deal vs stock, trading dashboard, trading matching | Dev A | 4 |
| 10. AR/AP + Opening Balance + Cash/Bank | 15-19 มิ.ย. 2026 | AR, AP, aging baseline, opening AR/AP, opening stock, opening cash/bank, cash/bank statement, cash position, reconciliation summary | Dev B + Dev C | 4 |
| 11. Finance / Accounting / Asset / Loan / FX | 15-19 มิ.ย. 2026 | tax/VAT/WHT, P&L, balance sheet, cash flow, working capital, stock finance, profit leak, fixed assets, depreciation, asset disposal, loan/leasing, equity, FX/FCD, bank reconciliation | Dev C | 4 |
| 12. Reports Index / Audit / Go-Live Readiness | 15-19 มิ.ย. 2026 | reports index, audit log, activity log, company profile, backup/export, deployment readiness, production checklist | Dev A + Dev C | 1 |
| 13. UAT / Data Import / Security Fix Window | 22-26 มิ.ย. 2026 | client UAT support, customer data import, migration dry run, security test, blocker fixes, go/no-go decision | PM/BA + Dev A/B/C | 5 |
| 14. Cutover / Go-Live / Stabilization | 29 มิ.ย.-12 ก.ค. 2026 | data freeze, backup, final migration, training, go-live checklist, production monitoring, critical/high issue closure | PM/BA + Dev A/B/C | 10 calendar days |
| **Total Calendar Development** | 25 พ.ค.-1 ก.ค. 2026 | ทำแบบ parallel ด้วย Dev 3 คน ภายใน 25 working days ก่อน Go-Live และมี stabilization หลัง Go-Live |  | **25** |

### 5.2.1 Page Ownership By Developer

ตารางนี้แตกจาก 110 รายการเมนูเป็นระดับหน้า เพื่อให้เห็นชัดว่า Dev คนไหนถือหน้าไหน และควรส่งงานช่วงใดตาม timeline Go-Live 1 กรกฎาคม 2026

หลักการแบ่งงาน:

- Dev A: foundation, auth/permission, purchase, payment, dual costing, trading, system readiness
- Dev B: master data, stock, production, AR/AP, opening balance, cash/bank baseline
- Dev C: sales, dashboard, tracking, reports, finance/accounting, asset/loan/FX, audit smoke
- PM/BA: ไม่ถือ code owner รายหน้า แต่ถือ requirement, acceptance, UAT scenario, data mapping, sign-off และ go/no-go ทุกหน้า

| ลำดับ | หมวดงาน | หน้า | Owner หลัก | ช่วงทำงาน |
|---:|---|---|---|---|
| 1 | หน้าหลัก / Dashboard / Monitoring | Owner Daily Control (เปิดทุกเช้า) | Dev C | 8-12 มิ.ย. 2026 |
| 2 | หน้าหลัก / Dashboard / Monitoring | ตรวจจับความผิดปกติ | Dev C | 8-12 มิ.ย. 2026 |
| 3 | หน้าหลัก / Dashboard / Monitoring | Daily Report / รายงานประจำวัน | Dev C | 8-12 มิ.ย. 2026 |
| 4 | หน้าหลัก / Dashboard / Monitoring | Dashboard | Dev C | 8-12 มิ.ย. 2026 |
| 5 | หน้าหลัก / Dashboard / Monitoring | Profit & Cost Analysis | Dev C | 8-12 มิ.ย. 2026 |
| 6 | หน้าหลัก / Dashboard / Monitoring | รายการรอขาย | Dev C | 1-5 มิ.ย. 2026 |
| 7 | หน้าหลัก / Dashboard / Monitoring | วางแผนการขาย (LME) | Dev C | 8-12 มิ.ย. 2026 |
| 8 | หน้าหลัก / Dashboard / Monitoring | Sales Tracking Dashboard | Dev C | 8-12 มิ.ย. 2026 |
| 9 | หน้าหลัก / Dashboard / Monitoring | Cash Flow Calendar | Dev C | 15-19 มิ.ย. 2026 |
| 10 | หน้าหลัก / Dashboard / Monitoring | Business Calendar | Dev C | 8-12 มิ.ย. 2026 |
| 11 | หน้าหลัก / Dashboard / Monitoring | Cash & Others Summary | Dev C | 8-12 มิ.ย. 2026 |
| 12 | Tracking 360° | Customer Tracking | Dev C | 8-12 มิ.ย. 2026 |
| 13 | Tracking 360° | Supplier Tracking | Dev C | 8-12 มิ.ย. 2026 |
| 14 | Tracking 360° | Product Tracking | Dev C | 8-12 มิ.ย. 2026 |
| 15 | รายการประจำวัน | บิลรับซื้อ | Dev A | 1-5 มิ.ย. 2026 |
| 16 | รายการประจำวัน | บิลขาย | Dev C | 1-5 มิ.ย. 2026 |
| 17 | รายการประจำวัน | เบิกออกรอบิล / Pending Sale | Dev C | 1-5 มิ.ย. 2026 |
| 18 | รายการประจำวัน | อนุมัติโอนเงิน / Payment Approval | Dev A | 8-12 มิ.ย. 2026 |
| 19 | รายการประจำวัน | จ่ายเงิน Supplier | Dev A | 8-12 มิ.ย. 2026 |
| 20 | รายการประจำวัน | ใบสำคัญรับเงิน / Receipt Voucher | Dev A | 8-12 มิ.ย. 2026 |
| 21 | รายการประจำวัน | รับเงิน Customer | Dev C | 8-12 มิ.ย. 2026 |
| 22 | รายการประจำวัน | โอนเงินระหว่างบัญชี | Dev A | 8-12 มิ.ย. 2026 |
| 23 | รายการประจำวัน | ค่าใช้จ่าย | Dev C | 8-12 มิ.ย. 2026 |
| 24 | รายการประจำวัน | เงินสำรองจ่าย / กู้กรรมการ | Dev A | 8-12 มิ.ย. 2026 |
| 25 | รายการประจำวัน | Dashboard ค่าใช้จ่าย | Dev C | 8-12 มิ.ย. 2026 |
| 26 | รายการประจำวัน | โอนสินค้าระหว่างสาขา | Dev B | 8-12 มิ.ย. 2026 |
| 27 | รายการประจำวัน | ประวัติเปลี่ยน Supplier ในบิล | Dev A | 1-5 มิ.ย. 2026 |
| 28 | การผลิต | ใบสั่งผลิต | Dev B | 15-19 มิ.ย. 2026 |
| 29 | การผลิต | Production Dashboard | Dev B | 15-19 มิ.ย. 2026 |
| 30 | การผลิต | WIP คงเหลือ | Dev B | 15-19 มิ.ย. 2026 |
| 31 | การผลิต | รายงานการผลิต / Yield | Dev B | 15-19 มิ.ย. 2026 |
| 32 | การผลิต | Production Cost Report | Dev B | 15-19 มิ.ย. 2026 |
| 33 | การผลิต | Yield/Loss + Abnormal | Dev B | 15-19 มิ.ย. 2026 |
| 34 | การผลิต | Machine Utilization | Dev B | 15-19 มิ.ย. 2026 |
| 35 | Dual Costing / จองดีล | PO Buy / จองซื้อ | Dev A | 1-5 มิ.ย. 2026 |
| 36 | Dual Costing / จองดีล | PO Sell / จองขาย | Dev C | 1-5 มิ.ย. 2026 |
| 37 | Dual Costing / จองดีล | Cost Pool | Dev A | 15-19 มิ.ย. 2026 |
| 38 | Dual Costing / จองดีล | Cost Allocator | Dev A | 15-19 มิ.ย. 2026 |
| 39 | Dual Costing / จองดีล | Waiting Allocations | Dev A | 15-19 มิ.ย. 2026 |
| 40 | Dual Costing / จองดีล | Allocation Ledger | Dev A | 15-19 มิ.ย. 2026 |
| 41 | Dual Costing / จองดีล | Dual Costing Report | Dev A | 15-19 มิ.ย. 2026 |
| 42 | Dual Costing / จองดีล | Match Log | Dev A | 15-19 มิ.ย. 2026 |
| 43 | Dual Costing / จองดีล | Deal Margin Report | Dev A | 15-19 มิ.ย. 2026 |
| 44 | Dual Costing / จองดีล | Compare Deal vs Stock | Dev A | 15-19 มิ.ย. 2026 |
| 45 | การเงินและหนี้ | ลูกหนี้ / AR | Dev B | 15-19 มิ.ย. 2026 |
| 46 | การเงินและหนี้ | เจ้าหนี้ / AP | Dev B | 15-19 มิ.ย. 2026 |
| 47 | การเงินและหนี้ | Cash / Bank Statement | Dev B | 15-19 มิ.ย. 2026 |
| 48 | การเงินและหนี้ | Cash Position | Dev B | 15-19 มิ.ย. 2026 |
| 49 | การเงินและหนี้ | จ่ายล่วงหน้า Supplier | Dev A | 8-12 มิ.ย. 2026 |
| 50 | การเงินและหนี้ | รับล่วงหน้าจาก Customer | Dev C | 8-12 มิ.ย. 2026 |
| 51 | การเงินต่างประเทศ | โอนเงินต่างประเทศ | Dev C | 15-19 มิ.ย. 2026 |
| 52 | การเงินต่างประเทศ | รับเงินจากต่างประเทศ | Dev C | 15-19 มิ.ย. 2026 |
| 53 | การเงินต่างประเทศ | FX Rate Management | Dev C | 15-19 มิ.ย. 2026 |
| 54 | การเงินต่างประเทศ | FCD Ledger | Dev C | 15-19 มิ.ย. 2026 |
| 55 | การเงินต่างประเทศ | FX Gain/Loss Report | Dev C | 15-19 มิ.ย. 2026 |
| 56 | การเงินต่างประเทศ | Bank Reconciliation | Dev C | 15-19 มิ.ย. 2026 |
| 57 | สินค้าและคลัง | สต๊อกคงเหลือ | Dev B | 8-12 มิ.ย. 2026 |
| 58 | สินค้าและคลัง | Stock Ledger | Dev B | 8-12 มิ.ย. 2026 |
| 59 | สินค้าและคลัง | ปรับสถานะสินค้า RM -> FG | Dev B | 8-12 มิ.ย. 2026 |
| 60 | สินค้าและคลัง | Grade Adjustment / ปรับเกรด | Dev B | 8-12 มิ.ย. 2026 |
| 61 | สินค้าและคลัง | นับสต๊อก / Stock Count Adjust | Dev B | 8-12 มิ.ย. 2026 |
| 62 | สินค้าและคลัง | Customer Return / ของคืน | Dev B | 8-12 มิ.ย. 2026 |
| 63 | Trading / ซื้อมาขายไป | Trading Dashboard | Dev A | 15-19 มิ.ย. 2026 |
| 64 | Trading / ซื้อมาขายไป | Trading Matching / จับคู่ดีล | Dev A | 15-19 มิ.ย. 2026 |
| 65 | PO Reports | PO ซื้อ/ขาย คงเหลือ | Dev C | 8-12 มิ.ย. 2026 |
| 66 | รายงานรวม | รายงานทั้งหมด | Dev C | 8-12 มิ.ย. 2026 |
| 67 | Finance / Accounting | Financial Dashboard | Dev C | 15-19 มิ.ย. 2026 |
| 68 | Finance / Accounting | Owner Daily Control | Dev C | 8-12 มิ.ย. 2026 |
| 69 | Finance / Accounting | Cash Flow Analysis | Dev C | 15-19 มิ.ย. 2026 |
| 70 | Finance / Accounting | CF Forecast Calendar | Dev C | 15-19 มิ.ย. 2026 |
| 71 | Finance / Accounting | Working Capital Analysis | Dev C | 15-19 มิ.ย. 2026 |
| 72 | Finance / Accounting | Stock Finance Analysis | Dev C | 15-19 มิ.ย. 2026 |
| 73 | Finance / Accounting | Profit Leak Dashboard | Dev C | 15-19 มิ.ย. 2026 |
| 74 | Finance / Accounting | Tax / VAT / WHT | Dev C | 15-19 มิ.ย. 2026 |
| 75 | Finance / Accounting | งบกำไรขาดทุน / P&L | Dev C | 15-19 มิ.ย. 2026 |
| 76 | Finance / Accounting | งบดุล / Balance Sheet | Dev C | 15-19 มิ.ย. 2026 |
| 77 | Finance / Accounting | งบกระแสเงินสด | Dev C | 15-19 มิ.ย. 2026 |
| 78 | Finance / Accounting | Fixed Assets / ทรัพย์สิน | Dev C | 15-19 มิ.ย. 2026 |
| 79 | Finance / Accounting | ค่าเสื่อมราคา | Dev C | 15-19 มิ.ย. 2026 |
| 80 | Finance / Accounting | จำหน่ายทรัพย์สิน | Dev C | 15-19 มิ.ย. 2026 |
| 81 | Finance / Accounting | Loan / Leasing / BSL | Dev C | 15-19 มิ.ย. 2026 |
| 82 | Finance / Accounting | Loan Dashboard | Dev C | 15-19 มิ.ย. 2026 |
| 83 | Finance / Accounting | Net Worth / Track Asset | Dev C | 15-19 มิ.ย. 2026 |
| 84 | Finance / Accounting | Equity / ทุนจดทะเบียน | Dev C | 15-19 มิ.ย. 2026 |
| 85 | Finance / Accounting | Opening Balance / ตั้งต้นยอด | Dev B | 15-19 มิ.ย. 2026 |
| 86 | Finance / Accounting | ข้อมูลย้อนหลัง ม.ค.-เม.ย. 2026 ก่อน Go-Live | Dev C | 15-19 มิ.ย. 2026 |
| 87 | ข้อมูลหลัก | ลูกค้า | Dev B | 25-29 พ.ค. 2026 |
| 88 | ข้อมูลหลัก | พนักงานขาย / Sales | Dev B | 25-29 พ.ค. 2026 |
| 89 | ข้อมูลหลัก | ผู้ขาย | Dev B | 25-29 พ.ค. 2026 |
| 90 | ข้อมูลหลัก | สินค้า | Dev B | 25-29 พ.ค. 2026 |
| 91 | ข้อมูลหลัก | สาขา / คลัง | Dev B | 25-29 พ.ค. 2026 |
| 92 | ข้อมูลหลัก | บัญชีเงิน | Dev B | 25-29 พ.ค. 2026 |
| 93 | ข้อมูลหลัก | ช่องทางซื้อ/ขาย | Dev B | 25-29 พ.ค. 2026 |
| 94 | ข้อมูลหลัก | หมวดค่าใช้จ่าย | Dev B | 25-29 พ.ค. 2026 |
| 95 | ข้อมูลหลัก | กรรมการ/พนักงาน | Dev B | 25-29 พ.ค. 2026 |
| 96 | ข้อมูลหลัก | เครื่องจักร | Dev B | 25-29 พ.ค. 2026 |
| 97 | ข้อมูลหลัก | Production Line | Dev B | 25-29 พ.ค. 2026 |
| 98 | ข้อมูลหลัก | สกุลเงิน | Dev B | 25-29 พ.ค. 2026 |
| 99 | ข้อมูลหลัก | ผู้รับเงินต่างประเทศ | Dev B | 25-29 พ.ค. 2026 |
| 100 | ข้อมูลหลัก | วิธีจ่าย/รับเงิน | Dev B | 25-29 พ.ค. 2026 |
| 101 | ข้อมูลหลัก | วัตถุประสงค์โอน | Dev B | 25-29 พ.ค. 2026 |
| 102 | ข้อมูลหลัก | Import Master จาก Excel | Dev B | 25-29 พ.ค. 2026 |
| 103 | ข้อมูลหลัก | Import บิลซื้อ/บิลขาย | Dev B | 22-26 มิ.ย. 2026 |
| 104 | ระบบ / ผู้ใช้ / Audit | ข้อมูลบริษัท สำหรับใบพิมพ์ | Dev A | 25-29 พ.ค. 2026 |
| 105 | ระบบ / ผู้ใช้ / Audit | เปลี่ยน Password ของฉัน | Dev A | 25-29 พ.ค. 2026 |
| 106 | ระบบ / ผู้ใช้ / Audit | Transaction Ledger / เช็คเงินเข้า-ออก | Dev C | 15-19 มิ.ย. 2026 |
| 107 | ระบบ / ผู้ใช้ / Audit | Backup / Restore | Dev A | 29-30 มิ.ย. 2026 |
| 108 | ระบบ / ผู้ใช้ / Audit | Audit Log | Dev C | 15-19 มิ.ย. 2026 |
| 109 | ระบบ / ผู้ใช้ / Audit | Users & Permissions | Dev A | 25-29 พ.ค. 2026 |
| 110 | ระบบ / ผู้ใช้ / Audit | User Activity Log | Dev C | 15-19 มิ.ย. 2026 |

Development delivery rule:

- แต่ละ module ต้องมี basic validation, permission, API error handling และ responsive check ก่อนส่งเข้า SIT
- Module ที่จบก่อนต้อง promote ไป SIT ทันทีเพื่อให้เจอ integration issue เร็ว
- ถ้า requirement เพิ่มหลัง scope freeze ต้องแยกเป็น change request พร้อมผลกระทบต่อ timeline/cost
- หน้าที่เป็น accounting/dual costing/report ขั้นสูงต้องยืนยันสูตรและ acceptance criteria ก่อนเริ่มพัฒนา

### 5.3 UAT Plan: 1 Week

Client UAT กำหนดเป็น 1 สัปดาห์เต็ม ระหว่างวันที่ 22-26 มิถุนายน 2026 ก่อน cutover และ Go-Live วันที่ 1 กรกฎาคม 2026

ก่อนเข้า UAT ทีมพัฒนาจะทำ SIT ภายในวันที่ 15-19 มิถุนายน 2026 เพื่อทดสอบการเชื่อมกันของ module หลัก เช่น master data, PO, บิล, payment, stock, report และ permission ให้พร้อมก่อนส่งให้ลูกค้า UAT 1 สัปดาห์

Environment flow:

```text
Dev -> SIT -> UAT -> Production
```

แนวทางทำงานคือ develop แต่ละ module ใน Dev แล้ว promote ไป SIT เป็นรอบสั้น ๆ ระหว่างโครงการ ไม่รอส่ง SIT ทั้งระบบทีเดียวตอนท้าย

| รอบ | ช่วงเวลา | ผู้เข้าร่วม | เป้าหมาย | เกณฑ์ผ่าน |
|---|---|---|---|---|
| SIT / System Integration Test | 15-19 มิ.ย. 2026 | ทีมพัฒนา + project owner | ตรวจ flow หลักและ integration ระหว่าง module ก่อนส่งให้ลูกค้า UAT | ไม่มี blocker พื้นฐานก่อนเริ่ม UAT |
| Client UAT | 22-26 มิ.ย. 2026 | Key users ทุกฝ่าย + project owner | ทดสอบ end-to-end ด้วยข้อมูลใกล้จริง, เอกสาร, report, customer data import, migration dry run, security test ตาม checklist ที่ตกลง | ไม่มี critical blocker, มี UAT sign-off, มี security result, มี go/no-go decision |
| Cutover Readiness | 29-30 มิ.ย. 2026 | Project owner + admin users | เตรียม production, final migration, training สั้น, rollback plan | พร้อม Go-Live วันที่ 1 ก.ค. 2026 |
| Post Go-Live Stabilization | 1-12 ก.ค. 2026 | Support + key users | เฝ้าระบบจริง แก้ issue หลังขึ้นใช้งาน | ปิด issue critical/high และสรุป backlog phase ถัดไป |

UAT output ที่ต้องมี:

- รายการ test scenario ตาม role
- รายการ issue พร้อม severity: Critical, High, Medium, Low
- UAT sign-off จากผู้รับผิดชอบแต่ละฝ่าย
- Customer data import result พร้อมรายการสำเร็จ/ไม่สำเร็จ/ข้อมูลที่ต้องแก้
- Data migration result และ reconciliation summary
- Security test result ตาม scope/checklist ที่ตกลงร่วมกัน
- Go/No-Go decision ก่อนวันที่ 29 มิถุนายน 2026

UAT data import scope:

| รายการ | สิ่งที่ต้องตรวจ |
|---|---|
| Customer master import | format file, required fields, duplicate check, tax ID, phone, address, salesperson mapping |
| Supplier master import | payment method, bank account, tax ID, address, responsible salesperson/person mapping |
| Product master import | SKU, unit, product type, active status, duplicate check |
| Opening balances / beginning data | ยอดตั้งต้นที่ต้องใช้วัน Go-Live เช่น stock, AR/AP, cash/bank ตาม scope ที่ตกลง |
| Import error report | ต้อง export รายการ error กลับให้ user แก้ได้ |

Security / pentest scope:

งาน security อยู่ใน scope แต่ยังต้องคุยรายละเอียดเพิ่มก่อนปิด proposal เช่น ระดับการทดสอบ, ผู้ทดสอบ, checklist, report format, remediation window และ acceptance criteria

รายการด้านล่างเป็น baseline ขั้นต่ำที่ควรใช้คุย scope security/pentest เพิ่มเติม

| Area | Minimum check |
|---|---|
| Authentication | login/logout, session expiry, password reset/change password |
| Authorization | role/permission, direct URL access, API permission guard |
| Input validation | required fields, numeric/date validation, file import validation, malicious text payload |
| File upload/import | file type, file size, malformed xlsx/csv, import error handling |
| API security | unauthenticated request, unauthorized role, invalid ID access |
| Data exposure | hidden fields, sensitive logs, exported files, browser console/network response |

Go-Live security criteria:

- Critical security issue = 0
- High security issue = 0 หรือมี approved mitigation ก่อน Go-Live
- Medium/Low issues ต้องบันทึกเป็น backlog พร้อม owner และ due date
- ต้องไม่มีช่องทางให้ user ที่ไม่มีสิทธิ์เข้าถึงข้อมูลหรือ API สำคัญโดยตรง

### 5.4 SIT Plan: System Integration Test

SIT เป็นรอบทดสอบก่อนส่งให้ลูกค้า UAT จุดประสงค์คือให้ทีมพัฒนาและ project owner ตรวจว่าระบบแต่ละ module เชื่อมกันถูกต้องแล้ว ลดความเสี่ยงที่ UAT จะเจอปัญหาพื้นฐาน

ช่วงเวลาเสนอ: 15-19 มิถุนายน 2026

| วัน | กิจกรรม SIT | Output |
|---|---|---|
| Day 1 | Environment readiness + master data integration | SIT environment พร้อม, master data ใช้ร่วมกันได้ |
| Day 2 | Purchase/Sales integration | PO, บิลซื้อ, บิลขาย, supplier/customer/product เชื่อมกันได้ |
| Day 3 | Payment/Stock integration | รับเงิน, จ่ายเงิน, โอนเงิน, stock ledger, stock balance เชื่อมกับ transaction |
| Day 4 | Report/API/Permission integration | report อ่านข้อมูลจาก transaction จริง, API guard, role permission |
| Day 5 | Regression + SIT sign-off | SIT issue list, blocker status, ready for UAT decision |

SIT checklist:

| กลุ่ม | สิ่งที่ต้องตรวจ |
|---|---|
| Environment | SIT URL, env vars, database connection, auth, seed/config data |
| Master Data | ลูกค้า, ผู้ขาย, สินค้า, สาขา/คลัง, บัญชีเงิน, payment method ถูกเรียกใช้ข้าม module |
| API Integration | API list/create/update/export/import ตอบถูก format และ handle error ได้ |
| Purchase Flow | PO Buy -> บิลรับซื้อ -> จ่ายเงิน -> stock/ledger/report |
| Sales Flow | PO Sell -> บิลขาย -> รับเงิน -> stock/pending sale/report |
| Finance Flow | cash/bank, AR/AP baseline, transfer, payment approval |
| Stock Flow | stock balance, stock ledger, transfer, adjust, status movement |
| Reports | daily report, purchase/sales summary, cash summary, stock summary อ่านข้อมูลตรงกับ transaction |
| Permission | role เห็นเมนูถูกต้อง, URL/API guard ทำงาน, unauthorized access ถูก block |
| Import Dry Run | import customer/supplier/product sample file และตรวจ error report |
| Security Smoke Test | login/session, direct URL, API unauthorized, basic malicious input |
| Regression | แก้ bug แล้วไม่ทำให้ flow หลักพัง |

SIT exit criteria:

- Critical SIT blocker = 0
- High issue ที่กระทบ UAT flow ต้องแก้ก่อนเริ่ม UAT
- API และ permission หลักต้องผ่าน smoke test
- Import sample file ต้องผ่านหรือมี error report ที่เข้าใจได้
- Project owner อนุมัติให้เปิด Client UAT ได้

### 5.5 Scope ที่รวมใน Full Delivery

| กลุ่ม | Scope ที่รวมในงานส่งมอบ |
|---|---|
| Master Data | ลูกค้า, ผู้ขาย, สินค้า, สาขา/คลัง, บัญชีเงิน, วิธีจ่าย/รับเงิน, พนักงานขาย, หมวดค่าใช้จ่าย |
| User / Permission | Login, role, permission, user management, change password |
| Purchase / Sales | PO Buy, PO Sell, บิลรับซื้อ, บิลขาย, line items, เลขเอกสาร, validation หลัก |
| Payment / Receipt | จ่ายเงิน Supplier, รับเงิน Customer, โอนเงินระหว่างบัญชี, ใบสำคัญรับเงินถ้าต้องใช้จริง |
| Stock | Stock balance, stock ledger, transfer, adjust ตาม scope ที่ตกลง |
| Daily Control | Daily Report, Owner Daily Control, Cash & Others Summary เฉพาะ KPI จำเป็น |
| Reports | รายงานซื้อขาย, ยอดคงเหลือ, ลูกหนี้/เจ้าหนี้ และรายงานตาม scope ที่ตกลง |
| Audit / Safety | Activity log, audit log, backup/export ข้อมูลจำเป็นก่อน Go-Live |

### 5.6 Scope ที่ต้องคุยรายละเอียดเพิ่ม

รายการด้านล่างถือว่าอยู่ใน scope ที่ต้องคุยรายละเอียดเพิ่ม เพราะยังไม่ได้สรุปขอบเขต วิธีส่งมอบ และเกณฑ์รับงานในรอบ requirement

| กลุ่ม | รายละเอียดที่ต้องยืนยัน | Tool / Tech ที่ใช้เสนอ |
|---|---|---|
| Server / Infrastructure Setup | hosting target, cloud account owner, DNS/domain, SSL, environment setup, backup policy, monitoring, access control, deployment responsibility | Vercel หรือ cloud hosting ที่ลูกค้าเลือก, Supabase, custom domain/DNS, SSL, environment variables, GitHub deployment, backup/export script |
| Security / Pentest | test level, checklist, tooling, tester responsibility, report format, remediation SLA, retest scope, go-live security criteria | OWASP checklist, OWASP ZAP หรือ Burp Suite Community, browser devtools, API test via Postman/Bruno, dependency audit, Supabase RLS/Auth review, manual role/permission test |
| Performance | target response time, concurrent users, expected data volume, report/export size, peak usage period, load test scope, performance acceptance criteria | Lighthouse, Playwright timing, k6 หรือ Artillery สำหรับ load test, database query review, Supabase/Postgres indexes, Vercel/Supabase logs |
| Data Cleansing & Migration | source data list, cleansing rules, field mapping, duplicate handling, migration dry run, reconciliation, final cutover import, owner sign-off | Excel/CSV templates, data mapping sheet, import validation report, reconciliation spreadsheet, SQL verification queries, Supabase import/migration scripts |
| MA / Maintenance Agreement | support period, SLA, response time, bugfix coverage, backup operation, monitoring, patch/update policy, monthly report | GitHub issue tracker, Vercel/Supabase monitoring/logs, uptime monitoring, scheduled backup/export, dependency/security update checklist, monthly support report |
| Major scope change | วิธีจัดการ requirement ใหม่หลัง scope freeze, change request process, ผลกระทบต่อ timeline/cost | Change request form, impact assessment, updated timeline, updated manday estimate, approval log |
| Historical data cleanup beyond agreed import | ขอบเขตการ clean/แก้ข้อมูลย้อนหลัง, owner ฝั่งลูกค้า, reconciliation criteria | Excel/CSV template, import validation report, reconciliation spreadsheet, SQL verification queries, Supabase table review |

Data cleansing and migration deliverables:

| Deliverable | รายละเอียด |
|---|---|
| Data source checklist | ระบุ source file/table ที่ต้องย้าย เช่น customer, supplier, product, stock opening, AR/AP opening, cash/bank opening |
| Field mapping sheet | mapping field จากข้อมูลเดิมไป schema ใหม่ พร้อม required/optional rule |
| Cleansing rule | กติกา clean ข้อมูล เช่น duplicate, tax ID, phone, address, bank account, product SKU, inactive record |
| Import template | template สำหรับลูกค้า key/แก้ข้อมูลกลับมาให้นำเข้าได้ |
| Dry-run migration result | ผลทดลองนำเข้า จำนวนสำเร็จ/ไม่สำเร็จ/error และรายการที่ต้องแก้ |
| Reconciliation summary | สรุปยอดเทียบก่อน/หลัง เช่น จำนวน record, stock opening, AR/AP, cash/bank เฉพาะ scope ที่ตกลง |
| Final migration sign-off | ลูกค้ายืนยันข้อมูลก่อน Go-Live |

### 5.7 เงื่อนไขสำคัญสำหรับ Timeline 1.5 เดือน

- ต้องเก็บ requirement หลักให้ครบภายในวันที่ 22 พฤษภาคม 2026
- ต้องส่ง proposal/scope ให้ลูกค้าตรวจในวันจันทร์ที่ 25 พฤษภาคม 2026
- ต้อง freeze scope สำหรับ Go-Live ภายในสัปดาห์วันที่ 25-29 พฤษภาคม 2026
- ลูกค้าต้องส่ง master data และตัวอย่างเอกสารจริงให้ครบภายในสัปดาห์แรก
- ต้องมีผู้ใช้งานหลักของลูกค้าช่วย UAT ทุกสัปดาห์
- ต้องมี formal UAT sign-off ภายในวันที่ 26 มิถุนายน 2026
- หน้าที่ซับซ้อนต้องยืนยัน acceptance criteria ก่อนเริ่มพัฒนา
- ข้อมูลบัญชี/ภาษี/ต้นทุนต้องมีผู้รับผิดชอบฝั่งลูกค้ายืนยันสูตร
- หากเพิ่ม scope ระหว่างทาง ต้องแยกเป็น change request เพื่อไม่กระทบวันที่ 1 กรกฎาคม 2026

## 6. สิ่งที่ต้องยืนยันกับลูกค้า

ก่อนสรุป scope และ timeline ควรยืนยันประเด็นต่อไปนี้

| ประเด็น | รายละเอียดที่ต้องยืนยัน |
|---|---|
| จำนวนหน้าที่ใช้งานจริง | ลูกค้าใช้ครบทุกหน้า หรือมีหน้าที่ไม่ต้องย้าย |
| สิทธิ์ตาม role | แต่ละ role เห็นเมนูไม่เท่ากัน ต้องยืนยันสิทธิ์จริง |
| Flow ที่เป็น prototype | บางหน้าอาจเป็น dashboard/read-only ต้องยืนยันว่าต้องทำเป็นระบบบันทึกจริงหรือไม่ |
| ข้อมูลเดิม | ต้องย้ายข้อมูลจริงชุดใดบ้าง และต้อง reconcile ตัวเลขอะไร |
| เอกสารพิมพ์ | ใบรับสินค้า ใบส่งของ ใบสำคัญรับเงิน และแบบฟอร์มอื่น ๆ ต้องยืนยันรูปแบบ |
| รายงานบัญชี/ภาษี | ต้องยืนยันสูตร วิธีปิดงบ และผู้รับผิดชอบตรวจตัวเลข |
| Go-Live | ต้องกำหนดรอบทดสอบ UAT, cutover, backup และ rollback |

## 7. Budgetary Estimate

ราคาด้านล่างเป็น budgetary estimate สำหรับใช้คุยเบื้องต้น โดยอิงจากแนวทาง AI-assisted development / reuse legacy pattern / migration จากระบบต้นแบบเดิม ไม่ใช่การ build ERP ใหม่จากศูนย์ทั้งหมด

### 7.1 Recommended Project Price

| รายการ | ราคาโดยประมาณ |
|---|---:|
| Base project: full delivery ตาม scope หลัก, Dev 25 working days, SIT, UAT support, Go-Live support | 690,000 บาท |
| Data / Security / Go-Live package: data import support, migration dry run, security checklist, cutover support | 160,000 บาท |
| **รวมราคาเสนอแนะนำ** | **850,000 บาท** |

### 7.2 Price Range Reference

| Package | ราคาโดยประมาณ | เหมาะกับกรณี |
|---|---:|---|
| Lean delivery | 350,000-500,000 บาท | scope จำกัด, data migration เบา, security/performance ตรวจพื้นฐาน, ลูกค้ารับ risk เองมากขึ้น |
| Recommended delivery | 650,000-900,000 บาท | full delivery ตาม proposal, มี SIT/UAT/data import/security checklist/go-live support |
| Extended delivery | 900,000-1,400,000 บาท | รวม data cleansing หนัก, server setup เต็ม, formal pentest, performance load test, go-live support เพิ่ม |

### 7.3 Optional / Clarification Pricing

รายการด้านล่างอยู่ใน scope ที่ต้องคุยรายละเอียดเพิ่ม หากขอบเขตเกิน baseline ที่ตกลงใน proposal ให้ประเมินราคาแยกตาม effort จริง

| รายการ | ราคาโดยประมาณ |
|---|---:|
| Data cleansing & migration เพิ่มเติม / ข้อมูลย้อนหลังจำนวนมาก | 50,000-200,000 บาท |
| Security / pentest formal report | 80,000-250,000 บาท |
| Server / infrastructure setup | 30,000-100,000 บาท |
| Performance load test จริง | 50,000-150,000 บาท |
| MA หลัง Go-Live | 30,000-80,000 บาท / เดือน |

### 7.4 Pricing Assumptions

- ราคาอิงจากการ reuse pattern เดิมและ master data structure ที่ค่อนข้างนิ่งแล้ว
- ต้อง freeze scope ตาม timeline ที่กำหนด
- ลูกค้าต้องส่งข้อมูล master data, ตัวอย่างเอกสาร, role และ acceptance criteria ตามกำหนด
- ถ้ามี requirement ใหม่หลัง scope freeze ให้จัดเป็น change request
- ราคาไม่รวมค่า cloud/service subscription ที่ลูกค้าเป็นเจ้าของ account โดยตรง เว้นแต่ตกลงเป็นลายลักษณ์อักษร
- รายการ security, performance, server setup และ MA ต้องยืนยันขอบเขตละเอียดก่อนสรุปราคา final

## 8. หมายเหตุสำหรับ Proposal

- รายการนี้เป็น baseline จากระบบต้นแบบเดิม ไม่ใช่ final requirement ทั้งหมด
- บางหน้ามีลักษณะเป็น dashboard หรือรายงาน อาจไม่ต้องมี flow บันทึกข้อมูล
- บางหน้าที่อยู่ในระบบเดิมอาจควรรวม ปรับชื่อ หรือย้ายหมวดในระบบใหม่เพื่อให้ใช้งานง่ายขึ้น
- ขอบเขตจริงควรสรุปหลัง workshop กับผู้ใช้งานแต่ละฝ่าย
- หน้าที่นับซ้ำ: `Owner Daily Control`
- หน้าที่อยู่ในเมนู legacy แต่ต้องตรวจสอบการทำงานเพิ่ม: `Net Worth / Track Asset`
