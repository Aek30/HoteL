# HMS Hotel — Vue frontend

หน้าเว็บลูกค้าและ admin ใน Vue 3 แอปเดียว เชื่อม Express/MySQL ผ่าน API ไม่มีข้อมูลจำลองในหน้าเว็บ

## เปิดบนเครื่อง

1. เปิด MySQL ใน XAMPP ให้เรียบร้อย
2. เทอร์มินัลแรก: เข้า `backend` แล้วรัน `npm install` และ `npm run dev`
3. เทอร์มินัลที่สอง: เข้า `frontend` แล้วรัน `npm install` และ `npm run dev`
4. เปิด http://127.0.0.1:5173

สร้าง `.env` จาก `.env.example` ถ้ายังไม่มี ค่าเริ่มต้น proxy `/api` ไป backend พอร์ต 3000 ดังนั้นไม่ต้องตั้ง URL ไว้ในแต่ละหน้าหรือใช้ Postman เปิดหน้ารายการห้องก็ทดสอบข้อมูลจาก MySQL ได้

ล็อกอินบัญชี customer เพื่อจอง บัญชี admin จะเข้าหน้า `/admin` อัตโนมัติ ใช้บัญชีและรหัสผ่านเดิมของคุณ ไม่มีรหัส admin ฝังใน frontend การตรวจสิทธิ์จริงอยู่ใน backend

## หน้าลูกค้า

หน้าหลัก, ห้องพัก/ค้นหาวันและจำนวนคน/เรียงราคา/กรองประเภท, รายละเอียดห้องและรูป, สมัครสมาชิก, เข้าสู่ระบบ, ลืมและตั้งรหัสผ่าน, จอง 4 ขั้นตอนพร้อมเลือกหลายห้อง, รายการและรายละเอียดการจอง, ส่งสลิป, ส่งบัตรประชาชน/พาสปอร์ต, ดาวน์โหลดใบเสร็จ PDF, ยกเลิกก่อนเข้าพัก, แก้ไขข้อมูลส่วนตัว, ติดต่อโรงแรม

## หน้า admin

ภาพรวมสถานะห้อง/ผู้เข้าพักวันนี้/รายการรอตรวจ, ประเภทห้องและราคา, รูปห้องและสิ่งอำนวยความสะดวก, ห้องจริงและสถานะ, การจอง, ตรวจสลิป/รับเงินสด/บันทึกคืนเงิน, ตรวจเอกสาร, check-in/out, ค่าใช้จ่ายระหว่างเข้าพัก, รายงานกระแสเงินสดและ CSV

การส่งสลิปไม่ได้แปลว่าจ่ายสำเร็จ ต้องให้ admin ตรวจ การคืนเงินเป็นการบันทึกหลังโรงแรมคืนเงินจริงแล้ว เว็บไม่ได้โอนเงินจริง

## ข้อมูลที่โรงแรมต้องใส่

ตั้งเบอร์ อีเมล ที่อยู่ บัญชีรับเงิน และพร้อมเพย์จริงใน `frontend/.env` ตามชื่อใน `.env.example` แล้วเปิด dev server ใหม่ ค่าเหล่านี้เป็นข้อมูลสาธารณะที่แสดงบนเว็บ ห้ามใส่รหัสผ่าน MySQL, JWT_SECRET, SMTP password หรือข้อมูลลับในตัวแปร VITE_

ลืมรหัสผ่านต้องตั้ง SMTP และ `PASSWORD_RESET_URL=http://127.0.0.1:5173/reset-password` ใน **backend/.env** ก่อน ใช้ URL เดียวกับที่เปิดเว็บจริง

## ให้เพื่อนทำงานต่อ

- คนดูแลลูกค้า: `src/views/Home.vue`, `Rooms.vue`, `RoomDetail.vue`, `Auth.vue`, `Booking.vue`, `MyBookings.vue`, `BookingDetail.vue`, `Profile.vue`, `Contact.vue`
- คนดูแล admin: `src/views/AdminDashboard.vue`, `AdminCatalog.vue`, `AdminReviews.vue`, `AdminReports.vue` และหน้าการจองที่ใช้ร่วมกัน
- สีปรับที่ `src/tokens.css`; การจัดวางและ responsive ที่ `src/style.css`; component ร่วมที่ `src/components`; API/auth ที่ `src/lib/api.js`; route ที่ `src/router.js`

ให้คนหนึ่งดูแล CSS กลางเมื่อแก้พร้อมกันเพื่อลด conflict หน้า MyBookings และ BookingDetail ใช้ร่วมสองบทบาท ให้ตกลงกันก่อนแก้ logic

แต่ละคน clone repository เดียวกัน สร้าง branch ของตนเอง เช่น `frontend/customer-ui` กับ `frontend/admin-ui` แล้วส่ง Pull Request เข้า main ใส่ `.env` บนเครื่องแต่ละคนและ import schema/seed ของโปรเจกต์เอง `localhost` ของเพื่อนหมายถึงเครื่องเพื่อน จึงต้องเปิด backend/MySQL ของตนด้วย

อ่าน API ที่ `../backend/API-CONTRACT.md` รักษาชื่อ field/request/status เดิมขณะตกแต่ง เมื่อเพิ่ม API ให้ตกลงกับคนทำ backend ก่อน ห้ามต่อ MySQL จาก Vue โดยตรง

## ตรวจและ build

`npm run build` ตรวจ compile ทุกหน้าและสร้าง `dist` ใช้ `npm run preview` ตรวจ build บนเครื่อง พอร์ต 4173 (มี proxy แบบ dev) สำหรับขึ้น server จริงให้ส่ง `dist` ไป web server ตั้ง SPA fallback เป็น `index.html` และ reverse proxy `/api` ไป Express ต้องทำ HTTPS และกำหนด URL/SMTP/CORS ตามโดเมนจริงก่อนเผยแพร่

ขั้นตอนตรวจผ่าน browser: ค้นหาห้อง → login customer → จอง → ส่งหลักฐาน/เอกสาร → login admin → ตรวจ/อนุมัติ → check-in → เพิ่มค่าใช้จ่าย/รับเงิน → check-out → ดาวน์โหลดใบเสร็จ → ดูรายงาน ทดสอบ admin guard และ customer ที่เปิดการจองคนอื่นด้วย

ใช้ภาพจาก Unsplash เป็นภาพประกอบจนโรงแรมอัปโหลดภาพจริงผ่าน admin: https://unsplash.com/photos/6a8506099945, https://images.unsplash.com/photo-1611892440504-42a792e24d32, https://images.unsplash.com/photo-1590490360182-c33d57733427 รูปประกอบถูกติดป้ายในหน้าเว็บ ใช้สี teal และ Prompt/Sarabun ตามภาพ design system ที่ผู้ใช้ให้ ยังไม่ได้เทียบ pixel กับไฟล์ Figma ต้นฉบับ
