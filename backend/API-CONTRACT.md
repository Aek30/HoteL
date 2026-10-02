# API สำหรับทีม Frontend

Base URL `http://localhost:3000/api` — JSON ใช้ Content-Type application/json
JWT: `Authorization: Bearer <data.access_token>`
public = ไม่ต้อง login, owner = เจ้าของการจองหรือ admin, admin = admin เท่านั้น
POST/PATCH ไม่รับฟิลด์นอกที่กำหนด; ใช้ null เฉพาะฟิลด์ที่รองรับ

| Method / Path | สิทธิ์ | Input / หมายเหตุ |
|---|---|---|
| GET /health | public | ทดสอบ DB |
| POST /auth/register | public | username,email,password,first_name,last_name,phone |
| POST /auth/login | public | username,password → access_token,user |
| POST /auth/forgot-password | public | email |
| POST /auth/reset-password | public | token,password |
| GET /me | login | user_id,username,email,role |
| PATCH /me/profile | customer | first_name,last_name,phone,address,province,postal_code (เลือกส่ง) |
| GET /room-types | public | ประเภท active |
| GET /room-types/:id | public | ประเภท+images(url)+amenities |
| GET /amenities | public | สิ่งอำนวยความสะดวก active |
| GET /room-images/:id/file | public | รูปประเภท active เท่านั้น |
| GET /rooms/availability | public | query check_in,check_out,adults,children,room_type_id,page,limit |
| GET /admin/room-types | admin | query search,status,page,limit |
| GET /admin/room-types/:id | admin | รายละเอียด |
| POST /admin/room-types | admin | type_name,price_per_night,adult_capacity; child_capacity,bed_count,bed_type,room_size,status,description optional |
| PATCH /admin/room-types/:id | admin | ฟิลด์ประเภทห้องที่ต้องเปลี่ยน |
| DELETE /admin/room-types/:id | admin | ไม่ลบถ้ามี FK อ้างอิง |
| POST /admin/room-types/:id/images | admin | multipart: file,description,is_primary ("true"/"false"),display_order |
| DELETE /admin/room-images/:id | admin | ลบรูปและไฟล์ |
| PUT /admin/room-types/:id/amenities | admin | amenity_ids: [1,2] แทนรายการเดิม |
| GET /admin/amenities | admin | รายการทั้งหมด |
| POST /admin/amenities | admin | amenity_name,icon,description,status |
| PATCH /admin/amenities/:id | admin | ฟิลด์ที่ต้องเปลี่ยน; inactive แทนลบ |
| GET /admin/rooms | admin | query search,floor,room_type_id,room_status,page,limit |
| GET /admin/rooms/:id | admin | รายละเอียดห้องจริง |
| POST /admin/rooms | admin | room_number,room_type_id; floor,room_status,note optional |
| PATCH /admin/rooms/:id | admin | ฟิลด์ห้องที่ต้องเปลี่ยน |
| DELETE /admin/rooms/:id | admin | ไม่ลบถ้ามีประวัติ booking_rooms |
| POST /bookings | customer | check_in_date,check_out_date,rooms:[{room_id,adult_count,child_count}],special_request |
| GET /me/bookings | login | query page,limit,status,search |
| GET /admin/bookings | admin | query page,limit,status,search |
| GET /bookings/:id | owner | booking,rooms,payments,documents,receipts,financial |
| PATCH /bookings/:id/cancel | owner | reason optional; คืนเงินก่อนถ้าชำระแล้ว |
| PATCH /admin/bookings/:id/no-show | admin | confirmed ที่พ้นวันเข้าแล้ว |
| POST /bookings/:id/payments | owner | JSON เงินสด(admin) หรือ multipart โอน: amount,payment_method,reference_number,note,file |
| GET /admin/payments | admin | query status,page,limit |
| GET /payments/:id/proof | owner | ไฟล์แนบแบบดาวน์โหลด |
| PATCH /admin/payments/:id/verify | admin | status:"successful"/"failed",note; คืน receipt_id เมื่อผ่าน |
| PATCH /admin/payments/:id/refund | admin | note จำเป็น; บันทึกคืนเต็มจำนวนก่อนเข้าพัก ไม่ได้โอนเงินจริง |
| POST /bookings/:id/identity-documents | owner | multipart: document_type:"national_id"/"passport",file |
| GET /admin/identity-documents | admin | query status,page,limit |
| GET /identity-documents/:id/file | owner | ไฟล์ส่วนตัว |
| PATCH /admin/identity-documents/:id/review | admin | status:"approved"/"rejected",note |
| POST /admin/bookings/:id/check-in | admin | {} หรือ {note}; คืน stay_id |
| POST /admin/stays/:id/additional-charges | admin | charge_name,quantity,unit_price,note |
| POST /admin/bookings/:id/check-out | admin | ต้องไม่มียอดคงเหลือ |
| GET /receipts/:id/pdf | owner | PDF; fetch ด้วย Authorization แล้วใช้ Blob |
| GET /admin/dashboard | admin | rooms,bookings,pending_payments,pending_documents,arrivals_today |
| GET /admin/reports/cash-flow | admin | query from,to รูปแบบ YYYY-MM-DD |

## ตัวอย่างสร้างการจอง

```json
{
  "check_in_date": "2026-10-06",
  "check_out_date": "2026-10-08",
  "rooms": [{"room_id": 1, "adult_count": 2, "child_count": 0}],
  "special_request": "ขอห้องเงียบ"
}
```

ห้ามส่ง total_amount/customer_id/booking_status เอง ราคาคำนวณบน backend จากประเภทห้องและจำนวนคืน
data ที่ตอบกลับ POST /bookings มี booking_id,booking_number,total_amount,booking_status,expires_at และฟิลด์ booking
GET /bookings/:id มี financial: room_amount,additional_amount,grand_total,paid_amount,balance
Decimal ตอบเป็น string เช่น "1800.00"; ใช้ Number เพื่อจัดรูปแบบแสดงผล แต่ห้ามใช้ราคา frontend เป็นยอด authoritative

## Upload ใน Vue

```javascript
const form = new FormData();
form.set('document_type', 'national_id');
form.set('file', selectedFile);
const response = await fetch(`${baseUrl}/bookings/${bookingId}/identity-documents`, {
  method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form,
});
const result = await response.json();
```

ไฟล์รูปห้องสูงสุด 5 MB PNG/JPEG; หลักฐานและเอกสารรองรับ PDF เพิ่มด้วย
ไม่รับ file_path จาก frontend และไม่มี static URL สำหรับเอกสารส่วนตัว

## สถานะหน้าจอ

pending: จองถือห้อง 30 นาที; ส่งสลิปสำเร็จยังเป็น pending payment
confirmed: ชำระค่าห้องครบหรือเอกสาร approved; check-in ต้องชำระครบและมีเอกสาร approved
checked_in: มี stay; เพิ่ม charges/ชำระส่วนเพิ่มได้
checked_out: ปิด stay ห้อง cleaning
cancelled/expired/no_show: ไม่ถือห้อง

Error {"error":{"code":"...","message":"..."}}: 400 ข้อมูลผิด; 401 login ใหม่; 403 ไม่มีสิทธิ์; 404 ไม่พบ; 409 ขัดกับสถานะ/จองซ้ำ; 413 ไฟล์ใหญ่; 429 ร้องขอถี่เกิน
Availability เป็นผล ณ เวลาค้นหา ต้องรองรับ 409 ROOM_ALREADY_BOOKED ตอนยืนยันจอง

SMTP ต้องตั้งค่าเอง; refund เป็น record เท่านั้น; frontend และ deployment ต้องทำต่อ
