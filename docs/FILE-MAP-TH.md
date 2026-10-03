# แผนที่ไฟล์ทั้งหมดของโปรเจค

ใช้ร่วมกับ [คู่มือหลัก](PROJECT-HANDOFF-TH.md) และ [พจนานุกรมฐานข้อมูล](DATABASE-DICTIONARY-TH.md) paths ในตารางเป็นตำแหน่งจากราก repository ตารางฐานข้อมูลที่ระบุรวมการตรวจเงื่อนไขและ join ไม่ได้หมายความว่าทุก request เขียนทุกตาราง

## ไฟล์รากและเอกสาร

| ไฟล์ | หน้าที่ | เชื่อมฐานข้อมูล |
|---|---|---|
| .gitignore | ไม่ส่ง dependencies, .env, dist, cache, uploads/private-storage และ PDF ที่สร้างทดสอบเข้า Git | ไม่มี |
| package-lock.json | lockfile ราก packages ว่าง ไม่มี package.json ราก ไม่ใช่ที่ติดตั้งแอป | ไม่มี |
| backend/.gitignore | ป้องกัน .env และ .env.* ยกเว้น .env.example | ไม่มี |
| backend/package.json | dependencies และ scripts dev/start/test/create-admin/test:integration | ไม่มี query เอง |
| backend/package-lock.json | ล็อกรุ่น dependencies backend สำหรับ npm ci | ไม่มี |
| backend/.env.example | ตัวอย่างพอร์ต DB JWT origins admin SMTP | db.js/server.js/scripts อ่านค่า |
| backend/API-CONTRACT.md | endpoint/input/สิทธิ์สำหรับ frontend; บางข้อความท้ายไฟล์เก่าและขาด GET /me/profile | เอกสาร |
| backend/README-complete.md | รวมกฎ booking/payment/stay/report และตัวอย่าง API; ข้อความว่า frontend ยังต้องเขียนเก่าแล้ว | เอกสาร |
| backend/README-auth.md | สมัคร/ล็อกอิน JWT ทดสอบ; ข้อความ admin ยังไม่ทำเก่าแล้ว | เอกสาร |
| backend/README-admin.md | สร้าง admin และ CRUD ประเภทห้อง | เอกสาร |
| backend/README-rooms.md | CRUD ห้องจริง; ข้อความ bookings ต้องทำต่อเก่าแล้ว | เอกสาร |
| backend/README-availability.md | อธิบายค้นหาห้องว่างและจำนวนคนต่อห้อง | เอกสาร |
| frontend/README.md | เปิด Vue และส่งต่องานลูกค้า/แอดมิน | เอกสาร |
| docs/PROJECT-HANDOFF-TH.md | คู่มือระบบ ติดตั้ง หน้าจอ/API และข้อจำกัดที่ตรวจพบ | เอกสารใหม่ |
| docs/FILE-MAP-TH.md | หน้าที่ทุกไฟล์โปรเจค | เอกสารใหม่ |
| docs/DATABASE-DICTIONARY-TH.md | ตาราง ความสัมพันธ์ คอลัมน์ และการนำไปใช้ | เอกสารใหม่ |

## Backend: การเปิดระบบและ helper

| ไฟล์ | หน้าที่/ข้อมูล | ตาราง/แหล่งข้อมูล | ใช้เมื่อ |
|---|---|---|---|
| backend/src/server.js | โหลด backend/.env ตรวจ JWT_SECRET เปิด HTTP และ timer expire ทุก 60 วินาที | bookings ผ่าน expire() | เริ่ม server |
| backend/src/app.js | helmet/CORS/JSON, mount ทุก route, /me, /health, public /room-types, 404/error handler | users ผ่าน auth; health SELECT 1; room_types + room_images | เพิ่ม route หรือ middleware กลาง |
| backend/src/config/db.js | mysql2 pool อ่าน DB_HOST/PORT/USER/PASSWORD/NAME; dateStrings=true | ทุกตารางผ่าน connection pool | ตั้ง DB; ไม่ใส่ credential ใน view |
| backend/src/lib/hotel.js | validate/date/money cents BigInt, transaction, owner access, locking, finance, live, expire และ wrap error | bookings, customers, rooms, booking_rooms, stays, additional_charges, payments | กฎการเงิน/สิทธิ์/จองร่วม |
| backend/src/lib/files.js | Multer memory upload 5 MB ตรวจ signature PNG/JPEG/PDF สุ่ม key บันทึก/ลบ/resolve | disk backend/private-storage ไม่มี SQL เอง | ไฟล์แนบทุกประเภท |
| backend/src/middleware/authenticate.js | Bearer JWT ตรวจ issuer/audience/HS256 และ user active ทุก request | users | API ที่ต้องล็อกอิน |
| backend/src/middleware/require-admin.js | ตรวจ req.user.role=admin | ไม่ query เอง | API เฉพาะแอดมิน |

## Backend: auth

| ไฟล์ | หน้าที่ | ตาราง | คู่หน้าเว็บ |
|---|---|---|---|
| backend/src/modules/auth/auth.routes.js | register/login rate limit, mount reset routes | ผ่าน controller/service | Auth.vue |
| backend/src/modules/auth/auth.controller.js | validate request และคืน response/error register/login | ผ่าน auth.service.js | Auth.vue |
| backend/src/modules/auth/auth.validation.js | Zod username/email/password/ชื่อ/โทร, strict input | ไม่มี SQL | ฟอร์มสมัคร/รหัสผ่าน |
| backend/src/modules/auth/auth.service.js | bcrypt register transaction users+customers; login ตรวจรหัส ออก JWT อัปเดต last_login_at | users, customers | Auth.vue, api.js |
| backend/src/modules/auth/reset-password.routes.js | forgot/reset, SMTP, SHA256 token, expiry 30 นาที, single use, bcrypt | users, password_reset_tokens | Auth.vue โหมด forgot/reset |

## Backend: ห้องและการจอง

| ไฟล์ | หน้าที่/API หลัก | ตารางที่เกี่ยวข้อง | คู่หน้าเว็บ |
|---|---|---|---|
| backend/src/modules/room-types/room-types.routes.js | admin CRUD ประเภท; รายละเอียดรูป/amenities; ป้องกัน FK ตอนลบ | room_types, room_images, amenities, room_type_amenities; users ผ่าน middleware | AdminCatalog.vue |
| backend/src/modules/rooms/rooms.routes.js | admin CRUD ห้องจริง ค้นหา/กรอง/แบ่งหน้า ป้องกันเปลี่ยนห้องมีผู้พัก/จอง | rooms, room_types, stays, bookings, booking_rooms | AdminCatalog.vue |
| backend/src/modules/rooms/availability.routes.js | public availability วัน/ความจุ/ประเภท เช็กทับช่วงและ stay ค้าง | rooms, room_types, bookings, booking_rooms, stays | Rooms.vue, Booking.vue |
| backend/src/modules/bookings/catalog.routes.js | public detail/images/amenities, admin upload/delete รูปและผูก amenities, CRUD amenities, GET/PATCH profile | room_types, room_images, amenities, room_type_amenities, customers | RoomDetail.vue, AdminCatalog.vue, Profile.vue |
| backend/src/modules/bookings/bookings.routes.js | สร้างจอง transaction, list/detail, cancel/no-show; รวมข้อมูลรายละเอียด | customers, rooms, room_types, bookings, booking_rooms, payments, identity_documents, receipts, stays, additional_charges | Booking.vue, MyBookings.vue, BookingDetail.vue |
| backend/src/modules/bookings/payments.routes.js | ส่ง payment/proof, list, verify, ออก receipt, confirm เมื่อค่าห้องครบ, refund | payments, bookings, receipts; customers/rooms/booking_rooms/stays/additional_charges ผ่าน helper | BookingDetail.vue, AdminReviews.vue |
| backend/src/modules/bookings/documents.routes.js | upload/list/file/review เอกสาร confirm เมื่อ approved | identity_documents, bookings; customers/rooms/booking_rooms ผ่าน helper | BookingDetail.vue, AdminReviews.vue |
| backend/src/modules/bookings/stays.routes.js | check-in/out, charge; update occupied/cleaning | bookings, booking_rooms, rooms, stays, identity_documents, payments, additional_charges และ customers ผ่าน helper | BookingDetail.vue |
| backend/src/modules/bookings/reports.routes.js | receipt PDF ไทย/อังกฤษ, dashboard, cash-flow | receipts, payments, bookings, customers, rooms, identity_documents | BookingDetail.vue, AdminDashboard.vue, AdminReports.vue |

## SQL, scripts และ tests

| ไฟล์ | หน้าที่ | ผลต่อข้อมูล |
|---|---|---|
| backend/test/schema.sql | แหล่งโครงสร้าง DB ที่มีจริง สร้าง hotel_management 15 ตารางพร้อม FK/CHECK/index/generated columns | รันครั้งแรกบน DB ใหม่ ไม่มี DROP; ไม่มี migration framework |
| backend/test/seed.sql | ตัวอย่าง 4 ประเภท/8 ห้อง/6 amenities/20 คู่ ไม่มีบัญชีและรูป | INSERT ครั้งเดียวหลัง schema |
| backend/scripts/create-admin.js | อ่าน ADMIN_* validate/hash และเพิ่ม admin | INSERT users; ไม่เพิ่ม customers; ไม่รีเซ็ตบัญชีเดิม |
| backend/scripts/integration.js | MySQL integration จองพร้อมกัน/สิทธิ์/เงิน/PDF/เอกสาร/stay/charges/refund/report/expiry/reset/catalog | สร้าง DB สุ่ม hotel_test_*, mock SMTP, ลบ test DB/ไฟล์ท้ายงาน; สร้าง test/receipt-preview.pdf |
| backend/test/auth.test.js | HTTP login/me JWT รหัสผิด token และสิทธิ์บัญชี | mock pool.execute ไม่ใช้ DB จริง |
| backend/test/hotel.test.js | เงินคงความแม่นยำ วันที่จริงและกฎ booking สิ้นสุด | ไม่ query ข้อมูลจริง |
| backend/test/room-types.test.js | CRUD admin validation pagination duplicate/FK partial patch | mock DB |
| backend/test/rooms.test.js | CRUD ห้อง admin validation type/occupied/history/partial patch | mock DB |

## Frontend: config และแกนร่วม

| ไฟล์ | หน้าที่ | แหล่งข้อมูล |
|---|---|---|
| frontend/package.json | scripts dev/build/preview และ dependencies Vue/icons/fonts/Vite | ไม่มี DB |
| frontend/package-lock.json | ล็อกรุ่นติดตั้ง npm ci | ไม่มี DB |
| frontend/.env.example | API base/proxy + hotel contact/bank/PromptPay แบบ public | env ไม่ใช่ตาราง DB |
| frontend/vite.config.js | Vue plugin และ proxy /api ไป API_PROXY_TARGET ทั้ง dev/preview | backend HTTP |
| frontend/index.html | HTML ไทย viewport/description/title/favicon และ div#app | ไม่มี DB |
| frontend/src/main.js | createApp mount router และ import CSS/Prompt/Sarabun | ไม่มี query |
| frontend/src/router.js | route/lazy views/title/auth/customer/admin guard และ restore session | /me ผ่าน api.js |
| frontend/src/App.vue | customer header/footer และ admin sidebar/topbar เมนูตาม role logout/toasts | session.user/notices; ไม่มี direct query |
| frontend/src/tokens.css | สีหลัก text/muted/background/border/danger | static CSS |
| frontend/src/style.css | CSS กลาง layout/button/forms/table/modal/gallery/responsive/reduced-motion | static CSS มีสีบางจุด hardcode |
| frontend/src/lib/api.js | fetch base/Authorization JSON/FormData/error/blob/login/restore/download/preview | API ทุกชุด; token ใน sessionStorage |
| frontend/src/lib/format.js | THB/date/วันนี้ Bangkok/nextDate และแปลชื่อ status/method/document | ไม่ query DB |
| frontend/src/lib/ui.js | toast notify 5 วินาที | state ฝั่ง Vue |

## Frontend: views ทุกไฟล์

| ไฟล์ใต้ frontend/src/views | หน้าที่ | API/ตารางต้นทาง |
|---|---|---|
| Home.vue | hero ค้นหาและแนะนำ 3 ประเภทแรก | /room-types → room_types, room_images |
| Rooms.vue | รายการประเภทหรือห้องว่าง filter/sort ราคาฝั่ง client | /room-types หรือ /rooms/availability → ห้องและวงจรจอง |
| RoomDetail.vue | รายละเอียดประเภท gallery amenities | /room-types/:id → room_types, room_images, amenities, room_type_amenities |
| Auth.vue | login/register/forgot/reset ในไฟล์เดียว | /auth/* → users, customers, password_reset_tokens |
| Booking.vue | จอง 4 ขั้น หลายห้อง/คนต่อห้อง | availability, /me/profile, POST /bookings |
| MyBookings.vue | ลูกค้าของตนและแอดมินทั้งหมด ใช้ route.meta.admin | /me/bookings หรือ /admin/bookings → bookings, customers |
| BookingDetail.vue | เงิน/เอกสาร/ใบเสร็จ/ยกเลิก และแอดมินเช็กอิน/out/no-show/charges/cash | /bookings/:id และ actions → วงจรจองครบ; bank จาก env |
| Profile.vue | ดูและแก้ 6 fields โปรไฟล์ | /me/profile → customers; user/email จาก session |
| Contact.vue | tel/mailto/ที่อยู่ และลิงก์การจอง | VITE_HOTEL_*; ไม่มี DB |
| AdminDashboard.vue | ห้องตามสถานะ arrivals pending reviews ล่าสุด | /admin/dashboard และ /admin/bookings |
| AdminCatalog.vue | 3 โหมด room-types/rooms/amenities เพิ่มแก้ลบและรูป/amenities | /admin/room-types, /rooms, /amenities และ media actions |
| AdminReviews.vue | 2 โหมดตรวจ payments/documents แสดง Blob/file และ refund | /admin/payments หรือ /admin/identity-documents และ review actions |
| AdminReports.vue | ช่วงวัน KPI/กราฟ/ตาราง cash flow และ export CSV client | /admin/reports/cash-flow → payments |
| NotFound.vue | 404 และกลับหน้าแรก/ห้อง | ไม่มี DB |

ดู URL และฟิลด์ที่คืนจริงในคู่มือหลักหัวข้อ 5–8

## Components และ assets

| ไฟล์ | หน้าที่ | แหล่งข้อมูล |
|---|---|---|
| frontend/src/components/RoomCard.vue | การ์ดประเภท/ห้องจริง ราคา specs รูป fallback และปุ่มจอง room_id | props.room จากหน้า ไม่มี fetch เอง |
| frontend/src/components/SearchForm.vue | เลือกวันและจำนวนคน ส่ง query ไป /rooms | props.initial และค่าฟอร์ม ไม่มี fetch เอง |
| frontend/src/components/StatusBadge.vue | ป้ายสี/ข้อความตาม status | props.value และ lib/format.js |
| frontend/src/components/StatePanel.vue | loading/error/empty และ retry emit | props จากหน้า |
| frontend/src/components/AppModal.vue | Teleport modal slot focus trap ปุ่มปิด Escape/Tab | props.title/wide และ emit close ไม่มี DB |
| frontend/public/hero.jpg | รูปประกอบโรงแรม ใช้ Home/Auth | local asset ไม่ใช่ room_images |
| frontend/public/room-1.jpg | ภาพห้องประกอบ fallback card/detail | local asset ไม่ใช่ภาพจริงใน DB |
| frontend/public/room-2.jpg | ภาพห้องประกอบ fallback card/detail | local asset ไม่ใช่ภาพจริงใน DB |
| frontend/public/favicon.svg | ไอคอน H บนแท็บ | local SVG ไม่มี DB |

## ไฟล์และโฟลเดอร์ที่อาจเกิดบนเครื่องหลังติดตั้ง

| path | ความหมาย/ควรส่งต่อไหม |
|---|---|
| backend/.env, frontend/.env | config รายเครื่อง ไม่ส่งค่าลับเข้า Git; คู่มือใช้ .env.example |
| backend/node_modules, frontend/node_modules | dependency ที่ npm ci สร้าง ไม่แก้เพื่อทำ UI ไม่ส่ง ZIP |
| frontend/dist | build ที่สร้างใหม่ได้ ไม่ใช่ source สำหรับเพื่อนแก้ |
| .npm-cache | cache npm ไม่มีข้อมูลโรงแรม |
| .git | ประวัติ repository ไม่มีข้อมูลแอป runtime |
| backend/private-storage | ไฟล์จริงตาม key ใน room_images/payments/identity_documents; ไม่ใช่ static public dir ต้องสำรองร่วม DB |
| backend/test/receipt-preview.pdf, backend/receipt.pdf | PDF output ตัวอย่าง/ทดสอบ ไม่ใช่ schema หรือ source |

มีข้อมูลเฉพาะใน DB หลายส่วนที่ไม่อยู่ใน Git เช่นบัญชี/การจอง และเนื้อไฟล์ private-storage ส่งแค่ source แล้วเพื่อนจะต้อง import schema/seed และสร้างบัญชีของตนเอง
