# Backend ระบบโรงแรม

โปรเจกต์จริง: `D:\3-1\project_อ.วิภารันต์\HoteL\HoteL\backend`

## รัน

```powershell
cd "D:\3-1\project_อ.วิภารันต์\HoteL\HoteL\backend"
npm.cmd install
npm.cmd run dev
```

ใช้ .env และฐานข้อมูลเดิม ห้ามนำเข้า schema/seed ซ้ำในฐานข้อมูลจริง
หาก server เดิมใช้พอร์ต 3000 ให้กด Ctrl+C ใน terminal ของ server เดิมก่อนรันใหม่

## สิ่งที่ทำได้

- สมัครสมาชิก, JWT login, me/profile, admin แยกสิทธิ์
- reset password ทางอีเมล (ต้องตั้ง SMTP)
- ประเภทห้อง ห้องจริง รูปห้อง สิ่งอำนวยความสะดวก
- ค้นหาห้องว่างตามวันและความจุ สร้างการจองหลายห้อง ดูการจองของตน ยกเลิก
- ล็อกห้องใน transaction ป้องกันการจองพร้อมกัน สร้าง snapshot ราคา
- ส่งหลักฐานชำระเงินและเอกสาร ตรวจโดย admin ไฟล์เป็น private
- check-in/out และค่าใช้จ่ายเพิ่มเติม
- ออกใบเสร็จ PDF ต่อรายการชำระสำเร็จ รองรับภาษาไทยและอังกฤษ
- dashboard, กระแสเงินสดรายวัน, บันทึกคืนเงินเต็มจำนวน

## กติกาเริ่มต้นที่ใช้

1. การจอง pending ถือห้อง 30 นาที สถานะหมดอายุอัปเดตทุกนาทีเมื่อ backend รัน และตอนอ่านรายการ
2. วัน checkout ไม่รวมในคืนเข้าพัก; ตรวจวันที่ตาม Asia/Bangkok
3. ยืนยันการจองเมื่อค่าห้องชำระครบ หรือ admin อนุมัติเอกสารยืนยัน
4. check-in ต้อง confirmed, อยู่ในช่วงวันเข้าพัก, ค่าห้องชำระครบ, มีเอกสาร approved และห้อง available ทุกห้อง
5. check-out ต้องชำระค่าห้อง+ค่าใช้จ่ายเพิ่มครบ ห้องเปลี่ยนเป็น cleaning; admin เปลี่ยนเป็น available หลังทำความสะอาด
6. ยกเลิกได้ก่อนเข้าพักเท่านั้น ถ้ามีเงินชำระสำเร็จให้บันทึกคืนเงินก่อน
7. refund API บันทึกบัญชีเท่านั้น ไม่โอนเงินจริง; คืนเต็มจำนวน payment เท่านั้นและก่อนเข้าพัก
8. เงินสดให้ admin บันทึก; โอน/PromptPay ต้องแนบ file และ admin ตรวจ ไม่ใช่ payment gateway อัตโนมัติ
9. amount/ราคาของ payment ส่งเป็น string เช่น "900.00" ได้; backend คำนวณด้วยหน่วยสตางค์
10. ไฟล์รองรับ PNG/JPEG/PDF สูงสุด 5 MB รูปห้องรองรับ PNG/JPEG เท่านั้น
11. ไม่เก็บเลขบัตรเต็มใน document_number; API รับชนิดเอกสารและไฟล์เท่านั้น
12. ห้องที่มีผู้พักห้ามเปลี่ยนประเภท/สถานะ; ห้องที่มีการจองปัจจุบัน/อนาคตห้ามปิดหรือเปลี่ยนประเภทจนจัดการการจองก่อน

## Login และทดสอบค้นหาห้อง

```powershell
$credential = Get-Credential -Message "บัญชี customer ที่สมัครไว้"
$body = @{ username = $credential.UserName; password = $credential.GetNetworkCredential().Password } | ConvertTo-Json
$login = Invoke-RestMethod -Uri "http://localhost:3000/api/auth/login" -Method Post -ContentType "application/json; charset=utf-8" -Body ([Text.Encoding]::UTF8.GetBytes($body))
$customerHeaders = @{ Authorization = "Bearer $($login.data.access_token)" }
$checkIn = (Get-Date).ToString('yyyy-MM-dd')
$checkOut = (Get-Date).AddDays(1).ToString('yyyy-MM-dd')
$available = Invoke-RestMethod -Uri "http://localhost:3000/api/rooms/availability?check_in=$checkIn&check_out=$checkOut&adults=2&children=0"
$available | ConvertTo-Json -Depth 8
```

## สร้างการจองจริง (เมื่อพร้อมทดสอบ)

```powershell
if ($available.data.Count -eq 0) { throw "ไม่มีห้องว่าง" }
$bookingBody = @{
    check_in_date = $checkIn
    check_out_date = $checkOut
    rooms = @(@{ room_id = $available.data[0].room_id; adult_count = 2; child_count = 0 })
} | ConvertTo-Json -Depth 6
$booking = Invoke-RestMethod -Uri "http://localhost:3000/api/bookings" -Method Post -Headers $customerHeaders -ContentType "application/json" -Body $bookingBody
$bookingId = $booking.data.booking_id
$booking | ConvertTo-Json -Depth 8
Invoke-RestMethod -Uri "http://localhost:3000/api/bookings/$bookingId" -Headers $customerHeaders | ConvertTo-Json -Depth 10
```

Login admin แยกอีกครั้งแล้วตั้ง `$adminHeaders` แบบเดียวกับ customer; อย่าใช้ token customer กับ /api/admin

## ตัวอย่างเงินสด (admin)

```powershell
$paymentBody = @{ amount = $booking.data.total_amount; payment_method = 'cash' } | ConvertTo-Json
$payment = Invoke-RestMethod -Uri "http://localhost:3000/api/bookings/$bookingId/payments" -Method Post -Headers $adminHeaders -ContentType 'application/json' -Body $paymentBody
$paymentId = $payment.data.payment_id
$verified = Invoke-RestMethod -Uri "http://localhost:3000/api/admin/payments/$paymentId/verify" -Method Patch -Headers $adminHeaders -ContentType 'application/json' -Body '{"status":"successful"}'
$receiptId = $verified.data.receipt_id
Invoke-WebRequest -Uri "http://localhost:3000/api/receipts/$receiptId/pdf" -Headers $adminHeaders -OutFile '.\receipt.pdf'
```

ส่งไฟล์ผ่าน multipart/form-data ชื่อช่อง `file` ดู API-CONTRACT.md; ใน Vue ใช้ FormData และไม่กำหนด Content-Type เอง
ต้องอัปโหลดเอกสารและให้ admin อนุมัติก่อน check-in

## SMTP

ตั้ง SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASSWORD, MAIL_FROM, PASSWORD_RESET_URL ใน .env
PASSWORD_RESET_URL เป็น URL หน้า Vue ที่รับ ?token=... แล้วเรียก POST /api/auth/reset-password
reset token ใช้ได้ครั้งเดียวและมีอายุ 30 นาที ถ้าส่งเมลล้มเหลวระบบบันทึกเหตุใน terminal และใช้ข้อความตอบกลับเดียวกันเพื่อไม่เปิดเผยว่ามีบัญชีหรือไม่
JWT ที่ออกก่อนเปลี่ยนรหัสผ่านยังใช้ได้จนหมดอายุ (ค่าเริ่มต้น 1 ชั่วโมง); การปิดบัญชีมีผลในการเรียกครั้งถัดไป

## ทดสอบ

```powershell
npm.cmd test
npm.cmd run test:integration
```

Unit/HTTP tests ใช้ DB จำลอง ส่วน integration สร้างฐานข้อมูล hotel_test_<random> จาก test/schema.sql และ test/seed.sql ทดสอบจริงแล้วลบเฉพาะฐานข้อมูลทดสอบและไฟล์อัปโหลดทดสอบ
integration ต้องใช้บัญชี MySQL ที่มีสิทธิ์ CREATE/DROP DATABASE; ไม่ควรเพิ่มสิทธิ์นี้ให้บัญชีแอปที่เปิดใช้งานจริง ใช้เครื่องพัฒนา
ตรวจ concurrent booking, IDOR, payment/receipt, เอกสาร, stay/charges/balance, refund/cancel, dashboard, expiration และ reset password (SMTP จำลอง)
PDF ตัวอย่างอยู่ test/receipt-preview.pdf ซึ่งมาจากข้อมูลทดสอบ ไม่ใช่ใบเสร็จลูกค้าจริง

## ส่งให้เพื่อนทำ Vue

ส่ง repository และ API-CONTRACT.md ให้เพื่อนแยก customer-web/admin-web
VITE_API_BASE_URL=http://localhost:3000/api
ส่ง Authorization: Bearer <access_token> สำหรับ API ที่ต้อง login; admin ใช้บัญชี admin
response ทั่วไปเป็น {data:...}; error เป็น {error:{code,message}}
401 ให้ login ใหม่; 403 ไม่มีสิทธิ์; 409 แสดงว่าขัดกับสถานะ/ห้องถูกจองแล้ว
รูป/ไฟล์ให้เติม API origin หน้า URL /api/...; private file ใช้ fetch พร้อม Authorization แล้วแสดง/ดาวน์โหลด Blob

frontend ยังต้องเขียนและตกแต่งตาม Figma; backend นี้ไม่ได้ deploy หรือ push GitHub ให้
ก่อนเปิดอินเทอร์เน็ตต้องตั้ง SMTP จริง, HTTPS, DB account เฉพาะ, สำรอง DB/ไฟล์, และ retention เอกสารตามนโยบายโรงแรม
